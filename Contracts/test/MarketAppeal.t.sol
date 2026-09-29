// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketAppeal.sol";

contract MarketAppealTest is Test {
    MarketAppeal appeal;

    address alice = address(0xA);

    function setUp() public {
        appeal = new MarketAppeal();
    }

    function testSubmitAndQueryAppeal() public {
        vm.prank(alice);
        bytes32 id = appeal.submitAppeal(address(0x100), "ipfs://evidence");

        (
            address market,
            address appellant,
            string memory uri,
            ,
            MarketAppeal.AppealStatus status,
            ,
            ,

        ) = appeal.getAppeal(id);

        assertEq(market, address(0x100));
        assertEq(appellant, alice);
        assertEq(uri, "ipfs://evidence");
        assertEq(uint256(status), uint256(MarketAppeal.AppealStatus.SUBMITTED));
    }

    function testReviewAndDecide() public {
        vm.prank(alice);
        bytes32 id = appeal.submitAppeal(address(0x200), "evidence2");

        // Start review as owner (test contract)
        appeal.startReview(id);

        // Decide the appeal
        appeal.decideAppeal(
            id,
            true,
            "upheld",
            keccak256(abi.encodePacked("v1"))
        );

        (
            ,
            ,
            ,
            ,
            MarketAppeal.AppealStatus status,
            bool accepted,
            string memory reason,

        ) = appeal.getAppeal(id);

        assertEq(uint256(status), uint256(MarketAppeal.AppealStatus.DECIDED));
        assertTrue(accepted);
        assertEq(reason, "upheld");
    }

    function test_NonOwnerCannotStartOrDecideAppeal() public {
        vm.prank(alice);
        bytes32 id = appeal.submitAppeal(address(0x200), "evidence");

        vm.prank(alice);
        vm.expectRevert(bytes("Not owner"));
        appeal.startReview(id);

        vm.prank(alice);
        vm.expectRevert(bytes("Not owner"));
        appeal.decideAppeal(id, true, "upheld", bytes32(0));
    }

    // -------------------------------------------------------------------------
    // #966 – Appeal lifecycle tests
    // -------------------------------------------------------------------------

    function test_appealLifecycle_cannotDecideWithoutStartingReview() public {
        vm.prank(alice);
        bytes32 id = appeal.submitAppeal(address(0x300), "evidence");

        // status is SUBMITTED; decideAppeal requires UNDER_REVIEW
        vm.expectRevert(bytes("Not under review"));
        appeal.decideAppeal(id, true, "upheld", bytes32(0));
    }

    function test_appealLifecycle_cannotStartReviewTwice() public {
        vm.prank(alice);
        bytes32 id = appeal.submitAppeal(address(0x400), "evidence");

        appeal.startReview(id);

        // Already UNDER_REVIEW; startReview requires SUBMITTED
        vm.expectRevert(bytes("Not submitted"));
        appeal.startReview(id);
    }

    function test_appealLifecycle_allStatusTransitionsSucceed() public {
        vm.prank(alice);
        bytes32 id = appeal.submitAppeal(address(0x500), "ipfs://flight-evidence");

        (, , , , MarketAppeal.AppealStatus s1, , , ) = appeal.getAppeal(id);
        assertEq(uint256(s1), uint256(MarketAppeal.AppealStatus.SUBMITTED));

        appeal.startReview(id);
        (, , , , MarketAppeal.AppealStatus s2, , , ) = appeal.getAppeal(id);
        assertEq(uint256(s2), uint256(MarketAppeal.AppealStatus.UNDER_REVIEW));

        bytes32 vId = keccak256(abi.encodePacked("verdict1"));
        appeal.decideAppeal(id, false, "rejected: no merit", vId);
        (, , , , MarketAppeal.AppealStatus s3, bool accepted, , bytes32 storedVId) = appeal.getAppeal(id);
        assertEq(uint256(s3), uint256(MarketAppeal.AppealStatus.DECIDED));
        assertFalse(accepted);
        assertEq(storedVId, vId);
    }
}
