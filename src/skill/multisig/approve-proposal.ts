#!/usr/bin/env tsx
/**
 * Approve a multisig proposal
 * 
 * Usage:
 *   npm run skill:multisig:approve -- --vault "VaultAddress" --proposal 1 --password "mypass"
 * 
 * Options:
 *   --vault      Multisig vault address
 *   --proposal   Proposal index number
 *   --password   Wallet password to sign
 */

import { PublicKey } from '@solana/web3.js'
import { getKeypair } from '../wallet.js'
import { getConnection } from '../rpc.js'
import { approveProposal, getProposalStatus, getMultisigAccount } from '../../utils/multisig.js'

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
      usage: 'npm run skill:multisig:approve -- --vault "VaultAddr" --proposal 1 --password "pass"'
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

    if (proposal.status !== 'Active') {
      console.log(JSON.stringify({
        success: false,
        error: 'PROPOSAL_NOT_ACTIVE',
        message: `Proposal is ${proposal.status}, cannot approve`,
        currentStatus: proposal.status,
        hint: proposal.status === 'Approved' ? 'Proposal is already approved. Ready to execute.' : 'Only Active proposals can be approved.'
      }))
      process.exit(1)
    }

    // Check if already voted
    if (proposal.approvals.includes(keypair.publicKey.toBase58())) {
      console.log(JSON.stringify({
        success: false,
        error: 'ALREADY_APPROVED',
        message: 'You have already approved this proposal',
        yourAddress: keypair.publicKey.toBase58(),
        currentApprovals: proposal.approvals.length
      }))
      process.exit(1)
    }

    const signature = await approveProposal(
      connection,
      keypair,
      multisigPda,
      BigInt(proposalIndex)
    )

    // Get updated status
    const updated = await getProposalStatus(connection, multisigPda, BigInt(proposalIndex))
    const vaultInfo = await getMultisigAccount(connection, multisigPda)

    console.log(JSON.stringify({
      success: true,
      proposalIndex,
      newStatus: updated?.status,
      approvals: updated?.approvals.length,
      threshold: vaultInfo?.threshold,
      signature,
      explorerUrl: `https://solscan.io/tx/${signature}`,
      message: updated?.status === 'Approved' 
        ? 'Proposal is now approved and ready to execute!'
        : `Approval recorded. ${vaultInfo?.threshold ? vaultInfo.threshold - (updated?.approvals.length || 0) : '?'} more approval(s) needed.`
    }))
  } catch (e: any) {
    const errorMsg = e.message || String(e)
    let error = 'APPROVE_FAILED'
    let hint = 'Check network connectivity and try again'
    
    if (errorMsg.includes('Invalid password')) {
      error = 'INVALID_PASSWORD'
      hint = 'Check your wallet password'
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
