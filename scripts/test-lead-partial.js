/* Parcial → GHL: upsert sem `tags`, tag form-incompleto, registrar:false não grava fap_form.
   Roda com `node scripts/test-lead-partial.js` (fetch stubado). */
const assert = require('assert');
process.env.SUPABASE_URL = 'https://sb'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
process.env.GHL_PIT_TOKEN = 'pit-test'; process.env.GHL_LOCATION_ID = 'LOC';
const handler = require('../api/lead-partial.js');

async function run(body, ip) {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.includes('/contacts/upsert')) return { ok: true, status: 200, json: async () => ({ new: true, contact: { id: 'C1' } }) };
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
  };
  const res = { statusCode: 0, setHeader() {}, end() {} };
  await handler({ method: 'POST', headers: { 'x-forwarded-for': ip }, socket: {}, body }, res);
  return calls;
}

(async () => {
  let c = await run({ nome: 'Fulano Teste', email: 'f@x.com', whatsapp: '(11) 97425-3168', cargo: 'socio-empresario' }, 'a');
  const up = c.find((x) => x.url.includes('/contacts/upsert'));
  assert.ok(up && !('tags' in up.body), 'upsert sem tags');
  assert.strictEqual(up.body.phone, '+5511974253168');
  assert.ok(c.some((x) => x.url.endsWith('/contacts/C1/tags') && x.body.tags.includes('form-incompleto')));
  assert.ok(c.some((x) => x.url.includes('fap_form')), 'primeiro envio grava fap_form');
  assert.ok(!c.some((x) => x.url.includes('opportunities')), 'parcial nunca cria card');

  c = await run({ email: 'f@x.com', registrar: false }, 'b');
  assert.ok(!c.some((x) => x.url.includes('fap_form')), 'reenvio não duplica fap_form');
  assert.ok(c.some((x) => x.url.includes('/contacts/upsert')));

  c = await run({ nome: 'Só Nome', email: 'nao-e-email', whatsapp: '11999999999', cargo: 'socio-empresario' }, 'c');
  assert.ok(!c.some((x) => x.url.includes('leadconnector') || x.url.includes('/contacts')), 'sem contato válido não vai pro GHL');

  /* treinamento: body string (sendBeacon text/plain), tags próprias, sem fap_form */
  c = await run(JSON.stringify({ funil: 'treinamento', nome: 'Ficha', email: 't@x.com' }), 'd');
  assert.ok(!c.some((x) => x.url.includes('fap_form')), 'treinamento não grava fap_form');
  assert.ok(c.some((x) => x.url.endsWith('/contacts/C1/tags') && x.body.tags.includes('treinamento-form-incompleto')));
  assert.ok(c.some((x) => x.body && x.body.source === 'FAP04 - Treinamento Comercial'));
  c = await run(JSON.stringify({ funil: 'treinamento', nome: 'Ficha', whatsapp: '11999999999' }), 'e');
  assert.strictEqual(c.length, 0, 'treinamento sem contato válido: 204, nada chamado');
  /* perfil do abandono: sócio 40k+ ganha tag de prioridade; abaixo do piso só as tags de valor */
  c = await run({ email: 'p@x.com', cargo: 'socio-empresario', receita: '40k-50k' }, 'f');
  let tg = c.find((x) => x.url.endsWith('/contacts/C1/tags')).body.tags;
  assert.ok(tg.includes('fap01-parcial-perfil') && tg.includes('receita:40k-50k') && tg.includes('cargo:socio-empresario'));
  c = await run({ email: 'p@x.com', cargo: 'socio-empresario', receita: 'abaixo-40k' }, 'g');
  tg = c.find((x) => x.url.endsWith('/contacts/C1/tags')).body.tags;
  assert.ok(!tg.includes('fap01-parcial-perfil') && tg.includes('receita:abaixo-40k'));
  c = await run(JSON.stringify({ funil: 'treinamento', email: 't@x.com', cargo: 'socio-empresario', receita: '50k-100k' }), 'h');
  assert.ok(!c.find((x) => x.url.endsWith('/contacts/C1/tags')).body.tags.includes('fap01-parcial-perfil'), 'perfil é só do fap01');
  console.log('ok — parcial → GHL');
})();
