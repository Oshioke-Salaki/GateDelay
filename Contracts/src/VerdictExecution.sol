// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Resolution.sol";

/// @title VerdictExecution
/// @notice Processes arbitration verdicts, executes decisions via `Resolution`,
///         tracks execution status, and exposes queries for callers.
contract VerdictExecution {
    enum ExecStatus {
        UNKNOWN,
        PROCESSED,
        EXECUTED,
        FAILED
    }

    struct Execution {
        address market;
        Resolution.Outcome outcome;
        uint256 processedAt;
        uint256 executedAt;
        ExecStatus status;
        string failureReason;
    }

    mapping(bytes32 => Execution) private _executions;

    address public arbitrator;
    Resolution public resolution;
    address public owner;

    event VerdictProcessed(
        bytes32 indexed verdictId,
        address indexed market,
        Resolution.Outcome outcome
    );
    event ExecutionSucceeded(bytes32 indexed verdictId);
    event ExecutionFailed(bytes32 indexed verdictId, string reason);

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) revert("Unauthorized");
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert("Not owner");
        _;
    }

    constructor(address _arbitrator) {
        arbitrator = _arbitrator;
        owner = msg.sender;
    }

    /// @notice Set the `Resolution` contract address. Callable once by owner.
    function setResolution(address _resolution) external onlyOwner {
        resolution = Resolution(_resolution);
    }

    /// @notice Process a verdict and attempt to execute its decision.
    /// @param verdictId  Unique identifier for the verdict.
    /// @param market     Target market address.
    /// @param outcome    Final outcome to apply.
    function processVerdict(
        bytes32 verdictId,
        address market,
        Resolution.Outcome outcome
    ) external onlyArbitrator {
        Execution storage rec = _executions[verdictId];
        if (rec.status != ExecStatus.UNKNOWN) revert("Already processed");

        rec.market = market;
        rec.outcome = outcome;
        rec.processedAt = block.timestamp;
        rec.status = ExecStatus.PROCESSED;

        emit VerdictProcessed(verdictId, market, outcome);

        // Attempt to execute the decision on Resolution. Catch failures and record them.
        try resolution.settleDispute(market, outcome) {
            rec.executedAt = block.timestamp;
            rec.status = ExecStatus.EXECUTED;
            emit ExecutionSucceeded(verdictId);
        } catch Error(string memory reason) {
            rec.status = ExecStatus.FAILED;
            rec.failureReason = reason;
            emit ExecutionFailed(verdictId, reason);
        } catch (bytes memory) {
            rec.status = ExecStatus.FAILED;
            rec.failureReason = "unknown";
            emit ExecutionFailed(verdictId, "unknown");
        }
    }

    /// @notice Query an execution record.
    function getExecution(
        bytes32 verdictId
    )
        external
        view
        returns (
            address market,
            Resolution.Outcome outcome,
            uint256 processedAt,
            uint256 executedAt,
            ExecStatus status,
            string memory failureReason
        )
    {
        Execution storage r = _executions[verdictId];
        return (
            r.market,
            r.outcome,
            r.processedAt,
            r.executedAt,
            r.status,
            r.failureReason
        );
    }
}
