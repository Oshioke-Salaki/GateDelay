// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RaffleContract
/// @notice Manages raffle entries, sales, winner selection, prize distribution, and queries.
contract RaffleContract is Ownable {
    error InvalidEntryQuantity();
    error InsufficientPayment();
    error RaffleClosed();
    error PrizeAlreadyDistributed();
    error WinnerNotSelected();
    error RaffleNotEnded();

    uint256 public entryPrice;
    uint256 public endTime;
    uint256 public prizeAmount;
    uint256 public totalEntries;
    bool public finalized;
    bool public prizeDistributed;
    address public winner;

    mapping(address => uint256[]) private _entriesByUser;
    mapping(address => uint256) private _entryCountByUser;
    mapping(address => bool) private _participantSet;
    address[] private _participants;

    event EntriesPurchased(address indexed buyer, uint256 quantity, uint256 totalPaid);
    event WinnerSelected(address indexed winnerAddress, uint256 indexed seed);
    event PrizeDistributed(address indexed winnerAddress, uint256 amount);

    constructor(uint256 _entryPrice, uint256 duration, uint256 _prizeAmount, address initialOwner) Ownable() {
        transferOwnership(initialOwner);
        entryPrice = _entryPrice;
        endTime = block.timestamp + duration;
        prizeAmount = _prizeAmount;
        finalized = false;
        prizeDistributed = false;
    }

    function buyEntries(uint256 quantity) external payable returns (uint256[] memory entryIds) {
        if (block.timestamp >= endTime) revert RaffleClosed();
        if (quantity == 0) revert InvalidEntryQuantity();

        uint256 totalCost = entryPrice * quantity;
        if (msg.value != totalCost) revert InsufficientPayment();

        if (!_participantSet[msg.sender]) {
            _participantSet[msg.sender] = true;
            _participants.push(msg.sender);
        }

        entryIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            _entriesByUser[msg.sender].push(totalEntries + i + 1);
            _entryCountByUser[msg.sender]++;
            entryIds[i] = totalEntries + i + 1;
        }

        totalEntries += quantity;
        emit EntriesPurchased(msg.sender, quantity, totalCost);
    }

    function selectWinner(uint256 seed) external onlyOwner returns (address selectedWinner) {
        if (block.timestamp < endTime) revert RaffleNotEnded();
        if (totalEntries == 0) revert WinnerNotSelected();

        finalized = true;
        uint256 participantCount = _participants.length;
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.timestamp, seed, totalEntries))) % participantCount;
        selectedWinner = _participants[randomIndex];

        winner = selectedWinner;
        emit WinnerSelected(selectedWinner, seed);
        return selectedWinner;
    }

    function distributePrize() external onlyOwner {
        if (!finalized) revert WinnerNotSelected();
        if (prizeDistributed) revert PrizeAlreadyDistributed();
        if (winner == address(0)) revert WinnerNotSelected();

        (bool success,) = winner.call{value: prizeAmount}("");
        require(success, "Prize transfer failed");
        prizeDistributed = true;
        emit PrizeDistributed(winner, prizeAmount);
    }

    function getEntryCount(address user) external view returns (uint256) {
        return _entryCountByUser[user];
    }

    function getEntriesByUser(address user) external view returns (uint256[] memory) {
        return _entriesByUser[user];
    }

    function isActive() external view returns (bool) {
        return block.timestamp < endTime;
    }

    receive() external payable {}
}
