// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../Contracts/contracts/MarketDelegation.sol";

contract MarketDelegationTest is Test {
    MarketDelegation public delegation;

    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public charlie = address(0x4);

    uint256 public constant MARKET_ID_1 = 1;
    uint256 public constant MARKET_ID_2 = 2;
    uint256 public constant GLOBAL_MARKET = 0;

    event DelegationRequested(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 marketId,
        uint256 timestamp
    );

    event DelegationActivated(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );

    event DelegationRevoked(
        bytes32 indexed delegationId,
        address indexed delegator,
        address indexed delegatee,
        uint256 timestamp
    );

    event PermissionGranted(
        bytes32 indexed delegationId,
        address indexed delegatee,
        MarketDelegation.Permission indexed permission,
        uint256 timestamp
    );

    event PermissionRevoked(
        bytes32 indexed delegationId,
        address indexed delegatee,
        MarketDelegation.Permission indexed permission,
        uint256 timestamp
    );

    function setUp() public {
        vm.prank(owner);
        delegation = new MarketDelegation();
    }

    // ── Delegation Request Tests ──────────────────────────────────────────────

    function test_requestDelegation_success() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        assertTrue(delegationId != bytes32(0), "Delegation ID should not be zero");

        MarketDelegation.Delegation memory del = delegation.getDelegation(delegationId);
        assertEq(del.delegator, alice, "Delegator should be alice");
        assertEq(del.delegatee, bob, "Delegatee should be bob");
        assertEq(del.marketId, MARKET_ID_1, "Market ID should match");
        assertEq(uint256(del.status), uint256(MarketDelegation.DelegationStatus.PENDING), "Status should be PENDING");
    }

    function test_requestDelegation_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(false, true, true, false);
        emit DelegationRequested(bytes32(0), alice, bob, MARKET_ID_1, block.timestamp);
        delegation.requestDelegation(bob, MARKET_ID_1, 0);
    }

    function test_requestDelegation_globalMarket() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, GLOBAL_MARKET, 0);

        MarketDelegation.Delegation memory del = delegation.getDelegation(delegationId);
        assertEq(del.marketId, GLOBAL_MARKET, "Should be global market");
    }

    function test_requestDelegation_withDuration() public {
        uint256 duration = 7 days;
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, duration);

        MarketDelegation.Delegation memory del = delegation.getDelegation(delegationId);
        assertEq(del.expiresAt, block.timestamp + duration, "Expiration should be set");
    }

    function test_requestDelegation_revertsOnZeroAddress() public {
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.ZeroAddress.selector);
        delegation.requestDelegation(address(0), MARKET_ID_1, 0);
    }

    function test_requestDelegation_revertsOnSelfDelegation() public {
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.SelfDelegation.selector);
        delegation.requestDelegation(alice, MARKET_ID_1, 0);
    }

    function test_requestDelegation_revertsOnExcessiveDuration() public {
        uint256 excessiveDuration = 366 days;
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.InvalidPermission.selector);
        delegation.requestDelegation(bob, MARKET_ID_1, excessiveDuration);
    }

    // ── Delegation Activation Tests ───────────────────────────────────────────

    function test_activateDelegation_success() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        MarketDelegation.DelegationStatus status = delegation.getDelegationStatus(delegationId);
        assertEq(uint256(status), uint256(MarketDelegation.DelegationStatus.ACTIVE), "Status should be ACTIVE");
    }

    function test_activateDelegation_emitsEvent() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit DelegationActivated(delegationId, alice, bob, block.timestamp);
        delegation.activateDelegation(delegationId);
    }

    function test_activateDelegation_incrementsActiveCount() public {
        uint256 initialActive = delegation.getActiveDelegations();

        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        assertEq(delegation.getActiveDelegations(), initialActive + 1, "Active count should increment");
    }

    function test_activateDelegation_revertsOnNonExistent() public {
        bytes32 fakeDelegationId = keccak256("fake");
        
        vm.prank(alice);
        vm.expectRevert(MarketDelegation.DelegationNotFound.selector);
        delegation.activateDelegation(fakeDelegationId);
    }

    function test_activateDelegation_revertsOnUnauthorized() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(bob);
        vm.expectRevert(MarketDelegation.UnauthorizedDelegator.selector);
        delegation.activateDelegation(delegationId);
    }

    function test_activateDelegation_revertsOnAlreadyActive() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        vm.expectRevert(MarketDelegation.DelegationNotActive.selector);
        delegation.activateDelegation(delegationId);
    }

    // ── Delegation Revocation Tests ───────────────────────────────────────────

    function test_revokeDelegation_success() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.revokeDelegation(delegationId);

        MarketDelegation.DelegationStatus status = delegation.getDelegationStatus(delegationId);
        assertEq(uint256(status), uint256(MarketDelegation.DelegationStatus.REVOKED), "Status should be REVOKED");
    }

    function test_revokeDelegation_emitsEvent() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit DelegationRevoked(delegationId, alice, bob, block.timestamp);
        delegation.revokeDelegation(delegationId);
    }

    function test_revokeDelegation_decrementsActiveCount() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        uint256 activeBeforeRevoke = delegation.getActiveDelegations();

        vm.prank(alice);
        delegation.revokeDelegation(delegationId);

        assertEq(delegation.getActiveDelegations(), activeBeforeRevoke - 1, "Active count should decrement");
    }

    function test_revokeDelegation_revertsOnUnauthorized() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(bob);
        vm.expectRevert(MarketDelegation.UnauthorizedDelegator.selector);
        delegation.revokeDelegation(delegationId);
    }

    function test_revokeDelegation_canRevokePending() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.revokeDelegation(delegationId);

        MarketDelegation.DelegationStatus status = delegation.getDelegationStatus(delegationId);
        assertEq(uint256(status), uint256(MarketDelegation.DelegationStatus.REVOKED), "Should revoke pending");
    }

    // ── Permission Management Tests ───────────────────────────────────────────

    function test_grantPermission_success() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        bool hasPerm = delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE);
        assertTrue(hasPerm, "Should have TRADE permission");
    }

    function test_grantPermission_emitsEvent() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit PermissionGranted(delegationId, bob, MarketDelegation.Permission.TRADE, block.timestamp);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);
    }

    function test_grantPermission_multiplePermissions() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.CREATE_MARKET);

        assertTrue(delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE));
        assertTrue(delegation.hasPermission(delegationId, MarketDelegation.Permission.CREATE_MARKET));
    }

    function test_grantPermission_revertsOnInactive() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        vm.expectRevert(MarketDelegation.DelegationNotActive.selector);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);
    }

    function test_grantPermission_revertsOnDuplicate() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        vm.prank(alice);
        vm.expectRevert(MarketDelegation.PermissionAlreadyGranted.selector);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);
    }

    function test_revokePermission_success() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        vm.prank(alice);
        delegation.revokePermission(delegationId, MarketDelegation.Permission.TRADE);

        bool hasPerm = delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE);
        assertFalse(hasPerm, "Should not have TRADE permission");
    }

    function test_revokePermission_emitsEvent() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit PermissionRevoked(delegationId, bob, MarketDelegation.Permission.TRADE, block.timestamp);
        delegation.revokePermission(delegationId, MarketDelegation.Permission.TRADE);
    }

    function test_revokePermission_revertsOnNotGranted() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        vm.expectRevert(MarketDelegation.PermissionNotGranted.selector);
        delegation.revokePermission(delegationId, MarketDelegation.Permission.TRADE);
    }

    function test_grantPermissions_batch() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        MarketDelegation.Permission[] memory perms = new MarketDelegation.Permission[](3);
        perms[0] = MarketDelegation.Permission.TRADE;
        perms[1] = MarketDelegation.Permission.CREATE_MARKET;
        perms[2] = MarketDelegation.Permission.MANAGE_LIQUIDITY;

        vm.prank(alice);
        delegation.grantPermissions(delegationId, perms);

        assertTrue(delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE));
        assertTrue(delegation.hasPermission(delegationId, MarketDelegation.Permission.CREATE_MARKET));
        assertTrue(delegation.hasPermission(delegationId, MarketDelegation.Permission.MANAGE_LIQUIDITY));
    }

    // ── Query Function Tests ──────────────────────────────────────────────────

    function test_getDelegation_returnsCorrectData() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        MarketDelegation.Delegation memory del = delegation.getDelegation(delegationId);
        
        assertEq(del.delegator, alice);
        assertEq(del.delegatee, bob);
        assertEq(del.marketId, MARKET_ID_1);
        assertEq(uint256(del.status), uint256(MarketDelegation.DelegationStatus.PENDING));
    }

    function test_isDelegationActive_returnsTrueForActive() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        assertTrue(delegation.isDelegationActive(delegationId));
    }

    function test_isDelegationActive_returnsFalseForPending() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        assertFalse(delegation.isDelegationActive(delegationId));
    }

    function test_isDelegationActive_returnsFalseForRevoked() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.revokeDelegation(delegationId);

        assertFalse(delegation.isDelegationActive(delegationId));
    }

    function test_getGrantedPermissions_returnsAllPermissions() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.CREATE_MARKET);

        MarketDelegation.Permission[] memory perms = delegation.getGrantedPermissions(delegationId);
        assertEq(perms.length, 2);
    }

    function test_getDelegationsByDelegator_returnsAllDelegations() public {
        vm.prank(alice);
        delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.requestDelegation(charlie, MARKET_ID_2, 0);

        bytes32[] memory delegations = delegation.getDelegationsByDelegator(alice);
        assertEq(delegations.length, 2);
    }

    function test_getDelegationsByDelegatee_returnsAllDelegations() public {
        vm.prank(alice);
        delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(charlie);
        delegation.requestDelegation(bob, MARKET_ID_2, 0);

        bytes32[] memory delegations = delegation.getDelegationsByDelegatee(bob);
        assertEq(delegations.length, 2);
    }

    function test_getDelegationsByMarket_returnsMarketDelegations() public {
        vm.prank(alice);
        delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(charlie);
        delegation.requestDelegation(bob, MARKET_ID_1, 0);

        bytes32[] memory delegations = delegation.getDelegationsByMarket(MARKET_ID_1);
        assertEq(delegations.length, 2);
    }

    function test_getTotalDelegations_returnsCorrectCount() public {
        uint256 initialTotal = delegation.getTotalDelegations();

        vm.prank(alice);
        delegation.requestDelegation(bob, MARKET_ID_1, 0);

        assertEq(delegation.getTotalDelegations(), initialTotal + 1);
    }

    // ── Expiration Tests ──────────────────────────────────────────────────────

    function test_delegation_expiresAfterDuration() public {
        uint256 duration = 1 days;
        
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, duration);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        assertTrue(delegation.isDelegationActive(delegationId));

        // Fast forward past expiration
        vm.warp(block.timestamp + duration + 1);

        assertFalse(delegation.isDelegationActive(delegationId));
        
        MarketDelegation.DelegationStatus status = delegation.getDelegationStatus(delegationId);
        assertEq(uint256(status), uint256(MarketDelegation.DelegationStatus.EXPIRED));
    }

    function test_hasPermission_returnsFalseAfterExpiration() public {
        uint256 duration = 1 days;
        
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, duration);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        assertTrue(delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE));

        // Fast forward past expiration
        vm.warp(block.timestamp + duration + 1);

        assertFalse(delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE));
    }

    // ── Admin Function Tests ──────────────────────────────────────────────────

    function test_expireDelegation_ownerCanExpire() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(owner);
        delegation.expireDelegation(delegationId);

        MarketDelegation.DelegationStatus status = delegation.getDelegationStatus(delegationId);
        assertEq(uint256(status), uint256(MarketDelegation.DelegationStatus.EXPIRED));
    }

    function test_expireDelegation_revertsOnNonOwner() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        vm.prank(bob);
        vm.expectRevert();
        delegation.expireDelegation(delegationId);
    }

    // ── Edge Cases and Integration Tests ──────────────────────────────────────

    function test_multipleDelegations_independentLifecycles() public {
        // Alice delegates to Bob for Market 1
        vm.prank(alice);
        bytes32 delegationId1 = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        // Alice delegates to Charlie for Market 2
        vm.prank(alice);
        bytes32 delegationId2 = delegation.requestDelegation(charlie, MARKET_ID_2, 0);

        // Activate first delegation
        vm.prank(alice);
        delegation.activateDelegation(delegationId1);

        // Revoke first delegation
        vm.prank(alice);
        delegation.revokeDelegation(delegationId1);

        // Second delegation should still be pending
        MarketDelegation.DelegationStatus status2 = delegation.getDelegationStatus(delegationId2);
        assertEq(uint256(status2), uint256(MarketDelegation.DelegationStatus.PENDING));
    }

    function test_revokeDelegation_revokesAllPermissions() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, MARKET_ID_1, 0);

        vm.prank(alice);
        delegation.activateDelegation(delegationId);

        // Grant multiple permissions
        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.TRADE);

        vm.prank(alice);
        delegation.grantPermission(delegationId, MarketDelegation.Permission.CREATE_MARKET);

        // Revoke delegation
        vm.prank(alice);
        delegation.revokeDelegation(delegationId);

        // All permissions should be revoked
        assertFalse(delegation.hasPermission(delegationId, MarketDelegation.Permission.TRADE));
        assertFalse(delegation.hasPermission(delegationId, MarketDelegation.Permission.CREATE_MARKET));
    }

    function test_globalDelegation_worksAcrossMarkets() public {
        vm.prank(alice);
        bytes32 delegationId = delegation.requestDelegation(bob, GLOBAL_MARKET, 0);

        MarketDelegation.Delegation memory del = delegation.getDelegation(delegationId);
        assertEq(del.marketId, GLOBAL_MARKET);
    }
}
