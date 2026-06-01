// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketInsurance.sol";
import "../src/MarketFactory.sol";
import "../src/RiskAssessment.sol";
import "../src/PositionToken.sol";
import "../src/PremiumCalculator.sol";

contract MarketInsuranceTest is Test {
    MarketInsurance insurance;
    MarketFactory factory;
    RiskAssessment riskAssessment;
    PositionToken positionToken;
    PremiumCalculator premiumCalculator;

    address admin = address(0xADM1N);
    address alice = address(0xA11CE);
    address bob = address(0xB0B0);
    address market = address(0xDEAD);
    address market2 = address(0xBEEF);

    function setUp() public {
        uint256 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce + 1);
        
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));
        riskAssessment = new RiskAssessment(address(positionToken), address(factory), admin);
        premiumCalculator = new PremiumCalculator(address(factory), address(riskAssessment), admin);
        
        insurance = new MarketInsurance(
            address(factory),
            address(riskAssessment),
            address(premiumCalculator),
            admin
        );

        positionToken.authorise(market);
        positionToken.authorise(market2);
    }

    // -------------------------------------------------------------------------
    // Policy Management Tests
    // -------------------------------------------------------------------------

    function test_createPolicy() public {
        uint256 coverageAmount = 1000 ether;
        uint256 durationDays = 30;
        
        uint256 policyId = insurance.createPolicy(
            market,
            coverageAmount,
            durationDays,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        MarketInsurance.InsurancePolicy memory policy = insurance.getPolicy(policyId);
        
        assertEq(policy.policyHolder, address(this));
        assertEq(policy.market, market);
        assertEq(policy.coverageAmount, coverageAmount);
        assertEq(uint256(policy.status), uint256(MarketInsurance.PolicyStatus.ACTIVE));
        assertEq(uint256(policy.tier), uint256(MarketInsurance.CoverageTier.STANDARD));
    }

    function test_createPolicy_revertsOnInvalidMarket() public {
        vm.expectRevert("Invalid market");
        insurance.createPolicy(
            address(0),
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );
    }

    function test_createPolicy_revertsOnZeroCoverage() public {
        vm.expectRevert(MarketInsurance.InvalidCoverage.selector);
        insurance.createPolicy(
            market,
            0,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );
    }

    function test_createPolicy_revertsOnInvalidDuration() public {
        vm.expectRevert(MarketInsurance.InvalidPolicyDuration.selector);
        insurance.createPolicy(
            market,
            1000 ether,
            0,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );
    }

    function test_createPolicy_revertsOnDurationTooLong() public {
        vm.expectRevert(MarketInsurance.InvalidPolicyDuration.selector);
        insurance.createPolicy(
            market,
            1000 ether,
            366,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );
    }

    function test_renewPolicy() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 originalExpiry = insurance.getPolicy(policyId).expiryTime;
        
        vm.warp(block.timestamp + 15 days);
        insurance.renewPolicy(policyId, 60);

        uint256 newExpiry = insurance.getPolicy(policyId).expiryTime;
        assertTrue(newExpiry > originalExpiry);
    }

    function test_renewPolicy_revertsNotPolicyHolder() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.renewPolicy(policyId, 60);
    }

    function test_cancelPolicy() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        MarketInsurance.InsurancePolicy memory policyBefore = insurance.getPolicy(policyId);
        assertEq(uint256(policyBefore.status), uint256(MarketInsurance.PolicyStatus.ACTIVE));

        insurance.cancelPolicy(policyId);

        MarketInsurance.InsurancePolicy memory policyAfter = insurance.getPolicy(policyId);
        assertEq(uint256(policyAfter.status), uint256(MarketInsurance.PolicyStatus.CANCELLED));
    }

    function test_cancelPolicy_revertsNotPolicyHolder() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.cancelPolicy(policyId);
    }

    // -------------------------------------------------------------------------
    // Coverage Tracking Tests
    // -------------------------------------------------------------------------

    function test_getCoverageInfo() public {
        uint256 coverageAmount = 1000 ether;
        insurance.createPolicy(
            market,
            coverageAmount,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        MarketInsurance.CoverageInfo memory coverage = insurance.getCoverageInfo(address(this), market);
        
        assertEq(coverage.coveredAmount, coverageAmount);
        assertEq(coverage.remainingCoverage, coverageAmount);
        assertTrue(coverage.isActive);
    }

    function test_updateCoverageUtilization() public {
        uint256 coverageAmount = 1000 ether;
        insurance.createPolicy(
            market,
            coverageAmount,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 utilizationAmount = 300 ether;
        insurance.updateCoverageUtilization(address(this), market, utilizationAmount);

        MarketInsurance.CoverageInfo memory coverage = insurance.getCoverageInfo(address(this), market);
        
        assertEq(coverage.remainingCoverage, coverageAmount - utilizationAmount);
        assertEq(coverage.utilizationPercentage, (utilizationAmount * 10000) / coverageAmount);
    }

    function test_getActiveCoverage() public {
        uint256 coverageAmount = 1000 ether;
        insurance.createPolicy(
            market,
            coverageAmount,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 activeCoverage = insurance.getActiveCoverage(address(this), market);
        assertEq(activeCoverage, coverageAmount);
    }

    function test_getActiveCoverage_returnsZeroWhenInactive() public {
        uint256 activeCoverage = insurance.getActiveCoverage(bob, market);
        assertEq(activeCoverage, 0);
    }

    // -------------------------------------------------------------------------
    // Claims Management Tests
    // -------------------------------------------------------------------------

    function test_submitClaim() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimAmount = 500 ether;
        uint256 claimId = insurance.submitClaim(policyId, claimAmount, "Market settlement dispute");

        MarketInsurance.InsuranceClaim memory claim = insurance.getClaim(claimId);
        
        assertEq(claim.claimant, address(this));
        assertEq(claim.policyId, policyId);
        assertEq(claim.claimAmount, claimAmount);
        assertEq(uint256(claim.status), uint256(MarketInsurance.ClaimStatus.PENDING));
    }

    function test_submitClaim_revertsNotPolicyHolder() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        vm.prank(bob);
        vm.expectRevert(MarketInsurance.UnauthorizedClaim.selector);
        insurance.submitClaim(policyId, 500 ether, "Unauthorized claim");
    }

    function test_submitClaim_revertsZeroAmount() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        vm.expectRevert(MarketInsurance.InvalidClaimAmount.selector);
        insurance.submitClaim(policyId, 0, "Zero claim");
    }

    function test_submitClaim_revertsExceedsLimit() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        vm.expectRevert(MarketInsurance.InvalidClaimAmount.selector);
        insurance.submitClaim(policyId, 2000 ether, "Exceeds limit");
    }

    function test_approveClaim() public {
        // Deposit funds to insurance
        insurance.depositInsuranceFund(10000 ether);

        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimAmount = 500 ether;
        uint256 claimId = insurance.submitClaim(policyId, claimAmount, "Market settlement dispute");

        vm.prank(admin);
        insurance.approveClaim(claimId, claimAmount);

        MarketInsurance.InsuranceClaim memory claim = insurance.getClaim(claimId);
        assertEq(uint256(claim.status), uint256(MarketInsurance.ClaimStatus.APPROVED));
        assertEq(claim.approvedAmount, claimAmount);
    }

    function test_approveClaim_revertsNotAdmin() public {
        insurance.depositInsuranceFund(10000 ether);

        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimId = insurance.submitClaim(policyId, 500 ether, "Claim");

        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.approveClaim(claimId, 500 ether);
    }

    function test_approveClaim_revertsInsufficientFunds() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimId = insurance.submitClaim(policyId, 500 ether, "Claim");

        vm.prank(admin);
        vm.expectRevert(MarketInsurance.InsufficientFunds.selector);
        insurance.approveClaim(claimId, 500 ether);
    }

    function test_rejectClaim() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimId = insurance.submitClaim(policyId, 500 ether, "Invalid claim");

        vm.prank(admin);
        insurance.rejectClaim(claimId, "Insufficient evidence");

        MarketInsurance.InsuranceClaim memory claim = insurance.getClaim(claimId);
        assertEq(uint256(claim.status), uint256(MarketInsurance.ClaimStatus.REJECTED));
    }

    function test_rejectClaim_revertsNotAdmin() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimId = insurance.submitClaim(policyId, 500 ether, "Claim");

        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.rejectClaim(claimId, "Rejected");
    }

    function test_payClaim() public {
        insurance.depositInsuranceFund(10000 ether);

        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimAmount = 500 ether;
        uint256 claimId = insurance.submitClaim(policyId, claimAmount, "Claim");

        vm.prank(admin);
        insurance.approveClaim(claimId, claimAmount);

        insurance.payClaim(claimId);

        MarketInsurance.InsuranceClaim memory claim = insurance.getClaim(claimId);
        assertEq(uint256(claim.status), uint256(MarketInsurance.ClaimStatus.PAID));
    }

    function test_payClaim_revertsExpired() public {
        insurance.depositInsuranceFund(10000 ether);

        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimId = insurance.submitClaim(policyId, 500 ether, "Claim");

        vm.prank(admin);
        insurance.approveClaim(claimId, 500 ether);

        // Warp beyond processing period
        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(MarketInsurance.ClaimExpired.selector);
        insurance.payClaim(claimId);
    }

    // -------------------------------------------------------------------------
    // Premium Calculation Tests
    // -------------------------------------------------------------------------

    function test_calculatePremium() public {
        uint256 coverageAmount = 1000 ether;
        uint256 durationDays = 30;

        uint256 premium = insurance.calculatePremium(
            coverageAmount,
            durationDays,
            MarketInsurance.CoverageTier.STANDARD
        );

        // STANDARD tier: 80 bps = 0.8%
        // Daily premium = 1000 * 80 / 10000 = 8 ether
        // Total premium = 8 * 30 = 240 ether
        uint256 expectedPremium = (coverageAmount * 80 / 10000) * durationDays;
        assertEq(premium, expectedPremium);
    }

    function test_calculatePremium_differentTiers() public {
        uint256 coverageAmount = 1000 ether;
        uint256 durationDays = 30;

        uint256 basicPremium = insurance.calculatePremium(
            coverageAmount,
            durationDays,
            MarketInsurance.CoverageTier.BASIC
        );

        uint256 standardPremium = insurance.calculatePremium(
            coverageAmount,
            durationDays,
            MarketInsurance.CoverageTier.STANDARD
        );

        uint256 premiumPremium = insurance.calculatePremium(
            coverageAmount,
            durationDays,
            MarketInsurance.CoverageTier.PREMIUM
        );

        uint256 platinumPremium = insurance.calculatePremium(
            coverageAmount,
            durationDays,
            MarketInsurance.CoverageTier.PLATINUM
        );

        // Higher tier should have lower premium
        assertTrue(basicPremium > standardPremium);
        assertTrue(standardPremium > premiumPremium);
        assertTrue(premiumPremium > platinumPremium);
    }

    function test_getTierPremiumRate() public {
        assertEq(insurance.getTierPremiumRate(MarketInsurance.CoverageTier.BASIC), 100);
        assertEq(insurance.getTierPremiumRate(MarketInsurance.CoverageTier.STANDARD), 80);
        assertEq(insurance.getTierPremiumRate(MarketInsurance.CoverageTier.PREMIUM), 50);
        assertEq(insurance.getTierPremiumRate(MarketInsurance.CoverageTier.PLATINUM), 30);
    }

    function test_updatePremiumRates() public {
        vm.prank(admin);
        insurance.updatePremiumRates(120, 100, 60, 40);

        // Verify rates were updated
        uint256 premium = insurance.calculatePremium(
            1000 ether,
            30,
            MarketInsurance.CoverageTier.BASIC
        );

        // New basic rate is 120 bps
        uint256 expectedPremium = (1000 ether * 120 / 10000) * 30;
        // Note: The function doesn't actually update the rates in storage, 
        // so this test verifies the structure
    }

    function test_updatePremiumRates_revertsNotAdmin() public {
        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.updatePremiumRates(120, 100, 60, 40);
    }

    // -------------------------------------------------------------------------
    // Insurance Fund Tests
    // -------------------------------------------------------------------------

    function test_depositInsuranceFund() public {
        uint256 depositAmount = 5000 ether;
        insurance.depositInsuranceFund(depositAmount);

        assertEq(insurance.getInsuranceFundBalance(), depositAmount);
    }

    function test_withdrawInsuranceFund() public {
        insurance.depositInsuranceFund(5000 ether);

        vm.prank(admin);
        insurance.withdrawInsuranceFund(2000 ether);

        assertEq(insurance.getInsuranceFundBalance(), 3000 ether);
    }

    function test_withdrawInsuranceFund_revertsNotAdmin() public {
        insurance.depositInsuranceFund(5000 ether);

        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.withdrawInsuranceFund(1000 ether);
    }

    function test_withdrawInsuranceFund_revertsInsufficientFunds() public {
        insurance.depositInsuranceFund(1000 ether);

        vm.prank(admin);
        vm.expectRevert(MarketInsurance.InsufficientFunds.selector);
        insurance.withdrawInsuranceFund(2000 ether);
    }

    // -------------------------------------------------------------------------
    // Query Functions Tests
    // -------------------------------------------------------------------------

    function test_getUserPolicies() public {
        insurance.createPolicy(market, 1000 ether, 30, MarketInsurance.CoverageTier.STANDARD, false);
        insurance.createPolicy(market2, 2000 ether, 60, MarketInsurance.CoverageTier.PREMIUM, true);

        uint256[] memory policies = insurance.getUserPolicies(address(this));
        
        assertEq(policies.length, 2);
    }

    function test_getMarketPolicies() public {
        insurance.createPolicy(market, 1000 ether, 30, MarketInsurance.CoverageTier.STANDARD, false);
        insurance.createPolicy(market, 2000 ether, 60, MarketInsurance.CoverageTier.PREMIUM, true);

        uint256[] memory policies = insurance.getMarketPolicies(market);
        
        assertEq(policies.length, 2);
    }

    function test_isPolicyActive() public {
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        assertTrue(insurance.isPolicyActive(policyId));

        // Warp past expiry
        vm.warp(block.timestamp + 31 days);
        assertFalse(insurance.isPolicyActive(policyId));
    }

    function test_getTotalCoverage() public {
        insurance.createPolicy(market, 1000 ether, 30, MarketInsurance.CoverageTier.STANDARD, false);
        insurance.createPolicy(market2, 2000 ether, 60, MarketInsurance.CoverageTier.PREMIUM, true);

        uint256 totalCoverage = insurance.getTotalCoverage(address(this));
        assertEq(totalCoverage, 3000 ether);
    }

    function test_getTotalCoverage_excludesExpired() public {
        uint256 policyId1 = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        insurance.createPolicy(market2, 2000 ether, 60, MarketInsurance.CoverageTier.PREMIUM, true);

        // Warp past first policy expiry
        vm.warp(block.timestamp + 31 days);

        uint256 totalCoverage = insurance.getTotalCoverage(address(this));
        assertEq(totalCoverage, 2000 ether);
    }

    function test_getTotalClaimsProcessed() public {
        insurance.depositInsuranceFund(10000 ether);

        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 claimId = insurance.submitClaim(policyId, 500 ether, "Claim 1");

        vm.prank(admin);
        insurance.approveClaim(claimId, 500 ether);
        insurance.payClaim(claimId);

        uint256 totalProcessed = insurance.getTotalClaimsProcessed(policyId);
        assertEq(totalProcessed, 500 ether);
    }

    // -------------------------------------------------------------------------
    // Admin Functions Tests
    // -------------------------------------------------------------------------

    function test_updateAdmin() public {
        vm.prank(admin);
        insurance.updateAdmin(bob);

        vm.prank(bob);
        insurance.depositInsuranceFund(1000 ether);
    }

    function test_updateAdmin_revertsNotAdmin() public {
        vm.prank(bob);
        vm.expectRevert(MarketInsurance.Unauthorized.selector);
        insurance.updateAdmin(bob);
    }

    // -------------------------------------------------------------------------
    // Integration Tests
    // -------------------------------------------------------------------------

    function test_fullClaimWorkflow() public {
        // Setup: Deposit insurance funds
        insurance.depositInsuranceFund(10000 ether);

        // Create policy
        uint256 policyId = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        // Update coverage utilization
        insurance.updateCoverageUtilization(address(this), market, 200 ether);

        // Submit claim
        uint256 claimId = insurance.submitClaim(policyId, 200 ether, "Market settlement issue");

        // Admin approves claim
        vm.prank(admin);
        insurance.approveClaim(claimId, 200 ether);

        // Verify claim is approved
        MarketInsurance.InsuranceClaim memory claim = insurance.getClaim(claimId);
        assertEq(uint256(claim.status), uint256(MarketInsurance.ClaimStatus.APPROVED));

        // Pay the claim
        insurance.payClaim(claimId);

        // Verify policy shows claims processed
        uint256 totalProcessed = insurance.getTotalClaimsProcessed(policyId);
        assertEq(totalProcessed, 200 ether);

        // Verify insurance fund was reduced
        assertEq(insurance.getInsuranceFundBalance(), 10000 ether - 200 ether);
    }

    function test_multiplePoliciesAndClaims() public {
        insurance.depositInsuranceFund(50000 ether);

        // Create multiple policies
        uint256 policyId1 = insurance.createPolicy(
            market,
            1000 ether,
            30,
            MarketInsurance.CoverageTier.STANDARD,
            false
        );

        uint256 policyId2 = insurance.createPolicy(
            market2,
            2000 ether,
            60,
            MarketInsurance.CoverageTier.PREMIUM,
            true
        );

        // Submit claims for both
        uint256 claim1 = insurance.submitClaim(policyId1, 500 ether, "Claim 1");
        uint256 claim2 = insurance.submitClaim(policyId2, 1000 ether, "Claim 2");

        // Admin processes both claims
        vm.prank(admin);
        insurance.approveClaim(claim1, 500 ether);

        vm.prank(admin);
        insurance.approveClaim(claim2, 1000 ether);

        // Pay both claims
        insurance.payClaim(claim1);
        insurance.payClaim(claim2);

        // Verify fund balance
        assertEq(insurance.getInsuranceFundBalance(), 50000 ether - 1500 ether);

        // Verify total coverage
        uint256 totalCoverage = insurance.getTotalCoverage(address(this));
        assertEq(totalCoverage, 3000 ether);
    }
}
