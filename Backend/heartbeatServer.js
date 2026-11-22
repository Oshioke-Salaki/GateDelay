const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { router, setService } = require('./routes/heartbeat');
const { HeartbeatService } = require('./services/heartbeat');
const monitor = require('./jobs/heartbeatMonitor');
const { createMarketFactoryWatcher } = require('./services/marketFactoryEvents');

const PORT = parseInt(process.env.HEARTBEAT_PORT || '4001', 10);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use('/api/heartbeat', router);

io.on('connection', (socket) => {
  console.log(`[HeartbeatServer] Socket connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[HeartbeatServer] Socket disconnected: ${socket.id}`);
  });
});

const service = new HeartbeatService();
setService(service);

if (service.redis && typeof service.redis.on === 'function') {
  service.redis.on('error', (err) => {
    console.warn(`[HeartbeatServer] Redis unavailable: ${err.message}`);
  });
}

service.on('alert', (alert) => {
  io.emit('heartbeat:alert', alert);
});

service.on('recovered', (data) => {
  io.emit('heartbeat:recovered', data);
});

const marketFactoryWatcher = createMarketFactoryWatcher({ service, io });

function startHeartbeatServer(options = {}) {
  const port = options.port != null ? options.port : PORT;
  const logger = options.logger || console;

  return new Promise((resolve) => {
    server.once('listening', () => {
      try {
        monitor.startMonitoring(service);
      } catch (err) {
        logger.warn(`[HeartbeatServer] monitor failed to start: ${err.message}`);
      }
      try {
        marketFactoryWatcher.start();
      } catch (err) {
        logger.warn(`[HeartbeatServer] MarketFactory watcher failed to start: ${err.message}`);
      }
      logger.log(`Heartbeat server running on port ${port}`);
      resolve({ app, server, io, service, marketFactoryWatcher });
    });
    server.on('error', (err) => {
      logger.error(`[HeartbeatServer] failed to listen on port ${port}: ${err.message}`);
      resolve({ app, server, io, service, marketFactoryWatcher, error: err });
    });
    server.listen(port);
  });
}

async function stopHeartbeatServer() {
  try {
    marketFactoryWatcher.stop();
  } catch {}
  try {
    monitor.stopMonitoring();
  } catch {}
  try {
    await service.destroy();
  } catch {}
  await new Promise((resolve) => {
    io.close(() => server.close(resolve));
  });
}

process.on('SIGTERM', async () => {
  console.log('Shutting down heartbeat server...');
  await stopHeartbeatServer();
  process.exit(0);
});

if (require.main === module) {
  startHeartbeatServer();
}

module.exports = {
  app,
  server,
  io,
  service,
  marketFactoryWatcher,
  startHeartbeatServer,
  stopHeartbeatServer,
};