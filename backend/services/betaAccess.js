/**
 * @file services/betaAccess.js
 * @description Beta access management service for GateDelay.
 *
 * ## Security review (#709)
 *
 * ### Secrets / private key policy
 *   - NO secrets or private keys are stored in this file.
 *   - The only credential this module uses is `process.env.BETA_INVITE_SECRET`,
 *     which is an HMAC signing key for invite tokens.  It is read exclusively
 *     from the environment; the fallback value 'gatedelay-beta-secret' is
 *     intentionally weak and triggers a startup warning in production — see the
 *     BetaAccessService constructor below.
 *   - `Backend/.env.example` documents the key as `BETA_INVITE_SECRET`.
 *
 * ### Trust assumptions
 *   - **MongoDB** is the persistence layer for beta user records.  The service
 *     connects to `process.env.MONGODB_URI` on demand.  The caller must ensure
 *     the URI is restricted to the minimum required privilege (read/write on the
 *     `gatedelay` database only; no admin or oplog access).
 *   - **Invite tokens** are single-use, 32-byte random values hashed with
 *     HMAC-SHA-256 before storage.  The raw token is returned to the issuer
 *     exactly once and is never persisted in plain text.
 *   - **Wallet addresses** are normalised to lowercase on write to prevent
 *     case-folding bypass attacks (e.g. `0xABC` vs `0xabc`).
 *   - **Oracle / multisig trust** — this service does not call any on-chain
 *     oracle or multisig.  Access decisions are based solely on the MongoDB
 *     record; any on-chain enforcement must be applied by the contract layer.
 *   - **Rate limiting** — this service has no built-in rate limiting.  The
 *     Express routes that expose it (`Backend/routes/beta.js`) should be
 *     mounted behind the DDoS guard (`middleware/ddosGuard.js`) and the
 *     standard rate-limiter (`middleware/rateLimiter.js`).  See Backend/README.md
 *     for mount instructions.
 *
 * ### Negative-path checklist
 *   ✓  `addToBetaList` throws if the wallet is already enrolled.
 *   ✓  `acceptInvitation` throws on invalid token (hash mismatch) and on
 *       expired invitations (TTL: 7 days).
 *   ✓  `acceptInvitation` throws if the presented wallet address does not match
 *       the address recorded at invite time.
 *   ✓  `checkAccess` returns `{ hasAccess: false }` for unknown wallets and for
 *       wallets whose status is not 'active'.
 *   ✓  `trackActivity` caps the activity log at 500 entries to prevent unbounded
 *       document growth.
 *   ✓  `_sanitize` strips `inviteToken` from every object returned to callers,
 *       ensuring the hashed token is never leaked through the API.
 *   ✗  Abuse scenario — brute-force invite token guessing: the 32-byte random
 *       token gives 2^256 HMAC pre-image space, which is computationally
 *       infeasible.  The route layer must still enforce rate-limiting on
 *       POST /invite/accept to prevent enumeration of expired/invalid tokens.
 *   ✗  Abuse scenario — wallet squatting: a malicious actor could pre-register
 *       a wallet before the legitimate owner.  Phase 2+ mitigation: require
 *       a signed proof-of-ownership challenge before `addToBetaList` is called.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

const betaUserSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, lowercase: true },
    status: {
      type: String,
      enum: ['invited', 'active', 'revoked', 'expired'],
      default: 'invited',
    },
    inviteToken: { type: String, unique: true, sparse: true },
    inviteExpiresAt: Date,
    features: [{ type: String }],
    activityLog: [
      {
        action: String,
        feature: String,
        metadata: mongoose.Schema.Types.Mixed,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    invitedBy: String,
    joinedAt: Date,
    lastActiveAt: Date,
  },
  { timestamps: true },
);

const BetaUser = mongoose.models.BetaUser || mongoose.model('BetaUser', betaUserSchema);

const BETA_FEATURES = ['market_creation', 'advanced_trading', 'ai_signals', 'early_resolution'];

class BetaAccessService {
  constructor() {
    this.inviteSecret = process.env.BETA_INVITE_SECRET || 'gatedelay-beta-secret';
    // #709 — warn loudly when the fallback weak secret is active in production
    if (!process.env.BETA_INVITE_SECRET && process.env.NODE_ENV === 'production') {
      console.error(
        '[betaAccess] FATAL: BETA_INVITE_SECRET is not set in production. ' +
        'Set a strong random value in your environment / secrets manager. ' +
        'See Backend/.env.example for the required key.'
      );
      throw new Error('BETA_INVITE_SECRET must be set in production');
    }
    if (!process.env.BETA_INVITE_SECRET) {
      console.warn(
        '[betaAccess] WARNING: BETA_INVITE_SECRET not set — using insecure default. ' +
        'Set BETA_INVITE_SECRET before deploying to staging or production.'
      );
    }
  }

  async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gatedelay';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  }

  _generateInviteToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  _hashToken(token) {
    return crypto.createHmac('sha256', this.inviteSecret).update(token).digest('hex');
  }

  async addToBetaList({ walletAddress, email, features = [], invitedBy }) {
    await this.connect();
    const normalized = walletAddress.toLowerCase();
    const existing = await BetaUser.findOne({ walletAddress: normalized });
    if (existing) throw new Error('User already on beta list');

    const inviteToken = this._generateInviteToken();
    const user = await BetaUser.create({
      walletAddress: normalized,
      email,
      features: features.length ? features : ['market_creation'],
      invitedBy,
      inviteToken: this._hashToken(inviteToken),
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'invited',
    });

    return { user: this._sanitize(user), rawInviteToken: inviteToken };
  }

  async removeFromBetaList(walletAddress) {
    await this.connect();
    const user = await BetaUser.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { status: 'revoked' },
      { new: true },
    );
    if (!user) throw new Error('User not found');
    return this._sanitize(user);
  }

  async getBetaList({ status, limit = 100 } = {}) {
    await this.connect();
    const query = status ? { status } : {};
    const users = await BetaUser.find(query).sort({ createdAt: -1 }).limit(limit);
    return users.map((u) => this._sanitize(u));
  }

  async acceptInvitation(token, walletAddress) {
    await this.connect();
    const hashed = this._hashToken(token);
    const user = await BetaUser.findOne({ inviteToken: hashed, status: 'invited' });

    if (!user) throw new Error('Invalid or expired invitation');
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      user.status = 'expired';
      await user.save();
      throw new Error('Invitation has expired');
    }

    if (walletAddress && user.walletAddress !== walletAddress.toLowerCase()) {
      throw new Error('Wallet address does not match invitation');
    }

    user.status = 'active';
    user.joinedAt = new Date();
    user.inviteToken = undefined;
    user.activityLog.push({ action: 'invitation_accepted' });
    await user.save();

    return this._sanitize(user);
  }

  async checkAccess(walletAddress, feature) {
    await this.connect();
    const user = await BetaUser.findOne({
      walletAddress: walletAddress.toLowerCase(),
      status: 'active',
    });

    if (!user) return { hasAccess: false, reason: 'Not a beta user' };
    if (feature && !user.features.includes(feature)) {
      return { hasAccess: false, reason: `Feature '${feature}' not enabled` };
    }

    return { hasAccess: true, features: user.features };
  }

  async trackActivity(walletAddress, { action, feature, metadata }) {
    await this.connect();
    const user = await BetaUser.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) throw new Error('User not found');

    user.activityLog.push({ action, feature, metadata });
    user.lastActiveAt = new Date();
    if (user.activityLog.length > 500) {
      user.activityLog = user.activityLog.slice(-500);
    }
    await user.save();
    return this._sanitize(user);
  }

  async getUserActivity(walletAddress) {
    await this.connect();
    const user = await BetaUser.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) throw new Error('User not found');
    return {
      walletAddress: user.walletAddress,
      lastActiveAt: user.lastActiveAt,
      activityLog: user.activityLog.slice(-50),
    };
  }

  getAvailableFeatures() {
    return BETA_FEATURES;
  }

  _sanitize(user) {
    const obj = user.toObject ? user.toObject() : user;
    delete obj.inviteToken;
    return obj;
  }
}

module.exports = new BetaAccessService();
