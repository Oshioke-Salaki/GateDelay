// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PausableMarket
/// @notice Implements pausable functionality for emergency stops.
contract PausableMarket is Pausable, Ownable {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketPaused(address indexed pauser, string reason);
    event MarketUnpaused(address indexed unpauser);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    string private _pauseReason;
    address private _pausedBy;
    uint256 private _pausedAt;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() Ownable(msg.sender) {}

    // -------------------------------------------------------------------------
    // Pause Management
    // -------------------------------------------------------------------------

    /// @notice Pause the market with a reason.
    /// @param reason The reason for pausing.
    function pause(string calldata reason) external onlyOwner {
        require(!paused(), "Already paused");
        _pauseReason = reason;
        _pausedBy = msg.sender;
        _pausedAt = block.timestamp;
        _pause();
        emit MarketPaused(msg.sender, reason);
    }

    /// @notice Unpause the market.
    function unpause() external onlyOwner {
        require(paused(), "Not paused");
        _pauseReason = "";
        _pausedBy = address(0);
        _pausedAt = 0;
        _unpause();
        emit MarketUnpaused(msg.sender);
    }

    /// @notice Get the pause reason.
    function getPauseReason() external view returns (string memory) {
        return _pauseReason;
    }

    /// @notice Get the address that paused the market.
    function getPausedBy() external view returns (address) {
        return _pausedBy;
    }

    /// @notice Get the timestamp when the market was paused.
    function getPausedAt() external view returns (uint256) {
        return _pausedAt;
    }

    /// @notice Get pause status.
    function isPaused() external view returns (bool) {
        return paused();
    }

    // -------------------------------------------------------------------------
    // Protected Functions
    // -------------------------------------------------------------------------

    /// @notice Example function that can only be called when not paused.
    function executeMarketOperation() external whenNotPaused returns (bool) {
        return true;
    }

    /// @notice Example function that can only be called when paused.
    function emergencyWithdraw() external whenPaused returns (bool) {
        return true;
    }
}
