// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {VoteWeight} from "../contracts/VoteWeight.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployVoteWeight
/// @notice Deployment script for VoteWeight contract
contract DeployVoteWeight is Script {
    function run() external returns (VoteWeight voteWeight) {
        // Get governance token address from environment
        address governanceToken = vm.envAddress("GOVERNANCE_TOKEN");
        
        console.log("Deploying VoteWeight with governance token:", governanceToken);
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();
        
        // Deploy VoteWeight
        voteWeight = new VoteWeight(governanceToken);
        
        vm.stopBroadcast();

        console.log("VoteWeight deployed at:", address(voteWeight));
        console.log("Owner:", voteWeight.owner());
        
        return voteWeight;
    }
}

/// @title DeployVoteWeightWithSetup
/// @notice Deployment script with initial setup
contract DeployVoteWeightWithSetup is Script {
    function run() external returns (VoteWeight voteWeight) {
        address governanceToken = vm.envAddress("GOVERNANCE_TOKEN");
        
        console.log("Deploying VoteWeight with initial setup...");
        console.log("Governance token:", governanceToken);

        vm.startBroadcast();
        
        // Deploy VoteWeight
        voteWeight = new VoteWeight(governanceToken);
        
        console.log("VoteWeight deployed at:", address(voteWeight));
        
        // Create initial snapshot
        uint256 snapshotId = voteWeight.createSnapshot();
        console.log("Initial snapshot created with ID:", snapshotId);
        
        vm.stopBroadcast();

        console.log("Deployment complete!");
        console.log("Owner:", voteWeight.owner());
        console.log("Total voting weight:", voteWeight.getTotalVotingWeight());
        
        return voteWeight;
    }
}

/// @title VerifyVoteWeight
/// @notice Verification script for deployed VoteWeight
contract VerifyVoteWeight is Script {
    function run() external view {
        address voteWeightAddress = vm.envAddress("VOTEWEIGHT_ADDRESS");
        VoteWeight voteWeight = VoteWeight(voteWeightAddress);
        
        console.log("=== VoteWeight Verification ===");
        console.log("Contract address:", voteWeightAddress);
        console.log("Governance token:", address(voteWeight.governanceToken()));
        console.log("Owner:", voteWeight.owner());
        console.log("Total voting weight:", voteWeight.getTotalVotingWeight());
        console.log("Tracked accounts:", voteWeight.getTrackedAccountCount());
        console.log("Current snapshot ID:", voteWeight.currentSnapshotId());
        console.log("=== Verification Complete ===");
    }
}
