// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {ERC20 as OZERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/ERC20Token.sol";
import "../src/MarketMaker.sol";
import "../src/MarketFactory.sol";
import "../src/PositionToken.sol";

/// @dev Collateral with configurable decimals (e.g. 6 for USDC-style tokens).
contract DecimalsToken is OZERC20 {
    uint8 private immutable _dec;

    constructor(uint8 dec) OZERC20("Mock", "MOCK") {
        _dec = dec;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice WAD shares vs collateral precision (#1375): conversion, rounding
///         direction for buys / sells / redemption, solvency and the factory path.
contract MarketMakerCollateralDecimalsTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant SCALE6 = 1e12; // WAD shares per 6-decimal base unit
    uint256 constant B = 100 * WAD;

    address resolver = address(0xBEEF);
    address evidenceApprover = address(0xE11D);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    // Same market on an 18-decimal and a 6-decimal collateral.
    ERC20Token token18;
    DecimalsToken token6;
    MarketMaker mm18;
    MarketMaker mm6;
    uint256 id18;
    uint256 id6;
    uint256 resolutionTime;

    function setUp() public {
        token18 = new ERC20Token(0);
        token6 = new DecimalsToken(6);
        mm18 = new MarketMaker(address(token18));
        mm6 = new MarketMaker(address(token6));
        resolutionTime = block.timestamp + 1 days;
        id18 = _setup(mm18, address(token18));
        id6 = _setup(mm6, address(token6));
    }

    function _setup(MarketMaker mm, address token) internal returns (uint256 id) {
        mm.setApprovedResolver(resolver, true);
        mm.setEvidenceApprover(evidenceApprover, true);
        address[3] memory who = [address(this), alice, bob];
        for (uint256 i; i < who.length; i++) {
            _mint(token, who[i], 1_000_000 * WAD);
            vm.prank(who[i]);
            IERC20(token).approve(address(mm), type(uint256).max);
        }
        id = mm.createMarket("decimals", 2, B, resolutionTime, resolver, mm.requiredInitialSubsidy(2, B));
    }

    function _mint(address token, address to, uint256 amount) internal {
        if (token == address(token18)) token18.mint(to, amount);
        else token6.mint(to, amount);
    }

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a + b - 1) / b;
    }

    function _resolve(MarketMaker mm, uint256 id, uint256 outcome) internal {
        vm.warp(resolutionTime);
        bytes32 h = keccak256(abi.encode(address(mm), id, outcome));
        vm.prank(evidenceApprover);
        mm.approveEvidence(id, outcome, h, "ipfs://evidence");
        vm.prank(resolver);
        mm.resolve(id, outcome, h);
    }

    // ── Configuration ─────────────────────────────────────────────────────────

    function testCollateralScale() public view {
        assertEq(mm18.collateralScale(), 1);
        assertEq(mm6.collateralScale(), SCALE6);
    }

    function testRejectsCollateralWithMoreThan18Decimals() public {
        DecimalsToken t24 = new DecimalsToken(24);
        vm.expectRevert(abi.encodeWithSelector(MarketMaker.UnsupportedCollateralDecimals.selector, uint8(24)));
        new MarketMaker(address(t24));
    }

    function testRequiredSubsidyIsInCollateralUnitsRoundedUp() public view {
        uint256 sub18 = mm18.requiredInitialSubsidy(2, B); // == WAD amount for 18 decimals
        assertEq(mm6.requiredInitialSubsidy(2, B), _ceilDiv(sub18, SCALE6));
        assertEq(mm6.getMarketReserve(id6), _ceilDiv(sub18, SCALE6));
    }

    // ── Rounding direction ────────────────────────────────────────────────────

    function testBuyCostRoundsUp() public {
        uint256 shares = 7 * WAD + 123_456_789; // not a whole base unit
        uint256 cost18 = mm18.getCostToBuy(id18, 0, shares);
        uint256 cost6 = mm6.getCostToBuy(id6, 0, shares);
        assertEq(cost6, _ceilDiv(cost18, SCALE6));

        uint256 before = token6.balanceOf(alice);
        vm.prank(alice);
        mm6.buy(id6, 0, shares);
        assertEq(before - token6.balanceOf(alice), cost6, "charged the quoted, rounded-up cost");
        assertEq(mm6.positions(alice, id6, 0), shares, "shares stay WAD");
    }

    function testSellProceedsRoundDown() public {
        vm.prank(alice);
        mm18.buy(id18, 0, 10 * WAD);
        vm.prank(alice);
        mm6.buy(id6, 0, 10 * WAD);

        uint256 shares = 3 * WAD + 987_654_321;
        uint256 proceeds18 = mm18.getProceedsToSell(id18, 0, shares);
        uint256 proceeds6 = mm6.getProceedsToSell(id6, 0, shares);
        assertEq(proceeds6, proceeds18 / SCALE6);

        uint256 before = token6.balanceOf(alice);
        vm.prank(alice);
        mm6.sell(id6, 0, shares);
        assertEq(token6.balanceOf(alice) - before, proceeds6);
    }

    function testRedemptionRoundsDownAndBurnsDust() public {
        // bob buys less than one base unit worth of shares: pays 1 unit, redeems 0.
        vm.prank(alice);
        mm6.buy(id6, 0, 5 * WAD + 1);
        vm.prank(bob);
        mm6.buy(id6, 0, SCALE6 - 1);
        _resolve(mm6, id6, 0);

        vm.prank(alice);
        assertEq(mm6.redeem(id6), 5_000_000, "floor(5e18 + 1 shares) = 5.000000 tokens");

        uint256 bobBefore = token6.balanceOf(bob);
        vm.prank(bob);
        assertEq(mm6.redeem(id6), 0);
        assertEq(token6.balanceOf(bob), bobBefore);
        assertEq(mm6.positions(bob, id6, 0), 0, "dust shares are burned");

        // Dust didn't leave a liability blocking the creator's residual withdrawal.
        assertGt(mm6.withdrawResidualReserve(id6, address(this)), 0);
        assertEq(token6.balanceOf(address(mm6)), 0, "every base unit accounted for");
        assertEq(mm6.totalReservedCollateral(), 0);
    }

    // ── Solvency ──────────────────────────────────────────────────────────────

    /// Random trades on a 6-decimal market keep the reserve >= ceil(liability)
    /// and every winner can be paid in full.
    function testFuzzSolventUnderRounding(uint256[6] memory amounts, uint8 sellMask, uint8 winner) public {
        address[2] memory traders = [alice, bob];
        for (uint256 i; i < amounts.length; i++) {
            uint256 outcome = i % 2;
            address t = traders[i % 2];
            // >= 1e9 wei-shares: smaller buys are below LMSR precision (zero cost reverts
            // "MM: non-positive cost" on any collateral) but still well under one 6-dec unit.
            uint256 shares = bound(amounts[i], 1e9, 50 * WAD);
            vm.prank(t);
            mm6.buy(id6, outcome, shares);
            if ((sellMask >> i) & 1 == 1) {
                uint256 sellShares = shares / 3;
                if (sellShares > 0) {
                    vm.prank(t);
                    mm6.sell(id6, outcome, sellShares);
                }
            }
            assertTrue(mm6.isMarketSolvent(id6));
            assertGe(token6.balanceOf(address(mm6)), mm6.totalReservedCollateral());
        }

        uint256 w = winner % 2;
        _resolve(mm6, id6, w);
        for (uint256 i; i < traders.length; i++) {
            if (mm6.positions(traders[i], id6, w) > 0) {
                vm.prank(traders[i]);
                mm6.redeem(id6);
            }
        }
        mm6.withdrawResidualReserve(id6, address(this));
        assertEq(token6.balanceOf(address(mm6)), 0);
    }

    // ── MarketFactory: `b` is WAD, not collateral base units ──────────────────

    function testFactoryMarketUsesWadLiquidityParameter() public {
        uint256 factoryNonce = vm.getNonce(address(this)) + 1;
        PositionToken pt = new PositionToken(vm.computeCreateAddress(address(this), factoryNonce));
        MarketFactory factory = new MarketFactory(address(pt));
        mm6.setApprovedResolver(address(0x5E7), true);
        mm6.setMarketFactory(address(factory));
        factory.setMarketMaker(address(mm6), address(0x5E7));
        token6.approve(address(factory), type(uint256).max);

        uint256 minLiquidityWhole = 100;
        factory.createMarket(address(token6), block.timestamp + 1 days, minLiquidityWhole, "ipfs://m");
        uint256 id = mm6.marketCount() - 1;

        (, uint256 b,,,,) = mm6.markets(id);
        assertEq(b, minLiquidityWhole * WAD, "b = 100 shares, not 100e6 wei-shares");
        uint256 required = mm6.requiredInitialSubsidy(2, b);
        uint256 expected = required > 100e6 ? required : 100e6;
        assertEq(mm6.getMarketReserve(id), expected);
    }
}
