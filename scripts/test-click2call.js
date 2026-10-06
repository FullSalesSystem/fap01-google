/* 3C Plus: só qualificado/semi disparam click2call no ramal da aplicação; desqualificado nunca.
   Roda com `node scripts/test-click2call.js` (fetch stubado). */
const assert = require('assert');
process.env.GHL_PIT_TOKEN = 'pit-test';
process.env.GHL_LOCATION_ID = 'LOC';
process.env.DIALER_BASE_URL = 'https://fullsales.3c.plus';
process.env.DIALER_TOKEN = 'tok';
process.env.DIALER_RAMAL_APLICACAO = '1007';
process.env.GHL_SDR_APLICACAO = 'RAUL';
delete process.env.SUPABASE_URL;
const handler = require('../api/lead.js');

async function run(receita, ip, status3c = 200, utm = '') {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: (opts && opts.method) || 'GET', body: opts && opts.body });
    if (url.includes('3c.plus')) return { ok: status3c < 300, status: status3c, json: async () => ({ data: { call: { id: 'x' }, agent: { name: 'Raul Fernandez' } } }) };
    if (url.includes('/contacts/upsert')) return { ok: true, status: 200, json: async () => ({ contact: { id: 'C1' } }) };
    if (url.includes('/opportunities/search')) return { ok: true, status: 200, json: async () => ({ opportunities: [] }) };
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  };
  const res = { statusCode: 0, setHeader() {}, end(b) { this.body = b; } };
  await handler({ method: 'POST', headers: { 'x-forwarded-for': ip }, socket: {}, body: {
    submission_id: 'testsubmission1', submitted_at: new Date().toISOString(), page: 'https://fap01.fullsalessystem.com/',
    nome: 'Fulano Teste', email: 'fulano@example.com', whatsapp: '+55 11974253168',
    cargo: 'socio-empresario', segmento: 'outro', receita, dor: '', instagram: '',
    utm_source: utm, utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '' } }, res);
  const dial = calls.filter((c) => c.url.includes('3c.plus'));
  const tags = calls.filter((c) => c.url.endsWith('/contacts/C1/tags') && c.body).map((c) => JSON.parse(c.body).tags).flat();
  const assigns = calls.filter((c) => c.body && typeof c.body === 'string' && c.body.includes('"assignedTo":"RAUL"')).map((c) => c.url.replace(/.*\.com\//, '').split('/')[0]);
  return { dial, tags, body: JSON.parse(res.body), assigns };
}

(async () => {
  const q = await run('100k-300k', 'ip-q');
  assert.strictEqual(q.dial.length, 1, 'qualificado liga 1x');
  assert.ok(q.dial[0].url.endsWith('/api/v1/click2call'));
  assert.strictEqual(q.dial[0].body, 'extension=1007&phone=5511974253168');
  assert.ok(q.tags.includes('3c-ligacao-disparada'));
  assert.deepStrictEqual(q.body.ligacao, { sdr: 'Raul' }, 'API devolve o SDR que está ligando');
  const s = await run('40k-50k', 'ip-s', 422);
  assert.strictEqual(s.dial.length, 1, 'semi liga 1x');
  assert.ok(s.tags.includes('3c-ramal-indisponivel'), '422 = ramal indisponível');
  assert.strictEqual(s.body.ligacao, null, 'sem ligação, página não promete');
  assert.deepStrictEqual(q.assigns.sort(), ['contacts', 'opportunities'], 'qualificado: contato e card do Raul');
  assert.deepStrictEqual(s.assigns.sort(), ['contacts', 'opportunities'], 'semi: contato e card do Raul');
  const d = await run('abaixo-40k', 'ip-d');
  assert.strictEqual(d.assigns.length, 0, 'desqualificado não vai pro Raul');
  assert.strictEqual(d.dial.length, 0, 'desqualificado nunca liga');
  const e = await run('50k-100k', 'ip-e', 200, 'e2e-check');
  assert.strictEqual(e.dial.length, 0, 'lead do monitor/E2E nunca liga');
  console.log('ok — click2call só pra qualificado/semi');
})();
