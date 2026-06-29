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
