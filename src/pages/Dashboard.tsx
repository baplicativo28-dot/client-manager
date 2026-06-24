import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Client, FilterTab } from '../types';
import { useClients } from '../hooks/useClients';
import { useFinance } from '../hooks/useFinance';
import { useSettings } from '../hooks/useSettings';
import {
  calcularStatus,
  formatarValor,
  formatarData,
  adicionarMeses,
  buildWhatsAppUrl,
  buildWhatsAppAppUrl,
  isToday,
  getSaudacao,
} from '../utils/helpers';
import { ClientModal } from '../components/ClientModal';
import { RenewButton } from '../components/RenewButton';
import { FinancialSummary } from '../components/FinancialSummary';
import { FilterTabs } from '../components/FilterTabs';
import { getExpiredClientsFromFirestore, deleteClientsFromFirestore } from '../utils/firestoreUtils';
import { TrustRenewalModal } from '../components/TrustRenewalModal';
import { MigrationModal } from '../components/MigrationModal';

interface DashboardProps {
  uid: string;
  onLogout: () => void;
  isAdmin?: boolean;
}

type SortField = 'nome' | 'cadastro' | 'vencimento';
type SortDirection = 'asc' | 'desc';

type ReminderItem = {
  client: Client;
  sent: boolean;
  label: string;
};

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
};

function ConfirmDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{dialog.title}</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700">{dialog.message}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            {dialog.cancelText || 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${dialog.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-accent-hover'}`}
          >
            {dialog.confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ uid, onLogout, isAdmin = false }: DashboardProps) {
  const { clients, loading: clientsLoading, addClient, updateClient, deleteClient } = useClients(uid);
  const { entries: financeEntries } = useFinance(uid);
  const { settings } = useSettings(uid);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [trustClient, setTrustClient] = useState<Client | null>(null);
  const [obsClient, setObsClient] = useState<Client | null>(null);
  const [diasAntecipado, setDiasAntecipado] = useState<number>(0);
  const [showServerStats, setShowServerStats] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [clearPeriod, setClearPeriod] = useState<number>(30);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearFeedback, setClearFeedback] = useState('');
  const [clearCount, setClearCount] = useState(0);
  const [sortField, setSortField] = useState<SortField>('nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [serverFilter, setServerFilter] = useState<string>('');
  const PAGE_SIZE = 10;
  const [autoSending, setAutoSending] = useState(false);
  const [autoSendProgress, setAutoSendProgress] = useState('');
  const [autoSendPending, setAutoSendPending] = useState<ReminderItem[]>([]);
  const [showAutoSendListModal, setShowAutoSendListModal] = useState(false);
  const [skipActionConfirmUntil, setSkipActionConfirmUntil] = useState<string | null>(
    localStorage.getItem('cm_skip_action_confirm_until')
  );
  const skipActionConfirmEnabled = !!skipActionConfirmUntil && Date.now() < Number(skipActionConfirmUntil);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  useEffect(() => {
    if (clientsLoading) return;
    if (clients.length === 0) {
      try {
        const raw = localStorage.getItem('cm_clients');
        if (raw) {
          const parsed = JSON.parse(raw) as unknown[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setShowMigration(true);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [clientsLoading, clients.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      const savedValue = localStorage.getItem('cm_skip_action_confirm_until');
      setSkipActionConfirmUntil(savedValue);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const clientsWithStatus = useMemo(() => {
    return clients.map((client) => ({
      ...client,
      statusCalculado: calcularStatus(client.dataVencimento),
    }));
  }, [clients]);

  const counts = useMemo(() => {
    const active = clientsWithStatus.filter((client) => !client.desativado);
    return {
      Todos: active.length,
      Ativos: active.filter((client) => client.statusCalculado === 'Ativo').length,
      Expirando: active.filter((client) => client.statusCalculado === 'Expirando').length,
      Expirados: active.filter((client) => client.statusCalculado === 'Expirado').length,
      'Em Confianca': active.filter((client) => client.trustRenewal).length,
      Desativados: clientsWithStatus.filter((client) => client.desativado).length,
    };
  }, [clientsWithStatus]);

  const ativosPorServidor = useMemo(() => {
    const active = clientsWithStatus.filter(
      (client) => !client.desativado && (client.statusCalculado === 'Ativo' || client.statusCalculado === 'Expirando'),
    );
    const map: Record<string, number> = {};
    active.forEach((client) => {
      const key = client.servidor || 'Sem servidor';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [clientsWithStatus]);

  const semServidorAtivos = ativosPorServidor['Sem servidor'] || 0;
  const ativosComServidor = Object.entries(ativosPorServidor)
    .filter(([servidor]) => servidor !== 'Sem servidor')
    .reduce((total, [, count]) => total + count, 0);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    clientsWithStatus.forEach((client) => {
      if (
        client.statusCalculado === 'Expirado'
        && client.lembreteEnviado
        && client.lastReminderResetDate !== today
      ) {
        updateClient(client.id, {
          lembreteEnviado: false,
          lastReminderResetDate: today,
        });
      }
    });
  }, [clientsWithStatus, updateClient]);

  const filtered = useMemo(() => {
    let list = clientsWithStatus;

    if (search.trim()) {
      const term = search
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
      list = list.filter((client) =>
        client.nome
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(term),
      );
    } else {
      if (activeTab === 'Desativados') {
        list = list.filter((client) => client.desativado);
      } else if (activeTab === 'Todos') {
        list = list.filter((client) => !client.desativado);
      } else {
        const statusMap: Record<string, string> = {
          Ativos: 'Ativo',
          Expirando: 'Expirando',
          Expirados: 'Expirado',
        };
        list = activeTab === 'Em Confianca'
          ? list.filter((client) => !client.desativado && client.trustRenewal)
          : list.filter((client) => !client.desativado && client.statusCalculado === statusMap[activeTab]);
      }

      if (diasAntecipado > 0) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + diasAntecipado);
        list = list.filter((client) => {
          const venc = new Date(client.dataVencimento + 'T00:00:00');
          return venc >= hoje && venc <= limite;
        });
      }
    }

    if (serverFilter) {
      list = list.filter((client) => (client.servidor || 'Sem servidor') === serverFilter);
    }

    return [...list].sort((left, right) => {
      if (search.trim()) {
        return left.nome.localeCompare(right.nome, 'pt-BR', { sensitivity: 'base' });
      }

      let comparison = 0;
      if (sortField === 'nome') {
        comparison = left.nome.localeCompare(right.nome, 'pt-BR', { sensitivity: 'base' });
      } else if (sortField === 'cadastro') {
        comparison = left.criadoEm.localeCompare(right.criadoEm);
      } else {
        comparison = left.dataVencimento.localeCompare(right.dataVencimento);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [clientsWithStatus, activeTab, diasAntecipado, search, serverFilter, sortDirection, sortField]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, serverFilter, diasAntecipado, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = counts.Ativos + counts.Expirando;

  const renewClientFromBaseDate = (client: Client, months: number, baseDate: string) => {
    const newDate = adicionarMeses(baseDate, months);
    updateClient(client.id, {
      dataVencimento: newDate,
      situacao: 'Renovou',
      lembreteEnviado: false,
      ultimaRenovacao: new Date().toISOString().split('T')[0],
      mesesRenovados: months,
      trustRenewal: false,
      trustPaymentDate: null,
      trustActivationDate: null,
      trustOriginalDueDate: null,
      desativado: false,
    });
  };

  const handleRenew = (clientId: string, months: number) => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return;
    if (!skipActionConfirmEnabled) {
      setConfirmDialog({
        title: 'Client Manager',
        message: `Tem certeza que deseja renovar "${client.nome}" por ${months} mês(es)?`,
        confirmText: 'Renovar',
        cancelText: 'Cancelar',
        destructive: false,
        onConfirm: () => renewClientFromBaseDate(client, months, client.dataVencimento),
      });
      return;
    }
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [year, month, day] = client.dataVencimento.split('-').map(Number);
    const vencimentoAtual = new Date(year, month - 1, day);
    const dataBase = vencimentoAtual < hoje ? new Date(hoje) : vencimentoAtual;
    const baseIso = [
      dataBase.getFullYear(),
      String(dataBase.getMonth() + 1).padStart(2, '0'),
      String(dataBase.getDate()).padStart(2, '0'),
    ].join('-');
    renewClientFromBaseDate(client, months, baseIso);
  };

  const handleReminder = (client: Client) => {
    const status = calcularStatus(client.dataVencimento);
    let template: string;

    if (client.trustRenewal) {
      template = settings.whatsappTemplateConfianca;
    } else if (status === 'Expirado') {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const [y, m, d] = client.dataVencimento.split('-').map(Number);
      const vencimento = new Date(y, m - 1, d);
      const diffDays = Math.round((hoje.getTime() - vencimento.getTime()) / 86400000);
      template = diffDays >= 1 ? settings.whatsappTemplateExpirado1Dia : settings.whatsappTemplateExpirado;
    } else {
      template = settings.whatsappTemplate;
    }

    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const url = isMobileDevice
      ? buildWhatsAppAppUrl(client, template, settings)
      : buildWhatsAppUrl(client, template, settings);
    window.open(url, '_blank');
    updateClient(client.id, {
      lembreteEnviado: true,
      lastReminderResetDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleTrustRenewal = (client: Client, trustPaymentDate: string) => {
    updateClient(client.id, {
      dataVencimento: trustPaymentDate,
      situacao: 'Renovou',
      trustRenewal: true,
      trustPaymentDate,
      trustActivationDate: client.trustActivationDate ?? new Date().toISOString().split('T')[0],
      trustOriginalDueDate: client.trustOriginalDueDate ?? client.dataVencimento,
      lembreteEnviado: false,
    });
    setTrustClient(null);
  };


  const handleMarkDefaulter = (client: Client) => {
    updateClient(client.id, {
      situacao: 'Inadimplente',
      trustRenewal: false,
      trustPaymentDate: null,
      trustActivationDate: null,
      trustOriginalDueDate: null,
      desativado: true,
    });
  };

  const handleDeactivate = (client: Client) => {
    if (client.desativado) {
      updateClient(client.id, {
        desativado: false,
        situacao: 'Renovou',
        trustRenewal: false,
        trustPaymentDate: null,
        trustActivationDate: null,
        trustOriginalDueDate: null,
      });
      return;
    }

    if (!skipActionConfirmEnabled) {
      setConfirmDialog({
        title: 'Client Manager',
        message: `Tem certeza que deseja desativar "${client.nome}"?`,
        confirmText: 'Desativar',
        cancelText: 'Cancelar',
        destructive: true,
        onConfirm: () => updateClient(client.id, { desativado: true, situacao: 'Não Renovou' }),
      });
      return;
    }
    updateClient(client.id, { desativado: true, situacao: 'Não Renovou' });
  };

  const handleDelete = async (client: Client) => {
    if (!skipActionConfirmEnabled) {
      setConfirmDialog({
        title: 'Client Manager',
        message: `Tem certeza que deseja excluir "${client.nome}"? Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        destructive: true,
        onConfirm: () => deleteClient(client.id),
      });
      return;
    }
    try {
      await deleteClient(client.id);
    } catch {
      window.alert('Erro ao excluir cliente. Verifique as permissões do Firestore e tente novamente.');
    }
  };

  const handlePrepareClearExpired = async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const cutoff = new Date(hoje);
    cutoff.setDate(cutoff.getDate() - clearPeriod);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const expired = await getExpiredClientsFromFirestore(uid, cutoffStr);
    const clearableClients = expired.filter((client) => {
      const isInactive = client.desativado === true;
      const isExpired = calcularStatus(client.dataVencimento) === 'Expirado';
      return client.dataVencimento < cutoffStr && (isInactive || isExpired);
    });
    setClearCount(clearableClients.length);
    setShowClearModal(true);
  };

  const handleConfirmClearExpired = async () => {
    setClearLoading(true);
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const cutoff = new Date(hoje);
      cutoff.setDate(cutoff.getDate() - clearPeriod);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      const expired = await getExpiredClientsFromFirestore(uid, cutoffStr);
      if (expired.length > 0) {
        await deleteClientsFromFirestore(uid, expired.map((client) => client.id));
      }
      setClearFeedback(`✓ ${expired.length} cliente(s) expirado(s) removido(s).`);
    } catch {
      setClearFeedback('Erro ao limpar clientes expirados. Tente novamente.');
    } finally {
      setClearLoading(false);
      setShowClearModal(false);
      setTimeout(() => setClearFeedback(''), 4000);
    }
  };

  const handleMonthlyRenew = (client: Client, months: number) => {
    if (skipActionConfirmEnabled) {
      handleRenew(client.id, months);
      return;
    }

    setConfirmDialog({
      title: 'Client Manager',
      message: `Tem certeza que deseja renovar "${client.nome}" por ${months} mês(es)?`,
      confirmText: 'Renovar',
      cancelText: 'Cancelar',
      destructive: false,
      onConfirm: () => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const [year, month, day] = client.dataVencimento.split('-').map(Number);
        const vencimentoAtual = new Date(year, month - 1, day);
        const dataBase = vencimentoAtual < hoje ? new Date(hoje) : vencimentoAtual;
        const baseIso = [
          dataBase.getFullYear(),
          String(dataBase.getMonth() + 1).padStart(2, '0'),
          String(dataBase.getDate()).padStart(2, '0'),
        ].join('-');
        renewClientFromBaseDate(client, months, baseIso);
      },
    });
  };

  const handleConfirmPayment = (client: Client) => {
    const baseDate = client.trustActivationDate || client.dataVencimento;
    renewClientFromBaseDate(client, 1, baseDate);
  };

  const handleDialogConfirm = async () => {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const getRowHighlightClass = (client: Client & { statusCalculado: string }) => {
    if (client.desativado || client.situacao === 'Inadimplente') {
      return 'bg-gray-50 ring-1 ring-gray-200';
    }

    if (client.trustRenewal && isToday(client.trustPaymentDate)) {
      return 'bg-orange-50 ring-1 ring-orange-200';
    }

    if (client.statusCalculado === 'Expirado') {
      return 'bg-red-50 ring-1 ring-red-200';
    }

    if (client.statusCalculado === 'Expirando') {
      return 'bg-yellow-50 ring-1 ring-yellow-200';
    }

    return '';
  };

  const statusBadge = (status: string, client: { desativado: boolean; situacao: string }) => {
    if (client.desativado || client.situacao === 'Inadimplente') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Inativo</span>;
    }
    const colors: Record<string, string> = {
      Ativo: 'bg-green-100 text-green-800',
      Expirando: 'bg-yellow-100 text-yellow-800',
      Expirado: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? ''}`}>{status}</span>;
  };

  const getPendingReminders = useCallback((): ReminderItem[] => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const hojeStr = hoje.toISOString().split('T')[0];
    const amanhaStr = amanha.toISOString().split('T')[0];

    return clientsWithStatus
      .filter((client) => {
        if (client.desativado) return false;
        const dueDate = client.trustRenewal
          ? (client.trustPaymentDate || client.dataVencimento)
          : client.dataVencimento;
        if (!dueDate) return false;

        if (client.trustRenewal) {
          return dueDate <= hojeStr && (!client.lembreteEnviado || client.lastReminderResetDate !== hojeStr);
        }

        return dueDate <= amanhaStr && (!client.lembreteEnviado || client.lastReminderResetDate !== hojeStr);
      })
      .map((client) => {
        const dueDate = client.trustRenewal
          ? (client.trustPaymentDate || client.dataVencimento)
          : client.dataVencimento;

        const label = client.trustRenewal && dueDate === hojeStr
          ? 'Confiança hoje'
          : dueDate < hojeStr
            ? 'Expirado 1+ dia'
            : dueDate === hojeStr
              ? 'Vence hoje'
              : 'Vence amanhã';

        return { client, sent: false, label };
      })
      .sort((left, right) => {
        const priority = (label: string) => {
          if (label === 'Expirado 1+ dia') return 0;
          if (label === 'Confiança hoje') return 1;
          if (label === 'Vence hoje') return 2;
          return 3;
        };

        const difference = priority(left.label) - priority(right.label);
        if (difference !== 0) return difference;
        return left.client.nome.localeCompare(right.client.nome, 'pt-BR', { sensitivity: 'base' });
      });
  }, [clientsWithStatus]);

  const prepareAutoSend = useCallback(() => {
    const list = getPendingReminders();
    if (list.length === 0) {
      setAutoSendProgress('Nenhum cliente precisa de lembrete no momento.');
      setTimeout(() => setAutoSendProgress(''), 4000);
      return;
    }
    setAutoSendPending(list);
    setShowAutoSendListModal(true);
  }, [getPendingReminders]);

  const buildReminderMessage = useCallback((client: Client) => {
    const statusC = calcularStatus(client.dataVencimento);
    let template: string;
    if (client.trustRenewal) {
      template = settings.whatsappTemplateConfianca;
    } else if (statusC === 'Expirado') {
      const hj = new Date();
      hj.setHours(0, 0, 0, 0);
      const [y, m, d] = client.dataVencimento.split('-').map(Number);
      const venc = new Date(y, m - 1, d);
      const diff = Math.round((hj.getTime() - venc.getTime()) / 86400000);
      template = diff >= 1 ? settings.whatsappTemplateExpirado1Dia : settings.whatsappTemplateExpirado;
    } else {
      template = settings.whatsappTemplate;
    }

    let message = template
      .replace(/{nome}/g, client.nome)
      .replace(/{valor}/g, formatarValor(client.valor))
      .replace(/{vencimento}/g, formatarData(client.dataVencimento))
      .replace(/{servidor}/g, client.servidor || '')
      .replace(/{data_promessa}/g, client.trustPaymentDate ? formatarData(client.trustPaymentDate) : '')
      .replace(/{chave_pix}/g, settings.defaultChavePix)
      .replace(/{banco}/g, settings.defaultBanco)
      .replace(/{beneficiario}/g, settings.defaultBeneficiario)
      .replace(/{saudacao}/g, getSaudacao());

    Object.entries(settings.variaveisPersonalizadas || {}).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return message;
  }, [settings]);

  const handleReminderClick = useCallback(async (item: ReminderItem) => {
    if (item.sent) return;

    const client = item.client;
    const message = buildReminderMessage(client);
    const celular = client.celular.replace(/\D/g, '');
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const url = isMobileDevice
      ? buildWhatsAppAppUrl(client, message, settings)
      : `https://wa.me/${celular}?text=${encodeURIComponent(message)}`;

    setAutoSending(true);
    setAutoSendProgress(`Abrindo lembrete de ${client.nome}...`);

    try {
      if (settings.whatsappServerUrl && settings.whatsappServerKey) {
        const apiBase = settings.whatsappServerUrl.replace(/\/$/, '');
        const response = await fetch(`${apiBase}/message/sendText/client-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: settings.whatsappServerKey },
          body: JSON.stringify({ number: client.celular, text: message }),
        });
        if (!response.ok) {
          setAutoSendProgress(`Erro ao enviar para ${client.nome}.`);
          return;
        }
      } else {
        if (isMobileDevice) {
          window.location.href = url;
        } else {
          window.open(url, '_blank');
        }
      }

      updateClient(client.id, {
        lembreteEnviado: true,
        lastReminderResetDate: new Date().toISOString().split('T')[0],
      });
      setAutoSendPending((current) =>
        current.map((entry) => (entry.client.id === client.id ? { ...entry, sent: true } : entry))
      );
      setAutoSendProgress(`✓ ${client.nome} marcado como enviado.`);
    } catch {
      setAutoSendProgress(`Erro ao abrir lembrete de ${client.nome}.`);
    } finally {
      setAutoSending(false);
      setTimeout(() => setAutoSendProgress(''), 2500);
    }
  }, [buildReminderMessage, settings, updateClient]);

  const handleReminderTap = useCallback((item: ReminderItem) => {
    if (item.sent || autoSending) return;
    void handleReminderClick(item);
  }, [autoSending, handleReminderClick]);

  if (clientsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-gray-500 text-sm">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <span className="bg-accent text-white text-xs font-semibold px-2.5 py-1 rounded-full">{activeCount} ativos</span>
        </div>
        <button
          onClick={() => { setEditingClient(null); setModalOpen(true); }}
          className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          + Novo Cliente
        </button>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 w-72 bg-card shadow-xl border-r border-border flex flex-col z-10">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-bold">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Fechar menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-4 space-y-2">
              {isAdmin && (
                <a href="/revendedores" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Revendedores
                </a>
              )}
              <a href="/configuracoes" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configurações
              </a>
              <a href="/financeiro" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3-.672 3-1.5S13.657 8 12 8zm0 0V6m0 5v2m-7 1.5C5 13.672 6.343 13 8 13s3 .672 3 1.5S9.657 16 8 16s-3-.672-3-1.5zM16 14.5c0-.828 1.343-1.5 3-1.5s3 .672 3 1.5S20.657 16 19 16s-3-.672-3-1.5zM6 20h12" />
                </svg>
                Financeiro
              </a>
              <button
                onClick={() => { setSidebarOpen(false); prepareAutoSend(); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
              >
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Disparar Lembretes
              </button>
            </div>
            <div className="p-4 border-t border-border">
              <button
                onClick={() => { setSidebarOpen(false); void onLogout(); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
          </nav>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4 bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">Período:</label>
          <select
            value={clearPeriod}
            onChange={(e) => setClearPeriod(Number(e.target.value))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>6 meses</option>
            <option value={365}>1 ano</option>
          </select>
        </div>
        <button
          onClick={() => void handlePrepareClearExpired()}
          className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Limpar Expirados
        </button>
        {clearFeedback && <p className="text-sm text-gray-700">{clearFeedback}</p>}
      </div>

      {showClearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2 text-red-700">Confirmar Limpeza</h3>
              <p className="text-sm text-gray-600 mb-4">
                {clearCount === 0
                  ? 'Nenhum cliente será afetado para o período selecionado.'
                  : `Você está prestes a deletar ${clearCount} cliente(s) com vencimento anterior ao limite selecionado e que estejam inativos ou expirados. Clientes ativos não serão removidos. Esta ação é irreversível.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                  disabled={clearLoading}
                >
                  {clearCount === 0 ? 'Fechar' : 'Cancelar'}
                </button>
                {clearCount > 0 && (
                  <button
                    onClick={() => void handleConfirmClearExpired()}
                    className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    disabled={clearLoading}
                  >
                    {clearLoading ? 'Deletando...' : 'Confirmar Limpeza'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <FinancialSummary clients={clients} settings={settings} financeEntries={financeEntries} />

      <div className="mb-4">
        <button onClick={() => setShowServerStats(!showServerStats)} className="text-sm font-medium text-accent hover:underline">
          {showServerStats ? 'Ocultar' : 'Mostrar'} ativos por servidor
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Com servidor: {ativosComServidor}
          {semServidorAtivos > 0 ? ` · Sem servidor: ${semServidorAtivos}` : ''}
        </p>
        {serverFilter && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Filtro atual:</span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
              {serverFilter}
              <button
                type="button"
                onClick={() => setServerFilter('')}
                className="text-accent hover:opacity-70"
                aria-label="Limpar filtro de servidor"
              >
                ×
              </button>
            </span>
          </div>
        )}
        {showServerStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
            {Object.entries(ativosPorServidor).map(([servidor, count]) => (
              <button
                key={servidor}
                type="button"
                onClick={() => setServerFilter((current) => (current === servidor ? '' : servidor))}
                className={`text-left bg-card border rounded-lg p-3 transition-colors ${
                  serverFilter === servidor
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/20'
                    : 'border-border hover:bg-gray-50'
                }`}
              >
                <p className="text-xs text-gray-500">{servidor}</p>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs mt-1 text-accent font-medium">
                  {serverFilter === servidor ? 'Toque para mostrar todos' : 'Toque para filtrar'}
                </p>
              </button>
            ))}
            {Object.keys(ativosPorServidor).length === 0 && (
              <p className="text-sm text-gray-400 col-span-full">Nenhum cliente ativo.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-card"
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-gray-500 hover:text-gray-800 font-bold text-base"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 whitespace-nowrap">Vencendo em até:</label>
          <select
            value={diasAntecipado}
            onChange={(e) => setDiasAntecipado(Number(e.target.value))}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value={0}>Sem filtro</option>
            <option value={2}>2 dias</option>
            <option value={3}>3 dias</option>
            <option value={5}>5 dias</option>
            <option value={7}>7 dias</option>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
          </select>
        </div>
      </div>

      <FilterTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      {autoSendProgress && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-800 font-medium">{autoSendProgress}</p>
        </div>
      )}

      <div className="hidden md:block bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium">
                <button type="button" onClick={() => toggleSort('nome')} className="inline-flex items-center gap-1 hover:text-accent transition-colors">
                  <span>Nome</span>
                  <span aria-hidden="true">{getSortIndicator('nome')}</span>
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium">Valor</th>
              <th className="text-left px-4 py-3 font-medium">Celular</th>
              <th className="text-left px-4 py-3 font-medium">Servidor</th>
              <th className="text-left px-4 py-3 font-medium">
                <button type="button" onClick={() => toggleSort('cadastro')} className="inline-flex items-center gap-1 hover:text-accent transition-colors">
                  <span>Cadastro</span>
                  <span aria-hidden="true">{getSortIndicator('cadastro')}</span>
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium">
                <button type="button" onClick={() => toggleSort('vencimento')} className="inline-flex items-center gap-1 hover:text-accent transition-colors">
                  <span>Vencimento</span>
                  <span aria-hidden="true">{getSortIndicator('vencimento')}</span>
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium">Situação</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((client) => (
              <tr
                key={client.id}
                className={`border-b border-border last:border-0 hover:bg-gray-50/50 ${getRowHighlightClass(client)}`}
              >
                <td className="px-4 py-3 font-medium">
                  <div className="flex items-center gap-1">
                    {client.observacao && (
                      <button onClick={() => setObsClient(client)} className="text-blue-500 text-lg leading-none hover:scale-110 transition-transform" title="Ver observação">
                        📝
                      </button>
                    )}
                    <span>{client.nome}</span>
                  </div>
                  {client.lembreteEnviado && (
                    <svg className="inline-block ml-2 w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <title>Lembrete enviado</title>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {client.trustRenewal && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Em Confiança</span>}
                </td>
                <td className="px-4 py-3">{formatarValor(client.valor)}</td>
                <td className="px-4 py-3">{client.celular}</td>
                <td className="px-4 py-3">{client.servidor}</td>
                <td className="px-4 py-3">{formatarData(client.criadoEm.split('T')[0])}</td>
                <td className="px-4 py-3">{formatarData(client.dataVencimento)}</td>
                <td className="px-4 py-3">{client.situacao}</td>
                <td className="px-4 py-3">{statusBadge(client.statusCalculado, client)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    <RenewButton onRenew={(months) => handleMonthlyRenew(client, months)} clientName={client.nome} />
                    <button onClick={() => setTrustClient(client)} className="text-xs bg-warning text-white px-2 py-1 rounded font-medium hover:opacity-90">
                      Confiança
                    </button>
                    <button onClick={() => handleReminder(client)} className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium hover:opacity-90" title="Enviar lembrete WhatsApp">
                      WhatsApp
                    </button>
                    <button onClick={() => openEdit(client)} className="text-xs border border-border px-2 py-1 rounded font-medium hover:bg-gray-50">
                      Editar
                    </button>
                    {client.trustRenewal && (
                      <>
                      <button onClick={() => handleConfirmPayment(client)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium hover:bg-green-200">
                          Confirmar Pagamento
                        </button>
                        <button onClick={() => handleMarkDefaulter(client)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium hover:bg-red-200">
                          Inadimplente
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeactivate(client)}
                      className={`text-xs px-2 py-1 rounded font-medium ${client.desativado ? 'bg-accent text-white hover:opacity-90' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {client.desativado ? 'Ativar' : 'Desativar'}
                    </button>
                    <button onClick={() => handleDelete(client)} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium hover:bg-red-700" title="Excluir cliente">
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nenhum cliente encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {paginated.map((client) => (
          <div
            key={client.id}
            className={`bg-card rounded-xl shadow-sm border border-border p-4 ${getRowHighlightClass(client)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium">
                  {client.nome}
                  {client.lembreteEnviado && (
                    <svg className="inline-block ml-2 w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </p>
                <p className="text-sm text-gray-500">{client.servidor}</p>
                {client.trustRenewal && <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Em Confiança</span>}
                {client.observacao && (
                  <div className="mt-2 flex items-start gap-1">
                    <button onClick={() => setObsClient(client)} className="text-blue-500 text-base leading-none hover:scale-110 transition-transform shrink-0" title="Ver observação completa">
                      📝
                    </button>
                    <p className="text-xs text-gray-600 line-clamp-2">{client.observacao}</p>
                  </div>
                )}
              </div>
              {statusBadge(client.statusCalculado, client)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div><span className="text-gray-500">Valor:</span> {formatarValor(client.valor)}</div>
              <div><span className="text-gray-500">Cadastro:</span> {formatarData(client.criadoEm.split('T')[0])}</div>
              <div><span className="text-gray-500">Vencimento:</span> {formatarData(client.dataVencimento)}</div>
              <div><span className="text-gray-500">Celular:</span> {client.celular}</div>
              <div><span className="text-gray-500">Situação:</span> {client.situacao}</div>
            </div>
            <div className="flex flex-wrap gap-2">
                  <RenewButton onRenew={(months) => handleMonthlyRenew(client, months)} clientName={client.nome} />
              <button onClick={() => setTrustClient(client)} className="text-xs bg-warning text-white px-2 py-1 rounded font-medium">
                Confiança
              </button>
              <button onClick={() => handleReminder(client)} className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium">
                WhatsApp
              </button>
              <button onClick={() => openEdit(client)} className="text-xs border border-border px-2 py-1 rounded font-medium">
                Editar
              </button>
              {client.trustRenewal && (
                <>
                  <button onClick={() => handleConfirmPayment(client)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                    Confirmar Pagamento
                  </button>
                  <button onClick={() => handleMarkDefaulter(client)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                    Inadimplente
                  </button>
                </>
              )}
              <button
                onClick={() => handleDeactivate(client)}
                className={`text-xs px-2 py-1 rounded font-medium ${client.desativado ? 'bg-accent text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {client.desativado ? 'Ativar' : 'Desativar'}
              </button>
              <button onClick={() => handleDelete(client)} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-medium" title="Excluir cliente">
                Excluir
              </button>
            </div>
          </div>
        ))}
        {paginated.length === 0 && <div className="text-center text-gray-400 py-8">Nenhum cliente encontrado.</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4 mb-4">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            &laquo;
          </button>
          <button onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            &lsaquo;
          </button>
          <span className="px-3 py-2 text-sm text-gray-600">{currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            &rsaquo;
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-3 py-2 rounded-lg text-sm font-medium border border-border hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            &raquo;
          </button>
          <span className="text-xs text-gray-400 ml-2">{filtered.length} cliente(s)</span>
        </div>
      )}

      {showAutoSendListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-green-700">Disparar Lembretes</h3>
              <p className="text-sm text-gray-600 mt-1">
                {settings.whatsappServerUrl && settings.whatsappServerKey
                  ? 'Use o botão Enviar para marcar como enviado.'
                  : 'Use o botão Enviar para abrir o WhatsApp.'}
              </p>
              <p className="text-xs text-gray-500 mt-1">A lista é atualizada quando você entra nesta função novamente.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              {autoSendPending.length === 0 ? (
                <p className="p-6 text-sm text-gray-500 text-center">Nenhum cliente na lista.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {autoSendPending.map((item) => (
                    <li key={item.client.id} className={`p-4 flex items-start justify-between gap-3 ${item.sent ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                      <div className="min-w-0 flex-1 text-left select-none">
                        <p className="font-medium text-sm truncate flex items-center gap-2">
                          <span>{item.client.nome}</span>
                          {item.sent && <span className="text-green-600 text-xs font-semibold">✓ enviado</span>}
                        </p>
                        <p className="text-xs text-gray-500">{item.client.celular} · {item.client.servidor || 'Sem servidor'}</p>
                        <p className="text-xs text-gray-500">
                          Vencimento: {formatarData(item.client.dataVencimento)}
                          {item.client.trustRenewal && item.client.trustPaymentDate ? ` · Confiança: ${formatarData(item.client.trustPaymentDate)}` : ''}
                        </p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{item.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleReminderTap(item)}
                        disabled={item.sent || autoSending}
                        className="shrink-0 mt-1 px-3 py-1 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Enviar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setShowAutoSendListModal(false); setAutoSendPending([]); }}
                disabled={autoSending}
                className="flex-1 border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <ClientModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditingClient(null); }}
          onSave={addClient}
          onUpdate={updateClient}
          editingClient={editingClient}
          servidores={settings.servidores}
        />
      )}

      {trustClient && (
        <TrustRenewalModal
          isOpen={Boolean(trustClient)}
          clientName={trustClient.nome}
          initialDate={trustClient.trustPaymentDate ?? trustClient.dataVencimento}
          onClose={() => setTrustClient(null)}
          onConfirm={(date) => handleTrustRenewal(trustClient, date)}
        />
      )}

      {obsClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">{obsClient.nome}</h3>
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{obsClient.observacao}</div>
              <button
                onClick={() => setObsClient(null)}
                className="mt-4 w-full bg-accent text-white rounded-lg py-2 font-medium hover:bg-accent-hover transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showMigration && <MigrationModal uid={uid} onDone={() => setShowMigration(false)} />}
      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => void handleDialogConfirm()}
        />
      )}
    </div>
  );
}