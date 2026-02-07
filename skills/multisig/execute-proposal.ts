#!/usr/bin/env tsx
/**
 * Execute an approved multisig proposal
 * 
 * Usage:
 *   npm run skill:multisig:execute -- --vault "VaultAddress" --proposal 1 --password "mypass"
 * 
 * Options:
 *   --vault      Multisig vault address
 *   --proposal   Proposal index number
 *   --password   Wallet password to sign
 */

import { PublicKey } from '@solana/web3.js'
import { getKeypair } from '../wallet.js'
import { getConnection } from '../rpc.js'
import { executeVaultTransaction, getProposalStatus } from '../utils/multisig.js'

async function main() {
  const args = process.argv.slice(2)
  
  let vault = ''
  let proposalIndex = 0
  let password = ''
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && args[i + 1]) {
      vault = args[++i]
    } else if (args[i] === '--proposal' && args[i + 1]) {
      proposalIndex = parseInt(args[++i], 10)
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    }
  }

  if (!vault || !proposalIndex || !password) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'MISSING_ARGS',
      message: 'Required: --vault, --proposal, --password',
      usage: 'npm run skill:multisig:execute -- --vault "VaultAddr" --proposal 1 --password "pass"'
    }))
    process.exit(1)
  }

  try {
    const keypair = await getKeypair(password)
    const connection = getConnection()
    const multisigPda = new PublicKey(vault)

    // Check proposal status first
    const proposal = await getProposalStatus(connection, multisigPda, BigInt(proposalIndex))
    if (!proposal) {
      console.log(JSON.stringify({
        success: false,
        error: 'PROPOSAL_NOT_FOUND',
        message: `Proposal #${proposalIndex} not found`,
        vault,
        proposalIndex,
        hint: 'Check the proposal index with: npm run skill:multisig:proposals -- --vault "..."'
      }))
      process.exit(1)
    }

    if (proposal.status !== 'Approved') {
      console.log(JSON.stringify({
        success: false,
        error: 'PROPOSAL_NOT_APPROVED',
        message: `Proposal is ${proposal.status}, must be Approved to execute`,
        currentStatus: proposal.status,
        currentApprovals: proposal.approvals.length,
        hint: proposal.status === 'Active' ? 'Need more approvals before executing.' : 'Only Approved proposals can be executed.'
      }))
      process.exit(1)
    }

    const signature = await executeVaultTransaction(
      connection,
      keypair,
      multisigPda,
      BigInt(proposalIndex)
    )

    // Get updated status
    const updated = await getProposalStatus(connection, multisigPda, BigInt(proposalIndex))

    console.log(JSON.stringify({
      success: true,
      proposalIndex,
      newStatus: updated?.status,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      message: 'Transaction executed successfully!'
    }))
  } catch (e: any) {
    const errorMsg = e.message || String(e)
    let error = 'EXECUTE_FAILED'
    let hint = 'Check network connectivity and try again'
    
    if (errorMsg.includes('Invalid password')) {
      error = 'INVALID_PASSWORD'
      hint = 'Check your wallet password'
    } else if (errorMsg.includes('insufficient')) {
      error = 'INSUFFICIENT_BALANCE'
      hint = 'Vault may not have enough balance for this transfer'
    }
    
    console.log(JSON.stringify({
      success: false,
      error,
      message: errorMsg,
      hint
    }))
    process.exit(1)
  }
}

main()
