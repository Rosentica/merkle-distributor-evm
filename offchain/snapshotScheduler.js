#!/usr/bin/env node

/**
 * snapshotScheduler.js
 *
 * Periodically fetches holder snapshots via Moralis API.
 * Runs getHolders() every 4 hours to keep holders.json up to date.
 *
 * Usage: node snapshotScheduler.js
 * PM2:   pm2 start snapshotScheduler.js --name dragon-snapshot
 */

import { getHolders } from './getHolders.js';

const INTERVAL_HOURS = 2;
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

async function runSnapshot() {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Running holder snapshot...`);

    try {
        const holders = await getHolders();
        console.log(`[${timestamp}] Snapshot complete: ${Object.keys(holders).length} holders`);
    } catch (error) {
        console.error(`[${timestamp}] Snapshot failed:`, error.message);
    }
}

async function main() {
    console.log('Dragon Snapshot Scheduler starting...');
    console.log(`Interval: every ${INTERVAL_HOURS} hours`);

    // Run immediately on start
    await runSnapshot();

    // Then run on interval
    setInterval(runSnapshot, INTERVAL_MS);

    console.log(`Next snapshot in ${INTERVAL_HOURS} hours. Waiting...`);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
