import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClients } from '../hooks/useClients';
import { useFinance } from '../hooks/useFinance';
import { useSettings } from '../hooks/useSettings';
import type { FinanceCategory, FinanceEntryType } from '../types';
import {
  buildFinancialTotalsByMonth,
  formatarValor,
  getMonthKeyFromIsoDate,
  getMonthLabel,
  getPreviousMonthKey,
} from '../utils/helpers';
import { ConfirmDialog, type ConfirmDialogState } from '../components/ConfirmDialog';

interface FinancePageProps {
  uid: string;
  onLogout: () => void;
}

const categoryLabels: Record<FinanceCategory, string> = {
  licenca: 'Licença',
  aparelho: 'Aparelho',
  fornecedor: 'Fornecedor',
  rotina: 'Rotina',
  outro: 'Outro',
};

const entryTypeLabels: Record<FinanceEntryType, string> = {
  venda: 'Venda',
  despesa: 'Despesa',
};

export function FinancePage({ uid, onLogout }: FinancePageProps) {
  const { clients, loading: clientsLoading } = useClients(uid);
  const {
    entries,
    products,
    loading: financeLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useFinance(uid);
  const { settings, loading: settingsLoading } = useSettings(uid);

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({
    productId: '',
    tipo: 'venda' as FinanceEntryType,
    categoria: 'licenca' as FinanceCategory,
    descricao: '',
    custo: '',
    valorVenda: '',
    quantidade: '1',
    data: today,
    observacao: '',
  });
  const [productForm, setProductForm] = useState({
    nome: '',
    categoria: 'licenca' as FinanceCategory,
    custo: '',
    valorVenda: '',
  });
  const safeClients = Array.isArray(clients) ? clients : [];
  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeSettings = settings || { servidores: [] };
  const monthHasMovement = (monthKey: string) => {
    const monthTotals = totalsByMonth[monthKey];
    return (
      (monthTotals?.receita || 0) > 0 ||
      (monthTotals?.despesa || 0) > 0 ||
      safeEntries.some((entry) => getMonthKeyFromIsoDate(entry.data) === monthKey)
    );
  };

  const totalsByMonth = useMemo(
    () => buildFinancialTotalsByMonth(safeClients, safeSettings, safeEntries),
    [safeClients, safeEntries, safeSettings],
  );

  const sortedProducts = useMemo(
    () => [...safeProducts].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    [safeProducts],
  );

  const months = useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    safeEntries.forEach((entry) => keys.add(getMonthKeyFromIsoDate(entry.data)));
    Object.keys(totalsByMonth).forEach((month) => keys.add(month));
    Array.from(keys).forEach((month) => {
      const previous = getPreviousMonthKey(month);
      if (previous && monthHasMovement(previous)) keys.add(previous);
    });
    return Array.from(keys)
      .filter((month) => monthHasMovement(month) || month === currentMonth)
      .sort((a, b) => b.localeCompare(a));
  }, [currentMonth, safeEntries, totalsByMonth]);
  const safeMonths = months;

  const hasFinanceData = months.some((month) => {
    const monthTotals = totalsByMonth[month];
    return (monthTotals?.receita || 0) > 0 || (monthTotals?.despesa || 0) > 0 || safeEntries.some((entry) => getMonthKeyFromIsoDate(entry.data) === month);
  });

  const effectiveSelectedMonth = months.includes(selectedMonth) ? selectedMonth : (months[0] || currentMonth);

  const filteredEntries = useMemo(
    () => safeEntries
      .filter((entry) => typeof entry?.data === 'string' && getMonthKeyFromIsoDate(entry.data) === effectiveSelectedMonth)
      .sort((a, b) => (String(b.data).localeCompare(String(a.data))) || (String(b.criadoEm).localeCompare(String(a.criadoEm)))),
    [safeEntries, effectiveSelectedMonth],
  );
  const totals = totalsByMonth[effectiveSelectedMonth] || { receita: 0, despesa: 0 };
  const previousMonthKey = getPreviousMonthKey(effectiveSelectedMonth);
  const previousTotals = totalsByMonth[previousMonthKey] || null;
  const chartItems = [
    previousTotals
      ? {
          label: getMonthLabel(previousMonthKey),
          receita: previousTotals.receita,
          despesa: previousTotals.despesa,
          color: 'bg-gray-300',
        }
      : null,
    {
      label: getMonthLabel(effectiveSelectedMonth),
      receita: totals.receita,
      despesa: totals.despesa,
      color: 'bg-accent',
    },
  ].filter(Boolean) as { label: string; receita: number; despesa: number; color: string }[];
  const maxChartValue = Math.max(...chartItems.flatMap((item) => [item.receita, item.despesa]), 1);

  const profit = totals.receita - totals.despesa;

  const resetEntryForm = () => {
    setEditingEntryId(null);
    setShowEntryModal(false);
    setEntryForm({
      productId: '',
      tipo: 'venda',
      categoria: 'licenca',
      descricao: '',
      custo: '',
      valorVenda: '',
      quantidade: '1',
      data: today,
      observacao: '',
    });
  };

  const applyProductToForm = (productId: string) => {
    const selected = safeProducts.find((item) => item.id === productId);
    if (!selected) {
      setEntryForm((current) => ({ ...current, productId: '', descricao: '', custo: '', valorVenda: '' }));
      return;
    }
    setEntryForm((current) => ({
      ...current,
      productId,
      descricao: selected.nome,
      categoria: selected.categoria,
      custo: String(selected.custo),
      valorVenda: String(selected.valorVenda),
      tipo: 'venda',
    }));
  };

  const handleDescriptionChange = (descricao: string) => {
    setEntryForm((current) => {
      if (current.productId) {
        return current;
      }
      return { ...current, descricao };
    });
  };

  const selectedProductName = safeProducts.find((item) => item.id === entryForm.productId)?.nome || '';

  const handleAddProduct = () => {
    if (!productForm.nome.trim()) return;
    const payload = {
      nome: productForm.nome.trim(),
      categoria: productForm.categoria,
      custo: Number(productForm.custo) || 0,
      valorVenda: Number(productForm.valorVenda) || 0,
    };

    if (editingProductId) {
      updateProduct(editingProductId, payload);
    } else {
      addProduct(payload);
    }

    setEditingProductId(null);
    setShowProductModal(false);
    setProductForm({
      nome: '',
      categoria: 'licenca',
      custo: '',
      valorVenda: '',
    });
  };

  const handleEditProduct = (productId: string) => {
    const product = safeProducts.find((item) => item.id === productId);
    if (!product) return;
    setEditingProductId(product.id);
    setShowProductModal(true);
    setProductForm({
      nome: product.nome,
      categoria: product.categoria,
      custo: String(product.custo),
      valorVenda: String(product.valorVenda),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setShowProductModal(false);
    setProductForm({
      nome: '',
      categoria: 'licenca',
      custo: '',
      valorVenda: '',
    });
  };

  const handleSaveEntry = () => {
    if (!entryForm.descricao.trim() || !entryForm.data) return;
    const payload = {
      productId: entryForm.productId || null,
      tipo: entryForm.tipo,
      categoria: entryForm.categoria,
      descricao: entryForm.descricao.trim(),
      custo: Number(entryForm.custo) || 0,
      valorVenda: entryForm.tipo === 'venda' ? Number(entryForm.valorVenda) || 0 : 0,
      quantidade: Number(entryForm.quantidade) || 1,
      data: entryForm.data,
      observacao: entryForm.observacao.trim(),
    };

    if (editingEntryId) {
      updateEntry(editingEntryId, payload);
    } else {
      addEntry(payload);
    }

    resetEntryForm();
  };

  const handleDeleteProduct = (productId: string) => {
    const product = safeProducts.find((item) => item.id === productId);
    const name = product?.nome || 'este produto';
    setConfirmDialog({
      title: 'Client Manager',
      message: `Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      destructive: true,
      onConfirm: () => deleteProduct(productId),
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    const entry = safeEntries.find((item) => item.id === entryId);
    const name = entry?.descricao || 'este lançamento';
    setConfirmDialog({
      title: 'Client Manager',
      message: `Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      destructive: true,
      onConfirm: () => deleteEntry(entryId),
    });
  };

  const handleExportPDF = () => {
    const selectedTotals = totalsByMonth[effectiveSelectedMonth] || { receita: 0, despesa: 0 };
    const selectedProfit = selectedTotals.receita - selectedTotals.despesa;
    const selectedEntries = safeEntries.filter((entry) => getMonthKeyFromIsoDate(entry.data) === effectiveSelectedMonth);
    const recurringExpenseSummary = safeEntries
      .filter((entry) => entry.tipo === 'despesa' && getMonthKeyFromIsoDate(entry.data) === effectiveSelectedMonth)
      .reduce((acc, entry) => {
        const key = `${entry.tipo}__${entry.categoria}__${String(entry.descricao || '').trim().toLowerCase()}`;
        if (!acc[key]) {
          acc[key] = {
            descricao: entry.descricao,
            categoria: entry.categoria,
            tipo: entry.tipo,
            custoTotal: 0,
            valorTotal: 0,
            quantidade: 0,
          };
        }
        acc[key].quantidade += entry.quantidade || 1;
        acc[key].custoTotal += (entry.custo || 0) * (entry.quantidade || 1);
        acc[key].valorTotal += (entry.valorVenda || 0) * (entry.quantidade || 1);
        return acc;
      }, {} as Record<string, {
        descricao: string;
        categoria: FinanceCategory;
        tipo: FinanceEntryType;
        custoTotal: number;
        valorTotal: number;
        quantidade: number;
      }>);
    const recurringExpenseItems = Object.values(recurringExpenseSummary)
      .filter((item) => item.quantidade >= 1)
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' }));
    const comparisonMonths = [
      previousMonthKey ? { key: previousMonthKey, label: getMonthLabel(previousMonthKey), totals: previousTotals } : null,
      { key: effectiveSelectedMonth, label: getMonthLabel(effectiveSelectedMonth), totals },
    ].filter(Boolean) as Array<{ key: string; label: string; totals: { receita: number; despesa: number } }>;
    const reportMonths = comparisonMonths.length >= 2
      ? comparisonMonths
      : [
          { key: effectiveSelectedMonth, label: getMonthLabel(effectiveSelectedMonth), totals },
          previousMonthKey ? { key: previousMonthKey, label: getMonthLabel(previousMonthKey), totals: previousTotals || { receita: 0, despesa: 0 } } : null,
        ].filter(Boolean) as Array<{ key: string; label: string; totals: { receita: number; despesa: number } }>;
    const reportMaxValue = Math.max(
      ...reportMonths.flatMap((item) => [item.totals?.receita || 0, item.totals?.despesa || 0, Math.abs((item.totals?.receita || 0) - (item.totals?.despesa || 0))]),
      1,
    );
    const html = `
      <html>
        <head>
          <title>Relatório Financeiro</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            h2 { margin: 24px 0 8px; font-size: 18px; }
            .meta { margin-bottom: 6px; font-size: 14px; }
            .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; margin: 8px 0; }
            .muted { color: #6b7280; }
            ul { padding-left: 18px; }
            .chart { margin-top: 20px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
            .comparison-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 12px; }
            .comparison-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
            .comparison-bars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: end; min-height: 210px; margin-top: 12px; }
            .comparison-column { display: flex; flex-direction: column; align-items: center; justify-content: end; gap: 8px; min-height: 210px; }
            .comparison-stack { width: 100%; height: 170px; display: flex; flex-direction: column; justify-content: end; align-items: center; gap: 6px; }
            .comparison-bar { width: 60px; border-radius: 8px 8px 0 0; min-height: 8px; }
            .comparison-label { font-size: 11px; color: #6b7280; text-align: center; }
            .comparison-value { font-size: 13px; font-weight: 700; text-align: center; }
            .green-bar { background: #16a34a; }
            .red-bar { background: #dc2626; }
            .blue-bar { background: #2563eb; }
            .legend { display: flex; gap: 12px; font-size: 12px; color: #6b7280; margin-top: 10px; }
            .legend span { display: inline-flex; align-items: center; gap: 6px; }
            .dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
          </style>
        </head>
        <body>
          <h1>Relatório Financeiro</h1>
          <div class="meta"><strong>Mês:</strong> ${getMonthLabel(effectiveSelectedMonth)}</div>
          <div class="card"><strong>Receita:</strong> ${formatarValor(selectedTotals.receita)}</div>
          <div class="card"><strong>Despesas:</strong> ${formatarValor(selectedTotals.despesa)}</div>
          <div class="card"><strong>Lucro:</strong> ${formatarValor(selectedProfit)}</div>
          <div class="card"><strong>Lançamentos do mês:</strong> ${selectedEntries.length}</div>
          ${comparisonMonths.length ? `
          <div class="chart">
            <h2>Comparativo de receita x despesa</h2>
            <div class="legend">
              <span><i class="dot" style="background:#16a34a"></i> Receita</span>
              <span><i class="dot" style="background:#dc2626"></i> Despesa</span>
              <span><i class="dot" style="background:#2563eb"></i> Resultado</span>
            </div>
            <div class="comparison-grid">
              ${reportMonths.map((item) => `
                <div class="comparison-card">
                  <strong>${item.label}</strong>
                  <div class="comparison-bars">
                    <div class="comparison-column">
                      <div class="comparison-stack">
                        <div class="comparison-bar green-bar" style="height:${Math.max(((item.totals?.receita || 0) / reportMaxValue) * 100, item.totals?.receita ? 10 : 4)}%"></div>
                      </div>
                      <div class="comparison-label">Receita</div>
                      <div class="comparison-value">${formatarValor(item.totals?.receita || 0)}</div>
                    </div>
                    <div class="comparison-column">
                      <div class="comparison-stack">
                        <div class="comparison-bar red-bar" style="height:${Math.max(((item.totals?.despesa || 0) / reportMaxValue) * 100, item.totals?.despesa ? 10 : 4)}%"></div>
                      </div>
                      <div class="comparison-label">Despesa</div>
                      <div class="comparison-value">${formatarValor(item.totals?.despesa || 0)}</div>
                    </div>
                    <div class="comparison-column">
                      <div class="comparison-stack">
                        <div class="comparison-bar blue-bar" style="height:${Math.max((Math.abs((item.totals?.receita || 0) - (item.totals?.despesa || 0)) / reportMaxValue) * 100, ((item.totals?.receita || 0) - (item.totals?.despesa || 0)) !== 0 ? 10 : 4)}%"></div>
                      </div>
                      <div class="comparison-label">Resultado</div>
                      <div class="comparison-value">${formatarValor((item.totals?.receita || 0) - (item.totals?.despesa || 0))}</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}
          <h2>Despesas recorrentes agrupadas</h2>
          <ul>
            ${recurringExpenseItems.length
              ? recurringExpenseItems.map((item) => `<li>${item.descricao} — ${item.quantidade}x — Total ${formatarValor(item.custoTotal)}</li>`).join('')
              : '<li class="muted">Nenhuma despesa recorrente lançada neste mês.</li>'}
          </ul>
          <h2>Lançamentos do mês</h2>
          ${filteredEntries.slice(0, 40).map((entry) => `<div class="card">${entry.data} | ${entry.descricao} | ${entryTypeLabels[entry.tipo]} | ${formatarValor(entry.valorVenda || entry.custo)}</div>`).join('')}
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      window.alert('O navegador bloqueou a janela do PDF. Permita pop-ups para gerar o relatório.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleEditEntry = (entryId: string) => {
    const entry = safeEntries.find((item) => item.id === entryId);
    if (!entry) return;
    setEditingEntryId(entry.id);
    setShowEntryModal(true);
    setEntryForm({
      productId: entry.productId || '',
      tipo: entry.tipo,
      categoria: entry.categoria,
      descricao: entry.descricao,
      custo: String(entry.custo),
      valorVenda: String(entry.valorVenda),
      quantidade: String(entry.quantidade || 1),
      data: entry.data,
      observacao: entry.observacao || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDialog = async () => {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    await action();
  };

  try {
    // mantém a página viva mesmo se algum dado antigo estiver inconsistente
  } catch {
    return (
      <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto flex items-center justify-center">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-gray-600">
          Não foi possível carregar os dados do financeiro, mas você já pode tentar novamente.
        </div>
      </div>
    );
  }

  if (financeLoading || clientsLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-gray-500">Carregando financeiro...</div>
      </div>
    );
  }

  if (!Array.isArray(entries) || !Array.isArray(products)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-gray-500">Preparando financeiro...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/" className="hover:text-accent">Clientes</Link>
            <span>›</span>
            <span>Financeiro</span>
          </div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-gray-500">Cadastre vendas, produtos recorrentes e despesas do dia a dia.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
            Voltar para clientes
          </Link>
          <button
            onClick={() => void onLogout()}
            className="border border-red-200 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {safeMonths.map((month) => (
          <button
            key={month}
            type="button"
            onClick={() => setSelectedMonth(month)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              month === effectiveSelectedMonth ? 'bg-accent text-white' : 'bg-card border border-border hover:bg-gray-50'
            }`}
          >
            {getMonthLabel(month)}
          </button>
        ))}
      </div>

      {!hasFinanceData && (
        <div className="mb-6 rounded-xl border border-dashed border-border bg-card p-5 text-sm text-gray-500">
          Nenhum dado financeiro ainda. Você já pode cadastrar produtos, vendas ou despesas abaixo.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Receita</p>
          <p className="text-2xl font-semibold text-success">{formatarValor(totals.receita)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Despesas</p>
          <p className="text-2xl font-semibold text-danger">{formatarValor(totals.despesa)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
          <p className="text-sm text-gray-500 mb-1">Lucro</p>
          <p className={`text-2xl font-semibold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{formatarValor(profit)}</p>
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border p-5 mb-6">
        <div className="flex flex-col gap-1 mb-4">
          <h2 className="text-lg font-semibold">Gráfico de vendas</h2>
          <p className="text-sm text-gray-500">Comparação da receita deste mês com o mês anterior, incluindo renovações e lançamentos do financeiro.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="h-64 flex items-end gap-4">
            {chartItems.map((item) => {
              const revenueHeight = Math.max((item.receita / maxChartValue) * 100, item.receita > 0 ? 10 : 4);
              const expenseHeight = Math.max((item.despesa / maxChartValue) * 100, item.despesa > 0 ? 10 : 4);
              const net = item.receita - item.despesa;
              const netHeight = Math.max((Math.abs(net) / maxChartValue) * 100, net !== 0 ? 8 : 4);
              return (
                <div key={item.label} className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-full max-w-32 h-48 bg-gray-100 rounded-xl p-3 flex flex-col justify-end">
                    <div className="flex items-end justify-around gap-3 h-full">
                      <div className="flex flex-col items-center justify-end h-full">
                        <div
                          className="w-8 bg-success rounded-t-md"
                          style={{ height: `${revenueHeight}%` }}
                        />
                        <span className="text-[11px] mt-2 text-gray-500">Receita</span>
                      </div>
                      <div className="flex flex-col items-center justify-end h-full">
                        <div
                          className="w-8 bg-danger rounded-t-md"
                          style={{ height: `${expenseHeight}%` }}
                        />
                        <span className="text-[11px] mt-2 text-gray-500">Despesa</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col items-center">
                      <div
                        className={`${net >= 0 ? 'bg-success' : 'bg-danger'} w-20 rounded-t-md`}
                        style={{ height: `${netHeight}%` }}
                      />
                      <span className="text-[11px] mt-2 text-gray-500">Resultado</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 capitalize">{item.label}</p>
                    <p className="text-sm font-semibold">{formatarValor(net)}</p>
                    <p className={`text-xs font-medium ${net >= 0 ? 'text-success' : 'text-danger'}`}>
                      {net >= 0 ? 'Positivo' : 'Negativo'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 border border-border p-4">
              <p className="text-sm text-gray-500">Mês selecionado</p>
              <p className="text-lg font-semibold capitalize">{getMonthLabel(effectiveSelectedMonth)}</p>
              <p className="text-xl font-bold text-success mt-2">{formatarValor(totals.receita)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-border p-4">
              <p className="text-sm text-gray-500">Mês anterior</p>
              {previousTotals ? (
                <>
                  <p className="text-lg font-semibold capitalize">{getMonthLabel(previousMonthKey)}</p>
                  <p className="text-xl font-bold mt-2">{formatarValor(previousTotals.receita)}</p>
                  <p className="text-sm text-gray-500">Despesa {formatarValor(previousTotals.despesa)}</p>
                  <p className={`text-sm font-medium ${previousTotals.receita - previousTotals.despesa >= 0 ? 'text-success' : 'text-danger'}`}>
                    Líquido {formatarValor(previousTotals.receita - previousTotals.despesa)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-2">Ainda não há dados do mês anterior para comparar.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Produtos recorrentes</h2>
          <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEditingProductId(null); setShowProductModal(true); setProductForm({ nome: '', categoria: 'licenca', custo: '', valorVenda: '' }); }}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                + Novo produto
              </button>
              <button
                type="button"
              onClick={() => {
                handleExportPDF();
              }}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Gerar PDF
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {sortedProducts.length === 0 && <p className="text-sm text-gray-500">Nenhum produto cadastrado.</p>}
            {sortedProducts.map((product) => (
              <div key={product.id} className="border border-border rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium">{product.nome}</p>
                  <p className="text-sm text-gray-500">{categoryLabels[product.categoria]}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Custo: {formatarValor(product.custo)} • Venda: {formatarValor(product.valorVenda)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditProduct(product.id)}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-xs text-red-600 font-medium hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {showProductModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-lg w-full max-w-lg">
              <div className="p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-xl font-semibold">{editingProductId ? 'Editar produto recorrente' : 'Novo produto recorrente'}</h3>
                  <button type="button" onClick={resetProductForm} className="text-sm font-medium text-gray-500 hover:text-gray-800">
                    Cancelar edição
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <input type="text" value={productForm.nome} onChange={(e) => setProductForm((current) => ({ ...current, nome: e.target.value }))} placeholder="Nome do produto" className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent" />
                  <select value={productForm.categoria} onChange={(e) => setProductForm((current) => ({ ...current, categoria: e.target.value as FinanceCategory }))} className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent">
                    {Object.entries(categoryLabels).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                  </select>
                  <input type="number" min="0" step="0.01" value={productForm.custo} onChange={(e) => setProductForm((current) => ({ ...current, custo: e.target.value }))} placeholder="Custo" className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent" />
                  <input type="number" min="0" step="0.01" value={productForm.valorVenda} onChange={(e) => setProductForm((current) => ({ ...current, valorVenda: e.target.value }))} placeholder="Valor de venda" className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddProduct} className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors">{editingProductId ? 'Salvar alteração' : 'Salvar produto'}</button>
                  <button type="button" onClick={resetProductForm} className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">Lançar venda ou despesa</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Produto cadastrado</label>
              <select
                value={entryForm.productId}
                onChange={(e) => applyProductToForm(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Selecionar produto cadastrado (opcional)</option>
                {sortedProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.nome}</option>
                ))}
              </select>
              {selectedProductName ? (
                <p className="mt-1 text-xs text-gray-500">Descrição preenchida automaticamente com “{selectedProductName}”.</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">Se você não selecionar um produto, pode digitar a descrição manualmente.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de lançamento</label>
              <select
                value={entryForm.tipo}
                onChange={(e) => setEntryForm((current) => ({ ...current, tipo: e.target.value as FinanceEntryType }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {Object.entries(entryTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select
                value={entryForm.categoria}
                onChange={(e) => setEntryForm((current) => ({ ...current, categoria: e.target.value as FinanceCategory }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                {entryForm.productId ? 'Descrição do produto selecionado' : 'Descrição / nome'}
              </label>
              <input
                type="text"
                value={entryForm.descricao}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                disabled={Boolean(entryForm.productId)}
                placeholder={entryForm.productId ? 'Preenchido automaticamente' : 'Digite o nome ou descrição'}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quanto pagou / custo</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entryForm.custo}
                onChange={(e) => setEntryForm((current) => ({ ...current, custo: e.target.value }))}
                placeholder="R$ 0,00"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quanto vendeu</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={entryForm.valorVenda}
                onChange={(e) => setEntryForm((current) => ({ ...current, valorVenda: e.target.value }))}
                placeholder="R$ 0,00"
                disabled={entryForm.tipo !== 'venda'}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade</label>
              <input
                type="number"
                min="1"
                step="1"
                value={entryForm.quantidade}
                onChange={(e) => setEntryForm((current) => ({ ...current, quantidade: e.target.value }))}
                placeholder="1"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input
                type="date"
                value={entryForm.data}
                onChange={(e) => setEntryForm((current) => ({ ...current, data: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Observação</label>
              <textarea
                value={entryForm.observacao}
                onChange={(e) => setEntryForm((current) => ({ ...current, observacao: e.target.value }))}
                placeholder="Opcional"
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveEntry}
            className="mt-4 bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Salvar lançamento
          </button>
        </div>
      </div>

      {showEntryModal && editingEntryId && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-2xl border border-border">
            <div className="p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-xl font-semibold">Editar lançamento</h3>
                <button type="button" onClick={resetEntryForm} className="text-sm font-medium text-gray-500 hover:text-gray-800">
                  Cancelar edição
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Produto cadastrado</label>
                  <select
                    value={entryForm.productId}
                    onChange={(e) => applyProductToForm(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">Selecionar produto cadastrado (opcional)</option>
                    {sortedProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de lançamento</label>
                  <select
                    value={entryForm.tipo}
                    onChange={(e) => setEntryForm((current) => ({ ...current, tipo: e.target.value as FinanceEntryType }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {Object.entries(entryTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <select
                    value={entryForm.categoria}
                    onChange={(e) => setEntryForm((current) => ({ ...current, categoria: e.target.value as FinanceCategory }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Descrição / nome</label>
                  <input
                    type="text"
                    value={entryForm.descricao}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    disabled={Boolean(entryForm.productId)}
                    placeholder={entryForm.productId ? 'Preenchido automaticamente' : 'Digite o nome ou descrição'}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quanto pagou / custo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entryForm.custo}
                    onChange={(e) => setEntryForm((current) => ({ ...current, custo: e.target.value }))}
                    placeholder="R$ 0,00"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quanto vendeu</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entryForm.valorVenda}
                    onChange={(e) => setEntryForm((current) => ({ ...current, valorVenda: e.target.value }))}
                    placeholder="R$ 0,00"
                    disabled={entryForm.tipo !== 'venda'}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={entryForm.quantidade}
                    onChange={(e) => setEntryForm((current) => ({ ...current, quantidade: e.target.value }))}
                    placeholder="1"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Data</label>
                  <input
                    type="date"
                    value={entryForm.data}
                    onChange={(e) => setEntryForm((current) => ({ ...current, data: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">Observação</label>
                  <textarea
                    value={entryForm.observacao}
                    onChange={(e) => setEntryForm((current) => ({ ...current, observacao: e.target.value }))}
                    placeholder="Opcional"
                    rows={3}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleSaveEntry}
                  className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
                >
                  Salvar alteração
                </button>
                <button
                  type="button"
                  onClick={resetEntryForm}
                  className="border border-border rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Lançamentos do mês</h2>
        </div>
        <div className="divide-y divide-border">
          {filteredEntries.length === 0 && (
            <p className="p-5 text-sm text-gray-500">Nenhum lançamento neste mês.</p>
          )}
          {filteredEntries.map((entry) => {
            const quantity = entry.quantidade || 1;
            const expense = entry.custo * quantity;
            const revenue = entry.tipo === 'venda' ? entry.valorVenda * quantity : 0;
            const result = revenue - expense;

            return (
              <div key={entry.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{entry.descricao}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.tipo === 'venda' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {entryTypeLabels[entry.tipo]}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {categoryLabels[entry.categoria]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Data: {new Date(entry.data + 'T00:00:00').toLocaleDateString('pt-BR')} · Quantidade: {quantity}
                  </p>
                  {entry.observacao && <p className="text-sm text-gray-600 mt-1">{entry.observacao}</p>}
                </div>
                <div className="text-sm md:text-right">
                  <p className="text-gray-500">Despesa: <span className="text-danger font-medium">{formatarValor(expense)}</span></p>
                  {entry.tipo === 'venda' && (
                    <p className="text-gray-500">Receita: <span className="text-success font-medium">{formatarValor(revenue)}</span></p>
                  )}
                  <p className={`font-semibold ${result >= 0 ? 'text-success' : 'text-danger'}`}>
                    Resultado: {formatarValor(result)}
                  </p>
                  <div className="mt-2 flex items-center gap-3 md:justify-end">
                    <button
                      type="button"
                      onClick={() => handleEditEntry(entry.id)}
                      className="text-xs text-accent font-medium hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-xs text-red-600 font-medium hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          dialog={confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => void handleConfirmDialog()}
        />
      )}
    </div>
  );
}
