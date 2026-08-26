const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const ipBucket = new Map();
const CLOSERS_PIPELINE_ID = 'mhe441mBoc0aQkVpwXXN';
const PRE_SALES_PIPELINE_ID = 'jg6YojszvhB88pE7Uhmw';
const PRE_SALES_STAGE_FUNIL_APLICACAO_ID = 'ccff0ad6-9ae8-4168-abed-8c83c948f61e';
/* Pipeline "Desqualificados" (fora do board dos SDRs). Lead que não é sócio
   ou fatura abaixo de 30k para aqui e não recebe tag de trigger. */
const DESQUALIFICADOS_PIPELINE_ID = 'lyyflLCiOZDwjaSfwxkj';
const DESQUALIFICADOS_STAGE_APLICACAO_ID = 'd9a875c4-302f-4176-8be9-89b4616970fc';
const LEAD_SOURCE = 'FAP01 - Sessão Estratégica';
const SUPABASE_TABLE = '[Leads] FAP01';
/* Custom field "Qual o seu perfil do Instagram?" (contact.qual_o_seu_perfil_do_instagram) */
const INSTAGRAM_FIELD_ID = '3pzsEnGon1ZhyyoUKOgf';

/* Custom fields do folder "Trackamento" (contact) — tracking pra atribuição
   offline via Meta CAPI e Google Enhanced Conversions. */
const META_FBCLID_FIELD_ID    = 'aMiyz46Xl5wTIy2I4Yj3';
const META_FBC_FIELD_ID       = 'JS5ravDWQm1NIUyugQJW';
const META_FBP_FIELD_ID       = 'rBUosTfO0Sj0dTSjxWf8';
const GOOGLE_GCLID_FIELD_ID          = 'e446fqRYi7eSNf9Vs3HD';
const GOOGLE_GBRAID_FIELD_ID         = 'r1npUqdn62ldrF8PZNGS';
const GOOGLE_WBRAID_FIELD_ID         = 'kErRveLpdEqZHY59WRYU';
const GOOGLE_GAD_SOURCE_FIELD_ID     = 'LsWdcHl8j7jW3Qy5Kofa';
const GOOGLE_GAD_CAMPAIGNID_FIELD_ID = 'ptKz8dG0gaAAFdDUnDDF';
const LEAD_TIMESTAMP_FIELD_ID        = '2JFYICtfBEs8ortLaZkF';
const UTM_SOURCE_FIELD_ID     = '5MMzSr6qazKxDKrP7QpQ';
const UTM_MEDIUM_FIELD_ID     = 'RlefKqMm6glnFiUlsDL0';
const UTM_CAMPAIGN_FIELD_ID   = 'J3E09xeKySD9hTmT20DF';
const UTM_CONTENT_FIELD_ID    = '6vTy247TY0MX2JRD1cBf';
const UTM_TERM_FIELD_ID       = '44YpIPGokrUcos2H13CA';

const ALLOWED_CARGOS = new Set([
  'socio-empresario',
  'gerente-lider',
  'colaborador-funcionario',
  'prestador-freelancer',
]);

const ALLOWED_SEGMENTOS = new Set([
  'saude',
  'financas',
  'juridico',
  'tecnologia-saas',
  'industria',
  'servicos-mentoria',
  'outro',
]);

const ALLOWED_RECEITAS = new Set([
  'abaixo-30k',
  '30k-50k',
  '50k-100k',
  '100k-300k',
  '300k-500k',
  '500k-1m',
  'acima-1m',
]);

const ALLOWED_DORES = new Set([
  'estrela',
  'processo',
  'playbooks',
  'captacao',
  'trafego',
]);

const DOR_LABELS = {
  estrela: 'Resultado depende de 1-2 vendedores estrela',
  processo: 'Sem processo replicável — contratação demora pra render',
  playbooks: 'Sem playbooks — rotinas, SOPs e documentação não existem',
  captacao: 'Captação ativa é improviso (sem prospecção / social selling)',
  trafego: 'Tráfego pago é caixa-preta (sem CPL, CAC, conversão por canal)',
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
  if (entry.count > MAX_REQUESTS_PER_WINDOW) return true;
  return false;
}

function sanitizeText(value, maxLen) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

/* Instagram (só vem preenchido pra receita 50k+). Aceita "@fulano",
   "fulano" ou link do perfil; normaliza pra "@fulano". Nunca rejeita
   o payload por causa dele — texto fora do padrão passa sanitizado. */
function normalizeInstagram(value) {
  const v = sanitizeText(value, 80)
    .replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '')
    .replace(/[?#/].*$/, '')
    .replace(/\s+/g, '')
    .replace(/^@+/, '');
  if (!v) return '';
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? `@${v}` : sanitizeText(value, 60);
}

function validatePayload(input) {
  const payload = {
    submission_id: sanitizeText(input.submission_id, 80),
    submitted_at: sanitizeText(input.submitted_at, 40),
    page: sanitizeText(input.page, 500),
    nome: sanitizeText(input.nome, 120),
    email: sanitizeText(input.email, 254).toLowerCase(),
    whatsapp: sanitizeText(input.whatsapp, 24),
    cargo: sanitizeText(input.cargo, 40),
    segmento: sanitizeText(input.segmento, 40),
    receita: sanitizeText(input.receita, 40),
    dor: sanitizeText(input.dor, 40),
    instagram: normalizeInstagram(input.instagram),
    utm_source: sanitizeText(input.utm_source, 120),
    utm_medium: sanitizeText(input.utm_medium, 120),
    utm_campaign: sanitizeText(input.utm_campaign, 200),
    utm_content: sanitizeText(input.utm_content, 200),
    utm_term: sanitizeText(input.utm_term, 200),
    fbclid: sanitizeText(input.fbclid, 512),
    gclid: sanitizeText(input.gclid, 512),
    gbraid: sanitizeText(input.gbraid, 512),
    wbraid: sanitizeText(input.wbraid, 512),
    gad_source: sanitizeText(input.gad_source, 120),
    gad_campaignid: sanitizeText(input.gad_campaignid, 120),
    fbc: sanitizeText(input.fbc, 512),
    fbp: sanitizeText(input.fbp, 512),
    lead_timestamp: sanitizeText(input.lead_timestamp, 40),
  };

  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(payload.submission_id)) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(payload.submitted_at)) return null;
  if (!/^https?:\/\//.test(payload.page)) return null;
  if (payload.nome.length < 2) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return null;
  if (!/^\+\d{1,3}\s\d{8,15}$/.test(payload.whatsapp)) return null;
  if (!ALLOWED_CARGOS.has(payload.cargo)) return null;
  if (!ALLOWED_SEGMENTOS.has(payload.segmento)) return null;
  if (!ALLOWED_RECEITAS.has(payload.receita)) return null;
  /* dor (travamento) virou opcional — etapa removida do formulário.
     Se vier preenchido, precisa ser válido; vazio é aceito. */
  if (payload.dor && !ALLOWED_DORES.has(payload.dor)) return null;

  return payload;
}

function splitName(fullName) {
  const clean = sanitizeText(fullName, 120);
  const parts = clean.split(' ').filter(Boolean);
  const firstName = parts[0] || 'Lead';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

function classifyLead(cargo, faturamento) {
  const isSocioEmpresario = cargo === 'socio-empresario';
  const isQualificadoFaturamento = new Set([
    '50k-100k',
    '100k-300k',
    '300k-500k',
    '500k-1m',
    'acima-1m',
  ]).has(faturamento);

  if (isSocioEmpresario && isQualificadoFaturamento) return 'qualificado';
  if (isSocioEmpresario && faturamento === '30k-50k') return 'SemiQualificado';
  if (!isSocioEmpresario || faturamento === 'abaixo-30k') return 'desqualificado';

  return 'desqualificado';
}

function buildGhlPayload(payload, locationId) {
  const { firstName, lastName } = splitName(payload.nome);
  const classificacao = classifyLead(payload.cargo, payload.receita);

  /* 'fap1-cadastro-trigger' NÃO entra no upsert: em lead repetido a tag já
     existe e o upsert não gera evento "tag added" — a automação de envio
     inicial não rodaria. O handler remove e recoloca a tag explicitamente
     após o upsert, gerando exatamente 1 evento por cadastro. */
  const tags = [
    'fap1-cadastro',
    classificacao,
    `cargo:${payload.cargo}`,
    `segmento:${payload.segmento}`,
    `receita:${payload.receita}`,
  ];
  /* Instagram NÃO vira tag (@ único por lead explodiria o registro de tags
     da conta — uma tag nova por pessoa). Vai no custom field do contato,
     visível no painel e filtrável em smart lists, além da nota e do Supabase. */
  const body = {
    locationId,
    firstName,
    lastName,
    name: payload.nome,
    email: payload.email,
    phone: payload.whatsapp,
    source: LEAD_SOURCE,
    tags,
  };

  /* customFields só entram quando têm valor — evita sobrescrever com string
     vazia em lead repetido (upsert nunca "limpa" um campo com "" no GHL,
     mas passar campo vazio polui logs e vira ruído no request). */
  const customFields = [];
  if (payload.instagram)      customFields.push({ id: INSTAGRAM_FIELD_ID,      field_value: payload.instagram });
  if (payload.utm_source)     customFields.push({ id: UTM_SOURCE_FIELD_ID,     field_value: payload.utm_source });
  if (payload.utm_medium)     customFields.push({ id: UTM_MEDIUM_FIELD_ID,     field_value: payload.utm_medium });
  if (payload.utm_campaign)   customFields.push({ id: UTM_CAMPAIGN_FIELD_ID,   field_value: payload.utm_campaign });
  if (payload.utm_content)    customFields.push({ id: UTM_CONTENT_FIELD_ID,    field_value: payload.utm_content });
  if (payload.utm_term)       customFields.push({ id: UTM_TERM_FIELD_ID,       field_value: payload.utm_term });
  if (payload.fbclid)         customFields.push({ id: META_FBCLID_FIELD_ID,    field_value: payload.fbclid });
  if (payload.fbc)            customFields.push({ id: META_FBC_FIELD_ID,       field_value: payload.fbc });
  if (payload.fbp)            customFields.push({ id: META_FBP_FIELD_ID,       field_value: payload.fbp });
  if (payload.gclid)          customFields.push({ id: GOOGLE_GCLID_FIELD_ID,          field_value: payload.gclid });
  if (payload.gbraid)         customFields.push({ id: GOOGLE_GBRAID_FIELD_ID,         field_value: payload.gbraid });
  if (payload.wbraid)         customFields.push({ id: GOOGLE_WBRAID_FIELD_ID,         field_value: payload.wbraid });
  if (payload.gad_source)     customFields.push({ id: GOOGLE_GAD_SOURCE_FIELD_ID,     field_value: payload.gad_source });
  if (payload.gad_campaignid) customFields.push({ id: GOOGLE_GAD_CAMPAIGNID_FIELD_ID, field_value: payload.gad_campaignid });
  if (payload.lead_timestamp) customFields.push({ id: LEAD_TIMESTAMP_FIELD_ID,        field_value: payload.lead_timestamp });
  if (customFields.length) body.customFields = customFields;

  return body;
}

async function sendToSupabase(supabaseUrl, supabaseKey, payload) {
  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/${encodeURIComponent(SUPABASE_TABLE)}`;
  const row = {
    nome: payload.nome,
    email: payload.email,
    telefone: payload.whatsapp,
    cargo: payload.cargo,
    segmento: payload.segmento,
    faturamento: payload.receita,
    utm_source: payload.utm_source,
    utm_medium: payload.utm_medium,
    utm_campaign: payload.utm_campaign,
    utm_content: payload.utm_content,
    utm_term: payload.utm_term,
    url: payload.page,
    data: payload.submitted_at,
    fbclid: payload.fbclid || null,
    gclid: payload.gclid || null,
    gbraid: payload.gbraid || null,
    wbraid: payload.wbraid || null,
    gad_source: payload.gad_source || null,
    gad_campaignid: payload.gad_campaignid || null,
    fbc: payload.fbc || null,
    fbp: payload.fbp || null,
    lead_timestamp: payload.lead_timestamp || null,
  };

  /* chave só entra quando preenchida: se a coluna `instagram` ainda não
     existir na tabela, o PostgREST rejeitaria o insert inteiro (PGRST204) */
  if (payload.instagram) row.instagram = payload.instagram;

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
    console.error('[supabase] insert failed', {
      status: response.status,
      endpoint,
      error: errorBody.slice(0, 500),
    });
  } else {
    console.log('[supabase] insert ok', { status: response.status });
  }

  return { ok: response.ok, status: response.status };
}

async function sendToHighLevel(ghlBaseUrl, pitToken, locationId, payload) {
  const body = JSON.stringify(buildGhlPayload(payload, locationId));
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/contacts/upsert`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Version: '2021-07-28',
      locationId,
    },
    body,
  });

  const data = await response.json().catch(() => null);
  return { response, data };
}

async function searchContactOpportunities(ghlBaseUrl, pitToken, locationId, contactId) {
  const query = new URLSearchParams({
    location_id: locationId,
    contact_id: contactId,
    limit: '100',
  });
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/opportunities/search?${query.toString()}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !Array.isArray(data.opportunities)) return [];
  return data.opportunities;
}

function buildNoteBody(payload) {
  const classificacao = classifyLead(payload.cargo, payload.receita);
  const lines = [
    'Respostas FAP01 — Sessão Estratégica',
    '',
  ];
  if (payload.dor) {
    lines.push(`• Travamento: ${DOR_LABELS[payload.dor] || payload.dor}`);
  }
  lines.push(
    `• Segmento: ${SEGMENTO_LABELS[payload.segmento] || payload.segmento}`,
    `• Perfil: ${CARGO_LABELS[payload.cargo] || payload.cargo}`,
    `• Receita mensal: ${RECEITA_LABELS[payload.receita] || payload.receita}`,
  );
  if (payload.instagram) {
    lines.push(`• Instagram: ${payload.instagram}`);
  }
  lines.push(
    '',
    `Classificação: ${classificacao}`,
    `Página: ${payload.page}`,
    `Enviado em: ${payload.submitted_at}`,
  );

  const utmEntries = [
    payload.utm_source && `source=${payload.utm_source}`,
    payload.utm_medium && `medium=${payload.utm_medium}`,
    payload.utm_campaign && `campaign=${payload.utm_campaign}`,
    payload.utm_content && `content=${payload.utm_content}`,
    payload.utm_term && `term=${payload.utm_term}`,
  ].filter(Boolean);

  if (utmEntries.length) {
    lines.push('', `UTMs: ${utmEntries.join(' | ')}`);
  }

  return lines.join('\n');
}

async function addContactNote(ghlBaseUrl, pitToken, contactId, userId, body) {
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/contacts/${contactId}/notes`;
  const payload = userId ? { userId, body } : { body };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[ghl] note failed', {
      status: response.status,
      hasUserId: Boolean(userId),
      error: errorBody.slice(0, 500),
    });
  } else {
    console.log('[ghl] note ok', { status: response.status });
  }

  return response.ok;
}

async function addContactTags(ghlBaseUrl, pitToken, contactId, tags) {
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/contacts/${contactId}/tags`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });
  return response.ok;
}

async function removeContactTags(ghlBaseUrl, pitToken, contactId, tags) {
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/contacts/${contactId}/tags`;
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[ghl] tag remove failed', {
      status: response.status,
      error: errorBody.slice(0, 300),
    });
  }
  return response.ok;
}

async function updateContactSource(ghlBaseUrl, pitToken, contactId) {
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/contacts/${contactId}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: LEAD_SOURCE }),
  });
  return response.ok;
}

async function createOpportunity(ghlBaseUrl, pitToken, locationId, contactId, name, pipelineId, stageId) {
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/opportunities/`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId,
      contactId,
      pipelineId,
      pipelineStageId: stageId,
      status: 'open',
      name,
      source: LEAD_SOURCE,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[ghl] opp create failed', {
      status: response.status,
      stageId,
      error: errorBody.slice(0, 500),
    });
  } else {
    console.log('[ghl] opp create ok', { status: response.status, stageId });
  }
  return response.ok;
}

async function moveOpportunity(ghlBaseUrl, pitToken, opportunityId, pipelineId, stageId) {
  const endpoint = `${ghlBaseUrl.replace(/\/+$/, '')}/opportunities/${opportunityId}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pitToken}`,
      Accept: 'application/json',
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pipelineId,
      pipelineStageId: stageId,
      source: LEAD_SOURCE,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[ghl] opp move failed', {
      status: response.status,
      opportunityId,
      stageId,
      error: errorBody.slice(0, 500),
    });
  } else {
    console.log('[ghl] opp move ok', { status: response.status, opportunityId, stageId });
  }
  return response.ok;
}

/* ===========================================================================
   Meta Conversions API (CAPI) — espelho server-side do pixel.

   Manda pro Meta os MESMOS eventos que o navegador dispara neste funil, com o
   MESMO event_id (= submission_id). A Meta deduplica navegador x servidor por
   (event_name, event_id) em 48h, entao o volume nao muda: o que muda e a
   qualidade da correspondencia (e-mail/telefone/nome com hash + IP + UA +
   fbp/fbc) e a resiliencia (bloqueador, ITP, aba fechada antes do fbq).

   Credencial: META_CAPI_TOKEN (env) ou ./capi.json ao lado do handler
   (Passenger no cPanel nao tem env editavel por FTP). Sem token => no-op.
   Nunca derruba o lead: erro so vai pro log. META_TEST_EVENT_CODE (env)
   manda pro "Testar eventos" do Events Manager sem contar de verdade.
   =========================================================================== */
const crypto = require('crypto');
const META_PIXEL_ID = process.env.META_PIXEL_ID || '288404690470754';

function metaCapiToken() {
  if (process.env.META_CAPI_TOKEN) return process.env.META_CAPI_TOKEN;
  try { return require('./capi.json').token || ''; } catch (_) { return ''; }
}

function metaHash(value) {
  const v = String(value || '').trim().toLowerCase();
  return v ? crypto.createHash('sha256').update(v).digest('hex') : null;
}

function readReqCookie(req, name) {
  const cookie = String((req.headers && req.headers.cookie) || '');
  const m = cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

/* user    = { nome, email, telefone, fbp, fbc, fbclid, url }
   eventos = [{ name, id, custom }] — todos vao numa unica chamada.
   Retorna quantos eventos a Meta aceitou (0 = sem token ou falha). */
async function metaCapi(req, user, eventos) {
  const token = metaCapiToken();
  if (!token || !eventos.length) return 0;

  const userData = {};
  const em = metaHash(user.email);
  if (em) userData.em = [em];
  const fone = String(user.telefone || '').replace(/\D/g, '');
  if (fone) userData.ph = [metaHash(fone)];
  const nome = String(user.nome || '').trim().split(/\s+/).filter(Boolean);
  if (nome[0]) userData.fn = [metaHash(nome[0])];
  if (nome.length > 1) userData.ln = [metaHash(nome.slice(1).join(' '))];
  if (fone.startsWith('55')) userData.country = [metaHash('br')];
  const ip = getClientIp(req);
  if (ip && ip !== 'unknown') userData.client_ip_address = ip;
  const ua = req.headers && req.headers['user-agent'];
  if (ua) userData.client_user_agent = String(ua).slice(0, 512);
  const fbp = user.fbp || readReqCookie(req, '_fbp');
  if (fbp) userData.fbp = fbp;
  const fbc = user.fbc || readReqCookie(req, '_fbc')
    || (user.fbclid ? 'fb.1.' + Date.now() + '.' + user.fbclid : '');
  if (fbc) userData.fbc = fbc;

  const now = Math.floor(Date.now() / 1000);
  const body = {
    access_token: token,
    data: eventos.map((ev) => ({
      event_name: ev.name,
      event_time: now,
      event_id: ev.id,
      action_source: 'website',
      event_source_url: user.url,
      user_data: userData,
      custom_data: ev.custom || {},
    })),
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const txt = await r.text().catch(() => '');
    if (!r.ok) {
      console.error('[capi] rejeitado', { status: r.status, body: txt.slice(0, 300) });
      return 0;
    }
    console.log('[capi] ok', { eventos: eventos.map((e) => e.name).join(','), id: eventos[0].id });
    return eventos.length;
  } catch (err) {
    console.error('[capi] falhou', { message: err && err.message });
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const ip = getClientIp(req);
  if (isRateLimited(ip)) return json(res, 429, { error: 'too_many_requests' });

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const ghlBaseUrl = process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
  const ghlUserId = process.env.GHL_USER_ID || '';
  if (!pitToken || !locationId) return json(res, 500, { error: 'server_not_configured' });

  /* req.body normalmente já vem parseado pelo Vercel quando o
     Content-Type é application/json. Mas sendBeacon (usado para
     sobreviver ao redirect) pode entregar como string ou Buffer
     em algumas runtimes — defensivo. */
  let rawBody = req.body;
  if (typeof rawBody === 'string') {
    try { rawBody = JSON.parse(rawBody); } catch (_) { rawBody = {}; }
  } else if (rawBody && typeof rawBody === 'object' && Buffer.isBuffer(rawBody)) {
    try { rawBody = JSON.parse(rawBody.toString('utf8')); } catch (_) { rawBody = {}; }
  }

  const payload = validatePayload(rawBody || {});
  if (!payload) {
    console.warn('[lead] invalid payload', {
      bodyType: typeof req.body,
      keys: rawBody && typeof rawBody === 'object' ? Object.keys(rawBody) : null,
    });
    return json(res, 400, { error: 'invalid_payload' });
  }

  console.log('[lead] utms received', {
    utm_source: payload.utm_source,
    utm_medium: payload.utm_medium,
    utm_campaign: payload.utm_campaign,
    utm_content: payload.utm_content,
    utm_term: payload.utm_term,
    page: payload.page.slice(0, 200),
  });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const supaResult = await sendToSupabase(supabaseUrl, supabaseKey, payload);
      console.log('[supabase] result', { ok: supaResult.ok, status: supaResult.status });
    } catch (err) {
      console.error('[supabase] threw', { message: err && err.message });
    }
  } else {
    console.warn('[supabase] env missing', {
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(supabaseKey),
    });
  }

  /* Meta CAPI — espelha o que as paginas de destino disparam no pixel:
       desqualificado (fap01-obrigado-lf): Lead_desqualificado_FAP01 +
         Pageview-lead-desqualificado-geral, eventID = ?sid= da URL;
       qualificado (fap01-calendly): Lead + Lead_qualificado_geral (inline) +
         Lead_qualificado_FAP01 (GTM) — AINDA SEM eventID nessa pagina (codigo
         fora do nosso alcance + tag do GTM sem Event ID). Mandar do servidor
         hoje contaria 2x o evento que as campanhas otimizam, entao o ramo
         qualificado fica atras de META_CAPI_FAP01_QUALIFICADO=1 ate a pagina
         ler ?sid= como eventID;
       semi (fap01-calendly-semi): nada. */
  const eventosMeta = [];
  const classificacaoMeta = classifyLead(payload.cargo, payload.receita);
  if (classificacaoMeta === 'desqualificado') {
    eventosMeta.push(
      { name: 'Lead_desqualificado_FAP01', id: payload.submission_id },
      { name: 'Pageview-lead-desqualificado-geral', id: payload.submission_id },
    );
  } else if (classificacaoMeta === 'qualificado' && process.env.META_CAPI_FAP01_QUALIFICADO === '1') {
    eventosMeta.push(
      { name: 'Lead', id: payload.submission_id },
      { name: 'Lead_qualificado_FAP01', id: payload.submission_id },
      { name: 'Lead_qualificado_geral', id: payload.submission_id },
    );
  }
  const capi = await metaCapi(req, {
    nome: payload.nome, email: payload.email, telefone: payload.whatsapp,
    fbp: payload.fbp, fbc: payload.fbc, fbclid: payload.fbclid, url: payload.page,
  }, eventosMeta);

  try {
    const classificacao = classifyLead(payload.cargo, payload.receita);
    const { response, data } = await sendToHighLevel(ghlBaseUrl, pitToken, locationId, payload);

    if (!response.ok) return json(res, 502, { error: 'upstream_rejected' });
    const contactId = data?.contact?.id;

    if (contactId) {
      await updateContactSource(ghlBaseUrl, pitToken, contactId);

      /* Lead repetido: remove tags de valor desatualizadas (o upsert só
         adiciona, nunca limpa — sem isso o contato acumula receita:X e
         receita:Y ao mesmo tempo). Conjuntos fechados, remoção segura.
         Classificação (qualificado/desqualificado) fica com as automações. */
      const staleValueTags = [];
      for (const v of ALLOWED_CARGOS) if (v !== payload.cargo) staleValueTags.push(`cargo:${v}`);
      for (const v of ALLOWED_SEGMENTOS) if (v !== payload.segmento) staleValueTags.push(`segmento:${v}`);
      for (const v of ALLOWED_RECEITAS) if (v !== payload.receita) staleValueTags.push(`receita:${v}`);
      await removeContactTags(ghlBaseUrl, pitToken, contactId, staleValueTags);
      try {
        const noteUserId = ghlUserId || data?.contact?.assignedTo || '';
        await addContactNote(ghlBaseUrl, pitToken, contactId, noteUserId, buildNoteBody(payload));
      } catch (err) {
        console.error('[ghl] note threw', { message: err && err.message });
      }
      const opportunities = await searchContactOpportunities(ghlBaseUrl, pitToken, locationId, contactId);
      const hasCloserOpportunity = opportunities.some((op) => op.pipelineId === CLOSERS_PIPELINE_ID);

      if (hasCloserOpportunity) {
        await addContactTags(ghlBaseUrl, pitToken, contactId, ['reentrada-fap01']);
      } else if (classificacao === 'desqualificado') {
        /* Régua: só sócio/CEO faturando 30k+ chega ao SDR. Desqualificado vai
           pro pipeline "Desqualificados" (fora do board de pré-vendas) e NÃO
           recebe 'fap1-cadastro-trigger' — é essa tag que dispara a mensagem
           inicial e a atribuição de SDR. Contato, tags, nota e Supabase seguem
           iguais: o lead continua na base pra farming. */
        const existingOpp = opportunities.find(
          (op) => op.pipelineId === PRE_SALES_PIPELINE_ID || op.pipelineId === DESQUALIFICADOS_PIPELINE_ID,
        );

        if (existingOpp) {
          if (existingOpp.pipelineId !== DESQUALIFICADOS_PIPELINE_ID) {
            await moveOpportunity(
              ghlBaseUrl, pitToken, existingOpp.id,
              DESQUALIFICADOS_PIPELINE_ID, DESQUALIFICADOS_STAGE_APLICACAO_ID,
            );
          }
        } else {
          await createOpportunity(
            ghlBaseUrl, pitToken, locationId, contactId, payload.nome,
            DESQUALIFICADOS_PIPELINE_ID, DESQUALIFICADOS_STAGE_APLICACAO_ID,
          );
        }

        /* tag de trigger some do contato: se ele já foi qualificado antes, a
           tag velha não pode ficar pra trás e re-disparar depois */
        await removeContactTags(ghlBaseUrl, pitToken, contactId, ['fap1-cadastro-trigger']);
        console.log('[ghl] desqualificado fora do pipeline de SDR', { contactId });
      } else {
        const existingPreSalesOpp = opportunities.find((op) => op.pipelineId === PRE_SALES_PIPELINE_ID);

        if (existingPreSalesOpp) {
          if (
            existingPreSalesOpp.pipelineStageId !== PRE_SALES_STAGE_FUNIL_APLICACAO_ID ||
            existingPreSalesOpp.source !== LEAD_SOURCE
          ) {
            await moveOpportunity(
              ghlBaseUrl, pitToken, existingPreSalesOpp.id,
              PRE_SALES_PIPELINE_ID, PRE_SALES_STAGE_FUNIL_APLICACAO_ID,
            );
          }
        } else {
          await createOpportunity(
            ghlBaseUrl, pitToken, locationId, contactId, payload.nome,
            PRE_SALES_PIPELINE_ID, PRE_SALES_STAGE_FUNIL_APLICACAO_ID,
          );
        }

        /* Envio inicial roda em TODA aplicação, inclusive lead repetido:
           remove e recoloca a tag de trigger pra forçar o evento "tag added".
           Lead em atendimento no pipeline de Closers fica de fora (recebe só
           'reentrada-fap01' acima). O workflow precisa aceitar re-entrada. */
        await removeContactTags(ghlBaseUrl, pitToken, contactId, ['fap1-cadastro-trigger']);
        await addContactTags(ghlBaseUrl, pitToken, contactId, ['fap1-cadastro-trigger']);
        console.log('[ghl] trigger tag re-armed', { contactId });
      }
    }

    return json(res, 202, { ok: true, classificacao, capi });
  } catch (_) {
    return json(res, 502, { error: 'upstream_unreachable' });
  }
}

module.exports = handler;
