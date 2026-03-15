#!/usr/bin/env node

/**
 * getHolders.js
 *
 * Fetches all token holders using Moralis API.
 * Much faster and more reliable than querying transfer events.
 *
 * Usage: node getHolders.js
 * Output: holders.json (mapping of address => balance)
 */

import { ethers } from 'ethers';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const TARGET_TOKEN_ADDRESS = process.env.TARGET_TOKEN_ADDRESS || process.env.DRAGON_TOKEN_ADDRESS;
const MORALIS_API_KEY = process.env.MORALIS_API_KEY;
const BUYBACK_CONTRACT_ADDRESS = process.env.BUYBACK_CONTRACT_ADDRESS;
const CHAIN = process.env.CHAIN || 'bsc'; // 'bsc' or 'sepolia'

// Addresses to exclude from distribution
const EXCLUDED_ADDRESSES = [
    '0x000000000000000000000000000000000000dead', // Burn address
    '0x0000000000000000000000000000000000000000', // Zero address
    '0xd504bcaebad45A1c92b14b14a9aB29A566ED2D42', // PancakeSwap LP
    '0x8b0B7f2436693837de5E63f1ACe3A3E564256430', // Old Buyback contract v2
    '0x70940516e85dd971FB042a0A504cD4735F80D60C', // New Buyback contract v4
    '0x407993575c91ce7643a4d4ccacc9a98c36ee1bbe', // PinkSale Lock
    '0x8D05F92CE60DB4A9842C8a7f74Ea404B9F6c88c7', // Freya Claim address
    BUYBACK_CONTRACT_ADDRESS, // New distributor contract
].filter(Boolean);

async function getHolders() {
    console.log('Fetching token holders via Moralis API...');
    console.log(`Token: ${TARGET_TOKEN_ADDRESS}`);
    console.log(`Chain: ${CHAIN}`);

    if (!MORALIS_API_KEY) {
        throw new Error('MORALIS_API_KEY not set in .env');
    }

    if (!TARGET_TOKEN_ADDRESS) {
        throw new Error('TARGET_TOKEN_ADDRESS or DRAGON_TOKEN_ADDRESS not set in .env');
    }

    try {
        const holders = await getHoldersViaMoralis();

        // Filter out excluded addresses
        const filteredHolders = {};
        let excludedCount = 0;

        for (const [address, balance] of Object.entries(holders)) {
            const addr = address.toLowerCase();

            // Check if address should be excluded
            const isExcluded = EXCLUDED_ADDRESSES.some(
                excluded => excluded && addr === excluded.toLowerCase()
            );

            if (!isExcluded && balance > 0n) {
                filteredHolders[address] = balance.toString();
            } else if (isExcluded) {
                excludedCount++;
                console.log(`  Excluded: ${address} (${ethers.formatEther(balance)} tokens)`);
            }
        }

        // Calculate total holder balance
        let totalHolderBalance = 0n;
        for (const balance of Object.values(filteredHolders)) {
            totalHolderBalance += BigInt(balance);
        }

        console.log(`\nFound ${Object.keys(filteredHolders).length} eligible holders`);
        console.log(`Excluded ${excludedCount} addresses (burn, contract, etc.)`);
        console.log(`Total holder balance: ${ethers.formatEther(totalHolderBalance)} tokens`);

        // Save to file
        fs.writeFileSync(
            'holders.json',
            JSON.stringify(filteredHolders, null, 2)
        );

        console.log('\nSaved to holders.json');

        // Archive this snapshot
        const archiveDir = 'archives/holders';
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archiveFile = `${archiveDir}/holders-${timestamp}.json`;
        fs.writeFileSync(archiveFile, JSON.stringify({
            timestamp: new Date().toISOString(),
            totalHolders: Object.keys(filteredHolders).length,
            totalBalance: totalHolderBalance.toString(),
            holders: filteredHolders
        }, null, 2));

        console.log(`Archived to ${archiveFile}`);

        return filteredHolders;

    } catch (error) {
        console.error('Error fetching holders:', error.message);
        throw error;
    }
}

async function getHoldersViaMoralis() {
    const holders = {};
    let cursor = null;
    let page = 1;
    const limit = 100; // Fetch 100 holders per page (max allowed)

    console.log('Fetching holders from Moralis API...');

    do {
        // Build URL with pagination cursor
        let url = `https://deep-index.moralis.io/api/v2.2/erc20/${TARGET_TOKEN_ADDRESS}/owners?chain=${CHAIN}&order=DESC&limit=${limit}`;
        if (cursor) {
            url += `&cursor=${encodeURIComponent(cursor)}`;
        }

        const options = {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'X-API-Key': MORALIS_API_KEY
            }
        };

        try {
            console.log(`  Fetching page ${page}...`);
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Moralis API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            console.log(`  Page ${page}: ${data.result.length} holders`);

            // Process holders from this page
            for (const holder of data.result) {
                const address = holder.owner_address;
                const balance = BigInt(holder.balance);

                // Store holder with their balance
                if (balance > 0n) {
                    holders[address] = balance;

                    // Log if it's a labeled address (PinkSale, etc.)
                    if (holder.owner_address_label) {
                        console.log(`    Found: ${holder.owner_address_label} - ${address}`);
                    }
                }
            }

            // Get cursor for next page
            cursor = data.cursor || null;
            page++;

            // Rate limiting: Moralis free tier is 5 req/sec, so wait 250ms between requests
            if (cursor) {
                await new Promise(resolve => setTimeout(resolve, 250));
            }

        } catch (error) {
            console.error(`\nError fetching page ${page}:`, error.message);
            throw error;
        }

    } while (cursor); // Continue while there's a next page

    console.log(`\nTotal holders fetched: ${Object.keys(holders).length}`);

    return holders;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    getHolders().catch(console.error);
}

export { getHolders };
