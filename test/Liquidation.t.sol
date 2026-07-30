// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {Liquidation} from "../contracts/Liquidation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ── Mock Contracts ─────────────────────────────────────────────────────────────

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockCollateralVault {
    mapping(address => mapping(address => uint256)) public userBalance;
    mapping(address => address) public marketCollateralToken;
    
    function registerMarket(address market, address token) external {
        marketCollateralToken[market] = token;
    }
    
    function deposit(address market, address user, uint256 amount) external {
        userBalance[market][user] += amount;
    }
    
    function getBalance(address market, address user) external view returns (uint256) {
        return userBalance[market][user];
    }
    
    function liquidate(
        address market,
        address account,
        uint256 amount,
        address recipient
    ) external {
        require(userBalance[market][account] >= amount, "Insufficient balance");
        userBalance[market][account] -= amount;
        
        address token = marketCollateralToken[market];
        IERC20(token).transfer(recipient, amount);
    }
}

contract MockMarginCalculator {
    struct MarginRequirement {
        uint256 initialMargin;
        uint256 maintenanceMargin;
        uint256 liquidationMargin;
        uint256 currentMargin;
        uint256 utilizationBps;
    }
    
    mapping(address => mapping(address => MarginRequirement)) public requirements;
    
    function setMarginRequirement(
        address user,
        address market,
        uint256 initialMargin,
        uint256 maintenanceMargin,
        uint256 liquidationMargin,
        uint256 currentMargin
    ) external {
        requirements[user][market] = MarginRequirement({
            initialMargin: initialMargin,
            maintenanceMargin: maintenanceMargin,
            liquidationMargin: liquidationMargin,
            currentMargin: currentMargin,
            utilizationBps: 0
        });
    }
    
    function getMarginRequirement(
        address user,
        address market
    ) external view returns (
        uint256 initialMargin,
        uint256 maintenanceMargin,
        uint256 liquidationMargin,
        uint256 currentMargin,
        uint256 utilizationBps
    ) {
        MarginRequirement memory req = requirements[user][market];
        return (
            req.initialMargin,
            req.maintenanceMargin,
            req.liquidationMargin,
            req.currentMargin,
            req.utilizationBps
        );
    }
}

contract MockPriceOracle {
    mapping(bytes32 => int256) public prices;
    
    function updatePrice(bytes32 feedId, int256 price) external {
        prices[feedId] = price;
    }
    
    function getPrice(bytes32 feedId) external view returns (int256, uint256) {
        return (prices[feedId], block.timestamp);
    }
}

// ── Liquidation Tests ──────────────────────────────────────────────────────────

contract LiquidationTest is Test {
    Liquidation public liquidation;
    MockCollateralVault public vault;
    MockMarginCalculator public calculator;
    MockPriceOracle public oracle;
    MockERC20 public collateralToken;
    
    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public liquidator = makeAddr("liquidator");
    address public market = makeAddr("market");
    
    uint256 constant LIQUIDATION_PENALTY_BPS = 1000; // 10%
    uint256 constant LIQUIDATOR_REWARD_BPS = 500;    // 5%
    
    function setUp() public {
        // Deploy mock contracts
        collateralToken = new MockERC20("Collateral", "COLL");
        vault = new MockCollateralVault();
        calculator = new MockMarginCalculator();
        oracle = new MockPriceOracle();
        
        // Deploy Liquidation contract
        liquidation = new Liquidation(
            address(vault),
            address(calculator),
            LIQUIDATION_PENALTY_BPS,
            LIQUIDATOR_REWARD_BPS
        );
        
        // Register market
        vault.registerMarket(market, address(collateralToken));
        liquidation.registerMarket(market, address(collateralToken), address(oracle));
        
        // Fund vault with collateral
        collateralToken.transfer(address(vault), 100_000 ether);
        
        // Setup test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(liquidator, 100 ether);
    }
    
    // ── Constructor Tests ──────────────────────────────────────────────────────
    
    function test_constructor_setsParameters() public view {
        assertEq(liquidation.collateralVault(), address(vault));
        assertEq(liquidation.marginCalculator(), address(calculator));
        assertEq(liquidation.liquidationPenaltyBps(), LIQUIDATION_PENALTY_BPS);
        assertEq(liquidation.liquidatorRewardBps(), LIQUIDATOR_REWARD_BPS);
        assertEq(liquidation.owner(), owner);
    }
    
    function test_constructor_revertsOnZeroAddress() public {
        vm.expectRevert(Liquidation.ZeroAddress.selector);
        new Liquidation(address(0), address(calculator), LIQUIDATION_PENALTY_BPS, LIQUIDATOR_REWARD_BPS);
        
        vm.expectRevert(Liquidation.ZeroAddress.selector);
        new Liquidation(address(vault), address(0), LIQUIDATION_PENALTY_BPS, LIQUIDATOR_REWARD_BPS);
    }
    
    function test_constructor_revertsOnInvalidPenalty() public {
        vm.expectRevert(Liquidation.InvalidLiquidationPenalty.selector);
        new Liquidation(address(vault), address(calculator), 50, LIQUIDATOR_REWARD_BPS); // Too low
        
        vm.expectRevert(Liquidation.InvalidLiquidationPenalty.selector);
        new Liquidation(address(vault), address(calculator), 3000, LIQUIDATOR_REWARD_BPS); // Too high
    }
    
    function test_constructor_revertsOnInvalidReward() public {
        vm.expectRevert(Liquidation.InvalidLiquidatorReward.selector);
        new Liquidation(address(vault), address(calculator), LIQUIDATION_PENALTY_BPS, 10); // Too low
        
        vm.expectRevert(Liquidation.InvalidLiquidatorReward.selector);
        new Liquidation(address(vault), address(calculator), LIQUIDATION_PENALTY_BPS, 1500); // Too high
    }
    
    // ── Admin Tests ────────────────────────────────────────────────────────────
    
    function test_registerMarket() public {
        address newMarket = makeAddr("newMarket");
        address newToken = makeAddr("newToken");
        address newOracle = makeAddr("newOracle");
        
        vm.expectEmit(true, true, true, true);
        emit Liquidation.MarketRegistered(newMarket, newToken, newOracle);
        
        liquidation.registerMarket(newMarket, newToken, newOracle);
        
        assertEq(liquidation.marketCollateralToken(newMarket), newToken);
        assertEq(liquidation.marketPriceOracle(newMarket), newOracle);
    }
    
    function test_registerMarket_revertsOnZeroAddress() public {
        vm.expectRevert(Liquidation.ZeroAddress.selector);
        liquidation.registerMarket(address(0), address(collateralToken), address(oracle));
    }
    
    function test_registerMarket_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        liquidation.registerMarket(makeAddr("market2"), address(collateralToken), address(oracle));
    }
    
    function test_updatePenaltyParameters() public {
        uint256 newPenalty = 1500;
        uint256 newReward = 750;
        
        vm.expectEmit(true, true, true, true);
        emit Liquidation.PenaltyParametersUpdated(newPenalty, newReward);
        
        liquidation.updatePenaltyParameters(newPenalty, newReward);
        
        assertEq(liquidation.liquidationPenaltyBps(), newPenalty);
        assertEq(liquidation.liquidatorRewardBps(), newReward);
    }
    
    function test_updatePenaltyParameters_revertsOnInvalidValues() public {
        vm.expectRevert(Liquidation.InvalidLiquidationPenalty.selector);
        liquidation.updatePenaltyParameters(50, LIQUIDATOR_REWARD_BPS);
        
        vm.expectRevert(Liquidation.InvalidLiquidatorReward.selector);
        liquidation.updatePenaltyParameters(LIQUIDATION_PENALTY_BPS, 10);
    }
    
    function test_setPaused() public {
        assertFalse(liquidation.paused());
        
        liquidation.setPaused(true);
        assertTrue(liquidation.paused());
        
        liquidation.setPaused(false);
        assertFalse(liquidation.paused());
    }
    
    // ── Liquidation Condition Monitoring ───────────────────────────────────────
    
    function test_monitorLiquidationCondition_healthyPosition() public {
        // Setup: Alice has sufficient margin
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(
            alice,
            market,
            2000 ether,  // initial
            1500 ether,  // maintenance
            1000 ether,  // liquidation
            1500 ether   // current (above liquidation)
        );
        
        Liquidation.LiquidationCondition memory condition = liquidation.monitorLiquidationCondition(alice, market);
        
        assertEq(condition.collateralValue, 10_000 ether);
        assertEq(condition.requiredMargin, 1000 ether);
        assertEq(condition.currentMargin, 1500 ether);
        assertFalse(condition.isLiquidatable);
        assertTrue(condition.healthFactor >= 1e18); // Health factor >= 1.0
    }
    
    function test_monitorLiquidationCondition_liquidatablePosition() public {
        // Setup: Alice has insufficient margin
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(
            alice,
            market,
            2000 ether,  // initial
            1500 ether,  // maintenance
            1000 ether,  // liquidation
            500 ether    // current (below liquidation)
        );
        
        vm.expectEmit(true, true, false, true);
        emit Liquidation.LiquidationConditionChecked(alice, market, 0.5e18, true);
        
        Liquidation.LiquidationCondition memory condition = liquidation.monitorLiquidationCondition(alice, market);
        
        assertEq(condition.collateralValue, 10_000 ether);
        assertEq(condition.requiredMargin, 1000 ether);
        assertEq(condition.currentMargin, 500 ether);
        assertTrue(condition.isLiquidatable);
        assertEq(condition.healthFactor, 0.5e18); // Health factor = 0.5
    }
    
    function test_monitorLiquidationCondition_zeroMargin() public {
        vault.deposit(market, alice, 5_000 ether);
        calculator.setMarginRequirement(alice, market, 1000 ether, 750 ether, 500 ether, 0);
        
        Liquidation.LiquidationCondition memory condition = liquidation.monitorLiquidationCondition(alice, market);
        
        assertTrue(condition.isLiquidatable);
        assertEq(condition.healthFactor, 0);
    }
    
    // ── Liquidation Penalty Calculation ────────────────────────────────────────
    
    function test_calculateLiquidationPenalty() public view {
        uint256 collateralValue = 10_000 ether;
        uint256 debtValue = 1_000 ether;
        
        (
            uint256 collateralToSeize,
            uint256 penaltyAmount,
            uint256 liquidatorReward,
            uint256 protocolFee
        ) = liquidation.calculateLiquidationPenalty(collateralValue, debtValue);
        
        // Penalty = 1000 * 10% = 100 ether
        assertEq(penaltyAmount, 100 ether);
        
        // Total seized = debt + penalty = 1100 ether
        assertEq(collateralToSeize, 1_100 ether);
        
        // Liquidator reward = 100 * 5% = 5 ether
        assertEq(liquidatorReward, 5 ether);
        
        // Protocol fee = penalty - reward = 95 ether
        assertEq(protocolFee, 95 ether);
    }
    
    function test_calculateLiquidationPenalty_insufficientCollateral() public view {
        uint256 collateralValue = 1_000 ether;
        uint256 debtValue = 1_500 ether;
        
        (
            uint256 collateralToSeize,
            uint256 penaltyAmount,
            uint256 liquidatorReward,
            uint256 protocolFee
        ) = liquidation.calculateLiquidationPenalty(collateralValue, debtValue);
        
        // Should cap at available collateral
        assertEq(collateralToSeize, 1_000 ether);
        assertEq(penaltyAmount, 0); // No penalty when collateral < debt
        assertEq(liquidatorReward, 0);
        assertEq(protocolFee, 0);
    }
    
    function testFuzz_calculateLiquidationPenalty(uint128 collateral, uint128 debt) public view {
        vm.assume(collateral > 0 && debt > 0);
        vm.assume(collateral >= debt); // Only test valid scenarios
        
        (
            uint256 collateralToSeize,
            uint256 penaltyAmount,
            uint256 liquidatorReward,
            uint256 protocolFee
        ) = liquidation.calculateLiquidationPenalty(collateral, debt);
        
        // Verify relationships
        assertLe(collateralToSeize, collateral);
        assertEq(liquidatorReward + protocolFee, penaltyAmount);
        assertGe(collateralToSeize, debt);
    }
    
    // ── Liquidation Execution ──────────────────────────────────────────────────
    
    function test_executeLiquidation() public {
        // Setup liquidatable position
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(
            alice,
            market,
            2000 ether,
            1500 ether,
            1000 ether,
            500 ether  // Below liquidation threshold
        );
        
        uint256 liquidatorBalanceBefore = collateralToken.balanceOf(liquidator);
        
        vm.expectEmit(true, true, true, false);
        emit Liquidation.LiquidationExecuted(alice, market, liquidator, 0, 0, 0, 0);
        
        vm.prank(liquidator);
        Liquidation.LiquidationExecution memory execution = liquidation.executeLiquidation(alice, market);
        
        // Verify execution details
        assertEq(execution.account, alice);
        assertEq(execution.market, market);
        assertEq(execution.liquidator, liquidator);
        assertGt(execution.collateralSeized, 0);
        assertGt(execution.penaltyAmount, 0);
        assertGt(execution.liquidatorReward, 0);
        assertEq(execution.healthFactorBefore, 0.5e18);
        
        // Verify liquidator received reward
        assertGt(collateralToken.balanceOf(liquidator), liquidatorBalanceBefore);
    }
    
    function test_executeLiquidation_revertsOnHealthyPosition() public {
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(
            alice,
            market,
            2000 ether,
            1500 ether,
            1000 ether,
            1500 ether  // Above liquidation threshold
        );
        
        vm.prank(liquidator);
        vm.expectRevert(Liquidation.PositionNotLiquidatable.selector);
        liquidation.executeLiquidation(alice, market);
    }
    
    function test_executeLiquidation_revertsOnInsufficientCollateral() public {
        calculator.setMarginRequirement(alice, market, 1000 ether, 750 ether, 500 ether, 100 ether);
        // No collateral deposited
        
        vm.prank(liquidator);
        vm.expectRevert(Liquidation.InsufficientCollateral.selector);
        liquidation.executeLiquidation(alice, market);
    }
    
    function test_executeLiquidation_revertsWhenPaused() public {
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 500 ether);
        
        liquidation.setPaused(true);
        
        vm.prank(liquidator);
        vm.expectRevert("Liquidation: paused");
        liquidation.executeLiquidation(alice, market);
    }
    
    function test_executeLiquidation_revertsOnUnregisteredMarket() public {
        address unregisteredMarket = makeAddr("unregistered");
        
        vm.prank(liquidator);
        vm.expectRevert(Liquidation.MarketNotRegistered.selector);
        liquidation.executeLiquidation(alice, unregisteredMarket);
    }
    
    function test_executeLiquidation_updatesHistory() public {
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 500 ether);
        
        vm.prank(liquidator);
        liquidation.executeLiquidation(alice, market);
        
        Liquidation.LiquidationExecution[] memory history = liquidation.getLiquidationHistory(alice, market);
        assertEq(history.length, 1);
        assertEq(history[0].account, alice);
        assertEq(history[0].liquidator, liquidator);
    }
    
    function test_executeLiquidation_updatesProceeds() public {
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 500 ether);
        
        vm.prank(liquidator);
        liquidation.executeLiquidation(alice, market);
        
        Liquidation.LiquidationProceeds memory proceeds = liquidation.getMarketProceeds(market);
        assertGt(proceeds.totalSeized, 0);
        assertGt(proceeds.totalPenalties, 0);
        assertGt(proceeds.totalRewards, 0);
        assertGt(proceeds.protocolBalance, 0);
        assertEq(proceeds.liquidationCount, 1);
    }
    
    // ── Protocol Proceeds ──────────────────────────────────────────────────────
    
    function test_withdrawProtocolProceeds() public {
        // Execute liquidation to generate proceeds
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 500 ether);
        
        vm.prank(liquidator);
        liquidation.executeLiquidation(alice, market);
        
        uint256 protocolBalance = liquidation.getProtocolProceeds(address(collateralToken));
        assertGt(protocolBalance, 0);
        
        uint256 ownerBalanceBefore = collateralToken.balanceOf(owner);
        
        vm.expectEmit(true, false, false, true);
        emit Liquidation.ProceedsWithdrawn(owner, protocolBalance);
        
        liquidation.withdrawProtocolProceeds(address(collateralToken), owner, protocolBalance);
        
        assertEq(collateralToken.balanceOf(owner) - ownerBalanceBefore, protocolBalance);
        assertEq(liquidation.getProtocolProceeds(address(collateralToken)), 0);
    }
    
    function test_withdrawProtocolProceeds_revertsOnInsufficientBalance() public {
        vm.expectRevert(Liquidation.NoLiquidationProceeds.selector);
        liquidation.withdrawProtocolProceeds(address(collateralToken), owner, 1000 ether);
    }
    
    function test_withdrawProtocolProceeds_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        liquidation.withdrawProtocolProceeds(address(collateralToken), alice, 100 ether);
    }
    
    // ── Query Functions ────────────────────────────────────────────────────────
    
    function test_isPositionLiquidatable() public {
        vault.deposit(market, alice, 10_000 ether);
        
        // Healthy position
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 1500 ether);
        assertFalse(liquidation.isPositionLiquidatable(alice, market));
        
        // Liquidatable position
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 500 ether);
        assertTrue(liquidation.isPositionLiquidatable(alice, market));
    }
    
    function test_getHealthFactor() public {
        vault.deposit(market, alice, 10_000 ether);
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 1500 ether);
        
        uint256 healthFactor = liquidation.getHealthFactor(alice, market);
        assertEq(healthFactor, 1.5e18); // 1500 / 1000 = 1.5
    }
    
    function test_batchMonitorConditions() public {
        address[] memory accounts = new address[](3);
        accounts[0] = alice;
        accounts[1] = bob;
        accounts[2] = liquidator;
        
        vault.deposit(market, alice, 10_000 ether);
        vault.deposit(market, bob, 5_000 ether);
        vault.deposit(market, liquidator, 8_000 ether);
        
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 1500 ether);
        calculator.setMarginRequirement(bob, market, 1000 ether, 750 ether, 500 ether, 300 ether);
        calculator.setMarginRequirement(liquidator, market, 1500 ether, 1125 ether, 750 ether, 1000 ether);
        
        Liquidation.LiquidationCondition[] memory conditions = liquidation.batchMonitorConditions(accounts, market);
        
        assertEq(conditions.length, 3);
        assertFalse(conditions[0].isLiquidatable); // Alice healthy
        assertTrue(conditions[1].isLiquidatable);  // Bob liquidatable
        assertFalse(conditions[2].isLiquidatable); // Liquidator healthy
    }
    
    function test_getLiquidationHistory_empty() public view {
        Liquidation.LiquidationExecution[] memory history = liquidation.getLiquidationHistory(alice, market);
        assertEq(history.length, 0);
    }
    
    function test_getMarketProceeds_initial() public view {
        Liquidation.LiquidationProceeds memory proceeds = liquidation.getMarketProceeds(market);
        assertEq(proceeds.totalSeized, 0);
        assertEq(proceeds.totalPenalties, 0);
        assertEq(proceeds.totalRewards, 0);
        assertEq(proceeds.protocolBalance, 0);
        assertEq(proceeds.liquidationCount, 0);
    }
    
    // ── Integration Tests ──────────────────────────────────────────────────────
    
    function test_multipleLiquidations() public {
        // Setup multiple liquidatable positions
        vault.deposit(market, alice, 10_000 ether);
        vault.deposit(market, bob, 8_000 ether);
        
        calculator.setMarginRequirement(alice, market, 2000 ether, 1500 ether, 1000 ether, 500 ether);
        calculator.setMarginRequirement(bob, market, 1600 ether, 1200 ether, 800 ether, 400 ether);
        
        // Execute first liquidation
        vm.prank(liquidator);
        liquidation.executeLiquidation(alice, market);
        
        // Execute second liquidation
        vm.prank(liquidator);
        liquidation.executeLiquidation(bob, market);
        
        // Verify proceeds
        Liquidation.LiquidationProceeds memory proceeds = liquidation.getMarketProceeds(market);
        assertEq(proceeds.liquidationCount, 2);
        
        // Verify histories
        assertEq(liquidation.getLiquidationHistory(alice, market).length, 1);
        assertEq(liquidation.getLiquidationHistory(bob, market).length, 1);
    }
}
