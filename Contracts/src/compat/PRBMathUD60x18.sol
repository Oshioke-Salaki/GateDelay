// SPDX-License-Identifier: MIT
pragma solidity >=0.8.19;

import {mulDiv} from "@prb/math/src/Common.sol";

/// @notice Compatibility shim for legacy contracts importing `prb-math/PRBMathUD60x18.sol`.
/// @dev prb-math v4 uses UD60x18; this library preserves the v3 `using PRBMathUD60x18 for uint256` API.
library PRBMathUD60x18 {
    uint256 internal constant SCALE = 1e18;

    function mul(uint256 x, uint256 y) internal pure returns (uint256 result) {
        return mulDiv(x, y, SCALE);
    }

    function div(uint256 x, uint256 y) internal pure returns (uint256 result) {
        return mulDiv(x, SCALE, y);
    }
}
