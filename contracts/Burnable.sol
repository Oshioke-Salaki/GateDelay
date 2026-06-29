// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Burnable
 * @dev Extension of ERC20 that allows token burning with permission control and tracking.
 */
contract Burnable is ERC20, AccessControl {
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint256 private _totalBurned;

    /**
     * @dev Emitted when tokens are burned.
     */
    event TokensBurned(address indexed account, uint256 amount);

    /**
     * @dev Emitted when batch burn operation is performed.
     */
    event BatchBurn(address indexed operator, uint256 totalBurned);

    /**
     * @dev Constructor to initialize the token and set up roles.
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial token supply
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Burns tokens from the caller's balance.
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public {
        require(amount > 0, "Burnable: amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Burnable: insufficient balance");

        _burn(msg.sender, amount);
        _totalBurned += amount;

        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from a specified account using allowance.
     * Requires approval from the account owner.
     * @param account Account to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) public {
        require(amount > 0, "Burnable: amount must be greater than 0");
        require(account != address(0), "Burnable: burn from zero address");
        require(balanceOf(account) >= amount, "Burnable: insufficient balance");

        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "Burnable: insufficient allowance");

        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
        _totalBurned += amount;

        emit TokensBurned(account, amount);
    }

    /**
     * @dev Burns tokens from multiple accounts in a single transaction.
     * Caller must have BURNER_ROLE.
     * @param accounts Array of addresses to burn tokens from
     * @param amounts Array of amounts to burn from each account
     */
    function batchBurn(address[] calldata accounts, uint256[] calldata amounts)
        external
        onlyRole(BURNER_ROLE)
    {
        require(
            accounts.length == amounts.length,
            "Burnable: accounts and amounts length mismatch"
        );
        require(accounts.length > 0, "Burnable: empty batch");

        uint256 totalBurnedInBatch = 0;

        for (uint256 i = 0; i < accounts.length; ++i) {
            address account = accounts[i];
            uint256 amount = amounts[i];

            require(account != address(0), "Burnable: burn from zero address");
            require(amount > 0, "Burnable: amount must be greater than 0");
            require(
                balanceOf(account) >= amount,
                "Burnable: insufficient balance"
            );

            _burn(account, amount);
            _totalBurned += amount;
            totalBurnedInBatch += amount;

            emit TokensBurned(account, amount);
        }

        emit BatchBurn(msg.sender, totalBurnedInBatch);
    }

    /**
     * @dev Returns the total number of tokens burned.
     * @return Total amount of tokens burned
     */
    function totalBurned() public view returns (uint256) {
        return _totalBurned;
    }

    /**
     * @dev Returns the remaining supply (total supply minus burned).
     * @return Remaining token supply
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() + _totalBurned;
    }

    /**
     * @dev Required override for AccessControl.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC20, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
