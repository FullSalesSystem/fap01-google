/* Contrato "Supabase primeiro" (19/10/2026) para funil SÓ REGISTRO.
   ~/crm-pre-vendas-fss/entrada-leads-1910/CONTRATO-SUPABASE-PRIMEIRO.md, seção 10.

   1. Grava o Supabase antes de tudo, em paralelo e com timeout de 3 s:
      - lead_capturas (corpo capture v1 exato, ignore-duplicates);
      - a linha [Leads] que o funil já gravava, agora com capture_key
        (on_conflict=capture_key, ignore-duplicates). Se o SQL 01 ainda não
        rodou (coluna/índice ausente), cai no insert de sempre.
   2. POST capture v1 de REGISTRO no CRM (conector create_deal=false, sem
      espelho, sem marketing, sem ghl_tags). Nunca rejeita, timeout de 3 s,
      só roda com CRM_REGISTRO_URL configurada.
   Nada aqui decide dono, card, tag ou trigger: o caminho GHL fica igual. */
const { createHash } = require('node:crypto');

const TIMEOUT_MS = 3000;
const sort = (v) => (Array.isArray(v) ? v.map(sort)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v);

/* Mesmo envelope e mesma chave do _crm-capture.js do fap01: <base>:complete:<sha256(answers)[:24]> */
function buildCapture(raw, payload, opts = {}) {
  const answers = JSON.parse(JSON.stringify(raw));
  const base = String(opts.base || raw.submission_id || '');
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(base)) throw new Error('invalid_submission_id');
  const stamp = opts.submittedAt || raw.submitted_at;
  if (!stamp || !Number.isFinite(Date.parse(stamp))) throw new Error('invalid_submitted_at');
  const contact = {};
  if (payload.nome) contact.name = payload.nome;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email || '')) contact.email = payload.email.toLowerCase();
  const phone = String(payload.whatsapp || '').replace(/\D/g, '');
  if (/^[1-9]\d{7,14}$/.test(phone)) contact.phone = '+' + phone;
  if (!contact.email && !contact.phone) throw new Error('invalid_contact');
  const qualification = {};
  if (opts.revenue) qualification.revenue = { raw: String(opts.revenue), currency: 'BRL', period: 'monthly' };
  if (opts.role) qualification.role = { raw: String(opts.role) };
  if (opts.segment) qualification.segment = { raw: String(opts.segment) };
  const attribution = { extra: { source_submission_id: base, phase: 'complete' } };
  const page = raw.page || raw.pagina;
  if (typeof page === 'string' && /^https?:\/\//.test(page)) attribution.page_url = page;
  for (const k of ['referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (typeof raw[k] === 'string' && raw[k]) attribution[k] = raw[k];
  }
  const hash = createHash('sha256').update(JSON.stringify(sort(answers))).digest('hex').slice(0, 24);
  return {
    schema_version: 1, submission_id: `${base}:complete:${hash}`,
    submitted_at: new Date(stamp).toISOString(), contact, answers, qualification, attribution,
  };
}

async function post(url, key, path, prefer, body) {
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: prefer },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const code = r.ok ? '' : ((await r.json().catch(() => ({}))).code || '');
    return { ok: r.ok, status: r.status, code };
  } catch (err) {
    return { ok: false, status: 0, code: (err && err.name) || 'erro' };
  }
}

/* capture null (não deu pra montar) => só a linha de sempre, sem capture_key. */
async function gravarSupabase({ url, key, table, row, capture, source }) {
  const t = encodeURIComponent(table);
  const legado = () => post(url, key, t, 'return=minimal', row);
  const linha = async () => {
    if (!capture) return legado();
    const r = await post(url, key, `${t}?on_conflict=capture_key`, 'resolution=ignore-duplicates,return=minimal',
      { ...row, capture_key: capture.submission_id });
    /* PGRST204 = coluna capture_key não existe; 42P10 = falta o índice único. SQL 01 não rodou. */
    return r.status === 400 && (r.code === 'PGRST204' || r.code === '42P10') ? legado() : r;
  };
  const [lead, captura] = await Promise.all([
    linha(),
    capture ? post(url, key, 'lead_capturas', 'resolution=ignore-duplicates,return=minimal', {
      capture_key: capture.submission_id, source, capture_phase: 'complete', capture_payload: capture,
    }) : { ok: false, status: 0, code: 'sem_capture' },
  ]);
  const key_ = capture ? capture.submission_id : null;
  (lead.ok ? console.log : console.error)('[supabase] leads', { ok: lead.ok, status: lead.status, code: lead.code, key: key_ });
  (captura.ok ? console.log : console.error)('[supabase] lead_capturas', { ok: captura.ok, status: captura.status, code: captura.code, key: key_ });
  return { lead, captura };
}

/* Nunca rejeita. Sem CRM_REGISTRO_URL => não chama nada (gate do deploy). */
function registrarNoCrm(capture) {
  const url = process.env.CRM_REGISTRO_URL || '';
  if (!capture || !/^https:\/\//.test(url)) return Promise.resolve({ ok: false, skipped: true });
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': capture.submission_id },
    body: JSON.stringify(capture),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'error',
  }).then(async (r) => {
    const ok = r.ok && (await r.json().catch(() => ({}))).received === true;
    (ok ? console.log : console.error)('[crm-registro]', { ok, status: r.status, key: capture.submission_id });
    return { ok, status: r.status };
  }).catch((err) => {
    console.error('[crm-registro] erro', { name: err && err.name, key: capture.submission_id });
    return { ok: false, status: 0 };
  });
}

module.exports = { buildCapture, gravarSupabase, registrarNoCrm };
