import { Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import BuiltinWalletApp from './components/BuiltinWalletApp';
import WalletProvider from './components/WalletProvider';
import ExternalDashboard from './components/external/ExternalDashboard';
import ExternalVaultDetail from './components/external/ExternalVaultDetail';
import './App.css';

function App() {
  return (
    <Routes>
      {/* Landing page - choose wallet type */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Built-in wallet path */}
      <Route path="/wallet" element={<BuiltinWalletApp />} />
      
      {/* External wallet paths - wrapped in WalletProvider */}
      <Route
        path="/connect"
        element={
          <WalletProvider>
            <ExternalDashboard />
          </WalletProvider>
        }
      />
      <Route
        path="/vault/:multisigPda"
        element={
          <WalletProvider>
            <ExternalVaultDetail />
          </WalletProvider>
        }
      />
      <Route
        path="/vault/:multisigPda/proposal/:proposalIndex"
        element={
          <WalletProvider>
            <ExternalVaultDetail />
          </WalletProvider>
        }
      />
    </Routes>
  );
}

export default App;
