// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {mulDiv} from "@prb/math/src/Common.sol";

/**
 * @title CashbackContract
 * @notice Tier-based cashback (rebates) accounting.
 *
 * Workflow:
 *  - Admin configures cashback tiers (tierId => cashbackBps).
 *  - Admin configures an authorized fee source (e.g. fee engine) that records
 *    eligible fee volume for users.
 *  - For each recorded event, the contract accrues cashback for the user
 *    based on their assigned tier.
 *  - Users call claim() to withdraw accrued cashback.
 */
contract CashbackContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ------------------------- Errors -------------------------
    error ZeroAddress();
    error ZeroAmount();
    error InvalidBps();
    error TierNotActive(bytes32 tierId);
    error UnknownTier(bytes32 tierId);
    error NotAuthorized();
    error NothingToClaim();
    error InvalidRecipient();

    // ------------------------- Types --------------------------

    struct Tier {
        uint256 cashbackBps; // cashback = feeAmount * cashbackBps / 10_000
        bool active;
    }

    // per-user assigned tier
    mapping(address => bytes32) public userTier;

    // tierId => tier
    mapping(bytes32 => Tier) public cashbackTiers;

    bytes32[] public tierIds;

    IERC20 public immutable paymentToken;

    // authorized callers that may record cashback events
    mapping(address => bool) public authorized;

    // user => accrued cashback
    mapping(address => uint256) public accrued;

    // ------------------------- Events -------------------------
    event TierDefined(bytes32 indexed tierId, uint256 cashbackBps);
    event TierDeactivated(bytes32 indexed tierId);
    event UserTierAssigned(address indexed user, bytes32 indexed tierId);

    event Authorized(address indexed caller, bool enabled);

    event CashbackRecorded(
        address indexed user,
        bytes32 indexed tierId,
        uint256 feeAmount,
        uint256 cashbackAmount
    );

    event CashbackClaimed(address indexed user, uint256 amount);

    // ------------------------- Constructor --------------------

    constructor(address _paymentToken, address _initialOwner) Ownable(_initialOwner) {
        if (_paymentToken == address(0)) revert ZeroAddress();
        if (_initialOwner == address(0)) revert ZeroAddress();
        paymentToken = IERC20(_paymentToken);
    }

    // ------------------------- Admin -------------------------

    /// @notice Executes setAuthorized.
    /// @param caller Address associated with caller.
    /// @param enabled Whether the configuration is enabled.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `ZeroAddress` if `caller == address(0)` is true.
    function setAuthorized(address caller, bool enabled) external onlyOwner {
        if (caller == address(0)) revert ZeroAddress();
        authorized[caller] = enabled;
        emit Authorized(caller, enabled);
    }

    /// @notice Executes defineTier.
    /// @param tierId Identifier of the relevant tier.
    /// @param cashbackBps cashback bps expressed in basis points.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `UnknownTier` if `tierId == bytes32(0)` is true. `InvalidBps` if `cashbackBps >
    ///     BPS_DENOMINATOR` is true.
    function defineTier(bytes32 tierId, uint256 cashbackBps) external onlyOwner {
        if (tierId == bytes32(0)) revert UnknownTier(tierId);
        if (cashbackBps > BPS_DENOMINATOR) revert InvalidBps();

        // Activate/replace
        bool isNew = !cashbackTiers[tierId].active && cashbackTiers[tierId].cashbackBps == 0;
        cashbackTiers[tierId] = Tier({cashbackBps: cashbackBps, active: true});
        if (isNew) tierIds.push(tierId);

        emit TierDefined(tierId, cashbackBps);
    }

    /// @notice Executes deactivateTier.
    /// @param tierId Identifier of the relevant tier.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `TierNotActive` if `!t.active` is true.
    function deactivateTier(bytes32 tierId) external onlyOwner {
        Tier storage t = cashbackTiers[tierId];
        if (!t.active) revert TierNotActive(tierId);
        t.active = false;
        emit TierDeactivated(tierId);
    }

    /// @notice Executes assignUserTier.
    /// @param user User address affected by this operation.
    /// @param tierId Identifier of the relevant tier.
    /// @dev Access: Caller must be the contract owner.
    /// @dev Reverts: `InvalidRecipient` if `user == address(0)` is true. `TierNotActive` if
    ///     `!cashbackTiers[tierId].active` is true.
    function assignUserTier(address user, bytes32 tierId) external onlyOwner {
        if (user == address(0)) revert InvalidRecipient();
        if (!cashbackTiers[tierId].active) revert TierNotActive(tierId);
        userTier[user] = tierId;
        emit UserTierAssigned(user, tierId);
    }

    // ------------------------- Accounting --------------------

    /**
     * @notice Record a fee volume for a user and accrue cashback.
     * @dev Intended to be called by the fee engine/collector after fees are known.
     * @param user       User receiving the cashback.
     * @param feeAmount  The eligible fee amount used as the base for cashback.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: `NotAuthorized` if `!authorized[msg.sender]` is true. `InvalidRecipient` if
     *     `user == address(0)` is true. `ZeroAmount` if `feeAmount == 0` is true. `UnknownTier` if
     *     `!t.active` is true.
     */
    function recordCashback(address user, uint256 feeAmount) external nonReentrant {
        if (!authorized[msg.sender]) revert NotAuthorized();
        if (user == address(0)) revert InvalidRecipient();
        if (feeAmount == 0) revert ZeroAmount();

        bytes32 tierId = userTier[user];
        Tier memory t = cashbackTiers[tierId];
        if (!t.active) revert UnknownTier(tierId);

        uint256 cashbackAmount = mulDiv(feeAmount, t.cashbackBps, BPS_DENOMINATOR);
        if (cashbackAmount == 0) {
            // still emit event for transparency
            emit CashbackRecorded(user, tierId, feeAmount, 0);
            return;
        }

        accrued[user] += cashbackAmount;
        emit CashbackRecorded(user, tierId, feeAmount, cashbackAmount);
    }

    /// @notice Returns accrued.
    /// @param user User address affected by this operation.
    /// @return Accrued returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getAccrued(address user) external view returns (uint256) {
        return accrued[user];
    }

    // ------------------------- Claiming -----------------------

    /// @notice Claims.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NothingToClaim` if `amount == 0` is true.
    function claim() external nonReentrant {
        uint256 amount = accrued[msg.sender];
        if (amount == 0) revert NothingToClaim();
        accrued[msg.sender] = 0;
        paymentToken.safeTransfer(msg.sender, amount);
        emit CashbackClaimed(msg.sender, amount);
    }

    // ------------------------- Views --------------------------

    /// @notice Returns tier.
    /// @param tierId Identifier of the relevant tier.
    /// @return Tier returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getTier(bytes32 tierId) external view returns (Tier memory) {
        return cashbackTiers[tierId];
    }

    /// @notice Returns tier ids.
    /// @return Tier ids returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getTierIds() external view returns (bytes32[] memory) {
        return tierIds;
    }

    // ------------------------- Treasury helpers -------------

    /**
     * @notice Owner may fund the contract with cashback tokens.
     * @param amount Amount to process, in the relevant token units.
     * @dev Access: Caller must be the contract owner.
     * @dev Reverts: `ZeroAmount` if `amount == 0` is true.
     */
    function fund(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
    }
}

