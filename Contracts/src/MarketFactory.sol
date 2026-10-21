// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PositionToken} from "./PositionToken.sol";
import {PredictionMarket} from "./PredictionMarket.sol";

/// @title MarketFactory
/// @notice Deploys and registers prediction market instances.
contract MarketFactory {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroCollateralToken();
    error InvalidDeadline();
    error ZeroMinLiquidity();
    error EmptyMetadataURI();
    error ZeroPositionToken();
    error InvalidPositionToken();
    error DeploymentFailed();
    error MarketAlreadyExists();
    error InvalidRange();
    error UnsupportedCollateral();
    error InvalidCollateralToken();
    error NotOwner();
    error ZeroOwner();
    error MetadataURITooLong();
    error UnsupportedMetadataScheme();

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

    struct CollateralConfig {
        bool supported;
        uint8 decimals;
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
    event CollateralSupportUpdated(address indexed token, bool supported, uint8 decimals);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    uint256 public constant MAX_METADATA_URI_LENGTH = 2048;

    PositionToken public immutable positionToken;
    address public owner;

    /// @dev market address => MarketInfo
    mapping(address => MarketInfo) private _markets;

    /// @dev all registered market addresses
    address[] private _marketList;

    /// @dev protocol-approved collateral tokens and recorded decimals
    mapping(address => CollateralConfig) private _collateralConfig;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _positionToken) {
        if (_positionToken == address(0)) revert ZeroPositionToken();
        if (_positionToken.code.length == 0) revert InvalidPositionToken();
        positionToken = PositionToken(_positionToken);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -------------------------------------------------------------------------
    // Admin — collateral registry (SC-020 / #1288)
    // -------------------------------------------------------------------------

    /// @notice Approve or revoke a collateral token for market creation.
    /// @dev Requires runtime code, IERC20Metadata.decimals(), and IERC20 transfer/transferFrom
    ///      selectors that succeed as view-probed interface checks via staticcall where possible.
    function setSupportedCollateral(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert ZeroCollateralToken();

        if (!supported) {
            delete _collateralConfig[token];
            emit CollateralSupportUpdated(token, false, 0);
            return;
        }

        if (token.code.length == 0) revert InvalidCollateralToken();

        uint8 decimals = _readDecimals(token);
        _assertTransferInterface(token);

        _collateralConfig[token] = CollateralConfig({supported: true, decimals: decimals});
        emit CollateralSupportUpdated(token, true, decimals);
    }

    /// @notice Transfer factory ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroOwner();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }

    /// @notice Whether `token` is an approved collateral asset.
    function isSupportedCollateral(address token) external view returns (bool) {
        return _collateralConfig[token].supported;
    }

    /// @notice Recorded decimals for an approved collateral token (0 if unsupported).
    function collateralDecimals(address token) external view returns (uint8) {
        return _collateralConfig[token].decimals;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Create and deploy a new prediction market.
    /// @param collateralToken  Protocol-approved ERC20 used as collateral.
    /// @param resolutionDeadline  Unix timestamp strictly greater than block.timestamp.
    /// @param minLiquidity  Minimum liquidity required (must be > 0).
    /// @param metadataURI  Non-empty metadata URI string.
    /// @return market  Address of the deployed market contract.
    function createMarket(
        address collateralToken,
        uint256 resolutionDeadline,
        uint256 minLiquidity,
        string calldata metadataURI
    ) external returns (address market) {
        if (collateralToken == address(0)) revert ZeroCollateralToken();
        if (collateralToken.code.length == 0) revert InvalidCollateralToken();
        if (!_collateralConfig[collateralToken].supported) revert UnsupportedCollateral();
        if (resolutionDeadline <= block.timestamp) revert InvalidDeadline();
        if (minLiquidity == 0) revert ZeroMinLiquidity();
        _validateMetadataURI(metadataURI);

        bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.timestamp, _marketList.length));

        PredictionMarket deployedMarket = (new PredictionMarket){salt: salt}(
            address(this),
            address(positionToken),
            collateralToken,
            resolutionDeadline,
            minLiquidity,
            metadataURI
        );

        market = address(deployedMarket);

        if (market.code.length == 0) revert DeploymentFailed();

        _markets[market] = MarketInfo({
            creator: msg.sender,
            collateralToken: collateralToken,
            resolutionDeadline: resolutionDeadline,
            minLiquidity: minLiquidity,
            metadataURI: metadataURI,
            status: MarketStatus.OPEN
        });

        _marketList.push(market);

        positionToken.authorise(market);

        emit MarketCreated(market, msg.sender, collateralToken, resolutionDeadline);
    }

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

        bytes memory constructorArgs = abi.encode(
            address(this),
            address(positionToken),
            collateralToken,
            resolutionDeadline,
            minLiquidity,
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

    function getMarketCount() external view returns (uint256) {
        return _marketList.length;
    }

    /// @dev WARNING: unbounded; prefer paginated `getMarkets(uint256,uint256)`.
    function getMarkets() external view returns (address[] memory) {
        return _marketList;
    }

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

    function getMarketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    function isRegisteredMarket(address market) external view returns (bool) {
        return _markets[market].creator != address(0);
    }

    function marketCount() external view returns (uint256) {
        return _marketList.length;
    }

    function marketAt(uint256 index) external view returns (address) {
        return _marketList[index];
    }

    function getCreator(address market) external view returns (address) {
        return _markets[market].creator;
    }

    function getMarketInfo(address market) external view returns (MarketInfo memory) {
        return _markets[market];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------


    function _validateMetadataURI(string calldata metadataURI) internal pure {
        bytes memory uri = bytes(metadataURI);
        uint256 len = uri.length;
        if (len == 0) revert EmptyMetadataURI();
        if (len > MAX_METADATA_URI_LENGTH) revert MetadataURITooLong();

        if (_hasPrefix(uri, "ipfs://") || _hasPrefix(uri, "https://") || _hasPrefix(uri, "ar://")) {
            return;
        }
        revert UnsupportedMetadataScheme();
    }

    function _hasPrefix(bytes memory data, string memory prefix) internal pure returns (bool) {
        bytes memory p = bytes(prefix);
        if (data.length < p.length) return false;
        for (uint256 i = 0; i < p.length; ++i) {
            if (data[i] != p[i]) return false;
        }
        return true;
    }

    bytes4 private constant _SELECTOR_DECIMALS = bytes4(keccak256("decimals()"));
    bytes4 private constant _SELECTOR_TOTAL_SUPPLY = bytes4(keccak256("totalSupply()"));
    bytes4 private constant _SELECTOR_TRANSFER = bytes4(keccak256("transfer(address,uint256)"));
    bytes4 private constant _SELECTOR_TRANSFER_FROM = bytes4(keccak256("transferFrom(address,address,uint256)"));

    function _readDecimals(address token) internal view returns (uint8 decimals) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSelector(_SELECTOR_DECIMALS));
        if (!ok || data.length < 32) revert InvalidCollateralToken();
        decimals = abi.decode(data, (uint8));
        if (decimals == 0 || decimals > 18) revert InvalidCollateralToken();
    }

    /// @dev Confirm ERC20 transfer surface: `totalSupply` responds and `transfer` /
    ///      `transferFrom` selectors exist in runtime bytecode (rejects EOAs / non-tokens).
    function _assertTransferInterface(address token) internal view {
        (bool ok,) = token.staticcall(abi.encodeWithSelector(_SELECTOR_TOTAL_SUPPLY));
        if (!ok) revert InvalidCollateralToken();

        if (!_bytecodeHasSelector(token, _SELECTOR_TRANSFER)) revert InvalidCollateralToken();
        if (!_bytecodeHasSelector(token, _SELECTOR_TRANSFER_FROM)) revert InvalidCollateralToken();
    }

    function _bytecodeHasSelector(address token, bytes4 selector) internal view returns (bool) {
        bytes memory code = token.code;
        uint256 length = code.length;
        if (length < 4) return false;
        for (uint256 i = 0; i + 4 <= length; ++i) {
            if (
                code[i] == selector[0] && code[i + 1] == selector[1] && code[i + 2] == selector[2]
                    && code[i + 3] == selector[3]
            ) {
                return true;
            }
        }
        return false;
    }
}
