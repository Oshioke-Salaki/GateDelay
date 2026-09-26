// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FeeHandler.sol";

/// @notice Deploy FeeHandler and optionally configure an initial fee structure,
///         then write a JSON artifact.
///
/// # Minimal deploy (no fee structure)
///   forge script script/DeployFeeHandler.s.sol:DeployFeeHandler \
///     --rpc-url $RPC_URL --broadcast --sig "run()"
///
/// # Deploy + configure a TRADING fee structure in one broadcast
///   forge script script/DeployFeeHandler.s.sol:DeployFeeHandlerWithSetup \
///     --rpc-url $RPC_URL --broadcast
///
/// # Read-only verification
///   forge script script/DeployFeeHandler.s.sol:VerifyFeeHandler \
///     --rpc-url $RPC_URL --sig "run()"
///
/// # Required env vars
///   PRIVATE_KEY                 – deployer private key (hex, 0x-prefixed)
///
/// # Optional env vars (DeployFeeHandlerWithSetup)
///   FEE_STRUCTURE_ID            – keccak256 label string, e.g. "TRADING" (default: "TRADING")
///   FEE_BPS                     – fee in basis points, max 1000 (default: 30)
///   FEE_RECIPIENT_1             – address of first fee recipient
///   FEE_RECIPIENT_1_SHARE_BPS   – share in bps for recipient 1 (must total 10000 with others)
///   FEE_RECIPIENT_2             – address of second fee recipient (optional)
///   FEE_RECIPIENT_2_SHARE_BPS   – share in bps for recipient 2 (optional)
///   FEE_RECIPIENT_3             – address of third fee recipient (optional)
///   FEE_RECIPIENT_3_SHARE_BPS   – share in bps for recipient 3 (optional)
///
/// # Verification env vars
///   FEE_HANDLER_ADDRESS         – deployed FeeHandler to verify
///   FEE_STRUCTURE_ID            – structure label to inspect (default: "TRADING")
contract DeployFeeHandler is Script {
    function run() external returns (FeeHandler feeHandler) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        feeHandler = new FeeHandler();
        vm.stopBroadcast();

        console.log("--- FeeHandler Deployment ---");
        console.log("Address  :", address(feeHandler));
        console.log("Owner    :", deployer);
        console.log("Chain ID :", block.chainid);

        _writeArtifact(address(feeHandler), deployer, bytes32(0), 0, 0);
    }

    function _writeArtifact(
        address feeHandler,
        address owner,
        bytes32 structureId,
        uint256 feeBps,
        uint256 recipientCount
    ) internal {
        string memory structureSection = structureId == bytes32(0)
            ? "null"
            : string.concat(
                '{"id":"',            vm.toString(structureId), '"',
                ',"feeBps":',         vm.toString(feeBps),
                ',"recipientCount":', vm.toString(recipientCount),
                '}'
              );

        string memory json = string.concat(
            '{"contractName":"FeeHandler"',
            ',"address":"',         vm.toString(feeHandler), '"',
            ',"owner":"',           vm.toString(owner),      '"',
            ',"chainId":',          vm.toString(block.chainid),
            ',"initialStructure":', structureSection,
            '}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/FeeHandler.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact :", path);
    }
}

/// @notice Extended deploy: deploys FeeHandler and configures an initial fee
///         structure (up to 3 recipients) inside the same broadcast.
///
///         Shares across recipients must sum to exactly 10 000 bps.
///         If only FEE_RECIPIENT_1 is provided its share must be 10 000.
///         If FEE_RECIPIENT_2 is also provided the two shares must sum to 10 000.
///         If all three are provided all three shares must sum to 10 000.
contract DeployFeeHandlerWithSetup is Script {
    uint256 constant BPS_DENOMINATOR = 10_000;

    function run() external returns (FeeHandler feeHandler) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // ── Read fee structure config from env ────────────────────────────────
        string memory structureLabel = vm.envOr("FEE_STRUCTURE_ID", string("TRADING"));
        bytes32 structureId = keccak256(bytes(structureLabel));

        uint256 feeBps = vm.envOr("FEE_BPS", uint256(30));
        require(feeBps <= 1_000, "DeployFeeHandler: FEE_BPS exceeds 10% ceiling");

        address r1 = vm.envOr("FEE_RECIPIENT_1", address(0));
        uint256 r1Share = vm.envOr("FEE_RECIPIENT_1_SHARE_BPS", uint256(0));
        address r2 = vm.envOr("FEE_RECIPIENT_2", address(0));
        uint256 r2Share = vm.envOr("FEE_RECIPIENT_2_SHARE_BPS", uint256(0));
        address r3 = vm.envOr("FEE_RECIPIENT_3", address(0));
        uint256 r3Share = vm.envOr("FEE_RECIPIENT_3_SHARE_BPS", uint256(0));

        // ── Build recipient array ─────────────────────────────────────────────
        // If no recipient is specified, fall back to deployer taking 100 %
        FeeHandler.FeeRecipient[] memory recipients;

        if (r1 == address(0)) {
            // Default: deployer receives 100 % of fees
            recipients = new FeeHandler.FeeRecipient[](1);
            recipients[0] = FeeHandler.FeeRecipient({
                account:  deployer,
                shareBps: BPS_DENOMINATOR
            });
            console.log("No FEE_RECIPIENT_1 set; defaulting to deployer as sole recipient.");
        } else if (r2 == address(0)) {
            require(r1Share == BPS_DENOMINATOR, "DeployFeeHandler: single recipient share must be 10000");
            recipients = new FeeHandler.FeeRecipient[](1);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
        } else if (r3 == address(0)) {
            require(r1Share + r2Share == BPS_DENOMINATOR, "DeployFeeHandler: two-recipient shares must sum to 10000");
            recipients = new FeeHandler.FeeRecipient[](2);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
            recipients[1] = FeeHandler.FeeRecipient({account: r2, shareBps: r2Share});
        } else {
            require(r1Share + r2Share + r3Share == BPS_DENOMINATOR, "DeployFeeHandler: three-recipient shares must sum to 10000");
            recipients = new FeeHandler.FeeRecipient[](3);
            recipients[0] = FeeHandler.FeeRecipient({account: r1, shareBps: r1Share});
            recipients[1] = FeeHandler.FeeRecipient({account: r2, shareBps: r2Share});
            recipients[2] = FeeHandler.FeeRecipient({account: r3, shareBps: r3Share});
        }

        // ── Broadcast ─────────────────────────────────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        feeHandler = new FeeHandler();
        feeHandler.setFeeStructure(structureId, feeBps, recipients);

        vm.stopBroadcast();

        // ── Logging ───────────────────────────────────────────────────────────
        console.log("--- FeeHandler Deployment (with setup) ---");
        console.log("Address          :", address(feeHandler));
        console.log("Owner            :", deployer);
        console.log("Chain ID         :", block.chainid);
        console.log("Structure label  :", structureLabel);
        console.log("Structure id     :", vm.toString(structureId));
        console.log("Fee (bps)        :", feeBps);
        console.log("Recipients       :", recipients.length);
        for (uint256 i; i < recipients.length; ++i) {
            console.log("  recipient[", i, "] :", recipients[i].account);
            console.log("  share (bps)  :", recipients[i].shareBps);
        }

        // ── Artifact ──────────────────────────────────────────────────────────
        string memory recipientsJson = "[";
        for (uint256 i; i < recipients.length; ++i) {
            if (i > 0) recipientsJson = string.concat(recipientsJson, ",");
            recipientsJson = string.concat(
                recipientsJson,
                '{"account":"',  vm.toString(recipients[i].account),   '"',
                ',"shareBps":',  vm.toString(recipients[i].shareBps),  '}'
            );
        }
        recipientsJson = string.concat(recipientsJson, "]");

        string memory json = string.concat(
            '{"contractName":"FeeHandler"',
            ',"address":"',          vm.toString(address(feeHandler)), '"',
            ',"owner":"',            vm.toString(deployer),            '"',
            ',"chainId":',           vm.toString(block.chainid),
            ',"initialStructure":{',
              '"label":"',           structureLabel,                   '"',
              ',"id":"',             vm.toString(structureId),         '"',
              ',"feeBps":',          vm.toString(feeBps),
              ',"recipients":',      recipientsJson,
            '}}'
        );
        string memory path = string.concat(
            "deployments/",
            vm.toString(block.chainid),
            "/FeeHandler.json"
        );
        vm.writeFile(path, json);
        console.log("Artifact         :", path);
    }
}

/// @notice Read-only verification — no broadcast.
///         Inspects an already-deployed FeeHandler for a given structure ID.
contract VerifyFeeHandler is Script {
    function run() external view {
        address addr = vm.envAddress("FEE_HANDLER_ADDRESS");
        string memory structureLabel = vm.envOr("FEE_STRUCTURE_ID", string("TRADING"));
        bytes32 structureId = keccak256(bytes(structureLabel));

        FeeHandler feeHandler = FeeHandler(addr);

        (uint256 feeBps, bool active, FeeHandler.FeeRecipient[] memory recipients) =
            feeHandler.getFeeStructure(structureId);

        console.log("--- FeeHandler Verification ---");
        console.log("Address         :", addr);
        console.log("Chain ID        :", block.chainid);
        console.log("Structure label :", structureLabel);
        console.log("Structure id    :", vm.toString(structureId));
        console.log("Fee (bps)       :", feeBps);
        console.log("Active          :", active);
        console.log("Recipients      :", recipients.length);
        for (uint256 i; i < recipients.length; ++i) {
            console.log("  recipient[", i, "]:", recipients[i].account);
            console.log("  share (bps) :", recipients[i].shareBps);
        }
    }
}
