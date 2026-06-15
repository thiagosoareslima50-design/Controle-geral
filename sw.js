// ControleGeral Service Worker v5.1.5-20260615
// UX Dashboard: grid 2 colunas, chips/tags, KPI badges, tooltips, paleta dark
// Estrategia:
//   Supabase/BrasilAPI -> sempre rede (dados nao sao cacheados)
//   CDN (React, XLSX, jsPDF) -> Cache First (baixa 1x, serve sempre offline)
//   App shell (index.html, app.js, modulos) -> Network First, fallback cache
//   NUNCA retorna undefined de respondWith (causa TypeError no browser)

const CACHE = 'cgel-v20';
const SHELL = [
  '/', '/index.html', '/app.js', '/brasao.js', '/manifest.json',
  '/constants.js', '/helpers.js', '/storage.js', '/useLocks.js', '/parecer.js'
];
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
];

// Instala e pre-cacheia CDN + shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      CDN_URLS.forEach(function(url) { cache.add(url).catch(function() {}); });
      return Promise.allSettled(SHELL.map(function(url) { return cache.add(url); }));
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Remove caches antigos na ativacao
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Resposta segura: NUNCA retorna undefined
function safeResponse(cached) {
  if (cached) return cached;
  return new Response('Offline -- recurso nao disponivel', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

// Intercepta requisicoes
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (e.request.method !== 'GET') return;

  // 1. Supabase e APIs -- sempre rede
  if (url.includes('supabase.co') || url.includes('brasilapi.com.br') || url.includes('cdn.jsdelivr.net/npm/@supabase')) {
    e.respondWith(
      fetch(e.request).catch(function() {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // 2. CDN e Shell -- Network First com Cache Fallback
  e.respondWith(
    fetch(e.request).then(function(resp) {
      if (resp && resp.ok) {
        var clone = resp.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return resp;
      }
      // Se nao for OK (404, etc.), tenta cache
      return caches.match(e.request).then(function(cached) {
        return safeResponse(cached || resp);
      });
    }).catch(function() {
      // Falha de rede total
      return caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        // Fallback root para SPA
        return caches.match('/').then(function(root) {
          return safeResponse(root);
        });
      });
    })
  );
});

// Controle via postMessage
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
