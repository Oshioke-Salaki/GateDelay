// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SupplyController.sol";

/// @title SupplyControllerFuzz
/// @notice Fuzz tests for supply controller limits and state transitions
/// @dev Tests #958: Fuzz supply limits, caps, pause states, and edge inputs under varied call sequences
contract SupplyControllerFuzz is Test {
    SupplyController public controller;
    address public admin;
    address public controller_addr;
    address public manager;

    function setUp() public {
        admin = address(0x1);
        controller_addr = address(0x2);
        manager = address(0x3);

        controller = new SupplyController();

        controller.grantRole(controller.ADMIN_ROLE(), admin);
        controller.grantRole(controller.CONTROLLER_ROLE(), controller_addr);
        controller.grantRole(controller.MANAGER_ROLE(), manager);
    }

    /// @notice Fuzz test: Mint operations with varied amounts
    function testFuzz_MintOperations(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(controller_addr);
        bool success = controller.mint(amount);
        
        assertTrue(success, "Mint should succeed");
        assertEq(controller.getCurrentSupply(), amount, "Supply should match minted amount");
        assertEq(controller.getTotalMinted(), amount, "Total minted should match");
    }

    /// @notice Fuzz test: Burn operations with varied amounts
    function testFuzz_BurnOperations(uint256 mintAmount, uint256 burnAmount) public {
        mintAmount = bound(mintAmount, 1, type(uint128).max);
        burnAmount = bound(burnAmount, 1, mintAmount);

        // Mint first
        vm.prank(controller_addr);
        controller.mint(mintAmount);

        // Burn
        vm.prank(controller_addr);
        bool success = controller.burn(burnAmount);
        
        assertTrue(success, "Burn should succeed");
        assertEq(controller.getCurrentSupply(), mintAmount - burnAmount, "Supply should be reduced");
        assertEq(controller.getTotalBurned(), burnAmount, "Total burned should match");
    }

    /// @notice Fuzz test: Supply cap enforcement
    function testFuzz_SupplyCapEnforcement(
        uint256 cap,
        uint256 mintAmount
    ) public {
        cap = bound(cap, 1, type(uint128).max);
        mintAmount = bound(mintAmount, 1, type(uint128).max);

        // Set cap and enable limits
        vm.prank(admin);
        controller.setSupplyCap(cap);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        if (mintAmount <= cap) {
            controller.mint(mintAmount);
            assertEq(controller.getCurrentSupply(), mintAmount, "Supply should match");
        } else {
            vm.expectRevert("Mint exceeds supply cap");
            controller.mint(mintAmount);
        }
    }

    /// @notice Fuzz test: Supply floor enforcement
    function testFuzz_SupplyFloorEnforcement(
        uint256 initialMint,
        uint256 floor,
        uint256 burnAmount
    ) public {
        initialMint = bound(initialMint, 1e18, type(uint128).max);
        floor = bound(floor, 0, initialMint);
        burnAmount = bound(burnAmount, 1, initialMint);

        // Mint initial supply
        vm.prank(controller_addr);
        controller.mint(initialMint);

        // Set floor and enable limits
        vm.prank(admin);
        controller.setSupplyFloor(floor);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        if (initialMint - burnAmount >= floor) {
            controller.burn(burnAmount);
            assertEq(controller.getCurrentSupply(), initialMint - burnAmount);
        } else {
            vm.expectRevert("Burn would breach supply floor");
            controller.burn(burnAmount);
        }
    }

    /// @notice Fuzz test: Per-transaction mint limits
    function testFuzz_MaxMintPerTx(
        uint256 maxPerTx,
        uint256 attemptAmount
    ) public {
        maxPerTx = bound(maxPerTx, 1, type(uint128).max);
        attemptAmount = bound(attemptAmount, 1, type(uint128).max);

        vm.prank(admin);
        controller.setMaxMintPerTx(maxPerTx);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        if (attemptAmount <= maxPerTx) {
            controller.mint(attemptAmount);
            assertEq(controller.getCurrentSupply(), attemptAmount);
        } else {
            vm.expectRevert("Mint exceeds per-transaction limit");
            controller.mint(attemptAmount);
        }
    }

    /// @notice Fuzz test: Per-transaction burn limits
    function testFuzz_MaxBurnPerTx(
        uint256 initialSupply,
        uint256 maxPerTx,
        uint256 attemptAmount
    ) public {
        initialSupply = bound(initialSupply, 1e18, type(uint128).max);
        maxPerTx = bound(maxPerTx, 1, type(uint64).max);
        attemptAmount = bound(attemptAmount, 1, initialSupply);

        // Mint initial supply
        vm.prank(controller_addr);
        controller.mint(initialSupply);

        vm.prank(admin);
        controller.setMaxBurnPerTx(maxPerTx);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        if (attemptAmount <= maxPerTx) {
            controller.burn(attemptAmount);
            assertEq(controller.getCurrentSupply(), initialSupply - attemptAmount);
        } else {
            vm.expectRevert("Burn exceeds per-transaction limit");
            controller.burn(attemptAmount);
        }
    }

    /// @notice Fuzz test: Mint and burn sequence
    function testFuzz_MintBurnSequence(
        uint256[5] memory mints,
        uint256[5] memory burns
    ) public {
        uint256 expectedSupply = 0;

        for (uint256 i = 0; i < 5; i++) {
            mints[i] = bound(mints[i], 1, 1e24);
            burns[i] = bound(burns[i], 0, expectedSupply + mints[i]);

            // Mint
            vm.prank(controller_addr);
            controller.mint(mints[i]);
            expectedSupply += mints[i];

            // Burn if possible
            if (burns[i] > 0 && burns[i] <= expectedSupply) {
                vm.prank(controller_addr);
                controller.burn(burns[i]);
                expectedSupply -= burns[i];
            }
        }

        assertEq(controller.getCurrentSupply(), expectedSupply, "Final supply should match");
    }

    /// @notice Fuzz test: Supply limits with cap and floor
    function testFuzz_CapAndFloorLimits(
        uint256 floor,
        uint256 cap,
        uint256 mintAmount
    ) public {
        floor = bound(floor, 0, type(uint64).max);
        cap = bound(cap, floor + 1, type(uint128).max);
        mintAmount = bound(mintAmount, 1, type(uint128).max);

        vm.prank(admin);
        controller.setSupplyFloor(floor);
        vm.prank(admin);
        controller.setSupplyCap(cap);
        vm.prank(admin);
        controller.toggleLimits(true);

        vm.prank(controller_addr);
        if (mintAmount <= cap) {
            controller.mint(mintAmount);
            assertEq(controller.getCurrentSupply(), mintAmount);
            assertGe(controller.getCurrentSupply(), floor);
            assertLe(controller.getCurrentSupply(), cap);
        } else {
            vm.expectRevert("Mint exceeds supply cap");
            controller.mint(mintAmount);
        }
    }

    /// @notice Fuzz test: Limits toggle behavior
    function testFuzz_LimitsToggle(
        uint256 cap,
        uint256 amount,
        bool limitsEnabled
    ) public {
        cap = bound(cap, 1, type(uint64).max);
        amount = bound(amount, cap + 1, type(uint128).max); // Exceeds cap

        vm.prank(admin);
        controller.setSupplyCap(cap);
        vm.prank(admin);
        controller.toggleLimits(limitsEnabled);

        vm.prank(controller_addr);
        if (limitsEnabled) {
            vm.expectRevert("Mint exceeds supply cap");
            controller.mint(amount);
        } else {
            controller.mint(amount);
            assertEq(controller.getCurrentSupply(), amount);
        }
    }

    /// @notice Fuzz test: Supply utilization calculation
    function testFuzz_SupplyUtilization(
        uint256 cap,
        uint256 supply
    ) public {
        cap = bound(cap, 1e18, type(uint128).max);
        supply = bound(supply, 0, cap);

        vm.prank(admin);
        controller.setSupplyCap(cap);

        if (supply > 0) {
            vm.prank(controller_addr);
            controller.mint(supply);
        }

        uint256 utilization = controller.getSupplyUtilization();
        assertLe(utilization, 100, "Utilization should be <= 100%");
        
        if (supply > 0) {
            assertGt(utilization, 0, "Utilization should be > 0 with supply");
        }
    }

    /// @notice Fuzz test: Remaining mint capacity
    function testFuzz_RemainingMintCapacity(
        uint256 cap,
        uint256 minted
    ) public {
        cap = bound(cap, 1e18, type(uint128).max);
        minted = bound(minted, 0, cap);

        vm.prank(admin);
        controller.setSupplyCap(cap);

        if (minted > 0) {
            vm.prank(controller_addr);
            controller.mint(minted);
        }

        uint256 remaining = controller.getRemainingMintCapacity();
        assertEq(remaining, cap - minted, "Remaining capacity should be cap - minted");
    }

    /// @notice Fuzz test: Available burn capacity
    function testFuzz_AvailableBurnCapacity(
        uint256 supply,
        uint256 floor
    ) public {
        supply = bound(supply, 1e18, type(uint128).max);
        floor = bound(floor, 0, supply);

        vm.prank(controller_addr);
        controller.mint(supply);

        vm.prank(admin);
        controller.setSupplyFloor(floor);

        uint256 available = controller.getAvailableBurnCapacity();
        assertEq(available, supply - floor, "Available burn should be supply - floor");
    }

    /// @notice Fuzz test: Transfer recording
    function testFuzz_RecordTransfer(
        address from,
        address to,
        uint256 amount
    ) public {
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(manager);
        bool success = controller.recordTransfer(from, to, amount);
        
        assertTrue(success, "Transfer recording should succeed");
        assertGt(controller.getMetricsCount(), 0, "Metrics should be recorded");
    }
}
