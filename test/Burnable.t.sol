// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/Burnable.sol";

contract BurnableTest is Test {
    Burnable token;
    address owner = address(0x1);
    address burner = address(0x2);
    address user = address(0x3);
    address other = address(0x4);

    uint256 constant INITIAL_SUPPLY = 10000e18;

    function setUp() public {
        vm.startPrank(owner);
        token = new Burnable("Test Token", "TST", INITIAL_SUPPLY);
        vm.stopPrank();
    }

    // ============ Basic Burn Tests ============

    function test_burn_successfulBurnOwnTokens() public {
        uint256 burnAmount = 100e18;
        uint256 initialBalance = token.balanceOf(owner);

        vm.prank(owner);
        token.burn(burnAmount);

        assertEq(token.balanceOf(owner), initialBalance - burnAmount);
        assertEq(token.totalBurned(), burnAmount);
    }

    function test_burn_emitsTokensBurnedEvent() public {
        uint256 burnAmount = 100e18;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Burnable.TokensBurned(owner, burnAmount);
        token.burn(burnAmount);
    }

    function test_burn_zeroAmountReverts() public {
        vm.prank(owner);
        vm.expectRevert("Burnable: amount must be greater than 0");
        token.burn(0);
    }

    function test_burn_insufficientBalanceReverts() public {
        uint256 balance = token.balanceOf(owner);

        vm.prank(owner);
        vm.expectRevert("Burnable: insufficient balance");
        token.burn(balance + 1);
    }

    function test_burn_multipleBurns() public {
        uint256 burnAmount1 = 100e18;
        uint256 burnAmount2 = 200e18;

        vm.prank(owner);
        token.burn(burnAmount1);
        assertEq(token.totalBurned(), burnAmount1);

        vm.prank(owner);
        token.burn(burnAmount2);
        assertEq(token.totalBurned(), burnAmount1 + burnAmount2);
    }

    // ============ BurnFrom Tests ============

    function test_burnFrom_successfulWithAllowance() public {
        uint256 burnAmount = 100e18;
        uint256 initialBalance = token.balanceOf(owner);

        vm.prank(owner);
        token.approve(user, burnAmount);

        vm.prank(user);
        token.burnFrom(owner, burnAmount);

        assertEq(token.balanceOf(owner), initialBalance - burnAmount);
        assertEq(token.totalBurned(), burnAmount);
    }

    function test_burnFrom_emitsTokensBurnedEvent() public {
        uint256 burnAmount = 100e18;

        vm.prank(owner);
        token.approve(user, burnAmount);

        vm.prank(user);
        vm.expectEmit(true, false, false, true);
        emit Burnable.TokensBurned(owner, burnAmount);
        token.burnFrom(owner, burnAmount);
    }

    function test_burnFrom_insufficientAllowanceReverts() public {
        uint256 burnAmount = 100e18;

        vm.prank(owner);
        token.approve(user, burnAmount - 1);

        vm.prank(user);
        vm.expectRevert("Burnable: insufficient allowance");
        token.burnFrom(owner, burnAmount);
    }

    function test_burnFrom_insufficientBalanceReverts() public {
        uint256 balance = token.balanceOf(owner);

        vm.prank(owner);
        token.approve(user, balance + 1);

        vm.prank(user);
        vm.expectRevert("Burnable: insufficient balance");
        token.burnFrom(owner, balance + 1);
    }

    function test_burnFrom_zeroAmountReverts() public {
        vm.prank(owner);
        token.approve(user, 100e18);

        vm.prank(user);
        vm.expectRevert("Burnable: amount must be greater than 0");
        token.burnFrom(owner, 0);
    }

    function test_burnFrom_zeroAddressReverts() public {
        uint256 burnAmount = 100e18;

        vm.prank(user);
        vm.expectRevert("Burnable: burn from zero address");
        token.burnFrom(address(0), burnAmount);
    }

    function test_burnFrom_decreasesAllowance() public {
        uint256 initialAllowance = 500e18;
        uint256 burnAmount = 100e18;

        vm.prank(owner);
        token.approve(user, initialAllowance);

        vm.prank(user);
        token.burnFrom(owner, burnAmount);

        assertEq(
            token.allowance(owner, user),
            initialAllowance - burnAmount
        );
    }

    // ============ Batch Burn Tests ============

    function test_batchBurn_successfulBatchOperation() public {
        address[] memory accounts = new address[](2);
        accounts[0] = owner;
        accounts[1] = user;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e18;
        amounts[1] = 50e18;

        // Transfer tokens to user
        vm.prank(owner);
        token.transfer(user, amounts[1]);

        vm.prank(owner);
        token.batchBurn(accounts, amounts);

        assertEq(
            token.balanceOf(owner),
            INITIAL_SUPPLY - amounts[0] - amounts[1]
        );
        assertEq(token.balanceOf(user), 0);
        assertEq(token.totalBurned(), amounts[0] + amounts[1]);
    }

    function test_batchBurn_emitsBatchBurnEvent() public {
        address[] memory accounts = new address[](1);
        accounts[0] = owner;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Burnable.BatchBurn(owner, 100e18);
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_emitsTokensBurnedForEach() public {
        address[] memory accounts = new address[](2);
        accounts[0] = owner;
        accounts[1] = user;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e18;
        amounts[1] = 50e18;

        vm.prank(owner);
        token.transfer(user, amounts[1]);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Burnable.TokensBurned(owner, amounts[0]);
        vm.expectEmit(true, false, false, true);
        emit Burnable.TokensBurned(user, amounts[1]);
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_requiresBurnerRole() public {
        address[] memory accounts = new address[](1);
        accounts[0] = owner;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(user);
        vm.expectRevert();
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_lengthMismatchReverts() public {
        address[] memory accounts = new address[](2);
        accounts[0] = owner;
        accounts[1] = user;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(owner);
        vm.expectRevert("Burnable: accounts and amounts length mismatch");
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_emptyBatchReverts() public {
        address[] memory accounts = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.prank(owner);
        vm.expectRevert("Burnable: empty batch");
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_zeroAmountReverts() public {
        address[] memory accounts = new address[](1);
        accounts[0] = owner;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 0;

        vm.prank(owner);
        vm.expectRevert("Burnable: amount must be greater than 0");
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_insufficientBalanceReverts() public {
        address[] memory accounts = new address[](1);
        accounts[0] = user;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(owner);
        vm.expectRevert("Burnable: insufficient balance");
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_zeroAddressReverts() public {
        address[] memory accounts = new address[](1);
        accounts[0] = address(0);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(owner);
        vm.expectRevert("Burnable: burn from zero address");
        token.batchBurn(accounts, amounts);
    }

    function test_batchBurn_largeMultipleAccounts() public {
        uint256 numAccounts = 10;
        address[] memory accounts = new address[](numAccounts);
        uint256[] memory amounts = new uint256[](numAccounts);
        uint256 totalToGrant = 0;

        for (uint256 i = 0; i < numAccounts; ++i) {
            accounts[i] = address(uint160(uint256(keccak256(abi.encodePacked(i)))));
            amounts[i] = 50e18;
            totalToGrant += amounts[i];
        }

        // Grant tokens to accounts
        for (uint256 i = 0; i < numAccounts; ++i) {
            if (i == 0) {
                continue;
            }
            vm.prank(owner);
            token.transfer(accounts[i], amounts[i]);
        }

        vm.prank(owner);
        token.batchBurn(accounts, amounts);

        assertEq(token.totalBurned(), totalToGrant);
    }

    // ============ Permission Tests ============

    function test_permissions_onlyBurnerCanBatchBurn() public {
        address[] memory accounts = new address[](1);
        accounts[0] = owner;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        // Owner has burner role by default
        vm.prank(owner);
        token.batchBurn(accounts, amounts);

        // Grant burner role to another address
        vm.prank(owner);
        token.grantRole(token.BURNER_ROLE(), burner);

        // Burner can now burn
        accounts[0] = owner;
        vm.prank(owner);
        token.transfer(burner, 100e18);

        vm.prank(burner);
        accounts[0] = burner;
        token.batchBurn(accounts, amounts);

        // User without role cannot burn
        vm.prank(user);
        accounts[0] = owner;
        vm.expectRevert();
        token.batchBurn(accounts, amounts);
    }

    function test_permissions_adminCanGrantRoles() public {
        require(
            token.hasRole(token.DEFAULT_ADMIN_ROLE(), owner),
            "Owner should be admin"
        );

        vm.prank(owner);
        token.grantRole(token.BURNER_ROLE(), burner);

        assertTrue(token.hasRole(token.BURNER_ROLE(), burner));
    }

    // ============ Query Tests ============

    function test_totalBurned_tracksAccurately() public {
        assertEq(token.totalBurned(), 0);

        uint256 burnAmount1 = 100e18;
        vm.prank(owner);
        token.burn(burnAmount1);
        assertEq(token.totalBurned(), burnAmount1);

        uint256 burnAmount2 = 200e18;
        vm.prank(owner);
        token.approve(user, burnAmount2);

        vm.prank(user);
        token.burnFrom(owner, burnAmount2);
        assertEq(token.totalBurned(), burnAmount1 + burnAmount2);
    }

    function test_totalBurned_withBatchBurn() public {
        address[] memory accounts = new address[](2);
        accounts[0] = owner;
        accounts[1] = user;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100e18;
        amounts[1] = 200e18;

        vm.prank(owner);
        token.transfer(user, amounts[1]);

        uint256 expectedBurned = amounts[0] + amounts[1];

        vm.prank(owner);
        token.batchBurn(accounts, amounts);

        assertEq(token.totalBurned(), expectedBurned);
    }

    function test_circulatingSupply() public {
        uint256 initialSupply = token.totalSupply() + token.totalBurned();
        assertEq(token.circulatingSupply(), initialSupply);

        vm.prank(owner);
        token.burn(100e18);

        assertEq(token.circulatingSupply(), initialSupply);
    }

    // ============ Edge Cases ============

    function test_edgeCase_burnEntireBalance() public {
        uint256 balance = token.balanceOf(owner);

        vm.prank(owner);
        token.burn(balance);

        assertEq(token.balanceOf(owner), 0);
        assertEq(token.totalBurned(), balance);
    }

    function test_edgeCase_multipleBurnerRoles() public {
        address[] memory accounts = new address[](1);
        accounts[0] = owner;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(owner);
        token.grantRole(token.BURNER_ROLE(), burner);

        vm.prank(owner);
        token.grantRole(token.BURNER_ROLE(), other);

        // Both burners can burn
        vm.prank(burner);
        token.batchBurn(accounts, amounts);

        vm.prank(owner);
        token.transfer(other, amounts[0]);

        vm.prank(other);
        accounts[0] = other;
        token.batchBurn(accounts, amounts);

        assertEq(token.totalBurned(), amounts[0] * 2);
    }

    function test_edgeCase_burnFromMaxAllowance() public {
        uint256 maxUint = type(uint256).max;
        uint256 burnAmount = 100e18;

        vm.prank(owner);
        token.approve(user, maxUint);

        vm.prank(user);
        token.burnFrom(owner, burnAmount);

        // Allowance should decrease correctly
        assertEq(token.allowance(owner, user), maxUint - burnAmount);
    }

    function test_edgeCase_consecutiveBurns() public {
        uint256 burnAmount = 1e18;
        uint256 initialBalance = token.balanceOf(owner);

        for (uint256 i = 0; i < 100; ++i) {
            vm.prank(owner);
            token.burn(burnAmount);
        }

        assertEq(token.balanceOf(owner), initialBalance - (burnAmount * 100));
        assertEq(token.totalBurned(), burnAmount * 100);
    }

    function test_roleManagement_grantAndRevoke() public {
        assertFalse(token.hasRole(token.BURNER_ROLE(), user));

        vm.prank(owner);
        token.grantRole(token.BURNER_ROLE(), user);
        assertTrue(token.hasRole(token.BURNER_ROLE(), user));

        address[] memory accounts = new address[](1);
        accounts[0] = owner;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100e18;

        vm.prank(user);
        token.batchBurn(accounts, amounts);

        vm.prank(owner);
        token.revokeRole(token.BURNER_ROLE(), user);
        assertFalse(token.hasRole(token.BURNER_ROLE(), user));

        vm.prank(user);
        vm.expectRevert();
        token.batchBurn(accounts, amounts);
    }
}
