// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PRBMathUD60x18} from "prb-math/PRBMathUD60x18.sol";

contract MarketYield {
    using PRBMathUD60x18 for uint256;

    enum YieldType {
        Fixed,      // Pre-agreed flat rate distribution
        Variable,   // Performance-based, proportional to market outcome/profit
        Bonus       // One-off incentive distribution (e.g. promotions, rebates)
    }

    struct MarketYieldState {
        uint256 totalShares;
        uint256 totalYieldDistributed;
        uint256 yieldPerShareIndex;     // UD60x18 scaled
        uint256 lastDistributionTimestamp;
        uint256 distributionCount;
    }

    struct ParticipantPosition {
        uint256 shares;
        uint256 lastIndex;
        uint256 claimedTotal;
        uint256 owedUnclaimed;          // checkpointed but unclaimed yield
    }

    struct DistributionRecord {
        uint256 marketId;
        YieldType yieldType;
        uint256 amount;
        uint256 totalSharesAtDistribution;
        uint256 timestamp;
    }

    address public immutable controller;

    mapping(uint256 => MarketYieldState) private _markets;
    mapping(uint256 => mapping(address => ParticipantPosition)) private _positions;
    mapping(uint256 => DistributionRecord[]) private _distributionHistory;
    mapping(uint256 => mapping(YieldType => uint256)) public yieldByType;

    uint256 private constant ONE = 1e18;

    event SharesUpdated(uint256 indexed marketId, address indexed participant, uint256 newShares);
    event YieldDeposited(uint256 indexed marketId, YieldType indexed yieldType, uint256 amount, uint256 totalSharesAtDistribution);
    event YieldClaimed(uint256 indexed marketId, address indexed participant, uint256 amount);

    error MarketYield__NotController(address caller);
    error MarketYield__ZeroShares();
    error MarketYield__ZeroAmount();
    error MarketYield__NoShareholders();
    error MarketYield__InsufficientFunds(uint256 required, uint256 available);
    error MarketYield__NothingToClaim();
    error MarketYield__InvalidMarket();

    constructor(address _controller) {
        controller = _controller;
    }

    modifier onlyController() {
        if (msg.sender != controller) revert MarketYield__NotController(msg.sender);
        _;
    }

    function recordShares(uint256 marketId, address participant, uint256 newShares)
        external onlyController
    {
        _settle(marketId, participant);

        MarketYieldState storage m = _markets[marketId];
        ParticipantPosition storage pos = _positions[marketId][participant];

        m.totalShares = m.totalShares - pos.shares + newShares;
        pos.shares = newShares;

        emit SharesUpdated(marketId, participant, newShares);
    }

    function _settle(uint256 marketId, address participant) internal {
        ParticipantPosition storage pos = _positions[marketId][participant];
        MarketYieldState storage m = _markets[marketId];

        if (pos.shares > 0 && m.yieldPerShareIndex > pos.lastIndex) {
            uint256 delta = m.yieldPerShareIndex - pos.lastIndex;
            uint256 newlyAccrued = pos.shares.mul(delta).div(ONE);
            pos.owedUnclaimed += newlyAccrued;
        }

        pos.lastIndex = m.yieldPerShareIndex;
    }

    function depositYield(uint256 marketId, YieldType yieldType)
        external payable onlyController
    {
        if (msg.value == 0) revert MarketYield__ZeroAmount();

        MarketYieldState storage m = _markets[marketId];
        if (m.totalShares == 0) revert MarketYield__NoShareholders();

        uint256 indexDelta = msg.value.mul(ONE).div(m.totalShares);
        m.yieldPerShareIndex += indexDelta;

        m.totalYieldDistributed += msg.value;
        m.lastDistributionTimestamp = block.timestamp;
        m.distributionCount += 1;

        yieldByType[marketId][yieldType] += msg.value;

        _distributionHistory[marketId].push(
            DistributionRecord({
                marketId: marketId,
                yieldType: yieldType,
                amount: msg.value,
                totalSharesAtDistribution: m.totalShares,
                timestamp: block.timestamp
            })
        );

        emit YieldDeposited(marketId, yieldType, msg.value, m.totalShares);
    }

    function claimableYield(uint256 marketId, address participant) public view returns (uint256) {
        ParticipantPosition storage pos = _positions[marketId][participant];
        MarketYieldState storage m = _markets[marketId];

        uint256 freshlyAccrued = 0;
        if (pos.shares > 0 && m.yieldPerShareIndex > pos.lastIndex) {
            uint256 delta = m.yieldPerShareIndex - pos.lastIndex;
            freshlyAccrued = pos.shares.mul(delta).div(ONE);
        }

        return pos.owedUnclaimed + freshlyAccrued;
    }

    function claimYield(uint256 marketId) external returns (uint256 amount) {
        amount = claimableYield(marketId, msg.sender);
        if (amount == 0) revert MarketYield__NothingToClaim();

        ParticipantPosition storage pos = _positions[marketId][msg.sender];
        MarketYieldState storage m = _markets[marketId];

        pos.lastIndex = m.yieldPerShareIndex;
        pos.owedUnclaimed = 0;
        pos.claimedTotal += amount;

        if (address(this).balance < amount) {
            revert MarketYield__InsufficientFunds(amount, address(this).balance);
        }

        emit YieldClaimed(marketId, msg.sender, amount);

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "MarketYield: transfer failed");
    }

    function effectiveAnnualRate(uint256 marketId) external view returns (uint256) {
        MarketYieldState storage m = _markets[marketId];
        if (m.totalShares == 0 || m.distributionCount == 0) return 0;

        DistributionRecord[] storage hist = _distributionHistory[marketId];
        uint256 firstTimestamp = hist[0].timestamp;
        uint256 elapsed = block.timestamp - firstTimestamp;
        if (elapsed == 0) return 0;

        uint256 yieldPerShare = m.totalYieldDistributed.mul(ONE).div(m.totalShares);
        uint256 annualizationFactor = (365 days * ONE) / elapsed;
        return yieldPerShare.mul(annualizationFactor).div(ONE);
    }

    function getMarketYieldState(uint256 marketId) external view returns (MarketYieldState memory) {
        return _markets[marketId];
    }

    function getPosition(uint256 marketId, address participant)
        external view returns (ParticipantPosition memory)
    {
        return _positions[marketId][participant];
    }

    function getDistributionHistory(uint256 marketId)
        external view returns (DistributionRecord[] memory)
    {
        return _distributionHistory[marketId];
    }

    function getDistributionCount(uint256 marketId) external view returns (uint256) {
        return _distributionHistory[marketId].length;
    }

    function totalYieldDistributed(uint256 marketId) external view returns (uint256) {
        return _markets[marketId].totalYieldDistributed;
    }

    function yieldDistributedByType(uint256 marketId, YieldType yieldType)
        external view returns (uint256)
    {
        return yieldByType[marketId][yieldType];
    }

    function totalShares(uint256 marketId) external view returns (uint256) {
        return _markets[marketId].totalShares;
    }

    receive() external payable {}
}