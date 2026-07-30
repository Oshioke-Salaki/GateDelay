# Blacklist.sol - Threat Assumptions & Security Documentation

## Scope & Objective
`Contracts/contracts/Blacklist.sol` manages restricted addresses within the GateDelay protocol.

## Key Threat Assumptions
1. **Admin Key Security:** Blacklist management relies on admin signature verification. Admin key compromise allows unauthorized access/blacklisting.
2. **Reentrancy & State Mutations:** Blacklist checks are read-only view operations during execution flows.
3. **Event Syncing:** Off-chain services monitor `Blacklisted` and `Unblacklisted` events to update real-time transaction routing.
