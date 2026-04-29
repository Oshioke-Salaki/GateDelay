// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Whitelist.sol";

contract WhitelistedMarketHarness is Whitelist {
    constructor(address initialOwner) Whitelist(initialOwner) {}

    function restrictedTrade() external view onlyWhitelistedCaller returns (bool) {
        return true;
    }

    function restrictedFor(address account) external view onlyWhitelisted(account) returns (bool) {
        return true;
    }
}

contract WhitelistTest is Test {
    Whitelist whitelistContract;
    WhitelistedMarketHarness market;

    address owner = address(0xA11CE);
    address alice = address(0xBEEF);
    address bob = address(0xCAFE);
    address carol = address(0xD00D);
    address other = address(0xFADE);

    event Whitelisted(address indexed account, address indexed operator);
    event Unwhitelisted(address indexed account, address indexed operator);
    event WhitelistChanged(address indexed account, address indexed operator, bool whitelisted);

    function setUp() public {
        whitelistContract = new Whitelist(owner);
        market = new WhitelistedMarketHarness(owner);
    }

    // ------- whitelist management -------

    function test_OwnerCanWhitelistAddress() public {
        vm.prank(owner);
        whitelistContract.whitelist(alice);

        assertTrue(whitelistContract.isWhitelisted(alice));
        assertTrue(whitelistContract.isAccessAllowed(alice));
        assertEq(whitelistContract.getWhitelistedCount(), 1);

        address[] memory accounts = whitelistContract.getWhitelistedAccounts();
        assertEq(accounts.length, 1);
        assertEq(accounts[0], alice);
    }

    function test_OwnerCanUnwhitelistAddress() public {
        vm.prank(owner);
        whitelistContract.whitelist(alice);

        vm.prank(owner);
        whitelistContract.unwhitelist(alice);

        assertFalse(whitelistContract.isWhitelisted(alice));
        assertFalse(whitelistContract.isAccessAllowed(alice));
        assertEq(whitelistContract.getWhitelistedCount(), 0);
    }

    function test_AddRemoveAliasesWork() public {
        vm.prank(owner);
        whitelistContract.addToWhitelist(alice);
        assertTrue(whitelistContract.isWhitelisted(alice));

        vm.prank(owner);
        whitelistContract.removeFromWhitelist(alice);
        assertFalse(whitelistContract.isWhitelisted(alice));
    }

    function test_CannotWhitelistZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(Whitelist.ZeroAddress.selector);
        whitelistContract.whitelist(address(0));
    }

    function test_CannotWhitelistTwice() public {
        vm.prank(owner);
        whitelistContract.whitelist(alice);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.AlreadyWhitelisted.selector, alice));
        whitelistContract.whitelist(alice);
    }

    function test_CannotUnwhitelistUnknownAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, alice));
        whitelistContract.unwhitelist(alice);
    }

    function test_NonOwnerCannotWhitelist() public {
        vm.prank(other);
        vm.expectRevert();
        whitelistContract.whitelist(alice);
    }

    function test_NonOwnerCannotUnwhitelist() public {
        vm.prank(owner);
        whitelistContract.whitelist(alice);

        vm.prank(other);
        vm.expectRevert();
        whitelistContract.unwhitelist(alice);
    }

    // ------- batch operations -------

    function test_BatchWhitelisting() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;

        vm.prank(owner);
        whitelistContract.whitelistBatch(accounts);

        assertTrue(whitelistContract.isWhitelisted(alice));
        assertTrue(whitelistContract.isWhitelisted(bob));
        assertTrue(whitelistContract.isWhitelisted(carol));
        assertEq(whitelistContract.getWhitelistedCount(), 3);
    }

    function test_BatchUnwhitelisting() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;

        vm.prank(owner);
        whitelistContract.whitelistBatch(accounts);

        vm.prank(owner);
        whitelistContract.unwhitelistBatch(accounts);

        assertFalse(whitelistContract.isWhitelisted(alice));
        assertFalse(whitelistContract.isWhitelisted(bob));
        assertFalse(whitelistContract.isWhitelisted(carol));
        assertEq(whitelistContract.getWhitelistedCount(), 0);
    }

    function test_BatchWhitelistRevertsOnDuplicateAndRollsBack() public {
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = alice;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.AlreadyWhitelisted.selector, alice));
        whitelistContract.whitelistBatch(accounts);

        assertFalse(whitelistContract.isWhitelisted(alice));
        assertEq(whitelistContract.getWhitelistedCount(), 0);
    }

    function test_BatchUnwhitelistRevertsOnUnknownAndRollsBack() public {
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        vm.prank(owner);
        whitelistContract.whitelist(alice);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, bob));
        whitelistContract.unwhitelistBatch(accounts);

        assertTrue(whitelistContract.isWhitelisted(alice));
        assertEq(whitelistContract.getWhitelistedCount(), 1);
    }

    // ------- access control -------

    function test_RequireWhitelistedControlsAccess() public {
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, alice));
        whitelistContract.requireWhitelisted(alice);

        vm.prank(owner);
        whitelistContract.whitelist(alice);

        whitelistContract.requireWhitelisted(alice);
    }

    function test_ModifierRestrictsMarketAccessToWhitelistedCaller() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, alice));
        market.restrictedTrade();

        vm.prank(owner);
        market.whitelist(alice);

        vm.prank(alice);
        assertTrue(market.restrictedTrade());
    }

    function test_ModifierCanCheckSpecificAccount() public {
        vm.prank(owner);
        market.whitelist(alice);

        assertTrue(market.restrictedFor(alice));

        vm.expectRevert(abi.encodeWithSelector(Whitelist.NotWhitelisted.selector, bob));
        market.restrictedFor(bob);
    }

    // ------- tracking and queries -------

    function test_WhitelistEvents() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Whitelisted(alice, owner);
        vm.expectEmit(true, true, false, true);
        emit WhitelistChanged(alice, owner, true);
        whitelistContract.whitelist(alice);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Unwhitelisted(alice, owner);
        vm.expectEmit(true, true, false, true);
        emit WhitelistChanged(alice, owner, false);
        whitelistContract.unwhitelist(alice);
    }

    function test_ChangeHistoryTracksAddAndRemove() public {
        vm.warp(1_000);
        vm.prank(owner);
        whitelistContract.whitelist(alice);

        vm.warp(2_000);
        vm.prank(owner);
        whitelistContract.unwhitelist(alice);

        assertEq(whitelistContract.getWhitelistChangeCount(), 2);

        Whitelist.WhitelistChange memory added = whitelistContract.getWhitelistChange(0);
        assertEq(added.account, alice);
        assertEq(added.operator, owner);
        assertTrue(added.whitelisted);
        assertEq(uint256(added.timestamp), 1_000);

        Whitelist.WhitelistChange memory removed = whitelistContract.getWhitelistChange(1);
        assertEq(removed.account, alice);
        assertEq(removed.operator, owner);
        assertFalse(removed.whitelisted);
        assertEq(uint256(removed.timestamp), 2_000);

        (bool whitelisted, uint64 updatedAt, address updatedBy) = whitelistContract.getWhitelistMetadata(alice);
        assertFalse(whitelisted);
        assertEq(uint256(updatedAt), 2_000);
        assertEq(updatedBy, owner);
        assertEq(uint256(whitelistContract.lastUpdatedAt(alice)), 2_000);
        assertEq(whitelistContract.lastUpdatedBy(alice), owner);
    }

    function test_ListWhitelistChangesPaginates() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;

        vm.prank(owner);
        whitelistContract.whitelistBatch(accounts);

        Whitelist.WhitelistChange[] memory page = whitelistContract.listWhitelistChanges(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].account, bob);
        assertEq(page[1].account, carol);

        Whitelist.WhitelistChange[] memory empty = whitelistContract.listWhitelistChanges(10, 2);
        assertEq(empty.length, 0);
    }

    function test_GetWhitelistedAccountsReturnsOnlyActiveAddresses() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;

        vm.prank(owner);
        whitelistContract.whitelistBatch(accounts);

        vm.prank(owner);
        whitelistContract.unwhitelist(bob);

        address[] memory active = whitelistContract.getWhitelistedAccounts();
        assertEq(active.length, 2);
        assertTrue(active[0] == alice || active[1] == alice);
        assertTrue(active[0] == carol || active[1] == carol);
        assertFalse(whitelistContract.isWhitelisted(bob));
    }
}
