/**
 * File-based storage adapter for wallet data
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const WALLET_DATA_DIR = path.join(__dirname, '..', '..', 'wallet-data')

/**
 * File-based storage for wallet data
 */
export class FileStorage {
  private baseDir: string
  private indexFile: string
  private index: Set<string> = new Set()
  private initialized: boolean = false

  constructor(baseDir: string = WALLET_DATA_DIR) {
    this.baseDir = baseDir
    this.indexFile = path.join(baseDir, '_index.json')
  }

  /**
   * Ensure storage directory and index are initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    // Ensure directory exists
    await fs.mkdir(this.baseDir, { recursive: true })

    // Load existing index
    try {
      const content = await fs.readFile(this.indexFile, 'utf-8')
      const keys = JSON.parse(content) as string[]
      this.index = new Set(keys)
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
      // Index doesn't exist yet, start fresh
      this.index = new Set()
    }

    this.initialized = true
  }

  /**
   * Save the index to disk
   */
  private async saveIndex(): Promise<void> {
    await fs.writeFile(
      this.indexFile,
      JSON.stringify([...this.index], null, 2),
      'utf-8'
    )
  }

  /**
   * Get safe filename from key
   */
  private getFilePath(key: string): string {
    const safeKey = Buffer.from(key).toString('base64url')
    return path.join(this.baseDir, `${safeKey}.json`)
  }

  /**
   * Get a value by key
   */
  async get<T>(key: string): Promise<T | null> {
    await this.ensureInitialized()

    try {
      const filePath = this.getFilePath(key)
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * Set a value by key
   */
  async set<T>(key: string, value: T): Promise<void> {
    await this.ensureInitialized()

    const filePath = this.getFilePath(key)
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')

    // Update index
    if (!this.index.has(key)) {
      this.index.add(key)
      await this.saveIndex()
    }
  }

  /**
   * Remove a key
   */
  async remove(key: string): Promise<void> {
    await this.ensureInitialized()

    try {
      const filePath = this.getFilePath(key)
      await fs.unlink(filePath)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    // Update index
    if (this.index.has(key)) {
      this.index.delete(key)
      await this.saveIndex()
    }
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    await this.ensureInitialized()

    try {
      const files = await fs.readdir(this.baseDir)
      await Promise.all(
        files
          .filter(f => f.endsWith('.json'))
          .map(f => fs.unlink(path.join(this.baseDir, f)))
      )
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    this.index.clear()
  }

  /**
   * List all stored keys
   */
  async list(): Promise<string[]> {
    await this.ensureInitialized()
    return [...this.index]
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.index.has(key)
  }
}
