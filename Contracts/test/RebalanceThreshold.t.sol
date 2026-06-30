// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RebalanceThreshold.sol";

contract MockThresholdExecutor is IThresholdActionExecutor {
    bool public called;
    bytes32 public lastThresholdId;
    uint256 public lastCurrentValue;
    uint256 public lastMinValue;
    uint256 public lastMaxValue;
    uint256 public lastDeviationBps;
    bytes public lastActionData;

    function executeThresholdAction(
        bytes32 thresholdId,
        uint256 currentValue,
        uint256 minValue,
        uint256 maxValue,
        uint256 deviationBps,
        bytes calldata actionData
    ) external {
        called = true;
        lastThresholdId = thresholdId;
        lastCurrentValue = currentValue;
        lastMinValue = minValue;
        lastMaxValue = maxValue;
        lastDeviationBps = deviationBps;
        lastActionData = actionData;
    }
}

contract RebalanceThresholdTest is Test {
    RebalanceThreshold threshold;
    MockThresholdExecutor executor;

    bytes32 constant ETH_WEIGHT = keccak256("ETH_WEIGHT");
    bytes32 constant USDC_WEIGHT = keccak256("USDC_WEIGHT");

    function setUp() public {
        executor = new MockThresholdExecutor();
        threshold = new RebalanceThreshold(address(executor));
    }

    function test_thresholdsAreSet() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "rebalance-eth");

        RebalanceThreshold.Threshold memory config = threshold.getThreshold(ETH_WEIGHT);
        assertEq(config.minValue, 4_500);
        assertEq(config.maxValue, 5_500);
        assertTrue(config.enabled);
        assertTrue(config.autoTrigger);
        assertEq(config.actionData, "rebalance-eth");

        bytes32[] memory ids = threshold.getThresholdIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], ETH_WEIGHT);
    }

    function test_ownerCanUpdateThreshold() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "old");
        threshold.setThreshold(ETH_WEIGHT, 4_000, 6_000, false, false, "new");

        RebalanceThreshold.Threshold memory config = threshold.getThreshold(ETH_WEIGHT);
        assertEq(config.minValue, 4_000);
        assertEq(config.maxValue, 6_000);
        assertFalse(config.enabled);
        assertFalse(config.autoTrigger);
        assertEq(config.actionData, "new");

        bytes32[] memory ids = threshold.getThresholdIds();
        assertEq(ids.length, 1);
    }

    function test_breachesAreMonitoredAboveMax() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, false, "");
        vm.warp(10);

        (bool breached, uint256 deviationBps) = threshold.checkThreshold(ETH_WEIGHT, 6_600);

        assertTrue(breached);
        assertEq(deviationBps, 2_000);

        RebalanceThreshold.ThresholdStatus memory status = threshold.getThresholdStatus(ETH_WEIGHT);
        assertTrue(status.breached);
        assertEq(status.currentValue, 6_600);
        assertEq(status.deviationBps, 2_000);
        assertEq(status.checkedAt, 10);
    }

    function test_breachesAreMonitoredBelowMin() public {
        threshold.setThreshold(ETH_WEIGHT, 4_000, 6_000, true, false, "");

        (bool breached, uint256 deviationBps) = threshold.checkThreshold(ETH_WEIGHT, 3_000);

        assertTrue(breached);
        assertEq(deviationBps, 2_500);
    }

    function test_noBreachInsideThreshold() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "rebalance-eth");

        (bool breached, uint256 deviationBps) = threshold.checkThreshold(ETH_WEIGHT, 5_000);

        assertFalse(breached);
        assertEq(deviationBps, 0);
        assertFalse(executor.called());
    }

    function test_actionsAreTriggered() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "rebalance-eth");

        (bool breached, uint256 deviationBps) = threshold.checkThreshold(ETH_WEIGHT, 6_600);

        assertTrue(breached);
        assertEq(deviationBps, 2_000);
        assertTrue(executor.called());
        assertEq(executor.lastThresholdId(), ETH_WEIGHT);
        assertEq(executor.lastCurrentValue(), 6_600);
        assertEq(executor.lastMinValue(), 4_500);
        assertEq(executor.lastMaxValue(), 5_500);
        assertEq(executor.lastDeviationBps(), 2_000);
        assertEq(executor.lastActionData(), "rebalance-eth");
        assertEq(threshold.actionCount(), 1);
    }

    function test_historyIsTracked() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "rebalance-eth");
        vm.warp(99);

        threshold.checkThreshold(ETH_WEIGHT, 6_600);

        assertEq(threshold.historyCount(), 1);
        RebalanceThreshold.ThresholdHistory memory record = threshold.getHistory(1);
        assertEq(record.id, 1);
        assertEq(record.thresholdId, ETH_WEIGHT);
        assertEq(record.currentValue, 6_600);
        assertEq(record.minValue, 4_500);
        assertEq(record.maxValue, 5_500);
        assertEq(record.deviationBps, 2_000);
        assertEq(record.timestamp, 99);
        assertTrue(record.actionTriggered);

        uint256[] memory ids = threshold.getThresholdHistoryIds(ETH_WEIGHT);
        assertEq(ids.length, 1);
        assertEq(ids[0], 1);
    }

    function test_queriesWorkForMultipleThresholds() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "eth");
        threshold.setThreshold(USDC_WEIGHT, 2_000, 3_000, true, false, "usdc");

        bytes32[] memory ids = threshold.getThresholdIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], ETH_WEIGHT);
        assertEq(ids[1], USDC_WEIGHT);

        assertEq(threshold.calculateDeviationBps(3_600, 4_500, 5_500), 2_000);
        assertEq(threshold.calculateDeviationBps(6_600, 4_500, 5_500), 2_000);
        assertEq(threshold.calculateDeviationBps(5_000, 4_500, 5_500), 0);
    }

    function test_disabledThresholdRevertsOnCheck() public {
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, false, true, "");

        vm.expectRevert(abi.encodeWithSelector(RebalanceThreshold.ThresholdDisabled.selector, ETH_WEIGHT));
        threshold.checkThreshold(ETH_WEIGHT, 6_600);
    }

    function test_invalidThresholdReverts() public {
        vm.expectRevert(RebalanceThreshold.InvalidThreshold.selector);
        threshold.setThreshold(ETH_WEIGHT, 5_500, 4_500, true, true, "");
    }

    function test_onlyOwnerCanSetThreshold() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        threshold.setThreshold(ETH_WEIGHT, 4_500, 5_500, true, true, "");
    }
}
