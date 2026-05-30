// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RulingTimelock
/// @notice Simple timelock for delayed execution of arbitration rulings.
contract RulingTimelock {
    address public owner;

    struct Ruling {
        address target;
        bytes data;
        uint256 unlockTime;
        uint256 delay;
        address proposer;
        bool executed;
        bool canceled;
        bool failed;
        bytes failureData;
    }

    mapping(bytes32 => Ruling) private _rulings;

    event RulingScheduled(
        bytes32 indexed id,
        address indexed target,
        uint256 unlockTime
    );
    event RulingExecuted(bytes32 indexed id);
    event RulingFailed(bytes32 indexed id, bytes failureData);
    event RulingCancelled(bytes32 indexed id);

    modifier onlyOwner() {
        if (msg.sender != owner) revert("Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Schedule a ruling to be executed after `delay` seconds.
    function scheduleRuling(
        bytes32 id,
        address target,
        bytes calldata data,
        uint256 delay
    ) external onlyOwner {
        Ruling storage r = _rulings[id];
        require(r.unlockTime == 0, "Already scheduled");
        require(target != address(0), "Invalid target");
        require(delay > 0, "Invalid delay");

        r.target = target;
        r.data = data;
        r.delay = delay;
        r.unlockTime = block.timestamp + delay;
        r.proposer = msg.sender;

        emit RulingScheduled(id, target, r.unlockTime);
    }

    /// @notice Execute a scheduled ruling if the timelock has passed.
    function executeRuling(bytes32 id) external {
        Ruling storage r = _rulings[id];
        require(r.unlockTime != 0, "Not scheduled");
        require(!r.executed, "Already executed");
        require(!r.canceled, "Canceled");
        require(block.timestamp >= r.unlockTime, "Not ready");

        (bool ok, bytes memory ret) = r.target.call(r.data);
        if (ok) {
            r.executed = true;
            emit RulingExecuted(id);
        } else {
            r.failed = true;
            r.failureData = ret;
            emit RulingFailed(id, ret);
        }
    }

    /// @notice Cancel a pending ruling. Owner only.
    function cancelRuling(bytes32 id) external onlyOwner {
        Ruling storage r = _rulings[id];
        require(r.unlockTime != 0, "Not scheduled");
        require(!r.executed, "Already executed");
        require(!r.canceled, "Already canceled");
        r.canceled = true;
        emit RulingCancelled(id);
    }

    /// @notice Query a ruling record.
    function getRuling(
        bytes32 id
    )
        external
        view
        returns (
            address target,
            bytes memory data,
            uint256 unlockTime,
            uint256 delay,
            address proposer,
            bool executed,
            bool canceled,
            bool failed,
            bytes memory failureData
        )
    {
        Ruling storage r = _rulings[id];
        return (
            r.target,
            r.data,
            r.unlockTime,
            r.delay,
            r.proposer,
            r.executed,
            r.canceled,
            r.failed,
            r.failureData
        );
    }

    /// @notice Check if a ruling is ready to execute.
    function isReady(bytes32 id) external view returns (bool) {
        Ruling storage r = _rulings[id];
        if (r.unlockTime == 0) return false;
        if (r.executed || r.canceled) return false;
        return block.timestamp >= r.unlockTime;
    }
}
