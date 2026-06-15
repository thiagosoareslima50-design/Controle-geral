/* ─── src/storage.js ─────────────────────────────────────────────────── */
// [S-1] Credenciais via window.ENV (injetado pelo Vercel via vercel.json)
// Fallback permite desenvolvimento local sem .env
const _env = window.ENV || {};
const SUPABASE_URL = _env.SUPABASE_URL || "https://mgstvnozvmyptxxnulmz.supabase.co";
const SUPABASE_ANON_KEY = _env.SUPABASE_ANON_KEY || "sb_publishable_MvSxZEfxJrrmTXpPday22Q_yV7Zx3Xy";
const APP_VERSION = _env.APP_VERSION || "5.1.5";

const _sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// [P-1] AbortController wrapper com timeout configurable (ms)
const DEFAULT_TIMEOUT = 8000;
function _sbWithTimeout(signal, fn) {
  if (!signal) return fn();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  signal._ctrl = controller;
  // [FIX-THENABLE] Supabase query builder é thenable (.then()) mas NÃO tem .finally().
  // Usar .then() para garantir compatibilidade com qualquer versão do client.
  return fn(controller.signal).then(
    function(result) { clearTimeout(timer); return result; },
    function(error)  { clearTimeout(timer); throw error; }
  );
}
let _sbLive = false;
const _sbReady = !!(_sb && SUPABASE_URL && SUPABASE_ANON_KEY);
const _SB_NOT_FOUND = Symbol("SB_NOT_FOUND");
const MEM = {};

// Lazy load de libs pesadas — só baixa quando chamado
const _loadCache = {};
function _lazyScript(url) {
  if (_loadCache[url]) return _loadCache[url];
  _loadCache[url] = new Promise((res, rej) => {
    if (document.querySelector('script[src="' + url + '"]')) {
      // Já carregado
      res();
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Falha ao carregar: " + url));
    document.head.appendChild(s);
  });
  return _loadCache[url];
}
window._lazyLoad = {
  jspdf: () => _lazyScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
    .then(() => window.jspdf),
  docx: () => _lazyScript("https://unpkg.com/docx@8.5.0/build/index.umd.js")
    .then(() => window.docx),
  sqljs: () => _lazyScript("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js")
};

async function _sbFetch(method, chave, valor) {
  if (!_sbReady) return null;
  const ctrl = { _ctrl: null }; // referência para o AbortController
  try {
    if (method === "GET") {
      const { data, error } = await _sbWithTimeout(ctrl, (sig) =>
        _sb.from('cgel_store').select('valor').eq('chave', chave).maybeSingle());
      if (error) return null;
      return data ? data.valor : _SB_NOT_FOUND;
    }
    if (method === "POST") {
      const { error } = await _sbWithTimeout(ctrl, (sig) =>
        _sb.from('cgel_store').upsert({ chave, valor, atualizado_em: new Date().toISOString() }));
      if (!error) _sbLive = true;
      return !error;
    }
    if (method === "DELETE") {
      const { error } = await _sbWithTimeout(ctrl, (sig) =>
        _sb.from('cgel_store').delete().eq('chave', chave));
      return !error;
    }
    if (method === "LIST") {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await _sbWithTimeout(ctrl, (sig) =>
          _sb.from('cgel_store')
            .select('chave,valor')
            .like('chave', `${chave}%`)
            .range(page * pageSize, (page + 1) * pageSize - 1)
        );
        if (error || !data) return null;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
      _sbLive = true;
      return allData;
    }
    if (method === "HIST_LIST") {
      let allData = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await _sbWithTimeout(ctrl, (sig) =>
          _sb.from('cgel_historico')
            .select('*')
            .order('num_processo', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1)
        );
        if (error || !data) return null;
        allData = allData.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
      return allData;
    }
    if (method === "HIST_POST") {
      const { error } = await _sbWithTimeout(ctrl, (sig) =>
        _sb.from('cgel_historico').upsert(valor));
      return !error;
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[storage] Timeout Supabase:', method, chave);
    }
    return null;
  }
}

const _writeQueues = {};
function _enqueueWrite(key, fn) {
  if (!_writeQueues[key]) _writeQueues[key] = Promise.resolve();
  _writeQueues[key] = _writeQueues[key].then(fn).catch(fn);
  return _writeQueues[key];
}

const ST = {
  async get(k) {
    if (_sbReady) {
      try {
        const raw = await _sbFetch("GET", k);
        if (raw === _SB_NOT_FOUND) {
          try { localStorage.removeItem("cgel_" + k); } catch {}
          // [FIX-EDIT-STALE] Se existe no MEM (gravado localmente mas não confirmado
          // pelo Supabase ainda), retorna o valor local em vez de null.
          return MEM[k] !== undefined ? MEM[k] : null;
        }
        if (raw !== null) {
          try { localStorage.setItem("cgel_" + k, raw); } catch {}
          // [FIX-EDIT-STALE] Se o MEM tem um valor mais recente (gravado após a
          // última leitura do Supabase), o MEM tem prioridade para proc_ e hist_.
          // Isso evita que ST.get devolva dados antigos durante a janela de propagação.
          if (MEM[k] !== undefined && (k.startsWith("proc_") || k.startsWith("hist_"))) {
            return MEM[k];
          }
          return JSON.parse(raw);
        }
      } catch {}
    }
    try {
      const local = localStorage.getItem("cgel_" + k);
      return local ? JSON.parse(local) : (MEM[k] || null);
    } catch { return MEM[k] || null; }
  },
  async set(k, v) {
    const raw = JSON.stringify(v);
    try { localStorage.setItem("cgel_" + k, raw); } catch {}
    MEM[k] = v;
    return _enqueueWrite(k, async () => {
      const cloud = await _sbFetch("POST", k, raw);
      return { ok: true, cloud: !!cloud };
    });
  },
  async del(k) {
    try { localStorage.removeItem("cgel_" + k); } catch {}
    delete MEM[k];
    if (_sbReady) await _sbFetch("DELETE", k);
    return true;
  },
  async list(prefix) {
    if (_sbReady) {
      try {
        const rows = await _sbFetch("LIST", prefix);
        if (rows !== null) {
          rows.forEach(r => { try { localStorage.setItem("cgel_" + r.chave, r.valor); } catch {} });
          // [FIX-EDIT-STALE] Mescla dados do Supabase com MEM local:
          // chaves gravadas localmente (mas ainda não confirmadas no Supabase)
          // substituem o valor do banco, evitando leitura de dado antigo.
          const sbMap = new Map();
          rows.filter(r => r.valor).forEach(r => {
            try { sbMap.set(r.chave, JSON.parse(r.valor)); } catch {}
          });
          // Sobrescreve com valores do MEM (mais recentes)
          Object.keys(MEM).filter(k => k.startsWith(prefix)).forEach(k => {
            sbMap.set(k, MEM[k]);
          });
          return [...sbMap.entries()].map(([key, value]) => ({ key, value }));
        }
      } catch {}
    }
    try {
      const results = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("cgel_" + prefix)) {
          const raw = localStorage.getItem(k);
          if (raw) { try { results.push({ key: k.slice(5), value: JSON.parse(raw) }); } catch {} }
        }
      }
      if (results.length) return results;
    } catch {}
    return Object.entries(MEM).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ key: k, value: v }));
  },
  async listHistorico() {
    if (_sbReady) {
      try {
        const rows = await _sbFetch("HIST_LIST");
        if (rows !== null) {
          return rows.map(r => {
            try {
              let d = typeof r.dados === "string" ? JSON.parse(r.dados) : r.dados;
              if (!d) {
                const decMapeado = r.decisao === "DEFERIDO" ? "deferir" : r.decisao === "INDEFERIDO" ? "indeferir" : "";
                d = {
                  "Processo": r.num_processo || "",
                  "NÚMERO DO DOCUMENTO": r.num_processo || "",
                  "Órgão": r.orgao || "",
                  "ORGÃO": r.orgao || "",
                  "Fornecedor": r.fornecedor || "",
                  "FORNECEDOR": r.fornecedor || "",
                  "CNPJ": r.cnpj || "",
                  "Valor": r.valor || "",
                  "VALOR": r.valor || "",
                  "TipoKey": r.tipo_key || "",
                  "_tipoKey": r.tipo_key || "",
                  "Decisão": r.decisao || "",
                  "_decisao": decMapeado,
                  "_status": r.status || "analise",
                  "_usuario": r.usuario || ""
                };
              }
              if (d) {
                // Fallback para campos de data/auditoria se não estiverem no JSON
                if (!d._registradoEm && r.registrado_em) {
                  const dt = new Date(r.registrado_em);
                  d._registradoEm = dt.toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit", second: "2-digit"
                  });
                }
                if (!d._usuario && r.usuario) {
                  d._usuario = r.usuario;
                }
                if (!d.Data && !d.DATA && r.registrado_em) {
                  const dt = new Date(r.registrado_em);
                  const dia = String(dt.getDate()).padStart(2, "0");
                  const mesesNomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
                  d.Data = `${dia} de ${mesesNomes[dt.getMonth()]} de ${dt.getFullYear()}`;
                }
              }
              return d;
            }
            catch { return null; }
          }).filter(Boolean);
        }
      } catch {}
    }
    return [];
  },
  async del_prefix(prefix) {
    const rows = await this.list(prefix);
    await Promise.all(rows.map(r => this.del(r.key)));
  },

  // ── [U-3] Soft delete — move proc_ para trash_ (recuperável) ─────────────
  async trash(key) {
    const item = await this.get(key);
    if (!item) return false;
    // Grava em trash_ com metadados de exclusão
    await this.set("trash_" + key, {
      _fromKey: key,
      _trashedAt: Date.now(),
      _data: item
    });
    // Remove o original
    await this.del(key);
    return true;
  },

  // ── [U-3] Restaurar do trash ───────────────────────────────────────────
  async restore(trashKey) {
    const trash = await this.get(trashKey);
    if (!trash || !trash._fromKey || !trash._data) return false;
    // Verifica se o destino já existe (evita sobrescrever)
    const existente = await this.get(trash._fromKey);
    if (existente) {
      // Merge: mantém o que existe + restaura campos do trash se diferentes
      const merged = { ...existente, ...trash._data, _restoredAt: Date.now() };
      await this.set(trash._fromKey, merged);
    } else {
      await this.set(trash._fromKey, { ...trash._data, _restoredAt: Date.now() });
    }
    await this.del(trashKey);
    return true;
  },

  // ── [U-3] Listar itens na lixeira ─────────────────────────────────────
  async listTrash() {
    const rows = await this.list("trash_proc_");
    return rows
      .map(r => {
        const d = r.value._data || {};
        return {
          key: r.key,
          fromKey: r.value._fromKey || "",
          trashedAt: r.value._trashedAt || 0,
          numero: d["NÚMERO DO DOCUMENTO"] || r.key.replace("trash_proc_", ""),
          fornecedor: d["FORNECEDOR"] || "",
          orgao: d["ORGÃO"] || ""
        };
      })
      .sort((a, b) => b.trashedAt - a.trashedAt);
  }
};

window.ST = ST;
