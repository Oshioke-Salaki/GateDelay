## GateDelay: Market rebate / commission / referral / market referrer

- [x] Fix `Contracts/src/Trading.sol` so it correctly wraps `Contracts/src/MarketMaker.sol` (remove broken accounting and make it compile).
- [x] Implement taker-based market referrer in `Contracts/src/Trading.sol` (storage + setter + events).
- [x] Implement commission payment + market rebate split in `Contracts/src/Trading.sol` (BUY path; SELL skipped).
- [ ] Wire on-chain rebate attribution to backend (new DB fields or new model + service logic updates).
- [ ] Update backend referral tracking to store/resolve market referrer (link referral to on-chain referrer address).
- [ ] Update backend trade settlement to compute commission/rebate based on actual fee split.
- [ ] Add tests:
  - forge tests for rebate/referrer/fee split correctness
  - backend jest tests for referral attribution using real computed amounts
- [ ] Run build/test commands.

