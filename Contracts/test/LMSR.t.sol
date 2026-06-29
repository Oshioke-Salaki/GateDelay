// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/LMSR.sol";

/// @dev Thin wrapper so we can call library functions from tests
contract LMSRHarness {
    function cost(uint256[] memory qOld, uint256[] memory qNew, uint256 b) external pure returns (int256) {
        return LMSR.cost(qOld, qNew, b);
    }

    function price(uint256[] memory q, uint256 b, uint256 i) external pure returns (uint256) {
        return LMSR.price(q, b, i);
    }

    function costFunction(uint256[] memory q, uint256 b) external pure returns (uint256) {
        return LMSR.costFunction(q, b);
    }
}

contract LMSRTest is Test {
    LMSRHarness lmsr;
    uint256 constant WAD = 1e18;
    uint256 constant B = 100 * WAD; // liquidity parameter

    function setUp() public {
        lmsr = new LMSRHarness();
    }

    // ── Equal prices at zero quantities ──────────────────────────────────────
    function testEqualPricesAtZero() public view {
        uint256[] memory q = new uint256[](2);
        // Both outcomes at 0 → prices should be 0.5 each
        uint256 p0 = lmsr.price(q, B, 0);
        uint256 p1 = lmsr.price(q, B, 1);
        assertApproxEqRel(p0, WAD / 2, 1e15); // within 0.1%
        assertApproxEqRel(p1, WAD / 2, 1e15);
        assertApproxEqRel(p0 + p1, WAD, 1e15);
    }

    // ── Prices sum to 1 ───────────────────────────────────────────────────────
    function testPricesSumToOne() public view {
        uint256[] memory q = new uint256[](3);
        q[0] = 50 * WAD;
        q[1] = 30 * WAD;
        q[2] = 20 * WAD;
        uint256 sum = lmsr.price(q, B, 0) + lmsr.price(q, B, 1) + lmsr.price(q, B, 2);
        assertApproxEqRel(sum, WAD, 1e15);
    }

    // ── Cost is positive for buying ───────────────────────────────────────────
    function testCostPositiveForBuy() public view {
        uint256[] memory qOld = new uint256[](2);
        uint256[] memory qNew = new uint256[](2);
        qNew[0] = 10 * WAD;
        int256 c = lmsr.cost(qOld, qNew, B);
        assertGt(c, 0);
    }

    // ── Cost is negative for selling ──────────────────────────────────────────
    function testCostNegativeForSell() public view {
        uint256[] memory qOld = new uint256[](2);
        qOld[0] = 10 * WAD;
        uint256[] memory qNew = new uint256[](2);
        int256 c = lmsr.cost(qOld, qNew, B);
        assertLt(c, 0);
    }

    // ── Path independence: buy then sell returns to original cost ─────────────
    function testPathIndependence() public view {
        uint256[] memory q0 = new uint256[](2);
        uint256[] memory q1 = new uint256[](2);
        q1[0] = 20 * WAD;
        uint256[] memory q2 = new uint256[](2);
        q2[0] = 20 * WAD;
        q2[1] = 15 * WAD;

        int256 c1 = lmsr.cost(q0, q1, B);
        int256 c2 = lmsr.cost(q1, q2, B);
        int256 c3 = lmsr.cost(q0, q2, B);

        // c1 + c2 should equal c3 (path independence)
        assertApproxEqAbs(c1 + c2, c3, uint256(WAD / 1000));
    }

    // ── Higher b → lower price impact ────────────────────────────────────────
    function testHigherLiquidityLowerImpact() public view {
        uint256[] memory qOld = new uint256[](2);
        uint256[] memory qNew = new uint256[](2);
        qNew[0] = 10 * WAD;

        int256 costLowB = lmsr.cost(qOld, qNew, 10 * WAD);
        int256 costHighB = lmsr.cost(qOld, qNew, 1000 * WAD);
        assertGt(costLowB, costHighB);
    }

    // ── expWad sanity: exp(0) = 1 ─────────────────────────────────────────────
    function testExpWadAtZero() public view {
        uint256[] memory q = new uint256[](2); // all zeros
        // costFunction(q, b) = b * ln(2) when q=[0,0]
        uint256 c = lmsr.costFunction(q, B);
        uint256 expected = (B * 693147180559945309) / WAD; // b * ln2
        assertApproxEqRel(c, expected, 1e15);
    }
}
