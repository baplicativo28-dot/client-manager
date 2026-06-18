import type { Client, Settings } from '../types';

interface SheetsValuesResponse {
  values?: string[][];
}

async function sheetsRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error('Falha na comunicação com Google Sheets.');
  }
  return response.json();
}

export async function syncToGoogleSheets(
  spreadsheetId: string,
  apiKey: string,
  clients: Client[],
  settings: Settings,
) {
  if (!spreadsheetId || !apiKey) {
    throw new Error('Informe o Spreadsheet ID e a API Key.');
  }
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate?key=${apiKey}`;
  const body = {
    valueInputOption: 'RAW',
    data: [
      {
        range: 'Clientes!A1',
        values: [
          ['id', 'nome', 'valor', 'celular', 'servidor', 'dataVencimento', 'situacao', 'desativado', 'lembreteEnviado', 'criadoEm', 'trustRenewal', 'trustPaymentDate', 'trustOriginalDueDate', 'ultimaRenovacao', 'mesesRenovados'],
          ...clients.map((client) => [
            client.id,
            client.nome,
            String(client.valor),
            client.celular,
            client.servidor,
            client.dataVencimento,
            client.situacao,
            String(client.desativado),
            String(client.lembreteEnviado),
            client.criadoEm,
            String(client.trustRenewal),
            client.trustPaymentDate ?? '',
            client.trustOriginalDueDate ?? '',
            client.ultimaRenovacao ?? '',
            String(client.mesesRenovados ?? 1),
          ]),
        ],
      },
      {
        range: 'Configuracoes!A1',
        values: [
          ['campo', 'valor'],
          ...Object.entries(settings)
            .filter(([key]) => key !== 'servidores')
            .map(([key, value]) => [key, typeof value === 'string' || value === null ? String(value ?? '') : JSON.stringify(value)]),
        ],
      },
      {
        range: 'Servidores!A1',
        values: [
          ['id', 'nome', 'custo'],
          ...settings.servidores.map((server) => [server.id, server.nome, String(server.custo)]),
        ],
      },
    ],
  };

  await sheetsRequest(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function downloadFromGoogleSheets(spreadsheetId: string, apiKey: string) {
  if (!spreadsheetId || !apiKey) {
    throw new Error('Informe o Spreadsheet ID e a API Key.');
  }
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Clientes!A:O&ranges=Configuracoes!A:B&ranges=Servidores!A:C&key=${apiKey}`;
  const response = await sheetsRequest(base) as { valueRanges?: SheetsValuesResponse[] };
  const [clientsSheet, settingsSheet, serversSheet] = response.valueRanges ?? [];

  const clientsRows = clientsSheet?.values ?? [];
  const settingsRows = settingsSheet?.values ?? [];
  const serversRows = serversSheet?.values ?? [];

  const clients: Client[] = clientsRows.slice(1).map((row) => ({
    id: row[0] ?? crypto.randomUUID(),
    nome: row[1] ?? '',
    valor: Number(row[2] ?? 0),
    celular: row[3] ?? '',
    servidor: row[4] ?? '',
    dataVencimento: row[5] ?? '',
    situacao: (row[6] as Client['situacao']) ?? 'Nao Renovou',
    desativado: row[7] === 'true',
    lembreteEnviado: row[8] === 'true',
    criadoEm: row[9] ?? new Date().toISOString(),
    trustRenewal: row[10] === 'true',
    trustPaymentDate: row[11] || null,
    trustOriginalDueDate: row[12] || null,
    ultimaRenovacao: row[13] || null,
    mesesRenovados: Number(row[14] ?? 1),
  }));

  const settingsMap = Object.fromEntries(settingsRows.slice(1).map((row) => [row[0], row[1] ?? '']));
  const servidores = serversRows.slice(1).map((row) => ({
    id: row[0] ?? crypto.randomUUID(),
    nome: row[1] ?? '',
    custo: Number(row[2] ?? 0),
  }));

  return {
    clients,
    settings: {
      whatsappTemplate: settingsMap.whatsappTemplate ?? '',
      whatsappTemplateConfianca: settingsMap.whatsappTemplateConfianca ?? '',
      defaultChavePix: settingsMap.defaultChavePix ?? '',
      defaultBanco: settingsMap.defaultBanco ?? '',
      defaultBeneficiario: settingsMap.defaultBeneficiario ?? '',
      servidores,
      googleSheetsSpreadsheetId: settingsMap.googleSheetsSpreadsheetId ?? '',
      googleSheetsApiKey: settingsMap.googleSheetsApiKey ?? '',
      lastSheetsSync: settingsMap.lastSheetsSync || null,
    },
  };
}