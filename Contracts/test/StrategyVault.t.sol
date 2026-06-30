// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StrategyVault} from "../contracts/StrategyVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MTK") {
        _mint(msg.sender, 1000000 * 10 ** 18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockTradeTarget {
    MockToken public token;

    constructor(address _token) {
        token = MockToken(_token);
    }

    function executeProfitableTrade(uint256 amount) external {
        token.mint(msg.sender, amount);
    }

    function executeLossTrade(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
    }
}

contract StrategyVaultTest is Test {
    StrategyVault public vault;
    MockToken public token;
    MockTradeTarget public target;

    address owner = address(this);
    address user = address(0x1);

    function setUp() public {
        token = new MockToken();
        vault = new StrategyVault(address(token));
        target = new MockTradeTarget(address(token));

        token.transfer(user, 10000);
        
        vm.startPrank(user);
        token.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        token.approve(address(vault), type(uint256).max);
    }

    function testDeposit() public {
        vm.prank(user);
        vault.deposit(1000);
        
        assertEq(vault.totalAssets(), 1000);
        assertEq(token.balanceOf(address(vault)), 1000);
    }

    function testExecuteProfitableTrade() public {
        vm.prank(user);
        vault.deposit(1000);

        bytes memory data = abi.encodeWithSelector(MockTradeTarget.executeProfitableTrade.selector, 500);
        vault.executeTrade(address(target), data);

        assertEq(vault.totalAssets(), 1500);
        
        StrategyVault.TradePerformance memory perf = vault.getPerformance();
        assertEq(perf.tradeCount, 1);
        assertEq(perf.totalProfit, 500);
        assertEq(perf.totalLoss, 0);
    }

    function testExecuteLossTrade() public {
        vm.prank(user);
        vault.deposit(1000);

        vault.approveTarget(address(target), 500);

        bytes memory data = abi.encodeWithSelector(MockTradeTarget.executeLossTrade.selector, 500);
        vault.executeTrade(address(target), data);

        assertEq(vault.totalAssets(), 500);
        
        StrategyVault.TradePerformance memory perf = vault.getPerformance();
        assertEq(perf.tradeCount, 1);
        assertEq(perf.totalProfit, 0);
        assertEq(perf.totalLoss, 500);
    }

    function testQueriesWork() public {
        vm.prank(user);
        vault.deposit(1000);

        bytes memory data = abi.encodeWithSelector(MockTradeTarget.executeProfitableTrade.selector, 200);
        vault.executeTrade(address(target), data);

        (uint256 ta, uint256 tp, uint256 tl) = vault.getVaultDetails();
        assertEq(ta, 1200);
        assertEq(tp, 200);
        assertEq(tl, 0);
    }
}
