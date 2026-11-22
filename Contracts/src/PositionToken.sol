// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// @title PositionToken
/// @notice ERC1155 token tracking YES/NO positions across all prediction markets.
///         Position IDs encode market address + outcome using two reserved low bits:
///           YES id = (uint256(uint160(market)) << 2) | 0
///           NO  id = (uint256(uint160(market)) << 2) | 1
///         The outcome occupies the two lowest bits, so the market address is shifted
///         clear of the outcome encoding and distinct market/outcome pairs always map
///         to distinct ids (e.g. markets 2 and 3 no longer collide on NO).
/// @dev Compatibility: this is a breaking change to the id encoding. Ids minted under
///      the previous `(market << 1) | {1,2}` scheme are not valid under the new scheme
///      and must be migrated (burn old ids / re-mint under the new encoding) or handled
///      via a versioned encoding before upgrading a live deployment.
contract PositionToken {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error UnauthorisedMinter();
    error UnauthorisedBurner();
    error ArrayLengthMismatch();
    error InsufficientBalance();
    error NotFactory();
    error InvalidTokenId();

    // -------------------------------------------------------------------------
    // Events (ERC1155)
    // -------------------------------------------------------------------------
    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);

    // -------------------------------------------------------------------------
    // Events (authorisation)
    // -------------------------------------------------------------------------
    event MinterAuthorised(address indexed minter, address indexed market);
    event BurnerAuthorised(address indexed burner);
    event MinterRevoked(address indexed minter, address indexed market);
    event BurnerRevoked(address indexed burner);
    event GlobalSettlementRevoked(address indexed settlement);
    event GlobalSettlementAuthorised(address indexed settlement);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    address public immutable factory;

    /// @dev ERC1155 balances: account => id => balance
    mapping(address => mapping(uint256 => uint256)) private _balances;

    /// @dev ERC1155 operator approvals: account => operator => approved
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /// @dev Total supply per token id
    mapping(uint256 => uint256) private _totalSupply;

    /// @dev Authorised minters: minter => market namespace it may mint for
    mapping(address => address) private _authorisedMinters;

    /// @dev Authorised burners (e.g. resolution/settlement contracts)
    mapping(address => bool) private _authorisedBurners;

    /// @dev Global settlement actors permitted to mint across all markets
    mapping(address => bool) private _globalSettlement;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _factory) {
        if (_factory == address(0)) revert ZeroAddress();
        factory = _factory;
    }

    // -------------------------------------------------------------------------
    // Position ID helpers
    // -------------------------------------------------------------------------
    /// @notice Computes the YES position token id for a market.
    /// @param market Market address associated with this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function yesId(address market) public pure returns (uint256) {
        return (uint256(uint160(market)) << 2) | 0;
    }

    /// @notice Computes the NO position token id for a market.
    /// @param market Market address associated with this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function noId(address market) public pure returns (uint256) {
        return (uint256(uint160(market)) << 2) | 1;
    }

    // -------------------------------------------------------------------------
    // Factory-only authorisation
    // -------------------------------------------------------------------------
    /// @notice Executes authorise.
    /// @param market Market address associated with this operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotFactory` if `msg.sender != factory` is true.
    function authorise(address market) external {
        if (msg.sender != factory) revert NotFactory();
        if (market == address(0)) revert ZeroAddress();
        _authorisedMinters[market] = market;
        emit MinterAuthorised(market, market);
    }

    /// @notice Authorise an address to mint only within a given market's namespace.
    ///         Only callable by the factory.
    /// @param minter Address granted mint permission.
    /// @param market Market whose token ids the minter may mint.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotFactory` if `msg.sender != factory` is true. `ZeroAddress` if `minter` or
    ///     `market` is the zero address.
    function authoriseMinter(address minter, address market) external {
        if (msg.sender != factory) revert NotFactory();
        if (minter == address(0) || market == address(0)) revert ZeroAddress();
        _authorisedMinters[minter] = market;
        emit MinterAuthorised(minter, market);
    }

    /// @notice Authorise an address (e.g. Resolution contract) to burn tokens.
    ///         Only callable by the factory. Grants burn permission only.
    /// @param burner Address associated with burner.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotFactory` if `msg.sender != factory` is true. `ZeroAddress` if `burner` is
    ///     the zero address.
    function authoriseBurner(address burner) external {
        if (msg.sender != factory) revert NotFactory();
        if (burner == address(0)) revert ZeroAddress();
        _authorisedBurners[burner] = true;
        emit BurnerAuthorised(burner);
    }

    /// @notice Authorise a global settlement actor permitted to mint across all markets.
    ///         Only callable by the factory.
    /// @param settlement Address granted global mint permission.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotFactory` if `msg.sender != factory` is true. `ZeroAddress` if `settlement`
    ///     is the zero address.
    function authoriseGlobalSettlement(address settlement) external {
        if (msg.sender != factory) revert NotFactory();
        if (settlement == address(0)) revert ZeroAddress();
        _globalSettlement[settlement] = true;
        emit GlobalSettlementAuthorised(settlement);
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------
    /// @notice Revoke namespace minting only. Existing balances and transfers remain valid.
    /// @dev Burn and global settlement permissions are independent and must be revoked separately.
    function revokeMinter(address minter) external {
        if (msg.sender != factory) revert NotFactory();
        if (minter == address(0)) revert ZeroAddress();
        address market = _authorisedMinters[minter];
        delete _authorisedMinters[minter];
        emit MinterRevoked(minter, market);
    }

    /// @notice Revoke third-party burning; holders and other approved settlement actors retain their rights.
    function revokeBurner(address burner) external {
        if (msg.sender != factory) revert NotFactory();
        if (burner == address(0)) revert ZeroAddress();
        delete _authorisedBurners[burner];
        emit BurnerRevoked(burner);
    }

    /// @notice Revoke global minting. Any separately granted namespace permission remains valid.
    function revokeGlobalSettlement(address settlement) external {
        if (msg.sender != factory) revert NotFactory();
        if (settlement == address(0)) revert ZeroAddress();
        delete _globalSettlement[settlement];
        emit GlobalSettlementRevoked(settlement);
    }

    function isAuthorised(address market) external view returns (bool) {
        return _authorisedMinters[market] == market;
    }

    /// @notice Reports whether `minter` may mint for `market`.
    /// @param minter Address to query.
    /// @param market Market namespace to query.
    /// @return True when the minter is bound to the market or is a global settlement actor.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isAuthorisedMinter(address minter, address market) external view returns (bool) {
        return _globalSettlement[minter] || _authorisedMinters[minter] == market;
    }

    /// @notice Reports whether `burner` holds burn permission.
    /// @param burner Address to query.
    /// @return True when the address is an authorised burner.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isAuthorisedBurner(address burner) external view returns (bool) {
        return _authorisedBurners[burner];
    }

    /// @notice Reports whether `settlement` holds global mint permission.
    /// @param settlement Address to query.
    /// @return True when the address is a global settlement actor.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isGlobalSettlement(address settlement) external view returns (bool) {
        return _globalSettlement[settlement];
    }

    /// @notice Executes totalSupply.
    /// @param id Numeric id used by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupply[id];
    }

    // -------------------------------------------------------------------------
    // ERC1155 view functions
    // -------------------------------------------------------------------------
    /// @notice Executes balanceOf.
    /// @param account Account address affected by this operation.
    /// @param id Numeric id used by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        return _balances[account][id];
    }

    /// @notice Executes balanceOfBatch.
    /// @param accounts Address associated with accounts.
    /// @param ids Numeric ids used by this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `ArrayLengthMismatch` if `accounts.length != ids.length` is true.
    function balanceOfBatch(
        address[] calldata accounts,
        uint256[] calldata ids
    ) external view returns (uint256[] memory) {
        if (accounts.length != ids.length) revert ArrayLengthMismatch();
        uint256[] memory batchBalances = new uint256[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            batchBalances[i] = _balances[accounts[i]][ids[i]];
        }
        return batchBalances;
    }

    /// @notice Reports whether approved for all is satisfied.
    /// @param account Account address affected by this operation.
    /// @param operator Address associated with operator.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    /// @notice Executes setApprovalForAll.
    /// @param operator Address associated with operator.
    /// @param approved Whether approved is enabled or selected.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    // -------------------------------------------------------------------------
    // ERC1155 transfer functions
    // -------------------------------------------------------------------------
    /// @notice Executes safeTransferFrom.
    /// @param from Source address for the transfer.
    /// @param to Destination address for the transfer.
    /// @param id Numeric id used by this operation.
    /// @param amount Amount to process, in the relevant token units.
    /// @param data Encoded data supplied to the operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: "ERC1155: not approved" if `from == msg.sender ||
    ///     _operatorApprovals[from][msg.sender]` is false.
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external {
        require(from == msg.sender || _operatorApprovals[from][msg.sender], "ERC1155: not approved");
        _transfer(from, to, id, amount);
        emit TransferSingle(msg.sender, from, to, id, amount);
        _doSafeTransferAcceptanceCheck(msg.sender, from, to, id, amount, data);
    }

    /// @notice Executes safeBatchTransferFrom.
    /// @param from Source address for the transfer.
    /// @param to Destination address for the transfer.
    /// @param ids Numeric ids used by this operation.
    /// @param amounts Numeric amounts used by this operation.
    /// @param data Encoded data supplied to the operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `ArrayLengthMismatch` if `ids.length != amounts.length` is true. "ERC1155: not
    ///     approved" if `from == msg.sender || _operatorApprovals[from][msg.sender]` is false.
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        require(from == msg.sender || _operatorApprovals[from][msg.sender], "ERC1155: not approved");
        if (ids.length != amounts.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
            _transfer(from, to, ids[i], amounts[i]);
        }
        emit TransferBatch(msg.sender, from, to, ids, amounts);
        _doSafeBatchTransferAcceptanceCheck(msg.sender, from, to, ids, amounts, data);
    }

    // -------------------------------------------------------------------------
    // Mint / Burn (authorised minters only)
    // -------------------------------------------------------------------------
    /// @notice Mints.
    /// @param to Destination address for the transfer.
    /// @param id Numeric id used by this operation.
    /// @param amount Amount to process, in the relevant token units.
    /// @param data Encoded data supplied to the operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `UnauthorisedMinter` if `!_authorisedMinters[msg.sender]` is true.
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external {
        _requireMintPermission(msg.sender, id);
        _mint(to, id, amount);
        emit TransferSingle(msg.sender, address(0), to, id, amount);
        _doSafeTransferAcceptanceCheck(msg.sender, address(0), to, id, amount, data);
    }

    /// @notice Executes mintBatch.
    /// @param to Destination address for the transfer.
    /// @param ids Numeric ids used by this operation.
    /// @param amounts Numeric amounts used by this operation.
    /// @param data Encoded data supplied to the operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `UnauthorisedMinter` if `!_authorisedMinters[msg.sender]` is true.
    ///     `ArrayLengthMismatch` if `ids.length != amounts.length` is true.
    function mintBatch(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        if (ids.length != amounts.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
            _requireMintPermission(msg.sender, ids[i]);
            _mint(to, ids[i], amounts[i]);
        }
        emit TransferBatch(msg.sender, address(0), to, ids, amounts);
        _doSafeBatchTransferAcceptanceCheck(msg.sender, address(0), to, ids, amounts, data);
    }

    /// @notice Burns.
    /// @param from Source address for the transfer.
    /// @param id Numeric id used by this operation.
    /// @param amount Amount to process, in the relevant token units.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `UnauthorisedMinter` if `msg.sender != from && !_authorisedMinters[msg.sender]`
    ///     is true. `InsufficientBalance` if `_balances[from][id] < amount` is true.
    function burn(address from, uint256 id, uint256 amount) external {
        if (msg.sender != from && !_authorisedBurners[msg.sender]) revert UnauthorisedBurner();
        _burn(from, id, amount);
        emit TransferSingle(msg.sender, from, address(0), id, amount);
    }

    /// @notice Burns a batch of positions.
    /// @param from Source address for the transfer.
    /// @param ids Numeric ids used by this operation.
    /// @param amounts Numeric amounts used by this operation.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `UnauthorisedBurner` if `msg.sender != from && !_authorisedBurners[msg.sender]`
    ///     is true. `ArrayLengthMismatch` if `ids.length != amounts.length` is true.
    ///     `InsufficientBalance` if a balance is too low.
    function burnBatch(address from, uint256[] calldata ids, uint256[] calldata amounts) external {
        if (msg.sender != from && !_authorisedBurners[msg.sender]) revert UnauthorisedBurner();
        if (ids.length != amounts.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
            _burn(from, ids[i], amounts[i]);
        }
        emit TransferBatch(msg.sender, from, address(0), ids, amounts);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    /// @dev Returns the market encoded in the high bits of a position id.
    function _marketOf(uint256 id) internal pure returns (address) {
        return address(uint160(id >> 1));
    }

    /// @dev Enforces that `minter` may mint `id` (its own market namespace or global settlement).
    function _requireMintPermission(address minter, uint256 id) internal view {
        if (_globalSettlement[minter]) return;
        address market = _authorisedMinters[minter];
        if (market == address(0)) revert UnauthorisedMinter();
        if (_marketOf(id) != market) revert InvalidTokenId();
    }

    function _mint(address to, uint256 id, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        _balances[to][id] += amount;
        _totalSupply[id] += amount;
    }

    function _transfer(address from, address to, uint256 id, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        if (_balances[from][id] < amount) revert InsufficientBalance();
        unchecked {
            _balances[from][id] -= amount;
        }
        _balances[to][id] += amount;
    }

    function _burn(address from, uint256 id, uint256 amount) internal {
        if (_balances[from][id] < amount) revert InsufficientBalance();
        unchecked {
            _balances[from][id] -= amount;
            _totalSupply[id] -= amount;
        }
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC1155: transfer to non-ERC1155Receiver");
                }
                assembly {
                    revert(add(32, reason), mload(reason))
                }
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (to.code.length > 0) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155BatchReceived.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC1155: transfer to non-ERC1155Receiver");
                }
                assembly {
                    revert(add(32, reason), mload(reason))
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // ERC165 supportsInterface
    // -------------------------------------------------------------------------
    /// @notice Reports whether interface is satisfied.
    /// @param interfaceId Identifier of the relevant interface.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0xd9b67a26 || // ERC1155
            interfaceId == 0x0e89341c || // ERC1155MetadataURI
            interfaceId == 0x01ffc9a7;   // ERC165
    }
}
