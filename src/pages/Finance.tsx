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
  const totalsByMonth = useMemo(
    () => buildFinancialTotalsByMonth(clients, settings, entries),
    [clients, entries, settings],
  );

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    [products],
  );

  const months = useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    entries.forEach((entry) => keys.add(getMonthKeyFromIsoDate(entry.data)));
    Object.keys(totalsByMonth).forEach((month) => keys.add(month));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [currentMonth, entries, totalsByMonth]);

  const filteredEntries = useMemo(
    () => entries
      .filter((entry) => getMonthKeyFromIsoDate(entry.data) === selectedMonth)
      .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)),
    [entries, selectedMonth],
  );
  const totals = totalsByMonth[selectedMonth] || { receitas: 0, despesa: 0 };
  const previousMonthKey = getPreviousMonthKey(selectedMonth);
  const previousTotals = totalsByMonth[previousMonthKey] || null;
  const chartItems = [
    previousTotals
      ? {
          label: getMonthLabel(previousMonthKey),
          value: previousTotals.receita,
          color: 'bg-gray-300',
        }
      : null,
    {
      label: getMonthLabel(selectedMonth),
      value: totals.receita,
      color: 'bg-accent',
    },
  ].filter(Boolean) as { label: string; value: number; color: string }[];
  const maxChartValue = Math.max(...chartItems.map((item) => item.value), 1);

  const profit = totals.receita - totals.despesa;

  const resetEntryForm = () => {
    setEditingEntryId(null);
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
    const selected = products.find((item) => item.id === productId);
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
    setProductForm({
      nome: '',
      categoria: 'licenca',
      custo: '',
      valorVenda: '',
    });
  };

  const handleEditProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setEditingProductId(product.id);
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
    const product = products.find((item) => item.id === productId);
    const name = product?.nome || 'este produto';
    if (!window.confirm(`Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    deleteProduct(productId);
  };

  const handleDeleteEntry = (entryId: string) => {
    const entry = entries.find((item) => item.id === entryId);
    const name = entry?.descricao || 'este lançamento';
    if (!window.confirm(`Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`)) return;
    deleteEntry(entryId);
  };

  const handleEditEntry = (entryId: string) => {
    const entry = entries.find((item) => item.id === entryId);
    if (!entry) return;
    setEditingEntryId(entry.id);
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

  if (financeLoading || clientsLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-gray-500">Carregando financeiro...</div>
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
        {months.map((month) => (
          <button
            key={month}
            type="button"
            onClick={() => setSelectedMonth(month)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              month === selectedMonth ? 'bg-accent text-white' : 'bg-card border border-border hover:bg-gray-50'
            }`}
          >
            {getMonthLabel(month)}
          </button>
        ))}
      </div>

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
            {chartItems.map((item) => (
              <div key={item.label} className="flex-1 flex flex-col items-center gap-3">
                <div className="w-full max-w-28 h-48 bg-gray-100 rounded-xl flex items-end p-2">
                  <div
                    className={`${item.color} w-full rounded-lg transition-all`}
                    style={{ height: `${Math.max((item.value / maxChartValue) * 100, item.value > 0 ? 10 : 4)}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 capitalize">{item.label}</p>
                  <p className="text-sm font-semibold">{formatarValor(item.value)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="rounded-xl bg-gray-50 border border-border p-4">
              <p className="text-sm text-gray-500">Mês selecionado</p>
              <p className="text-lg font-semibold capitalize">{getMonthLabel(selectedMonth)}</p>
              <p className="text-xl font-bold text-success mt-2">{formatarValor(totals.receita)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-border p-4">
              <p className="text-sm text-gray-500">Mês anterior</p>
              {previousTotals ? (
                <>
                  <p className="text-lg font-semibold capitalize">{getMonthLabel(previousMonthKey)}</p>
                  <p className="text-xl font-bold mt-2">{formatarValor(previousTotals.receita)}</p>
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
            <h2 className="text-lg font-semibold">{editingProductId ? 'Editar produto recorrente' : 'Produtos recorrentes'}</h2>
            {editingProductId && (
              <button
                type="button"
                onClick={resetProductForm}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Cancelar edição
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              value={productForm.nome}
              onChange={(e) => setProductForm((current) => ({ ...current, nome: e.target.value }))}
              placeholder="Nome do produto"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <select
              value={productForm.categoria}
              onChange={(e) => setProductForm((current) => ({ ...current, categoria: e.target.value as FinanceCategory }))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={productForm.custo}
              onChange={(e) => setProductForm((current) => ({ ...current, custo: e.target.value }))}
              placeholder="Custo"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={productForm.valorVenda}
              onChange={(e) => setProductForm((current) => ({ ...current, valorVenda: e.target.value }))}
              placeholder="Valor de venda"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="button"
            onClick={handleAddProduct}
            className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            {editingProductId ? 'Salvar alteração' : 'Salvar produto'}
          </button>

          <div className="mt-5 space-y-3">
            {sortedProducts.length === 0 && <p className="text-sm text-gray-500">Nenhum produto cadastrado.</p>}
            {sortedProducts.map((product) => (
              <div key={product.id} className="border border-border rounded-xl p-4 flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleEditProduct(product.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="font-medium">{product.nome}</p>
                  <p className="text-sm text-gray-500">{categoryLabels[product.categoria]}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Custo: {formatarValor(product.custo)} • Venda: {formatarValor(product.valorVenda)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(product.id)}
                  className="text-xs text-red-600 font-medium hover:underline"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">{editingEntryId ? 'Editar lançamento' : 'Lançar venda ou despesa'}</h2>
            {editingEntryId && (
              <button
                type="button"
                onClick={resetEntryForm}
                className="text-sm font-medium text-gray-500 hover:text-gray-800"
              >
                Cancelar edição
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={entryForm.productId}
              onChange={(e) => applyProductToForm(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent sm:col-span-2"
            >
              <option value="">Selecionar produto cadastrado (opcional)</option>
              {sortedProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.nome}</option>
              ))}
            </select>
            <select
              value={entryForm.tipo}
              onChange={(e) => setEntryForm((current) => ({ ...current, tipo: e.target.value as FinanceEntryType }))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {Object.entries(entryTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={entryForm.categoria}
              onChange={(e) => setEntryForm((current) => ({ ...current, categoria: e.target.value as FinanceCategory }))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input
              type="text"
              value={entryForm.descricao}
              onChange={(e) => setEntryForm((current) => ({ ...current, descricao: e.target.value }))}
              placeholder="Descrição"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent sm:col-span-2"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryForm.custo}
              onChange={(e) => setEntryForm((current) => ({ ...current, custo: e.target.value }))}
              placeholder="Quanto pagou"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={entryForm.valorVenda}
              onChange={(e) => setEntryForm((current) => ({ ...current, valorVenda: e.target.value }))}
              placeholder="Quanto vendeu"
              disabled={entryForm.tipo !== 'venda'}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100"
            />
            <input
              type="number"
              min="1"
              step="1"
              value={entryForm.quantidade}
              onChange={(e) => setEntryForm((current) => ({ ...current, quantidade: e.target.value }))}
              placeholder="Quantidade"
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="date"
              value={entryForm.data}
              onChange={(e) => setEntryForm((current) => ({ ...current, data: e.target.value }))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <textarea
              value={entryForm.observacao}
              onChange={(e) => setEntryForm((current) => ({ ...current, observacao: e.target.value }))}
              placeholder="Observação (opcional)"
              rows={3}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-accent sm:col-span-2"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveEntry}
            className="mt-4 bg-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            {editingEntryId ? 'Salvar alteração' : 'Salvar lançamento'}
          </button>
        </div>
      </div>

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
    </div>
  );
}
