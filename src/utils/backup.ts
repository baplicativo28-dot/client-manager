import type { Client, Settings } from '../types';

export interface BackupData {
  clients: Client[];
  settings: Settings;
}

export function exportBackup(data: BackupData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.download = `client-manager-backup-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportClientsToCSV(clients: Client[]) {
  const headers = ['NOME', 'valor', 'celular', 'Servidor', 'Cadastro', 'Vencimento', 'situação', 'status', 'observacao'];
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    // Parse YYYY-MM-DD directly without timezone issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    // For ISO strings, extract date part
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return '';
  };
  const rows = clients.map((c) => {
    const valorStr = `R$ ${c.valor.toFixed(2).replace('.', ',')}`;
    const cadastroStr = formatDate(c.criadoEm);
    const vencimentoStr = formatDate(c.dataVencimento);
    const statusStr = c.desativado ? 'Inativo' : 'Ativo';
    return [
      c.nome,
      valorStr,
      c.celular,
      c.servidor,
      cadastroStr,
      vencimentoStr,
      c.situacao,
      statusStr,
      c.observacao || '',
    ];
  });
  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `clientes-export-${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<BackupData> {
  const text = await file.text();
  return JSON.parse(text) as BackupData;
}