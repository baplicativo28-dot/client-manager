import { useMemo } from 'react';
import type { Client, FinanceEntry, Settings } from '../types';
import { defaultSettings } from '../utils/storage';
import { buildFinancialTotalsByMonth, calcularStatus, formatarValor } from '../utils/helpers';

interface Props {
  clients: Client[];
  settings: Settings | null | undefined;
  financeEntries?: FinanceEntry[];
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function FinancialSummary({ clients, settings, financeEntries = [] }: Props) {
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeSettings = settings || defaultSettings();
  const safeEntries = Array.isArray(financeEntries) ? financeEntries : [];

  const activeClients = safeClients.filter((c) => !c.desativado);
  const hoje = new Date();
  const mesAtual = getMonthKey(hoje);

  const totalsByMonth = buildFinancialTotalsByMonth(safeClients, safeSettings, safeEntries);
  const selectedMonth = mesAtual;
  const selectedTotals = totalsByMonth[selectedMonth] || { receita: 0, despesa: 0 };
  const receitaBruta = selectedTotals.receita || 0;
  const despesas = selectedTotals.despesa || 0;
  const resultado = receitaBruta - despesas;
  const emConfianca = activeClients.filter((c) => c.trustRenewal).length;
  const activeWithServer = useMemo(() => activeClients.filter((client) => {
    const status = calcularStatus(client.dataVencimento);
    return status === 'Ativo' || status === 'Expirando';
  }), [activeClients]);
  const activeWithServerCount = activeWithServer.filter((client) => typeof client.servidor === 'string' && client.servidor.trim()).length;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Despesas</p>
          <p className="text-xl font-semibold text-danger">{formatarValor(despesas)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Receita Bruta</p>
          <p className="text-xl font-semibold text-success">{formatarValor(receitaBruta)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Resultado</p>
          <p className={`text-xl font-semibold ${resultado >= 0 ? 'text-success' : 'text-danger'}`}>
            {formatarValor(resultado)}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Em Confianca</p>
          <p className="text-xl font-semibold text-warning">{emConfianca}</p>
          <p className="text-xs text-gray-500 mt-2">Ativos/expirando com servidor: {activeWithServerCount}</p>
        </div>
      </div>
    </div>
  );
}
