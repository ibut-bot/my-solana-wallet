#!/usr/bin/env tsx
/**
 * Get multisig vault details
 * 
 * Usage:
 *   npm run skill:multisig:get -- --vault "MultisigPdaAddress..."
 *   npm run skill:multisig:get -- --vault "MultisigPdaAddress..." --rpc-url "https://..."
 * 
 * Options:
 *   --vault      Multisig vault address (also accepts --address for backward compat)
 *   --rpc-url    Optional RPC endpoint override
 */

import { PublicKey } from '@solana/web3.js'
import { getConnection } from '../rpc.js'
import { getMultisigAccount, getVaultBalance, getProposals } from '../utils/multisig.js'
import { getVaultShareLink } from '../utils/share-links.js'

async function main() {
  const args = process.argv.slice(2)
  
  let vault = ''
  
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--vault' || args[i] === '--address') && args[i + 1]) {
      vault = args[++i]
    }
  }

  if (!vault) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'VAULT_REQUIRED',
      message: 'Please provide --vault',
      usage: 'npm run skill:multisig:get -- --vault "VaultAddress..."'
    }))
    process.exit(1)
  }

  // Validate address format
  try {
    new PublicKey(vault)
  } catch {
    console.log(JSON.stringify({
      success: false,
      error: 'INVALID_VAULT_ADDRESS',
      message: 'Invalid vault address format',
      providedAddress: vault,
      hint: 'Vault address should be a 32-44 character base58 string'
    }))
    process.exit(1)
  }

  try {
    const connection = getConnection()
    const multisigPda = new PublicKey(vault)

    const [vaultInfo, balance, proposals] = await Promise.all([
      getMultisigAccount(connection, multisigPda),
      getVaultBalance(connection, multisigPda),
      getProposals(connection, multisigPda)
    ])

    if (!vaultInfo) {
      console.log(JSON.stringify({
        success: false,
        error: 'VAULT_NOT_FOUND',
        message: 'Multisig vault not found at this address',
        providedAddress: vault,
        hint: 'Verify the address is correct and the vault exists on this network'
      }))
      process.exit(1)
    }

    const activeProposals = proposals.filter(p => p.status === 'Active')
    const approvedProposals = proposals.filter(p => p.status === 'Approved')

    console.log(JSON.stringify({
      success: true,
      vault: {
        address: vaultInfo.address,
        threshold: vaultInfo.threshold,
        memberCount: vaultInfo.members.length,
        members: vaultInfo.members,
        transactionIndex: vaultInfo.transactionIndex.toString()
      },
      balance: {
        sol: balance.solBalance,
        vaultAddress: balance.vaultPda
      },
      proposals: {
        total: proposals.length,
        active: activeProposals.length,
        approved: approvedProposals.length,
        recent: proposals.slice(0, 5).map(p => ({
          index: p.index.toString(),
          status: p.status,
          approvals: p.approvals.length,
          rejections: p.rejections.length
        }))
      },
      shareLink: getVaultShareLink(vaultInfo.address)
    }))
  } catch (e: any) {
    console.log(JSON.stringify({
      success: false,
      error: 'FETCH_FAILED',
      message: e.message || String(e),
      hint: 'Check network connectivity and RPC endpoint'
    }))
    process.exit(1)
  }
}

main()
