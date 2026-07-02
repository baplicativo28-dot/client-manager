import { useState } from 'react';
import type { Client, ServerCost } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Client, 'id' | 'desativado' | 'lembreteEnviado' | 'situacao'>) => void;
  onUpdate?: (id: string, data: Partial<Client>) => void;
  editingClient?: Client | null;
  servidores: ServerCost[];
}

export function ClientModal({ isOpen, onClose, onSave, onUpdate, editingClient, servidores }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [form, setForm] = useState({
    nome: editingClient?.nome ?? '',
    valor: editingClient?.valor?.toString() ?? '',
    celular: editingClient?.celular ?? '',
    servidor: editingClient?.servidor ?? '',
    dataVencimento: editingClient?.dataVencimento ?? '',
    criadoEm: editingClient?.criadoEm?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    situacao: editingClient?.situacao ?? 'Assinou' as Client['situacao'],
    trustRenewal: editingClient?.trustRenewal ?? false,
    trustPaymentDate: editingClient?.trustPaymentDate ?? null,
    trustOriginalDueDate: editingClient?.trustOriginalDueDate ?? null,
    observacao: editingClient?.observacao ?? '',
  });

  if (!isOpen) return null;

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setSaveStatus('idle');
    const data: Record<string, unknown> = {
      nome: form.nome,
      valor: parseFloat(form.valor) || 0,
      celular: form.celular,
      servidor: form.servidor,
      dataVencimento: form.dataVencimento,
      criadoEm: form.criadoEm ? form.criadoEm + 'T00:00:00.000Z' : new Date().toISOString(),
      situacao: form.situacao,
      trustRenewal: form.trustRenewal,
      trustPaymentDate: form.trustPaymentDate,
      trustOriginalDueDate: form.trustOriginalDueDate,
      observacao: form.observacao,
    };

    if (editingClient && onUpdate) {
      const createdAt = editingClient.criadoEm?.split('T')[0] ?? '';
      const original = {
        nome: editingClient.nome,
        valor: editingClient.valor.toString(),
        celular: editingClient.celular,
        servidor: editingClient.servidor,
        dataVencimento: editingClient.dataVencimento,
        criadoEm: createdAt,
        situacao: editingClient.situacao,
        trustRenewal: String(editingClient.trustRenewal),
        trustPaymentDate: editingClient.trustPaymentDate ?? '',
        trustOriginalDueDate: editingClient.trustOriginalDueDate ?? '',
        observacao: editingClient.observacao ?? '',
      };

      const hasChanges =
        normalize(form.nome) !== normalize(original.nome) ||
        String(parseFloat(form.valor) || 0) !== original.valor ||
        normalize(form.celular) !== normalize(original.celular) ||
        normalize(form.servidor) !== normalize(original.servidor) ||
        form.dataVencimento !== original.dataVencimento ||
        form.criadoEm !== original.criadoEm ||
        form.situacao !== original.situacao ||
        String(form.trustRenewal) !== original.trustRenewal ||
        (form.trustPaymentDate ?? '') !== original.trustPaymentDate ||
        (form.trustOriginalDueDate ?? '') !== original.trustOriginalDueDate ||
        normalize(form.observacao) !== normalize(original.observacao);

      data.ultimaRenovacao = editingClient.ultimaRenovacao ?? null;
      data.mesesRenovados = editingClient.mesesRenovados ?? 1;
      data.trustActivationDate = editingClient.trustActivationDate;
      if (!hasChanges) data.lembreteEnviado = false;
      Promise.resolve(onUpdate(editingClient.id, data))
        .then(() => {
          setSaveStatus('saved');
          onClose();
        })
        .catch(() => {
          setSaveStatus('failed');
        })
        .finally(() => setIsSaving(false));
    } else {
      Promise.resolve(onSave(data as Omit<Client, 'id' | 'desativado' | 'lembreteEnviado' | 'situacao'>))
        .then(() => {
          setSaveStatus('saved');
          onClose();
        })
        .catch(() => {
          setSaveStatus('failed');
        })
        .finally(() => setIsSaving(false));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Celular</label>
                <input
                  type="text"
                  required
                  value={form.celular}
                  onChange={(e) => setForm({ ...form, celular: e.target.value })}
                  placeholder="5511999999999"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Servidor</label>
                <select
                  value={form.servidor}
                  onChange={(e) => setForm({ ...form, servidor: e.target.value })}
                  disabled={servidores.length === 0}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:bg-gray-100 disabled:text-gray-400"
                >
                  {servidores.length === 0 ? (
                    <option value="">Cadastre servidores em Configuracoes</option>
                  ) : (
                    <>
                      <option value="">Selecione...</option>
                      {servidores.map((s) => (
                        <option key={s.id} value={s.nome}>{s.nome}</option>
                      ))}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={form.dataVencimento}
                  onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data de Cadastro</label>
                <input
                  type="date"
                  value={form.criadoEm}
                  onChange={(e) => setForm({ ...form, criadoEm: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Situação</label>
                <select
                  value={form.situacao}
                  onChange={(e) => setForm({ ...form, situacao: e.target.value as Client['situacao'] })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="Assinou">Assinou</option>
                  <option value="Renovou">Renovou</option>
                  <option value="Não Renovou">Não Renovou</option>
                  <option value="Inadimplente">Inadimplente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Observação</label>
              <textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Anotações sobre o cliente..."
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-accent text-white rounded-lg py-2 font-medium hover:bg-accent-hover transition-colors"
              >
                {isSaving ? 'Salvando...' : editingClient ? 'Salvar' : 'Adicionar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-border rounded-lg py-2 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
      {saveStatus === 'failed' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-card rounded-xl shadow-lg w-full max-w-md border border-border p-6">
            <h3 className="text-lg font-semibold mb-2">Falha ao sincronizar</h3>
            <p className="text-sm text-gray-600 mb-5">
              Não foi possível gravar agora. Deseja tentar sincronizar novamente?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSaveStatus('idle');
                  onClose();
                }}
                className="flex-1 border border-border rounded-lg py-2 font-medium hover:bg-gray-50 transition-colors"
              >
                Não, fechar
              </button>
              <button
                type="button"
                onClick={() => setSaveStatus('idle')}
                className="flex-1 bg-accent text-white rounded-lg py-2 font-medium hover:bg-accent-hover transition-colors"
              >
                Sim, tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
