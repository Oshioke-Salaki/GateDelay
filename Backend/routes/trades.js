const express = require('express');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const {
  normalizePagination,
  buildPaginationMeta,
} = require('../utils/pagination');

const router = express.Router();

/**
 * Middleware for error handling
 */
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'TRADE_HISTORY_ERROR',
    });
  }
};

/**
 * GET /history/:pair
 * Retrieve paginated trade history for a pair
 */
router.get(
  '/history/:pair',
  handleErrors(async (req, res) => {
    const { pair } = req.params;
    const { page, limit, skip } = normalizePagination({
      ...req.query,
      defaultLimit: 20,
      maxLimit: 200,
    });
    const side = req.query.side;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query filter
    const filter = { pair, status: 'Filled' };
    
    if (side && side !== 'all') {
      filter.side = side;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        filter.timestamp.$lte = end;
      }
    }

    // Execute queries in parallel
    const [trades, total] = await Promise.all([
      Order.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('price amount side timestamp pair')
        .lean(),
      Order.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    // `totalPages` predates the shared meta block and is still read by the
    // frontend history table; `meta` is additive so both clients keep working.
    res.json({
      success: true,
      data: {
        trades,
        total,
        page,
        totalPages,
        meta: buildPaginationMeta({
          total,
          count: trades.length,
          page,
          limit,
          offset: skip,
        }),
      },
    });
  })
);

/**
 * GET /history/user/:userId
 * Retrieve paginated trade history for a user
 */
router.get(
  '/history/user/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const { page, limit, skip } = normalizePagination({
      ...req.query,
      defaultLimit: 20,
      maxLimit: 200,
    });

    const [trades, total] = await Promise.all([
      Order.find({ userId, status: 'Filled' })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('price amount side timestamp pair')
        .lean(),
      Order.countDocuments({ userId, status: 'Filled' }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        trades,
        total,
        page,
        totalPages,
        meta: buildPaginationMeta({
          total,
          count: trades.length,
          page,
          limit,
          offset: skip,
        }),
      },
    });
  })
);

module.exports = router;