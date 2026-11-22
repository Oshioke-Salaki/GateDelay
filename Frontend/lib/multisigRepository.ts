/**
 * FE-037 – Durable, shared storage for multisig proposals and approvals.
 *
 * Replaces the module-level `Map` previously held by `multisigStore.ts`, which
 * lost every proposal on restart and could not be seen by a second server
 * process.  Records now live on disk under `MULTISIG_STORE_DIR`; every worker
 * that points at the same directory (a local path or a shared volume) sees
 * the same proposals, signatures, and audit history.
 *
 * Concurrency control is per transaction: `update` takes an exclusive lock
 * file (`O_CREAT | O_EXCL`) for the transaction, re-reads the latest record,
 * applies the mutation, and atomically replaces the record via rename.  Two
 * approvals racing on different workers are therefore serialised, so one
 * owner can never be recorded twice and no approval is lost.
 *
 * Layout:
 *   <dir>/tx/<txId>.json     – current record (written via tmp + rename)
 *   <dir>/locks/<txId>.lock  – held only while a mutation is in flight
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Minimal shape the repository needs; the store owns the full record type. */
export interface VersionedRecord {
  id: string;
  /** Monotonic revision, incremented on every committed update. */
  version: number;
  updatedAt: string;
}

export interface MultisigRepository<T extends VersionedRecord> {
  /** Returns the committed record, or `null` when it does not exist. */
  get(id: string): Promise<T | null>;
  /** Persists a new record; throws if a record with this id already exists. */
  create(record: T): Promise<void>;
  /**
   * Runs `mutate` against the latest committed record while holding the
   * transaction lock.  If `mutate` throws, nothing is written.
   */
  update(id: string, mutate: (record: T) => T | void): Promise<T>;
  /** Removes every record.  Intended for tests only. */
  clear(): void;
}

export class RecordNotFoundError extends Error {
  constructor() {
    super("Transaction not found");
  }
}

// Ids are used as file names, so anything outside this set is rejected
// before it can reach the filesystem (e.g. `../` from a URL segment).
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const LOCK_TIMEOUT_MS = 10_000;
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MIN_MS = 5;
const LOCK_RETRY_MAX_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isErrno(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as NodeJS.ErrnoException).code === code
  );
}

export class FileMultisigRepository<T extends VersionedRecord>
  implements MultisigRepository<T>
{
  private readonly txDir: string;
  private readonly lockDir: string;

  constructor(readonly dir: string) {
    this.txDir = path.join(dir, "tx");
    this.lockDir = path.join(dir, "locks");
    fs.mkdirSync(this.txDir, { recursive: true });
    fs.mkdirSync(this.lockDir, { recursive: true });
  }

  async get(id: string): Promise<T | null> {
    if (!SAFE_ID.test(id)) return null;
    try {
      const raw = await fsp.readFile(this.recordPath(id), "utf8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if (isErrno(err, "ENOENT")) return null;
      throw err;
    }
  }

  async create(record: T): Promise<void> {
    this.assertSafeId(record.id);
    const tmp = await this.writeTemp(record);
    try {
      // link() fails with EEXIST instead of overwriting, so two workers that
      // somehow generate the same id cannot clobber each other.
      await fsp.link(tmp, this.recordPath(record.id));
    } catch (err) {
      if (isErrno(err, "EEXIST")) {
        throw new Error(`Transaction ${record.id} already exists`);
      }
      throw err;
    } finally {
      await fsp.rm(tmp, { force: true });
    }
  }

  async update(id: string, mutate: (record: T) => T | void): Promise<T> {
    if (!SAFE_ID.test(id)) throw new RecordNotFoundError();

    const release = await this.acquireLock(id);
    try {
      const current = await this.get(id);
      if (!current) throw new RecordNotFoundError();

      const draft = structuredClone(current);
      const next = mutate(draft) ?? draft;
      next.version = current.version + 1;
      next.updatedAt = new Date().toISOString();

      const tmp = await this.writeTemp(next);
      await fsp.rename(tmp, this.recordPath(id));
      return next;
    } finally {
      await release();
    }
  }

  clear(): void {
    fs.rmSync(this.txDir, { recursive: true, force: true });
    fs.rmSync(this.lockDir, { recursive: true, force: true });
    fs.mkdirSync(this.txDir, { recursive: true });
    fs.mkdirSync(this.lockDir, { recursive: true });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private recordPath(id: string): string {
    return path.join(this.txDir, `${id}.json`);
  }

  private assertSafeId(id: string): void {
    if (!SAFE_ID.test(id)) {
      throw new Error(`Invalid transaction id: ${id}`);
    }
  }

  private async writeTemp(record: T): Promise<string> {
    const tmp = path.join(this.txDir, `.${record.id}.${randomUUID()}.tmp`);
    const handle = await fsp.open(tmp, "w");
    try {
      await handle.writeFile(JSON.stringify(record));
      await handle.sync();
    } finally {
      await handle.close();
    }
    return tmp;
  }

  private async acquireLock(id: string): Promise<() => Promise<void>> {
    const lockPath = path.join(this.lockDir, `${id}.lock`);
    const deadline = Date.now() + LOCK_TIMEOUT_MS;

    for (;;) {
      try {
        const handle = await fsp.open(lockPath, "wx");
        await handle.writeFile(
          JSON.stringify({ pid: process.pid, host: os.hostname(), at: Date.now() }),
        );
        await handle.close();
        return () => fsp.rm(lockPath, { force: true });
      } catch (err) {
        if (!isErrno(err, "EEXIST")) throw err;
      }

      // A worker that crashed mid-update leaves its lock behind; reclaim it
      // once it is clearly older than any legitimate update could take.
      try {
        const { mtimeMs } = await fsp.stat(lockPath);
        if (Date.now() - mtimeMs > LOCK_STALE_MS) {
          await fsp.rm(lockPath, { force: true });
          continue;
        }
      } catch (err) {
        if (!isErrno(err, "ENOENT")) throw err;
        continue;
      }

      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for lock on transaction ${id}`);
      }
      await sleep(
        LOCK_RETRY_MIN_MS + Math.random() * (LOCK_RETRY_MAX_MS - LOCK_RETRY_MIN_MS),
      );
    }
  }
}

/**
 * Resolve the storage directory.
 *
 * - `MULTISIG_STORE_DIR` wins in every environment; point all workers at the
 *   same path (or shared volume) so they share state.
 * - Under test, each process gets a private temp directory so parallel test
 *   files never wipe each other's records.
 * - Otherwise default to `<cwd>/.data/multisig`.
 */
export function resolveMultisigStoreDir(): string {
  const configured = process.env.MULTISIG_STORE_DIR?.trim();
  if (configured) return path.resolve(configured);

  if (process.env.NODE_ENV === "test") {
    return fs.mkdtempSync(path.join(os.tmpdir(), "gatedelay-multisig-"));
  }

  return path.join(process.cwd(), ".data", "multisig");
}
