import type { Client, Settings, StatusCalculado } from '../types';

export function calcularStatus(dataVencimento: string): StatusCalculado {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [y, m, d] = dataVencimento.split('-').map(Number);
  const vencimento = new Date(y, m - 1, d);

  const diffMs = vencimento.getTime() - hoje.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) return 'Ativo';
  if (diffDays === 1) return 'Expirando';
  return 'Expirado';
}

export function formatarValor(valor: number): string {
  return valor.toLocaleString('pt-BR', {
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
