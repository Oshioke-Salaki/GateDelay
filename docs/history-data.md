# Historical data sources

The UI no longer generates price, order-book, transaction, or return history.

## Outcome prices

Set NEXT_PUBLIC_OUTCOME_HISTORY_URL to a browser-accessible historical outcome quote indexer. The UI adds marketId as a query parameter. Return an array of records with timestamp (Unix milliseconds), yesPrice and noPrice (each 0–1), and optional volume (nonnegative). Return actual observations in market time, with both outcome prices recorded explicitly. Do not derive NO history from YES, substitute underlying asset prices, or fill missing observations with generated movements. Empty responses show unavailable history for the selected range. All range and zoom filtering uses these timestamps. Without a configured source, history is explicitly unavailable.

## CLOB venues

NEXT_PUBLIC_CLOB_VENUES_JSON is an object keyed by exact market ID. Each value must have name and orderBookUrl. The URL receives marketId and returns { bids: [{ price, quantity }], asks: [{ price, quantity }] }. Only configured markets render an order book; the heading names the venue and identifies CLOB orders separately from LMSR quotes. Unconfigured LMSR markets render no book. Configured venues show loading, empty sides, and request errors without fixtures.

## Transactions

TransactionHistory requests the existing authenticated /trading-history endpoint using the access token and follows offset pagination. The signed-in backend account determines ownership. The table identifies this coverage; the connected wallet alone does not grant access to another account. Records use createdAt, type, marketId, amount, status, and txHash. Missing hashes are unavailable, and full valid hashes are retained for explorer links and CSV exports. History reflects records indexed by that service, rather than a claim of complete chain-wide coverage.

## Time-weighted returns

Set NEXT_PUBLIC_ACCOUNT_HISTORY_URL to an authenticated account-history service. The UI sends the existing bearer access token plus account and chainId query parameters. Use a trusted endpoint: it receives that token. It must enforce account ownership and network scope server-side.

Return { values: [{ timestamp, value }], cashFlows: [{ timestamp, amount }], cashFlowsComplete: true }. Timestamps are Unix milliseconds; values are total account equity in a consistent currency, including cash. Deposits are positive and withdrawals negative. A valuation at a cash-flow timestamp is AFTER all external flows at that instant. Flows sharing a timestamp are summed. Returns link (closing equity minus external flows) / opening equity for each interval. Both the chart and headline use this same calculation. No market comparison is shown without real market account histories.

A return needs at least two distinct valuations, positive opening equity for each interval, complete external flows, and a valuation at every intervening flow. Otherwise it is unavailable. Periods show the actual first and last observation used within the selected window; no boundary equity is interpolated or invented. Opening flows are already included in opening equity. Future records are excluded.

The existing portfolio history service records position cost and P&L only. Those records do not certify total account equity or complete deposits/withdrawals and cannot safely be used as an exact TWR source. Until a suitable account-history service is configured, the UI explicitly reports unavailable history.
