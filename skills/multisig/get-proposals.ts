#!/usr/bin/env tsx
/**
 * List proposals for a multisig vault
 * 
 * Usage:
 *   npm run skill:multisig:proposals -- --vault "VaultAddress"
 *   npm run skill:multisig:proposals -- --vault "VaultAddress" --status active
 * 
 * Options:
 *   --vault    Multisig vault address
 *   --status   Filter by status: active, approved, executed, rejected (optional)
 */

import { PublicKey } from '@solana/web3.js'
import { getConnection } from '../rpc.js'
import { getProposals, getMultisigAccount } from '../utils/multisig.js'
import { getProposalShareLink } from '../utils/share-links.js'

async function main() {
  const args = process.argv.slice(2)
  
  let vault = ''
  let statusFilter = ''
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && args[i + 1]) {
      vault = args[++i]
    } else if (args[i] === '--status' && args[i + 1]) {
      statusFilter = args[++i].toLowerCase()
    }
  }

  if (!vault) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'VAULT_REQUIRED',
      message: 'Please provide --vault',
      usage: 'npm run skill:multisig:proposals -- --vault "VaultAddress"'
    }))
    process.exit(1)
  }

  try {
    const connection = getConnection()
    const multisigPda = new PublicKey(vault)

    const [vaultInfo, proposals] = await Promise.all([
      getMultisigAccount(connection, multisigPda),
      getProposals(connection, multisigPda)
    ])

    if (!vaultInfo) {
      console.log(JSON.stringify({
        success: false,
        error: 'VAULT_NOT_FOUND',
        message: 'Multisig vault not found',
        providedAddress: vault,
        hint: 'Verify the vault address and network'
      }))
      process.exit(1)
    }

    // Filter by status if specified
    let filtered = proposals
    if (statusFilter) {
      filtered = proposals.filter(p => p.status.toLowerCase() === statusFilter)
    }

    const result = filtered.map(p => ({
      index: p.index.toString(),
      status: p.status,
      approvals: p.approvals.length,
      rejections: p.rejections.length,
      threshold: vaultInfo.threshold,
      canExecute: p.status === 'Approved',
      shareLink: getProposalShareLink(vault, p.index)
    }))

    console.log(JSON.stringify({
      success: true,
      vault,
      threshold: vaultInfo.threshold,
      totalProposals: proposals.length,
      filtered: filtered.length,
      proposals: result
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
