import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useClients } from '../hooks/useClients';
import { useAuth } from '../contexts/AuthContext';
import type { ServerCost, Client } from '../types';
import { generateId } from '../utils/storage';
import { saveAllClientsToFirestore, saveSettingsToFirestore, deleteAllClientsFromFirestore } from '../utils/firestoreUtils';
import { exportBackup, importBackup, exportClientsToCSV } from '../utils/backup';

interface SettingsPageProps {
  uid: string;
  onLogout: () => void;
}

export function SettingsPage({ uid, onLogout }: SettingsPageProps) {
  const { settings, loading, updateSettings } = useSettings(uid);
  const { clients } = useClients(uid);
  const { user } = useAuth();
  const [template, setTemplate] = useState(settings.whatsappTemplate);
  const [templateConfianca, setTemplateConfianca] = useState(settings.whatsappTemplateConfianca);
  const [templateExpirado, setTemplateExpirado] = useState(settings.whatsappTemplateExpirado);
  const [templateExpirado1Dia, setTemplateExpirado1Dia] = useState(settings.whatsappTemplateExpirado1Dia);
  const [chavePix, setChavePix] = useState(settings.defaultChavePix);
  const [banco, setBanco] = useState(settings.defaultBanco);
  const [beneficiario, setBeneficiario] = useState(settings.defaultBeneficiario);
  const [servidores, setServidores] = useState<ServerCost[]>(settings.servidores);
  const [novoServidor, setNovoServidor] = useState({ nome: '', custo: '' });
  const [saved, setSaved] = useState(false);
  const [csvServidor, setCsvServidor] = useState('');
  const [csvSituacao, setCsvSituacao] = useState<'Assinou' | 'Renovou' | 'Não Renovou' | 'Inadimplente'>('Assinou');
  const [csvMessage, setCsvMessage] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  const [deleteAllFeedback, setDeleteAllFeedback] = useState('');
  const [csvEmailFeedback, setCsvEmailFeedback] = useState('');
  const [skipActionConfirmUntil, setSkipActionConfirmUntil] = useState<string | null>(
    localStorage.getItem('cm_skip_action_confirm_until')
  );
  const skipActionConfirmEnabled =
    !!skipActionConfirmUntil && Date.now() < Number(skipActionConfirmUntil);

  const [whatsappServerUrl, setWhatsappServerUrl] = useState(settings.whatsappServerUrl ?? '');
  const [whatsappServerKey, setWhatsappServerKey] = useState(settings.whatsappServerKey ?? '');
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'qr' | 'connected'>('disconnected');
  const [waQR, setWaQR] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState('');
  const waPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync local state once when Firestore finishes loading.
  useEffect(() => {
    if (!loading && !initialized) {
      setTemplate(settings.whatsappTemplate);
      setTemplateConfianca(settings.whatsappTemplateConfianca);
      setTemplateExpirado(settings.whatsappTemplateExpirado);
      setTemplateExpirado1Dia(settings.whatsappTemplateExpirado1Dia);
      setChavePix(settings.defaultChavePix);
      setBanco(settings.defaultBanco);
      setBeneficiario(settings.defaultBeneficiario);
      setServidores(settings.servidores);
      setWhatsappServerUrl(settings.whatsappServerUrl ?? '');
      setWhatsappServerKey(settings.whatsappServerKey ?? '');
      setInitialized(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const interval = setInterval(() => {
      const savedValue = localStorage.getItem('cm_skip_action_confirm_until');
      setSkipActionConfirmUntil(savedValue);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    // Cascade server name changes to clients
    const oldServidores = settings.servidores;
    let updatedClients = [...clients];
    let clientsUpdated = false;
    oldServidores.forEach((old) => {
      const updated = servidores.find((s) => s.id === old.id);
      if (updated && updated.nome !== old.nome) {
        updatedClients = updatedClients.map((c) => {
          if (c.servidor === old.nome) {
            clientsUpdated = true;
            return { ...c, servidor: updated.nome };
          }
          return c;
        });
      }
    });
    if (clientsUpdated) {
      await saveAllClientsToFirestore(uid, updatedClients);
    }

    updateSettings({
      whatsappTemplate: template,
      whatsappTemplateConfianca: templateConfianca,
      whatsappTemplateExpirado: templateExpirado,
      whatsappTemplateExpirado1Dia: templateExpirado1Dia,
      defaultChavePix: chavePix,
      defaultBanco: banco,
      defaultBeneficiario: beneficiario,
      servidores,
      variaveisPersonalizadas: settings.variaveisPersonalizadas,
      whatsappServerUrl,
      whatsappServerKey,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleSkipActionConfirm = () => {
    if (skipActionConfirmEnabled) {
      localStorage.removeItem('cm_skip_action_confirm_until');
      setSkipActionConfirmUntil(null);
      return;
    }

    const expiresAt = Date.now() + 5 * 60 * 1000;
    localStorage.setItem('cm_skip_action_confirm_until', String(expiresAt));
    setSkipActionConfirmUntil(String(expiresAt));
  };

  const addServidor = () => {
    if (!novoServidor.nome) return;
    const novo: ServerCost = {
      id: generateId(),
      nome: novoServidor.nome,
      custo: parseFloat(novoServidor.custo) || 0,
    };
    setServidores([...servidores, novo]);
    setNovoServidor({ nome: '', custo: '' });
  };

  const removeServidor = (id: string) => {
    setServidores(servidores.filter((s) => s.id !== id));
  };

  const handleExportBackup = () => {
    exportBackup({
      clients,
      settings: {
        ...settings,
        whatsappTemplate: template,
        whatsappTemplateConfianca: templateConfianca,
        whatsappTemplateExpirado: templateExpirado,
        defaultChavePix: chavePix,
        defaultBanco: banco,
        defaultBeneficiario: beneficiario,
        servidores,
      },
    });
  };

  const handleImportBackup = async (file: File | null) => {
    if (!file) return;
    if (!skipActionConfirmEnabled && !window.confirm('Isso substituirá todos os dados atuais. Deseja continuar?')) return;
    const data = await importBackup(file);
    await saveAllClientsToFirestore(uid, data.clients);
    await saveSettingsToFirestore(uid, data.settings);
    window.location.reload();
  };

  const handleExportCSV = () => {
    exportClientsToCSV(clients);
  };

  const handleSendCSVByEmail = async () => {
    const email = user?.email;
    if (!email) {
      setCsvEmailFeedback('Email do usuário não encontrado.');
      setTimeout(() => setCsvEmailFeedback(''), 3000);
      return;
    }

    // Generate CSV content
    const headers = ['NOME', 'valor', 'celular', 'Servidor', 'Cadastro', 'Vencimento', 'situação', 'status', 'observacao'];
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
      }
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[3]}/${match[2]}/${match[1]}`;
      return '';
    };
    const rows = clients.map((c) => [
      c.nome,
      `R$ ${c.valor.toFixed(2).replace('.', ',')}`,
      c.celular,
      c.servidor,
      formatDate(c.criadoEm),
      formatDate(c.dataVencimento),
      c.situacao,
      c.desativado ? 'Inativo' : 'Ativo',
      c.observacao || '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    // Try Web Share API first (mobile-friendly, supports files)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], `clientes-export-${new Date().toISOString().slice(0, 10)}.csv`, { type: 'text/csv' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Exportação CSV - Clientes',
          text: 'Lista de clientes exportada do Client Manager',
        });
        setCsvEmailFeedback('CSV compartilhado com sucesso!');
      } catch (err: unknown) {
        if ((err as DOMException).name !== 'AbortError') {
          // Fallback to mailto
          openMailtoCSV(email, csvContent);
        }
      }
    } else {
      // Fallback: open mailto with CSV in body
      openMailtoCSV(email, csvContent);
    }
    setTimeout(() => setCsvEmailFeedback(''), 4000);
  };

  const openMailtoCSV = (email: string, csvContent: string) => {
    const subject = encodeURIComponent('Exportação CSV - Clientes');
    const body = encodeURIComponent(`Segue a lista de clientes exportada em CSV:\n\n${csvContent}`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    setCsvEmailFeedback('Abrindo cliente de email...');
  };

  const handleDeleteAllClients = async () => {
    setDeleteAllLoading(true);
    try {
      const count = await deleteAllClientsFromFirestore(uid);
      setDeleteAllFeedback(`✓ ${count} cliente(s) deletado(s) com sucesso.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteAllFeedback(`Erro: ${msg}`);
    } finally {
      setDeleteAllLoading(false);
      setShowDeleteAllModal(false);
      setTimeout(() => setDeleteAllFeedback(''), 5000);
    }
  };

  const pollWaStatus = useCallback(async () => {
    if (!whatsappServerUrl || !whatsappServerKey) return;
    try {
      const res = await fetch(`${whatsappServerUrl.replace(/\/$/, '')}/status`, {
        headers: { apikey: whatsappServerKey },
      });
      if (!res.ok) return;
      const data = await res.json();
      setWaStatus(data.status);
      setWaQR(data.qr ?? null);
      if (data.status === 'connected' && waPollingRef.current) {
        clearInterval(waPollingRef.current);
        waPollingRef.current = null;
      }
    } catch { /* ignore */ }
  }, [whatsappServerUrl, whatsappServerKey]);

  const handleWaConnect = async () => {
    if (!whatsappServerUrl || !whatsappServerKey) {
      setWaError('Preencha a URL do servidor e a API Key primeiro e salve.');
      return;
    }
    setWaLoading(true);
    setWaError('');
    try {
      const res = await fetch(`${whatsappServerUrl.replace(/\/$/, '')}/session/start`, {
        method: 'POST',
        headers: { apikey: whatsappServerKey, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setWaStatus(data.status);
      setWaQR(data.qr ?? null);
      if (waPollingRef.current) clearInterval(waPollingRef.current);
      waPollingRef.current = setInterval(() => void pollWaStatus(), 3000);
    } catch (err: any) {
      setWaError('Erro ao conectar: ' + (err.message ?? 'verifique a URL e a API Key'));
    } finally {
      setWaLoading(false);
    }
  };

  const handleWaDisconnect = async () => {
    setWaLoading(true);
    try {
      await fetch(`${whatsappServerUrl.replace(/\/$/, '')}/session/disconnect`, {
        method: 'POST',
        headers: { apikey: whatsappServerKey },
      });
      setWaStatus('disconnected');
      setWaQR(null);
      if (waPollingRef.current) { clearInterval(waPollingRef.current); waPollingRef.current = null; }
    } catch (err: any) {
      setWaError('Erro ao desconectar: ' + err.message);
    } finally {
      setWaLoading(false);
    }
  };

  useEffect(() => {
    if (whatsappServerUrl && whatsappServerKey) void pollWaStatus();
  }, [whatsappServerUrl, whatsappServerKey, pollWaStatus]);

  useEffect(() => {
    return () => {
      if (waPollingRef.current) clearInterval(waPollingRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
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
      </div>

      <div className="mb-6 rounded-3xl border-4 border-amber-500 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 p-5 shadow-[0_12px_30px_rgba(245,158,11,0.22)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl font-black text-white shadow-lg">
              !
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-amber-950">Confirmações de Ação</h2>
              <p className="text-sm font-medium text-amber-900">
                Ative para deletar ou desativar sem confirmação por até 5 minutos.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <button
              onClick={toggleSkipActionConfirm}
              className={`rounded-2xl px-6 py-4 text-base font-black shadow-lg transition-transform hover:scale-[1.02] ${skipActionConfirmEnabled ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}`}
            >
              {skipActionConfirmEnabled ? 'Desativar modo sem confirmação' : 'Ativar por 5 minutos'}
            </button>
            {skipActionConfirmEnabled && skipActionConfirmUntil && (
              <span className="text-sm font-semibold text-green-800">
                Ativo até {new Date(Number(skipActionConfirmUntil)).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* WhatsApp Template */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-3">Modelo de Mensagem WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-3">
            Placeholders disponíveis: {'{nome}'}, {'{valor}'}, {'{vencimento}'}, {'{servidor}'}, {'{chave_pix}'}, {'{banco}'}, {'{beneficiario}'}
          </p>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
          <h3 className="text-base font-semibold mt-5 mb-3">Modelo para Renovação em Confiança</h3>
          <p className="text-sm text-gray-500 mb-3">
            Use também o placeholder {'{data_promessa}'} para a data prometida.
          </p>
          <textarea
            value={templateConfianca}
            onChange={(e) => setTemplateConfianca(e.target.value)}
            rows={5}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
          <h3 className="text-base font-semibold mt-5 mb-3">Modelo para Clientes Expirados</h3>
          <p className="text-sm text-gray-500 mb-3">
            Enviado automaticamente quando o cliente já expirou.
          </p>
          <textarea
            value={templateExpirado}
            onChange={(e) => setTemplateExpirado(e.target.value)}
            rows={5}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
          <h3 className="text-base font-semibold mt-5 mb-3">Modelo para Clientes Expirados há 1+ Dias</h3>
          <p className="text-sm text-gray-500 mb-3">
            Enviado automaticamente quando o cliente está expirado há 1 ou mais dias.
          </p>
          <textarea
            value={templateExpirado1Dia}
            onChange={(e) => setTemplateExpirado1Dia(e.target.value)}
            rows={5}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y"
          />
        </div>

        {/* Default PIX Info */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-3">Dados PIX Padrão</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Chave PIX</label>
              <input
                type="text"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Banco</label>
                <input
                  type="text"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Beneficiário</label>
                <input
                  type="text"
                  value={beneficiario}
                  onChange={(e) => setBeneficiario(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Servers */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-3">Servidores (Despesas)</h2>
          <div className="space-y-2 mb-4">
            {servidores.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <input
                  type="text"
                  value={s.nome}
                  onChange={(e) => {
                    const updated = [...servidores];
                    updated[idx] = { ...updated[idx], nome: e.target.value };
                    setServidores(updated);
                  }}
                  className="flex-1 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <input
                  type="number"
                  step="0.01"
                  value={s.custo}
                  onChange={(e) => {
                    const updated = [...servidores];
                    updated[idx] = { ...updated[idx], custo: parseFloat(e.target.value) || 0 };
                    setServidores(updated);
                  }}
                  className="w-24 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={() => removeServidor(s.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Remover
                </button>
              </div>
            ))}
            {servidores.length === 0 && (
              <p className="text-sm text-gray-400">Nenhum servidor cadastrado.</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome do servidor"
              value={novoServidor.nome}
              onChange={(e) => setNovoServidor({ ...novoServidor, nome: e.target.value })}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Custo (R$)"
              value={novoServidor.custo}
              onChange={(e) => setNovoServidor({ ...novoServidor, custo: e.target.value })}
              className="w-32 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={addServidor}
              className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-1">WhatsApp (Disparo Automatico)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Configure o servidor de WhatsApp. Apos salvar a URL e a Key, clique em "Conectar" e escaneie o QR Code que aparecera aqui no painel.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">URL do Servidor</label>
              <input
                type="url"
                placeholder="https://seu-servidor.fly.dev"
                value={whatsappServerUrl}
                onChange={(e) => setWhatsappServerUrl(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
              <input
                type="password"
                placeholder="sua-chave-secreta"
                value={whatsappServerKey}
                onChange={(e) => setWhatsappServerKey(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {waStatus === 'connected' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm font-semibold text-green-800">WhatsApp conectado e pronto para disparos automaticos!</span>
              </div>
              <button onClick={() => void handleWaDisconnect()} disabled={waLoading}
                className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50">
                {waLoading ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          ) : waStatus === 'qr' && waQR ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-yellow-800">Escaneie o QR Code abaixo com o WhatsApp do celular</span>
              </div>
              <div className="flex justify-center bg-white p-4 rounded-xl border border-border">
                <img src={waQR} alt="QR Code WhatsApp" className="w-56 h-56" />
              </div>
              <p className="text-xs text-gray-500 text-center">
                WhatsApp &gt; Dispositivos conectados &gt; Conectar dispositivo
              </p>
              <button onClick={() => void handleWaDisconnect()} disabled={waLoading}
                className="w-full border border-border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
            </div>
          ) : waStatus === 'connecting' ? (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm text-blue-800">Aguardando QR Code... (pode levar alguns segundos)</span>
            </div>
          ) : (
            <button onClick={() => void handleWaConnect()} disabled={waLoading || !whatsappServerUrl || !whatsappServerKey}
              className="bg-green-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
              {waLoading ? 'Conectando...' : 'Conectar WhatsApp'}
            </button>
          )}

          {waError && <p className="text-sm text-red-600 mt-2">{waError}</p>}
        </div>

        <div className="sticky top-4 z-20 mb-6 rounded-3xl border-4 border-amber-500 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 p-5 shadow-[0_12px_30px_rgba(245,158,11,0.22)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl font-black text-white shadow-lg">
                !
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-amber-950">Confirmações de Ação</h2>
                <p className="text-sm font-medium text-amber-900">
                  Botão temporário para deletar ou desativar sem aparecer confirmação por até 5 minutos.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <button
                onClick={toggleSkipActionConfirm}
                className={`rounded-2xl px-6 py-4 text-base font-black shadow-lg transition-transform hover:scale-[1.02] ${skipActionConfirmEnabled ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}`}
              >
                {skipActionConfirmEnabled ? 'Desativar modo sem confirmação' : 'Ativar por 5 minutos'}
              </button>
              {skipActionConfirmEnabled && skipActionConfirmUntil && (
                <span className="text-sm font-semibold text-green-800">
                  Ativo até {new Date(Number(skipActionConfirmUntil)).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-3">Backup</h2>
          <p className="text-sm text-gray-500 mb-4">
            Exporte todos os dados em JSON ou importe um backup para restaurar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportBackup}
              className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Exportar Backup
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Exportar CSV
            </button>
            <button
              onClick={() => void handleSendCSVByEmail()}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Enviar CSV por Email
            </button>
            <label className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer text-center">
              Importar Backup
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => void handleImportBackup(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {csvEmailFeedback && (
            <p className="text-sm text-gray-700 mt-3">{csvEmailFeedback}</p>
          )}
        </div>

        {/* CSV Import */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-3">Importar Clientes (CSV)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Colunas esperadas: nome, celular, dataVencimento, valor. Opcionais: servidor, situacao, criadoEm.
            <br />Se definir servidor/situação abaixo, eles serão usados para linhas sem esses campos no CSV.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Servidor padrão</label>
              <select
                value={csvServidor}
                onChange={(e) => setCsvServidor(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">— Selecione —</option>
                {servidores.map((s) => (
                  <option key={s.id} value={s.nome}>{s.nome}</option>
                ))}
              </select>
              {servidores.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Cadastre servidores acima primeiro.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Situação padrão</label>
              <select
                value={csvSituacao}
                onChange={(e) => setCsvSituacao(e.target.value as typeof csvSituacao)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="Assinou">Assinou</option>
                <option value="Renovou">Renovou</option>
                <option value="Não Renovou">Não Renovou</option>
                <option value="Inadimplente">Inadimplente</option>
              </select>
            </div>
          </div>
          <label className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer text-center inline-block">
            Selecionar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const text = ev.target?.result as string;
                  const lines = text.split(/\r?\n/).filter((l) => l.trim());
                  if (lines.length < 2) { setCsvMessage('CSV vazio ou sem dados.'); return; }
                  const firstLine = lines[0];
                  const delimiter = firstLine.includes(';') ? ';' : ',';
                  const splitRow = (line: string) => {
                    const result: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                      const char = line[i];
                      if (char === '"') {
                        if (inQuotes && line[i + 1] === '"') {
                          current += '"';
                          i++;
                        } else {
                          inQuotes = !inQuotes;
                        }
                      } else if (char === delimiter && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                      } else {
                        current += char;
                      }
                    }
                    result.push(current.trim());
                    return result;
                  };
                  const headers = splitRow(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ''));
                  const newClients: Client[] = [];
                  for (let i = 1; i < lines.length; i++) {
                    const values = splitRow(lines[i]).map((v) => v.replace(/^['"]|['"]$/g, ''));
                    const row: Record<string, string> = {};
                    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
                    const nome = row['nome'];
                    if (!nome) continue;
                    const servidor = row['servidor'] || csvServidor;
                    const situacaoRaw = row['situacao'] || '';
                    const validSituacoes = ['Assinou', 'Renovou', 'Não Renovou', 'Inadimplente'];
                    const situacao = validSituacoes.includes(situacaoRaw) ? situacaoRaw as typeof csvSituacao : csvSituacao;
                    let valorNum = 0;
                    const valorRaw = row['valor'] || '';
                    if (valorRaw.includes('R$')) {
                      valorNum = parseFloat(valorRaw.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
                    } else {
                      valorNum = parseFloat(valorRaw.replace(',', '.')) || 0;
                    }
                    let dataVencimento = row['datavencimento'] || row['data_vencimento'] || row['vencimento'] || '';
                    if (dataVencimento.includes('/')) {
                      const [d, m, y] = dataVencimento.split('/');
                      dataVencimento = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    }
                    if (!dataVencimento) {
                      dataVencimento = new Date().toISOString().split('T')[0];
                    }
                    let criadoEm = row['criadoem'] || row['criado_em'] || row['cadastro'] || '';
                    if (criadoEm.includes('/')) {
                      const [d, m, y] = criadoEm.split('/');
                      criadoEm = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00.000Z`;
                    } else if (!criadoEm) {
                      criadoEm = new Date().toISOString();
                    }
                    const statusRaw = row['status'] || '';
                    const desativado = statusRaw.toLowerCase() === 'inativo' || situacao === 'Não Renovou' || situacao === 'Inadimplente';
                    newClients.push({
                      id: generateId(),
                      nome,
                      celular: row['celular'] || '',
                      servidor,
                      dataVencimento: dataVencimento,
                      valor: valorNum,
                      situacao,
                      desativado,
                      lembreteEnviado: false,
                      criadoEm,
                      trustRenewal: false,
                      trustPaymentDate: null,
                      trustOriginalDueDate: null,
                      ultimaRenovacao: null,
                      mesesRenovados: 1,
                      observacao: row['observacao'] || '',
                    });
                  }
                  if (newClients.length === 0) { setCsvMessage('Nenhum cliente válido encontrado no CSV.'); return; }
                  if (!skipActionConfirmEnabled && !window.confirm(`Importar ${newClients.length} clientes? (Existentes: ${clients.length})`)) return;
                  void saveAllClientsToFirestore(uid, [...clients, ...newClients]).then(() => {
                    setCsvMessage(`✓ ${newClients.length} clientes importados com sucesso!`);
                  });
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
          {csvMessage && <p className="text-sm text-gray-600 mt-3">{csvMessage}</p>}
        </div>

        {/* Danger Zone */}
        <div className="bg-card rounded-xl shadow-sm border border-red-200 p-6">
          <h2 className="text-lg font-semibold mb-3 text-red-700">Zona de Perigo</h2>
          <p className="text-sm text-gray-500 mb-4">
            Ações irreversíveis. Tenha certeza antes de prosseguir.
          </p>
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Deletar Todos os Clientes
          </button>
          {deleteAllFeedback && (
            <p className="text-sm mt-3 text-gray-700">{deleteAllFeedback}</p>
          )}
        </div>

        {/* Delete All Modal */}
        {showDeleteAllModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2 text-red-700">Confirmar Exclusão</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Tem certeza que deseja deletar <strong>todos os {clients.length} clientes</strong>? Esta ação é <strong>irreversível</strong>.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteAllModal(false)}
                    className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                    disabled={deleteAllLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleDeleteAllClients()}
                    className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    disabled={deleteAllLoading}
                  >
                    {deleteAllLoading ? 'Deletando...' : 'Confirmar Exclusão'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={() => void handleSave()}
          className="w-full bg-accent text-white rounded-lg py-3 font-medium hover:bg-accent-hover transition-colors"
        >
          {saved ? '✓ Salvo com sucesso!' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
