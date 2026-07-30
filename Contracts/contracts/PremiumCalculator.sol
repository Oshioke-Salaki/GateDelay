// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MarketFactory.sol";
import "./RiskAssessment.sol";

/// @title PremiumCalculator
/// @notice Calculates insurance premium rates, tracks payments, and supports discounts.
contract PremiumCalculator {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error InvalidMarket();
    error InvalidCoverage();
    error PremiumAlreadyPaid();
    error PremiumNotDue();
    error Unauthorized();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Risk tier determines the base premium multiplier
    enum RiskTier { LOW, MEDIUM, HIGH, CRITICAL }

    struct PremiumRate {
        uint256 baseBps;        // Base rate in basis points
        uint256 riskMultiplier; // Multiplier scaled by BPS_DENOMINATOR
        uint256 durationDays;   // Coverage duration in days
        RiskTier tier;
    }

    struct PremiumPayment {
        address payer;
        address market;
        uint256 coverageAmount;
        uint256 premiumPaid;
        uint256 discountBps;
        uint256 paidAt;
        uint256 expiresAt;
        bool active;
    }

    struct DiscountProgram {
        string name;
        uint256 discountBps;  // Discount in basis points
        uint256 minVolume;    // Minimum trading volume to qualify
        bool active;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event PremiumCalculated(
        address indexed user,
        address indexed market,
        uint256 coverageAmount,
        uint256 premium,
        uint256 discountBps
    );
    event PremiumPaid(
        address indexed payer,
        address indexed market,
        uint256 coverageAmount,
        uint256 premiumPaid,
        uint256 expiresAt
    );
    event DiscountProgramAdded(uint256 indexed programId, string name, uint256 discountBps);
    event DiscountProgramUpdated(uint256 indexed programId, bool active);
    event RateUpdated(RiskTier indexed tier, uint256 baseBps, uint256 riskMultiplier);

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_DISCOUNT_BPS = 5_000; // 50% max discount
    uint256 public constant MAX_RATE_BPS = 2_000;     // 20% max base rate

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    MarketFactory public immutable marketFactory;
    RiskAssessment public immutable riskAssessment;
    address public admin;

    /// @dev tier => PremiumRate
    mapping(RiskTier => PremiumRate) private _rates;

    /// @dev user => market => PremiumPayment[]
    mapping(address => mapping(address => PremiumPayment[])) private _payments;

    /// @dev programId => DiscountProgram
    mapping(uint256 => DiscountProgram) private _discounts;
    uint256 private _nextDiscountId;

    /// @dev user => total volume (for discount qualification)
    mapping(address => uint256) private _userVolume;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(
        address _marketFactory,
        address _riskAssessment,
        address _admin
    ) {
        marketFactory = MarketFactory(_marketFactory);
        riskAssessment = RiskAssessment(_riskAssessment);
        admin = _admin;

        // Default rates per tier
        _rates[RiskTier.LOW]      = PremiumRate({ baseBps: 50,  riskMultiplier: 10_000, durationDays: 30, tier: RiskTier.LOW });
        _rates[RiskTier.MEDIUM]   = PremiumRate({ baseBps: 150, riskMultiplier: 12_500, durationDays: 30, tier: RiskTier.MEDIUM });
        _rates[RiskTier.HIGH]     = PremiumRate({ baseBps: 400, riskMultiplier: 15_000, durationDays: 30, tier: RiskTier.HIGH });
        _rates[RiskTier.CRITICAL] = PremiumRate({ baseBps: 800, riskMultiplier: 20_000, durationDays: 30, tier: RiskTier.CRITICAL });
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // -------------------------------------------------------------------------
    // Premium calculation
    // -------------------------------------------------------------------------

    /// @notice Calculate the premium for a given coverage amount and market.
    /// @param user           Address of the insured party.
    /// @param market         Market address to insure.
    /// @param coverageAmount Amount of collateral to cover (WAD).
    /// @return premium       Premium amount due.
    /// @return discountBps   Applied discount in basis points.
    function calculatePremium(
        address user,
        address market,
        uint256 coverageAmount
    ) external returns (uint256 premium, uint256 discountBps) {
        if (coverageAmount == 0) revert InvalidCoverage();

        RiskTier tier = _resolveRiskTier(user, market);
        PremiumRate memory rate = _rates[tier];

        // Base premium = coverageAmount * baseBps / BPS_DENOMINATOR
        uint256 basePremium = (coverageAmount * rate.baseBps) / BPS_DENOMINATOR;

        // Apply risk multiplier
        uint256 adjustedPremium = (basePremium * rate.riskMultiplier) / BPS_DENOMINATOR;

        // Apply best available discount
        discountBps = _bestDiscount(user);
        uint256 discountAmount = (adjustedPremium * discountBps) / BPS_DENOMINATOR;
        premium = adjustedPremium - discountAmount;

        emit PremiumCalculated(user, market, coverageAmount, premium, discountBps);
    }

    /// @notice Record a premium payment for a user.
    /// @param market         Market being insured.
    /// @param coverageAmount Coverage amount.
    /// @param premiumPaid    Actual premium paid.
    /// @param discountBps    Discount applied.
    function recordPayment(
        address market,
        uint256 coverageAmount,
        uint256 premiumPaid,
        uint256 discountBps
    ) external {
        if (coverageAmount == 0) revert InvalidCoverage();

        PremiumRate memory rate = _rates[_resolveRiskTier(msg.sender, market)];
        uint256 expiresAt = block.timestamp + (rate.durationDays * 1 days);

        _payments[msg.sender][market].push(PremiumPayment({
            payer: msg.sender,
            market: market,
            coverageAmount: coverageAmount,
            premiumPaid: premiumPaid,
            discountBps: discountBps,
            paidAt: block.timestamp,
            expiresAt: expiresAt,
            active: true
        }));

        // Track volume for discount qualification
        _userVolume[msg.sender] += coverageAmount;

        emit PremiumPaid(msg.sender, market, coverageAmount, premiumPaid, expiresAt);
    }

    // -------------------------------------------------------------------------
    // Discount management
    // -------------------------------------------------------------------------

    /// @notice Add a new discount program.
    function addDiscountProgram(
        string calldata name,
        uint256 discountBps,
        uint256 minVolume
    ) external onlyAdmin returns (uint256 programId) {
        require(discountBps <= MAX_DISCOUNT_BPS, "Discount too high");
        programId = _nextDiscountId++;
        _discounts[programId] = DiscountProgram({
            name: name,
            discountBps: discountBps,
            minVolume: minVolume,
            active: true
        });
        emit DiscountProgramAdded(programId, name, discountBps);
    }

    /// @notice Enable or disable a discount program.
    function setDiscountActive(uint256 programId, bool active) external onlyAdmin {
        _discounts[programId].active = active;
        emit DiscountProgramUpdated(programId, active);
    }

    // -------------------------------------------------------------------------
    // Rate management
    // -------------------------------------------------------------------------

    /// @notice Update premium rate for a risk tier.
    function updateRate(
        RiskTier tier,
        uint256 baseBps,
        uint256 riskMultiplier,
        uint256 durationDays
    ) external onlyAdmin {
        require(baseBps <= MAX_RATE_BPS, "Rate too high");
        _rates[tier] = PremiumRate({
            baseBps: baseBps,
            riskMultiplier: riskMultiplier,
            durationDays: durationDays,
            tier: tier
        });
        emit RateUpdated(tier, baseBps, riskMultiplier);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice Get the current premium rate for a tier.
    function getRate(RiskTier tier) external view returns (PremiumRate memory) {
        return _rates[tier];
    }

    /// @notice Get all premium payments for a user on a market.
    function getPayments(
        address user,
        address market
    ) external view returns (PremiumPayment[] memory) {
        return _payments[user][market];
    }

    /// @notice Check if a user has active coverage on a market.
    function hasActiveCoverage(address user, address market) external view returns (bool) {
        PremiumPayment[] memory payments = _payments[user][market];
        for (uint256 i = payments.length; i > 0; i--) {
            PremiumPayment memory p = payments[i - 1];
            if (p.active && p.expiresAt > block.timestamp) {
                return true;
            }
        }
        return false;
    }

    /// @notice Get the best discount available for a user.
    function getBestDiscount(address user) external view returns (uint256 discountBps) {
        return _bestDiscount(user);
    }

    /// @notice Get user's accumulated volume.
    function getUserVolume(address user) external view returns (uint256) {
        return _userVolume[user];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    function _resolveRiskTier(address user, address market) internal returns (RiskTier) {
        RiskAssessment.RiskMetrics memory metrics = riskAssessment.assessRisk(user, market);
        RiskAssessment.RiskLevel level = metrics.riskLevel;

        if (level == RiskAssessment.RiskLevel.LOW)      return RiskTier.LOW;
        if (level == RiskAssessment.RiskLevel.MEDIUM)   return RiskTier.MEDIUM;
        if (level == RiskAssessment.RiskLevel.HIGH)     return RiskTier.HIGH;
        return RiskTier.CRITICAL;
    }

    function _bestDiscount(address user) internal view returns (uint256 best) {
        uint256 volume = _userVolume[user];
        for (uint256 i = 0; i < _nextDiscountId; i++) {
            DiscountProgram memory p = _discounts[i];
            if (p.active && volume >= p.minVolume && p.discountBps > best) {
                best = p.discountBps;
            }
        }
    }
}
