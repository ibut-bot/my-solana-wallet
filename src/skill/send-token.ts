#!/usr/bin/env node
/**
 * CLI script to send SPL tokens to another wallet
 * 
 * Usage:
 *   npx tsx src/skill/send-token.ts --mint <token_mint_or_symbol> --to <address> --amount <amount> --password <pwd>
 * 
 * Examples:
 *   npx tsx src/skill/send-token.ts --mint USDC --to 7abc... --amount 10 --password secret
 *   npx tsx src/skill/send-token.ts --mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --to 7abc... --amount 10 --password secret
 */

import { PublicKey } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { getConnection } from './rpc.js'
import { getKeypair, formatPublicKey } from './wallet.js'
import { NoWalletError, InvalidPasswordError, InsufficientBalanceError } from './errors.js'

// Common token symbols to mint addresses
const TOKEN_SYMBOLS: Record<string, string> = {
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'WSOL': 'So11111111111111111111111111111111111111112',
  'MSOL': 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'JTO': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'RENDER': 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
  'MEW': 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  'DRIFT': 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
  'TNSR': 'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
}

interface SendTokenResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  from?: string
  to?: string
  mint?: string
  symbol?: string
  amount?: number
  message?: string
  error?: string
  code?: string
}

interface Args {
  mint: string
  to: string
  amount: number
  password: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let mint = ''
  let to = ''
  let amount = 0
  let password = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mint' && args[i + 1]) {
      mint = args[++i]
    } else if (args[i] === '--to' && args[i + 1]) {
      to = args[++i]
    } else if (args[i] === '--amount' && args[i + 1]) {
      amount = parseFloat(args[++i])
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    }
  }

  return { mint, to, amount, password }
}

function resolveMint(mintOrSymbol: string): { mint: string; symbol?: string } {
  // Check if it's a known symbol
  const upperSymbol = mintOrSymbol.toUpperCase()
  if (TOKEN_SYMBOLS[upperSymbol]) {
    return { mint: TOKEN_SYMBOLS[upperSymbol], symbol: upperSymbol }
  }
  // Otherwise treat as mint address
  return { mint: mintOrSymbol }
}

async function main() {
  const { mint: mintInput, to, amount, password } = parseArgs()

  // Validate arguments
  if (!mintInput || !to || !amount || !password) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments. Usage: --mint <token_mint_or_symbol> --to <address> --amount <amount> --password <pwd>',
    }))
    process.exit(1)
  }

  if (amount <= 0) {
    console.error(JSON.stringify({
      success: false,
      error: 'Amount must be greater than 0',
    }))
    process.exit(1)
  }

  // Resolve mint address from symbol or address
  const { mint, symbol } = resolveMint(mintInput)

  // Validate addresses
  let mintPublicKey: PublicKey
  let toPublicKey: PublicKey
  try {
    mintPublicKey = new PublicKey(mint)
  } catch {
    console.error(JSON.stringify({
      success: false,
      error: `Invalid token: "${mintInput}". Use a valid mint address or known symbol (USDC, USDT, BONK, JUP, etc.)`,
    }))
    process.exit(1)
  }

  try {
    toPublicKey = new PublicKey(to)
  } catch {
    console.error(JSON.stringify({
      success: false,
      error: 'Invalid destination address',
    }))
    process.exit(1)
  }

  try {
    const connection = getConnection()
    const keypair = await getKeypair(password)
    const fromPublicKey = keypair.publicKey

    // Get source token account
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      fromPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    // Check source token account exists and has balance
    let sourceAccount
    try {
      sourceAccount = await getAccount(connection, sourceTokenAccount)
    } catch {
      console.error(JSON.stringify({
        success: false,
        code: 'NO_TOKEN_ACCOUNT',
        error: `You don't have a token account for mint ${formatPublicKey(mint)}`,
      }))
      process.exit(1)
    }

    // Get token decimals from the account
    const mintInfo = await connection.getParsedAccountInfo(mintPublicKey)
    const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 0
    const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)))

    // Check balance
    if (sourceAccount.amount < rawAmount) {
      const availableAmount = Number(sourceAccount.amount) / Math.pow(10, decimals)
      throw new InsufficientBalanceError(amount, availableAmount)
    }

    // Get or create destination token account
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      toPublicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const transaction = new Transaction()

    // Check if destination token account exists
    const destinationAccountInfo = await connection.getAccountInfo(destinationTokenAccount)
    if (!destinationAccountInfo) {
      // Create associated token account for recipient
      transaction.add(
        createAssociatedTokenAccountInstruction(
          fromPublicKey, // payer
          destinationTokenAccount, // associated token account
          toPublicKey, // owner
          mintPublicKey, // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        sourceTokenAccount,
        destinationTokenAccount,
        fromPublicKey,
        rawAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    )

    // Send and confirm transaction
    const txHash = await sendAndConfirmTransaction(connection, transaction, [keypair])

    const tokenLabel = symbol || formatPublicKey(mint)
    const result: SendTokenResult = {
      success: true,
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
      from: fromPublicKey.toBase58(),
      to,
      mint,
      symbol,
      amount,
      message: `Successfully sent ${amount} ${tokenLabel} to ${formatPublicKey(to)}. TX: ${txHash}`,
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
    if (error instanceof InvalidPasswordError) {
      console.error(JSON.stringify({
        success: false,
        code: error.code,
        error: error.message,
      }))
      process.exit(1)
    }
    if (error instanceof InsufficientBalanceError) {
      console.error(JSON.stringify({
        success: false,
        code: error.code,
        error: error.message,
        required: error.required,
        available: error.available,
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
