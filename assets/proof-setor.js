/* Prova por setor — vitrine de depoimentos (dados: assets/depoimentos.json, mídia: proof-manager) */
(function () {
  var section = document.getElementById('prova-setor');
  if (!section) return;

  var chipsWrap = document.getElementById('ps-chips');
  var grid = document.getElementById('ps-grid');
  var moreBtn = document.getElementById('ps-more');
  var countEl = document.getElementById('ps-count');
  var arrowBtn = document.getElementById('ps-arrow');
  var wrap = chipsWrap.parentElement;

  var DATA = null;
  var COUNTS = {};
  var results = [];
  var shown = 0;
  var PAGE = 3;
  var atual = null; // null = Destaques

  var SETORES = [
    'Mentoria e Consultoria', 'Agência e Marketing',
    'Saúde, Clínicas e Estética', 'Negócios Digitais e Infoprodutos',
    'Educação e Cursos', 'Indústria, Comércio e Varejo', 'Tecnologia, SaaS e IA',
    'Serviços e Assessoria', 'Imóveis', 'Eventos, Audiovisual e Criativo',
    'Advocacia e Jurídico', 'Serviços Financeiros e Contábeis'
  ];

  // rótulo exibido (curto) — o filtro continua usando o nome completo
  var LABELS = {
    'Mentoria e Consultoria': 'Mentoria',
    'Agência e Marketing': 'Agências',
    'Saúde, Clínicas e Estética': 'Saúde e Estética',
    'Negócios Digitais e Infoprodutos': 'Infoprodutos',
    'Educação e Cursos': 'Educação',
    'Indústria, Comércio e Varejo': 'Indústria e Varejo',
    'Tecnologia, SaaS e IA': 'Tech e SaaS',
    'Serviços e Assessoria': 'Serviços',
    'Imóveis': 'Imóveis',
    'Eventos, Audiovisual e Criativo': 'Eventos',
    'Advocacia e Jurídico': 'Advocacia',
    'Serviços Financeiros e Contábeis': 'Financeiro'
  };

  // ?setor=slug na URL do anúncio abre a vitrine já filtrada
  var SLUGS = {
    mentoria: 'Mentoria e Consultoria', consultoria: 'Mentoria e Consultoria',
    agencia: 'Agência e Marketing', marketing: 'Agência e Marketing',
    saude: 'Saúde, Clínicas e Estética', estetica: 'Saúde, Clínicas e Estética', clinica: 'Saúde, Clínicas e Estética',
    infoprodutos: 'Negócios Digitais e Infoprodutos', digital: 'Negócios Digitais e Infoprodutos',
    educacao: 'Educação e Cursos',
    industria: 'Indústria, Comércio e Varejo', varejo: 'Indústria, Comércio e Varejo',
    tecnologia: 'Tecnologia, SaaS e IA', tech: 'Tecnologia, SaaS e IA', saas: 'Tecnologia, SaaS e IA',
    servicos: 'Serviços e Assessoria',
    imoveis: 'Imóveis',
    eventos: 'Eventos, Audiovisual e Criativo',
    advocacia: 'Advocacia e Jurídico', juridico: 'Advocacia e Jurídico',
    financeiro: 'Serviços Financeiros e Contábeis', contabil: 'Serviços Financeiros e Contábeis'
  };

  // setor da vitrine → radio de segmento do Passo 1 do wizard
  var SETOR_TO_SEGMENTO = {
    'Saúde, Clínicas e Estética': 'saude',
    'Advocacia e Jurídico': 'juridico',
    'Serviços Financeiros e Contábeis': 'financas',
    'Tecnologia, SaaS e IA': 'tecnologia-saas',
    'Indústria, Comércio e Varejo': 'industria',
    'Imóveis': 'industria',
    'Mentoria e Consultoria': 'servicos-mentoria',
    'Agência e Marketing': 'servicos-mentoria',
    'Negócios Digitais e Infoprodutos': 'servicos-mentoria',
    'Educação e Cursos': 'servicos-mentoria',
    'Eventos, Audiovisual e Criativo': 'servicos-mentoria',
    'Serviços e Assessoria': 'servicos-mentoria'
  };

  function norm(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Fonte única da curadoria de destaques: os data-attributes do bloco estático
     (emitidos por scripts/gerar-prova-destaques.mjs junto com o HTML — nada hardcoded aqui). */
  var destaquesGrid = document.querySelector('.ps-grid--destaques');
  var DESTAQUES_ARQUIVOS = ((destaquesGrid && destaquesGrid.dataset.videos) || '')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var DESTAQUES_PESSOAS = ((destaquesGrid && destaquesGrid.dataset.pessoas) || '')
    .toLowerCase().split('|').map(function (s) { return s.trim(); }).filter(Boolean);

  /* Posters dos destaques ficam em data-poster no HTML (fora da janela de parse/LCP);
     aplicamos quando a seção se aproxima — mesmo gatilho do fetch dos dados. */
  function ativarPostersDestaques() {
    if (!destaquesGrid) return;
    Array.prototype.forEach.call(destaquesGrid.querySelectorAll('video[data-poster]'), function (v) {
      v.poster = v.dataset.poster;
      v.removeAttribute('data-poster');
    });
  }

  function loadData(cb) {
    if (DATA) return cb();
    ativarPostersDestaques();
    fetch('assets/depoimentos.json')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        /* os depoimentos do bloco estático PROVA-DESTAQUES não repetem na vitrine */
        DATA = json.filter(function (d) {
          return DESTAQUES_ARQUIVOS.indexOf(String(d.f || '').split('/').pop()) === -1;
        });
        var total = document.getElementById('ps-total');
        if (total) total.textContent = String(json.length);
        COUNTS = {};
        DATA.forEach(function (d) { COUNTS[d.s] = (COUNTS[d.s] || 0) + 1; });
        injectCounts();
        cb();
      })
      .catch(function () { DATA = []; cb(); });
  }

  function injectCounts() {
    Array.prototype.forEach.call(chipsWrap.querySelectorAll('.ps-chip'), function (c) {
      if (c.querySelector('.ps-chip__n')) return;
      var full = c.dataset.setor;
      var n = full ? (COUNTS[full] || 0) : DATA.length;
      c.insertAdjacentHTML('beforeend', '<span class="ps-chip__n">' + n + '</span>');
      c.setAttribute('aria-label', (full || 'Todos os setores') + ', ' + n + ' depoimentos');
    });
  }

  /* As pessoas dos destaques estáticos não repetem na visão padrão (nas buscas por
     setor as outras provas delas continuam). Match EXATO pelo nome do JSON — prefixo
     já engoliu homônimo ('Tallisson' destaque vs 'Tallisson Souza' de Advocacia). */
  function ehPessoaDestaque(nomeNormalizado) {
    return DESTAQUES_PESSOAS.indexOf(nomeNormalizado) !== -1;
  }

  /* Visão padrão: 1 card por pessoa (o banco tem a mesma pessoa com várias mídias —
     a lista chega ordenada por score, então o primeiro é o melhor dela). */
  function dedupePorPessoa(list) {
    var seen = {}, out = [];
    for (var i = 0; i < list.length; i++) {
      var k = String(list[i].n || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (ehPessoaDestaque(k) || seen[k]) continue;
      seen[k] = 1;
      out.push(list[i]);
    }
    return out;
  }

  // quão impressionante: vídeo > força alta > métrica financeira no badge
  function score(d) {
    return (d.k === 'v' ? 4 : 0) + (d.fc ? 2 : 0) + (d.v ? 1 : 0);
  }

  // round-robin por chave: distribui (setores/pessoas) sem perder o ranking
  function espalharPor(list, keyFn) {
    var buckets = {}, ordem = [];
    list.forEach(function (d) {
      var k = keyFn(d) || '·';
      if (!buckets[k]) { buckets[k] = []; ordem.push(k); }
      buckets[k].push(d);
    });
    var out = [], added = true;
    while (added) {
      added = false;
      for (var i = 0; i < ordem.length; i++) {
        var b = buckets[ordem[i]];
        if (b.length) { out.push(b.shift()); added = true; }
      }
    }
    return out;
  }

  function cardHTML(d) {
    var media;
    if (d.k === 'v') {
      media = '<video controls preload="none" playsinline' + (d.p ? ' poster="' + esc(d.p) + '"' : '') +
        ' src="' + esc(d.f) + '"></video>';
    } else {
      media = '<img loading="lazy" decoding="async" src="' + esc(d.f) + '" alt="Depoimento de ' + esc(d.n) + '">';
    }
    var badge = d.v ? '<span class="ps-card__valor">' + esc(d.v) + '</span>' : '';
    var setor = d.s || d.m;
    return '<figure class="ps-card' + (d.k === 'v' ? ' ps-card--video' : '') + '">' +
      '<div class="ps-card__media">' + media + '</div>' +
      '<figcaption>' +
      (d.h ? '<p class="ps-card__head">' + esc(d.h) + '</p>' : '') +
      '<div class="ps-card__meta"><strong>' + esc(d.n) + '</strong>' + (setor ? ' · ' + esc(setor) : '') + '</div>' +
      badge +
      '</figcaption></figure>';
  }

  // CTA no pico de crença: entra depois da 1ª página de cards
  function ctaCardHTML() {
    var frase = atual
      ? 'Quer ser o próximo case de ' + esc(LABELS[atual] || atual) + '?'
      : 'Quer ser o próximo case do seu setor?';
    return '<a class="ps-card ps-card--cta" href="#form">' +
      '<span class="ps-card--cta__title">' + frase + '</span>' +
      '<span class="ps-card--cta__btn">Falar com especialista <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></span>' +
      '</a>';
  }

  function render(reset) {
    if (reset) { grid.innerHTML = ''; shown = 0; }
    var slice = results.slice(shown, shown + PAGE);
    var primeiraLeva = shown === 0;
    shown += slice.length;
    var html = slice.map(cardHTML).join('');
    if (primeiraLeva && slice.length) html += ctaCardHTML();
    grid.insertAdjacentHTML('beforeend', html);
    moreBtn.style.display = shown < results.length ? '' : 'none';
    if (countEl) {
      countEl.textContent = atual
        ? results.length + (results.length === 1 ? ' depoimento' : ' depoimentos') + ' em ' + (LABELS[atual] || atual)
        : '';
    }
  }

  function selecionar(full, chipEl) {
    atual = full || null;
    Array.prototype.forEach.call(chipsWrap.querySelectorAll('.ps-chip'), function (c) {
      var on = c === chipEl;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    /* centraliza o chip rolando SÓ o trilho horizontal — scrollIntoView
       rolava a página inteira até a seção no load (mobile) */
    if (chipEl && chipsWrap) {
      var reduz = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      var alvo = (chipEl.offsetLeft - chipsWrap.offsetLeft) - (chipsWrap.clientWidth - chipEl.offsetWidth) / 2;
      try {
        chipsWrap.scrollTo({ left: alvo, behavior: reduz ? 'auto' : 'smooth' });
      } catch (e) { chipsWrap.scrollLeft = alvo; }
    }
    // ponte com o wizard: o chip tocado pré-preenche o segmento do Passo 1
    /* setor ativo esconde os destaques estáticos — a vitrine filtrada assume a cena */
    var destaquesEl = document.querySelector('.ps-grid--destaques');
    if (destaquesEl) destaquesEl.style.display = atual ? 'none' : '';
    try {
      var seg = atual ? (SETOR_TO_SEGMENTO[atual] || '') : '';
      if (seg) sessionStorage.setItem('fss_segmento', seg);
    } catch (e) { /* storage indisponível */ }
    loadData(function () {
      results = atual
        ? espalharPor(DATA.filter(function (d) { return d.s === atual; }), function (d) { return d.n; })
        : espalharPor(dedupePorPessoa(DATA.slice().sort(function (a, b) { return score(b) - score(a); })), function (d) { return d.s; });
      render(true);
    });
  }

  // ── chips ──
  chipsWrap.setAttribute('role', 'group');
  chipsWrap.setAttribute('aria-label', 'Filtrar depoimentos por setor');

  var chipEls = {};
  [null].concat(SETORES).forEach(function (full) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ps-chip' + (full ? '' : ' ps-chip--star active');
    b.dataset.setor = full || '';
    if (full) {
      b.textContent = LABELS[full] || full;
    } else {
      b.textContent = 'Todos os setores';
    }
    b.setAttribute('aria-pressed', full ? 'false' : 'true');
    b.addEventListener('click', function () { selecionar(full, b); });
    chipsWrap.appendChild(b);
    chipEls[full || '__destaques'] = b;
  });

  // ?setor=slug → move o chip pra frente e abre já filtrado
  var setorParam = null;
  try {
    var rawParam = new URLSearchParams(window.location.search).get('setor');
    if (rawParam) setorParam = SLUGS[norm(rawParam)] || null;
  } catch (e) { /* URLSearchParams indisponível */ }
  if (setorParam && chipEls[setorParam]) {
    chipsWrap.insertBefore(chipEls[setorParam], chipsWrap.children[1] || null);
  }

  // ── trilho: fades por posição + dica que some no 1º swipe ──
  function updateFades() {
    var max = chipsWrap.scrollWidth - chipsWrap.clientWidth;
    wrap.classList.toggle('at-start', chipsWrap.scrollLeft <= 4);
    wrap.classList.toggle('at-end', chipsWrap.scrollLeft >= max - 4);
  }
  chipsWrap.addEventListener('scroll', updateFades, { passive: true });
  window.addEventListener('resize', updateFades);
  updateFades();

  if (arrowBtn) {
    arrowBtn.addEventListener('click', function () {
      chipsWrap.scrollBy({ left: chipsWrap.clientWidth * 0.8, behavior: 'smooth' });
    });
  }

  moreBtn.addEventListener('click', function () { render(false); });

  // carrega e mostra quando a seção se aproxima do viewport
  function boot() {
    if (setorParam && chipEls[setorParam]) {
      selecionar(setorParam, chipEls[setorParam]);
    } else {
      selecionar(null, chipEls['__destaques']);
    }
  }
  if ('IntersectionObserver' in window && !setorParam) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { boot(); io.disconnect(); }
      });
    }, { rootMargin: '600px 0px' });
    io.observe(section);
  } else {
    boot();
  }
})();
