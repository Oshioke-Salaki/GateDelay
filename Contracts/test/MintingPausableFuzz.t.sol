// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MintingPausable.sol";

/// @title MintingPausableFuzz
/// @notice Fuzz tests for minting pause boundaries and state transitions
/// @dev Tests #958: Fuzz supply limits, caps, pause states, and edge inputs under varied call sequences
contract MintingPausableFuzz is Test {
    MintingPausable internal token;
    address internal minter;
    address internal pauser;
    address internal emergencyPauser;
    address internal user1;
    address internal user2;

    function setUp() public {
        minter = makeAddr("minter");
        pauser = makeAddr("pauser");
        emergencyPauser = makeAddr("emergencyPauser");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        token = new MintingPausable("FuzzToken", "FUZZ");
        token.grantMinterRole(minter);
        token.grantPauserRole(pauser);
        token.grantEmergencyPauserRole(emergencyPauser);
    }

    /// @notice Fuzz test: Minting with varied amounts
    function testFuzz_Mint(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0));
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(minter);
        token.mint(recipient, amount);

        assertEq(token.balanceOf(recipient), amount, "Balance should match minted amount");
        assertEq(token.totalSupply(), amount, "Total supply should match");
    }

    /// @notice Fuzz test: Batch minting with varied inputs
    function testFuzz_BatchMint(
        uint8 batchSize,
        uint256 baseAmount
    ) public {
        batchSize = uint8(bound(batchSize, 1, 50)); // Reasonable batch size
        baseAmount = bound(baseAmount, 1, 1e24);

        address[] memory recipients = new address[](batchSize);
        uint256[] memory amounts = new uint256[](batchSize);
        uint256 expectedTotal = 0;

        for (uint256 i = 0; i < batchSize; i++) {
            recipients[i] = address(uint160(0x1000 + i));
            amounts[i] = baseAmount + i;
            expectedTotal += amounts[i];
        }

        vm.prank(minter);
        token.mintBatch(recipients, amounts);

        assertEq(token.totalSupply(), expectedTotal, "Total supply should match sum");
    }

    /// @notice Fuzz test: Pause and unpause cycles
    function testFuzz_PauseUnpauseCycle(uint8 cycles) public {
        cycles = uint8(bound(cycles, 1, 10));

        for (uint256 i = 0; i < cycles; i++) {
            // Pause
            vm.prank(pauser);
            token.pauseMinting("Test pause");
            assertTrue(token.isMintingPaused(), "Should be paused");

            // Verify mint is blocked
            vm.prank(minter);
            vm.expectRevert(bytes("MintingPausable: minting is paused"));
            token.mint(user1, 1 ether);

            // Unpause
            vm.prank(pauser);
            token.unpauseMinting("Test unpause");
            assertFalse(token.isMintingPaused(), "Should be unpaused");

            // Verify mint works
            vm.prank(minter);
            token.mint(user1, 1 ether);
        }

        assertEq(token.pauseCount, cycles, "Pause count should match cycles");
    }

    /// @notice Fuzz test: Minting during pause state
    function testFuzz_MintDuringPause(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0));
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(pauser);
        token.pauseMinting("Paused");

        vm.prank(minter);
        vm.expectRevert(bytes("MintingPausable: minting is paused"));
        token.mint(recipient, amount);
    }

    /// @notice Fuzz test: Batch minting during pause
    function testFuzz_BatchMintDuringPause(uint8 batchSize) public {
        batchSize = uint8(bound(batchSize, 1, 20));

        address[] memory recipients = new address[](batchSize);
        uint256[] memory amounts = new uint256[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            recipients[i] = address(uint160(0x2000 + i));
            amounts[i] = 1 ether + i;
        }

        vm.prank(pauser);
        token.pauseMinting("Batch test pause");

        vm.prank(minter);
        vm.expectRevert(bytes("MintingPausable: minting is paused"));
        token.mintBatch(recipients, amounts);
    }

    /// @notice Fuzz test: Transfers during pause
    function testFuzz_TransferDuringPause(uint256 mintAmount, uint256 transferAmount) public {
        mintAmount = bound(mintAmount, 1e18, type(uint128).max);
        transferAmount = bound(transferAmount, 1, mintAmount);

        // Mint before pause
        vm.prank(minter);
        token.mint(user1, mintAmount);

        // Pause
        vm.prank(pauser);
        token.pauseMinting("Transfer test");

        // Transfer should fail when paused
        vm.prank(user1);
        vm.expectRevert();
        token.transfer(user2, transferAmount);

        // Unpause and retry
        vm.prank(pauser);
        token.unpauseMinting("Unpause for transfer");

        vm.prank(user1);
        token.transfer(user2, transferAmount);
        assertEq(token.balanceOf(user2), transferAmount, "Transfer should succeed after unpause");
    }

    /// @notice Fuzz test: Emergency pause with varied timing
    function testFuzz_EmergencyPause(uint256 delaySeconds) public {
        delaySeconds = bound(delaySeconds, 0, 365 days);

        vm.warp(block.timestamp + delaySeconds);

        vm.prank(emergencyPauser);
        token.emergencyPause();

        assertTrue(token.isMintingPaused(), "Should be paused");
        assertEq(token.pausedAt, block.timestamp, "Paused timestamp should match");
    }

    /// @notice Fuzz test: Pause duration tracking
    function testFuzz_PauseDuration(uint256 pauseDuration) public {
        pauseDuration = bound(pauseDuration, 1, 365 days);

        vm.prank(pauser);
        token.pauseMinting("Duration test");

        uint256 pauseStart = block.timestamp;
        vm.warp(block.timestamp + pauseDuration);

        uint256 timeSincePause = token.getTimeSincePause();
        assertEq(timeSincePause, pauseDuration, "Duration should match");

        vm.prank(pauser);
        token.unpauseMinting("End duration test");
    }

    /// @notice Fuzz test: Multiple pause/unpause with minting
    function testFuzz_PauseMintSequence(
        uint8 sequences,
        uint256 mintPerSequence
    ) public {
        sequences = uint8(bound(sequences, 1, 5));
        mintPerSequence = bound(mintPerSequence, 1e18, 1e24);

        uint256 totalMinted = 0;

        for (uint256 i = 0; i < sequences; i++) {
            // Mint
            vm.prank(minter);
            token.mint(user1, mintPerSequence);
            totalMinted += mintPerSequence;

            // Pause
            vm.prank(pauser);
            token.pauseMinting("Sequence pause");

            // Try to mint (should fail)
            vm.prank(minter);
            vm.expectRevert(bytes("MintingPausable: minting is paused"));
            token.mint(user1, 1 ether);

            // Unpause
            vm.prank(pauser);
            token.unpauseMinting("Sequence unpause");
        }

        assertEq(token.totalSupply(), totalMinted, "Total supply should match");
    }

    /// @notice Fuzz test: Pause state transitions
    function testFuzz_PauseStateTransitions(bool[] memory pauseStates) public {
        vm.assume(pauseStates.length > 0 && pauseStates.length <= 20);

        bool currentState = false;

        for (uint256 i = 0; i < pauseStates.length; i++) {
            bool targetState = pauseStates[i];

            if (targetState && !currentState) {
                vm.prank(pauser);
                token.pauseMinting("State transition");
                currentState = true;
            } else if (!targetState && currentState) {
                vm.prank(pauser);
                token.unpauseMinting("State transition");
                currentState = false;
            }

            assertEq(token.isMintingPaused(), currentState, "State should match");
        }
    }

    /// @notice Fuzz test: Mint amounts at boundaries
    function testFuzz_MintBoundaries(uint256 amount) public {
        // Test very small amounts
        if (amount > 0 && amount < 1e10) {
            vm.prank(minter);
            token.mint(user1, amount);
            assertEq(token.balanceOf(user1), amount);
        }

        // Test very large amounts (bounded for safety)
        amount = bound(amount, 1e18, type(uint128).max);
        vm.prank(minter);
        token.mint(user2, amount);
        assertEq(token.balanceOf(user2), amount);
    }

    /// @notice Fuzz test: Batch size boundaries
    function testFuzz_BatchSizeBoundaries(uint16 size) public {
        size = uint16(bound(size, 1, 1000)); // Max batch size is 1000

        address[] memory recipients = new address[](size);
        uint256[] memory amounts = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            recipients[i] = address(uint160(0x3000 + i));
            amounts[i] = 1 ether;
        }

        vm.prank(minter);
        token.mintBatch(recipients, amounts);

        assertEq(token.totalSupply(), uint256(size) * 1 ether, "Supply should match batch");
    }

    /// @notice Fuzz test: Pause immediately after minting
    function testFuzz_PauseAfterMint(address recipient, uint256 amount) public {
        vm.assume(recipient != address(0));
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(minter);
        token.mint(recipient, amount);

        vm.prank(pauser);
        token.pauseMinting("Immediate pause");

        assertTrue(token.isMintingPaused());
        assertEq(token.balanceOf(recipient), amount);
    }

    /// @notice Fuzz test: Complex pause/mint/transfer sequence
    function testFuzz_ComplexSequence(
        uint256 mint1,
        uint256 mint2,
        uint256 transfer1,
        bool pause1,
        bool pause2
    ) public {
        mint1 = bound(mint1, 1e18, 1e24);
        mint2 = bound(mint2, 1e18, 1e24);
        transfer1 = bound(transfer1, 1, mint1);

        // Initial mint
        vm.prank(minter);
        token.mint(user1, mint1);

        // Optional pause 1
        if (pause1) {
            vm.prank(pauser);
            token.pauseMinting("Complex sequence pause 1");
            
            vm.prank(pauser);
            token.unpauseMinting("Complex sequence unpause 1");
        }

        // Second mint
        vm.prank(minter);
        token.mint(user2, mint2);

        // Optional pause 2
        if (pause2) {
            vm.prank(pauser);
            token.pauseMinting("Complex sequence pause 2");
            
            vm.prank(pauser);
            token.unpauseMinting("Complex sequence unpause 2");
        }

        // Transfer
        vm.prank(user1);
        token.transfer(user2, transfer1);

        assertEq(token.balanceOf(user2), mint2 + transfer1, "Final balance should match");
        assertEq(token.totalSupply(), mint1 + mint2, "Total supply should be preserved");
    }
}
