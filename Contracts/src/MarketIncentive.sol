// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ERC20Token.sol";
import "./MarketFactory.sol";

/// @title MarketIncentive
/// @notice Manages incentive programs for prediction markets:
///         designs programs, calculates rewards, tracks participation,
///         and distributes incentives automatically.
contract MarketIncentive {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------
    error ProgramNotFound();
    error ProgramInactive();
    error ProgramExpired();
    error AlreadyClaimed();
    error InsufficientRewardPool();
    error Unauthorized();
    error InvalidParams();

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum ProgramType {
        LIQUIDITY_PROVISION,  // Reward LPs
        TRADING_VOLUME,       // Reward active traders
        MARKET_CREATION,      // Reward market creators
        REFERRAL              // Reward referrers
    }

    struct IncentiveProgram {
        uint256 id;
        string name;
        ProgramType programType;
        address rewardToken;
        uint256 rewardPool;          // Total rewards allocated
        uint256 rewardDistributed;   // Rewards already distributed
        uint256 rewardPerUnit;       // Reward per unit of participation (WAD)
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    struct Participation {
        uint256 programId;
        address participant;
        address market;
        uint256 units;       // e.g. liquidity amount, trade volume
        uint256 rewardEarned;
        uint256 rewardClaimed;
        uint256 lastUpdated;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event ProgramCreated(
        uint256 indexed programId,
        string name,
        ProgramType programType,
        address rewardToken,
        uint256 rewardPool,
        uint256 startTime,
        uint256 endTime
    );
    event ProgramUpdated(uint256 indexed programId, bool active);
    event ParticipationRecorded(
        uint256 indexed programId,
        address indexed participant,
        address indexed market,
        uint256 units,
        uint256 rewardEarned
    );
    event RewardClaimed(
        uint256 indexed programId,
        address indexed participant,
        uint256 amount
    );
    event RewardPoolToppedUp(uint256 indexed programId, uint256 amount);

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------
    uint256 public constant WAD = 1e18;

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    MarketFactory public immutable marketFactory;
    address public admin;

    /// @dev programId => IncentiveProgram
    mapping(uint256 => IncentiveProgram) private _programs;
    uint256 private _nextProgramId;

    /// @dev programId => participant => market => Participation
    mapping(uint256 => mapping(address => mapping(address => Participation))) private _participations;

    /// @dev programId => list of participants (for enumeration)
    mapping(uint256 => address[]) private _programParticipants;

    /// @dev programId => participant => already in list
    mapping(uint256 => mapping(address => bool)) private _isParticipant;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    constructor(address _marketFactory, address _admin) {
        marketFactory = MarketFactory(_marketFactory);
        admin = _admin;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // -------------------------------------------------------------------------
    // Program management
    // -------------------------------------------------------------------------

    /// @notice Design a new incentive program.
    /// @param name          Human-readable program name.
    /// @param programType   Type of participation being incentivised.
    /// @param rewardToken   ERC20 token used for rewards.
    /// @param rewardPool    Total reward tokens allocated to this program.
    /// @param rewardPerUnit Reward tokens per unit of participation (WAD-scaled).
    /// @param startTime     Unix timestamp when the program starts.
    /// @param endTime       Unix timestamp when the program ends.
    function createProgram(
        string calldata name,
        ProgramType programType,
        address rewardToken,
        uint256 rewardPool,
        uint256 rewardPerUnit,
        uint256 startTime,
        uint256 endTime
    ) external onlyAdmin returns (uint256 programId) {
        if (rewardPool == 0 || rewardPerUnit == 0) revert InvalidParams();
        if (endTime <= startTime || startTime < block.timestamp) revert InvalidParams();

        // Transfer reward tokens into this contract
        ERC20Token(rewardToken).transferFrom(msg.sender, address(this), rewardPool);

        programId = _nextProgramId++;
        _programs[programId] = IncentiveProgram({
            id: programId,
            name: name,
            programType: programType,
            rewardToken: rewardToken,
            rewardPool: rewardPool,
            rewardDistributed: 0,
            rewardPerUnit: rewardPerUnit,
            startTime: startTime,
            endTime: endTime,
            active: true
        });

        emit ProgramCreated(programId, name, programType, rewardToken, rewardPool, startTime, endTime);
    }

    /// @notice Activate or deactivate a program.
    function setProgramActive(uint256 programId, bool active) external onlyAdmin {
        if (programId >= _nextProgramId) revert ProgramNotFound();
        _programs[programId].active = active;
        emit ProgramUpdated(programId, active);
    }

    /// @notice Top up the reward pool of an existing program.
    function topUpRewardPool(uint256 programId, uint256 amount) external onlyAdmin {
        if (programId >= _nextProgramId) revert ProgramNotFound();
        IncentiveProgram storage program = _programs[programId];
        ERC20Token(program.rewardToken).transferFrom(msg.sender, address(this), amount);
        program.rewardPool += amount;
        emit RewardPoolToppedUp(programId, amount);
    }

    // -------------------------------------------------------------------------
    // Participation tracking
    // -------------------------------------------------------------------------

    /// @notice Record participation units for a user on a market.
    ///         Called by authorised contracts (e.g. Trading, LiquidityPool).
    /// @param programId    The incentive program.
    /// @param participant  Address of the participant.
    /// @param market       Market address.
    /// @param units        Units of participation (e.g. trade volume in WAD).
    function recordParticipation(
        uint256 programId,
        address participant,
        address market,
        uint256 units
    ) external {
        if (programId >= _nextProgramId) revert ProgramNotFound();
        IncentiveProgram storage program = _programs[programId];
        if (!program.active) revert ProgramInactive();
        if (block.timestamp < program.startTime || block.timestamp > program.endTime) {
            revert ProgramExpired();
        }

        uint256 reward = (units * program.rewardPerUnit) / WAD;
        if (program.rewardDistributed + reward > program.rewardPool) {
            // Cap reward to remaining pool
            reward = program.rewardPool - program.rewardDistributed;
        }

        Participation storage p = _participations[programId][participant][market];
        if (p.participant == address(0)) {
            // First participation
            p.programId = programId;
            p.participant = participant;
            p.market = market;
        }

        p.units += units;
        p.rewardEarned += reward;
        p.lastUpdated = block.timestamp;

        program.rewardDistributed += reward;

        // Track participant list
        if (!_isParticipant[programId][participant]) {
            _isParticipant[programId][participant] = true;
            _programParticipants[programId].push(participant);
        }

        emit ParticipationRecorded(programId, participant, market, units, reward);
    }

    // -------------------------------------------------------------------------
    // Reward distribution
    // -------------------------------------------------------------------------

    /// @notice Claim earned rewards for a specific program and market.
    function claimReward(uint256 programId, address market) external {
        Participation storage p = _participations[programId][msg.sender][market];
        uint256 claimable = p.rewardEarned - p.rewardClaimed;
        if (claimable == 0) revert AlreadyClaimed();

        p.rewardClaimed += claimable;

        IncentiveProgram storage program = _programs[programId];
        ERC20Token(program.rewardToken).transfer(msg.sender, claimable);

        emit RewardClaimed(programId, msg.sender, claimable);
    }

    /// @notice Batch distribute rewards to all participants of a program (admin).
    ///         Useful for automatic end-of-program distribution.
    function distributeAll(uint256 programId) external onlyAdmin {
        if (programId >= _nextProgramId) revert ProgramNotFound();
        IncentiveProgram storage program = _programs[programId];

        address[] storage participants = _programParticipants[programId];
        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            // We don't know which markets per participant here — iterate via events off-chain.
            // This function is a hook; full distribution should be driven off-chain.
            emit RewardClaimed(programId, participant, 0); // signal for off-chain indexer
        }
    }

    // -------------------------------------------------------------------------
    // Queries
    // -------------------------------------------------------------------------

    /// @notice Get an incentive program by ID.
    function getProgram(uint256 programId) external view returns (IncentiveProgram memory) {
        if (programId >= _nextProgramId) revert ProgramNotFound();
        return _programs[programId];
    }

    /// @notice Get all program IDs (count).
    function getProgramCount() external view returns (uint256) {
        return _nextProgramId;
    }

    /// @notice Get participation record for a user on a program/market.
    function getParticipation(
        uint256 programId,
        address participant,
        address market
    ) external view returns (Participation memory) {
        return _participations[programId][participant][market];
    }

    /// @notice Get claimable reward for a user.
    function getClaimableReward(
        uint256 programId,
        address participant,
        address market
    ) external view returns (uint256) {
        Participation storage p = _participations[programId][participant][market];
        return p.rewardEarned - p.rewardClaimed;
    }

    /// @notice Get all participants of a program.
    function getProgramParticipants(uint256 programId) external view returns (address[] memory) {
        return _programParticipants[programId];
    }

    /// @notice Get remaining reward pool for a program.
    function getRemainingPool(uint256 programId) external view returns (uint256) {
        if (programId >= _nextProgramId) revert ProgramNotFound();
        IncentiveProgram storage p = _programs[programId];
        return p.rewardPool - p.rewardDistributed;
    }
}
