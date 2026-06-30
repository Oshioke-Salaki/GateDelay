// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/TicketPurchase.sol";

contract TicketPurchaseTest is Test {
    TicketPurchase public ticketPurchase;
    address public owner = address(0x1);
    address public alice = address(0xA11CE);

    function setUp() public {
        vm.prank(owner);
        ticketPurchase = new TicketPurchase(1 ether, owner);
    }

    function test_purchaseTickets_tracksOwnershipAndQueries() public {
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        uint256[] memory ticketIds = ticketPurchase.purchaseTickets{value: 2 ether}(2);

        assertEq(ticketIds.length, 2);
        assertEq(ticketPurchase.getOwnedTicketCount(alice), 2);
        assertEq(ticketPurchase.ownerOf(ticketIds[0]), alice);
        assertEq(ticketPurchase.ownerOf(ticketIds[1]), alice);
        assertEq(ticketPurchase.getTicketsByOwner(alice).length, 2);

        TicketPurchase.Ticket memory ticket = ticketPurchase.getTicket(ticketIds[0]);
        assertEq(ticket.owner, alice);
        assertEq(ticket.pricePaid, 1 ether);
    }

    function test_bulkPurchaseTickets_succeeds() public {
        vm.deal(alice, 3 ether);

        vm.prank(alice);
        uint256[] memory ticketIds = ticketPurchase.bulkPurchaseTickets{value: 3 ether}(3);

        assertEq(ticketIds.length, 3);
        assertEq(ticketPurchase.getOwnedTicketCount(alice), 3);
    }

    function test_purchaseTickets_revertsWhenSaleInactive() public {
        vm.prank(owner);
        ticketPurchase.setSaleActive(false);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(TicketPurchase.SaleClosed.selector);
        ticketPurchase.purchaseTickets{value: 1 ether}(1);
    }

    function test_purchaseTickets_revertsWhenInsufficientPayment() public {
        vm.deal(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert(TicketPurchase.InsufficientPayment.selector);
        ticketPurchase.purchaseTickets{value: 0.5 ether}(1);
    }
}
