// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DragonRewardDistributor.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title ForkMainnetV4
 * @notice Tests against the LIVE deployed V4 contract on BSC mainnet.
 *         Verifies claim + deposit work correctly with real on-chain state.
 */
contract ForkMainnetV4 is Test {
    address constant NEW_CONTRACT = 0x70940516e85dd971FB042a0A504cD4735F80D60C;
    address constant DRAGON = 0x66969ecD173451F00a4652a53acc6246569D4444;
    address constant OWNER = 0x8869F458f63B801A59b733a7917B3229978ff915;
    address constant OPERATOR = 0xB9ef730E9b663087759cB1E9424caB8fEa2119AE;

    // A depositor wallet
    address constant DEPOSITOR = 0xB131471d3A848F96b4822277d4FCb526c404D594;

    // User who has claimed before (totalClaimed = 29272277598810109878548)
    address constant CLAIMER = 0x37De61085a5A5e1A86AAb35fB75DfB6D6A59ADe0;

    DragonRewardDistributor distributor;
    IERC20 dragon;

    function setUp() public {
        vm.createSelectFork(vm.envOr("RPC_URL", string("https://bsc-dataseed.binance.org/")));
        distributor = DragonRewardDistributor(NEW_CONTRACT);
        dragon = IERC20(DRAGON);
    }

    function testContractState() public view {
        assertEq(distributor.currentEpoch(), 69);
        assertEq(distributor.initialized(), true);
        assertEq(distributor.paused(), false);
        assertEq(distributor.owner(), OWNER);
        assertEq(distributor.operator(), OPERATOR);
        assertEq(distributor.targetToken(), DRAGON);

        // Contract should have ~19.1M DRAGON
        uint256 balance = dragon.balanceOf(NEW_CONTRACT);
        assertGt(balance, 19_000_000 ether, "Contract should have >19M DRAGON");
    }

    function testDepositorIsSet() public view {
        assertTrue(distributor.isDepositor(DEPOSITOR));
    }

    function testTotalClaimedMigrated() public view {
        // Verify the user who claimed an hour ago
        uint256 claimed = distributor.totalClaimed(CLAIMER);
        assertEq(claimed, 29272277598810109878548);
    }

    function testDepositAndBurn() public {
        uint256 depositAmount = 100_000 ether;

        // Give depositor some DRAGON (deal cheatcode)
        deal(DRAGON, DEPOSITOR, depositAmount);

        // Approve
        vm.prank(DEPOSITOR);
        dragon.approve(NEW_CONTRACT, depositAmount);

        // Get state before
        uint256 epochBefore = distributor.currentEpoch();
        uint256 contractBalBefore = dragon.balanceOf(NEW_CONTRACT);

        // Deposit
        vm.prank(DEPOSITOR);
        distributor.depositAndBurn(depositAmount);

        // 80% goes to contract, 20% burned
        uint256 expectedDistribute = depositAmount * 80 / 100;
        uint256 contractBalAfter = dragon.balanceOf(NEW_CONTRACT);

        assertEq(contractBalAfter, contractBalBefore + expectedDistribute);
        // Epoch doesn't change on deposit — only on updateMerkleRoot
        assertEq(distributor.currentEpoch(), epochBefore);
    }

    function testUpdateMerkleRootAfterDeposit() public {
        uint256 depositAmount = 100_000 ether;

        // Deposit first
        deal(DRAGON, DEPOSITOR, depositAmount);
        vm.prank(DEPOSITOR);
        dragon.approve(NEW_CONTRACT, depositAmount);
        vm.prank(DEPOSITOR);
        distributor.depositAndBurn(depositAmount);

        // Now update merkle root as operator
        bytes32 fakeMerkleRoot = keccak256("test-merkle-root");
        // Use a fake deposit tx hash
        bytes32 depositTxHash = keccak256("fake-deposit-tx");

        uint256 epochBefore = distributor.currentEpoch();

        vm.prank(OPERATOR);
        distributor.updateMerkleRoot(fakeMerkleRoot, depositTxHash);

        assertEq(distributor.currentEpoch(), epochBefore + 1);
        assertEq(distributor.merkleRoot(), fakeMerkleRoot);
        assertTrue(distributor.processedDeposits(depositTxHash));
    }

    function testDuplicateDepositTxHashRejected() public {
        bytes32 fakeMerkleRoot = keccak256("test-merkle-root");
        bytes32 depositTxHash = keccak256("fake-deposit-tx");

        // First update succeeds
        vm.prank(OPERATOR);
        distributor.updateMerkleRoot(fakeMerkleRoot, depositTxHash);

        // Second update with same txHash reverts
        vm.prank(OPERATOR);
        vm.expectRevert(DragonRewardDistributor.AlreadyProcessed.selector);
        distributor.updateMerkleRoot(fakeMerkleRoot, depositTxHash);
    }

    function testNonDepositorCannotDeposit() public {
        address rando = makeAddr("rando");
        deal(DRAGON, rando, 1000 ether);

        vm.prank(rando);
        dragon.approve(NEW_CONTRACT, 1000 ether);

        vm.prank(rando);
        vm.expectRevert(DragonRewardDistributor.Unauthorized.selector);
        distributor.depositAndBurn(1000 ether);
    }
}
