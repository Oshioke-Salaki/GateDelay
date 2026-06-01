// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ClaimContract.sol";

contract ClaimContractTest is Test {
    ClaimContract claimContract;
    address owner = address(0x1);
    address alice = address(0xA11CE);
    address bob = address(0xB0B0);
    address market = address(0xDEAD);

    function setUp() public {
        vm.prank(owner);
        claimContract = new ClaimContract();
    }

    function test_submitClaim_succeeds() public {
        vm.prank(alice);
        uint256 claimId = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.RESOLUTION,
            100 ether,
            block.timestamp - 1 days,
            "Market outcome dispute"
        );

        ClaimContract.Claim memory claim = claimContract.getClaim(claimId);
        assertEq(claim.claimant, alice);
        assertEq(claim.market, market);
        assertEq(
            uint256(claim.claimType),
            uint256(ClaimContract.ClaimType.RESOLUTION)
        );
        assertEq(claim.amountRequested, 100 ether);
        assertEq(
            uint256(claim.status),
            uint256(ClaimContract.ClaimStatus.PENDING)
        );
    }

    function test_submitClaim_revertsInvalidMarket() public {
        vm.prank(alice);
        vm.expectRevert(ClaimContract.InvalidMarket.selector);
        claimContract.submitClaim(
            address(0),
            ClaimContract.ClaimType.RESOLUTION,
            100 ether,
            block.timestamp - 1 days,
            "No market"
        );
    }

    function test_submitClaim_revertsInvalidAmount() public {
        vm.prank(alice);
        vm.expectRevert(ClaimContract.InvalidAmount.selector);
        claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.RESOLUTION,
            0,
            block.timestamp - 1 days,
            "Zero amount"
        );
    }

    function test_submitClaim_revertsInvalidReason() public {
        vm.prank(alice);
        vm.expectRevert(ClaimContract.InvalidReason.selector);
        claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.RESOLUTION,
            100 ether,
            block.timestamp - 1 days,
            ""
        );
    }

    function test_submitClaim_revertsInvalidIncidentTime_future() public {
        vm.prank(alice);
        vm.expectRevert(ClaimContract.InvalidIncidentTime.selector);
        claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.RESOLUTION,
            100 ether,
            block.timestamp + 1 days,
            "Future incident"
        );
    }

    function test_submitClaim_revertsInvalidIncidentTime_old() public {
        vm.prank(alice);
        vm.expectRevert(ClaimContract.InvalidIncidentTime.selector);
        claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.RESOLUTION,
            100 ether,
            block.timestamp - 100 days,
            "Too old"
        );
    }

    function test_validateClaim_eligible() public {
        vm.prank(alice);
        uint256 claimId = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.LIQUIDITY,
            200 ether,
            block.timestamp - 1 days,
            "Liquidity event"
        );

        vm.prank(owner);
        bool eligible = claimContract.validateClaim(claimId);

        assertTrue(eligible);
        assertEq(
            uint256(claimContract.getClaimStatus(claimId)),
            uint256(ClaimContract.ClaimStatus.VALIDATED)
        );
        assertEq(claimContract.getClaimPayout(claimId), 160 ether);
    }

    function test_validateClaim_rejectedForIneligibleClaim() public {
        vm.prank(alice);
        uint256 claimId = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.FRAUD,
            150 ether,
            block.timestamp - 100 days,
            "Expired claim"
        );

        vm.prank(owner);
        bool eligible = claimContract.validateClaim(claimId);

        assertFalse(eligible);
        assertEq(
            uint256(claimContract.getClaimStatus(claimId)),
            uint256(ClaimContract.ClaimStatus.REJECTED)
        );
        assertEq(claimContract.getClaimPayout(claimId), 0);
    }

    function test_approveAndPayClaim() public {
        vm.prank(alice);
        uint256 claimId = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.OPERATIONAL,
            100 ether,
            block.timestamp - 1 days,
            "Operational loss"
        );

        vm.prank(owner);
        claimContract.validateClaim(claimId);
        claimContract.approveClaim(claimId);
        claimContract.payClaim(claimId);

        assertEq(
            uint256(claimContract.getClaimStatus(claimId)),
            uint256(ClaimContract.ClaimStatus.PAID)
        );
        assertEq(claimContract.getClaimPayout(claimId), 70 ether);
    }

    function test_approveClaim_revertsWhenNotValidated() public {
        vm.prank(alice);
        uint256 claimId = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.RESOLUTION,
            100 ether,
            block.timestamp - 1 days,
            "Resolution dispute"
        );

        vm.prank(owner);
        vm.expectRevert(ClaimContract.ClaimNotValidated.selector);
        claimContract.approveClaim(claimId);
    }

    function test_payClaim_revertsWhenNotApproved() public {
        vm.prank(alice);
        uint256 claimId = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.LIQUIDITY,
            100 ether,
            block.timestamp - 1 days,
            "Liquidity issue"
        );

        vm.prank(owner);
        vm.expectRevert(ClaimContract.ClaimNotApproved.selector);
        claimContract.payClaim(claimId);
    }

    function test_queryFunctions() public {
        vm.prank(alice);
        uint256 claimId1 = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.LIQUIDITY,
            50 ether,
            block.timestamp - 2 days,
            "Claim one"
        );

        vm.prank(alice);
        uint256 claimId2 = claimContract.submitClaim(
            market,
            ClaimContract.ClaimType.FRAUD,
            80 ether,
            block.timestamp - 1 days,
            "Claim two"
        );

        uint256[] memory userClaims = claimContract.getClaimsByUser(alice);
        uint256[] memory marketClaims = claimContract.getClaimsByMarket(market);

        assertEq(userClaims.length, 2);
        assertEq(marketClaims.length, 2);
        assertEq(userClaims[0], claimId1);
        assertEq(userClaims[1], claimId2);
        assertEq(marketClaims[0], claimId1);
        assertEq(marketClaims[1], claimId2);

        assertTrue(claimContract.isClaimEligible(claimId1));
        assertEq(claimContract.getClaimCount(), 2);
    }

    function test_updatePayoutRate_and_transferOwnership() public {
        vm.prank(owner);
        claimContract.updatePayoutRate(ClaimContract.ClaimType.FRAUD, 5_000);
        assertEq(
            claimContract.payoutRatesBps(ClaimContract.ClaimType.FRAUD),
            5_000
        );

        vm.prank(owner);
        claimContract.transferOwnership(bob);

        vm.prank(bob);
        claimContract.updatePayoutRate(ClaimContract.ClaimType.FRAUD, 4_000);
        assertEq(
            claimContract.payoutRatesBps(ClaimContract.ClaimType.FRAUD),
            4_000
        );
    }

    function test_updatePayoutRate_revertsInvalidRate() public {
        vm.prank(owner);
        vm.expectRevert(ClaimContract.InvalidPayout.selector);
        claimContract.updatePayoutRate(ClaimContract.ClaimType.LIQUIDITY, 0);
    }
}
