import type { Pool, PoolClient } from "pg";

export interface CreditParams {
  idempotencyKey: string;
  userId: string;
  asset: string;
  amount: string;       // decimal string, never a JS float
  referenceId: string;  // e.g. deposit id
}

export interface CreditResult {
  credited: boolean;    // true = new credit applied, false = already existed
}

export class LedgerService {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotently credit a user's balance. Safe to call repeatedly with the same key.
   * Pass `client` to run inside a caller-owned transaction.
   */
  async creditDeposit(params: CreditParams, client?: PoolClient): Promise<CreditResult> {
    if (!params.idempotencyKey) throw new Error("idempotencyKey is required");

    const run = async (c: PoolClient): Promise<CreditResult> => {
      const inserted = await c.query(
        `INSERT INTO ledger_entries
           (idempotency_key, user_id, asset, amount, type, reference_id)
         VALUES ($1, $2, $3, $4, 'deposit', $5)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [params.idempotencyKey, params.userId, params.asset, params.amount, params.referenceId]
      );

      if (inserted.rowCount === 0) {
        return { credited: false }; // already credited earlier
      }

      // Only touch the cached balance when the ledger insert actually happened.
      await c.query(
        `INSERT INTO balances (user_id, asset, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, asset)
         DO UPDATE SET amount = balances.amount + EXCLUDED.amount`,
        [params.userId, params.asset, params.amount]
      );

      return { credited: true };
    };

    if (client) return run(client);

    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const result = await run(c);
      await c.query("COMMIT");
      return result;
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    } finally {
      c.release();
    }
  }
}
