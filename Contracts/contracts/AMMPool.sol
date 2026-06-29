// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UD60x18, ud} from "@prb/math/src/UD60x18.sol";
import {sqrt as uSqrt} from "@prb/math/src/Common.sol";

/**
 * @title  AMMPool
 * @notice Constant-product (x·y=k) AMM pool for a single token pair.
 *
 * Liquidity providers receive LP tokens proportional to their share of the pool.
 * Swap fees are split between LPs (captured automatically in the growing k) and
 * a configurable protocol recipient.
 *
 * Price queries are returned as PRBMath UD60x18 (18-decimal fixed-point) values.
 * sqrt for initial LP minting uses PRBMath's uSqrt for gas-efficient computation.
 */
contract AMMPool is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 300; // 3 % ceiling
    uint256 public constant MINIMUM_LIQUIDITY = 1_000; // permanently locked on first mint

    // ── Immutables ─────────────────────────────────────────────────────────────

    address public immutable token0; // lexicographically smaller address
    address public immutable token1;

    // ── State ──────────────────────────────────────────────────────────────────

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 public feeRateBps; // total swap fee in bps  (e.g. 30 = 0.30 %)
    uint256 public protocolSharePct; // protocol's cut of feeRateBps  (0–100 %)
    address public feeRecipient;

    uint256 public protocolFees0; // uncollected protocol fees denominated in token0
    uint256 public protocolFees1; // uncollected protocol fees denominated in token1

    // ── Events ─────────────────────────────────────────────────────────────────

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    event FeeRateSet(uint256 feeRateBps);
    event ProtocolShareSet(uint256 protocolSharePct);
    event FeeRecipientSet(address indexed recipient);
    event ProtocolFeesCollected(uint256 amount0, uint256 amount1);

    // ── Errors ─────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error IdenticalTokens();
    error FeeTooHigh();
    error InvalidProtocolShare();
    error InsufficientLiquidity();
    error InsufficientLiquidityMinted();
    error InsufficientLiquidityBurned();
    error InsufficientInputAmount();
    error InsufficientOutputAmount();
    error InvalidToken();
    error SlippageExceeded();
    error Overflow();

    // ── Constructor ────────────────────────────────────────────────────────────

    /**
     * @param tokenA          One of the two pool tokens (order does not matter).
     * @param tokenB          The other pool token.
     * @param feeRateBps_     Total swap fee in basis points (max 300 = 3 %).
     * @param protocolSharePct_ Percentage of feeRateBps sent to feeRecipient (0–100).
     * @param feeRecipient_   Address that receives the protocol portion of fees.
     */
    constructor(address tokenA, address tokenB, uint256 feeRateBps_, uint256 protocolSharePct_, address feeRecipient_)
        ERC20("GateDelay AMM LP", "GD-LP")
        Ownable(msg.sender)
    {
        if (tokenA == address(0) || tokenB == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        if (tokenA == tokenB) revert IdenticalTokens();
        if (feeRateBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (protocolSharePct_ > 100) revert InvalidProtocolShare();

        // Enforce canonical ordering so external tooling can identify the pair.
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        feeRateBps = feeRateBps_;
        protocolSharePct = protocolSharePct_;
        feeRecipient = feeRecipient_;
    }

    // ── Pool Queries ───────────────────────────────────────────────────────────

    /// @notice Returns the current reserves and the timestamp of the last update.
    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    /**
     * @notice Spot price of token0 denominated in token1, as a UD60x18 value.
     *         E.g. if 1 token0 = 2 token1, returns ud(2e18).
     *         Uses PRBMath for 18-decimal fixed-point precision.
     */
    function getPrice0() external view returns (UD60x18) {
        (uint112 r0, uint112 r1,) = getReserves();
        if (r0 == 0) revert InsufficientLiquidity();
        return ud(uint256(r1) * 1e18).div(ud(uint256(r0) * 1e18));
    }

    /**
     * @notice Spot price of token1 denominated in token0, as a UD60x18 value.
     */
    function getPrice1() external view returns (UD60x18) {
        (uint112 r0, uint112 r1,) = getReserves();
        if (r1 == 0) revert InsufficientLiquidity();
        return ud(uint256(r0) * 1e18).div(ud(uint256(r1) * 1e18));
    }

    /**
     * @notice Returns the maximum output for a given input, accounting for the
     *         pool fee. Implements the standard CPMM formula:
     *         amountOut = reserveOut * amountIn * (1 - fee) / (reserveIn + amountIn * (1 - fee))
     */
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut)
        public
        view
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - feeRateBps);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    }

    /**
     * @notice Returns the minimum input needed to receive a given output.
     *         amountIn = reserveIn * amountOut / ((reserveOut - amountOut) * (1 - fee)) + 1
     */
    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        public
        view
        returns (uint256 amountIn)
    {
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();
        if (amountOut >= reserveOut) revert InsufficientLiquidity();

        amountIn =
            (reserveIn * amountOut * FEE_DENOMINATOR) / ((reserveOut - amountOut) * (FEE_DENOMINATOR - feeRateBps)) + 1; // round up to protect the pool
    }

    // ── Liquidity Provision ────────────────────────────────────────────────────

    /**
     * @notice Deposit token0 and token1 to receive LP tokens.
     *         On the first deposit the ratio is set freely; subsequent deposits
     *         must match the current ratio within the specified minima.
     *
     * @param amount0Desired Max token0 willing to deposit.
     * @param amount1Desired Max token1 willing to deposit.
     * @param amount0Min     Minimum token0 to deposit (slippage guard).
     * @param amount1Min     Minimum token1 to deposit (slippage guard).
     * @param to             Recipient of the LP tokens.
     * @return amount0    Actual token0 deposited.
     * @return amount1    Actual token1 deposited.
     * @return liquidity  LP tokens minted.
     */
    function addLiquidity(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address to
    ) external nonReentrant returns (uint256 amount0, uint256 amount1, uint256 liquidity) {
        if (to == address(0)) revert ZeroAddress();

        (uint112 r0, uint112 r1,) = getReserves();

        if (r0 == 0 && r1 == 0) {
            // First deposit: accept caller's ratio as-is.
            (amount0, amount1) = (amount0Desired, amount1Desired);
        } else {
            // Subsequent deposits: maintain current ratio, use the smaller side.
            uint256 amount1Optimal = amount0Desired * uint256(r1) / uint256(r0);
            if (amount1Optimal <= amount1Desired) {
                if (amount1Optimal < amount1Min) revert SlippageExceeded();
                (amount0, amount1) = (amount0Desired, amount1Optimal);
            } else {
                uint256 amount0Optimal = amount1Desired * uint256(r0) / uint256(r1);
                if (amount0Optimal < amount0Min) revert SlippageExceeded();
                (amount0, amount1) = (amount0Optimal, amount1Desired);
            }
        }

        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        liquidity = _mintLP(to, amount0, amount1, r0, r1);
        _syncReserves();

        emit LiquidityAdded(msg.sender, amount0, amount1, liquidity);
    }

    /**
     * @notice Burn LP tokens to withdraw a proportional share of both reserves.
     *
     * @param liquidity   LP tokens to burn.
     * @param amount0Min  Minimum token0 to receive (slippage guard).
     * @param amount1Min  Minimum token1 to receive (slippage guard).
     * @param to          Recipient of withdrawn tokens.
     * @return amount0  token0 returned.
     * @return amount1  token1 returned.
     */
    function removeLiquidity(uint256 liquidity, uint256 amount0Min, uint256 amount1Min, address to)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        if (to == address(0)) revert ZeroAddress();

        uint256 supply = totalSupply();
        // LP share of balances (protocol fees stay in the contract but are not
        // part of the LP-owned portion tracked by reserves).
        uint256 balance0 = IERC20(token0).balanceOf(address(this)) - protocolFees0;
        uint256 balance1 = IERC20(token1).balanceOf(address(this)) - protocolFees1;

        amount0 = liquidity * balance0 / supply;
        amount1 = liquidity * balance1 / supply;

        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();
        if (amount0 < amount0Min || amount1 < amount1Min) revert SlippageExceeded();

        _burn(msg.sender, liquidity);
        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);
        _syncReserves();

        emit LiquidityRemoved(msg.sender, amount0, amount1, liquidity);
    }

    // ── Swaps ──────────────────────────────────────────────────────────────────

    /**
     * @notice Swap an exact input amount for as many output tokens as possible.
     *
     * @param tokenIn    Address of the token being sold.
     * @param amountIn   Exact amount of tokenIn to sell.
     * @param minOut     Minimum output tokens to receive (slippage guard).
     * @param to         Recipient of the output tokens.
     * @return amountOut Tokens received.
     */
    function swapExactInput(address tokenIn, uint256 amountIn, uint256 minOut, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (tokenIn != token0 && tokenIn != token1) revert InvalidToken();
        if (amountIn == 0) revert InsufficientInputAmount();
        if (to == address(0)) revert ZeroAddress();

        bool zeroForOne = tokenIn == token0;
        (uint112 r0, uint112 r1,) = getReserves();
        (uint256 rIn, uint256 rOut) = zeroForOne ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));

        amountOut = getAmountOut(amountIn, rIn, rOut);
        if (amountOut < minOut) revert SlippageExceeded();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        _collectProtocolFee(tokenIn, amountIn);

        address tokenOut = zeroForOne ? token1 : token0;
        IERC20(tokenOut).safeTransfer(to, amountOut);
        _syncReserves();

        (uint256 in0, uint256 in1) = zeroForOne ? (amountIn, uint256(0)) : (uint256(0), amountIn);
        (uint256 out0, uint256 out1) = zeroForOne ? (uint256(0), amountOut) : (amountOut, uint256(0));
        emit Swap(msg.sender, in0, in1, out0, out1, to);
    }

    /**
     * @notice Swap as few input tokens as necessary to receive an exact output.
     *
     * @param tokenOut   Address of the token being bought.
     * @param amountOut  Exact amount of tokenOut to receive.
     * @param maxIn      Maximum input tokens willing to spend (slippage guard).
     * @param to         Recipient of the output tokens.
     * @return amountIn  Tokens spent.
     */
    function swapExactOutput(address tokenOut, uint256 amountOut, uint256 maxIn, address to)
        external
        nonReentrant
        returns (uint256 amountIn)
    {
        if (tokenOut != token0 && tokenOut != token1) revert InvalidToken();
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (to == address(0)) revert ZeroAddress();

        bool zeroForOne = tokenOut == token1; // selling token0 to buy token1
        (uint112 r0, uint112 r1,) = getReserves();
        (uint256 rIn, uint256 rOut) = zeroForOne ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));

        amountIn = getAmountIn(amountOut, rIn, rOut);
        if (amountIn > maxIn) revert SlippageExceeded();

        address tokenIn = zeroForOne ? token0 : token1;
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        _collectProtocolFee(tokenIn, amountIn);

        IERC20(tokenOut).safeTransfer(to, amountOut);
        _syncReserves();

        (uint256 in0, uint256 in1) = zeroForOne ? (amountIn, uint256(0)) : (uint256(0), amountIn);
        (uint256 out0, uint256 out1) = zeroForOne ? (uint256(0), amountOut) : (amountOut, uint256(0));
        emit Swap(msg.sender, in0, in1, out0, out1, to);
    }

    // ── Fee Collection ─────────────────────────────────────────────────────────

    /// @notice Transfer all accumulated protocol fees to feeRecipient.
    function collectProtocolFees() external returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = (protocolFees0, protocolFees1);
        protocolFees0 = 0;
        protocolFees1 = 0;
        if (amount0 > 0) IERC20(token0).safeTransfer(feeRecipient, amount0);
        if (amount1 > 0) IERC20(token1).safeTransfer(feeRecipient, amount1);
        _syncReserves();
        emit ProtocolFeesCollected(amount0, amount1);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setFeeRate(uint256 feeBps) external onlyOwner {
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeRateBps = feeBps;
        emit FeeRateSet(feeBps);
    }

    function setProtocolShare(uint256 sharePct) external onlyOwner {
        if (sharePct > 100) revert InvalidProtocolShare();
        protocolSharePct = sharePct;
        emit ProtocolShareSet(sharePct);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    /// Mints LP tokens to `to`. Uses PRBMath uSqrt for the initial geometric mean.
    function _mintLP(address to, uint256 amount0, uint256 amount1, uint112 r0, uint112 r1)
        internal
        returns (uint256 liquidity)
    {
        uint256 supply = totalSupply();

        if (supply == 0) {
            // Geometric mean of initial deposits minus the permanently locked minimum.
            // uSqrt computes floor(sqrt(x)) for a uint256 without overflow.
            liquidity = uSqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            // Lock MINIMUM_LIQUIDITY to address(dead) so the pool can never be drained.
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
        } else {
            // Proportional share of the smaller side.
            uint256 l0 = amount0 * supply / uint256(r0);
            uint256 l1 = amount1 * supply / uint256(r1);
            liquidity = l0 < l1 ? l0 : l1;
        }

        if (liquidity == 0) revert InsufficientLiquidityMinted();
        _mint(to, liquidity);
    }

    /// Accrues the protocol portion of a swap fee into the relevant fee bucket.
    function _collectProtocolFee(address tokenIn, uint256 amountIn) internal {
        if (protocolSharePct == 0) return;
        uint256 protocolFee = amountIn * feeRateBps * protocolSharePct / (FEE_DENOMINATOR * 100);
        if (tokenIn == token0) {
            protocolFees0 += protocolFee;
        } else {
            protocolFees1 += protocolFee;
        }
    }

    /// Snapshots current balances (minus uncollected protocol fees) as reserves.
    function _syncReserves() internal {
        uint256 b0 = IERC20(token0).balanceOf(address(this)) - protocolFees0;
        uint256 b1 = IERC20(token1).balanceOf(address(this)) - protocolFees1;
        if (b0 > type(uint112).max || b1 > type(uint112).max) revert Overflow();
        // forge-lint: disable-next-line(unsafe-typecast)
        reserve0 = uint112(b0);
        // forge-lint: disable-next-line(unsafe-typecast)
        reserve1 = uint112(b1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }
}
