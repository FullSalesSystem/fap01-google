/* Discador 3C Plus — liga o lead de aplicação direto no ramal de um SDR (06/10/2026).
   POST {instancia}/api/v1/click2call com token de GESTOR + ramal do agente (contrato
   conferido no swagger público e no ~/mvp-crm-fss/lib/integrations/dialer-3cplus.ts).
   A 3C toca o ramal; quando o SDR atende, ela disca o lead. 422 = agente não está
   logado/ocioso. Nunca lança: o lead já está salvo, o discador é bônus de velocidade. */
const TIMEOUT_MS = 6000;

async function click2call(phoneDigits) {
  const base = (process.env.DIALER_BASE_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  const token = process.env.DIALER_TOKEN;
  const extension = process.env.DIALER_RAMAL_APLICACAO;
  if (!base || !token || !extension) return { ok: false, status: 'nao_configurado' };
  if (!/^https:\/\/[a-z0-9-]+\.3c\.plus$/.test(base) || !/^\d{10,15}$/.test(phoneDigits)) return { ok: false, status: 'invalido' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${base}/api/v1/click2call`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ extension: String(extension), phone: phoneDigits }).toString(),
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, status: r.status };
    /* resposta: { data: { call: {...}, agent: { name } } } — o nome vai pra página de obrigado */
    const j = await r.json().catch(() => null);
    const d = (j && j.data) || j || {};
    const nome = d.agent && typeof d.agent.name === 'string' ? d.agent.name.trim().split(/\s+/)[0] : '';
    return { ok: true, status: r.status, sdr: nome.slice(0, 40) };
  } catch (err) {
    return { ok: false, status: 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = click2call;
