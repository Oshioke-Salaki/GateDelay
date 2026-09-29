// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "../Contracts/src/MarketMinter.sol";
import "../Contracts/src/ERC20Token.sol";

contract MarketMinterTest is Test {
    ERC20Token token;
    MarketMinter controller;

    address admin = address(0xA);
    address minter = address(0xB);
    address recipient = address(0xC);
    address unauthorized = address(0xD);

    uint256 constant CAP = 1000 ether;
    uint256 constant PER_MINT = 500 ether;

    function setUp() public {
        vm.startPrank(admin);
        token = new ERC20Token(0);
        controller = new MarketMinter(address(token));
        // grant the controller minter rights on the token
        token.addMinter(address(controller));
        // register a minter in the controller with caps
        controller.registerMinter(minter, CAP, PER_MINT);
        vm.stopPrank();
    }

    function test_authorised_mint_success() public {
        uint256 amount = 200 ether;

        vm.prank(minter);
        controller.mint(recipient, amount);

        assertEq(token.balanceOf(recipient), amount);
        assertEq(controller.mintedTotal(minter), amount);
    }

    function test_nonMinterCannotMint() public {
        vm.prank(unauthorized);
        vm.expectRevert(MarketMinter.NotMinter.selector);
        controller.mint(recipient, 1 ether);
    }

    function test_onlyAdminCanRegisterMinter() public {
        _assertAdminDenied(abi.encodeCall(controller.registerMinter, (recipient, CAP, PER_MINT)));
    }

    function test_onlyAdminCanUnregisterMinter() public {
        _assertAdminDenied(abi.encodeCall(controller.unregisterMinter, (minter)));
    }

    function test_onlyAdminCanUpdateMintCap() public {
        _assertAdminDenied(abi.encodeCall(controller.setMintCap, (minter, CAP)));
    }

    function test_onlyAdminCanUpdatePerMintCap() public {
        _assertAdminDenied(abi.encodeCall(controller.setPerMintCap, (minter, PER_MINT)));
    }

    function _assertAdminDenied(bytes memory callData) internal {
        vm.prank(unauthorized);
        (bool success, bytes memory returnData) = address(controller).call(callData);

        assertFalse(success);
        assertEq(
            returnData,
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                unauthorized,
                bytes32(0)
            )
        );
    }

    function test_perMint_cap_enforced() public {
        // attempt to mint more than per-call cap
        vm.prank(minter);
        vm.expectRevert(MarketMinter.ExceedsPerMintCap.selector);
        controller.mint(recipient, PER_MINT + 1);
    }

    function test_total_cap_enforced_across_calls() public {
        // Two per-call mints exhaust the total cap.
        vm.prank(minter);
        controller.mint(recipient, PER_MINT);

        vm.prank(minter);
        controller.mint(recipient, PER_MINT);

        vm.prank(minter);
        vm.expectRevert(MarketMinter.ExceedsTotalCap.selector);
        controller.mint(recipient, 1);
    }

    function test_queries_and_remaining() public {
        // before minting
        assertTrue(controller.isMinter(minter));
        assertEq(controller.mintCap(minter), CAP);
        assertEq(controller.perMintCap(minter), PER_MINT);

        vm.prank(minter);
        controller.mint(recipient, 300 ether);

        assertEq(controller.mintedTotal(minter), 300 ether);
        assertEq(controller.remainingCap(minter), CAP - 300 ether);
    }
}
