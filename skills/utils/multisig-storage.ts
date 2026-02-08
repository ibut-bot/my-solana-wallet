/**
 * Multisig Storage - Universal storage for multisig vault references
 * 
 * Works in both Node.js (file-based) and browser (localStorage) environments.
 */

import * as fs from 'fs/promises'
import * as path from 'path'

const MULTISIG_STORAGE_KEY = "squads_multisigs";

interface StoredMultisig {
  multisigPda: string;
  createKey: string;
}

type MultisigStorageData = Record<string, StoredMultisig[]>;

/**
 * Check if running in browser
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/**
 * Get file path for Node.js storage
 */
function getStorageFilePath(): string {
  return path.join(process.cwd(), 'wallet-data', 'multisigs.json')
}

/**
 * Ensure storage directory exists (Node.js)
 */
async function ensureStorageDir(): Promise<void> {
  const filePath = getStorageFilePath()
  const dir = path.dirname(filePath)
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error
  }
}

/**
 * Load all multisig data
 */
async function loadData(): Promise<MultisigStorageData> {
  if (isBrowser()) {
    const stored = localStorage.getItem(MULTISIG_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  }

  // Node.js: file-based
  try {
    const filePath = getStorageFilePath()
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error: any) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

/**
 * Save all multisig data
 */
async function saveData(data: MultisigStorageData): Promise<void> {
  if (isBrowser()) {
    localStorage.setItem(MULTISIG_STORAGE_KEY, JSON.stringify(data))
    return
  }

  // Node.js: file-based
  await ensureStorageDir()
  const filePath = getStorageFilePath()
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Sync version for browser - returns empty in Node.js
 */
function loadDataSync(): MultisigStorageData {
  if (isBrowser()) {
    const stored = localStorage.getItem(MULTISIG_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  }
  return {}
}

/**
 * Sync version for browser - no-op in Node.js
 */
function saveDataSync(data: MultisigStorageData): void {
  if (isBrowser()) {
    localStorage.setItem(MULTISIG_STORAGE_KEY, JSON.stringify(data))
  }
}

// ============== Async API (recommended) ==============

/**
 * Save a multisig address (async - works everywhere)
 */
export async function saveMultisigAddressAsync(
  ownerPublicKey: string,
  multisigPda: string,
  createKey: string
): Promise<void> {
  const data = await loadData()

  if (!data[ownerPublicKey]) {
    data[ownerPublicKey] = []
  }

  // Check if already exists
  if (!data[ownerPublicKey].some((m) => m.multisigPda === multisigPda)) {
    data[ownerPublicKey].push({ multisigPda, createKey })
    await saveData(data)
  }
}

/**
 * Get stored multisigs (async - works everywhere)
 */
export async function getStoredMultisigsAsync(
  ownerPublicKey: string
): Promise<StoredMultisig[]> {
  const data = await loadData()
  return data[ownerPublicKey] || []
}

/**
 * Remove a stored multisig (async - works everywhere)
 */
export async function removeStoredMultisigAsync(
  ownerPublicKey: string,
  multisigPda: string
): Promise<void> {
  const data = await loadData()

  if (data[ownerPublicKey]) {
    data[ownerPublicKey] = data[ownerPublicKey].filter(
      (m) => m.multisigPda !== multisigPda
    )
    await saveData(data)
  }
}

// ============== Sync API (browser only, for backward compatibility) ==============

/**
 * Save a multisig address (sync - browser only)
 * @deprecated Use saveMultisigAddressAsync instead
 */
export function saveMultisigAddress(
  ownerPublicKey: string,
  multisigPda: string,
  createKey: string
): void {
  const data = loadDataSync()

  if (!data[ownerPublicKey]) {
    data[ownerPublicKey] = []
  }

  if (!data[ownerPublicKey].some((m) => m.multisigPda === multisigPda)) {
    data[ownerPublicKey].push({ multisigPda, createKey })
    saveDataSync(data)
  }
}

/**
 * Get stored multisigs (sync - browser only)
 * @deprecated Use getStoredMultisigsAsync instead
 */
export function getStoredMultisigs(
  ownerPublicKey: string
): StoredMultisig[] {
  const data = loadDataSync()
  return data[ownerPublicKey] || []
}

/**
 * Remove a stored multisig (sync - browser only)
 * @deprecated Use removeStoredMultisigAsync instead
 */
export function removeStoredMultisig(
  ownerPublicKey: string,
  multisigPda: string
): void {
  const data = loadDataSync()

  if (data[ownerPublicKey]) {
    data[ownerPublicKey] = data[ownerPublicKey].filter(
      (m) => m.multisigPda !== multisigPda
    )
    saveDataSync(data)
  }
}
