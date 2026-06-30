// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RaffleContract.sol";

contract RaffleContractTest is Test {
    RaffleContract public raffle;
    address public owner = address(0x1);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B0);

    function setUp() public {
        vm.prank(owner);
        raffle = new RaffleContract(1 ether, 7 days, 3 ether, owner);
    }

    function test_buyEntries_and_queries() public {
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        raffle.buyEntries{value: 2 ether}(2);

        assertEq(raffle.totalEntries(), 2);
        assertEq(raffle.getEntryCount(alice), 2);
        assertEq(raffle.getEntriesByUser(alice).length, 2);
        assertTrue(raffle.isActive());
    }

    function test_selectWinner_and_distributePrize() public {
        vm.deal(alice, 5 ether);
        vm.deal(bob, 5 ether);

        vm.prank(alice);
        raffle.buyEntries{value: 2 ether}(2);

        vm.prank(bob);
        raffle.buyEntries{value: 3 ether}(3);

        vm.warp(block.timestamp + 8 days);

        vm.prank(owner);
        address winner = raffle.selectWinner(123);

        assertTrue(winner == alice || winner == bob);
        assertTrue(raffle.finalized());
        assertEq(raffle.winner(), winner);

        uint256 balanceBefore = address(winner).balance;
        vm.prank(owner);
        raffle.distributePrize();

        assertEq(address(winner).balance, balanceBefore + 3 ether);
        assertEq(raffle.prizeDistributed(), true);
    }
}
