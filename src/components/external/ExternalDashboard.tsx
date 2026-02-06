import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useNavigate } from 'react-router-dom';
import { PublicKey } from '@solana/web3.js';
import {
  getMultisigAccount,
  getVaultBalance,
  getProposals,
  getStoredMultisigs,
  saveMultisigAddress,
  removeStoredMultisig,
  discoverMultisigsForMember,
} from '../../utils/multisig';
import type { MultisigVault, VaultBalance } from '../../utils/multisig';
import ExternalCreateVault from './ExternalCreateVault';

interface VaultWithDetails {
  vault: MultisigVault;
  balance: VaultBalance;
  pendingCount: number;
}

type Tab = 'vaults' | 'create';

export default function ExternalDashboard() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<Tab>('vaults');
  const [vaults, setVaults] = useState<VaultWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [importAddress, setImportAddress] = useState('');
  const [importError, setImportError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadVaults = useCallback(async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setDiscovering(true);
    try {
      // Start with stored multisigs
      const storedMultisigs = getStoredMultisigs(publicKey.toBase58());
      const knownAddresses = new Set(storedMultisigs.map((s) => s.multisigPda));
      
      // Discover multisigs where user is a member (runs in parallel)
      const discoveredVaults = await discoverMultisigsForMember(connection, publicKey);
      setDiscovering(false);
      
      // Add any newly discovered vaults to storage
      for (const vault of discoveredVaults) {
        if (!knownAddresses.has(vault.address)) {
          saveMultisigAddress(publicKey.toBase58(), vault.address, vault.createKey);
          knownAddresses.add(vault.address);
        }
      }

      // Now load full details for all vaults (stored + discovered)
      const allAddresses = Array.from(knownAddresses);
      const vaultDetails: VaultWithDetails[] = [];

      for (const address of allAddresses) {
        try {
          const multisigPda = new PublicKey(address);
          
          // Check if we already have the vault data from discovery
          let vault: MultisigVault | null = discoveredVaults.find((v) => v.address === address) || null;
          if (!vault) {
            vault = await getMultisigAccount(connection, multisigPda);
          }
          
          if (vault) {
            const balance = await getVaultBalance(connection, multisigPda);
            const proposals = await getProposals(connection, multisigPda);
            const pendingCount = proposals.filter(
              (p) => p.status === 'Active' || p.status === 'Approved'
            ).length;
            
            vaultDetails.push({ vault, balance, pendingCount });
          }
        } catch (e) {
          console.error('Error loading vault:', address, e);
        }
      }

      setVaults(vaultDetails);
    } catch (e) {
      console.error('Error loading vaults:', e);
      setDiscovering(false);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      loadVaults();
    }
  }, [connected, publicKey, loadVaults, refreshTrigger]);

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

  const handleImportVault = async () => {
    setImportError('');
    
    if (!publicKey) {
      setImportError('Please connect your wallet first');
      return;
    }

    if (!importAddress.trim()) {
      setImportError('Please enter a vault address or link');
      return;
    }

    // Extract address from input (handles both direct address and URLs)
    const extractedAddress = extractVaultAddress(importAddress);
    if (!extractedAddress) {
      setImportError('Invalid address or link format');
      return;
    }

    try {
      const multisigPda = new PublicKey(extractedAddress);
      const vault = await getMultisigAccount(connection, multisigPda);
      
      if (!vault) {
        setImportError('Could not find vault at this address');
        return;
      }

      // Check if user is a member
      const isMember = vault.members.some(
        (m) => m.publicKey === publicKey.toBase58()
      );
      
      if (!isMember) {
        setImportError('You are not a member of this vault');
        return;
      }

      // Save to local storage
      saveMultisigAddress(publicKey.toBase58(), vault.address, vault.createKey);
      setImportAddress('');
      setRefreshTrigger((r) => r + 1);
    } catch (e) {
      setImportError('Invalid vault address');
    }
  };

  const handleRemoveVault = (multisigPda: string) => {
    if (!publicKey) return;
    if (confirm('Remove this vault from your list? You can always import it again.')) {
      removeStoredMultisig(publicKey.toBase58(), multisigPda);
      setRefreshTrigger((r) => r + 1);
    }
  };

  const handleVaultCreated = (multisigPda: string, createKey: string) => {
    if (publicKey) {
      saveMultisigAddress(publicKey.toBase58(), multisigPda, createKey);
      setRefreshTrigger((r) => r + 1);
      setActiveTab('vaults');
    }
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <div className="container">
        <div className="card external-connect-card">
          <button className="back-link" onClick={() => navigate('/')}>
            ← Back to home
          </button>
          
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="2" />
              <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1>Connect Your Wallet</h1>
          <p className="subtitle">
            Connect your Phantom, Solflare, or other Solana wallet to manage multisig vaults
          </p>
          
          <div className="wallet-button-container">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card external-dashboard-card">
        <div className="external-header">
          <button className="back-link" onClick={() => navigate('/')}>
            ← Back to home
          </button>
          <div className="wallet-info">
            <WalletMultiButton />
          </div>
        </div>

        <h1>Multisig Dashboard</h1>
        <p className="connected-as">
          Connected as: <span className="address">{formatAddress(publicKey?.toBase58() || '')}</span>
        </p>

        {/* Tabs */}
        <div className="external-tabs">
          <button
            className={`external-tab ${activeTab === 'vaults' ? 'active' : ''}`}
            onClick={() => setActiveTab('vaults')}
          >
            My Vaults
          </button>
          <button
            className={`external-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create Vault
          </button>
        </div>

        {activeTab === 'vaults' && (
          <div className="external-content">
            {/* Import Vault Section */}
            <div className="import-section">
              <h3>Import Vault</h3>
              <p className="import-hint">Paste a vault address or share link</p>
              <div className="import-form">
                <input
                  type="text"
                  placeholder="Address or link (e.g. https://.../vault/ABC...)"
                  value={importAddress}
                  onChange={(e) => setImportAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleImportVault()}
                />
                <button onClick={handleImportVault} className="primary">
                  Import
                </button>
              </div>
              {importError && <p className="error-text">{importError}</p>}
            </div>

            {/* Vaults List */}
            {loading ? (
              <div className="loading-state">
                {discovering ? 'Discovering your vaults...' : 'Loading vaults...'}
              </div>
            ) : vaults.length > 0 ? (
              <div className="external-vault-list">
                {vaults.map((v) => (
                  <div key={v.vault.address} className="external-vault-card">
                    <div className="vault-main-info">
                      <div className="vault-address" title={v.vault.address}>
                        {formatAddress(v.vault.address)}
                      </div>
                      <div className="vault-stats">
                        <span className="vault-threshold">
                          {v.vault.threshold}/{v.vault.members.length} threshold
                        </span>
                        <span className="vault-balance">
                          {v.balance.solBalance.toFixed(4)} SOL
                        </span>
                        {v.pendingCount > 0 && (
                          <span className="vault-pending">
                            {v.pendingCount} pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="vault-actions">
                      <button
                        className="primary"
                        onClick={() => navigate(`/vault/${v.vault.address}`)}
                      >
                        Open
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => handleRemoveVault(v.vault.address)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No vaults found</p>
                <p className="hint">Import an existing vault or create a new one</p>
              </div>
            )}

            {/* Refresh Button */}
            <button
              className="refresh-button"
              onClick={() => setRefreshTrigger((r) => r + 1)}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        )}

        {activeTab === 'create' && (
          <ExternalCreateVault onVaultCreated={handleVaultCreated} />
        )}
      </div>
    </div>
  );
}
