import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const { Permission, Permissions } = multisig.types;

export interface MultisigMember {
  publicKey: string;
  permissions: {
    initiate: boolean;
    vote: boolean;
    execute: boolean;
  };
}

export interface MultisigVault {
  address: string;
  createKey: string;
  threshold: number;
  members: MultisigMember[];
  transactionIndex: bigint;
  staleTransactionIndex: bigint;
  rentCollector: string | null;
  bump: number;
}

export interface VaultBalance {
  solBalance: number;
  vaultPda: string;
}

export interface ProposalInfo {
  index: bigint;
  multisigPda: string;
  transactionPda: string;
  proposalPda: string;
  status: "Active" | "Approved" | "Rejected" | "Executed" | "Cancelled" | "Draft";
  approvals: string[];
  rejections: string[];
  transaction?: {
    message: any;
  };
}

// Get the Squads Program Config PDA
export function getProgramConfigPda(): PublicKey {
  return multisig.getProgramConfigPda({})[0];
}

// Get the multisig PDA from a create key
export function getMultisigPda(createKey: PublicKey): PublicKey {
  return multisig.getMultisigPda({ createKey })[0];
}

// Get the vault PDA for a multisig (where funds are stored)
export function getVaultPda(multisigPda: PublicKey, index: number = 0): PublicKey {
  return multisig.getVaultPda({ multisigPda, index })[0];
}

// Get transaction PDA
export function getTransactionPda(
  multisigPda: PublicKey,
  transactionIndex: bigint
): PublicKey {
  return multisig.getTransactionPda({ multisigPda, index: transactionIndex })[0];
}

// Get proposal PDA
export function getProposalPda(
  multisigPda: PublicKey,
  transactionIndex: bigint
): PublicKey {
  return multisig.getProposalPda({ multisigPda, transactionIndex })[0];
}

// Create a new multisig vault
export async function createMultisigVault(
  connection: Connection,
  creator: Keypair,
  members: { publicKey: PublicKey; permissions: multisig.types.Permissions }[],
  threshold: number,
  timeLock: number = 0
): Promise<{ multisigPda: PublicKey; vaultPda: PublicKey; signature: string }> {
  // Generate a random create key
  const createKey = Keypair.generate();

  // Derive the multisig PDA
  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });

  // Get program config for treasury
  const programConfigPda = getProgramConfigPda();
  const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
    connection,
    programConfigPda
  );

  // Create the multisig instruction
  const ix = multisig.instructions.multisigCreateV2({
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority: null,
    timeLock,
    members: members.map((m) => ({
      key: m.publicKey,
      permissions: m.permissions,
    })),
    threshold,
    treasury: programConfig.treasury,
    rentCollector: null,
  });

  // Build and send transaction
  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = creator.publicKey;
  transaction.add(ix);

  transaction.sign(creator, createKey);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  // Get vault PDA
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

  return { multisigPda, vaultPda, signature };
}

// Get multisig account details
export async function getMultisigAccount(
  connection: Connection,
  multisigPda: PublicKey
): Promise<MultisigVault | null> {
  try {
    const account = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    return {
      address: multisigPda.toBase58(),
      createKey: account.createKey.toBase58(),
      threshold: account.threshold,
      members: account.members.map((m: any) => ({
        publicKey: m.key.toBase58(),
        permissions: {
          initiate: Permissions.has(m.permissions, Permission.Initiate),
          vote: Permissions.has(m.permissions, Permission.Vote),
          execute: Permissions.has(m.permissions, Permission.Execute),
        },
      })),
      transactionIndex: BigInt(account.transactionIndex.toString()),
      staleTransactionIndex: BigInt(account.staleTransactionIndex.toString()),
      rentCollector: account.rentCollector?.toBase58() || null,
      bump: account.bump,
    };
  } catch (e) {
    console.error("Error fetching multisig account:", e);
    return null;
  }
}

// Get vault balance
export async function getVaultBalance(
  connection: Connection,
  multisigPda: PublicKey
): Promise<VaultBalance> {
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
  const balance = await connection.getBalance(vaultPda);

  return {
    solBalance: balance / LAMPORTS_PER_SOL,
    vaultPda: vaultPda.toBase58(),
  };
}

// Create a SOL transfer proposal
export async function createTransferProposal(
  connection: Connection,
  creator: Keypair,
  multisigPda: PublicKey,
  recipient: PublicKey,
  lamports: number,
  memo?: string
): Promise<{ transactionIndex: bigint; signature: string }> {
  // Get the current transaction index
  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  const transactionIndex = BigInt(Number(multisigAccount.transactionIndex) + 1);

  // Get vault PDA
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

  // Create the transfer instruction
  const transferIx = SystemProgram.transfer({
    fromPubkey: vaultPda,
    toPubkey: recipient,
    lamports,
  });

  // Create vault transaction message
  const { blockhash } = await connection.getLatestBlockhash();
  const transferMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: blockhash,
    instructions: [transferIx],
  });

  // Create the vault transaction
  const createVaultTxIx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex,
    creator: creator.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: transferMessage,
    memo,
  });

  // Create proposal for the transaction
  const createProposalIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex,
    creator: creator.publicKey,
  });

  // Build and send transaction
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = creator.publicKey;
  transaction.add(createVaultTxIx, createProposalIx);

  transaction.sign(creator);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return { transactionIndex, signature };
}

// Approve a proposal
export async function approveProposal(
  connection: Connection,
  member: Keypair,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<string> {
  const ix = multisig.instructions.proposalApprove({
    multisigPda,
    transactionIndex,
    member: member.publicKey,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = member.publicKey;
  transaction.add(ix);

  transaction.sign(member);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Reject a proposal
export async function rejectProposal(
  connection: Connection,
  member: Keypair,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<string> {
  const ix = multisig.instructions.proposalReject({
    multisigPda,
    transactionIndex,
    member: member.publicKey,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = member.publicKey;
  transaction.add(ix);

  transaction.sign(member);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Execute an approved vault transaction
export async function executeVaultTransaction(
  connection: Connection,
  executor: Keypair,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<string> {
  // Get the vault transaction
  const [transactionPda] = multisig.getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  const vaultTransaction =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      connection,
      transactionPda
    );

  // Get vault PDA (needed for the execution)
  const [_vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: vaultTransaction.vaultIndex,
  });

  // Execute the transaction using the rpc method
  const { blockhash } = await connection.getLatestBlockhash();
  
  const executeResult = await multisig.instructions.vaultTransactionExecute({
    connection,
    multisigPda,
    transactionIndex,
    member: executor.publicKey,
  });

  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = executor.publicKey;
  transaction.add(executeResult.instruction);

  transaction.sign(executor);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Get proposal status
export async function getProposalStatus(
  connection: Connection,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<ProposalInfo | null> {
  try {
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
    });

    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
    });

    const proposal = await multisig.accounts.Proposal.fromAccountAddress(
      connection,
      proposalPda
    );

    // Determine status
    let status: ProposalInfo["status"] = "Draft";
    if (proposal.status.__kind === "Active") {
      status = "Active";
    } else if (proposal.status.__kind === "Approved") {
      status = "Approved";
    } else if (proposal.status.__kind === "Rejected") {
      status = "Rejected";
    } else if (proposal.status.__kind === "Executed") {
      status = "Executed";
    } else if (proposal.status.__kind === "Cancelled") {
      status = "Cancelled";
    }

    return {
      index: transactionIndex,
      multisigPda: multisigPda.toBase58(),
      transactionPda: transactionPda.toBase58(),
      proposalPda: proposalPda.toBase58(),
      status,
      approvals: proposal.approved.map((pk: PublicKey) => pk.toBase58()),
      rejections: proposal.rejected.map((pk: PublicKey) => pk.toBase58()),
    };
  } catch (e) {
    console.error("Error fetching proposal:", e);
    return null;
  }
}

// Get all proposals for a multisig
export async function getProposals(
  connection: Connection,
  multisigPda: PublicKey
): Promise<ProposalInfo[]> {
  const multisigAccount = await getMultisigAccount(connection, multisigPda);
  if (!multisigAccount) return [];

  const proposals: ProposalInfo[] = [];
  const currentIndex = Number(multisigAccount.transactionIndex);

  // Fetch recent proposals (last 20 or all if less)
  const startIndex = Math.max(1, currentIndex - 19);

  for (let i = startIndex; i <= currentIndex; i++) {
    const proposal = await getProposalStatus(connection, multisigPda, BigInt(i));
    if (proposal) {
      proposals.push(proposal);
    }
  }

  return proposals.reverse(); // Most recent first
}

// Helper to create permissions
export function createPermissions(
  initiate: boolean,
  vote: boolean,
  execute: boolean
): multisig.types.Permissions {
  const perms: multisig.types.Permission[] = [];
  if (initiate) perms.push(Permission.Initiate);
  if (vote) perms.push(Permission.Vote);
  if (execute) perms.push(Permission.Execute);
  return Permissions.fromPermissions(perms);
}

// Helper to get all permissions
export function getAllPermissions(): multisig.types.Permissions {
  return Permissions.all();
}

// Discover multisigs where a user is a member
// This queries the Squads program for all multisig accounts
export async function discoverMultisigsForMember(
  connection: Connection,
  memberPublicKey: PublicKey
): Promise<MultisigVault[]> {
  const vaults: MultisigVault[] = [];
  
  try {
    // Get the Squads program ID
    const programId = multisig.PROGRAM_ID;
    
    // Fetch all program accounts
    // Note: This can be expensive on mainnet. Consider using an indexer in production.
    // We filter by data size to only get Multisig accounts (they have a specific minimum size)
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        // Multisig accounts have a minimum data length
        {
          dataSize: 178, // Approximate size for a multisig with no members + variable
        },
      ],
    });

    // If dataSize filter doesn't match, try without it
    const accountsToCheck = accounts.length > 0 ? accounts : 
      await connection.getProgramAccounts(programId);

    // Parse each account and check if the user is a member
    for (const { pubkey, account } of accountsToCheck) {
      try {
        // Try to parse as a Multisig account
        const [multisigAccount] = multisig.accounts.Multisig.fromAccountInfo(account);
        
        // Check if the user is a member of this multisig
        const isMember = multisigAccount.members.some(
          (m: any) => m.key.toBase58() === memberPublicKey.toBase58()
        );

        if (isMember) {
          vaults.push({
            address: pubkey.toBase58(),
            createKey: multisigAccount.createKey.toBase58(),
            threshold: multisigAccount.threshold,
            members: multisigAccount.members.map((m: any) => ({
              publicKey: m.key.toBase58(),
              permissions: {
                initiate: Permissions.has(m.permissions, Permission.Initiate),
                vote: Permissions.has(m.permissions, Permission.Vote),
                execute: Permissions.has(m.permissions, Permission.Execute),
              },
            })),
            transactionIndex: BigInt(multisigAccount.transactionIndex.toString()),
            staleTransactionIndex: BigInt(multisigAccount.staleTransactionIndex.toString()),
            rentCollector: multisigAccount.rentCollector?.toBase58() || null,
            bump: multisigAccount.bump,
          });
        }
      } catch {
        // Skip accounts that fail to parse (they're not Multisig accounts)
      }
    }
  } catch (e) {
    console.error("Error discovering multisigs:", e);
  }

  return vaults;
}

// Re-export storage functions from dedicated module
// These work in both Node.js and browser environments
export {
  saveMultisigAddress,
  getStoredMultisigs,
  removeStoredMultisig,
  saveMultisigAddressAsync,
  getStoredMultisigsAsync,
  removeStoredMultisigAsync,
} from './multisig-storage.js';
