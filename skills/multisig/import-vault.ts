#!/usr/bin/env tsx
/**
 * Import a multisig vault by address or share link
 * 
 * Usage:
 *   npm run skill:multisig:import -- --link "https://app.com/vault/ABC..."
 *   npm run skill:multisig:import -- --vault "MultisigPdaAddress..."
 *   npm run skill:multisig:import -- --vault "ABC..." --rpc-url "https://..."
 * 
 * Options:
 *   --link       Share link containing vault address
 *   --vault      Direct vault address (also accepts --address for backward compat)
 *   --rpc-url    Optional RPC endpoint override
 */

import { PublicKey } from '@solana/web3.js'
import { getAddress } from '../wallet.js'
import { getConnection } from '../rpc.js'
import { getMultisigAccount, saveMultisigAddressAsync, getStoredMultisigsAsync } from '../utils/multisig.js'

function extractVaultAddress(input: string): string | null {
  const trimmed = input.trim()
  
  // Check if it's a URL containing /vault/ADDRESS
  const vaultUrlMatch = trimmed.match(/\/vault\/([A-HJ-NP-Za-km-z1-9]{32,44})/)
  if (vaultUrlMatch) {
    return vaultUrlMatch[1]
  }
  
  // Check if it's a direct Solana address
  if (/^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(trimmed)) {
    return trimmed
  }
  
  return null
}

async function main() {
  const args = process.argv.slice(2)
  
  let link = ''
  let vault = ''
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--link' && args[i + 1]) {
      link = args[++i]
    } else if ((args[i] === '--vault' || args[i] === '--address') && args[i + 1]) {
      vault = args[++i]
    }
    // --rpc-url is handled by rpc.ts
  }

  const input = link || vault
  if (!input) {
    console.log(JSON.stringify({ 
      success: false, 
      error: 'INPUT_REQUIRED',
      message: 'Please provide --link or --vault',
      usage: 'npm run skill:multisig:import -- --vault "VaultAddress" or --link "https://app.com/vault/ABC..."'
    }))
    process.exit(1)
  }

  try {
    const extractedAddress = extractVaultAddress(input)
    if (!extractedAddress) {
      console.log(JSON.stringify({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Could not extract a valid vault address from input',
        providedInput: input,
        hint: 'Vault address should be a 32-44 character base58 string'
      }))
      process.exit(1)
    }

    const addressResult = await getAddress()
    if (!addressResult.success || !addressResult.address) {
      console.log(JSON.stringify({
        success: false,
        error: 'NO_WALLET',
        message: 'No wallet found. Create one first.',
        action: 'Run: npm run skill:create -- --name "MyWallet" --password "yourpassword"'
      }))
      process.exit(1)
    }
    const walletAddress = addressResult.address
    const connection = getConnection()
    const multisigPda = new PublicKey(extractedAddress)

    // Check if vault exists
    const vaultInfo = await getMultisigAccount(connection, multisigPda)
    if (!vaultInfo) {
      console.log(JSON.stringify({
        success: false,
        error: 'VAULT_NOT_FOUND',
        message: 'No multisig vault found at this address',
        providedAddress: extractedAddress,
        hint: 'Verify the address is correct and the vault exists on this network'
      }))
      process.exit(1)
    }

    // Check if user is a member
    const isMember = vaultInfo.members.some(m => m.publicKey === walletAddress)
    if (!isMember) {
      console.log(JSON.stringify({
        success: false,
        error: 'NOT_A_MEMBER',
        message: 'Your wallet is not a member of this multisig vault',
        yourAddress: walletAddress,
        vaultMembers: vaultInfo.members.map(m => m.publicKey),
        hint: 'Ask the vault creator to add your address as a member'
      }))
      process.exit(1)
    }

    // Check if already imported
    const existing = await getStoredMultisigsAsync(walletAddress)
    if (existing.some(e => e.multisigPda === vaultInfo.address)) {
      console.log(JSON.stringify({
        success: true,
        alreadyImported: true,
        vault: {
          address: vaultInfo.address,
          threshold: vaultInfo.threshold,
          memberCount: vaultInfo.members.length
        },
        message: 'Vault was already imported'
      }))
      return
    }

    // Save to storage
    await saveMultisigAddressAsync(walletAddress, vaultInfo.address, vaultInfo.createKey)

    console.log(JSON.stringify({
      success: true,
      alreadyImported: false,
      vault: {
        address: vaultInfo.address,
        threshold: vaultInfo.threshold,
        memberCount: vaultInfo.members.length,
        members: vaultInfo.members.map(m => m.publicKey)
      },
      message: 'Vault imported successfully'
    }))
  } catch (e: any) {
    console.log(JSON.stringify({
      success: false,
      error: 'IMPORT_FAILED',
      message: e.message || String(e),
      hint: 'Check network connectivity and RPC endpoint'
    }))
    process.exit(1)
  }
}

main()
