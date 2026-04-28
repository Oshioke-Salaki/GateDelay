// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title KYCStorage
/// @notice Stores KYC verification data with role-gated writes and query helpers.
contract KYCStorage is Ownable {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error NotVerifier();
    error AlreadyVerifier();
    error UnknownRecord();
    error InvalidStatus();
    error InvalidLevel();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum Status { NONE, PENDING, VERIFIED, REJECTED, EXPIRED, REVOKED }

    struct Record {
        Status status;
        uint8 level;             // 0 = none, 1 = basic, 2 = enhanced, 3 = institutional
        uint64 verifiedAt;
        uint64 expiresAt;        // 0 = no expiry
        uint64 updatedAt;
        address verifier;
        bytes32 documentHash;    // hash of off-chain documents
        string jurisdiction;     // ISO country code
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event RecordSubmitted(address indexed user, bytes32 documentHash, string jurisdiction);
    event RecordUpdated(
        address indexed user,
        Status indexed status,
        uint8 level,
        address indexed verifier,
        uint64 expiresAt
    );
    event RecordRevoked(address indexed user, address indexed verifier, string reason);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    mapping(address => Record) private _records;
    mapping(address => bool) private _verifiers;
    address[] private _verifierList;
    address[] private _userList;
    mapping(address => bool) private _userListed;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address initialOwner) Ownable(initialOwner) {
        // owner is implicitly able to add verifiers; they are not a verifier by default
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyVerifier() {
        if (!_verifiers[msg.sender]) revert NotVerifier();
        _;
    }

    // -------------------------------------------------------------------------
    // Verifier management
    // -------------------------------------------------------------------------

    /// @notice Add an account that may write KYC records.
    function addVerifier(address verifier) external onlyOwner {
        if (verifier == address(0)) revert ZeroAddress();
        if (_verifiers[verifier]) revert AlreadyVerifier();
        _verifiers[verifier] = true;
        _verifierList.push(verifier);
        emit VerifierAdded(verifier);
    }

    /// @notice Remove a verifier.
    function removeVerifier(address verifier) external onlyOwner {
        if (!_verifiers[verifier]) revert NotVerifier();
        _verifiers[verifier] = false;

        uint256 len = _verifierList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_verifierList[i] == verifier) {
                _verifierList[i] = _verifierList[len - 1];
                _verifierList.pop();
                break;
            }
        }
        emit VerifierRemoved(verifier);
    }

    /// @notice Whether the supplied account is registered as a verifier.
    function isVerifier(address account) external view returns (bool) {
        return _verifiers[account];
    }

    /// @notice Read all current verifier addresses.
    function getVerifiers() external view returns (address[] memory) {
        return _verifierList;
    }

    // -------------------------------------------------------------------------
    // Record writes
    // -------------------------------------------------------------------------

    /// @notice User-facing entry point: submit a KYC record for review.
    /// @dev Marks the record as PENDING; verifier later finalises status.
    function submit(bytes32 documentHash, string calldata jurisdiction) external {
        Record storage rec = _records[msg.sender];
        rec.status = Status.PENDING;
        rec.documentHash = documentHash;
        rec.jurisdiction = jurisdiction;
        rec.updatedAt = uint64(block.timestamp);

        if (!_userListed[msg.sender]) {
            _userListed[msg.sender] = true;
            _userList.push(msg.sender);
        }
        emit RecordSubmitted(msg.sender, documentHash, jurisdiction);
    }

    /// @notice Verifier finalises a user's KYC outcome.
    function setVerification(
        address user,
        Status status,
        uint8 level,
        uint64 expiresAt
    ) external onlyVerifier {
        if (user == address(0)) revert ZeroAddress();
        if (status == Status.NONE) revert InvalidStatus();
        if (level > 3) revert InvalidLevel();

        Record storage rec = _records[user];
        rec.status = status;
        rec.level = level;
        rec.verifier = msg.sender;
        rec.updatedAt = uint64(block.timestamp);
        rec.expiresAt = expiresAt;
        if (status == Status.VERIFIED) {
            rec.verifiedAt = uint64(block.timestamp);
        }

        if (!_userListed[user]) {
            _userListed[user] = true;
            _userList.push(user);
        }
        emit RecordUpdated(user, status, level, msg.sender, expiresAt);
    }

    /// @notice Revoke a previously verified record.
    function revoke(address user, string calldata reason) external onlyVerifier {
        Record storage rec = _records[user];
        if (rec.status == Status.NONE) revert UnknownRecord();
        rec.status = Status.REVOKED;
        rec.updatedAt = uint64(block.timestamp);
        rec.verifier = msg.sender;
        emit RecordRevoked(user, msg.sender, reason);
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice Return the full KYC record for a user.
    function getRecord(address user) external view returns (Record memory) {
        return _records[user];
    }

    /// @notice Effective verification status, accounting for expiry.
    function statusOf(address user) public view returns (Status) {
        Record storage rec = _records[user];
        if (rec.status == Status.VERIFIED && rec.expiresAt != 0 && block.timestamp >= rec.expiresAt) {
            return Status.EXPIRED;
        }
        return rec.status;
    }

    /// @notice Convenience predicate: user is currently verified at >= minLevel.
    function isVerified(address user, uint8 minLevel) external view returns (bool) {
        Record storage rec = _records[user];
        if (rec.status != Status.VERIFIED) return false;
        if (rec.expiresAt != 0 && block.timestamp >= rec.expiresAt) return false;
        return rec.level >= minLevel;
    }

    /// @notice Block timestamp at which the user's verification expires (0 = none).
    function expiryOf(address user) external view returns (uint64) {
        return _records[user].expiresAt;
    }

    /// @notice Number of users that have ever submitted or been written by a verifier.
    function userCount() external view returns (uint256) {
        return _userList.length;
    }

    /// @notice Paginated list of known users.
    function listUsers(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 total = _userList.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = _userList[i];
        }
    }
}
