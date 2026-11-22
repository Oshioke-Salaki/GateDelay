// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {mulDiv as mulDiv512} from "@prb/math/src/Common.sol";

/// @title PRBMathUD60x18Compat
/// @notice Compatibility layer for PRBMathUD60x18 v3 API using prb-math v4 Common.mulDiv
/// @dev Provides mul/div functions for 18-decimal fixed-point numbers (UD60x18)
library PRBMathUD60x18Compat {
    uint256 internal constant UNIT = 1e18;

    /// @notice Multiplies two 18-decimal fixed-point numbers
    function mul(uint256 x, uint256 y) internal pure returns (uint256) {
        return mulDiv512(x, y, UNIT);
    }

    /// @notice Divides two 18-decimal fixed-point numbers
    function div(uint256 x, uint256 y) internal pure returns (uint256) {
        return mulDiv512(x, UNIT, y);
    }

    /// @notice Multiplies x and y and divides by denominator with 512-bit precision
    function mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256) {
        return mulDiv512(x, y, denominator);
    }
}