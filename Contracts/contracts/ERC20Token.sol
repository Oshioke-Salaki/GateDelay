// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title GateDelay ERC20 Token
/// @notice ERC20 with mint/burn, access control, and EIP-2612 permit
contract ERC20Token {
    // ── Metadata ──────────────────────────────────────────────────────────────
    string public name     = "GateDelay Token";
    string public symbol   = "GTD";
    uint8  public constant decimals = 18;

    // ── ERC20 state ───────────────────────────────────────────────────────────
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ── Access control ────────────────────────────────────────────────────────
    address public owner;
    mapping(address => bool) public minters;

    // ── EIP-2612 permit ───────────────────────────────────────────────────────
    bytes32 public immutable DOMAIN_SEPARATOR;
    // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
    bytes32 public constant PERMIT_TYPEHASH =
        0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
    mapping(address => uint256) public nonces;

    // ── Events ────────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Errors ────────────────────────────────────────────────────────────────
    error Unauthorized();
    error InsufficientBalance();
    error AllowanceExceeded();
    error ZeroAddress();
    error PermitExpired();
    error InvalidSignature();

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(uint256 initialSupply) {
        owner = msg.sender;
        minters[msg.sender] = true;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply * 10 ** decimals);
        }
    }

    // ── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyMinter() {
        if (!minters[msg.sender]) revert Unauthorized();
        _;
    }

    // ── ERC20 core ────────────────────────────────────────────────────────────
    function transfer(address to, uint256 value) public returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert AllowanceExceeded();
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    // ── Mint / Burn ───────────────────────────────────────────────────────────
    function mint(address to, uint256 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address from, uint256 amount) external {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert AllowanceExceeded();
            allowance[from][msg.sender] = allowed - amount;
        }
        _burn(from, amount);
    }

    // ── EIP-2612 Permit ───────────────────────────────────────────────────────
    function permit(
        address _owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (block.timestamp > deadline) revert PermitExpired();
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, _owner, spender, value, nonces[_owner]++, deadline))
            )
        );
        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0) || recovered != _owner) revert InvalidSignature();
        allowance[_owner][spender] = value;
        emit Approval(_owner, spender, value);
    }

    // ── Access control ────────────────────────────────────────────────────────
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────
    function _transfer(address from, address to, uint256 value) internal {
        if (balanceOf[from] < value) revert InsufficientBalance();
        balanceOf[from] -= value;
        balanceOf[to]   += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply     += amount;
        balanceOf[to]   += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        totalSupply     -= amount;
        emit Transfer(from, address(0), amount);
    }
}
