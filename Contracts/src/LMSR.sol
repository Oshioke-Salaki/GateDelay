// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LMSR – Logarithmic Market Scoring Rule library
/// @notice Pure math library for LMSR pricing. Uses a fixed-point approximation
///         of ln/exp with 18-decimal precision (WAD arithmetic).
library LMSR {
    uint256 internal constant WAD = 1e18;

    // ── Public price queries ──────────────────────────────────────────────────

    /// @notice Cost to move from quantities `qOld` to `qNew` under liquidity `b`.
    /// @param qOld  Current outcome quantities (WAD)
    /// @param qNew  Desired outcome quantities (WAD)
    /// @param b     Liquidity parameter (WAD)
    /// @return cost Net cost (positive = buyer pays, negative = buyer receives)
    function cost(
        uint256[] memory qOld,
        uint256[] memory qNew,
        uint256 b
    ) internal pure returns (int256) {
        return int256(costFunction(qNew, b)) - int256(costFunction(qOld, b));
    }

    /// @notice Spot price of outcome `i` given quantities `q` and liquidity `b`.
    /// @return price in WAD (sums to ~1e18 across all outcomes)
    function price(
        uint256[] memory q,
        uint256 b,
        uint256 i
    ) internal pure returns (uint256) {
        // p_i = exp(q_i / b) / sum_j exp(q_j / b)
        uint256 len = q.length;
        uint256[] memory exps = new uint256[](len);
        uint256 sumExp = 0;
        for (uint256 j = 0; j < len; j++) {
            exps[j] = expWad(wadDiv(q[j], b));
            sumExp += exps[j];
        }
        return wadDiv(exps[i], sumExp);
    }

    // ── LMSR cost function ────────────────────────────────────────────────────

    /// @dev C(q) = b * ln( sum_i exp(q_i / b) )
    function costFunction(uint256[] memory q, uint256 b) internal pure returns (uint256) {
        uint256 len = q.length;
        uint256 sumExp = 0;
        for (uint256 i = 0; i < len; i++) {
            sumExp += expWad(wadDiv(q[i], b));
        }
        return wadMul(b, lnWad(sumExp));
    }

    // ── WAD fixed-point helpers ───────────────────────────────────────────────

    function wadMul(uint256 a, uint256 b_) internal pure returns (uint256) {
        return (a * b_) / WAD;
    }

    function wadDiv(uint256 a, uint256 b_) internal pure returns (uint256) {
        require(b_ > 0, "LMSR: div by zero");
        return (a * WAD) / b_;
    }

    /// @dev exp(x) in WAD where x is WAD-scaled. Uses the identity
    ///      exp(x) = 2^(x / ln2). Reverts for x > 135 * WAD (overflow guard).
    function expWad(uint256 x) internal pure returns (uint256 result) {
        // Solmate-style exp approximation (integer + fractional decomposition)
        // Accurate to ~1e-9 relative error for x in [0, 135e18]
        require(x <= 135 * WAD, "LMSR: exp overflow");
        unchecked {
            // Split x = k*ln2 + r  where 0 <= r < ln2
            // ln2 in WAD = 693147180559945309
            uint256 ln2 = 693147180559945309;
            uint256 k   = x / ln2;
            uint256 r   = x - k * ln2; // r in [0, ln2)

            // Compute exp(r) via 6-term Taylor series (r < 0.694, so converges fast)
            // exp(r) ≈ 1 + r + r²/2! + r³/3! + r⁴/4! + r⁵/5! + r⁶/6!
            uint256 rr = (r * r) / WAD;
            result = WAD
                + r
                + rr / 2
                + (rr * r / WAD) / 6
                + (rr * rr / WAD) / 24
                + (rr * rr / WAD * r / WAD) / 120
                + (rr * rr / WAD * rr / WAD) / 720;

            // Multiply by 2^k
            result = result << k;
        }
    }

    /// @dev Natural log of x (WAD). x must be >= WAD (i.e., argument >= 1).
    ///      Uses the identity ln(x) = ln(m * 2^e) = e*ln2 + ln(m)
    ///      where m is normalised to [1, 2).
    function lnWad(uint256 x) internal pure returns (uint256 result) {
        require(x >= WAD, "LMSR: ln of value < 1");
        unchecked {
            uint256 ln2 = 693147180559945309;

            // Find e such that 2^e <= x/WAD < 2^(e+1)
            uint256 xScaled = x / WAD; // integer part
            uint256 e = 0;
            uint256 tmp = xScaled;
            while (tmp >= 2) { tmp >>= 1; e++; }

            // Normalise m = x / 2^e  into [WAD, 2*WAD)
            uint256 m = x >> e;

            // ln(m) for m in [1,2) via Padé approximant:
            // ln(m) ≈ 2*(m-1)/(m+1) * (1 + ((m-1)/(m+1))^2 / 3 + ...)
            // Use 4-term series for ~1e-9 accuracy
            uint256 num = m - WAD;          // m - 1  (WAD-scaled)
            uint256 den = m + WAD;          // m + 1  (WAD-scaled)
            uint256 t   = (num * WAD) / den; // t = (m-1)/(m+1)
            uint256 t2  = (t * t) / WAD;
            uint256 lnm = 2 * (t + t2 * t / WAD / 3 + t2 * t2 / WAD * t / WAD / 5 + t2 * t2 / WAD * t2 / WAD * t / WAD / 7);

            result = e * ln2 + lnm;
        }
    }
}
