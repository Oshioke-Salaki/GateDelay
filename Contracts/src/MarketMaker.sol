// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LMSR.sol";
import "./ERC20Token.sol";

/// @notice Minimal interface to verify approved evidence stored in `EvidenceStorage`.
interface IEvidenceStorage {
    struct Evidence {
        uint256 id;
        uint256 disputeId;
        address submitter;
        string evidenceURI;
        bytes32 evidenceHash;
        uint256 timestamp;
        bool verified;
    }

    function getEvidence(uint256 evidenceId) external view returns (Evidence memory);
}

/// @notice Minimal synchronization hook on factory-deployed `PredictionMarket` contracts.
interface IPredictionMarketSync {
    function onCanonicalResolved(uint256 winningOutcome) external;
}

/// @notice Minimal synchronization hook on `MarketFactory`.
interface IMarketFactorySync {
    function syncMarketResolved(address market) external;
}

/// @title MarketMaker – Canonical LMSR prediction market engine
/// @notice Manages LMSR pricing, per-market isolated collateral reserves,
///         initial LMSR subsidy funding, evidence-gated resolution, and
///         1:1 alignment with `MarketFactory`-deployed `PredictionMarket` instances.
contract MarketMaker {
    using LMSR for uint256[];

    // ── Types ─────────────────────────────────────────────────────────────────

    struct Market {
        string description;
        uint256 b; // LMSR liquidity parameter (WAD)
        uint256 numOutcomes;
        uint256[] quantities; // q_i per outcome (WAD)
        bool resolved;
        uint256 winningOutcome;
        address creator;
    }

    /// @notice Resolution timing, authority, factory binding, and pause metadata per market.
    struct MarketMeta {
        address resolver; // Designated approved resolver for this market
        uint64 resolutionTime; // Earliest timestamp when resolution may occur (trading closes here)
        bool paused; // Synchronized pause flag
        address factoryMarket; // Paired PredictionMarket contract (address(0) if standalone)
        uint64 resolvedAt; // Timestamp when the market was resolved
        uint256 minReserve; // Cached max(requiredInitialSubsidy, factory minLiquidity)
        bytes32 resolutionEvidenceHash; // Approved evidence hash used to resolve the market
    }

    /// @notice Per-market asset and liability ledger guaranteeing strict reserve isolation.
    struct MarketAccounting {
        uint256 initialSubsidy; // Initial LMSR subsidy collected at market creation
        uint256 extraSubsidy; // Additional reserve top-ups credited to this market
        uint256 collateralReserve; // Exact collateral balance backing exclusively this market
        uint256 totalRedeemed; // Cumulative collateral paid out on redemptions in this market
        uint256 maxLiability; // Active: max_i(quantities[i]); Resolved: unredeemed winning shares
    }

    /// @dev Storage-optimized per-market accounting & hot-path trading guards.
    ///      Slot 0 packs `collateralReserve` and `maxLiabilityPlusOne` (1 SLOAD/SSTORE per trade).
    ///      Slot 1 packs `minReserve`, `resolutionTime`, and `paused` (1 SLOAD per trade).
    struct MarketAccountingStorage {
        uint128 collateralReserve;
        uint128 maxLiabilityPlusOne;
        uint128 minReserve;
        uint64 resolutionTime;
        bool paused;
        uint256 initialSubsidy;
        uint256 extraSubsidy;
        uint256 totalRedeemed;
    }

    /// @notice On-chain approval record binding resolution evidence to a market and outcome.
    struct ResolutionEvidence {
        uint256 winningOutcome;
        bytes32 evidenceHash;
        string evidenceURI;
        address approver;
        uint256 approvedAt;
        bool approved;
    }

    /// @notice Parameters for `MarketFactory` canonical market registration.
    struct FactoryMarketParams {
        address factoryMarket;
        address creator;
        string description;
        uint256 numOutcomes;
        uint256 b;
        uint256 resolutionTime;
        address resolver;
        uint256 initialSubsidy;
        uint256 minLiquidity;
    }

    struct CreateMarketParams {
        address funder;
        address creator;
        address factoryMarket;
        uint256 numOutcomes;
        uint256 b;
        uint256 resolutionTime;
        address resolver;
        uint256 initialSubsidy;
        uint256 minLiquidity;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    ERC20Token public immutable collateral;
    address public owner;
    address public marketFactory;
    address public defaultResolver;
    IEvidenceStorage public evidenceStorage;

    uint256 public marketCount;

    /// @notice Sum of `collateralReserve` across all markets.
    /// @dev Always <= `collateral.balanceOf(address(this))`. Unsolicited transfers
    ///      to this contract are never attributed to any market reserve.
    uint256 public totalReservedCollateral;

    mapping(uint256 => Market) public markets;
    mapping(uint256 => MarketMeta) private _marketMeta;
    mapping(uint256 => MarketAccountingStorage) private _accounting;

    // user => marketId => outcomeIndex => shares (WAD)
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) public positions;

    /// @notice Explicit allowlist of addresses permitted to act as market resolvers.
    mapping(address => bool) public approvedResolvers;

    /// @notice Explicit allowlist of addresses permitted to approve resolution evidence.
    mapping(address => bool) public approvedEvidenceApprovers;

    /// @notice Explicit allowlist of wrapper contracts permitted to call buyFor/sellFor on behalf of traders.
    mapping(address => bool) public approvedWrappers;

    /// @dev marketId => evidenceHash => ResolutionEvidence
    mapping(uint256 => mapping(bytes32 => ResolutionEvidence)) private _approvedEvidences;

    /// @dev Paired factory PredictionMarket => canonical numeric marketId
    mapping(address => uint256) private _factoryMarketToId;

    /// @dev True if the PredictionMarket address is bound to a numeric marketId
    mapping(address => bool) public isFactoryMarketLinked;

    /// @dev Originating MarketFactory that registered each factory-linked marketId
    mapping(uint256 => address) private _marketOriginFactory;

    /// @dev Reentrancy guard state (1 = unlocked, 2 = locked)
    uint256 private _locked = 1;

    // ── Events ────────────────────────────────────────────────────────────────

    event MarketCreated(uint256 indexed marketId, address indexed creator, uint256 numOutcomes, uint256 b);
    event MarketConfigured(
        uint256 indexed marketId,
        address indexed resolver,
        uint256 resolutionTime,
        uint256 initialSubsidy,
        address indexed factoryMarket
    );
    event MarketFunded(uint256 indexed marketId, address indexed funder, uint256 amount, uint256 newReserve);
    event SharesBought(uint256 indexed marketId, address indexed buyer, uint256 outcome, uint256 shares, uint256 cost);
    event SharesSold(
        uint256 indexed marketId, address indexed seller, uint256 outcome, uint256 shares, uint256 proceeds
    );
    event EvidenceApproved(
        uint256 indexed marketId,
        uint256 winningOutcome,
        bytes32 indexed evidenceHash,
        address indexed approver,
        string evidenceURI
    );
    event EvidenceRevoked(uint256 indexed marketId, bytes32 indexed evidenceHash, address indexed revoker);
    event MarketResolved(uint256 indexed marketId, uint256 winningOutcome);
    event MarketResolvedWithEvidence(
        uint256 indexed marketId,
        uint256 winningOutcome,
        address indexed resolver,
        bytes32 indexed evidenceHash,
        string evidenceURI
    );
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 payout);
    event ResidualReserveWithdrawn(uint256 indexed marketId, address indexed to, uint256 amount);
    event ApprovedResolverUpdated(address indexed resolver, bool approved);
    event DefaultResolverUpdated(address indexed resolver);
    event EvidenceApproverUpdated(address indexed approver, bool approved);
    event EvidenceStorageUpdated(address indexed evidenceStorage);
    event MarketFactoryUpdated(address indexed marketFactory);
    event ApprovedWrapperUpdated(address indexed wrapper, bool approved);
    event MarketResolverUpdated(uint256 indexed marketId, address indexed oldResolver, address indexed newResolver);
    event MarketPauseUpdated(uint256 indexed marketId, bool paused);

    // ── Errors ────────────────────────────────────────────────────────────────

    error Unauthorized();
    error InvalidMarket();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error MarketPaused();
    error InvalidOutcome();
    error InsufficientShares();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientLiquidity();
    error InsufficientSubsidy(uint256 provided, uint256 required);
    error InsufficientMarketReserve();
    error InvalidResolutionTime();
    error TradingClosed();
    error ResolutionTooEarly();
    error InvalidResolver();
    error InvalidEvidence();
    error EvidenceNotApproved();
    error EvidenceOutcomeMismatch();
    error EvidenceStorageNotConfigured();
    error MarketAlreadyLinked();
    error SlippageExceeded();
    error OutstandingLiability();
    error TransferFailed();
    error Reentrancy();
    error ReserveOverflow();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _collateral) {
        if (_collateral == address(0)) revert ZeroAddress();
        collateral = ERC20Token(_collateral);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    /// @notice Approve or revoke an address allowed to resolve markets.
    function setApprovedResolver(address resolver, bool approved) external onlyOwner {
        if (resolver == address(0)) revert ZeroAddress();
        approvedResolvers[resolver] = approved;
        if (!approved && defaultResolver == resolver) {
            defaultResolver = address(0);
            emit DefaultResolverUpdated(address(0));
        }
        emit ApprovedResolverUpdated(resolver, approved);
    }

    /// @notice Set the default approved resolver used when market creation omits one.
    function setDefaultResolver(address resolver) external onlyOwner {
        if (resolver == address(0)) revert ZeroAddress();
        if (!approvedResolvers[resolver]) revert InvalidResolver();
        defaultResolver = resolver;
        emit DefaultResolverUpdated(resolver);
    }

    /// @notice Approve or revoke an address allowed to approve resolution evidence.
    function setEvidenceApprover(address approver, bool approved) external onlyOwner {
        if (approver == address(0)) revert ZeroAddress();
        approvedEvidenceApprovers[approver] = approved;
        emit EvidenceApproverUpdated(approver, approved);
    }

    /// @notice Approve or revoke a wrapper contract allowed to call buyFor/sellFor/redeemFor.
    function setApprovedWrapper(address wrapper, bool approved) external onlyOwner {
        if (wrapper == address(0)) revert ZeroAddress();
        approvedWrappers[wrapper] = approved;
        emit ApprovedWrapperUpdated(wrapper, approved);
    }

    /// @notice Configure an external `EvidenceStorage` contract for verified resolution evidence.
    function setEvidenceStorage(address _evidenceStorage) external onlyOwner {
        if (_evidenceStorage != address(0) && _evidenceStorage.code.length == 0) revert InvalidEvidence();
        evidenceStorage = IEvidenceStorage(_evidenceStorage);
        emit EvidenceStorageUpdated(_evidenceStorage);
    }

    /// @notice Bind the canonical `MarketFactory` allowed to create and pause factory-linked markets.
    function setMarketFactory(address _marketFactory) external onlyOwner {
        if (_marketFactory == address(0)) revert ZeroAddress();
        marketFactory = _marketFactory;
        emit MarketFactoryUpdated(_marketFactory);
    }

    /// @notice Reassign the designated resolver for an unresolved market.
    function setMarketResolver(uint256 marketId, address newResolver) external onlyOwner {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (newResolver == address(0) || !approvedResolvers[newResolver] || newResolver == m.creator) {
            revert InvalidResolver();
        }
        MarketMeta storage meta = _marketMeta[marketId];
        address oldResolver = meta.resolver;
        meta.resolver = newResolver;
        emit MarketResolverUpdated(marketId, oldResolver, newResolver);
    }

    /// @notice Pause or unpause trading on an unresolved market.
    function setMarketPaused(uint256 marketId, bool paused) external {
        if (marketId >= marketCount) revert InvalidMarket();
        if (markets[marketId].resolved) revert MarketAlreadyResolved();
        MarketMeta storage meta = _marketMeta[marketId];
        address originFactory = _marketOriginFactory[marketId];
        bool isFactoryCaller =
            originFactory != address(0) && msg.sender == originFactory && meta.factoryMarket != address(0);
        if (msg.sender != owner && !isFactoryCaller) revert Unauthorized();
        meta.paused = paused;
        _accounting[marketId].paused = paused;
        emit MarketPauseUpdated(marketId, paused);
    }

    // ── Market lifecycle ──────────────────────────────────────────────────────

    /// @notice Compute the minimum initial collateral subsidy required for LMSR solvency.
    function requiredInitialSubsidy(uint256 numOutcomes, uint256 b) public pure returns (uint256) {
        return LMSR.initialSubsidy(numOutcomes, b);
    }

    /// @notice Create a new funded, timed, resolver-gated LMSR market directly.
    function createMarket(
        string calldata description,
        uint256 numOutcomes,
        uint256 b,
        uint256 resolutionTime,
        address resolver,
        uint256 initialSubsidy
    ) external nonReentrant returns (uint256 marketId) {
        marketId = _createMarket(
            CreateMarketParams({
                funder: msg.sender,
                creator: msg.sender,
                factoryMarket: address(0),
                numOutcomes: numOutcomes,
                b: b,
                resolutionTime: resolutionTime,
                resolver: resolver,
                initialSubsidy: initialSubsidy,
                minLiquidity: 0
            }),
            description
        );
    }

    /// @notice Create a canonical LMSR market paired 1:1 with a factory-deployed `PredictionMarket`.
    function createFactoryMarket(FactoryMarketParams calldata params)
        external
        nonReentrant
        returns (uint256 marketId)
    {
        if (marketFactory == address(0) || msg.sender != marketFactory) revert Unauthorized();
        if (params.factoryMarket == address(0) || params.creator == address(0)) revert ZeroAddress();
        if (isFactoryMarketLinked[params.factoryMarket]) revert MarketAlreadyLinked();

        marketId = _createMarket(
            CreateMarketParams({
                funder: msg.sender,
                creator: params.creator,
                factoryMarket: params.factoryMarket,
                numOutcomes: params.numOutcomes,
                b: params.b,
                resolutionTime: params.resolutionTime,
                resolver: params.resolver,
                initialSubsidy: params.initialSubsidy,
                minLiquidity: params.minLiquidity
            }),
            params.description
        );

        _factoryMarketToId[params.factoryMarket] = marketId;
        isFactoryMarketLinked[params.factoryMarket] = true;
        _marketOriginFactory[marketId] = msg.sender;
    }

    /// @notice Add extra collateral backing exclusively to `marketId`'s isolated reserve.
    function fundMarket(uint256 marketId, uint256 amount) external nonReentrant {
        if (marketId >= marketCount) revert InvalidMarket();
        if (amount == 0) revert ZeroAmount();
        if (markets[marketId].resolved) revert MarketAlreadyResolved();

        _pullCollateralExact(msg.sender, amount);

        MarketAccountingStorage storage acc = _accounting[marketId];
        uint256 newReserve = uint256(acc.collateralReserve) + amount;
        if (newReserve > type(uint128).max) revert ReserveOverflow();
        acc.extraSubsidy += amount;
        acc.collateralReserve = uint128(newReserve);
        totalReservedCollateral += amount;

        emit MarketFunded(marketId, msg.sender, amount, newReserve);
    }

    // ── Trading ───────────────────────────────────────────────────────────────

    /// @notice Buy `shares` of `outcome` in market `marketId`.
    function buy(uint256 marketId, uint256 outcome, uint256 shares) external nonReentrant {
        _buy(marketId, msg.sender, msg.sender, outcome, shares, type(uint256).max);
    }

    /// @notice Buy `shares` of `outcome` on behalf of `trader` via the paired `PredictionMarket`.
    function buyFor(uint256 marketId, address trader, uint256 outcome, uint256 shares, uint256 maxCost)
        external
        nonReentrant
        returns (uint256 costAmt)
    {
        if (marketId >= marketCount) revert InvalidMarket();
        if (trader == address(0)) revert ZeroAddress();
        
        address linked = _marketMeta[marketId].factoryMarket;
        bool isLinkedFactory = linked != address(0) && msg.sender == linked;
        bool isApprovedWrapper = approvedWrappers[msg.sender];
        
        if (!isLinkedFactory && !isApprovedWrapper) revert Unauthorized();
        
        costAmt = _buy(marketId, msg.sender, trader, outcome, shares, maxCost);
    }

    /// @notice Sell `shares` of `outcome` in market `marketId`.
    function sell(uint256 marketId, uint256 outcome, uint256 shares) external nonReentrant {
        _sell(marketId, msg.sender, outcome, shares, 0);
    }

    /// @notice Sell `shares` of `outcome` on behalf of `trader` via the paired `PredictionMarket`.
    function sellFor(uint256 marketId, address trader, uint256 outcome, uint256 shares, uint256 minProceeds)
        external
        nonReentrant
        returns (uint256 proceeds)
    {
        if (marketId >= marketCount) revert InvalidMarket();
        if (trader == address(0)) revert ZeroAddress();
        
        address linked = _marketMeta[marketId].factoryMarket;
        bool isLinkedFactory = linked != address(0) && msg.sender == linked;
        bool isApprovedWrapper = approvedWrappers[msg.sender];
        
        if (!isLinkedFactory && !isApprovedWrapper) revert Unauthorized();
        
        proceeds = _sell(marketId, trader, outcome, shares, minProceeds);
    }

    // ── Evidence approval & resolution ────────────────────────────────────────

    /// @notice Compute the canonical commitment hash used with `EvidenceStorage`.
    function computeEvidenceCommitment(uint256 marketId, uint256 winningOutcome, bytes32 payloadHash)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(marketId, winningOutcome, payloadHash));
    }

    /// @notice Approve resolution evidence for a market once its resolution time has arrived.
    function approveEvidence(
        uint256 marketId,
        uint256 winningOutcome,
        bytes32 evidenceHash,
        string calldata evidenceURI
    ) external {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        MarketMeta storage meta = _marketMeta[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (!approvedEvidenceApprovers[msg.sender] || msg.sender == m.creator) revert Unauthorized();
        if (block.timestamp < meta.resolutionTime) revert ResolutionTooEarly();
        if (winningOutcome >= m.numOutcomes) revert InvalidOutcome();
        if (evidenceHash == bytes32(0) || bytes(evidenceURI).length == 0) revert InvalidEvidence();
        if (_approvedEvidences[marketId][evidenceHash].approved) revert InvalidEvidence();

        _approvedEvidences[marketId][evidenceHash] = ResolutionEvidence({
            winningOutcome: winningOutcome,
            evidenceHash: evidenceHash,
            evidenceURI: evidenceURI,
            approver: msg.sender,
            approvedAt: block.timestamp,
            approved: true
        });

        emit EvidenceApproved(marketId, winningOutcome, evidenceHash, msg.sender, evidenceURI);
    }

    /// @notice Revoke previously approved evidence prior to resolution.
    function revokeEvidence(uint256 marketId, bytes32 evidenceHash) external {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (msg.sender != owner && (!approvedEvidenceApprovers[msg.sender] || msg.sender == m.creator)) {
            revert Unauthorized();
        }
        if (!_approvedEvidences[marketId][evidenceHash].approved) revert EvidenceNotApproved();

        delete _approvedEvidences[marketId][evidenceHash];
        emit EvidenceRevoked(marketId, evidenceHash, msg.sender);
    }

    /// @notice Resolve a market using on-chain approved evidence after its resolution time.
    function resolve(uint256 marketId, uint256 winningOutcome, bytes32 evidenceHash) external nonReentrant {
        _validateResolverAndTiming(marketId, winningOutcome);
        if (evidenceHash == bytes32(0)) revert InvalidEvidence();

        ResolutionEvidence storage ev = _approvedEvidences[marketId][evidenceHash];
        if (!ev.approved) revert EvidenceNotApproved();
        if (ev.winningOutcome != winningOutcome) revert EvidenceOutcomeMismatch();
        if (ev.approvedAt < _marketMeta[marketId].resolutionTime) revert ResolutionTooEarly();

        _finalizeResolution(marketId, winningOutcome, evidenceHash, ev.evidenceURI);
    }

    /// @notice Resolve a market using verified evidence stored in the configured `EvidenceStorage`.
    function resolveWithEvidenceStorage(
        uint256 marketId,
        uint256 winningOutcome,
        uint256 evidenceId,
        bytes32 payloadHash
    ) external nonReentrant {
        if (address(evidenceStorage) == address(0)) revert EvidenceStorageNotConfigured();
        _validateResolverAndTiming(marketId, winningOutcome);
        if (payloadHash == bytes32(0)) revert InvalidEvidence();

        IEvidenceStorage.Evidence memory ev = evidenceStorage.getEvidence(evidenceId);
        if (!ev.verified) revert EvidenceNotApproved();
        if (ev.disputeId != marketId) revert InvalidEvidence();
        if (ev.timestamp < _marketMeta[marketId].resolutionTime) revert ResolutionTooEarly();

        bytes32 expectedHash = computeEvidenceCommitment(marketId, winningOutcome, payloadHash);
        if (ev.evidenceHash != expectedHash) revert EvidenceOutcomeMismatch();

        _finalizeResolution(marketId, winningOutcome, ev.evidenceHash, ev.evidenceURI);
    }

    // ── Redemption & residual reserve withdrawal ──────────────────────────────

    /// @notice Redeem winning shares after resolution from this market's isolated reserve.
    function redeem(uint256 marketId) external nonReentrant returns (uint256 payout) {
        payout = _redeem(marketId, msg.sender);
    }

    /// @notice Redeem winning shares on behalf of `trader` via the paired `PredictionMarket`.
    function redeemFor(uint256 marketId, address trader) external nonReentrant returns (uint256 payout) {
        if (marketId >= marketCount) revert InvalidMarket();
        if (trader == address(0)) revert ZeroAddress();
        
        address linked = _marketMeta[marketId].factoryMarket;
        bool isLinkedFactory = linked != address(0) && msg.sender == linked;
        bool isApprovedWrapper = approvedWrappers[msg.sender];
        
        if (!isLinkedFactory && !isApprovedWrapper) revert Unauthorized();
        
        payout = _redeem(marketId, trader);
    }

    /// @notice Withdraw residual collateral surplus belonging to `marketId` after all winners redeem.
    function withdrawResidualReserve(uint256 marketId, address to) external nonReentrant returns (uint256 amount) {
        if (marketId >= marketCount) revert InvalidMarket();
        if (to == address(0)) revert ZeroAddress();
        Market storage m = markets[marketId];
        if (msg.sender != m.creator) revert Unauthorized();
        if (!m.resolved) revert MarketNotResolved();

        MarketAccountingStorage storage acc = _accounting[marketId];
        if (acc.maxLiabilityPlusOne != 1) revert OutstandingLiability();
        amount = acc.collateralReserve;
        if (amount == 0) revert ZeroAmount();

        acc.collateralReserve = 0;
        totalReservedCollateral -= amount;

        _pushCollateral(to, amount);
        emit ResidualReserveWithdrawn(marketId, to, amount);
    }

    // ── Price, accounting & registry views ────────────────────────────────────

    /// @notice Spot price of outcome `outcome` in WAD.
    function getPrice(uint256 marketId, uint256 outcome) external view returns (uint256) {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        if (outcome >= m.numOutcomes) revert InvalidOutcome();
        return LMSR.price(m.quantities, m.b, outcome);
    }

    /// @notice Cost to buy `shares` of `outcome` in market `marketId`.
    function getCostToBuy(uint256 marketId, uint256 outcome, uint256 shares) external view returns (uint256) {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        uint256[] storage qs = m.quantities;
        uint256 len = qs.length;
        if (outcome >= len) revert InvalidOutcome();
        if (shares == 0) return 0;
        uint256 b = m.b;
        uint256 sumExpOld;
        uint256 expOutcomeOld;
        uint256 qOutcomeOld;
        for (uint256 i; i < len;) {
            uint256 qi = qs[i];
            uint256 ei = qi == 0 ? LMSR.WAD : LMSR.expWad((qi * LMSR.WAD) / b);
            sumExpOld += ei;
            if (i == outcome) {
                expOutcomeOld = ei;
                qOutcomeOld = qi;
            }
            unchecked {
                ++i;
            }
        }
        uint256 expOutcomeNew = LMSR.expWad(((qOutcomeOld + shares) * LMSR.WAD) / b);
        uint256 cOld = LMSR.wadMul(b, LMSR.lnWad(sumExpOld));
        uint256 cNew = LMSR.wadMul(b, LMSR.lnWad(sumExpOld - expOutcomeOld + expOutcomeNew));
        return cNew > cOld ? cNew - cOld : 0;
    }

    /// @notice Collateral proceeds returned for selling `shares` of `outcome` in market `marketId`.
    function getProceedsToSell(uint256 marketId, uint256 outcome, uint256 shares) external view returns (uint256) {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        uint256[] storage qs = m.quantities;
        uint256 len = qs.length;
        if (outcome >= len) revert InvalidOutcome();
        if (shares > qs[outcome]) revert InsufficientShares();
        if (shares == 0) return 0;
        uint256 b = m.b;
        uint256 sumExpOld;
        uint256 expOutcomeOld;
        uint256 qOutcomeOld;
        for (uint256 i; i < len;) {
            uint256 qi = qs[i];
            uint256 ei = qi == 0 ? LMSR.WAD : LMSR.expWad((qi * LMSR.WAD) / b);
            sumExpOld += ei;
            if (i == outcome) {
                expOutcomeOld = ei;
                qOutcomeOld = qi;
            }
            unchecked {
                ++i;
            }
        }
        uint256 qOutcomeNew = qOutcomeOld - shares;
        uint256 expOutcomeNew = qOutcomeNew == 0 ? LMSR.WAD : LMSR.expWad((qOutcomeNew * LMSR.WAD) / b);
        uint256 cOld = LMSR.wadMul(b, LMSR.lnWad(sumExpOld));
        uint256 cNew = LMSR.wadMul(b, LMSR.lnWad(sumExpOld - expOutcomeOld + expOutcomeNew));
        return cOld > cNew ? cOld - cNew : 0;
    }

    /// @notice Return the current outcome quantities array for `marketId`.
    function getQuantities(uint256 marketId) external view returns (uint256[] memory) {
        if (marketId >= marketCount) revert InvalidMarket();
        return _copyQuantities(markets[marketId]);
    }

    /// @notice Return resolution timing, authority, factory binding, and pause metadata for `marketId`.
    function getMarketMeta(uint256 marketId) external view returns (MarketMeta memory) {
        if (marketId >= marketCount) revert InvalidMarket();
        return _marketMeta[marketId];
    }

    /// @notice Return the full isolated accounting record for `marketId`.
    function getMarketAccounting(uint256 marketId) external view returns (MarketAccounting memory) {
        if (marketId >= marketCount) revert InvalidMarket();
        MarketAccountingStorage storage acc = _accounting[marketId];
        return MarketAccounting({
            initialSubsidy: acc.initialSubsidy,
            extraSubsidy: acc.extraSubsidy,
            collateralReserve: acc.collateralReserve,
            totalRedeemed: acc.totalRedeemed,
            maxLiability: acc.maxLiabilityPlusOne - 1
        });
    }

    /// @notice Return the isolated collateral reserve backing exclusively `marketId`.
    function getMarketReserve(uint256 marketId) external view returns (uint256) {
        if (marketId >= marketCount) revert InvalidMarket();
        return _accounting[marketId].collateralReserve;
    }

    /// @notice Return the current maximum redemption liability for `marketId`.
    function getMarketLiability(uint256 marketId) external view returns (uint256) {
        if (marketId >= marketCount) revert InvalidMarket();
        return _accounting[marketId].maxLiabilityPlusOne - 1;
    }

    /// @notice Return the required initial LMSR subsidy for an existing market.
    function getRequiredSubsidy(uint256 marketId) external view returns (uint256) {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        return requiredInitialSubsidy(m.numOutcomes, m.b);
    }

    /// @notice Report whether `marketId`'s isolated collateral reserve covers its liability.
    function isMarketSolvent(uint256 marketId) external view returns (bool) {
        if (marketId >= marketCount) revert InvalidMarket();
        MarketAccountingStorage storage acc = _accounting[marketId];
        return acc.collateralReserve >= (acc.maxLiabilityPlusOne - 1);
    }

    /// @notice Return approved evidence metadata for `(marketId, evidenceHash)`.
    function getApprovedEvidence(uint256 marketId, bytes32 evidenceHash)
        external
        view
        returns (ResolutionEvidence memory)
    {
        if (marketId >= marketCount) revert InvalidMarket();
        return _approvedEvidences[marketId][evidenceHash];
    }

    /// @notice Return the canonical numeric `marketId` bound to a factory-deployed `PredictionMarket`.
    function getMarketIdForFactoryMarket(address factoryMarket) external view returns (uint256) {
        if (!isFactoryMarketLinked[factoryMarket]) revert InvalidMarket();
        return _factoryMarketToId[factoryMarket];
    }

    /// @notice Return the paired `PredictionMarket` address for `marketId` (or zero if standalone).
    function getFactoryMarket(uint256 marketId) external view returns (address) {
        if (marketId >= marketCount) revert InvalidMarket();
        return _marketMeta[marketId].factoryMarket;
    }

    /// @notice Proceeds from selling `shares` of `outcome`.
    /// @param marketId Identifier of the relevant market.
    /// @param outcome Numeric outcome used by this operation.
    /// @param shares Numeric shares used by this operation.
    /// @return Proceeds from sell returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getProcedsFromSell(uint256 marketId, uint256 outcome, uint256 shares) external view returns (uint256) {
        Market storage m = markets[marketId];
        uint256[] memory qNew = _copyQuantities(m);
        qNew[outcome] -= shares;
        int256 c = LMSR.cost(m.quantities, qNew, m.b);
        return c < 0 ? uint256(-c) : 0;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    function _createMarket(CreateMarketParams memory params, string calldata description)
        internal
        returns (uint256 marketId)
    {
        require(params.numOutcomes >= 2, "MM: need >= 2 outcomes");
        require(params.b > 0, "MM: b must be > 0");
        if (params.resolutionTime <= block.timestamp || params.resolutionTime > type(uint64).max) {
            revert InvalidResolutionTime();
        }

        address resolvedAuthority = params.resolver == address(0) ? defaultResolver : params.resolver;
        if (
            resolvedAuthority == address(0) || !approvedResolvers[resolvedAuthority]
                || resolvedAuthority == params.creator
        ) {
            revert InvalidResolver();
        }

        uint256 minSubsidy = requiredInitialSubsidy(params.numOutcomes, params.b);
        if (params.initialSubsidy < minSubsidy) revert InsufficientSubsidy(params.initialSubsidy, minSubsidy);
        uint256 minReserve = params.minLiquidity > minSubsidy ? params.minLiquidity : minSubsidy;
        if (params.initialSubsidy > type(uint128).max || minReserve > type(uint128).max) revert ReserveOverflow();

        _pullCollateralExact(params.funder, params.initialSubsidy);

        marketId = marketCount++;
        Market storage m = markets[marketId];
        m.description = description;
        m.b = params.b;
        m.numOutcomes = params.numOutcomes;
        m.quantities = new uint256[](params.numOutcomes);
        m.creator = params.creator;

        MarketMeta storage meta = _marketMeta[marketId];
        meta.resolver = resolvedAuthority;
        meta.resolutionTime = uint64(params.resolutionTime);
        meta.factoryMarket = params.factoryMarket;
        meta.minReserve = minReserve;

        MarketAccountingStorage storage acc = _accounting[marketId];
        acc.collateralReserve = uint128(params.initialSubsidy);
        acc.maxLiabilityPlusOne = 1; // Represents 0 liability while keeping slot warm/non-zero
        acc.minReserve = uint128(minReserve);
        acc.resolutionTime = uint64(params.resolutionTime);
        acc.initialSubsidy = params.initialSubsidy;
        totalReservedCollateral += params.initialSubsidy;

        emit MarketCreated(marketId, params.creator, params.numOutcomes, params.b);
        emit MarketConfigured(
            marketId, resolvedAuthority, params.resolutionTime, params.initialSubsidy, params.factoryMarket
        );
    }

    function _buy(
        uint256 marketId,
        address payer,
        address trader,
        uint256 outcome,
        uint256 shares,
        uint256 maxCost
    ) internal returns (uint256 costAmt) {
        if (shares == 0) revert ZeroAmount();
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (outcome >= m.quantities.length) revert InvalidOutcome();

        MarketAccountingStorage storage acc = _accounting[marketId];
        if (acc.paused) revert MarketPaused();
        if (block.timestamp >= acc.resolutionTime) revert TradingClosed();

        uint256 currentReserve = acc.collateralReserve;
        if (currentReserve < acc.minReserve) revert InsufficientLiquidity();

        uint256 newOutcomeQty;
        (costAmt, newOutcomeQty) = _quoteBuyCostAndNewQty(m, outcome, shares);
        if (costAmt > maxCost) revert SlippageExceeded();

        {
            uint256 newReserve = currentReserve + costAmt;
            uint256 currentLiability = uint256(acc.maxLiabilityPlusOne) - 1;
            uint256 newMaxLiability = newOutcomeQty > currentLiability ? newOutcomeQty : currentLiability;
            if (newReserve < newMaxLiability) revert InsufficientMarketReserve();
            if (newReserve > type(uint128).max || newMaxLiability >= type(uint128).max) revert ReserveOverflow();

            _pullCollateral(payer, costAmt);

            acc.collateralReserve = uint128(newReserve);
            acc.maxLiabilityPlusOne = uint128(newMaxLiability + 1);
        }

        m.quantities[outcome] = newOutcomeQty;
        positions[trader][marketId][outcome] += shares;
        totalReservedCollateral += costAmt;

        emit SharesBought(marketId, trader, outcome, shares, costAmt);
    }

    function _sell(uint256 marketId, address trader, uint256 outcome, uint256 shares, uint256 minProceeds)
        internal
        returns (uint256 proceeds)
    {
        if (shares == 0) revert ZeroAmount();
        if (positions[trader][marketId][outcome] < shares) revert InsufficientShares();
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (outcome >= m.quantities.length) revert InvalidOutcome();

        MarketAccountingStorage storage acc = _accounting[marketId];
        if (acc.paused) revert MarketPaused();
        if (block.timestamp >= acc.resolutionTime) revert TradingClosed();

        uint256 newMaxLiability;
        (proceeds, newMaxLiability) = _quoteSellProceedsAndMaxQty(m, outcome, shares);
        if (proceeds < minProceeds) revert SlippageExceeded();
        uint256 currentReserve = acc.collateralReserve;
        if (proceeds > currentReserve) revert InsufficientMarketReserve();

        uint256 newReserve = currentReserve - proceeds;
        if (newReserve < newMaxLiability) revert InsufficientMarketReserve();

        m.quantities[outcome] -= shares;
        positions[trader][marketId][outcome] -= shares;
        acc.collateralReserve = uint128(newReserve);
        acc.maxLiabilityPlusOne = uint128(newMaxLiability + 1);
        totalReservedCollateral -= proceeds;

        _pushCollateral(trader, proceeds);

        emit SharesSold(marketId, trader, outcome, shares, proceeds);
    }

    function _quoteBuyCostAndNewQty(Market storage m, uint256 outcome, uint256 shares)
        internal
        view
        returns (uint256 costAmt, uint256 newOutcomeQty)
    {
        uint256[] storage qs = m.quantities;
        uint256 len = qs.length;
        uint256 b = m.b;
        uint256 sumExpOld;
        uint256 expOutcomeOld;
        uint256 qOutcomeOld;
        for (uint256 i; i < len;) {
            uint256 qi = qs[i];
            uint256 ei = qi == 0 ? LMSR.WAD : LMSR.expWad((qi * LMSR.WAD) / b);
            sumExpOld += ei;
            if (i == outcome) {
                expOutcomeOld = ei;
                qOutcomeOld = qi;
            }
            unchecked {
                ++i;
            }
        }
        newOutcomeQty = qOutcomeOld + shares;
        uint256 expOutcomeNew = LMSR.expWad((newOutcomeQty * LMSR.WAD) / b);
        uint256 cOld = LMSR.wadMul(b, LMSR.lnWad(sumExpOld));
        uint256 cNew = LMSR.wadMul(b, LMSR.lnWad(sumExpOld - expOutcomeOld + expOutcomeNew));
        require(cNew > cOld, "MM: non-positive cost");
        costAmt = cNew - cOld;
    }

    function _quoteSellProceedsAndMaxQty(Market storage m, uint256 outcome, uint256 shares)
        internal
        view
        returns (uint256 proceeds, uint256 maxQty)
    {
        uint256[] storage qs = m.quantities;
        uint256 len = qs.length;
        uint256 b = m.b;
        uint256 sumExpOld;
        uint256 expOutcomeOld;
        uint256 qOutcomeNew;
        for (uint256 i; i < len;) {
            uint256 qi = qs[i];
            uint256 ei = qi == 0 ? LMSR.WAD : LMSR.expWad((qi * LMSR.WAD) / b);
            sumExpOld += ei;
            uint256 postQty = qi;
            if (i == outcome) {
                expOutcomeOld = ei;
                qOutcomeNew = qi - shares;
                postQty = qOutcomeNew;
            }
            if (postQty > maxQty) maxQty = postQty;
            unchecked {
                ++i;
            }
        }
        uint256 expOutcomeNew = qOutcomeNew == 0 ? LMSR.WAD : LMSR.expWad((qOutcomeNew * LMSR.WAD) / b);
        uint256 cOld = LMSR.wadMul(b, LMSR.lnWad(sumExpOld));
        uint256 cNew = LMSR.wadMul(b, LMSR.lnWad(sumExpOld - expOutcomeOld + expOutcomeNew));
        require(cOld > cNew, "MM: non-negative proceeds");
        proceeds = cOld - cNew;
    }

    function _validateResolverAndTiming(uint256 marketId, uint256 winningOutcome) internal view {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        MarketMeta storage meta = _marketMeta[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
        if (block.timestamp < meta.resolutionTime) revert ResolutionTooEarly();
        if (msg.sender != meta.resolver || !approvedResolvers[msg.sender] || msg.sender == m.creator) {
            revert Unauthorized();
        }
        if (winningOutcome >= m.numOutcomes) revert InvalidOutcome();
    }

    function _finalizeResolution(
        uint256 marketId,
        uint256 winningOutcome,
        bytes32 evidenceHash,
        string memory evidenceURI
    ) internal {
        Market storage m = markets[marketId];
        MarketMeta storage meta = _marketMeta[marketId];
        MarketAccountingStorage storage acc = _accounting[marketId];

        uint256 winningLiability = m.quantities[winningOutcome];
        if (acc.collateralReserve < winningLiability) revert InsufficientMarketReserve();

        m.resolved = true;
        m.winningOutcome = winningOutcome;
        meta.resolvedAt = uint64(block.timestamp);
        meta.resolutionEvidenceHash = evidenceHash;
        acc.maxLiabilityPlusOne = uint128(winningLiability + 1);

        if (meta.factoryMarket != address(0)) {
            IPredictionMarketSync(meta.factoryMarket).onCanonicalResolved(winningOutcome);
            address originFactory = _marketOriginFactory[marketId];
            if (originFactory != address(0)) {
                IMarketFactorySync(originFactory).syncMarketResolved(meta.factoryMarket);
            }
        }

        emit MarketResolved(marketId, winningOutcome);
        emit MarketResolvedWithEvidence(marketId, winningOutcome, msg.sender, evidenceHash, evidenceURI);
    }

    function _redeem(uint256 marketId, address trader) internal returns (uint256 shares) {
        if (marketId >= marketCount) revert InvalidMarket();
        Market storage m = markets[marketId];
        if (!m.resolved) revert MarketNotResolved();

        shares = positions[trader][marketId][m.winningOutcome];
        if (shares == 0) revert ZeroAmount();

        MarketAccountingStorage storage acc = _accounting[marketId];
        uint256 remainingLiability = acc.maxLiabilityPlusOne - 1;
        if (shares > acc.collateralReserve || shares > remainingLiability) revert InsufficientMarketReserve();

        positions[trader][marketId][m.winningOutcome] = 0;
        acc.collateralReserve = uint128(uint256(acc.collateralReserve) - shares);
        acc.totalRedeemed += shares;
        acc.maxLiabilityPlusOne = uint128((remainingLiability - shares) + 1);
        totalReservedCollateral -= shares;

        _pushCollateral(trader, shares);
        emit Redeemed(marketId, trader, shares);
    }

    function _copyQuantities(Market storage m) internal view returns (uint256[] memory q) {
        uint256 len = m.numOutcomes;
        q = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            q[i] = m.quantities[i];
        }
    }

    function _pullCollateral(address from, uint256 amount) internal {
        bool ok = collateral.transferFrom(from, address(this), amount);
        if (!ok) revert TransferFailed();
    }

    function _pullCollateralExact(address from, uint256 amount) internal {
        uint256 balanceBefore = collateral.balanceOf(address(this));
        bool ok = collateral.transferFrom(from, address(this), amount);
        if (!ok) revert TransferFailed();
        uint256 balanceAfter = collateral.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) {
            revert TransferFailed();
        }
    }

    function _pushCollateral(address to, uint256 amount) internal {
        bool ok = collateral.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }
}
