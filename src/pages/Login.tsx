import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos.');
      } else if (code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else if (code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde e tente novamente.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Email de redefinição enviado! Verifique sua caixa de entrada.');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        setResetError('Email não encontrado ou inválido.');
      } else if (code === 'auth/too-many-requests') {
        setResetError('Muitas tentativas. Aguarde e tente novamente.');
      } else {
        setResetError('Erro ao enviar email. Tente novamente.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-sm p-8 border border-border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">Gestao de Assinaturas</h1>
          <p className="text-sm text-gray-500 mt-1">Faça login para acessar</p>
        </div>

        {!showForgotPassword ? (
          <>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Digite seu email"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white rounded-lg py-2 font-medium hover:bg-accent-hover transition-colors disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setResetEmail(email); setResetMessage(''); setResetError(''); }}
                className="text-sm text-accent hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={(e) => void handlePasswordReset(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email para redefinição</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => { setResetEmail(e.target.value); setResetError(''); setResetMessage(''); }}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Digite seu email"
                  autoComplete="email"
                  required
                />
              </div>

              {resetError && (
                <p className="text-red-500 text-sm">{resetError}</p>
              )}
              {resetMessage && (
                <p className="text-green-500 text-sm">{resetMessage}</p>
              )}

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-accent text-white rounded-lg py-2 font-medium hover:bg-accent-hover transition-colors disabled:opacity-60"
              >
                {resetLoading ? 'Enviando...' : 'Enviar email de redefinição'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setResetMessage(''); setResetError(''); }}
                className="text-sm text-accent hover:underline"
              >
                Voltar ao login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
