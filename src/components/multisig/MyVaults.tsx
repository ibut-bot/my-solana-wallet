import { useState, useEffect, useCallback } from 'react';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import {
  getStoredMultisigs,
  getMultisigAccount,
  getVaultBalance,
  getProposals,
  saveMultisigAddress,
  removeStoredMultisig,
} from '../../utils/multisig';
import type { MultisigVault, VaultBalance } from '../../utils/multisig';

interface VaultListItem {
  multisigPda: string;
  account: MultisigVault | null;
  balance: VaultBalance | null;
  pendingProposals: number;
  loading: boolean;
  error: string | null;
}

interface MyVaultsProps {
  keypair: Keypair;
  connection: Connection;
  onSelectVault: (multisigPda: string) => void;
  refreshTrigger: number;
}

export default function MyVaults({
  keypair,
  connection,
  onSelectVault,
  refreshTrigger,
}: MyVaultsProps) {
  const [vaults, setVaults] = useState<VaultListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importAddress, setImportAddress] = useState('');
  const [importError, setImportError] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchVaultDetails = useCallback(
    async (multisigPda: string): Promise<VaultListItem> => {
      try {
        const pdaPublicKey = new PublicKey(multisigPda);
        const [account, balance, proposals] = await Promise.all([
          getMultisigAccount(connection, pdaPublicKey),
          getVaultBalance(connection, pdaPublicKey),
          getProposals(connection, pdaPublicKey),
        ]);

        const pendingProposals = proposals.filter(
          (p) => p.status === 'Active' || p.status === 'Approved'
        ).length;

        return {
          multisigPda,
          account,
          balance,
          pendingProposals,
          loading: false,
          error: null,
        };
      } catch (e) {
        console.error('Error fetching vault:', e);
        return {
          multisigPda,
          account: null,
          balance: null,
          pendingProposals: 0,
          loading: false,
          error: 'Failed to load vault',
        };
      }
    },
    [connection]
  );

  const loadVaults = useCallback(async () => {
    setLoading(true);
    const stored = getStoredMultisigs(keypair.publicKey.toBase58());

    if (stored.length === 0) {
      setVaults([]);
      setLoading(false);
      return;
    }

    // Initialize with loading state
    setVaults(
      stored.map((s) => ({
        multisigPda: s.multisigPda,
        account: null,
        balance: null,
        pendingProposals: 0,
        loading: true,
        error: null,
      }))
    );

    // Fetch details for each vault
    const details = await Promise.all(
      stored.map((s) => fetchVaultDetails(s.multisigPda))
    );

    setVaults(details);
    setLoading(false);
  }, [keypair, fetchVaultDetails]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults, refreshTrigger]);

  // Extract vault address from input (supports direct address or URL)
  const extractVaultAddress = (input: string): string | null => {
    const trimmed = input.trim();
    
    // Check if it's a URL containing /vault/ADDRESS
    const vaultUrlMatch = trimmed.match(/\/vault\/([A-HJ-NP-Za-km-z1-9]{32,44})/);
    if (vaultUrlMatch) {
      return vaultUrlMatch[1];
    }
    
    // Check if it's a direct Solana address (base58, 32-44 chars)
    if (/^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(trimmed)) {
      return trimmed;
    }
    
    return null;
  };

  const handleImport = async () => {
    setImportError('');

    if (!importAddress.trim()) {
      setImportError('Please enter a multisig address or link');
      return;
    }

    // Extract address from input (handles both direct address and URLs)
    const extractedAddress = extractVaultAddress(importAddress);
    if (!extractedAddress) {
      setImportError('Invalid address or link format');
      return;
    }

    try {
      const pdaPublicKey = new PublicKey(extractedAddress);
      
      // Verify it's a valid multisig
      const account = await getMultisigAccount(connection, pdaPublicKey);
      if (!account) {
        setImportError('Invalid multisig address or not found');
        return;
      }

      // Check if user is a member
      const isMember = account.members.some(
        (m) => m.publicKey === keypair.publicKey.toBase58()
      );
      if (!isMember) {
        setImportError('You are not a member of this multisig');
        return;
      }

      // Save to local storage
      saveMultisigAddress(
        keypair.publicKey.toBase58(),
        extractedAddress,
        account.createKey
      );

      setImportAddress('');
      setShowImport(false);
      loadVaults();
    } catch (e) {
      console.error('Import error:', e);
      setImportError('Invalid address format');
    }
  };

  const handleRemove = (multisigPda: string) => {
    if (confirm('Remove this vault from your list? (This will not delete the vault on-chain)')) {
      removeStoredMultisig(keypair.publicKey.toBase58(), multisigPda);
      setVaults(vaults.filter((v) => v.multisigPda !== multisigPda));
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading && vaults.length === 0) {
    return <div className="loading-state">Loading vaults...</div>;
  }

  return (
    <div className="my-vaults">
      <div className="vaults-header">
        <h2>Your Multisig Vaults</h2>
        <div className="vaults-actions">
          <button className="refresh-btn" onClick={loadVaults} disabled={loading}>
            {loading ? '...' : '↻'}
          </button>
          <button
            className="import-btn"
            onClick={() => setShowImport(!showImport)}
          >
            {showImport ? 'Cancel' : 'Import'}
          </button>
        </div>
      </div>

      {showImport && (
        <div className="import-section">
          <p className="import-hint">Paste a vault address or share link</p>
          <input
            type="text"
            placeholder="Address or link (e.g. https://.../vault/ABC...)"
            value={importAddress}
            onChange={(e) => setImportAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          />
          {importError && <div className="error small">{importError}</div>}
          <button className="primary small" onClick={handleImport}>
            Import Vault
          </button>
        </div>
      )}

      {vaults.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p>No multisig vaults found</p>
          <p className="hint">Create a new vault or import an existing one</p>
        </div>
      ) : (
        <div className="vaults-list">
          {vaults.map((vault) => (
            <div
              key={vault.multisigPda}
              className="vault-card"
              onClick={() => !vault.error && onSelectVault(vault.multisigPda)}
            >
              {vault.loading ? (
                <div className="vault-loading">Loading...</div>
              ) : vault.error ? (
                <div className="vault-error">
                  <span>{formatAddress(vault.multisigPda)}</span>
                  <span className="error-text">{vault.error}</span>
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(vault.multisigPda);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="vault-info">
                    <div className="vault-address" title={vault.multisigPda}>
                      {formatAddress(vault.multisigPda)}
                    </div>
                    <div className="vault-meta">
                      <span className="threshold">
                        {vault.account?.threshold} of {vault.account?.members.length}
                      </span>
                      <span className="balance">
                        {vault.balance?.solBalance.toFixed(4)} SOL
                      </span>
                    </div>
                  </div>
                  <div className="vault-status">
                    {vault.pendingProposals > 0 && (
                      <span className="pending-badge">
                        {vault.pendingProposals} pending
                      </span>
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      className="chevron"
                    >
                      <path
                        d="M9 18L15 12L9 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
