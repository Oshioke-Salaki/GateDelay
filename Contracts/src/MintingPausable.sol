// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MintingPausable is ERC20, Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EMERGENCY_PAUSER_ROLE = keccak256("EMERGENCY_PAUSER_ROLE");

    uint256 public pausedAt;
    uint256 public pauseCount;
    uint256 public lastUnpauseTime;
    mapping(uint256 => uint256) public pauseStartTimes; // pause index -> timestamp

    event MintingPaused(address indexed by, string reason);
    event MintingUnpaused(address indexed by, string reason);
    event EmergencyPausedTriggered(address indexed by, uint256 timestamp);
    event PauseStatusChanged(bool paused, address indexed initiator);

    modifier onlyMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "MintingPausable: caller is not minter");
        _;
    }

    modifier onlyPauser() {
        require(hasRole(PAUSER_ROLE, msg.sender), "MintingPausable: caller is not pauser");
        _;
    }

    modifier onlyEmergencyPauser() {
        require(
            hasRole(EMERGENCY_PAUSER_ROLE, msg.sender),
            "MintingPausable: caller is not emergency pauser"
        );
        _;
    }

    modifier onlyAdminOrPauser() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(PAUSER_ROLE, msg.sender),
            "MintingPausable: caller is not admin or pauser"
        );
        _;
    }

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(EMERGENCY_PAUSER_ROLE, msg.sender);
    }

    // Minting with pause check
    /// @notice Mints.
    /// @param to Destination address for the transfer.
    /// @param amount Amount to process, in the relevant token units.
    /// @dev Access: Caller must be an authorized minter.
    /// @dev Reverts: "MintingPausable: minting is paused" if `!paused()` is false. "MintingPausable:
    ///     cannot mint to zero address" if `to != address(0)` is false. "MintingPausable: amount
    ///     must be positive" if `amount > 0` is false.
    function mint(address to, uint256 amount) external onlyMinter {
        require(!paused(), "MintingPausable: minting is paused");
        require(to != address(0), "MintingPausable: cannot mint to zero address");
        require(amount > 0, "MintingPausable: amount must be positive");

        _mint(to, amount);
    }

    /// @notice Executes mintBatch.
    /// @param recipients Address associated with recipients.
    /// @param amounts Numeric amounts used by this operation.
    /// @dev Access: Caller must be an authorized minter.
    /// @dev Reverts: "MintingPausable: minting is paused" if `!paused()` is false. "MintingPausable:
    ///     recipients and amounts length mismatch" if `recipients.length == amounts.length` is
    ///     false. "MintingPausable: empty batch" if `recipients.length > 0` is false.
    ///     "MintingPausable: batch too large" if `recipients.length <= 1000` is false.
    ///     "MintingPausable: cannot mint to zero address" if `recipients[i] != address(0)` is
    ///     false. "MintingPausable: amount must be positive" if `amounts[i] > 0` is false.
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        onlyMinter 
    {
        require(!paused(), "MintingPausable: minting is paused");
        require(
            recipients.length == amounts.length,
            "MintingPausable: recipients and amounts length mismatch"
        );
        require(recipients.length > 0, "MintingPausable: empty batch");
        require(recipients.length <= 1000, "MintingPausable: batch too large");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "MintingPausable: cannot mint to zero address");
            require(amounts[i] > 0, "MintingPausable: amount must be positive");
            _mint(recipients[i], amounts[i]);
        }
    }

    // Pause Control
    /// @notice Executes pauseMinting.
    /// @param reason reason used by this operation.
    /// @dev Access: Caller must have the pauser role.
    /// @dev Reverts: "MintingPausable: already paused" if `!paused()` is false.
    function pauseMinting(string calldata reason) external onlyPauser {
        require(!paused(), "MintingPausable: already paused");
        _pause();
        pausedAt = block.timestamp;
        pauseCount++;
        pauseStartTimes[pauseCount] = block.timestamp;
        emit MintingPaused(msg.sender, reason);
        emit PauseStatusChanged(true, msg.sender);
    }

    /// @notice Executes unpauseMinting.
    /// @param reason reason used by this operation.
    /// @dev Access: Caller must satisfy `onlyAdminOrPauser` access checks.
    /// @dev Reverts: "MintingPausable: not paused" if `paused()` is false.
    function unpauseMinting(string calldata reason) external onlyAdminOrPauser {
        require(paused(), "MintingPausable: not paused");
        _unpause();
        lastUnpauseTime = block.timestamp;
        emit MintingUnpaused(msg.sender, reason);
        emit PauseStatusChanged(false, msg.sender);
    }

    /// @notice Executes emergencyPause.
    /// @dev Access: Caller must satisfy `onlyEmergencyPauser` access checks.
    /// @dev Reverts: "MintingPausable: already paused" if `!paused()` is false.
    function emergencyPause() external onlyEmergencyPauser {
        require(!paused(), "MintingPausable: already paused");
        _pause();
        pausedAt = block.timestamp;
        pauseCount++;
        pauseStartTimes[pauseCount] = block.timestamp;
        emit EmergencyPausedTriggered(msg.sender, block.timestamp);
        emit PauseStatusChanged(true, msg.sender);
    }

    // Permission Management
    /// @notice Executes grantMinterRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must hold the DEFAULT_ADMIN_ROLE role.
    /// @dev Reverts: "MintingPausable: invalid account" if `account != address(0)` is false.
    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _grantRole(MINTER_ROLE, account);
    }

    /// @notice Executes revokeMinterRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must hold the DEFAULT_ADMIN_ROLE role.
    /// @dev Reverts: "MintingPausable: invalid account" if `account != address(0)` is false.
    function revokeMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _revokeRole(MINTER_ROLE, account);
    }

    /// @notice Executes grantPauserRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must hold the DEFAULT_ADMIN_ROLE role.
    /// @dev Reverts: "MintingPausable: invalid account" if `account != address(0)` is false.
    function grantPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _grantRole(PAUSER_ROLE, account);
    }

    /// @notice Executes revokePauserRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must hold the DEFAULT_ADMIN_ROLE role.
    /// @dev Reverts: "MintingPausable: invalid account" if `account != address(0)` is false.
    function revokePauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _revokeRole(PAUSER_ROLE, account);
    }

    /// @notice Executes grantEmergencyPauserRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must hold the DEFAULT_ADMIN_ROLE role.
    /// @dev Reverts: "MintingPausable: invalid account" if `account != address(0)` is false.
    function grantEmergencyPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _grantRole(EMERGENCY_PAUSER_ROLE, account);
    }

    /// @notice Executes revokeEmergencyPauserRole.
    /// @param account Account address affected by this operation.
    /// @dev Access: Caller must hold the DEFAULT_ADMIN_ROLE role.
    /// @dev Reverts: "MintingPausable: invalid account" if `account != address(0)` is false.
    function revokeEmergencyPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _revokeRole(EMERGENCY_PAUSER_ROLE, account);
    }

    // Status Queries
    /// @notice Reports whether minting paused is satisfied.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function isMintingPaused() external view returns (bool) {
        return paused();
    }

    /// @notice Returns pause status.
    /// @return isPaused is paused produced by the operation.
    /// @return pausedSince paused since produced by the operation.
    /// @return totalPauses total pauses produced by the operation.
    /// @return timePausedSeconds time paused seconds produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getPauseStatus() 
        external 
        view 
        returns (
            bool isPaused,
            uint256 pausedSince,
            uint256 totalPauses,
            uint256 timePausedSeconds
        ) 
    {
        isPaused = paused();
        pausedSince = isPaused ? pausedAt : 0;
        totalPauses = pauseCount;
        
        if (isPaused) {
            timePausedSeconds = block.timestamp - pausedAt;
        } else {
            timePausedSeconds = 0;
        }
    }

    /// @notice Returns pause history.
    /// @return totalPauses total pauses produced by the operation.
    /// @return lastPauseStartTime last pause start time produced by the operation.
    /// @return lastUnpauseTime last unpause time produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getPauseHistory() 
        external 
        view 
        returns (
            uint256 totalPauses,
            uint256 lastPauseStartTime,
            uint256 lastUnpauseTime
        ) 
    {
        totalPauses = pauseCount;
        lastPauseStartTime = pausedAt;
        lastUnpauseTime = lastUnpauseTime;
    }

    /// @notice Returns time since pause.
    /// @return Time since pause returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    /// @dev Reverts: "MintingPausable: not currently paused" if `paused()` is false.
    function getTimeSincePause() external view returns (uint256) {
        require(paused(), "MintingPausable: not currently paused");
        return block.timestamp - pausedAt;
    }

    /// @notice Returns time until next unpause.
    /// @return Time until next unpause returned by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getTimeUntilNextUnpause() external view returns (uint256) {
        if (!paused()) {
            return 0;
        }
        return block.timestamp - pausedAt;
    }

    /// @notice Reports whether minter role is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    function hasMinterRole(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    /// @notice Reports whether pauser role is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    function hasPauserRole(address account) external view returns (bool) {
        return hasRole(PAUSER_ROLE, account);
    }

    /// @notice Reports whether emergency pauser role is satisfied.
    /// @param account Account address affected by this operation.
    /// @return True when the requested condition is met.
    /// @dev Access: Caller permissions are checked against the sender or assigned roles.
    function hasEmergencyPauserRole(address account) external view returns (bool) {
        return hasRole(EMERGENCY_PAUSER_ROLE, account);
    }

    /// @notice Returns paused reason.
    /// @return isCurrentlyPaused is currently paused produced by the operation.
    /// @return totalTimePausedInSeconds total time paused in seconds produced by the operation.
    /// @return pauseCountLifetime pause count lifetime produced by the operation.
    /// @dev Access: No caller-specific access restriction is imposed.
    function getPausedReason() 
        external 
        view 
        returns (
            bool isCurrentlyPaused,
            uint256 totalTimePausedInSeconds,
            uint256 pauseCountLifetime
        ) 
    {
        isCurrentlyPaused = paused();
        totalTimePausedInSeconds = isCurrentlyPaused ? (block.timestamp - pausedAt) : 0;
        pauseCountLifetime = pauseCount;
    }

    // Override _beforeTokenTransfer to include pause check
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    // Required override for AccessControl
    /// @notice Reports whether interface is satisfied.
    /// @param interfaceId Identifier of the relevant interface.
    /// @return True when the requested condition is met.
    /// @dev Access: No caller-specific access restriction is imposed.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC20, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
