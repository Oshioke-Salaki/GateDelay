// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Proxy.sol";

contract MockImplementation {
    uint256 public value;

    function setValue(uint256 _value) external {
        value = _value;
    }

    function getValue() external view returns (uint256) {
        return value;
    }
}

contract ProxyTest is Test {
    Proxy proxy;
    MockImplementation impl1;
    MockImplementation impl2;
    address admin = address(0x1);
    address user = address(0x2);

    function setUp() public {
        impl1 = new MockImplementation();
        impl2 = new MockImplementation();
        proxy = new Proxy(address(impl1), admin);
    }

    function test_ProxyDeployed() public {
        assertEq(proxy.getImplementation(), address(impl1));
        assertEq(proxy.getAdmin(), admin);
    }

    function test_DelegateCallWorks() public {
        vm.prank(user);
        (bool success, ) = address(proxy).call(
            abi.encodeWithSignature("setValue(uint256)", 42)
        );
        require(success);

        (bool success2, bytes memory result) = address(proxy).staticcall(
            abi.encodeWithSignature("getValue()")
        );
        require(success2);
        uint256 value = abi.decode(result, (uint256));
        assertEq(value, 42);
    }

    function test_UpgradeTo() public {
        vm.prank(admin);
        proxy.upgradeTo(address(impl2));
        assertEq(proxy.getImplementation(), address(impl2));
    }

    function test_UpgradeHistoryTracked() public {
        assertEq(proxy.getUpgradeCount(), 1);
        vm.prank(admin);
        proxy.upgradeTo(address(impl2));
        assertEq(proxy.getUpgradeCount(), 2);
    }

    function test_ChangeAdmin() public {
        address newAdmin = address(0x3);
        vm.prank(admin);
        proxy.changeAdmin(newAdmin);
        assertEq(proxy.getAdmin(), newAdmin);
    }

    function test_OnlyAdminCanUpgrade() public {
        vm.prank(user);
        vm.expectRevert(Proxy.InvalidProxyAdmin.selector);
        proxy.upgradeTo(address(impl2));
    }

    function test_OnlyAdminCanChangeAdmin() public {
        vm.prank(user);
        vm.expectRevert(Proxy.InvalidProxyAdmin.selector);
        proxy.changeAdmin(address(0x3));
    }

    function test_CannotUpgradeToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(Proxy.ZeroImplementation.selector);
        proxy.upgradeTo(address(0));
    }

    function test_CannotSetAdminToZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(Proxy.InvalidProxyAdmin.selector);
        proxy.changeAdmin(address(0));
    }

    function test_ReceiveETH() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        (bool success, ) = address(proxy).call{value: 1 ether}("");
        require(success);
    }
}
