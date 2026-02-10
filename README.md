# Agent Escrow Protocol

A production-ready escrow protocol for agent payments using USDC on Base network. Features secure escrow management, dispute resolution, and reputation tracking.

## Features

- **USDC Escrow**: Create escrows with USDC for agent services
- **Dispute Resolution**: Built-in dispute mechanism with protocol arbitration
- **Reputation Tracking**: On-chain reputation scores for providers and clients
- **Gas Optimized**: Uses custom errors, immutable variables, and efficient storage patterns
- **Secure**: Implements checks-effects-interactions pattern and reentrancy protection

## Prerequisites

- Node.js v18+
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Fill in your environment variables in `.env`:

```
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key_here
```

## Compile Contracts

```bash
npm run compile
```

## Run Tests

```bash
npm test
```

## Deployment

### Deploy to Base Sepolia (Testnet)

```bash
npm run deploy:base-sepolia
```

### Deploy to Base Mainnet

```bash
npm run deploy:base
```

## Contract Verification

After deployment, update the `CONTRACT_ADDRESS` in `scripts/verify.js`, then:

### Verify on Base Sepolia

```bash
npm run verify:base-sepolia
```

### Verify on Base Mainnet

```bash
npm run verify:base
```

Or verify manually:

```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS> <USDC_ADDRESS> <PROTOCOL_WALLET> <FEE_BPS>
```

## Contract Overview

### AgentEscrowProtocol

| Function | Description |
|----------|-------------|
| `createEscrow(provider, amount, deadline)` | Create a new escrow agreement |
| `completeEscrow(escrowId)` | Release funds to provider (client only) |
| `raiseDispute(escrowId)` | Flag escrow as disputed |
| `resolveDispute(escrowId, providerWins)` | Resolve dispute (protocol wallet only) |

### USDC Addresses

| Network | USDC Address |
|---------|--------------|
| Base Mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Base Sepolia | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## Protocol Fee

The protocol charges a 2.5% fee (250 basis points) on completed escrows. This fee is sent to the protocol wallet.

## License

MIT
