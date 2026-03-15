#!/usr/bin/env node

/**
 * distributionBot.js
 *
 * Listens for TokensDeposited events on the DragonRewardDistributor contract.
 * On each deposit:
 *   1. Generate new merkle tree with the forDistribution amount
 *   2. Update merkle root on-chain (with depositTxHash for dedup)
 *
 * The contract enforces idempotency via processedDeposits mapping,
 * so no dedup logic is needed here.
 *
 * Usage: node distributionBot.js
 * PM2:   pm2 start distributionBot.js --name dragon-distribution
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { generateMerkleTree } from './generateMerkle.js';
import { updateMerkleRoot } from './updateMerkleRoot.js';

dotenv.config();

const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';
const BUYBACK_CONTRACT_ADDRESS = process.env.BUYBACK_CONTRACT_ADDRESS;

const DISTRIBUTOR_ABI = [
    'event TokensDeposited(address indexed depositor, uint256 totalAmount, uint256 burned, uint256 forDistribution)',
    'function currentEpoch() external view returns (uint256)',
    'function processedDeposits(bytes32) external view returns (bool)'
];

const POLL_INTERVAL_MS = 600_000; // 10 minutes
let lastProcessedBlock = 0;
let isProcessing = false;

async function processDeposit(event, contract) {
    const { depositor, totalAmount, burned, forDistribution } = event.args;
    const depositTxHash = event.transactionHash;

    console.log(`\n========================================`);
    console.log(`Deposit detected!`);
    console.log(`  Depositor: ${depositor}`);
    console.log(`  Total: ${ethers.formatEther(totalAmount)} DRAGON`);
    console.log(`  Burned: ${ethers.formatEther(burned)} DRAGON`);
    console.log(`  For Distribution: ${ethers.formatEther(forDistribution)} DRAGON`);
    console.log(`  TxHash: ${depositTxHash}`);
    console.log(`========================================\n`);

    // Check if already processed on-chain
    try {
        const alreadyProcessed = await contract.processedDeposits(depositTxHash);
        if (alreadyProcessed) {
            console.log(`Deposit ${depositTxHash} already processed, skipping.`);
            return;
        }
    } catch (err) {
        console.error('Error checking processedDeposits:', err.message);
    }

    try {
        // Step 1: Generate merkle tree
        console.log('Step 1: Generating merkle tree...');
        const { root } = generateMerkleTree('holders.json', forDistribution);
        console.log(`Merkle root generated: ${root}`);

        // Step 2: Update on-chain
        console.log('Step 2: Updating merkle root on-chain...');
        const receipt = await updateMerkleRoot(depositTxHash);

        if (receipt) {
            console.log(`Distribution complete! New epoch started.`);
        } else {
            console.log('Update skipped (already processed on-chain).');
        }
    } catch (error) {
        console.error(`Error processing deposit ${depositTxHash}:`, error.message);
        // Don't throw — let the bot continue running for future events
    }
}

async function pollForEvents() {
    console.log('Dragon Distribution Bot starting...');
    console.log(`Contract: ${BUYBACK_CONTRACT_ADDRESS}`);
    console.log(`RPC: ${RPC_URL}`);
    console.log(`Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

    if (!BUYBACK_CONTRACT_ADDRESS) {
        throw new Error('BUYBACK_CONTRACT_ADDRESS not set in .env');
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BUYBACK_CONTRACT_ADDRESS, DISTRIBUTOR_ABI, provider);

    // Start from current block
    lastProcessedBlock = await provider.getBlockNumber();
    console.log(`Starting from block ${lastProcessedBlock}`);

    const currentEpoch = await contract.currentEpoch();
    console.log(`Current epoch: ${currentEpoch}`);
    console.log('Listening for TokensDeposited events...\n');

    // Poll loop
    while (true) {
        try {
            if (!isProcessing) {
                const currentBlock = await provider.getBlockNumber();

                if (currentBlock > lastProcessedBlock) {
                    // Query for events in the gap
                    const filter = contract.filters.TokensDeposited();
                    const events = await contract.queryFilter(
                        filter,
                        lastProcessedBlock + 1,
                        currentBlock
                    );

                    if (events.length > 0) {
                        isProcessing = true;
                        console.log(`Found ${events.length} deposit event(s) in blocks ${lastProcessedBlock + 1}-${currentBlock}`);

                        for (const event of events) {
                            await processDeposit(event, contract);
                        }
                        isProcessing = false;
                    }

                    lastProcessedBlock = currentBlock;
                }
            }
        } catch (error) {
            console.error('Poll error:', error.message);
            isProcessing = false;
            // Continue polling after error
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

pollForEvents().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
