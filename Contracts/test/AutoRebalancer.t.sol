// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AutoRebalancer.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockRebalanceToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockExecutor is IRebalanceExecutor {
    bool public called;
    address public lastVault;
    bytes public lastData;
    int256 public profitLoss = 12;

    function executeRebalance(
        address vault,
        address[] calldata,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata data
    ) external returns (int256) {
        called = true;
        lastVault = vault;
        lastData = data;
        return profitLoss;
    }
}

contract AutoRebalancerTest is Test {
    AutoRebalancer rebalancer;
    MockRebalanceToken tokenA;
    MockRebalanceToken tokenB;
    MockExecutor executor;

    uint256 constant WAD = 1e18;

    function setUp() public {
        tokenA = new MockRebalanceToken("Token A", "TKA");
        tokenB = new MockRebalanceToken("Token B", "TKB");
        executor = new MockExecutor();

        address[] memory assets = new address[](2);
        assets[0] = address(tokenA);
        assets[1] = address(tokenB);

        uint256[] memory weights = new uint256[](2);
        weights[0] = 6_000;
        weights[1] = 4_000;

        rebalancer = new AutoRebalancer(assets, weights, 500, 1 hours, address(executor));
    }

    function test_parametersAreSet() public view {
        (uint256 minDeviationBps, uint256 minInterval, bool enabled) = rebalancer.config();
        assertEq(minDeviationBps, 500);
        assertEq(minInterval, 1 hours);
        assertTrue(enabled);
        assertEq(rebalancer.targetWeightBps(address(tokenA)), 6_000);
        assertEq(rebalancer.targetWeightBps(address(tokenB)), 4_000);
        assertEq(rebalancer.executor(), address(executor));
    }

    function test_ownerCanUpdateParametersAndTargets() public {
        rebalancer.setRebalanceParameters(250, 30 minutes, false);
        (uint256 minDeviationBps, uint256 minInterval, bool enabled) = rebalancer.config();
        assertEq(minDeviationBps, 250);
        assertEq(minInterval, 30 minutes);
        assertFalse(enabled);

        address[] memory assets = new address[](2);
        assets[0] = address(tokenA);
        assets[1] = address(tokenB);

        uint256[] memory weights = new uint256[](2);
        weights[0] = 5_000;
        weights[1] = 5_000;
        rebalancer.setTargetWeights(assets, weights);

        assertEq(rebalancer.targetWeightBps(address(tokenA)), 5_000);
        assertEq(rebalancer.targetWeightBps(address(tokenB)), 5_000);
    }

    function test_triggersAreMonitoredByCheckUpkeep() public {
        tokenA.mint(address(rebalancer), 90 * WAD);
        tokenB.mint(address(rebalancer), 10 * WAD);
        vm.warp(block.timestamp + 1 hours);

        (bool needed, bytes memory performData) = rebalancer.checkUpkeep("");
        assertTrue(needed);
        assertEq(performData.length, 0);

        (bool queryNeeded, uint256 deviation) = rebalancer.needsRebalance();
        assertTrue(queryNeeded);
        assertEq(deviation, 3_000);
    }

    function test_triggerRespectsDisabledFlagAndInterval() public {
        tokenA.mint(address(rebalancer), 90 * WAD);
        tokenB.mint(address(rebalancer), 10 * WAD);

        (bool neededBeforeInterval,) = rebalancer.checkUpkeep("");
        assertFalse(neededBeforeInterval);

        vm.warp(block.timestamp + 1 hours);
        rebalancer.setRebalanceParameters(500, 1 hours, false);

        (bool neededWhenDisabled,) = rebalancer.checkUpkeep("");
        assertFalse(neededWhenDisabled);
    }

    function test_rebalancesExecuteThroughKeeper() public {
        tokenA.mint(address(rebalancer), 90 * WAD);
        tokenB.mint(address(rebalancer), 10 * WAD);
        rebalancer.setExecutorData("rebalance-plan");
        vm.warp(block.timestamp + 1 hours);

        (, bytes memory performData) = rebalancer.checkUpkeep("");
        rebalancer.performUpkeep(performData);

        assertTrue(executor.called());
        assertEq(executor.lastVault(), address(rebalancer));
        assertEq(executor.lastData(), "rebalance-plan");
        assertEq(rebalancer.rebalanceCount(), 1);
        assertEq(rebalancer.lastRebalanceAt(), block.timestamp);
    }

    function test_performanceIsTracked() public {
        tokenA.mint(address(rebalancer), 90 * WAD);
        tokenB.mint(address(rebalancer), 10 * WAD);
        vm.warp(block.timestamp + 1 hours);

        rebalancer.performUpkeep("");

        (uint256 count, int256 profitLoss, uint256 latest) = rebalancer.getPerformance();
        assertEq(count, 1);
        assertEq(profitLoss, 12);
        assertEq(latest, block.timestamp);

        AutoRebalancer.RebalanceRecord memory record = rebalancer.getRebalanceRecord(1);
        assertEq(record.id, 1);
        assertEq(record.executor, address(executor));
        assertEq(record.profitLoss, 12);
        assertEq(record.totalValueBefore, 100 * WAD);
        assertEq(record.totalValueAfter, 100 * WAD);
    }

    function test_queriesReturnCurrentWeights() public {
        tokenA.mint(address(rebalancer), 90 * WAD);
        tokenB.mint(address(rebalancer), 10 * WAD);

        (address[] memory assets, uint256[] memory balances, uint256[] memory weights) =
            rebalancer.getCurrentWeights();

        assertEq(assets.length, 2);
        assertEq(assets[0], address(tokenA));
        assertEq(balances[0], 90 * WAD);
        assertEq(balances[1], 10 * WAD);
        assertEq(weights[0], 9_000);
        assertEq(weights[1], 1_000);
        assertEq(rebalancer.getMaxDeviationBps(), 3_000);
    }

    function test_performUpkeepRevertsWhenNotNeeded() public {
        tokenA.mint(address(rebalancer), 60 * WAD);
        tokenB.mint(address(rebalancer), 40 * WAD);
        vm.warp(block.timestamp + 1 hours);

        vm.expectRevert(AutoRebalancer.RebalanceNotNeeded.selector);
        rebalancer.performUpkeep("");
    }

    function test_invalidWeightsRevert() public {
        address[] memory assets = new address[](2);
        assets[0] = address(tokenA);
        assets[1] = address(tokenB);

        uint256[] memory weights = new uint256[](2);
        weights[0] = 5_000;
        weights[1] = 4_999;

        vm.expectRevert(AutoRebalancer.InvalidWeights.selector);
        rebalancer.setTargetWeights(assets, weights);
    }
}
