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
     * @notice Burns.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: "Burnable: amount must be greater than 0" if `amount > 0` is false. "Burnable:
     *     insufficient balance" if `balanceOf(msg.sender) >= amount` is false.
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
     * @notice Executes burnFrom.
     * @dev Access: Caller permissions are checked against the sender or assigned roles.
     * @dev Reverts: "Burnable: amount must be greater than 0" if `amount > 0` is false. "Burnable:
     *     burn from zero address" if `account != address(0)` is false. "Burnable: insufficient
     *     balance" if `balanceOf(account) >= amount` is false. "Burnable: insufficient allowance"
     *     if `currentAllowance >= amount` is false.
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
     * @notice Executes batchBurn.
     * @dev Access: Caller must hold the BURNER_ROLE role.
     * @dev Reverts: "Burnable: accounts and amounts length mismatch" if `accounts.length ==
     *     amounts.length` is false. "Burnable: empty batch" if `accounts.length > 0` is false.
     *     "Burnable: burn from zero address" if `account != address(0)` is false. "Burnable: amount
     *     must be greater than 0" if `amount > 0` is false. "Burnable: insufficient balance" if
     *     `balanceOf(account) >= amount` is false.
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
     * @notice Executes totalBurned.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function totalBurned() public view returns (uint256) {
        return _totalBurned;
    }

    /**
     * @dev Returns the remaining supply (total supply minus burned).
     * @return Remaining token supply
     * @notice Executes circulatingSupply.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() + _totalBurned;
    }

    /**
     * @dev Required override for AccessControl.
     * @notice Reports whether interface is satisfied.
     * @param interfaceId Identifier of the relevant interface.
     * @return True when the requested condition is met.
     * @dev Access: No caller-specific access restriction is imposed.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PRBMathUD60x18} from "src/compat/PRBMathUD60x18.sol";

contract BondRedemption {
    using PRBMathUD60x18 for uint256;

    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 private constant ONE = 1e18;

    struct RedeemableBond {
        uint256 id;
        address owner;
        uint256 marketId;
        uint256 originalPrincipal;
        uint256 remainingPrincipal;
        uint256 annualRate;       // UD60x18 fraction, e.g. 0.05e18 = 5%
        uint256 maturityDate;
        uint256 accrualStart;     // timestamp from which yield is currently accruing
        bool fullyRedeemed;
        bool registered;
    }

    struct RedemptionRecord {
        uint256 bondId;
        address redeemer;
        uint256 principalRedeemed;
        uint256 yieldPaid;
        uint256 totalPaid;
        uint256 timestamp;
        bool wasFullRedemption;
    }

    address public immutable registrar;

    mapping(uint256 => RedeemableBond) private _bonds;
    mapping(uint256 => RedemptionRecord[]) private _history;
    mapping(address => uint256[]) private _redeemerBonds;

    uint256 public totalPrincipalRedeemed;
    uint256 public totalYieldPaid;

    event BondRegistered(
        uint256 indexed bondId, address indexed owner, uint256 indexed marketId,
        uint256 principal, uint256 annualRate, uint256 maturityDate
    );

    event BondRedeemed(
        uint256 indexed bondId, address indexed redeemer, uint256 principalRedeemed,
        uint256 yieldPaid, uint256 totalPaid, bool wasFullRedemption
    );

    error BondRedemption__NotRegistrar(address caller);
    error BondRedemption__AlreadyRegistered(uint256 bondId);
    error BondRedemption__NotRegistered(uint256 bondId);
    error BondRedemption__NotOwner(uint256 bondId, address caller);
    error BondRedemption__NotMatured(uint256 bondId, uint256 maturityDate, uint256 currentTime);
    error BondRedemption__FullyRedeemed(uint256 bondId);
    error BondRedemption__InvalidAmount(uint256 requested, uint256 available);
    error BondRedemption__ZeroAmount();
    error BondRedemption__InsufficientFunds(uint256 required, uint256 available);
    error BondRedemption__InvalidOwner();

    constructor(address _registrar) {
        registrar = _registrar;
    }

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert BondRedemption__NotRegistrar(msg.sender);
        _;
    }

    /// @notice Executes registerBond.
    /// @param bondId Identifier of the relevant bond.
    /// @param owner_ Address associated with owner_.
    /// @param marketId Identifier of the relevant market.
    /// @param principal Numeric principal used by this operation.
    /// @param annualRate Numeric annual rate used by this operation.
    /// @param maturityDate Numeric maturity date used by this operation.
    /// @dev Access: Caller must be an authorized registrar.
    /// @dev Reverts: `BondRedemption__AlreadyRegistered` if `_bonds[bondId].registered` is true.
    ///     `BondRedemption__InvalidOwner` if `owner_ == address(0)` is true.
    function registerBond(
        uint256 bondId,
        address owner_,
        uint256 marketId,
        uint256 principal,
        uint256 annualRate,
        uint256 maturityDate
    ) external payable onlyRegistrar {
        if (_bonds[bondId].registered) revert BondRedemption__AlreadyRegistered(bondId);
        if (owner_ == address(0)) revert BondRedemption__InvalidOwner();

        _bonds[bondId] = RedeemableBond({
            id: bondId,
            owner: owner_,
            marketId: marketId,
            originalPrincipal: principal,
            remainingPrincipal: principal,
            annualRate: annualRate,
            maturityDate: maturityDate,
            accrualStart: block.timestamp,
            fullyRedeemed: false,
            registered: true
        });

        emit BondRegistered(bondId, owner_, marketId, principal, annualRate, maturityDate);
    }

    /// @notice Executes calculateAccruedYield.
    /// @param bondId Identifier of the relevant bond.
    /// @return Accrued yield returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BondRedemption__NotRegistered` if `!b.registered` is true.
    function calculateAccruedYield(uint256 bondId) public view returns (uint256) {
        RedeemableBond storage b = _bonds[bondId];
        if (!b.registered) revert BondRedemption__NotRegistered(bondId);
        if (b.remainingPrincipal == 0) return 0;

        uint256 endTime = block.timestamp < b.maturityDate ? block.timestamp : b.maturityDate;
        if (endTime <= b.accrualStart) return 0;

        uint256 elapsed = endTime - b.accrualStart;
        uint256 rateScaled = b.annualRate.mul(elapsed * ONE).div(SECONDS_PER_YEAR * ONE);
        return b.remainingPrincipal.mul(rateScaled).div(ONE);
    }

    /// @notice Executes redeemableValue.
    /// @param bondId Identifier of the relevant bond.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BondRedemption__NotRegistered` if `!b.registered` is true.
    function redeemableValue(uint256 bondId) external view returns (uint256) {
        RedeemableBond storage b = _bonds[bondId];
        if (!b.registered) revert BondRedemption__NotRegistered(bondId);
        return b.remainingPrincipal + calculateAccruedYield(bondId);
    }

    /// @notice Executes redeemFull.
    /// @param bondId Identifier of the relevant bond.
    /// @dev Access: No caller-specific access restriction is imposed.
    function redeemFull(uint256 bondId) external {
        _redeem(bondId, _bonds[bondId].remainingPrincipal, true);
    }

    /// @notice Executes redeemPartial.
    /// @param bondId Identifier of the relevant bond.
    /// @param principalAmount Numeric principal amount used by this operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: `BondRedemption__ZeroAmount` if `principalAmount == 0` is true.
    function redeemPartial(uint256 bondId, uint256 principalAmount) external {
        if (principalAmount == 0) revert BondRedemption__ZeroAmount();
        _redeem(bondId, principalAmount, false);
    }

    function _redeem(uint256 bondId, uint256 principalAmount, bool isFullCall) internal {
        RedeemableBond storage b = _bonds[bondId];

        if (!b.registered) revert BondRedemption__NotRegistered(bondId);
        if (b.owner != msg.sender) revert BondRedemption__NotOwner(bondId, msg.sender);
        if (b.fullyRedeemed) revert BondRedemption__FullyRedeemed(bondId);
        if (block.timestamp < b.maturityDate) {
            revert BondRedemption__NotMatured(bondId, b.maturityDate, block.timestamp);
        }
        if (principalAmount == 0) revert BondRedemption__ZeroAmount();
        if (principalAmount > b.remainingPrincipal) {
            revert BondRedemption__InvalidAmount(principalAmount, b.remainingPrincipal);
        }

        uint256 totalAccruedYield = calculateAccruedYield(bondId);

        uint256 yieldForSlice = b.remainingPrincipal == 0
            ? 0
            : totalAccruedYield.mul(principalAmount * ONE).div(b.remainingPrincipal * ONE);

        uint256 totalPaid = principalAmount + yieldForSlice;
        bool isFullRedemption = principalAmount == b.remainingPrincipal;

        b.remainingPrincipal -= principalAmount;
        b.accrualStart = block.timestamp;

        if (isFullRedemption) {
            b.fullyRedeemed = true;
        }

        totalPrincipalRedeemed += principalAmount;
        totalYieldPaid += yieldForSlice;

        _history[bondId].push(
            RedemptionRecord({
                bondId: bondId,
                redeemer: msg.sender,
                principalRedeemed: principalAmount,
                yieldPaid: yieldForSlice,
                totalPaid: totalPaid,
                timestamp: block.timestamp,
                wasFullRedemption: isFullRedemption
            })
        );
        _redeemerBonds[msg.sender].push(bondId);

        if (address(this).balance < totalPaid) {
            revert BondRedemption__InsufficientFunds(totalPaid, address(this).balance);
        }

        emit BondRedeemed(bondId, msg.sender, principalAmount, yieldForSlice, totalPaid, isFullRedemption);

        (bool ok, ) = payable(msg.sender).call{value: totalPaid}("");
        require(ok, "BondRedemption: transfer failed");

        isFullCall;
    }

    /// @notice Returns bond.
    /// @param bondId Identifier of the relevant bond.
    /// @return Complete data for the bond.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getBond(uint256 bondId) external view returns (RedeemableBond memory) {
        return _bonds[bondId];
    }

    /// @notice Returns redemption history.
    /// @param bondId Identifier of the relevant bond.
    /// @return Redemption history returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRedemptionHistory(uint256 bondId) external view returns (RedemptionRecord[] memory) {
        return _history[bondId];
    }

    /// @notice Returns redemption count.
    /// @param bondId Identifier of the relevant bond.
    /// @return Redemption count returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRedemptionCount(uint256 bondId) external view returns (uint256) {
        return _history[bondId].length;
    }

    /// @notice Returns redemption record.
    /// @param bondId Identifier of the relevant bond.
    /// @param index Numeric index used by this operation.
    /// @return Redemption record returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getRedemptionRecord(uint256 bondId, uint256 index)
        external view returns (RedemptionRecord memory)
    {
        return _history[bondId][index];
    }

    /// @notice Returns bonds redeemed by.
    /// @param redeemer Address associated with redeemer.
    /// @return Bonds redeemed by returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getBondsRedeemedBy(address redeemer) external view returns (uint256[] memory) {
        return _redeemerBonds[redeemer];
    }

    /// @notice Reports whether fully redeemed is satisfied.
    /// @param bondId Identifier of the relevant bond.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isFullyRedeemed(uint256 bondId) external view returns (bool) {
        return _bonds[bondId].fullyRedeemed;
    }

    /// @notice Executes remainingPrincipal.
    /// @param bondId Identifier of the relevant bond.
    /// @return Value produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function remainingPrincipal(uint256 bondId) external view returns (uint256) {
        return _bonds[bondId].remainingPrincipal;
    }

    receive() external payable {}
}