Resolution workflow storage
===========================

Requests, confirmations, and disputes are stored together in MongoDB's resolution_workflows collection. Startup installs unique indexes and a strict collection validator; the database account must have createIndex and collMod permissions. Startup fails if constraints cannot be installed. Updates compare the saved revision, status, market, and attempt so concurrent actions cannot overwrite each other. Cancelled attempts release the unique active-market slot; resolved attempts continue to reserve it.

Confirmation requires DEPLOYMENT_REGISTRY_JSON to contain the Resolution deployment on the chain served by BLOCKCHAIN_RPC_URL. RESOLUTION_REQUIRED_CONFIRMATIONS is a positive integer (default 12). The verifier checks a successful canonical receipt and the exact Resolution.MarketResolved(address,uint8,address) event, emitting contract, market address, and outcome. The contract enum is NONE=0, YES=1, NO=2. INVALID requests cannot be confirmed through this event. A supplied block number must match the receipt; stored block data always comes from RPC.

Rejected disputes restore their recorded prior state, with confirmed restoration requiring current verified evidence. Upholding a dispute cancels and seals that attempt, clears its active transaction fields, and marks historical confirmations invalid. Submit a new resolution request to select the replacement outcome. Each new request has a new ID and increasing market attempt number. The unique evidence index retains invalidated evidence so a replacement cannot replay a rejected transaction event. Historical attempts remain available by ID and in the resolution list; market status/report returns the latest attempt.

Previous Map contents were never durable and cannot be recovered automatically after restart. No migration imports unverified old confirmations.
