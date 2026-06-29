// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {MarketLottery} from "../Contracts/contracts/MarketLottery.sol";

contract MarketLotteryTest is Test {
    MarketLottery lottery;
    ERC20 prizeToken;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        prizeToken = new ERC20("Prize", "PRZ");
        lottery = new MarketLottery(address(prizeToken));

        // Fund lottery with prize tokens
        prizeToken.mint(address(this), 1_000 ether);
        prizeToken.approve(address(lottery), type(uint256).max);
    }

    function testLotteryFlow_singleWinner() public {
        uint256 ticketPrice = 1 ether;
        uint256 duration = 10;
        uint256 winnerCount = 1;

        uint256 roundId = lottery.startRound(duration, ticketPrice, winnerCount);

        // Fund prize for round
        lottery.fundPrize(roundId, 100 ether);

        // Enter
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);

        vm.prank(alice);
        lottery.enter{value: ticketPrice * 2}(2);

        vm.prank(bob);
        lottery.enter{value: ticketPrice * 3}(3);

        // Close by time
        vm.warp(block.timestamp + duration + 1);

        // Request randomness
        uint256 requestId = lottery.requestRandomWinner();

        // Deterministic seed to select winner
        // totalTickets = 5, ticket indices [0..4]
        // seed chosen so that ticketIndex = 0 (likely but deterministic)
        uint256 seed = uint256(keccak256(abi.encode(uint256(0), uint256(0), roundId))));
        lottery.fulfillRandomWords(requestId, seed);

        // Winner claims
        (bool open, bool randomRequested, bool finalized, , uint256 totalTickets, uint256 prizeBalance, , ) =
            lottery.roundStatus(roundId);
        assertEq(open, false);
        assertEq(randomRequested, true);
        assertEq(finalized, true);
        assertEq(totalTickets, 5);
        assertEq(prizeBalance, 100 ether);

        // Query history winners
        (, , , , uint256 wc, address[] memory winners, , ) = lottery.getHistory(roundId);
        assertEq(wc, 1);
        assertEq(winners.length, 1);

        address winner = winners[0];
        vm.prank(winner);
        lottery.claim(roundId);

        assertEq(prizeToken.balanceOf(winner), 100 ether);
    }
}

