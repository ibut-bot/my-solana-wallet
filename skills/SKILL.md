---
name: solana-local-wallet
description: Encrypted Solana wallet with multisig support - create wallets, send SOL/SPL tokens, and manage Squads multisig vaults
license: MIT
compatibility: openclaw
metadata:
  category: finance
  security: medium
  chain: solana
  requires_human_approval: false
---

# Solana Local Wallet

A Solana wallet skill with full multisig support:
- **Keypairs are generated locally** using `@solana/web3.js`
- **Private keys are encrypted** with a user-provided password (AES-256-GCM)
- **Storage is file-based** for persistence across sessions
- **Full transaction support** for SOL and SPL token transfers
- **Squads Multisig integration** for secure multi-signature vaults

## Security Model

⚠️ **IMPORTANT**: The single-signature wallet allows anyone with the password to access funds.

- Private key is encrypted at rest using PBKDF2 + AES-256-GCM
- Password is never stored - only used for encryption/decryption
- Wallet data is stored in `wallet-data/` directory
- Suitable for testing, development, or small amounts

**For high-value transactions, use the multisig vault feature** which requires multiple approvals before funds can be moved.

## ⚠️ Important: Single Wallet Limitation

This skill currently supports **one wallet at a time** in the default storage location.

**Creating a new wallet will overwrite your existing wallet file.**

To avoid losing funds:
1. **Always backup** your wallet before creating a new one:
   ```bash
   cp wallet-data/c29sYW5hX3dhbGxldA.json wallet-data/my-wallet-backup.json
   ```
2. **Export your secret key** immediately after creation:
   ```bash
   npm run skill:unlock -- --password "yourpass" --show-secret
   # Save the secret key somewhere secure!
   ```
3. To use multiple wallets, use different `WALLET_DATA_DIR` environments

## Best Practices

### After Creating a Wallet — IMMEDIATELY:

1. **Export the secret key:**
   ```bash
   npm run skill:unlock -- --password "yourpass" --show-secret
   ```
   Save the `secretKey` output somewhere secure (password manager, encrypted file).

2. **Backup the wallet file:**
   ```bash
   npm run skill:backup -- --password "yourpass"
   ```
   Or manually:
   ```bash
   cp wallet-data/c29sYW5hX3dhbGxldA.json ~/backups/solana-wallet-$(date +%Y%m%d).json
   ```

3. **Verify you can restore:**
   ```bash
   npm run skill:unlock -- --password "yourpass"
   ```

⚠️ Without the secret key or wallet file backup, your funds are unrecoverable.

## Capabilities

### 1. Create Wallet
Creates a new Solana keypair and encrypts it with a password.

**When to use**: User explicitly asks to create/setup a new wallet

**Process**:
1. Ask user for a wallet name and encryption password (min 8 chars)
2. Call the create-wallet script
3. Return the public address to the user
4. Remind user to securely store their password

### 2. Get Wallet Address
Returns the Solana address without needing the password.

**When to use**: User asks for their wallet/deposit address

### 3. Check Balance
Shows SOL balance and all SPL token balances.

**When to use**: User asks about their balance, holdings, or portfolio

**Returns**: SOL balance + list of SPL tokens with amounts

### 4. Send SOL
Transfers SOL to another wallet address.

**When to use**: User wants to send/transfer SOL to someone

**Process**:
1. Confirm destination address and amount
2. Ask for wallet password
3. Execute transfer
4. Return transaction hash and explorer link

### 5. Send SPL Tokens
Transfers SPL tokens to another wallet address.

**When to use**: User wants to send tokens (USDC, etc.) to someone

**Process**:
1. Confirm token (by symbol like "USDC" or mint address), destination address, and amount
2. Ask for wallet password
3. Execute transfer (creates recipient token account if needed)
4. Return transaction hash and explorer link

**Supported token symbols**: USDC, USDT, BONK, JUP, WIF, JTO, PYTH, RENDER, MEW, DRIFT, TNSR, RAY, ORCA, wSOL, mSOL

### 6. Unlock Wallet
Decrypts the wallet and returns full keypair information.

**When to use**: User needs to export their private key

### 7. Check Wallet Status
Checks if a wallet exists.

**When to use**: At conversation start or when user asks about wallet status

### 8. Delete Wallet
Permanently deletes the encrypted wallet file.

**When to use**: User explicitly asks to delete/remove their wallet

---

## Multisig Capabilities (Squads Protocol)

The multisig feature provides secure multi-signature vaults where transactions require approval from multiple members before execution. Built on the Squads Protocol.

### 9. Create Multisig Vault
Creates a new multisig vault with specified members and approval threshold.

**When to use**: User wants to create a shared vault, set up team treasury, or secure funds with multi-approval

**Process**:
1. Ask for member addresses (comma-separated, creator is auto-included)
2. Ask for threshold (number of approvals needed, defaults to majority)
3. Ask for wallet password
4. Create vault on-chain
5. Return vault address and share link

### 10. Get Multisig Details
Returns vault details including members, threshold, balance, and proposals.

**When to use**: User asks about a vault's configuration, balance, or status

### 11. List Multisig Vaults
Lists all stored multisig vaults for the current wallet.

**When to use**: User asks which vaults they have access to

### 12. Import Multisig Vault
Imports a vault using an address or share link.

**When to use**: User receives a share link or has a vault address to import

### 13. Create Transfer Proposal
Creates a proposal to send SOL from the vault.

**When to use**: User wants to initiate a transfer from a multisig vault

**Process**:
1. Confirm vault address, recipient, and amount
2. Ask for wallet password
3. Create proposal on-chain
4. Return proposal share link for other members to approve

### 14. List Proposals
Lists all proposals for a vault with their status.

**When to use**: User asks about pending proposals or proposal history

### 15. Approve Proposal
Approves a proposal as a vault member.

**When to use**: User wants to approve/sign off on a pending proposal

### 16. Reject Proposal
Rejects a proposal as a vault member.

**When to use**: User wants to reject a pending proposal

### 17. Execute Proposal
Executes an approved proposal (performs the actual transfer).

**When to use**: Proposal has reached threshold and user wants to execute it

### 18. Get Share Link
Generates a shareable link for a vault or proposal. This is a lightweight operation that doesn't make any blockchain calls.

**When to use**: Agent needs to quickly generate a share link to pass to other members for sign-off

**Returns**: URL that members can use to access the vault/proposal in the web UI

## Scripts

Located in the `skills/` directory:

### Wallet Scripts

| Script | Purpose | Arguments | Returns |
|--------|---------|-----------|---------|
| `create-wallet.ts` | Create new encrypted wallet | `--name`, `--password`, `[--force]` | Address + status |
| `backup-wallet.ts` | Backup wallet file + export key | `--password` | Backup path + secret key |
| `get-address.ts` | Get public address | (none) | Address string |
| `get-balance.ts` | Get SOL + token balances (with names) | (none) | Balances + symbols |
| `send-sol.ts` | Send SOL | `--to`, `--amount`, `--password` | TX hash |
| `send-token.ts` | Send SPL tokens | `--mint` (symbol or address), `--to`, `--amount`, `--password` | TX hash |
| `unlock-wallet.ts` | Decrypt and access wallet | `--password`, `[--show-secret]` | Keypair info |
| `check-status.ts` | Check if wallet exists | (none) | Status object |
| `delete-wallet.ts` | Delete wallet file | `--confirm` | Status |

### Multisig Scripts

Located in the `skills/multisig/` directory:

| Script | Purpose | Arguments | Returns |
|--------|---------|-----------|---------|
| `create-multisig.ts` | Create multisig vault | `--members`, `--threshold`, `--password`, `[--dry-run]` | Vault address + share link |
| `get-multisig.ts` | Get vault details | `--vault`, `[--rpc-url]` | Vault info + balance + proposals |
| `list-multisigs.ts` | List stored vaults | `[--rpc-url]` | Array of vaults |
| `import-vault.ts` | Import vault by link/address | `--link` or `--vault`, `[--rpc-url]` | Vault info |
| `create-proposal.ts` | Create transfer proposal | `--vault`, `--to`, `--amount`, `--password`, `[--dry-run]` | Proposal index + share link |
| `get-proposals.ts` | List proposals | `--vault`, `[--status]`, `[--rpc-url]` | Array of proposals |
| `approve-proposal.ts` | Approve a proposal | `--vault`, `--proposal`, `--password` | Updated status |
| `reject-proposal.ts` | Reject a proposal | `--vault`, `--proposal`, `--password` | Updated status |
| `execute-proposal.ts` | Execute approved proposal | `--vault`, `--proposal`, `--password` | TX hash |
| `get-share-link.ts` | Generate share link (no RPC call) | `--vault`, `[--proposal]`, `[--base-url]` | Share URL |

**Common Options:**
- `--rpc-url`: Override RPC endpoint (optional, works on most commands)
- `--dry-run`: Validate without executing (create-multisig, create-proposal)

## CLI Usage

```bash
# Create a new wallet
npm run skill:create -- --name "My Wallet" --password "mySecurePassword123"

# Create a new wallet (overwrite existing — requires --force)
npm run skill:create -- --name "New Wallet" --password "mySecurePassword123" --force

# Backup wallet (copies file + exports secret key)
npm run skill:backup -- --password "mySecurePassword123"

# Check if wallet exists
npm run skill:status

# Get wallet address (no password needed)
npm run skill:address

# Check balances (SOL + tokens)
npm run skill:balance

# Send SOL
npm run skill:send-sol -- --to "RecipientAddress..." --amount 0.1 --password "mySecurePassword123"

# Send SPL tokens (by symbol)
npm run skill:send-token -- --mint USDC --to "RecipientAddress..." --amount 100 --password "mySecurePassword123"

# Send SPL tokens (by mint address)
npm run skill:send-token -- --mint "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" --to "RecipientAddress..." --amount 100 --password "mySecurePassword123"

# Unlock wallet (requires password)
npm run skill:unlock -- --password "mySecurePassword123"

# Unlock and show secret key
npm run skill:unlock -- --password "mySecurePassword123" --show-secret

# Delete wallet
npm run skill:delete -- --confirm

# ===== MULTISIG COMMANDS =====

# Create a multisig vault (2-of-3)
npm run skill:multisig:create -- --members "Address1...,Address2..." --threshold 2 --password "mySecurePassword123"

# List your multisig vaults
npm run skill:multisig:list

# Import a vault from share link
npm run skill:multisig:import -- --link "https://yourapp.com/vault/VaultAddress..."

# Import a vault by direct address
npm run skill:multisig:import -- --address "VaultAddress..."

# Get vault details
npm run skill:multisig:get -- --address "VaultAddress..."

# Create a transfer proposal
npm run skill:multisig:propose -- --vault "VaultAddress" --to "RecipientAddress" --amount 0.5 --password "mySecurePassword123"

# List all proposals for a vault
npm run skill:multisig:proposals -- --vault "VaultAddress"

# List only active proposals
npm run skill:multisig:proposals -- --vault "VaultAddress" --status active

# Approve a proposal
npm run skill:multisig:approve -- --vault "VaultAddress" --proposal 1 --password "mySecurePassword123"

# Reject a proposal
npm run skill:multisig:reject -- --vault "VaultAddress" --proposal 1 --password "mySecurePassword123"

# Execute an approved proposal
npm run skill:multisig:execute -- --vault "VaultAddress" --proposal 1 --password "mySecurePassword123"

# Generate a share link for a vault (no password needed, no RPC call)
npm run skill:multisig:link -- --vault "VaultAddress"

# Generate a share link for a specific proposal
npm run skill:multisig:link -- --vault "VaultAddress" --proposal 1

# Generate share link with custom base URL (for production)
npm run skill:multisig:link -- --vault "VaultAddress" --base-url "https://myapp.com"
```

## Environment Configuration

RPC URL can be configured in multiple ways (priority order):

1. **CLI flag**: `--rpc-url "https://..."` (highest priority)
2. **Environment variable**: `SOLANA_RPC_URL="https://..."`
3. **`.env` file**: Create `.env` with `SOLANA_RPC_URL=https://...`
4. **Default**: Falls back to public mainnet RPC

```bash
# Using CLI flag
npm run skill:multisig:get -- --vault "..." --rpc-url "https://mainnet.helius-rpc.com/?api-key=KEY"

# Using environment variable
SOLANA_RPC_URL="https://..." npm run skill:multisig:get -- --vault "..."

# Using .env file
echo 'SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=KEY' > .env
npm run skill:multisig:get -- --vault "..."
```

## Dry Run Mode

Test vault creation and proposals without spending SOL:

```bash
# Validate vault creation parameters
npm run skill:multisig:create -- --members "addr1,addr2" --threshold 2 --password "pass" --dry-run

# Validate proposal parameters
npm run skill:multisig:propose -- --vault "..." --to "..." --amount 1 --password "pass" --dry-run
```

Dry run validates:
- Address formats
- Balance sufficiency  
- Threshold logic
- Member permissions

## Error Handling

| Error Code | Meaning | Action |
|------------|---------|--------|
| `NO_WALLET` | User hasn't created wallet yet | Guide through creation |
| `INVALID_PASSWORD` | Wrong decryption password | Ask user to re-enter |
| `WALLET_EXISTS` | Wallet already exists | Ask if they want to delete and recreate |
| `WEAK_PASSWORD` | Password too short | Ask for stronger password (min 8 chars) |
| `INSUFFICIENT_BALANCE` | Not enough SOL/tokens | Show balance, suggest deposit |
| `NO_TOKEN_ACCOUNT` | User doesn't hold that token | Inform user they don't have this token |

### Multisig Error Codes

| Error Code | Meaning | Action |
|------------|---------|--------|
| `VAULT_NOT_FOUND` | Multisig vault doesn't exist | Check address is correct |
| `NOT_A_MEMBER` | Wallet is not a vault member | Cannot interact with this vault |
| `INVALID_THRESHOLD` | Threshold exceeds member count | Reduce threshold or add members |
| `PROPOSAL_NOT_FOUND` | Proposal doesn't exist | Check proposal index |
| `PROPOSAL_NOT_ACTIVE` | Proposal already completed | Cannot vote on completed proposals |
| `PROPOSAL_NOT_APPROVED` | Proposal hasn't reached threshold | Wait for more approvals |
| `ALREADY_APPROVED` | User already voted on proposal | One vote per member |
| `INSUFFICIENT_VAULT_BALANCE` | Vault doesn't have enough SOL | Deposit to vault treasury |

## Proposal Lifecycle

Understanding the proposal workflow:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │ ──► │   Active    │ ──► │  Approved   │ ──► │  Executed   │
│  Proposal   │     │ (voting)    │     │ (threshold  │     │ (funds      │
│             │     │             │     │  reached)   │     │  transferred)│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           │ (rejected)
                           ▼
                    ┌─────────────┐
                    │  Rejected   │
                    └─────────────┘
```

1. **Create**: Any member proposes a transfer
2. **Active**: Members vote (approve/reject)
3. **Approved**: Threshold reached, ready to execute
4. **Executed**: Any member can execute, funds transfer
5. **Rejected**: Proposal cancelled (optional)

## Troubleshooting

### Common Issues

**"INSUFFICIENT_BALANCE" when creating vault**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "required": 0.003,
  "current": 0.001
}
```
Solution: Deposit SOL to your wallet for rent. Vault creation requires ~0.003 SOL.

**"VAULT_NOT_FOUND" when importing**
- Verify the address is correct (case-sensitive)
- Check you're on the right network (mainnet vs devnet)
- Use `--rpc-url` to specify the correct endpoint

**"NOT_A_MEMBER" error**
- Your wallet address is not in the vault's member list
- Ask the vault creator to add your address
- Check if you're using the correct wallet

**Proposal stuck in "Active" status**
- Need more approvals to reach threshold
- Check how many approvals are needed: `npm run skill:multisig:proposals -- --vault "..."`
- Share the proposal link with other members

**"Invalid password" error**
- Password is case-sensitive
- Minimum 8 characters required
- Check for trailing spaces

### Debug Tips

```bash
# Check wallet exists and get address
npm run skill:status
npm run skill:address

# Check vault details and balance
npm run skill:multisig:get -- --vault "VaultAddress"

# List all proposals with status
npm run skill:multisig:proposals -- --vault "VaultAddress"

# Filter only active proposals
npm run skill:multisig:proposals -- --vault "VaultAddress" --status active
```

## Example Interactions

**Creating a wallet:**
```
User: "Create a Solana wallet for me"
Agent: "I'll create a new Solana wallet. Please provide:
       1. A name for the wallet
       2. An encryption password (minimum 8 characters)"
User: "Name it 'Test Wallet', password is mysecretpass123"
Agent: [Executes create-wallet script]
Agent: "✓ Wallet created successfully!
       Address: 7xKp...3nQm
       
       ⚠️ Important: Save your password securely. 
       If you lose it, you cannot recover your wallet."
```

**Checking balance:**
```
User: "What's my balance?"
Agent: [Executes get-balance script]
Agent: "Your wallet balance:
       
       Address: 7xKp...3nQm
       SOL: 1.5 SOL
       
       SPL Tokens (2):
       - USDC: 100.00
       - BONK: 1,000,000"
```

**Sending SOL:**
```
User: "Send 0.5 SOL to 7abc...xyz"
Agent: "I'll send 0.5 SOL to 7abc...xyz. Please provide your wallet password."
User: "mysecretpass123"
Agent: [Executes send-sol script]
Agent: "✓ Transaction successful!
       Sent: 0.5 SOL
       To: 7abc...xyz
       TX: https://solscan.io/tx/5xyz..."
```

**Sending tokens:**
```
User: "Send 50 USDC to 7abc...xyz"
Agent: "I'll send 50 USDC to 7abc...xyz. Please provide your wallet password."
User: "mysecretpass123"
Agent: [Executes: send-token --mint USDC --to 7abc...xyz --amount 50 --password ...]
Agent: "✓ Transaction successful!
       Sent: 50 USDC
       To: 7abc...xyz
       TX: https://solscan.io/tx/5xyz..."
```

**Creating a multisig vault:**
```
User: "Create a multisig vault with addresses 7abc...xyz and 8def...uvw, 
       requiring 2 of 3 signatures"
Agent: "I'll create a 2-of-3 multisig vault with you and those two addresses. 
       Please provide your wallet password."
User: "mysecretpass123"
Agent: [Executes: multisig:create --members "7abc...,8def..." --threshold 2 --password ...]
Agent: "✓ Multisig vault created!
       
       Vault Address: 9xyz...abc
       Treasury Address: Bnm1...opq (fund this address)
       Threshold: 2 of 3
       Members: [Your address, 7abc...xyz, 8def...uvw]
       
       Share link: https://yourapp.com/vault/9xyz...abc
       Send this link to other members so they can access the vault."
```

**Creating a transfer proposal:**
```
User: "Propose sending 1 SOL to 7abc...xyz from vault 9xyz...abc"
Agent: "I'll create a proposal to send 1 SOL from the vault. Password?"
User: "mysecretpass123"
Agent: [Executes: multisig:propose --vault 9xyz...abc --to 7abc...xyz --amount 1 --password ...]
Agent: "✓ Proposal #1 created!
       
       Amount: 1 SOL
       Recipient: 7abc...xyz
       Status: Active (needs 2 approvals)
       
       Share this link with vault members to approve:
       https://yourapp.com/vault/9xyz...abc/proposal/1"
```

**Approving a proposal:**
```
User: "Approve proposal #1 on vault 9xyz...abc"
Agent: "I'll approve proposal #1. Password?"
User: "mysecretpass123"
Agent: [Executes: multisig:approve --vault 9xyz...abc --proposal 1 --password ...]
Agent: "✓ Approval recorded!
       
       Proposal #1 now has 2/2 required approvals.
       Status: Approved - ready to execute!"
```

**Executing an approved proposal:**
```
User: "Execute proposal #1"
Agent: "I'll execute the approved proposal. Password?"
User: "mysecretpass123"
Agent: [Executes: multisig:execute --vault 9xyz...abc --proposal 1 --password ...]
Agent: "✓ Transaction executed!
       
       Sent: 1 SOL
       From: Vault treasury
       To: 7abc...xyz
       TX: https://solscan.io/tx/5xyz..."
```

**Getting a share link (fast, no password needed):**
```
User: "Get me a share link for proposal #2 on vault 9xyz...abc so I can send it to team members"
Agent: [Executes: multisig:link --vault 9xyz...abc --proposal 2]
Agent: "Here's the share link for proposal #2:
       
       https://yourapp.com/vault/9xyz...abc/proposal/2
       
       Send this to your vault members. They can open it in their browser,
       connect their wallet (Phantom, etc.), and approve the proposal."
```

**Importing a vault from a share link:**
```
User: "I received this vault link from my team: https://app.com/vault/9xyz...abc"
Agent: [Executes: multisig:import --link "https://app.com/vault/9xyz...abc"]
Agent: "✓ Vault imported successfully!
       
       Address: 9xyz...abc
       Threshold: 2 of 3
       Members: 3
       
       You are a member of this vault and can now:
       - View proposals: npm run skill:multisig:proposals -- --vault 9xyz...abc
       - Approve/reject proposals
       - Create new proposals"
```

**Dry-run before creating vault:**
```
User: "I want to create a 2-of-3 vault with these addresses, but first test it"
Agent: [Executes: multisig:create --members "addr1,addr2" --threshold 2 --password "..." --dry-run]
Agent: "✓ Dry run successful! Configuration validated:
       
       Creator: YourAddress...
       Members: 3 (you + 2 others)
       Threshold: 2 of 3
       Estimated cost: 0.003 SOL
       Your balance: 0.5 SOL ✓
       
       Remove --dry-run to create the vault."
```

## Storage Location

Wallet data is stored in `wallet-data/` directory:
- `wallet.json` - Encrypted wallet data (safe to backup)
- `_index.json` - Storage index

## Programmatic Usage

```typescript
import { 
  createWallet, 
  unlockWallet, 
  getAddress, 
  checkStatus,
  deleteWallet,
  getKeypair,
} from './skills/index.js'
import { getConnection } from './skills/rpc.js'

// Create new wallet
const result = await createWallet('My Wallet', 'password123')
console.log(result.address)

// Check status
const status = await checkStatus()
console.log(status.exists)

// Get address (no password)
const addr = await getAddress()
console.log(addr.address)

// Get keypair for signing
const keypair = await getKeypair('password123')
const connection = getConnection()

// Send transaction using keypair
// ... use @solana/web3.js as normal

// Delete wallet
await deleteWallet()
```

### Multisig Programmatic Usage

```typescript
import {
  createMultisigVault,
  getMultisigAccount,
  getVaultBalance,
  getProposals,
  createTransferProposal,
  approveProposal,
  executeVaultTransaction,
  getAllPermissions,
  saveMultisigAddress,
  getStoredMultisigs,
  getVaultShareLink,
  getProposalShareLink,
} from './skills/multisig/index.js'
import { getKeypair } from './skills/index.js'
import { getConnection } from './skills/rpc.js'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'

const connection = getConnection()
const keypair = await getKeypair('password123')

// Create a 2-of-3 multisig vault
const members = [
  { publicKey: keypair.publicKey, permissions: getAllPermissions() },
  { publicKey: new PublicKey('Member2Address...'), permissions: getAllPermissions() },
  { publicKey: new PublicKey('Member3Address...'), permissions: getAllPermissions() },
]
const { multisigPda, vaultPda, signature } = await createMultisigVault(
  connection, keypair, members, 2, 0
)

// Save and share
saveMultisigAddress(keypair.publicKey.toBase58(), multisigPda.toBase58(), multisigPda.toBase58())
console.log('Share link:', getVaultShareLink(multisigPda.toBase58()))

// Get vault details
const vault = await getMultisigAccount(connection, multisigPda)
const balance = await getVaultBalance(connection, multisigPda)

// Create a transfer proposal
const recipient = new PublicKey('RecipientAddress...')
const proposal = await createTransferProposal(
  connection, keypair, multisigPda, recipient, 0.5 * LAMPORTS_PER_SOL
)
console.log('Proposal share link:', getProposalShareLink(multisigPda.toBase58(), proposal.transactionIndex))

// Approve (each member calls this)
await approveProposal(connection, keypair, multisigPda, proposal.transactionIndex)

// Execute after threshold reached
await executeVaultTransaction(connection, keypair, multisigPda, proposal.transactionIndex)
```

## Common Token Mints (Mainnet)

| Token | Mint Address |
|-------|--------------|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` |

Use these mint addresses when sending tokens.
