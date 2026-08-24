(function () {
  'use strict';

  /* Passos físicos: 1 segmento · 2 perfil · 3 receita · 4 nome · 5 email ·
     6 whatsapp · 7 instagram. O passo 7 só entra no fluxo pra receita 50k+ —
     quem decide é o produto.js (syncInstagramField), que esconde/mostra o
     #field-instagram. As tabs do header são SEÇÕES: a de Contato agrupa os
     passos 4-6; a numeração de passos e tabs é reescrita a cada transição. */
  var currentStep = 1;

  /* passo físico → tab (data-step da tab) */
  var TAB_OF = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 7: 5 };
  /* passos de radio avançam sozinhos; passos de texto têm botão + autofocus */
  var RADIO_STEPS = { 1: 'segmento', 2: 'cargo', 3: 'receita' };
  var FOCUS_OF = { 4: 'f-nome', 5: 'f-email', 6: 'f-whatsapp', 7: 'f-instagram' };

  function igNeeded() {
    var box = document.getElementById('field-instagram');
    return Boolean(box && !box.hidden);
  }

  function stepSeq() {
    return igNeeded() ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6];
  }

  /* Tracking → tabela fap_form via /api/lead-partial.
     Dispara SÓ no abandono (fechou modal / fechou aba / trocou de aba)
     e apenas 1 vez por sessão de modal. Se o lead completou o form,
     não grava em fap_form — vai pro fluxo normal /api/lead → [Leads] FAP01.
     Assim evita linha duplicada para o mesmo lead. */
  var partialSent = false;
  var formCompleted = false;

  function readPartial() {
    var country = (document.getElementById('f-country-code') || {}).value || '';
    var phone   = ((document.getElementById('f-whatsapp')    || {}).value || '').trim();
    var whatsapp = '';
    if (phone) {
      if (phone.charAt(0) === '+') {
        /* modo internacional (normalização mora no produto.js) */
        var intl = typeof window.__fssIntlPhone === 'function' ? window.__fssIntlPhone(phone) : null;
        whatsapp = intl ? intl.full : phone.replace(/\s+/g, ' ');
      } else {
        whatsapp = (country ? '+' + country + ' ' : '') + phone;
      }
    }
    var seg = document.querySelector('input[name="segmento"]:checked');
    var car = document.querySelector('input[name="cargo"]:checked');
    var rec = document.querySelector('input[name="receita"]:checked');
    var igBox = document.getElementById('field-instagram');
    var igVisivel = Boolean(igBox && !igBox.hidden);
    return {
      segmento: seg ? seg.value : '',
      cargo:    car ? car.value : '',
      receita:  rec ? rec.value : '',
      nome:     ((document.getElementById('f-nome')  || {}).value || '').trim(),
      email:    ((document.getElementById('f-email') || {}).value || '').trim().toLowerCase(),
      whatsapp: whatsapp,
      instagram: igVisivel ? ((document.getElementById('f-instagram') || {}).value || '').trim() : ''
    };
  }

  function sendPartialBeacon() {
    if (formCompleted || partialSent) return;
    var data = readPartial();
    if (!data.segmento && !data.cargo && !data.receita &&
        !data.nome && !data.email && !data.whatsapp) return;
    partialSent = true;
    try {
      var body = JSON.stringify(data);
      var sent = false;
      if (navigator && typeof navigator.sendBeacon === 'function') {
        var blob = new Blob([body], { type: 'application/json' });
        sent = navigator.sendBeacon('/api/lead-partial', blob);
      }
      if (!sent) {
        fetch('/api/lead-partial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (_) {}
  }

  window.addEventListener('pagehide', sendPartialBeacon);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendPartialBeacon();
  });

  /* ─── LAZY LOAD VÍDEO ────────────────────────────────────── */
  document.querySelectorAll('iframe[data-src]').forEach(function (iframe) {
    iframe.src = iframe.getAttribute('data-src');
  });

  /* ─── NAVBAR SCROLL ──────────────────────────────────────── */
  var navbar = document.querySelector('.v2-navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      navbar.classList[window.scrollY > 60 ? 'add' : 'remove']('is-scrolled');
    }, { passive: true });
  }

  /* ─── MODAL ──────────────────────────────────────────────── */
  var modalBackdrop = document.getElementById('modal');

  function openModal() {
    if (!modalBackdrop) return;
    partialSent = false;
    formCompleted = false;
    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    goToStep(1);
  }

  function closeModal() {
    if (!modalBackdrop) return;
    sendPartialBeacon();
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* produto.js reabre o wizard por aqui (hash #form/?form=1, exit popup) */
  window.__v2WizardOpen = openModal;

  /* Intercepta todos os links href="#form" */
  document.querySelectorAll('a[href="#form"]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  });

  /* Fechar pelo backdrop */
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function (e) {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  /* Botão fechar — clona para remover listeners do JS legado (ex-app.min.js, removido) */
  var closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) {
    var newClose = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newClose, closeBtn);
    newClose.addEventListener('click', closeModal);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ─── WIZARD — clona botões para remover listeners antigos ── */
  var form = document.getElementById('modal-form');

  /* Clona #wizard-btn-next para zerar listeners do JS legado (ex-app.min.js, removido) */
  var btnNextOld = document.getElementById('wizard-btn-next');
  var btnNext;
  if (btnNextOld) {
    btnNext = btnNextOld.cloneNode(true);
    btnNextOld.parentNode.replaceChild(btnNext, btnNextOld);
  }

  /* Clona #wizard-btn-back */
  var btnBackOld = document.getElementById('wizard-btn-back');
  var btnBack;
  if (btnBackOld) {
    btnBack = btnBackOld.cloneNode(true);
    btnBackOld.parentNode.replaceChild(btnBack, btnBackOld);
  }

  var stepLabel   = document.querySelector('.wizard-step-label');
  var progressFill = document.getElementById('v2-progress-fill');
  var tabs        = document.querySelectorAll('.v2-wizard-tabs .wizard-tab');

  /* Listeners nos botões clonados */
  if (btnNext) {
    btnNext.addEventListener('click', function () {
      if (!validateStep(currentStep)) return;
      var seq = stepSeq();
      var idx = seq.indexOf(currentStep);
      if (idx > -1 && idx < seq.length - 1) {
        /* Saindo do WhatsApp pra etapa do Instagram: o lead já vai inteiro
           pro backend (fase 1) — abandono no Instagram não perde o lead.
           Com o lead capturado, o beacon de parcial não precisa disparar. */
        if (currentStep === 6 && seq[idx + 1] === 7 &&
            typeof window.__fap01PreInstagram === 'function' &&
            window.__fap01PreInstagram()) {
          formCompleted = true;
        }
        goToStep(seq[idx + 1]);
      } else {
        submitForm();
      }
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', function () {
      var seq = stepSeq();
      var idx = seq.indexOf(currentStep);
      if (idx > 0) goToStep(seq[idx - 1]);
    });
  }

  /* Auto-avança ao clicar em radio (steps 1–3; o produto.js já sincronizou
     o campo do Instagram quando a receita muda, então a seq sai atualizada) */
  if (form) {
    form.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      if (!RADIO_STEPS[currentStep]) return;
      setTimeout(function () {
        if (!validateStep(currentStep)) return;
        var seq = stepSeq();
        var idx = seq.indexOf(currentStep);
        if (idx > -1 && idx < seq.length - 1) goToStep(seq[idx + 1]);
      }, 300);
    });
  }

  /* Enter nos campos de texto avança em vez de submeter o form */
  ['f-nome', 'f-email', 'f-whatsapp', 'f-instagram'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (btnNext) btnNext.click();
      }
    });
  });

  /* ─── goToStep ───────────────────────────────────────────── */
  function goToStep(step) {
    var seq = stepSeq();
    if (seq.indexOf(step) === -1) step = seq[0];
    var idx = seq.indexOf(step);
    var total = seq.length;

    /* Mostra só o step atual */
    [1, 2, 3, 4, 5, 6, 7].forEach(function (s) {
      var el = document.getElementById('wizard-step-' + s);
      if (el) el.hidden = (s !== step);
    });
    currentStep = step;

    /* mobile: corpo rola internamente — cada passo começa do topo */
    var wizardBody = document.querySelector('.wizard-body');
    if (wizardBody) wizardBody.scrollTop = 0;

    /* Labels (numeração muda conforme o passo do Instagram entra ou não) */
    if (stepLabel) {
      stepLabel.textContent = 'Passo ' + (idx + 1) + ' de ' + total;
    }
    var stepEl = document.getElementById('wizard-step-' + step);
    var tagEl = stepEl && stepEl.querySelector('.wizard-step-tag');
    if (tagEl) {
      var tagName = tagEl.getAttribute('data-label') || '';
      tagEl.textContent = 'Passo ' + (idx + 1) + ' de ' + total + (tagName ? ' · ' + tagName : '');
    }

    /* Progress bar */
    if (progressFill) {
      progressFill.style.width = (((idx + 1) / total) * 100) + '%';
    }

    /* Tabs são seções (Contato agrupa nome/email/whatsapp): esconde a do
       Instagram fora do fluxo, renumera as visíveis e marca completed quando
       TODOS os passos da seção já ficaram pra trás */
    var currentTab = TAB_OF[step];
    var pos = 0;
    tabs.forEach(function (tab) {
      var t = parseInt(tab.getAttribute('data-step'), 10);
      var tabSteps = seq.filter(function (s) { return TAB_OF[s] === t; });
      tab.style.display = tabSteps.length === 0 ? 'none' : '';
      tab.classList.remove('active', 'completed');
      if (tabSteps.length === 0) return;
      pos += 1;
      var num = tab.querySelector('.v2-tab-num');
      if (num) num.textContent = pos;
      if (t === currentTab) tab.classList.add('active');
      var lastIdx = seq.indexOf(tabSteps[tabSteps.length - 1]);
      if (lastIdx < idx) tab.classList.add('completed');
    });

    /* Botão voltar */
    if (btnBack) {
      btnBack.style.display = idx > 0 ? 'flex' : 'none';
    }

    /* Botão principal: escondido nos passos de radio (avançam sozinhos);
       "Continuar" nos passos de texto; submit no último passo da sequência */
    if (btnNext) {
      var arrow = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>';
      btnNext.disabled = false;
      if (RADIO_STEPS[step]) {
        btnNext.style.display = 'none';
      } else if (idx === total - 1) {
        btnNext.style.display = '';
        btnNext.innerHTML = 'Enviar aplica\u00e7\u00e3o ' + arrow;
      } else {
        btnNext.style.display = '';
        btnNext.innerHTML = 'Continuar ' + arrow;
      }
    }

    /* Passos de texto: foco direto no campo */
    var focusId = FOCUS_OF[step];
    if (focusId) {
      setTimeout(function () {
        var stepEl2 = document.getElementById('wizard-step-' + currentStep);
        var input = document.getElementById(focusId);
        if (input && stepEl2 && !stepEl2.hidden) input.focus();
      }, 80);
    }

  }

  /* ─── VALIDAÇÃO ──────────────────────────────────────────── */
  function invalid(el) {
    if (el && typeof el.reportValidity === 'function') el.reportValidity();
    return false;
  }

  function validateStep(step) {
    if (RADIO_STEPS[step] && form) {
      if (!form.querySelector('input[name="' + RADIO_STEPS[step] + '"]:checked')) {
        return false;
      }
    }
    if (step === 4) {
      var n = document.getElementById('f-nome');
      if (!n || n.value.trim().length < 2) return invalid(n);
    }
    if (step === 5) {
      var em = document.getElementById('f-email');
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim())) return invalid(em);
    }
    if (step === 6) {
      var wh = document.getElementById('f-whatsapp');
      if (!wh) return invalid(wh);
      var whRaw = wh.value.trim();
      if (whRaw.charAt(0) === '+' && typeof window.__fssIntlPhone === 'function') {
        /* modo internacional: +código do país + número de 8-15 dígitos */
        if (!window.__fssIntlPhone(whRaw)) return invalid(wh);
      } else if (wh.value.replace(/\D/g, '').length < 8) {
        return invalid(wh);
      }
    }
    if (step === 7) {
      /* Instagram é obrigatório quando a etapa está no fluxo (receita 50k+) */
      var ig = document.getElementById('f-instagram');
      if (igNeeded() && (!ig || !ig.value.trim())) return invalid(ig);
    }
    return true;
  }

  /* ─── SUBMIT ─────────────────────────────────────────────── */
  /* Submit próprio (o legado app.min.js foi removido): POST /api/lead + redirect Calendly. */
  function submitForm() {
    if (!form) return;
    formCompleted = true; /* bloqueia /api/lead-partial — vai pro [Leads] FAP01 */
    if (btnNext) { btnNext.disabled = true; btnNext.textContent = 'Enviando...'; }
    form.dispatchEvent(new Event('submit', { cancelable: true }));
  }

  function showSuccess() {
    if (!form) return;
    form.innerHTML =
      '<div style="text-align:center;padding:48px 20px;">' +
      '<div style="font-size:2.5rem;margin-bottom:16px;">✅</div>' +
      '<h3 style="font-family:Sora,sans-serif;font-size:1.3rem;font-weight:800;color:#111118;margin-bottom:12px;">Recebemos sua solicita\u00e7\u00e3o!</h3>' +
      '<p style="color:#55556a;line-height:1.7;">Um estrategista vai entrar em contato via WhatsApp em at\u00e9 <strong style="color:#111118;">4h \u00fateis</strong> para confirmar sua vaga.</p>' +
      '</div>';
    if (progressFill) progressFill.style.width = '100%';
    if (typeof fbq === 'function') fbq('track', 'Lead');
    if (typeof gtag === 'function') gtag('event', 'conversion');
  }

  function radio(name) {
    var el = form && form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  /* ─── FIXED BAR — aparece a partir da 2ª seção (logos)
       Esconde de volta enquanto o hero (1ª seção) estiver visível. */
  var triggerSection = document.querySelector('.logos-section');
  if (triggerSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          document.body.classList.add('v2-show-bar');
        } else if (entry.boundingClientRect.top > 0) {
          /* trigger ainda abaixo do viewport → usuário voltou ao hero */
          document.body.classList.remove('v2-show-bar');
        }
      });
    }, { threshold: 0.01 }).observe(triggerSection);
  }

  /* ─── FAQ ACCORDION ──────────────────────────────────────── */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    /* Clona para remover listeners do JS legado (ex-app.min.js, removido) */
    var newQ = q.cloneNode(true);
    q.parentNode.replaceChild(newQ, q);
    newQ.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (i) {
        i.classList.remove('open');
      });
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ─── SCROLL REVEAL — classe "visible" do styles.min.css ─── */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          ro.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el) { ro.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  /* ─── EXIT POPUP ─────────────────────────────────────────── */
  // produto.js e o dono do exit popup (gatilhos, guard de sessao, dataLayer).
  // Este fallback so age se produto.js nao estiver na pagina, e respeita a
  // mesma chave de sessao pra nunca disparar duas vezes.
  var exitOverlay = document.getElementById('exit-popup-overlay');
  var exitCta     = document.getElementById('exit-popup-cta');

  if (exitOverlay && !document.querySelector('script[src*="produto.js"]')) {
    document.addEventListener('mouseleave', function (e) {
      /* nunca por cima do formulário aberto */
      if (modalBackdrop && modalBackdrop.classList.contains('open')) return;
      if (!sessionStorage.getItem('exitPopupShown') && e.clientY < 10) {
        sessionStorage.setItem('exitPopupShown', '1');
        exitOverlay.classList.add('active');
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'exit_popup_view' });
      }
    });
    exitOverlay.addEventListener('click', function (e) {
      if (e.target === exitOverlay) exitOverlay.classList.remove('active');
    });
    if (exitCta) {
      exitCta.addEventListener('click', function () {
        exitOverlay.classList.remove('active');
        openModal();
      });
    }
  }

})();
