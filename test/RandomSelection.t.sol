// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";

import {RandomSelection} from "../Contracts/contracts/RandomSelection.sol";

contract RandomSelectionTest is Test {
    RandomSelection rs;

    address a0 = address(0xA0);
    address a1 = address(0xA1);
    address a2 = address(0xA2);
    address a3 = address(0xA3);

    function setUp() public {
        rs = new RandomSelection();

        address[] memory members = new address[](4);
        members[0] = a0;
        members[1] = a1;
        members[2] = a2;
        members[3] = a3;
        rs.setPopulation(1, members);
    }

    function testNumbersAreGenerated_andHistoryTracked() public {
        uint256 requestId = rs.requestSelection(1, 3, true);

        uint256 seed = 123456789;
        rs.fulfillRandomWords(requestId, seed);

        (uint256 popRoundId, uint256 selectionCount, uint256 randomSeed, uint256[] memory idx, address[] memory vals) =
            rs.getSelectionHistoryByRequestId(requestId);

        assertEq(popRoundId, 1);
        assertEq(selectionCount, 3);
        assertEq(randomSeed, seed);
        assertEq(idx.length, 3);
        assertEq(vals.length, 3);

        // Deterministic check based on contract formula
        // idx[i] = keccak256(seed, popRoundId, requestId, i) % size
        uint256 size = 4;
        for (uint256 i = 0; i < 3; i++) {
            uint256 expectedIdx = uint256(keccak256(abi.encode(seed, uint256(1), requestId, i))) % size;
            address expectedVal = _member(expectedIdx);
            assertEq(idx[i], expectedIdx);
            assertEq(vals[i], expectedVal);
        }
    }

    function testProcessStateGuards() public {
        uint256 requestId = rs.requestSelection(1, 2, true);

        // request fulfilled once
        rs.fulfillRandomWords(requestId, 999);

        // fulfill again reverts
        vm.expectRevert(RandomSelection.RequestAlreadyFulfilled.selector);
        rs.fulfillRandomWords(requestId, 1000);
    }

    function testFairness_uniformWithReplacement_smokeDistribution() public {
        // Compare counts across many seeds.
        uint256 populationRoundId = 1;
        uint256 selectionCount = 1;
        bool withReplacement = true;

        uint256[4] memory counts;
        uint256 seedsToTry = 200;

        for (uint256 s = 1; s <= seedsToTry; s++) {
            uint256 requestId = rs.requestSelection(populationRoundId, selectionCount, withReplacement);
            rs.fulfillRandomWords(requestId, s);

            uint256 idx0 = rs.getSelectedIndex(requestId, 0);
            counts[idx0]++;
        }

        // Rough fairness: each index should appear close to seedsToTry/4.
        uint256 expected = seedsToTry / 4;
        for (uint256 i = 0; i < 4; i++) {
            uint256 c = counts[i];
            uint256 diff = c > expected ? c - expected : expected - c;
            // Allow 35% tolerance due to pseudo-randomness.
            assertLe(diff, expected * 35 / 100);
        }
    }

    function _member(uint256 idx) internal view returns (address) {
        if (idx == 0) return a0;
        if (idx == 1) return a1;
        if (idx == 2) return a2;
        return a3;
    }
}

