// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PositionToken} from "./PositionToken.sol";
import {PredictionMarket} from "./PredictionMarket.sol";

interface IERC20Metadata {
    function decimals() external view returns (uint8);
}

/// @title MarketFactory
/// @notice Deploys and registers prediction market instances.
contract MarketFactory {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error NotGovernance();
    error ZeroCollateralToken();
    error InvalidDeadline();
    error ZeroMinLiquidity();
    error EmptyMetadataURI();
    error ZeroPositionToken();
    error InvalidPositionToken();
    error DeploymentFailed();
    error MarketAlreadyExists();
    error InvalidRange();
    error UnsupportedCollateralDecimals();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarketStatus { OPEN, PAUSED, RESOLVED, DISPUTED, CANCELLED }

    struct MarketInfo {
        address creator;
        address collateralToken;
        uint256 resolutionDeadline;
        uint256 minLiquidity;
        string metadataURI;
        MarketStatus status;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketCreated(
        address indexed market,
        address indexed creator,
        address indexed collateralToken,
        uint256 resolutionDeadline
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;
    address public immutable governance;

    /// @dev market address => MarketInfo
    mapping(address => MarketInfo) private _markets;

    /// @dev all registered market addresses
    address[] private _marketList;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _positionToken) {
        if (_positionToken == address(0)) revert ZeroPositionToken();
        if (_positionToken.code.length == 0) revert InvalidPositionToken();
        positionToken = PositionToken(_positionToken);
        governance = msg.sender;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Manage independent token privileges without changing existing balances.
    function setMinterPermission(address actor, address market, bool enabled) external {
        if (msg.sender != governance) revert NotGovernance();
        if (enabled) positionToken.authoriseMinter(actor, market);
        else positionToken.revokeMinter(actor);
    }
    function setBurnerPermission(address actor, bool enabled) external {
        if (msg.sender != governance) revert NotGovernance();
        if (enabled) positionToken.authoriseBurner(actor);
        else positionToken.revokeBurner(actor);
    }
    function setGlobalSettlementPermission(address actor, bool enabled) external {
        if (msg.sender != governance) revert NotGovernance();
        if (enabled) positionToken.authoriseGlobalSettlement(actor);
        else positionToken.revokeGlobalSettlement(actor);
    }

    /// @notice Create and deploy a new prediction market.
    /// @param collateralToken  ERC20 token used as collateral (must be non-zero).
    /// @param resolutionDeadline  Unix timestamp strictly greater than block.timestamp.
    /// @param minLiquidity  Minimum liquidity required (must be > 0).
    /// @param metadataURI  Non-empty metadata URI string.
    /// @return market  Address of the deployed market contract.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `ZeroCollateralToken` if `collateralToken == address(0)` is true.
    ///     `InvalidDeadline` if `resolutionDeadline <= block.timestamp` is true. `ZeroMinLiquidity`
    ///     if `minLiquidity == 0` is true. `EmptyMetadataURI` if `bytes(metadataURI).length == 0`
    ///     is true. `MarketAlreadyExists` if market already deployed at deterministic address.
    ///     `DeploymentFailed` if contract deployment fails.
    function createMarket(
        address collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string calldata metadataURI
    ) external returns (address market) {
        if (collateralToken == address(0)) revert ZeroCollateralToken();
        if (resolutionDeadline <= block.timestamp) revert InvalidDeadline();
        if (minLiquidity == 0) revert ZeroMinLiquidity();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();

        // Scale the minimum liquidity by the collateral token's actual precision
        // instead of assuming six decimals.
        uint256 scaledMinLiquidity = _scaleMinLiquidity(collateralToken, minLiquidity);

        // Generate a unique salt per market creation
        // Using msg.sender, block.timestamp, and market count for uniqueness
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.timestamp, _marketList.length));

        // Deploy the market contract using CREATE2 with the salt
        // The constructor arguments ensure the deployment is deterministic
        PredictionMarket deployedMarket = (new PredictionMarket){salt: salt}(
            address(this),
            address(positionToken),
            collateralToken,
            resolutionDeadline,
            scaledMinLiquidity,
            metadataURI
        );
        
        market = address(deployedMarket);

        // Verify deployment succeeded
        if (market.code.length == 0) revert DeploymentFailed();

        _markets[market] = MarketInfo({
            creator: msg.sender,
            collateralToken: collateralToken,
            resolutionDeadline: resolutionDeadline,
            minLiquidity: scaledMinLiquidity,
            metadataURI: metadataURI,
            status: MarketStatus.OPEN
        });

        _marketList.push(market);

        // Authorise the new market address to mint/burn position tokens
        positionToken.authorise(market);

        emit MarketCreated(market, msg.sender, collateralToken, resolutionDeadline);
    }

    /// @notice Compute the deterministic address for a market without deploying.
    /// @param creator The creator address.
    /// @param timestamp The block timestamp.
    /// @param index The market index in the factory.
    /// @param collateralToken The collateral token address.
    /// @param resolutionDeadline The resolution deadline.
    /// @param minLiquidity The minimum liquidity.
    /// @param metadataURI The metadata URI.
    /// @return The predicted market address.
    /// @dev Access: No caller-specific access restriction is imposed.
    function computeMarketAddress(
        address creator,
        uint256 timestamp,
        uint256 index,
        address collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string calldata metadataURI
    ) external view returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(creator, timestamp, index));

        // Mirror createMarket's scaling so predicted addresses match deployment.
        uint256 scaledMinLiquidity = _scaleMinLiquidity(collateralToken, minLiquidity);

        // The deployment code is creationCode + abi.encode(arguments)
        bytes memory constructorArgs = abi.encode(
            address(this),
            address(positionToken),
            collateralToken,
            resolutionDeadline,
            scaledMinLiquidity,
            metadataURI
        );
        
        bytes32 initCodeHash = keccak256(abi.encodePacked(
            type(PredictionMarket).creationCode,
            constructorArgs
        ));
        
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            initCodeHash
        )))));
    }

    /// @notice Returns the number of registered markets.
    /// @return Market count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @notice Returns all registered market addresses.
    /// @return Markets returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev WARNING: This returns the entire, ever-growing registry and may exceed RPC
    ///     response or call-gas limits. Integrations should prefer the paginated
    ///     `getMarkets(uint256,uint256)` variant together with `getMarketCount()` /
    ///     `marketCount()` to traverse the registry in bounded pages without omissions
    ///     or duplicates. Kept for backward compatibility.
    function getMarkets() external view returns (address[] memory) {
        return _marketList;
    }

    /// @notice Returns a bounded page of registered market addresses.
    /// @param offset Starting index into the registry (0-based).
    /// @param count Maximum number of addresses to return.
    /// @return page Market addresses in `[offset, min(offset + count, length))`.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `InvalidRange` if `offset > _marketList.length`. Returns an empty
    ///     array when `offset == _marketList.length` or `count == 0`. The end index is
    ///     clamped to the registry length, so pages never revert on the tail.
    ///     Clients should iterate with `offset += page.length` until `offset` reaches
    ///     `getMarketCount()` to enumerate all markets without omissions or duplicates.
    function getMarkets(uint256 offset, uint256 count) external view returns (address[] memory page) {
        uint256 length = _marketList.length;
        if (offset > length) revert InvalidRange();

        uint256 end = offset + count;
        if (end > length) {
            end = length;
        }

        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = _marketList[i];
        }
    }

    /// @notice Returns a registered market address by index.
    /// @param index Numeric index used by this operation.
    /// @return Market at returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    /// @notice Returns whether an address is a registered market.
    /// @param market Market address associated with this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isRegisteredMarket(address market) external view returns (bool) {
        return _markets[market].creator != address(0);
    }

    /// @notice Executes marketCount.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function marketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @notice Returns a registered market address by index.
    /// @param index Numeric index used by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function marketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    /// @notice Returns the creator of a registered market, or address(0) if unregistered.
    /// @param market Market address associated with this operation.
    /// @return Creator returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getCreator(address market) external view returns (address) {
        return _markets[market].creator;
    }

    /// @notice Returns the full MarketInfo for a registered market.
    /// @param market Market address associated with this operation.
    /// @return Market info returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        return _markets[market];
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    /// @dev Scales `minLiquidity` by 10**decimals of the collateral token.
    ///      Reverts with `UnsupportedCollateralDecimals` if the token does not
    ///      expose `decimals()` or reports an out-of-range value.
    function _scaleMinLiquidity(address collateralToken, uint256 minLiquidity) internal view returns (uint256) {
        uint8 decimals;
        try IERC20Metadata(collateralToken).decimals() returns (uint8 d) {
            decimals = d;
        } catch {
            revert UnsupportedCollateralDecimals();
        }
        if (decimals > 77) revert UnsupportedCollateralDecimals();
        return minLiquidity * (10 ** uint256(decimals));
    }
}