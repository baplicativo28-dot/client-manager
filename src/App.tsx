import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { Login } from './pages/Login';
import { ResellersPage } from './pages/Resellers';

function BlockedScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.73-3L13.73 4a2 2 0 00-3.46 0L3.27 16A2 2 0 005.07 19z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Conta Bloqueada</h2>
        <p className="text-gray-500 text-sm mb-6">
          Sua conta foi temporariamente bloqueada. Entre em contato com o administrador para regularizar o acesso.
        </p>
        <button
          onClick={() => void onLogout()}
          className="w-full border border-red-200 text-red-600 rounded-lg py-2 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, logout, isAdmin, isBlocked } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-500 text-sm">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (isBlocked) {
    return <BlockedScreen onLogout={logout} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard uid={user.uid} onLogout={logout} isAdmin={isAdmin} />} />
        <Route path="/configuracoes" element={<SettingsPage uid={user.uid} onLogout={logout} />} />
        <Route
          path="/revendedores"
          element={
            isAdmin
              ? <ResellersPage adminUid={user.uid} onLogout={logout} />
              : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
