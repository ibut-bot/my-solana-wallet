/**
 * Solana RPC connection utilities
 * 
 * Configuration priority:
 * 1. Explicit override via setRpcUrl()
 * 2. CLI flag --rpc-url
 * 3. Environment variable SOLANA_RPC_URL
 * 4. .env file
 * 5. Default public RPC
 */

import { Connection } from '@solana/web3.js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import * as path from 'path'

// Load .env silently - suppress dotenv verbose output
const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.DOTENV_CONFIG_QUIET = 'true'
config({ path: path.join(__dirname, '..', '.env') })

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com'

// Runtime override
let rpcUrlOverride: string | null = null

/**
 * Set RPC URL programmatically (takes highest priority)
 */
export function setRpcUrl(url: string): void {
  rpcUrlOverride = url
}

/**
 * Parse --rpc-url from CLI arguments
 */
function getCliRpcUrl(): string | null {
  const args = process.argv
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--rpc-url' && args[i + 1]) {
      return args[i + 1]
    }
  }
  return null
}

/**
 * Get the configured RPC URL
 * Priority: override > CLI flag > env var > default
 */
export function getRpcUrl(): string {
  if (rpcUrlOverride) return rpcUrlOverride
  
  const cliUrl = getCliRpcUrl()
  if (cliUrl) return cliUrl
  
  return process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL
}

/**
 * Create a Solana connection
 */
export function getConnection(): Connection {
  return new Connection(getRpcUrl(), 'confirmed')
}

/**
 * Create a connection with a specific RPC URL
 */
export function createConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed')
}
