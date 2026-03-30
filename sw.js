// ─── ControleGeral Service Worker v3.5 ───────────────────────────────────────
// [M-A3] Suporte offline completo — cacheia app, serve offline, sincroniza ao voltar
const CACHE_NAME = "cgel-v3.5";
const STATIC = ["/", "/index.html", "/app.js", "/brasao.js"];
const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

// Instala e cacheia todos os arquivos estáticos
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled([
        ...STATIC.map(url => cache.add(url).catch(() => {})),
        ...CDN.map(url => cache.add(url).catch(() => {}))
      ])
    ).then(() => self.skipWaiting())
  );
});

// Limpa caches antigos ao ativar
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estratégia: Network First para Supabase, Cache First para estáticos
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Supabase — sempre tenta rede, nunca cacheia dados
  if (url.hostname.includes("supabase.co")) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }

  // CDN e arquivos estáticos — Cache First, fallback para rede
  if (
    url.hostname.includes("cdnjs.cloudflare.com") ||
    url.hostname.includes("unpkg.com") ||
    STATIC.includes(url.pathname)
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  // Demais — Network First, fallback para cache
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        if (resp.ok && e.request.method === "GET") {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// Mensagem de sync — enviada pelo app quando a rede volta
self.addEventListener("message", e => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
