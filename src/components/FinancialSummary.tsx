import { useMemo, useState } from 'react';
import type { Client, FinanceEntry, Settings } from '../types';
import { buildFinancialTotalsByMonth, formatarValor } from '../utils/helpers';

interface Props {
  clients: Client[];
  settings: Settings;
  financeEntries?: FinanceEntry[];
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthName(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
}

export function FinancialSummary({ clients, settings, financeEntries = [] }: Props) {
  const activeClients = clients.filter((c) => !c.desativado);
  const hoje = new Date();
  const mesAtual = getMonthKey(hoje);

  const totalsByMonth = buildFinancialTotalsByMonth(clients, settings, financeEntries);
  const receitaPorMes: Record<string, number> = {};
  const despesaPorMes: Record<string, number> = {};
  const mesesDisponiveis: string[] = [];

  for (let i = 2; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const key = getMonthKey(d);
    mesesDisponiveis.push(key);
    receitaPorMes[key] = totalsByMonth[key]?.receita || 0;
    despesaPorMes[key] = totalsByMonth[key]?.despesa || 0;
  }

  const [mesSelecionado, setMesSelecionado] = useState(mesAtual);

  const receitaBruta = receitaPorMes[mesSelecionado] || 0;
  const despesas = despesaPorMes[mesSelecionado] || 0;
  const resultado = receitaBruta - despesas;
  const emConfianca = activeClients.filter((c) => c.trustRenewal).length;
  const activeWithServer = useMemo(() => activeClients.filter((client) => {
    const status = (() => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const [y, m, d] = client.dataVencimento.split('-').map(Number);
      const vencimento = new Date(y, m - 1, d);
      const diffDays = Math.round((vencimento.getTime() - hoje.getTime()) / 86400000);
      if (diffDays > 1) return 'Ativo';
      if (diffDays === 1) return 'Expirando';
      return 'Expirado';
    })();
    return status === 'Ativo' || status === 'Expirando';
  }), [activeClients]);
  const activeWithServerCount = activeWithServer.filter((client) => client.servidor && client.servidor.trim()).length;

  return (
    <div className="mb-6">
      {/* Month selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {mesesDisponiveis.map((mes) => (
          <button
            key={mes}
            onClick={() => setMesSelecionado(mes)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              mes === mesSelecionado
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
