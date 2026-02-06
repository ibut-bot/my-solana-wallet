import { Keypair } from '@solana/web3.js';
import { encrypt, decrypt } from './crypto';

const STORAGE_KEY = 'solana_wallet_encrypted';

export interface WalletData {
  publicKey: string;
  secretKey: number[];
}

/**
 * Generates a new Solana keypair
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Converts a Keypair to storable wallet data
 */
export function keypairToWalletData(keypair: Keypair): WalletData {
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey),
  };
}

/**
 * Converts wallet data back to a Keypair
 */
export function walletDataToKeypair(data: WalletData): Keypair {
  return Keypair.fromSecretKey(new Uint8Array(data.secretKey));
}

/**
 * Encrypts and saves wallet data to localStorage
 */
export async function saveWallet(keypair: Keypair, password: string): Promise<void> {
  const walletData = keypairToWalletData(keypair);
  const encrypted = await encrypt(JSON.stringify(walletData), password);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

/**
 * Loads and decrypts wallet data from localStorage
 * Returns null if no wallet exists
 * Throws if password is incorrect
 */
export async function loadWallet(password: string): Promise<Keypair | null> {
  const encrypted = localStorage.getItem(STORAGE_KEY);
  if (!encrypted) {
    return null;
  }

  try {
    const decrypted = await decrypt(encrypted, password);
    const walletData: WalletData = JSON.parse(decrypted);
    return walletDataToKeypair(walletData);
  } catch {
    throw new Error('Invalid password or corrupted wallet data');
  }
}

/**
 * Checks if a wallet exists in localStorage
 */
export function walletExists(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Deletes the wallet from localStorage
 */
export function deleteWallet(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Formats a public key for display (truncated)
 */
export function formatPublicKey(publicKey: string): string {
  if (publicKey.length <= 12) return publicKey;
  return `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`;
}

/**
 * Converts secret key to base58 string for display/export
 */
export function secretKeyToBase58(secretKey: Uint8Array): string {
  // Simple base58 encoding for display
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let num = BigInt(0);
  for (const byte of secretKey) {
    num = num * BigInt(256) + BigInt(byte);
  }
  
  let result = '';
  while (num > 0) {
    result = ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }
  
  // Handle leading zeros
  for (const byte of secretKey) {
    if (byte === 0) {
      result = '1' + result;
    } else {
      break;
    }
  }
  
  return result;
}
