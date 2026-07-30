// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {VaultShares}    from "../contracts/VaultShares.sol";
import {ERC20}          from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal underlying ERC-20
// ─────────────────────────────────────────────────────────────────────────────
contract MockUnderlying is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────
contract VaultSharesTest is Test {
    VaultShares    internal vs;
    MockUnderlying internal underlying;

    // The test contract itself acts as the vault (has onlyVault permission)
    address internal vaultAddr = address(this);

    address internal owner  = address(this);
    address internal alice  = makeAddr("alice");
    address internal bob    = makeAddr("bob");
    address internal carol  = makeAddr("carol");

    uint256 internal constant SHARES_1K   = 1_000e18;
    uint256 internal constant SHARES_500  = 500e18;
    uint256 internal constant ASSETS_1K   = 1_000e18;
    uint256 internal constant PRECISION   = 1e18;

    // ─────────────────────────────────────────────────────────────────────────
    // Setup
    // ─────────────────────────────────────────────────────────────────────────

    function setUp() public {
        underlying = new MockUnderlying();
        vs = new VaultShares(
            "GateDelay Vault Share",
            "gvUSD",
            address(underlying),
            vaultAddr   // test contract == vault
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Issue shares from vault (test contract) to a recipient.
    function _issue(address to, uint256 shares, uint256 assets) internal {
        vs.issueShares(to, shares, assets);
    }

    /// @dev Issue + set managed assets so value queries are meaningful.
    function _issueAndSetAssets(address to, uint256 shares, uint256 assets) internal {
        uint256 current = vs.totalManagedAssets();
        _issue(to, shares, assets);
        vs.setTotalManagedAssets(current + assets);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Share issuance (Shares are issued)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Issue_MintsBalanceToRecipient() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        assertEq(vs.balanceOf(alice), SHARES_1K);
    }

    function test_Issue_UpdatesTotalSharesIssued() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        _issue(bob,   SHARES_500, ASSETS_1K / 2);
        assertEq(vs.totalSharesIssued(), SHARES_1K + SHARES_500);
    }

    function test_Issue_UpdatesTotalManagedAssets() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        assertEq(vs.totalManagedAssets(), ASSETS_1K);
    }

    function test_Issue_RecordsIssuanceHistory() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        _issue(alice, SHARES_500, ASSETS_1K / 2);

        VaultShares.IssuanceRecord[] memory hist = vs.getIssuanceHistory(alice);
        assertEq(hist.length, 2);
        assertEq(hist[0].shares,          SHARES_1K);
        assertEq(hist[0].assetsDeposited, ASSETS_1K);
        assertEq(hist[1].shares,          SHARES_500);
    }

    function test_Issue_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit VaultShares.SharesIssued(alice, SHARES_1K, ASSETS_1K);
        _issue(alice, SHARES_1K, ASSETS_1K);
    }

    function test_Issue_OnlyVaultCanMint() public {
        vm.prank(alice);
        vm.expectRevert(VaultShares.OnlyVault.selector);
        vs.issueShares(alice, SHARES_1K, ASSETS_1K);
    }

    function test_Issue_RevertsZeroShares() public {
        vm.expectRevert(VaultShares.ZeroAmount.selector);
        vs.issueShares(alice, 0, ASSETS_1K);
    }

    function test_Issue_RevertsZeroAddress() public {
        vm.expectRevert(VaultShares.ZeroAddress.selector);
        vs.issueShares(address(0), SHARES_1K, ASSETS_1K);
    }

    function test_Issue_RevertsWhenPaused() public {
        vs.pause();
        vm.expectRevert();
        vs.issueShares(alice, SHARES_1K, ASSETS_1K);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Ownership tracking (Ownership is tracked)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Ownership_BalanceTrackedPerHolder() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        _issue(bob,   SHARES_500, ASSETS_1K / 2);

        assertEq(vs.balanceOf(alice), SHARES_1K);
        assertEq(vs.balanceOf(bob),   SHARES_500);
    }

    function test_Ownership_TotalSupplyIsSum() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        _issue(bob,   SHARES_500, ASSETS_1K / 2);
        assertEq(vs.totalSupply(), SHARES_1K + SHARES_500);
    }

    function test_Ownership_BalanceSnapshotTakenOnIssuance() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        VaultShares.BalanceSnapshot[] memory snaps = vs.getBalanceSnapshots(alice);
        assertEq(snaps.length, 1);
        assertEq(snaps[0].shares, SHARES_1K);
        assertEq(snaps[0].blockNumber, block.number);
    }

    function test_Ownership_ManualSnapshot() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vm.roll(block.number + 5);
        vs.takeSnapshot(alice);

        VaultShares.BalanceSnapshot[] memory snaps = vs.getBalanceSnapshots(alice);
        assertEq(snaps.length, 2);
        assertEq(snaps[1].blockNumber, block.number);
    }

    function test_Ownership_ERC20VotesCheckpoints() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vm.prank(alice);
        vs.delegate(alice);

        assertEq(vs.getVotes(alice), SHARES_1K, "voting weight matches shares");
    }

    function test_Ownership_RedeemDecreasesBalance() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.redeemShares(alice, SHARES_500);
        assertEq(vs.balanceOf(alice), SHARES_500);
    }

    function test_Ownership_RedeemUpdatesBurnCount() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.redeemShares(alice, SHARES_500);
        assertEq(vs.totalSharesBurned(), SHARES_500);
    }

    function test_Ownership_RedeemRevertsInsufficientShares() public {
        _issue(alice, SHARES_500, ASSETS_1K / 2);
        vm.expectRevert(
            abi.encodeWithSelector(
                VaultShares.InsufficientShares.selector,
                alice, SHARES_1K, SHARES_500
            )
        );
        vs.redeemShares(alice, SHARES_1K);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Value calculation (Values are calculated)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Value_PricePerShareAtInception() public view {
        assertEq(vs.pricePerShare(), PRECISION, "1.0 at inception");
    }

    function test_Value_PricePerShareAfterYield() public {
        // 1000 shares backed by 1000 assets → pps = 1.0
        _issueAndSetAssets(alice, SHARES_1K, ASSETS_1K);
        assertApproxEqRel(vs.pricePerShare(), PRECISION, 1e14, "pps 1.0");

        // Simulate 10% yield: 1100 assets, 1000 shares → pps = 1.1
        vs.setTotalManagedAssets(1_100e18);
        assertApproxEqRel(vs.pricePerShare(), 1.1e18, 1e14, "pps 1.1 after yield");
    }

    function test_Value_ShareValue_ProRata() public {
        _issueAndSetAssets(alice, SHARES_1K, ASSETS_1K);
        _issueAndSetAssets(bob,   SHARES_500, ASSETS_1K / 2);
        // total: 1500 shares, 1500 assets → 1:1
        assertApproxEqRel(vs.shareValue(SHARES_1K), ASSETS_1K, 1e14);
        assertApproxEqRel(vs.shareValue(SHARES_500), ASSETS_1K / 2, 1e14);
    }

    function test_Value_AccountValue() public {
        _issueAndSetAssets(alice, SHARES_1K, ASSETS_1K);
        assertApproxEqRel(vs.accountValue(alice), ASSETS_1K, 1e14);
    }

    function test_Value_AccountValue_ZeroIfNoShares() public view {
        assertEq(vs.accountValue(alice), 0);
    }

    function test_Value_AssetsToShares_AtInception() public view {
        assertEq(vs.assetsToShares(ASSETS_1K), ASSETS_1K, "1:1 before any supply");
    }

    function test_Value_AssetsToShares_AfterYield() public {
        // 1000 shares / 1100 assets → buying 110 assets gives ~100 shares
        _issueAndSetAssets(alice, SHARES_1K, ASSETS_1K);
        vs.setTotalManagedAssets(1_100e18);
        uint256 shares = vs.assetsToShares(110e18);
        assertApproxEqRel(shares, 100e18, 1e14, "~100 shares for 110 assets at 1.1 pps");
    }

    function test_Value_SharesToAssets() public {
        _issueAndSetAssets(alice, SHARES_1K, ASSETS_1K);
        vs.setTotalManagedAssets(1_100e18);
        uint256 assets = vs.sharesToAssets(SHARES_500);
        assertApproxEqRel(assets, 550e18, 1e14, "500 shares → 550 assets at 1.1 pps");
    }

    function test_Value_SupplyStats() public {
        _issueAndSetAssets(alice, SHARES_1K, ASSETS_1K);
        vs.redeemShares(alice, SHARES_500);

        (
            uint256 current,
            uint256 issued,
            uint256 burned,
            uint256 managedAssets,
            uint256 pps
        ) = vs.supplyStats();

        assertEq(current,       SHARES_500,  "current supply");
        assertEq(issued,        SHARES_1K,   "total issued");
        assertEq(burned,        SHARES_500,  "total burned");
        assertEq(managedAssets, ASSETS_1K,   "managed assets");
        assertGt(pps,           0,           "pps nonzero");
    }

    function test_Value_CirculatingShares() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        _issue(bob,   SHARES_500, ASSETS_1K / 2);
        vs.redeemShares(alice, SHARES_500);
        assertEq(vs.circulatingShares(), SHARES_1K);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Transfers (Transfers work)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Transfer_MovesBalance() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vm.prank(alice);
        vs.transfer(bob, SHARES_500);

        assertEq(vs.balanceOf(alice), SHARES_500);
        assertEq(vs.balanceOf(bob),   SHARES_500);
    }

    function test_Transfer_RecordsHistory() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vm.prank(alice);
        vs.transfer(bob, SHARES_500);

        VaultShares.TransferRecord[] memory hist = vs.getTransferHistory(alice);
        assertEq(hist.length, 1);
        assertEq(hist[0].from,   alice);
        assertEq(hist[0].to,     bob);
        assertEq(hist[0].amount, SHARES_500);
    }

    function test_Transfer_Approval_And_TransferFrom() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vm.prank(alice);
        vs.approve(carol, SHARES_500);

        vm.prank(carol);
        vs.transferFrom(alice, bob, SHARES_500);

        assertEq(vs.balanceOf(alice), SHARES_500);
        assertEq(vs.balanceOf(bob),   SHARES_500);
    }

    function test_Transfer_Restriction_BlocksNonWhitelisted() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.setTransferRestriction(true);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(VaultShares.TransferNotAllowed.selector, alice, bob)
        );
        vs.transfer(bob, SHARES_500);
    }

    function test_Transfer_Restriction_AllowsWhitelisted() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.setTransferRestriction(true);
        vs.setWhitelist(alice, true);

        vm.prank(alice);
        vs.transfer(bob, SHARES_500);
        assertEq(vs.balanceOf(bob), SHARES_500);
    }

    function test_Transfer_Restriction_AllowedWhenReceiverWhitelisted() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.setTransferRestriction(true);
        vs.setWhitelist(bob, true); // receiver whitelisted is sufficient

        vm.prank(alice);
        vs.transfer(bob, SHARES_500);
        assertEq(vs.balanceOf(bob), SHARES_500);
    }

    function test_Transfer_BatchWhitelist() public {
        address[] memory accounts = new address[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        vs.batchSetWhitelist(accounts, true);

        assertTrue(vs.transferWhitelist(alice));
        assertTrue(vs.transferWhitelist(bob));
    }

    function test_Transfer_RevertsWhenPaused() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.pause();

        vm.prank(alice);
        vm.expectRevert();
        vs.transfer(bob, SHARES_500);
    }

    function test_Transfer_Unrestricted_AfterToggleOff() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vs.setTransferRestriction(true);
        vs.setTransferRestriction(false);

        vm.prank(alice);
        vs.transfer(bob, SHARES_500);
        assertEq(vs.balanceOf(bob), SHARES_500);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Queries (Queries work)
    // ─────────────────────────────────────────────────────────────────────────

    function test_Query_IssuanceCount() public {
        _issue(alice, SHARES_1K,  ASSETS_1K);
        _issue(alice, SHARES_500, ASSETS_1K / 2);
        assertEq(vs.issuanceCount(alice), 2);
    }

    function test_Query_TransferCount() public {
        _issue(alice, SHARES_1K, ASSETS_1K);
        vm.prank(alice); vs.transfer(bob, 100e18);
        vm.prank(alice); vs.transfer(carol, 100e18);
        assertEq(vs.transferCount(alice), 2);
    }

    function test_Query_GetTransferHistory_Empty() public view {
        VaultShares.TransferRecord[] memory hist = vs.getTransferHistory(alice);
        assertEq(hist.length, 0);
    }

    function test_Query_GetIssuanceHistory_MultipleRounds() public {
        for (uint256 i; i < 5; ++i) {
            _issue(alice, 100e18, 100e18);
        }
        assertEq(vs.issuanceCount(alice), 5);
    }

    function test_Query_VaultAddress() public view {
        assertEq(vs.vault(), vaultAddr);
    }

    function test_Query_UnderlyingAsset() public view {
        assertEq(address(vs.underlyingAsset()), address(underlying));
    }

    function test_Query_SetVault_UpdatesVaultAddress() public {
        address newVault = makeAddr("newVault");
        vs.setVault(newVault);
        assertEq(vs.vault(), newVault);
    }

    function test_Query_SetVault_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        vs.setVault(alice);
    }

    function test_Query_SetVault_RevertsZeroAddress() public {
        vm.expectRevert(VaultShares.ZeroAddress.selector);
        vs.setVault(address(0));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. ERC-2612 Permit
    // ─────────────────────────────────────────────────────────────────────────

    function test_Permit_AllowsGaslessApproval() public {
        uint256 privKey = 0xABCDEF;
        address signer  = vm.addr(privKey);

        _issue(signer, SHARES_1K, ASSETS_1K);

        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(
            privKey, signer, carol, SHARES_500, vs.nonces(signer), deadline
        );

        vs.permit(signer, carol, SHARES_500, deadline, v, r, s);
        assertEq(vs.allowance(signer, carol), SHARES_500);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_Issue_BalanceMatchesShares(uint128 shares) public {
        vm.assume(shares > 0);
        _issue(alice, uint256(shares), uint256(shares));
        assertEq(vs.balanceOf(alice), uint256(shares));
    }

    function testFuzz_Value_ShareValueProRata(uint128 totalShares, uint128 assets) public {
        vm.assume(totalShares > 0 && assets > 0);
        _issue(alice, uint256(totalShares), uint256(assets));
        vs.setTotalManagedAssets(uint256(assets));

        uint256 half = uint256(totalShares) / 2;
        if (half == 0) return;

        uint256 val = vs.shareValue(half);
        uint256 expected = uint256(half) * uint256(assets) / uint256(totalShares);
        assertApproxEqAbs(val, expected, 1, "value proportional to share fraction");
    }

    function testFuzz_Transfer_ConservesSupply(uint128 shares, uint128 transferAmt) public {
        vm.assume(shares > 0 && transferAmt > 0 && transferAmt <= shares);
        _issue(alice, uint256(shares), uint256(shares));
        uint256 supplyBefore = vs.totalSupply();

        vm.prank(alice);
        vs.transfer(bob, uint256(transferAmt));

        assertEq(vs.totalSupply(), supplyBefore, "supply unchanged by transfer");
        assertEq(vs.balanceOf(alice) + vs.balanceOf(bob), supplyBefore);
    }

    function testFuzz_PricePerShare_NeverZero(uint128 shares, uint128 assets) public {
        vm.assume(shares > 0 && assets > 0);
        _issue(alice, uint256(shares), uint256(assets));
        vs.setTotalManagedAssets(uint256(assets));
        assertGt(vs.pricePerShare(), 0, "pps always positive");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal — EIP-712 permit signing helper
    // ─────────────────────────────────────────────────────────────────────────

    function _signPermit(
        uint256 privateKey,
        address owner_,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256(
                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                ),
                owner_,
                spender,
                value,
                nonce,
                deadline
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", vs.DOMAIN_SEPARATOR(), structHash)
        );
        (v, r, s) = vm.sign(privateKey, digest);
    }
}
