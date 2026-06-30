const mongoose = require('mongoose');
const Agenda = require('agenda');
const Order = require('../models/Order');

const ScheduledTradeSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['Limit', 'Market', 'Stop-Loss'], required: true },
  side: { type: String, enum: ['Buy', 'Sell'], required: true },
  pair: { type: String, required: true },
  price: { type: String, default: '0' },
  amount: { type: String, required: true },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Executed', 'Failed', 'Canceled'], default: 'Pending' },
  executedAt: Date,
  error: String,
  jobId: String
}, { timestamps: true });

const ScheduledTrade = mongoose.models.ScheduledTrade || mongoose.model('ScheduledTrade', ScheduledTradeSchema);

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI || 'mongodb://localhost:27017/gatedelay' } });

class SchedulerService {
  constructor() {
    this.initAgenda();
  }

  async initAgenda() {
    await agenda.start();
    agenda.define('execute-scheduled-trade', async (job) => {
      const { scheduledTradeId } = job.attrs.data;
      await this.executeScheduledTrade(scheduledTradeId);
    });
    console.log('[SchedulerService] Agenda initialized');
  }

  async scheduleTrade(tradeData) {
    const { userId, type, side, pair, price, amount, scheduledAt } = tradeData;

    if (new Date(scheduledAt) <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const conflictingTrades = await ScheduledTrade.find({
      userId,
      pair,
      scheduledAt: { 
        $gte: new Date(new Date(scheduledAt).getTime() - 5 * 60 * 1000),
        $lte: new Date(new Date(scheduledAt).getTime() + 5 * 60 * 1000)
      },
      status: 'Pending'
    });

    if (conflictingTrades.length > 0) {
      throw new Error(`Conflicting trade scheduled within 5 minutes for ${pair}`);
    }

    const scheduledTrade = new ScheduledTrade({
      userId,
      type,
      side,
      pair,
      price,
      amount,
      scheduledAt: new Date(scheduledAt)
    });

    await scheduledTrade.save();

    const job = await agenda.schedule(scheduledTrade.scheduledAt, 'execute-scheduled-trade', {
      scheduledTradeId: scheduledTrade._id.toString()
    });

    scheduledTrade.jobId = job.attrs._id.toString();
    await scheduledTrade.save();

    return scheduledTrade;
  }

  async executeScheduledTrade(scheduledTradeId) {
    const scheduledTrade = await ScheduledTrade.findById(scheduledTradeId);
    if (!scheduledTrade || scheduledTrade.status !== 'Pending') {
      return;
    }

    try {
      const order = new Order({
        userId: scheduledTrade.userId,
        type: scheduledTrade.type,
        side: scheduledTrade.side,
        pair: scheduledTrade.pair,
        price: scheduledTrade.price,
        amount: scheduledTrade.amount
      });

      await order.save();

      scheduledTrade.status = 'Executed';
      scheduledTrade.executedAt = new Date();
      await scheduledTrade.save();

      console.log(`[SchedulerService] Executed scheduled trade ${scheduledTradeId}`);
    } catch (error) {
      scheduledTrade.status = 'Failed';
      scheduledTrade.error = error.message;
      await scheduledTrade.save();
      console.error(`[SchedulerService] Failed to execute scheduled trade ${scheduledTradeId}:`, error);
      throw error;
    }
  }

  async cancelScheduledTrade(scheduledTradeId, userId) {
    const scheduledTrade = await ScheduledTrade.findById(scheduledTradeId);
    if (!scheduledTrade) throw new Error('Trade not found');
    if (scheduledTrade.userId !== userId) throw new Error('Unauthorized');

    if (scheduledTrade.jobId) {
      await agenda.cancel({ _id: scheduledTrade.jobId });
    }

    scheduledTrade.status = 'Canceled';
    await scheduledTrade.save();

    return scheduledTrade;
  }

  async getScheduledTrades(userId, status = null) {
    const filter = { userId };
    if (status) filter.status = status;
    return await ScheduledTrade.find(filter).sort({ scheduledAt: 1 });
  }

  async getAnalytics(userId) {
    const trades = await ScheduledTrade.find({ userId });
    const total = trades.length;
    const executed = trades.filter(t => t.status === 'Executed').length;
    const failed = trades.filter(t => t.status === 'Failed').length;
    const canceled = trades.filter(t => t.status === 'Canceled').length;

    return { total, executed, failed, canceled };
  }
}

module.exports = new SchedulerService();
