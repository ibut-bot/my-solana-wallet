/**
 * Multisig Skill Functions
 * 
 * Programmatic API for Squads multisig operations.
 * Works in both Node.js and browser environments.
 */

export {
  // Core multisig operations
  createMultisigVault,
  getMultisigAccount,
  getVaultBalance,
  getProposals,
  getProposalStatus,
  createTransferProposal,
  approveProposal,
  rejectProposal,
  executeVaultTransaction,
  
  // Permission helpers
  createPermissions,
  getAllPermissions,
  
  // PDA derivation
  getMultisigPda,
  getVaultPda,
  
  // Storage (sync - browser only, deprecated)
  saveMultisigAddress,
  getStoredMultisigs,
  removeStoredMultisig,
  
  // Storage (async - works everywhere, recommended)
  saveMultisigAddressAsync,
  getStoredMultisigsAsync,
  removeStoredMultisigAsync,
  
  // Types
  type MultisigMember,
  type MultisigVault,
  type VaultBalance,
  type ProposalInfo,
} from '../utils/multisig.js'

export {
  getProposalShareLink,
  getVaultShareLink,
} from '../utils/share-links.js'

// RPC utilities
export { getConnection, getRpcUrl, setRpcUrl, createConnection } from '../rpc.js'
