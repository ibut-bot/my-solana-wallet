import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { createMultisigVaultWA } from '../../utils/multisigWalletAdapter';
import { createPermissions } from '../../utils/multisig';

interface MemberInput {
  address: string;
  permissions: {
    initiate: boolean;
    vote: boolean;
    execute: boolean;
  };
}

interface ExternalCreateVaultProps {
  onVaultCreated: (multisigPda: string, createKey: string) => void;
}

export default function ExternalCreateVault({ onVaultCreated }: ExternalCreateVaultProps) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { publicKey } = wallet;

  const [members, setMembers] = useState<MemberInput[]>([
    {
      address: publicKey?.toBase58() || '',
      permissions: { initiate: true, vote: true, execute: true },
    },
  ]);
  const [threshold, setThreshold] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ address: string; signature: string } | null>(null);

  // Update first member address when wallet connects
  if (publicKey && members[0].address === '') {
    setMembers([
      {
        address: publicKey.toBase58(),
        permissions: { initiate: true, vote: true, execute: true },
      },
    ]);
  }

  const addMember = () => {
    setMembers([
      ...members,
      {
        address: '',
        permissions: { initiate: true, vote: true, execute: true },
      },
    ]);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      const newMembers = members.filter((_, i) => i !== index);
      setMembers(newMembers);
      if (threshold > newMembers.length) {
        setThreshold(newMembers.length);
      }
    }
  };

  const updateMemberAddress = (index: number, address: string) => {
    const newMembers = [...members];
    newMembers[index] = { ...newMembers[index], address };
    setMembers(newMembers);
  };

  const updateMemberPermission = (
    index: number,
    permission: 'initiate' | 'vote' | 'execute',
    value: boolean
  ) => {
    const newMembers = [...members];
    newMembers[index] = {
      ...newMembers[index],
      permissions: { ...newMembers[index].permissions, [permission]: value },
    };
    setMembers(newMembers);
  };

  const handleCreate = async () => {
    setError('');
    setSuccess(null);

    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    // Validate members
    const validMembers: { publicKey: PublicKey; permissions: any }[] = [];
    for (const member of members) {
      if (!member.address.trim()) {
        setError('All member addresses are required');
        return;
      }

      try {
        const pubKey = new PublicKey(member.address.trim());
        const perms = createPermissions(
          member.permissions.initiate,
          member.permissions.vote,
          member.permissions.execute
        );
        validMembers.push({ publicKey: pubKey, permissions: perms });
      } catch {
        setError(`Invalid address: ${member.address}`);
        return;
      }
    }

    // Validate threshold
    const voterCount = members.filter((m) => m.permissions.vote).length;
    if (threshold < 1 || threshold > voterCount) {
      setError(`Threshold must be between 1 and ${voterCount} (number of voters)`);
      return;
    }

    setLoading(true);
    try {
      const result = await createMultisigVaultWA(
        connection,
        wallet,
        validMembers,
        threshold,
        0 // timeLock
      );

      setSuccess({
        address: result.multisigPda.toBase58(),
        signature: result.signature,
      });

      onVaultCreated(result.multisigPda.toBase58(), result.createKey.toBase58());
    } catch (e) {
      console.error('Error creating vault:', e);
      setError((e as Error).message || 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="create-vault-success">
        <div className="success-icon">✓</div>
        <h3>Vault Created Successfully!</h3>
        <p>Your new multisig vault is ready to use.</p>
        <div className="success-details">
          <label>Vault Address:</label>
          <code>{success.address}</code>
        </div>
        <a
          href={`https://solscan.io/tx/${success.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-link"
        >
          View Transaction on Solscan
        </a>
        <button
          className="primary"
          onClick={() => setSuccess(null)}
          style={{ marginTop: '1rem' }}
        >
          Create Another Vault
        </button>
      </div>
    );
  }

  return (
    <div className="external-create-vault">
      <h3>Create New Multisig Vault</h3>
      <p className="create-description">
        Set up a new multisig vault with multiple members. Each member can have different permissions.
      </p>

      {error && <div className="error">{error}</div>}

      {/* Members Section */}
      <div className="members-section">
        <h4>Members</h4>
        {members.map((member, index) => (
          <div key={index} className="member-input-card">
            <div className="member-header">
              <span className="member-number">Member {index + 1}</span>
              {index === 0 && publicKey && member.address === publicKey.toBase58() && (
                <span className="you-badge">You</span>
              )}
              {members.length > 1 && (
                <button
                  className="remove-member-btn"
                  onClick={() => removeMember(index)}
                  title="Remove member"
                >
                  ×
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Member wallet address"
              value={member.address}
              onChange={(e) => updateMemberAddress(index, e.target.value)}
              disabled={index === 0 && !!publicKey && member.address === publicKey.toBase58()}
            />
            <div className="permissions-row">
              <label className="permission-checkbox">
                <input
                  type="checkbox"
                  checked={member.permissions.initiate}
                  onChange={(e) =>
                    updateMemberPermission(index, 'initiate', e.target.checked)
                  }
                />
                <span>Propose</span>
              </label>
              <label className="permission-checkbox">
                <input
                  type="checkbox"
                  checked={member.permissions.vote}
                  onChange={(e) =>
                    updateMemberPermission(index, 'vote', e.target.checked)
                  }
                />
                <span>Vote</span>
              </label>
              <label className="permission-checkbox">
                <input
                  type="checkbox"
                  checked={member.permissions.execute}
                  onChange={(e) =>
                    updateMemberPermission(index, 'execute', e.target.checked)
                  }
                />
                <span>Execute</span>
              </label>
            </div>
          </div>
        ))}
        <button className="add-member-btn" onClick={addMember}>
          + Add Member
        </button>
      </div>

      {/* Threshold Section */}
      <div className="threshold-section">
        <h4>Approval Threshold</h4>
        <p className="threshold-description">
          Number of approvals required to execute a transaction
        </p>
        <div className="threshold-input">
          <input
            type="number"
            min={1}
            max={members.filter((m) => m.permissions.vote).length}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value) || 1)}
          />
          <span className="threshold-label">
            of {members.filter((m) => m.permissions.vote).length} voters
          </span>
        </div>
      </div>

      {/* Create Button */}
      <button
        className="primary create-button"
        onClick={handleCreate}
        disabled={loading || !publicKey}
      >
        {loading ? 'Creating Vault...' : 'Create Vault'}
      </button>
    </div>
  );
}
