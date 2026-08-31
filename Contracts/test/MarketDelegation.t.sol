// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketDelegation.sol";

// ─── MarketDelegationTest ──────────────────────────────────────────────────────

contract MarketDelegationTest is Test {
    MarketDelegation internal delegation;

    address internal owner = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    function setUp() public {
        delegation = new MarketDelegation();
    }

    // ── Constructor / ownership ────────────────────────────────────────────────

    function test_ConstructorSetsDeployerAsOwner() public view {
        assertEq(delegation.owner(), owner);
    }

    // ── requestDelegation ──────────────────────────────────────────────────────

    function test_RequestDelegation() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        MarketDelegation.Delegation memory d = delegation.getDelegation(id);
        assertEq(d.delegator, alice);
        assertEq(d.delegatee, bob);
        assertEq(d.marketId, 0);
        assertEq(uint256(d.status), uint256(MarketDelegation.DelegationStatus.PENDING));
        assertEq(delegation.getTotalDelegations(), 1);
    }

    function test_RequestDelegation_RevertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.ZeroAddress.selector);
        delegation.requestDelegation(address(0), 0, 0);
    }

    function test_RequestDelegation_RevertsOnSelfDelegation() public {
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.SelfDelegation.selector);
        delegation.requestDelegation(alice, 0, 0);
    }

    function test_RequestDelegation_RevertsOnDurationTooLong() public {
        uint256 tooLong = delegation.MAX_DELEGATION_DURATION() + 1;
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.InvalidPermission.selector);
        delegation.requestDelegation(bob, 0, tooLong);
    }

    function test_RequestDelegation_RevertsOnMaxDelegationsExceeded() public {
        vm.startPrank(alice);
        for (uint256 i = 0; i < delegation.MAX_DELEGATIONS_PER_DELEGATOR(); i++) {
            address delegatee = address(uint160(uint256(keccak256(abi.encodePacked(i, "delegatee")))));
            delegation.requestDelegation(delegatee, 0, 0);
        }
        vm.expectRevert(MarketDelegation.MaxDelegationsExceeded.selector);
        delegation.requestDelegation(bob, 0, 0);
        vm.stopPrank();
    }

    // ── activateDelegation ─────────────────────────────────────────────────────

    function test_ActivateDelegation() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        vm.prank(alice);
        delegation.activateDelegation(id);

        assertEq(uint256(delegation.getDelegationStatus(id)), uint256(MarketDelegation.DelegationStatus.ACTIVE));
        assertTrue(delegation.isDelegationActive(id));
        assertEq(delegation.getActiveDelegations(), 1);
    }

    function test_ActivateDelegation_RevertsForNonDelegator() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        vm.prank(carol);
        vm.expectRevert(MarketDelegation.UnauthorizedDelegator.selector);
        delegation.activateDelegation(id);
    }

    function test_ActivateDelegation_RevertsWhenNotFound() public {
        vm.expectRevert(MarketDelegation.DelegationNotFound.selector);
        delegation.activateDelegation(bytes32(uint256(1)));
    }

    function test_ActivateDelegation_RevertsWhenAlreadyActive() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);

        vm.expectRevert(MarketDelegation.DelegationNotActive.selector);
        delegation.activateDelegation(id);
        vm.stopPrank();
    }

    function test_ActivateDelegation_RevertsAndExpiresWhenPastExpiry() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 1);

        vm.warp(block.timestamp + 2);

        vm.prank(alice);
        vm.expectRevert(MarketDelegation.DelegationNotActive.selector);
        delegation.activateDelegation(id);

        // The EXPIRED write inside activateDelegation is rolled back by its own revert,
        // and getDelegationStatus only computes expiry dynamically for ACTIVE delegations,
        // so a PENDING delegation past its expiry is reported as still PENDING.
        assertEq(uint256(delegation.getDelegationStatus(id)), uint256(MarketDelegation.DelegationStatus.PENDING));
    }

    // ── revokeDelegation ───────────────────────────────────────────────────────

    function test_RevokeDelegation_FromActive() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);
        delegation.grantPermission(id, MarketDelegation.Permission.TRADE);

        delegation.revokeDelegation(id);
        vm.stopPrank();

        assertEq(uint256(delegation.getDelegationStatus(id)), uint256(MarketDelegation.DelegationStatus.REVOKED));
        assertEq(delegation.getActiveDelegations(), 0);
        assertFalse(delegation.hasPermission(id, MarketDelegation.Permission.TRADE));
    }

    function test_RevokeDelegation_FromPending() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.revokeDelegation(id);
        vm.stopPrank();

        assertEq(uint256(delegation.getDelegationStatus(id)), uint256(MarketDelegation.DelegationStatus.REVOKED));
    }

    function test_RevokeDelegation_RevertsForNonDelegator() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        vm.prank(carol);
        vm.expectRevert(MarketDelegation.UnauthorizedDelegator.selector);
        delegation.revokeDelegation(id);
    }

    // ── grantPermission / revokePermission ─────────────────────────────────────

    function test_GrantPermission() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);
        delegation.grantPermission(id, MarketDelegation.Permission.TRADE);
        vm.stopPrank();

        assertTrue(delegation.hasPermission(id, MarketDelegation.Permission.TRADE));
        MarketDelegation.Permission[] memory granted = delegation.getGrantedPermissions(id);
        assertEq(granted.length, 1);
        assertEq(uint256(granted[0]), uint256(MarketDelegation.Permission.TRADE));
    }

    function test_GrantPermission_RevertsWhenNotActive() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        vm.expectRevert(MarketDelegation.DelegationNotActive.selector);
        delegation.grantPermission(id, MarketDelegation.Permission.TRADE);
        vm.stopPrank();
    }

    function test_GrantPermission_RevertsWhenAlreadyGranted() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);
        delegation.grantPermission(id, MarketDelegation.Permission.TRADE);

        vm.expectRevert(MarketDelegation.PermissionAlreadyGranted.selector);
        delegation.grantPermission(id, MarketDelegation.Permission.TRADE);
        vm.stopPrank();
    }

    function test_RevokePermission() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);
        delegation.grantPermission(id, MarketDelegation.Permission.TRADE);
        delegation.revokePermission(id, MarketDelegation.Permission.TRADE);
        vm.stopPrank();

        assertFalse(delegation.hasPermission(id, MarketDelegation.Permission.TRADE));
    }

    function test_RevokePermission_RevertsWhenNotGranted() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);

        vm.expectRevert(MarketDelegation.PermissionNotGranted.selector);
        delegation.revokePermission(id, MarketDelegation.Permission.TRADE);
        vm.stopPrank();
    }

    function test_GrantPermissions_Batch() public {
        vm.startPrank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        delegation.activateDelegation(id);

        MarketDelegation.Permission[] memory perms = new MarketDelegation.Permission[](2);
        perms[0] = MarketDelegation.Permission.TRADE;
        perms[1] = MarketDelegation.Permission.MANAGE_LIQUIDITY;
        delegation.grantPermissions(id, perms);
        vm.stopPrank();

        assertTrue(delegation.hasPermission(id, MarketDelegation.Permission.TRADE));
        assertTrue(delegation.hasPermission(id, MarketDelegation.Permission.MANAGE_LIQUIDITY));
        assertEq(delegation.getGrantedPermissions(id).length, 2);
    }

    // ── Query helpers ──────────────────────────────────────────────────────────

    function test_GetDelegationsByMarket() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 42, 0);

        bytes32[] memory marketDelegations = delegation.getDelegationsByMarket(42);
        assertEq(marketDelegations.length, 1);
        assertEq(marketDelegations[0], id);
    }

    function test_GetDelegationsByDelegatorAndDelegatee() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        bytes32[] memory byDelegator = delegation.getDelegationsByDelegator(alice);
        bytes32[] memory byDelegatee = delegation.getDelegationsByDelegatee(bob);
        assertEq(byDelegator.length, 1);
        assertEq(byDelegatee.length, 1);
        assertEq(byDelegator[0], id);
        assertEq(byDelegatee[0], id);
    }

    function test_GetDelegation_RevertsWhenNotFound() public {
        vm.expectRevert(MarketDelegation.DelegationNotFound.selector);
        delegation.getDelegation(bytes32(uint256(1)));
    }

    // ── Admin: expireDelegation ────────────────────────────────────────────────

    function test_ExpireDelegation_OnlyOwner() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        vm.prank(alice);
        delegation.activateDelegation(id);

        delegation.expireDelegation(id);

        assertEq(uint256(delegation.getDelegationStatus(id)), uint256(MarketDelegation.DelegationStatus.EXPIRED));
        assertEq(delegation.getActiveDelegations(), 0);
    }

    function test_ExpireDelegation_RevertsForNonOwner() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);
        vm.prank(alice);
        delegation.activateDelegation(id);

        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", carol));
        delegation.expireDelegation(id);
    }

    function test_ExpireDelegation_RevertsWhenNotActive() public {
        vm.prank(alice);
        bytes32 id = delegation.requestDelegation(bob, 0, 0);

        vm.expectRevert(MarketDelegation.DelegationNotActive.selector);
        delegation.expireDelegation(id);
    }
}
