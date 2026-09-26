// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../../src/ERC20Token.sol";
import "../../src/LMSR.sol";
import "../../src/MarketMaker.sol";

contract LMSRMarketMakerHandler is Test {
    uint256 public constant WAD = 1e18;
    uint256 public constant LIQUIDITY_PARAMETER = 100 * WAD;
    uint256 public constant OUTCOME_COUNT = 3;

    ERC20Token public immutable token;
    MarketMaker public immutable marketMaker;
    uint256 public immutable marketId;

    address[4] private _actors;
    uint256[3] private _quantities;
    mapping(address => mapping(uint256 => uint256)) private _shares;

    uint256 public grossBuyCollateral;
    uint256 public grossSellProceeds;
    uint256 public totalPayouts;
    uint256 public expectedPayouts;
    uint256 public winningOutcome;
    bool public resolved;
    bool public redeemAllCalled;
    bool public pricingConsistent = true;

    constructor(ERC20Token token_, MarketMaker marketMaker_, address[4] memory actors_) {
        token = token_;
        marketMaker = marketMaker_;
        _actors = actors_;
        marketId = marketMaker_.createMarket("LMSR invariant market", OUTCOME_COUNT, LIQUIDITY_PARAMETER);

        for (uint256 i; i < _actors.length; ++i) {
            vm.prank(_actors[i]);
            token_.approve(address(marketMaker_), type(uint256).max);
        }
    }

    function buy(uint256 actorSeed, uint256 outcomeSeed, uint256 amountSeed) external {
        if (resolved) return;

        address actor = _actors[actorSeed % _actors.length];
        uint256 outcome = outcomeSeed % OUTCOME_COUNT;
        uint256 shares = ((amountSeed % 5) + 1) * (WAD / 10);
        uint256 priceBefore = marketMaker.getPrice(marketId, outcome);
        uint256 quotedCost = marketMaker.getCostToBuy(marketId, outcome, shares);
        uint256 balanceBefore = token.balanceOf(address(marketMaker));

        vm.prank(actor);
        marketMaker.buy(marketId, outcome, shares);

        uint256 spent = balanceBefore - token.balanceOf(address(marketMaker));
        uint256 priceAfter = marketMaker.getPrice(marketId, outcome);
        uint256[] memory quantitiesBefore = _quantitySnapshot();
        uint256[] memory quantitiesAfter = _quantitySnapshot();
        quantitiesAfter[outcome] += shares;
        int256 expectedCost = LMSR.cost(quantitiesBefore, quantitiesAfter, LIQUIDITY_PARAMETER);

        pricingConsistent = pricingConsistent
            && expectedCost > 0
            && quotedCost == uint256(expectedCost)
            && spent == quotedCost
            && priceAfter >= priceBefore;

        _quantities[outcome] += shares;
        _shares[actor][outcome] += shares;
        grossBuyCollateral += spent;
    }

    function sell(uint256 actorSeed, uint256 outcomeSeed, uint256 amountSeed) external {
        if (resolved) return;

        address actor = _actors[actorSeed % _actors.length];
        uint256 outcome = outcomeSeed % OUTCOME_COUNT;
        uint256 available = _shares[actor][outcome];
        if (available == 0) return;

        uint256 shares = ((amountSeed % 5) + 1) * (WAD / 10);
        if (shares > available) shares = available;

        uint256 priceBefore = marketMaker.getPrice(marketId, outcome);
        uint256 balanceBefore = token.balanceOf(address(marketMaker));
        uint256[] memory quantitiesBefore = _quantitySnapshot();
        uint256[] memory quantitiesAfter = _quantitySnapshot();
        quantitiesAfter[outcome] -= shares;
        int256 expectedDelta = LMSR.cost(quantitiesBefore, quantitiesAfter, LIQUIDITY_PARAMETER);

        vm.prank(actor);
        marketMaker.sell(marketId, outcome, shares);

        uint256 proceeds = token.balanceOf(address(marketMaker)) - balanceBefore;
        uint256 priceAfter = marketMaker.getPrice(marketId, outcome);
        pricingConsistent = pricingConsistent
            && expectedDelta < 0
            && proceeds == uint256(-expectedDelta)
            && priceAfter <= priceBefore;

        _quantities[outcome] -= shares;
        _shares[actor][outcome] -= shares;
        grossSellProceeds += proceeds;
    }

    function resolve(uint256 outcomeSeed) external {
        if (resolved) return;

        winningOutcome = outcomeSeed % OUTCOME_COUNT;
        marketMaker.resolve(marketId, winningOutcome);
        resolved = true;
    }

    function redeem(uint256 actorSeed) external {
        if (!resolved) return;
        _redeem(_actors[actorSeed % _actors.length]);
    }

    function redeemAll() external {
        if (!resolved) return;
        redeemAllCalled = true;
        for (uint256 i; i < _actors.length; ++i) {
            _redeem(_actors[i]);
        }
    }

    function actorAt(uint256 index) external view returns (address) {
        return _actors[index];
    }

    function sharesOf(address actor, uint256 outcome) external view returns (uint256) {
        return _shares[actor][outcome];
    }

    function quantityAt(uint256 outcome) external view returns (uint256) {
        return _quantities[outcome];
    }

    function outstandingForOutcome(uint256 outcome) external view returns (uint256 total) {
        for (uint256 i; i < _actors.length; ++i) {
            total += _shares[_actors[i]][outcome];
        }
    }

    function _redeem(address actor) internal {
        uint256 shares = _shares[actor][winningOutcome];
        if (shares == 0) return;

        uint256 balanceBefore = token.balanceOf(actor);
        vm.prank(actor);
        marketMaker.redeem(marketId);
        uint256 payout = token.balanceOf(actor) - balanceBefore;

        expectedPayouts += shares;
        totalPayouts += payout;
        pricingConsistent = pricingConsistent && payout == shares;
        _shares[actor][winningOutcome] = 0;
    }

    function _quantitySnapshot() internal view returns (uint256[] memory quantities) {
        quantities = new uint256[](OUTCOME_COUNT);
        for (uint256 i; i < OUTCOME_COUNT; ++i) {
            quantities[i] = _quantities[i];
        }
    }
}

contract MarketMakerInvariantTest is StdInvariant, Test {
    uint256 private constant WAD = 1e18;
    uint256 private constant INITIAL_LIQUIDITY = 1_000_000 * WAD;
    uint256 private constant ACTOR_FUNDS = 1_000_000 * WAD;

    ERC20Token private token;
    MarketMaker private marketMaker;
    LMSRMarketMakerHandler private handler;

    function setUp() public {
        token = new ERC20Token(0);
        marketMaker = new MarketMaker(address(token));
        token.mint(address(marketMaker), INITIAL_LIQUIDITY);

        address[4] memory actors;
        actors[0] = address(0xA11CE);
        actors[1] = address(0xB0B);
        actors[2] = address(0xCA401);
        actors[3] = address(0xDA4E);
        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], ACTOR_FUNDS);
        }

        handler = new LMSRMarketMakerHandler(token, marketMaker, actors);
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = LMSRMarketMakerHandler.buy.selector;
        selectors[1] = LMSRMarketMakerHandler.sell.selector;
        selectors[2] = LMSRMarketMakerHandler.resolve.selector;
        selectors[3] = LMSRMarketMakerHandler.redeem.selector;
        selectors[4] = LMSRMarketMakerHandler.redeemAll.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_pricesMatchTradeLedgerAndNormalize() public view {
        assertTrue(handler.pricingConsistent(), "trade quote, price direction, or payout mismatch");

        uint256 sum;
        uint256[] memory quantities = new uint256[](3);
        for (uint256 outcome; outcome < 3; ++outcome) {
            quantities[outcome] = handler.quantityAt(outcome);
            uint256 price = marketMaker.getPrice(handler.marketId(), outcome);
            assertGt(price, 0);
            assertLe(price, WAD);
            assertEq(price, LMSR.price(quantities, 100 * WAD, outcome));
            sum += price;
        }

        assertApproxEqAbs(sum, WAD, 3, "outcome prices must sum to one WAD");
    }

    function invariant_positionsMatchTradeLedger() public view {
        for (uint256 actorIndex; actorIndex < 4; ++actorIndex) {
            address actor = handler.actorAt(actorIndex);
            for (uint256 outcome; outcome < 3; ++outcome) {
                assertEq(
                    marketMaker.positions(actor, handler.marketId(), outcome),
                    handler.sharesOf(actor, outcome)
                );
            }
        }
    }

    function invariant_collateralLedgerAndSolvency() public view {
        uint256 expectedBalance = INITIAL_LIQUIDITY
            + handler.grossBuyCollateral()
            - handler.grossSellProceeds()
            - handler.totalPayouts();
        assertEq(token.balanceOf(address(marketMaker)), expectedBalance);

        uint256 requiredLiquidity;
        if (handler.resolved()) {
            requiredLiquidity = handler.outstandingForOutcome(handler.winningOutcome());
        } else {
            for (uint256 outcome; outcome < 3; ++outcome) {
                uint256 liability = handler.outstandingForOutcome(outcome);
                if (liability > requiredLiquidity) requiredLiquidity = liability;
            }
        }
        assertGe(token.balanceOf(address(marketMaker)), requiredLiquidity);
    }

    function invariant_redemptionsConserveWinningPayout() public view {
        assertEq(handler.totalPayouts(), handler.expectedPayouts());
        if (handler.redeemAllCalled()) {
            assertEq(handler.outstandingForOutcome(handler.winningOutcome()), 0);
        }
    }
}