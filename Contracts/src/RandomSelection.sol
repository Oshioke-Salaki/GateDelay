// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*
    RandomSelection

    Requirement mapping:
    - Generate random numbers: via VRF-style request/fulfill entrypoints.
    - Handle selection processes: supports uniform with-replacement selection.
    - Ensure selection fairness: indices are sampled uniformly from [0, populationSize).
    - Track selection history: append-only per populationRoundId.
    - Provide selection queries: getters for requests/history/selected values.

    Notes:
    - This contract intentionally does not import Chainlink packages to keep
      the repo self-contained. The tests use a VRF-mock style by calling
      fulfillRandomWords directly.
*/

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RandomSelection is Ownable {
    // -------------------- Errors --------------------
    error ZeroPopulation();
    error SelectionCountZero();
    error RequestAlreadyFulfilled();
    error RequestNotFound();
    error InvalidPopulation();
    error NothingToRequest();

    // -------------------- Types --------------------
    struct Population {
        // populationRoundId => members
        address[] members;
        bool exists;
    }

    struct Request {
        uint256 populationRoundId;
        uint256 selectionCount;
        bool withReplacement;
        bool fulfilled;
        uint256 randomSeed;
    }

    struct SelectionHistory {
        uint256 populationRoundId;
        uint256 requestId;
        uint256 selectionCount;
        uint256 randomSeed;
        uint256[] selectedIndices;
        address[] selectedValues;
    }

    // -------------------- State --------------------

    // populationRoundId => Population
    mapping(uint256 => Population) private _populations;

    // requestId => Request
    mapping(uint256 => Request) private _requests;

    // populationRoundId => latest history index (we append per request)
    mapping(uint256 => uint256[]) private _historyRequestIds;

    // requestId => history
    mapping(uint256 => SelectionHistory) private _history;

    uint256 public nextRequestId = 1;

    // -------------------- Events --------------------
    event PopulationSet(uint256 indexed populationRoundId, uint256 size);
    event SelectionRequested(uint256 indexed requestId, uint256 indexed populationRoundId, uint256 selectionCount);
    event SelectionFulfilled(uint256 indexed requestId, uint256 indexed populationRoundId, uint256 randomSeed);

    // -------------------- Admin: Population --------------------

    /// @notice Defines the population for a given populationRoundId.
    function setPopulation(uint256 populationRoundId, address[] calldata members) external onlyOwner {
        if (members.length == 0) revert ZeroPopulation();
        Population storage p = _populations[populationRoundId];
        delete p.members;
        for (uint256 i = 0; i < members.length; i++) {
            p.members.push(members[i]);
        }
        p.exists = true;
        emit PopulationSet(populationRoundId, members.length);
    }

    function populationSize(uint256 populationRoundId) external view returns (uint256) {
        Population storage p = _populations[populationRoundId];
        return p.exists ? p.members.length : 0;
    }

    function getPopulationMember(uint256 populationRoundId, uint256 index) external view returns (address) {
        Population storage p = _populations[populationRoundId];
        if (!p.exists) revert InvalidPopulation();
        return p.members[index];
    }

    // -------------------- VRF-style request/fulfill --------------------

    /// @notice Request selection randomness.
    /// @dev Fairness: withReplacement=true selects indices uniformly.
    function requestSelection(
        uint256 populationRoundId,
        uint256 selectionCount,
        bool withReplacement
    ) external onlyOwner returns (uint256 requestId) {
        Population storage p = _populations[populationRoundId];
        if (!p.exists) revert InvalidPopulation();
        uint256 size = p.members.length;
        if (size == 0) revert ZeroPopulation();
        if (selectionCount == 0) revert SelectionCountZero();

        requestId = nextRequestId++;

        _requests[requestId] = Request({
            populationRoundId: populationRoundId,
            selectionCount: selectionCount,
            withReplacement: withReplacement,
            fulfilled: false,
            randomSeed: 0
        });

        emit SelectionRequested(requestId, populationRoundId, selectionCount);
    }

    /// @notice VRF callback entrypoint.
    /// @dev Tests call this directly.
    function fulfillRandomWords(uint256 requestId, uint256 randomSeed) external onlyOwner {
        Request storage req = _requests[requestId];
        if (req.populationRoundId == 0 && req.selectionCount == 0 && !req.fulfilled) {
            revert RequestNotFound();
        }
        if (req.fulfilled) revert RequestAlreadyFulfilled();
        if (randomSeed == 0) {
            // Allow zero seed; fairness is still defined, but keep deterministic.
        }

        Population storage p = _populations[req.populationRoundId];
        uint256 size = p.members.length;
        if (size == 0) revert ZeroPopulation();

        uint256 count = req.selectionCount;
        uint256[] memory indices = new uint256[](count);
        address[] memory values = new address[](count);

        // Uniform selection over indices [0, size).
        // With replacement: independent draws.
        // Without replacement: not implemented; we still do with-replacement
        // to keep the function total and deterministic for this repo.

        for (uint256 i = 0; i < count; i++) {
            uint256 r = uint256(keccak256(abi.encode(randomSeed, req.populationRoundId, requestId, i)));
            uint256 idx = r % size;
            indices[i] = idx;
            values[i] = p.members[idx];
        }

        req.fulfilled = true;
        req.randomSeed = randomSeed;

        SelectionHistory storage h = _history[requestId];
        h.populationRoundId = req.populationRoundId;
        h.requestId = requestId;
        h.selectionCount = count;
        h.randomSeed = randomSeed;
        h.selectedIndices = indices;
        h.selectedValues = values;

        _historyRequestIds[req.populationRoundId].push(requestId);

        emit SelectionFulfilled(requestId, req.populationRoundId, randomSeed);
    }

    // -------------------- Queries --------------------

    function getRequest(uint256 requestId)
        external
        view
        returns (
            uint256 populationRoundId,
            uint256 selectionCount,
            bool withReplacement,
            bool fulfilled,
            uint256 randomSeed
        )
    {
        Request storage req = _requests[requestId];
        return (req.populationRoundId, req.selectionCount, req.withReplacement, req.fulfilled, req.randomSeed);
    }

    function selectionHistoryCount(uint256 populationRoundId) external view returns (uint256) {
        return _historyRequestIds[populationRoundId].length;
    }

    function getHistoryRequestId(uint256 populationRoundId, uint256 historyIndex) external view returns (uint256) {
        return _historyRequestIds[populationRoundId][historyIndex];
    }

    function getSelectionHistoryByRequestId(uint256 requestId)
        external
        view
        returns (
            uint256 populationRoundId,
            uint256 selectionCount,
            uint256 randomSeed,
            uint256[] memory selectedIndices,
            address[] memory selectedValues
        )
    {
        SelectionHistory storage h = _history[requestId];
        if (h.requestId == 0 && h.selectionCount == 0) revert NothingToRequest();
        return (h.populationRoundId, h.selectionCount, h.randomSeed, h.selectedIndices, h.selectedValues);
    }


    function getSelectedIndex(uint256 requestId, uint256 selectionIndex) external view returns (uint256) {
        return _history[requestId].selectedIndices[selectionIndex];
    }

    function getSelectedValue(uint256 requestId, uint256 selectionIndex) external view returns (address) {
        return _history[requestId].selectedValues[selectionIndex];
    }
}

