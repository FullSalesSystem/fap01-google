const fssPhone = require('./_fss-phone.js');
/* Endpoint dedicado para leads que SAEM do formulário antes de concluir.
   Insere uma linha em `fap_form` no Supabase (1x por sessão de modal: o front
   manda `registrar: false` nos reenvios) e, se já tem e-mail OU telefone
   válido, cria/atualiza o contato no GHL com a tag 'form-incompleto' — sem
   card, sem tag de trigger, sem SDR. Quem completa depois entra pelo
   /api/lead normal, que tira a tag (E2E 02/10/2026: SDR atribuído igual).

   Recebe via fetch ou navigator.sendBeacon (Blob application/json). */

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const ipBucket = new Map();
const SUPABASE_TABLE = 'fap_form';
/* piso do SDR (40k desde 02/10/2026; 30k-50k = legado de página em cache) */
const RECEITAS_PERFIL = new Set(['40k-50k', '30k-50k', '50k-100k', '100k-300k', '300k-500k', '500k-1m', 'acima-1m']);
/* funil do parcial: FAP01 (padrão) ou a ficha do Treinamento/FAP04, que manda
   `funil: 'treinamento'` via sendBeacon text/plain cross-origin (sem preflight,
   resposta ignorada — mesmo esquema do /api/lead-treinamento). Treinamento
   não grava no fap_form (tabela de abandono do FAP01). */
const FUNIS = {
  fap01: { source: 'FAP01 - Sessão Estratégica', tags: ['form-incompleto', 'fap01-form-incompleto'], fapForm: true },
  treinamento: { source: 'FAP04 - Treinamento Comercial', tags: ['form-incompleto', 'treinamento-form-incompleto'], fapForm: false },
};

const SEGMENTO_LABELS = {
  saude: 'Saúde',
  financas: 'Finanças',
  juridico: 'Jurídico',
  'tecnologia-saas': 'Tecnologia/SaaS',
  industria: 'Indústria',
  'servicos-mentoria': 'Serviços/Mentoria',
  outro: 'Outro',
};

const CARGO_LABELS = {
  'socio-empresario': 'Sócio / Empresário',
  'gerente-lider': 'Gerente / Líder',
  'colaborador-funcionario': 'Colaborador',
  'prestador-freelancer': 'Freelancer',
};

const RECEITA_LABELS = {
  'abaixo-40k': 'Abaixo de R$ 40 mil',
  '40k-50k': 'Entre R$ 40 mil e R$ 50 mil',
  /* legado (página em cache, régua de 30k até 02/10/2026) */
  'abaixo-30k': 'Abaixo de R$ 30 mil',
  '30k-50k': 'Entre R$ 30 mil e R$ 50 mil',
  '50k-100k': 'Entre R$ 50 mil e R$ 100 mil',
  '100k-300k': 'Entre R$ 100 mil e R$ 300 mil',
  '300k-500k': 'Entre R$ 300 mil e R$ 500 mil',
  '500k-1m': 'Entre R$ 500 mil e R$ 1 milhão',
  'acima-1m': 'Acima de R$ 1 milhão',
};

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    ipBucket.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

function sanitizeText(value, maxLen) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

async function sendToSupabase(supabaseUrl, supabaseKey, row) {
  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${encodeURIComponent(SUPABASE_TABLE)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[fap_form] insert failed', {
      status: response.status,
      error: errorBody.slice(0, 500),
    });
  } else {
    console.log('[fap_form] insert ok', { status: response.status });
  }
  return response.ok;
}

async function ghl(method, path, body) {
  const base = (process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com').replace(/\/+$/, '');
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_PIT_TOKEN}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      locationId: process.env.GHL_LOCATION_ID,
    },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
}

/* Upsert SEM `tags` (tags no upsert substituem o conjunto inteiro do contato)
   e sem campo vazio (não apaga nome/telefone que o contato já tinha). */
async function sendPartialToGhl({ nome, email, whatsapp }, funil, extraTags = []) {
  if (!process.env.GHL_PIT_TOKEN || !process.env.GHL_LOCATION_ID) return;
  const body = { locationId: process.env.GHL_LOCATION_ID };
  if (nome) {
    const parts = nome.split(' ');
    body.firstName = parts[0];
    if (parts.length > 1) body.lastName = parts.slice(1).join(' ');
  }
  if (email) body.email = email;
  if (whatsapp) body.phone = whatsapp.replace(/\s+/g, '');
  const up = await ghl('POST', '/contacts/upsert', body);
  const contactId = up.data?.contact?.id;
  if (!up.ok || !contactId) {
    console.error('[ghl] partial upsert failed', { status: up.status });
    return;
  }
  /* source só no contato novo: não reescreve a origem de quem já existia */
  if (up.data.new) await ghl('PUT', `/contacts/${contactId}`, { source: funil.source });
  await ghl('POST', `/contacts/${contactId}/tags`, { tags: funil.tags.concat(extraTags) });
  console.log('[ghl] partial ok', { contactId, novo: Boolean(up.data.new) });
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const ip = getClientIp(req);
  if (isRateLimited(ip)) return json(res, 429, { error: 'too_many_requests' });

  /* sendBeacon entrega como string/Buffer em algumas runtimes do Vercel. */
  let raw = req.body;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (_) { raw = {}; }
  } else if (raw && Buffer.isBuffer(raw)) {
    try { raw = JSON.parse(raw.toString('utf8')); } catch (_) { raw = {}; }
  }
  raw = raw || {};
  const funil = FUNIS[raw.funil] || FUNIS.fap01;

  const segmentoSlug = sanitizeText(raw.segmento, 40);
  const cargoSlug    = sanitizeText(raw.cargo, 40);
  const receitaSlug  = sanitizeText(raw.receita, 40);
  const nome     = sanitizeText(raw.nome, 120);
  const emailRaw = sanitizeText(raw.email, 254).toLowerCase();
  const email    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : '';
  /* parcial nunca é barrado pelo telefone; só não grava número lixo */
  const tel = fssPhone(sanitizeText(raw.whatsapp, 32));
  const whatsapp = tel.ok ? tel.full : '';
  const instagram = sanitizeText(raw.instagram, 60);

  if (!funil.fapForm && !email && !whatsapp) { res.statusCode = 204; return res.end(); }

  if (!segmentoSlug && !cargoSlug && !receitaSlug && !nome && !emailRaw && !whatsapp) {
    return json(res, 400, { error: 'empty_payload' });
  }

  const row = {
    nome_completo: nome || null,
    email: emailRaw || null,
    whatsapp: whatsapp || null,
    qual_o_segmento_da_sua_empresa: SEGMENTO_LABELS[segmentoSlug] || segmentoSlug || null,
    qual_e_o_seu_papel_hoje_na_empresa: CARGO_LABELS[cargoSlug] || cargoSlug || null,
    qual_a_receita_media_mensal_da_empresa: RECEITA_LABELS[receitaSlug] || receitaSlug || null,
  };

  /* chave só entra quando preenchida: se a coluna `instagram` ainda não
     existir na fap_form, o PostgREST rejeitaria o insert inteiro */
  if (instagram) row.instagram = instagram;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[fap_form] env missing');
    return json(res, 500, { error: 'server_not_configured' });
  }

  if (funil.fapForm && raw.registrar !== false) {
    try {
      await sendToSupabase(supabaseUrl, supabaseKey, row);
    } catch (err) {
      console.error('[fap_form] threw', { message: err && err.message });
    }
  }

  /* Perfil do abandono vai pro GHL como tag (mesmo formato do /api/lead, que
     limpa os valores velhos no submit completo): o time prioriza o sócio 40k+
     que largou o form antes de agendar. Sem card nem SDR — régua do board. */
  const extraTags = [];
  if (funil === FUNIS.fap01) {
    if (cargoSlug) extraTags.push(`cargo:${cargoSlug}`);
    if (receitaSlug) extraTags.push(`receita:${receitaSlug}`);
    if (cargoSlug === 'socio-empresario' && RECEITAS_PERFIL.has(receitaSlug)) extraTags.push('fap01-parcial-perfil');
  }

  if (email || whatsapp) {
    try {
      await sendPartialToGhl({ nome, email, whatsapp }, funil, extraTags);
    } catch (err) {
      console.error('[ghl] partial threw', { message: err && err.message });
    }
  }

  return json(res, 202, { ok: true });
}

module.exports = handler;
