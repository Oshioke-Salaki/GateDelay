// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal IERC1155Receiver interface for safe transfer checks
interface IERC1155Receiver {
    /// @notice Executes onERC1155Received.
    /// @param operator Address associated with operator.
    /// @param from Source address for the transfer.
    /// @param to Destination address for the transfer.
    /// @param id Numeric id used by this operation.
    /// @param value Value to set or process.
    /// @param data Encoded data supplied to the operation.
    /// @return Value produced by the operation.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function onERC1155Received(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

    /// @notice Executes onERC1155BatchReceived.
    /// @param operator Address associated with operator.
    /// @param from Source address for the transfer.
    /// @param ids Numeric ids used by this operation.
    /// @param values Numeric values used by this operation.
    /// @param data Encoded data supplied to the operation.
    /// @return Value produced by the operation.
    /// @dev Access: The interface specifies no caller restriction; implementations may enforce
    ///     access checks.
    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external returns (bytes4);
}

/// @title PositionToken
/// @notice ERC1155 token tracking YES/NO positions across all prediction markets.
///         Position IDs encode market address + outcome:
///           YES id = (uint256(uint160(market)) << 1) | 1
///           NO  id = (uint256(uint160(market)) << 1) | 2
contract PositionToken {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error UnauthorisedMinter();
    error ArrayLengthMismatch();
    error InsufficientBalance();
    error NotFactory();

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
    // Storage
    // -------------------------------------------------------------------------
    address public immutable factory;

    /// @dev ERC1155 balances: account => id => balance
    mapping(address => mapping(uint256 => uint256)) private _balances;

    /// @dev ERC1155 operator approvals: account => operator => approved
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /// @dev Total supply per token id
    mapping(uint256 => uint256) private _totalSupply;

    /// @dev Authorised minters (market addresses registered by factory)
    mapping(address => bool) private _authorisedMinters;

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
    /// @notice Executes yesId.
    /// @param market Market address associated with this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function yesId(address market) public pure returns (uint256) {
        return (uint256(uint160(market)) << 1) | 1;
    }

    /// @notice Executes noId.
    /// @param market Market address associated with this operation.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function noId(address market) public pure returns (uint256) {
        return (uint256(uint160(market)) << 1) | 2;
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
        _authorisedMinters[market] = true;
    }

    /// @notice Authorise an address (e.g. Resolution contract) to burn tokens.
    ///         Only callable by the factory.
    /// @param burner Address associated with burner.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    /// @dev Reverts: `NotFactory` if `msg.sender != factory` is true.
    function authoriseBurner(address burner) external {
        if (msg.sender != factory) revert NotFactory();
        _authorisedMinters[burner] = true;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------
    /// @notice Reports whether authorised is satisfied.
    /// @param market Market address associated with this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isAuthorised(address market) external view returns (bool) {
        return _authorisedMinters[market];
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
        if (!_authorisedMinters[msg.sender]) revert UnauthorisedMinter();
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
        if (!_authorisedMinters[msg.sender]) revert UnauthorisedMinter();
        if (ids.length != amounts.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < ids.length; i++) {
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
        if (msg.sender != from && !_authorisedMinters[msg.sender]) revert UnauthorisedMinter();
        if (_balances[from][id] < amount) revert InsufficientBalance();
        unchecked {
            _balances[from][id] -= amount;
            _totalSupply[id] -= amount;
        }
        emit TransferSingle(msg.sender, from, address(0), id, amount);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------
    function _mint(address to, uint256 id, uint256 amount) internal {
        _balances[to][id] += amount;
        _totalSupply[id] += amount;
    }

    function _transfer(address from, address to, uint256 id, uint256 amount) internal {
        if (_balances[from][id] < amount) revert InsufficientBalance();
        unchecked {
            _balances[from][id] -= amount;
        }
        _balances[to][id] += amount;
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
            try IERC1155Receiver(to).onERC1155Received(operator, from, to, id, amount, data) returns (bytes4 response) {
                if (response != IERC1155Receiver.onERC1155Received.selector) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch {
                revert("ERC1155: transfer to non-ERC1155Receiver");
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
            } catch {
                revert("ERC1155: transfer to non-ERC1155Receiver");
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
