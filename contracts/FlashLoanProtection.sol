// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title FlashLoanProtection
 * @dev Lightweight protection utilities to detect and guard against unapproved flash-loan-like calls.
 *
 * Protection strategy implemented:
 * - Calls that originate from an EOA (msg.sender == tx.origin) are allowed.
 * - Calls that come through a contract (msg.sender != tx.origin) are treated as potential flash loans
 *   and are blocked unless the calling contract address is explicitly approved by owner.
 * - Activity (loan count and last block) is tracked per origin (tx.origin) so legitimate relayers
 *   that are approved can work, while malicious flash-loan callers are prevented.
 */
contract FlashLoanProtection {
    address public owner;

    mapping(address => bool) private _approvedContracts;
    mapping(address => uint256) private _loanCount;
    mapping(address => uint256) private _lastLoanBlock;

    event ContractApproved(address indexed contractAddress);
    event ContractRevoked(address indexed contractAddress);
    event LoanActivity(address indexed caller, address indexed origin, uint256 amount, bool allowed);

    modifier onlyOwner() {
        require(msg.sender == owner, "FlashLoanProtection: only owner");
        _;
    }

    modifier protected(uint256 amount) {
        // If caller is a contract (msg.sender != tx.origin) it must be approved
        bool isContractCall = msg.sender != tx.origin;
        if (isContractCall) {
            require(_approvedContracts[msg.sender], "FlashLoanProtection: unapproved contract caller");
        }

        // Track activity using tx.origin so we attribute the full transaction initiator
        _loanCount[tx.origin] += 1;
        _lastLoanBlock[tx.origin] = block.number;

        emit LoanActivity(msg.sender, tx.origin, amount, !isContractCall || _approvedContracts[msg.sender]);

        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Owner management
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FlashLoanProtection: zero address");
        owner = newOwner;
    }

    // Approve a contract that is allowed to perform flash-loan style interactions
    function approveContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "FlashLoanProtection: zero address");
        _approvedContracts[contractAddress] = true;
        emit ContractApproved(contractAddress);
    }

    function revokeContract(address contractAddress) external onlyOwner {
        require(_approvedContracts[contractAddress], "FlashLoanProtection: not approved");
        _approvedContracts[contractAddress] = false;
        emit ContractRevoked(contractAddress);
    }

    // Queries
    function isApproved(address contractAddress) external view returns (bool) {
        return _approvedContracts[contractAddress];
    }

    function loanCount(address origin) external view returns (uint256) {
        return _loanCount[origin];
    }

    function lastLoanBlock(address origin) external view returns (uint256) {
        return _lastLoanBlock[origin];
    }

    // Example protected action that other contracts in the system would call
    // to ensure the caller is not an unapproved flash-loan contract.
    function protectedAction(uint256 amount) external protected(amount) returns (bool) {
        // No state change other than tracking in modifier; real systems would perform action here.
        return true;
    }
}
