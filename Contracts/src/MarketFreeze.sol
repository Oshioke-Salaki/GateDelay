// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MarketFreeze
/// @notice Per-market and per-operation freeze controls for emergency response.
contract MarketFreeze is Ownable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error NotFreezer();
    error AlreadyFreezer();
    error MarketAlreadyFrozen(bytes32 op);
    error MarketNotFrozen(bytes32 op);
    error OperationFrozen(bytes32 op);
    error InvalidMarket();

    // -------------------------------------------------------------------------
    // Built-in operation identifiers
    // -------------------------------------------------------------------------
    bytes32 public constant OP_ALL      = keccak256("OP_ALL");
    bytes32 public constant OP_TRADE    = keccak256("OP_TRADE");
    bytes32 public constant OP_DEPOSIT  = keccak256("OP_DEPOSIT");
    bytes32 public constant OP_WITHDRAW = keccak256("OP_WITHDRAW");
    bytes32 public constant OP_RESOLVE  = keccak256("OP_RESOLVE");

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    struct FreezeInfo {
        bool frozen;
        address frozenBy;
        uint64 frozenAt;
        string reason;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    /// @dev market => operation => freeze info
    mapping(address => mapping(bytes32 => FreezeInfo)) private _freezes;

    /// @dev addresses authorised to freeze/unfreeze
    mapping(address => bool) private _freezers;
    address[] private _freezerList;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event FreezerAdded(address indexed freezer);
    event FreezerRemoved(address indexed freezer);
    event MarketFrozen(address indexed market, bytes32 indexed operation, address indexed by, string reason);
    event MarketUnfrozen(address indexed market, bytes32 indexed operation, address indexed by);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address initialOwner) Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyFreezer() {
        if (!_freezers[msg.sender] && msg.sender != owner()) revert NotFreezer();
        _;
    }

    // -------------------------------------------------------------------------
    // Freezer registry
    // -------------------------------------------------------------------------
    /// @notice Executes addFreezer.
    /// @param freezer Address associated with freezer.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `freezer == address(0)` is true. `AlreadyFreezer` if
    ///     `_freezers[freezer]` is true.
    function addFreezer(address freezer) external onlyOwner {
        if (freezer == address(0)) revert ZeroAddress();
        if (_freezers[freezer]) revert AlreadyFreezer();
        _freezers[freezer] = true;
        _freezerList.push(freezer);
        emit FreezerAdded(freezer);
    }

    /// @notice Executes removeFreezer.
    /// @param freezer Address associated with freezer.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `NotFreezer` if `!_freezers[freezer]` is true.
    function removeFreezer(address freezer) external onlyOwner {
        if (!_freezers[freezer]) revert NotFreezer();
        _freezers[freezer] = false;

        uint256 len = _freezerList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_freezerList[i] == freezer) {
                _freezerList[i] = _freezerList[len - 1];
                _freezerList.pop();
                break;
            }
        }
        emit FreezerRemoved(freezer);
    }

    /// @notice Reports whether freezer is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isFreezer(address account) external view returns (bool) {
        return _freezers[account];
    }

    /// @notice Returns freezers.
    /// @return Freezers returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getFreezers() external view returns (address[] memory) {
        return _freezerList;
    }

    // -------------------------------------------------------------------------
    // Freeze / unfreeze
    // -------------------------------------------------------------------------

    /// @notice Freeze every operation on a market.
    /// @param market Market address associated with this operation.
    /// @param reason reason used by this operation.
    /// @dev Access: Caller must satisfy `onlyFreezer` access checks.
    function freezeMarket(address market, string calldata reason) external onlyFreezer {
        _freeze(market, OP_ALL, reason);
    }

    /// @notice Freeze a single operation on a market (e.g. only withdrawals).
    /// @param market Market address associated with this operation.
    /// @param operation Encoded data used for operation.
    /// @param reason reason used by this operation.
    /// @dev Access: Caller must satisfy `onlyFreezer` access checks.
    function freezeOperation(address market, bytes32 operation, string calldata reason) external onlyFreezer {
        _freeze(market, operation, reason);
    }

    /// @notice Lift a market-wide freeze.
    /// @param market Market address associated with this operation.
    /// @dev Access: Caller must satisfy `onlyFreezer` access checks.
    function unfreezeMarket(address market) external onlyFreezer {
        _unfreeze(market, OP_ALL);
    }

    /// @notice Lift a per-operation freeze.
    /// @param market Market address associated with this operation.
    /// @param operation Encoded data used for operation.
    /// @dev Access: Caller must satisfy `onlyFreezer` access checks.
    function unfreezeOperation(address market, bytes32 operation) external onlyFreezer {
        _unfreeze(market, operation);
    }

    function _freeze(address market, bytes32 operation, string calldata reason) internal {
        if (market == address(0)) revert InvalidMarket();
        FreezeInfo storage info = _freezes[market][operation];
        if (info.frozen) revert MarketAlreadyFrozen(operation);
        info.frozen = true;
        info.frozenBy = msg.sender;
        info.frozenAt = uint64(block.timestamp);
        info.reason = reason;
        emit MarketFrozen(market, operation, msg.sender, reason);
    }

    function _unfreeze(address market, bytes32 operation) internal {
        FreezeInfo storage info = _freezes[market][operation];
        if (!info.frozen) revert MarketNotFrozen(operation);
        info.frozen = false;
        info.frozenBy = address(0);
        info.frozenAt = 0;
        info.reason = "";
        emit MarketUnfrozen(market, operation, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice Whether the entire market is frozen via OP_ALL.
    /// @param market Market address associated with this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isMarketFrozen(address market) public view returns (bool) {
        return _freezes[market][OP_ALL].frozen;
    }

    /// @notice Whether a specific operation is frozen.
    /// @dev A market-wide OP_ALL freeze also counts as frozen for any operation.
    /// @param market Market address associated with this operation.
    /// @param operation Encoded data used for operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isOperationFrozen(address market, bytes32 operation) public view returns (bool) {
        if (_freezes[market][OP_ALL].frozen) return true;
        return _freezes[market][operation].frozen;
    }

    /// @notice Read the freeze record for a given operation.
    /// @param market Market address associated with this operation.
    /// @param operation Encoded data used for operation.
    /// @return Freeze info returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getFreezeInfo(address market, bytes32 operation) external view returns (FreezeInfo memory) {
        return _freezes[market][operation];
    }

    /// @notice Convenience guard helper for downstream contracts.
    /// @param market Market address associated with this operation.
    /// @param operation Encoded data used for operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `OperationFrozen` if `isOperationFrozen(market, operation)` is true.
    function requireOperationAllowed(address market, bytes32 operation) external view {
        if (isOperationFrozen(market, operation)) revert OperationFrozen(operation);
    }
}
