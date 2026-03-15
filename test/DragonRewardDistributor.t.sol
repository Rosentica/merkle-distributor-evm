// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DragonRewardDistributor.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract DragonRewardDistributorTest is Test {
    DragonRewardDistributor public distributor;

    address constant DRAGON = 0x66969ecD173451F00a4652a53acc6246569D4444;
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // A whale that holds DRAGON (use the old claim contract which has ~25M)
    address constant DRAGON_WHALE = 0x8b0B7f2436693837de5E63f1ACe3A3E564256430;

    address owner;
    address operator;
    address user1;
    address user2;

    function setUp() public {
        // Fork BSC mainnet
        vm.createSelectFork("https://bsc-dataseed.binance.org/");

        owner = makeAddr("owner");
        operator = makeAddr("operator");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        vm.prank(owner);
        distributor = new DragonRewardDistributor(operator);

        vm.prank(owner);
        distributor.setTargetToken(DRAGON);
    }

    function testDeployment() public view {
        assertEq(distributor.owner(), owner);
        assertEq(distributor.operator(), operator);
        assertEq(distributor.targetToken(), DRAGON);
        assertEq(distributor.paused(), false);
        assertEq(distributor.initialized(), false);
        assertEq(distributor.currentEpoch(), 0);
    }

    function testDepositAndBurn() public {
        uint256 depositAmount = 1_000_000 ether;

        // Give owner some DRAGON from whale
        vm.prank(DRAGON_WHALE);
        IERC20(DRAGON).transfer(owner, depositAmount);

        uint256 deadBefore = IERC20(DRAGON).balanceOf(DEAD);
        uint256 contractBefore = IERC20(DRAGON).balanceOf(address(distributor));

        // Owner approves and deposits
        vm.startPrank(owner);
        IERC20(DRAGON).approve(address(distributor), depositAmount);

        vm.expectEmit(true, false, false, true);
        emit DragonRewardDistributor.TokensDeposited(owner, depositAmount, 200_000 ether, 800_000 ether);
        distributor.depositAndBurn(depositAmount);
        vm.stopPrank();

        // Verify 20% burned
        assertEq(IERC20(DRAGON).balanceOf(DEAD) - deadBefore, 200_000 ether);
        // Verify 80% held in contract
        assertEq(IERC20(DRAGON).balanceOf(address(distributor)) - contractBefore, 800_000 ether);
    }

    function testDepositOnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert(DragonRewardDistributor.Unauthorized.selector);
        distributor.depositAndBurn(1000 ether);
    }

    function testDepositWhenPaused() public {
        vm.prank(owner);
        distributor.setPaused(true);

        vm.prank(owner);
        vm.expectRevert(DragonRewardDistributor.ContractPaused.selector);
        distributor.depositAndBurn(1000 ether);
    }

    function testDepositZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(DragonRewardDistributor.InvalidAmount.selector);
        distributor.depositAndBurn(0);
    }

    function testInitializeFromV2() public {
        address[] memory claimers = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        claimers[0] = user1;
        claimers[1] = user2;
        amounts[0] = 100 ether;
        amounts[1] = 200 ether;

        bytes32 fakeRoot = keccak256("test");

        vm.prank(owner);
        distributor.initializeFromV2(69, fakeRoot, claimers, amounts);

        assertEq(distributor.currentEpoch(), 69);
        assertEq(distributor.merkleRoot(), fakeRoot);
        assertEq(distributor.totalClaimed(user1), 100 ether);
        assertEq(distributor.totalClaimed(user2), 200 ether);
        assertTrue(distributor.initialized());
    }

    function testInitializeOnlyOnce() public {
        address[] memory claimers = new address[](0);
        uint256[] memory amounts = new uint256[](0);
        bytes32 fakeRoot = keccak256("test");

        vm.prank(owner);
        distributor.initializeFromV2(1, fakeRoot, claimers, amounts);

        vm.prank(owner);
        vm.expectRevert(DragonRewardDistributor.AlreadyInitialized.selector);
        distributor.initializeFromV2(2, fakeRoot, claimers, amounts);
    }

    function testUpdateMerkleRoot() public {
        bytes32 newRoot = keccak256("newroot");
        bytes32 depositTxHash = keccak256("txhash1");

        vm.prank(operator);
        distributor.updateMerkleRoot(newRoot, depositTxHash);

        assertEq(distributor.merkleRoot(), newRoot);
        assertEq(distributor.currentEpoch(), 1);
        assertGt(distributor.lastDistributionTime(), 0);
        assertTrue(distributor.processedDeposits(depositTxHash));
    }

    function testUpdateMerkleRootOnlyOperator() public {
        vm.prank(user1);
        vm.expectRevert(DragonRewardDistributor.Unauthorized.selector);
        distributor.updateMerkleRoot(keccak256("test"), keccak256("txhash"));
    }

    function testUpdateMerkleRootDuplicateDepositReverts() public {
        bytes32 newRoot = keccak256("newroot");
        bytes32 depositTxHash = keccak256("txhash1");

        vm.prank(operator);
        distributor.updateMerkleRoot(newRoot, depositTxHash);

        // Same txHash should revert
        vm.prank(operator);
        vm.expectRevert(DragonRewardDistributor.AlreadyProcessed.selector);
        distributor.updateMerkleRoot(keccak256("newroot2"), depositTxHash);
    }

    function testMultipleDepositsNoInterval() public {
        uint256 depositAmount = 100_000 ether;

        // Give owner DRAGON
        vm.prank(DRAGON_WHALE);
        IERC20(DRAGON).transfer(owner, depositAmount * 3);

        vm.startPrank(owner);
        IERC20(DRAGON).approve(address(distributor), depositAmount * 3);

        // Three deposits back to back — no cooldown
        distributor.depositAndBurn(depositAmount);
        distributor.depositAndBurn(depositAmount);
        distributor.depositAndBurn(depositAmount);
        vm.stopPrank();

        // 80% * 3 deposits = 240k held
        assertEq(IERC20(DRAGON).balanceOf(address(distributor)), 240_000 ether);
    }

    function testEmergencyWithdraw() public {
        uint256 depositAmount = 100_000 ether;

        vm.prank(DRAGON_WHALE);
        IERC20(DRAGON).transfer(owner, depositAmount);

        vm.startPrank(owner);
        IERC20(DRAGON).approve(address(distributor), depositAmount);
        distributor.depositAndBurn(depositAmount);

        uint256 contractBalance = IERC20(DRAGON).balanceOf(address(distributor));
        uint256 ownerBefore = IERC20(DRAGON).balanceOf(owner);

        distributor.emergencyWithdraw(DRAGON, contractBalance);
        vm.stopPrank();

        assertEq(IERC20(DRAGON).balanceOf(address(distributor)), 0);
        assertEq(IERC20(DRAGON).balanceOf(owner), ownerBefore + contractBalance);
    }

    function testMigrationGasEstimate() public {
        // Simulate migration with 167 claimers (real data size)
        uint256 numClaimers = 167;
        address[] memory claimers = new address[](numClaimers);
        uint256[] memory amounts = new uint256[](numClaimers);

        for (uint256 i = 0; i < numClaimers; i++) {
            claimers[i] = address(uint160(i + 1000));
            amounts[i] = (i + 1) * 1 ether;
        }

        bytes32 fakeRoot = keccak256("migration");

        uint256 gasBefore = gasleft();
        vm.prank(owner);
        distributor.initializeFromV2(69, fakeRoot, claimers, amounts);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for 167-claimer migration:", gasUsed);
        // Should be well under block gas limit
        assertLt(gasUsed, 30_000_000);
    }
}
