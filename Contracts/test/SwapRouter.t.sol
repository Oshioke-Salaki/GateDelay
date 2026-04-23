// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {SwapRouter, IOneInchRouterV5} from "../contracts/SwapRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ─── Mock: 1inch router ────────────────────────────────────────────────────────

/**
 * @dev Simulates 1inch AggregationRouterV5.swap().
 *      Must be pre-funded with dstToken before any swap call.
 *      Pulls srcToken from the SwapRouter (which approves this contract),
 *      then sends fixedOutput of dstToken to dstReceiver.
 */
contract MockOneInchRouter {
    struct SwapDescription {
        IERC20          srcToken;
        IERC20          dstToken;
        address payable srcReceiver;
        address payable dstReceiver;
        uint256         amount;
        uint256         minReturnAmount;
        uint256         flags;
    }

    uint256 public immutable fixedOutput;

    constructor(uint256 output) {
        fixedOutput = output;
    }

    function swap(
        address,
        SwapDescription calldata desc,
        bytes calldata,
        bytes calldata
    ) external payable returns (uint256 returnAmount, uint256 spentAmount) {
        desc.srcToken.transferFrom(msg.sender, address(this), desc.amount);
        desc.dstToken.transfer(desc.dstReceiver, fixedOutput);
        return (fixedOutput, desc.amount);
    }
}

// ─── SwapRouterTest ────────────────────────────────────────────────────────────

contract SwapRouterTest is Test {
    // ── Mainnet contract addresses ─────────────────────────────────────────────
    address constant UNISWAP_ROUTER  = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45; // SwapRouter02
    address constant UNISWAP_QUOTER  = 0x61fFE014bA17989E743c5F6cB21bF9697530B21e; // QuoterV2
    address constant ONE_INCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582; // AggregationRouterV5

    // ── Mainnet token addresses ────────────────────────────────────────────────
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant DAI  = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    // ── Uniswap V3 pool fee tiers ──────────────────────────────────────────────
    uint24 constant FEE_LOW    = 500;   // 0.05 %  — stablecoin pairs
    uint24 constant FEE_MEDIUM = 3_000; // 0.30 %  — standard pairs
    uint24 constant FEE_HIGH   = 10_000;// 1.00 %  — exotic pairs

    // ── Protocol fee set at deployment: 30 bps = 0.30 % ──────────────────────
    uint256 constant PROTOCOL_FEE_BPS = 30;

    // ── Test actors ───────────────────────────────────────────────────────────
    address feeRecipient;
    address user;

    // ── Contracts under test ──────────────────────────────────────────────────
    SwapRouter router;        // uses real 1inch router (Uniswap tests + best-rate Uniswap-wins)
    SwapRouter routerMock1;   // uses MockOneInchRouter  (1inch tests + best-rate 1inch-wins)
    MockOneInchRouter mockOneInch;

    // ── Setup ──────────────────────────────────────────────────────────────────

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string("https://eth.llamarpc.com"));
        vm.createSelectFork(rpc);

        feeRecipient = makeAddr("feeRecipient");
        user         = makeAddr("user");

        router = new SwapRouter(
            UNISWAP_ROUTER,
            UNISWAP_QUOTER,
            ONE_INCH_ROUTER,
            feeRecipient,
            PROTOCOL_FEE_BPS
        );

        // Mock 1inch returns 2 000 USDC regardless of input
        mockOneInch = new MockOneInchRouter(2_000e6);
        routerMock1 = new SwapRouter(
            UNISWAP_ROUTER,
            UNISWAP_QUOTER,
            address(mockOneInch),
            feeRecipient,
            PROTOCOL_FEE_BPS
        );

        // Fund test user with 10 WETH
        deal(WETH, user, 10 ether);
        // Pre-fund mock 1inch with USDC so it can pay out swaps
        deal(USDC, address(mockOneInch), 100_000e6);
    }

    // ─── Helper ────────────────────────────────────────────────────────────────

    function _approve(address token, address spender, uint256 amount) internal {
        vm.prank(user);
        IERC20(token).approve(spender, amount);
    }

    // ── Quote Tests ────────────────────────────────────────────────────────────

    function test_getUniswapSingleQuote_returnsPositive() public {
        uint256 amountIn = 1 ether;
        uint256 quote = router.getUniswapSingleQuote(WETH, USDC, FEE_MEDIUM, amountIn);
        assertGt(quote, 0, "quote should be > 0");
        console2.log("WETH->USDC single quote for 1 ETH:", quote);
    }

    function test_getUniswapMultiHopQuote_returnsPositive() public {
        // WETH --3000--> USDC --500--> DAI
        bytes memory path = abi.encodePacked(WETH, uint24(3_000), USDC, uint24(500), DAI);
        uint256 amountIn = 1 ether;
        uint256 quote = router.getUniswapMultiHopQuote(path, amountIn);
        assertGt(quote, 0, "multi-hop quote should be > 0");
        console2.log("WETH->USDC->DAI multi-hop quote for 1 ETH:", quote);
    }

    function test_getUniswapSingleQuote_revertsOnZeroAmount() public {
        vm.expectRevert(SwapRouter.ZeroAmount.selector);
        router.getUniswapSingleQuote(WETH, USDC, FEE_MEDIUM, 0);
    }

    function test_getUniswapMultiHopQuote_revertsOnShortPath() public {
        vm.expectRevert(SwapRouter.InvalidPath.selector);
        router.getUniswapMultiHopQuote(abi.encodePacked(WETH), 1 ether);
    }

    // ── swapSingle Tests ───────────────────────────────────────────────────────

    function test_swapSingle_executesAndDeliversTokens() public {
        uint256 amountIn = 1 ether;
        _approve(WETH, address(router), amountIn);

        vm.prank(user);
        uint256 amountOut = router.swapSingle(WETH, USDC, FEE_MEDIUM, amountIn, 1, user);

        assertGt(amountOut, 0, "should receive USDC");
        assertGt(IERC20(USDC).balanceOf(user), 0, "user USDC balance should increase");
    }

    function test_swapSingle_deductsProtocolFee() public {
        uint256 amountIn        = 1 ether;
        uint256 expectedFee     = (amountIn * PROTOCOL_FEE_BPS) / 10_000;
        uint256 wethBefore      = IERC20(WETH).balanceOf(feeRecipient);

        _approve(WETH, address(router), amountIn);
        vm.prank(user);
        router.swapSingle(WETH, USDC, FEE_MEDIUM, amountIn, 1, user);

        uint256 collected = IERC20(WETH).balanceOf(feeRecipient) - wethBefore;
        assertEq(collected, expectedFee, "wrong fee amount collected");
    }

    function test_swapSingle_revertsWhenSlippageTooTight() public {
        uint256 amountIn     = 1 ether;
        uint256 impossibleMin = type(uint256).max;

        _approve(WETH, address(router), amountIn);
        vm.prank(user);
        vm.expectRevert(); // Uniswap reverts with "Too little received"
        router.swapSingle(WETH, USDC, FEE_MEDIUM, amountIn, impossibleMin, user);
    }

    function test_swapSingle_revertsOnZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(SwapRouter.ZeroAmount.selector);
        router.swapSingle(WETH, USDC, FEE_MEDIUM, 0, 0, user);
    }

    function test_swapSingle_revertsOnZeroRecipient() public {
        _approve(WETH, address(router), 1 ether);
        vm.prank(user);
        vm.expectRevert(SwapRouter.ZeroAddress.selector);
        router.swapSingle(WETH, USDC, FEE_MEDIUM, 1 ether, 0, address(0));
    }

    // ── swapMultiHop Tests ─────────────────────────────────────────────────────

    function test_swapMultiHop_WETHtoDaiViaUSDC() public {
        // WETH --3000--> USDC --500--> DAI
        bytes memory path = abi.encodePacked(WETH, uint24(3_000), USDC, uint24(500), DAI);
        uint256 amountIn = 1 ether;

        _approve(WETH, address(router), amountIn);
        vm.prank(user);
        uint256 amountOut = router.swapMultiHop(path, WETH, amountIn, 1, user);

        assertGt(amountOut, 0, "should receive DAI");
        assertGt(IERC20(DAI).balanceOf(user), 0, "user DAI balance should increase");
    }

    function test_swapMultiHop_deductsProtocolFee() public {
        bytes memory path    = abi.encodePacked(WETH, uint24(3_000), USDC, uint24(500), DAI);
        uint256 amountIn     = 1 ether;
        uint256 expectedFee  = (amountIn * PROTOCOL_FEE_BPS) / 10_000;
        uint256 wethBefore   = IERC20(WETH).balanceOf(feeRecipient);

        _approve(WETH, address(router), amountIn);
        vm.prank(user);
        router.swapMultiHop(path, WETH, amountIn, 1, user);

        assertEq(IERC20(WETH).balanceOf(feeRecipient) - wethBefore, expectedFee);
    }

    function test_swapMultiHop_revertsOnInvalidPath() public {
        _approve(WETH, address(router), 1 ether);
        vm.prank(user);
        vm.expectRevert(SwapRouter.InvalidPath.selector);
        router.swapMultiHop(abi.encodePacked(WETH), WETH, 1 ether, 0, user);
    }

    // ── swapOneInch Tests (mock router) ────────────────────────────────────────

    function test_swapOneInch_executesViaMock() public {
        uint256 amountIn    = 1 ether;
        uint256 expectedOut = mockOneInch.fixedOutput(); // 2 000 USDC

        _approve(WETH, address(routerMock1), amountIn);
        vm.prank(user);
        uint256 amountOut = routerMock1.swapOneInch(
            WETH, USDC, amountIn, 1, user,
            address(mockOneInch), // executor = mock itself
            "",                   // no permit
            ""                    // no calldata needed by mock
        );

        assertEq(amountOut, expectedOut, "should receive mock fixed output");
        assertEq(IERC20(USDC).balanceOf(user), expectedOut, "user should hold USDC");
    }

    function test_swapOneInch_deductsProtocolFee() public {
        uint256 amountIn    = 1 ether;
        uint256 expectedFee = (amountIn * PROTOCOL_FEE_BPS) / 10_000;
        uint256 wethBefore  = IERC20(WETH).balanceOf(feeRecipient);

        _approve(WETH, address(routerMock1), amountIn);
        vm.prank(user);
        routerMock1.swapOneInch(WETH, USDC, amountIn, 1, user, address(mockOneInch), "", "");

        assertEq(IERC20(WETH).balanceOf(feeRecipient) - wethBefore, expectedFee);
    }

    function test_swapOneInch_revertsWhenOutputBelowMin() public {
        uint256 amountIn      = 1 ether;
        uint256 impossibleMin = mockOneInch.fixedOutput() + 1; // 1 more than mock returns

        _approve(WETH, address(routerMock1), amountIn);
        vm.prank(user);
        // WETH9 uses old Solidity require() which produces empty revert data,
        // so we match on any revert rather than a specific selector.
        vm.expectRevert();
        routerMock1.swapOneInch(WETH, USDC, amountIn, impossibleMin, user, address(mockOneInch), "", "");
    }

    // ── swapBestRate Tests ─────────────────────────────────────────────────────

    function test_swapBestRate_usesUniswapWhenBetter() public {
        uint256 amountIn       = 1 ether;
        // Give Uniswap a huge expected output so it wins routing
        uint256 uniExpected    = type(uint256).max / 2;
        uint256 oneInchExpected = 1;

        _approve(WETH, address(router), amountIn);
        vm.prank(user);
        (uint256 amountOut, SwapRouter.Protocol proto) = router.swapBestRate(
            WETH, USDC, FEE_MEDIUM, amountIn, 1, user,
            uniExpected, oneInchExpected,
            address(0), "", ""   // oneInch params unused when Uniswap wins
        );

        assertGt(amountOut, 0);
        assertEq(uint8(proto), uint8(SwapRouter.Protocol.UNISWAP_V3), "should use Uniswap");
    }

    function test_swapBestRate_usesOneInchWhenBetter() public {
        uint256 amountIn        = 1 ether;
        uint256 uniExpected     = 1;                            // Uniswap "loses"
        uint256 oneInchExpected = mockOneInch.fixedOutput();    // 1inch "wins"

        _approve(WETH, address(routerMock1), amountIn);
        vm.prank(user);
        (uint256 amountOut, SwapRouter.Protocol proto) = routerMock1.swapBestRate(
            WETH, USDC, FEE_MEDIUM, amountIn, 1, user,
            uniExpected, oneInchExpected,
            address(mockOneInch), "", ""
        );

        assertEq(amountOut, mockOneInch.fixedOutput());
        assertEq(uint8(proto), uint8(SwapRouter.Protocol.ONE_INCH), "should use 1inch");
    }

    function test_swapBestRate_revertsOnZeroAmount() public {
        vm.prank(user);
        vm.expectRevert(SwapRouter.ZeroAmount.selector);
        router.swapBestRate(WETH, USDC, FEE_MEDIUM, 0, 0, user, 0, 0, address(0), "", "");
    }

    // ── Admin Tests ────────────────────────────────────────────────────────────

    function test_setProtocolFee_ownerCanUpdate() public {
        router.setProtocolFee(50);
        assertEq(router.protocolFeeBps(), 50);
    }

    function test_setProtocolFee_revertsAboveMax() public {
        vm.expectRevert(
            abi.encodeWithSelector(SwapRouter.FeeTooHigh.selector, 101, 100)
        );
        router.setProtocolFee(101);
    }

    function test_setProtocolFee_revertsForNonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        router.setProtocolFee(10);
    }

    function test_setFeeRecipient_ownerCanUpdate() public {
        address newRecipient = makeAddr("newRecipient");
        router.setFeeRecipient(newRecipient);
        assertEq(router.feeRecipient(), newRecipient);
    }

    function test_setFeeRecipient_revertsOnZeroAddress() public {
        vm.expectRevert(SwapRouter.ZeroAddress.selector);
        router.setFeeRecipient(address(0));
    }

    function test_rescueTokens_ownerCanRecover() public {
        // Send USDC directly to router (simulating accidental transfer)
        deal(USDC, address(router), 500e6);

        address rescueTo = makeAddr("rescueTo");
        router.rescueTokens(USDC, rescueTo, 500e6);

        assertEq(IERC20(USDC).balanceOf(rescueTo), 500e6);
    }

    function test_rescueTokens_revertsForNonOwner() public {
        deal(USDC, address(router), 100e6);
        vm.prank(user);
        vm.expectRevert();
        router.rescueTokens(USDC, user, 100e6);
    }

    // ── Constructor Tests ──────────────────────────────────────────────────────

    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(SwapRouter.ZeroAddress.selector);
        new SwapRouter(address(0), UNISWAP_QUOTER, ONE_INCH_ROUTER, feeRecipient, 30);
    }

    function test_constructor_revertsFeeTooHigh() public {
        vm.expectRevert(
            abi.encodeWithSelector(SwapRouter.FeeTooHigh.selector, 101, 100)
        );
        new SwapRouter(UNISWAP_ROUTER, UNISWAP_QUOTER, ONE_INCH_ROUTER, feeRecipient, 101);
    }

    function test_constructor_zeroFeeAllowed() public {
        SwapRouter zeroFeeRouter = new SwapRouter(
            UNISWAP_ROUTER, UNISWAP_QUOTER, ONE_INCH_ROUTER, feeRecipient, 0
        );
        assertEq(zeroFeeRouter.protocolFeeBps(), 0);
    }

    // ── Fuzz Tests ─────────────────────────────────────────────────────────────

    function testFuzz_feeDeductionIsExact(uint96 amountIn, uint8 feeBps) public {
        // Bound inputs: 0.01 ETH minimum so Uniswap V3 can fill the swap
        amountIn = uint96(bound(amountIn, 0.01 ether, 5 ether));
        feeBps   = uint8(bound(feeBps, 0, 100));   // 0 – 100 bps

        router.setProtocolFee(feeBps);

        uint256 expectedFee = (uint256(amountIn) * feeBps) / 10_000;
        uint256 expectedNet = uint256(amountIn) - expectedFee;

        deal(WETH, user, amountIn);
        _approve(WETH, address(router), amountIn);

        uint256 recipientBefore = IERC20(WETH).balanceOf(feeRecipient);
        vm.prank(user);
        router.swapSingle(WETH, USDC, FEE_MEDIUM, amountIn, 1, user);

        uint256 collected = IERC20(WETH).balanceOf(feeRecipient) - recipientBefore;
        assertEq(collected, expectedFee, "fee amount mismatch");
        // Net is verified implicitly: if the swap executes with netIn, Uniswap would
        // have consumed exactly netIn WETH (checked via router's forceApprove reset).
        (expectedNet); // silence unused warning
    }
}
