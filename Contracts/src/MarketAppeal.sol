// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MarketAppeal
/// @notice Handles appeal submissions, manages appeal lifecycle, tracks status, and exposes queries.
contract MarketAppeal {
    enum AppealStatus {
        NONE,
        SUBMITTED,
        UNDER_REVIEW,
        DECIDED
    }

    struct Appeal {
        address market;
        address appellant;
        string evidenceURI;
        uint256 submittedAt;
        AppealStatus status;
        bool accepted;
        string decisionReason;
        bytes32 verdictId;
    }

    mapping(bytes32 => Appeal) private _appeals;

    address public owner;

    event AppealSubmitted(
        bytes32 indexed appealId,
        address indexed market,
        address indexed appellant
    );
    event ReviewStarted(bytes32 indexed appealId);
    event AppealDecided(
        bytes32 indexed appealId,
        bool accepted,
        bytes32 verdictId
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert("Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Submit an appeal for a market.
    function submitAppeal(
        address market,
        string calldata evidenceURI
    ) external returns (bytes32) {
        bytes32 id = keccak256(
            abi.encodePacked(market, msg.sender, block.timestamp, block.number)
        );
        Appeal storage a = _appeals[id];
        require(a.status == AppealStatus.NONE, "Already exists");

        a.market = market;
        a.appellant = msg.sender;
        a.evidenceURI = evidenceURI;
        a.submittedAt = block.timestamp;
        a.status = AppealStatus.SUBMITTED;

        emit AppealSubmitted(id, market, msg.sender);
        return id;
    }

    /// @notice Mark an appeal as under review. Owner only.
    function startReview(bytes32 appealId) external onlyOwner {
        Appeal storage a = _appeals[appealId];
        require(a.status == AppealStatus.SUBMITTED, "Not submitted");
        a.status = AppealStatus.UNDER_REVIEW;
        emit ReviewStarted(appealId);
    }

    /// @notice Decide an appeal. Owner only. Optionally attach a verdict id to link to external execution.
    function decideAppeal(
        bytes32 appealId,
        bool accept,
        string calldata reason,
        bytes32 verdictId
    ) external onlyOwner {
        Appeal storage a = _appeals[appealId];
        require(a.status == AppealStatus.UNDER_REVIEW, "Not under review");
        a.status = AppealStatus.DECIDED;
        a.accepted = accept;
        a.decisionReason = reason;
        a.verdictId = verdictId;

        emit AppealDecided(appealId, accept, verdictId);
    }

    /// @notice Query an appeal record.
    function getAppeal(
        bytes32 appealId
    )
        external
        view
        returns (
            address market,
            address appellant,
            string memory evidenceURI,
            uint256 submittedAt,
            AppealStatus status,
            bool accepted,
            string memory decisionReason,
            bytes32 verdictId
        )
    {
        Appeal storage a = _appeals[appealId];
        return (
            a.market,
            a.appellant,
            a.evidenceURI,
            a.submittedAt,
            a.status,
            a.accepted,
            a.decisionReason,
            a.verdictId
        );
    }
}
