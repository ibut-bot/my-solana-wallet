#!/usr/bin/env node
/**
 * CLI script to create a new encrypted Solana wallet
 * 
 * Usage:
 *   npx tsx skills/create-wallet.ts --name "My Wallet" --password "secret123"
 *   npx tsx skills/create-wallet.ts --name "My Wallet" --password "secret123" --force
 */

import { createWallet, checkStatus, deleteWallet } from './wallet.js'
import { WalletExistsError, WeakPasswordError } from './errors.js'

interface Args {
  name: string
  password: string
  force: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let name = ''
  let password = ''
  let force = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
      name = args[++i]
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    } else if (args[i] === '--force') {
      force = true
    }
  }

  return { name, password, force }
}

async function main() {
  const { name, password, force } = parseArgs()

  if (!name || !password) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required arguments. Usage: --name "Wallet Name" --password "yourpassword"',
    }))
    process.exit(1)
  }

  try {
    // Check if wallet already exists and warn
    const existing = await checkStatus()
    if (existing.exists) {
      if (!force) {
        console.error(JSON.stringify({
          success: false,
          code: 'WALLET_EXISTS',
          warning: 'WALLET EXISTS — Creating a new wallet will OVERWRITE your existing wallet!',
          existingAddress: existing.publicKey,
          existingName: existing.name,
          action: 'Backup your wallet first or use --force to overwrite.',
          backupCommand: 'npm run skill:backup -- --password "yourpass"',
          forceCommand: `npm run skill:create -- --name "${name}" --password "yourpass" --force`,
        }))
        process.exit(1)
      }

      // --force: delete existing wallet before creating new one
      await deleteWallet()
      process.stderr.write(JSON.stringify({
        info: 'Existing wallet deleted',
        previousAddress: existing.publicKey,
      }) + '\n')
    }

    const result = await createWallet(name, password)
    console.log(JSON.stringify({
      success: true,
      address: result.address,
      name: result.name,
      message: `Wallet "${result.name}" created successfully. Address: ${result.address}`,
      nextSteps: [
        'IMPORTANT: Backup your wallet immediately!',
        'Run: npm run skill:backup -- --password "yourpass"',
        'Run: npm run skill:unlock -- --password "yourpass" --show-secret',
        'Save the secret key somewhere secure — without it your funds are unrecoverable.',
      ],
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
