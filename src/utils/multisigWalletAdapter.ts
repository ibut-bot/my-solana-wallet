import * as multisig from "@sqds/multisig";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  SystemProgram,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { getProgramConfigPda } from "./multisig";

/**
 * Wallet adapter versions of multisig functions.
 * These use the wallet adapter's signTransaction method instead of a Keypair.
 */

// Create a new multisig vault using wallet adapter
export async function createMultisigVaultWA(
  connection: Connection,
  wallet: WalletContextState,
  members: { publicKey: PublicKey; permissions: multisig.types.Permissions }[],
  threshold: number,
  timeLock: number = 0
): Promise<{ multisigPda: PublicKey; vaultPda: PublicKey; createKey: PublicKey; signature: string }> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }

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
    creator: wallet.publicKey,
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

  // Build transaction
  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.add(ix);

  // Partial sign with createKey first (required signer)
  transaction.partialSign(createKey);

  // Sign with wallet adapter
  const signedTx = await wallet.signTransaction(transaction);
  
  // Send transaction
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  // Get vault PDA
  const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });

  return { multisigPda, vaultPda, createKey: createKey.publicKey, signature };
}

// Create a SOL transfer proposal using wallet adapter
export async function createTransferProposalWA(
  connection: Connection,
  wallet: WalletContextState,
  multisigPda: PublicKey,
  recipient: PublicKey,
  lamports: number,
  memo?: string
): Promise<{ transactionIndex: bigint; signature: string }> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }

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
    creator: wallet.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: transferMessage,
    memo,
  });

  // Create proposal for the transaction
  const createProposalIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex,
    creator: wallet.publicKey,
  });

  // Build transaction
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.add(createVaultTxIx, createProposalIx);

  // Sign with wallet adapter
  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return { transactionIndex, signature };
}

// Approve a proposal using wallet adapter
export async function approveProposalWA(
  connection: Connection,
  wallet: WalletContextState,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }

  const ix = multisig.instructions.proposalApprove({
    multisigPda,
    transactionIndex,
    member: wallet.publicKey,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.add(ix);

  // Sign with wallet adapter
  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Reject a proposal using wallet adapter
export async function rejectProposalWA(
  connection: Connection,
  wallet: WalletContextState,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }

  const ix = multisig.instructions.proposalReject({
    multisigPda,
    transactionIndex,
    member: wallet.publicKey,
  });

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.add(ix);

  // Sign with wallet adapter
  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Execute an approved vault transaction using wallet adapter
export async function executeVaultTransactionWA(
  connection: Connection,
  wallet: WalletContextState,
  multisigPda: PublicKey,
  transactionIndex: bigint
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or doesn't support signing");
  }

  // Get the execute instruction
  const { blockhash } = await connection.getLatestBlockhash();
  
  const executeResult = await multisig.instructions.vaultTransactionExecute({
    connection,
    multisigPda,
    transactionIndex,
    member: wallet.publicKey,
  });

  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;
  transaction.add(executeResult.instruction);

  // Sign with wallet adapter
  const signedTx = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

// Helper to generate share link for a proposal
export function getProposalShareLink(multisigPda: string, proposalIndex: bigint): string {
  const base = window.location.origin;
  return `${base}/vault/${multisigPda}/proposal/${proposalIndex.toString()}`;
}

// Helper to generate share link for a vault
export function getVaultShareLink(multisigPda: string): string {
  const base = window.location.origin;
  return `${base}/vault/${multisigPda}`;
}

// Copy text to clipboard and return success status
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("Failed to copy to clipboard:", e);
    return false;
  }
}
