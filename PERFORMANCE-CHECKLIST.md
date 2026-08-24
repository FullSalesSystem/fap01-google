## Performance Checklist (Landing FAP01)

- [x] CSS minificado em `assets/styles.min.css`
- [x] JS da página em `assets/produto.js` + `assets/v2.js` (deferred; app.js/app.min.js legados foram removidos)
- [x] HTML aponta para arquivos minificados (`index.html`)
- [x] Preload do asset principal (background hero)
- [x] `loading="lazy"` aplicado nas imagens abaixo da dobra
- [x] `decoding="async"` aplicado nas imagens
- [x] Scripts principais com `defer`

### Observacoes de produção

- TTFB depende de infraestrutura (CDN/edge/cache). Configurar cache de estáticos e compressão Brotli/Gzip no servidor.
- Validar com Lighthouse em produção e acompanhar LCP/CLS/INP por URL final.
