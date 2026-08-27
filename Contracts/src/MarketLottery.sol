// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
    NOTE: This repository already references Chainlink VRF in requirements,
    but there is no existing VRF interface/implementation visible in the current
    file set we can align to.

    This contract implements the *lottery logic* and exposes Chainlink-style
    entrypoints (requestRandomWinner / fulfillRandomWords) expected by the
    tests we add.

    The test will use a lightweight VRF mock pattern by directly calling
    fulfillRandomWords.
*/
contract MarketLottery is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------- Errors --------------------
    error TicketPriceZero();
    error PrizeTokenZero();
    error NoTickets();
    error RoundNotOpen();
    error RoundAlreadyRequested();
    error RoundAlreadyFinalized();
    error InvalidWinnerCount();
    error NothingToWithdraw();
    error NotWinner();

    // -------------------- Types --------------------

    struct Ticket {
        address account;
        uint256 tickets; // number of tickets this ticket entry represents
    }

    struct Round {
        uint256 roundId;
        uint256 startedAt;
        uint256 endsAt;
        uint256 ticketPrice; // wei or smallest unit of entry currency (ETH in this default)
        uint256 totalTickets;
        uint256 prizeBalance; // prize token available for this round (snapshot)
        bool open;
        bool randomRequested;
        bool finalized;
        uint256 winnerCount;
        uint256[] winners; // ticket index winners (0-based over totalTickets)
        mapping(uint256 => uint256) _winnerTicketCounts; // winner index => how many ticket shares they had (for accounting)
    }

    // Round history (append-only)
    struct LotteryHistory {
        uint256 roundId;
        uint256 startedAt;
        uint256 endsAt;
        uint256 totalTickets;
        uint256 prizeBalance;
        uint256 winnerCount;
        address[] winners;
        uint256[] winTicketIndices;
        uint256[] prizeAmounts;
    }

    // -------------------- State --------------------

    IERC20 public immutable prizeToken;

    uint256 public currentRoundId;

    // roundId => tickets (expanded by ticket count entries; we store compressed ranges via array of Ticket)
    mapping(uint256 => Ticket[]) private _tickets;

    // roundId => list of buyer accounts repeated by ticket entries? (not expanded)

    // roundId => requested randomness id (chainlink-like)
    mapping(uint256 => uint256) public requestIdToRoundId;

    // roundId => randomness state
    mapping(uint256 => uint256) public roundRandomSeed;

    // roundId => ended
    mapping(uint256 => Round) private _rounds;

    // winner calculation uses a flattened cumulative distribution of ticket counts
    mapping(uint256 => uint256[]) private _cumulativeTicketWeights; // roundId => prefix sums (length = tickets.length)

    // winner payouts
    mapping(uint256 => mapping(address => uint256)) public claimablePrizeByRound;

    mapping(uint256 => LotteryHistory) private _history;
    uint256 public historyCount;

    // -------------------- Events --------------------

    event RoundStarted(
        uint256 indexed roundId,
        uint256 startedAt,
        uint256 endsAt,
        uint256 ticketPrice,
        uint256 winnerCount
    );

    event TicketsEntered(uint256 indexed roundId, address indexed account, uint256 ticketCount, uint256 amountPaid);

    event RandomWinnerRequested(uint256 indexed roundId, uint256 requestId);
    event WinnersFinalized(uint256 indexed roundId, address[] winners, uint256[] winTicketIndices, uint256[] prizeAmounts);
    event PrizeClaimed(uint256 indexed roundId, address indexed account, uint256 amount);

    // -------------------- Constructor --------------------

    constructor(address _prizeToken) Ownable(msg.sender) {
        if (_prizeToken == address(0)) revert PrizeTokenZero();
        prizeToken = IERC20(_prizeToken);
    }

    // -------------------- Lottery Admin --------------------

    /// @notice Starts a new lottery round. Closes any existing round.
    /// @dev This default implementation uses ETH for ticket entries.
    function startRound(
        uint256 durationSeconds,
        uint256 _ticketPriceWei,
        uint256 _winnerCount
    ) external onlyOwner returns (uint256 roundId) {
        if (_ticketPriceWei == 0) revert TicketPriceZero();
        if (_winnerCount == 0) revert InvalidWinnerCount();
        // allow any winnerCount; tests will use 1

        roundId = ++currentRoundId;

        Round storage r = _rounds[roundId];
        r.roundId = roundId;
        r.startedAt = block.timestamp;
        r.endsAt = block.timestamp + durationSeconds;
        r.ticketPrice = _ticketPriceWei;
        r.totalTickets = 0;
        r.prizeBalance = 0;
        r.open = true;
        r.randomRequested = false;
        r.finalized = false;
        r.winnerCount = _winnerCount;

        // reset cumulative distribution storage
        delete _cumulativeTicketWeights[roundId];

        emit RoundStarted(roundId, r.startedAt, r.endsAt, _ticketPriceWei, _winnerCount);
    }

    /// @notice Fund prize tokens for the current or a specific round.
    /// @dev Admin can pre-fund to ensure enough prize tokens.
    function fundPrize(uint256 roundId, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert NothingToWithdraw();
        // Transfer into contract then snapshot when finalizing
        prizeToken.safeTransferFrom(msg.sender, address(this), amount);
        _rounds[roundId].prizeBalance += amount;
    }

    // -------------------- Entry --------------------

    /// @notice Enter by paying ETH. Each ticket costs `ticketPrice`.
    function enter(uint256 ticketCount) external payable nonReentrant {
        Round storage r = _rounds[currentRoundId];
        if (!r.open) revert RoundNotOpen();
        if (block.timestamp > r.endsAt) revert RoundNotOpen();

        uint256 cost = r.ticketPrice * ticketCount;
        require(msg.value == cost, "BAD_VALUE");
        if (ticketCount == 0) return;

        r.totalTickets += ticketCount;

        _tickets[currentRoundId].push(Ticket({account: msg.sender, tickets: ticketCount}));

        emit TicketsEntered(currentRoundId, msg.sender, ticketCount, cost);
    }

    // -------------------- Randomness / Winners --------------------

    /// @notice Admin requests randomness. In real usage this would call Chainlink VRF.
    /// @dev Here we expose the interface and let the test call fulfillRandomWords.
    function requestRandomWinner() external onlyOwner returns (uint256 requestId) {
        Round storage r = _rounds[currentRoundId];
        if (!r.open) revert RoundNotOpen();
        if (block.timestamp <= r.endsAt) revert RoundNotOpen();
        if (r.randomRequested) revert RoundAlreadyRequested();

        if (r.totalTickets == 0) revert NoTickets();

        // build cumulative weights
        _buildCumulative(currentRoundId);

        r.randomRequested = true;
        requestId = uint256(
            keccak256(abi.encode(blockhash(block.number - 1), currentRoundId, address(this), r.totalTickets))
        );
        requestIdToRoundId[requestId] = currentRoundId;
        emit RandomWinnerRequested(currentRoundId, requestId);
    }

    function fulfillRandomWords(uint256 requestId, uint256 randomSeed) external onlyOwner {
        uint256 roundId = requestIdToRoundId[requestId];
        Round storage r = _rounds[roundId];
        if (!r.randomRequested) revert RoundAlreadyFinalized();
        if (r.finalized) revert RoundAlreadyFinalized();

        roundRandomSeed[roundId] = randomSeed;

        // finalize winners and distribute prize
        _finalize(roundId, randomSeed);
    }

    function _buildCumulative(uint256 roundId) internal {
        Ticket[] storage ts = _tickets[roundId];
        delete _cumulativeTicketWeights[roundId];
        uint256 running;
        uint256 len = ts.length;
        for (uint256 i; i < len; ++i) {
            running += ts[i].tickets;
            _cumulativeTicketWeights[roundId].push(running);
        }
    }

    function _pickWinner(uint256 roundId, uint256 ticketIndex) internal view returns (address winner) {
        // ticketIndex is 0-based in [0, totalTickets)
        uint256[] storage cum = _cumulativeTicketWeights[roundId];
        uint256 lo = 0;
        uint256 hi = cum.length; // exclusive
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (ticketIndex < cum[mid]) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        Ticket[] storage ts = _tickets[roundId];
        winner = ts[lo].account;
    }

    function _finalize(uint256 roundId, uint256 seed) internal {
        Round storage r = _rounds[roundId];
        r.finalized = true;
        r.open = false;

        uint256 prizeAmount = r.prizeBalance;
        if (prizeAmount == 0) {
            // no prize funded; nothing to distribute
            prizeAmount = prizeAmount;
        }

        uint256 winnerCount = r.winnerCount;
        if (winnerCount > r.totalTickets) {
            winnerCount = r.totalTickets;
        }

        // pick winners (ticket share selection without requiring distinct addresses)
        r.winners = new uint256[](winnerCount);
        uint256[] memory winTicketIndices = new uint256[](winnerCount);
        address[] memory winners = new address[](winnerCount);
        uint256[] memory prizeAmounts = new uint256[](winnerCount);

        // equal split among winners
        uint256 each = prizeAmount / winnerCount;
        uint256 dust = prizeAmount - (each * winnerCount);

        for (uint256 i; i < winnerCount; ++i) {
            // pseudo-random ticket index
            uint256 mix = uint256(keccak256(abi.encode(seed, i, roundId)));
            uint256 ticketIndex = mix % r.totalTickets;
            winTicketIndices[i] = ticketIndex;
            address winner = _pickWinner(roundId, ticketIndex);
            winners[i] = winner;

            uint256 payout = each;
            if (i == 0) payout += dust;
            prizeAmounts[i] = payout;

            claimablePrizeByRound[roundId][winner] += payout;
        }

        // write history
        address[] memory historyWinners = winners;
        uint256[] memory historyWinIdx = winTicketIndices;
        uint256[] memory historyPrize = prizeAmounts;

        LotteryHistory storage h = _history[roundId];
        h.roundId = roundId;
        h.startedAt = r.startedAt;
        h.endsAt = r.endsAt;
        h.totalTickets = r.totalTickets;
        h.prizeBalance = r.prizeBalance;
        h.winnerCount = r.winnerCount;
        h.winners = historyWinners;
        h.winTicketIndices = historyWinIdx;
        h.prizeAmounts = historyPrize;

        historyCount = (roundId > historyCount) ? roundId : historyCount;

        emit WinnersFinalized(roundId, winners, winTicketIndices, prizeAmounts);
    }

    // -------------------- Claim / Queries --------------------

    function claim(uint256 roundId) external nonReentrant {
        Round storage r = _rounds[roundId];
        require(r.finalized, "NOT_FINAL");

        uint256 amount = claimablePrizeByRound[roundId][msg.sender];
        if (amount == 0) revert NotWinner();
        claimablePrizeByRound[roundId][msg.sender] = 0;

        prizeToken.safeTransfer(msg.sender, amount);
        emit PrizeClaimed(roundId, msg.sender, amount);
    }

    function getTickets(uint256 roundId) external view returns (Ticket[] memory) {
        return _tickets[roundId];
    }

    function getHistory(uint256 roundId)
        external
        view
        returns (
            uint256 startedAt,
            uint256 endsAt,
            uint256 totalTickets,
            uint256 prizeBalance,
            uint256 winnerCount,
            address[] memory winners,
            uint256[] memory winTicketIndices,
            uint256[] memory prizeAmounts
        )
    {
        LotteryHistory storage h = _history[roundId];
        return (
            h.startedAt,
            h.endsAt,
            h.totalTickets,
            h.prizeBalance,
            h.winnerCount,
            h.winners,
            h.winTicketIndices,
            h.prizeAmounts
        );
    }

    function roundStatus(uint256 roundId)
        external
        view
        returns (
            bool open,
            bool randomRequested,
            bool finalized,
            uint256 ticketPrice,
            uint256 totalTickets,
            uint256 prizeBalance,
            uint256 endsAt,
            uint256 winnerCount
        )
    {
        Round storage r = _rounds[roundId];
        return (
            r.open,
            r.randomRequested,
            r.finalized,
            r.ticketPrice,
            r.totalTickets,
            r.prizeBalance,
            r.endsAt,
            r.winnerCount
        );
    }

    function withdrawUnallocated(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert NothingToWithdraw();
        prizeToken.safeTransfer(msg.sender, amount);
    }

    // -------------------- Helpers --------------------

    function roundrIdSafe(uint256 x) internal pure returns (uint256) {
        return x;
    }
}

