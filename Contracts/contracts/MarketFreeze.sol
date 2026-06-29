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
    function addFreezer(address freezer) external onlyOwner {
        if (freezer == address(0)) revert ZeroAddress();
        if (_freezers[freezer]) revert AlreadyFreezer();
        _freezers[freezer] = true;
        _freezerList.push(freezer);
        emit FreezerAdded(freezer);
    }

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

    function isFreezer(address account) external view returns (bool) {
        return _freezers[account];
    }

    function getFreezers() external view returns (address[] memory) {
        return _freezerList;
    }

    // -------------------------------------------------------------------------
    // Freeze / unfreeze
    // -------------------------------------------------------------------------

    /// @notice Freeze every operation on a market.
    function freezeMarket(address market, string calldata reason) external onlyFreezer {
        _freeze(market, OP_ALL, reason);
    }

    /// @notice Freeze a single operation on a market (e.g. only withdrawals).
    function freezeOperation(address market, bytes32 operation, string calldata reason) external onlyFreezer {
        _freeze(market, operation, reason);
    }

    /// @notice Lift a market-wide freeze.
    function unfreezeMarket(address market) external onlyFreezer {
        _unfreeze(market, OP_ALL);
    }

    /// @notice Lift a per-operation freeze.
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
    function isMarketFrozen(address market) public view returns (bool) {
        return _freezes[market][OP_ALL].frozen;
    }

    /// @notice Whether a specific operation is frozen.
    /// @dev A market-wide OP_ALL freeze also counts as frozen for any operation.
    function isOperationFrozen(address market, bytes32 operation) public view returns (bool) {
        if (_freezes[market][OP_ALL].frozen) return true;
        return _freezes[market][operation].frozen;
    }

    /// @notice Read the freeze record for a given operation.
    function getFreezeInfo(address market, bytes32 operation) external view returns (FreezeInfo memory) {
        return _freezes[market][operation];
    }

    /// @notice Convenience guard helper for downstream contracts.
    function requireOperationAllowed(address market, bytes32 operation) external view {
        if (isOperationFrozen(market, operation)) revert OperationFrozen(operation);
    }
}
