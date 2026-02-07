#!/usr/bin/env node
/**
 * CLI script to get wallet balances (SOL + SPL tokens)
 * 
 * Usage:
 *   npx tsx skills/get-balance.ts
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { getConnection } from './rpc.js'
import { getAddress, formatPublicKey } from './wallet.js'
import { NoWalletError } from './errors.js'

interface JupiterToken {
  address: string
  symbol: string
  name: string
  logoURI?: string
}

interface TokenBalance {
  mint: string
  symbol: string
  name: string
  amount: string
  decimals: number
  uiAmount: number
}

interface BalanceResult {
  success: boolean
  address?: string
  addressShort?: string
  solBalance?: number
  solBalanceLamports?: number
  tokens?: TokenBalance[]
  message?: string
  error?: string
}

// Common tokens fallback
const KNOWN_TOKENS: Record<string, { symbol: string; name: string }> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter' },
  'So11111111111111111111111111111111111111112': { symbol: 'wSOL', name: 'Wrapped SOL' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade Staked SOL' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', name: 'dogwifhat' },
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': { symbol: 'JTO', name: 'Jito' },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network' },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RENDER', name: 'Render Token' },
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5': { symbol: 'MEW', name: 'cat in a dogs world' },
  'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7': { symbol: 'DRIFT', name: 'Drift' },
  'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6': { symbol: 'TNSR', name: 'Tensor' },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium' },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': { symbol: 'ORCA', name: 'Orca' },
}

async function fetchJupiterTokens(): Promise<Map<string, JupiterToken>> {
  const tokenMap = new Map<string, JupiterToken>()
  
  // Add known tokens as fallback
  for (const [address, token] of Object.entries(KNOWN_TOKENS)) {
    tokenMap.set(address, { address, ...token })
  }
  
  try {
    const response = await fetch('https://api.jup.ag/tokens/v2/tag?query=verified')
    if (response.ok) {
      const tokens = (await response.json()) as JupiterToken[]
      for (const token of tokens) {
        tokenMap.set(token.address, token)
      }
    }
  } catch {
    // Use fallback tokens
  }
  
  return tokenMap
}

async function main() {
  try {
    // Get wallet address
    const addressResult = await getAddress()
    if (!addressResult.success || !addressResult.address) {
      throw new NoWalletError()
    }

    const address = addressResult.address
    const publicKey = new PublicKey(address)
    const connection = getConnection()

    // Fetch Jupiter token list
    const jupiterTokens = await fetchJupiterTokens()

    // Get SOL balance
    const solBalanceLamports = await connection.getBalance(publicKey)
    const solBalance = solBalanceLamports / LAMPORTS_PER_SOL

    // Get SPL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    )

    const tokens: TokenBalance[] = tokenAccounts.value
      .map((account) => {
        const parsed = account.account.data.parsed
        const info = parsed.info
        const mint = info.mint
        const jupToken = jupiterTokens.get(mint)
        
        return {
          mint,
          symbol: jupToken?.symbol || formatPublicKey(mint),
          name: jupToken?.name || 'Unknown Token',
          amount: info.tokenAmount.amount,
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount || 0,
        }
      })
      .filter((token) => token.uiAmount > 0)

    // Build message
    let message = `Wallet: ${address}\n`
    message += `SOL Balance: ${solBalance.toFixed(4)} SOL`

    if (tokens.length > 0) {
      message += `\n\nSPL Tokens (${tokens.length}):`
      for (const token of tokens) {
        message += `\n  - ${token.symbol}: ${token.uiAmount.toLocaleString()}`
      }
    } else {
      message += '\n\nNo SPL tokens found.'
    }

    const result: BalanceResult = {
      success: true,
      address,
      addressShort: formatPublicKey(address),
      solBalance,
      solBalanceLamports,
      tokens,
      message,
    }

    console.log(JSON.stringify(result))
  } catch (error: any) {
    if (error instanceof NoWalletError) {
      console.error(JSON.stringify({
        success: false,
        code: error.code,
        error: error.message,
      }))
      process.exit(1)
    }
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }))
    process.exit(1)
  }
}

main()
