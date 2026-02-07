#!/usr/bin/env node
/**
 * CLI script to get wallet public address (no password required)
 * 
 * Usage:
 *   npx tsx skills/get-address.ts
 */

import { getAddress, formatPublicKey } from './wallet.js'
import { NoWalletError } from './errors.js'

async function main() {
  try {
    const result = await getAddress()

    console.log(JSON.stringify({
      success: true,
      address: result.address,
      addressShort: formatPublicKey(result.address!),
      name: result.name,
      message: `Wallet "${result.name}" address: ${result.address}`,
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
