// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketMaker.sol";
import "../src/Trading.sol";
import "../src/FeeHandler.sol";

/// @notice Deploy the canonical LMSR MarketMaker and its fee/rebate wrapper (Trading),
///         with optional wiring to an existing FeeHandler for centralised fee routing.
///         Writes a JSON artifact on completion.
///
/// # Minimal deploy (no FeeHandler integration)
///   forge script script/DeployCoreMarket.s.sol:DeployCoreMarket \
///     --rpc-url $RPC_URL --broadcast --sig "run()"
///
/// # Deploy + register a TRADING fee structure on a pre-deployed FeeHandler
///   forge script script/DeployCoreMarket.s.sol:DeployCoreMarketWithFeeHandler \
///     --rpc-url $RPC_URL --broadcast
///
/// # Read-only verification
///   forge script script/DeployCoreMarket.s.sol:VerifyCoreMarket \
///     --rpc-url $RPC_URL --sig "run()"
///
/// # Required env vars
///   PRIVATE_KEY                 – deployer private key (hex, 0x-prefixed)
///   COLLATERAL_TOKEN_ADDRESS    – address of a deployed ERC-20 collateral token
///   COMMISSION_RECIPIENT        – address that receives the commission portion of fees
///
/// # Optional env vars
///   TRADING_FEE_BPS             – total fee in basis points, max 1000 (default: 30)
///   TRADING_REBATE_BPS          – referrer rebate portion in bps, ≤ fee (default: 0)
///
/// # Optional env vars (DeployCoreMarketWithFeeHandler only)
///   FEE_HANDLER_ADDRESS         – pre-deployed FeeHandler to register a TRADING structure on
///   FEE_BPS                     – fee rate for the FeeHandler structure (default: TRADING_FEE_BPS)
///   FEE_RECIPIENT_1             – first recipient address for the FeeHandler structure
///   FEE_RECIPIENT_1_SHARE_BPS   – share in bps for recipient 1
///   FEE_RECIPIENT_2             – second recipient (optional)
///   FEE_RECIPIENT_2_SHARE_BPS   – share in bps for recipient 2
///   FEE_RECIPIENT_3             – third recipient (optional)
///   FEE_RECIPIENT_3_SHARE_BPS   – share in bps for recipient 3
///
/// # Verification env vars
///   MARKET_MAKER_ADDRESS        – deployed MarketMaker to verify
///   TRADING_ADDRESS             – deployed Trading to verify
contract DeployCoreMarket is Script {
    error InvalidCollateralToken(address collateralToken);

    function run() external returns (MarketMaker marketMaker, Trading trading) {
        uint256 deployerPrivateKey  = vm.envUint("PRIVATE_KEY");
        address deployer            = vm.addr(deployerPrivateKey);
        address collateralToken     = vm.envAddress("COLLATERAL_TOKEN_ADDRESS");
        address commissionRecipient = vm.envAddress("COMMISSION_RECIPIENT");
        uint256 feeBps              = vm.envOr("TRADING_FEE_BPS",    uint256(30));
        uint256 rebateBps           = vm.envOr("TRADING_REBATE_BPS", uint256(0));

        _validateInputs(collateralToken, feeBps, rebateBps, commissionRecipient);

        vm.startBroadcast(deployerPrivateKey);
        marketMaker = new MarketMaker(collateralToken);
        trading = new Trading(
            address(marketMaker),
            feeBps,
            rebateBps,
            commissionRecipient
        );
        vm.stopBroadcast();

        _logAndArtifact(deployer, marketMaker, trading, feeBps, rebateBps, address(0));
    }

    // ── Shared helpers ────────────────────────────────────────────────────────

    function _validateInputs(
        address collateralToken,
        uint256 feeBps,
        uint256 rebateBps,
        address commissionRecipient
    ) internal view {
        if (collateralToken == address(0))
            revert InvalidCollateralToken(collateralToken);
        // Verify the address actually contains contract code (not a fresh EOA or typo).
        if (collateralToken.code.length == 0)
            revert InvalidCollateralToken(collateralToken);
        require(feeBps <= 1_000,  "DeployCoreMarket: TRADING_FEE_BPS exceeds 10% ceiling");
        require(rebateBps <= feeBps, "DeployCoreMarket: TRADING_REBATE_BPS exceeds fee");
        require(commissionRecipient != address(0),
            "DeployCoreMarket: COMMISSION_RECIPIENT is zero address");
    }

    function _logAndArtifact(
        address deployer,
        MarketMaker marketMaker,
        Trading trading,
        uint256 feeBps,
        uint256 rebateBps,
        address feeHandlerAddr
    ) internal {
        console.log("--- CoreMarket Deployment ---");
        console.log("MarketMaker          :", address(marketMaker));
        console.log("Trading              :", address(trading));
        console.log("Collateral token     :", address(marketMaker.collateral()));
        console.log("Fee (bps)            :", feeBps);
        console.log("Rebate (bps)         :", rebateBps);
        console.log("Commission (bps)     :", feeBps - rebateBps);
        console.log("Commission recipient :", trading.commissionRecipient());
        if (feeHandlerAddr != address(0)) {
            console.log("FeeHandler           :", feeHandlerAddr);
        }
        console.log("Deployer             :", deployer);
        console.log("Chain ID             :", block.chainid);

        string memory feeHandlerSection = feeHandlerAddr == address(0)
            ? "null"
            : string.concat('"', vm.toString(feeHandlerAddr), '"');

        string memory json = string.concat(
            '{"contractName":"CoreMarket"',
            ',"marketMaker":"',       vm.toString(address(marketMaker)),              '"',
            ',"trading":"',           vm.toString(address(trading)),                  '"',
            ',"collateralToken":"',   vm.toString(address(marketMaker.collateral())), '"',
            ',"feeBps":',             vm.toString(feeBps),
            ',"rebateBps":',          vm.toString(rebateBps),
            ',"commissionBps":',      vm.toString(feeBps - rebateBps),
            ',"commissionRecipient":"', vm.toString(trading.commissionRecipient()),   '"',
            ',"feeHandler":',         feeHandlerSection,
            ',"deployer":"',          vm.toString(deployer),                          '"',
            ',"chainId":',            vm.toString(block.chainid),
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/CoreMarket.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact             :", path);
    }
}

/// @notice Extended deploy: deploys MarketMaker + Trading and, when
///         FEE_HANDLER_ADDRESS is set, registers a TRADING fee structure on the
///         pre-deployed FeeHandler in the same broadcast.
///
///         The FeeHandler must already be deployed and the deployer must be its
///         owner, or the setFeeStructure call will revert.
contract DeployCoreMarketWithFeeHandler is DeployCoreMarket {
    bytes32 public constant TRADING_STRUCTURE_ID = keccak256("TRADING");
    uint256 constant BPS_DENOMINATOR = 10_000;

    function run() external returns (MarketMaker marketMaker, Trading trading) {
        uint256 deployerPrivateKey  = vm.envUint("PRIVATE_KEY");
        address deployer            = vm.addr(deployerPrivateKey);
        address collateralToken     = vm.envAddress("COLLATERAL_TOKEN_ADDRESS");
        address commissionRecipient = vm.envAddress("COMMISSION_RECIPIENT");
        uint256 tradingFeeBps       = vm.envOr("TRADING_FEE_BPS",    uint256(30));
        uint256 rebateBps           = vm.envOr("TRADING_REBATE_BPS", uint256(0));

        _validateInputs(collateralToken, tradingFeeBps, rebateBps, commissionRecipient);

        // ── FeeHandler config (optional) ──────────────────────────────────────
        address feeHandlerAddr = vm.envOr("FEE_HANDLER_ADDRESS", address(0));

        // If FEE_BPS not set, mirror the Trading fee so both systems are consistent.
        uint256 handlerFeeBps = vm.envOr("FEE_BPS", tradingFeeBps);
        require(handlerFeeBps <= 1_000,
            "DeployCoreMarket: FEE_BPS exceeds 10% ceiling");

        FeeHandler.FeeRecipient[] memory recipients;
        if (feeHandlerAddr != address(0)) {
            recipients = _buildRecipients(deployer, handlerFeeBps);
        }

        // ── Broadcast ─────────────────────────────────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        marketMaker = new MarketMaker(collateralToken);
        trading = new Trading(
            address(marketMaker),
            tradingFeeBps,
            rebateBps,
            commissionRecipient
        );

        if (feeHandlerAddr != address(0)) {
            FeeHandler(feeHandlerAddr).setFeeStructure(
                TRADING_STRUCTURE_ID,
                handlerFeeBps,
                recipients
            );
        }

        vm.stopBroadcast();

        // ── Logging + artifact ────────────────────────────────────────────────
        if (feeHandlerAddr != address(0)) {
            console.log("FeeHandler structure registered:");
            console.log("  ID    :", vm.toString(TRADING_STRUCTURE_ID));
            console.log("  Bps   :", handlerFeeBps);
            for (uint256 i; i < recipients.length; ++i) {
                console.log("  recipient[", i, "]:", recipients[i].account);
                console.log("    share (bps)     :", recipients[i].shareBps);
            }
        }

        _logAndArtifact(deployer, marketMaker, trading, tradingFeeBps, rebateBps, feeHandlerAddr);
    }

    function _buildRecipients(
        address deployer,
        uint256 /*handlerFeeBps*/
    ) internal view returns (FeeHandler.FeeRecipient[] memory recipients) {
        address r1 = vm.envOr("FEE_RECIPIENT_1", address(0));
        uint256 r1Share = vm.envOr("FEE_RECIPIENT_1_SHARE_BPS", uint256(0));
        address r2 = vm.envOr("FEE_RECIPIENT_2", address(0));
        uint256 r2Share = vm.envOr("FEE_RECIPIENT_2_SHARE_BPS", uint256(0));
        address r3 = vm.envOr("FEE_RECIPIENT_3", address(0));
        uint256 r3Share = vm.envOr("FEE_RECIPIENT_3_SHARE_BPS", uint256(0));

        if (r1 == address(0)) {
            // Default: deployer absorbs 100 % of handler fees.
            recipients = new FeeHandler.FeeRecipient[](1);
            recipients[0] = FeeHandler.FeeRecipient({
                account:  deployer,
                shareBps: BPS_DENOMINATOR
            });
        } else if (r2 == address(0)) {
            require(r1Share == BPS_DENOMINATOR,
                "DeployCoreMarket: single FeeHandler recipient share must be 10000");
            recipients = new FeeHandler.FeeRecipient[](1);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
        } else if (r3 == address(0)) {
            require(r1Share + r2Share == BPS_DENOMINATOR,
                "DeployCoreMarket: two FeeHandler recipient shares must sum to 10000");
            recipients = new FeeHandler.FeeRecipient[](2);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
            recipients[1] = FeeHandler.FeeRecipient({account: r2, shareBps: r2Share});
        } else {
            require(r1Share + r2Share + r3Share == BPS_DENOMINATOR,
                "DeployCoreMarket: three FeeHandler recipient shares must sum to 10000");
            recipients = new FeeHandler.FeeRecipient[](3);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
            recipients[1] = FeeHandler.FeeRecipient({account: r2, shareBps: r2Share});
            recipients[2] = FeeHandler.FeeRecipient({account: r3, shareBps: r3Share});
        }
    }
}

/// @notice Read-only verification — no broadcast.
///         Prints MarketMaker and Trading configuration for an already-deployed pair.
contract VerifyCoreMarket is Script {
    function run() external view {
        address mmAddr      = vm.envAddress("MARKET_MAKER_ADDRESS");
        address tradingAddr = vm.envAddress("TRADING_ADDRESS");

        MarketMaker marketMaker = MarketMaker(mmAddr);
        Trading     trading     = Trading(tradingAddr);

        console.log("--- CoreMarket Verification ---");
        console.log("MarketMaker          :", mmAddr);
        console.log("  owner              :", marketMaker.owner());
        console.log("  collateral         :", address(marketMaker.collateral()));
        console.log("  market count       :", marketMaker.marketCount());
        console.log("Trading              :", tradingAddr);
        console.log("  owner              :", trading.owner());
        console.log("  marketMaker        :", address(trading.marketMaker()));
        console.log("  collateral         :", address(trading.collateral()));
        console.log("  feeBps             :", trading.feeBps());
        console.log("  rebateBps          :", trading.rebateBps());
        console.log("  commissionBps      :", trading.commissionBps());
        console.log("  commissionRecipient:", trading.commissionRecipient());
        console.log("Chain ID             :", block.chainid);
    }
}
