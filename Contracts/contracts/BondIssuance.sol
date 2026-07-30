// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract BondIssuance is Ownable, Pausable, ReentrancyGuard {
    struct BondParams {
        uint256 id;
        address issuer;
        uint256 marketId;
        uint256 principal;       // wei
        uint256 annualRateBps;   // basis points, e.g. 500 = 5.00%
        uint256 tenorSeconds;    // duration from issuance to maturity
        uint256 issuedAt;
        uint256 maturityDate;
    }

    uint256 public minPrincipal = 0.01 ether;
    uint256 public maxPrincipal = 1000 ether;

    uint256 public minAnnualRateBps = 1;        // 0.01%
    uint256 public maxAnnualRateBps = 5000;     // 50.00%

    uint256 public minTenorSeconds = 1 days;
    uint256 public maxTenorSeconds = 5 * 365 days;

    mapping(uint256 => uint256) public marketIssuanceCap;
    mapping(uint256 => uint256) public marketIssuedTotal;

    uint256 private _nextBondId;
    mapping(uint256 => BondParams) private _bonds;
    mapping(address => uint256[]) private _issuerBonds;
    mapping(uint256 => uint256[]) private _marketBonds;

    uint256 public totalPrincipalIssued;

    event BondIssuanceCreated(
        uint256 indexed bondId,
        address indexed issuer,
        uint256 indexed marketId,
        uint256 principal,
        uint256 annualRateBps,
        uint256 tenorSeconds,
        uint256 maturityDate
    );

    event IssuanceLimitsUpdated(
        uint256 minPrincipal,
        uint256 maxPrincipal,
        uint256 minAnnualRateBps,
        uint256 maxAnnualRateBps,
        uint256 minTenorSeconds,
        uint256 maxTenorSeconds
    );

    event MarketCapUpdated(uint256 indexed marketId, uint256 cap);

    error BondIssuance__PrincipalOutOfRange(uint256 value, uint256 min, uint256 max);
    error BondIssuance__RateOutOfRange(uint256 value, uint256 min, uint256 max);
    error BondIssuance__TenorOutOfRange(uint256 value, uint256 min, uint256 max);
    error BondIssuance__MarketCapExceeded(uint256 marketId, uint256 attempted, uint256 cap);
    error BondIssuance__InvalidMarket();
    error BondIssuance__InvalidLimits();
    error BondIssuance__ZeroValue();
    error BondIssuance__BondNotFound(uint256 bondId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function createBond(
        uint256 marketId,
        uint256 annualRateBps,
        uint256 tenorSeconds
    ) external payable whenNotPaused nonReentrant returns (uint256 bondId) {
        uint256 principal = msg.value;

        _validateIssuance(marketId, principal, annualRateBps, tenorSeconds);

        bondId = ++_nextBondId;
        uint256 issuedAt = block.timestamp;
        uint256 maturityDate = issuedAt + tenorSeconds;

        _bonds[bondId] = BondParams({
            id: bondId,
            issuer: msg.sender,
            marketId: marketId,
            principal: principal,
            annualRateBps: annualRateBps,
            tenorSeconds: tenorSeconds,
            issuedAt: issuedAt,
            maturityDate: maturityDate
        });

        _issuerBonds[msg.sender].push(bondId);
        _marketBonds[marketId].push(bondId);

        marketIssuedTotal[marketId] += principal;
        totalPrincipalIssued += principal;

        emit BondIssuanceCreated(
            bondId, msg.sender, marketId, principal, annualRateBps, tenorSeconds, maturityDate
        );
    }

    function _validateIssuance(
        uint256 marketId,
        uint256 principal,
        uint256 annualRateBps,
        uint256 tenorSeconds
    ) internal view {
        if (marketId == 0) revert BondIssuance__InvalidMarket();

        if (principal == 0) revert BondIssuance__ZeroValue();
        if (principal < minPrincipal || principal > maxPrincipal) {
            revert BondIssuance__PrincipalOutOfRange(principal, minPrincipal, maxPrincipal);
        }

        if (annualRateBps < minAnnualRateBps || annualRateBps > maxAnnualRateBps) {
            revert BondIssuance__RateOutOfRange(annualRateBps, minAnnualRateBps, maxAnnualRateBps);
        }

        if (tenorSeconds < minTenorSeconds || tenorSeconds > maxTenorSeconds) {
            revert BondIssuance__TenorOutOfRange(tenorSeconds, minTenorSeconds, maxTenorSeconds);
        }

        uint256 cap = marketIssuanceCap[marketId];
        if (cap != 0) {
            uint256 prospectiveTotal = marketIssuedTotal[marketId] + principal;
            if (prospectiveTotal > cap) {
                revert BondIssuance__MarketCapExceeded(marketId, prospectiveTotal, cap);
            }
        }
    }

    function setIssuanceLimits(
        uint256 _minPrincipal,
        uint256 _maxPrincipal,
        uint256 _minAnnualRateBps,
        uint256 _maxAnnualRateBps,
        uint256 _minTenorSeconds,
        uint256 _maxTenorSeconds
    ) external onlyOwner {
        if (
            _minPrincipal > _maxPrincipal ||
            _minAnnualRateBps > _maxAnnualRateBps ||
            _minTenorSeconds > _maxTenorSeconds
        ) revert BondIssuance__InvalidLimits();

        minPrincipal = _minPrincipal;
        maxPrincipal = _maxPrincipal;
        minAnnualRateBps = _minAnnualRateBps;
        maxAnnualRateBps = _maxAnnualRateBps;
        minTenorSeconds = _minTenorSeconds;
        maxTenorSeconds = _maxTenorSeconds;

        emit IssuanceLimitsUpdated(
            _minPrincipal, _maxPrincipal, _minAnnualRateBps, _maxAnnualRateBps,
            _minTenorSeconds, _maxTenorSeconds
        );
    }

    function setMarketIssuanceCap(uint256 marketId, uint256 cap) external onlyOwner {
        if (marketId == 0) revert BondIssuance__InvalidMarket();
        marketIssuanceCap[marketId] = cap;
        emit MarketCapUpdated(marketId, cap);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function sweep(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert BondIssuance__ZeroValue();
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "BondIssuance: sweep failed");
    }

    function getBondParams(uint256 bondId) external view returns (BondParams memory) {
        if (bondId == 0 || bondId > _nextBondId) revert BondIssuance__BondNotFound(bondId);
        return _bonds[bondId];
    }

    function getBondsByIssuer(address issuer) external view returns (uint256[] memory) {
        return _issuerBonds[issuer];
    }

    function getBondsByMarket(uint256 marketId) external view returns (uint256[] memory) {
        return _marketBonds[marketId];
    }

    function totalBondsIssued() external view returns (uint256) {
        return _nextBondId;
    }

    function remainingMarketCapacity(uint256 marketId) external view returns (uint256) {
        uint256 cap = marketIssuanceCap[marketId];
        if (cap == 0) return type(uint256).max;
        uint256 issued = marketIssuedTotal[marketId];
        return issued >= cap ? 0 : cap - issued;
    }

    function wouldPassValidation(
        uint256 marketId,
        uint256 principal,
        uint256 annualRateBps,
        uint256 tenorSeconds
    ) external view returns (bool) {
        if (marketId == 0 || principal == 0) return false;
        if (principal < minPrincipal || principal > maxPrincipal) return false;
        if (annualRateBps < minAnnualRateBps || annualRateBps > maxAnnualRateBps) return false;
        if (tenorSeconds < minTenorSeconds || tenorSeconds > maxTenorSeconds) return false;

        uint256 cap = marketIssuanceCap[marketId];
        if (cap != 0 && marketIssuedTotal[marketId] + principal > cap) return false;

        return true;
    }

    receive() external payable {}
}