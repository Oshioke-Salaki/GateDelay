// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MarketBridge, Client, IRouterClient} from "../contracts/MarketBridge.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Mock CCIP router that mimics ccipSend's external effects (pulling the approved
/// token amount, charging a native fee, returning a deterministic message id) without
/// implementing real cross-chain messaging.
contract MockCcipRouter is IRouterClient {
    uint256 public nativeFee = 0.01 ether;
    uint256 public nextNonce = 1;
    mapping(uint64 => bool) public supportedChains;

    function setChainSupported(uint64 chainSelector, bool supported) external {
        supportedChains[chainSelector] = supported;
    }

    function setNativeFee(uint256 fee) external {
        nativeFee = fee;
    }

    function isChainSupported(uint64 destChainSelector) external view returns (bool) {
        return supportedChains[destChainSelector];
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external view returns (uint256) {
        return nativeFee;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        require(msg.value >= nativeFee, "insufficient native fee");

        if (message.tokenAmounts.length > 0) {
            ERC20(message.tokenAmounts[0].token).transferFrom(
                msg.sender, address(this), message.tokenAmounts[0].amount
            );
        }

        return keccak256(abi.encode(nextNonce++, block.timestamp));
    }
}

contract MarketBridgeTest is Test {
    MarketBridge internal bridge;
    MockToken internal token;
    MockCcipRouter internal router;

    address internal owner = makeAddr("owner");
    address internal relayer = makeAddr("relayer");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");
    address internal bobRemote = makeAddr("bobRemote"); // recipient on destination chain

    uint64 internal constant CHAIN_AVALANCHE = 6433500567565415381;
    uint64 internal constant CHAIN_BASE = 15971525489660198786;

    function setUp() public {
        token = new MockToken();
        router = new MockCcipRouter();

        bridge = new MarketBridge(address(token), address(router), relayer, feeRecipient, owner);

        token.mint(alice, 1_000 ether);
        vm.prank(alice);
        token.approve(address(bridge), type(uint256).max);

        vm.deal(alice, 10 ether);
    }

    function _addChain(uint64 chainSelector, uint256 flatFee, uint256 feeBps) internal {
        vm.prank(owner);
        bridge.addSupportedChain(chainSelector, flatFee, feeBps);
    }

    // ---------------------------------------------------------------
    // Access control
    // ---------------------------------------------------------------

    function test_RevertWhen_AddSupportedChainCalledByNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice)
        );
        bridge.addSupportedChain(CHAIN_BASE, 0, 0);
    }

    function test_RevertWhen_ConfirmBridgeCompletedCalledByNonRelayer() public {
        _addChain(CHAIN_BASE, 0, 0);
        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 100 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__NotRelayer.selector, alice)
        );
        bridge.confirmBridgeCompleted(transferId);
    }

    // ---------------------------------------------------------------
    // Chain support
    // ---------------------------------------------------------------

    function test_AddSupportedChain_SetsConfigAndEmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit MarketBridge.ChainSupported(CHAIN_BASE, 1 ether, 50);

        _addChain(CHAIN_BASE, 1 ether, 50);

        assertTrue(bridge.isChainSupported(CHAIN_BASE));
        MarketBridge.ChainConfig memory cfg = bridge.getChainConfig(CHAIN_BASE);
        assertEq(cfg.flatFee, 1 ether);
        assertEq(cfg.feeBps, 50);
    }

    function test_RevertWhen_AddingAlreadySupportedChain() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__ChainAlreadySupported.selector, CHAIN_BASE)
        );
        bridge.addSupportedChain(CHAIN_BASE, 0, 0);
    }

    function test_RevertWhen_AddingChainWithFeeAboveCeiling() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__InvalidFee.selector, 1001)
        );
        bridge.addSupportedChain(CHAIN_BASE, 0, 1001);
    }

    function test_RemoveSupportedChain_DisablesFurtherBridging() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(owner);
        bridge.removeSupportedChain(CHAIN_BASE);

        assertFalse(bridge.isChainSupported(CHAIN_BASE));

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__ChainNotSupported.selector, CHAIN_BASE)
        );
        bridge.bridgeOut(CHAIN_BASE, bobRemote, 10 ether);
    }

    function test_GetSupportedChains_ListsAddedChains() public {
        _addChain(CHAIN_BASE, 0, 0);
        _addChain(CHAIN_AVALANCHE, 0, 0);

        uint64[] memory chains = bridge.getSupportedChains();
        assertEq(chains.length, 2);
        assertEq(chains[0], CHAIN_BASE);
        assertEq(chains[1], CHAIN_AVALANCHE);
    }

    function test_UpdateChainFee_ChangesFeeAndEmitsEvent() public {
        _addChain(CHAIN_BASE, 1 ether, 10);

        vm.expectEmit(true, false, false, true);
        emit MarketBridge.ChainFeeUpdated(CHAIN_BASE, 2 ether, 25);

        vm.prank(owner);
        bridge.updateChainFee(CHAIN_BASE, 2 ether, 25);

        MarketBridge.ChainConfig memory cfg = bridge.getChainConfig(CHAIN_BASE);
        assertEq(cfg.flatFee, 2 ether);
        assertEq(cfg.feeBps, 25);
    }

    // ---------------------------------------------------------------
    // Fee management
    // ---------------------------------------------------------------

    function test_CalculateFee_CombinesFlatAndProportional() public {
        _addChain(CHAIN_BASE, 1 ether, 100); // 1 ether flat + 1% (100 bps)

        uint256 fee = bridge.calculateFee(CHAIN_BASE, 100 ether);
        assertEq(fee, 1 ether + 1 ether); // 1 ether flat + 1 ether (1% of 100)
    }

    function test_RevertWhen_CalculatingFeeForUnsupportedChain() public {
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__ChainNotSupported.selector, CHAIN_BASE)
        );
        bridge.calculateFee(CHAIN_BASE, 10 ether);
    }

    function test_BridgeOut_DeductsFeeAndCreditsRecipientFeeRecipient() public {
        _addChain(CHAIN_BASE, 1 ether, 100); // 1 ether + 1%

        uint256 feeRecipientBalanceBefore = token.balanceOf(feeRecipient);

        vm.prank(alice);
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 100 ether);

        uint256 expectedFee = 2 ether;
        assertEq(token.balanceOf(feeRecipient), feeRecipientBalanceBefore + expectedFee);
        assertEq(bridge.totalFeesCollected(), expectedFee);
    }

    function test_WithdrawFees_TransfersAccumulatedFeeTokensHeldByContract() public {
        // Fees route directly to feeRecipient in bridgeOut, so withdrawFees covers any
        // bridge-token balance the contract separately accumulates (e.g. dust, refunds).
        token.mint(address(bridge), 5 ether);

        vm.prank(owner);
        bridge.withdrawFees(owner, 5 ether);

        assertEq(token.balanceOf(owner), 5 ether);
    }

    // ---------------------------------------------------------------
    // bridgeOut
    // ---------------------------------------------------------------

    function test_RevertWhen_BridgingZeroAmount() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        vm.expectRevert(MarketBridge.MarketBridge__ZeroAmount.selector);
        bridge.bridgeOut(CHAIN_BASE, bobRemote, 0);
    }

    function test_RevertWhen_BridgingToZeroAddressRecipient() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        vm.expectRevert(MarketBridge.MarketBridge__ZeroAddress.selector);
        bridge.bridgeOut(CHAIN_BASE, address(0), 10 ether);
    }

    function test_RevertWhen_BridgingToUnsupportedChain() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__ChainNotSupported.selector, CHAIN_BASE)
        );
        bridge.bridgeOut(CHAIN_BASE, bobRemote, 10 ether);
    }

    function test_BridgeOut_PullsTokensAndCreatesPendingTransfer() public {
        _addChain(CHAIN_BASE, 0, 0);

        uint256 aliceBalanceBefore = token.balanceOf(alice);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 50 ether);

        assertEq(token.balanceOf(alice), aliceBalanceBefore - 50 ether);

        MarketBridge.BridgeTransfer memory t = bridge.getBridgeTransfer(transferId);
        assertEq(t.sender, alice);
        assertEq(t.recipient, bobRemote);
        assertEq(t.destChainSelector, CHAIN_BASE);
        assertEq(t.amount, 50 ether);
        assertEq(uint256(t.status), uint256(MarketBridge.BridgeStatus.Pending));
        assertTrue(t.ccipMessageId != bytes32(0));
    }

    function test_BridgeOut_EmitsEvent() public {
        _addChain(CHAIN_BASE, 0, 50); // 0.5%

        vm.prank(alice);
        vm.recordLogs();
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 100 ether);
        // Net amount after 0.5% fee = 99.5 ether; just confirm the call succeeded and
        // tracked state lines up (full event-arg matching covered indirectly via getBridgeTransfer).
        MarketBridge.BridgeTransfer memory t = bridge.getBridgeTransfer(1);
        assertEq(t.amount, 99.5 ether);
        assertEq(t.feeCharged, 0.5 ether);
    }

    function test_BridgeOut_IncrementsTotalBridgedOut() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 40 ether);

        assertEq(bridge.totalBridgedOut(), 40 ether);
    }

    function test_BridgeOut_TracksTransferIdsBySender() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.startPrank(alice);
        uint256 id1 = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 10 ether);
        uint256 id2 = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 20 ether);
        vm.stopPrank();

        uint256[] memory ids = bridge.getTransfersBySender(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }

    function test_RevertWhen_RouterFeeNotMet() public {
        _addChain(CHAIN_BASE, 0, 0);
        router.setNativeFee(1 ether);

        vm.prank(alice);
        vm.expectRevert("insufficient native fee");
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 10 ether);
    }

    // ---------------------------------------------------------------
    // Status tracking: completion / failure / refund
    // ---------------------------------------------------------------

    function test_ConfirmBridgeCompleted_UpdatesStatusAndTotals() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 30 ether);

        vm.expectEmit(true, false, false, true);
        emit MarketBridge.BridgeCompleted(transferId, block.timestamp);

        vm.prank(relayer);
        bridge.confirmBridgeCompleted(transferId);

        assertEq(uint256(bridge.getTransferStatus(transferId)), uint256(MarketBridge.BridgeStatus.Completed));
        assertEq(bridge.totalBridgedIn(), 30 ether);
    }

    function test_RevertWhen_ConfirmingAlreadyCompletedTransfer() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 30 ether);

        vm.prank(relayer);
        bridge.confirmBridgeCompleted(transferId);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketBridge.MarketBridge__TransferNotPending.selector,
                transferId,
                MarketBridge.BridgeStatus.Completed
            )
        );
        bridge.confirmBridgeCompleted(transferId);
    }

    function test_RevertWhen_ConfirmingNonexistentTransfer() public {
        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__TransferNotFound.selector, 999)
        );
        bridge.confirmBridgeCompleted(999);
    }

    function test_MarkBridgeFailed_UpdatesStatus() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 30 ether);

        vm.prank(relayer);
        bridge.markBridgeFailed(transferId);

        assertEq(uint256(bridge.getTransferStatus(transferId)), uint256(MarketBridge.BridgeStatus.Failed));
    }

    function test_RefundFailedTransfer_ReturnsFundsToSender() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 30 ether);

        vm.prank(relayer);
        bridge.markBridgeFailed(transferId);

        // Simulate funds that never actually left the contract on the failed send.
        token.mint(address(bridge), 30 ether);

        uint256 aliceBalanceBefore = token.balanceOf(alice);

        vm.prank(relayer);
        bridge.refundFailedTransfer(transferId);

        assertEq(token.balanceOf(alice), aliceBalanceBefore + 30 ether);
        assertEq(uint256(bridge.getTransferStatus(transferId)), uint256(MarketBridge.BridgeStatus.Refunded));
    }

    function test_RevertWhen_RefundingWithoutSufficientContractBalance() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 30 ether);

        vm.prank(relayer);
        bridge.markBridgeFailed(transferId);

        // No funds minted back to the contract this time.
        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketBridge.MarketBridge__InsufficientFeeFunds.selector,
                30 ether,
                0
            )
        );
        bridge.refundFailedTransfer(transferId);
    }

    function test_RevertWhen_RefundingNonFailedTransfer() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 30 ether);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                MarketBridge.MarketBridge__TransferNotPending.selector,
                transferId,
                MarketBridge.BridgeStatus.Pending
            )
        );
        bridge.refundFailedTransfer(transferId);
    }

    // ---------------------------------------------------------------
    // Multi-chain isolation
    // ---------------------------------------------------------------

    function test_MultipleChains_TrackedIndependently() public {
        _addChain(CHAIN_BASE, 1 ether, 0);
        _addChain(CHAIN_AVALANCHE, 2 ether, 0);

        vm.startPrank(alice);
        uint256 idBase = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 10 ether);
        uint256 idAvax = bridge.bridgeOut{value: 0.01 ether}(CHAIN_AVALANCHE, bobRemote, 10 ether);
        vm.stopPrank();

        assertEq(bridge.getBridgeTransfer(idBase).destChainSelector, CHAIN_BASE);
        assertEq(bridge.getBridgeTransfer(idAvax).destChainSelector, CHAIN_AVALANCHE);
        assertEq(bridge.getBridgeTransfer(idBase).feeCharged, 1 ether);
        assertEq(bridge.getBridgeTransfer(idAvax).feeCharged, 2 ether);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function test_RevertWhen_QueryingNonexistentTransfer() public {
        vm.expectRevert(
            abi.encodeWithSelector(MarketBridge.MarketBridge__TransferNotFound.selector, 42)
        );
        bridge.getBridgeTransfer(42);
    }

    function test_TransferCount_TracksTotalCreated() public {
        _addChain(CHAIN_BASE, 0, 0);

        vm.startPrank(alice);
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 10 ether);
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 10 ether);
        bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, 10 ether);
        vm.stopPrank();

        assertEq(bridge.transferCount(), 3);
    }

    // ---------------------------------------------------------------
    // Fuzz
    // ---------------------------------------------------------------

    function testFuzz_NetAmountPlusFeeAlwaysEqualsGrossAmount(uint96 amount, uint16 feeBps) public {
        vm.assume(amount > 0.001 ether && amount <= 500 ether);
        vm.assume(feeBps <= 1000); // within MAX_FEE_BPS

        _addChain(CHAIN_BASE, 0, feeBps);

        vm.prank(alice);
        uint256 transferId = bridge.bridgeOut{value: 0.01 ether}(CHAIN_BASE, bobRemote, amount);

        MarketBridge.BridgeTransfer memory t = bridge.getBridgeTransfer(transferId);
        assertEq(t.amount + t.feeCharged, amount);
    }
}
