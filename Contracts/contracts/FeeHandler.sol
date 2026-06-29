// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {mulDiv} from "@prb/math/src/Common.sol";

/**
 * @title  FeeHandler
 * @notice Central contract for calculating, collecting, and distributing trading fees.
 *
 * Fee structures are keyed by an arbitrary bytes32 id (e.g. keccak256("TRADING")).
 * Each structure defines:
 *   - a fee rate in basis points (max 10 %)
 *   - an ordered list of recipients whose shareBps values sum to 10 000
 *
 * Two collection paths are supported:
 *   1. collectAndDistribute — pulls the fee from the caller (requires allowance) then
 *      immediately distributes to all recipients.
 *   2. distribute — distributes tokens already present in this contract; useful when a
 *      sibling contract has pre-transferred the fee amount here.
 *
 * All fees are tracked per-structure and per-token for off-chain and on-chain querying.
 */
contract FeeHandler is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000; // 10 % ceiling

    // ── Types ──────────────────────────────────────────────────────────────────

    struct FeeRecipient {
        address account;
        uint256 shareBps; // fraction of fee; all recipients must sum to BPS_DENOMINATOR
    }

    struct FeeStructure {
        uint256 feeBps;
        bool active;
        FeeRecipient[] recipients;
    }

    // ── State ──────────────────────────────────────────────────────────────────

    mapping(bytes32 => FeeStructure) private _structures;

    // structureId => token => cumulative fee amount collected
    mapping(bytes32 => mapping(address => uint256)) private _collected;

    // token => cumulative fee amount collected across all structures
    mapping(address => uint256) private _totalCollected;

    // ── Events ─────────────────────────────────────────────────────────────────

    event FeeStructureSet(bytes32 indexed id, uint256 feeBps, uint256 recipientCount);
    event FeeStructureDeactivated(bytes32 indexed id);
    event FeesDistributed(bytes32 indexed id, address indexed token, uint256 feeAmount);

    // ── Errors ─────────────────────────────────────────────────────────────────

    error StructureNotActive(bytes32 id);
    error FeeTooHigh();
    error InvalidRecipients();
    error ZeroAmount();
    error ZeroAddress();

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Admin ──────────────────────────────────────────────────────────────────

    /**
     * @notice Create or replace a fee structure.
     * @param id         Arbitrary identifier (e.g. keccak256("TRADING")).
     * @param feeBps     Fee rate in basis points. Must be ≤ MAX_FEE_BPS.
     * @param recipients List of recipients; shareBps must sum to BPS_DENOMINATOR.
     */
    function setFeeStructure(bytes32 id, uint256 feeBps, FeeRecipient[] calldata recipients) external onlyOwner {
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (recipients.length == 0) revert InvalidRecipients();

        uint256 shareSum;
        for (uint256 i; i < recipients.length; ++i) {
            if (recipients[i].account == address(0)) revert ZeroAddress();
            shareSum += recipients[i].shareBps;
        }
        if (shareSum != BPS_DENOMINATOR) revert InvalidRecipients();

        FeeStructure storage fs = _structures[id];
        fs.feeBps = feeBps;
        fs.active = true;

        // Reset existing recipients then rebuild.
        delete fs.recipients;
        for (uint256 i; i < recipients.length; ++i) {
            fs.recipients.push(recipients[i]);
        }

        emit FeeStructureSet(id, feeBps, recipients.length);
    }

    /// @notice Disable a fee structure; any collection attempt will revert.
    function deactivateFeeStructure(bytes32 id) external onlyOwner {
        _structures[id].active = false;
        emit FeeStructureDeactivated(id);
    }

    // ── Fee calculation ────────────────────────────────────────────────────────

    /**
     * @notice Calculate the fee for a given gross amount under structure `id`.
     * @param grossAmount Pre-fee amount in token units.
     * @param id          Fee structure to apply.
     * @return feeAmount  Fee in the same token units as grossAmount.
     */
    function calculateFee(uint256 grossAmount, bytes32 id) public view returns (uint256 feeAmount) {
        if (!_structures[id].active) revert StructureNotActive(id);
        // mulDiv avoids phantom overflow: floor(grossAmount * feeBps / BPS_DENOMINATOR)
        feeAmount = mulDiv(grossAmount, _structures[id].feeBps, BPS_DENOMINATOR);
    }

    // ── Collection ─────────────────────────────────────────────────────────────

    /**
     * @notice Pull the fee from the caller and immediately distribute it to all
     *         recipients. The caller must have approved this contract for at least
     *         the fee amount (computed internally from grossAmount and feeBps).
     *
     * @param token       ERC-20 token in which fees are denominated.
     * @param grossAmount The gross (pre-fee) amount used to derive the fee.
     * @param id          Fee structure to apply.
     * @return feeAmount  Tokens collected and distributed.
     */
    function collectAndDistribute(address token, uint256 grossAmount, bytes32 id)
        external
        nonReentrant
        returns (uint256 feeAmount)
    {
        if (token == address(0)) revert ZeroAddress();
        if (grossAmount == 0) revert ZeroAmount();

        feeAmount = calculateFee(grossAmount, id);
        if (feeAmount == 0) return 0;

        IERC20(token).safeTransferFrom(msg.sender, address(this), feeAmount);
        _distribute(token, feeAmount, id);
    }

    /**
     * @notice Distribute tokens already held by this contract to fee recipients.
     *         Useful when the calling contract has pre-transferred the exact fee
     *         amount to this address.
     *
     * @param token      ERC-20 token to distribute.
     * @param feeAmount  Exact amount to distribute.
     * @param id         Fee structure that defines the recipient split.
     */
    function distribute(address token, uint256 feeAmount, bytes32 id) external nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (feeAmount == 0) revert ZeroAmount();
        if (!_structures[id].active) revert StructureNotActive(id);
        _distribute(token, feeAmount, id);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /// @notice Return the full configuration of a fee structure.
    function getFeeStructure(bytes32 id)
        external
        view
        returns (uint256 feeBps, bool active, FeeRecipient[] memory recipients)
    {
        FeeStructure storage fs = _structures[id];
        return (fs.feeBps, fs.active, fs.recipients);
    }

    /// @notice Cumulative fees collected under a specific structure for a given token.
    function getCollectedFees(bytes32 id, address token) external view returns (uint256) {
        return _collected[id][token];
    }

    /// @notice Cumulative fees collected across all structures for a given token.
    function getTotalCollectedFees(address token) external view returns (uint256) {
        return _totalCollected[token];
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _distribute(address token, uint256 feeAmount, bytes32 id) internal {
        FeeRecipient[] storage recipients = _structures[id].recipients;
        uint256 n = recipients.length;
        uint256 distributed;

        for (uint256 i; i < n; ++i) {
            uint256 share;
            if (i == n - 1) {
                // Last recipient absorbs any dust from integer division.
                share = feeAmount - distributed;
            } else {
                share = mulDiv(feeAmount, recipients[i].shareBps, BPS_DENOMINATOR);
                distributed += share;
            }
            if (share > 0) IERC20(token).safeTransfer(recipients[i].account, share);
        }

        _collected[id][token] += feeAmount;
        _totalCollected[token] += feeAmount;

        emit FeesDistributed(id, token, feeAmount);
    }
}
