// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/JurySelection.sol";

contract JurySelectionTest is Test {
    JurySelection jury;

    address[] candidates;

    function setUp() public {
        jury = new JurySelection();
        // build candidate list
        for (uint256 i = 1; i <= 10; i++) {
            candidates.push(address(uint160(i)));
        }
    }

    function testSelectJury() public {
        bytes32 jid = keccak256(abi.encodePacked("j1"));
        jury.selectJury(jid, candidates, 5, 123);

        address[] memory members = jury.getJury(jid);
        assertEq(members.length, 5);

        // all members should be marked as jurors
        for (uint256 i = 0; i < members.length; i++) {
            assertTrue(jury.isMember(jid, members[i]));
        }
    }

    function testParticipationTracking() public {
        bytes32 jid = keccak256(abi.encodePacked("j2"));
        jury.selectJury(jid, candidates, 3, 999);
        address[] memory members = jury.getJury(jid);

        // simulate one member participating
        vm.prank(members[0]);
        jury.recordParticipation(jid);
        assertTrue(jury.hasParticipated(jid, members[0]));

        // cannot participate twice
        vm.prank(members[0]);
        vm.expectRevert("Already participated");
        jury.recordParticipation(jid);
    }

    function testSelectInvalidCandidatesFails() public {
        bytes32 jid = keccak256(abi.encodePacked("j3"));
        // duplicate candidate should still allow selection because uniqueness is enforced per jury
        address[] memory bad = new address[](2);
        bad[0] = address(1);
        bad[1] = address(0);

        vm.expectRevert("Invalid candidate");
        jury.selectJury(jid, bad, 2, 1);
    }
}
