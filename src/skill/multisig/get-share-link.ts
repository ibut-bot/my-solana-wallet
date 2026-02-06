#!/usr/bin/env tsx
/**
 * Generate a share link for a multisig vault or proposal
 * 
 * This is a lightweight script that generates share links without making
 * any blockchain calls. Perfect for agents that just need to construct
 * a shareable URL.
 * 
 * Usage:
 *   # Get vault share link
 *   npm run skill:multisig:link -- --vault "VaultAddress..."
 * 
 *   # Get proposal share link
 *   npm run skill:multisig:link -- --vault "VaultAddress..." --proposal 1
 * 
 *   # Customize base URL (for production deployment)
 *   npm run skill:multisig:link -- --vault "VaultAddress..." --base-url "https://myapp.com"
 */

import { PublicKey } from '@solana/web3.js'

// Default base URL - update this to your deployed app URL
const DEFAULT_BASE_URL = typeof window !== 'undefined' 
  ? window.location.origin 
  : 'http://localhost:5173'

function getVaultShareLink(multisigPda: string, baseUrl: string): string {
  return `${baseUrl}/vault/${multisigPda}`
}

function getProposalShareLink(multisigPda: string, proposalIndex: number, baseUrl: string): string {
  return `${baseUrl}/vault/${multisigPda}/proposal/${proposalIndex}`
}

async function main() {
  const args = process.argv.slice(2)
  
  let vault = ''
  let proposal: number | null = null
  let baseUrl = process.env.APP_BASE_URL || DEFAULT_BASE_URL
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--vault' && args[i + 1]) {
      vault = args[++i]
    } else if (args[i] === '--proposal' && args[i + 1]) {
      proposal = parseInt(args[++i], 10)
    } else if (args[i] === '--base-url' && args[i + 1]) {
      baseUrl = args[++i]
    }
  }

  if (!vault) {
    console.error(JSON.stringify({ 
      success: false, 
      error: 'VAULT_REQUIRED',
      message: 'Please provide --vault address' 
    }))
    process.exit(1)
  }

  // Validate the vault address format
  try {
    new PublicKey(vault)
  } catch {
    console.error(JSON.stringify({
      success: false,
      error: 'INVALID_ADDRESS',
      message: 'Invalid vault address format'
    }))
    process.exit(1)
  }

  if (proposal !== null) {
    // Generate proposal share link
    const link = getProposalShareLink(vault, proposal, baseUrl)
    console.log(JSON.stringify({
      success: true,
      type: 'proposal',
      vault,
      proposalIndex: proposal,
      shareLink: link,
      message: `Share this link with vault members to view/approve proposal #${proposal}`
    }))
  } else {
    // Generate vault share link
    const link = getVaultShareLink(vault, baseUrl)
    console.log(JSON.stringify({
      success: true,
      type: 'vault',
      vault,
      shareLink: link,
      message: 'Share this link with vault members to access the vault'
    }))
  }
}

main()
