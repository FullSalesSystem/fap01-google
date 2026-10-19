/* Supabase primeiro + registro no CRM (contrato 19/10/2026). fetch stubado.
   Roda com `node scripts/test-lead-registro.js`. */
const assert = require('assert');
process.env.SUPABASE_URL = 'https://sb'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
process.env.GHL_PIT_TOKEN = 'pit-test'; process.env.GHL_LOCATION_ID = 'LOC';
const handler = require('../api/lead.js');

const BODY = {
  submission_id: 'sub_teste_0001', submitted_at: '2026-10-19T12:00:00.000Z', page: 'https://fap01.vendasfullsalessystem.com.br/?utm_source=google',
  nome: 'Fulano Teste', email: 'F@x.com', whatsapp: '(11) 97425-3168', cargo: 'colaborador-funcionario',
  segmento: 'saude', receita: 'abaixo-40k', utm_source: 'google',
};

async function run(body, ip, { leadsFail, crmThrows } = {}) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method, headers: opts.headers || {}, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.includes('crm.test')) {
      if (crmThrows) throw Object.assign(new Error('x'), { name: 'TimeoutError' });
      return { ok: true, status: 201, json: async () => ({ received: true }) };
    }
    if (leadsFail && url.includes('on_conflict=capture_key')) return { ok: false, status: 400, json: async () => ({ code: 'PGRST204' }) };
    if (url.includes('/contacts/upsert')) return { ok: true, status: 200, json: async () => ({ contact: { id: 'C1' } }) };
    if (url.includes('/opportunities/search')) return { ok: true, status: 200, json: async () => ({ opportunities: [] }) };
    return { ok: true, status: 201, json: async () => ({}), text: async () => '' };
  };
  const res = { statusCode: 0, setHeader() {}, end(b) { this.body = JSON.parse(b); } };
  await handler({ method: 'POST', headers: { 'x-forwarded-for': ip }, socket: {}, body }, res);
  return { calls, res };
}

(async () => {
  /* sem CRM_REGISTRO_URL: grava Supabase primeiro, não chama o CRM, GHL igual */
  let { calls, res } = await run({ ...BODY }, 'a');
  const leads = calls.find((c) => c.url.includes(encodeURIComponent('[Leads] FAP01')));
  const cap = calls.find((c) => c.url.endsWith('/rest/v1/lead_capturas'));
  assert.ok(leads.url.endsWith('?on_conflict=capture_key') && /ignore-duplicates/.test(leads.headers.Prefer));
  assert.strictEqual(cap.body.source, 'fap01google');
  assert.strictEqual(cap.body.capture_phase, 'complete');
  assert.strictEqual(leads.body.capture_key, cap.body.capture_key);
  assert.strictEqual(cap.body.capture_payload.submission_id, cap.body.capture_key);
  assert.match(cap.body.capture_key, /^sub_teste_0001:complete:[0-9a-f]{24}$/);
  assert.strictEqual(cap.body.capture_payload.contact.phone, '+5511974253168');
  assert.ok(!('ghl_tags' in cap.body.capture_payload.attribution.extra) && !('marketing' in cap.body.capture_payload.attribution.extra));
  assert.ok(calls.indexOf(leads) < calls.findIndex((c) => c.url.includes('/contacts/upsert')), 'Supabase antes do GHL');
  assert.ok(!calls.some((c) => c.url.includes('crm.test')), 'sem URL nao chama o CRM');
  assert.strictEqual(res.statusCode, 202);
  const key1 = cap.body.capture_key;

  /* com URL: mesmo objeto do lead_capturas, Idempotency-Key = chave */
  process.env.CRM_REGISTRO_URL = 'https://crm.test/api/webhooks/inbound/tok';
  ({ calls, res } = await run({ ...BODY }, 'b'));
  const crm = calls.find((c) => c.url.includes('crm.test'));
  const cap2 = calls.find((c) => c.url.endsWith('/rest/v1/lead_capturas'));
  assert.deepStrictEqual(crm.body, cap2.body.capture_payload);
  assert.strictEqual(crm.headers['Idempotency-Key'], key1, 'mesma resposta => mesma chave');
  assert.strictEqual(res.statusCode, 202);

  /* CRM fora + SQL 01 não rodado: lead segue igual e a linha cai no insert de sempre */
  ({ calls, res } = await run({ ...BODY }, 'c', { leadsFail: true, crmThrows: true }));
  const legado = calls.filter((c) => c.url.endsWith(encodeURIComponent('[Leads] FAP01')));
  assert.strictEqual(legado.length, 1);
  assert.ok(!('capture_key' in legado[0].body));
  assert.strictEqual(res.statusCode, 202);
  assert.ok(calls.some((c) => c.url.includes('/contacts/upsert')));

  console.log('ok test-lead-registro');
})().catch((e) => { console.error(e); process.exit(1); });
