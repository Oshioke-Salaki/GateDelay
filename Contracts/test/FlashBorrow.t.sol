// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../contracts/FlashBorrow.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FlashBorrowReceiver {
    FlashBorrow public immutable flashBorrow;
    bool public repayOnExecute;

    constructor(FlashBorrow flashBorrow_, bool repayOnExecute_) {
        flashBorrow = flashBorrow_;
        repayOnExecute = repayOnExecute_;
    }

    function executeFlashBorrow(address token, uint256 amount, bytes calldata) external {
        if (repayOnExecute) {
            IERC20(token).transfer(address(flashBorrow), amount);
        }
    }
}

contract FlashBorrowTest is Test {
    FlashBorrow internal flashBorrow;
    MockToken internal token;
    FlashBorrowReceiver internal receiver;
    address internal borrower = address(0xB0B);
    address internal other = address(0xF00D);

    function setUp() public {
        token = new MockToken();
        flashBorrow = new FlashBorrow(type(uint256).max);

        token.mint(address(flashBorrow), 1000 ether);
        receiver = new FlashBorrowReceiver(flashBorrow, true);
    }

    function test_successfulFlashBorrow() public {
        uint256 amount = 100 ether;
        uint256 initialBalance = token.balanceOf(address(flashBorrow));

        vm.prank(borrower);
        flashBorrow.flashBorrow(address(token), amount, address(receiver), "0x");

        assertEq(token.balanceOf(address(flashBorrow)), initialBalance);
        assertEq(flashBorrow.borrowCount(borrower), 1);
        assertEq(flashBorrow.totalBorrowed(borrower), amount);
        assertEq(flashBorrow.lastBorrowBlock(borrower), block.number);
    }

    function test_flashBorrow_emitsEvents() public {
        uint256 amount = 50 ether;
        bytes memory data = abi.encodePacked(uint256(42));

        vm.expectEmit(true, true, true, true);
        emit FlashBorrow.FlashBorrowExecuted(borrower, address(receiver), address(token), amount, data);

        vm.expectEmit(true, true, true, true);
        emit FlashBorrow.FlashBorrowRepaid(borrower, address(receiver), address(token), amount);

        vm.prank(borrower);
        flashBorrow.flashBorrow(address(token), amount, address(receiver), data);
    }

    function test_repaymentRequiredReverts() public {
        FlashBorrowReceiver badReceiver = new FlashBorrowReceiver(flashBorrow, false);

        vm.prank(borrower);
        vm.expectRevert(FlashBorrow.RepaymentRequired.selector);
        flashBorrow.flashBorrow(address(token), 10 ether, address(badReceiver), "");
    }

    function test_exceedingBorrowLimitReverts() public {
        flashBorrow.setBorrowLimit(borrower, 100 ether);

        vm.prank(borrower);
        vm.expectRevert(FlashBorrow.BorrowLimitExceeded.selector);
        flashBorrow.flashBorrow(address(token), 101 ether, address(receiver), "");
    }

    function test_globalBorrowLimitEnforced() public {
        flashBorrow.setGlobalBorrowLimit(30 ether);

        vm.prank(borrower);
        vm.expectRevert(FlashBorrow.BorrowLimitExceeded.selector);
        flashBorrow.flashBorrow(address(token), 50 ether, address(receiver), "");
    }

    function test_multipleFlashBorrowsAccumulateActivity() public {
        vm.prank(borrower);
        flashBorrow.flashBorrow(address(token), 10 ether, address(receiver), "0x");

        vm.prank(borrower);
        flashBorrow.flashBorrow(address(token), 20 ether, address(receiver), "0x");

        assertEq(flashBorrow.borrowCount(borrower), 2);
        assertEq(flashBorrow.totalBorrowed(borrower), 30 ether);
        assertEq(flashBorrow.remainingBorrowLimit(borrower), type(uint256).max);
    }

    function test_setBorrowLimit_onlyOwner() public {
        vm.prank(other);
        vm.expectRevert("Ownable: caller is not the owner");
        flashBorrow.setBorrowLimit(borrower, 1 ether);
    }

    function test_remainingBorrowLimitReturnsEffectiveCap() public {
        assertEq(flashBorrow.remainingBorrowLimit(borrower), type(uint256).max);

        flashBorrow.setGlobalBorrowLimit(100 ether);
        assertEq(flashBorrow.remainingBorrowLimit(borrower), 100 ether);

        flashBorrow.setBorrowLimit(borrower, 50 ether);
        assertEq(flashBorrow.remainingBorrowLimit(borrower), 50 ether);
    }
}
