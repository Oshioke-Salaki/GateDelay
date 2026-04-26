// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PositionToken.sol";

/// @notice Helper contract that acts as the factory for tests
contract MockFactory {
    PositionToken public token;

    constructor() {
        token = new PositionToken(address(this));
    }

    function authorise(address market) external {
        token.authorise(market);
    }
}

/// @notice Helper that acts as an authorised minter (market)
contract MockMarket {
    PositionToken public token;

    constructor(PositionToken _token) {
        token = _token;
    }

    function mint(address to, uint256 id, uint256 amount) external {
        token.mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external {
        token.mintBatch(to, ids, amounts, "");
    }

    function burn(address from, uint256 id, uint256 amount) external {
        token.burn(from, id, amount);
    }
}

contract PositionTokenTest is Test {
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
event TransferBatch(
    address indexed operator,
    address indexed from,
    address indexed to,
    uint256[] ids,
    uint256[] values
);

    MockFactory factory;
    PositionToken token;
    MockMarket market;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        factory = new MockFactory();
        token = factory.token();

        // Deploy a mock market and authorise it
        market = new MockMarket(token);
        factory.authorise(address(market));
    }

    // =========================================================================
    // Unit tests — task 1.7
    // =========================================================================

    // --- Deployment / authorisation ---

    function test_factory_isSet() public {
        assertEq(token.factory(), address(factory));
    }

    function test_authorise_setsAuthorised() public {
        address newMarket = address(0x1234);
        assertFalse(token.isAuthorised(newMarket));
        factory.authorise(newMarket);
        assertTrue(token.isAuthorised(newMarket));
    }

    function test_authorise_revertsIfNotFactory() public {
        vm.expectRevert(PositionToken.NotFactory.selector);
        token.authorise(address(0x9999));
    }

    // --- yesId / noId helpers ---

    function test_yesId_encoding() public {
        address m = address(0xDEAD);
        assertEq(token.yesId(m), (uint256(uint160(m)) << 1) | 1);
    }

    function test_noId_encoding() public {
        address m = address(0xDEAD);
        assertEq(token.noId(m), (uint256(uint160(m)) << 1) | 2);
    }

    // --- Mint ---

    function test_mint_increasesBalance() public {
        uint256 id = token.yesId(address(market));
        market.mint(alice, id, 100);
        assertEq(token.balanceOf(alice, id), 100);
    }

    function test_mint_increasesTotalSupply() public {
        uint256 id = token.yesId(address(market));
        market.mint(alice, id, 50);
        assertEq(token.totalSupply(id), 50);
    }

    /// Req 2.3 — TransferSingle event on mint
    function test_mint_emitsTransferSingle() public {
        uint256 id = token.yesId(address(market));
        vm.expectEmit(true, true, true, true);
        emit TransferSingle(address(market), address(0), alice, id, 77);
        market.mint(alice, id, 77);
    }

    /// Req 2.8 — UnauthorisedMinter
    function test_mint_revertsIfUnauthorised() public {
        vm.expectRevert(PositionToken.UnauthorisedMinter.selector);
        vm.prank(address(0xBAD));
        token.mint(alice, 1, 10, "");
    }

    // --- MintBatch ---

    function test_mintBatch_increasesBalances() public {
        uint256 yId = token.yesId(address(market));
        uint256 nId = token.noId(address(market));
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        ids[0] = yId;
        ids[1] = nId;
        amounts[0] = 30;
        amounts[1] = 70;
        market.mintBatch(alice, ids, amounts);
        assertEq(token.balanceOf(alice, yId), 30);
        assertEq(token.balanceOf(alice, nId), 70);
    }

    /// Req 2.6 — TransferBatch event on mintBatch
    function test_mintBatch_emitsTransferBatch() public {
        uint256 yId = token.yesId(address(market));
        uint256 nId = token.noId(address(market));
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        ids[0] = yId;
        ids[1] = nId;
        amounts[0] = 10;
        amounts[1] = 20;
        vm.expectEmit(true, true, true, true);
        emit TransferBatch(address(market), address(0), alice, ids, amounts);
        market.mintBatch(alice, ids, amounts);
    }

    /// Req 2.7 — ArrayLengthMismatch on unequal arrays
    function test_mintBatch_revertsOnLengthMismatch() public {
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = 1;
        ids[1] = 2;
        amounts[0] = 10;
        vm.expectRevert(PositionToken.ArrayLengthMismatch.selector);
        market.mintBatch(alice, ids, amounts);
    }

    /// Req 2.8 — UnauthorisedMinter on mintBatch
    function test_mintBatch_revertsIfUnauthorised() public {
        uint256[] memory ids = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0] = 1;
        amounts[0] = 10;
        vm.expectRevert(PositionToken.UnauthorisedMinter.selector);
        vm.prank(address(0xBAD));
        token.mintBatch(alice, ids, amounts, "");
    }

    // --- Burn ---

    function test_burn_decreasesBalance() public {
        uint256 id = token.yesId(address(market));
        market.mint(alice, id, 100);
        market.burn(alice, id, 40);
        assertEq(token.balanceOf(alice, id), 60);
    }

    function test_burn_decreasesTotalSupply() public {
        uint256 id = token.yesId(address(market));
        market.mint(alice, id, 100);
        market.burn(alice, id, 40);
        assertEq(token.totalSupply(id), 60);
    }

    /// Req 2.12 — InsufficientBalance on burn
    function test_burn_revertsOnInsufficientBalance() public {
        uint256 id = token.yesId(address(market));
        market.mint(alice, id, 10);
        vm.expectRevert(PositionToken.InsufficientBalance.selector);
        market.burn(alice, id, 11);
    }

    // --- Transfer ---

    /// Req 2.12 — InsufficientBalance on transfer
    function test_transfer_revertsOnInsufficientBalance() public {
        uint256 id = token.yesId(address(market));
        market.mint(alice, id, 5);
        vm.prank(alice);
        vm.expectRevert(PositionToken.InsufficientBalance.selector);
        token.safeTransferFrom(alice, bob, id, 10, "");
    }

    // --- balanceOfBatch ---

    /// Req 2.10 — balanceOfBatch with equal-length arrays
    function test_balanceOfBatch_equalArrays() public {
        uint256 yId = token.yesId(address(market));
        uint256 nId = token.noId(address(market));
        market.mint(alice, yId, 100);
        market.mint(bob, nId, 200);

        address[] memory accounts = new address[](2);
        uint256[] memory ids = new uint256[](2);
        accounts[0] = alice;
        accounts[1] = bob;
        ids[0] = yId;
        ids[1] = nId;

        uint256[] memory balances = token.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 100);
        assertEq(balances[1], 200);
    }

    /// Req 2.9 — balanceOfBatch reverts on unequal arrays
    function test_balanceOfBatch_revertsOnLengthMismatch() public {
        address[] memory accounts = new address[](2);
        uint256[] memory ids = new uint256[](1);
        accounts[0] = alice;
        accounts[1] = bob;
        ids[0] = 1;
        vm.expectRevert(PositionToken.ArrayLengthMismatch.selector);
        token.balanceOfBatch(accounts, ids);
    }

    // =========================================================================
    // Property-based fuzz tests
    // =========================================================================

    // Feature: prediction-market-contracts, Property 2: Mint increases recipient balance
    // Validates: Requirements 2.2
    function testFuzz_mint_increasesBalance(address recipient, uint128 amount) public {
        vm.assume(recipient != address(0));
        vm.assume(amount > 0);

        uint256 id = token.yesId(address(market));
        uint256 balanceBefore = token.balanceOf(recipient, id);
        market.mint(recipient, id, uint256(amount));
        uint256 balanceAfter = token.balanceOf(recipient, id);
        assertEq(balanceAfter, balanceBefore + uint256(amount));
    }

    // Feature: prediction-market-contracts, Property 3: Transfer preserves total supply
    // Validates: Requirements 2.4
    function testFuzz_transfer_preservesTotalSupply(uint128 mintAmount, uint128 transferAmount) public {
        vm.assume(mintAmount > 0);
        vm.assume(transferAmount > 0 && transferAmount <= mintAmount);

        uint256 id = token.yesId(address(market));
        market.mint(alice, id, uint256(mintAmount));

        uint256 supplyBefore = token.totalSupply(id);

        vm.prank(alice);
        token.safeTransferFrom(alice, bob, id, uint256(transferAmount), "");

        uint256 supplyAfter = token.totalSupply(id);
        assertEq(supplyAfter, supplyBefore);
    }

    // Feature: prediction-market-contracts, Property 4: Batch mint with equal-length arrays succeeds
    // Validates: Requirements 2.6
    function testFuzz_mintBatch_equalArrays(address recipient, uint64 amount0, uint64 amount1) public {
        vm.assume(recipient != address(0));
        vm.assume(amount0 > 0 && amount1 > 0);

        uint256 yId = token.yesId(address(market));
        uint256 nId = token.noId(address(market));

        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        ids[0] = yId;
        ids[1] = nId;
        amounts[0] = uint256(amount0);
        amounts[1] = uint256(amount1);

        uint256 yBefore = token.balanceOf(recipient, yId);
        uint256 nBefore = token.balanceOf(recipient, nId);

        market.mintBatch(recipient, ids, amounts);

        assertEq(token.balanceOf(recipient, yId), yBefore + uint256(amount0));
        assertEq(token.balanceOf(recipient, nId), nBefore + uint256(amount1));
    }

    // Feature: prediction-market-contracts, Property 5: Unauthorised mint always reverts
    // Validates: Requirements 2.8
    function testFuzz_unauthorisedMint_reverts(address caller, uint256 id, uint128 amount) public {
        vm.assume(caller != address(market)); // market is the only authorised minter
        vm.assume(amount > 0);

        vm.expectRevert(PositionToken.UnauthorisedMinter.selector);
        vm.prank(caller);
        token.mint(alice, id, uint256(amount), "");
    }

    // Feature: prediction-market-contracts, Property 6: Mint-then-burn round trip
    // Validates: Requirements 2.11
    function testFuzz_mintBurnRoundTrip(address holder, uint128 amount) public {
        vm.assume(holder != address(0));
        vm.assume(amount > 0);

        uint256 id = token.yesId(address(market));
        uint256 balanceBefore = token.balanceOf(holder, id);
        uint256 supplyBefore = token.totalSupply(id);

        market.mint(holder, id, uint256(amount));
        market.burn(holder, id, uint256(amount));

        assertEq(token.balanceOf(holder, id), balanceBefore);
        assertEq(token.totalSupply(id), supplyBefore);
    }
}
