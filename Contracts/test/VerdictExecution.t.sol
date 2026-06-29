// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VerdictExecution.sol";
import "../src/Resolution.sol";
import "../src/PositionToken.sol";

contract VerdictExecutionTest is Test {
    VerdictExecution verdictExec;
    Resolution resolution;
    PositionToken pt;

    address arbitrator = address(0xA);
    address resolver = address(0xB);

    function setUp() public {
        // Deploy the execution router (arbitrator set to `arbitrator`)
        verdictExec = new VerdictExecution(arbitrator);

        // Deploy a minimal PositionToken (factory set to zero for tests)
        pt = new PositionToken(address(0))

        // Deploy Resolution with `verdictExec` as admin so it can call settleDispute
        resolution = new Resolution(
            1 days,
            resolver,
            address(verdictExec),
            address(pt)
        );

        // Point the execution router at the Resolution contract
        verdictExec.setResolution(address(resolution));
    }

    function testProcessVerdictFailsWhenNotDisputed() public {
        bytes32 vid = keccak256(abi.encodePacked("vid1"));
        address market = address(0x100);

        // If market is not disputed, settleDispute should revert and execution should be recorded as FAILED
        vm.prank(arbitrator);
        verdictExec.processVerdict(vid, market, Resolution.Outcome.YES);

        (, , , , VerdictExecution.ExecStatus status, ) = verdictExec
            .getExecution(vid);

        assertEq(uint256(status), uint256(VerdictExecution.ExecStatus.FAILED));
    }

    function testProcessVerdictExecutesAfterDispute() public {
        bytes32 vid = keccak256(abi.encodePacked("vid2"));
        address market = address(0x200);

        // Register market and resolve it (resolver must call resolve)
        resolution.registerMarket(market, address(0), block.timestamp - 1);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        // Raise a dispute so the market moves to DISPUTED
        vm.prank(address(0xC));
        resolution.dispute(market, "evidence");

        // Now an arbitrator submits a verdict; the router should call settleDispute and succeed
        vm.prank(arbitrator);
        verdictExec.processVerdict(vid, market, Resolution.Outcome.NO);

        (, , , , VerdictExecution.ExecStatus status, ) = verdictExec
            .getExecution(vid);

        assertEq(
            uint256(status),
            uint256(VerdictExecution.ExecStatus.EXECUTED)
        );
    }
}
