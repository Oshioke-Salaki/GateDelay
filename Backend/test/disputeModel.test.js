const mongoose = require('mongoose');

const {
  Dispute,
  DISPUTE_STATUSES,
  VALID_TRANSITIONS,
} = require('../models/Dispute');

/**
 * Contract tests for Backend/models/Dispute.js.
 *
 * These run without a MongoDB connection on purpose: everything asserted here is
 * schema/model shape, which is what breaks the dev server on boot. `npm run
 * start:dev` runs `nest start --watch`, so this module is re-required on every
 * file change — the failure mode this guards against is a boot-time throw, not
 * a query returning the wrong rows.
 */

describe('Dispute model', () => {
  it('loads without a database connection', () => {
    expect(mongoose.connection.readyState).toBe(0);
    expect(Dispute).toBeDefined();
    expect(Dispute.modelName).toBe('Dispute');
  });

  it('survives being re-required, as --watch does on every reload', () => {
    // Without the `mongoose.models.Dispute || ...` guard, the second
    // `mongoose.model('Dispute', schema)` throws OverwriteModelError and the
    // watcher dies mid-session with a stack trace and no obvious cause.
    // Evict only this module, leaving mongoose cached — that is exactly what a
    // watcher does when the file changes. `jest.resetModules()` would reset
    // mongoose too, giving a fresh registry and testing nothing.
    delete require.cache[require.resolve('../models/Dispute')];

    let reloaded;
    expect(() => {
      reloaded = require('../models/Dispute');
    }).not.toThrow();
    expect(reloaded.Dispute).toBe(Dispute);
  });

  describe('schema', () => {
    const schema = Dispute.schema;

    it.each(['marketId', 'userId', 'reason', 'description'])(
      'requires %s',
      (path) => {
        expect(schema.path(path).isRequired).toBe(true);
      },
    );

    it('defaults status to OPEN', () => {
      expect(schema.path('status').defaultValue).toBe(DISPUTE_STATUSES.OPEN);
    });

    it('constrains status to the declared statuses', () => {
      const allowed = schema.path('status').enumValues;
      expect(allowed.sort()).toEqual(Object.values(DISPUTE_STATUSES).sort());
    });

    it('constrains resolution outcome to the known outcomes', () => {
      const outcome = schema.path('resolution').schema.path('outcome');
      expect(outcome.enumValues).toEqual([
        'USER_WIN',
        'ADMIN_WIN',
        'SYSTEM_DECISION',
        'REJECTED',
      ]);
    });

    it('stores evidence as URLs, never as file blobs', () => {
      const evidence = schema.path('evidence').schema;
      expect(evidence.path('url').isRequired).toBe(true);
      expect(evidence.path('url').instance).toBe('String');
      expect(evidence.path('uploadedBy').isRequired).toBe(true);
    });

    it('declares the compound indexes the analytics queries rely on', () => {
      const indexKeys = schema.indexes().map(([keys]) => Object.keys(keys).join(','));
      expect(indexKeys).toEqual(
        expect.arrayContaining([
          'marketId,userId,status',
          'status,createdAt',
          'marketId,status',
        ]),
      );
    });
  });

  describe('status transitions', () => {
    it('declares a transition list for every status', () => {
      expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual(
        Object.values(DISPUTE_STATUSES).sort(),
      );
    });

    it('only ever targets declared statuses', () => {
      const known = Object.values(DISPUTE_STATUSES);
      for (const targets of Object.values(VALID_TRANSITIONS)) {
        for (const target of targets) {
          expect(known).toContain(target);
        }
      }
    });

    it('treats RESOLVED and REJECTED as terminal', () => {
      expect(VALID_TRANSITIONS[DISPUTE_STATUSES.RESOLVED]).toEqual([]);
      expect(VALID_TRANSITIONS[DISPUTE_STATUSES.REJECTED]).toEqual([]);
    });

    it('cannot jump straight from OPEN to RESOLVED', () => {
      // Resolution must pass through review; a direct jump would skip the
      // reviewStartedAt bookkeeping the service writes.
      expect(VALID_TRANSITIONS[DISPUTE_STATUSES.OPEN]).not.toContain(
        DISPUTE_STATUSES.RESOLVED,
      );
      expect(VALID_TRANSITIONS[DISPUTE_STATUSES.OPEN]).toContain(
        DISPUTE_STATUSES.UNDER_REVIEW,
      );
    });

    it('leaves every non-terminal status reachable from OPEN', () => {
      const reachable = new Set([DISPUTE_STATUSES.OPEN]);
      const queue = [DISPUTE_STATUSES.OPEN];
      while (queue.length) {
        for (const next of VALID_TRANSITIONS[queue.shift()]) {
          if (!reachable.has(next)) {
            reachable.add(next);
            queue.push(next);
          }
        }
      }
      expect(reachable.size).toBe(Object.values(DISPUTE_STATUSES).length);
    });
  });

  describe('validation', () => {
    it('rejects a document missing required fields', () => {
      const error = new Dispute({}).validateSync();
      expect(error).toBeDefined();
      expect(Object.keys(error.errors).sort()).toEqual(
        expect.arrayContaining(['description', 'marketId', 'reason', 'userId']),
      );
    });

    it('rejects an unknown status', () => {
      const doc = new Dispute({
        marketId: 'm1',
        userId: 'u1',
        reason: 'settlement',
        description: 'Long enough description of the dispute.',
        status: 'NOT_A_STATUS',
      });
      expect(doc.validateSync().errors.status).toBeDefined();
    });

    it('accepts a well-formed dispute', () => {
      const doc = new Dispute({
        marketId: 'm1',
        userId: 'u1',
        reason: 'settlement',
        description: 'Long enough description of the dispute.',
      });
      expect(doc.validateSync()).toBeUndefined();
      expect(doc.status).toBe(DISPUTE_STATUSES.OPEN);
    });
  });
});
