## Deploy no Vercel (FAP01)

Este projeto publica `index.html` + `assets/` como estático e usa `api/lead.js` como Serverless Function para envio ao GHL.

### 1) Importar projeto

- No Vercel, clique em **Add New -> Project**
- Selecione o repositório `fap01`
- Framework Preset: **Other**
- Root Directory: **/** (raiz do projeto)

### 2) Variáveis de ambiente

Configurar em **Project Settings -> Environment Variables**:

- `GHL_PIT_TOKEN` = token Private Integration Token do GHL
- `GHL_LOCATION_ID` = `FUoQ8Kefs7Wj8cbgdJnS`
- `GHL_BASE_URL` = `https://services.leadconnectorhq.com`

Aplicar em **Production** (e Preview se quiser testar branch).

### 3) Deploy

- Fazer push da branch com as mudanças
- Executar deploy no Vercel (automático via Git)

### 4) Validação após deploy

1. Acessar `https://SEU-DOMINIO/api/lead` via GET e validar retorno `405 method_not_allowed`.
2. Submeter o formulário na landing.
3. Confirmar no GHL:
   - contato com source `FAP01 - Sessão Estratégica`
   - tags `fap1-cadastro` e `fap1-cadastro-trigger`
   - oportunidade em `2. Pré-Vendas 2.0 (SDR1)` / stage `Funil de Aplicação` quando aplicável

### 5) Se não entrar no GHL

- Conferir se as env vars estão preenchidas no ambiente correto (Production).
- Conferir logs da função em **Vercel -> Functions -> api/lead**.
- Verificar se o domínio publicado está apontando para o projeto/branch corretos.
