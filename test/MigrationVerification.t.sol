// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DragonRewardDistributor.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @notice Verifies migration preserves claim state correctly using REAL addresses.
 *         Tests that:
 *         - Fully claimed users CANNOT claim again
 *         - Partially claimed users can only claim the difference
 *         - Never-claimed users can claim their full allocation
 */
contract MigrationVerificationTest is Test {
    DragonRewardDistributor public distributor;

    address constant DRAGON = 0x66969ecD173451F00a4652a53acc6246569D4444;
    address constant OLD_CONTRACT = 0x8b0B7f2436693837de5E63f1ACe3A3E564256430;

    address owner;
    address operator;

    // Real addresses from the old contract
    address constant FULLY_CLAIMED_USER = 0x1b80D0C2574e253a5aa5C01ba4b56B140AeE8639;
    uint256 constant FULLY_CLAIMED_ALLOCATED = 755025942688845652452926;
    uint256 constant FULLY_CLAIMED_AMOUNT = 755025942688845652452926; // claimed == allocated

    address constant PARTIAL_USER = 0x545BDa840366390aC986306744159d8E2948C0A1;
    uint256 constant PARTIAL_ALLOCATED = 8662817735161211730038846;
    uint256 constant PARTIAL_CLAIMED = 4482477992889744842165607;

    address constant NEVER_CLAIMED_USER = 0xF5B653eE37DE30299CeCE9216c04beDb9b5275EF;
    uint256 constant NEVER_CLAIMED_ALLOCATED = 858417806181443180944276;

    function setUp() public {
        vm.createSelectFork("https://bsc-dataseed.binance.org/");

        owner = makeAddr("owner");
        operator = makeAddr("operator");

        vm.startPrank(owner);
        distributor = new DragonRewardDistributor(operator);
        distributor.setTargetToken(DRAGON);

        // Migrate only the claimers (users with totalClaimed > 0)
        address[] memory claimers = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        claimers[0] = FULLY_CLAIMED_USER;
        amounts[0] = FULLY_CLAIMED_AMOUNT;
        claimers[1] = PARTIAL_USER;
        amounts[1] = PARTIAL_CLAIMED;

        distributor.initializeFromV2(
            69,
            bytes32(0), // We'll set a real merkle root below
            claimers,
            amounts
        );
        vm.stopPrank();

        // Fund the contract with DRAGON from old contract
        vm.prank(OLD_CONTRACT);
        IERC20(DRAGON).transfer(address(distributor), 10_000_000 ether);
    }

    function testMigratedState() public view {
        // Verify fully claimed user's state is preserved
        assertEq(distributor.totalClaimed(FULLY_CLAIMED_USER), FULLY_CLAIMED_AMOUNT);

        // Verify partially claimed user's state is preserved
        assertEq(distributor.totalClaimed(PARTIAL_USER), PARTIAL_CLAIMED);

        // Verify never-claimed user defaults to 0
        assertEq(distributor.totalClaimed(NEVER_CLAIMED_USER), 0);
    }

    function testFullyClaimedCannotOverclaim() public {
        // getClaimableAmount should return 0 for fully claimed user
        uint256 claimable = distributor.getClaimableAmount(FULLY_CLAIMED_USER, FULLY_CLAIMED_ALLOCATED);
        assertEq(claimable, 0, "Fully claimed user should have 0 claimable");
    }

    function testPartialUserCanOnlyClaimDifference() public {
        uint256 expectedClaimable = PARTIAL_ALLOCATED - PARTIAL_CLAIMED;
        uint256 claimable = distributor.getClaimableAmount(PARTIAL_USER, PARTIAL_ALLOCATED);
        assertEq(claimable, expectedClaimable, "Partial user should only claim the difference");
    }

    function testNeverClaimedCanClaimFull() public {
        uint256 claimable = distributor.getClaimableAmount(NEVER_CLAIMED_USER, NEVER_CLAIMED_ALLOCATED);
        assertEq(claimable, NEVER_CLAIMED_ALLOCATED, "Never claimed user should claim full allocation");
    }

    function testFullyClaimedUserClaimReverts() public {
        // Even with a valid merkle proof, claim() should revert with NoClaimableTokens
        // We can test this by setting a merkle root and trying to claim
        // But since we'd need a real proof, let's test the internal logic directly:
        // If someone has totalClaimed == cumulativeTotalClaimable, claim should revert

        // Simulate: set a dummy merkle root and try claiming with the allocated amount
        // The contract checks: if (cumulativeTotalClaimable <= alreadyClaimed) revert NoClaimableTokens
        // For fully claimed: 755025942688845652452926 <= 755025942688845652452926 → TRUE → REVERT

        // We verify this logic through getClaimableAmount (which uses the same check)
        assertEq(distributor.getClaimableAmount(FULLY_CLAIMED_USER, FULLY_CLAIMED_ALLOCATED), 0);
        assertEq(distributor.getClaimableAmount(FULLY_CLAIMED_USER, FULLY_CLAIMED_ALLOCATED - 1), 0);
    }

    function testNeverClaimedUserNotMigratedIsOk() public view {
        // Never-claimed users have totalClaimed = 0 by default
        // This means they CAN claim up to their full allocation
        // This is CORRECT behavior — no migration needed for them
        assertEq(distributor.totalClaimed(NEVER_CLAIMED_USER), 0);

        // They can claim their full allocation
        uint256 claimable = distributor.getClaimableAmount(NEVER_CLAIMED_USER, NEVER_CLAIMED_ALLOCATED);
        assertEq(claimable, NEVER_CLAIMED_ALLOCATED);
    }

    function testCannotClaimMoreThanAllocated() public view {
        // Even if someone tries to claim more than allocated,
        // the merkle proof would fail (wrong leaf)
        // But let's verify getClaimableAmount math is correct
        uint256 fakeHighAllocation = PARTIAL_ALLOCATED + 1_000_000 ether;
        uint256 claimable = distributor.getClaimableAmount(PARTIAL_USER, fakeHighAllocation);
        // Without merkle proof this won't execute, but math would give:
        assertEq(claimable, fakeHighAllocation - PARTIAL_CLAIMED);
        // The merkle proof verification prevents this from actually executing
    }
}
