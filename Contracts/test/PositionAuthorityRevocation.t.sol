// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Test} from "forge-std/Test.sol";
import {PositionToken} from "../src/PositionToken.sol";
contract PositionAuthorityRevocationTest is Test {
    PositionToken token;
    address actor = address(11);
    address holder = address(12);
    address settlement = address(13);
    function setUp() public { token = new PositionToken(address(this)); }
    function testRevokePrivilegesAndRetainSettlement() public {
        uint256 id = token.yesId(actor);
        token.authorise(actor);
        vm.prank(actor); token.mint(holder, id, 10, "");
        token.revokeMinter(actor);
        vm.prank(actor); vm.expectRevert(PositionToken.UnauthorisedMinter.selector);
        token.mint(holder, id, 1, "");
        token.authoriseBurner(actor);
        vm.prank(actor); token.burn(holder, id, 1);
        token.revokeBurner(actor);
        vm.prank(actor); vm.expectRevert(PositionToken.UnauthorisedBurner.selector);
        token.burn(holder, id, 1);
        token.authoriseGlobalSettlement(actor);
        vm.prank(actor); token.mint(holder, id, 1, "");
        token.revokeGlobalSettlement(actor);
        vm.prank(actor); vm.expectRevert(PositionToken.UnauthorisedMinter.selector);
        token.mint(holder, id, 1, "");
        token.authoriseBurner(settlement);
        vm.prank(settlement); token.burn(holder, id, 1);
        vm.prank(holder); token.safeTransferFrom(holder, address(14), id, 1, "");
        assertEq(token.balanceOf(address(14), id), 1);
    }
    function testOnlyFactoryCanRevoke() public {
        vm.startPrank(actor);
        vm.expectRevert(PositionToken.NotFactory.selector); token.revokeMinter(actor);
        vm.expectRevert(PositionToken.NotFactory.selector); token.revokeBurner(actor);
        vm.expectRevert(PositionToken.NotFactory.selector); token.revokeGlobalSettlement(actor);
        vm.stopPrank();
    }
}
