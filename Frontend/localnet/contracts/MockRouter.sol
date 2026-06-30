// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MockRouter {
    // Simple swap: pull tokenIn from sender, then send tokenOut from router balance
    function swapExactTokensForTokens(uint256 amountIn, uint256 /*amountOutMin*/, address[] calldata path, address to, uint256 /*deadline*/) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "invalid path");
        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // Pull tokenIn
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "transferIn failed");

        // For demo, simply transfer same amount of tokenOut from router to recipient
        require(IERC20(tokenOut).transfer(to, amountIn), "transferOut failed");

        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountIn;
        return amounts;
    }
}
