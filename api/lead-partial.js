/* Endpoint dedicado para leads que SAEM do formulário antes de concluir.
   Insere uma linha em `fap_form` no Supabase. Não toca no fluxo principal
   (/api/lead → [Leads] FAP01 + GHL), que continua igual.

   Recebe via fetch ou navigator.sendBeacon (Blob application/json). */

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const ipBucket = new Map();
const SUPABASE_TABLE = 'fap_form';

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

  const segmentoSlug = sanitizeText(raw.segmento, 40);
  const cargoSlug    = sanitizeText(raw.cargo, 40);
  const receitaSlug  = sanitizeText(raw.receita, 40);
  const nome     = sanitizeText(raw.nome, 120);
  const email    = sanitizeText(raw.email, 254).toLowerCase();
  const whatsapp = sanitizeText(raw.whatsapp, 32);
  const instagram = sanitizeText(raw.instagram, 60);

  if (!segmentoSlug && !cargoSlug && !receitaSlug && !nome && !email && !whatsapp) {
    return json(res, 400, { error: 'empty_payload' });
  }

  const row = {
    nome_completo: nome || null,
    email: email || null,
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

  try {
    await sendToSupabase(supabaseUrl, supabaseKey, row);
  } catch (err) {
    console.error('[fap_form] threw', { message: err && err.message });
  }

  return json(res, 202, { ok: true });
}

module.exports = handler;
