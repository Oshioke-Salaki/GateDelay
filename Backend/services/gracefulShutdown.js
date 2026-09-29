/**
 * GRACEFUL SHUTDOWN MANAGER
 * Manages signal capture (SIGTERM, SIGINT), ordered teardown of application resources,
 * draining of background workers, WebSocket gateway disconnection, and DB/cache cleanup.
 *
 * Requirements (#921):
 * - Capture OS termination signals (SIGTERM, SIGINT) and trigger coordinated shutdown.
 * - Stop accepting new HTTP requests while allowing active requests & background workers to finish.
 * - Gracefully disconnect active WebSocket gateway clients with close frames/notifications.
 * - Safely flush and close database and cache connection pools without dropping inflight transactions.
 * - Timeout safeguard: force exit if graceful draining exceeds threshold limits.
 */

const { EventEmitter } = require('events');

const SHUTDOWN_PHASES = {
  INGRESS: 'ingress',        // Phase 1: Halt HTTP ingress (reject new, drain inflight)
  WORKERS: 'workers',        // Phase 2: Stop timers, pollers, and queue workers
  WEBSOCKETS: 'websockets',  // Phase 3: Notify & disconnect WebSocket clients/gateways
  DATABASE: 'database',      // Phase 4: Close DB (Mongoose) & Cache (Redis) connection pools
};

class GracefulShutdownManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.timeoutMs =
      options.timeoutMs ||
      parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
    this.isShuttingDown = false;
    this.shutdownCompleted = false;
    this.shutdownPromise = null;
    this.exitOnComplete =
      options.exitOnComplete !== undefined ? options.exitOnComplete : true;
    this.logger = options.logger || console;

    this.registry = {
      [SHUTDOWN_PHASES.INGRESS]: [],
      [SHUTDOWN_PHASES.WORKERS]: [],
      [SHUTDOWN_PHASES.WEBSOCKETS]: [],
      [SHUTDOWN_PHASES.DATABASE]: [],
    };

    this.executionLog = [];
    this.signalListenersAttached = false;
    this._sigtermHandler = null;
    this._sigintHandler = null;
  }

  /**
   * Register a cleanup handler for a specific phase.
   * @param {string} phase - One of SHUTDOWN_PHASES
   * @param {string} name - Human-readable label for hook
   * @param {Function} fn - Async or sync cleanup function
   */
  register(phase, name, fn) {
    if (!Object.values(SHUTDOWN_PHASES).includes(phase)) {
      throw new Error(
        `Invalid shutdown phase: "${phase}". Must be one of: ${Object.values(
          SHUTDOWN_PHASES,
        ).join(', ')}`,
      );
    }
    if (typeof fn !== 'function') {
      throw new Error(
        `Cleanup handler for "${name}" in phase "${phase}" must be a function`,
      );
    }
    this.registry[phase].push({ name, fn });
    return this;
  }

  registerIngress(name, fn) {
    return this.register(SHUTDOWN_PHASES.INGRESS, name, fn);
  }

  registerWorker(name, fn) {
    return this.register(SHUTDOWN_PHASES.WORKERS, name, fn);
  }

  registerWebSocket(name, fn) {
    return this.register(SHUTDOWN_PHASES.WEBSOCKETS, name, fn);
  }

  registerDatabase(name, fn) {
    return this.register(SHUTDOWN_PHASES.DATABASE, name, fn);
  }

  /**
   * Attach SIGTERM and SIGINT listeners to process.
   */
  attachSignalListeners() {
    if (this.signalListenersAttached) return;

    this._sigtermHandler = () => {
      this.logger.log(
        '[Shutdown] Received SIGTERM signal. Initiating graceful shutdown...',
      );
      this.initiateShutdown('SIGTERM').catch((err) => {
        this.logger.error('[Shutdown] Unhandled error during SIGTERM shutdown:', err);
      });
    };

    this._sigintHandler = () => {
      this.logger.log(
        '[Shutdown] Received SIGINT signal. Initiating graceful shutdown...',
      );
      this.initiateShutdown('SIGINT').catch((err) => {
        this.logger.error('[Shutdown] Unhandled error during SIGINT shutdown:', err);
      });
    };

    process.on('SIGTERM', this._sigtermHandler);
    process.on('SIGINT', this._sigintHandler);
    this.signalListenersAttached = true;
  }

  /**
   * Detach signal listeners from process.
   */
  removeSignalListeners() {
    if (!this.signalListenersAttached) return;
    if (this._sigtermHandler)
      process.removeListener('SIGTERM', this._sigtermHandler);
    if (this._sigintHandler)
      process.removeListener('SIGINT', this._sigintHandler);
    this.signalListenersAttached = false;
    this._sigtermHandler = null;
    this._sigintHandler = null;
  }

  /**
   * Trigger the coordinated shutdown sequence across all registered phases.
   * @param {string} [signal='MANUAL']
   * @returns {Promise<object>}
   */
  async initiateShutdown(signal = 'MANUAL') {
    if (this.isShuttingDown) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    this.emit('shutdown:start', { signal, timestamp: new Date().toISOString() });

    this.shutdownPromise = (async () => {
      let timeoutTimer = null;

      const timeoutPromise = new Promise((_, reject) => {
        timeoutTimer = setTimeout(() => {
          const err = new Error(
            `Graceful shutdown sequence timed out after ${this.timeoutMs}ms`,
          );
          err.code = 'SHUTDOWN_TIMEOUT';
          reject(err);
        }, this.timeoutMs);
        if (timeoutTimer && timeoutTimer.unref) timeoutTimer.unref();
      });

      const executeSequence = async () => {
        const phases = [
          SHUTDOWN_PHASES.INGRESS,
          SHUTDOWN_PHASES.WORKERS,
          SHUTDOWN_PHASES.WEBSOCKETS,
          SHUTDOWN_PHASES.DATABASE,
        ];

        for (const phase of phases) {
          const items = this.registry[phase];
          if (!items || items.length === 0) continue;

          this.logger.log(
            `[Shutdown] Executing Phase: ${phase.toUpperCase()} (${items.length} handlers)`,
          );
          this.emit('shutdown:phase', { phase, count: items.length });

          for (const item of items) {
            const start = Date.now();
            try {
              this.logger.log(
                `[Shutdown] Running teardown hook: ${item.name} (${phase})`,
              );
              await item.fn();
              const duration = Date.now() - start;
              this.executionLog.push({
                phase,
                name: item.name,
                status: 'success',
                duration,
              });
            } catch (err) {
              const duration = Date.now() - start;
              this.logger.error(
                `[Shutdown] Error in teardown hook ${item.name} (${phase}):`,
                err.message,
              );
              this.executionLog.push({
                phase,
                name: item.name,
                status: 'error',
                error: err.message,
                duration,
              });
            }
          }
        }
      };

      try {
        await Promise.race([executeSequence(), timeoutPromise]);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        this.shutdownCompleted = true;
        this.emit('shutdown:complete', { signal, log: this.executionLog });
        this.logger.log(
          '[Shutdown] Graceful shutdown sequence completed successfully.',
        );
        if (this.exitOnComplete) {
          process.exit(0);
        }
        return { success: true, signal, log: this.executionLog };
      } catch (err) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        this.emit('shutdown:error', {
          signal,
          error: err.message,
          log: this.executionLog,
        });
        this.logger.error(
          '[Shutdown] Graceful shutdown failed or timed out:',
          err.message,
        );
        if (this.exitOnComplete) {
          process.exit(1);
        }
        throw err;
      }
    })();

    return this.shutdownPromise;
  }

  /**
   * Get overall manager status and log.
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      shutdownCompleted: this.shutdownCompleted,
      signalListenersAttached: this.signalListenersAttached,
      timeoutMs: this.timeoutMs,
      registeredCounts: {
        ingress: this.registry[SHUTDOWN_PHASES.INGRESS].length,
        workers: this.registry[SHUTDOWN_PHASES.WORKERS].length,
        websockets: this.registry[SHUTDOWN_PHASES.WEBSOCKETS].length,
        database: this.registry[SHUTDOWN_PHASES.DATABASE].length,
      },
      executionLog: [...this.executionLog],
    };
  }

  /**
   * Reset manager state (useful for test isolation).
   */
  reset() {
    this.removeSignalListeners();
    this.isShuttingDown = false;
    this.shutdownCompleted = false;
    this.shutdownPromise = null;
    this.executionLog = [];
    this.registry = {
      [SHUTDOWN_PHASES.INGRESS]: [],
      [SHUTDOWN_PHASES.WORKERS]: [],
      [SHUTDOWN_PHASES.WEBSOCKETS]: [],
      [SHUTDOWN_PHASES.DATABASE]: [],
    };
  }
}

// Singleton instance
const defaultManager = new GracefulShutdownManager();

module.exports = defaultManager;
module.exports.GracefulShutdownManager = GracefulShutdownManager;
module.exports.SHUTDOWN_PHASES = SHUTDOWN_PHASES;
