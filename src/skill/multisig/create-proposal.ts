#!/usr/bin/env tsx
/**
 * Create a SOL transfer proposal for a multisig vault
 * 
 * Usage:
 *   npm run skill:multisig:propose -- --vault "VaultAddress" --to "RecipientAddress" --amount 0.5 --password "mypass"
 *   npm run skill:multisig:propose -- --vault "VaultAddress" --to "RecipientAddress" --amount 0.5 --password "mypass" --dry-run
 * 
 * Options:
 *   --vault      Multisig vault address
 *   --to         Recipient address
 *   --amount     Amount of SOL to transfer
 *   --memo       Optional memo for the transaction
 *   --password   Wallet password to sign
 *   --dry-run    Validate without creating the proposal
 *   --rpc-url    Optional RPC endpoint override
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getKeypair } from '../wallet.js'
import { getConnection } from '../rpc.js'
import { createTransferProposal, getVaultBalance, getMultisigAccount } from '../../utils/multisig.js'
import { getProposalShareLink } from '../../utils/multisigWalletAdapter.js'

async function main() {
  const args = process.argv.slice(2)
  
  let vault = ''
  let to = ''
  let amount = 0
  let memo = ''
  let password = ''
  let dryRun = false
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && args[i + 1]) {
      vault = args[++i]
    } else if (args[i] === '--to' && args[i + 1]) {
      to = args[++i]
    } else if (args[i] === '--amount' && args[i + 1]) {
      amount = parseFloat(args[++i])
    } else if (args[i] === '--memo' && args[i + 1]) {
      memo = args[++i]
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    } else if (args[i] === '--dry-run') {
      dryRun = true
    }
  }

  if (!vault || !to || !amount || !password) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'MISSING_ARGS',
      message: 'Required: --vault, --to, --amount, --password',
      usage: 'npm run skill:multisig:propose -- --vault "VaultAddr" --to "RecipientAddr" --amount 0.5 --password "pass"'
    }))
    process.exit(1)
  }

  // Validate addresses
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
    new PublicKey(to)
  } catch {
    console.log(JSON.stringify({
      success: false,
      error: 'INVALID_RECIPIENT_ADDRESS',
      message: 'Invalid recipient address format',
      providedAddress: to,
      hint: 'Recipient address should be a 32-44 character base58 string'
    }))
    process.exit(1)
  }

  if (amount <= 0) {
    console.log(JSON.stringify({
      success: false,
      error: 'INVALID_AMOUNT',
      message: 'Amount must be greater than 0',
      providedAmount: amount
    }))
    process.exit(1)
  }

  try {
    const keypair = await getKeypair(password)
    const connection = getConnection()
    const multisigPda = new PublicKey(vault)
    const recipient = new PublicKey(to)

    // Check vault exists and user is member
    const vaultInfo = await getMultisigAccount(connection, multisigPda)
    if (!vaultInfo) {
      console.log(JSON.stringify({
        success: false,
        error: 'VAULT_NOT_FOUND',
        message: 'Multisig vault not found at this address',
        providedAddress: vault,
        hint: 'Verify the vault address and network'
      }))
      process.exit(1)
    }

    const isMember = vaultInfo.members.some(m => m.publicKey === keypair.publicKey.toBase58())
    if (!isMember) {
      console.log(JSON.stringify({
        success: false,
        error: 'NOT_A_MEMBER',
        message: 'Your wallet is not a member of this multisig vault',
        yourAddress: keypair.publicKey.toBase58(),
        vaultMembers: vaultInfo.members.map(m => m.publicKey),
        hint: 'Only vault members can create proposals'
      }))
      process.exit(1)
    }

    // Check vault balance
    const balance = await getVaultBalance(connection, multisigPda)
    if (amount > balance.solBalance) {
      console.log(JSON.stringify({
        success: false,
        error: 'INSUFFICIENT_VAULT_BALANCE',
        message: `Vault only has ${balance.solBalance.toFixed(6)} SOL, cannot send ${amount} SOL`,
        requested: amount,
        available: balance.solBalance,
        deficit: amount - balance.solBalance,
        hint: `Deposit ${(amount - balance.solBalance).toFixed(6)} SOL to ${balance.vaultPda}`
      }))
      process.exit(1)
    }

    // Dry run - just validate
    if (dryRun) {
      console.log(JSON.stringify({
        success: true,
        dryRun: true,
        validation: 'passed',
        config: {
          vault,
          recipient: to,
          amount,
          vaultBalance: balance.solBalance,
          remainingBalance: balance.solBalance - amount,
          threshold: vaultInfo.threshold,
          memberCount: vaultInfo.members.length
        },
        message: 'Dry run successful. Remove --dry-run to create the proposal.'
      }))
      return
    }

    const lamports = Math.round(amount * LAMPORTS_PER_SOL)
    const result = await createTransferProposal(
      connection,
      keypair,
      multisigPda,
      recipient,
      lamports,
      memo || undefined
    )

    console.log(JSON.stringify({
      success: true,
      proposalIndex: result.transactionIndex.toString(),
      vault: vault,
      recipient: to,
      amount: amount,
      threshold: vaultInfo.threshold,
      signature: result.signature,
      shareLink: getProposalShareLink(vault, result.transactionIndex),
      explorerUrl: `https://solscan.io/tx/${result.signature}`,
      message: `Proposal created. Needs ${vaultInfo.threshold} approval(s). Share the link with members.`
    }))
  } catch (e: any) {
    const errorMsg = e.message || String(e)
    
    let error = 'PROPOSAL_FAILED'
    let hint = 'Check network connectivity and try again'
    
    if (errorMsg.includes('Invalid password')) {
      error = 'INVALID_PASSWORD'
      hint = 'Check your wallet password'
    } else if (errorMsg.includes('insufficient')) {
      error = 'INSUFFICIENT_BALANCE'
      hint = 'Check wallet balance for transaction fees'
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
