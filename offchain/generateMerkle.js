#!/usr/bin/env node

/**
 * generateMerkle.js
 *
 * Generates a cumulative Merkle tree for token distribution.
 * Takes current holder balances and new distribution amount,
 * calculates proportional distribution, adds to previous cumulative totals,
 * and generates Merkle tree with proofs.
 *
 * Usage: node generateMerkle.js <tokensToDistribute>
 * Output:
 *   - merkle-data.json (root + proofs for each address)
 *   - cumulative-totals.json (running totals for next iteration)
 */

import { MerkleTree } from 'merkletreejs';
import { ethers } from 'ethers';
import fs from 'fs';

function generateMerkleTree(holdersFile, tokensToDistribute) {
    console.log('Generating Merkle tree...');
    console.log(`Tokens to distribute: ${ethers.formatEther(tokensToDistribute)}`);

    // Load current holder balances
    if (!fs.existsSync(holdersFile)) {
        throw new Error(`Holders file not found: ${holdersFile}`);
    }

    const holders = JSON.parse(fs.readFileSync(holdersFile, 'utf-8'));
    const holderAddresses = Object.keys(holders);

    if (holderAddresses.length === 0) {
        throw new Error('No holders found');
    }

    console.log(`Found ${holderAddresses.length} holders`);

    // MINIMUM ELIGIBILITY: 300,000 DRAGON tokens
    const MIN_BALANCE_FOR_REWARDS = 300000n * (10n ** 18n); // 300k tokens

    // Filter holders to only those meeting minimum threshold
    const eligibleHolders = {};
    let ineligibleCount = 0;

    for (const [address, balance] of Object.entries(holders)) {
        if (BigInt(balance) >= MIN_BALANCE_FOR_REWARDS) {
            eligibleHolders[address] = balance;
        } else {
            ineligibleCount++;
        }
    }

    console.log(`Eligible holders (>=300k tokens): ${Object.keys(eligibleHolders).length}`);
    console.log(`Ineligible holders (<300k tokens): ${ineligibleCount}`);

    // Calculate total supply from ELIGIBLE holders only
    let totalSupply = 0n;
    for (const balance of Object.values(eligibleHolders)) {
        totalSupply += BigInt(balance);
    }

    console.log(`Total supply (eligible holders): ${ethers.formatEther(totalSupply)}`);

    // Load previous cumulative totals (if exists)
    let previousCumulative = {};
    if (fs.existsSync('cumulative-totals.json')) {
        previousCumulative = JSON.parse(fs.readFileSync('cumulative-totals.json', 'utf-8'));
        console.log('Loaded previous cumulative totals');
    }

    // Calculate new distribution for each holder
    const newDistribution = {};

    // IMPORTANT: Start with ALL previous addresses (preserves unclaimed balances)
    const newCumulative = {};
    for (const [address, previousTotal] of Object.entries(previousCumulative)) {
        newCumulative[address] = BigInt(previousTotal);
    }

    // Add new distributions for ELIGIBLE holders only (>=300k tokens)
    for (const [address, balance] of Object.entries(eligibleHolders)) {
        const holderBalance = BigInt(balance);

        // Calculate this holder's share of the new distribution (direct proportion, no precision loss)
        const holderShare = (tokensToDistribute * holderBalance) / totalSupply;

        newDistribution[address] = holderShare;

        // Add to previous cumulative (or start fresh if new holder)
        const previousTotal = newCumulative[address] || 0n;
        newCumulative[address] = previousTotal + holderShare;
    }

    // Filter out addresses with 0 cumulative total (nothing to claim)
    const filteredCumulative = {};
    let prunedCount = 0;

    for (const [address, cumulativeTotal] of Object.entries(newCumulative)) {
        if (cumulativeTotal > 0n) {
            filteredCumulative[address] = cumulativeTotal;
        } else {
            prunedCount++;
        }
    }

    if (prunedCount > 0) {
        console.log(`Pruned ${prunedCount} addresses with 0 claimable balance`);
    }

    // Generate Merkle tree leaves
    const leaves = [];
    const leafData = [];

    for (const [address, cumulativeTotal] of Object.entries(filteredCumulative)) {
        // Create leaf: keccak256(bytes.concat(keccak256(abi.encode(address, cumulativeTotal))))
        // This matches the contract's double-hashing
        const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
            ['address', 'uint256'],
            [address, cumulativeTotal.toString()]
        );
        const firstHash = ethers.keccak256(encoded);
        const leaf = ethers.keccak256(firstHash); // Double hash to match contract

        leaves.push(leaf);
        leafData.push({
            address,
            cumulativeTotal: cumulativeTotal.toString(),
            newAllocation: (newDistribution[address] || 0n).toString(),
            balance: eligibleHolders[address] || holders[address] || '0'
        });
    }

    // Create Merkle tree
    const merkleTree = new MerkleTree(leaves, ethers.keccak256, { sortPairs: true });
    const root = merkleTree.getHexRoot();

    console.log(`\nMerkle Root: ${root}`);

    // Generate proofs for each address
    const merkleData = {
        root,
        totalHolders: Object.keys(eligibleHolders).length,
        tokensDistributed: tokensToDistribute.toString(),
        timestamp: new Date().toISOString(),
        claims: {}
    };

    for (let i = 0; i < leaves.length; i++) {
        const leaf = leaves[i];
        const proof = merkleTree.getHexProof(leaf);
        const data = leafData[i];

        merkleData.claims[data.address] = {
            cumulativeTotal: data.cumulativeTotal,
            newAllocation: data.newAllocation,
            balance: data.balance,
            proof
        };
    }

    // Save Merkle data
    fs.writeFileSync(
        'merkle-data.json',
        JSON.stringify(merkleData, null, 2)
    );

    console.log('Saved to merkle-data.json');

    // Save cumulative totals for next iteration
    const cumulativeTotalsOutput = {};
    for (const [address, total] of Object.entries(filteredCumulative)) {
        cumulativeTotalsOutput[address] = total.toString();
    }

    fs.writeFileSync(
        'cumulative-totals.json',
        JSON.stringify(cumulativeTotalsOutput, null, 2)
    );

    console.log('Saved cumulative totals for next run');

    // Print summary
    console.log('\nDistribution Summary:');
    console.log(`  Total holders fetched: ${Object.keys(holders).length}`);
    console.log(`  Eligible holders (>=300k DRAGON): ${Object.keys(eligibleHolders).length}`);
    console.log(`  Ineligible holders (<300k DRAGON): ${ineligibleCount}`);

    const formerHolders = Object.keys(filteredCumulative).filter(addr => !eligibleHolders[addr]);
    if (formerHolders.length > 0) {
        console.log(`  ${formerHolders.length} former eligible holders with unclaimed tokens`);
    }

    console.log(`  Total addresses in merkle tree: ${Object.keys(filteredCumulative).length}`);
    console.log(`\n  Top 5 allocations (this round):`);
    const sortedByNew = Object.entries(newDistribution)
        .sort(([, a], [, b]) => (b > a ? 1 : -1))
        .slice(0, 5);

    for (const [address, amount] of sortedByNew) {
        console.log(`    ${address}: ${ethers.formatEther(amount)} tokens`);
    }

    return { root, merkleData };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tokensToDistribute = process.argv[2];

    if (!tokensToDistribute) {
        console.error('Usage: node generateMerkle.js <tokensToDistribute>');
        console.error('Example: node generateMerkle.js 400000000000000000000');
        process.exit(1);
    }

    generateMerkleTree('holders.json', BigInt(tokensToDistribute));
}

export { generateMerkleTree };
