// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PositionToken} from "./PositionToken.sol";
import {PredictionMarket} from "./PredictionMarket.sol";

interface IERC20Metadata {
    function decimals() external view returns (uint8);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Minimal interface to the canonical LMSR `MarketMaker` contract.
interface IMarketMakerCanonical {
    struct FactoryMarketParams {
        address factoryMarket;
        address creator;
        string description;
        uint256 numOutcomes;
        uint256 b;
        uint256 resolutionTime;
        address resolver;
        uint256 initialSubsidy;
        uint256 minLiquidity;
    }

    function collateral() external view returns (address);
    function requiredInitialSubsidy(uint256 numOutcomes, uint256 b) external view returns (uint256);
    function collateralScale() external view returns (uint256);
    function createFactoryMarket(FactoryMarketParams calldata params) external returns (uint256 marketId);
    function setMarketPaused(uint256 marketId, bool paused) external;
}

/// @title MarketFactory
/// @notice Deploys and registers prediction market instances and aligns them 1:1 with
///         the canonical LMSR `MarketMaker` numeric registry.
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
    error NotRegisteredMarket();
    error ZeroMarketMaker();
    error InvalidMarketMaker();
    error MarketMakerAlreadyLocked();
    error MarketMakerNotConfigured();
    error CollateralMismatch();
    error NotCanonicalMarketMaker();
    error MarketNotCanonical();
    error TransferFailed();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum MarketStatus {
        OPEN,
        PAUSED,
        RESOLVED,
        DISPUTED,
        CANCELLED
    }

    struct MarketInfo {
        address creator;
        address collateralToken;
        uint256 resolutionDeadline;
        uint256 minLiquidity;
        string metadataURI;
        MarketStatus status;
    }

    struct CanonicalLinkParams {
        address market;
        address collateralToken;
        uint256 resolutionDeadline;
        uint256 scaledMinLiquidity;
        uint256 numOutcomes;
        uint256 liquidityB;
        uint256 initialSubsidy;
        address resolver;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event MarketCreated(
        address indexed market, address indexed creator, address indexed collateralToken, uint256 resolutionDeadline
    );
    event MarketMakerConfigured(address indexed marketMaker, address indexed defaultResolver);
    event CanonicalMarketLinked(
        address indexed market,
        uint256 indexed marketId,
        uint256 numOutcomes,
        uint256 liquidityB,
        uint256 initialSubsidy,
        address indexed resolver
    );
    event MarketPaused(address indexed market);
    event MarketUnpaused(address indexed market);
    event MarketResolvedSynced(address indexed market, uint256 indexed marketId);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    PositionToken public immutable positionToken;
    address public immutable governance;

    /// @notice Canonical LMSR `MarketMaker` bound to this factory.
    address public marketMaker;

    /// @notice Default approved resolver passed when creating canonical markets without an explicit resolver.
    address public defaultResolver;

    /// @dev market address => MarketInfo
    mapping(address => MarketInfo) private _markets;

    /// @dev all registered market addresses
    address[] private _marketList;

    /// @dev Factory PredictionMarket address => canonical MarketMaker numeric ID
    mapping(address => uint256) private _marketToCanonicalId;

    /// @dev True if the factory market is paired 1:1 with a canonical MarketMaker market
    mapping(address => bool) private _hasCanonicalMarket;

    /// @dev Canonical MarketMaker numeric ID => factory PredictionMarket address
    mapping(uint256 => address) private _canonicalIdToMarket;

    /// @dev Number of factory markets bound 1:1 to `marketMaker`
    uint256 private _canonicalMarketCount;

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
    // Governance configuration
    // -------------------------------------------------------------------------

    /// @notice Bind this factory to the canonical LMSR `MarketMaker` and optional default resolver.
    /// @param _marketMaker Deployed `MarketMaker` contract address.
    /// @param _defaultResolver Optional default approved resolver address for canonical markets.
    /// @dev Access: Restricted to `governance`.
    function setMarketMaker(address _marketMaker, address _defaultResolver) external {
        if (msg.sender != governance) revert NotGovernance();
        if (_marketMaker == address(0)) revert ZeroMarketMaker();
        if (_marketMaker.code.length == 0) revert InvalidMarketMaker();
        if (marketMaker != address(0) && _marketMaker != marketMaker && _canonicalMarketCount > 0) {
            revert MarketMakerAlreadyLocked();
        }
        try IMarketMakerCanonical(_marketMaker).collateral() returns (address mmCollateral) {
            if (mmCollateral == address(0)) revert InvalidMarketMaker();
        } catch {
            revert InvalidMarketMaker();
        }

        marketMaker = _marketMaker;
        defaultResolver = _defaultResolver;
        emit MarketMakerConfigured(_marketMaker, _defaultResolver);
    }

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

    // -------------------------------------------------------------------------
    // Market creation
    // -------------------------------------------------------------------------

    /// @notice Create and deploy a new prediction market.
    /// @param collateralToken ERC20 token used as collateral (must be non-zero).
    /// @param resolutionDeadline Unix timestamp strictly greater than block.timestamp.
    /// @param minLiquidity Minimum liquidity required in whole tokens (must be > 0).
    /// @param metadataURI Non-empty metadata URI string.
    /// @return market Address of the deployed market contract.
    /// @dev When `marketMaker` is configured, this enforces collateral alignment and
    ///      atomically creates and binds a funded binary LMSR market in `MarketMaker`
    ///      so factory markets and canonical LMSR markets stay 1:1 aligned.
    function createMarket(
        address collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string calldata metadataURI
    ) external returns (address market) {
        if (collateralToken == address(0)) revert ZeroCollateralToken();
        if (marketMaker != address(0) && collateralToken != IMarketMakerCanonical(marketMaker).collateral()) {
            revert CollateralMismatch();
        }

        uint256 scaledMinLiquidity;
        (market, scaledMinLiquidity) =
            _deployAndRegisterMarket(collateralToken, resolutionDeadline, minLiquidity, metadataURI);

        if (marketMaker != address(0)) {
            // LMSR `b` is in WAD shares; scaledMinLiquidity is in collateral base units.
            uint256 liquidityB = scaledMinLiquidity * IMarketMakerCanonical(marketMaker).collateralScale();
            uint256 requiredSub = IMarketMakerCanonical(marketMaker).requiredInitialSubsidy(2, liquidityB);
            uint256 subsidy = requiredSub > scaledMinLiquidity ? requiredSub : scaledMinLiquidity;
            _linkCanonicalMarket(
                CanonicalLinkParams({
                    market: market,
                    collateralToken: collateralToken,
                    resolutionDeadline: resolutionDeadline,
                    scaledMinLiquidity: scaledMinLiquidity,
                    numOutcomes: 2,
                    liquidityB: liquidityB,
                    initialSubsidy: subsidy,
                    resolver: defaultResolver
                }),
                metadataURI
            );
        }
    }

    /// @notice Create and deploy a factory `PredictionMarket` explicitly paired 1:1 with a
    ///         funded, timed, resolver-gated canonical LMSR market in `MarketMaker`.
    /// @param resolutionDeadline Unix timestamp strictly greater than block.timestamp.
    /// @param minLiquidity Minimum liquidity required in whole tokens (scaled by collateral decimals).
    /// @param numOutcomes Number of LMSR outcomes (2 to `MarketMaker.MAX_OUTCOMES`, currently 64).
    /// @param liquidityB LMSR liquidity parameter `b` (WAD).
    /// @param initialSubsidy Initial collateral reserve collected from `msg.sender` (>= required LMSR subsidy).
    /// @param resolver Approved resolver address (or zero to fall back to `defaultResolver`).
    /// @param metadataURI Non-empty metadata URI string.
    /// @return market Address of the deployed `PredictionMarket`.
    /// @return marketId Canonical numeric market ID in `MarketMaker`.
    function createCanonicalMarket(
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        uint256 numOutcomes,
        uint256 liquidityB,
        uint256 initialSubsidy,
        address resolver,
        string calldata metadataURI
    ) external returns (address market, uint256 marketId) {
        if (marketMaker == address(0)) revert MarketMakerNotConfigured();

        address collateralToken = IMarketMakerCanonical(marketMaker).collateral();
        uint256 scaledMinLiquidity;
        (market, scaledMinLiquidity) =
            _deployAndRegisterMarket(collateralToken, resolutionDeadline, minLiquidity, metadataURI);

        marketId = _linkCanonicalMarket(
            CanonicalLinkParams({
                market: market,
                collateralToken: collateralToken,
                resolutionDeadline: resolutionDeadline,
                scaledMinLiquidity: scaledMinLiquidity,
                numOutcomes: numOutcomes,
                liquidityB: liquidityB,
                initialSubsidy: initialSubsidy,
                resolver: resolver == address(0) ? defaultResolver : resolver
            }),
            metadataURI
        );
    }

    // -------------------------------------------------------------------------
    // Lifecycle hooks (pause / unpause / canonical resolution sync)
    // -------------------------------------------------------------------------

    /// @notice Pause a registered market via the factory's privileged lifecycle hook.
    /// @param market Address of a factory-deployed market.
    /// @dev Access: Restricted to `governance`; reverts with `NotGovernance` otherwise.
    function pauseMarket(address market) external {
        if (msg.sender != governance) revert NotGovernance();
        if (_markets[market].creator == address(0)) revert NotRegisteredMarket();

        PredictionMarket(payable(market)).pause();
        if (_hasCanonicalMarket[market]) {
            IMarketMakerCanonical(marketMaker).setMarketPaused(_marketToCanonicalId[market], true);
        }
        _markets[market].status = MarketStatus.PAUSED;

        emit MarketPaused(market);
    }

    /// @notice Unpause a registered market via the factory's privileged lifecycle hook.
    /// @param market Address of a factory-deployed market.
    /// @dev Access: Restricted to `governance`; reverts with `NotGovernance` otherwise.
    function unpauseMarket(address market) external {
        if (msg.sender != governance) revert NotGovernance();
        if (_markets[market].creator == address(0)) revert NotRegisteredMarket();

        PredictionMarket(payable(market)).unpause();
        if (_hasCanonicalMarket[market]) {
            IMarketMakerCanonical(marketMaker).setMarketPaused(_marketToCanonicalId[market], false);
        }
        _markets[market].status = MarketStatus.OPEN;

        emit MarketUnpaused(market);
    }

    /// @notice Synchronize a factory market's status to `RESOLVED` when resolved in `MarketMaker`.
    /// @param market Address of the factory-deployed `PredictionMarket`.
    /// @dev Access: Restricted exclusively to the bound `marketMaker`.
    function syncMarketResolved(address market) external {
        if (marketMaker == address(0) || msg.sender != marketMaker) revert NotCanonicalMarketMaker();
        if (!_hasCanonicalMarket[market]) revert MarketNotCanonical();

        _markets[market].status = MarketStatus.RESOLVED;
        emit MarketResolvedSynced(market, _marketToCanonicalId[market]);
    }

    // -------------------------------------------------------------------------
    // Deterministic address prediction & registry views
    // -------------------------------------------------------------------------

    /// @notice Compute the deterministic address for a market without deploying.
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

        bytes memory constructorArgs = abi.encode(
            address(this),
            address(positionToken),
            collateralToken,
            resolutionDeadline,
            scaledMinLiquidity,
            metadataURI
        );

        bytes32 initCodeHash = keccak256(abi.encodePacked(type(PredictionMarket).creationCode, constructorArgs));

        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash))))
        );
    }

    /// @notice Return the canonical `MarketMaker` numeric market ID for a factory market.
    function getCanonicalMarketId(address market) external view returns (uint256) {
        if (!_hasCanonicalMarket[market]) revert MarketNotCanonical();
        return _marketToCanonicalId[market];
    }

    /// @notice Report whether `market` is linked to a canonical LMSR market in `MarketMaker`.
    function hasCanonicalMarket(address market) external view returns (bool) {
        return _hasCanonicalMarket[market];
    }

    /// @notice Return the factory `PredictionMarket` address paired with `marketId` (or zero if unlinked).
    function getFactoryMarket(uint256 marketId) external view returns (address) {
        return _canonicalIdToMarket[marketId];
    }

    /// @notice Returns the number of registered markets.
    function getMarketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @notice Returns all registered market addresses.
    function getMarkets() external view returns (address[] memory) {
        return _marketList;
    }

    /// @notice Returns a bounded page of registered market addresses.
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
    function getMarketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    /// @notice Returns whether an address is a registered market.
    function isRegisteredMarket(address market) external view returns (bool) {
        return _markets[market].creator != address(0);
    }

    /// @notice Returns total market count.
    function marketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @notice Returns a registered market address by index.
    function marketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    /// @notice Returns the creator of a registered market, or address(0) if unregistered.
    function getCreator(address market) external view returns (address) {
        return _markets[market].creator;
    }

    /// @notice Returns the full MarketInfo for a registered market.
    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        return _markets[market];
    }

    // -------------------------------------------------------------------------
    // Internal functions
    // -------------------------------------------------------------------------

    function _deployAndRegisterMarket(
        address collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string calldata metadataURI
    ) internal returns (address market, uint256 scaledMinLiquidity) {
        if (collateralToken == address(0)) revert ZeroCollateralToken();
        if (resolutionDeadline <= block.timestamp) revert InvalidDeadline();
        if (minLiquidity == 0) revert ZeroMinLiquidity();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();

        scaledMinLiquidity = _scaleMinLiquidity(collateralToken, minLiquidity);

        bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.timestamp, _marketList.length));

        PredictionMarket deployedMarket = (new PredictionMarket){salt: salt}(
            address(this),
            address(positionToken),
            collateralToken,
            resolutionDeadline,
            scaledMinLiquidity,
            metadataURI
        );

        market = address(deployedMarket);
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
        positionToken.authorise(market);

        emit MarketCreated(market, msg.sender, collateralToken, resolutionDeadline);
    }

    function _linkCanonicalMarket(CanonicalLinkParams memory params, string calldata metadataURI)
        internal
        returns (uint256 marketId)
    {
        bool pulled = IERC20Metadata(params.collateralToken).transferFrom(msg.sender, address(this), params.initialSubsidy);
        if (!pulled) revert TransferFailed();

        bool approved = IERC20Metadata(params.collateralToken).approve(marketMaker, params.initialSubsidy);
        if (!approved) revert TransferFailed();

        IMarketMakerCanonical.FactoryMarketParams memory mmParams = IMarketMakerCanonical.FactoryMarketParams({
            factoryMarket: params.market,
            creator: msg.sender,
            description: metadataURI,
            numOutcomes: params.numOutcomes,
            b: params.liquidityB,
            resolutionTime: params.resolutionDeadline,
            resolver: params.resolver,
            initialSubsidy: params.initialSubsidy,
            minLiquidity: params.scaledMinLiquidity
        });
        marketId = IMarketMakerCanonical(marketMaker).createFactoryMarket(mmParams);

        PredictionMarket(payable(params.market)).bindCanonicalMarket(marketMaker, marketId);

        _marketToCanonicalId[params.market] = marketId;
        _hasCanonicalMarket[params.market] = true;
        _canonicalIdToMarket[marketId] = params.market;
        _canonicalMarketCount += 1;

        emit CanonicalMarketLinked(
            params.market,
            marketId,
            params.numOutcomes,
            params.liquidityB,
            params.initialSubsidy,
            params.resolver
        );
    }

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
