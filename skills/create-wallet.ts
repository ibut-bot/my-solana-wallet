#!/usr/bin/env node
/**
 * CLI script to create a new encrypted Solana wallet
 * 
 * Usage:
 *   npx tsx skills/create-wallet.ts --name "My Wallet" --password "secret123"
 */

import { createWallet } from './wallet.js'
import { WalletExistsError, WeakPasswordError } from './errors.js'

interface Args {
  name: string
  password: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let name = ''
  let password = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i]
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    }
  }

  return { name, password }
}

async function main() {
  const { name, password } = parseArgs()

  if (!name || !password) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments. Usage: --name "Wallet Name" --password "yourpassword"',
    }))
    process.exit(1)
  }

  try {
    const result = await createWallet(name, password)
    console.log(JSON.stringify({
      success: true,
      address: result.address,
      name: result.name,
      message: `Wallet "${result.name}" created successfully. Address: ${result.address}`,
    }))
  } catch (error: any) {
    if (error instanceof WalletExistsError) {
      console.error(JSON.stringify({
        success: false,
        code: error.code,
        error: error.message,
      }))
      process.exit(1)
    }
    if (error instanceof WeakPasswordError) {
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
