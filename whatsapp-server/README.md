# WhatsApp Server

Servidor leve que conecta ao WhatsApp Web via Baileys e expoe uma API REST para envio de mensagens.

## Deploy no Railway (gratuito, sem CLI)

1. Faça commit dessa pasta no seu repositório GitHub (se ainda não fez).
2. Acesse [railway.app](https://railway.app) e entre com sua conta GitHub.
3. Clique em **New Project** → **Deploy from GitHub repo**.
4. Selecione o repositório `client-manager` e, quando perguntar, escolha o subdiretório **`whatsapp-server`**.
5. Em **Variables**, adicione:
   - `API_KEY` = uma senha qualquer (ex: `minha-chave-123`)
   - `PORT` = `3001`
6. Clique em **Deploy**. Em ~2 minutos seu servidor estará no ar.
7. Copie a URL gerada pelo Railway (ex: `https://whatsapp-server-production.up.railway.app`).
8. No app Client Manager, vá em **Configurações → WhatsApp (Disparo Automático)**.
9. Cole a URL e a API Key que você definiu.
10. Clique em **Salvar** e depois em **Conectar WhatsApp**.
11. Escaneie o QR Code que aparece com o WhatsApp do celular.
12. Pronto! O disparo automático está ativo.

## Variáveis de ambiente

| Variável  | Padrão              | Descrição                          |
|-----------|---------------------|------------------------------------|
| PORT      | 3001                | Porta do servidor                  |
| API_KEY   | client-manager-key  | Chave de autenticação da API       |
| AUTH_DIR  | ./auth_info         | Pasta para salvar sessão WhatsApp  |

## Endpoints

| Método | Rota                          | Descrição                    |
|--------|-------------------------------|------------------------------|
| GET    | /health                       | Verificar se servidor está ok |
| GET    | /status                       | Status da conexão + QR Code  |
| POST   | /session/start                | Iniciar sessão / gerar QR    |
| POST   | /session/disconnect           | Desconectar sessão           |
| POST   | /message/sendText/:instance   | Enviar mensagem de texto     |
