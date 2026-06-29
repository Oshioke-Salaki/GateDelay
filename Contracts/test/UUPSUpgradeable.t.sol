// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/UUPSUpgradeable.sol";

contract MockUUPSV1 is UUPSUpgradeable {
    uint256 public value;
    address public owner;

    function initialize(address _owner) external {
        owner = _owner;
        value = 0;
    }

    function setValue(uint256 _value) external {
        require(msg.sender == owner, "Only owner");
        value = _value;
    }

    function getValue() external view returns (uint256) {
        return value;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == owner, "Only owner can upgrade");
    }
}

contract MockUUPSV2 is UUPSUpgradeable {
    uint256 public value;
    address public owner;
    uint256 public newField;

    function setValue(uint256 _value) external {
        require(msg.sender == owner, "Only owner");
        value = _value;
    }

    function getValue() external view returns (uint256) {
        return value;
    }

    function setNewField(uint256 _newField) external {
        require(msg.sender == owner, "Only owner");
        newField = _newField;
    }

    function _authorizeUpgrade(address newImplementation) internal override {
        require(msg.sender == owner, "Only owner can upgrade");
    }
}

contract UUPSUpgradeableTest is Test {
    MockUUPSV1 impl1;
    MockUUPSV2 impl2;
    address owner = address(0x1);
    address user = address(0x2);

    function setUp() public {
        impl1 = new MockUUPSV1();
        impl2 = new MockUUPSV2();
    }

    function test_GetImplementation() public {
        assertEq(impl1.getImplementation(), address(0));
    }

    function test_UpgradeTo() public {
        vm.prank(owner);
        impl1.upgradeTo(address(impl2));
        assertEq(impl1.getImplementation(), address(impl2));
    }

    function test_UpgradeHistoryTracked() public {
        assertEq(impl1.getUpgradeCount(), 0);
        vm.prank(owner);
        impl1.upgradeTo(address(impl2));
        assertEq(impl1.getUpgradeCount(), 1);
    }

    function test_UpgradeToAndCall() public {
        vm.prank(owner);
        impl1.initialize(owner);

        vm.prank(owner);
        impl1.upgradeToAndCall(
            address(impl2),
            abi.encodeWithSignature("setNewField(uint256)", 100)
        );

        assertEq(impl1.getImplementation(), address(impl2));
    }

    function test_OnlyOwnerCanUpgrade() public {
        vm.prank(owner);
        impl1.initialize(owner);

        vm.prank(user);
        vm.expectRevert("Only owner can upgrade");
        impl1.upgradeTo(address(impl2));
    }

    function test_CannotUpgradeToZeroAddress() public {
        vm.prank(owner);
        impl1.initialize(owner);

        vm.prank(owner);
        vm.expectRevert(UUPSUpgradeable.InvalidImplementation.selector);
        impl1.upgradeTo(address(0));
    }

    function test_IsImplementation() public {
        assertFalse(impl1.isImplementation(address(impl2)));
        vm.prank(owner);
        impl1.upgradeTo(address(impl2));
        assertTrue(impl1.isImplementation(address(impl2)));
    }

    function test_GetUpgradeHistory() public {
        vm.prank(owner);
        impl1.upgradeTo(address(impl2));

        address[] memory history = impl1.getUpgradeHistory();
        assertEq(history.length, 1);
        assertEq(history[0], address(impl2));
    }
}
