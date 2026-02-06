#!/usr/bin/env node
/**
 * CLI script to delete wallet (requires --confirm flag)
 * 
 * Usage:
 *   npx ts-node src/skill/delete-wallet.ts --confirm
 */

import { deleteWallet, getAddress } from './wallet.js'
import { NoWalletError } from './errors.js'

function parseArgs(): { confirm: boolean } {
  const args = process.argv.slice(2)
  return { confirm: args.includes('--confirm') }
}

async function main() {
  const { confirm } = parseArgs()

  if (!confirm) {
    console.error(JSON.stringify({
      success: false,
      error: 'Deletion requires --confirm flag. This action is irreversible.',
    }))
    process.exit(1)
  }

  try {
    // Get address before deleting for the message
    const addressInfo = await getAddress()
    const address = addressInfo.address
    const name = addressInfo.name

    await deleteWallet()

    console.log(JSON.stringify({
      success: true,
      message: `Wallet "${name}" (${address}) has been permanently deleted.`,
      deletedAddress: address,
      deletedName: name,
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
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }))
    process.exit(1)
  }
}

main()
