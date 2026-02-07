# Solana Local Wallet

A full-featured Solana wallet application with Squads multisig support. Includes a web UI and CLI skill scripts.

## Features

### Single-Signature Wallet
- **Local keypair generation** using `@solana/web3.js`
- **Password-encrypted storage** (AES-256-GCM)
- **SOL and SPL token transfers**
- **Balance checking** with token name resolution

### Multisig Vaults (Squads Protocol)
- **Create multisig vaults** with configurable thresholds
- **Propose SOL transfers** requiring multiple approvals
- **Approve/reject proposals** as a vault member
- **Execute approved transactions**
- **Shareable links** for easy collaboration
- **External wallet support** (Phantom, Solflare, etc.)

## Quick Start

```bash
# Install dependencies
npm install

# Start the web UI
npm run dev

# Or use CLI scripts
npm run skill:create -- --name "My Wallet" --password "securepass123"
npm run skill:balance
```

## Web UI

The web application provides two modes:

### Built-in Wallet Mode (`/wallet`)
- Create and manage a local encrypted wallet
- View balances and transaction history
- Create multisig vaults
- Propose, approve, and execute vault transactions

### External Wallet Mode (`/connect`)
- Connect Phantom, Solflare, or other Solana wallets
- View multisig vaults you're a member of
- Import vaults via share links
- Vote on proposals and create new vaults

## CLI Scripts

### Wallet Operations

```bash
# Create wallet
npm run skill:create -- --name "My Wallet" --password "pass123"

# Get address
npm run skill:address

# Check balance
npm run skill:balance

# Send SOL
npm run skill:send-sol -- --to "Address..." --amount 0.1 --password "pass123"

# Send tokens (by symbol)
npm run skill:send-token -- --mint USDC --to "Address..." --amount 10 --password "pass123"
```

### Multisig Operations

```bash
# Create 2-of-3 vault
npm run skill:multisig:create -- --members "Addr1,Addr2" --threshold 2 --password "pass123"

# List your vaults
npm run skill:multisig:list

# Import vault from share link
npm run skill:multisig:import -- --link "https://app.com/vault/ABC..."

# Get vault details
npm run skill:multisig:get -- --address "VaultAddress..."

# Create transfer proposal
npm run skill:multisig:propose -- --vault "VaultAddr" --to "Recipient" --amount 0.5 --password "pass123"

# List proposals
npm run skill:multisig:proposals -- --vault "VaultAddr"

# Approve proposal
npm run skill:multisig:approve -- --vault "VaultAddr" --proposal 1 --password "pass123"

# Execute approved proposal
npm run skill:multisig:execute -- --vault "VaultAddr" --proposal 1 --password "pass123"
```

## Environment Setup

Create a `.env` file:

```env
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

For development, you can use:
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
```

## Project Structure

```
src/
├── components/           # React UI components
│   ├── external/        # External wallet components
│   ├── multisig/        # Built-in wallet multisig components
│   ├── BuiltinWalletApp.tsx
│   ├── LandingPage.tsx
│   └── WalletProvider.tsx
├── skill/               # CLI skill scripts
│   ├── multisig/        # Multisig skill scripts
│   ├── wallet.ts        # Core wallet functions
│   ├── rpc.ts           # RPC connection
│   └── ...
├── utils/               # Shared utilities
│   ├── multisig.ts      # Multisig helper functions
│   └── multisigWalletAdapter.ts  # External wallet support
└── App.tsx              # Route definitions
```

## Security Notes

- **Single-sig wallet**: Password gives full access to funds
- **Multisig vaults**: Require multiple approvals for transactions
- **Never commit** `.env` files or `wallet-data/` directory
- **For production**: Use multisig for any significant amounts

## Skill Documentation

For detailed agent/AI integration, see [SKILL.md](./skills/SKILL.md).

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Build skill scripts
npm run build:skill

# Lint
npm run lint
```

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: CSS (no framework)
- **Blockchain**: Solana Web3.js
- **Multisig**: Squads Protocol SDK
- **Wallet Adapter**: @solana/wallet-adapter-react

## License

MIT
