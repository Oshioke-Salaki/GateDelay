// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DepositLogic.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC20 for testing with configurable decimals
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1_000_000 * 10 ** decimals_);
    }

    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function decimals() public view override returns (uint8) { return _decimals; }
}

contract DepositLogicTest is Test {
    DepositLogic internal depositLogic;

    MockERC20 internal tokenUSDC;
    MockERC20 internal tokenWETH;
    MockERC20 internal tokenWBTC;

    address internal alice    = address(0xA11CE);
    address internal bob      = address(0xB0B);
    address internal charlie  = address(0xC0C);
    address internal nonOwner = address(0xBAD);

    uint256 internal constant MIN_DEPOSIT = 1 ether;
    uint256 internal constant DEPOSIT_CAP = 100_000 ether;

    function setUp() public {
        depositLogic = new DepositLogic();

        tokenUSDC = new MockERC20("USD Coin", "USDC", 6);
        tokenWETH = new MockERC20("Wrapped Ether", "WETH", 18);
        tokenWBTC = new MockERC20("Wrapped Bitcoin", "WBTC", 8);

        // Add supported assets (depositCap, minimumDeposit)
        depositLogic.addAsset(address(tokenUSDC), DEPOSIT_CAP, MIN_DEPOSIT);
        depositLogic.addAsset(address(tokenWETH), DEPOSIT_CAP, MIN_DEPOSIT);
        depositLogic.addAsset(address(tokenWBTC), DEPOSIT_CAP, MIN_DEPOSIT);

        // Fund users
        tokenUSDC.mint(alice, 500_000 * 1e6);
        tokenUSDC.mint(bob,   500_000 * 1e6);
        tokenUSDC.mint(charlie, 500_000 * 1e6);

        tokenWETH.mint(alice, 1000 ether);
        tokenWETH.mint(bob,   1000 ether);

        tokenWBTC.mint(alice, 100 * 1e8);
        tokenWBTC.mint(bob,   100 * 1e8);
    }

    // --- Helpers ---

    function _deposit(address user, address asset, uint256 amount) internal returns (uint256) {
        vm.startPrank(user);
        ERC20(asset).approve(address(depositLogic), amount);
        uint256 shares = depositLogic.deposit(asset, amount, user);
        vm.stopPrank();
        return shares;
    }

    // --- Constructor & Initialization ---

    function test_constructor_setsOwner() public {
        assertEq(depositLogic.owner(), address(this));
    }

    function test_constructor_notPaused() public {
        assertFalse(depositLogic.paused());
    }

    // --- Asset Management (Admin) ---

    function test_addAsset_emitsEvent() public {
        MockERC20 newToken = new MockERC20("New", "NEW", 18);
        vm.expectEmit(true, true, true, true);
        emit DepositLogic.AssetAdded(address(newToken), 50_000 ether, 0);
        depositLogic.addAsset(address(newToken), 50_000 ether, 0);
    }

    function test_addAsset_isSupported() public {
        assertTrue(depositLogic.isAssetSupported(address(tokenUSDC)));
    }

    function test_addAsset_getDepositCap() public {
        DepositLogic.AssetConfig memory config = depositLogic.getAssetConfig(address(tokenUSDC));
        assertEq(config.depositCap, DEPOSIT_CAP);
    }

    function test_addAsset_revertsZeroAddress() public {
        vm.expectRevert(DepositLogic.ZeroAddress.selector);
        depositLogic.addAsset(address(0), DEPOSIT_CAP, 0);
    }

    function test_addAsset_revertsDuplicate() public {
        vm.expectRevert(abi.encodeWithSelector(DepositLogic.AssetAlreadySupported.selector, address(tokenUSDC)));
        depositLogic.addAsset(address(tokenUSDC), DEPOSIT_CAP, 0);
    }

    function test_addAsset_revertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        depositLogic.addAsset(address(0x123), DEPOSIT_CAP, 0);
    }

    function test_removeAsset_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit DepositLogic.AssetRemoved(address(tokenWBTC));
        depositLogic.removeAsset(address(tokenWBTC));
    }

    function test_removeAsset_removesSupport() public {
        depositLogic.removeAsset(address(tokenWBTC));
        assertFalse(depositLogic.isAssetSupported(address(tokenWBTC)));
    }

    function test_removeAsset_revertsUnsupportedAsset() public {
        vm.expectRevert(abi.encodeWithSelector(DepositLogic.AssetNotSupported.selector, address(0xDEAD)));
        depositLogic.removeAsset(address(0xDEAD));
    }

    function test_removeAsset_revertsWhenDepositsExist() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        vm.expectRevert(DepositLogic.InsufficientBalance.selector);
        depositLogic.removeAsset(address(tokenUSDC));
    }

    function test_removeAsset_revertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        depositLogic.removeAsset(address(tokenWBTC));
    }

    function test_setDepositCap_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit DepositLogic.DepositCapUpdated(address(tokenUSDC), 200_000 ether);
        depositLogic.setDepositCap(address(tokenUSDC), 200_000 ether);
    }

    function test_setDepositCap_updatesCap() public {
        depositLogic.setDepositCap(address(tokenUSDC), 200_000 ether);
        DepositLogic.AssetConfig memory config = depositLogic.getAssetConfig(address(tokenUSDC));
        assertEq(config.depositCap, 200_000 ether);
    }

    function test_setDepositCap_revertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        depositLogic.setDepositCap(address(tokenUSDC), 200_000 ether);
    }

    function test_setDepositCap_revertsUnsupportedAsset() public {
        vm.expectRevert(abi.encodeWithSelector(DepositLogic.AssetNotSupported.selector, address(0xDEAD)));
        depositLogic.setDepositCap(address(0xDEAD), 200_000 ether);
    }

    function test_supportedAssetsCount_increases() public {
        assertEq(depositLogic.supportedAssetsCount(), 3);
    }

    function test_supportedAssetsCount_afterRemove() public {
        depositLogic.removeAsset(address(tokenWBTC));
        assertEq(depositLogic.supportedAssetsCount(), 2);
    }

    function test_getSupportedAssets_returnsList() public {
        address[] memory assets = depositLogic.getSupportedAssets();
        assertEq(assets.length, 3);
        assertEq(assets[0], address(tokenUSDC));
        assertEq(assets[1], address(tokenWETH));
        assertEq(assets[2], address(tokenWBTC));
    }

    // --- Minimum Deposit Management ---

    function test_setMinimumDeposit_updates() public {
        depositLogic.setMinimumDeposit(address(tokenUSDC), 2 ether);
        DepositLogic.AssetConfig memory config = depositLogic.getAssetConfig(address(tokenUSDC));
        assertEq(config.minimumDeposit, 2 ether);
    }

    function test_setMinimumDeposit_revertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        depositLogic.setMinimumDeposit(address(tokenUSDC), 2 ether);
    }

    // --- Pause / Unpause ---

    function test_pause_setsState() public {
        depositLogic.pause();
        assertTrue(depositLogic.paused());
    }

    function test_unpause_setsState() public {
        depositLogic.pause();
        depositLogic.unpause();
        assertFalse(depositLogic.paused());
    }

    function test_pause_revertsNonOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        depositLogic.pause();
    }

    // --- Deposits ---

    function test_deposit_emitsEvent() public {
        vm.startPrank(alice);
        tokenUSDC.approve(address(depositLogic), 100 ether);
        vm.expectEmit(true, true, true, true);
        emit DepositLogic.AssetDeposited(alice, address(tokenUSDC), 100 ether, 100 ether - 1000);
        depositLogic.deposit(address(tokenUSDC), 100 ether, alice);
        vm.stopPrank();
    }

    function test_deposit_updatesUserDeposit() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.totalDeposited, 100 ether);
    }

    function test_deposit_updatesUserShares() public {
        uint256 shares = _deposit(alice, address(tokenUSDC), 100 ether);
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.shares, shares);
    }

    function test_deposit_updatesTotalDeposits() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        assertEq(depositLogic.assetTotalDeposited(address(tokenUSDC)), 100 ether);
    }

    function test_deposit_updatesTotalShares() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        assertEq(depositLogic.assetTotalShares(address(tokenUSDC)), 100 ether - 1000);
    }

    function test_deposit_multipleUsers() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(bob, address(tokenUSDC), 50 ether);
        assertEq(depositLogic.assetTotalDeposited(address(tokenUSDC)), 150 ether);
    }

    function test_deposit_revertsZeroAmount() public {
        vm.startPrank(alice);
        tokenUSDC.approve(address(depositLogic), 1 ether);
        vm.expectRevert(DepositLogic.ZeroAssets.selector);
        depositLogic.deposit(address(tokenUSDC), 0, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsBelowMin() public {
        vm.startPrank(alice);
        tokenUSDC.approve(address(depositLogic), 1 ether);
        vm.expectRevert();
        depositLogic.deposit(address(tokenUSDC), 0.5 ether, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsUnsupportedAsset() public {
        vm.startPrank(alice);
        tokenUSDC.approve(address(depositLogic), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(DepositLogic.AssetNotSupported.selector, address(0xDEAD)));
        depositLogic.deposit(address(0xDEAD), 100 ether, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsWhenPaused() public {
        depositLogic.pause();
        vm.startPrank(alice);
        tokenUSDC.approve(address(depositLogic), 100 ether);
        vm.expectRevert();
        depositLogic.deposit(address(tokenUSDC), 100 ether, alice);
        vm.stopPrank();
    }

    function test_deposit_revertsCapExceeded() public {
        depositLogic.setDepositCap(address(tokenUSDC), 200 ether);
        _deposit(alice, address(tokenUSDC), 150 ether);
        vm.startPrank(bob);
        tokenUSDC.approve(address(depositLogic), 100 ether);
        vm.expectRevert();
        depositLogic.deposit(address(tokenUSDC), 100 ether, bob);
        vm.stopPrank();
    }

    function test_deposit_transfersTokens() public {
        uint256 before = tokenUSDC.balanceOf(alice);
        _deposit(alice, address(tokenUSDC), 100 ether);
        assertEq(tokenUSDC.balanceOf(alice), before - 100 ether);
        assertEq(tokenUSDC.balanceOf(address(depositLogic)), 100 ether);
    }

    function test_deposit_multipleAssets() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(alice, address(tokenWETH), 10 ether);
        _deposit(alice, address(tokenWBTC), 1 * 1e8);

        DepositLogic.AssetPosition memory posUSDC = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        DepositLogic.AssetPosition memory posWETH = depositLogic.getAssetPosition(address(tokenWETH), alice);
        DepositLogic.AssetPosition memory posWBTC = depositLogic.getAssetPosition(address(tokenWBTC), alice);

        assertEq(posUSDC.totalDeposited, 100 ether);
        assertEq(posWETH.totalDeposited, 10 ether);
        assertEq(posWBTC.totalDeposited, 1 * 1e8);
    }

    function test_deposit_multipleDepositsAccumulate() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(alice, address(tokenUSDC), 50 ether);
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.totalDeposited, 150 ether);
    }

    // --- Share Calculation ---

    function test_sharePrice_initial() public {
        assertEq(depositLogic.pricePerShare(address(tokenUSDC)), 1e18);
    }

    function test_sharePrice_afterDeposit() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        assertEq(depositLogic.pricePerShare(address(tokenUSDC)), 1e18);
    }

    function test_sharePrice_afterMultipleDeposits() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(bob, address(tokenUSDC), 50 ether);
        assertEq(depositLogic.pricePerShare(address(tokenUSDC)), 1e18);
    }

    function test_sharePrice_afterWithdrawal() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(bob, address(tokenUSDC), 100 ether);

        vm.startPrank(alice);
        uint256 shares = depositLogic.getAssetPosition(address(tokenUSDC), alice).shares;
        depositLogic.withdraw(address(tokenUSDC), shares / 2, alice);
        vm.stopPrank();

        assertEq(depositLogic.pricePerShare(address(tokenUSDC)), 1e18);
    }

    function test_deposit_sharesCalculatedCorrectly() public {
        uint256 shares1 = _deposit(alice, address(tokenUSDC), 100 ether);
        // First deposit: 1:1 minus MINIMUM_SHARES (1000)
        assertEq(shares1, 100 ether - 1000);

        uint256 shares2 = _deposit(alice, address(tokenUSDC), 50 ether);
        // Second deposit uses ratio
        assertTrue(shares2 > 0);
    }

    // --- Withdrawals ---

    function test_withdraw_emitsEvent() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        vm.startPrank(alice);
        uint256 shares = depositLogic.getAssetPosition(address(tokenUSDC), alice).shares;
        vm.expectEmit(true, true, true, true);
        emit DepositLogic.AssetWithdrawn(alice, address(tokenUSDC), 100 ether - 1000, shares);
        depositLogic.withdraw(address(tokenUSDC), shares, alice);
        vm.stopPrank();
    }

    function test_withdraw_updatesUserDeposit() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        uint256 shares = depositLogic.getAssetPosition(address(tokenUSDC), alice).shares;
        vm.prank(alice);
        depositLogic.withdraw(address(tokenUSDC), shares, alice);
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.totalDeposited, 0);
    }

    function test_withdraw_updatesUserShares() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        uint256 shares = depositLogic.getAssetPosition(address(tokenUSDC), alice).shares;
        vm.prank(alice);
        depositLogic.withdraw(address(tokenUSDC), shares, alice);
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.shares, 0);
    }

    function test_withdraw_transfersTokens() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        uint256 before = tokenUSDC.balanceOf(alice);
        uint256 shares = depositLogic.getAssetPosition(address(tokenUSDC), alice).shares;
        vm.prank(alice);
        depositLogic.withdraw(address(tokenUSDC), shares, alice);
        assertTrue(tokenUSDC.balanceOf(alice) > before);
    }

    function test_withdraw_revertsZeroShares() public {
        vm.prank(alice);
        vm.expectRevert(DepositLogic.ZeroShares.selector);
        depositLogic.withdraw(address(tokenUSDC), 0, alice);
    }

    function test_withdraw_revertsInsufficientShares() public {
        vm.prank(alice);
        vm.expectRevert();
        depositLogic.withdraw(address(tokenUSDC), 100 ether, alice);
    }

    function test_withdraw_revertsWhenPaused() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        depositLogic.pause();
        uint256 shares = depositLogic.getAssetPosition(address(tokenUSDC), alice).shares;
        vm.prank(alice);
        vm.expectRevert();
        depositLogic.withdraw(address(tokenUSDC), shares, alice);
    }

    function test_withdraw_revertsUnsupportedAsset() public {
        vm.expectRevert(abi.encodeWithSelector(DepositLogic.AssetNotSupported.selector, address(0xDEAD)));
        depositLogic.withdraw(address(0xDEAD), 100 ether, alice);
    }

    // --- Deposit History ---

    function test_depositHistory_recordsDeposit() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        DepositLogic.DepositRecord[] memory history = depositLogic.getDepositHistory(alice);
        assertEq(history.length, 1);
        assertEq(history[0].assets, 100 ether);
    }

    function test_depositHistory_multipleDeposits() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(alice, address(tokenUSDC), 50 ether);
        DepositLogic.DepositRecord[] memory history = depositLogic.getDepositHistory(alice);
        assertEq(history.length, 2);
        assertEq(history[0].assets, 100 ether);
        assertEq(history[1].assets, 50 ether);
    }

    function test_depositCount() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(alice, address(tokenUSDC), 50 ether);
        assertEq(depositLogic.depositCount(alice), 2);
    }

    function test_depositHistory_differentUsers() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(bob, address(tokenUSDC), 50 ether);
        assertEq(depositLogic.depositCount(alice), 1);
        assertEq(depositLogic.depositCount(bob), 1);
    }

    // --- Queries ---

    function test_getAssetPosition() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.totalDeposited, 100 ether);
        assertTrue(pos.shares > 0);
    }

    function test_getAssetPosition_noDeposit() public {
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.totalDeposited, 0);
        assertEq(pos.shares, 0);
    }

    function test_getUserSummary() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(alice, address(tokenWETH), 10 ether);
        (uint256 totalDeposits, , uint256 positionCount) = depositLogic.getUserSummary(alice);
        assertEq(totalDeposits, 110 ether);
        assertEq(positionCount, 2);
    }

    function test_getTotalValueLocked() public {
        _deposit(alice, address(tokenUSDC), 100 ether);
        _deposit(bob, address(tokenWETH), 50 ether);
        assertEq(depositLogic.totalValueLocked(), 150 ether);
    }

    function test_getAssetConfig() public {
        DepositLogic.AssetConfig memory config = depositLogic.getAssetConfig(address(tokenUSDC));
        assertTrue(config.isActive);
        assertEq(config.depositCap, DEPOSIT_CAP);
        assertEq(config.minimumDeposit, MIN_DEPOSIT);
    }

    // --- Fuzz Tests ---

    function testFuzz_deposit_anyAmount(uint96 amount) public {
        vm.assume(amount >= MIN_DEPOSIT);
        vm.assume(amount <= tokenUSDC.balanceOf(alice));

        uint256 before = tokenUSDC.balanceOf(alice);
        uint256 shares = _deposit(alice, address(tokenUSDC), uint256(amount));

        assertEq(tokenUSDC.balanceOf(alice), before - uint256(amount));
        DepositLogic.AssetPosition memory pos = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        assertEq(pos.totalDeposited, uint256(amount));
        assertEq(pos.shares, shares);
    }

    function testFuzz_depositWithdraw_roundTrip(uint96 amount) public {
        vm.assume(amount >= MIN_DEPOSIT);
        vm.assume(amount <= tokenUSDC.balanceOf(alice));

        uint256 shares = _deposit(alice, address(tokenUSDC), uint256(amount));
        vm.startPrank(alice);
        uint256 withdrawn = depositLogic.withdraw(address(tokenUSDC), shares, alice);
        vm.stopPrank();

        assertTrue(withdrawn > 0);
    }

    function testFuzz_differentAssets_independent(uint96 usdcAmount, uint96 wethAmount) public {
        vm.assume(usdcAmount >= MIN_DEPOSIT);
        vm.assume(wethAmount >= MIN_DEPOSIT);
        vm.assume(usdcAmount <= tokenUSDC.balanceOf(alice));
        vm.assume(wethAmount <= tokenWETH.balanceOf(alice));

        _deposit(alice, address(tokenUSDC), uint256(usdcAmount));
        _deposit(alice, address(tokenWETH), uint256(wethAmount));

        DepositLogic.AssetPosition memory posUSDC = depositLogic.getAssetPosition(address(tokenUSDC), alice);
        DepositLogic.AssetPosition memory posWETH = depositLogic.getAssetPosition(address(tokenWETH), alice);
        assertEq(posUSDC.totalDeposited, uint256(usdcAmount));
        assertEq(posWETH.totalDeposited, uint256(wethAmount));
    }
}
