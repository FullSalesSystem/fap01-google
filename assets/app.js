var THIRD_PARTY_LOADED = false;
var GTAG_ID = 'AW-11465446145';
var CONVERTE_PLAYER_ID = '673683322eb080000b6db91f';

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
  loadScript('https://scripts.converteai.net/lib/js/smartplayer/v1/sdk.min.js', {
    'data-id': CONVERTE_PLAYER_ID
  });
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

function initLazyHeroVideo() {
  var iframe = document.getElementById('ifr_673683322eb080000b6db91f');
  if (!iframe || !iframe.dataset || !iframe.dataset.src) return;

  function activateVideo() {
    if (iframe.dataset.loaded === '1') return;
    iframe.src = iframe.dataset.src;
    iframe.dataset.loaded = '1';
    bootThirdParty();
  }

  var wrapper = document.getElementById('ifr_673683322eb080000b6db91f_wrapper') || iframe;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          activateVideo();
          io.disconnect();
        }
      });
    }, { rootMargin: '200px 0px' });
    io.observe(wrapper);
  } else {
    activateVideo();
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (eventName) {
    window.addEventListener(eventName, activateVideo, { once: true, passive: true });
  });
}

var formOpenedAt = Date.now();

    // Modal
var wizardCurrentStep = 1;

    function openModal() {
      document.getElementById('modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      bootThirdParty();
      formOpenedAt = Date.now();
      wizardGoTo(1, true);
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

    captureUtms();

    function createSubmissionId() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      return 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      var nome     = sanitizeText(document.getElementById('f-nome').value, 120);
      var email    = sanitizeText(document.getElementById('f-email').value, 254).toLowerCase();
      var pais     = document.getElementById('f-country-code').value;
      var whatsappDigits = digitsOnly(document.getElementById('f-whatsapp').value);
      var whatsapp = '+' + pais + ' ' + whatsappDigits;
      var cargoEl = document.querySelector('input[name="cargo"]:checked');
      var cargo = cargoEl ? cargoEl.value : '';
      var segmento = document.getElementById('f-segmento').value;
      var receitaEl = document.querySelector('input[name="receita"]:checked');
      var receita = receitaEl ? receitaEl.value : '';
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

      var isEligibleCargo = (cargo === 'socio-empresario');
      var isHighRevenue = (receita === '50k-100k' || receita === '100k-300k' || receita === '300k-500k' || receita === '500k-1m' || receita === 'acima-1m');
      var isSemiRevenue = (receita === '30k-50k');

      var submissionId = createSubmissionId();

      var redirectUrl;
      if (isEligibleCargo && isHighRevenue) {
        redirectUrl = 'https://fap01-obrigado.fullsalessystem.com';
      } else if (isEligibleCargo && isSemiRevenue) {
        redirectUrl = 'https://fap01-obrigado-semi.fullsalessystem.com';
      } else {
        redirectUrl = 'https://fap01-obrigado-lf.fullsalessystem.com';
      }

      var utms = captureUtms();

      var redirectParams = new URLSearchParams({
        nome: nome,
        email: email,
        whatsapp: whatsapp,
        cargo: cargo,
        segmento: segmento,
        receita: receita
      });
      UTM_KEYS.forEach(function(k) {
        if (utms[k]) redirectParams.set(k, utms[k]);
      });

      var payload = {
        submission_id: submissionId,
        submitted_at: new Date().toISOString(),
        page: window.location.href,
        nome: nome,
        email: email,
        whatsapp: whatsapp,
        cargo: cargo,
        segmento: segmento,
        receita: receita,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term
      };

      var request = fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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
        var m = getMask(countrySelect.value);
        var d = e.target.value.replace(/\D/g, '').substring(0, m.max);
        e.target.value = d.length === 0 ? '' : m.fmt(d);
      });
    })();

    // Wizard 3-step navigation
    function wizardGoTo(step, instant) {
      var steps = [1, 2, 3];
      var tabs = document.querySelectorAll('.wizard-tab');
      var stepLabel = document.querySelector('.wizard-step-label');
      var btnNext = document.getElementById('wizard-btn-next');
      var btnBack = document.getElementById('wizard-btn-back');

      steps.forEach(function(s) {
        var el = document.getElementById('wizard-step-' + s);
        if (!el) return;
        if (s === step) { el.hidden = false; }
        else { el.hidden = true; }
      });

      tabs.forEach(function(tab) {
        var ts = parseInt(tab.getAttribute('data-step'));
        tab.classList.remove('active', 'completed');
        if (ts === step) tab.classList.add('active');
        else if (ts < step) tab.classList.add('completed');
      });

      if (stepLabel) stepLabel.textContent = 'Passo ' + step + ' de 3';
      if (btnBack) btnBack.style.display = step > 1 ? '' : 'none';

      if (step === 3) {
        btnNext.textContent = '';
        btnNext.innerHTML = 'Enviar aplicação <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>';
        btnNext.setAttribute('data-action', 'submit');
      } else {
        btnNext.innerHTML = 'Continuar <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>';
        btnNext.setAttribute('data-action', 'next');
      }

      wizardCurrentStep = step;
    }

    document.getElementById('wizard-btn-next').addEventListener('click', function() {
      if (wizardCurrentStep === 1) {
        var cargo = document.querySelector('input[name="cargo"]:checked');
        var segmento = document.getElementById('f-segmento');
        if (!cargo) { alert('Selecione seu cargo.'); return; }
        if (!segmento.value) { segmento.reportValidity(); return; }
        wizardGoTo(2);
      } else if (wizardCurrentStep === 2) {
        var receita = document.querySelector('input[name="receita"]:checked');
        if (!receita) { alert('Selecione a faixa de receita.'); return; }
        wizardGoTo(3);
      } else if (wizardCurrentStep === 3) {
        var nome = document.getElementById('f-nome');
        var email = document.getElementById('f-email');
        var whatsapp = document.getElementById('f-whatsapp');
        if (!nome.reportValidity() || !email.reportValidity() || !whatsapp.reportValidity()) return;
        document.getElementById('modal-form').dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });

    document.getElementById('wizard-btn-back').addEventListener('click', function() {
      if (wizardCurrentStep > 1) wizardGoTo(wizardCurrentStep - 1);
    });

    // Attach modal to all CTA buttons
    document.querySelectorAll('a[href="#form"], a.navbar-cta').forEach(a => {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        openModal();
      });
    });

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

    // Fixed bottom bar - hide when native CTA buttons are visible
    (function() {
      var bar = document.getElementById('fixed-bottom-bar');
      if (!bar) return;
      var allBtns = document.querySelectorAll('.btn--red');
      var targets = [];
      allBtns.forEach(function(btn) {
        if (!btn.closest('.fixed-bottom-bar') && !btn.closest('.navbar') && !btn.closest('.modal')) targets.push(btn);
      });
      var visibleSet = new Set();
      var ctaObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) visibleSet.add(entry.target);
          else visibleSet.delete(entry.target);
        });
        if (visibleSet.size > 0) bar.classList.add('hidden');
        else bar.classList.remove('hidden');
      }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
      targets.forEach(function(btn) { ctaObserver.observe(btn); });
      document.getElementById('fixed-bar-cta').addEventListener('click', function(e) {
        e.preventDefault();
        openModal();
      });
    })();

// Exit Popup - dispara 1x por visita
    (function () {
      if (sessionStorage.getItem('exitPopupShown')) return;

      var overlay = document.getElementById('exit-popup-overlay');

      function openExitPopup() {
        if (sessionStorage.getItem('exitPopupShown')) return;
        sessionStorage.setItem('exitPopupShown', '1');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
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

initLazyHeroVideo();
scheduleThirdPartyBoot();
