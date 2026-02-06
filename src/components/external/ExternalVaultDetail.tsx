import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getMultisigAccount,
  getVaultBalance,
  getProposals,
  saveMultisigAddress,
} from '../../utils/multisig';
import type { MultisigVault, VaultBalance, ProposalInfo } from '../../utils/multisig';
import {
  createTransferProposalWA,
  approveProposalWA,
  rejectProposalWA,
  executeVaultTransactionWA,
  getProposalShareLink,
  getVaultShareLink,
  copyToClipboard,
} from '../../utils/multisigWalletAdapter';

type Tab = 'proposals' | 'transfer' | 'members';

export default function ExternalVaultDetail() {
  const { multisigPda, proposalIndex } = useParams<{ multisigPda: string; proposalIndex?: string }>();
  const navigate = useNavigate();
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();

  const [vault, setVault] = useState<MultisigVault | null>(null);
  const [balance, setBalance] = useState<VaultBalance | null>(null);
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('proposals');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [highlightedProposal, setHighlightedProposal] = useState<bigint | null>(null);

  // Transfer form state
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMemo, setTransferMemo] = useState('');
  const [transferSuccess, setTransferSuccess] = useState<{ txIndex: bigint; signature: string } | null>(null);

  const loadVaultData = useCallback(async () => {
    if (!multisigPda) return;

    setLoading(true);
    setError('');
    try {
      const pda = new PublicKey(multisigPda);
      const vaultData = await getMultisigAccount(connection, pda);
      
      if (!vaultData) {
        setError('Vault not found');
        setLoading(false);
        return;
      }

      setVault(vaultData);

      const balanceData = await getVaultBalance(connection, pda);
      setBalance(balanceData);

      const proposalsData = await getProposals(connection, pda);
      setProposals(proposalsData);

      // If there's a proposal index in URL, highlight it
      if (proposalIndex) {
        setHighlightedProposal(BigInt(proposalIndex));
        setActiveTab('proposals');
      }

      // Save to local storage if user is a member and connected
      if (publicKey && vaultData.members.some((m) => m.publicKey === publicKey.toBase58())) {
        saveMultisigAddress(publicKey.toBase58(), vaultData.address, vaultData.createKey);
      }
    } catch (e) {
      console.error('Error loading vault:', e);
      setError('Failed to load vault data');
    } finally {
      setLoading(false);
    }
  }, [multisigPda, proposalIndex, connection, publicKey]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  const handleCopyLink = async (type: 'vault' | 'proposal', proposalIdx?: bigint) => {
    if (!multisigPda) return;

    const link = type === 'vault' 
      ? getVaultShareLink(multisigPda)
      : getProposalShareLink(multisigPda, proposalIdx!);
    
    const success = await copyToClipboard(link);
    if (success) {
      setCopied(type === 'vault' ? 'vault' : `proposal-${proposalIdx}`);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleApprove = async (proposalIdx: bigint) => {
    if (!multisigPda) return;
    setActionLoading(true);
    setError('');
    try {
      await approveProposalWA(connection, wallet, new PublicKey(multisigPda), proposalIdx);
      await loadVaultData();
    } catch (e) {
      console.error('Error approving:', e);
      setError((e as Error).message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (proposalIdx: bigint) => {
    if (!multisigPda) return;
    setActionLoading(true);
    setError('');
    try {
      await rejectProposalWA(connection, wallet, new PublicKey(multisigPda), proposalIdx);
      await loadVaultData();
    } catch (e) {
      console.error('Error rejecting:', e);
      setError((e as Error).message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecute = async (proposalIdx: bigint) => {
    if (!multisigPda) return;
    setActionLoading(true);
    setError('');
    try {
      await executeVaultTransactionWA(connection, wallet, new PublicKey(multisigPda), proposalIdx);
      await loadVaultData();
    } catch (e) {
      console.error('Error executing:', e);
      setError((e as Error).message || 'Failed to execute');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTransfer = async () => {
    if (!multisigPda || !publicKey) return;
    setError('');
    setTransferSuccess(null);

    if (!recipientAddress.trim()) {
      setError('Please enter a recipient address');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setActionLoading(true);
    try {
      const recipient = new PublicKey(recipientAddress.trim());
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);

      const result = await createTransferProposalWA(
        connection,
        wallet,
        new PublicKey(multisigPda),
        recipient,
        lamports,
        transferMemo || undefined
      );

      setTransferSuccess({
        txIndex: result.transactionIndex,
        signature: result.signature,
      });
      setRecipientAddress('');
      setTransferAmount('');
      setTransferMemo('');
      await loadVaultData();
    } catch (e) {
      console.error('Error creating transfer:', e);
      setError((e as Error).message || 'Failed to create transfer proposal');
    } finally {
      setActionLoading(false);
    }
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getUserPermissions = () => {
    if (!publicKey || !vault) return null;
    const member = vault.members.find((m) => m.publicKey === publicKey.toBase58());
    return member?.permissions || null;
  };

  const canUserVote = () => {
    const perms = getUserPermissions();
    return perms?.vote === true;
  };

  const canUserExecute = () => {
    const perms = getUserPermissions();
    return perms?.execute === true;
  };

  const canUserPropose = () => {
    const perms = getUserPermissions();
    return perms?.initiate === true;
  };

  const hasUserVoted = (proposal: ProposalInfo): 'approved' | 'rejected' | null => {
    if (!publicKey) return null;
    if (proposal.approvals.includes(publicKey.toBase58())) return 'approved';
    if (proposal.rejections.includes(publicKey.toBase58())) return 'rejected';
    return null;
  };

  if (!connected) {
    return (
      <div className="container">
        <div className="card external-connect-card">
          <button className="back-link" onClick={() => navigate('/connect')}>
            ← Back to dashboard
          </button>
          
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="2" />
              <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1>Connect Your Wallet</h1>
          <p className="subtitle">
            Connect your wallet to interact with this multisig vault
          </p>
          
          <div className="wallet-button-container">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading-state">Loading vault...</div>
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="container">
        <div className="card">
          <button className="back-link" onClick={() => navigate('/connect')}>
            ← Back to dashboard
          </button>
          <div className="error-state">
            <h2>Vault Not Found</h2>
            <p>The vault address may be invalid or the vault doesn't exist.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card external-vault-detail">
        <div className="external-header">
          <button className="back-link" onClick={() => navigate('/connect')}>
            ← Back to dashboard
          </button>
          <WalletMultiButton />
        </div>

        {/* Vault Banner */}
        <div className="vault-banner">
          <div className="vault-banner-info">
            <h1>Multisig Vault</h1>
            <div className="vault-address-row">
              <code title={vault.address}>{formatAddress(vault.address)}</code>
              <button
                className="copy-btn small"
                onClick={() => handleCopyLink('vault')}
              >
                {copied === 'vault' ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
          <div className="vault-banner-stats">
            <div className="stat">
              <span className="stat-value">{balance?.solBalance.toFixed(4) || '0'}</span>
              <span className="stat-label">SOL</span>
            </div>
            <div className="stat">
              <span className="stat-value">{vault.threshold}/{vault.members.length}</span>
              <span className="stat-label">Threshold</span>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {/* Tabs */}
        <div className="external-tabs">
          <button
            className={`external-tab ${activeTab === 'proposals' ? 'active' : ''}`}
            onClick={() => setActiveTab('proposals')}
          >
            Proposals ({proposals.filter((p) => p.status === 'Active' || p.status === 'Approved').length})
          </button>
          <button
            className={`external-tab ${activeTab === 'transfer' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfer')}
            disabled={!canUserPropose()}
            title={!canUserPropose() ? 'You need Propose permission' : ''}
          >
            New Transfer
          </button>
          <button
            className={`external-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
        </div>

        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <div className="external-content">
            {proposals.length > 0 ? (
              <div className="proposals-list">
                {proposals.map((proposal) => (
                  <div
                    key={proposal.index.toString()}
                    className={`proposal-card ${highlightedProposal === proposal.index ? 'highlighted' : ''}`}
                  >
                    <div className="proposal-header">
                      <span className="proposal-index">#{proposal.index.toString()}</span>
                      <span className={`proposal-status ${proposal.status.toLowerCase()}`}>
                        {proposal.status}
                      </span>
                    </div>
                    <div className="proposal-votes">
                      <span className="approvals">
                        ✓ {proposal.approvals.length} approvals
                      </span>
                      <span className="rejections">
                        ✗ {proposal.rejections.length} rejections
                      </span>
                      <span className="needed">
                        (need {vault.threshold} to pass)
                      </span>
                    </div>
                    {hasUserVoted(proposal) && (
                      <div className={`user-vote ${hasUserVoted(proposal)}`}>
                        You {hasUserVoted(proposal)}
                      </div>
                    )}
                    <div className="proposal-actions">
                      {proposal.status === 'Active' && canUserVote() && !hasUserVoted(proposal) && (
                        <>
                          <button
                            className="approve-btn"
                            onClick={() => handleApprove(proposal.index)}
                            disabled={actionLoading}
                          >
                            {actionLoading ? '...' : 'Approve'}
                          </button>
                          <button
                            className="reject-btn"
                            onClick={() => handleReject(proposal.index)}
                            disabled={actionLoading}
                          >
                            {actionLoading ? '...' : 'Reject'}
                          </button>
                        </>
                      )}
                      {proposal.status === 'Approved' && canUserExecute() && (
                        <button
                          className="execute-btn"
                          onClick={() => handleExecute(proposal.index)}
                          disabled={actionLoading}
                        >
                          {actionLoading ? '...' : 'Execute'}
                        </button>
                      )}
                      <button
                        className="share-btn"
                        onClick={() => handleCopyLink('proposal', proposal.index)}
                      >
                        {copied === `proposal-${proposal.index}` ? '✓ Copied!' : 'Share'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No proposals yet</p>
                {canUserPropose() && (
                  <p className="hint">Create a new transfer to start</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transfer Tab */}
        {activeTab === 'transfer' && (
          <div className="external-content">
            <h3>Create Transfer Proposal</h3>
            <p className="transfer-description">
              Propose a SOL transfer from the vault. Other members will need to approve it.
            </p>

            {transferSuccess ? (
              <div className="transfer-success">
                <div className="success-icon">✓</div>
                <h4>Proposal Created!</h4>
                <p>Transaction #{transferSuccess.txIndex.toString()} is now awaiting approval.</p>
                <a
                  href={`https://solscan.io/tx/${transferSuccess.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View on Solscan
                </a>
                <button
                  className="share-proposal-btn"
                  onClick={() => handleCopyLink('proposal', transferSuccess.txIndex)}
                >
                  {copied === `proposal-${transferSuccess.txIndex}` ? '✓ Link Copied!' : 'Copy Share Link'}
                </button>
                <button
                  className="primary"
                  onClick={() => setTransferSuccess(null)}
                  style={{ marginTop: '1rem' }}
                >
                  Create Another
                </button>
              </div>
            ) : (
              <div className="transfer-form">
                <div className="form-group">
                  <label>Recipient Address</label>
                  <input
                    type="text"
                    placeholder="Enter Solana address..."
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Amount (SOL)</label>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    step="any"
                    min="0"
                  />
                  <span className="available-balance">
                    Available: {balance?.solBalance.toFixed(4) || '0'} SOL
                  </span>
                </div>
                <div className="form-group">
                  <label>Memo (optional)</label>
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={transferMemo}
                    onChange={(e) => setTransferMemo(e.target.value)}
                  />
                </div>
                <button
                  className="primary"
                  onClick={handleCreateTransfer}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Creating...' : 'Create Proposal'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="external-content">
            <h3>Vault Members</h3>
            <div className="members-list">
              {vault.members.map((member) => (
                <div key={member.publicKey} className="member-card">
                  <div className="member-address">
                    <code title={member.publicKey}>{formatAddress(member.publicKey)}</code>
                    {member.publicKey === publicKey?.toBase58() && (
                      <span className="you-badge">You</span>
                    )}
                  </div>
                  <div className="member-permissions">
                    {member.permissions.initiate && (
                      <span className="permission-badge propose">Propose</span>
                    )}
                    {member.permissions.vote && (
                      <span className="permission-badge vote">Vote</span>
                    )}
                    {member.permissions.execute && (
                      <span className="permission-badge execute">Execute</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <button
          className="refresh-button"
          onClick={loadVaultData}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
