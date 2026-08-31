// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/VoteDelegation.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract IntegrationGovernanceToken is ERC20 {
    constructor() ERC20("Integration Governance Token", "IGOV") {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract VoteDelegationIntegrationTest is Test {
    VoteDelegation internal voteDelegation;
    IntegrationGovernanceToken internal governanceToken;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA401);

    function setUp() public {
        governanceToken = new IntegrationGovernanceToken();
        governanceToken.mint(alice, 1_000 ether);
        governanceToken.mint(bob, 500 ether);
        governanceToken.mint(carol, 300 ether);
        voteDelegation = new VoteDelegation(address(governanceToken));
    }

    function test_readmeQuickStartFlow() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        assertEq(voteDelegation.getVotingPower(alice), 0);
        assertEq(voteDelegation.getVotingPower(bob), 1_500 ether);
        assertEq(voteDelegation.getFinalDelegatee(alice), bob);

        vm.prank(alice);
        voteDelegation.undelegate();

        assertEq(voteDelegation.getVotingPower(alice), 1_000 ether);
        assertEq(voteDelegation.getVotingPower(bob), 500 ether);
    }

    function test_readmeDelegationChainFlow() public {
        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.prank(bob);
        voteDelegation.delegate(carol);

        VoteDelegation.DelegationChain memory chain = voteDelegation.getDelegationChain(alice);
        assertEq(chain.depth, 2);
        assertEq(chain.chain.length, 3);
        assertEq(chain.chain[0], alice);
        assertEq(chain.chain[1], bob);
        assertEq(chain.chain[2], carol);
        assertEq(chain.totalPower, 1_800 ether);
        assertEq(voteDelegation.getVotingPower(carol), 1_800 ether);
    }

    function test_readmeHistoricalQueryFlow() public {
        vm.roll(100);

        vm.prank(alice);
        voteDelegation.delegate(bob);

        vm.roll(101);

        governanceToken.mint(carol, 1);
        vm.roll(102);

        uint256 historicalBlock = block.number - 1;
        assertLt(historicalBlock, block.number);
        assertEq(voteDelegation.getVotingPowerAt(bob, historicalBlock), 1_500 ether);
        assertEq(voteDelegation.getVotingPowerAt(alice, historicalBlock), 0);
    }
}