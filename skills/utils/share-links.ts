/**
 * Share link utilities for multisig vaults and proposals
 * 
 * Node.js-compatible version (no window dependency).
 * Base URL can be configured via APP_BASE_URL env var.
 */

const DEFAULT_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173'

/**
 * Generate a share link for a multisig vault
 */
export function getVaultShareLink(multisigPda: string, baseUrl: string = DEFAULT_BASE_URL): string {
  return `${baseUrl}/vault/${multisigPda}`
}

/**
 * Generate a share link for a specific proposal
 */
export function getProposalShareLink(
  multisigPda: string,
  proposalIndex: bigint | number,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${baseUrl}/vault/${multisigPda}/proposal/${proposalIndex.toString()}`
}
