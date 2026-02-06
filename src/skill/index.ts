/**
 * Solana Local Wallet Skill
 *
 * OpenClaw skill for simple encrypted Solana wallet management.
 * Create, store, and access keypairs locally with password protection.
 * Supports SOL and SPL token transfers.
 */

// Core wallet functions
export {
  createWallet,
  unlockWallet,
  getAddress,
  checkStatus,
  deleteWallet,
  getKeypair,
  formatPublicKey,
  secretKeyToBase58,
  type WalletData,
  type CreateWalletResult,
  type UnlockWalletResult,
  type WalletStatus,
  type AddressResult,
} from './wallet.js'

// RPC connection utilities
export { getConnection, getRpcUrl } from './rpc.js'

// Storage utilities
export { FileStorage, WALLET_DATA_DIR } from './storage.js'

// Crypto utilities
export { encrypt, decrypt } from './crypto.js'

// Error types
export {
  NoWalletError,
  InvalidPasswordError,
  WalletExistsError,
  WeakPasswordError,
  InsufficientBalanceError,
} from './errors.js'

// Multisig functions
export * from './multisig/index.js'
