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

/* Fila da campanha (06/10/2026): se o click2call falhar (SDR ocupado/deslogado), o lead
   entra na lista da campanha da LP de aplicação e o discador da 3C liga quando houver
   agente livre, no horário da campanha. POST /campaigns/{c}/lists/{l}/mailing.json,
   phone = DDD+número (só Brasil; internacional fica de fora). */
async function enfileirar(phoneDigits, identifier) {
  const base = (process.env.DIALER_BASE_URL || '').replace(/\/+$/, '').replace(/\/api\/v1$/, '');
  const token = process.env.DIALER_TOKEN;
  const campanha = process.env.DIALER_CAMPANHA_APLICACAO;
  const lista = process.env.DIALER_LISTA_APLICACAO;
  if (!base || !token || !campanha || !lista) return { ok: false, status: 'nao_configurado' };
  if (!/^55\d{10,11}$/.test(phoneDigits) || !/^\d+$/.test(campanha + lista)) return { ok: false, status: 'invalido' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${base}/api/v1/campaigns/${campanha}/lists/${lista}/mailing.json`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify([{ phone: phoneDigits.slice(2), identifier: String(identifier || '').slice(0, 80) }]),
      signal: ctrl.signal,
    });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, status: 'erro' };
  } finally {
    clearTimeout(timer);
  }
}

/* A campanha só disca das 08:00 às 19:30 (horário de Brasília). */
function campanhaNoHorario(agora = new Date()) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(agora).split(':').map(Number);
  const min = h * 60 + m;
  return min >= 8 * 60 && min < 19 * 60 + 30;
}

module.exports = click2call;
module.exports.enfileirar = enfileirar;
module.exports.campanhaNoHorario = campanhaNoHorario;
