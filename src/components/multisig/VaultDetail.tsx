import { useState, useEffect, useCallback } from 'react';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getMultisigAccount,
  getVaultBalance,
  getProposals,
  createTransferProposal,
  approveProposal,
  rejectProposal,
  executeVaultTransaction,
} from '../../utils/multisig';
import type { MultisigVault, VaultBalance, ProposalInfo } from '../../utils/multisig';
import { getProposalShareLink, getVaultShareLink, copyToClipboard } from '../../utils/multisigWalletAdapter';

type DetailTab = 'proposals' | 'transfer' | 'members';

interface VaultDetailProps {
  multisigPda: string;
  keypair: Keypair;
  connection: Connection;
  loadWallet: (password: string) => Promise<Keypair | null>;
  onBack: () => void;
}

export default function VaultDetail({
  multisigPda,
  keypair,
  connection,
  loadWallet,
  onBack,
}: VaultDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('proposals');
  const [vault, setVault] = useState<MultisigVault | null>(null);
  const [balance, setBalance] = useState<VaultBalance | null>(null);
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Transfer form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [password, setPassword] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Share link state
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  // Copy address state
  const [copiedAddress, setCopiedAddress] = useState<'multisig' | 'treasury' | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const pdaPublicKey = new PublicKey(multisigPda);
      const [vaultData, balanceData, proposalsData] = await Promise.all([
        getMultisigAccount(connection, pdaPublicKey),
        getVaultBalance(connection, pdaPublicKey),
        getProposals(connection, pdaPublicKey),
      ]);

      if (!vaultData) {
        setError('Failed to load vault data');
        return;
      }

      setVault(vaultData);
      setBalance(balanceData);
      setProposals(proposalsData);
    } catch (e) {
      console.error('Error fetching vault data:', e);
      setError('Failed to load vault data');
    } finally {
      setLoading(false);
    }
  }, [connection, multisigPda]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTransfer = async () => {
    setError('');
    setTransferSuccess(null);

    if (!recipient || !amount) {
      setError('Please fill in recipient and amount');
      return;
    }

    try {
      new PublicKey(recipient);
    } catch {
      setError('Invalid recipient address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (balance && amountNum > balance.solBalance) {
      setError(`Insufficient vault balance. Available: ${balance.solBalance.toFixed(4)} SOL`);
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    setTransferLoading(true);
    try {
      const kp = await loadWallet(password);
      if (!kp) {
        setError('Invalid password');
        setTransferLoading(false);
        return;
      }

      const lamports = Math.round(amountNum * LAMPORTS_PER_SOL);
      const result = await createTransferProposal(
        connection,
        kp,
        new PublicKey(multisigPda),
        new PublicKey(recipient),
        lamports,
        memo || undefined
      );

      setTransferSuccess(result.signature);
      setRecipient('');
      setAmount('');
      setMemo('');
      setPassword('');
      
      // Refresh data
      await fetchData();
    } catch (e) {
      console.error('Failed to create proposal:', e);
      setError((e as Error).message);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleApprove = async (proposal: ProposalInfo) => {
    const pwd = prompt('Enter your password to approve:');
    if (!pwd) return;

    setActionLoading(`approve-${proposal.index}`);
    try {
      const kp = await loadWallet(pwd);
      if (!kp) {
        alert('Invalid password');
        return;
      }

      await approveProposal(
        connection,
        kp,
        new PublicKey(multisigPda),
        proposal.index
      );

      await fetchData();
    } catch (e) {
      console.error('Failed to approve:', e);
      alert('Failed to approve: ' + (e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (proposal: ProposalInfo) => {
    const pwd = prompt('Enter your password to reject:');
    if (!pwd) return;

    setActionLoading(`reject-${proposal.index}`);
    try {
      const kp = await loadWallet(pwd);
      if (!kp) {
        alert('Invalid password');
        return;
      }

      await rejectProposal(
        connection,
        kp,
        new PublicKey(multisigPda),
        proposal.index
      );

      await fetchData();
    } catch (e) {
      console.error('Failed to reject:', e);
      alert('Failed to reject: ' + (e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExecute = async (proposal: ProposalInfo) => {
    const pwd = prompt('Enter your password to execute:');
    if (!pwd) return;

    setActionLoading(`execute-${proposal.index}`);
    try {
      const kp = await loadWallet(pwd);
      if (!kp) {
        alert('Invalid password');
        return;
      }

      await executeVaultTransaction(
        connection,
        kp,
        new PublicKey(multisigPda),
        proposal.index
      );

      await fetchData();
    } catch (e) {
      console.error('Failed to execute:', e);
      alert('Failed to execute: ' + (e as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleCopyShareLink = async (type: 'vault' | 'proposal', proposalIdx?: bigint) => {
    const link = type === 'vault'
      ? getVaultShareLink(multisigPda)
      : getProposalShareLink(multisigPda, proposalIdx!);
    
    const success = await copyToClipboard(link);
    if (success) {
      const key = type === 'vault' ? 'vault' : `proposal-${proposalIdx}`;
      setCopiedLink(key);
      setTimeout(() => setCopiedLink(null), 2000);
    }
  };

  const handleCopyAddress = async (type: 'multisig' | 'treasury', address: string) => {
    const success = await copyToClipboard(address);
    if (success) {
      setCopiedAddress(type);
      setTimeout(() => setCopiedAddress(null), 2000);
    }
  };

  const hasVoted = (proposal: ProposalInfo) => {
    const userPubKey = keypair.publicKey.toBase58();
    return (
      proposal.approvals.includes(userPubKey) ||
      proposal.rejections.includes(userPubKey)
    );
  };

  const canExecute = (proposal: ProposalInfo) => {
    return proposal.status === 'Approved' && vault;
  };

  const userPermissions = vault?.members.find(
    (m) => m.publicKey === keypair.publicKey.toBase58()
  )?.permissions;

  if (loading) {
    return (
      <div className="card multisig-card">
        <div className="loading-state">Loading vault...</div>
      </div>
    );
  }

  return (
    <div className="card multisig-card vault-detail">
      <div className="vault-detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>Vault Details</h1>
        <button className="refresh-btn" onClick={fetchData} disabled={loading}>
          {loading ? '...' : '↻'}
        </button>
      </div>

      {/* Vault Addresses Section */}
      <div className="vault-addresses">
        <div className="address-row">
          <div className="address-info">
            <span className="address-label">Multisig Account</span>
            <span className="address-hint">Configuration & settings</span>
          </div>
          <div className="address-value-row">
            <code className="address-value" title={multisigPda}>{formatAddress(multisigPda)}</code>
            <button 
              className="copy-btn small"
              onClick={() => handleCopyAddress('multisig', multisigPda)}
            >
              {copiedAddress === 'multisig' ? '✓' : 'Copy'}
            </button>
          </div>
        </div>
        {balance && (
          <div className="address-row treasury">
            <div className="address-info">
              <span className="address-label">Treasury Address</span>
              <span className="address-hint">Send SOL here to fund vault</span>
            </div>
            <div className="address-value-row">
              <code className="address-value" title={balance.vaultPda}>{formatAddress(balance.vaultPda)}</code>
              <button 
                className="copy-btn small"
                onClick={() => handleCopyAddress('treasury', balance.vaultPda)}
              >
                {copiedAddress === 'treasury' ? '✓' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Vault Stats Banner */}
      <div className="vault-stats-banner">
        <div className="stat-item">
          <span className="stat-value">{balance?.solBalance.toFixed(4)}</span>
          <span className="stat-label">SOL Balance</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{vault?.threshold}/{vault?.members.length}</span>
          <span className="stat-label">Threshold</span>
        </div>
        <div className="stat-item">
          <button
            className="share-vault-btn"
            onClick={() => handleCopyShareLink('vault')}
          >
            {copiedLink === 'vault' ? '✓ Copied!' : 'Share Link'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => setActiveTab('proposals')}
        >
          Proposals ({proposals.filter((p) => p.status === 'Active' || p.status === 'Approved').length})
        </button>
        <button
          className={`tab ${activeTab === 'transfer' ? 'active' : ''}`}
          onClick={() => setActiveTab('transfer')}
        >
          New Transfer
        </button>
        <button
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="tab-content">
        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <div className="proposals-list">
            {proposals.length === 0 ? (
              <div className="empty-state">
                <p>No proposals yet</p>
                <p className="hint">Create a transfer to get started</p>
              </div>
            ) : (
              proposals.map((proposal) => (
                <div
                  key={proposal.index.toString()}
                  className={`proposal-card ${proposal.status.toLowerCase()}`}
                >
                  <div className="proposal-header">
                    <span className="proposal-id">#{proposal.index.toString()}</span>
                    <span className={`status-badge ${proposal.status.toLowerCase()}`}>
                      {proposal.status}
                    </span>
                  </div>

                  <div className="proposal-body">
                    <div className="votes">
                      <span className="approvals">
                        ✓ {proposal.approvals.length} approved
                      </span>
                      <span className="rejections">
                        ✗ {proposal.rejections.length} rejected
                      </span>
                      <span className="threshold">
                        (need {vault?.threshold})
                      </span>
                    </div>
                  </div>

                  <div className="proposal-actions">
                    {proposal.status === 'Active' && (
                      <>
                        {!hasVoted(proposal) && userPermissions?.vote && (
                          <>
                            <button
                              className="approve-btn"
                              onClick={() => handleApprove(proposal)}
                              disabled={actionLoading === `approve-${proposal.index}`}
                            >
                              {actionLoading === `approve-${proposal.index}`
                                ? '...'
                                : 'Approve'}
                            </button>
                            <button
                              className="reject-btn"
                              onClick={() => handleReject(proposal)}
                              disabled={actionLoading === `reject-${proposal.index}`}
                            >
                              {actionLoading === `reject-${proposal.index}`
                                ? '...'
                                : 'Reject'}
                            </button>
                          </>
                        )}
                        {hasVoted(proposal) && (
                          <span className="voted-label">
                            You voted: {proposal.approvals.includes(keypair.publicKey.toBase58())
                              ? '✓ Approved'
                              : '✗ Rejected'}
                          </span>
                        )}
                      </>
                    )}
                    {canExecute(proposal) && userPermissions?.execute && (
                      <button
                        className="execute-btn"
                        onClick={() => handleExecute(proposal)}
                        disabled={actionLoading === `execute-${proposal.index}`}
                      >
                        {actionLoading === `execute-${proposal.index}`
                          ? '...'
                          : 'Execute'}
                      </button>
                    )}
                    <button
                      className="share-btn"
                      onClick={() => handleCopyShareLink('proposal', proposal.index)}
                    >
                      {copiedLink === `proposal-${proposal.index}` ? '✓ Copied!' : 'Share'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Transfer Tab */}
        {activeTab === 'transfer' && (
          <div className="transfer-form">
            <h2>Propose SOL Transfer</h2>
            {!userPermissions?.initiate ? (
              <div className="warning">
                You don't have permission to create proposals
              </div>
            ) : (
              <>
                {transferSuccess ? (
                  <div className="success-message">
                    <div className="success-icon">✓</div>
                    <p>Proposal created successfully!</p>
                    <a
                      href={`https://solscan.io/tx/${transferSuccess}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View on Solscan
                    </a>
                    <button
                      className="primary"
                      onClick={() => {
                        setTransferSuccess(null);
                        setActiveTab('proposals');
                      }}
                      style={{ marginTop: '1rem' }}
                    >
                      View Proposals
                    </button>
                  </div>
                ) : (
                  <div className="form">
                    <input
                      type="text"
                      placeholder="Recipient address"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Amount (SOL)"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      step="any"
                      min="0"
                    />
                    <input
                      type="text"
                      placeholder="Memo (optional)"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                    <input
                      type="password"
                      placeholder="Enter password to sign"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      className="primary"
                      onClick={handleCreateTransfer}
                      disabled={transferLoading}
                    >
                      {transferLoading ? 'Creating...' : 'Create Proposal'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && vault && (
          <div className="members-list">
            <h2>Vault Members</h2>
            {vault.members.map((member) => (
              <div
                key={member.publicKey}
                className={`member-item ${
                  member.publicKey === keypair.publicKey.toBase58() ? 'current' : ''
                }`}
              >
                <div className="member-info">
                  <span className="member-address" title={member.publicKey}>
                    {formatAddress(member.publicKey)}
                    {member.publicKey === keypair.publicKey.toBase58() && (
                      <span className="you-badge">You</span>
                    )}
                  </span>
                </div>
                <div className="member-permissions">
                  {member.permissions.initiate && (
                    <span className="perm-badge propose">Propose</span>
                  )}
                  {member.permissions.vote && (
                    <span className="perm-badge vote">Vote</span>
                  )}
                  {member.permissions.execute && (
                    <span className="perm-badge execute">Execute</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
