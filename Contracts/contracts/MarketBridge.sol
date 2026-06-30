// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Minimal reproduction of Chainlink CCIP's public message types, matching the
/// real `Client` library shape so this contract's `ccipSend` calls are wire-compatible
/// with an actual `IRouterClient` deployment.
library Client {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }

    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
        EVMTokenAmount[] destTokenAmounts;
    }
}

/// @dev Chainlink CCIP router interface (matches the real `IRouterClient`).
interface IRouterClient {
    function isChainSupported(uint64 destChainSelector) external view returns (bool supported);
    function getFee(uint64 destinationChainSelector, Client.EVM2AnyMessage memory message)
        external
        view
        returns (uint256 fee);
    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external
        payable
        returns (bytes32 messageId);
}

/// @title MarketBridge
/// @notice Cross-chain transfer scaffold for moving a tracked ERC20 token between chains.
/// Outbound transfers are sent through Chainlink's CCIP router. Inbound completion is
/// confirmed by an authorized relayer rather than a real `ccipReceive` callback, since
/// wiring the actual router/receiver pair requires real, audited per-chain endpoint
/// addresses that don't exist in this scaffold. Swap `_confirmIncoming` for a genuine
/// `CCIPReceiver` override (or LayerZero `lzReceive`) once those addresses are known,
/// and have the real bridge logic audited before moving real funds.
contract MarketBridge is Ownable {
    using SafeERC20 for IERC20;

    enum BridgeStatus {
        None,
        Pending,
        Completed,
        Failed,
        Refunded
    }

    struct ChainConfig {
        uint64 chainSelector;   // CCIP chain selector (or LayerZero chain id, depending on path used)
        bool supported;
        uint256 flatFee;        // flat fee charged in the bridged token, on top of any router fee
        uint256 feeBps;         // proportional fee in basis points (1 bps = 0.01%)
    }

    struct BridgeTransfer {
        uint256 transferId;
        address sender;
        address recipient;
        uint64 destChainSelector;
        uint256 amount;
        uint256 feeCharged;
        BridgeStatus status;
        uint256 createdAt;
        uint256 completedAt;
        bytes32 ccipMessageId;
    }

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MAX_FEE_BPS = 1_000; // 10% hard ceiling

    IERC20 public immutable bridgeToken;
    IRouterClient public ccipRouter;
    address public relayer;
    address public feeRecipient;

    mapping(uint64 => ChainConfig) private _chains;
    uint64[] private _supportedChainList;

    mapping(uint256 => BridgeTransfer) private _transfers;
    mapping(address => uint256[]) private _transfersBySender;
    uint256 private _nextTransferId = 1;

    uint256 public totalFeesCollected;
    uint256 public totalBridgedOut;
    uint256 public totalBridgedIn;

    event ChainSupported(uint64 indexed chainSelector, uint256 flatFee, uint256 feeBps);
    event ChainRemoved(uint64 indexed chainSelector);
    event ChainFeeUpdated(uint64 indexed chainSelector, uint256 flatFee, uint256 feeBps);
    event RelayerUpdated(address indexed newRelayer);
    event FeeRecipientUpdated(address indexed newFeeRecipient);
    event RouterUpdated(address indexed newRouter);

    event BridgeInitiated(
        uint256 indexed transferId,
        address indexed sender,
        address indexed recipient,
        uint64 destChainSelector,
        uint256 amount,
        uint256 feeCharged,
        bytes32 ccipMessageId
    );
    event BridgeCompleted(uint256 indexed transferId, uint256 completedAt);
    event BridgeFailed(uint256 indexed transferId, uint256 failedAt);
    event BridgeRefunded(uint256 indexed transferId, address indexed recipient, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error MarketBridge__NotRelayer(address caller);
    error MarketBridge__ChainNotSupported(uint64 chainSelector);
    error MarketBridge__ChainAlreadySupported(uint64 chainSelector);
    error MarketBridge__InvalidFee(uint256 feeBps);
    error MarketBridge__ZeroAmount();
    error MarketBridge__ZeroAddress();
    error MarketBridge__TransferNotFound(uint256 transferId);
    error MarketBridge__TransferNotPending(uint256 transferId, BridgeStatus currentStatus);
    error MarketBridge__InsufficientFeeFunds(uint256 required, uint256 available);

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert MarketBridge__NotRelayer(msg.sender);
        _;
    }

    constructor(address _bridgeToken, address _ccipRouter, address _relayer, address _feeRecipient, address _owner)
        Ownable(_owner)
    {
        if (_bridgeToken == address(0) || _ccipRouter == address(0) || _relayer == address(0) || _feeRecipient == address(0)) {
            revert MarketBridge__ZeroAddress();
        }
        bridgeToken = IERC20(_bridgeToken);
        ccipRouter = IRouterClient(_ccipRouter);
        relayer = _relayer;
        feeRecipient = _feeRecipient;
    }

    // ---------------------------------------------------------------
    // Admin: chains, fees, relayer, router
    // ---------------------------------------------------------------

    function addSupportedChain(uint64 chainSelector, uint256 flatFee, uint256 feeBps) external onlyOwner {
        if (_chains[chainSelector].supported) revert MarketBridge__ChainAlreadySupported(chainSelector);
        if (feeBps > MAX_FEE_BPS) revert MarketBridge__InvalidFee(feeBps);

        _chains[chainSelector] = ChainConfig({
            chainSelector: chainSelector,
            supported: true,
            flatFee: flatFee,
            feeBps: feeBps
        });
        _supportedChainList.push(chainSelector);

        emit ChainSupported(chainSelector, flatFee, feeBps);
    }

    function removeSupportedChain(uint64 chainSelector) external onlyOwner {
        if (!_chains[chainSelector].supported) revert MarketBridge__ChainNotSupported(chainSelector);
        _chains[chainSelector].supported = false;

        emit ChainRemoved(chainSelector);
    }

    function updateChainFee(uint64 chainSelector, uint256 flatFee, uint256 feeBps) external onlyOwner {
        if (!_chains[chainSelector].supported) revert MarketBridge__ChainNotSupported(chainSelector);
        if (feeBps > MAX_FEE_BPS) revert MarketBridge__InvalidFee(feeBps);

        _chains[chainSelector].flatFee = flatFee;
        _chains[chainSelector].feeBps = feeBps;

        emit ChainFeeUpdated(chainSelector, flatFee, feeBps);
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert MarketBridge__ZeroAddress();
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert MarketBridge__ZeroAddress();
        feeRecipient = newFeeRecipient;
        emit FeeRecipientUpdated(newFeeRecipient);
    }

    function setCcipRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert MarketBridge__ZeroAddress();
        ccipRouter = IRouterClient(newRouter);
        emit RouterUpdated(newRouter);
    }

    // ---------------------------------------------------------------
    // Outbound bridging
    // ---------------------------------------------------------------

    function calculateFee(uint64 destChainSelector, uint256 amount) public view returns (uint256) {
        ChainConfig storage cfg = _chains[destChainSelector];
        if (!cfg.supported) revert MarketBridge__ChainNotSupported(destChainSelector);

        return cfg.flatFee + (amount * cfg.feeBps) / BPS_DENOMINATOR;
    }

    /// @notice Lock `amount` of the bridge token and initiate a CCIP transfer to `recipient`
    /// on `destChainSelector`. The proportional + flat fee is deducted from `amount` before
    /// the net amount is reflected in the transfer record; actual token movement across
    /// chains depends on the CCIP router's own token-transfer mechanics in production use.
    function bridgeOut(uint64 destChainSelector, address recipient, uint256 amount)
        external
        payable
        returns (uint256 transferId)
    {
        if (!_chains[destChainSelector].supported) revert MarketBridge__ChainNotSupported(destChainSelector);
        if (amount == 0) revert MarketBridge__ZeroAmount();
        if (recipient == address(0)) revert MarketBridge__ZeroAddress();

        uint256 fee = calculateFee(destChainSelector, amount);
        uint256 netAmount = amount - fee;

        bridgeToken.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) {
            bridgeToken.safeTransfer(feeRecipient, fee);
            totalFeesCollected += fee;
        }

        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: address(bridgeToken), amount: netAmount});

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(recipient),
            data: "",
            tokenAmounts: tokenAmounts,
            feeToken: address(0), // pay CCIP fee in native gas token
            extraArgs: ""
        });

        bridgeToken.forceApprove(address(ccipRouter), netAmount);
        bytes32 messageId = ccipRouter.ccipSend{value: msg.value}(destChainSelector, message);

        transferId = _nextTransferId++;
        _transfers[transferId] = BridgeTransfer({
            transferId: transferId,
            sender: msg.sender,
            recipient: recipient,
            destChainSelector: destChainSelector,
            amount: netAmount,
            feeCharged: fee,
            status: BridgeStatus.Pending,
            createdAt: block.timestamp,
            completedAt: 0,
            ccipMessageId: messageId
        });
        _transfersBySender[msg.sender].push(transferId);

        totalBridgedOut += netAmount;

        emit BridgeInitiated(transferId, msg.sender, recipient, destChainSelector, netAmount, fee, messageId);
    }

    // ---------------------------------------------------------------
    // Inbound confirmation
    // ---------------------------------------------------------------
    // NOTE: in a production deployment this section is replaced by a genuine
    // `CCIPReceiver.ccipReceive` (or LayerZero `lzReceive`) override invoked directly by
    // the router/endpoint contract. The relayer pattern below is a placeholder so transfer
    // status and accounting can be exercised and tested without a live cross-chain router.

    function confirmBridgeCompleted(uint256 transferId) external onlyRelayer {
        BridgeTransfer storage t = _transfers[transferId];
        if (t.transferId == 0) revert MarketBridge__TransferNotFound(transferId);
        if (t.status != BridgeStatus.Pending) revert MarketBridge__TransferNotPending(transferId, t.status);

        t.status = BridgeStatus.Completed;
        t.completedAt = block.timestamp;
        totalBridgedIn += t.amount;

        emit BridgeCompleted(transferId, block.timestamp);
    }

    function markBridgeFailed(uint256 transferId) external onlyRelayer {
        BridgeTransfer storage t = _transfers[transferId];
        if (t.transferId == 0) revert MarketBridge__TransferNotFound(transferId);
        if (t.status != BridgeStatus.Pending) revert MarketBridge__TransferNotPending(transferId, t.status);

        t.status = BridgeStatus.Failed;

        emit BridgeFailed(transferId, block.timestamp);
    }

    /// @notice Refund a failed transfer's net amount back to the original sender.
    /// @dev Requires the contract to hold sufficient bridge-token balance, e.g. funds that
    /// were never actually consumed by the router on a failed send.
    function refundFailedTransfer(uint256 transferId) external onlyRelayer {
        BridgeTransfer storage t = _transfers[transferId];
        if (t.transferId == 0) revert MarketBridge__TransferNotFound(transferId);
        if (t.status != BridgeStatus.Failed) revert MarketBridge__TransferNotPending(transferId, t.status);

        uint256 available = bridgeToken.balanceOf(address(this));
        if (available < t.amount) revert MarketBridge__InsufficientFeeFunds(t.amount, available);

        t.status = BridgeStatus.Refunded;
        bridgeToken.safeTransfer(t.sender, t.amount);

        emit BridgeRefunded(transferId, t.sender, t.amount);
    }

    function withdrawFees(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert MarketBridge__ZeroAddress();
        bridgeToken.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    function getBridgeTransfer(uint256 transferId) external view returns (BridgeTransfer memory) {
        BridgeTransfer memory t = _transfers[transferId];
        if (t.transferId == 0) revert MarketBridge__TransferNotFound(transferId);
        return t;
    }

    function getTransfersBySender(address sender) external view returns (uint256[] memory) {
        return _transfersBySender[sender];
    }

    function getChainConfig(uint64 chainSelector) external view returns (ChainConfig memory) {
        return _chains[chainSelector];
    }

    function isChainSupported(uint64 chainSelector) external view returns (bool) {
        return _chains[chainSelector].supported;
    }

    function getSupportedChains() external view returns (uint64[] memory) {
        return _supportedChainList;
    }

    function getTransferStatus(uint256 transferId) external view returns (BridgeStatus) {
        BridgeTransfer memory t = _transfers[transferId];
        if (t.transferId == 0) revert MarketBridge__TransferNotFound(transferId);
        return t.status;
    }

    function transferCount() external view returns (uint256) {
        return _nextTransferId - 1;
    }
}
