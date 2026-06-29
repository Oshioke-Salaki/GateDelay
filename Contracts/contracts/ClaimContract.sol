// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ClaimContract
/// @notice Handles claim submissions, eligibility validation, payout calculation, status tracking, and query operations.
contract ClaimContract {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidMarket();
    error InvalidAmount();
    error InvalidReason();
    error InvalidIncidentTime();
    error ClaimNotFound();
    error ClaimAlreadyProcessed();
    error ClaimNotPending();
    error ClaimNotValidated();
    error ClaimNotApproved();
    error Unauthorized();
    error InvalidPayout();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum ClaimStatus {
        PENDING,
        VALIDATED,
        REJECTED,
        APPROVED,
        PAID
    }

    enum ClaimType {
        LIQUIDITY,
        FRAUD,
        RESOLUTION,
        OPERATIONAL
    }

    struct Claim {
        address claimant;
        address market;
        ClaimType claimType;
        uint256 amountRequested;
        uint256 payoutAmount;
        uint256 incidentTimestamp;
        uint256 submittedAt;
        uint256 processedAt;
        ClaimStatus status;
        string reason;
        string decisionNote;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ClaimSubmitted(
        uint256 indexed claimId,
        address indexed claimant,
        address indexed market,
        ClaimType claimType,
        uint256 amountRequested,
        uint256 incidentTimestamp
    );

    event ClaimValidated(uint256 indexed claimId, bool eligible, uint256 payoutAmount);
    event ClaimRejected(uint256 indexed claimId, string reason);
    event ClaimApproved(uint256 indexed claimId, uint256 payoutAmount);
    event ClaimPaid(uint256 indexed claimId, uint256 payoutAmount);
    event ClaimPayoutRateUpdated(ClaimType indexed claimType, uint256 newRateBps);
    event OwnerUpdated(address indexed previousOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_INCIDENT_WINDOW = 90 days;
    uint256 public constant MAX_CLAIM_AMOUNT = 10_000 ether;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address public owner;
    uint256 public nextClaimId;

    mapping(uint256 => Claim) private _claims;
    mapping(address => uint256[]) private _claimsByUser;
    mapping(address => uint256[]) private _claimsByMarket;
    mapping(ClaimType => uint256) public payoutRatesBps;

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor() {
        owner = msg.sender;

        payoutRatesBps[ClaimType.LIQUIDITY] = 8_000;   // 80%
        payoutRatesBps[ClaimType.FRAUD] = 6_000;      // 60%
        payoutRatesBps[ClaimType.RESOLUTION] = 9_000; // 90%
        payoutRatesBps[ClaimType.OPERATIONAL] = 7_000; // 70%
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Submit a new claim.
    /// @param market Market address associated with the claim.
    /// @param claimType Category of the claim.
    /// @param amountRequested Requested payout amount.
    /// @param incidentTimestamp Timestamp when the incident occurred.
    /// @param reason Text description of the claim.
    function submitClaim(
        address market,
        ClaimType claimType,
        uint256 amountRequested,
        uint256 incidentTimestamp,
        string calldata reason
    ) external returns (uint256 claimId) {
        if (market == address(0)) revert InvalidMarket();
        if (amountRequested == 0 || amountRequested > MAX_CLAIM_AMOUNT) revert InvalidAmount();
        if (bytes(reason).length == 0) revert InvalidReason();
        if (incidentTimestamp == 0 || incidentTimestamp > block.timestamp) revert InvalidIncidentTime();
        if (block.timestamp - incidentTimestamp > MAX_INCIDENT_WINDOW) revert InvalidIncidentTime();

        claimId = nextClaimId++;

        _claims[claimId] = Claim({
            claimant: msg.sender,
            market: market,
            claimType: claimType,
            amountRequested: amountRequested,
            payoutAmount: 0,
            incidentTimestamp: incidentTimestamp,
            submittedAt: block.timestamp,
            processedAt: 0,
            status: ClaimStatus.PENDING,
            reason: reason,
            decisionNote: ""
        });

        _claimsByUser[msg.sender].push(claimId);
        _claimsByMarket[market].push(claimId);

        emit ClaimSubmitted(claimId, msg.sender, market, claimType, amountRequested, incidentTimestamp);
    }

    /// @notice Validate claim eligibility and calculate the expected payout.
    /// @param claimId ID of the claim to validate.
    function validateClaim(uint256 claimId) external onlyOwner returns (bool eligible) {
        Claim storage claim = _getClaim(claimId);
        if (claim.status != ClaimStatus.PENDING) revert ClaimNotPending();

        eligible = _isEligible(claim);

        if (!eligible) {
            claim.status = ClaimStatus.REJECTED;
            claim.processedAt = block.timestamp;
            claim.decisionNote = "Eligibility validation failed";
            emit ClaimRejected(claimId, claim.decisionNote);
            emit ClaimValidated(claimId, false, 0);
            return false;
        }

        uint256 payout = _calculatePayout(claim);
        if (payout == 0) revert InvalidPayout();

        claim.status = ClaimStatus.VALIDATED;
        claim.payoutAmount = payout;
        claim.processedAt = block.timestamp;
        claim.decisionNote = "Eligible claim";

        emit ClaimValidated(claimId, true, payout);
        return true;
    }

    /// @notice Approve a validated claim.
    /// @param claimId ID of the claim to approve.
    function approveClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = _getClaim(claimId);
        if (claim.status != ClaimStatus.VALIDATED) revert ClaimNotValidated();

        claim.status = ClaimStatus.APPROVED;
        claim.processedAt = block.timestamp;

        emit ClaimApproved(claimId, claim.payoutAmount);
    }

    /// @notice Mark an approved claim as paid.
    /// @param claimId ID of the claim to pay.
    function payClaim(uint256 claimId) external onlyOwner {
        Claim storage claim = _getClaim(claimId);
        if (claim.status != ClaimStatus.APPROVED) revert ClaimNotApproved();

        claim.status = ClaimStatus.PAID;
        claim.processedAt = block.timestamp;

        emit ClaimPaid(claimId, claim.payoutAmount);
    }

    /// @notice Update the payout rate for a claim type.
    /// @param claimType Claim type to update.
    /// @param newRateBps New payout rate in basis points.
    function updatePayoutRate(ClaimType claimType, uint256 newRateBps) external onlyOwner {
        if (newRateBps == 0 || newRateBps > BPS_DENOMINATOR) revert InvalidPayout();

        payoutRatesBps[claimType] = newRateBps;
        emit ClaimPayoutRateUpdated(claimType, newRateBps);
    }

    /// @notice Transfer ownership of the contract.
    /// @param newOwner New owner address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidMarket();

        emit OwnerUpdated(owner, newOwner);
        owner = newOwner;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    /// @notice Fetch a claim by its ID.
    function getClaim(uint256 claimId) external view returns (Claim memory) {
        return _getClaim(claimId);
    }

    /// @notice Get all claims submitted by a user.
    function getClaimsByUser(address claimant) external view returns (uint256[] memory) {
        return _claimsByUser[claimant];
    }

    /// @notice Get all claims submitted for a market.
    function getClaimsByMarket(address market) external view returns (uint256[] memory) {
        return _claimsByMarket[market];
    }

    /// @notice Get the current status of a claim.
    function getClaimStatus(uint256 claimId) external view returns (ClaimStatus) {
        Claim storage claim = _getClaim(claimId);
        return claim.status;
    }

    /// @notice Get expected payout for a claim.
    function getClaimPayout(uint256 claimId) external view returns (uint256) {
        Claim storage claim = _getClaim(claimId);
        if (claim.status == ClaimStatus.PAID || claim.status == ClaimStatus.APPROVED || claim.status == ClaimStatus.VALIDATED) {
            return claim.payoutAmount;
        }
        if (claim.status == ClaimStatus.PENDING) {
            if (!_isEligible(claim)) {
                return 0;
            }
            return _calculatePayout(claim);
        }
        return 0;
    }

    /// @notice Check whether a claim is eligible.
    function isClaimEligible(uint256 claimId) external view returns (bool) {
        Claim storage claim = _getClaim(claimId);
        return _isEligible(claim);
    }

    /// @notice Get total number of claims submitted.
    function getClaimCount() external view returns (uint256) {
        return nextClaimId;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    function _getClaim(uint256 claimId) internal view returns (Claim storage) {
        if (claimId >= nextClaimId) revert ClaimNotFound();
        return _claims[claimId];
    }

    function _isEligible(Claim storage claim) internal view returns (bool) {
        if (claim.claimant == address(0)) return false;
        if (claim.market == address(0)) return false;
        if (claim.amountRequested == 0 || claim.amountRequested > MAX_CLAIM_AMOUNT) return false;
        if (bytes(claim.reason).length == 0) return false;
        if (claim.incidentTimestamp == 0 || claim.incidentTimestamp > block.timestamp) return false;
        if (block.timestamp - claim.incidentTimestamp > MAX_INCIDENT_WINDOW) return false;
        return true;
    }

    function _calculatePayout(Claim storage claim) internal view returns (uint256) {
        uint256 rate = payoutRatesBps[claim.claimType];
        if (rate == 0) return 0;
        return (claim.amountRequested * rate) / BPS_DENOMINATOR;
    }
}
