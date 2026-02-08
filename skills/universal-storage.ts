/**
 * Universal Storage Utility
 * 
 * Works in both Node.js and browser environments.
 * - Browser: Uses localStorage
 * - Node.js: Uses file-based storage in wallet-data/
 */

import * as fs from 'fs/promises'
import * as path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'wallet-data')

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/**
 * Get the file path for a storage key (Node.js only)
 */
function getFilePath(key: string): string {
  const safeKey = Buffer.from(key).toString('base64url')
  return path.join(STORAGE_DIR, `${safeKey}.json`)
}

/**
 * Ensure storage directory exists (Node.js only)
 */
async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error
  }
}

/**
 * Universal storage interface
 */
export const universalStorage = {
  /**
   * Get a value by key
   */
  async get<T = string>(key: string): Promise<T | null> {
    if (isBrowser()) {
      const value = localStorage.getItem(key)
      if (value === null) return null
      try {
        return JSON.parse(value) as T
      } catch {
        return value as unknown as T
      }
    }

    // Node.js: file-based storage
    try {
      const filePath = getFilePath(key)
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error: any) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },

  /**
   * Set a value by key
   */
  async set<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value)

    if (isBrowser()) {
      localStorage.setItem(key, serialized)
      return
    }

    // Node.js: file-based storage
    await ensureDir()
    const filePath = getFilePath(key)
    await fs.writeFile(filePath, serialized, 'utf-8')
  },

  /**
   * Remove a key
   */
  async remove(key: string): Promise<void> {
    if (isBrowser()) {
      localStorage.removeItem(key)
      return
    }

    // Node.js: file-based storage
    try {
      const filePath = getFilePath(key)
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
  },

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    if (isBrowser()) {
      return localStorage.getItem(key) !== null
    }

    // Node.js: file-based storage
    try {
      const filePath = getFilePath(key)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  },

  /**
   * Get raw string value (no JSON parsing)
   */
  async getRaw(key: string): Promise<string | null> {
    if (isBrowser()) {
      return localStorage.getItem(key)
    }

    try {
      const filePath = getFilePath(key)
      return await fs.readFile(filePath, 'utf-8')
    } catch (error: any) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  },

  /**
   * Set raw string value (no JSON serialization)
   */
  async setRaw(key: string, value: string): Promise<void> {
    if (isBrowser()) {
      localStorage.setItem(key, value)
      return
    }

    await ensureDir()
    const filePath = getFilePath(key)
    await fs.writeFile(filePath, value, 'utf-8')
  }
}

/**
 * Synchronous storage for browser-only contexts
 * Falls back to null operations in Node.js
 */
export const syncStorage = {
  get(key: string): string | null {
    if (isBrowser()) {
      return localStorage.getItem(key)
    }
    return null
  },

  set(key: string, value: string): void {
    if (isBrowser()) {
      localStorage.setItem(key, value)
    }
  },

  remove(key: string): void {
    if (isBrowser()) {
      localStorage.removeItem(key)
    }
  },

  has(key: string): boolean {
    if (isBrowser()) {
      return localStorage.getItem(key) !== null
    }
    return false
  }
}
