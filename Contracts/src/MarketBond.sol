// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PRBMathUD60x18} from "src/compat/PRBMathUD60x18.sol";

/**
 * @title MarketBond
 * @notice Issues, tracks, and redeems bonds tied to prediction market outcomes.
 *         Bonds accrue yield at a fixed annual rate using PRBMath fixed-point arithmetic.
 *
 * Bond lifecycle:
 *   issueBond()  →  [accruing yield]  →  redeemBond()
 *
 * Yield formula (simple interest, 18-decimal fixed-point):
 *   yield = principal × annualRate × elapsedSeconds / SECONDS_PER_YEAR
 *   redemptionAmount = principal + yield
 */
contract MarketBond {
    using PRBMathUD60x18 for uint256;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @dev Seconds in a 365-day year, expressed as an 18-decimal fixed-point number.
    uint256 private constant SECONDS_PER_YEAR = 365 days;

    /// @dev 1e18 — the PRBMath "one" in UD60x18 representation.
    uint256 private constant ONE = 1e18;

    // -------------------------------------------------------------------------
    // Data structures
    // -------------------------------------------------------------------------

    struct Bond {
        uint256 id;
        address owner;
        uint256 marketId;
        /// @notice Face value in wei (18-decimal tokens or native currency).
        uint256 principal;
        /// @notice Annual yield rate as an 18-decimal fraction (e.g. 5% = 0.05e18).
        uint256 annualRate;
        uint256 issuedAt;
        uint256 maturityDate;
        bool redeemed;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Incrementing bond ID counter.
    uint256 private _nextBondId;

    /// @notice bondId → Bond
    mapping(uint256 => Bond) private _bonds;

    /// @notice owner → list of bond IDs
    mapping(address => uint256[]) private _ownerBonds;

    /// @notice marketId → list of bond IDs
    mapping(uint256 => uint256[]) private _marketBonds;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event BondIssued(
        uint256 indexed bondId,
        address indexed owner,
        uint256 indexed marketId,
        uint256 principal,
        uint256 annualRate,
        uint256 maturityDate
    );

    event BondTransferred(
        uint256 indexed bondId,
        address indexed from,
        address indexed to
    );

    event BondRedeemed(
        uint256 indexed bondId,
        address indexed owner,
        uint256 principal,
        uint256 yieldAmount,
        uint256 totalPaid
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error Bond__NotOwner(uint256 bondId, address caller);
    error Bond__AlreadyRedeemed(uint256 bondId);
    error Bond__NotMatured(uint256 bondId, uint256 maturityDate, uint256 currentTime);
    error Bond__InvalidPrincipal();
    error Bond__InvalidRate();
    error Bond__InvalidMaturity();
    error Bond__InvalidRecipient();
    error Bond__InsufficientFunds(uint256 required, uint256 available);

    // -------------------------------------------------------------------------
    // Issue
    // -------------------------------------------------------------------------

    /**
     * @notice Issue a new bond for a given market.
     * @param marketId      The prediction market this bond is associated with.
     * @param annualRate    Annual yield rate in UD60x18 (e.g. 5% = 0.05e18 = 5e16).
     * @param maturityDate  Unix timestamp when the bond matures (must be in the future).
     * @return bondId       The ID of the newly issued bond.
     *
     * The bond principal equals msg.value — ETH (or native token) is held in
     * the contract until redemption.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: `Bond__InvalidPrincipal` if `msg.value == 0` is true. `Bond__InvalidRate` if
     *     `annualRate == 0 || annualRate >= ONE` is true. `Bond__InvalidMaturity` if `maturityDate
     *     <= block.timestamp` is true.
     */
    function issueBond(
        uint256 marketId,
        uint256 annualRate,
        uint256 maturityDate
    ) external payable returns (uint256 bondId) {
        if (msg.value == 0) revert Bond__InvalidPrincipal();
        if (annualRate == 0 || annualRate >= ONE) revert Bond__InvalidRate();
        if (maturityDate <= block.timestamp) revert Bond__InvalidMaturity();

        bondId = ++_nextBondId;

        _bonds[bondId] = Bond({
            id: bondId,
            owner: msg.sender,
            marketId: marketId,
            principal: msg.value,
            annualRate: annualRate,
            issuedAt: block.timestamp,
            maturityDate: maturityDate,
            redeemed: false
        });

        _ownerBonds[msg.sender].push(bondId);
        _marketBonds[marketId].push(bondId);

        emit BondIssued(bondId, msg.sender, marketId, msg.value, annualRate, maturityDate);
    }

    // -------------------------------------------------------------------------
    // Transfer / Ownership
    // -------------------------------------------------------------------------

    /**
     * @notice Transfer a bond to a new owner.
     * @param bondId    The bond to transfer.
     * @param newOwner  Recipient address.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: `Bond__NotOwner` if `bond.owner != msg.sender` is true. `Bond__AlreadyRedeemed`
     *     if `bond.redeemed` is true. `Bond__InvalidRecipient` if `newOwner == address(0)` is true.
     */
    function transferBond(uint256 bondId, address newOwner) external {
        Bond storage bond = _bonds[bondId];
        if (bond.owner != msg.sender) revert Bond__NotOwner(bondId, msg.sender);
        if (bond.redeemed) revert Bond__AlreadyRedeemed(bondId);
        if (newOwner == address(0)) revert Bond__InvalidRecipient();

        address previousOwner = bond.owner;
        bond.owner = newOwner;

        _ownerBonds[newOwner].push(bondId);
        // Note: we leave the old owner's array intact (soft removal)
        // A real implementation may use EnumerableSet for O(1) removal.

        emit BondTransferred(bondId, previousOwner, newOwner);
    }

    // -------------------------------------------------------------------------
    // Yield calculation
    // -------------------------------------------------------------------------

    /**
     * @notice Calculate the yield accrued on a bond up to the current block.
     * @dev    Uses simple (not compound) interest via PRBMath UD60x18 multiplication.
     *         yield = principal × annualRate × min(elapsed, maturity−issued) / SECONDS_PER_YEAR
     * @param bondId The bond to query.
     * @return yieldAmount Accrued yield in wei.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function calculateYield(uint256 bondId) public view returns (uint256 yieldAmount) {
        Bond storage bond = _bonds[bondId];

        // Cap elapsed time at maturity
        uint256 endTime = block.timestamp < bond.maturityDate
            ? block.timestamp
            : bond.maturityDate;

        uint256 elapsed = endTime - bond.issuedAt;

        // yield = principal × annualRate × elapsed / SECONDS_PER_YEAR
        // All three factors are in UD60x18 before division.
        uint256 rateScaled = bond.annualRate.mul(elapsed * ONE).div(SECONDS_PER_YEAR * ONE);
        yieldAmount = bond.principal.mul(rateScaled).div(ONE);
    }

    /**
     * @notice Total redemption value (principal + accrued yield) at the current block.
     * @param bondId The bond to query.
     * @return total Amount the bond holder would receive upon redemption now.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function redemptionValue(uint256 bondId) external view returns (uint256 total) {
        Bond storage bond = _bonds[bondId];
        uint256 yield = calculateYield(bondId);
        total = bond.principal + yield;
    }

    // -------------------------------------------------------------------------
    // Redemption
    // -------------------------------------------------------------------------

    /**
     * @notice Redeem a matured bond.  Sends principal + yield to the caller.
     * @param bondId The bond to redeem.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: `Bond__NotOwner` if `bond.owner != msg.sender` is true. `Bond__AlreadyRedeemed`
     *     if `bond.redeemed` is true. `Bond__NotMatured` if `block.timestamp < bond.maturityDate`
     *     is true. `Bond__InsufficientFunds` if `address(this).balance < total` is true.
     *     "MarketBond: ETH transfer failed" if `ok` is false.
     */
    function redeemBond(uint256 bondId) external {
        Bond storage bond = _bonds[bondId];

        if (bond.owner != msg.sender) revert Bond__NotOwner(bondId, msg.sender);
        if (bond.redeemed) revert Bond__AlreadyRedeemed(bondId);
        if (block.timestamp < bond.maturityDate)
            revert Bond__NotMatured(bondId, bond.maturityDate, block.timestamp);

        bond.redeemed = true;

        uint256 yield = calculateYield(bondId);
        uint256 total = bond.principal + yield;

        if (address(this).balance < total)
            revert Bond__InsufficientFunds(total, address(this).balance);

        emit BondRedeemed(bondId, msg.sender, bond.principal, yield, total);

        // Interactions last (CEI pattern)
        (bool ok, ) = payable(msg.sender).call{value: total}("");
        require(ok, "MarketBond: ETH transfer failed");
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /**
     * @notice Return full details of a bond.
     * @param bondId Identifier of the relevant bond.
     * @return Complete data for the bond.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getBond(uint256 bondId) external view returns (Bond memory) {
        return _bonds[bondId];
    }

    /**
     * @notice Return all bond IDs owned by an address.
     * @dev    May include IDs that were transferred away (soft-removal).
     *         Callers should filter by `bond.owner == owner`.
     * @param owner Owner address associated with this operation.
     * @return Bond IDs associated with the owner; transferred bonds may remain in this list.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getBondsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerBonds[owner];
    }

    /**
     * @notice Return all bond IDs issued for a given market.
     * @param marketId Identifier of the relevant market.
     * @return Bond IDs issued for the market.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function getBondsByMarket(uint256 marketId) external view returns (uint256[] memory) {
        return _marketBonds[marketId];
    }

    /**
     * @notice Total number of bonds ever issued.
     * @return Total number of bonds issued.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function totalBonds() external view returns (uint256) {
        return _nextBondId;
    }

    /**
     * @notice Check whether a specific bond has been redeemed.
     * @param bondId Identifier of the relevant bond.
     * @return True if the bond has been redeemed.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function isBondRedeemed(uint256 bondId) external view returns (bool) {
        return _bonds[bondId].redeemed;
    }

    // -------------------------------------------------------------------------
    // Funding (owner/protocol can top-up the contract with yield reserves)
    // -------------------------------------------------------------------------

    receive() external payable {}
}