#!/usr/bin/env node

/**
 * generateMigrationScript.js
 *
 * Generates the DragonRewardDistributor deployment script with migration data.
 *
 * Usage:
 *   1. SCP cumulative-totals.json from server:
 *      scp root@38.242.226.239:/root/offchain/cumulative-totals.json ./offchain/cumulative-totals-remote.json
 *
 *   2. Run this script:
 *      node offchain/generateMigrationScript.js
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from offchain directory
dotenv.config({ path: path.join(path.dirname(new URL(import.meta.url).pathname), '.env') });

const RPC_URL = process.env.RPC_URL;
const OLD_CONTRACT = process.env.OLD_CONTRACT_ADDRESS || '0x8b0B7f2436693837de5E63f1ACe3A3E564256430';
const DRAGON_TOKEN = process.env.DRAGON_TOKEN_ADDRESS || '0x66969ecd173451f00a4652a53acc6246569d4444';

if (!RPC_URL) {
    console.error('ERROR: RPC_URL not set in offchain/.env');
    process.exit(1);
}

const CONTRACT_ABI = [
    'function totalClaimed(address) view returns (uint256)',
    'function currentEpoch() view returns (uint256)',
    'function merkleRoot() view returns (bytes32)',
    'function paused() view returns (bool)',
];

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
];

function fmt(wei) {
    return parseFloat(ethers.formatEther(wei)).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

async function generateMigrationScript() {
    console.log('='.repeat(70));
    console.log('  DRAGON REWARD DISTRIBUTOR — MIGRATION SCRIPT GENERATOR');
    console.log('='.repeat(70));
    console.log(`  Old Contract : ${OLD_CONTRACT}`);
    console.log(`  Dragon Token : ${DRAGON_TOKEN}`);
    console.log(`  RPC          : ${RPC_URL.replace(/\/[^/]{10,}$/, '/***')}`);
    console.log('='.repeat(70));
    console.log('');

    const cumulativeTotalsPath = 'offchain/cumulative-totals-remote.json';
    if (!fs.existsSync(cumulativeTotalsPath)) {
        console.error('ERROR: offchain/cumulative-totals-remote.json not found!');
        console.error('Run: scp root@38.242.226.239:/root/offchain/cumulative-totals.json ./offchain/cumulative-totals-remote.json');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(OLD_CONTRACT, CONTRACT_ABI, provider);
    const dragonToken = new ethers.Contract(DRAGON_TOKEN, ERC20_ABI, provider);

    // Step 1: Fetch contract state + balances
    console.log('[1/4] Fetching on-chain state...');
    const [currentEpoch, merkleRoot, isPaused, contractDragonBalance, deadBalance] = await Promise.all([
        contract.currentEpoch(),
        contract.merkleRoot(),
        contract.paused(),
        dragonToken.balanceOf(OLD_CONTRACT),
        dragonToken.balanceOf('0x000000000000000000000000000000000000dEaD'),
    ]);

    console.log('');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │  OLD CONTRACT STATE                                     │');
    console.log('  ├─────────────────────────────────────────────────────────┤');
    console.log(`  │  Epoch        : ${currentEpoch.toString().padEnd(39)}│`);
    console.log(`  │  Merkle Root  : ${merkleRoot.slice(0, 20)}...${merkleRoot.slice(-8)}  │`);
    console.log(`  │  Paused       : ${String(isPaused).padEnd(39)}│`);
    console.log(`  │  DRAGON Bal   : ${fmt(contractDragonBalance).padEnd(31)} DRAGON │`);
    console.log(`  │  Dead Bal     : ${fmt(deadBalance).padEnd(31)} DRAGON │`);
    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log('');

    // Step 2: Query totalClaimed for all holders
    console.log('[2/4] Querying totalClaimed for all holders...');
    const cumulativeTotals = JSON.parse(fs.readFileSync(cumulativeTotalsPath, 'utf8'));
    const holders = Object.entries(cumulativeTotals);
    console.log(`      Found ${holders.length} holders in cumulative-totals`);

    const holderDetails = [];
    const BATCH_SIZE = 20;

    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
        const batch = holders.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
            batch.map(async ([address, allocated]) => {
                const claimed = await contract.totalClaimed(address);
                return {
                    address: ethers.getAddress(address),
                    allocated: BigInt(allocated),
                    claimed: BigInt(claimed),
                    unclaimed: BigInt(allocated) - BigInt(claimed),
                };
            })
        );
        holderDetails.push(...results);
        process.stdout.write(`\r      Processed ${Math.min(i + BATCH_SIZE, holders.length)}/${holders.length} holders...`);
    }
    console.log('\n');

    // Calculate totals
    let totalAllocated = 0n;
    let totalClaimed = 0n;
    let totalUnclaimed = 0n;
    let fullyClaimed = 0;
    let partiallyClaimed = 0;
    let neverClaimed = 0;

    const claimers = [];

    for (const h of holderDetails) {
        totalAllocated += h.allocated;
        totalClaimed += h.claimed;
        totalUnclaimed += h.unclaimed;

        if (h.claimed > 0n) {
            claimers.push({ address: h.address, amount: h.claimed.toString() });
        }

        if (h.unclaimed === 0n && h.claimed > 0n) fullyClaimed++;
        else if (h.claimed > 0n) partiallyClaimed++;
        else neverClaimed++;
    }

    const contractBalance = BigInt(contractDragonBalance);
    const surplus = contractBalance - totalUnclaimed;

    // Step 3: Display detailed stats
    console.log('[3/4] Migration Summary');
    console.log('');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │  HOLDER BREAKDOWN                                       │');
    console.log('  ├─────────────────────────────────────────────────────────┤');
    console.log(`  │  Total holders        : ${String(holders.length).padEnd(32)}│`);
    console.log(`  │  Fully claimed         : ${String(fullyClaimed).padEnd(31)}│`);
    console.log(`  │  Partially claimed     : ${String(partiallyClaimed).padEnd(31)}│`);
    console.log(`  │  Never claimed         : ${String(neverClaimed).padEnd(31)}│`);
    console.log(`  │  Unique claimers       : ${String(claimers.length).padEnd(31)}│`);
    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('  ┌─────────────────────────────────────────────────────────┐');
    console.log('  │  TOKEN ACCOUNTING                                       │');
    console.log('  ├─────────────────────────────────────────────────────────┤');
    console.log(`  │  Total Allocated       : ${(fmt(totalAllocated) + ' DRAGON').padEnd(31)}│`);
    console.log(`  │  Total Claimed         : ${(fmt(totalClaimed) + ' DRAGON').padEnd(31)}│`);
    console.log(`  │  Total Unclaimed       : ${(fmt(totalUnclaimed) + ' DRAGON').padEnd(31)}│`);
    console.log('  ├─────────────────────────────────────────────────────────┤');
    console.log(`  │  Contract Balance      : ${(fmt(contractBalance) + ' DRAGON').padEnd(31)}│`);
    console.log(`  │  Surplus (bal - owed)  : ${(fmt(surplus) + ' DRAGON').padEnd(31)}│`);
    console.log('  └─────────────────────────────────────────────────────────┘');
    console.log('');

    if (surplus > 0n) {
        console.log(`  ⚠️  Surplus of ${fmt(surplus)} DRAGON in contract beyond what's owed.`);
        console.log(`     This can be withdrawn after migration or left as buffer.`);
    } else if (surplus < 0n) {
        console.log(`  ❌ DEFICIT: Contract is short ${fmt(-surplus)} DRAGON!`);
        console.log(`     You need to add more DRAGON to cover all unclaimed amounts.`);
    } else {
        console.log(`  ✅ Contract balance exactly matches unclaimed amount.`);
    }
    console.log('');

    // Top 10 unclaimed
    const sortedByUnclaimed = [...holderDetails].sort((a, b) =>
        b.unclaimed > a.unclaimed ? 1 : b.unclaimed < a.unclaimed ? -1 : 0
    );
    const top10 = sortedByUnclaimed.slice(0, 10);

    console.log('  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('  │  TOP 10 UNCLAIMED                                                                              │');
    console.log('  ├──────────────────────────────────────────┬──────────────────┬──────────────────┬────────────────┤');
    console.log('  │ Wallet                                   │ Allocated        │ Claimed          │ Unclaimed      │');
    console.log('  ├──────────────────────────────────────────┼──────────────────┼──────────────────┼────────────────┤');
    for (const h of top10) {
        const addr = h.address.slice(0, 6) + '...' + h.address.slice(-4);
        console.log(`  │ ${addr.padEnd(40)} │ ${fmt(h.allocated).padStart(16)} │ ${fmt(h.claimed).padStart(16)} │ ${fmt(h.unclaimed).padStart(14)} │`);
    }
    console.log('  └──────────────────────────────────────────┴──────────────────┴──────────────────┴────────────────┘');
    console.log('');

    // Step 4: Generate Solidity code
    const isTestnet = process.argv.includes('--testnet');
    console.log(`[4/4] Generating deployment script... ${isTestnet ? '(TESTNET)' : '(MAINNET)'}`);

    const users = claimers.map(c => c.address);
    const amounts = claimers.map(c => c.amount);

    if (isTestnet) {
        const testnetCode = generateTestnetSolidityCode(
            currentEpoch.toString(),
            merkleRoot,
            users,
            amounts
        );
        fs.writeFileSync('script/DeployTestnet.s.sol', testnetCode);
        console.log('      Saved to script/DeployTestnet.s.sol');
    }

    const solidityCode = generateSolidityCode(
        currentEpoch.toString(),
        merkleRoot,
        users,
        amounts
    );
    fs.writeFileSync('script/DeployDragonRewardDistributor.s.sol', solidityCode);
    console.log('      Saved to script/DeployDragonRewardDistributor.s.sol');

    // Save claimed-state.json for reference
    const claimedState = {
        timestamp: new Date().toISOString(),
        oldContract: OLD_CONTRACT,
        currentEpoch: currentEpoch.toString(),
        merkleRoot,
        contractBalance: contractDragonBalance.toString(),
        uniqueClaimers: claimers.length,
        totalAllocated: totalAllocated.toString(),
        totalClaimed: totalClaimed.toString(),
        totalUnclaimed: totalUnclaimed.toString(),
        surplus: surplus.toString(),
        holders: {
            total: holders.length,
            fullyClaimed,
            partiallyClaimed,
            neverClaimed,
        },
        claimers,
        // Full holder details for dashboard
        holderDetails: holderDetails.map(h => ({
            address: h.address,
            allocated: h.allocated.toString(),
            claimed: h.claimed.toString(),
            unclaimed: h.unclaimed.toString(),
        })),
    };
    fs.writeFileSync('offchain/claimed-state.json', JSON.stringify(claimedState, null, 2));
    console.log('      Saved offchain/claimed-state.json');

    console.log('');
    console.log('='.repeat(70));
    console.log('  READY TO DEPLOY');
    console.log('='.repeat(70));
    console.log('');
    console.log('  Dry-run:');
    console.log('    forge script script/DeployDragonRewardDistributor.s.sol:DeployDragonRewardDistributor --rpc-url $RPC_URL -vvv');
    console.log('');
    console.log('  Deploy:');
    console.log('    forge script script/DeployDragonRewardDistributor.s.sol:DeployDragonRewardDistributor --rpc-url $RPC_URL --broadcast');
    console.log('');
    console.log('='.repeat(70));
}

function generateSolidityCode(epoch, merkleRoot, users, amounts) {
    let usersCode = '';
    for (let i = 0; i < users.length; i++) {
        usersCode += `        users[${i}] = ${users[i]};\n`;
        usersCode += `        amounts[${i}] = ${amounts[i]};\n\n`;
    }

    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/DragonRewardDistributor.sol";

/**
 * @title DeployDragonRewardDistributor
 * @notice Deploy DragonRewardDistributor to BSC Mainnet with state migration
 *
 * Generated: ${new Date().toISOString()}
 * Claimers: ${users.length}
 *
 * Usage:
 *   forge script script/DeployDragonRewardDistributor.s.sol:DeployDragonRewardDistributor --rpc-url $RPC_URL -vvv
 *   forge script script/DeployDragonRewardDistributor.s.sol:DeployDragonRewardDistributor --rpc-url $RPC_URL --broadcast
 */
contract DeployDragonRewardDistributor is Script {
    uint256 constant MIGRATION_EPOCH = ${epoch};
    bytes32 constant MIGRATION_MERKLE_ROOT = ${merkleRoot};

    function run() external {
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address dragonToken = vm.envAddress("DRAGON_TOKEN_ADDRESS");
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("\\n========================================");
        console.log("DRAGON REWARD DISTRIBUTOR DEPLOYMENT");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Operator:", operator);
        console.log("Dragon Token:", dragonToken);

        (address[] memory users, uint256[] memory amounts) = getMigrationData();
        console.log("Migration Users:", users.length);

        vm.startBroadcast(deployerPrivateKey);

        DragonRewardDistributor distributor = new DragonRewardDistributor(operator);
        console.log("DragonRewardDistributor deployed at:", address(distributor));

        distributor.setTargetToken(dragonToken);
        console.log("Target token set");

        distributor.initializeFromV2(
            MIGRATION_EPOCH,
            MIGRATION_MERKLE_ROOT,
            users,
            amounts
        );
        console.log("Migration complete!");
        console.log("  Epoch:", distributor.currentEpoch());
        console.log("  Initialized:", distributor.initialized());

        vm.stopBroadcast();

        console.log("\\n========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("DragonRewardDistributor:", address(distributor));
        console.log("Owner:", deployer);
        console.log("Operator:", operator);
        console.log("Target Token:", dragonToken);
        console.log("\\n========================================");
        console.log("NEXT STEPS");
        console.log("========================================");
        console.log("1. Pause old contract");
        console.log("2. emergencyWithdraw DRAGON from old contract");
        console.log("3. Transfer DRAGON to new contract:", address(distributor));
        console.log("4. Update server .env with new contract address");
        console.log("5. Test a claim on new contract");
        console.log("========================================\\n");
    }

    function getMigrationData() internal pure returns (address[] memory users, uint256[] memory amounts) {
        users = new address[](${users.length});
        amounts = new uint256[](${users.length});

${usersCode}        return (users, amounts);
    }
}
`;
}

function generateTestnetSolidityCode(epoch, merkleRoot, users, amounts) {
    let usersCode = '';
    for (let i = 0; i < users.length; i++) {
        usersCode += `        users[${i}] = ${users[i]};\n`;
        usersCode += `        amounts[${i}] = ${amounts[i]};\n\n`;
    }

    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockDragon.sol";
import "../src/DragonRewardDistributor.sol";

/**
 * @title DeployTestnet
 * @notice Testnet deploy with MockDragon + full ${users.length}-claimer migration.
 * Generated: ${new Date().toISOString()}
 */
contract DeployTestnet is Script {
    uint256 constant MIGRATION_EPOCH = ${epoch};
    bytes32 constant MIGRATION_MERKLE_ROOT = ${merkleRoot};

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        (address[] memory users, uint256[] memory amounts) = getMigrationData();

        vm.startBroadcast(deployerPrivateKey);

        MockDragon dragon = new MockDragon();
        console.log("MockDragon:", address(dragon));

        DragonRewardDistributor distributor = new DragonRewardDistributor(operator);
        console.log("Distributor:", address(distributor));

        distributor.setTargetToken(address(dragon));
        distributor.setDepositor(deployer, true);
        distributor.initializeFromV2(MIGRATION_EPOCH, MIGRATION_MERKLE_ROOT, users, amounts);

        // Seed contract balance to match mainnet (~25M unclaimed)
        dragon.transfer(address(distributor), 25_000_000 ether);

        vm.stopBroadcast();

        console.log("Epoch:", distributor.currentEpoch());
        console.log("Claimers:", users.length);
        console.log("MockDragon:", address(dragon));
        console.log("Distributor:", address(distributor));
    }

    function getMigrationData() internal pure returns (address[] memory users, uint256[] memory amounts) {
        users = new address[](${users.length});
        amounts = new uint256[](${users.length});

${usersCode}        return (users, amounts);
    }
}
`;
}

generateMigrationScript().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
