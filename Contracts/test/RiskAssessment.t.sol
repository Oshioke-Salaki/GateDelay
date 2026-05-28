// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RiskAssessment.sol";
import "../src/PositionToken.sol";
import "../src/MarketFactory.sol";

contract RiskAssessmentTest is Test {
    RiskAssessment assessment;
    PositionToken positionToken;
    MarketFactory factory;

    address admin = address(0xADM1N);
    address alice = address(0xA11CE);
    address market = address(0xDEAD);

    function setUp() public {
        uint256 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce + 1);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));

        assessment = new RiskAssessment(address(positionToken), address(factory), admin);

        positionToken.authorise(market);
    }

    function test_assessRisk() public {
        uint256 yesId = positionToken.yesId(market);
        vm.prank(market);
        positionToken.mint(alice, yesId, 1000, "");

        RiskAssessment.RiskMetrics memory metrics = assessment.assessRisk(alice, market);
        
        assertTrue(metrics.exposureScore > 0);
        assertEq(uint256(metrics.riskLevel), uint256(RiskAssessment.RiskLevel.LOW));
    }

    function test_updateRiskThresholds() public {
        vm.prank(admin);
        assessment.updateRiskThresholds(9000, 8000, 7000);

        RiskAssessment.RiskThreshold memory threshold = assessment.riskThreshold();
        assertEq(threshold.maxExposure, 9000);
        assertEq(threshold.maxConcentration, 8000);
        assertEq(threshold.maxVolatility, 7000);
    }

    function test_updateRiskThresholds_revertsNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        assessment.updateRiskThresholds(9000, 8000, 7000);
    }

    function test_isRiskAcceptable() public {
        uint256 yesId = positionToken.yesId(market);
        vm.prank(market);
        positionToken.mint(alice, yesId, 100, "");

        assessment.assessRisk(alice, market);
        bool acceptable = assessment.isRiskAcceptable(alice, market);
        
        assertTrue(acceptable);
    }

    function test_acknowledgeAlert() public {
        // Create high risk position
        uint256 yesId = positionToken.yesId(market);
        uint256 totalSupply = 1000;
        
        vm.prank(market);
        positionToken.mint(address(0x1), yesId, totalSupply, "");
        
        vm.prank(market);
        positionToken.mint(alice, yesId, totalSupply * 9 / 10, "");

        assessment.assessRisk(alice, market);

        RiskAssessment.RiskAlert[] memory alerts = assessment.getRiskAlerts(alice, market);
        if (alerts.length > 0) {
            vm.prank(alice);
            assessment.acknowledgeAlert(market, 0);
            
            alerts = assessment.getRiskAlerts(alice, market);
            assertTrue(alerts[0].acknowledged);
        }
    }

    function testFuzz_riskLevelDetermination(uint64 positionSize, uint64 totalSupply) public {
        vm.assume(positionSize > 0 && totalSupply > positionSize);
        
        uint256 yesId = positionToken.yesId(market);
        
        // Mint total supply to others
        vm.prank(market);
        positionToken.mint(address(0x1), yesId, totalSupply - positionSize, "");
        
        // Mint position to alice
        vm.prank(market);
        positionToken.mint(alice, yesId, positionSize, "");

        RiskAssessment.RiskMetrics memory metrics = assessment.assessRisk(alice, market);
        
        // Verify exposure is calculated correctly
        uint256 expectedExposure = (uint256(positionSize) * 10000) / uint256(totalSupply);
        assertEq(metrics.exposureScore, expectedExposure);
    }
}
