// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MarketRebalance, I1inchRouter} from "../contracts/MarketRebalance.sol";

// ─── Mock ERC-20 ─────────────────────────────────────────────────────────────

contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ─── Mock 1inch Router ────────────────────────────────────────────────────────
//
// Simulates a 1inch swap: takes `amount` of srcToken from the caller and returns
// a configurable `returnAmount` of dstToken (pre-minted into the router).

contract Mock1inchRouter {
    // configurable return ratio (scaled 1e18)
    uint256 public returnRatioWad = 1e18; // 1:1 default

    function setReturnRatio(uint256 ratioWad) external {
        returnRatioWad = ratioWad;
    }

    function swap(
        address, /* executor */
        I1inchRouter.SwapDescription calldata desc,
        bytes calldata, /* permit */
        bytes calldata  /* data */
    ) external payable returns (uint256 returnAmount, uint256 spentAmount) {
        // Pull source tokens from caller
        IERC20(address(desc.srcToken)).transferFrom(
            msg.sender,
            address(this),
            desc.amount
        );

        // Compute and pay destination tokens
        returnAmount = (desc.amount * returnRatioWad) / 1e18;
        spentAmount  = desc.amount;

        // Mint dstToken to dstReceiver (simulating a swap)
        MockToken(address(desc.dstToken)).mint(desc.dstReceiver, returnAmount);
    }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

contract MarketRebalanceTest is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address owner = makeAddr("owner");

    // ── Contracts ─────────────────────────────────────────────────────────────
    MockToken       tokenA;
    MockToken       tokenB;
    MockToken       tokenC;
    Mock1inchRouter mockRouter;
    MarketRebalance rebalancer;

    // ── Defaults ──────────────────────────────────────────────────────────────
    uint256 constant DRIFT_BPS   = 500;  // 5 % drift threshold
    uint256 constant COOLDOWN    = 1 hours;

    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        tokenA     = new MockToken("Token A", "TKA");
        tokenB     = new MockToken("Token B", "TKB");
        tokenC     = new MockToken("Token C", "TKC");
        mockRouter = new Mock1inchRouter();

        rebalancer = new MarketRebalance(
            owner,
            address(mockRouter),
            DRIFT_BPS,
            COOLDOWN
        );

        // Fund the rebalancer with initial portfolio tokens
        tokenA.mint(address(rebalancer), 5_000 ether);
        tokenB.mint(address(rebalancer), 3_000 ether);
        tokenC.mint(address(rebalancer), 2_000 ether);

        // Set a simple 3-asset portfolio: 50/30/20 %
        MarketRebalance.Asset[] memory assets = new MarketRebalance.Asset[](3);
        assets[0] = MarketRebalance.Asset(address(tokenA), 5_000);
        assets[1] = MarketRebalance.Asset(address(tokenB), 3_000);
        assets[2] = MarketRebalance.Asset(address(tokenC), 2_000);

        vm.prank(owner);
        rebalancer.setPortfolio(assets);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    function _buildSwapOrder(
        address src,
        address dst,
        uint256 amount,
        uint256 minReturn
    ) internal view returns (MarketRebalance.SwapOrder memory) {
        return MarketRebalance.SwapOrder({
            executor: address(mockRouter),
            desc: I1inchRouter.SwapDescription({
                srcToken:        IERC20(src),
                dstToken:        IERC20(dst),
                srcReceiver:     payable(address(mockRouter)),
                dstReceiver:     payable(address(rebalancer)),
                amount:          amount,
                minReturnAmount: minReturn,
                flags:           0
            }),
            permit: "",
            data:   "",
            minReturnAmount: minReturn
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Deployment
    // ─────────────────────────────────────────────────────────────────────────

    function test_InitialState() public view {
        assertEq(rebalancer.router(), address(mockRouter));
        assertEq(rebalancer.driftThresholdBps(), DRIFT_BPS);
        assertEq(rebalancer.cooldownPeriod(), COOLDOWN);
        assertEq(rebalancer.lastRebalanceAt(), 0);
        assertFalse(rebalancer.paused());
        assertEq(rebalancer.rebalanceCount(), 0);
    }

    function test_RevertOnZeroRouter() public {
        vm.expectRevert(MarketRebalance.ZeroAddress.selector);
        new MarketRebalance(owner, address(0), DRIFT_BPS, COOLDOWN);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Portfolio management
    // ─────────────────────────────────────────────────────────────────────────

    function test_PortfolioSet() public view {
        MarketRebalance.Asset[] memory p = rebalancer.getPortfolio();
        assertEq(p.length, 3);
        assertEq(p[0].token, address(tokenA));
        assertEq(p[0].targetWeightBps, 5_000);
    }

    function test_RevertOnInvalidWeightsSum() public {
        MarketRebalance.Asset[] memory assets = new MarketRebalance.Asset[](2);
        assets[0] = MarketRebalance.Asset(address(tokenA), 5_000);
        assets[1] = MarketRebalance.Asset(address(tokenB), 4_000); // sum = 9000 ≠ 10000

        vm.prank(owner);
        vm.expectRevert(MarketRebalance.InvalidWeights.selector);
        rebalancer.setPortfolio(assets);
    }

    function test_RevertOnZeroAddressAsset() public {
        MarketRebalance.Asset[] memory assets = new MarketRebalance.Asset[](2);
        assets[0] = MarketRebalance.Asset(address(0), 5_000);
        assets[1] = MarketRebalance.Asset(address(tokenB), 5_000);

        vm.prank(owner);
        vm.expectRevert(MarketRebalance.ZeroAddress.selector);
        rebalancer.setPortfolio(assets);
    }

    function test_NonOwnerCannotSetPortfolio() public {
        MarketRebalance.Asset[] memory assets = new MarketRebalance.Asset[](1);
        assets[0] = MarketRebalance.Asset(address(tokenA), 10_000);
        vm.expectRevert();
        rebalancer.setPortfolio(assets);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Balance monitoring
    // ─────────────────────────────────────────────────────────────────────────

    function test_GetPortfolioBalances() public view {
        (address[] memory tokens, uint256[] memory bals) =
            rebalancer.getPortfolioBalances(address(rebalancer));

        assertEq(tokens[0], address(tokenA));
        assertEq(bals[0],   5_000 ether);
        assertEq(tokens[1], address(tokenB));
        assertEq(bals[1],   3_000 ether);
        assertEq(tokens[2], address(tokenC));
        assertEq(bals[2],   2_000 ether);
    }

    function test_CurrentWeightsMatchBalances() public view {
        // Total = 10_000 ether → A=50%, B=30%, C=20%
        (, uint256[] memory weights) = rebalancer.currentWeights(address(rebalancer));
        assertEq(weights[0], 5_000);
        assertEq(weights[1], 3_000);
        assertEq(weights[2], 2_000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Rebalance check (drift detection)
    // ─────────────────────────────────────────────────────────────────────────

    function test_NoRebalanceNeededWhenBalanced() public view {
        assertFalse(rebalancer.checkRebalance(address(rebalancer)));
    }

    function test_RebalanceNeededWhenDriftExceedsThreshold() public {
        // Give A a lot more tokens so it drifts well above threshold
        tokenA.mint(address(rebalancer), 10_000 ether); // now ~72% vs 50% target
        assertTrue(rebalancer.checkRebalance(address(rebalancer)));
    }

    function test_DriftReportReflectsImbalance() public {
        tokenA.mint(address(rebalancer), 5_000 ether); // 10_000 / 15_000 ≈ 66%
        (, , , int256[] memory drifts) =
            rebalancer.getDriftReport(address(rebalancer));
        // A is overweight → positive drift
        assertGt(drifts[0], 0);
        // B and C are underweight → negative drift
        assertLt(drifts[1], 0);
        assertLt(drifts[2], 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Rebalance execution
    // ─────────────────────────────────────────────────────────────────────────

    function test_RebalanceExecutesSwapAndRecordsHistory() public {
        // Swap 1000 A → B (move A closer to target)
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](1);
        swaps[0] = _buildSwapOrder(address(tokenA), address(tokenB), 1_000 ether, 900 ether);

        // Approve router for the swap
        vm.startPrank(owner);

        // The rebalancer needs to approve the router internally; that happens in
        // rebalance(). We do need to call it as the owner.
        rebalancer.rebalance(swaps, false);
        vm.stopPrank();

        assertEq(rebalancer.rebalanceCount(), 1);

        uint256[] memory ids = rebalancer.rebalanceHistory();
        assertEq(ids.length, 1);

        MarketRebalance.RebalanceRecord memory r = rebalancer.getRebalance(ids[0]);
        assertEq(r.swapCount, 1);
        assertFalse(r.triggered);
        assertGt(r.executedAt, 0);
    }

    function test_RebalanceUpdatesLastRebalanceAt() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);
        vm.prank(owner);
        rebalancer.rebalance(swaps, false);

        assertEq(rebalancer.lastRebalanceAt(), block.timestamp);
    }

    function test_RebalanceCooldownEnforced() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);
        vm.prank(owner);
        rebalancer.rebalance(swaps, false);

        vm.prank(owner);
        vm.expectRevert(MarketRebalance.RebalanceCooldown.selector);
        rebalancer.rebalance(swaps, false);
    }

    function test_RebalanceAfterCooldown() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);
        vm.prank(owner);
        rebalancer.rebalance(swaps, false);

        vm.warp(block.timestamp + COOLDOWN + 1);

        vm.prank(owner);
        rebalancer.rebalance(swaps, false);
        assertEq(rebalancer.rebalanceCount(), 2);
    }

    function test_RebalanceRevertsWhenPaused() public {
        vm.prank(owner);
        rebalancer.setPaused(true);

        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);
        vm.prank(owner);
        vm.expectRevert(MarketRebalance.ContractPaused.selector);
        rebalancer.rebalance(swaps, false);
    }

    function test_NonOwnerCannotRebalance() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);
        vm.expectRevert();
        rebalancer.rebalance(swaps, false);
    }

    function test_SlippageGuardReverts() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](1);
        // minReturnAmount > actual return (router returns 1:1, we demand 2x)
        swaps[0] = _buildSwapOrder(
            address(tokenA), address(tokenB), 100 ether, 300 ether // impossible
        );

        vm.prank(owner);
        vm.expectRevert(MarketRebalance.SlippageExceeded.selector);
        rebalancer.rebalance(swaps, false);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § History queries
    // ─────────────────────────────────────────────────────────────────────────

    function test_GetRebalanceRevertsOnUnknownId() public {
        vm.expectRevert(MarketRebalance.UnknownRebalance.selector);
        rebalancer.getRebalance(999);
    }

    function test_MultipleRebalancesTracked() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);

        vm.prank(owner);
        rebalancer.rebalance(swaps, false);

        vm.warp(block.timestamp + COOLDOWN + 1);
        vm.prank(owner);
        rebalancer.rebalance(swaps, true);

        assertEq(rebalancer.rebalanceCount(), 2);
        uint256[] memory ids = rebalancer.rebalanceHistory();
        assertEq(ids.length, 2);

        // Second rebalance is autoDrift = true
        MarketRebalance.RebalanceRecord memory r2 = rebalancer.getRebalance(ids[1]);
        assertTrue(r2.triggered);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Cooldown remaining
    // ─────────────────────────────────────────────────────────────────────────

    function test_CooldownRemainingBeforeFirstRebalance() public view {
        // No rebalance yet: lastRebalanceAt = 0, next = 0 + cooldown
        // block.timestamp starts at ~1 in tests; already past so remaining = 0
        assertEq(rebalancer.cooldownRemaining(), 0);
    }

    function test_CooldownRemainingAfterRebalance() public {
        MarketRebalance.SwapOrder[] memory swaps = new MarketRebalance.SwapOrder[](0);
        vm.prank(owner);
        rebalancer.rebalance(swaps, false);

        uint256 remaining = rebalancer.cooldownRemaining();
        assertGt(remaining, 0);
        assertLe(remaining, COOLDOWN);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Admin guards
    // ─────────────────────────────────────────────────────────────────────────

    function test_OwnerCanUpdateRouter() public {
        address newRouter = makeAddr("newRouter");
        vm.prank(owner);
        rebalancer.setRouter(newRouter);
        assertEq(rebalancer.router(), newRouter);
    }

    function test_OwnerCanUpdateDriftThreshold() public {
        vm.prank(owner);
        rebalancer.setDriftThreshold(300);
        assertEq(rebalancer.driftThresholdBps(), 300);
    }

    function test_OwnerCanUpdateCooldown() public {
        vm.prank(owner);
        rebalancer.setCooldownPeriod(2 hours);
        assertEq(rebalancer.cooldownPeriod(), 2 hours);
    }

    function test_NonOwnerCannotPause() public {
        vm.expectRevert();
        rebalancer.setPaused(true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // § Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Fuzz: any weight distribution that sums to 10 000 should be accepted.
    function testFuzz_ValidPortfolioWeights(uint256 wA, uint256 wB) public {
        wA = bound(wA, 1, 9_998);
        wB = bound(wB, 1, 9_999 - wA);
        uint256 wC = 10_000 - wA - wB;

        MarketRebalance.Asset[] memory assets = new MarketRebalance.Asset[](3);
        assets[0] = MarketRebalance.Asset(address(tokenA), wA);
        assets[1] = MarketRebalance.Asset(address(tokenB), wB);
        assets[2] = MarketRebalance.Asset(address(tokenC), wC);

        vm.prank(owner);
        rebalancer.setPortfolio(assets);

        MarketRebalance.Asset[] memory stored = rebalancer.getPortfolio();
        assertEq(stored[0].targetWeightBps + stored[1].targetWeightBps + stored[2].targetWeightBps, 10_000);
    }
}
