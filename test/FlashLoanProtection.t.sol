// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/FlashLoanProtection.sol";

contract Malicious {
    FlashLoanProtection public target;

    constructor(FlashLoanProtection _target) {
        target = _target;
    }

    function attack(uint256 amount) external {
        // Forward call to the protected contract - simulates a contract-originated call
        target.protectedAction(amount);
    }
}

contract FlashLoanProtectionTest is Test {
    FlashLoanProtection fp;
    address owner = address(0x1);
    address attacker = address(0x2);
    address user = address(0x3);

    function setUp() public {
        vm.prank(owner);
        fp = new FlashLoanProtection();
    }

    function test_eoaAllowed() public {
        vm.prank(user);
        bool ok = fp.protectedAction(100);
        assertTrue(ok);

        assertEq(fp.loanCount(user), 1);
        assertEq(fp.lastLoanBlock(user), block.number);
    }

    function test_unapprovedContractReverts() public {
        vm.prank(attacker);
        Malicious mal = new Malicious(fp);

        vm.prank(attacker);
        vm.expectRevert(bytes("FlashLoanProtection: unapproved contract caller"));
        mal.attack(50);
    }

    function test_approveAllowsContract() public {
        vm.prank(attacker);
        Malicious mal = new Malicious(fp);

        // Approve the malicious contract as legitimate
        vm.prank(owner);
        fp.approveContract(address(mal));

        vm.prank(attacker);
        mal.attack(77);

        // Activity should be tracked for tx.origin (attacker)
        assertEq(fp.loanCount(attacker), 1);
        assertEq(fp.lastLoanBlock(attacker), block.number);
        assertTrue(fp.isApproved(address(mal)));
    }

    function test_revokePreventsAgain() public {
        vm.prank(attacker);
        Malicious mal = new Malicious(fp);

        vm.prank(owner);
        fp.approveContract(address(mal));

        vm.prank(attacker);
        mal.attack(5);

        vm.prank(owner);
        fp.revokeContract(address(mal));

        vm.prank(attacker);
        vm.expectRevert(bytes("FlashLoanProtection: unapproved contract caller"));
        mal.attack(6);
    }
}
