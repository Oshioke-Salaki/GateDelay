// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title JurySelection
/// @notice Selects jurors from candidate lists, validates eligibility, manages composition,
///         tracks participation, and provides query APIs.
contract JurySelection {
    address public owner;

    enum JuryStatus {
        NONE,
        SELECTED
    }

    struct JuryInfo {
        address[] members;
        JuryStatus status;
        uint256 size;
    }

    // juryId => info
    mapping(bytes32 => JuryInfo) private _juries;
    // juryId => member => isMember
    mapping(bytes32 => mapping(address => bool)) private _isMember;
    // juryId => member => participated
    mapping(bytes32 => mapping(address => bool)) private _hasParticipated;

    event JurySelected(bytes32 indexed juryId, address[] members);
    event ParticipationRecorded(bytes32 indexed juryId, address indexed member);

    modifier onlyOwner() {
        if (msg.sender != owner) revert("Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Select a jury from candidate addresses. Owner only.
    /// @param juryId  Unique id for the jury selection.
    /// @param candidates  Pool of candidate addresses.
    /// @param size  Desired jury size.
    /// @param seed  Entropy seed for pseudo-random selection.
    function selectJury(
        bytes32 juryId,
        address[] calldata candidates,
        uint256 size,
        uint256 seed
    ) external onlyOwner {
        require(_juries[juryId].status == JuryStatus.NONE, "Jury exists");
        require(size > 0, "Invalid size");
        require(candidates.length >= size, "Not enough candidates");

        // copy candidates to memory to shuffle
        address[] memory pool = candidates;

        // basic Fisher-Yates shuffle using seed
        for (uint256 i = pool.length - 1; i > 0; i--) {
            uint256 rand = uint256(
                keccak256(
                    abi.encodePacked(seed, block.timestamp, block.number, i)
                )
            );
            uint256 j = rand % (i + 1);
            // swap
            address tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }

        address[] storage members = _juries[juryId].members;
        members = new address[](0);

        // pick first `size` unique and valid addresses
        uint256 count = 0;
        for (uint256 k = 0; k < pool.length && count < size; k++) {
            address cand = pool[k];
            require(cand != address(0), "Invalid candidate");
            // ensure uniqueness
            bool already = _isMember[juryId][cand];
            if (already) continue;
            members.push(cand);
            _isMember[juryId][cand] = true;
            count++;
        }

        require(count == size, "Could not fill jury");

        _juries[juryId].size = size;
        _juries[juryId].status = JuryStatus.SELECTED;

        emit JurySelected(juryId, _juries[juryId].members);
    }

    /// @notice Record participation for a jury member.
    function recordParticipation(bytes32 juryId) external {
        require(
            _juries[juryId].status == JuryStatus.SELECTED,
            "Jury not selected"
        );
        require(_isMember[juryId][msg.sender], "Not a juror");
        require(!_hasParticipated[juryId][msg.sender], "Already participated");

        _hasParticipated[juryId][msg.sender] = true;
        emit ParticipationRecorded(juryId, msg.sender);
    }

    /// @notice Returns jury members for a jury id.
    function getJury(bytes32 juryId) external view returns (address[] memory) {
        return _juries[juryId].members;
    }

    /// @notice Check if address is member of a jury.
    function isMember(
        bytes32 juryId,
        address account
    ) external view returns (bool) {
        return _isMember[juryId][account];
    }

    /// @notice Check if member has participated.
    function hasParticipated(
        bytes32 juryId,
        address account
    ) external view returns (bool) {
        return _hasParticipated[juryId][account];
    }

    /// @notice Returns jury size and status.
    function getJuryInfo(
        bytes32 juryId
    ) external view returns (uint256 size, JuryStatus status) {
        JuryInfo storage info = _juries[juryId];
        return (info.size, info.status);
    }
}
