// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal IERC1155Receiver interface for safe transfer checks
interface IERC1155Receiver {
    function onERC1155Received(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);

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
        factory = _factory;
    }

    // -------------------------------------------------------------------------
    // Position ID helpers
    // -------------------------------------------------------------------------
    function yesId(address market) public pure returns (uint256) {
        return (uint256(uint160(market)) << 1) | 1;
    }

    function noId(address market) public pure returns (uint256) {
        return (uint256(uint160(market)) << 1) | 2;
    }

    // -------------------------------------------------------------------------
    // Factory-only authorisation
    // -------------------------------------------------------------------------
    function authorise(address market) external {
        if (msg.sender != factory) revert NotFactory();
        _authorisedMinters[market] = true;
    }

    /// @notice Authorise an address (e.g. Resolution contract) to burn tokens.
    ///         Only callable by the factory.
    function authoriseBurner(address burner) external {
        if (msg.sender != factory) revert NotFactory();
        _authorisedMinters[burner] = true;
    }

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------
    function isAuthorised(address market) external view returns (bool) {
        return _authorisedMinters[market];
    }

    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupply[id];
    }

    // -------------------------------------------------------------------------
    // ERC1155 view functions
    // -------------------------------------------------------------------------
    function balanceOf(address account, uint256 id) public view returns (uint256) {
        return _balances[account][id];
    }

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

    function isApprovedForAll(address account, address operator) public view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    // -------------------------------------------------------------------------
    // ERC1155 transfer functions
    // -------------------------------------------------------------------------
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
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external {
        if (!_authorisedMinters[msg.sender]) revert UnauthorisedMinter();
        _mint(to, id, amount);
        emit TransferSingle(msg.sender, address(0), to, id, amount);
        _doSafeTransferAcceptanceCheck(msg.sender, address(0), to, id, amount, data);
    }

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
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0xd9b67a26 || // ERC1155
            interfaceId == 0x0e89341c || // ERC1155MetadataURI
            interfaceId == 0x01ffc9a7;   // ERC165
    }
}
