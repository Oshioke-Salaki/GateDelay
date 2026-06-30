// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SupplyController.sol";

contract SupplyControllerTest is Test {
    SupplyController public controller;
    address public admin;
    address public controller_addr;
    address public manager;
    address public user;

    function setUp() public {
        admin = address(0x1);
        controller_addr = address(0x2);
        manager = address(0x3);
        user = address(0x4);

        controller = new SupplyController();

        // Grant roles
        controller.grantRole(controller.ADMIN_ROLE(), admin);
        controller.grantRole(controller.CONTROLLER_ROLE(), controller_addr);
        controller.grantRole(controller.MANAGER_ROLE(), manager);
    }

    // ==================== Configuration Tests ====================

    function test_SetSupplyCap() public {
        vm.prank(admin);
        controller.setSupplyCap(1000000);
        assertEq(controller.getSupplyCap(), 1000000);
    }

    function test_SetSupplyCapRevertsIfLessThanCurrentSupply() public {
        // Mint some supply first
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        vm.expectRevert("Cap cannot be less than current supply");
        controller.setSupplyCap(100000);
    }

    function test_SetSupplyCapRevertsIfLessThanFloor() public {
        vm.prank(admin);
        controller.setSupplyFloor(200000);

        vm.prank(admin);
        vm.expectRevert("Cap cannot be less than floor");
        controller.setSupplyCap(100000);
    }

    function test_SetSupplyFloor() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(100000);
        assertEq(controller.getSupplyFloor(), 100000);
    }

    function test_SetSupplyFloorRevertsIfMoreThanCurrentSupply() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        vm.prank(admin);
        vm.expectRevert("Floor cannot be more than current supply");
        controller.setSupplyFloor(500000);
    }

    function test_SetSupplyFloorRevertsIfMoreThanCap() public {
        vm.prank(admin);
        controller.setSupplyCap(100000);

        vm.prank(admin);
        vm.expectRevert("Floor cannot be more than cap");
        controller.setSupplyFloor(500000);
    }

    function test_SetMaxMintPerTx() public {
        vm.prank(admin);
        controller.setMaxMintPerTx(50000);
        assertEq(controller.getMaxMintPerTx(), 50000);
    }

    function test_SetMaxBurnPerTx() public {
        vm.prank(admin);
        controller.setMaxBurnPerTx(30000);
        assertEq(controller.getMaxBurnPerTx(), 30000);
    }

    function test_ToggleLimits() public {
        assertFalse(controller.limitsEnabled());

        vm.prank(admin);
        controller.toggleLimits(true);
        assertTrue(controller.limitsEnabled());

        vm.prank(admin);
        controller.toggleLimits(false);
        assertFalse(controller.limitsEnabled());
    }

    function test_OnlyAdminCanSetCap() public {
        vm.prank(user);
        vm.expectRevert();
        controller.setSupplyCap(1000000);
    }

    function test_OnlyAdminCanSetFloor() public {
        vm.prank(user);
        vm.expectRevert();
        controller.setSupplyFloor(100000);
    }

    function test_OnlyAdminCanToggleLimits() public {
        vm.prank(user);
        vm.expectRevert();
        controller.toggleLimits(true);
    }

    // ==================== Supply Control - Mint Tests ====================

    function test_Mint() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        assertEq(controller.getCurrentSupply(), 500000);
        assertEq(controller.getTotalMinted(), 500000);
    }

    function test_MintMultipleTimes() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.mint(200000);
        vm.prank(controller_addr);
        controller.mint(150000);

        assertEq(controller.getCurrentSupply(), 450000);
        assertEq(controller.getTotalMinted(), 450000);
    }

    function test_MintCannotBeZero() public {
        vm.prank(controller_addr);
        vm.expectRevert("Cannot mint zero amount");
        controller.mint(0);
    }

    function test_MintRevertsIfExceedsCapWhenLimitsEnabled() public {
        vm.prank(admin);
        controller.setSupplyCap(500000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        vm.expectRevert("Mint exceeds supply cap");
        controller.mint(600000);
    }

    function test_MintRevertsIfExceedsPerTxLimit() public {
        vm.prank(admin);
        controller.setMaxMintPerTx(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        vm.expectRevert("Mint exceeds per-transaction limit");
        controller.mint(200000);
    }

    function test_MintWorksWithinLimits() public {
        vm.prank(admin);
        controller.setSupplyCap(1000000);
        vm.prank(admin);
        controller.setMaxMintPerTx(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        bool result = controller.mint(50000);
        assertTrue(result);
        assertEq(controller.getCurrentSupply(), 50000);
    }

    function test_MintIncrementsMintCount() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.mint(100000);

        (uint256 mintCount, , , ) = controller.getUserStats(controller_addr);
        assertEq(mintCount, 2);
    }

    function test_OnlyControllerCanMint() public {
        vm.prank(user);
        vm.expectRevert();
        controller.mint(100000);
    }

    // ==================== Supply Control - Burn Tests ====================

    function test_Burn() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(controller_addr);
        controller.burn(200000);

        assertEq(controller.getCurrentSupply(), 300000);
        assertEq(controller.getTotalBurned(), 200000);
    }

    function test_BurnMultipleTimes() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(controller_addr);
        controller.burn(100000);
        vm.prank(controller_addr);
        controller.burn(150000);

        assertEq(controller.getCurrentSupply(), 250000);
        assertEq(controller.getTotalBurned(), 250000);
    }

    function test_BurnCannotBeZero() public {
        vm.prank(controller_addr);
        vm.expectRevert("Cannot burn zero amount");
        controller.burn(0);
    }

    function test_BurnCannotExceedTotalSupply() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        vm.prank(controller_addr);
        vm.expectRevert("Cannot burn more than total supply");
        controller.burn(200000);
    }

    function test_BurnRevertsIfExceedsFloorWhenLimitsEnabled() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(200000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        vm.expectRevert("Burn would breach supply floor");
        controller.burn(400000);
    }

    function test_BurnRevertsIfExceedsPerTxLimit() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setMaxBurnPerTx(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        vm.expectRevert("Burn exceeds per-transaction limit");
        controller.burn(200000);
    }

    function test_BurnWorksWithinLimits() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(100000);
        vm.prank(admin);
        controller.setMaxBurnPerTx(200000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        bool result = controller.burn(100000);
        assertTrue(result);
        assertEq(controller.getCurrentSupply(), 400000);
    }

    function test_BurnIncrementsBurnCount() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(controller_addr);
        controller.burn(100000);
        vm.prank(controller_addr);
        controller.burn(100000);

        ( , uint256 burnCount, , ) = controller.getUserStats(controller_addr);
        assertEq(burnCount, 2);
    }

    function test_OnlyControllerCanBurn() public {
        vm.prank(user);
        vm.expectRevert();
        controller.burn(100000);
    }

    // ==================== Supply Limits & Changes ====================

    function test_CanMintReturnsTrue() public {
        vm.prank(admin);
        controller.setSupplyCap(1000000);
        vm.prank(admin);
        controller.setMaxMintPerTx(500000);
        vm.prank(admin);
        controller.toggleLimits(true);

        assertTrue(controller.canMint(100000));
    }

    function test_CanMintReturnsFalseIfExceedsPerTxLimit() public {
        vm.prank(admin);
        controller.setMaxMintPerTx(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        assertFalse(controller.canMint(200000));
    }

    function test_CanMintReturnsFalseIfExceedsCap() public {
        vm.prank(admin);
        controller.setSupplyCap(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        assertFalse(controller.canMint(150000));
    }

    function test_CanMintReturnsTrueWhenLimitsDisabled() public {
        vm.prank(admin);
        controller.setSupplyCap(100000);

        assertTrue(controller.canMint(500000));
    }

    function test_CanBurnReturnsTrue() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        assertTrue(controller.canBurn(100000));
    }

    function test_CanBurnReturnsFalseIfExceedsPerTxLimit() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setMaxBurnPerTx(100000);
        vm.prank(admin);
        controller.toggleLimits(true);

        assertFalse(controller.canBurn(200000));
    }

    function test_CanBurnReturnsFalseIfBreachesFloor() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(300000);
        vm.prank(admin);
        controller.toggleLimits(true);

        assertFalse(controller.canBurn(300000));
    }

    function test_CanBurnReturnsTrueWhenLimitsDisabled() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(400000);

        assertTrue(controller.canBurn(300000));
    }

    function test_GetSupplyUtilization() public {
        vm.prank(admin);
        controller.setSupplyCap(1000000);

        vm.prank(controller_addr);
        controller.mint(500000);

        assertEq(controller.getSupplyUtilization(), 50);
    }

    function test_GetSupplyUtilizationZeroIfCapIsZero() public {
        assertEq(controller.getSupplyUtilization(), 0);
    }

    function test_GetRemainingMintCapacity() public {
        vm.prank(admin);
        controller.setSupplyCap(1000000);

        vm.prank(controller_addr);
        controller.mint(300000);

        assertEq(controller.getRemainingMintCapacity(), 700000);
    }

    function test_GetRemainingMintCapacityZeroIfAtCap() public {
        vm.prank(admin);
        controller.setSupplyCap(100000);

        vm.prank(controller_addr);
        controller.mint(100000);

        assertEq(controller.getRemainingMintCapacity(), 0);
    }

    function test_GetAvailableBurnCapacity() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.setSupplyFloor(200000);

        assertEq(controller.getAvailableBurnCapacity(), 300000);
    }

    function test_GetAvailableBurnCapacityZeroIfAtFloor() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        vm.prank(admin);
        controller.setSupplyFloor(100000);

        assertEq(controller.getAvailableBurnCapacity(), 0);
    }

    // ==================== Transfer Recording Tests ====================

    function test_RecordTransfer() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(manager);
        bool result = controller.recordTransfer(user, address(0x5), 100000);
        assertTrue(result);
    }

    function test_RecordTransferCannotBeZero() public {
        vm.prank(manager);
        vm.expectRevert("Cannot transfer zero amount");
        controller.recordTransfer(user, address(0x5), 0);
    }

    function test_RecordTransferCannotHaveZeroAddress() public {
        vm.prank(manager);
        vm.expectRevert("Invalid from address");
        controller.recordTransfer(address(0), address(0x5), 100000);

        vm.prank(manager);
        vm.expectRevert("Invalid to address");
        controller.recordTransfer(user, address(0), 100000);
    }

    function test_OnlyManagerCanRecordTransfer() public {
        vm.prank(user);
        vm.expectRevert();
        controller.recordTransfer(user, address(0x5), 100000);
    }

    // ==================== Metrics & Analytics Tests ====================

    function test_GetTotalMinted() public {
        vm.prank(controller_addr);
        controller.mint(300000);
        vm.prank(controller_addr);
        controller.mint(200000);

        assertEq(controller.getTotalMinted(), 500000);
    }

    function test_GetTotalBurned() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(controller_addr);
        controller.burn(200000);
        vm.prank(controller_addr);
        controller.burn(150000);

        assertEq(controller.getTotalBurned(), 350000);
    }

    function test_GetMetricsCount() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.burn(50000);

        assertEq(controller.getMetricsCount(), 3);
    }

    function test_GetMetric() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        SupplyController.SupplyMetric memory metric = controller.getMetric(0);
        assertEq(metric.amount, 100000);
        assertEq(metric.executor, controller_addr);
        assertEq(
            uint256(metric.operation),
            uint256(SupplyController.SupplyOperation.MINT)
        );
    }

    function test_GetMetricReverts() public {
        vm.expectRevert("Invalid metric index");
        controller.getMetric(0);
    }

    function test_GetMetricsRange() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.mint(200000);
        vm.prank(controller_addr);
        controller.burn(50000);

        SupplyController.SupplyMetric[] memory metrics = controller.getMetricsRange(0, 2);
        assertEq(metrics.length, 2);
        assertEq(metrics[0].amount, 100000);
        assertEq(metrics[1].amount, 200000);
    }

    function test_GetUserMetricsCount() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.mint(100000);

        assertEq(controller.getUserMetricsCount(controller_addr), 2);
        assertEq(controller.getUserMetricsCount(user), 0);
    }

    function test_GetUserMetric() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        SupplyController.SupplyMetric memory metric = controller.getUserMetric(
            controller_addr,
            0
        );
        assertEq(metric.amount, 100000);
    }

    function test_GetUserMetricsRange() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.burn(50000);

        vm.prank(manager);
        controller.recordTransfer(controller_addr, user, 25000);

        SupplyController.SupplyMetric[] memory userMetrics = controller
            .getUserMetricsRange(controller_addr, 0, 2);
        assertEq(userMetrics.length, 2);
    }

    function test_GetSupplyChangesSince() public {
        uint256 timestamp1 = block.timestamp;

        vm.prank(controller_addr);
        controller.mint(100000);

        vm.warp(block.timestamp + 10);
        uint256 timestamp2 = block.timestamp;

        vm.prank(controller_addr);
        controller.mint(50000);

        SupplyController.SupplyMetric[] memory changes = controller
            .getSupplyChangesSince(timestamp2);
        assertEq(changes.length, 1);
        assertEq(changes[0].amount, 50000);
    }

    function test_GetUserStats() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        vm.warp(block.timestamp + 5);

        vm.prank(controller_addr);
        controller.burn(50000);

        (
            uint256 mintCount,
            uint256 burnCount,
            uint256 lastMint,
            uint256 lastBurn
        ) = controller.getUserStats(controller_addr);

        assertEq(mintCount, 1);
        assertEq(burnCount, 1);
        assertGt(lastMint, 0);
        assertGt(lastBurn, 0);
        assertGt(lastBurn, lastMint);
    }

    // ==================== Reset Tests ====================

    function test_ResetSupply() public {
        vm.prank(controller_addr);
        controller.mint(500000);

        vm.prank(admin);
        controller.resetSupply();

        assertEq(controller.getCurrentSupply(), 0);
        assertEq(controller.getTotalMinted(), 0);
        assertEq(controller.getTotalBurned(), 0);
    }

    function test_OnlyAdminCanResetSupply() public {
        vm.prank(user);
        vm.expectRevert();
        controller.resetSupply();
    }

    function test_ResetUserStats() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.burn(50000);

        vm.prank(admin);
        controller.resetUserStats(controller_addr);

        (uint256 mintCount, uint256 burnCount, , ) = controller.getUserStats(
            controller_addr
        );
        assertEq(mintCount, 0);
        assertEq(burnCount, 0);
    }

    function test_OnlyAdminCanResetUserStats() public {
        vm.prank(user);
        vm.expectRevert();
        controller.resetUserStats(user);
    }

    // ==================== Access Control Tests ====================

    function test_AdminRoleCanConfigureLimits() public {
        vm.prank(admin);
        controller.setSupplyCap(1000000);
    }

    function test_ControllerRoleCanMintAndBurn() public {
        vm.prank(controller_addr);
        controller.mint(100000);
        vm.prank(controller_addr);
        controller.burn(50000);
    }

    function test_ManagerRoleCanRecordTransfers() public {
        vm.prank(manager);
        controller.recordTransfer(user, address(0x5), 100000);
    }

    // ==================== Edge Cases ====================

    function test_MintAndBurnCycle() public {
        vm.prank(controller_addr);
        controller.mint(500000);
        assertEq(controller.getCurrentSupply(), 500000);

        vm.prank(controller_addr);
        controller.burn(200000);
        assertEq(controller.getCurrentSupply(), 300000);

        vm.prank(controller_addr);
        controller.mint(100000);
        assertEq(controller.getCurrentSupply(), 400000);

        assertEq(controller.getTotalMinted(), 600000);
        assertEq(controller.getTotalBurned(), 200000);
    }

    function test_LimitsWithMultipleOperations() public {
        vm.prank(admin);
        controller.setSupplyCap(500000);
        vm.prank(admin);
        controller.setSupplyFloor(100000);
        vm.prank(admin);
        controller.setMaxMintPerTx(200000);
        vm.prank(admin);
        controller.setMaxBurnPerTx(150000);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        controller.mint(200000);
        assertEq(controller.getCurrentSupply(), 200000);

        vm.prank(controller_addr);
        controller.mint(200000);
        assertEq(controller.getCurrentSupply(), 400000);

        vm.prank(controller_addr);
        controller.burn(150000);
        assertEq(controller.getCurrentSupply(), 250000);

        vm.prank(controller_addr);
        controller.burn(150000);
        assertEq(controller.getCurrentSupply(), 100000);
    }

    function test_CompleteMetricsTrack() public {
        vm.prank(controller_addr);
        controller.mint(100000);

        vm.prank(controller_addr);
        controller.burn(30000);

        vm.prank(manager);
        controller.recordTransfer(controller_addr, user, 40000);

        assertEq(controller.getMetricsCount(), 3);
        assertEq(controller.getTotalMinted(), 100000);
        assertEq(controller.getTotalBurned(), 30000);
    }
}
