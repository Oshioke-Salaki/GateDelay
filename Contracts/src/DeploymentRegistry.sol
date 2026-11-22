// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title DeploymentRegistry
/// @notice Builds the JSON registry of deployed addresses consumed by the backend and frontend.
///         The deploy script writes this document; it is not checked in.
library DeploymentRegistry {
    struct Entry {
        string name;
        address deployed;
        uint256 chainId;
        string abiVersion;
    }

    error EmptyName();
    error ZeroAddress();
    error EmptyAbiVersion();

    /// @notice Encode `entries` as `{"contracts":[{name,address,chainId,abiVersion},...]}`.
    function encode(Entry[] memory entries) internal pure returns (string memory) {
        string memory body;
        for (uint256 i; i < entries.length; ++i) {
            if (bytes(entries[i].name).length == 0) revert EmptyName();
            if (entries[i].deployed == address(0)) revert ZeroAddress();
            if (bytes(entries[i].abiVersion).length == 0) revert EmptyAbiVersion();

            if (i > 0) body = string.concat(body, ",");
            body = string.concat(
                body,
                '{"name":"',
                entries[i].name,
                '","address":"',
                Strings.toHexString(uint160(entries[i].deployed), 20),
                '","chainId":',
                Strings.toString(entries[i].chainId),
                ',"abiVersion":"',
                entries[i].abiVersion,
                '"}'
            );
        }
        return string.concat('{"contracts":[', body, "]}");
    }
}
