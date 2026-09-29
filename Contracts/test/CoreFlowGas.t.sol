// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Token} from "../src/ERC20Token.sol";
import {LiquidityPool} from "../src/LiquidityPool.sol";
import {MarketBridge, IRouterClient, Client} from "../src/MarketBridge.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {MarketMaker} from "../src/MarketMaker.sol";
import {MarketMinter} from "../src/MarketMinter.sol";
import {MarketSettlement} from "../src/MarketSettlement.sol";
import {MarketWithdraw} from "../src/MarketWithdraw.sol";
import {PositionToken} from "../src/PositionToken.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {Resolution} from "../src/Resolution.sol";
import {Trading} from "../src/Trading.sol";

contract GasMockToken is ERC20 {
    constructor() ERC20("Gas Mock", "GAS") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract GasRouter is IRouterClient {
    function isChainSupported(uint64) external pure returns (bool) {
        return true;
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external pure returns (uint256) {
        return 0;
    }

    function ccipSend(uint64, Client.EVM2AnyMessage calldata message) external payable returns (bytes32) {
        if (message.tokenAmounts.length > 0) {
            ERC20(message.tokenAmounts[0].token).transferFrom(
                msg.sender, address(this), message.tokenAmounts[0].amount
            );
        }
        return bytes32(uint256(1));
    }
}

/// @notice Gas ceilings for trade, settle, resolve, bridge, mint, and withdraw.
///         Bounds live in this test so review does not depend on a snapshot file.
contract CoreFlowGasTest is Test {
    uint256 internal constant TRADE_GAS = 220_000;
    uint256 internal constant SETTLE_GAS = 120_000;
    uint256 internal constant RESOLVE_GAS = 210_000;
    uint256 internal constant BRIDGE_GAS = 400_000;
    uint256 internal constant MINT_GAS = 120_000;
    uint256 internal constant WITHDRAW_GAS = 40_000;

    bytes32 internal constant ORACLE_FEED = keccak256("ORACLE/USD");

    function test_gas_trade() public {
        ERC20Token token = new ERC20Token(0);
        MarketMaker mm = new MarketMaker(address(token));
        Trading trading = new Trading(address(mm), 30, 0, address(this));
        token.mint(address(this), 10_000 ether);
        uint256 marketId = mm.createMarket("Flight delayed?", 2, 100 ether);
        uint256 shares = 10 ether;
        uint256 rawCost = mm.getCostToBuy(marketId, 0, shares);
        uint256 total = rawCost + (rawCost * 30) / 10_000;
        token.approve(address(trading), total);

        uint256 gas = gasleft();
        trading.executeBuy(marketId, 0, shares, total);
        gas = gas - gasleft();
        assertLt(gas, TRADE_GAS, "trade gas regression");
    }

    function test_gas_resolveAndSettle() public {
        ERC20Token collateral = new ERC20Token(0);
        PositionToken positionToken = new PositionToken(address(this));
        MarketFactory factory = new MarketFactory(address(positionToken));
        address market = address(0xDEAD);
        LiquidityPool pool = new LiquidityPool(address(collateral), market);
        PriceOracle priceOracle = new PriceOracle();
        priceOracle.registerFeed(ORACLE_FEED, "Oracle/USD", 365 days);
        priceOracle.setUpdater(address(this), true);
        priceOracle.updatePrice(ORACLE_FEED, 1e18);

        Resolution resolution = new Resolution(1 days, address(this), address(this), address(positionToken), address(priceOracle));
        pool.setResolution(address(resolution));
        resolution.registerMarket(market, address(pool), block.timestamp + 1 hours, ORACLE_FEED);
        collateral.mint(address(this), 1_000 ether);
        collateral.approve(address(pool), 1_000 ether);
        pool.deposit(1_000 ether);
        MarketSettlement settlement = new MarketSettlement(address(positionToken), address(factory), address(resolution));

        vm.warp(block.timestamp + 2 hours);
        uint256 resolveGas = gasleft();
        resolution.resolve(market, Resolution.Outcome.YES, bytes("oracle"));
        resolveGas = resolveGas - gasleft();
        assertLt(resolveGas, RESOLVE_GAS, "resolve gas regression");

        uint256 settleGas = gasleft();
        settlement.initiateSettlement(market, address(pool));
        settleGas = settleGas - gasleft();
        assertLt(settleGas, SETTLE_GAS, "settle gas regression");
    }

    function test_gas_bridge() public {
        GasMockToken token = new GasMockToken();
        GasRouter router = new GasRouter();
        MarketBridge bridge = new MarketBridge(
            address(token), address(router), address(1), address(2), address(this)
        );
        bridge.addSupportedChain(1, 0, 0);
        token.mint(address(this), 50 ether);
        token.approve(address(bridge), type(uint256).max);

        uint256 gas = gasleft();
        bridge.bridgeOut(1, address(0xB0B), 10 ether);
        gas = gas - gasleft();
        assertLt(gas, BRIDGE_GAS, "bridge gas regression");
    }

    function test_gas_mint() public {
        ERC20Token token = new ERC20Token(0);
        MarketMinter minter = new MarketMinter(address(token));
        token.addMinter(address(minter));
        minter.registerMinter(address(this), 0, 0);

        uint256 gas = gasleft();
        minter.mint(address(0xB0B), 1 ether);
        gas = gas - gasleft();
        assertLt(gas, MINT_GAS, "mint gas regression");
    }

    function test_gas_withdraw() public {
        GasMockToken token = new GasMockToken();
        MarketWithdraw market = new MarketWithdraw(address(this), address(token), 10_000, 0, 0);
        token.mint(address(this), 50 ether);
        token.approve(address(market), type(uint256).max);
        market.deposit(20 ether);
        uint256 id = market.requestWithdraw(10 ether, 10_000);

        uint256 gas = gasleft();
        market.executeWithdraw(id);
        gas = gas - gasleft();
        assertLt(gas, WITHDRAW_GAS, "withdraw gas regression");
    }
}
