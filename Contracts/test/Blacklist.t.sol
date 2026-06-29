// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/Blacklist.sol";

contract BlacklistTest is Test {
    Blacklist public blacklistContract;
    address public owner = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);
    address public carol = address(0x4);

    event Blacklisted(address indexed account, address indexed operator);
    event Unblacklisted(address indexed account, address indexed operator);

    function setUp() public {
        vm.prank(owner);
        blacklistContract = new Blacklist();
    }

    function test_OwnerCanBlacklist() public {
        vm.prank(owner);
        blacklistContract.blacklist(alice);

        assertTrue(blacklistContract.isBlacklisted(alice));
        assertEq(blacklistContract.getBlacklistedCount(), 1);
    }

    function test_OwnerCanUnblacklist() public {
        vm.prank(owner);
        blacklistContract.blacklist(alice);

        vm.prank(owner);
        blacklistContract.unblacklist(alice);

        assertFalse(blacklistContract.isBlacklisted(alice));
        assertEq(blacklistContract.getBlacklistedCount(), 0);
    }

    function test_BatchBlacklisting() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = carol;

        vm.prank(owner);
        blacklistContract.blacklistBatch(accounts);

        assertTrue(blacklistContract.isBlacklisted(alice));
        assertTrue(blacklistContract.isBlacklisted(bob));
        assertTrue(blacklistContract.isBlacklisted(carol));
        assertEq(blacklistContract.getBlacklistedCount(), 3);
    }

    function test_BatchUnblacklisting() public {
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;

        vm.prank(owner);
        blacklistContract.blacklistBatch(accounts);

        vm.prank(owner);
        blacklistContract.unblacklistBatch(accounts);

        assertFalse(blacklistContract.isBlacklisted(alice));
        assertFalse(blacklistContract.isBlacklisted(bob));
        assertEq(blacklistContract.getBlacklistedCount(), 0);
    }

    function test_BlacklistEvents() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Blacklisted(alice, owner);
        blacklistContract.blacklist(alice);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Unblacklisted(alice, owner);
        blacklistContract.unblacklist(alice);
    }

    function test_AlreadyBlacklistedReverts() public {
        vm.prank(owner);
        blacklistContract.blacklist(alice);

        vm.prank(owner);
        vm.expectRevert(Blacklist.AlreadyBlacklisted.selector);
        blacklistContract.blacklist(alice);
    }

    function test_UnblacklistNotBlacklistedReverts() public {
        vm.prank(owner);
        vm.expectRevert(Blacklist.NotBlacklisted.selector);
        blacklistContract.unblacklist(alice);
    }

    function test_NonOwnerCannotBlacklist() public {
        vm.prank(bob);
        vm.expectRevert();
        blacklistContract.blacklist(alice);
    }

    function test_RequireNotBlacklistedRevertsForBlacklistedAccount() public {
        vm.prank(owner);
        blacklistContract.blacklist(alice);

        vm.expectRevert(Blacklist.Blacklisted.selector);
        blacklistContract.requireNotBlacklisted(alice);
    }

    function test_GetBlacklistedAccountsReturnsActiveList() public {
        vm.prank(owner);
        blacklistContract.blacklist(alice);
        blacklistContract.blacklist(bob);

        address[] memory results = blacklistContract.getBlacklistedAccounts();
        assertEq(results.length, 2);
        assertEq(results[0], alice);
        assertEq(results[1], bob);
    }
}
