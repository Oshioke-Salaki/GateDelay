# GateDelay Issue Backlog

Total issues: 125

## Frontend Issues

1. FRONTEND-Improve market list loading, empty, and error states
   Description: Add clear loading, empty, and error states to the markets list so users know whether data is still loading, no markets match filters, or the backend request failed.

2. FRONTEND-Add mobile-first layout polish for the dashboard route
   Description: Fix dashboard spacing, stacking, table overflow, and card layout on small screens so the page remains usable without horizontal scrolling.

3. FRONTEND-Fix wallet connect unavailable state when Particle credentials are missing
   Description: Improve no-wallet local mode by showing that signing is unavailable when Particle credentials are absent while keeping the rest of the app usable.

4. FRONTEND-Add retry controls for failed WebSocket price subscriptions
   Description: Add retry behavior and visible connection status when `/prices` WebSocket subscriptions fail or disconnect.

5. FRONTEND-Create reusable market status badge variants for active, paused, resolved, and cancelled markets
   Description: Build a shared badge component for market lifecycle states and use consistent labels, colors, and accessibility text across the app.

6. FRONTEND-Add accessibility labels to icon-only wallet and trade controls
   Description: Add aria labels, keyboard focus styles, and helpful tooltips to icon-only controls in wallet, trading, bridge, and settings views.

7. FRONTEND-Improve trade confirmation copy for slippage, fees, and wallet signature steps
   Description: Make trade confirmation clearer by showing estimated cost, fees, slippage, expected outcome, and wallet signature progress before submission.

8. FRONTEND-Add skeleton loading to market detail charts and order book panels
   Description: Replace blank chart and order book areas with stable skeleton loaders while market data is being fetched.

9. FRONTEND-Add client-side validation to the create market form
   Description: Validate flight details, close time, outcomes, liquidity, and metadata before submission, with inline messages that mirror backend rules.

10. FRONTEND-Add route-level error boundaries to bridge, audit, wallet, and analytics pages
    Description: Add page-level error boundaries so route render failures show a useful fallback instead of blanking the whole app.

11. FRONTEND-Add pagination and sorting controls to transaction history
    Description: Add pagination and sorting so large transaction histories can be browsed efficiently without rendering every row at once.

12. FRONTEND-Improve keyboard navigation in token selector and pair selector modals
    Description: Support tab navigation, escape-to-close, focus restoration, and sensible keyboard movement in selector modals.

13. FRONTEND-Add optimistic favorite toggling with rollback on API failure
    Description: Update favorite toggles instantly, then roll back and show a toast if the API request fails.

14. FRONTEND-Add toast notifications for successful deposits, withdrawals, and trades
    Description: Add consistent success and failure toasts for wallet actions, including transaction references when available.

15. FRONTEND-Add stale-price warning to trading panels when WebSocket updates stop
    Description: Detect stale live price data and warn users before they act on outdated trading information.

16. FRONTEND-Replace hard-coded mock market fallbacks with typed fixture loading
    Description: Move mock market data into typed fixtures or tests so production screens do not silently fall back to fake data.

17. FRONTEND-Add test coverage for market search filtering and category navigation
    Description: Add tests for search matching, category filters, empty results, and any URL or query-state behavior.

18. FRONTEND-Improve dark mode contrast for cards, tables, and chart tooltips
    Description: Adjust dark mode colors so text, borders, tables, and chart tooltips meet readable contrast expectations.

19. FRONTEND-Add responsive overflow handling for order book rows on small screens
    Description: Prevent order book columns from clipping or overlapping on mobile by using compact formatting or scroll-safe layouts.

20. FRONTEND-Add CSV export loading state and failure handling
    Description: Show loading, success, and failure states when users export market, audit, or transaction data to CSV.

21. FRONTEND-Add wallet network mismatch banner with switch action
    Description: Detect wrong wallet networks and show a banner with a network switch action when the provider supports it.

22. FRONTEND-Add pending transaction drawer with confirmations and failure reasons
    Description: Add a drawer that tracks pending transactions, confirmations, final status, and failure reasons.

23. FRONTEND-Improve portfolio widget calculations for unsettled positions
    Description: Account for unresolved markets, pending trades, and estimated payout values when displaying portfolio totals.

24. FRONTEND-Add empty-state guidance for watchlists and favorite markets
    Description: Add helpful empty states that guide users to browse, search, or favorite markets instead of showing blank pages.

25. FRONTEND-Add form-level validation messages to withdrawal and emergency withdrawal flows
    Description: Validate amount, destination, balance, wallet state, and emergency requirements before withdrawal submission.

26. FRONTEND-Add bridge transaction status timeline to the bridge page
    Description: Display bridge progress as steps such as submitted, source confirmed, relayed, destination confirmed, failed, or refunded.

27. FRONTEND-Add market metadata preview before IPFS upload
    Description: Let users review the metadata JSON before upload, including flight fields, outcomes, category, and evidence links.

28. FRONTEND-Add retry and cancel actions to IPFS upload failures
    Description: Allow failed IPFS uploads to be retried or cancelled while preserving entered form data.

29. FRONTEND-Improve analytics page chart legends, date filters, and loading behavior
    Description: Add clearer legends, date range controls, loading states, and empty-data states to analytics charts.

30. FRONTEND-Add notification preferences UI connected to backend settings
    Description: Build settings controls for trade, dispute, market resolution, and security notifications backed by the API.

31. FRONTEND-Add API key management copy, masking, and revoke confirmation states
    Description: Mask API key secrets, explain key scope, and require confirmation before revoking keys.

32. FRONTEND-Add audit log filters for event type, actor, market, and date range
    Description: Add audit log filters that match backend query capabilities and reduce manual scanning.

33. FRONTEND-Add multisig proposal confirmation details before submission
    Description: Show destination, action summary, required signatures, expiry, and warnings before creating a multisig proposal.

34. FRONTEND-Add settlement result preview for market resolution actions
    Description: Show admins the projected winning outcome, payout effect, and market status before settlement submission.

35. FRONTEND-Improve dispute interface with evidence upload status and validation
    Description: Add validation, progress, and failure handling for dispute evidence uploads and links.

36. FRONTEND-Add offline mode banner and reconnect progress indicator
    Description: Show a persistent offline banner and reconnect progress when backend or network connectivity is unavailable.

37. FRONTEND-Add latency indicator thresholds and tooltip explanations
    Description: Define latency thresholds and explain live, degraded, and disconnected states in a concise tooltip.

38. FRONTEND-Add reusable number formatting utilities for odds, liquidity, and volume
    Description: Centralize formatting for odds, percentages, token amounts, liquidity, and volume to avoid inconsistent decimals.

39. FRONTEND-Add localization-ready labels for market outcomes and order states
    Description: Move market outcome and order state labels into reusable constants or translation-ready helpers.

40. FRONTEND-Add Playwright smoke coverage for wallet, market detail, and trade routes
    Description: Add browser smoke tests for loading the app, opening market details, reaching trade UI, and handling wallet/no-wallet mode.

41. FRONTEND-Add unit tests for bridge API base URL and error parsing
    Description: Test bridge API helpers for backend URL construction, missing configuration, and error response parsing.

42. FRONTEND-Add contract address validation to frontend environment startup checks
    Description: Validate configured contract addresses early so invalid values fail with clear developer-facing errors.

43. FRONTEND-Improve create market flow with flight search autocomplete failure states
    Description: Handle slow responses, empty results, provider failures, and manual entry fallback in flight search autocomplete.

44. FRONTEND-Add governance proposal list filters and voting eligibility messages
    Description: Add proposal filters and explain whether the connected wallet can vote or why voting is unavailable.

45. FRONTEND-Add profile page wallet activity summary and account safety reminders
    Description: Show recent wallet activity, trade activity, backup status, and basic account safety reminders on the profile page.

46. FRONTEND-Add accessible modal focus traps to wallet, trade, and multisig dialogs
    Description: Ensure dialogs trap focus, restore focus on close, and support keyboard dismissal consistently.

47. FRONTEND-Add chart fallback when Recharts cannot render in constrained containers
    Description: Show a fallback message when chart containers are too small or rendering fails instead of leaving empty space.

48. FRONTEND-Add route handler tests for market audit, sentiment, IPFS, and multisig APIs
    Description: Test route handlers for request forwarding, success responses, validation errors, and backend failures.

49. FRONTEND-Improve Docker build documentation for environment-specific client variables
    Description: Clarify that `NEXT_PUBLIC_*` values are build-time client variables and must not contain secrets.

50. FRONTEND-Add end-to-end regression test for archive page filtering and retry behavior
    Description: Add e2e coverage for archive loading, filtering, backend failure, retry behavior, and empty states.

## Backend Issues

51. BACKEND-Consolidate Express and NestJS startup documentation into one canonical runbook
    Description: Resolve conflicting backend startup notes and document the correct dev and production entrypoints, ports, and environment setup.

52. BACKEND-Add health checks for MongoDB, Redis, RPC, AviationStack, and AI provider dependencies
    Description: Extend health endpoints to report database, cache, blockchain RPC, flight data, and AI provider status.

53. BACKEND-Add request correlation IDs across controllers, routes, jobs, and logs
    Description: Generate or propagate request IDs through APIs, background jobs, and logs to make production incidents traceable.

54. BACKEND-Add structured error envelopes for all REST endpoints
    Description: Standardize API errors with code, message, details, requestId, and timestamp across NestJS and Express routes.

55. BACKEND-Add OpenAPI documentation for NestJS modules and legacy Express routes
    Description: Document routes, DTOs, response shapes, authentication requirements, and error responses for integrators.

56. BACKEND-Add authentication guard coverage to sensitive AML, approvals, and blacklist endpoints
    Description: Ensure compliance and approval routes reject anonymous or invalid requests and add tests for those cases.

57. BACKEND-Add role-based authorization policies for market admin and settlement routes
    Description: Enforce role checks for pausing markets, resolving outcomes, settling markets, and triggering rollback operations.

58. BACKEND-Add integration tests for archive markets endpoint consumed by the frontend
    Description: Test archive filters, pagination, empty results, malformed rows, and error behavior expected by the frontend archive page.

59. BACKEND-Add WebSocket heartbeat and reconnect metrics for price gateway clients
    Description: Track socket connections, heartbeats, dropped clients, reconnects, and subscription counts for price feeds.

60. BACKEND-Add rate-limit configuration validation at startup
    Description: Validate rate-limit settings and Redis requirements before the server starts to avoid unsafe production defaults.

61. BACKEND-Add Redis-backed idempotency keys for trade placement and settlement requests
    Description: Prevent duplicate trade and settlement processing by storing short-lived idempotency keys and replay-safe responses.

62. BACKEND-Add background job retry limits and dead-letter logging
    Description: Add bounded retries for jobs and log final failures with enough context for operator recovery.

63. BACKEND-Add audit trail entries for market creation, resolution, pause, and rollback actions
    Description: Record actor, timestamp, market ID, previous state, new state, and transaction references for major lifecycle events.

64. BACKEND-Add input validation DTOs for legacy Express route payloads
    Description: Add schema or DTO validation to legacy routes for request bodies, params, and query strings.

65. BACKEND-Add pagination metadata to list endpoints for markets, trades, audit logs, and notifications
    Description: Return limit, cursor or page, total where available, and next cursor for list endpoints.

66. BACKEND-Add database indexes for market status, flight number, close time, and user wallet queries
    Description: Add indexes for common market and user lookup paths, with migrations and basic performance validation.

67. BACKEND-Add stale oracle data detection before price-sensitive trade execution
    Description: Block or warn on trades using stale oracle data and include freshness details in the response.

68. BACKEND-Add sanity checks for market migration status before server startup
    Description: Detect missing required migrations before enabling market endpoints and provide clear startup errors.

69. BACKEND-Add circuit breaker integration to trading and bridge service calls
    Description: Protect provider, trading, and bridge operations from cascading failures using circuit breaker behavior.

70. BACKEND-Add graceful shutdown handling for workers, WebSocket gateway, and database clients
    Description: Drain work, close sockets, stop accepting new requests, and disconnect database/cache clients during shutdown.

71. BACKEND-Add centralized environment schema validation for all required secrets and URLs
    Description: Create one validation schema for backend configuration including secrets, URLs, ports, and contract addresses.

72. BACKEND-Add API version deprecation headers and migration guidance for v1 clients
    Description: Add deprecation headers and migration links for old API versions as v2 routes become canonical.

73. BACKEND-Add replay protection for signed wallet and multisig requests
    Description: Enforce nonce, timestamp, and signature checks so signed requests cannot be reused maliciously.

74. BACKEND-Add notification templates for trade filled, dispute opened, and market resolved events
    Description: Create reusable templates with user-facing copy, metadata, severity, and delivery channel hints.

75. BACKEND-Add e2e tests for wallet backup, restore, and emergency withdrawal APIs
    Description: Test backup, restore, and emergency withdrawal flows across success, invalid credentials, and authorization failures.

76. BACKEND-Add monitoring metrics for trade engine latency, failed jobs, and provider errors
    Description: Emit metrics for trade engine performance, failed jobs, and provider error rates for dashboards and alerts.

77. BACKEND-Add fallback handling for AviationStack outages and missing flight data
    Description: Add retries, cached-safe fallback behavior, and clear errors when flight data is unavailable or incomplete.

78. BACKEND-Add cache invalidation rules for market metadata, categories, and trending markets
    Description: Define cache refresh behavior after market updates, resolutions, category changes, and metadata edits.

79. BACKEND-Add validation for IPFS hashes before gateway, pin, and retrieve operations
    Description: Validate CID format and reject unsafe or malformed values before calling IPFS services.

80. BACKEND-Add bridge transaction reconciliation job for stuck or failed cross-chain transfers
    Description: Add a scheduled job that detects stuck bridge transactions, retries eligible transfers, and flags manual recovery cases.

81. BACKEND-Add liquidation service tests for margin threshold and collateral edge cases
    Description: Cover boundary collateral ratios, price movement, partial liquidation, and already-liquidated accounts.

82. BACKEND-Add risk score explainability fields for frontend AI analysis panels
    Description: Include reasons, confidence, input signals, and provider timestamp in risk score responses.

83. BACKEND-Add trade reconciliation alerts when on-chain and database state diverge
    Description: Compare persisted trades with on-chain events and alert when state diverges.

84. BACKEND-Add endpoint-level permission tests for admin, user, and unauthenticated access
    Description: Verify protected endpoints allow the correct roles and reject unauthorized or anonymous callers.

85. BACKEND-Add database migration rollback smoke test and fixture data
    Description: Add migration apply and rollback smoke tests using representative market, trade, and user fixtures.

86. BACKEND-Add abuse detection for high-frequency search, quote, and market audit requests
    Description: Detect and throttle abusive patterns on expensive endpoints using user, wallet, IP, and endpoint counters.

87. BACKEND-Add webhook signature verification and replay window enforcement
    Description: Verify webhook signatures and reject events outside an allowed timestamp window.

88. BACKEND-Add service-level tests for market sentiment and market audit modules
    Description: Test service behavior for valid inputs, provider failures, malformed data, and empty result sets.

89. BACKEND-Add operational runbooks for failed deploy, rollback, and circuit breaker activation
    Description: Document operator steps, commands, checks, and escalation paths for release failures and emergency controls.

90. BACKEND-Add contract ABI version checks before starting contract-facing services
    Description: Validate configured ABIs and deployed addresses against backend expectations before enabling contract-facing services.

## Contract Issues

91. CONTRACT-Decide and document LMSR versus CLOB ownership for core trading flow
    Description: Resolve whether LMSR or CLOB is canonical for core trading and document routing expectations for backend and frontend integrations.

92. CONTRACT-Add deploy script coverage for RoleManager, FeeHandler, CircuitBreaker, and core market contracts
    Description: Add Foundry deployment scripts with constructor args, environment variables, broadcast commands, and output artifacts.

93. CONTRACT-Add full forge test target once unrelated parsing and type errors are resolved
    Description: Restore a reliable repo-wide `forge test` target after existing Solidity parse and type errors are fixed.

94. CONTRACT-Add invariant tests for LMSR pricing, liquidity, and payout conservation
    Description: Add invariant tests proving pricing, liquidity, and payouts remain consistent across trades and settlement.

95. CONTRACT-Add access-control tests for every privileged function across market contracts
    Description: Verify only expected roles can call admin, pause, mint, settlement, fee, bridge, and upgrade functions.

96. CONTRACT-Add pause and unpause coverage for market trading, minting, bridge, and settlement paths
    Description: Test emergency pause behavior across sensitive flows and confirm approved recovery actions still work.

97. CONTRACT-Add events for all admin, risk, settlement, fee, and bridge configuration changes
    Description: Emit indexable events for important configuration and lifecycle changes, including previous and new values where useful.

98. CONTRACT-Add NatSpec comments to public and external functions missing integration guidance
    Description: Add NatSpec for parameters, return values, access restrictions, and key revert conditions.

99. CONTRACT-Add gas snapshots for trade, settle, resolve, bridge, mint, and withdraw flows
    Description: Track gas usage for high-frequency and high-risk contract flows to catch regressions during review.

100. CONTRACT-Add deployment address registry artifact consumed by backend and frontend
     Description: Generate a machine-readable registry of deployed addresses, chain IDs, contract names, and ABI versions.

101. CONTRACT-Add constructor validation for zero addresses, invalid basis points, and empty dependencies
     Description: Harden constructors with validation for addresses, basis points, dependency contracts, and initial settings.

102. CONTRACT-Add fee recipient sum validation tests for FeeHandler edge cases
     Description: Test empty recipients, duplicate recipients, invalid totals, and maximum fee values.

103. CONTRACT-Add role handoff runbook and tests for deployer admin transfer
     Description: Document and test admin transfer after deployment, including co-admin setup and renounce risks.

104. CONTRACT-Add slippage and max-cost enforcement tests for Trading and MarketMaker flows
     Description: Ensure users cannot be charged above declared max cost or receive worse pricing than accepted.

105. CONTRACT-Add oracle freshness enforcement before resolution and payout execution
     Description: Require fresh trusted oracle data before resolving markets or executing payouts.

106. CONTRACT-Add reentrancy coverage for withdrawal, payout, bridge, and flash borrow functions
     Description: Test value-moving and external-call flows for reentrancy risk and add guards where needed.

107. CONTRACT-Add fuzz tests for market cap, supply controller, and minting pause boundaries
     Description: Fuzz supply limits, caps, pause states, and edge inputs under varied call sequences.

108. CONTRACT-Add upgrade authorization tests for UUPS and proxy-managed contracts
     Description: Verify only authorized roles can upgrade implementations and that state is preserved after upgrade.

109. CONTRACT-Add storage layout documentation for upgradeable market contracts
     Description: Document storage slot expectations and safe variable-addition rules for upgradeable contracts.

110. CONTRACT-Add emergency stop tests for active trades, pending withdrawals, and settlement attempts
     Description: Test how emergency stop affects active trades, queued withdrawals, and settlement operations.

111. CONTRACT-Add cross-chain relay failure handling tests for retry, refund, and duplicate delivery
     Description: Test relay failures, duplicate messages, retries, refunds, and state consistency across chains.

112. CONTRACT-Add liquidation math tests for rounding, collateral ratios, and partial liquidation
     Description: Cover precision, rounding direction, collateral thresholds, and partial liquidation results.

113. CONTRACT-Add vote delegation tests for delegation loops, revoke behavior, and vote weight snapshots
     Description: Ensure delegation loops are impossible, revokes update power, and snapshots remain consistent.

114. CONTRACT-Add governance quorum tests for edge cases around abstain votes and late voting
     Description: Test quorum calculations, abstentions, votes near deadlines, and proposal state transitions.

115. CONTRACT-Add dispute lifecycle tests for evidence, appeal, ruling timelock, and verdict execution
     Description: Cover the dispute flow from evidence through appeal, timelock, ruling, and verdict execution.

116. CONTRACT-Add bridge connector tests for unsupported chain IDs and malformed payloads
     Description: Ensure unsupported destinations and invalid payloads fail explicitly without partial state changes.

117. CONTRACT-Add market factory tests for deterministic market IDs and duplicate flight markets
     Description: Test deterministic IDs, duplicate flight markets, invalid flight data, and repeated creation attempts.

118. CONTRACT-Add payout tests for cancelled, delayed, on-time, and unresolved flight outcomes
     Description: Verify payout behavior for all flight outcome states and invalid unresolved outcomes.

119. CONTRACT-Add withdrawal queue tests for ordering, limits, and claim expiration
     Description: Test queue ordering, per-user and global limits, and expired withdrawal claims.

120. CONTRACT-Add blacklist and whitelist interaction tests for restricted trading and withdrawals
     Description: Verify restricted users are blocked consistently across trading, withdrawals, bridge, and payout claims.

121. CONTRACT-Add coverage tier tests for premium calculation and claim eligibility boundaries
     Description: Test premium, eligibility, and claim amount calculations at coverage tier boundary values.

122. CONTRACT-Add flash loan protection tests around same-block manipulation and nested calls
     Description: Verify same-block manipulation and nested exploit attempts are blocked around price-sensitive functions.

123. CONTRACT-Add deployment verification script for ABI generation and address export
     Description: Add a script that verifies compilation, ABI generation, deployment address export, and expected artifact paths.

124. CONTRACT-Add contract-to-backend integration checklist for emitted events and expected DTO fields
     Description: Document emitted events, backend DTO fields, and state transitions expected by backend indexers.

125. CONTRACT-Add security review checklist for roles, oracle trust, upgrade keys, and emergency controls
     Description: Create a review checklist covering privileged roles, oracle trust, upgrade authority, emergency controls, external calls, and value movement.
