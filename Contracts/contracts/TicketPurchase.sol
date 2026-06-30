// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TicketPurchase
/// @notice Handles ticket sales, ownership tracking, bulk purchases, and ticket queries.
contract TicketPurchase is Ownable {
    error SaleClosed();
    error InvalidQuantity();
    error InsufficientPayment();
    error TicketNotFound();

    struct Ticket {
        uint256 id;
        address owner;
        uint256 pricePaid;
        bool active;
    }

    uint256 public constant MAX_TICKETS_PER_PURCHASE = 100;
    uint256 public ticketPrice;
    uint256 public nextTicketId;
    bool public saleActive;

    mapping(uint256 => Ticket) private _tickets;
    mapping(address => uint256[]) private _ticketsByOwner;
    mapping(address => uint256) private _ownedTicketCount;

    event TicketsPurchased(address indexed buyer, uint256[] ticketIds, uint256 quantity, uint256 totalPaid);
    event SaleStatusUpdated(bool indexed active);

    constructor(uint256 _ticketPrice, address initialOwner) Ownable() {
        transferOwnership(initialOwner);
        ticketPrice = _ticketPrice;
        saleActive = true;
    }

    function purchaseTickets(uint256 quantity) external payable returns (uint256[] memory ticketIds) {
        return _purchaseTickets(quantity);
    }

    function bulkPurchaseTickets(uint256 quantity) external payable returns (uint256[] memory ticketIds) {
        return _purchaseTickets(quantity);
    }

    function setSaleActive(bool active) external onlyOwner {
        saleActive = active;
        emit SaleStatusUpdated(active);
    }

    function getTicket(uint256 ticketId) external view returns (Ticket memory ticket) {
        if (ticketId >= nextTicketId) revert TicketNotFound();
        return _tickets[ticketId];
    }

    function getTicketsByOwner(address owner) external view returns (uint256[] memory) {
        return _ticketsByOwner[owner];
    }

    function getOwnedTicketCount(address owner) external view returns (uint256) {
        return _ownedTicketCount[owner];
    }

    function ownerOf(uint256 ticketId) public view returns (address) {
        if (ticketId >= nextTicketId) revert TicketNotFound();
        return _tickets[ticketId].owner;
    }

    function _purchaseTickets(uint256 quantity) internal returns (uint256[] memory ticketIds) {
        if (!saleActive) revert SaleClosed();
        if (quantity == 0 || quantity > MAX_TICKETS_PER_PURCHASE) revert InvalidQuantity();

        uint256 totalCost = ticketPrice * quantity;
        if (msg.value != totalCost) revert InsufficientPayment();

        ticketIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            uint256 ticketId = nextTicketId++;
            _tickets[ticketId] = Ticket({
                id: ticketId,
                owner: msg.sender,
                pricePaid: ticketPrice,
                active: true
            });
            _ticketsByOwner[msg.sender].push(ticketId);
            _ownedTicketCount[msg.sender]++;
            ticketIds[i] = ticketId;
        }

        emit TicketsPurchased(msg.sender, ticketIds, quantity, totalCost);
    }

    receive() external payable {}

    fallback() external payable {}
}
