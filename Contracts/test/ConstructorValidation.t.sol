// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AutoRebalancer} from "../src/AutoRebalancer.sol";
import {ERC20Token} from "../src/ERC20Token.sol";
import {LiquidityPool} from "../src/LiquidityPool.sol";
import {MarketMaker} from "../src/MarketMaker.sol";
import {MarketRebalance} from "../src/MarketRebalance.sol";
import {MarketSettlement} from "../src/MarketSettlement.sol";
import {MarketVault} from "../src/MarketVault.sol";
import {MultiSigWallet} from "../src/MultiSigWallet.sol";
import {Payout} from "../src/Payout.sol";
import {PositionToken} from "../src/PositionToken.sol";
import {Resolution} from "../src/Resolution.sol";
import {Trading} from "../src/Trading.sol";
import {VerdictExecution} from "../src/VerdictExecution.sol";

/// @dev MarketMaker stand-in whose collateral dependency is unset.
contract EmptyCollateralMarketMaker {
    function collateral() external pure returns (address) {
        return address(0);
    }
}

/// @notice Constructor checks for zero addresses, basis points, and empty dependencies.
contract ConstructorValidationTest is Test {
    ERC20Token internal token;
    MarketMaker internal marketMaker;

    function setUp() public {
        token = new ERC20Token(0);
        marketMaker = new MarketMaker(address(token));
    }

    function test_marketMaker_revertsOnZeroCollateral() public {
        vm.expectRevert(MarketMaker.ZeroAddress.selector);
        new MarketMaker(address(0));
    }

    function test_trading_revertsOnZeroMarketMaker() public {
        vm.expectRevert(Trading.ZeroAddress.selector);
        new Trading(address(0), 30, 0, address(this));
    }

    function test_trading_revertsWhenCollateralDependencyIsUnset() public {
        EmptyCollateralMarketMaker emptyMm = new EmptyCollateralMarketMaker();
        vm.expectRevert(Trading.ZeroAddress.selector);
        new Trading(address(emptyMm), 30, 0, address(this));
    }

    function test_trading_revertsOnInvalidFeeBps() public {
        vm.expectRevert(bytes("Trading: fee > 10%"));
        new Trading(address(marketMaker), 1_001, 0, address(this));
    }

    function test_trading_revertsWhenRebateExceedsFee() public {
        vm.expectRevert(bytes("Trading: rebate > fee"));
        new Trading(address(marketMaker), 30, 31, address(this));
    }

    function test_payout_revertsOnZeroCollateral() public {
        vm.expectRevert(Payout.ZeroAddress.selector);
        new Payout(address(0));
    }

    function test_resolution_revertsOnZeroDisputeWindow() public {
        vm.expectRevert(Resolution.InvalidDisputeWindow.selector);
        new Resolution(0, address(1), address(2), address(3), address(4));
    }

    function test_resolution_revertsOnZeroDependencies() public {
        vm.expectRevert(Resolution.ZeroAddress.selector);
        new Resolution(1 days, address(0), address(2), address(3), address(4));

        vm.expectRevert(Resolution.ZeroAddress.selector);
        new Resolution(1 days, address(1), address(0), address(3), address(4));

        vm.expectRevert(Resolution.ZeroAddress.selector);
        new Resolution(1 days, address(1), address(2), address(0), address(4));
    }

    function test_marketSettlement_revertsOnZeroDependencies() public {
        vm.expectRevert(MarketSettlement.ZeroAddress.selector);
        new MarketSettlement(address(0), address(1), address(2));

        vm.expectRevert(MarketSettlement.ZeroAddress.selector);
        new MarketSettlement(address(1), address(0), address(2));

        vm.expectRevert(MarketSettlement.ZeroAddress.selector);
        new MarketSettlement(address(1), address(2), address(0));
    }

    function test_liquidityPool_revertsOnZeroAddresses() public {
        vm.expectRevert(LiquidityPool.ZeroAddress.selector);
        new LiquidityPool(address(0), address(1));

        vm.expectRevert(LiquidityPool.ZeroAddress.selector);
        new LiquidityPool(address(1), address(0));
    }

    function test_positionToken_revertsOnZeroFactory() public {
        vm.expectRevert(PositionToken.ZeroAddress.selector);
        new PositionToken(address(0));
    }

    function test_marketVault_revertsOnZeroAsset() public {
        vm.expectRevert(MarketVault.ZeroAddress.selector);
        new MarketVault(address(0), "Vault Share", "vMCK", 0);
    }

    function test_marketVault_revertsOnEmptyShareMetadata() public {
        vm.expectRevert(MarketVault.EmptyShareMetadata.selector);
        new MarketVault(address(token), "", "vMCK", 0);

        vm.expectRevert(MarketVault.EmptyShareMetadata.selector);
        new MarketVault(address(token), "Vault Share", "", 0);
    }

    function test_marketRebalance_revertsOnInvalidBasisPoints() public {
        vm.expectRevert(abi.encodeWithSelector(MarketRebalance.InvalidBasisPoints.selector, 0));
        new MarketRebalance(address(this), address(1), 0, 1 hours);

        vm.expectRevert(abi.encodeWithSelector(MarketRebalance.InvalidBasisPoints.selector, 10_001));
        new MarketRebalance(address(this), address(1), 10_001, 1 hours);
    }

    function test_verdictExecution_revertsOnZeroArbitrator() public {
        vm.expectRevert(VerdictExecution.ZeroAddress.selector);
        new VerdictExecution(address(0));
    }

    function test_autoRebalancer_revertsOnEmptyAssets() public {
        address[] memory assets = new address[](0);
        uint256[] memory weights = new uint256[](0);
        vm.expectRevert(AutoRebalancer.EmptyAssets.selector);
        new AutoRebalancer(assets, weights, 100, 1, address(1));
    }

    function test_multiSig_revertsOnEmptySigners() public {
        address[] memory signers = new address[](0);
        vm.expectRevert(MultiSigWallet.InvalidSignerCount.selector);
        new MultiSigWallet(signers, 1);
    }
}
