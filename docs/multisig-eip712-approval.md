# Multisig EIP-712 approval format

The frontend store, backend service, and `Contracts/src/MultiSigWallet.sol` use the same approval schema. Keep the constants in those implementations synchronized with this reference.

**Domain**

```json
{
  "name": "GateDelay MultiSig",
  "version": "1",
  "chainId": "the target chain ID",
  "verifyingContract": "the multisig wallet address"
}
```

**Primary type**

```text
MultisigApproval(uint256 chainId,address walletAddress,uint256 nonce,address target,uint256 value,bytes32 calldataHash,uint256 expiry)
```

`calldataHash` is `keccak256` of the exact calldata bytes. `value` is the wei amount. The wallet assigns a monotonically increasing nonce and stores the expiry with the call. The contract checks the recovered signer against its owner set, rejects expired proposals, and allows a nonce to authorize only the transaction that first consumed it. For more than one required signer, additional valid approvals for that same transaction and nonce remain accepted.

Signers must sign the exact domain and message returned by the frontend/backend `buildTypedData` helper. The contract's `getApprovalDigest` computes the matching EIP-712 digest from its stored transaction fields.
