/**
 * jobRetryService.js — bounded retries and dead-letter logging for background jobs.
 *
 * Background work in this codebase runs from four different places (Bull
 * consumers, node-cron schedules, Agenda, and plain setInterval loops) and most
 * of them handled failure the same way: log it and move on. That loses two
 * things operators need — a transient failure gets exactly one attempt, and
 * when it is genuinely dead there is no durable record that it was ever tried,
 * what it was carrying, or how many times it failed.
 *
 * This module supplies both halves:
 *   - `withRetry` runs a job at most `maxAttempts` times with capped exponential
 *     backoff, so a job cannot spin forever on a permanent failure;
 *   - when the attempts are exhausted the failure is dead-lettered — logged
 *     with the full recovery context and retained in a bounded in-process
 *     buffer that `getDeadLetters()` exposes for inspection.
 *
 * Queue workers that own their own retry policy (Bull's `attempts`) call
 * `recordQueueFailure` instead, so a job is only dead-lettered on its final
 * failed attempt rather than on every retry.
 *
 * Closes #913
 */

'use strict';

const { log } = require('../utils/correlation');

const DEFAULTS = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  factor: 2,
  deadLetterLimit: 500,
};

const MAX_ATTEMPTS_CEILING = 100;

function readInt(
  raw,
  fallback,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    return fallback;
  }
  return Math.min(Math.floor(value), max);
}

function readFloat(
  raw,
  fallback,
  { min = 0, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    return fallback;
  }
  return Math.min(value, max);
}

const CONFIG = {
  maxAttempts: readInt(process.env.JOB_MAX_ATTEMPTS, DEFAULTS.maxAttempts, {
    max: MAX_ATTEMPTS_CEILING,
  }),
  baseDelayMs: readInt(
    process.env.JOB_RETRY_BASE_DELAY_MS,
    DEFAULTS.baseDelayMs,
  ),
  maxDelayMs: readInt(process.env.JOB_RETRY_MAX_DELAY_MS, DEFAULTS.maxDelayMs),
  factor: readFloat(process.env.JOB_RETRY_FACTOR, DEFAULTS.factor, { min: 1 }),
};

const deadLetters = [];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeError(err) {
  if (!err) {
    return { name: 'Error', message: 'Unknown error' };
  }
  return {
    name: err.name || 'Error',
    message: err.message || String(err),
    ...(err.stack ? { stack: err.stack } : {}),
  };
}

function defaultShouldRetry() {
  return true;
}

/** Capped exponential backoff: delay = base * factor^(attempt-1), capped. */
function computeBackoffMs(
  attempt,
  { baseDelayMs, factor, maxDelayMs, jitter },
) {
  const raw = baseDelayMs * factor ** Math.max(0, attempt - 1);
  const capped = Math.min(raw, maxDelayMs);
  if (!jitter) {
    return Math.round(capped);
  }
  // Full jitter: spread retries so a fleet of workers does not resynchronise
  // into a thundering herd against the same dependency.
  return Math.round(Math.random() * capped);
}

/**
 * Record a dead-lettered job: a bounded, inspectable copy plus one structured
 * log line carrying everything needed to recover the job by hand.
 *
 * @param {object} entry
 * @param {string} entry.job          - job name
 * @param {number} entry.attempts     - attempts actually made
 * @param {number} [entry.maxAttempts]
 * @param {Error}  [entry.error]
 * @param {string} [entry.queue]
 * @param {string} [entry.jobId]
 * @param {object} [entry.payload]    - what the job was carrying
 * @param {object} [entry.context]    - extra operator context
 */
function deadLetter(entry) {
  const record = {
    id: `dl_${Date.now()}_${deadLetters.length}`,
    job: entry.job || 'unknown-job',
    queue: entry.queue ?? null,
    jobId: entry.jobId ?? null,
    attempts: entry.attempts ?? 0,
    maxAttempts: entry.maxAttempts ?? null,
    error: describeError(entry.error),
    payload: entry.payload ?? null,
    context: entry.context ?? null,
    failedAt: new Date().toISOString(),
  };

  deadLetters.push(record);
  // Bounded ring: a dead-letter buffer that grows without limit is a second
  // outage waiting to happen.
  while (deadLetters.length > DEFAULTS.deadLetterLimit) {
    deadLetters.shift();
  }

  log('error', 'Background job dead-lettered after exhausting retries', {
    job: record.job,
    queue: record.queue,
    jobId: record.jobId,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    error: record.error.message,
    errorName: record.error.name,
    errorStack: record.error.stack,
    payload: record.payload,
    context: record.context,
    deadLetterId: record.id,
    failedAt: record.failedAt,
  });

  return record;
}

/**
 * Run `task` with bounded retries.
 *
 * @param {(attempt: number) => Promise<unknown>} task
 * @param {object}  [options]
 * @param {string}  [options.job]         - job name used in logs for recovery
 * @param {number}  [options.maxAttempts] - defaults to JOB_MAX_ATTEMPTS (3)
 * @param {number}  [options.baseDelayMs]
 * @param {number}  [options.maxDelayMs]
 * @param {number}  [options.factor]
 * @param {boolean} [options.jitter]      - set false for deterministic delays
 * @param {string}  [options.queue]
 * @param {string}  [options.jobId]
 * @param {object}  [options.payload]     - recorded with the dead letter
 * @param {object}  [options.context]
 * @param {(err: Error, attempt: number) => boolean} [options.shouldRetry]
 * @param {(info: {attempt: number, delayMs: number, error: Error}) => void} [options.onRetry]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @returns {Promise<unknown>} the task's result
 * @throws the final error, after dead-lettering it
 */
async function withRetry(task, options = {}) {
  if (typeof task !== 'function') {
    throw new TypeError('[job-retry] withRetry requires a task function');
  }

  const job = options.job || 'unnamed-job';
  const maxAttempts = readInt(options.maxAttempts, CONFIG.maxAttempts, {
    max: MAX_ATTEMPTS_CEILING,
  });
  const backoff = {
    baseDelayMs: readInt(options.baseDelayMs, CONFIG.baseDelayMs),
    maxDelayMs: readInt(options.maxDelayMs, CONFIG.maxDelayMs),
    factor: readFloat(options.factor, CONFIG.factor, { min: 1 }),
    jitter: options.jitter !== false,
  };
  const shouldRetry = options.shouldRetry || defaultShouldRetry;
  const wait = options.sleep || sleep;

  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      // eslint-disable-next-line no-await-in-loop
      return await task(attempt);
    } catch (err) {
      const retryable = shouldRetry(err, attempt);
      if (attempt >= maxAttempts || !retryable) {
        deadLetter({
          job,
          queue: options.queue,
          jobId: options.jobId,
          attempts: attempt,
          maxAttempts,
          error: err,
          payload: options.payload,
          context: {
            ...options.context,
            reason: retryable ? 'attempts-exhausted' : 'error-not-retryable',
          },
        });
        throw err;
      }

      const delayMs = computeBackoffMs(attempt, backoff);
      log('warn', 'Background job attempt failed; retrying', {
        job,
        queue: options.queue,
        jobId: options.jobId,
        attempt,
        maxAttempts,
        delayMs,
        error: err.message,
      });
      if (typeof options.onRetry === 'function') {
        options.onRetry({ attempt, delayMs, error: err });
      }
      // eslint-disable-next-line no-await-in-loop
      await wait(delayMs);
    }
  }
}

/**
 * Has a queue job used up every attempt Bull gave it?
 *
 * Bull emits `failed` on every attempt, so dead-lettering on the first one
 * would bury a job that is about to succeed on retry.
 */
function isExhausted(job) {
  if (!job) {
    return true;
  }
  const allowed = Number(job.opts?.attempts ?? 1);
  const made = Number(job.attemptsMade ?? 0);
  return made >= allowed;
}

/**
 * Dead-letter a queue job, but only once its retries are spent.
 *
 * @param {object} job   - the Bull job from the `failed` event
 * @param {Error}  err
 * @param {object} [options]
 * @param {string} [options.queue]
 * @param {string} [options.job]  - job name; defaults to the queue name
 * @returns {object|null} the dead-letter record, or null if retries remain
 */
function recordQueueFailure(job, err, options = {}) {
  if (!isExhausted(job)) {
    return null;
  }
  return deadLetter({
    job: options.job || options.queue || job?.queue?.name || 'queue-job',
    queue: options.queue ?? job?.queue?.name ?? null,
    jobId: job?.id != null ? String(job.id) : null,
    attempts: Number(job?.attemptsMade ?? 0),
    maxAttempts: Number(job?.opts?.attempts ?? 1),
    error: err,
    payload: job?.data ?? null,
    context: options.context,
  });
}

/** Dead letters still held in memory, oldest first. */
function getDeadLetters() {
  return deadLetters.slice();
}

/** Number of dead letters currently retained. */
function getDeadLetterCount() {
  return deadLetters.length;
}

/** Drop retained dead letters. Intended for operators and tests. */
function clearDeadLetters() {
  const removed = deadLetters.length;
  deadLetters.length = 0;
  return removed;
}

module.exports = {
  CONFIG,
  DEFAULTS,
  clearDeadLetters,
  computeBackoffMs,
  deadLetter,
  getDeadLetterCount,
  getDeadLetters,
  isExhausted,
  recordQueueFailure,
  withRetry,
};
