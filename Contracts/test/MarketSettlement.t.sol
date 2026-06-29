// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketSettlement.sol";
import "../src/PositionToken.sol";
import "../src/MarketFactory.sol";
import "../src/LiquidityPool.sol";
import "../src/Resolution.sol";
import "../src/ERC20Token.sol";

contract MarketSettlementTest is Test {
    MarketSettlement settlement;
    PositionToken positionToken;
    MarketFactory factory;
    LiquidityPool pool;
    Resolution resolution;
    ERC20Token collateral;

    address resolver = address(0xBEEF1);
    address admin = address(0xBEEF2);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address market = address(0xDEAD);

    function setUp() public {
        collateral = new ERC20Token(1_000_000);

        uint256 nonce = vm.getNonce(address(this));
        address predictedFactory = vm.computeCreateAddress(address(this), nonce + 1);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));

        positionToken.authorise(market);

        pool = new LiquidityPool(address(collateral), market);
        
        resolution = new Resolution(
            1 days,
            resolver,
            admin,
            address(positionToken)
        );

        pool.setResolution(address(resolution));
        positionToken.authoriseBurner(address(resolution));

        resolution.registerMarket(market, address(pool), block.timestamp + 2 hours);

        settlement = new MarketSettlement(
            address(positionToken),
            address(factory),
            address(resolution)
        );

        // Fund pool
        collateral.approve(address(pool), 10_000 ether);
        pool.deposit(10_000 ether);
    }

    function test_initiateSettlement() public {
        // Resolve market first
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        settlement.initiateSettlement(market, address(pool));

        MarketSettlement.Settlement memory s = settlement.getSettlement(market);
        assertEq(s.totalAmount, 10_000 ether);
        assertEq(uint256(s.status), uint256(MarketSettlement.SettlementStatus.PENDING));
    }

    function test_processPayout() public {
        // Resolve and initiate settlement
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        settlement.initiateSettlement(market, address(pool));

        // Process payout
        settlement.processPayout(market, alice, 1000 ether);

        uint256 claimed = settlement.getClaimedPayout(market, alice);
        assertEq(claimed, 1000 ether);

        MarketSettlement.Settlement memory s = settlement.getSettlement(market);
        assertEq(s.distributedAmount, 1000 ether);
        assertEq(s.remainingAmount, 9000 ether);
    }

    function test_processBatchPayouts() public {
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        settlement.initiateSettlement(market, address(pool));

        address[] memory users = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        users[0] = alice;
        users[1] = bob;
        amounts[0] = 3000 ether;
        amounts[1] = 2000 ether;

        settlement.processBatchPayouts(market, users, amounts);

        assertEq(settlement.getClaimedPayout(market, alice), 3000 ether);
        assertEq(settlement.getClaimedPayout(market, bob), 2000 ether);

        MarketSettlement.Settlement memory s = settlement.getSettlement(market);
        assertEq(s.distributedAmount, 5000 ether);
        assertEq(s.participantCount, 2);
    }

    function test_settlementComplete() public {
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        settlement.initiateSettlement(market, address(pool));

        // Distribute all funds
        settlement.processPayout(market, alice, 10_000 ether);

        assertTrue(settlement.isSettlementComplete(market));
        
        MarketSettlement.SettlementStatus status = settlement.getSettlementStatus(market);
        assertEq(uint256(status), uint256(MarketSettlement.SettlementStatus.COMPLETE));
    }

    function test_processPayout_revertsAlreadySettled() public {
        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        settlement.initiateSettlement(market, address(pool));
        settlement.processPayout(market, alice, 10_000 ether);

        vm.expectRevert(MarketSettlement.AlreadySettled.selector);
        settlement.processPayout(market, bob, 100 ether);
    }

    function testFuzz_partialSettlement(uint128 amount1, uint128 amount2) public {
        uint256 total = 10_000 ether;
        vm.assume(amount1 > 0 && amount2 > 0);
        vm.assume(uint256(amount1) + uint256(amount2) <= total);

        vm.warp(block.timestamp + 3 hours);
        vm.prank(resolver);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("data"));

        settlement.initiateSettlement(market, address(pool));

        settlement.processPayout(market, alice, amount1);
        settlement.processPayout(market, bob, amount2);

        MarketSettlement.Settlement memory s = settlement.getSettlement(market);
        assertEq(s.distributedAmount, uint256(amount1) + uint256(amount2));
        assertEq(s.remainingAmount, total - uint256(amount1) - uint256(amount2));
    }
}
