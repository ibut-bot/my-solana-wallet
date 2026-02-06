#!/usr/bin/env tsx
/**
 * List stored multisig vaults for the current wallet
 * 
 * Usage:
 *   npm run skill:multisig:list
 *   npm run skill:multisig:list -- --rpc-url "https://..."
 */

import { getAddress } from '../wallet.js'
import { getConnection } from '../rpc.js'
import { getStoredMultisigsAsync, getMultisigAccount, getVaultBalance } from '../../utils/multisig.js'
import { PublicKey } from '@solana/web3.js'

async function main() {
  try {
    const result = await getAddress()
    if (!result.success || !result.address) {
      console.log(JSON.stringify({
        success: false,
        error: 'NO_WALLET',
        message: 'No wallet found. Create one first with: npm run skill:create',
        action: 'Run: npm run skill:create -- --name "MyWallet" --password "yourpassword"'
      }))
      process.exit(1)
    }
    const walletAddress = result.address
    const stored = await getStoredMultisigsAsync(walletAddress)

    if (stored.length === 0) {
      console.log(JSON.stringify({
        success: true,
        count: 0,
        vaults: [],
        message: 'No multisig vaults stored. Create one or import using a share link.'
      }))
      return
    }

    const connection = getConnection()
    const vaults = []

    for (const s of stored) {
      try {
        const pda = new PublicKey(s.multisigPda)
        const [vault, balance] = await Promise.all([
          getMultisigAccount(connection, pda),
          getVaultBalance(connection, pda)
        ])

        if (vault) {
          vaults.push({
            address: vault.address,
            threshold: vault.threshold,
            memberCount: vault.members.length,
            balance: balance.solBalance,
            vaultAddress: balance.vaultPda
          })
        }
      } catch (e) {
        // Skip vaults that fail to load
        vaults.push({
          address: s.multisigPda,
          error: 'Failed to load'
        })
      }
    }

    console.log(JSON.stringify({
      success: true,
      count: vaults.length,
      vaults
    }))
  } catch (e: any) {
    console.log(JSON.stringify({
      success: false,
      error: 'LIST_FAILED',
      message: e.message || String(e),
      hint: 'Check network connectivity and try again'
    }))
    process.exit(1)
  }
}

main()
