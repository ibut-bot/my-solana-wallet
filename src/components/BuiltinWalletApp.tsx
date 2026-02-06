import { useState, useEffect, useCallback } from 'react';
import { Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram, sendAndConfirmTransaction, Connection, TransactionInstruction } from '@solana/web3.js';
import {
  generateKeypair,
  saveWallet,
  loadWallet,
  walletExists,
  deleteWallet,
  formatPublicKey,
  secretKeyToBase58,
} from '../utils/wallet';
import MultisigView from './MultisigView';

type View = 'loading' | 'create' | 'unlock' | 'wallet';
type Tab = 'balance' | 'send' | 'keys';
type Page = 'wallet' | 'multisig';

interface TokenBalance {
  mint: string;
  mintShort: string;
  symbol: string;
  name: string;
  logoURI?: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  logoURI?: string;
  decimals: number;
}

// Common tokens fallback list
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; logoURI?: string }> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', logoURI: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I' },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', logoURI: 'https://static.jup.ag/jup/icon.png' },
  'So11111111111111111111111111111111111111112': { symbol: 'wSOL', name: 'Wrapped SOL', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade Staked SOL', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png' },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'ETH', name: 'Wrapped Ether (Wormhole)', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png' },
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': { symbol: 'stSOL', name: 'Lido Staked SOL', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj/logo.png' },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': { symbol: 'PYTH', name: 'Pyth Network', logoURI: 'https://pyth.network/token.svg' },
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RENDER', name: 'Render Token', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png' },
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux': { symbol: 'HNT', name: 'Helium', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux/logo.png' },
  'WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk': { symbol: 'WEN', name: 'Wen', logoURI: 'https://shdw-drive.genesysgo.net/GwJapVHVvfM4Mw4sWszkzywncUWuxxPd6s9VuFfXRgie/wen_logo.png' },
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': { symbol: 'JTO', name: 'Jito', logoURI: 'https://metadata.jito.network/token/jto/image' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', name: 'dogwifhat', logoURI: 'https://bafkreibk3covs5ltyqxa272uodhber3ylcn4dtb6e5i6m4tyww6wsqjxta.ipfs.nftstorage.link' },
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5': { symbol: 'MEW', name: 'cat in a dogs world', logoURI: 'https://bafkreidlwyr565dxtao2ipsze6bmzpszqzybz7sqi2zaet5fs7k53henju.ipfs.nftstorage.link/' },
  'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7': { symbol: 'DRIFT', name: 'Drift', logoURI: 'https://drift-public.s3.eu-central-1.amazonaws.com/DRIFT.png' },
  'TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6': { symbol: 'TNSR', name: 'Tensor', logoURI: 'https://arweave.net/gMgC3cE4xNdzmdr7rEsaKT4xAL5GVVfcqBWoxLDE8Mg' },
  'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS': { symbol: 'KMNO', name: 'Kamino', logoURI: 'https://cdn.kamino.finance/kamino-logo.png' },
  'SAMUmDpEKqXDJDJ9gYs2t1f6Ck2VmTJJWRTKJjxcrFH': { symbol: 'SAMO', name: 'Samoyedcoin' },
  'RaydiumvonXitrqWHUCgdBqDGzNdSMVdUKm9dUuFzrap': { symbol: 'RAY', name: 'Raydium', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png' },
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': { symbol: 'RAY', name: 'Raydium', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png' },
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': { symbol: 'ORCA', name: 'Orca', logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png' },
};

// Jupiter token list cache
let jupiterTokens: Map<string, JupiterToken> | null = null;

async function fetchJupiterTokenList(): Promise<Map<string, JupiterToken>> {
  if (jupiterTokens) return jupiterTokens;
  
  // Start with known tokens as fallback
  jupiterTokens = new Map(
    Object.entries(KNOWN_TOKENS).map(([address, token]) => [
      address,
      { address, ...token, decimals: 0 }
    ])
  );
  
  try {
    // Try fetching verified tokens from Jupiter API V2
    const response = await fetch('https://api.jup.ag/tokens/v2/tag?query=verified');
    
    if (response.ok) {
      const tokens: JupiterToken[] = await response.json();
      jupiterTokens = new Map(tokens.map(t => [t.address, t]));
      console.log(`Loaded ${tokens.length} tokens from Jupiter API`);
    }
  } catch (e) {
    console.warn('Using fallback token list:', e);
  }
  
  return jupiterTokens;
}

interface WalletBalance {
  solBalance: number;
  solBalanceLamports: number;
  tokens: TokenBalance[];
}

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=1b7eba7f-f6ed-4bf8-ae30-cdfdd3f22fb1';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export function getConnection(): Connection {
  return new Connection(RPC_URL, 'confirmed');
}

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// Get associated token address
async function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

// Create associated token account instruction
function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

// Create token transfer instruction
function createTokenTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0); // Transfer instruction
  data.writeBigUInt64LE(amount, 1);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

export default function BuiltinWalletApp() {
  const [view, setView] = useState<View>('loading');
  const [page, setPage] = useState<Page>('wallet');
  const [activeTab, setActiveTab] = useState<Tab>('balance');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'public' | 'secret' | null>(null);

  // Balance state
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Send state
  const [sendType, setSendType] = useState<'sol' | 'token'>('sol');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMint, setSendMint] = useState('');
  const [sendPassword, setSendPassword] = useState('');
  const [sendSuccess, setSendSuccess] = useState<{ txHash: string; explorerUrl: string } | null>(null);

  useEffect(() => {
    if (walletExists()) {
      setView('unlock');
    } else {
      setView('create');
    }
  }, []);

  const fetchBalance = useCallback(async (publicKeyStr: string) => {
    setBalanceLoading(true);
    try {
      const connection = getConnection();
      const pubKey = new PublicKey(publicKeyStr);

      // Fetch Jupiter token list for metadata
      const tokenList = await fetchJupiterTokenList();

      // Get SOL balance
      const solBalanceLamports = await connection.getBalance(pubKey);
      const solBalance = solBalanceLamports / LAMPORTS_PER_SOL;

      // Get SPL token accounts using getParsedTokenAccountsByOwner
      let tokens: TokenBalance[] = [];
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubKey, {
          programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });

        tokens = tokenAccounts.value
          .map((account) => {
            const parsed = account.account.data.parsed;
            const info = parsed.info;
            const mint = info.mint;
            const jupToken = tokenList.get(mint);
            
            return {
              mint,
              mintShort: formatAddress(mint),
              symbol: jupToken?.symbol || formatAddress(mint),
              name: jupToken?.name || 'Unknown Token',
              logoURI: jupToken?.logoURI,
              amount: info.tokenAmount.amount,
              decimals: info.tokenAmount.decimals,
              uiAmount: info.tokenAmount.uiAmount || 0,
            };
          })
          .filter((token) => token.uiAmount > 0);
      } catch (e) {
        console.error('Failed to fetch tokens:', e);
      }

      setBalance({ solBalance, solBalanceLamports, tokens });
    } catch (e) {
      console.error('Failed to fetch balance:', e);
      setBalance({ solBalance: 0, solBalanceLamports: 0, tokens: [] });
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  // Fetch balance when wallet is unlocked
  useEffect(() => {
    if (keypair && view === 'wallet') {
      fetchBalance(keypair.publicKey.toBase58());
    }
  }, [keypair, view, fetchBalance]);

  const handleCreateWallet = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const newKeypair = generateKeypair();
      await saveWallet(newKeypair, password);
      setKeypair(newKeypair);
      setView('wallet');
      setPassword('');
      setConfirmPassword('');
    } catch (e) {
      setError('Failed to create wallet: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockWallet = async () => {
    setError('');
    setLoading(true);
    try {
      const loadedKeypair = await loadWallet(password);
      if (loadedKeypair) {
        setKeypair(loadedKeypair);
        setView('wallet');
        setPassword('');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    setKeypair(null);
    setShowSecret(false);
    setBalance(null);
    setSendSuccess(null);
    setView('unlock');
  };

  const handleDeleteWallet = () => {
    if (confirm('Are you sure you want to delete this wallet? This cannot be undone.')) {
      deleteWallet();
      setKeypair(null);
      setShowSecret(false);
      setBalance(null);
      setView('create');
    }
  };

  const handleSend = async () => {
    setError('');
    setSendSuccess(null);

    if (!sendTo || !sendAmount) {
      setError('Please fill in all fields');
      return;
    }

    if (sendType === 'token' && !sendMint) {
      setError('Please enter the token mint address');
      return;
    }

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid amount');
      return;
    }

    if (!sendPassword) {
      setError('Please enter your password to sign the transaction');
      return;
    }

    setLoading(true);
    try {
      // Verify password by loading wallet
      const kp = await loadWallet(sendPassword);
      if (!kp) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      const connection = getConnection();
      const toPublicKey = new PublicKey(sendTo);

      let txHash: string;

      if (sendType === 'sol') {
        // SOL transfer
        const lamportsToSend = Math.round(amount * LAMPORTS_PER_SOL);
        const currentBalance = await connection.getBalance(kp.publicKey);
        const estimatedFee = 5000;
        
        if (currentBalance < lamportsToSend + estimatedFee) {
          setError(`Insufficient balance. Available: ${currentBalance / LAMPORTS_PER_SOL} SOL`);
          setLoading(false);
          return;
        }

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: kp.publicKey,
            toPubkey: toPublicKey,
            lamports: lamportsToSend,
          })
        );

        txHash = await sendAndConfirmTransaction(connection, transaction, [kp]);
      } else {
        // Token transfer
        const mintPublicKey = new PublicKey(sendMint);
        
        // Get source token account
        const sourceTokenAccount = await getAssociatedTokenAddress(mintPublicKey, kp.publicKey);
        
        // Check source account exists and get balance
        const sourceAccountInfo = await connection.getParsedAccountInfo(sourceTokenAccount);
        if (!sourceAccountInfo.value) {
          setError("You don't have a token account for this mint");
          setLoading(false);
          return;
        }

        const tokenData = (sourceAccountInfo.value.data as any).parsed.info;
        const decimals = tokenData.tokenAmount.decimals;
        const tokenBalance = tokenData.tokenAmount.uiAmount;
        
        if (amount > tokenBalance) {
          setError(`Insufficient token balance. Available: ${tokenBalance}`);
          setLoading(false);
          return;
        }

        const rawAmount = BigInt(Math.round(amount * Math.pow(10, decimals)));

        // Get destination token account
        const destinationTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);

        const transaction = new Transaction();

        // Check if destination token account exists
        const destAccountInfo = await connection.getAccountInfo(destinationTokenAccount);
        if (!destAccountInfo) {
          // Create associated token account for recipient
          transaction.add(
            createAssociatedTokenAccountInstruction(
              kp.publicKey,
              destinationTokenAccount,
              toPublicKey,
              mintPublicKey
            )
          );
        }

        // Add transfer instruction
        transaction.add(
          createTokenTransferInstruction(
            sourceTokenAccount,
            destinationTokenAccount,
            kp.publicKey,
            rawAmount
          )
        );

        txHash = await sendAndConfirmTransaction(connection, transaction, [kp]);
      }

      setSendSuccess({
        txHash,
        explorerUrl: `https://solscan.io/tx/${txHash}`,
      });
      setSendTo('');
      setSendAmount('');
      setSendMint('');
      setSendPassword('');

      // Refresh balance
      await fetchBalance(kp.publicKey.toBase58());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectToken = (token: TokenBalance) => {
    setSendType('token');
    setSendMint(token.mint);
    setActiveTab('send');
  };

  const copyToClipboard = async (text: string, type: 'public' | 'secret') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (view === 'loading') {
    return (
      <div className="container">
        <div className="card">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21Z" stroke="currentColor" strokeWidth="2" />
              <path d="M7 7H17M7 12H17M7 17H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1>Create Wallet</h1>
          <p className="subtitle">Create a new Solana wallet secured with a password</p>

          {error && <div className="error">{error}</div>}

          <div className="form">
            <input
              type="password"
              placeholder="Enter password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWallet()}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWallet()}
            />
            <button onClick={handleCreateWallet} disabled={loading} className="primary">
              {loading ? 'Creating...' : 'Create Wallet'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'unlock') {
    return (
      <div className="container">
        <div className="card">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1>Unlock Wallet</h1>
          <p className="subtitle">Enter your password to access your wallet</p>

          {error && <div className="error">{error}</div>}

          <div className="form">
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlockWallet()}
              autoFocus
            />
            <button onClick={handleUnlockWallet} disabled={loading} className="primary">
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
          </div>

          <button className="text-button danger" onClick={handleDeleteWallet}>
            Delete Wallet
          </button>
        </div>
      </div>
    );
  }

  if (view === 'wallet' && keypair) {
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = secretKeyToBase58(keypair.secretKey);

    // Render multisig page
    if (page === 'multisig') {
      return (
        <div className="container">
          {/* Top Navigation */}
          <div className="top-nav">
            <button 
              className="nav-btn" 
              onClick={() => setPage('wallet')}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M3 9H21" stroke="currentColor" strokeWidth="2" />
              </svg>
              Wallet
            </button>
            <button 
              className="nav-btn active" 
              onClick={() => setPage('multisig')}
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <circle cx="5" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
                <circle cx="19" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M12 12V15M12 15L5 18M12 15L19 18" stroke="currentColor" strokeWidth="2" />
              </svg>
              Multisig
            </button>
            <button className="icon-button nav-lock" onClick={handleLock} title="Lock wallet">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <MultisigView 
            keypair={keypair} 
            connection={getConnection()}
            loadWallet={loadWallet}
          />
        </div>
      );
    }

    return (
      <div className="container">
        {/* Top Navigation */}
        <div className="top-nav">
          <button 
            className="nav-btn active" 
            onClick={() => setPage('wallet')}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M3 9H21" stroke="currentColor" strokeWidth="2" />
            </svg>
            Wallet
          </button>
          <button 
            className="nav-btn" 
            onClick={() => setPage('multisig')}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="5" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
              <circle cx="19" cy="18" r="3" stroke="currentColor" strokeWidth="2" />
              <path d="M12 12V15M12 15L5 18M12 15L19 18" stroke="currentColor" strokeWidth="2" />
            </svg>
            Multisig
          </button>
          <button className="icon-button nav-lock" onClick={handleLock} title="Lock wallet">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="card wallet-card">
          <div className="wallet-header">
            <h1>My Wallet</h1>
          </div>

          {/* Address display */}
          <div className="address-bar">
            <span className="address" title={publicKey}>{formatPublicKey(publicKey)}</span>
            <button className="copy-btn" onClick={() => copyToClipboard(publicKey, 'public')}>
              {copied === 'public' ? '✓' : 'Copy'}
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${activeTab === 'balance' ? 'active' : ''}`} onClick={() => setActiveTab('balance')}>
              Balance
            </button>
            <button className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>
              Send
            </button>
            <button className={`tab ${activeTab === 'keys' ? 'active' : ''}`} onClick={() => setActiveTab('keys')}>
              Keys
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {/* Balance Tab */}
          {activeTab === 'balance' && (
            <div className="tab-content">
              <div className="balance-header">
                <h2>Balances</h2>
                <button className="refresh-btn" onClick={() => fetchBalance(publicKey)} disabled={balanceLoading}>
                  {balanceLoading ? '...' : '↻'}
                </button>
              </div>

              {balanceLoading && !balance ? (
                <div className="loading-state">Loading balances...</div>
              ) : balance ? (
                <>
                  <div className="balance-card sol">
                    <div className="balance-info">
                      <span className="token-name">SOL</span>
                      <span className="token-amount">{balance.solBalance.toFixed(4)}</span>
                    </div>
                    <button className="send-btn" onClick={() => setActiveTab('send')}>
                      Send
                    </button>
                  </div>

                  {balance.tokens.length > 0 ? (
                    <div className="token-list">
                      <h3>Tokens</h3>
                      {balance.tokens.map((token) => (
                        <div key={token.mint} className="balance-card token">
                          <div className="token-icon-info">
                            {token.logoURI && (
                              <img src={token.logoURI} alt={token.symbol} className="token-logo" />
                            )}
                            <div className="balance-info">
                              <span className="token-symbol" title={token.name}>{token.symbol}</span>
                              <span className="token-amount">{token.uiAmount.toLocaleString()}</span>
                            </div>
                          </div>
                          <button className="send-btn" onClick={() => selectToken(token)}>
                            Send
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-tokens">No SPL tokens found</p>
                  )}
                </>
              ) : (
                <div className="loading-state">Unable to load balance</div>
              )}
            </div>
          )}

          {/* Send Tab */}
          {activeTab === 'send' && (
            <div className="tab-content">
              <h2>Send {sendType === 'sol' ? 'SOL' : 'Token'}</h2>

              {sendSuccess ? (
                <div className="success-message">
                  <div className="success-icon">✓</div>
                  <p>Transaction successful!</p>
                  <a href={sendSuccess.explorerUrl} target="_blank" rel="noopener noreferrer" className="tx-link">
                    View on Solscan
                  </a>
                  <button className="primary" onClick={() => setSendSuccess(null)} style={{ marginTop: '1rem' }}>
                    Send Another
                  </button>
                </div>
              ) : (
                <div className="form">
                  <div className="toggle-group">
                    <button 
                      className={`toggle ${sendType === 'sol' ? 'active' : ''}`} 
                      onClick={() => { setSendType('sol'); setSendMint(''); }}
                    >
                      SOL
                    </button>
                    <button 
                      className={`toggle ${sendType === 'token' ? 'active' : ''}`} 
                      onClick={() => setSendType('token')}
                      disabled={!balance || balance.tokens.length === 0}
                    >
                      Token
                    </button>
                  </div>

                  {sendType === 'token' && (
                    <div className="select-wrapper">
                      <select
                        value={sendMint}
                        onChange={(e) => setSendMint(e.target.value)}
                        className="token-select"
                      >
                        <option value="">Select a token</option>
                        {balance?.tokens.map((token) => (
                          <option key={token.mint} value={token.mint}>
                            {token.symbol} - {token.uiAmount.toLocaleString()} available
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Recipient address"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                  />

                  <input
                    type="number"
                    placeholder={sendType === 'sol' ? 'Amount (SOL)' : 'Amount'}
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                    step="any"
                    min="0"
                  />

                  <input
                    type="password"
                    placeholder="Enter password to sign"
                    value={sendPassword}
                    onChange={(e) => setSendPassword(e.target.value)}
                  />

                  <button onClick={handleSend} disabled={loading} className="primary">
                    {loading ? 'Sending...' : `Send ${sendType === 'sol' ? 'SOL' : 'Token'}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Keys Tab */}
          {activeTab === 'keys' && (
            <div className="tab-content">
              <div className="key-section">
                <label>Public Address</label>
                <div className="key-display">
                  <span className="key-value" title={publicKey}>{formatPublicKey(publicKey)}</span>
                  <button className="copy-button" onClick={() => copyToClipboard(publicKey, 'public')} title="Copy">
                    {copied === 'public' ? '✓' : '⧉'}
                  </button>
                </div>
              </div>

              <div className="key-section">
                <div className="label-row">
                  <label>Secret Key</label>
                  <button className="text-button small" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div className="key-display secret">
                  {showSecret ? (
                    <>
                      <span className="key-value secret-key">{secretKey}</span>
                      <button className="copy-button" onClick={() => copyToClipboard(secretKey, 'secret')} title="Copy">
                        {copied === 'secret' ? '✓' : '⧉'}
                      </button>
                    </>
                  ) : (
                    <span className="key-value masked">••••••••••••••••••••••••</span>
                  )}
                </div>
                <p className="warning">
                  Never share your secret key. Anyone with it can access your funds.
                </p>
              </div>

              <button className="text-button danger" onClick={handleDeleteWallet}>
                Delete Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
