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
}
