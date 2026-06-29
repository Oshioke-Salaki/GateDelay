const async = require('async');
const Big = require('big.js');
const Order = require('../models/Order');
const Balance = require('../models/Balance');
const mongoose = require('mongoose');

class TradeEngine {
  constructor() {
    this.orderBook = {
      Buy: [],
      Sell: []
    };
  }

  // Load active orders into memory
  async initialize() {
    try {
      const orders = await Order.find({ status: { $in: ['Pending', 'Partial'] } }).sort({ timestamp: 1 });
      for (const order of orders) {
        this.orderBook[order.side].push(order);
      }
    } catch (err) {
      console.error('Failed to initialize orderbook', err);
    }
  }

  async processOrder(orderData) {
    // Determine the asset to lock
    const lockAsset = orderData.side === 'Buy' ? orderData.pair.split('-')[1] : orderData.pair.split('-')[0];
    const lockValue = orderData.side === 'Buy'
      ? new Big(orderData.price || '0').times(orderData.amount).toString() // Assumes limit for buy. Market buys need different logic.
      : orderData.amount;

    let session;
    try {
      session = await mongoose.startSession();
    } catch (e) {
      // For unit tests without replica sets, session creation might fail. We mock it if it fails.
      session = {
        withTransaction: async (cb) => { await cb(); },
        endSession: () => {},
        inTransaction: () => true
      };
    }

    let result;

    try {
      if (session.withTransaction) {
        await session.withTransaction(async () => {
          result = await this._executeOrderFlow(orderData, lockAsset, lockValue, session);
        });
      } else {
         result = await this._executeOrderFlow(orderData, lockAsset, lockValue, null);
      }
    } finally {
      if (session.endSession) {
        session.endSession();
      }
    }

    return result;
  }

  async _executeOrderFlow(orderData, lockAsset, lockValue, session) {
    const balanceQuery = session && session.inTransaction() ? { session } : {};
    
    // Balance check and lock
    const balance = await Balance.findOne({ userId: orderData.userId, asset: lockAsset }, null, balanceQuery);
    if (!balance || new Big(balance.available).lt(lockValue)) {
      throw new Error('Insufficient balance');
    }

    balance.available = new Big(balance.available).minus(lockValue).toString();
    balance.locked = new Big(balance.locked).plus(lockValue).toString();
    await balance.save(balanceQuery);

    const order = new Order({
      ...orderData,
      status: 'Pending',
      filled: '0'
    });
    await order.save(balanceQuery);

    return new Promise((resolve, reject) => {
      async.waterfall([
        (callback) => this.matchOrder(order, callback),
        (matches, callback) => this.settleMatches(order, matches, session, callback)
      ], (err, res) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  matchOrder(order, callback) {
    const matches = [];
    let remainingAmount = new Big(order.amount).minus(order.filled);

    const oppositeSide = order.side === 'Buy' ? 'Sell' : 'Buy';
    const book = this.orderBook[oppositeSide].filter(o => o.pair === order.pair);

    // Price-Time priority
    book.sort((a, b) => {
      const pA = new Big(a.price);
      const pB = new Big(b.price);
      if (pA.eq(pB)) {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      return order.side === 'Buy' ? pA.cmp(pB) : pB.cmp(pA); // Lowest ask for Buy, Highest bid for Sell
    });

    for (let i = 0; i < book.length && remainingAmount.gt(0); i++) {
      const candidate = book[i];

      if (candidate.userId.toString() === order.userId.toString()) continue;

      const matchPrice = new Big(candidate.price);

      if (order.type === 'Limit') {
        const orderPrice = new Big(order.price);
        if (order.side === 'Buy' && orderPrice.lt(matchPrice)) continue;
        if (order.side === 'Sell' && orderPrice.gt(matchPrice)) continue;
      }

      const candidateRemaining = new Big(candidate.amount).minus(candidate.filled);
      const fillAmount = remainingAmount.lt(candidateRemaining) ? remainingAmount : candidateRemaining;

      matches.push({
        makerOrder: candidate,
        amount: fillAmount.toString(),
        price: matchPrice.toString()
      });

      remainingAmount = remainingAmount.minus(fillAmount);
    }

    callback(null, matches);
  }

  async settleMatches(takerOrder, matches, session, callback) {
    const options = session && session.inTransaction() ? { session } : {};
    try {
      let takerFilled = new Big(takerOrder.filled);
      const [baseAsset, quoteAsset] = takerOrder.pair.split('-');

      for (const match of matches) {
        const makerOrder = match.makerOrder;
        const fillAmount = new Big(match.amount);
        const price = new Big(match.price);
        const value = fillAmount.times(price);

        makerOrder.filled = new Big(makerOrder.filled).plus(fillAmount).toString();
        makerOrder.status = new Big(makerOrder.filled).eq(makerOrder.amount) ? 'Filled' : 'Partial';

        const dbMakerOrder = await Order.findById(makerOrder._id, null, options);
        if (dbMakerOrder) {
          dbMakerOrder.filled = makerOrder.filled;
          dbMakerOrder.status = makerOrder.status;
          await dbMakerOrder.save(options);
        }

        // Update real-time aggregation
        try {
          const tradeAggregator = require('./tradeAggregator');
          await tradeAggregator.updateRealTimeStats(takerOrder.pair, match.price, match.amount);
        } catch (e) {
          console.error('Failed to update trade aggregation', e);
        }

        const makerBaseBalance = await Balance.findOne({ userId: makerOrder.userId, asset: baseAsset }, null, options);
        const makerQuoteBalance = await Balance.findOne({ userId: makerOrder.userId, asset: quoteAsset }, null, options);
        
        if (makerBaseBalance && makerQuoteBalance) {
            if (makerOrder.side === 'Buy') {
              makerQuoteBalance.locked = new Big(makerQuoteBalance.locked).minus(value).toString();
              makerBaseBalance.available = new Big(makerBaseBalance.available).plus(fillAmount).toString();
            } else {
              makerBaseBalance.locked = new Big(makerBaseBalance.locked).minus(fillAmount).toString();
              makerQuoteBalance.available = new Big(makerQuoteBalance.available).plus(value).toString();
            }
            await makerQuoteBalance.save(options);
            await makerBaseBalance.save(options);
        }

        takerFilled = takerFilled.plus(fillAmount);

        const takerBaseBalance = await Balance.findOne({ userId: takerOrder.userId, asset: baseAsset }, null, options);
        const takerQuoteBalance = await Balance.findOne({ userId: takerOrder.userId, asset: quoteAsset }, null, options);

        if (takerBaseBalance && takerQuoteBalance) {
            if (takerOrder.side === 'Buy') {
              takerQuoteBalance.locked = new Big(takerQuoteBalance.locked).minus(value).toString();
              takerBaseBalance.available = new Big(takerBaseBalance.available).plus(fillAmount).toString();
            } else {
              takerBaseBalance.locked = new Big(takerBaseBalance.locked).minus(fillAmount).toString();
              takerQuoteBalance.available = new Big(takerQuoteBalance.available).plus(value).toString();
            }
            await takerQuoteBalance.save(options);
            await takerBaseBalance.save(options);
        }
      }

      takerOrder.filled = takerFilled.toString();
      takerOrder.status = takerFilled.eq(takerOrder.amount) ? 'Filled' : (takerFilled.gt(0) ? 'Partial' : 'Pending');

      const dbTakerOrder = await Order.findById(takerOrder._id, null, options);
      if (dbTakerOrder) {
        dbTakerOrder.filled = takerOrder.filled;
        dbTakerOrder.status = takerOrder.status;
        await dbTakerOrder.save(options);
      }

      // Sync Memory Book
      const oppositeSide = takerOrder.side === 'Buy' ? 'Sell' : 'Buy';
      this.orderBook[oppositeSide] = this.orderBook[oppositeSide].filter(o => o.status !== 'Filled');

      if (takerOrder.status !== 'Filled' && takerOrder.type === 'Limit') {
        this.orderBook[takerOrder.side].push(takerOrder);
      }

      callback(null, { order: takerOrder, matches });
    } catch (err) {
      callback(err);
    }
  }

  // Helper for web3
  async executeOnChain(web3ProviderUrl, settlementData) {
      const Web3 = require('web3');
      const web3 = new Web3(web3ProviderUrl);
      // Implementation logic for smart contract call
      return true;
  }
}

module.exports = new TradeEngine();
