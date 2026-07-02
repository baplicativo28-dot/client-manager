export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'reseller';
  blocked: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface Client {
  id: string;
  nome: string;
  valor: number;
  celular: string;
  servidor: string;
  dataVencimento: string;
  situacao: 'Assinou' | 'Renovou' | 'Não Renovou' | 'Inadimplente';
  desativado: boolean;
  lembreteEnviado: boolean;
  criadoEm: string;
  trustRenewal: boolean;
  trustPaymentDate: string | null;
  trustActivationDate?: string | null;
  trustOriginalDueDate?: string | null;
  lastReminderResetDate?: string | null;
  ultimaRenovacao: string | null;
  mesesRenovados: number;
  observacao?: string;
}

export type StatusCalculado = 'Ativo' | 'Expirando' | 'Expirado';

export type FilterTab = 'Todos' | 'Ativos' | 'Expirando' | 'Expirados' | 'Em Confianca' | 'Desativados';

export interface ServerCost {
  id: string;
  nome: string;
  custo: number;
}

export interface Settings {
  whatsappTemplate: string;
  whatsappTemplateConfianca: string;
  whatsappTemplateExpirado: string;
  whatsappTemplateExpirado1Dia: string;
  defaultChavePix: string;
  defaultBanco: string;
  defaultBeneficiario: string;
  servidores: ServerCost[];
  variaveisPersonalizadas: Record<string, string>;
  whatsappServerUrl?: string;
  whatsappServerKey?: string;
  ignoreRenewalServerCost?: boolean;
}

export type FinanceEntryType = 'venda' | 'despesa';
export type FinanceCategory = 'licenca' | 'aparelho' | 'fornecedor' | 'rotina' | 'outro';

export interface FinanceProduct {
  id: string;
  nome: string;
  categoria: FinanceCategory;
  custo: number;
  valorVenda: number;
  criadoEm: string;
}

export interface FinanceEntry {
  id: string;
  tipo: FinanceEntryType;
  categoria: FinanceCategory;
  descricao: string;
  custo: number;
  valorVenda: number;
  quantidade: number;
  data: string;
  observacao?: string;
  productId?: string | null;
  criadoEm: string;
}
