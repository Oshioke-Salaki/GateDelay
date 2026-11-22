const http = require('http');
const express = require('express');
const {
  GracefulShutdownManager,
  SHUTDOWN_PHASES,
} = require('../services/gracefulShutdown');

describe('Graceful Shutdown Lifecycle & Teardown Suite', () => {
  let manager;

  beforeEach(() => {
    manager = new GracefulShutdownManager({
      timeoutMs: 3000,
      exitOnComplete: false, // Prevent tests from exiting process
      logger: { log: () => {}, error: () => {}, warn: () => {} },
    });
  });

  afterEach(() => {
    if (manager) {
      manager.reset();
    }
  });

  describe('Signal Capture', () => {
    it('should attach SIGTERM and SIGINT listeners and capture signals', async () => {
      let capturedSignal = null;
      manager.on('shutdown:start', ({ signal }) => {
        capturedSignal = signal;
      });

      manager.attachSignalListeners();
      expect(manager.getStatus().signalListenersAttached).toBe(true);

      // Emit simulated SIGTERM signal to process
      process.emit('SIGTERM');

      // Wait for async shutdown sequence
      await manager.shutdownPromise;

      expect(capturedSignal).toBe('SIGTERM');
      expect(manager.getStatus().isShuttingDown).toBe(true);
      expect(manager.getStatus().shutdownCompleted).toBe(true);
    });

    it('should handle SIGINT signal cleanly', async () => {
      let capturedSignal = null;
      manager.on('shutdown:start', ({ signal }) => {
        capturedSignal = signal;
      });

      manager.attachSignalListeners();
      process.emit('SIGINT');

      await manager.shutdownPromise;

      expect(capturedSignal).toBe('SIGINT');
      expect(manager.getStatus().shutdownCompleted).toBe(true);
    });
  });

  describe('Ordered Execution Sequence', () => {
    it('should execute teardown hooks strictly in phase order: INGRESS -> WORKERS -> WEBSOCKETS -> DATABASE', async () => {
      const executionOrder = [];

      manager.registerDatabase('Mongoose DB', async () => {
        executionOrder.push('DATABASE');
      });

      manager.registerWebSocket('PriceGateway Sockets', async () => {
        executionOrder.push('WEBSOCKETS');
      });

      manager.registerWorker('SyncWorker Cron', async () => {
        executionOrder.push('WORKERS');
      });

      manager.registerIngress('Express HTTP Server', async () => {
        executionOrder.push('INGRESS');
      });

      const result = await manager.initiateShutdown('TEST_ORDER');

      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(['INGRESS', 'WORKERS', 'WEBSOCKETS', 'DATABASE']);
    });

    it('should log execution status and duration for each registered hook', async () => {
      manager.registerIngress('HTTP Server', async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      manager.registerWorker('Worker Pool', async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      await manager.initiateShutdown('TEST_LOG');

      const status = manager.getStatus();
      expect(status.executionLog.length).toBe(2);
      expect(status.executionLog[0]).toMatchObject({
        phase: SHUTDOWN_PHASES.INGRESS,
        name: 'HTTP Server',
        status: 'success',
      });
      expect(status.executionLog[1]).toMatchObject({
        phase: SHUTDOWN_PHASES.WORKERS,
        name: 'Worker Pool',
        status: 'success',
      });
    });

    it('should continue executing remaining phases even if one hook throws an error', async () => {
      const executed = [];

      manager.registerIngress('Failing Ingress', async () => {
        executed.push('INGRESS_FAIL');
        throw new Error('Failed to stop HTTP server');
      });

      manager.registerWorker('Background Worker', async () => {
        executed.push('WORKER_SUCCESS');
      });

      manager.registerDatabase('DB Pool', async () => {
        executed.push('DATABASE_SUCCESS');
      });

      await manager.initiateShutdown('TEST_ERROR_CONTINUATION');

      expect(executed).toEqual(['INGRESS_FAIL', 'WORKER_SUCCESS', 'DATABASE_SUCCESS']);
      const log = manager.getStatus().executionLog;
      expect(log[0]).toMatchObject({ name: 'Failing Ingress', status: 'error' });
      expect(log[1]).toMatchObject({ name: 'Background Worker', status: 'success' });
      expect(log[2]).toMatchObject({ name: 'DB Pool', status: 'success' });
    });
  });

  describe('HTTP Server Ingress Draining', () => {
    let app;
    let server;
    let serverPort;

    beforeEach((done) => {
      app = express();
      server = http.createServer(app);
      server.listen(0, () => {
        serverPort = server.address().port;
        done();
      });
    });

    afterEach((done) => {
      if (server.listening) {
        server.close(done);
      } else {
        done();
      }
    });

    it('should stop HTTP server from accepting new connections while completing inflight requests', async () => {
      let inflightStarted = false;
      let inflightCompleted = false;

      let resolveRoute = null;
      const routeHoldPromise = new Promise((resolve) => {
        resolveRoute = resolve;
      });

      app.get('/inflight', async (req, res) => {
        inflightStarted = true;
        await routeHoldPromise;
        inflightCompleted = true;
        res.json({ ok: true });
      });

      manager.registerIngress('Test HTTP Server', () => {
        return new Promise((resolve) => {
          server.close(() => resolve());
        });
      });

      // Start inflight HTTP request with Connection: close
      const reqPromise = new Promise((resolve, reject) => {
        const req = http.get(
          `http://127.0.0.1:${serverPort}/inflight`,
          { headers: { Connection: 'close' } },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(JSON.parse(data)));
          },
        );
        req.on('error', reject);
      });

      // Wait for server to receive and start processing the request
      while (!inflightStarted) {
        await new Promise((r) => setTimeout(r, 10));
      }

      // Initiate shutdown — server stops accepting new connections
      const shutdownPromise = manager.initiateShutdown('TEST_INGRESS');

      // Attempt new HTTP request after server.close() — should be rejected with ECONNREFUSED
      const newReqPromise = new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${serverPort}/inflight`, () => {
          resolve('connected');
        });
        req.on('error', (err) => resolve(`rejected:${err.code}`));
      });

      const newReqResult = await newReqPromise;
      expect(newReqResult).toMatch(/rejected:ECONNREFUSED/);

      // Now release holding route and allow inflight request to finish
      resolveRoute();

      const response = await reqPromise;
      await shutdownPromise;

      expect(inflightCompleted).toBe(true);
      expect(response).toEqual({ ok: true });
      expect(server.listening).toBe(false);
    });
  });

  describe('WebSocket Gateway Client Disconnection', () => {
    it('should send shutdown notification frame and disconnect active WebSocket clients', async () => {
      let shutdownPayload = null;
      let disconnectedFlag = false;

      const mockSocket = {
        id: 'socket-999',
        emit: (event, data) => {
          if (event === 'shutdown') shutdownPayload = data;
        },
        disconnect: (flag) => {
          disconnectedFlag = flag;
        },
      };

      const mockIoServer = {
        sockets: {
          sockets: new Map([['socket-999', mockSocket]]),
          forEach: function (cb) {
            this.sockets.forEach(cb);
          },
        },
        close: (cb) => cb && cb(),
      };

      manager.registerWebSocket('Price Gateway WebSocket', () => {
        return new Promise((resolve) => {
          mockIoServer.sockets.forEach((socket) => {
            socket.emit('shutdown', { message: 'Server shutting down' });
            socket.disconnect(true);
          });
          mockIoServer.close(() => resolve());
        });
      });

      await manager.initiateShutdown('TEST_WEBSOCKET');

      expect(shutdownPayload).toEqual({ message: 'Server shutting down' });
      expect(disconnectedFlag).toBe(true);
    });
  });

  describe('Database and Cache Pool Disconnection', () => {
    it('should safely flush and close DB and cache connection pools', async () => {
      let mongooseClosed = false;
      let redisClosed = false;

      const mockMongooseConnection = {
        readyState: 1,
        close: async () => {
          mongooseClosed = true;
        },
      };

      const mockRedisClient = {
        connected: true,
        disconnect: () => {
          redisClosed = true;
        },
      };

      manager.registerDatabase('Mongoose DB', async () => {
        if (mockMongooseConnection.readyState !== 0) {
          await mockMongooseConnection.close();
        }
      });

      manager.registerDatabase('Redis Cache', async () => {
        if (mockRedisClient.connected) {
          mockRedisClient.disconnect();
        }
      });

      await manager.initiateShutdown('TEST_DB_CACHE');

      expect(mongooseClosed).toBe(true);
      expect(redisClosed).toBe(true);
    });
  });

  describe('Timeout Safeguard & Idempotency', () => {
    it('should reject with SHUTDOWN_TIMEOUT error when a teardown hook exceeds timeout limit', async () => {
      const fastManager = new GracefulShutdownManager({
        timeoutMs: 150,
        exitOnComplete: false,
        logger: { log: () => {}, error: () => {}, warn: () => {} },
      });

      fastManager.registerIngress('Hanging Ingress Hook', () => {
        return new Promise(() => {}); // Never resolves
      });

      await expect(fastManager.initiateShutdown('TEST_TIMEOUT')).rejects.toThrow(
        /Graceful shutdown sequence timed out after 150ms/,
      );

      fastManager.reset();
    });

    it('should prevent duplicate shutdown executions when initiateShutdown is called concurrently', async () => {
      let callCount = 0;

      manager.registerWorker('Single Worker', async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 50));
      });

      const p1 = manager.initiateShutdown('SIGTERM');
      const p2 = manager.initiateShutdown('SIGINT');

      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1).toBe(res2);
      expect(callCount).toBe(1);
    });
  });
});
