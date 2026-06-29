const tradeEngine = require('../services/tradeEngine');
const Order = require('../models/Order');
const Balance = require('../models/Balance');
const Big = require('big.js');
const mongoose = require('mongoose');

jest.mock('../models/Order');
jest.mock('../models/Balance');

describe('Trade Execution Engine', () => {
  beforeEach(() => {
    tradeEngine.orderBook = { Buy: [], Sell: [] };
    jest.clearAllMocks();
    
    // Mock mongoose startSession
    mongoose.startSession = jest.fn().mockResolvedValue({
      withTransaction: async (cb) => { await cb(); },
      endSession: jest.fn(),
      inTransaction: () => true
    });
  });

  describe('Unit Test: Partial fill logic and decimal precision', () => {
    it('should correctly calculate partial fills using big.js', (done) => {
      const takerOrder = {
        _id: 'taker1',
        userId: 'u1',
        side: 'Buy',
        type: 'Limit',
        pair: 'ETH-USDT',
        amount: '1.05',
        price: '2000',
        filled: '0'
      };

      const makerOrder = {
        _id: 'maker1',
        userId: 'u2',
        side: 'Sell',
        type: 'Limit',
        pair: 'ETH-USDT',
        amount: '0.5',
        price: '2000',
        filled: '0',
        save: jest.fn()
      };

      tradeEngine.orderBook.Sell.push(makerOrder);

      tradeEngine.matchOrder(takerOrder, (err, matches) => {
        expect(err).toBeNull();
        expect(matches.length).toBe(1);
        expect(matches[0].amount).toBe('0.5');
        expect(matches[0].price).toBe('2000');
        expect(new Big(takerOrder.amount).minus(takerOrder.filled).minus(matches[0].amount).toString()).toBe('0.55');
        done();
      });
    });
  });

  describe('Integration Test: Order matching sequence', () => {
    it('should lock balance and process the order successfully', async () => {
      const orderData = {
        userId: 'u1',
        side: 'Buy',
        type: 'Limit',
        pair: 'ETH-USDT',
        amount: '1',
        price: '2000'
      };

      const mockBalance = {
        userId: 'u1',
        asset: 'USDT',
        available: '5000',
        locked: '0',
        save: jest.fn()
      };

      Balance.findOne.mockResolvedValue(mockBalance);
      Order.prototype.save = jest.fn().mockResolvedValue(true);

      const result = await tradeEngine.processOrder(orderData);
      
      expect(Balance.findOne).toHaveBeenCalledWith(
        { userId: 'u1', asset: 'USDT' },
        null,
        expect.any(Object)
      );
      
      expect(mockBalance.available).toBe('3000');
      expect(mockBalance.locked).toBe('2000');
      expect(mockBalance.save).toHaveBeenCalled();
    });
  });

  describe('Stress Test: Concurrent matching of multiple small orders', () => {
    it('should match multiple small orders against a single whale order', (done) => {
      const takerWhale = {
        _id: 'whale1',
        userId: 'uWhale',
        side: 'Sell',
        type: 'Market',
        pair: 'ETH-USDT',
        amount: '10',
        filled: '0'
      };

      // Add 10 small maker orders
      for (let i = 0; i < 10; i++) {
        tradeEngine.orderBook.Buy.push({
          _id: `small${i}`,
          userId: `u${i}`,
          side: 'Buy',
          type: 'Limit',
          pair: 'ETH-USDT',
          amount: '1',
          price: '2000',
          filled: '0'
        });
      }

      tradeEngine.matchOrder(takerWhale, (err, matches) => {
        expect(err).toBeNull();
        expect(matches.length).toBe(10);
        
        const totalMatched = matches.reduce((acc, m) => acc.plus(m.amount), new Big(0));
        expect(totalMatched.toString()).toBe('10');
        done();
      });
    });
  });

  describe('Failure Test: Rollback verification', () => {
    it('should abort matching if an error is thrown in settlement stage', async () => {
      const orderData = {
        userId: 'u1',
        side: 'Buy',
        type: 'Limit',
        pair: 'ETH-USDT',
        amount: '1',
        price: '2000'
      };

      const mockBalance = {
        userId: 'u1',
        asset: 'USDT',
        available: '5000',
        locked: '0',
        save: jest.fn()
      };

      Balance.findOne.mockResolvedValue(mockBalance);
      
      // Force an error in matching phase to simulate rollback/failure
      jest.spyOn(tradeEngine, 'matchOrder').mockImplementation((order, cb) => {
        cb(new Error('Simulated Settlement Failure'));
      });

      await expect(tradeEngine.processOrder(orderData)).rejects.toThrow('Simulated Settlement Failure');
    });
  });
});
