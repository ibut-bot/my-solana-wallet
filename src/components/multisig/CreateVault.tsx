import { useState } from 'react';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import {
  createMultisigVault,
  createPermissions,
  getAllPermissions,
  saveMultisigAddress,
} from '../../utils/multisig';

interface Member {
  address: string;
  initiate: boolean;
  vote: boolean;
  execute: boolean;
}

interface CreateVaultProps {
  keypair: Keypair;
  connection: Connection;
  loadWallet: (password: string) => Promise<Keypair | null>;
  onVaultCreated: (multisigPda: string) => void;
}

export default function CreateVault({
  keypair,
  connection,
  loadWallet,
  onVaultCreated,
}: CreateVaultProps) {
  const [members, setMembers] = useState<Member[]>([
    {
      address: keypair.publicKey.toBase58(),
      initiate: true,
      vote: true,
      execute: true,
    },
  ]);
  const [threshold, setThreshold] = useState(1);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    multisigPda: string;
    vaultPda: string;
    signature: string;
  } | null>(null);

  const addMember = () => {
    setMembers([
      ...members,
      { address: '', initiate: true, vote: true, execute: true },
    ]);
  };

  const removeMember = (index: number) => {
    if (members.length > 1) {
      const newMembers = members.filter((_, i) => i !== index);
      setMembers(newMembers);
      // Adjust threshold if needed
      if (threshold > newMembers.length) {
        setThreshold(newMembers.length);
      }
    }
  };

  const updateMember = (index: number, field: keyof Member, value: string | boolean) => {
    const newMembers = [...members];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setMembers(newMembers);
  };

  const handleCreate = async () => {
    setError('');
    setSuccess(null);

    // Validate members
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      if (!member.address) {
        setError(`Member ${i + 1}: Address is required`);
        return;
      }
      try {
        new PublicKey(member.address);
      } catch {
        setError(`Member ${i + 1}: Invalid Solana address`);
        return;
      }
      if (!member.initiate && !member.vote && !member.execute) {
        setError(`Member ${i + 1}: Must have at least one permission`);
        return;
      }
    }

    // Check for duplicates
    const addresses = members.map((m) => m.address);
    const uniqueAddresses = new Set(addresses);
    if (uniqueAddresses.size !== addresses.length) {
      setError('Duplicate member addresses are not allowed');
      return;
    }

    // Validate threshold
    const votersCount = members.filter((m) => m.vote).length;
    if (threshold > votersCount) {
      setError(`Threshold (${threshold}) cannot exceed number of voters (${votersCount})`);
      return;
    }

    if (!password) {
      setError('Please enter your password to sign the transaction');
      return;
    }

    setLoading(true);
    try {
      // Verify password
      const kp = await loadWallet(password);
      if (!kp) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      // Build member list with permissions
      const membersList = members.map((m) => ({
        publicKey: new PublicKey(m.address),
        permissions:
          m.initiate && m.vote && m.execute
            ? getAllPermissions()
            : createPermissions(m.initiate, m.vote, m.execute),
      }));

      // Create the multisig
      const result = await createMultisigVault(
        connection,
        kp,
        membersList,
        threshold,
        0 // No time-lock
      );

      // Save to local storage
      saveMultisigAddress(
        keypair.publicKey.toBase58(),
        result.multisigPda.toBase58(),
        '' // We don't need to store createKey since it's derived
      );

      setSuccess({
        multisigPda: result.multisigPda.toBase58(),
        vaultPda: result.vaultPda.toBase58(),
        signature: result.signature,
      });

      setPassword('');
    } catch (e) {
      console.error('Failed to create vault:', e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="success-message">
        <div className="success-icon">✓</div>
        <h3>Vault Created Successfully!</h3>
        <div className="success-details">
          <div className="detail-row">
            <span className="detail-label">Multisig Address:</span>
            <span className="detail-value" title={success.multisigPda}>
              {success.multisigPda.slice(0, 8)}...{success.multisigPda.slice(-8)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Vault Address:</span>
            <span className="detail-value" title={success.vaultPda}>
              {success.vaultPda.slice(0, 8)}...{success.vaultPda.slice(-8)}
            </span>
          </div>
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
          onClick={() => onVaultCreated(success.multisigPda)}
          style={{ marginTop: '1rem' }}
        >
          View Vault
        </button>
      </div>
    );
  }

  return (
    <div className="create-vault">
      <h2>Create New Multisig Vault</h2>
      <p className="subtitle">
        Set up a multi-signature vault that requires multiple approvals for transactions.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="form">
        {/* Members Section */}
        <div className="members-section">
          <div className="section-header">
            <h3>Members</h3>
            <button type="button" className="add-btn" onClick={addMember}>
              + Add Member
            </button>
          </div>

          {members.map((member, index) => (
            <div key={index} className="member-card">
              <div className="member-header">
                <span className="member-number">Member {index + 1}</span>
                {members.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeMember(index)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="Solana address"
                value={member.address}
                onChange={(e) => updateMember(index, 'address', e.target.value)}
                disabled={index === 0} // First member is always the creator
              />

              <div className="permissions">
                <label className="permission-label">
                  <input
                    type="checkbox"
                    checked={member.initiate}
                    onChange={(e) => updateMember(index, 'initiate', e.target.checked)}
                  />
                  <span>Propose</span>
                </label>
                <label className="permission-label">
                  <input
                    type="checkbox"
                    checked={member.vote}
                    onChange={(e) => updateMember(index, 'vote', e.target.checked)}
                  />
                  <span>Vote</span>
                </label>
                <label className="permission-label">
                  <input
                    type="checkbox"
                    checked={member.execute}
                    onChange={(e) => updateMember(index, 'execute', e.target.checked)}
                  />
                  <span>Execute</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Threshold Section */}
        <div className="threshold-section">
          <h3>Approval Threshold</h3>
          <p className="threshold-description">
            Number of approvals required to execute transactions
          </p>
          <div className="threshold-input">
            <input
              type="number"
              min={1}
              max={members.filter((m) => m.vote).length}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <span className="threshold-label">
              of {members.filter((m) => m.vote).length} voter{members.filter((m) => m.vote).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Password and Submit */}
        <div className="submit-section">
          <input
            type="password"
            placeholder="Enter password to sign"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? 'Creating Vault...' : 'Create Vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
