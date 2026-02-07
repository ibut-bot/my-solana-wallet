#!/usr/bin/env node
/**
 * CLI script to send SOL to another wallet
 * 
 * Usage:
 *   npx tsx skills/send-sol.ts --to <address> --amount <sol> --password <pwd>
 */

import {
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { getConnection } from './rpc.js'
import { getKeypair, formatPublicKey } from './wallet.js'
import { NoWalletError, InvalidPasswordError, InsufficientBalanceError } from './errors.js'

interface SendSolResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  from?: string
  to?: string
  amount?: number
  message?: string
  error?: string
  code?: string
}

interface Args {
  to: string
  amount: number
  password: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let to = ''
  let amount = 0
  let password = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) {
      to = args[++i]
    } else if (args[i] === '--amount' && args[i + 1]) {
      amount = parseFloat(args[++i])
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    }
  }

  return { to, amount, password }
}

async function main() {
  const { to, amount, password } = parseArgs()

  // Validate arguments
  if (!to || !amount || !password) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments. Usage: --to <address> --amount <sol> --password <pwd>',
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

  // Validate destination address
  let toPublicKey: PublicKey
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

    // Check balance
    const balance = await connection.getBalance(fromPublicKey)
    const lamportsToSend = Math.round(amount * LAMPORTS_PER_SOL)

    // Estimate fee (rough estimate)
    const estimatedFee = 5000 // ~0.000005 SOL

    if (balance < lamportsToSend + estimatedFee) {
      const availableSol = balance / LAMPORTS_PER_SOL
      throw new InsufficientBalanceError(amount, availableSol)
    }

    // Create transaction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromPublicKey,
        toPubkey: toPublicKey,
        lamports: lamportsToSend,
      })
    )

    // Send and confirm transaction
    const txHash = await sendAndConfirmTransaction(connection, transaction, [keypair])

    const result: SendSolResult = {
      success: true,
      txHash,
      explorerUrl: `https://solscan.io/tx/${txHash}`,
      from: fromPublicKey.toBase58(),
      to,
      amount,
      message: `Successfully sent ${amount} SOL to ${formatPublicKey(to)}. TX: ${txHash}`,
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
