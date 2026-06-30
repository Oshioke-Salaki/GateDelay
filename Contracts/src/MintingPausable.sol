// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
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
    function mint(address to, uint256 amount) external onlyMinter {
        require(!paused(), "MintingPausable: minting is paused");
        require(to != address(0), "MintingPausable: cannot mint to zero address");
        require(amount > 0, "MintingPausable: amount must be positive");

        _mint(to, amount);
    }

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
    function pauseMinting(string calldata reason) external onlyPauser {
        require(!paused(), "MintingPausable: already paused");
        _pause();
        pausedAt = block.timestamp;
        pauseCount++;
        pauseStartTimes[pauseCount] = block.timestamp;
        emit MintingPaused(msg.sender, reason);
        emit PauseStatusChanged(true, msg.sender);
    }

    function unpauseMinting(string calldata reason) external onlyAdminOrPauser {
        require(paused(), "MintingPausable: not paused");
        _unpause();
        lastUnpauseTime = block.timestamp;
        emit MintingUnpaused(msg.sender, reason);
        emit PauseStatusChanged(false, msg.sender);
    }

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
    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _grantRole(MINTER_ROLE, account);
    }

    function revokeMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _revokeRole(MINTER_ROLE, account);
    }

    function grantPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _grantRole(PAUSER_ROLE, account);
    }

    function revokePauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _revokeRole(PAUSER_ROLE, account);
    }

    function grantEmergencyPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _grantRole(EMERGENCY_PAUSER_ROLE, account);
    }

    function revokeEmergencyPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "MintingPausable: invalid account");
        _revokeRole(EMERGENCY_PAUSER_ROLE, account);
    }

    // Status Queries
    function isMintingPaused() external view returns (bool) {
        return paused();
    }

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

    function getTimeSincePause() external view returns (uint256) {
        require(paused(), "MintingPausable: not currently paused");
        return block.timestamp - pausedAt;
    }

    function getTimeUntilNextUnpause() external view returns (uint256) {
        if (!paused()) {
            return 0;
        }
        return block.timestamp - pausedAt;
    }

    function hasMinterRole(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }

    function hasPauserRole(address account) external view returns (bool) {
        return hasRole(PAUSER_ROLE, account);
    }

    function hasEmergencyPauserRole(address account) external view returns (bool) {
        return hasRole(EMERGENCY_PAUSER_ROLE, account);
    }

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
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC20, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
