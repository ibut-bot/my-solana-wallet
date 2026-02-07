#!/usr/bin/env node
/**
 * CLI script to unlock wallet and retrieve keypair info
 * 
 * Usage:
 *   npx tsx skills/unlock-wallet.ts --password "secret123"
 *   npx tsx skills/unlock-wallet.ts --password "secret123" --show-secret
 */

import { unlockWallet, formatPublicKey } from './wallet.js'
import { NoWalletError, InvalidPasswordError } from './errors.js'

interface Args {
  password: string
  showSecret: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let password = ''
  let showSecret = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    } else if (args[i] === '--show-secret') {
      showSecret = true
    }
  }

  return { password, showSecret }
}

async function main() {
  const { password, showSecret } = parseArgs()

  if (!password) {
    console.error(JSON.stringify({
      success: false,
      error: 'Missing required argument. Usage: --password "yourpassword"',
    }))
    process.exit(1)
  }

  try {
    const result = await unlockWallet(password)

    const output: any = {
      success: true,
      name: result.name,
      publicKey: result.publicKey,
      publicKeyShort: formatPublicKey(result.publicKey!),
      message: `Wallet "${result.name}" unlocked. Address: ${result.publicKey}`,
    }

    // Only include secret key if explicitly requested
    if (showSecret) {
      output.secretKey = result.secretKey
      output.secretKeyArray = result.secretKeyArray
      output.warning = 'Secret key exposed. Keep this secure!'
    }

    console.log(JSON.stringify(output))
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
