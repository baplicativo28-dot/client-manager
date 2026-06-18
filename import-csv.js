const fs = require('fs');

const csv = fs.readFileSync('C:\\Users\\Rafael Liziero\\Projects\\client-manager\\import-data.csv', 'utf-8');
const lines = csv.split(/\r?\n/).filter(l => l.trim());

// Skip header
const header = lines[0];
const clients = [];
let id = 1;

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Remove time part if present
  dateStr = dateStr.split(' ')[0].trim();
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
}

function parseValor(valorStr) {
  if (!valorStr) return 0;
  // "R$ 30,00" -> 30
  return parseFloat(valorStr.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.')) || 0;
}

function parseCelular(cel) {
  if (!cel) return '';
  return cel.trim();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9) + (id++).toString(36);
}

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  // Parse CSV considering commas inside quoted fields
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '"') {
      inQuotes = !inQuotes;
    } else if (line[c] === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += line[c];
    }
  }
  fields.push(current.trim());

  const nome = fields[0];
  if (!nome) continue;

  const valor = parseValor(fields[1]);
  const celular = parseCelular(fields[2]);
  const servidor = (fields[3] || '').trim();
  const cadastro = parseDate(fields[4]);
  const vencimento = parseDate(fields[5]);
  const situacaoRaw = (fields[6] || '').trim();
  const statusRaw = (fields[7] || '').trim();

  // Map situacao
  const validSituacoes = ['Assinou', 'Renovou', 'Não Renovou', 'Inadimplente'];
  let situacao = validSituacoes.includes(situacaoRaw) ? situacaoRaw : 'Renovou';

  // Map desativado from status
  const desativado = statusRaw === 'Inativo';

  if (!vencimento) continue;

  clients.push({
    id: generateId(),
    nome,
    celular,
    servidor,
    dataVencimento: vencimento,
    valor,
    situacao,
    desativado,
    lembreteEnviado: false,
    criadoEm: cadastro ? cadastro + 'T00:00:00.000Z' : new Date().toISOString(),
    trustRenewal: false,
    trustPaymentDate: null,
    ultimaRenovacao: null,
    mesesRenovados: 1,
  });
}

// Stats
const ativos = clients.filter(c => !c.desativado).length;
const inativos = clients.filter(c => c.desativado).length;
const servidores = [...new Set(clients.map(c => c.servidor))].sort();

console.log(`Total: ${clients.length} clientes`);
console.log(`Ativos: ${ativos} | Inativos: ${inativos}`);
console.log(`Servidores encontrados: ${servidores.join(', ')}`);
console.log(`\nSituações:`);
const sits = {};
clients.forEach(c => { sits[c.situacao] = (sits[c.situacao] || 0) + 1; });
Object.entries(sits).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

// Write backup JSON
const backup = { clients, settings: null };
fs.writeFileSync('C:\\Users\\Rafael Liziero\\Projects\\client-manager\\backup-import.json', JSON.stringify(backup, null, 2));
console.log(`\nBackup salvo em: backup-import.json`);
