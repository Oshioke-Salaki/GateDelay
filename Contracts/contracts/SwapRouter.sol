// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ─── Uniswap V3 Interfaces ─────────────────────────────────────────────────────

interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes   path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);

    function exactInput(ExactInputParams calldata params)
        external payable returns (uint256 amountOut);
}

interface IQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint24  fee;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external
        returns (
            uint256 amountOut,
            uint160 sqrtPriceX96After,
            uint32  initializedTicksCrossed,
            uint256 gasEstimate
        );

    function quoteExactInput(bytes memory path, uint256 amountIn)
        external
        returns (
            uint256 amountOut,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[]  memory initializedTicksCrossedList,
            uint256   gasEstimate
        );
}

// ─── 1inch V5 Interface ────────────────────────────────────────────────────────

interface IOneInchRouterV5 {
    struct SwapDescription {
        IERC20          srcToken;
        IERC20          dstToken;
        address payable srcReceiver;
        address payable dstReceiver;
        uint256         amount;
        uint256         minReturnAmount;
        uint256         flags;
    }

    // executor and data are obtained from the 1inch Aggregation API.
    function swap(
        address              executor,
        SwapDescription calldata desc,
        bytes           calldata permit,
        bytes           calldata data
    ) external payable returns (uint256 returnAmount, uint256 spentAmount);
}

// ─── SwapRouter ────────────────────────────────────────────────────────────────

/**
 * @title  SwapRouter
 * @notice Routes token swaps through Uniswap V3 (single-hop and multi-hop) and
 *         the 1inch Aggregation Protocol. Deducts a configurable protocol fee
 *         from the input amount before executing each swap.
 *
 * Quote functions are intended to be called via staticcall (eth_call) off-chain;
 * they work on-chain too but consume gas without producing a state change.
 *
 * 1inch executor + calldata must be sourced from the 1inch API off-chain and
 * supplied by the caller. The contract validates outputs via minAmountOut.
 */
contract SwapRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Constants ──────────────────────────────────────────────────────────────

    uint256 public constant BPS_BASE    = 10_000;
    uint256 public constant MAX_FEE_BPS = 100;   // 1 % ceiling

    // ── Immutables ─────────────────────────────────────────────────────────────

    IUniswapV3Router public immutable uniswapRouter;
    IQuoterV2        public immutable uniswapQuoter;
    IOneInchRouterV5 public immutable oneInchRouter;

    // ── State ──────────────────────────────────────────────────────────────────

    uint256 public protocolFeeBps;
    address public feeRecipient;

    // ── Types ──────────────────────────────────────────────────────────────────

    enum Protocol { UNISWAP_V3, ONE_INCH }

    // ── Events ─────────────────────────────────────────────────────────────────

    event SwapExecuted(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount,
        Protocol protocol
    );
    event FeeCollected(address indexed token, uint256 amount);
    event ProtocolFeeSet(uint256 feeBps);
    event FeeRecipientSet(address indexed recipient);

    // ── Errors ─────────────────────────────────────────────────────────────────

    error FeeTooHigh(uint256 given, uint256 max);
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientOutput(uint256 actual, uint256 minimum);
    error InvalidPath();

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(
        address uniswapRouter_,
        address uniswapQuoter_,
        address oneInchRouter_,
        address feeRecipient_,
        uint256 protocolFeeBps_
    ) Ownable(msg.sender) {
        if (
            uniswapRouter_ == address(0) ||
            uniswapQuoter_ == address(0) ||
            oneInchRouter_ == address(0) ||
            feeRecipient_  == address(0)
        ) revert ZeroAddress();
        if (protocolFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh(protocolFeeBps_, MAX_FEE_BPS);

        uniswapRouter  = IUniswapV3Router(uniswapRouter_);
        uniswapQuoter  = IQuoterV2(uniswapQuoter_);
        oneInchRouter  = IOneInchRouterV5(oneInchRouter_);
        feeRecipient   = feeRecipient_;
        protocolFeeBps = protocolFeeBps_;
    }

    // ── Quote helpers (staticcall / eth_call only — not for use in txs) ────────

    /**
     * @notice Returns the expected output for a single-hop Uniswap V3 swap.
     *         Always call via staticcall; never embed in a state-changing tx.
     */
    function getUniswapSingleQuote(
        address tokenIn,
        address tokenOut,
        uint24  poolFee,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        (amountOut,,,) = uniswapQuoter.quoteExactInputSingle(
            IQuoterV2.QuoteExactInputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          tokenOut,
                amountIn:          amountIn,
                fee:               poolFee,
                sqrtPriceLimitX96: 0
            })
        );
    }

    /**
     * @notice Returns the expected output for a multi-hop Uniswap V3 swap.
     *         Path encoding: abi.encodePacked(tokenA, fee, tokenB, fee, tokenC, ...)
     *         Always call via staticcall; never embed in a state-changing tx.
     */
    function getUniswapMultiHopQuote(bytes calldata path, uint256 amountIn)
        external
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (path.length < 43) revert InvalidPath(); // 20 + 3 + 20 bytes minimum
        (amountOut,,,) = uniswapQuoter.quoteExactInput(path, amountIn);
    }

    // ── Swap: Uniswap V3 single-hop ────────────────────────────────────────────

    /**
     * @notice Swap tokenIn → tokenOut through a single Uniswap V3 pool.
     * @param tokenIn      Input token address.
     * @param tokenOut     Output token address.
     * @param poolFee      Uniswap V3 fee tier (500 / 3000 / 10000).
     * @param amountIn     Gross input amount (protocol fee deducted before swap).
     * @param minAmountOut Minimum acceptable output (slippage guard).
     * @param recipient    Address that receives tokenOut.
     */
    function swapSingle(
        address tokenIn,
        address tokenOut,
        uint24  poolFee,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0)          revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        (uint256 netIn, uint256 fee) = _pullAndDeductFee(tokenIn, amountIn);

        IERC20(tokenIn).forceApprove(address(uniswapRouter), netIn);
        amountOut = uniswapRouter.exactInputSingle(
            IUniswapV3Router.ExactInputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          tokenOut,
                fee:               poolFee,
                recipient:         recipient,
                amountIn:          netIn,
                amountOutMinimum:  minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(uniswapRouter), 0);

        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee, Protocol.UNISWAP_V3);
    }

    // ── Swap: Uniswap V3 multi-hop ─────────────────────────────────────────────

    /**
     * @notice Swap through two or more Uniswap V3 pools in sequence.
     * @param path         ABI-packed swap path: token + fee + token [+ fee + token ...].
     * @param tokenIn      First token in the path (used to pull funds from caller).
     * @param amountIn     Gross input amount (protocol fee deducted before swap).
     * @param minAmountOut Minimum acceptable output (slippage guard).
     * @param recipient    Address that receives the final output token.
     */
    function swapMultiHop(
        bytes   calldata path,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0)          revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();
        if (path.length < 43)       revert InvalidPath();

        (uint256 netIn, uint256 fee) = _pullAndDeductFee(tokenIn, amountIn);

        IERC20(tokenIn).forceApprove(address(uniswapRouter), netIn);
        amountOut = uniswapRouter.exactInput(
            IUniswapV3Router.ExactInputParams({
                path:             path,
                recipient:        recipient,
                amountIn:         netIn,
                amountOutMinimum: minAmountOut
            })
        );
        IERC20(tokenIn).forceApprove(address(uniswapRouter), 0);

        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        address tokenOut = _pathTokenOut(path);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee, Protocol.UNISWAP_V3);
    }

    // ── Swap: 1inch Aggregation Protocol ───────────────────────────────────────

    /**
     * @notice Swap via the 1inch AggregationRouterV5.
     *         executor, permit, and data must be fetched from the 1inch API off-chain.
     * @param tokenIn      Input token address.
     * @param tokenOut     Output token address.
     * @param amountIn     Gross input amount (protocol fee deducted before swap).
     * @param minAmountOut Minimum acceptable output (slippage guard).
     * @param recipient    Address that receives tokenOut.
     * @param executor     1inch executor contract (from API response).
     * @param permit       EIP-2612 permit data, or empty bytes.
     * @param data         Executor calldata (from API response).
     */
    function swapOneInch(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        address executor,
        bytes calldata permit,
        bytes calldata data
    ) external nonReentrant returns (uint256 amountOut) {
        if (amountIn == 0)                              revert ZeroAmount();
        if (recipient == address(0) || executor == address(0)) revert ZeroAddress();

        (uint256 netIn, uint256 fee) = _pullAndDeductFee(tokenIn, amountIn);

        IERC20(tokenIn).forceApprove(address(oneInchRouter), netIn);
        (amountOut,) = oneInchRouter.swap(
            executor,
            IOneInchRouterV5.SwapDescription({
                srcToken:        IERC20(tokenIn),
                dstToken:        IERC20(tokenOut),
                srcReceiver:     payable(executor),
                dstReceiver:     payable(recipient),
                amount:          netIn,
                minReturnAmount: minAmountOut,
                flags:           0
            }),
            permit,
            data
        );
        IERC20(tokenIn).forceApprove(address(oneInchRouter), 0);

        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee, Protocol.ONE_INCH);
    }

    // ── Swap: best-rate router ─────────────────────────────────────────────────

    /**
     * @notice Routes a single-hop swap to whichever protocol offers the larger
     *         expected output. Both quotes are supplied by the caller (from
     *         off-chain staticcalls / 1inch API); the contract picks the winner
     *         and executes. minAmountOut still applies as a hard slippage guard.
     *
     * @param tokenIn            Input token.
     * @param tokenOut           Output token.
     * @param poolFee            Uniswap V3 pool fee tier.
     * @param amountIn           Gross input (protocol fee deducted before swap).
     * @param minAmountOut       Minimum acceptable output.
     * @param recipient          Output recipient.
     * @param uniswapExpectedOut Off-chain Uniswap V3 quote for this swap.
     * @param oneInchExpectedOut Off-chain 1inch quote for this swap.
     * @param oneInchExecutor    1inch executor address (from API).
     * @param oneInchPermit      EIP-2612 permit bytes, or empty.
     * @param oneInchData        1inch executor calldata (from API).
     */
    function swapBestRate(
        address tokenIn,
        address tokenOut,
        uint24  poolFee,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient,
        uint256 uniswapExpectedOut,
        uint256 oneInchExpectedOut,
        address oneInchExecutor,
        bytes calldata oneInchPermit,
        bytes calldata oneInchData
    ) external nonReentrant returns (uint256 amountOut, Protocol usedProtocol) {
        if (amountIn == 0)          revert ZeroAmount();
        if (recipient == address(0)) revert ZeroAddress();

        (uint256 netIn, uint256 fee) = _pullAndDeductFee(tokenIn, amountIn);

        if (uniswapExpectedOut >= oneInchExpectedOut) {
            // ── Uniswap V3 ──────────────────────────────────────────────────
            IERC20(tokenIn).forceApprove(address(uniswapRouter), netIn);
            amountOut = uniswapRouter.exactInputSingle(
                IUniswapV3Router.ExactInputSingleParams({
                    tokenIn:           tokenIn,
                    tokenOut:          tokenOut,
                    fee:               poolFee,
                    recipient:         recipient,
                    amountIn:          netIn,
                    amountOutMinimum:  minAmountOut,
                    sqrtPriceLimitX96: 0
                })
            );
            IERC20(tokenIn).forceApprove(address(uniswapRouter), 0);
            usedProtocol = Protocol.UNISWAP_V3;
        } else {
            // ── 1inch ───────────────────────────────────────────────────────
            if (oneInchExecutor == address(0)) revert ZeroAddress();
            IERC20(tokenIn).forceApprove(address(oneInchRouter), netIn);
            (amountOut,) = oneInchRouter.swap(
                oneInchExecutor,
                IOneInchRouterV5.SwapDescription({
                    srcToken:        IERC20(tokenIn),
                    dstToken:        IERC20(tokenOut),
                    srcReceiver:     payable(oneInchExecutor),
                    dstReceiver:     payable(recipient),
                    amount:          netIn,
                    minReturnAmount: minAmountOut,
                    flags:           0
                }),
                oneInchPermit,
                oneInchData
            );
            IERC20(tokenIn).forceApprove(address(oneInchRouter), 0);
            usedProtocol = Protocol.ONE_INCH;
        }

        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee, usedProtocol);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setProtocolFee(uint256 feeBps) external onlyOwner {
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh(feeBps, MAX_FEE_BPS);
        protocolFeeBps = feeBps;
        emit ProtocolFeeSet(feeBps);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        emit FeeRecipientSet(recipient);
    }

    /// @notice Recover tokens accidentally sent directly to this contract.
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    /// Pulls `amount` of `token` from msg.sender, sends the protocol fee to
    /// feeRecipient, and returns the net amount available for the swap.
    function _pullAndDeductFee(address token, uint256 amount)
        internal
        returns (uint256 netAmount, uint256 feeAmount)
    {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        feeAmount = (amount * protocolFeeBps) / BPS_BASE;
        if (feeAmount > 0) {
            IERC20(token).safeTransfer(feeRecipient, feeAmount);
            emit FeeCollected(token, feeAmount);
        }
        netAmount = amount - feeAmount;
    }

    /// Decodes the output token from the last 20 bytes of a packed Uniswap V3 path.
    function _pathTokenOut(bytes calldata path) internal pure returns (address tokenOut) {
        // path layout: address(20) | fee(3) | address(20) [ | fee(3) | address(20) ]...
        // The final token is the last 20 bytes of the path.
        assembly {
            tokenOut := shr(96, calldataload(sub(add(path.offset, path.length), 20)))
        }
    }
}
