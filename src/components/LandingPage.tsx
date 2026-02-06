import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="container">
      <div className="card landing-card">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>Solana Wallet</h1>
        <p className="subtitle">
          Manage your Solana assets and participate in multisig vaults
        </p>

        <div className="landing-options">
          <div className="option-card" onClick={() => navigate('/wallet')}>
            <div className="option-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M3 9H21" stroke="currentColor" strokeWidth="2" />
                <circle cx="17" cy="14" r="2" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h3>Built-in Wallet</h3>
            <p>Create or unlock a password-protected wallet stored in your browser</p>
            <span className="option-action">Get Started</span>
          </div>

          <div className="option-card" onClick={() => navigate('/connect')}>
            <div className="option-icon phantom">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Connect Wallet</h3>
            <p>Use Phantom, Solflare, or other wallets for multisig participation</p>
            <span className="option-action">Connect</span>
          </div>
        </div>

        <p className="landing-hint">
          Received a multisig approval link? Choose "Connect Wallet" to sign with your existing wallet.
        </p>
      </div>
    </div>
  );
}
