// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@prb/math/contracts/PRBMath.sol";

/// @title Quorum
/// @notice Manages quorum requirements for governance decisions.
contract Quorum {
    using PRBMath for uint256;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidQuorumPercentage();
    error QuorumNotAchieved();
    error InvalidQuorumType();
    error ZeroTotalVotes();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum QuorumType { ABSOLUTE, PERCENTAGE }

    struct QuorumConfig {
        QuorumType quorumType;
        uint256 threshold;
        uint256 lastUpdated;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event QuorumUpdated(QuorumType indexed quorumType, uint256 threshold);
    event QuorumValidated(uint256 votesReceived, uint256 totalVotes, bool achieved);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    QuorumConfig public quorumConfig;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(QuorumType _quorumType, uint256 _threshold) {
        if (_quorumType == QuorumType.PERCENTAGE && (_threshold > 100e18 || _threshold == 0)) {
            revert InvalidQuorumPercentage();
        }
        if (_quorumType == QuorumType.ABSOLUTE && _threshold == 0) {
            revert InvalidQuorumPercentage();
        }

        quorumConfig = QuorumConfig({
            quorumType: _quorumType,
            threshold: _threshold,
            lastUpdated: block.timestamp
        });
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Calculate the required quorum threshold.
    /// @param totalVotes Total number of votes available.
    /// @return requiredVotes The number of votes required to achieve quorum.
    function calculateQuorumThreshold(uint256 totalVotes) external view returns (uint256) {
        if (totalVotes == 0) revert ZeroTotalVotes();

        if (quorumConfig.quorumType == QuorumType.ABSOLUTE) {
            return quorumConfig.threshold;
        } else {
            // PERCENTAGE: threshold is in basis points (e.g., 50e18 = 50%)
            return totalVotes.mulDiv(quorumConfig.threshold, 100e18);
        }
    }

    /// @notice Validate if quorum has been achieved.
    /// @param votesReceived Number of votes received.
    /// @param totalVotes Total number of votes available.
    /// @return achieved True if quorum is achieved, false otherwise.
    function validateQuorumAchievement(uint256 votesReceived, uint256 totalVotes)
        external
        returns (bool achieved)
    {
        if (totalVotes == 0) revert ZeroTotalVotes();

        uint256 requiredVotes = this.calculateQuorumThreshold(totalVotes);
        achieved = votesReceived >= requiredVotes;

        emit QuorumValidated(votesReceived, totalVotes, achieved);

        if (!achieved) revert QuorumNotAchieved();

        return achieved;
    }

    /// @notice Update the quorum configuration.
    /// @param _quorumType The type of quorum (ABSOLUTE or PERCENTAGE).
    /// @param _threshold The threshold value.
    function updateQuorumConfig(QuorumType _quorumType, uint256 _threshold) external {
        if (_quorumType == QuorumType.PERCENTAGE && (_threshold > 100e18 || _threshold == 0)) {
            revert InvalidQuorumPercentage();
        }
        if (_quorumType == QuorumType.ABSOLUTE && _threshold == 0) {
            revert InvalidQuorumPercentage();
        }

        quorumConfig = QuorumConfig({
            quorumType: _quorumType,
            threshold: _threshold,
            lastUpdated: block.timestamp
        });

        emit QuorumUpdated(_quorumType, _threshold);
    }

    /// @notice Get the current quorum status.
    /// @return quorumType The current quorum type.
    /// @return threshold The current threshold.
    /// @return lastUpdated The timestamp of the last update.
    function getQuorumStatus()
        external
        view
        returns (QuorumType quorumType, uint256 threshold, uint256 lastUpdated)
    {
        return (quorumConfig.quorumType, quorumConfig.threshold, quorumConfig.lastUpdated);
    }
}
