// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/VerdictExecution.sol";
import "../src/Resolution.sol";
import "../src/PositionToken.sol";
import "../src/PriceOracle.sol";

contract VerdictExecutionTest is Test {
    VerdictExecution verdictExec;
    Resolution resolution;
    PositionToken pt;
    PriceOracle priceOracle;

    bytes32 constant ORACLE_FEED = keccak256("ORACLE/USD");

    address arbitrator = address(0xA);
    address resolver = address(0xB);

    function setUp() public {
        // Deploy the execution router (arbitrator set to `arbitrator`)
        verdictExec = new VerdictExecution(arbitrator);

        // Deploy a minimal PositionToken (factory set to zero for tests)
        pt = new PositionToken(address(this));

        // Deploy a PriceOracle with a long-lived feed so resolve() freshness checks pass
        priceOracle = new PriceOracle();
        priceOracle.registerFeed(ORACLE_FEED, "Oracle/USD", 365 days);
        priceOracle.setUpdater(address(this), true);
        priceOracle.updatePrice(ORACLE_FEED, 1e18);

        // Deploy Resolution with `verdictExec` as admin so it can call settleDispute
        resolution = new Resolution(
            1 days,
            resolver,
            address(verdictExec),
            address(pt),
            address(priceOracle)
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
        resolution.registerMarket(market, address(0), block.timestamp - 1, ORACLE_FEED);
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

    // -------------------------------------------------------------------------
    // #966 – Verdict execution lifecycle tests
    // -------------------------------------------------------------------------

    function test_verdictLifecycle_queryBeforeProcessingReturnsUnknown() public {
        bytes32 vid = keccak256(abi.encodePacked("vid3"));

        (, , , , VerdictExecution.ExecStatus status, ) = verdictExec.getExecution(vid);
        assertEq(uint256(status), uint256(VerdictExecution.ExecStatus.UNKNOWN));
    }

    function test_verdictLifecycle_nonArbitratorBlocked() public {
        bytes32 vid = keccak256(abi.encodePacked("vid4"));

        vm.prank(address(0xDEAD));
        vm.expectRevert(bytes("Unauthorized"));
        verdictExec.processVerdict(vid, address(0x100), Resolution.Outcome.YES);
    }

    function test_verdictLifecycle_duplicateVerdictReverts() public {
        bytes32 vid = keccak256(abi.encodePacked("vid5"));
        address market = address(0x300);

        // First processing: market is not disputed → recorded as FAILED (not UNKNOWN)
        vm.prank(arbitrator);
        verdictExec.processVerdict(vid, market, Resolution.Outcome.YES);

        // Second processing of the same verdict id must revert
        vm.prank(arbitrator);
        vm.expectRevert(bytes("Already processed"));
        verdictExec.processVerdict(vid, market, Resolution.Outcome.NO);
    }
}
