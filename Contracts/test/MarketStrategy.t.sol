// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MarketStrategy} from "../contracts/MarketStrategy.sol";

contract MockTarget {
    uint256 public value;
    
    function execute(uint256 _value) external {
        value = _value;
    }

    function fail() external pure {
        revert("Failed");
    }
}

contract MarketStrategyTest is Test {
    MarketStrategy public strategyContract;
    MockTarget public target;

    function setUp() public {
        strategyContract = new MarketStrategy();
        target = new MockTarget();
    }

    function testDefineStrategy() public {
        bytes32 id = keccak256("STRAT_1");
        bytes memory defaultData = abi.encodeWithSelector(MockTarget.execute.selector, 42);
        strategyContract.defineStrategy(id, "Test Strategy", address(target), defaultData);

        MarketStrategy.Strategy memory s = strategyContract.getStrategy(id);
        assertEq(s.name, "Test Strategy");
        assertEq(s.target, address(target));
        assertTrue(s.active);
    }

    function testUpdateStrategy() public {
        bytes32 id = keccak256("STRAT_1");
        bytes memory defaultData = abi.encodeWithSelector(MockTarget.execute.selector, 42);
        strategyContract.defineStrategy(id, "Test Strategy", address(target), defaultData);

        strategyContract.updateStrategy(id, address(target), defaultData, false);
        MarketStrategy.Strategy memory s = strategyContract.getStrategy(id);
        assertFalse(s.active);
    }

    function testExecuteStrategySuccess() public {
        bytes32 id = keccak256("STRAT_1");
        bytes memory defaultData = abi.encodeWithSelector(MockTarget.execute.selector, 42);
        strategyContract.defineStrategy(id, "Test Strategy", address(target), defaultData);

        strategyContract.executeStrategy(id, "");
        assertEq(target.value(), 42);

        MarketStrategy.Performance memory p = strategyContract.getPerformance(id);
        assertEq(p.executions, 1);
        assertEq(p.successes, 1);
        assertEq(p.failures, 0);
    }

    function testExecuteStrategyWithCustomData() public {
        bytes32 id = keccak256("STRAT_1");
        bytes memory defaultData = "";
        strategyContract.defineStrategy(id, "Test Strategy", address(target), defaultData);

        bytes memory executionData = abi.encodeWithSelector(MockTarget.execute.selector, 100);
        strategyContract.executeStrategy(id, executionData);
        assertEq(target.value(), 100);
    }

    function testExecuteStrategyFail() public {
        bytes32 id = keccak256("STRAT_1");
        bytes memory defaultData = abi.encodeWithSelector(MockTarget.fail.selector);
        strategyContract.defineStrategy(id, "Test Strategy", address(target), defaultData);

        // Does not revert the whole transaction, but internal call fails
        strategyContract.executeStrategy(id, "");

        MarketStrategy.Performance memory p = strategyContract.getPerformance(id);
        assertEq(p.executions, 1);
        assertEq(p.successes, 0);
        assertEq(p.failures, 1);
    }
    
    function testQueriesWork() public {
        bytes32 id1 = keccak256("STRAT_1");
        bytes32 id2 = keccak256("STRAT_2");
        strategyContract.defineStrategy(id1, "Strat 1", address(target), "");
        strategyContract.defineStrategy(id2, "Strat 2", address(target), "");
        
        bytes32[] memory ids = strategyContract.getAllStrategyIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }
}
