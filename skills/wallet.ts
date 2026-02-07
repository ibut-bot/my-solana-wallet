/**
 * Core wallet functions for Solana keypair management
 */

import { Keypair } from '@solana/web3.js'
import { encrypt, decrypt } from './crypto.js'
import { FileStorage, WALLET_DATA_DIR } from './storage.js'
import {
  NoWalletError,
  InvalidPasswordError,
  WalletExistsError,
  WeakPasswordError,
} from './errors.js'

const WALLET_KEY = 'solana_wallet'
const MIN_PASSWORD_LENGTH = 8

export interface WalletData {
  name: string
  publicKey: string
  encryptedSecretKey: string
  createdAt: number
}

export interface CreateWalletResult {
  success: boolean
  address?: string
  name?: string
  error?: string
}

export interface UnlockWalletResult {
  success: boolean
  publicKey?: string
  secretKey?: string
  secretKeyArray?: number[]
  name?: string
  error?: string
}

export interface WalletStatus {
  exists: boolean
  name?: string
  publicKey?: string
  createdAt?: number
  error?: string
}

export interface AddressResult {
  success: boolean
  address?: string
  name?: string
  error?: string
}

/**
 * Format public key for display (truncated)
 */
export function formatPublicKey(publicKey: string): string {
  if (publicKey.length <= 12) return publicKey
  return `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`
}

/**
 * Convert secret key bytes to base58 string
 */
export function secretKeyToBase58(secretKey: Uint8Array): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let num = BigInt(0)
  for (const byte of secretKey) {
    num = num * BigInt(256) + BigInt(byte)
  }

  let result = ''
  while (num > 0) {
    result = ALPHABET[Number(num % BigInt(58))] + result
    num = num / BigInt(58)
  }

  // Handle leading zeros
  for (const byte of secretKey) {
    if (byte === 0) {
      result = '1' + result
    } else {
      break
    }
  }

  return result
}

/**
 * Create a new wallet with the given name and password
 */
export async function createWallet(
  name: string,
  password: string
): Promise<CreateWalletResult> {
  // Validate password
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(MIN_PASSWORD_LENGTH)
  }

  const storage = new FileStorage(WALLET_DATA_DIR)

  // Check if wallet already exists
  const existing = await storage.get<WalletData>(WALLET_KEY)
  if (existing) {
    throw new WalletExistsError()
  }

  // Generate new keypair
  const keypair = Keypair.generate()
  const publicKey = keypair.publicKey.toBase58()

  // Encrypt secret key
  const secretKeyJson = JSON.stringify(Array.from(keypair.secretKey))
  const encryptedSecretKey = encrypt(secretKeyJson, password)

  // Store wallet data
  const walletData: WalletData = {
    name,
    publicKey,
    encryptedSecretKey,
    createdAt: Date.now(),
  }

  await storage.set(WALLET_KEY, walletData)

  return {
    success: true,
    address: publicKey,
    name,
  }
}

/**
 * Unlock wallet and return keypair information
 */
export async function unlockWallet(password: string): Promise<UnlockWalletResult> {
  const storage = new FileStorage(WALLET_DATA_DIR)

  const walletData = await storage.get<WalletData>(WALLET_KEY)
  if (!walletData) {
    throw new NoWalletError()
  }

  try {
    // Decrypt secret key
    const secretKeyJson = decrypt(walletData.encryptedSecretKey, password)
    const secretKeyArray = JSON.parse(secretKeyJson) as number[]
    const secretKeyUint8 = new Uint8Array(secretKeyArray)

    // Reconstruct keypair to verify
    const keypair = Keypair.fromSecretKey(secretKeyUint8)

    return {
      success: true,
      publicKey: keypair.publicKey.toBase58(),
      secretKey: secretKeyToBase58(secretKeyUint8),
      secretKeyArray,
      name: walletData.name,
    }
  } catch (error: any) {
    throw new InvalidPasswordError()
  }
}

/**
 * Get wallet address without password
 */
export async function getAddress(): Promise<AddressResult> {
  const storage = new FileStorage(WALLET_DATA_DIR)

  const walletData = await storage.get<WalletData>(WALLET_KEY)
  if (!walletData) {
    throw new NoWalletError()
  }

  return {
    success: true,
    address: walletData.publicKey,
    name: walletData.name,
  }
}

/**
 * Check if wallet exists and return basic info
 */
export async function checkStatus(): Promise<WalletStatus> {
  const storage = new FileStorage(WALLET_DATA_DIR)

  try {
    const walletData = await storage.get<WalletData>(WALLET_KEY)

    if (!walletData) {
      return { exists: false }
    }

    return {
      exists: true,
      name: walletData.name,
      publicKey: walletData.publicKey,
      createdAt: walletData.createdAt,
    }
  } catch (error: any) {
    return {
      exists: false,
      error: error.message,
    }
  }
}

/**
 * Delete the wallet
 */
export async function deleteWallet(): Promise<{ success: boolean; error?: string }> {
  const storage = new FileStorage(WALLET_DATA_DIR)

  const walletData = await storage.get<WalletData>(WALLET_KEY)
  if (!walletData) {
    throw new NoWalletError()
  }

  await storage.remove(WALLET_KEY)

  return { success: true }
}

/**
 * Get keypair object (for signing transactions)
 */
export async function getKeypair(password: string): Promise<Keypair> {
  const storage = new FileStorage(WALLET_DATA_DIR)

  const walletData = await storage.get<WalletData>(WALLET_KEY)
  if (!walletData) {
    throw new NoWalletError()
  }

  try {
    const secretKeyJson = decrypt(walletData.encryptedSecretKey, password)
    const secretKeyArray = JSON.parse(secretKeyJson) as number[]
    return Keypair.fromSecretKey(new Uint8Array(secretKeyArray))
  } catch {
    throw new InvalidPasswordError()
  }
}
