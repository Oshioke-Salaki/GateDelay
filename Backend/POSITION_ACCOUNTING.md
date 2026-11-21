# Position accounting

Positions are derived from successful, canonical, confirmed MarketMaker SharesBought / SharesSold receipt logs. POST /positions applies a buy; DELETE /positions/:id applies a partial or full sell. Both accept only txHash, logIndex (global receipt log index), and signature. Supplied shares/prices never affect accounting. Authentication is still required.

The EIP-191 personal-sign message is the following six lines joined by a newline, without a trailing newline:

GateDelay position execution v1
<authenticated user id>
<decimal RPC chain id>
<lowercase configured MarketMaker address>
<lowercase transaction hash>
<decimal log index>

The signer must be the buyer/seller in the event. An account position already linked to another application user cannot be claimed. DEPLOYMENT_REGISTRY_JSON must include MarketMaker for the RPC chain. POSITION_CONFIRMATIONS defaults to 12 and must be a positive integer. Binary markets only: outcome 0 = YES, outcome 1 = NO. Other execution venues require a separate verified adapter; Trading wrapper events are deliberately not treated as direct user holdings because MarketMaker credits the wrapper address.

MongoDB must run as a replica set or sharded cluster supporting transactions. Position identity is unique on account, chain, contract, market and outcome. The chain/transaction/log event key is globally unique. Holdings and the applied event journal commit in the same transaction. No nontransactional fallback exists. Provision the schema unique indexes before serving traffic if automatic index creation is disabled. Concurrent unique-index conflicts return 409; retry the identical reference. Repeated committed references are no-ops. Apply history in block/log order; stale events and oversells return 409. Import complete history from deployment before exposing an existing account. Process-local historical positions cannot be trusted or migrated as financial records.

Shares and collateral use WAD (18 decimals) as defined by these contracts. Stored balances, costs, realized profit and prices are integer strings, calculated with bigint. Average acquisition cost is retained across buys. A partial sell releases floor(cost * sold shares / held shares) collateral units; the last sell releases the entire remaining cost, preserving all rounding dust. Realized profit is proceeds minus released cost. Reopening keeps lifetime realized profit.

Entry and current prices represent the HELD outcome, never a reversed NO price. Unrealized profit for both outcomes is held shares times held outcome price minus remaining cost. PriceGateway feeds represent YES probability and are complemented once for NO; feed updates require chainId and are ignored without it. Number feed values are converted through decimal text at the boundary; receipt accounting never uses floating point. Last execution average price is the initial mark. Mark valuation and execution price division floor at one WAD unit. Maximum loss is remaining cost.

API amounts and prices are decimal strings with 18 places, percentages with 8, rounded half away from zero. pnl is unrealized profit; realizedPnl is lifetime realized profit. Closed positions have zero shares, cost and unrealized profit. Portfolio profit includes both components; portfolio percentage uses remaining cost as its denominator (zero when no cost remains). Portfolio values also return strings. Consumers must update from numeric arithmetic to decimal arithmetic. Existing portfolio responses may remain cached for up to 30 seconds.

Deep reorganizations beyond the confirmation policy require pausing imports and rebuilding positions from canonical history; this implementation rejects a replay whose stored block hash changed and does not silently reverse financial history. Resolution/redemption and other venues are outside this trade-event adapter.
