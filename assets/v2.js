(function () {
  'use strict';

  var TOTAL_STEPS = 5;
  var currentStep = 1;

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
    modalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    goToStep(1);
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

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

  /* Botão fechar — clona para remover listeners do app.min.js */
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

  /* Clona #wizard-btn-next para zerar listeners do app.min.js */
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
      if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
      else submitForm();
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', function () {
      if (currentStep > 1) goToStep(currentStep - 1);
    });
  }

  /* Auto-avança ao clicar em radio (steps 1–4) */
  if (form) {
    form.addEventListener('change', function (e) {
      if (e.target.type === 'radio' && currentStep < TOTAL_STEPS) {
        setTimeout(function () {
          if (validateStep(currentStep)) goToStep(currentStep + 1);
        }, 300);
      }
    });
  }

  /* ─── goToStep ───────────────────────────────────────────── */
  function goToStep(step) {
    /* Esconde step atual */
    var currEl = document.getElementById('wizard-step-' + currentStep);
    if (currEl) currEl.hidden = true;

    currentStep = step;

    /* Mostra próximo step */
    var nextEl = document.getElementById('wizard-step-' + currentStep);
    if (nextEl) nextEl.hidden = false;

    /* Label */
    if (stepLabel) {
      stepLabel.textContent = 'Passo ' + currentStep + ' de ' + TOTAL_STEPS;
    }

    /* Progress bar */
    if (progressFill) {
      progressFill.style.width = ((currentStep / TOTAL_STEPS) * 100) + '%';
    }

    /* Tabs */
    tabs.forEach(function (tab) {
      var t = parseInt(tab.getAttribute('data-step'), 10);
      tab.classList.remove('active', 'completed');
      if (t === currentStep) tab.classList.add('active');
      if (t < currentStep)  tab.classList.add('completed');
    });

    /* Botão voltar */
    if (btnBack) {
      btnBack.style.display = currentStep > 1 ? 'flex' : 'none';
    }

    /* Texto do botão continuar */
    if (btnNext) {
      var arrow = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>';
      btnNext.disabled = false;
      if (currentStep < TOTAL_STEPS) {
        btnNext.innerHTML = 'Continuar ' + arrow;
      } else {
        btnNext.innerHTML = 'Quero meu diagn\u00f3stico gratuito ' + arrow;
      }
    }
  }

  /* ─── VALIDAÇÃO ──────────────────────────────────────────── */
  function validateStep(step) {
    var map = { 1: 'dor', 2: 'segmento', 3: 'cargo', 4: 'receita' };
    if (map[step] && form) {
      if (!form.querySelector('input[name="' + map[step] + '"]:checked')) {
        return false;
      }
    }
    if (step === TOTAL_STEPS) {
      var n = document.getElementById('f-nome');
      var em = document.getElementById('f-email');
      var wh = document.getElementById('f-whatsapp');
      if (!n || !n.value.trim() || !em || !em.value.trim() || !wh || !wh.value.trim()) {
        return false;
      }
    }
    return true;
  }

  /* ─── SUBMIT ─────────────────────────────────────────────── */
  /* Delega para handleFormSubmit do app.min.js: POST /api/lead + redirect Calendly. */
  function submitForm() {
    if (!form) return;
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

  /* ─── FIXED BAR — aparece quando pain section entra no viewport */
  var painSection = document.querySelector('.v2-pain-section') ||
                    document.querySelector('.pain-section');
  if (painSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        document.body.classList.add('v2-show-bar');
      }
    }, { threshold: 0.05 }).observe(painSection);
  }

  /* ─── FAQ ACCORDION ──────────────────────────────────────── */
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    /* Clona para remover listeners do app.min.js */
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
  var exitShown   = false;
  var exitOverlay = document.getElementById('exit-popup-overlay');
  var exitCta     = document.getElementById('exit-popup-cta');

  if (exitOverlay) {
    document.addEventListener('mouseleave', function (e) {
      if (!exitShown && e.clientY < 10) {
        exitShown = true;
        exitOverlay.classList.add('active');
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
