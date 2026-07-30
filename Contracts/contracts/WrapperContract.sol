// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title WrapperContract
/// @notice Upgradeable 1:1 wrapper around a single underlying ERC20 asset. Deposits of the
/// underlying mint an equal amount of the wrapper's own ERC20 token; burning the wrapper
/// token redeems the underlying back out. Upgradeable via UUPS so wrapper logic can evolve
/// without migrating holder balances or the underlying asset address.
contract WrapperContract is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    address public underlyingAsset;
    uint256 public totalUnderlyingHeld;
    uint256 public wrapperVersion;
    uint256 public totalWrapOperations;
    uint256 public totalUnwrapOperations;

    event Wrapped(address indexed account, uint256 amount);
    event Unwrapped(address indexed account, uint256 amount);
    event WrapperUpgraded(uint256 indexed newVersion, address indexed newImplementation);

    error WrapperContract__ZeroAddress();
    error WrapperContract__ZeroAmount();
    error WrapperContract__InsufficientUnderlying(uint256 requested, uint256 available);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address underlying_, string memory name_, string memory symbol_, address initialOwner)
        public
        initializer
    {
        if (underlying_ == address(0) || initialOwner == address(0)) {
            revert WrapperContract__ZeroAddress();
        }

        __ERC20_init(name_, symbol_);
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();

        underlyingAsset = underlying_;
        wrapperVersion = 1;
    }

    /// @notice Deposit `amount` of the underlying asset and receive an equal amount of wrapper tokens.
    function wrap(uint256 amount) external {
        if (amount == 0) revert WrapperContract__ZeroAmount();

        IERC20(underlyingAsset).safeTransferFrom(msg.sender, address(this), amount);

        totalUnderlyingHeld += amount;
        totalWrapOperations += 1;

        _mint(msg.sender, amount);

        emit Wrapped(msg.sender, amount);
    }

    /// @notice Burn `amount` of wrapper tokens and redeem an equal amount of the underlying asset.
    function unwrap(uint256 amount) external {
        if (amount == 0) revert WrapperContract__ZeroAmount();
        if (amount > totalUnderlyingHeld) {
            revert WrapperContract__InsufficientUnderlying(amount, totalUnderlyingHeld);
        }

        _burn(msg.sender, amount);

        totalUnderlyingHeld -= amount;
        totalUnwrapOperations += 1;

        IERC20(underlyingAsset).safeTransfer(msg.sender, amount);

        emit Unwrapped(msg.sender, amount);
    }

    // ---------------------------------------------------------------
    // Upgrades
    // ---------------------------------------------------------------

    /// @dev Restricts upgrades to the owner and bumps the tracked version on every successful upgrade.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        wrapperVersion += 1;
        emit WrapperUpgraded(wrapperVersion, newImplementation);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function getWrapperState()
        external
        view
        returns (
            address underlying,
            uint256 underlyingHeld,
            uint256 version,
            uint256 wrapCount,
            uint256 unwrapCount
        )
    {
        return (underlyingAsset, totalUnderlyingHeld, wrapperVersion, totalWrapOperations, totalUnwrapOperations);
    }

    /// @notice Wrapping is always 1:1; expressed as a fixed-point rate for future-proofing
    /// in case a future version introduces fee-on-wrap or rebasing behavior.
    function exchangeRate() external pure returns (uint256) {
        return 1e18;
    }

    /// @dev Reserved storage slots to allow future versions to add new state variables
    /// without corrupting the storage layout of already-deployed proxies.
    uint256[45] private __gap;
}
