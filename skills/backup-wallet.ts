#!/usr/bin/env node
/**
 * CLI script to backup wallet file and optionally export the secret key
 * 
 * Usage:
 *   npx tsx skills/backup-wallet.ts --password "secret123"
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { checkStatus, unlockWallet, formatPublicKey } from './wallet.js'
import { WALLET_DATA_DIR } from './storage.js'
import { NoWalletError, InvalidPasswordError } from './errors.js'

// The wallet key used by FileStorage (base64url of "solana_wallet")
const WALLET_FILENAME = Buffer.from('solana_wallet').toString('base64url') + '.json'

interface Args {
  password: string
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let password = ''

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    }
  }

  return { password }
}

async function main() {
  const { password } = parseArgs()

  if (!password) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required argument. Usage: --password "yourpassword"',
    }))
    process.exit(1)
  }

  try {
    // Check wallet exists
    const status = await checkStatus()
    if (!status.exists) {
      throw new NoWalletError()
    }

    // Unlock to verify password and get secret key
    const unlocked = await unlockWallet(password)

    // Copy wallet file with timestamp
    const sourceFile = path.join(WALLET_DATA_DIR, WALLET_FILENAME)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
    const backupFilename = `wallet-backup-${timestamp}.json`
    const backupFile = path.join(WALLET_DATA_DIR, backupFilename)

    await fs.copyFile(sourceFile, backupFile)

    console.log(JSON.stringify({
      success: true,
      wallet: {
        name: unlocked.name,
        address: unlocked.publicKey,
        addressShort: formatPublicKey(unlocked.publicKey!),
      },
      backup: {
        path: backupFile,
        filename: backupFilename,
      },
      secretKey: unlocked.secretKey,
      warning: 'Secret key exposed above. Store it securely and delete this output from your terminal history.',
      message: `Wallet backed up to ${backupFilename}. Secret key exported — save it somewhere secure!`,
    }))
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
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }))
    process.exit(1)
  }
}

main()
