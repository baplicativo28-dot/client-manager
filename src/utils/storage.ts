import type { Client, Settings } from '../types';

const CLIENTS_KEY = 'cm_clients';
const SETTINGS_KEY = 'cm_settings';

export function getClients(): Client[] {
  const data = localStorage.getItem(CLIENTS_KEY);
  if (!data) return [];
  return (JSON.parse(data) as Partial<Client>[]).map((client) => ({
    trustRenewal: false,
    trustPaymentDate: null,
    trustOriginalDueDate: null,
    ultimaRenovacao: null,
    mesesRenovados: 1,
    ...client,
  })) as Client[];
}

export function saveClients(clients: Client[]): void {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

export function getSettings(): Settings {
  const data = localStorage.getItem(SETTINGS_KEY);
  if (!data) return defaultSettings();
  const parsed = JSON.parse(data) as Partial<Settings>;
  // Merge with defaults to handle new fields added after initial save
  return { ...defaultSettings(), ...parsed };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function defaultSettings(): Settings {
  return {
    whatsappTemplate:
      '{saudacao} {nome}! Sua assinatura no valor de R$ {valor} vence em {vencimento}. Dados para pagamento:\nChave PIX: {chave_pix}\nBanco: {banco}\nBeneficiario: {beneficiario}',
    whatsappTemplateConfianca:
      '{saudacao} {nome}! Passando para lembrar que hoje ({data_promessa}) e o dia combinado para o pagamento da sua assinatura (R$ {valor}). Dados para pagamento:\nChave PIX: {chave_pix}\nBanco: {banco}\nBeneficiario: {beneficiario}\n\nAgradeco a confianca!',
    whatsappTemplateExpirado:
      '{saudacao} {nome}! Sua assinatura expirou em {vencimento}. Para reativar o acesso, realize o pagamento de R$ {valor}.\nChave PIX: {chave_pix}\nBanco: {banco}\nBeneficiario: {beneficiario}\n\nQualquer duvida estou a disposicao!',
    whatsappTemplateExpirado1Dia:
      '⚠️ {saudacao} {nome}! Seu acesso EXPIROU ontem ({vencimento})! Para nao ficar sem assistir, faca a renovacao AGORA no valor de R$ {valor}.\nChave PIX: {chave_pix}\nBanco: {banco}\nBeneficiario: {beneficiario}\n\nMe avise assim que pagar para eu reativar seu acesso!',
    defaultChavePix: '',
    defaultBanco: '',
    defaultBeneficiario: '',
    servidores: [],
    variaveisPersonalizadas: {},
    whatsappServerUrl: '',
    whatsappServerKey: '',
    ignoreRenewalServerCost: false,
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}
