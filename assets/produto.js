var THIRD_PARTY_LOADED = false;
var GTAG_ID = 'AW-11465446145';

function loadScript(src, attrs) {
  var script = document.createElement('script');
  script.src = src;
  script.async = true;
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      script.setAttribute(key, attrs[key]);
    });
  }
  document.head.appendChild(script);
}

function bootThirdParty() {
  if (THIRD_PARTY_LOADED) return;
  THIRD_PARTY_LOADED = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GTAG_ID);

  loadScript('https://www.googletagmanager.com/gtag/js?id=' + GTAG_ID);
}

function scheduleThirdPartyBoot() {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(function () { bootThirdParty(); }, { timeout: 3500 });
  } else {
    setTimeout(bootThirdParty, 3500);
  }

  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (eventName) {
    window.addEventListener(eventName, bootThirdParty, { once: true, passive: true });
  });
}

var formOpenedAt = Date.now();

    // Modal
    function openModal() {
      document.getElementById('modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      bootThirdParty();
      formOpenedAt = Date.now();
      // ponte da vitrine de depoimentos: setor tocado pré-marca o segmento (só se nada foi escolhido)
      try {
        var segSalvo = sessionStorage.getItem('fss_segmento');
        if (segSalvo && !document.querySelector('input[name="segmento"]:checked')) {
          var radio = document.querySelector('input[name="segmento"][value="' + segSalvo + '"]');
          if (radio) radio.checked = true;
        }
      } catch (e) { /* storage indisponível */ }
      syncInstagramField();
      /* navegação do wizard mora no v2.js — reseta pro passo 1 por lá */
      if (window.__v2WizardOpen) window.__v2WizardOpen();
    }
    function closeModal() {
      document.getElementById('modal').classList.remove('open');
      document.body.style.overflow = '';
    }
    document.getElementById('modal').addEventListener('click', function(e) {
      if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    // Form submit with redirect logic
    function sanitizeText(value, maxLen) {
      return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function digitsOnly(value) {
      return String(value || '').replace(/\D/g, '');
    }

    /* ── Telefone internacional (modo "+") ────────────────────────
       Se o PRIMEIRO caractere digitado no WhatsApp for "+", o campo
       vira modo internacional livre: aceita +, dígitos e espaços,
       sem máscara BR e ignorando o select de país. Normaliza pra
       "+CC NUMERO". CC (código do país, ITU): 1 e 7 têm 1 dígito;
       conjunto fechado de 2 dígitos; o resto tem 3. */
    var CC_1DIGIT = { '1': 1, '7': 1 };
    var CC_2DIGIT = {
      '20': 1, '27': 1, '30': 1, '31': 1, '32': 1, '33': 1, '34': 1, '36': 1, '39': 1,
      '40': 1, '41': 1, '43': 1, '44': 1, '45': 1, '46': 1, '47': 1, '48': 1, '49': 1,
      '51': 1, '52': 1, '53': 1, '54': 1, '55': 1, '56': 1, '57': 1, '58': 1,
      '60': 1, '61': 1, '62': 1, '63': 1, '64': 1, '65': 1, '66': 1,
      '81': 1, '82': 1, '84': 1, '86': 1,
      '90': 1, '91': 1, '92': 1, '93': 1, '94': 1, '95': 1, '98': 1
    };

    function isIntlPhoneMode(raw) {
      return String(raw || '').trim().charAt(0) === '+';
    }

    /* "+351 912345678" | "+351912345678" → { cc:'351', num:'912345678',
       full:'+351 912345678' }. Null quando não está no modo "+" ou o
       número (sem CC) foge de 8-15 dígitos. */
    function normalizeIntlPhone(raw) {
      var v = String(raw || '').trim();
      if (v.charAt(0) !== '+') return null;
      if (!/^\+[\d\s]+$/.test(v)) return null;
      var digits = v.slice(1).replace(/\D/g, '');
      var cc;
      if (CC_1DIGIT[digits.slice(0, 1)]) cc = digits.slice(0, 1);
      else if (CC_2DIGIT[digits.slice(0, 2)]) cc = digits.slice(0, 2);
      else cc = digits.slice(0, 3);
      var num = digits.slice(cc.length);
      if (!cc || num.length < 8 || num.length > 15) return null;
      return { cc: cc, num: num, full: '+' + cc + ' ' + num };
    }
    /* v2.js reusa a mesma regra (validação do passo 6 e beacon de parcial) */
    window.__fssIntlPhone = normalizeIntlPhone;

    // Instagram só é perguntado pra quem fatura acima de R$ 50 mil/mês
    var INSTAGRAM_RECEITAS = ['50k-100k', '100k-300k', '300k-500k', '500k-1m', 'acima-1m'];

    function instagramFieldVisible() {
      var box = document.getElementById('field-instagram');
      return Boolean(box && !box.hidden);
    }

    function syncInstagramField() {
      var box = document.getElementById('field-instagram');
      var input = document.getElementById('f-instagram');
      if (!box || !input) return;
      var receitaEl = document.querySelector('input[name="receita"]:checked');
      var show = Boolean(receitaEl && INSTAGRAM_RECEITAS.indexOf(receitaEl.value) !== -1);
      box.hidden = !show;
      input.required = show;
    }

    // Aceita "@fulano", "fulano" ou o link do perfil; devolve "@fulano"
    function normalizeInstagram(value) {
      var v = sanitizeText(value, 80)
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/[?#/].*$/, '')
        .replace(/\s+/g, '')
        .replace(/^@+/, '');
      if (!v) return '';
      return /^[A-Za-z0-9._]{1,30}$/.test(v) ? '@' + v : sanitizeText(value, 60);
    }

    function safeRedirect(url) {
      window.location.assign(url);
    }

    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var UTM_STORAGE_KEY = 'fap01_utms';

    function captureUtms() {
      try {
        var params = new URLSearchParams(window.location.search);
        var stored = {};
        try { stored = JSON.parse(sessionStorage.getItem(UTM_STORAGE_KEY) || '{}'); } catch (_) {}
        var merged = {};
        UTM_KEYS.forEach(function (k) {
          var v = params.get(k);
          merged[k] = (v && v.length) ? v.slice(0, 200) : (stored[k] || '');
        });
        try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged)); } catch (_) {}
        return merged;
      } catch (_) {
        return { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '' };
      }
    }

    /* Click IDs (Meta/Google) pra atribuição offline via CAPI / Enhanced
       Conversions. Mesmo padrão sessionStorage das UTMs: se a URL já foi
       "limpa" antes do lead abrir o modal, o valor original persiste. */
    /* gad_source e gad_campaignid vêm junto do gclid em anúncios Google
       modernos (Search/Display/YouTube) — mesma leitura da URL. */
    var CLICK_ID_KEYS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'gad_source', 'gad_campaignid'];
    var CLICK_ID_STORAGE_KEY = 'fap01_click_ids';

    function captureClickIds() {
      try {
        var params = new URLSearchParams(window.location.search);
        var stored = {};
        try { stored = JSON.parse(sessionStorage.getItem(CLICK_ID_STORAGE_KEY) || '{}'); } catch (_) {}
        var merged = {};
        CLICK_ID_KEYS.forEach(function (k) {
          var v = params.get(k);
          merged[k] = (v && v.length) ? v.slice(0, 512) : (stored[k] || '');
        });
        try { sessionStorage.setItem(CLICK_ID_STORAGE_KEY, JSON.stringify(merged)); } catch (_) {}
        return merged;
      } catch (_) {
        return { fbclid: '', gclid: '', gbraid: '', wbraid: '', gad_source: '', gad_campaignid: '' };
      }
    }

    function readCookie(name) {
      try {
        var re = new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
        var m = document.cookie.match(re);
        return m ? decodeURIComponent(m[1]) : '';
      } catch (_) { return ''; }
    }

    /* _fbc e _fbp são setados pelo Pixel Meta. Lidos no submit — em localhost
       podem vir vazios (Pixel só cria em domínio real); em prod existem. */
    function readMetaCookies() {
      return { fbc: readCookie('_fbc'), fbp: readCookie('_fbp') };
    }

    captureUtms();
    captureClickIds();

    function createSubmissionId() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      return 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }

    /* ── CAPTURA EM DUAS FASES ─────────────────────────────────
       Fase 1: ao concluir o WhatsApp (antes da etapa do Instagram),
       o lead já vai inteiro pro /api/lead — se a pessoa abandonar no
       Instagram, o lead NÃO se perde. Fase 2: o envio final manda só
       o @ pro /api/lead-instagram, que atualiza contato + linha. */
    var leadCapturado = null; // { submission_id, submitted_at, email, whatsapp }

    function coletarContato() {
      var phoneRaw = document.getElementById('f-whatsapp').value;
      var intl = normalizeIntlPhone(phoneRaw); // null fora do modo "+" ou inválido
      var pais = document.getElementById('f-country-code').value;
      /* modo "+" inválido → digits vazio: reprova nos checks de 8-15 */
      var digits = isIntlPhoneMode(phoneRaw)
        ? (intl ? intl.num : '')
        : digitsOnly(phoneRaw);
      return {
        nome: sanitizeText(document.getElementById('f-nome').value, 120),
        email: sanitizeText(document.getElementById('f-email').value, 254).toLowerCase(),
        whatsappDigits: digits,
        whatsapp: intl ? intl.full : '+' + pais + ' ' + digits,
      };
    }

    /* Chamado pelo v2.js ao avançar do WhatsApp pra etapa do Instagram.
       Retorna true quando o lead foi (ou já tinha sido) capturado. */
    window.__fap01PreInstagram = function () {
      var c = coletarContato();
      if (document.getElementById('f-website').value) return false;      // honeypot
      if (Date.now() - formOpenedAt < 1800) return false;                // rápido demais (bot)
      if (!isValidEmail(c.email)) return false;
      if (c.whatsappDigits.length < 8 || c.whatsappDigits.length > 15) return false;

      /* voltou, trocou contato e seguiu de novo → captura de novo com os dados atuais */
      if (leadCapturado && leadCapturado.email === c.email && leadCapturado.whatsapp === c.whatsapp) {
        return true;
      }

      var cargoEl = document.querySelector('input[name="cargo"]:checked');
      var segmentoEl = document.querySelector('input[name="segmento"]:checked');
      var receitaEl = document.querySelector('input[name="receita"]:checked');
      var utms = captureUtms();
      var clickIds = captureClickIds();
      var metaCookies = readMetaCookies();
      var submissionId = createSubmissionId();
      var submittedAt = new Date().toISOString();

      var payload = {
        submission_id: submissionId,
        submitted_at: submittedAt,
        page: window.location.href,
        nome: c.nome,
        email: c.email,
        whatsapp: c.whatsapp,
        cargo: cargoEl ? cargoEl.value : '',
        segmento: segmentoEl ? segmentoEl.value : '',
        receita: receitaEl ? receitaEl.value : '',
        dor: '',
        instagram: '',
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        fbclid: clickIds.fbclid,
        gclid: clickIds.gclid,
        gbraid: clickIds.gbraid,
        wbraid: clickIds.wbraid,
        gad_source: clickIds.gad_source,
        gad_campaignid: clickIds.gad_campaignid,
        fbc: metaCookies.fbc,
        fbp: metaCookies.fbp,
        lead_timestamp: submittedAt,
      };

      leadCapturado = { submission_id: submissionId, submitted_at: submittedAt, email: c.email, whatsapp: c.whatsapp };

      try {
        fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(function () {});
      } catch (_) {}

      return true;
    };

    function handleFormSubmit(e) {
      e.preventDefault();
      var nome     = sanitizeText(document.getElementById('f-nome').value, 120);
      var email    = sanitizeText(document.getElementById('f-email').value, 254).toLowerCase();
      var pais     = document.getElementById('f-country-code').value;
      var phoneRaw = document.getElementById('f-whatsapp').value;
      var intl     = normalizeIntlPhone(phoneRaw); // null fora do modo "+" ou inválido
      var whatsappDigits = isIntlPhoneMode(phoneRaw)
        ? (intl ? intl.num : '')
        : digitsOnly(phoneRaw);
      var whatsapp = intl ? intl.full : '+' + pais + ' ' + whatsappDigits;
      var cargoEl = document.querySelector('input[name="cargo"]:checked');
      var cargo = cargoEl ? cargoEl.value : '';
      var segmentoEl = document.querySelector('input[name="segmento"]:checked');
      var segmento = segmentoEl ? segmentoEl.value : '';
      var receitaEl = document.querySelector('input[name="receita"]:checked');
      var receita = receitaEl ? receitaEl.value : '';
      var dorEl = document.querySelector('input[name="dor"]:checked');
      var dor = dorEl ? dorEl.value : '';
      var instagramInput = document.getElementById('f-instagram');
      var instagram = (instagramFieldVisible() && instagramInput) ? normalizeInstagram(instagramInput.value) : '';
      var websiteTrap = document.getElementById('f-website').value;
      var submitElapsed = Date.now() - formOpenedAt;

      if (websiteTrap) {
        return safeRedirect('https://fap01-obrigado-lf.fullsalessystem.com');
      }
      if (submitElapsed < 1800) {
        return safeRedirect('https://fap01-obrigado-lf.fullsalessystem.com');
      }
      if (!isValidEmail(email)) {
        return alert('Informe um e-mail valido.');
      }
      if (whatsappDigits.length < 8 || whatsappDigits.length > 15) {
        return alert('Informe um WhatsApp valido.');
      }
      if (instagramFieldVisible() && !instagram) {
        return alert('Informe o @ do seu Instagram.');
      }

      var isEligibleCargo = (cargo === 'socio-empresario');
      var isHighRevenue = (receita === '50k-100k' || receita === '100k-300k' || receita === '300k-500k' || receita === '500k-1m' || receita === 'acima-1m');
      var isSemiRevenue = (receita === '30k-50k');

      var submissionId = createSubmissionId();

      var redirectUrl;
      if (isEligibleCargo && isHighRevenue) {
        redirectUrl = 'https://fap01-calendly.fullsalessystem.com';
      } else if (isEligibleCargo && isSemiRevenue) {
        redirectUrl = 'https://fap01-calendly-semi.fullsalessystem.com';
      } else {
        redirectUrl = 'https://fap01-obrigado-lf.fullsalessystem.com';
      }

      var utms = captureUtms();
      var clickIds = captureClickIds();
      var metaCookies = readMetaCookies();
      var submittedAtIso = new Date().toISOString();

      var redirectParams = new URLSearchParams({
        nome: nome,
        email: email,
        whatsapp: whatsapp,
        cargo: cargo,
        segmento: segmento,
        receita: receita,
        dor: dor
      });
      if (instagram) redirectParams.set('instagram', instagram);
      UTM_KEYS.forEach(function(k) {
        if (utms[k]) redirectParams.set(k, utms[k]);
      });
      /* Click IDs seguem pra próxima página (Calendly/obrigado) pra permitir
         que o Pixel/Google Tag da landing final gere eventos correlacionados. */
      CLICK_ID_KEYS.forEach(function(k) {
        if (clickIds[k]) redirectParams.set(k, clickIds[k]);
      });

      var payload = {
        submission_id: submissionId,
        submitted_at: submittedAtIso,
        page: window.location.href,
        nome: nome,
        email: email,
        whatsapp: whatsapp,
        cargo: cargo,
        segmento: segmento,
        receita: receita,
        dor: dor,
        instagram: instagram,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
        fbclid: clickIds.fbclid,
        gclid: clickIds.gclid,
        gbraid: clickIds.gbraid,
        wbraid: clickIds.wbraid,
        gad_source: clickIds.gad_source,
        gad_campaignid: clickIds.gad_campaignid,
        fbc: metaCookies.fbc,
        fbp: metaCookies.fbp,
        lead_timestamp: submittedAtIso,
      };

      /* Fase 2: se o lead já foi capturado antes da etapa do Instagram,
         o envio final só ATUALIZA o contato/linha com o @ (evita duplicar). */
      var request;
      if (leadCapturado) {
        if (instagram) {
          request = fetch('/api/lead-instagram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              submission_id: leadCapturado.submission_id,
              submitted_at: leadCapturado.submitted_at,
              page: window.location.href,
              email: leadCapturado.email,
              whatsapp: leadCapturado.whatsapp,
              instagram: instagram,
            }),
            keepalive: true,
          });
        } else {
          request = Promise.resolve();
        }
      } else {
        request = fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      Promise.race([
        request,
        new Promise(function(resolve) { setTimeout(resolve, 2500); })
      ]).finally(function () {
        safeRedirect(redirectUrl + '?' + redirectParams.toString());
      });
    }

    // Phone mask by country
    (function () {
      var countrySelect = document.getElementById('f-country-code');
      var phoneInput    = document.getElementById('f-whatsapp');

      var masks = {
        '55':  { ph: '(11) 99999-9999',  max: 11, fmt: function(d) {
          if (d.length <= 2) return '(' + d;
          if (d.length <= 7) return '(' + d.slice(0,2) + ') ' + d.slice(2);
          return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
        }},
        '1':   { ph: '(555) 555-5555',   max: 10, fmt: function(d) {
          if (d.length <= 3) return '(' + d;
          if (d.length <= 6) return '(' + d.slice(0,3) + ') ' + d.slice(3);
          return '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6);
        }},
        '351': { ph: '912 345 678',       max: 9,  fmt: function(d) {
          if (d.length <= 3) return d;
          if (d.length <= 6) return d.slice(0,3) + ' ' + d.slice(3);
          return d.slice(0,3) + ' ' + d.slice(3,6) + ' ' + d.slice(6);
        }},
        '54':  { ph: '(11) 1234-5678',    max: 10, fmt: function(d) {
          if (d.length <= 2) return '(' + d;
          if (d.length <= 6) return '(' + d.slice(0,2) + ') ' + d.slice(2);
          return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
        }},
        '57':  { ph: '312 345 6789',      max: 10, fmt: function(d) {
          if (d.length <= 3) return d;
          if (d.length <= 6) return d.slice(0,3) + ' ' + d.slice(3);
          return d.slice(0,3) + ' ' + d.slice(3,6) + ' ' + d.slice(6);
        }},
        '52':  { ph: '55 1234 5678',      max: 10, fmt: function(d) {
          if (d.length <= 2) return d;
          if (d.length <= 6) return d.slice(0,2) + ' ' + d.slice(2);
          return d.slice(0,2) + ' ' + d.slice(2,6) + ' ' + d.slice(6);
        }},
        '56':  { ph: '9 1234 5678',       max: 9,  fmt: function(d) {
          if (d.length <= 1) return d;
          if (d.length <= 5) return d.slice(0,1) + ' ' + d.slice(1);
          return d.slice(0,1) + ' ' + d.slice(1,5) + ' ' + d.slice(5);
        }},
        '598': { ph: '094 123 456',       max: 8,  fmt: function(d) {
          if (d.length <= 3) return d;
          if (d.length <= 6) return d.slice(0,3) + ' ' + d.slice(3);
          return d.slice(0,3) + ' ' + d.slice(3,6) + ' ' + d.slice(6);
        }},
        '595': { ph: '0981 123 456',      max: 9,  fmt: function(d) {
          if (d.length <= 4) return d;
          if (d.length <= 7) return d.slice(0,4) + ' ' + d.slice(4);
          return d.slice(0,4) + ' ' + d.slice(4,7) + ' ' + d.slice(7);
        }},
        '51':  { ph: '987 654 321',       max: 9,  fmt: function(d) {
          if (d.length <= 3) return d;
          if (d.length <= 6) return d.slice(0,3) + ' ' + d.slice(3);
          return d.slice(0,3) + ' ' + d.slice(3,6) + ' ' + d.slice(6);
        }},
        '34':  { ph: '612 34 56 78',      max: 9,  fmt: function(d) {
          if (d.length <= 3) return d;
          if (d.length <= 5) return d.slice(0,3) + ' ' + d.slice(3);
          if (d.length <= 7) return d.slice(0,3) + ' ' + d.slice(3,5) + ' ' + d.slice(5);
          return d.slice(0,3) + ' ' + d.slice(3,5) + ' ' + d.slice(5,7) + ' ' + d.slice(7);
        }},
        '44':  { ph: '07911 123456',      max: 11, fmt: function(d) {
          if (d.length <= 5) return d;
          return d.slice(0,5) + ' ' + d.slice(5);
        }}
      };

      function getMask(code) { return masks[code] || { ph: '99999-9999', max: 10, fmt: function(d) { return d; } }; }

      function updatePlaceholder() {
        phoneInput.placeholder = getMask(countrySelect.value).ph;
        phoneInput.value = '';
      }

      countrySelect.addEventListener('change', updatePlaceholder);

      phoneInput.addEventListener('input', function(e) {
        var raw = e.target.value.replace(/^\s+/, '');
        /* Primeiro caractere "+": modo internacional livre — sem máscara.
           Aceita só +, dígitos e espaços (regra única dos funis FSS). */
        if (raw.charAt(0) === '+') {
          var clean = '+' + raw.slice(1).replace(/[^\d ]/g, '').replace(/ {2,}/g, ' ');
          if (clean !== e.target.value) e.target.value = clean;
          return;
        }
        var m = getMask(countrySelect.value);
        var d = raw.replace(/\D/g, '').substring(0, m.max);
        e.target.value = d.length === 0 ? '' : m.fmt(d);
      });
    })();

    // Navegação do wizard mora no v2.js. Aqui só a regra de negócio:
    // a receita escolhida define se a etapa do Instagram entra no fluxo (50k+).
    document.querySelectorAll('input[name="receita"]').forEach(function(r) {
      r.addEventListener('change', function() { syncInstagramField(); });
    });

    // Attach modal to all CTA buttons
    document.querySelectorAll('a[href="#form"], a.navbar-cta').forEach(a => {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        openModal();
      });
    });

    // Link direto pro formulário: ?cadastro=1 / ?form=1 / #cadastro / #form abrem o wizard já iniciado
    (function () {
      function hashPedeForm() {
        var h = window.location.hash;
        return h === '#form' || h === '#cadastro';
      }
      var params = new URLSearchParams(window.location.search);
      if (params.has('cadastro') || params.has('form') || hashPedeForm()) {
        setTimeout(openModal, 400);
      }
      // CTA dentro do player VTurb (shadow DOM) navega pra #form sem passar pelos
      // listeners de clique da página — o hashchange cobre esse caminho
      window.addEventListener('hashchange', function () {
        if (hashPedeForm()) openModal();
      });
    })();

    // Scroll reveal
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // FAQ
    function toggleFaq(btn) {
      const item = btn.closest('.faq-item');
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!open) item.classList.add('open');
    }

    // Testimonials carousel
    (function () {
      const carousel = document.getElementById('testiCarousel');
      if (!carousel) return;
      const STEP = 378;
      let timer;

      function next() {
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        if (carousel.scrollLeft >= maxScroll - 4) {
          carousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          carousel.scrollBy({ left: STEP, behavior: 'smooth' });
        }
      }

      function startAuto() { timer = setInterval(next, 3500); }
      function stopAuto() { clearInterval(timer); }

      startAuto();
      carousel.addEventListener('mouseenter', stopAuto);
      carousel.addEventListener('mouseleave', startAuto);
      carousel.addEventListener('touchstart', stopAuto, { passive: true });
      carousel.addEventListener('touchend', () => { setTimeout(startAuto, 4000); }, { passive: true });

      document.querySelector('.carousel-btn--prev').addEventListener('click', () => {
        stopAuto();
        carousel.scrollBy({ left: -STEP, behavior: 'smooth' });
        setTimeout(startAuto, 4000);
      });
      document.querySelector('.carousel-btn--next').addEventListener('click', () => {
        stopAuto();
        next();
        setTimeout(startAuto, 4000);
      });
    })();

    // Fixed bottom bar - always visible
    (function() {
      var cta = document.getElementById('fixed-bar-cta');
      if (cta) {
        cta.addEventListener('click', function(e) {
          e.preventDefault();
          openModal();
        });
      }
    })();

// Exit Popup - dispara 1x por visita
    (function () {
      if (sessionStorage.getItem('exitPopupShown')) return;

      var overlay = document.getElementById('exit-popup-overlay');

      function openExitPopup() {
        if (sessionStorage.getItem('exitPopupShown')) return;
        // nunca por cima do formulario aberto
        var modalEl = document.getElementById('modal');
        if (modalEl && modalEl.classList.contains('open')) return;
        sessionStorage.setItem('exitPopupShown', '1');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'exit_popup_view' });
      }

      function closeExitPopup() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }

      // Gatilho: mouse saindo pelo topo da janela (intencao de fechar aba/navegar)
      // relatedTarget === null garante que o cursor saiu do viewport de verdade
      document.addEventListener('mouseleave', function (e) {
        if (e.relatedTarget === null && e.clientY <= 0) {
          openExitPopup();
        }
      });

      // Gatilho mobile: scroll rapido pra cima (>100px em <250ms) depois de ja ter
      // descido a pagina — sinal de saida em touch, onde mouseleave nunca dispara.
      // Sem gatilho de inatividade de proposito: quem assiste a VSL fica parado.
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        var anchorY = window.scrollY;
        var anchorT = Date.now();
        window.addEventListener('scroll', function () {
          var now = Date.now();
          var y = window.scrollY;
          if (now - anchorT > 250) {
            anchorY = y;
            anchorT = now;
            return;
          }
          if (anchorY - y > 100 && y > 400) openExitPopup();
        }, { passive: true });
      }

      // Fechar ao clicar no X
      document.getElementById('exit-popup-close').addEventListener('click', closeExitPopup);

      // Fechar ao clicar no overlay (fora do card)
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeExitPopup();
      });

      // Fechar com ESC
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeExitPopup();
      });

      // CTA: abrir o formulario principal
      document.getElementById('exit-popup-cta').addEventListener('click', function () {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'exit_popup_cta_click' });
        closeExitPopup();
        if (typeof openModal === 'function') openModal();
      });
    })();

(function bindUiEvents() {
  var modalClose = document.getElementById('modal-close-btn');
  if (modalClose) modalClose.addEventListener('click', closeModal);

  var modalForm = document.getElementById('modal-form');
  if (modalForm) modalForm.addEventListener('submit', handleFormSubmit);

  var nextStep = document.getElementById('btn-step-next');
  if (nextStep) nextStep.addEventListener('click', function() { goToStep(2); });

  var prevStep = document.getElementById('btn-step-back');
  if (prevStep) prevStep.addEventListener('click', function() { goToStep(1); });

  document.querySelectorAll('.faq-q').forEach(function(el) {
    el.addEventListener('click', function() { toggleFaq(el); });
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFaq(el);
      }
    });
  });
})();

scheduleThirdPartyBoot();
