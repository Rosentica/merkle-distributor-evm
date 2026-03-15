// Mainnet addresses (BSC chain 56)
export const DISTRIBUTOR_ADDRESS =
  "0x70940516e85dd971FB042a0A504cD4735F80D60C" as `0x${string}`;
export const DRAGON_ADDRESS =
  "0x66969ecD173451F00a4652a53acc6246569D4444" as `0x${string}`;

// Authorized admin wallets (owner + 6 buyback wallets from treasury report)
export const ADMIN_WALLETS: string[] = [
  "0x8869F458f63B801A59b733a7917B3229978ff915", // Deployer/Owner
  "0xb131471d3a848f96b4822277d4fcb526c404d594", // Wallet 1
  "0x848b8c423cd0329c30fcc4d7bed7be9491fd616f", // Wallet 2
  "0x8475a78825ff386994bd0b1db374148c7d1a1b08", // Wallet 3
  "0x357e25f5d7d219f2d26881d408cfcd5f9d6d1bbf", // Wallet 4
  "0xffe6830ee2e4caf60911bcb623038c21b49aaab6", // Wallet 5
  "0xf504ca16f90906b5d45717e5f718434ae4adcab0", // Wallet 6
];

export const DISTRIBUTOR_ABI = [
  {
    name: "depositAndBurn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "currentEpoch",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "lastDistributionTime",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isDepositor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "depositor", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "TokensDeposited",
    type: "event",
    inputs: [
      { name: "depositor", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "burned", type: "uint256", indexed: false },
      { name: "forDistribution", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
