import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

app.use(express.json());

// Contract configuration
const BUYBACK_CONTRACT_ADDRESS = process.env.BUYBACK_CONTRACT_ADDRESS;
const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';
const MERKLE_DATA_PATH = path.join(__dirname, 'merkle-data.json');
const CUMULATIVE_TOTALS_PATH = path.join(__dirname, 'cumulative-totals.json');

const DISTRIBUTOR_ABI = [
  'function totalClaimed(address) view returns (uint256)',
  'function currentEpoch() view returns (uint256)',
  'function merkleRoot() view returns (bytes32)',
  'function paused() view returns (bool)',
  'function targetToken() view returns (address)',
  'function lastDistributionTime() view returns (uint256)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)'
];

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'dragon-distributor-api',
    timestamp: new Date().toISOString()
  });
});

// GET /api/merkle-data - Get complete merkle tree
app.get('/api/merkle-data', (req, res) => {
  try {
    if (!fs.existsSync(MERKLE_DATA_PATH)) {
      return res.status(404).json({
        error: 'Merkle data not found. The distribution bot may not have run yet.'
      });
    }

    const data = JSON.parse(fs.readFileSync(MERKLE_DATA_PATH, 'utf-8'));
    res.json(data);
  } catch (error) {
    console.error('Error reading merkle data:', error);
    res.status(500).json({ error: 'Failed to read merkle data' });
  }
});

// GET /api/user-claim/:address - Get claim data for specific user
app.get('/api/user-claim/:address', async (req, res) => {
  try {
    const address = req.params.address;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const checksumAddress = ethers.getAddress(address);

    if (!fs.existsSync(MERKLE_DATA_PATH)) {
      return res.status(404).json({
        error: 'Merkle data not found.'
      });
    }

    const merkleData = JSON.parse(fs.readFileSync(MERKLE_DATA_PATH, 'utf-8'));

    // Try to find claim with both checksummed and lowercase addresses
    const claim = merkleData.claims[checksumAddress] ||
                  merkleData.claims[address.toLowerCase()] ||
                  Object.entries(merkleData.claims).find(
                    ([addr]) => addr.toLowerCase() === address.toLowerCase()
                  )?.[1];

    if (!claim) {
      return res.status(404).json({
        error: 'No rewards available for this address'
      });
    }

    // Get on-chain claimed amount
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BUYBACK_CONTRACT_ADDRESS, DISTRIBUTOR_ABI, provider);

    const alreadyClaimed = await contract.totalClaimed(checksumAddress);

    const cumulativeTotal = BigInt(claim.cumulativeTotal);
    const claimed = BigInt(alreadyClaimed.toString());
    const claimableNow = cumulativeTotal > claimed ? cumulativeTotal - claimed : 0n;

    res.json({
      address: checksumAddress,
      cumulativeTotal: claim.cumulativeTotal,
      newAllocation: claim.newAllocation,
      currentBalance: claim.balance,
      proof: claim.proof,
      alreadyClaimed: alreadyClaimed.toString(),
      claimableNow: claimableNow.toString()
    });

  } catch (error) {
    console.error('Error fetching user claim:', error);
    res.status(500).json({ error: 'Failed to fetch claim data' });
  }
});

// GET /api/stats - Get system statistics
app.get('/api/stats', async (req, res) => {
  try {
    let merkleData = null;
    if (fs.existsSync(MERKLE_DATA_PATH)) {
      merkleData = JSON.parse(fs.readFileSync(MERKLE_DATA_PATH, 'utf-8'));
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BUYBACK_CONTRACT_ADDRESS, DISTRIBUTOR_ABI, provider);

    const [currentEpoch, merkleRoot, isPaused, targetToken] = await Promise.all([
      contract.currentEpoch(),
      contract.merkleRoot(),
      contract.paused(),
      contract.targetToken()
    ]);

    const stats = {
      currentEpoch: currentEpoch.toString(),
      merkleRoot,
      isPaused,
      contractAddress: BUYBACK_CONTRACT_ADDRESS,
      targetToken: targetToken
    };

    if (merkleData) {
      stats.totalHolders = merkleData.totalHolders;
      stats.lastUpdateTime = merkleData.timestamp;

      let totalDistributedAllTime = 0n;
      if (merkleData.claims) {
        for (const claim of Object.values(merkleData.claims)) {
          totalDistributedAllTime += BigInt(claim.cumulativeTotal);
        }
      }
      stats.tokensDistributed = totalDistributedAllTime.toString();
    }

    res.json(stats);

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/distribution - Full distribution data for frontend dashboard
app.get('/api/distribution', async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BUYBACK_CONTRACT_ADDRESS, DISTRIBUTOR_ABI, provider);

    // Load cumulative totals
    if (!fs.existsSync(CUMULATIVE_TOTALS_PATH)) {
      return res.status(404).json({ error: 'Distribution data not available yet.' });
    }

    const cumulativeTotals = JSON.parse(fs.readFileSync(CUMULATIVE_TOTALS_PATH, 'utf-8'));
    const addresses = Object.keys(cumulativeTotals);

    // Fetch on-chain state
    const [currentEpoch, merkleRoot, targetToken] = await Promise.all([
      contract.currentEpoch(),
      contract.merkleRoot(),
      contract.targetToken()
    ]);

    // Get contract balance
    const tokenContract = new ethers.Contract(targetToken, ERC20_ABI, provider);
    const contractBalance = await tokenContract.balanceOf(BUYBACK_CONTRACT_ADDRESS);

    // Batch query totalClaimed for all addresses
    const BATCH_SIZE = 50;
    const claimedAmounts = {};

    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(addr => contract.totalClaimed(addr).catch(() => 0n))
      );
      batch.forEach((addr, idx) => {
        claimedAmounts[addr] = results[idx];
      });
    }

    // Build holder details + stats
    let totalAllocated = 0n;
    let totalClaimed = 0n;
    let fullyClaimed = 0;
    let partiallyClaimed = 0;
    let neverClaimed = 0;
    const holderDetails = [];

    for (const [address, allocatedStr] of Object.entries(cumulativeTotals)) {
      const allocated = BigInt(allocatedStr);
      const claimed = BigInt((claimedAmounts[address] || 0n).toString());
      const unclaimed = allocated > claimed ? allocated - claimed : 0n;

      totalAllocated += allocated;
      totalClaimed += claimed;

      if (claimed === 0n) {
        neverClaimed++;
      } else if (claimed >= allocated) {
        fullyClaimed++;
      } else {
        partiallyClaimed++;
      }

      holderDetails.push({
        address,
        allocated: allocated.toString(),
        claimed: claimed.toString(),
        unclaimed: unclaimed.toString()
      });
    }

    const totalUnclaimed = totalAllocated > totalClaimed ? totalAllocated - totalClaimed : 0n;
    const uniqueClaimers = fullyClaimed + partiallyClaimed;

    res.json({
      timestamp: new Date().toISOString(),
      currentEpoch: currentEpoch.toString(),
      merkleRoot,
      contractBalance: contractBalance.toString(),
      totalAllocated: totalAllocated.toString(),
      totalClaimed: totalClaimed.toString(),
      totalUnclaimed: totalUnclaimed.toString(),
      surplus: (contractBalance > totalUnclaimed ? contractBalance - totalUnclaimed : 0n).toString(),
      uniqueClaimers,
      holders: {
        total: addresses.length,
        fullyClaimed,
        partiallyClaimed,
        neverClaimed
      },
      holderDetails
    });

  } catch (error) {
    console.error('Error fetching distribution data:', error);
    res.status(500).json({ error: 'Failed to fetch distribution data' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} does not exist`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/merkle-data',
      'GET /api/user-claim/:address',
      'GET /api/stats',
      'GET /api/distribution'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('Dragon Distributor API Server');
  console.log('='.repeat(50));
  console.log(`Port: ${PORT}`);
  console.log(`Contract: ${BUYBACK_CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(50));
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Distribution: http://localhost:${PORT}/api/distribution`);
  console.log('='.repeat(50));
});

export default app;
