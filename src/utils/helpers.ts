import type { Client, FinanceEntry, Settings, StatusCalculado } from '../types';

export function calcularStatus(dataVencimento: string | null | undefined): StatusCalculado {
  if (!dataVencimento || typeof dataVencimento !== 'string') return 'Expirado';
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const parts = dataVencimento.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 'Expirado';
  const [y, m, d] = parts;
  const vencimento = new Date(y, m - 1, d);
  if (Number.isNaN(vencimento.getTime())) return 'Expirado';

  const diffMs = vencimento.getTime() - hoje.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) return 'Ativo';
  if (diffDays === 1) return 'Expirando';
  return 'Expirado';
}

export function formatarValor(valor: number): string {
  const safe = typeof valor === 'number' && !Number.isNaN(valor) ? valor : 0;
  return safe.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatarData(dataISO: string): string {
  if (!dataISO || !dataISO.includes('-')) return '';
  const [year, month, day] = dataISO.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

export function adicionarMeses(dataISO: string, meses: number): string {
  const date = new Date(dataISO + 'T00:00:00');
  const dia = date.getDate();
  date.setMonth(date.getMonth() + meses);
  // Keep same day if possible
  if (date.getDate() !== dia) {
    date.setDate(0); // last day of previous month
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getSaudacao(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function buildWhatsAppUrl(client: Client, template: string, settings: Settings): string {
  const celular = client.celular.replace(/\D/g, '');
  let mensagem = template
    .replace(/{nome}/g, client.nome)
    .replace(/{valor}/g, formatarValor(client.valor))
    .replace(/{vencimento}/g, formatarData(client.dataVencimento))
    .replace(/{servidor}/g, client.servidor || '')
    .replace(/{data_promessa}/g, client.trustPaymentDate ? formatarData(client.trustPaymentDate) : '')
    .replace(/{chave_pix}/g, settings.defaultChavePix)
    .replace(/{banco}/g, settings.defaultBanco)
    .replace(/{beneficiario}/g, settings.defaultBeneficiario)
    .replace(/{saudacao}/g, getSaudacao());

  // Replace custom variables
  Object.entries(settings.variaveisPersonalizadas || {}).forEach(([key, value]) => {
    mensagem = mensagem.replace(new RegExp(`{${key}}`, 'g'), value);
  });

  return `https://wa.me/${celular}?text=${encodeURIComponent(mensagem)}`;
}

export function buildWhatsAppAppUrl(client: Client, template: string, settings: Settings): string {
  const celular = client.celular.replace(/\D/g, '');
  let mensagem = template
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
    mensagem = mensagem.replace(new RegExp(`{${key}}`, 'g'), value);
  });

  return `whatsapp://send?phone=${celular}&text=${encodeURIComponent(mensagem)}`;
}

export function isToday(dateISO: string | null): boolean {
  if (!dateISO) return false;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` === dateISO;
}

export function formatarDataHora(dataISO: string): string {
  return new Date(dataISO).toLocaleString('pt-BR');
}

export function getMonthKeyFromIsoDate(dateISO: string): string {
  if (!dateISO || typeof dateISO !== 'string') return '';
  return dateISO.slice(0, 7);
}

export function getMonthLabel(yearMonth: string): string {
  if (!yearMonth || yearMonth.length < 7 || !yearMonth.includes('-')) return '';
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) return '';
  const date = new Date(year, month - 1);
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

export function getPreviousMonthKey(yearMonth: string): string {
  if (!yearMonth || yearMonth.length < 7 || !yearMonth.includes('-')) return '';
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) return '';
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function buildFinancialTotalsByMonth(
  clients: Client[] = [],
  settings: Settings | null | undefined,
  financeEntries: FinanceEntry[] = [],
): Record<string, { receita: number; despesa: number }> {
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeEntries = Array.isArray(financeEntries) ? financeEntries : [];
  const safeSettings = settings || { servidores: [] };

  const totals: Record<string, { receita: number; despesa: number }> = {};
  const currentMonthKey = getMonthKeyFromIsoDate(new Date().toISOString().split('T')[0]);
  const activeClients = safeClients.filter((client) => !client.desativado);
  const createdClients = activeClients.filter((client) => {
    if (client.situacao !== 'Assinou' || client.ultimaRenovacao) return false;
    if (client.trustRenewal) return false;
    return calcularStatus(client.dataVencimento) !== 'Expirado';
  });
  const serverCostMap: Record<string, number> = {};

  (safeSettings.servidores || []).forEach((server) => {
    if (server && typeof server.nome === 'string') {
      serverCostMap[server.nome] = typeof server.custo === 'number' && !Number.isNaN(server.custo) ? server.custo : 0;
    }
  });

  const ensureMonth = (monthKey: string) => {
    if (monthKey < currentMonthKey) return false;
    if (!totals[monthKey]) {
      totals[monthKey] = { receita: 0, despesa: 0 };
    }
    return true;
  };

  activeClients.forEach((client) => {
    if (!client.ultimaRenovacao) return;
    const renewalDate = new Date(client.ultimaRenovacao);
    if (Number.isNaN(renewalDate.getTime())) return;
    const monthKey = `${renewalDate.getFullYear()}-${String(renewalDate.getMonth() + 1).padStart(2, '0')}`;
    if (!ensureMonth(monthKey)) return;
    const months = typeof client.mesesRenovados === 'number' && !Number.isNaN(client.mesesRenovados) ? client.mesesRenovados : 1;
    const valor = typeof client.valor === 'number' && !Number.isNaN(client.valor) ? client.valor : 0;
    totals[monthKey].receita += valor * months;
    totals[monthKey].despesa += (serverCostMap[client.servidor] || 0) * months;
  });

  createdClients.forEach((client) => {
    const createdDate = new Date(client.criadoEm);
    if (Number.isNaN(createdDate.getTime())) return;
    const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
    if (!ensureMonth(monthKey)) return;
    const valor = typeof client.valor === 'number' && !Number.isNaN(client.valor) ? client.valor : 0;
    totals[monthKey].receita += valor;
    totals[monthKey].despesa += serverCostMap[client.servidor] || 0;
  });

  safeEntries.forEach((entry) => {
    if (!entry || typeof entry.data !== 'string') return;
    const monthKey = getMonthKeyFromIsoDate(entry.data);
    if (!monthKey || monthKey.length < 7) return;
    if (!ensureMonth(monthKey)) return;
    const quantity = typeof entry.quantidade === 'number' && !Number.isNaN(entry.quantidade) ? entry.quantidade : 1;
    const custo = typeof entry.custo === 'number' && !Number.isNaN(entry.custo) ? entry.custo : 0;
    const valorVenda = typeof entry.valorVenda === 'number' && !Number.isNaN(entry.valorVenda) ? entry.valorVenda : 0;
    totals[monthKey].despesa += custo * quantity;
    if (entry.tipo === 'venda') {
      totals[monthKey].receita += valorVenda * quantity;
    }
  });

  return totals;
}
