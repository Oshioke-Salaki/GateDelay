// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MarketMinter
/// @notice Controls minting permissions and forwards mint requests to an ERC20 token.
contract MarketMinter is AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Simple ERC20 mint interface used by this controller
    interface IERC20Mint {
        function mint(address to, uint256 amount) external;
    }

    IERC20Mint public immutable token;

    /// @dev total minted by each minter through this contract
    mapping(address => uint256) private _mintedTotal;

    /// @dev global cap per minter (0 = unlimited)
    mapping(address => uint256) private _mintCap;

    /// @dev per-call cap per minter (0 = unlimited)
    mapping(address => uint256) private _perMintCap;

    event MinterRegistered(address indexed minter, uint256 cap, uint256 perMintCap);
    event MinterUnregistered(address indexed minter);
    event Mint(address indexed minter, address indexed to, uint256 amount);
    event MintCapUpdated(address indexed minter, uint256 cap);
    event PerMintCapUpdated(address indexed minter, uint256 perMintCap);

    error NotMinter();
    error ExceedsPerMintCap();
    error ExceedsTotalCap();
    error ZeroAddress();

    constructor(address tokenAddress) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20Mint(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Register an address as a minter and set its caps. Only admin.
    function registerMinter(address minter, uint256 cap, uint256 perMintCap_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (minter == address(0)) revert ZeroAddress();
        _grantRole(MINTER_ROLE, minter);
        _mintCap[minter] = cap;
        _perMintCap[minter] = perMintCap_;
        emit MinterRegistered(minter, cap, perMintCap_);
    }

    /// @notice Unregister a minter. Only admin.
    function unregisterMinter(address minter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, minter);
        _mintCap[minter] = 0;
        _perMintCap[minter] = 0;
        emit MinterUnregistered(minter);
    }

    /// @notice Update total cap for a minter. Only admin.
    function setMintCap(address minter, uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _mintCap[minter] = cap;
        emit MintCapUpdated(minter, cap);
    }

    /// @notice Update per-call cap for a minter. Only admin.
    function setPerMintCap(address minter, uint256 perMintCap_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _perMintCap[minter] = perMintCap_;
        emit PerMintCapUpdated(minter, perMintCap_);
    }

    /// @notice Mint tokens via the underlying token contract. Caller must have `MINTER_ROLE`.
    function mint(address to, uint256 amount) external {
        if (!hasRole(MINTER_ROLE, msg.sender)) revert NotMinter();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ExceedsPerMintCap();

        uint256 perCap = _perMintCap[msg.sender];
        if (perCap != 0 && amount > perCap) revert ExceedsPerMintCap();

        uint256 cap = _mintCap[msg.sender];
        if (cap != 0) {
            uint256 already = _mintedTotal[msg.sender];
            if (already + amount > cap) revert ExceedsTotalCap();
            _mintedTotal[msg.sender] = already + amount;
        } else {
            // unlimited, still track
            _mintedTotal[msg.sender] += amount;
        }

        token.mint(to, amount);
        emit Mint(msg.sender, to, amount);
    }

    // --------- Queries ---------
    function isMinter(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    function mintedTotal(address minter) external view returns (uint256) {
        return _mintedTotal[minter];
    }

    /// @notice Returns configured total cap (0 = unlimited)
    function mintCap(address minter) external view returns (uint256) {
        return _mintCap[minter];
    }

    /// @notice Returns configured per-call cap (0 = unlimited)
    function perMintCap(address minter) external view returns (uint256) {
        return _perMintCap[minter];
    }

    /// @notice Remaining cap for a minter (uint256 max if unlimited)
    function remainingCap(address minter) external view returns (uint256) {
        uint256 cap = _mintCap[minter];
        if (cap == 0) return type(uint256).max;
        uint256 used = _mintedTotal[minter];
        if (used >= cap) return 0;
        return cap - used;
    }
}
