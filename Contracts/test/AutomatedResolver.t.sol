// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/AutomatedResolver.sol";
import "../src/Resolution.sol";
import "../src/PositionToken.sol";
import "../src/LiquidityPool.sol";
import "../src/ERC20Token.sol";

contract AutomatedResolverTest is Test {
    AutomatedResolver public resolver;
    Resolution public resolution;
    PositionToken public positionToken;
    LiquidityPool public pool;
    ERC20Token public collateral;

    address public admin = address(0xADMIN);
    address public resolverAddr = address(0xRESOLVER);
    address public market = address(0xMARKET);

    bytes32 public constant DATA_FEED_BTC = keccak256("BTC/USD");
    bytes32 public constant DATA_FEED_ETH = keccak256("ETH/USD");

    function setUp() public {
        collateral = new ERC20Token(1_000_000 ether);
        positionToken = new PositionToken(address(this));
        
        resolution = new Resolution(
            1 days,
            resolverAddr,
            admin,
            address(positionToken)
        );

        resolver = new AutomatedResolver(address(resolution), admin);

        pool = new LiquidityPool(address(collateral), market);
        pool.setResolution(address(resolution));

        resolution.registerMarket(market, address(pool), block.timestamp + 1 hours);
    }

    function test_registerCondition() public {
        vm.prank(admin);
        resolver.registerCondition(
            market,
            block.timestamp + 1 days,
            DATA_FEED_BTC,
            50000e8,
            true
        );

        AutomatedResolver.ResolutionCondition memory condition = resolver.getCondition(market);
        assertEq(condition.targetTimestamp, block.timestamp + 1 days);
        assertEq(condition.dataFeedId, DATA_FEED_BTC);
        assertEq(condition.threshold, 50000e8);
        assertTrue(condition.isGreaterThan);
        assertTrue(condition.isActive);
    }

    function test_registerCondition_revertsNotAuthorized() public {
        vm.expectRevert(AutomatedResolver.NotAuthorized.selector);
        resolver.registerCondition(market, block.timestamp + 1 days, DATA_FEED_BTC, 50000e8, true);
    }

    function test_updateDataFeed() public {
        vm.prank(admin);
        resolver.updateDataFeed(DATA_FEED_BTC, 55000e8);

        assertEq(resolver.getDataFeedValue(DATA_FEED_BTC), 55000e8);
    }

    function test_checkUpkeep_conditionNotMet() public {
        vm.startPrank(admin);
        resolver.registerCondition(market, block.timestamp + 1 days, DATA_FEED_BTC, 50000e8, true);
        resolver.updateDataFeed(DATA_FEED_BTC, 45000e8);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 days);

        (bool upkeepNeeded,) = resolver.checkUpkeep(abi.encode(market));
        assertFalse(upkeepNeeded);
    }

    function test_checkUpkeep_conditionMet() public {
        vm.startPrank(admin);
        resolver.registerCondition(market, block.timestamp + 1 days, DATA_FEED_BTC, 50000e8, true);
        resolver.updateDataFeed(DATA_FEED_BTC, 55000e8);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 days);

        (bool upkeepNeeded, bytes memory performData) = resolver.checkUpkeep(abi.encode(market));
        assertTrue(upkeepNeeded);
        
        (address returnedMarket, Resolution.Outcome outcome, int256 value) = 
            abi.decode(performData, (address, Resolution.Outcome, int256));
        
        assertEq(returnedMarket, market);
        assertEq(uint256(outcome), uint256(Resolution.Outcome.YES));
        assertEq(value, 55000e8);
    }

    function test_checkUpkeep_beforeTargetTimestamp() public {
        vm.startPrank(admin);
        resolver.registerCondition(market, block.timestamp + 1 days, DATA_FEED_BTC, 50000e8, true);
        resolver.updateDataFeed(DATA_FEED_BTC, 55000e8);
        vm.stopPrank();

        (bool upkeepNeeded,) = resolver.checkUpkeep(abi.encode(market));
        assertFalse(upkeepNeeded);
    }

    function test_manualTrigger() public {
        vm.startPrank(admin);
        resolver.registerCondition(market, block.timestamp + 1 days, DATA_FEED_BTC, 50000e8, true);
        resolver.updateDataFeed(DATA_FEED_BTC, 55000e8);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(resolverAddr);
        resolution.resolve(market, Resolution.Outcome.YES, bytes("manual"));
    }

    function test_deactivateCondition() public {
        vm.startPrank(admin);
        resolver.registerCondition(market, block.timestamp + 1 days, DATA_FEED_BTC, 50000e8, true);
        
        AutomatedResolver.ResolutionCondition memory conditionBefore = resolver.getCondition(market);
        assertTrue(conditionBefore.isActive);

        resolver.deactivateCondition(market);
        vm.stopPrank();

        AutomatedResolver.ResolutionCondition memory conditionAfter = resolver.getCondition(market);
        assertFalse(conditionAfter.isActive);
    }

    function testFuzz_registerCondition(
        uint256 targetTimestamp,
        int256 threshold,
        bool isGreaterThan
    ) public {
        targetTimestamp = bound(targetTimestamp, block.timestamp, block.timestamp + 365 days);
        threshold = bound(threshold, -1e18, 1e18);

        vm.prank(admin);
        resolver.registerCondition(market, targetTimestamp, DATA_FEED_BTC, threshold, isGreaterThan);

        AutomatedResolver.ResolutionCondition memory condition = resolver.getCondition(market);
        assertEq(condition.threshold, threshold);
        assertEq(condition.isGreaterThan, isGreaterThan);
    }

    function testFuzz_updateDataFeed(int256 value) public {
        value = bound(value, -1e18, 1e18);

        vm.prank(admin);
        resolver.updateDataFeed(DATA_FEED_ETH, value);

        assertEq(resolver.getDataFeedValue(DATA_FEED_ETH), value);
    }
}
