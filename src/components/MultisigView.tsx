import { useState } from 'react';
import { Keypair, Connection } from '@solana/web3.js';
import CreateVault from './multisig/CreateVault';
import MyVaults from './multisig/MyVaults';
import VaultDetail from './multisig/VaultDetail';

type MultisigTab = 'vaults' | 'create';

interface MultisigViewProps {
  keypair: Keypair;
  connection: Connection;
  loadWallet: (password: string) => Promise<Keypair | null>;
}

export default function MultisigView({ keypair, connection, loadWallet }: MultisigViewProps) {
  const [activeTab, setActiveTab] = useState<MultisigTab>('vaults');
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleVaultCreated = (multisigPda: string) => {
    setRefreshTrigger((prev) => prev + 1);
    setSelectedVault(multisigPda);
  };

  const handleSelectVault = (multisigPda: string) => {
    setSelectedVault(multisigPda);
  };

  const handleBackToVaults = () => {
    setSelectedVault(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  // If a vault is selected, show the detail view
  if (selectedVault) {
    return (
      <VaultDetail
        multisigPda={selectedVault}
        keypair={keypair}
        connection={connection}
        loadWallet={loadWallet}
        onBack={handleBackToVaults}
      />
    );
  }

  return (
    <div className="card multisig-card">
      <div className="multisig-header">
        <h1>Multisig Vaults</h1>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'vaults' ? 'active' : ''}`}
          onClick={() => setActiveTab('vaults')}
        >
          My Vaults
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Vault
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'vaults' && (
          <MyVaults
            keypair={keypair}
            connection={connection}
            onSelectVault={handleSelectVault}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'create' && (
          <CreateVault
            keypair={keypair}
            connection={connection}
            loadWallet={loadWallet}
            onVaultCreated={handleVaultCreated}
          />
        )}
      </div>
    </div>
  );
}
