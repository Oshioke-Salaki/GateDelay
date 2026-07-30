// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {WrapperContract} from "../contracts/WrapperContract.sol";
import {WrapperContractV2} from "./fixtures/WrapperContractV2.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Underlying", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract WrapperContractTest is Test {
    WrapperContract internal wrapper;
    MockToken internal underlying;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        underlying = new MockToken();

        WrapperContract implementation = new WrapperContract();
        bytes memory initData = abi.encodeCall(
            WrapperContract.initialize,
            (address(underlying), "Wrapped Mock", "wMOCK", owner)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        wrapper = WrapperContract(address(proxy));

        underlying.mint(alice, 1_000 ether);
        underlying.mint(bob, 1_000 ether);

        vm.prank(alice);
        underlying.approve(address(wrapper), type(uint256).max);

        vm.prank(bob);
        underlying.approve(address(wrapper), type(uint256).max);
    }

    // ---------------------------------------------------------------
    // Initialization
    // ---------------------------------------------------------------

    function test_Initialize_SetsUpStateCorrectly() public view {
        assertEq(wrapper.underlyingAsset(), address(underlying));
        assertEq(wrapper.owner(), owner);
        assertEq(wrapper.name(), "Wrapped Mock");
        assertEq(wrapper.symbol(), "wMOCK");
        assertEq(wrapper.wrapperVersion(), 1);
        assertEq(wrapper.totalUnderlyingHeld(), 0);
    }

    function test_RevertWhen_InitializingWithZeroUnderlying() public {
        WrapperContract implementation = new WrapperContract();
        bytes memory initData = abi.encodeCall(
            WrapperContract.initialize,
            (address(0), "Wrapped Mock", "wMOCK", owner)
        );

        vm.expectRevert(WrapperContract.WrapperContract__ZeroAddress.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function test_RevertWhen_InitializingWithZeroOwner() public {
        WrapperContract implementation = new WrapperContract();
        bytes memory initData = abi.encodeCall(
            WrapperContract.initialize,
            (address(underlying), "Wrapped Mock", "wMOCK", address(0))
        );

        vm.expectRevert(WrapperContract.WrapperContract__ZeroAddress.selector);
        new ERC1967Proxy(address(implementation), initData);
    }

    function test_RevertWhen_InitializingTwice() public {
        vm.expectRevert();
        wrapper.initialize(address(underlying), "Wrapped Mock", "wMOCK", owner);
    }

    function test_RevertWhen_InitializingImplementationDirectly() public {
        WrapperContract implementation = new WrapperContract();
        vm.expectRevert();
        implementation.initialize(address(underlying), "Wrapped Mock", "wMOCK", owner);
    }

    // ---------------------------------------------------------------
    // wrap()
    // ---------------------------------------------------------------

    function test_RevertWhen_WrappingZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(WrapperContract.WrapperContract__ZeroAmount.selector);
        wrapper.wrap(0);
    }

    function test_Wrap_TransfersUnderlyingAndMintsWrapperToken() public {
        uint256 aliceUnderlyingBefore = underlying.balanceOf(alice);

        vm.prank(alice);
        wrapper.wrap(100 ether);

        assertEq(underlying.balanceOf(alice), aliceUnderlyingBefore - 100 ether);
        assertEq(underlying.balanceOf(address(wrapper)), 100 ether);
        assertEq(wrapper.balanceOf(alice), 100 ether);
        assertEq(wrapper.totalUnderlyingHeld(), 100 ether);
        assertEq(wrapper.totalSupply(), 100 ether);
    }

    function test_Wrap_IsAlways1to1() public {
        vm.prank(alice);
        wrapper.wrap(37 ether);

        assertEq(wrapper.balanceOf(alice), 37 ether);
        assertEq(wrapper.exchangeRate(), 1e18);
    }

    function test_Wrap_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit WrapperContract.Wrapped(alice, 50 ether);

        vm.prank(alice);
        wrapper.wrap(50 ether);
    }

    function test_Wrap_TracksOperationCount() public {
        vm.prank(alice);
        wrapper.wrap(10 ether);

        vm.prank(bob);
        wrapper.wrap(5 ether);

        (, , , uint256 wrapCount, ) = wrapper.getWrapperState();
        assertEq(wrapCount, 2);
    }

    // ---------------------------------------------------------------
    // unwrap()
    // ---------------------------------------------------------------

    function test_RevertWhen_UnwrappingZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(WrapperContract.WrapperContract__ZeroAmount.selector);
        wrapper.unwrap(0);
    }

    function test_RevertWhen_UnwrappingMoreThanWrapperBalance() public {
        vm.prank(alice);
        wrapper.wrap(10 ether);

        // Alice only holds 10 ether of wrapper tokens; ERC20 burn itself reverts
        // on insufficient balance before our own underlying check is reached.
        vm.prank(alice);
        vm.expectRevert();
        wrapper.unwrap(20 ether);
    }

    function test_Unwrap_BurnsWrapperTokenAndReturnsUnderlying() public {
        vm.prank(alice);
        wrapper.wrap(100 ether);

        uint256 aliceUnderlyingBefore = underlying.balanceOf(alice);

        vm.prank(alice);
        wrapper.unwrap(40 ether);

        assertEq(underlying.balanceOf(alice), aliceUnderlyingBefore + 40 ether);
        assertEq(wrapper.balanceOf(alice), 60 ether);
        assertEq(wrapper.totalUnderlyingHeld(), 60 ether);
    }

    function test_Unwrap_EmitsEvent() public {
        vm.prank(alice);
        wrapper.wrap(50 ether);

        vm.expectEmit(true, false, false, true);
        emit WrapperContract.Unwrapped(alice, 20 ether);

        vm.prank(alice);
        wrapper.unwrap(20 ether);
    }

    function test_Unwrap_TracksOperationCount() public {
        vm.prank(alice);
        wrapper.wrap(50 ether);

        vm.prank(alice);
        wrapper.unwrap(10 ether);

        vm.prank(alice);
        wrapper.unwrap(5 ether);

        (, , , , uint256 unwrapCount) = wrapper.getWrapperState();
        assertEq(unwrapCount, 2);
    }

    function test_WrapUnwrapRoundTrip_FullyRestoresBalances() public {
        uint256 aliceUnderlyingBefore = underlying.balanceOf(alice);

        vm.startPrank(alice);
        wrapper.wrap(77 ether);
        wrapper.unwrap(77 ether);
        vm.stopPrank();

        assertEq(underlying.balanceOf(alice), aliceUnderlyingBefore);
        assertEq(wrapper.balanceOf(alice), 0);
        assertEq(wrapper.totalUnderlyingHeld(), 0);
        assertEq(underlying.balanceOf(address(wrapper)), 0);
    }

    // ---------------------------------------------------------------
    // Wrapper token transferability (inherited ERC20 behavior)
    // ---------------------------------------------------------------

    function test_WrapperToken_IsTransferableAndRedeemableByNewHolder() public {
        vm.prank(alice);
        wrapper.wrap(100 ether);

        vm.prank(alice);
        wrapper.transfer(bob, 40 ether);

        assertEq(wrapper.balanceOf(alice), 60 ether);
        assertEq(wrapper.balanceOf(bob), 40 ether);

        uint256 bobUnderlyingBefore = underlying.balanceOf(bob);

        vm.prank(bob);
        wrapper.unwrap(40 ether);

        assertEq(underlying.balanceOf(bob), bobUnderlyingBefore + 40 ether);
    }

    // ---------------------------------------------------------------
    // Upgrades
    // ---------------------------------------------------------------

    function test_RevertWhen_NonOwnerAttemptsUpgrade() public {
        WrapperContractV2 newImplementation = new WrapperContractV2();

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, alice)
        );
        wrapper.upgradeToAndCall(address(newImplementation), "");
    }

    function test_Upgrade_PreservesStateAndBalances() public {
        vm.prank(alice);
        wrapper.wrap(150 ether);

        vm.prank(bob);
        wrapper.wrap(50 ether);

        uint256 versionBefore = wrapper.wrapperVersion();

        WrapperContractV2 newImplementation = new WrapperContractV2();

        vm.prank(owner);
        wrapper.upgradeToAndCall(address(newImplementation), "");

        // Storage/state survives the upgrade since it lives in the proxy.
        assertEq(wrapper.balanceOf(alice), 150 ether);
        assertEq(wrapper.balanceOf(bob), 50 ether);
        assertEq(wrapper.totalUnderlyingHeld(), 200 ether);
        assertEq(wrapper.underlyingAsset(), address(underlying));
        assertEq(wrapper.owner(), owner);
        assertEq(wrapper.wrapperVersion(), versionBefore + 1);
    }

    function test_Upgrade_EmitsWrapperUpgradedEvent() public {
        WrapperContractV2 newImplementation = new WrapperContractV2();

        vm.expectEmit(true, true, false, true);
        emit WrapperContract.WrapperUpgraded(2, address(newImplementation));

        vm.prank(owner);
        wrapper.upgradeToAndCall(address(newImplementation), "");
    }

    function test_Upgrade_NewLogicIsLiveAfterUpgrade() public {
        WrapperContractV2 newImplementation = new WrapperContractV2();

        vm.prank(owner);
        wrapper.upgradeToAndCall(address(newImplementation), "");

        WrapperContractV2 upgraded = WrapperContractV2(address(wrapper));
        assertEq(upgraded.describeVersion(), "v2");
        assertEq(upgraded.wrapFeeBps(), 0);
    }

    function test_Upgrade_StillFunctionalForWrapUnwrapAfterUpgrade() public {
        vm.prank(alice);
        wrapper.wrap(100 ether);

        WrapperContractV2 newImplementation = new WrapperContractV2();
        vm.prank(owner);
        wrapper.upgradeToAndCall(address(newImplementation), "");

        vm.prank(alice);
        wrapper.unwrap(30 ether);

        assertEq(wrapper.balanceOf(alice), 70 ether);
        assertEq(wrapper.totalUnderlyingHeld(), 70 ether);
    }

    function test_RepeatedUpgrades_IncrementVersionEachTime() public {
        WrapperContractV2 v2 = new WrapperContractV2();
        vm.prank(owner);
        wrapper.upgradeToAndCall(address(v2), "");
        assertEq(wrapper.wrapperVersion(), 2);

        WrapperContractV2 v3 = new WrapperContractV2();
        vm.prank(owner);
        wrapper.upgradeToAndCall(address(v3), "");
        assertEq(wrapper.wrapperVersion(), 3);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function test_GetWrapperState_ReflectsCurrentState() public {
        vm.prank(alice);
        wrapper.wrap(60 ether);

        (
            address underlyingAddr,
            uint256 underlyingHeld,
            uint256 version,
            uint256 wrapCount,
            uint256 unwrapCount
        ) = wrapper.getWrapperState();

        assertEq(underlyingAddr, address(underlying));
        assertEq(underlyingHeld, 60 ether);
        assertEq(version, 1);
        assertEq(wrapCount, 1);
        assertEq(unwrapCount, 0);
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_WrapThenUnwrapNetsToZero(uint96 amount) public {
        vm.assume(amount > 0 && amount <= 1_000 ether);

        vm.startPrank(alice);
        wrapper.wrap(amount);
        wrapper.unwrap(amount);
        vm.stopPrank();

        assertEq(wrapper.balanceOf(alice), 0);
        assertEq(wrapper.totalUnderlyingHeld(), 0);
    }

    function testFuzz_TotalSupplyAlwaysMatchesUnderlyingHeld(uint96 a, uint96 b) public {
        vm.assume(a > 0 && a <= 500 ether);
        vm.assume(b > 0 && b <= 500 ether);

        vm.prank(alice);
        wrapper.wrap(a);

        vm.prank(bob);
        wrapper.wrap(b);

        assertEq(wrapper.totalSupply(), wrapper.totalUnderlyingHeld());
    }
}
