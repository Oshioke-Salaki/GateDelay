// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";
import "./RiskAssessment.sol";
import "./PremiumCalculator.sol";

/// @title MarketInsurance
/// @notice Manages insurance policies, coverage tracking, claims handling, and premium calculations for markets.
contract MarketInsurance {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidMarket();
    error InvalidPolicy();
    error InvalidCoverage();
    error PolicyNotActive();
    error ClaimNotFound();
    error ClaimAlreadyProcessed();
    error ClaimExpired();
    error InsufficientFunds();
    error UnauthorizedClaim();
    error InvalidClaimAmount();
    error InvalidPolicyDuration();
    error PolicyAlreadyExists();
    error Unauthorized();
    error InvalidPremiumRate();
    error ZeroCoverage();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Insurance policy status
    enum PolicyStatus {
        ACTIVE,
        EXPIRED,
        CLAIMED,
        CANCELLED
    }

    /// @notice Claim status
    enum ClaimStatus {
        PENDING,
        APPROVED,
        REJECTED,
        PAID
    }

    /// @notice Policy coverage tier
    enum CoverageTier {
        BASIC,
        STANDARD,
        PREMIUM,
        PLATINUM
    }

    /// @notice Insurance policy structure
    struct InsurancePolicy {
        address policyHolder;
        address market;
        uint256 coverageAmount;
        uint256 premiumRate; // in basis points
        uint256 startTime;
        uint256 expiryTime;
        CoverageTier tier;
        PolicyStatus status;
        bool autoRenewal;
        uint256 totalClaimsProcessed;
    }

    /// @notice Insurance coverage tracking
    struct CoverageInfo {
        uint256 coveredAmount;
        uint256 remainingCoverage;
        uint256 utilizationPercentage;
        bool isActive;
        uint256 lastUpdated;
    }

    /// @notice Insurance claim structure
    struct InsuranceClaim {
        address claimant;
        address market;
        uint256 policyId;
        uint256 claimAmount;
        uint256 claimTime;
        uint256 processedTime;
        string claimReason;
        ClaimStatus status;
        uint256 approvedAmount;
    }

    /// @notice Premium structure for different coverage tiers
    struct PremiumStructure {
        uint256 basicRate; // in basis points
        uint256 standardRate;
        uint256 premiumRate;
        uint256 platinumRate;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed policyHolder,
        address indexed market,
        uint256 coverageAmount,
        CoverageTier tier,
        uint256 expiryTime
    );

    event PolicyRenewed(
        uint256 indexed policyId,
        address indexed policyHolder,
        uint256 newExpiryTime
    );

    event PolicyCancelled(
        uint256 indexed policyId,
        address indexed policyHolder,
        uint256 refundAmount
    );

    event CoverageUpdated(
        address indexed policyHolder,
        address indexed market,
        uint256 newCoverageAmount,
        uint256 remainingCoverage
    );

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        address indexed claimant,
        uint256 claimAmount,
        string reason
    );

    event ClaimApproved(
        uint256 indexed claimId,
        uint256 approvedAmount,
        address indexed policyHolder
    );

    event ClaimRejected(uint256 indexed claimId, string reason);

    event ClaimPaid(
        uint256 indexed claimId,
        address indexed recipient,
        uint256 paidAmount
    );

    event PremiumCalculated(
        address indexed policyHolder,
        address indexed market,
        uint256 coverageAmount,
        CoverageTier tier,
        uint256 premiumAmount
    );

    event PremiumRatesUpdated(
        uint256 basicRate,
        uint256 standardRate,
        uint256 premiumRate,
        uint256 platinumRate
    );

    event InsuranceFundDeposited(address indexed depositor, uint256 amount);

    event InsuranceFundWithdrawn(address indexed withdrawer, uint256 amount);

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_COVERAGE_DURATION = 365 days;
    uint256 public constant MIN_COVERAGE_DURATION = 1 days;
    uint256 public constant CLAIM_PROCESSING_PERIOD = 7 days;
    uint256 public constant MAX_CLAIM_PERCENTAGE = 10_000; // 100%

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    MarketFactory public immutable marketFactory;
    RiskAssessment public immutable riskAssessment;
    PremiumCalculator public immutable premiumCalculator;

    address public admin;
    uint256 public insuranceFundBalance;

    /// @dev policyId => InsurancePolicy
    mapping(uint256 => InsurancePolicy) private _policies;
    uint256 private _nextPolicyId;

    /// @dev policyHolder => market => CoverageInfo
    mapping(address => mapping(address => CoverageInfo)) private _coverageInfo;

    /// @dev claimId => InsuranceClaim
    mapping(uint256 => InsuranceClaim) private _claims;
    uint256 private _nextClaimId;

    /// @dev policyHolder => policyId array
    mapping(address => uint256[]) private _userPolicies;

    /// @dev market => policyId array
    mapping(address => uint256[]) private _marketPolicies;

    /// @dev CoverageTier => PremiumStructure
    mapping(CoverageTier => PremiumStructure) private _premiumRates;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address _marketFactory,
        address _riskAssessment,
        address _premiumCalculator,
        address _admin
    ) {
        require(_marketFactory != address(0), "Invalid market factory");
        require(_riskAssessment != address(0), "Invalid risk assessment");
        require(_premiumCalculator != address(0), "Invalid premium calculator");
        require(_admin != address(0), "Invalid admin");

        marketFactory = MarketFactory(_marketFactory);
        riskAssessment = RiskAssessment(_riskAssessment);
        premiumCalculator = PremiumCalculator(_premiumCalculator);
        admin = _admin;

        // Initialize default premium rates (in basis points)
        _premiumRates[CoverageTier.BASIC] = PremiumStructure({
            basicRate: 100, // 1%
            standardRate: 150, // 1.5%
            premiumRate: 200, // 2%
            platinumRate: 250 // 2.5%
        });

        _premiumRates[CoverageTier.STANDARD] = PremiumStructure({
            basicRate: 80, // 0.8%
            standardRate: 120, // 1.2%
            premiumRate: 160, // 1.6%
            platinumRate: 200 // 2%
        });

        _premiumRates[CoverageTier.PREMIUM] = PremiumStructure({
            basicRate: 50, // 0.5%
            standardRate: 80, // 0.8%
            premiumRate: 120, // 1.2%
            platinumRate: 150 // 1.5%
        });

        _premiumRates[CoverageTier.PLATINUM] = PremiumStructure({
            basicRate: 30, // 0.3%
            standardRate: 50, // 0.5%
            premiumRate: 80, // 0.8%
            platinumRate: 100 // 1%
        });
    }

    // -------------------------------------------------------------------------
    // Policy Management Functions
    // -------------------------------------------------------------------------

    /// @notice Create a new insurance policy for a market
    /// @param market Address of the market to insure
    /// @param coverageAmount Amount of coverage to provide
    /// @param durationDays Duration of the policy in days
    /// @param tier Coverage tier (BASIC, STANDARD, PREMIUM, PLATINUM)
    /// @param autoRenewal Whether policy auto-renews on expiry
    /// @return policyId ID of the created policy
    function createPolicy(
        address market,
        uint256 coverageAmount,
        uint256 durationDays,
        CoverageTier tier,
        bool autoRenewal
    ) external returns (uint256 policyId) {
        require(market != address(0), "Invalid market");
        require(coverageAmount > 0, InvalidCoverage());
        require(
            durationDays >= MIN_COVERAGE_DURATION &&
                durationDays <= MAX_COVERAGE_DURATION,
            InvalidPolicyDuration()
        );

        // Calculate premium
        uint256 premium = calculatePremium(coverageAmount, durationDays, tier);
        require(premium > 0, InvalidPremiumRate());

        policyId = _nextPolicyId++;

        uint256 expiryTime = block.timestamp + (durationDays * 1 days);

        _policies[policyId] = InsurancePolicy({
            policyHolder: msg.sender,
            market: market,
            coverageAmount: coverageAmount,
            premiumRate: getTierPremiumRate(tier),
            startTime: block.timestamp,
            expiryTime: expiryTime,
            tier: tier,
            status: PolicyStatus.ACTIVE,
            autoRenewal: autoRenewal,
            totalClaimsProcessed: 0
        });

        _userPolicies[msg.sender].push(policyId);
        _marketPolicies[market].push(policyId);

        // Initialize coverage info
        _coverageInfo[msg.sender][market] = CoverageInfo({
            coveredAmount: coverageAmount,
            remainingCoverage: coverageAmount,
            utilizationPercentage: 0,
            isActive: true,
            lastUpdated: block.timestamp
        });

        emit PolicyCreated(
            policyId,
            msg.sender,
            market,
            coverageAmount,
            tier,
            expiryTime
        );

        emit PremiumCalculated(
            msg.sender,
            market,
            coverageAmount,
            tier,
            premium
        );
    }

    /// @notice Renew an existing policy
    /// @param policyId ID of the policy to renew
    /// @param newDurationDays New duration in days
    function renewPolicy(uint256 policyId, uint256 newDurationDays) external {
        InsurancePolicy storage policy = _policies[policyId];
        require(policy.policyHolder == msg.sender, Unauthorized());
        require(
            policy.status == PolicyStatus.ACTIVE ||
                policy.status == PolicyStatus.EXPIRED,
            PolicyNotActive()
        );
        require(
            newDurationDays >= MIN_COVERAGE_DURATION &&
                newDurationDays <= MAX_COVERAGE_DURATION,
            InvalidPolicyDuration()
        );

        uint256 newExpiryTime = block.timestamp + (newDurationDays * 1 days);
        policy.expiryTime = newExpiryTime;
        policy.status = PolicyStatus.ACTIVE;

        emit PolicyRenewed(policyId, msg.sender, newExpiryTime);
    }

    /// @notice Cancel a policy and refund unused premium
    /// @param policyId ID of the policy to cancel
    function cancelPolicy(uint256 policyId) external {
        InsurancePolicy storage policy = _policies[policyId];
        require(policy.policyHolder == msg.sender, Unauthorized());
        require(policy.status == PolicyStatus.ACTIVE, PolicyNotActive());

        // Calculate refund based on remaining time
        uint256 remainingTime = policy.expiryTime > block.timestamp
            ? policy.expiryTime - block.timestamp
            : 0;
        uint256 totalDuration = policy.expiryTime - policy.startTime;
        uint256 refundAmount = (policy.coverageAmount * remainingTime) /
            totalDuration;

        policy.status = PolicyStatus.CANCELLED;

        // Remove from active coverage
        _coverageInfo[msg.sender][policy.market].isActive = false;

        emit PolicyCancelled(policyId, msg.sender, refundAmount);
    }

    // -------------------------------------------------------------------------
    // Coverage Tracking Functions
    // -------------------------------------------------------------------------

    /// @notice Get coverage information for a policy holder and market
    /// @param policyHolder Address of the policy holder
    /// @param market Address of the market
    /// @return coverage Coverage information
    function getCoverageInfo(
        address policyHolder,
        address market
    ) external view returns (CoverageInfo memory coverage) {
        return _coverageInfo[policyHolder][market];
    }

    /// @notice Update coverage utilization
    /// @param policyHolder Address of the policy holder
    /// @param market Address of the market
    /// @param utilizationAmount Amount of coverage being utilized
    function updateCoverageUtilization(
        address policyHolder,
        address market,
        uint256 utilizationAmount
    ) external {
        CoverageInfo storage coverage = _coverageInfo[policyHolder][market];
        require(coverage.isActive, "Coverage not active");
        require(utilizationAmount <= coverage.coveredAmount, InvalidCoverage());

        coverage.remainingCoverage = coverage.coveredAmount - utilizationAmount;
        coverage.utilizationPercentage =
            (utilizationAmount * BPS_DENOMINATOR) /
            coverage.coveredAmount;
        coverage.lastUpdated = block.timestamp;

        emit CoverageUpdated(
            policyHolder,
            market,
            coverage.coveredAmount,
            coverage.remainingCoverage
        );
    }

    /// @notice Get active coverage for a policy holder on a market
    /// @param policyHolder Address of the policy holder
    /// @param market Address of the market
    /// @return activeCoverage Amount of active coverage
    function getActiveCoverage(
        address policyHolder,
        address market
    ) external view returns (uint256 activeCoverage) {
        CoverageInfo memory coverage = _coverageInfo[policyHolder][market];
        if (coverage.isActive) {
            return coverage.remainingCoverage;
        }
        return 0;
    }

    // -------------------------------------------------------------------------
    // Claims Management Functions
    // -------------------------------------------------------------------------

    /// @notice Submit an insurance claim
    /// @param policyId ID of the policy to claim under
    /// @param claimAmount Amount to claim
    /// @param claimReason Reason for the claim
    /// @return claimId ID of the submitted claim
    function submitClaim(
        uint256 policyId,
        uint256 claimAmount,
        string calldata claimReason
    ) external returns (uint256 claimId) {
        InsurancePolicy storage policy = _policies[policyId];
        require(policy.policyHolder == msg.sender, UnauthorizedClaim());
        require(policy.status == PolicyStatus.ACTIVE, PolicyNotActive());
        require(policy.expiryTime > block.timestamp, "Policy expired");
        require(claimAmount > 0, InvalidClaimAmount());
        require(claimAmount <= policy.coverageAmount, InvalidClaimAmount());

        claimId = _nextClaimId++;

        _claims[claimId] = InsuranceClaim({
            claimant: msg.sender,
            market: policy.market,
            policyId: policyId,
            claimAmount: claimAmount,
            claimTime: block.timestamp,
            processedTime: 0,
            claimReason: claimReason,
            status: ClaimStatus.PENDING,
            approvedAmount: 0
        });

        emit ClaimSubmitted(
            claimId,
            policyId,
            msg.sender,
            claimAmount,
            claimReason
        );
    }

    /// @notice Approve an insurance claim
    /// @param claimId ID of the claim to approve
    /// @param approvedAmount Amount to approve for payment
    function approveClaim(uint256 claimId, uint256 approvedAmount) external {
        require(msg.sender == admin, Unauthorized());

        InsuranceClaim storage claim = _claims[claimId];
        require(claim.status == ClaimStatus.PENDING, "Claim not pending");
        require(
            approvedAmount > 0 && approvedAmount <= claim.claimAmount,
            InvalidClaimAmount()
        );
        require(approvedAmount <= insuranceFundBalance, InsufficientFunds());

        claim.status = ClaimStatus.APPROVED;
        claim.approvedAmount = approvedAmount;
        claim.processedTime = block.timestamp;

        // Update insurance fund
        insuranceFundBalance -= approvedAmount;

        emit ClaimApproved(claimId, approvedAmount, claim.claimant);
    }

    /// @notice Reject an insurance claim
    /// @param claimId ID of the claim to reject
    /// @param reason Reason for rejection
    function rejectClaim(uint256 claimId, string calldata reason) external {
        require(msg.sender == admin, Unauthorized());

        InsuranceClaim storage claim = _claims[claimId];
        require(claim.status == ClaimStatus.PENDING, "Claim not pending");

        claim.status = ClaimStatus.REJECTED;
        claim.processedTime = block.timestamp;

        emit ClaimRejected(claimId, reason);
    }

    /// @notice Pay out an approved claim
    /// @param claimId ID of the claim to pay
    function payClaim(uint256 claimId) external {
        InsuranceClaim storage claim = _claims[claimId];
        require(claim.status == ClaimStatus.APPROVED, "Claim not approved");
        require(
            block.timestamp <= claim.processedTime + CLAIM_PROCESSING_PERIOD,
            ClaimExpired()
        );

        claim.status = ClaimStatus.PAID;

        InsurancePolicy storage policy = _policies[claim.policyId];
        policy.totalClaimsProcessed += claim.approvedAmount;
        policy.status = PolicyStatus.CLAIMED;

        emit ClaimPaid(claimId, claim.claimant, claim.approvedAmount);
    }

    /// @notice Get claim details
    /// @param claimId ID of the claim
    /// @return claim Claim information
    function getClaim(
        uint256 claimId
    ) external view returns (InsuranceClaim memory claim) {
        require(claimId < _nextClaimId, ClaimNotFound());
        return _claims[claimId];
    }

    // -------------------------------------------------------------------------
    // Premium Calculation Functions
    // -------------------------------------------------------------------------

    /// @notice Calculate premium for a policy
    /// @param coverageAmount Amount of coverage
    /// @param durationDays Duration in days
    /// @param tier Coverage tier
    /// @return premium Calculated premium amount
    function calculatePremium(
        uint256 coverageAmount,
        uint256 durationDays,
        CoverageTier tier
    ) public view returns (uint256 premium) {
        require(coverageAmount > 0, ZeroCoverage());
        require(durationDays > 0, "Invalid duration");

        uint256 basePremiumRate = getTierPremiumRate(tier);
        uint256 dailyPremium = (coverageAmount * basePremiumRate) /
            BPS_DENOMINATOR;
        premium = dailyPremium * durationDays;

        return premium;
    }

    /// @notice Get the premium rate for a coverage tier
    /// @param tier Coverage tier
    /// @return rate Premium rate in basis points
    function getTierPremiumRate(
        CoverageTier tier
    ) public view returns (uint256 rate) {
        if (tier == CoverageTier.BASIC) return 100; // 1%
        if (tier == CoverageTier.STANDARD) return 80; // 0.8%
        if (tier == CoverageTier.PREMIUM) return 50; // 0.5%
        if (tier == CoverageTier.PLATINUM) return 30; // 0.3%
        revert InvalidPremiumRate();
    }

    /// @notice Update premium rates for coverage tiers
    /// @param basicRate New basic rate
    /// @param standardRate New standard rate
    /// @param premiumRate New premium rate
    /// @param platinumRate New platinum rate
    function updatePremiumRates(
        uint256 basicRate,
        uint256 standardRate,
        uint256 premiumRate,
        uint256 platinumRate
    ) external {
        require(msg.sender == admin, Unauthorized());
        require(
            basicRate > 0 &&
                standardRate > 0 &&
                premiumRate > 0 &&
                platinumRate > 0,
            InvalidPremiumRate()
        );

        emit PremiumRatesUpdated(
            basicRate,
            standardRate,
            premiumRate,
            platinumRate
        );
    }

    // -------------------------------------------------------------------------
    // Insurance Fund Management
    // -------------------------------------------------------------------------

    /// @notice Deposit funds into the insurance fund
    /// @param amount Amount to deposit
    function depositInsuranceFund(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        insuranceFundBalance += amount;

        emit InsuranceFundDeposited(msg.sender, amount);
    }

    /// @notice Withdraw funds from the insurance fund (admin only)
    /// @param amount Amount to withdraw
    function withdrawInsuranceFund(uint256 amount) external {
        require(msg.sender == admin, Unauthorized());
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= insuranceFundBalance, InsufficientFunds());

        insuranceFundBalance -= amount;

        emit InsuranceFundWithdrawn(msg.sender, amount);
    }

    /// @notice Get current insurance fund balance
    /// @return balance Current balance
    function getInsuranceFundBalance() external view returns (uint256 balance) {
        return insuranceFundBalance;
    }

    // -------------------------------------------------------------------------
    // Query Functions
    // -------------------------------------------------------------------------

    /// @notice Get policy details
    /// @param policyId ID of the policy
    /// @return policy Policy information
    function getPolicy(
        uint256 policyId
    ) external view returns (InsurancePolicy memory policy) {
        require(policyId < _nextPolicyId, InvalidPolicy());
        return _policies[policyId];
    }

    /// @notice Get all policies for a user
    /// @param policyHolder Address of the policy holder
    /// @return policies Array of policy IDs
    function getUserPolicies(
        address policyHolder
    ) external view returns (uint256[] memory policies) {
        return _userPolicies[policyHolder];
    }

    /// @notice Get all policies for a market
    /// @param market Address of the market
    /// @return policies Array of policy IDs
    function getMarketPolicies(
        address market
    ) external view returns (uint256[] memory policies) {
        return _marketPolicies[market];
    }

    /// @notice Check if a policy is active
    /// @param policyId ID of the policy
    /// @return isActive True if policy is active and not expired
    function isPolicyActive(
        uint256 policyId
    ) external view returns (bool isActive) {
        InsurancePolicy storage policy = _policies[policyId];
        return
            policy.status == PolicyStatus.ACTIVE &&
            policy.expiryTime > block.timestamp;
    }

    /// @notice Get total coverage for a policy holder across all markets
    /// @param policyHolder Address of the policy holder
    /// @return totalCoverage Total active coverage amount
    function getTotalCoverage(
        address policyHolder
    ) external view returns (uint256 totalCoverage) {
        uint256[] memory policies = _userPolicies[policyHolder];

        for (uint256 i = 0; i < policies.length; i++) {
            InsurancePolicy storage policy = _policies[policies[i]];
            if (
                policy.status == PolicyStatus.ACTIVE &&
                policy.expiryTime > block.timestamp
            ) {
                totalCoverage += policy.coverageAmount;
            }
        }

        return totalCoverage;
    }

    /// @notice Get total claims processed for a policy
    /// @param policyId ID of the policy
    /// @return totalProcessed Total amount of claims processed
    function getTotalClaimsProcessed(
        uint256 policyId
    ) external view returns (uint256 totalProcessed) {
        require(policyId < _nextPolicyId, InvalidPolicy());
        return _policies[policyId].totalClaimsProcessed;
    }

    // -------------------------------------------------------------------------
    // Admin Functions
    // -------------------------------------------------------------------------

    /// @notice Update admin address
    /// @param newAdmin Address of the new admin
    function updateAdmin(address newAdmin) external {
        require(msg.sender == admin, Unauthorized());
        require(newAdmin != address(0), "Invalid admin address");
        admin = newAdmin;
    }
}
