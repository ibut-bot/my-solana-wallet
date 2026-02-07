#!/usr/bin/env node
/**
 * CLI script to check if a wallet exists
 * 
 * Usage:
 *   npx tsx skills/check-status.ts
 */

import { checkStatus, formatPublicKey } from './wallet.js'

async function main() {
  try {
    const status = await checkStatus()

    if (status.exists) {
      console.log(JSON.stringify({
        success: true,
        exists: true,
        name: status.name,
        publicKey: status.publicKey,
        publicKeyShort: formatPublicKey(status.publicKey!),
        createdAt: status.createdAt,
        createdAtReadable: status.createdAt
          ? new Date(status.createdAt).toISOString()
          : undefined,
        message: `Wallet "${status.name}" exists. Address: ${status.publicKey}`,
      }))
    } else {
      console.log(JSON.stringify({
        success: true,
        exists: false,
        message: 'No wallet found. Create one using create-wallet.',
      }))
    }
  } catch (error: any) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
    }))
    process.exit(1)
  }
}

main()
