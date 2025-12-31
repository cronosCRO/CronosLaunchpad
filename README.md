# CronosMeme.fun

A pump.fun-style memecoin launchpad on Cronos blockchain with automatic graduation to VVS Finance DEX.

## Overview

CronosMeme.fun allows users to:
- Create memecoins instantly with 1 CRO
- Trade tokens on a fair bonding curve
- Earn 0.5% of all trades as token creator
- Graduate to VVS Finance at 500 CRO market cap

## Tech Stack

- **Smart Contracts**: Solidity 0.8.20, Hardhat
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, wagmi/viem
- **Chain**: Cronos Mainnet (ChainID: 25) / Testnet (ChainID: 338)
- **DEX**: VVS Finance (Uniswap V2 fork)

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `MemeToken.sol` | ERC-20 token deployed for each memecoin |
| `TokenFactory.sol` | Deploys new tokens and initializes bonding curves |
| `BondingCurve.sol` | Handles trading with constant product AMM |
| `LiquidityMigrator.sol` | Migrates graduated tokens to VVS Finance |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/cronosCRO/CronosLaunchpad.git
cd CronosLaunchpad

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your private key and API keys
```

### Compile & Test Contracts

```bash
# Compile
npm run compile

# Run tests
npm run test

# Run local node
npm run node

# Deploy to local
npm run deploy:local
```

### Deploy to Cronos

```bash
# Deploy to testnet
npm run deploy:testnet

# Deploy to mainnet
npm run deploy:mainnet
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Contract Parameters ( these can always be updated or changed)

| Parameter | Value |
|-----------|-------|
| Total Supply | 1,000,000,000 tokens |
| Creation Fee | 1 CRO |
| Trading Fee | 1% (split 50/50 creator/platform) |
| Graduation Threshold | 500 CRO |
| Initial Virtual CRO | 30 CRO |
| Migration Fee | 3 CRO |

## Architecture

```
User creates token → TokenFactory deploys MemeToken
                   → Sends all tokens to BondingCurve
                   → BondingCurve initialized with virtual reserves

Users trade on BondingCurve (constant product AMM)
  ↓
At 500 CRO real reserve:
  ↓
LiquidityMigrator.migrate()
  → Pulls CRO + remaining tokens from BondingCurve
  → Adds liquidity to VVS Finance
  → Burns LP tokens
  → Token now tradeable on VVS
```

## Security Considerations

- Reentrancy protection on all state-changing functions
- Access control for admin functions
- Slippage protection for trades
- LP tokens burned permanently at graduation

## License

MIT
