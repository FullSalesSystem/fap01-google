/* 3C Plus: todo qualificado/semi entra na fila da campanha da LP de aplicação; desqualificado
   e lead sintético nunca. Contato e card nascem com o SDR da aplicação.
   Roda com `node scripts/test-click2call.js` (fetch stubado). */
const assert = require('assert');
process.env.GHL_PIT_TOKEN = 'pit-test';
process.env.GHL_LOCATION_ID = 'LOC';
process.env.DIALER_BASE_URL = 'https://fullsales.3c.plus';
process.env.DIALER_TOKEN = 'tok';
process.env.DIALER_CAMPANHA_APLICACAO = '322705';
process.env.DIALER_LISTA_APLICACAO = '4946059';
process.env.DIALER_SDR_NOME = 'Raul';
process.env.GHL_SDR_APLICACAO = 'RAUL';
delete process.env.SUPABASE_URL;
const handler = require('../api/lead.js');
const { campanhaNoHorario } = require('../api/_click2call.js');

async function run(receita, ip, utm = '', status3c = 200) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: (opts && opts.method) || 'GET', body: opts && opts.body });
    if (url.includes('3c.plus')) return { ok: status3c < 300, status: status3c, json: async () => ({}) };
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
  const assigns = calls.filter((c) => typeof c.body === 'string' && c.body.includes('"assignedTo":"RAUL"')).map((c) => c.url.replace(/.*\.com\//, '').split('/')[0]);
  return { dial, tags, assigns, body: JSON.parse(res.body) };
}

(async () => {
  const promessa = campanhaNoHorario() ? { sdr: 'Raul', agora: false } : null;
  for (const receita of ['100k-300k', '40k-50k']) {
    const r = await run(receita, 'ip-' + receita);
    assert.strictEqual(r.dial.length, 1, receita + ': 1 chamada à 3C');
    assert.ok(r.dial[0].url.endsWith('/campaigns/322705/lists/4946059/mailing.json'), 'vai pra fila, não click2call');
    assert.deepStrictEqual(JSON.parse(r.dial[0].body), [{ phone: '11974253168', identifier: 'Fulano Teste' }]);
    assert.ok(r.tags.includes('3c-fila-campanha'));
    assert.deepStrictEqual(r.body.ligacao, promessa, 'página só promete no horário da campanha');
    assert.deepStrictEqual(r.assigns.sort(), ['contacts', 'opportunities'], 'contato e card do Raul');
  }
  const f = await run('50k-100k', 'ip-f', '', 500);
  assert.ok(f.tags.includes('3c-fila-falhou') && f.body.ligacao === null, 'fila falhou: tag e sem promessa');
  const d = await run('abaixo-40k', 'ip-d');
  assert.strictEqual(d.dial.length, 0, 'desqualificado nunca entra');
  assert.strictEqual(d.assigns.length, 0, 'desqualificado não vai pro Raul');
  const e = await run('50k-100k', 'ip-e', 'e2e-check');
  assert.strictEqual(e.dial.length, 0, 'lead do monitor/E2E nunca entra');
  console.log('ok — qualificado/semi entram na fila da campanha da 3C');
})();
