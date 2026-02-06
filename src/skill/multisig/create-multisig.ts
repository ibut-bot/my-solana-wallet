#!/usr/bin/env tsx
/**
 * Create a new Squads multisig vault
 * 
 * Usage:
 *   npm run skill:multisig:create -- --members "addr1,addr2,addr3" --threshold 2 --password "mypass"
 *   npm run skill:multisig:create -- --members "addr1,addr2" --threshold 2 --password "mypass" --dry-run
 * 
 * Options:
 *   --members    Comma-separated list of member addresses (creator is auto-included)
 *   --threshold  Number of approvals required (default: majority)
 *   --password   Wallet password to sign the transaction
 *   --dry-run    Validate inputs without creating the vault
 *   --rpc-url    Optional RPC endpoint override
 */

import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getKeypair } from '../wallet.js'
import { getConnection } from '../rpc.js'
import { createMultisigVault, getAllPermissions, saveMultisigAddressAsync } from '../../utils/multisig.js'
import { getVaultShareLink } from '../../utils/multisigWalletAdapter.js'

// Estimated rent for multisig creation (~0.003 SOL)
const ESTIMATED_RENT = 0.003

async function main() {
  const args = process.argv.slice(2)
  
  // Parse arguments
  let membersArg = ''
  let threshold = 0
  let password = ''
  let dryRun = false
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--members' && args[i + 1]) {
      membersArg = args[++i]
    } else if (args[i] === '--threshold' && args[i + 1]) {
      threshold = parseInt(args[++i], 10)
    } else if (args[i] === '--password' && args[i + 1]) {
      password = args[++i]
    } else if (args[i] === '--dry-run') {
      dryRun = true
    }
    // --rpc-url is handled by rpc.ts
  }

  if (!password) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'PASSWORD_REQUIRED',
      message: 'Please provide --password',
      usage: 'npm run skill:multisig:create -- --members "addr1,addr2" --threshold 2 --password "yourpass"'
    }))
    process.exit(1)
  }

  try {
    // Get keypair
    const keypair = await getKeypair(password)
    const connection = getConnection()

    // Parse members (always include creator)
    const memberAddresses = new Set<string>([keypair.publicKey.toBase58()])
    
    if (membersArg) {
      for (const addr of membersArg.split(',')) {
        const trimmed = addr.trim()
        if (trimmed) {
          try {
            new PublicKey(trimmed) // Validate
            memberAddresses.add(trimmed)
          } catch {
            console.log(JSON.stringify({
              success: false,
              error: 'INVALID_MEMBER_ADDRESS',
              message: `Invalid member address: ${trimmed}`,
              invalidAddress: trimmed,
              hint: 'Solana addresses are 32-44 character base58 strings'
            }))
            process.exit(1)
          }
        }
      }
    }

    const members = Array.from(memberAddresses).map(addr => ({
      publicKey: new PublicKey(addr),
      permissions: getAllPermissions()
    }))

    // Default threshold to majority
    const finalThreshold = threshold > 0 ? threshold : Math.ceil(members.length / 2)

    if (finalThreshold > members.length) {
      console.log(JSON.stringify({
        success: false,
        error: 'INVALID_THRESHOLD',
        message: `Threshold (${finalThreshold}) cannot exceed number of members (${members.length})`,
        threshold: finalThreshold,
        memberCount: members.length,
        hint: `Set threshold to ${members.length} or less`
      }))
      process.exit(1)
    }

    if (finalThreshold < 1) {
      console.log(JSON.stringify({
        success: false,
        error: 'INVALID_THRESHOLD',
        message: 'Threshold must be at least 1',
        threshold: finalThreshold,
        hint: 'Use --threshold 1 or higher'
      }))
      process.exit(1)
    }

    // Check balance for rent
    const balance = await connection.getBalance(keypair.publicKey)
    const balanceSol = balance / LAMPORTS_PER_SOL

    if (balanceSol < ESTIMATED_RENT) {
      console.log(JSON.stringify({
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `Need ~${ESTIMATED_RENT} SOL for rent-exempt minimum. Current: ${balanceSol.toFixed(6)} SOL`,
        required: ESTIMATED_RENT,
        current: balanceSol,
        deficit: ESTIMATED_RENT - balanceSol,
        hint: `Deposit at least ${(ESTIMATED_RENT - balanceSol).toFixed(6)} SOL to ${keypair.publicKey.toBase58()}`
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
          creator: keypair.publicKey.toBase58(),
          threshold: finalThreshold,
          memberCount: members.length,
          members: members.map(m => m.publicKey.toBase58()),
          estimatedCost: ESTIMATED_RENT,
          currentBalance: balanceSol
        },
        message: 'Dry run successful. Remove --dry-run to create the vault.'
      }))
      return
    }

    // Create the multisig
    const result = await createMultisigVault(
      connection,
      keypair,
      members,
      finalThreshold,
      0 // timeLock
    )

    // Save to local storage
    await saveMultisigAddressAsync(
      keypair.publicKey.toBase58(),
      result.multisigPda.toBase58(),
      result.multisigPda.toBase58()
    )

    console.log(JSON.stringify({
      success: true,
      multisigAddress: result.multisigPda.toBase58(),
      vaultAddress: result.vaultPda.toBase58(),
      threshold: finalThreshold,
      members: members.map(m => m.publicKey.toBase58()),
      signature: result.signature,
      shareLink: getVaultShareLink(result.multisigPda.toBase58()),
      explorerUrl: `https://solscan.io/tx/${result.signature}`,
      message: 'Vault created successfully. Share the link with members.'
    }))
  } catch (e: any) {
    // Parse common errors for actionable messages
    const errorMsg = e.message || String(e)
    
    let error = 'CREATE_FAILED'
    let hint = 'Check network connectivity and try again'
    
    if (errorMsg.includes('insufficient funds') || errorMsg.includes('Insufficient')) {
      error = 'INSUFFICIENT_BALANCE'
      hint = 'Deposit more SOL to your wallet'
    } else if (errorMsg.includes('blockhash')) {
      error = 'NETWORK_ERROR'
      hint = 'Network congestion. Try again in a few seconds.'
    } else if (errorMsg.includes('Invalid password')) {
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
