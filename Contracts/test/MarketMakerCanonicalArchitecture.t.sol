// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ERC20Token.sol";
import "../src/EvidenceStorage.sol";
import "../src/LMSR.sol";
import "../src/MarketFactory.sol";
import "../src/MarketMaker.sol";
import "../src/PositionToken.sol";
import "../src/PredictionMarket.sol";

/// @title MarketMakerCanonicalArchitectureTest
/// @notice End-to-end verification suite for:
///         - #1367: Align factory-created markets with canonical LMSR architecture
///         - #1368: Restrict MarketMaker resolution to approved evidence and timing
///         - #1369: Fund the initial LMSR market subsidy & prove single-outcome solvency
///         - #1370: Isolate collateral reserves and liabilities between markets
contract MarketMakerCanonicalArchitectureTest is Test {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant B = 100 * WAD;

    ERC20Token internal collateral;
    PositionToken internal positionToken;
    MarketFactory internal factory;
    MarketMaker internal mm;
    EvidenceStorage internal evidenceStorage;

    address internal creator = address(0xC0EA70);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal resolver = address(0x10501);
    address internal resolver2 = address(0x10502);
    address internal evidenceApprover = address(0xE01D1);
    address internal evidenceAdmin = address(0xE01D2);

    function setUp() public {
        collateral = new ERC20Token(0);
        mm = new MarketMaker(address(collateral));

        // Deploy PositionToken <-> MarketFactory circular binding
        uint256 factoryNonce = vm.getNonce(address(this)) + 1;
        address predictedFactory = vm.computeCreateAddress(address(this), factoryNonce);
        positionToken = new PositionToken(predictedFactory);
        factory = new MarketFactory(address(positionToken));
        require(address(factory) == predictedFactory, "factory prediction mismatch");

        evidenceStorage = new EvidenceStorage(evidenceAdmin);

        // Configure canonical MarketMaker <-> MarketFactory alignment
        mm.setApprovedResolver(resolver, true);
        mm.setApprovedResolver(resolver2, true);
        mm.setDefaultResolver(resolver);
        mm.setEvidenceApprover(evidenceApprover, true);
        mm.setEvidenceStorage(address(evidenceStorage));
        mm.setMarketFactory(address(factory));

        factory.setMarketMaker(address(mm), resolver);

        // Fund test actors
        collateral.mint(creator, 1_000_000 * WAD);
        collateral.mint(alice, 1_000_000 * WAD);
        collateral.mint(bob, 1_000_000 * WAD);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _createDirectMarket(uint256 numOutcomes, uint256 b, uint256 delaySeconds)
        internal
        returns (uint256 marketId, uint256 resolutionTime, uint256 subsidy)
    {
        resolutionTime = block.timestamp + delaySeconds;
        subsidy = mm.requiredInitialSubsidy(numOutcomes, b);
        vm.startPrank(creator);
        collateral.approve(address(mm), subsidy);
        marketId = mm.createMarket("Flight UA101 delayed > 2h?", numOutcomes, b, resolutionTime, resolver, subsidy);
        vm.stopPrank();
    }

    function _createCanonicalFactoryMarket(
        uint256 numOutcomes,
        uint256 b,
        uint256 minLiqWhole,
        uint256 delaySeconds
    ) internal returns (address market, uint256 marketId, uint256 deadline, uint256 subsidy) {
        deadline = block.timestamp + delaySeconds;
        subsidy = mm.requiredInitialSubsidy(numOutcomes, b);
        uint256 scaledMinLiq = minLiqWhole * WAD;
        if (scaledMinLiq > subsidy) subsidy = scaledMinLiq;

        vm.startPrank(creator);
        collateral.approve(address(factory), subsidy);
        (market, marketId) = factory.createCanonicalMarket(
            deadline, minLiqWhole, numOutcomes, b, subsidy, resolver, "ipfs://flight-ua101"
        );
        vm.stopPrank();
    }

    function _approveAndResolve(uint256 marketId, uint256 winningOutcome) internal returns (bytes32 evidenceHash) {
        evidenceHash = keccak256(abi.encode("approved-flight-data", marketId, winningOutcome));
        vm.prank(evidenceApprover);
        mm.approveEvidence(marketId, winningOutcome, evidenceHash, "ipfs://flight-evidence");

        vm.prank(resolver);
        mm.resolve(marketId, winningOutcome, evidenceHash);
    }

    // =========================================================================
    // #1367 — Align factory-created markets with canonical LMSR architecture
    // =========================================================================

    function test_1367_factoryCanonicalCreationBindsRegistryBidirectionally() public {
        uint256 timestamp = 1_700_000_000;
        vm.warp(timestamp);
        uint256 deadline = timestamp + 1 days;
        uint256 subsidy = mm.requiredInitialSubsidy(3, B);

        address predicted = factory.computeMarketAddress(
            creator, timestamp, 0, address(collateral), deadline, 50, "ipfs://canonical-3-outcome"
        );

        vm.startPrank(creator);
        collateral.approve(address(factory), subsidy);
        (address market, uint256 marketId) =
            factory.createCanonicalMarket(deadline, 50, 3, B, subsidy, resolver, "ipfs://canonical-3-outcome");
        vm.stopPrank();

        assertEq(market, predicted, "CREATE2 deterministic address must match");
        assertEq(marketId, 0);

        // Bidirectional registry checks on Factory, MarketMaker, and PredictionMarket
        assertTrue(factory.hasCanonicalMarket(market));
        assertEq(factory.getCanonicalMarketId(market), marketId);
        assertEq(factory.getFactoryMarket(marketId), market);

        assertTrue(mm.isFactoryMarketLinked(market));
        assertEq(mm.getMarketIdForFactoryMarket(market), marketId);
        assertEq(mm.getFactoryMarket(marketId), market);

        PredictionMarket pm = PredictionMarket(payable(market));
        assertTrue(pm.canonicalBound());
        assertEq(pm.marketMaker(), address(mm));
        assertEq(pm.canonicalMarketId(), marketId);
        assertTrue(pm.hasMinLiquidity());
        assertEq(pm.getReserve(), subsidy);
        assertEq(pm.getLiability(), 0);
        // No collateral stranded inside factory or PredictionMarket
        assertEq(collateral.balanceOf(address(factory)), 0);
        assertEq(collateral.balanceOf(market), 0);
        assertEq(collateral.balanceOf(address(mm)), subsidy);
    }

    function test_1367_factoryFourArgCreateMarketLinksCanonicallyAndRejectsWrongCollateral() public {
        ERC20Token otherToken = new ERC20Token(0);
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(creator);
        vm.expectRevert(MarketFactory.CollateralMismatch.selector);
        factory.createMarket(address(otherToken), deadline, 100, "ipfs://wrong-collateral");

        // With canonical collateral, 4-arg createMarket deploys and binds a binary LMSR market
        uint256 expectedSubsidy = 100 * WAD; // max(requiredInitialSubsidy(2, 100e18), 100e18) == 100e18
        vm.startPrank(creator);
        collateral.approve(address(factory), expectedSubsidy);
        address market = factory.createMarket(address(collateral), deadline, 100, "ipfs://canonical-binary");
        vm.stopPrank();

        assertTrue(factory.hasCanonicalMarket(market));
        uint256 marketId = factory.getCanonicalMarketId(market);
        assertEq(mm.getFactoryMarket(marketId), market);
        assertEq(mm.getMarketReserve(marketId), expectedSubsidy);
        assertTrue(PredictionMarket(payable(market)).canonicalBound());
    }

    function test_1367_pricingPositionsAndTradingUnifiedBetweenPredictionMarketAndMarketMaker() public {
        (address market, uint256 marketId, uint256 deadline,) = _createCanonicalFactoryMarket(2, B, 50, 1 days);
        PredictionMarket pm = PredictionMarket(payable(market));

        // 1. Quotes match identically between PredictionMarket and MarketMaker
        assertEq(pm.getPrice(0), mm.getPrice(marketId, 0));
        assertEq(pm.getPrice(1), mm.getPrice(marketId, 1));

        uint256 shares1 = 20 * WAD;
        {
            uint256 quote1 = pm.getCostToBuy(0, shares1);
            assertEq(quote1, mm.getCostToBuy(marketId, 0, shares1));

            // 2. Alice buys via PredictionMarket wrapper -> credited directly to Alice in MarketMaker
            vm.startPrank(alice);
            collateral.approve(market, quote1);
            uint256 paid1 = pm.buy(0, shares1, quote1);
            vm.stopPrank();

            assertEq(paid1, quote1);
            assertEq(mm.positions(alice, marketId, 0), shares1);
            assertEq(pm.getPosition(alice, 0), shares1);
            assertEq(mm.positions(market, marketId, 0), 0, "wrapper must never own trader shares");
        }

        uint256 shares2 = 15 * WAD;
        {
            // 3. Alice buys additional shares directly via MarketMaker -> same unified position ledger
            uint256 quote2 = mm.getCostToBuy(marketId, 0, shares2);
            vm.startPrank(alice);
            collateral.approve(address(mm), quote2);
            mm.buy(marketId, 0, shares2);
            vm.stopPrank();

            assertEq(mm.positions(alice, marketId, 0), shares1 + shares2);
            assertEq(pm.getPosition(alice, 0), shares1 + shares2);
        }

        uint256 sellShares = 10 * WAD;
        {
            // 4. Alice sells 10 shares via PredictionMarket -> proceeds transfer directly to Alice
            uint256 quotedProceeds = pm.getProceedsToSell(0, sellShares);
            assertEq(quotedProceeds, mm.getProceedsToSell(marketId, 0, sellShares));

            uint256 aliceBalBefore = collateral.balanceOf(alice);
            vm.prank(alice);
            uint256 proceeds = pm.sell(0, sellShares, quotedProceeds);
            assertEq(proceeds, quotedProceeds);
            assertEq(collateral.balanceOf(alice), aliceBalBefore + proceeds);
            assertEq(pm.getPosition(alice, 0), shares1 + shares2 - sellShares);
        }

        // 5. Slippage guards revert cleanly
        vm.startPrank(alice);
        collateral.approve(market, type(uint256).max);
        vm.expectRevert(PredictionMarket.SlippageExceeded.selector);
        pm.buy(0, 5 * WAD, 1);
        vm.expectRevert(MarketMaker.SlippageExceeded.selector);
        pm.sell(0, 5 * WAD, type(uint256).max);
        vm.stopPrank();

        // 6. Resolution in MarketMaker syncs PredictionMarket & MarketFactory; redeem works via PredictionMarket
        vm.warp(deadline);
        _approveAndResolve(marketId, 0);

        assertEq(uint256(pm.state()), uint256(PredictionMarket.MarketState.RESOLVED));
        assertEq(pm.winningOutcome(), 0);
        assertEq(uint256(factory.getMarketInfo(market).status), uint256(MarketFactory.MarketStatus.RESOLVED));

        uint256 remainingShares = shares1 + shares2 - sellShares;
        uint256 balBeforeRedeem = collateral.balanceOf(alice);
        vm.prank(alice);
        pm.redeem();
        assertEq(collateral.balanceOf(alice), balBeforeRedeem + remainingShares);
        assertEq(pm.getPosition(alice, 0), 0);
        assertEq(mm.getMarketLiability(marketId), 0);
    }

    function test_1367_legacyUnbackedMintBurnAndDirectResolveAreDisabledOnCanonicalMarkets() public {
        (address market, uint256 marketId, uint256 deadline,) = _createCanonicalFactoryMarket(2, B, 50, 1 days);
        PredictionMarket pm = PredictionMarket(payable(market));

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.CanonicalMarketUsesMarketMaker.selector);
        pm.mintPosition(1, 100 * WAD);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.CanonicalMarketUsesMarketMaker.selector);
        pm.burnPosition(1, 100 * WAD);

        vm.warp(deadline + 1);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.CanonicalMarketUsesMarketMaker.selector);
        pm.resolve(1);

        // Unauthorized callers cannot invoke delegated hooks
        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.buyFor(marketId, alice, 0, 1 * WAD, type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.sellFor(marketId, alice, 0, 1 * WAD, 0);

        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.redeemFor(marketId, alice);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.OnlyMarketMaker.selector);
        pm.onCanonicalResolved(0);

        vm.prank(alice);
        vm.expectRevert(MarketFactory.NotCanonicalMarketMaker.selector);
        factory.syncMarketResolved(market);

        vm.prank(address(factory));
        vm.expectRevert(PredictionMarket.CanonicalAlreadyBound.selector);
        pm.bindCanonicalMarket(address(mm), 999);
    }

    function test_1367_addLiquidityAndPauseUnpauseSynchronizeWithMarketMaker() public {
        // Create market with minLiquidity = 100 WAD, initial subsidy = required (~69.325 WAD < 100 WAD)
        uint256 deadline = block.timestamp + 1 days;
        uint256 minSub = mm.requiredInitialSubsidy(2, B);
        vm.startPrank(creator);
        collateral.approve(address(factory), minSub);
        (address market, uint256 marketId) =
            factory.createCanonicalMarket(deadline, 100, 2, B, minSub, resolver, "ipfs://needs-topup");
        vm.stopPrank();

        PredictionMarket pm = PredictionMarket(payable(market));
        assertFalse(pm.hasMinLiquidity(), "reserve below scaled minLiquidity");

        // Buying reverts until minLiquidity floor is funded
        uint256 cost = mm.getCostToBuy(marketId, 0, 5 * WAD);
        vm.startPrank(alice);
        collateral.approve(address(mm), cost);
        vm.expectRevert(MarketMaker.InsufficientLiquidity.selector);
        mm.buy(marketId, 0, 5 * WAD);
        vm.stopPrank();

        // Adding liquidity through PredictionMarket forwards directly into MarketMaker's isolated reserve
        uint256 topUp = 100 * WAD - minSub;
        vm.startPrank(creator);
        collateral.approve(market, topUp);
        pm.addLiquidity(topUp);
        vm.stopPrank();

        assertEq(collateral.balanceOf(market), 0, "no liquidity stranded in PredictionMarket");
        assertEq(mm.getMarketReserve(marketId), 100 * WAD);
        assertTrue(pm.hasMinLiquidity());

        // Governance pause via MarketFactory blocks both PredictionMarket and direct MarketMaker trades
        factory.pauseMarket(market);
        assertEq(uint256(factory.getMarketInfo(market).status), uint256(MarketFactory.MarketStatus.PAUSED));
        assertTrue(mm.getMarketMeta(marketId).paused);

        vm.startPrank(alice);
        collateral.approve(address(mm), cost);
        vm.expectRevert(MarketMaker.MarketPaused.selector);
        mm.buy(marketId, 0, 5 * WAD);

        collateral.approve(market, cost);
        vm.expectRevert(PredictionMarket.InvalidMarketState.selector);
        pm.buy(0, 5 * WAD, cost);
        vm.stopPrank();

        // Unpausing restores trading on both surfaces
        factory.unpauseMarket(market);
        vm.startPrank(alice);
        collateral.approve(address(mm), cost);
        mm.buy(marketId, 0, 5 * WAD);
        vm.stopPrank();
        assertEq(pm.getPosition(alice, 0), 5 * WAD);
    }

    function test_1367_factoryBindingLocksAfterCanonicalLinkAndSurvivesFactoryRotation() public {
        (address market, uint256 marketId, uint256 deadline,) = _createCanonicalFactoryMarket(2, B, 50, 1 days);

        // Governance can update defaultResolver on the same MarketMaker
        factory.setMarketMaker(address(mm), resolver2);
        assertEq(factory.defaultResolver(), resolver2);

        // Switching factory to a different MarketMaker reverts once canonical markets exist
        MarketMaker otherMm = new MarketMaker(address(collateral));
        vm.expectRevert(MarketFactory.MarketMakerAlreadyLocked.selector);
        factory.setMarketMaker(address(otherMm), resolver);

        // Rotating MarketMaker.setMarketFactory to a new factory does not break pause or resolution sync
        address newFactory = address(0xFAC702);
        mm.setMarketFactory(newFactory);

        // New factory cannot pause markets created by the originating factory
        vm.prank(newFactory);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.setMarketPaused(marketId, true);

        // Originating factory can still pause, unpause, and receive resolution sync
        factory.pauseMarket(market);
        assertTrue(mm.getMarketMeta(marketId).paused);
        factory.unpauseMarket(market);
        assertFalse(mm.getMarketMeta(marketId).paused);

        vm.warp(deadline);
        _approveAndResolve(marketId, 0);
        assertEq(uint256(PredictionMarket(payable(market)).state()), uint256(PredictionMarket.MarketState.RESOLVED));
        assertEq(uint256(factory.getMarketInfo(market).status), uint256(MarketFactory.MarketStatus.RESOLVED));
    }

    // =========================================================================
    // #1368 — Restrict MarketMaker resolution to approved evidence and timing
    // =========================================================================

    function test_1368_blocksCreatorSelfResolverUnapprovedResolverAndPastDeadline() public {
        uint256 sub = mm.requiredInitialSubsidy(2, B);

        // Even if creator is in approvedResolvers, creator cannot designate themselves as resolver
        mm.setApprovedResolver(creator, true);
        vm.startPrank(creator);
        collateral.approve(address(mm), sub);
        vm.expectRevert(MarketMaker.InvalidResolver.selector);
        mm.createMarket("Self-resolved market", 2, B, block.timestamp + 1 days, creator, sub);

        // Unapproved resolver address rejected
        vm.expectRevert(MarketMaker.InvalidResolver.selector);
        mm.createMarket("Unapproved resolver", 2, B, block.timestamp + 1 days, alice, sub);

        // Past or current resolutionTime rejected
        vm.expectRevert(MarketMaker.InvalidResolutionTime.selector);
        mm.createMarket("Immediate resolution", 2, B, block.timestamp, resolver, sub);
        vm.stopPrank();
    }

    function test_1368_enforcesResolverAuthorityTimingAndEvidenceApproval() public {
        (uint256 marketId, uint256 resolutionTime,) = _createDirectMarket(2, B, 2 days);
        (uint256 otherMarketId,,) = _createDirectMarket(2, B, 2 days);

        // Trading works before resolutionTime
        uint256 cost = mm.getCostToBuy(marketId, 0, 10 * WAD);
        vm.startPrank(alice);
        collateral.approve(address(mm), cost);
        mm.buy(marketId, 0, 10 * WAD);
        vm.stopPrank();

        // Before resolutionTime: neither evidence approval nor resolution is allowed
        bytes32 hash0 = keccak256("flight-delayed-proof");
        vm.prank(evidenceApprover);
        vm.expectRevert(MarketMaker.ResolutionTooEarly.selector);
        mm.approveEvidence(marketId, 0, hash0, "ipfs://proof-0");

        vm.prank(resolver);
        vm.expectRevert(MarketMaker.ResolutionTooEarly.selector);
        mm.resolve(marketId, 0, hash0);

        // Warp to resolutionTime: trading is now closed to prevent resolution front-running
        vm.warp(resolutionTime);
        vm.startPrank(bob);
        collateral.approve(address(mm), 100 * WAD);
        vm.expectRevert(MarketMaker.TradingClosed.selector);
        mm.buy(marketId, 0, 1 * WAD);
        vm.stopPrank();

        vm.prank(alice);
        vm.expectRevert(MarketMaker.TradingClosed.selector);
        mm.sell(marketId, 0, 1 * WAD);

        // Resolver cannot resolve without approved evidence
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.EvidenceNotApproved.selector);
        mm.resolve(marketId, 0, hash0);

        // Zero evidence hash rejected
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.InvalidEvidence.selector);
        mm.resolve(marketId, 0, bytes32(0));

        // Creator cannot approve evidence for their own market even if granted approver role
        mm.setEvidenceApprover(creator, true);
        vm.prank(creator);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.approveEvidence(marketId, 0, hash0, "ipfs://self-proof");

        // Legitimate evidence approver approves evidence for outcome 0 on marketId
        vm.prank(evidenceApprover);
        mm.approveEvidence(marketId, 0, hash0, "ipfs://proof-0");

        // Creator cannot revoke approved evidence on their own market even if granted approver role
        vm.prank(creator);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.revokeEvidence(marketId, hash0);

        // Owner CANNOT resolve directly
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0, hash0);

        // Creator CANNOT resolve directly
        vm.prank(creator);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0, hash0);

        // Another approved resolver (not assigned to this market) CANNOT resolve
        vm.prank(resolver2);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0, hash0);

        // Designated resolver CANNOT substitute a different winningOutcome than the approved evidence
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.EvidenceOutcomeMismatch.selector);
        mm.resolve(marketId, 1, hash0);

        // Evidence approved for marketId CANNOT be replayed on otherMarketId
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.EvidenceNotApproved.selector);
        mm.resolve(otherMarketId, 0, hash0);

        // Revoking resolver blocks resolution until reinstated
        mm.setApprovedResolver(resolver, false);
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.resolve(marketId, 0, hash0);

        mm.setApprovedResolver(resolver, true);

        // Designated approved resolver resolves with matching approved evidence -> succeeds!
        vm.prank(resolver);
        mm.resolve(marketId, 0, hash0);

        (,,, bool resolved, uint256 winningOutcome,) = mm.markets(marketId);
        assertTrue(resolved);
        assertEq(winningOutcome, 0);
        assertEq(mm.getMarketMeta(marketId).resolutionEvidenceHash, hash0);
        assertEq(mm.getMarketMeta(marketId).resolvedAt, resolutionTime);
    }

    function test_1368_resolveWithEvidenceStorageEnforcesVerifiedCommitmentAndTiming() public {
        (address market, uint256 marketId, uint256 deadline,) = _createCanonicalFactoryMarket(2, B, 50, 1 days);

        bytes32 payloadHash = keccak256("FAA-delay-feed-UA101-2026-11-22");
        bytes32 commitment = mm.computeEvidenceCommitment(marketId, 1, payloadHash);

        // 1. Evidence submitted BEFORE deadline cannot be used even if verified
        uint256 earlyId = evidenceStorage.storeEvidence(marketId, "ipfs://early", commitment);
        vm.prank(evidenceAdmin);
        evidenceStorage.verifyEvidence(earlyId);

        vm.warp(deadline);
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.ResolutionTooEarly.selector);
        mm.resolveWithEvidenceStorage(marketId, 1, earlyId, payloadHash);

        // 2. Evidence submitted AT/AFTER deadline must be verified by EvidenceStorage admin
        uint256 unverifiedId = evidenceStorage.storeEvidence(marketId, "ipfs://post-deadline", commitment);
        vm.prank(resolver);
        vm.expectRevert(MarketMaker.EvidenceNotApproved.selector);
        mm.resolveWithEvidenceStorage(marketId, 1, unverifiedId, payloadHash);

        // 3. Verify evidence -> wrong outcome fails commitment check, matching outcome resolves & syncs!
        vm.prank(evidenceAdmin);
        evidenceStorage.verifyEvidence(unverifiedId);

        vm.prank(resolver);
        vm.expectRevert(MarketMaker.EvidenceOutcomeMismatch.selector);
        mm.resolveWithEvidenceStorage(marketId, 0, unverifiedId, payloadHash);

        vm.prank(resolver);
        mm.resolveWithEvidenceStorage(marketId, 1, unverifiedId, payloadHash);

        assertEq(uint256(PredictionMarket(payable(market)).state()), uint256(PredictionMarket.MarketState.RESOLVED));
        assertEq(PredictionMarket(payable(market)).winningOutcome(), 1);
        assertEq(uint256(factory.getMarketInfo(market).status), uint256(MarketFactory.MarketStatus.RESOLVED));
    }

    // =========================================================================
    // #1369 — Fund the initial LMSR market subsidy & single-outcome solvency
    // =========================================================================

    function test_1369_rejectsInsufficientInitialSubsidyDirectAndViaFactory() public {
        uint256 deadline = block.timestamp + 1 days;

        uint256 req2 = mm.requiredInitialSubsidy(2, B);
        uint256 req3 = mm.requiredInitialSubsidy(3, B);
        uint256 req5 = mm.requiredInitialSubsidy(5, B);

        // Monotonicity: more outcomes require strictly larger subsidy (b * ln(n))
        assertGt(req3, req2);
        assertGt(req5, req3);

        vm.startPrank(creator);
        collateral.approve(address(mm), req5);

        vm.expectRevert(abi.encodeWithSelector(MarketMaker.InsufficientSubsidy.selector, 0, req2));
        mm.createMarket("Zero subsidy", 2, B, deadline, resolver, 0);

        vm.expectRevert(abi.encodeWithSelector(MarketMaker.InsufficientSubsidy.selector, req3 - 1, req3));
        mm.createMarket("1 wei short", 3, B, deadline, resolver, req3 - 1);

        // Via MarketFactory: underfunded canonical creation reverts atomically (no orphaned market)
        collateral.approve(address(factory), req2 - 1);
        vm.expectRevert(abi.encodeWithSelector(MarketMaker.InsufficientSubsidy.selector, req2 - 1, req2));
        factory.createCanonicalMarket(deadline, 1, 2, B, req2 - 1, resolver, "ipfs://underfunded");
        vm.stopPrank();

        assertEq(factory.getMarketCount(), 0, "failed creation must not leave orphaned factory market");
        assertEq(mm.marketCount(), 0);
    }

    function test_1369_singleOutcomePurchaseSolvencyBinaryAndMultiOutcome() public {
        uint256[3] memory outcomeCounts = [uint256(2), uint256(3), uint256(5)];

        for (uint256 idx; idx < outcomeCounts.length; ++idx) {
            uint256 n = outcomeCounts[idx];
            // Create market funded with ONLY the minimum required LMSR subsidy (zero extra buffer!)
            (uint256 marketId, uint256 resolutionTime, uint256 subsidy) = _createDirectMarket(n, B, 1 days);

            // ONLY outcome 0 is ever purchased (in increasing tranches up to 50*B = 5,000 WAD)
            uint256[3] memory tranches = [uint256(10 * WAD), uint256(250 * WAD), uint256(4_740 * WAD)];
            uint256 totalShares;
            uint256 totalPaid;

            for (uint256 t; t < tranches.length; ++t) {
                uint256 shares = tranches[t];
                uint256 cost = mm.getCostToBuy(marketId, 0, shares);
                // Confirm buyer pays strictly less than face payout (subsidy is genuinely required!)
                assertLt(cost, shares);

                vm.startPrank(alice);
                collateral.approve(address(mm), cost);
                mm.buy(marketId, 0, shares);
                vm.stopPrank();

                totalShares += shares;
                totalPaid += cost;
                assertTrue(mm.isMarketSolvent(marketId));
                assertEq(mm.getMarketReserve(marketId), subsidy + totalPaid);
                assertEq(mm.getMarketLiability(marketId), totalShares);
            }

            // Confirm total buy collateral alone could NOT pay winners without the initial LMSR subsidy
            assertLt(totalPaid, totalShares, "buys alone are insufficient without subsidy");
            assertGe(subsidy + totalPaid, totalShares, "subsidy + buys must cover full winning payout");

            // Resolve to the ONLY purchased outcome (worst-case liability)
            vm.warp(resolutionTime);
            _approveAndResolve(marketId, 0);

            // Alice redeems every single share 1:1
            uint256 aliceBefore = collateral.balanceOf(alice);
            vm.prank(alice);
            uint256 payout = mm.redeem(marketId);

            assertEq(payout, totalShares);
            assertEq(collateral.balanceOf(alice), aliceBefore + totalShares);
            assertEq(mm.getMarketLiability(marketId), 0);
            assertTrue(mm.isMarketSolvent(marketId));
        }
    }

    function testFuzz_1369_singleOutcomePurchaseAlwaysSolvent(
        uint8 rawOutcomes,
        uint16 rawBWhole,
        uint16 rawSharesWhole
    ) public {
        uint256 numOutcomes = bound(uint256(rawOutcomes), 2, 8);
        uint256 b = bound(uint256(rawBWhole), 1, 200) * WAD;
        // Keep shares within LMSR expWad domain (<= 100 * b)
        uint256 maxSharesWhole = (b / WAD) * 50;
        uint256 shares = bound(uint256(rawSharesWhole), 1, maxSharesWhole) * WAD;

        uint256 subsidy = mm.requiredInitialSubsidy(numOutcomes, b);
        collateral.mint(creator, subsidy);

        uint256 deadline = block.timestamp + 1 days;
        vm.startPrank(creator);
        collateral.approve(address(mm), subsidy);
        uint256 marketId = mm.createMarket("Fuzz single outcome", numOutcomes, b, deadline, resolver, subsidy);
        vm.stopPrank();

        uint256 cost = mm.getCostToBuy(marketId, 0, shares);
        collateral.mint(alice, cost);

        vm.startPrank(alice);
        collateral.approve(address(mm), cost);
        mm.buy(marketId, 0, shares);
        vm.stopPrank();

        assertTrue(mm.isMarketSolvent(marketId));
        assertGe(mm.getMarketReserve(marketId), shares);

        vm.warp(deadline);
        _approveAndResolve(marketId, 0);

        uint256 balBefore = collateral.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = mm.redeem(marketId);
        assertEq(payout, shares);
        assertEq(collateral.balanceOf(alice), balBefore + shares);
        assertEq(mm.getMarketLiability(marketId), 0);
    }

    // =========================================================================
    // #1370 — Isolate collateral reserves between markets
    // =========================================================================

    function test_1370_isolatesReservesAndLiabilitiesAcrossConcurrentMarkets() public {
        (uint256 marketA, uint256 deadlineA, uint256 subA) = _createDirectMarket(2, B, 1 days);
        (uint256 marketB, uint256 deadlineB, uint256 subB) = _createDirectMarket(3, 250 * WAD, 2 days);

        assertEq(mm.getMarketReserve(marketA), subA);
        assertEq(mm.getMarketReserve(marketB), subB);
        assertEq(mm.totalReservedCollateral(), subA + subB);
        assertEq(collateral.balanceOf(address(mm)), subA + subB);

        uint256 expectedReserveA = subA;
        uint256 aliceSharesA = 300 * WAD;
        uint256 bobSharesA = 200 * WAD;
        {
            // Heavy single-sided trading in Market A (Alice & Bob buy outcome 0)
            uint256 costAliceA = mm.getCostToBuy(marketA, 0, aliceSharesA);
            vm.startPrank(alice);
            collateral.approve(address(mm), costAliceA);
            mm.buy(marketA, 0, aliceSharesA);
            vm.stopPrank();

            uint256 costBobA = mm.getCostToBuy(marketA, 0, bobSharesA);
            vm.startPrank(bob);
            collateral.approve(address(mm), costBobA);
            mm.buy(marketA, 0, bobSharesA);
            vm.stopPrank();

            expectedReserveA += costAliceA + costBobA;
        }

        // Market B's reserve and liability are completely untouched
        assertEq(mm.getMarketReserve(marketB), subB);
        assertEq(mm.getMarketLiability(marketB), 0);
        assertEq(mm.getMarketReserve(marketA), expectedReserveA);
        assertEq(mm.getMarketLiability(marketA), aliceSharesA + bobSharesA);

        uint256 bobSharesB = 400 * WAD;
        uint256 expectedReserveB = subB;
        {
            // Trading in Market B (Bob buys outcome 2) does not affect Market A
            uint256 costBobB = mm.getCostToBuy(marketB, 2, bobSharesB);
            vm.startPrank(bob);
            collateral.approve(address(mm), costBobB);
            mm.buy(marketB, 2, bobSharesB);
            vm.stopPrank();
            expectedReserveB += costBobB;
        }

        assertEq(mm.getMarketReserve(marketA), expectedReserveA);
        assertEq(mm.getMarketReserve(marketB), expectedReserveB);
        assertEq(mm.totalReservedCollateral(), expectedReserveA + expectedReserveB);

        // Resolve Market A -> outcome 0 wins
        vm.warp(deadlineA);
        _approveAndResolve(marketA, 0);

        // Alice redeems from Market A; Bob has NOT redeemed yet -> creator cannot withdraw residual yet
        vm.prank(alice);
        mm.redeem(marketA);
        assertEq(mm.getMarketLiability(marketA), bobSharesA);

        vm.prank(creator);
        vm.expectRevert(MarketMaker.OutstandingLiability.selector);
        mm.withdrawResidualReserve(marketA, creator);

        // Bob redeems; non-creator cannot withdraw residual
        vm.prank(bob);
        mm.redeem(marketA);
        assertEq(mm.getMarketLiability(marketA), 0);

        vm.prank(alice);
        vm.expectRevert(MarketMaker.Unauthorized.selector);
        mm.withdrawResidualReserve(marketA, alice);

        // Creator withdraws Market A's exact residual surplus; Market B's reserve is UNTOUCHED
        {
            uint256 residualA = mm.getMarketReserve(marketA);
            uint256 creatorBalBefore = collateral.balanceOf(creator);
            vm.prank(creator);
            uint256 withdrawn = mm.withdrawResidualReserve(marketA, creator);
            assertEq(withdrawn, residualA);
            assertEq(collateral.balanceOf(creator), creatorBalBefore + residualA);
        }

        assertEq(mm.getMarketReserve(marketA), 0);
        assertEq(mm.getMarketReserve(marketB), expectedReserveB);
        assertEq(mm.totalReservedCollateral(), expectedReserveB);
        assertEq(collateral.balanceOf(address(mm)), expectedReserveB);

        // Market B resolves and Bob redeems in full from Market B's intact reserve
        vm.warp(deadlineB);
        _approveAndResolve(marketB, 2);

        uint256 bobBeforeB = collateral.balanceOf(bob);
        vm.prank(bob);
        uint256 payoutB = mm.redeem(marketB);
        assertEq(payoutB, bobSharesB);
        assertEq(collateral.balanceOf(bob), bobBeforeB + bobSharesB);
        assertEq(mm.getMarketLiability(marketB), 0);
        assertEq(collateral.balanceOf(address(mm)), mm.getMarketReserve(marketB));
    }

    function test_1370_unsolicitedTokensAreNotAttributedToAnyMarketReserve() public {
        (uint256 marketA, uint256 deadlineA, uint256 subA) = _createDirectMarket(2, B, 1 days);

        // Send unsolicited collateral directly to MarketMaker (bypassing createMarket/fundMarket/buy)
        uint256 strayAmount = 50_000 * WAD;
        collateral.mint(address(mm), strayAmount);

        // Market A's accounted reserve MUST ignore stray balance
        assertEq(mm.getMarketReserve(marketA), subA);
        assertEq(mm.totalReservedCollateral(), subA);
        assertEq(collateral.balanceOf(address(mm)), subA + strayAmount);

        // Resolve Market A with zero trades and withdraw residual -> creator receives ONLY subA, never strayAmount
        vm.warp(deadlineA);
        _approveAndResolve(marketA, 0);

        uint256 creatorBefore = collateral.balanceOf(creator);
        vm.prank(creator);
        uint256 withdrawn = mm.withdrawResidualReserve(marketA, creator);

        assertEq(withdrawn, subA);
        assertEq(collateral.balanceOf(creator), creatorBefore + subA);
        assertEq(mm.getMarketReserve(marketA), 0);
        assertEq(mm.totalReservedCollateral(), 0);
        assertEq(collateral.balanceOf(address(mm)), strayAmount);
    }
}
