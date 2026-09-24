# UpgradeableMarket storage layout

`UpgradeableMarket` (`Contracts/src/UpgradeableMarket.sol`) is a UUPS implementation that runs behind an ERC1967 proxy. All of its state lives in the **proxy's** storage, so every new implementation must read the slots below exactly as the previous one wrote them.

Generated with:

```
forge inspect --root Contracts src/UpgradeableMarket.sol:UpgradeableMarket storageLayout
```

## Sequential slots

Inheritance order is `Initializable, UUPSUpgradeable, Ownable`. `Initializable` uses namespaced storage and `UUPSUpgradeable` only an immutable, so `Ownable` takes slot 0.

| Slot | Offset | Bytes | Variable | Type | Declared in |
|---|---|---|---|---|---|
| 0 | 0 | 20 | `_owner` | `address` | `Ownable` |
| 1 | 0 | 32 | `_version` | `uint256` | `UpgradeableMarket` |
| 2 | 0 | 32 | `_upgradeHistory` | `address[]` | `UpgradeableMarket` |
| 3 | 0 | 32 | `_upgradeTimestamps` | `mapping(address => uint256)` | `UpgradeableMarket` |
| 4 | 0 | 1 | `_upgradeLocked` | `bool` | `UpgradeableMarket` |

The array length lives at slot 2 and its elements at `keccak256(2)`. Mapping values live at `keccak256(abi.encode(key, 3))`. Slot 4 has 31 unused bytes after `_upgradeLocked`.

## Fixed slots

| Slot | Holds | Standard |
|---|---|---|
| `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` | Current implementation address | EIP-1967 |
| `0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00` | `Initializable` state (`_initialized`, `_initializing`) | ERC-7201 |

`UUPSUpgradeable` stores nothing: its `__self` is an immutable in the implementation's bytecode.

## Rules for a new implementation

1. **Append only.** Add new variables after `_upgradeLocked`. Never insert a variable before an existing one.
2. **Never remove, reorder, rename-with-a-new-type or retype** an existing variable. A removed variable must stay as a placeholder so the slots after it do not move.
3. **Keep the inheritance order.** Swapping or adding a base contract with sequential storage shifts `_owner` and everything after it.
4. **Small types pack.** A `bool` or `uint8` appended right after `_upgradeLocked` packs into slot 4 (offset 1). That is safe, but check the new layout with `forge inspect` rather than assuming.
5. **Contracts that inherit `UpgradeableMarket`** place their own variables from slot 5. There is no storage gap, so if `UpgradeableMarket` later appends variables, they collide with those of any inheriting contract. For new state, prefer an ERC-7201 namespaced struct (as OpenZeppelin v5 does) over new sequential variables.
6. **Constructors do not run on the proxy.** Any state the proxy needs must be set in `initialize()` or in a `reinitializer(n)` function, never in a constructor.

## Checking a new implementation

Compare the layouts before upgrading:

```
forge inspect --root Contracts src/UpgradeableMarket.sol:UpgradeableMarket storageLayout > old.txt
# check out the new implementation, then:
forge inspect --root Contracts src/UpgradeableMarket.sol:UpgradeableMarket storageLayout > new.txt
diff old.txt new.txt
```

Every existing row must be unchanged; the only differences allowed are new rows at the end. `Contracts/test/UpgradeableMarketStorageLayout.t.sol` pins the slots above and fails if they move.
