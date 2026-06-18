import { useState } from 'react';
import { useResellers } from '../hooks/useResellers';

interface ResellersPageProps {
  adminUid: string;
  onLogout: () => void;
}

export function ResellersPage({ adminUid, onLogout }: ResellersPageProps) {
  const { resellers, loading, createReseller, toggleBlock, deleteReseller, sendPasswordReset } =
    useResellers(adminUid);

  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  // Delete state
  const [confirmDeleteReseller, setConfirmDeleteReseller] = useState<{ uid: string; email: string } | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  // Reset password state
  const [resettingUid, setResettingUid] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCreate = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha email e senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await createReseller(email.trim(), password);
      setEmail('');
      setPassword('');
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        setError('Este email já está cadastrado no sistema.');
      } else {
        setError(`Erro ao criar revendedor: ${msg}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleBlock = async (uid: string, currentBlocked: boolean) => {
    const action = currentBlocked ? 'desbloquear' : 'bloquear';
    if (!window.confirm(`Deseja ${action} este revendedor?`)) return;
    setTogglingUid(uid);
    try {
      await toggleBlock(uid, !currentBlocked);
    } finally {
      setTogglingUid(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteReseller) return;
    setDeletingUid(confirmDeleteReseller.uid);
    setConfirmDeleteReseller(null);
    try {
      await deleteReseller(confirmDeleteReseller.uid);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResetFeedback({ type: 'error', message: `Erro ao deletar: ${msg}` });
    } finally {
      setDeletingUid(null);
    }
  };

  const handlePasswordReset = async (uid: string, resellerEmail: string) => {
    setResettingUid(uid);
    setResetFeedback(null);
    try {
      await sendPasswordReset(resellerEmail);
      setResetFeedback({
        type: 'success',
        message: `Email de redefinição de senha enviado para ${resellerEmail}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResetFeedback({ type: 'error', message: `Erro ao enviar email: ${msg}` });
    } finally {
      setResettingUid(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold mb-4 sm:mb-0">Revendedores</h1>
        <div className="flex gap-3">
          <a
            href="/"
            className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Voltar
          </a>
          <button
            onClick={() => void onLogout()}
            className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Sair
          </button>
          <button
            onClick={() => { setModalOpen(true); setError(''); }}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            + Novo Revendedor
          </button>
        </div>
      </div>

      {/* Reset feedback toast */}
      {resetFeedback && (
        <div
          className={`mb-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm ${
            resetFeedback.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{resetFeedback.message}</span>
          <button
            onClick={() => setResetFeedback(null)}
            className="ml-4 text-current opacity-60 hover:opacity-100 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-bold">{resellers.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Ativos</p>
          <p className="text-2xl font-bold text-green-600">
            {resellers.filter((r) => !r.blocked).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Bloqueados</p>
          <p className="text-2xl font-bold text-red-600">
            {resellers.filter((r) => r.blocked).length}
          </p>
        </div>
      </div>

      {/* Table (desktop) */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Carregando...</div>
      ) : resellers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">Nenhum revendedor cadastrado.</p>
          <button
            onClick={() => { setModalOpen(true); setError(''); }}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Criar primeiro revendedor
          </button>
        </div>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Criado em</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((r) => (
                  <tr key={r.uid} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">{r.email}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      {r.blocked ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Block/Unblock */}
                        <button
                          disabled={togglingUid === r.uid}
                          onClick={() => void handleToggleBlock(r.uid, r.blocked)}
                          className={`text-xs px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50 ${
                            r.blocked
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {togglingUid === r.uid ? '...' : r.blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                        {/* Reset Password */}
                        <button
                          disabled={resettingUid === r.uid}
                          onClick={() => void handlePasswordReset(r.uid, r.email)}
                          className="text-xs px-3 py-1.5 rounded font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                        >
                          {resettingUid === r.uid ? '...' : 'Resetar Senha'}
                        </button>
                        {/* Delete */}
                        <button
                          disabled={deletingUid === r.uid}
                          onClick={() => setConfirmDeleteReseller({ uid: r.uid, email: r.email })}
                          className="text-xs px-3 py-1.5 rounded font-medium bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50"
                        >
                          {deletingUid === r.uid ? '...' : 'Deletar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {resellers.map((r) => (
              <div key={r.uid} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-sm">{r.email}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Criado: {formatDate(r.createdAt)}</p>
                  </div>
                  {r.blocked ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Bloqueado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Ativo
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={togglingUid === r.uid}
                    onClick={() => void handleToggleBlock(r.uid, r.blocked)}
                    className={`text-sm py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                      r.blocked
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {togglingUid === r.uid ? '...' : r.blocked ? 'Desbloquear' : 'Bloquear'}
                  </button>
                  <button
                    disabled={resettingUid === r.uid}
                    onClick={() => void handlePasswordReset(r.uid, r.email)}
                    className="text-sm py-2 rounded-lg font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors disabled:opacity-50"
                  >
                    {resettingUid === r.uid ? '...' : 'Resetar Senha'}
                  </button>
                  <button
                    disabled={deletingUid === r.uid}
                    onClick={() => setConfirmDeleteReseller({ uid: r.uid, email: r.email })}
                    className="text-sm py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    {deletingUid === r.uid ? '...' : 'Deletar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Reseller Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Novo Revendedor</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={creating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={creating}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setModalOpen(false); setEmail(''); setPassword(''); setError(''); }}
                  disabled={creating}
                  className="flex-1 border border-border rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="flex-1 bg-accent text-white rounded-lg py-2 text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Revendedor'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteReseller && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Confirmar exclusão</h3>
              <p className="text-sm text-gray-600 mb-2">
                Tem certeza que deseja deletar o revendedor:
              </p>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-3 py-2 mb-4 break-all">
                {confirmDeleteReseller.email}
              </p>
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-6">
                Esta acao ira remover todos os dados do revendedor (perfil, clientes e
                configuracoes) do Firestore. O acesso ao app sera encerrado imediatamente.
                Esta acao nao pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteReseller(null)}
                  className="flex-1 border border-border rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleDeleteConfirm()}
                  className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  Deletar permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
