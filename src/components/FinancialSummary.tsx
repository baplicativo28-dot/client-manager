import { useMemo, useState } from 'react';
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

function getMonthName(yearMonth: string): string {
  if (!yearMonth || yearMonth.length < 7 || !yearMonth.includes('-')) return '';
  const [year, month] = yearMonth.split('-').map(Number);
  if (!year || !month || Number.isNaN(year) || Number.isNaN(month)) return '';
  const date = new Date(year, month - 1);
  return date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
}

export function FinancialSummary({ clients, settings, financeEntries = [] }: Props) {
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeSettings = settings || defaultSettings();
  const safeEntries = Array.isArray(financeEntries) ? financeEntries : [];

  const activeClients = safeClients.filter((c) => !c.desativado);
  const hoje = new Date();
  const mesAtual = getMonthKey(hoje);

  const totalsByMonth = buildFinancialTotalsByMonth(safeClients, safeSettings, safeEntries);
  const receitaPorMes: Record<string, number> = {};
  const despesaPorMes: Record<string, number> = {};
  const mesesDisponiveis: string[] = [];

  Object.entries(totalsByMonth)
    .filter(([, totals]) => (totals.receita || 0) > 0 || (totals.despesa || 0) > 0)
    .filter(([key]) => key >= getMonthKey(hoje))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .forEach(([key, totals]) => {
      mesesDisponiveis.push(key);
      receitaPorMes[key] = totals.receita || 0;
      despesaPorMes[key] = totals.despesa || 0;
    });

  const [mesSelecionado, setMesSelecionado] = useState(mesAtual);
  const selectedMonth = mesesDisponiveis.includes(mesSelecionado) ? mesSelecionado : (mesesDisponiveis[mesesDisponiveis.length - 1] || mesAtual);

  const receitaBruta = receitaPorMes[selectedMonth] || 0;
  const despesas = despesaPorMes[selectedMonth] || 0;
  const resultado = receitaBruta - despesas;
  const emConfianca = activeClients.filter((c) => c.trustRenewal).length;
  const activeWithServer = useMemo(() => activeClients.filter((client) => {
    const status = calcularStatus(client.dataVencimento);
    return status === 'Ativo' || status === 'Expirando';
  }), [activeClients]);
  const activeWithServerCount = activeWithServer.filter((client) => typeof client.servidor === 'string' && client.servidor.trim()).length;

  return (
    <div className="mb-6">
      {/* Month selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {mesesDisponiveis.map((mes) => (
          <button
            key={mes}
            onClick={() => setMesSelecionado(mes)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              mes === selectedMonth
                ? 'bg-accent text-white'
                : 'bg-card border border-border hover:bg-gray-50'
            }`}
          >
            {getMonthName(mes)}
          </button>
        ))}
      </div>

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
