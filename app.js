/*
================================================================================
  SISTEMA DE CONTROLE DE PROCESSOS DE PAGAMENTO — React v4.0
  Controladoria Geral · Prefeitura Gov. Edison Lobão / MA
================================================================================
  [C1] Storage: Supabase Cloud → localStorage → MEM
  [C2] proxNumero verifica duplicatas
  [C3] Auto-save não contamina modo edição
  [C4] Histórico avisa quando truncado em 1000 registros
  [A1] Máscara e validação automática de CNPJ/CPF
  [A2] Campo Valor preserva posição do cursor
  [M6] cleanBrasaoAsync com crossOrigin = "anonymous"
  [B1] formPct zerado ao navegar para outra página
  [B2] Busca avisa quando resultado limitado a 100
  [B3] Modal de atalhos de teclado
  ── v3.2 ──────────────────────────────────────────────────────────────────────
  [ATOM] onSave/onSaveEdit gravam cada processo em chave INDIVIDUAL "proc_NUM"
         → elimina race-condition de escritas concorrentes (operador + admin)
         → cada usuário grava só o seu registro, nunca sobrescreve o outro
  [POLL] Polling a cada 20 s + visibilitychange reconstroem estado a partir de
         todos os "proc_*" e "hist_*" do Supabase → 100% sincronizado
  [LIST] _sbFetch("LIST") consulta prefixo no Supabase via PostgREST LIKE
  ── v3.3 ──────────────────────────────────────────────────────────────────────
  ── v3.4 (análise profunda) ───────────────────────────────────────────────────
  [FIX-A] buildMapData: chaves duplicadas orgaoContrato/orgaoModalidade removidas
  [FIX-B] proxNumero/maiorNumero/nextProcesso: Math.max spread → reduce (sem stack overflow)
  [FIX-D] Sidebar: versão atualizada para v3.4·2026
  [FIX-E] procToHist: window.TINFO desnecessário removido
  [FIX-F] handleSync: atualiza sbOnline após sincronização
  [FIX-G] Sidebar: lê sbOnline prop React em vez de _sbLive (agora re-renderiza)
  [FIX-H] App: passa sbOnline para Sidebar
  [FIX-I] App: estado sbOnline adicionado
  [FIX-J] refresh(): setSbOnline atualizado a cada polling
  ── v3.5 (todas as melhorias propostas) ──────────────────────────────────────
  [M-P1] AbortController 8s timeout em toda chamada Supabase
  [M-P2] Cache buildMapData — recalcula só quando dado muda
  [M-AU1] Consulta automática de CNPJ na BrasilAPI
  [M-AU2] Log de auditoria automático (audit_NUM)
  [M-AU3] Relatório mensal PDF em 1 clique (Dashboard)
  [G-S1] Permissões reais — operador não edita processo de outro usuário
  [G-S2] Backup automático semanal + restauração em ConfigPage
  [G-S4] Validação real de CNPJ/CPF com dígitos verificadores (módulo 11)
  [G-I1] Exportação SIAFEM/TCE-MA em CSV
  [G-R1] Relatório mensal PDF formal com assinatura
  [G-R2] Painel comparativo: mês atual vs anterior no Dashboard
  [G-R3] Alerta de processos pendentes há mais de 5 dias úteis
  [J-F2] Indicador de auto-save com 3 estados (salvando/local/nuvem)
  [J-F3] Chip de confirmação ao aplicar dados históricos do fornecedor
  [J-F4] Status de tramitação com semáforo (Em análise/Aprovado/Pago/etc)
  [J-V1] Gráfico de pizza SVG por tipo de processo no Dashboard
  [J-V2] Animação de transição entre páginas + CSS mobile
  [J-V3] Toast com botão Desfazer (5 segundos)
  [J-M1] Sidebar colapsável com hamburger (mobile)
  [J-M2] CSS responsivo — formulários 1 coluna abaixo de 640px
  [J-M3] PWA manifest + theme-color injetados automaticamente
  [M-P3] Web Worker inline para importação de Excel — sem travar a UI
  [M-A3] Service Worker registrado — suporte offline + installable PWA
  ── v4.0 ──────────────────────────────────────────────────────────────────────
  [v4.0-E] ETag polling: _versaoBancoCambou() — zero tráfego quando banco parado
  [v4.0-H] Tabela cgel_historico: HIST_LIST/HIST_POST para histórico indexado
  [v4.0-I] _incrementarVersao() em todo save — notifica outros clientes
  [G-S3] RLS Supabase com app_token — script SQL em INSTRUCOES_v3.5.md
  [FIX1] loadUsers com __schemaV → hash admin nunca quebra após deploy
  [FIX2] Histórico com paginação real (50/pág) — substitui limite fixo de 30
  [FIX3] window.prompt substituído por ModalSenha React (funciona em Safari iOS)
  [FIX4] Subtítulo Dashboard/Histórico corrigido para "20s"
  [FIX5] Filtros avançados na Busca: período, tipo, decisão + CNPJ incluso
  [FIX6] Sessão expira automaticamente após 8h de inatividade
  [FIX7] Tentativas de login persistidas em sessionStorage (resiste a F5)
  [FIX8] Total financeiro R$ no Dashboard por órgão e por mês
  [FIX9] ConfirmModal React substitui os 3 window.confirm nativos
  [FIX10] jsPDF e docx.js pré-carregados silenciosamente após login
  [FIX11] Indicador de rede na carga inicial (erro explícito se Supabase falha)
================================================================================
*/

// ─── Gráficos nativos SVG/CSS — sem dependência externa ──────────────────────

// ─── SQL.js loader ────────────────────────────────────────────────────────────
let _sqlJs = null;
async function loadSqlJs() {
  if (_sqlJs) return _sqlJs;
  return new Promise(res => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js";
    s.onload = async () => {
      try {
        const SQL = await window.initSqlJs({
          locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
        });
        _sqlJs = SQL;
        res(SQL);
      } catch {
        res(null);
      }
    };
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
}

// ─── [C1] Storage durável — Supabase Cloud (primário) + localStorage (fallback) ──
//
//  CONFIGURAÇÃO SUPABASE:
//  1. Acesse https://supabase.com e crie uma conta gratuita
//  2. Crie um novo projeto (anote a URL e a chave anon)
//  3. No SQL Editor do Supabase, execute o script abaixo para criar a tabela:
//
//  CREATE TABLE IF NOT EXISTS cgel_store (
//    chave TEXT PRIMARY KEY,
//    valor TEXT NOT NULL,
//    atualizado_em TIMESTAMPTZ DEFAULT NOW()
//  );
//  ALTER TABLE cgel_store ENABLE ROW LEVEL SECURITY;
//  CREATE POLICY "acesso_publico" ON cgel_store FOR ALL USING (true) WITH CHECK (true);
//
//  4. Preencha SUPABASE_URL e SUPABASE_ANON_KEY abaixo com os valores do seu projeto.
//
const SUPABASE_URL = "https://ogbjhtrrturarxxxkwlg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_PiAtSf5DzNV0dYdNHv1_XA_lQ9pPwDC";

// _sbLive: true = conexão Supabase verificada e funcionando
let _sbLive = false;
const _sbReady = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Cabeçalhos padrão para todas as chamadas
function _sbHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": "Bearer " + SUPABASE_ANON_KEY,
    ...extra
  };
}

// Testa conexão real — chamado 1x na inicialização
async function _sbTestConnection() {
  if (!_sbReady) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cgel_store?select=chave&limit=1`,
      { headers: _sbHeaders() }
    );
    _sbLive = res.ok;
    return _sbLive;
  } catch {
    _sbLive = false;
    return false;
  }
}
// Inicia teste imediatamente
_sbTestConnection();

// [M-P1] AbortController: timeout de 8s em toda chamada Supabase
const _SB_TIMEOUT = 8000;
function _sbFetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), _SB_TIMEOUT);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(tid));
}

async function _sbFetch(method, chave, valor) {
  if (!_sbReady) return null;
  try {
    if (method === "GET") {
      const res = await _sbFetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/cgel_store?chave=eq.${encodeURIComponent(chave)}&select=valor`,
        { headers: _sbHeaders() }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.length ? data[0].valor : null;
    }
    if (method === "POST") {
      const res = await _sbFetchWithTimeout(`${SUPABASE_URL}/rest/v1/cgel_store`, {
        method: "POST",
        headers: _sbHeaders({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ chave, valor, atualizado_em: new Date().toISOString() })
      });
      if (res.ok) _sbLive = true;
      return res.ok;
    }
    if (method === "DELETE") {
      const res = await _sbFetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/cgel_store?chave=eq.${encodeURIComponent(chave)}`,
        { method: "DELETE", headers: _sbHeaders() }
      );
      return res.ok;
    }
    if (method === "LIST") {
      const res = await _sbFetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/cgel_store?chave=like.${encodeURIComponent(chave)}*&select=chave,valor&order=atualizado_em.asc&limit=10000`,
        { headers: _sbHeaders() }
      );
      if (!res.ok) return null;
      _sbLive = true;
      return await res.json();
    }
    // [v4.0] HIST_LIST — tabela separada cgel_historico (migration path)
    if (method === "HIST_LIST") {
      const res = await _sbFetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/cgel_historico?select=*&order=num_processo.asc&limit=10000`,
        { headers: _sbHeaders() }
      );
      if (!res.ok) return null;
      return await res.json();
    }
    if (method === "HIST_POST") {
      const res = await _sbFetchWithTimeout(`${SUPABASE_URL}/rest/v1/cgel_historico`, {
        method: "POST",
        headers: _sbHeaders({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(valor),
      });
      return res.ok;
    }
  } catch { return null; }
}

const MEM = {};
const ST = {
  async get(k) {
    if (_sbReady) {
      try {
        const raw = await _sbFetch("GET", k);
        if (raw !== null) {
          try { localStorage.setItem("cgel_" + k, raw); } catch {}
          return JSON.parse(raw);
        }
      } catch {}
    }
    try {
      const raw = localStorage.getItem("cgel_" + k);
      if (raw !== null) return JSON.parse(raw);
    } catch {}
    return MEM[k] ?? null;
  },

  // Retorna { ok: bool, cloud: bool } — permite saber se salvou na nuvem
  async set(k, v) {
    MEM[k] = v;
    const serialized = JSON.stringify(v);
    let cloud = false;
    if (_sbReady) {
      try {
        const result = await _sbFetch("POST", k, serialized);
        cloud = result === true;
        if (cloud) _sbLive = true;
      } catch {}
    }
    try {
      localStorage.setItem("cgel_" + k, serialized);
    } catch {}
    return { ok: true, cloud };
  },

  async del(k) {
    delete MEM[k];
    if (_sbReady) { try { await _sbFetch("DELETE", k); } catch {} }
    try { localStorage.removeItem("cgel_" + k); } catch {}
    return true;
  },

  // list — sempre tenta Supabase; localStorage só como fallback offline
  async list(prefix) {
    if (_sbReady) {
      try {
        const rows = await _sbFetch("LIST", prefix);
        if (rows !== null) {
          // Atualiza cache local com todos os registros recebidos
          rows.forEach(r => {
            try { localStorage.setItem("cgel_" + r.chave, r.valor); } catch {}
          });
          return rows
            .filter(r => r.valor)
            .map(r => {
              try { return { key: r.chave, value: JSON.parse(r.valor) }; }
              catch { return null; }
            })
            .filter(Boolean);
        }
      } catch {}
    }
    // Fallback offline: lê localStorage deste navegador
    try {
      const results = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("cgel_" + prefix)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            try { results.push({ key: k.slice(5), value: JSON.parse(raw) }); } catch {}
          }
        }
      }
      if (results.length) return results;
    } catch {}
    return Object.entries(MEM)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ key: k, value: v }));
  },

  async del_prefix(prefix) {
    const rows = await this.list(prefix);
    await Promise.all(rows.map(r => this.del(r.key)));
  }
};

// ─── [ATOM] Carregadores atômicos ─────────────────────────────────────────────
//
// loadAllProcessos — mescla blob "processos" (Excel import) + chaves "proc_NUM"
// (gravação individual). proc_ tem prioridade (dados mais frescos).
async function loadAllProcessos() {
  const [atomRows, blobArr] = await Promise.all([
    ST.list("proc_"),
    ST.get("processos")
  ]);

  const map = new Map();

  // 1. Blob legado (importação Excel) — menor prioridade
  if (Array.isArray(blobArr)) {
    blobArr.forEach(p => {
      const k = String(p["NÚMERO DO DOCUMENTO"] || "").trim();
      if (k) map.set(k, p);
    });
  }

  // 2. Chaves atômicas individuais — maior prioridade (sobrescrevem)
  if (atomRows && atomRows.length > 0) {
    atomRows.forEach(r => {
      if (!r.value) return;
      const k = String(r.value["NÚMERO DO DOCUMENTO"] || "").trim();
      if (k) map.set(k, r.value);
    });
  }

  return [...map.values()].sort((a, b) => {
    const na = parseInt(String(a["NÚMERO DO DOCUMENTO"] || "0"), 10);
    const nb = parseInt(String(b["NÚMERO DO DOCUMENTO"] || "0"), 10);
    return na - nb;
  });
}

// loadAllHistorico — garante que TODOS os processos do banco aparecem no
// Histórico e no Dashboard, independentemente de terem passado pelo formulário.
//
// Camadas (prioridade crescente):
//   1. Entradas derivadas de cada processo do banco (processos blob + proc_*)
//   2. Blob legado "historico" (sobrepõe com info de Decisão já salva)
//   3. Chaves atômicas "hist_NUM" (dados mais frescos, gravados por qualquer usuário)
async function loadAllHistorico() {
  const [atomProcs, procBlob, atomHist, histBlob] = await Promise.all([
    ST.list("proc_"),
    ST.get("processos"),
    ST.list("hist_"),
    ST.get("historico")
  ]);

  const map = new Map();

  // Auxiliar: converte um registro de processo em linha de histórico
  const procToHist = p => {
    const tipoKey = p["_tipoKey"] || "";
    const dec = p["_decisao"]; // só "deferir"/"indeferir" quando explicitamente salvo
    // Data sempre por extenso
    const dataExt = dtExt(formatData(p["DATA"] || ""));
    return {
      "Processo":            p["NÚMERO DO DOCUMENTO"] || "",
      "Data":                dataExt,
      "Órgão":               p["ORGÃO"] || "",
      "Fornecedor":          p["FORNECEDOR"] || "",
      "Valor":               p["VALOR"] || "",
      "Tipo":                tipoKey ? (TINFO[tipoKey]?.label || tipoKey) : "",
      "TipoKey":             tipoKey,
      // Vazio = ainda não processado (renderizado como PENDENTE, nunca como INDEFERIDO)
      "Decisão":             dec === "deferir" ? "DEFERIDO" : dec === "indeferir" ? "INDEFERIDO" : "",
      "CNPJ":                p["CNPJ"] || "",
      "MODALIDADE":          p["MODALIDADE"] || "",
      "CONTRATO":            p["CONTRATO"] || "",
      "OBJETO":              p["OBJETO"] || "",
      "DOCUMENTO FISCAL":    p["DOCUMENTO FISCAL"] || "",
      "Nº":                  p["Nº"] || "",
      "TIPO":                p["TIPO"] || "",
      "SECRETARIO":          p["SECRETARIO"] || "",
      "PERÍODO DE REFERÊNCIA": p["PERÍODO DE REFERÊNCIA"] || "",
      "N° ORDEM DE COMPRA":  p["N° ORDEM DE COMPRA"] || "",
      "DATA NF":             p["DATA NF"] || "",
      "NÚMERO DO DOCUMENTO": p["NÚMERO DO DOCUMENTO"] || "",
      "_obs":                p["_obs"] || "",
      "_sits":               p["_sits"] || [],
      "_tipoKey":            tipoKey,
      "_decisao":            dec || "",
      "_usuario":            p["_usuario"] || "",
      "_registradoEm":       p["_registradoEm"] || ""
    };
  };

  // ── 1. Base: todos os processos do banco ─────────────────────────────────
  // 1a. Blob "processos" (importação Excel)
  if (Array.isArray(procBlob)) {
    procBlob.forEach(p => {
      const k = String(p["NÚMERO DO DOCUMENTO"] || "").trim();
      if (k) map.set(k, procToHist(p));
    });
  }
  // 1b. Chaves atômicas proc_* (gravadas por qualquer usuário)
  if (atomProcs && atomProcs.length) {
    atomProcs.forEach(r => {
      if (!r.value) return;
      const k = String(r.value["NÚMERO DO DOCUMENTO"] || "").trim();
      if (k) map.set(k, procToHist(r.value));
    });
  }

  // ── 2. Blob legado "historico" — sobrepõe dados de Decisão/Tipo ──────────
  if (Array.isArray(histBlob)) {
    histBlob.forEach(h => {
      const k = String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "").trim();
      if (!k) return;
      map.set(k, { ...(map.get(k) || {}), ...h });
    });
  }

  // ── 3. Chaves atômicas hist_* — dados mais frescos (maior prioridade) ────
  if (atomHist && atomHist.length) {
    atomHist.forEach(r => {
      if (!r.value) return;
      const k = String(r.value["Processo"] || r.value["NÚMERO DO DOCUMENTO"] || "").trim();
      if (!k) return;
      map.set(k, { ...(map.get(k) || {}), ...r.value });
    });
  }

  // Ordena: mais recente (maior número) primeiro
  return [...map.values()].sort((a, b) => {
    const na = parseInt(String(a["Processo"] || "0"), 10);
    const nb = parseInt(String(b["Processo"] || "0"), 10);
    return nb - na;
  });
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CHK = {
  padrao: ["Validação do Documento Fiscal", "Emissão e Autenticação das Certidões Negativas", "Conformidade com o processo Licitatório", "Disponibilidade de Saldos Licitatórios", "Outros: Contratos, Valores, Impostos", "Extrato do Contrato"],
  eng: ["Validação do Documento Fiscal", "Emissão e Autenticação das Certidões Negativas", "Conformidade com o processo Licitatório", "Disponibilidade de Saldos Licitatórios", "Solicitação de pagamento com medição", "Planilha de medição assinada", "Relatório fotográfico", "Cópia Do Contrato", "ART ou RRT"],
  tdf: ["Ofício", "Formulário TFD", "Conformidade com o processo Licitatório", "Laudo Médico", "Documentos pessoais"],
  passagem: ["Prestação de contas diárias", "Documentação comprobatória", "Requerimento de restituição"],
  // Aldir Blanc / PNAB — baseado no modelo oficial
  pnab: [
    "Documentos pessoais (RG e CPF)",
    "Formulário de Inscrição e informações sobre a trajetória",
    "Comprovante de residência em Governador Edison Lobão",
    "Curriculum ou Portifólio Artístico",
    "Publicação do resultado final",
    "Certidões pessoa física ou jurídica"
  ]
};
const TINFO = {
  padrao: {
    label: "Anexo II",
    icon: "📄",
    cor: "#2563eb"
  },
  eng: {
    label: "NF Engenharia",
    icon: "🏗️",
    cor: "#7c3aed"
  },
  tdf: {
    label: "TFD",
    icon: "🏥",
    cor: "#0f766e"
  },
  passagem: {
    label: "Restituição Passagem",
    icon: "✈️",
    cor: "#d97706"
  },
  // Aldir Blanc / PNAB
  pnab: {
    label: "Aldir Blanc / PNAB",
    icon: "🎭",
    cor: "#be185d"
  }
};
const COL_CANON = {
  // Órgão / Secretaria
  "ORGAO": "ORGÃO",
  "SECRETARIA ORGAO": "ORGÃO",
  "ORGAO SECRETARIA": "ORGÃO",
  "UNIDADE": "ORGÃO",
  "DEPARTAMENTO": "ORGÃO",
  "SECRETARIA MUNICIPAL": "ORGÃO",
  // Secretário
  "SECRETARIO": "SECRETARIO",
  "ORDENADOR": "SECRETARIO",
  "GESTOR": "SECRETARIO",
  "RESPONSAVEL": "SECRETARIO",
  "ORDENADOR DE DESPESA": "SECRETARIO",
  // Fornecedor / Credor
  "FORNECEDOR": "FORNECEDOR",
  "EMPRESA": "FORNECEDOR",
  "CREDOR": "FORNECEDOR",
  "RAZAO SOCIAL": "FORNECEDOR",
  "NOME": "FORNECEDOR",
  "BENEFICIARIO": "FORNECEDOR",
  // CNPJ/CPF
  "CNPJ": "CNPJ",
  "CPF": "CNPJ",
  "CNPJ/CPF": "CNPJ",
  "CPF/CNPJ": "CNPJ",
  "CNPJ CPF": "CNPJ",
  "CPF CNPJ": "CNPJ",
  "INSCRICAO": "CNPJ",
  // Modalidade / Licitação
  "MODALIDADE": "MODALIDADE",
  "MODALIDADE LICITACAO": "MODALIDADE",
  "MODALIDADE LICITAÇÃO": "MODALIDADE",
  "TIPO LICITACAO": "MODALIDADE",
  // Contrato
  "CONTRATO": "CONTRATO",
  "NUMERO CONTRATO": "CONTRATO",
  "N CONTRATO": "CONTRATO",
  "Nº CONTRATO": "CONTRATO",
  "CONTRATO N": "CONTRATO",
  // Objeto
  "OBJETO": "OBJETO",
  "DESCRICAO": "OBJETO",
  "DESCRICAO DO OBJETO": "OBJETO",
  "SERVICO": "OBJETO",
  "PRODUTO": "OBJETO",
  "DESCRICAO SERVICO": "OBJETO",
  // Valor
  "VALOR": "VALOR",
  "VALOR TOTAL": "VALOR",
  "VALOR PAGO": "VALOR",
  "VALOR LIQUIDO": "VALOR",
  "VALOR BRUTO": "VALOR",
  "MONTANTE": "VALOR",
  // NF número (campo "Nº" salvo pelo sistema — chave exata)
  "Nº": "Nº",
  "N°": "Nº",
  "NF": "Nº",
  "NUMERO NF": "Nº",
  "Nº NF": "Nº",
  "NF/FATURA": "Nº",
  "NUMERO DA NF": "Nº",
  "NUMERO NOTA": "Nº",
  "NOTA FISCAL": "Nº",
  "NUMERO DOCUMENTO FISCAL": "Nº",
  "FATURA": "Nº",
  "NUMERO FATURA": "Nº",
  // Tipo NF
  "TIPO": "TIPO",
  "TIPO NF": "TIPO",
  "TIPO NOTA": "TIPO",
  "TIPO DOCUMENTO FISCAL": "TIPO",
  "ESPECIE": "TIPO",
  // Documento Fiscal (tipo do documento: NFS-e, NF, RPA...)
  "DOCUMENTO FISCAL": "DOCUMENTO FISCAL",
  "DOC FISCAL": "DOCUMENTO FISCAL",
  "TIPO DOCUMENTO": "DOCUMENTO FISCAL",
  "ESPECIE DOCUMENTO": "DOCUMENTO FISCAL",
  // Data NF
  "DATA NF": "DATA NF",
  "DATA DA NF": "DATA NF",
  "DATA NOTA": "DATA NF",
  "DATA EMISSAO": "DATA NF",
  "DATA EMISSÃO": "DATA NF",
  "EMISSAO": "DATA NF",
  // Número do processo / documento
  "NUMERO DO DOCUMENTO": "NÚMERO DO DOCUMENTO",
  "PROCESSO": "NÚMERO DO DOCUMENTO",
  "NUMERO PROCESSO": "NÚMERO DO DOCUMENTO",
  "N PROCESSO": "NÚMERO DO DOCUMENTO",
  "PROTOCOLO": "NÚMERO DO DOCUMENTO",
  "NUMERO": "NÚMERO DO DOCUMENTO",
  // Período de referência
  "PERIODO DE REFERENCIA": "PERÍODO DE REFERÊNCIA",
  "PERIODO": "PERÍODO DE REFERÊNCIA",
  "COMPETENCIA": "PERÍODO DE REFERÊNCIA",
  "REFERENCIA": "PERÍODO DE REFERÊNCIA",
  "MES REFERENCIA": "PERÍODO DE REFERÊNCIA",
  // Ordem de compra
  "N° ORDEM DE COMPRA": "N° ORDEM DE COMPRA",
  "ORDEM DE COMPRA": "N° ORDEM DE COMPRA",
  "N ORDEM": "N° ORDEM DE COMPRA",
  "ORDEM": "N° ORDEM DE COMPRA",
  "NUMERO ORDEM": "N° ORDEM DE COMPRA",
  "OC": "N° ORDEM DE COMPRA",
  // Nome fantasia
  "NOME FANTASIA": "NOME FANTASIA",
  "FANTASIA": "NOME FANTASIA",
  "APELIDO": "NOME FANTASIA",
  // Outros
  "SOLICITANTE": "SOLICITANTE",
  "CPF BENEFICIARIO": "CPF_BENEFICIARIO",
  "OBSERVACAO": "_obs",
  "OBSERVAÇÃO": "_obs",
  "OBS": "_obs",
  "NOTAS": "NOTAS",
  "NOTA INTERNA": "NOTAS",
  "DATA": "DATA",
  "DATA ATESTE": "DATA",
  "DATA DO ATESTE": "DATA"
};
const FOOTER_TXT = "RUA IMPERATRIZ II, Nº 800, CENTRO - GOV. EDISON LOBÃO/MA  |  CEP: 65.928-000";

// ── Cores municipais: Ouro #EFD103 | Verde #006000 | Azul #0040E0 ──
const MUN = {
  gold: "#EFD103",
  goldDk: "#b89d00",
  goldXdk: "#7a6500",
  green: "#006000",
  greenDk: "#003d00",
  greenXdk: "#001800",
  greenMid: "#1a4a1a",
  blue: "#0040E0",
  blueDk: "#002da0",
  blueXdk: "#001560"
};
const T = {
  // Modo claro: fundo creme-esverdeado suave
  appBg: "#f2f4f7",
  cardBg: "#ffffff",
  border: "#c8d8b8",
  textMain: "#1a2310",
  // Modo escuro: fundo verde-escuro profundo baseado nas cores do brasão
  appBgDark: "#1a2820",
  cardBgDark: "#1e3528",
  borderDark: "#005c1a",
  textMainDark: "#f0fae8",
  kpi1: "linear-gradient(135deg," + MUN.green + "," + MUN.greenDk + ")",
  kpi2: "linear-gradient(135deg," + MUN.blue + "," + MUN.blueDk + ")",
  kpi3: "linear-gradient(135deg,#c0392b,#7b241c)",
  kpi4: "linear-gradient(135deg," + MUN.gold + "," + MUN.goldDk + ")",
  kpi5: "linear-gradient(135deg,#1a9e4a,#0e6b30)"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normCol = c => {
  let s = String(c).trim().toUpperCase();
  s = s.replace(/\xa0/g, " ").replace(/\n|\t/g, " ");
  // Antes de NFD: substituir "Nº" (com ordinal masculino U+00BA) por marcador
  s = s.replace(/N\u00ba/gi, "Nº"); // preservar Nº exato
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
};
const canonCol = raw => {
  const n = normCol(raw);
  // Busca exata primeiro
  if (COL_CANON[n]) return COL_CANON[n];
  // Busca pelo valor "Nº" literal (a chave especial)
  if (raw.trim() === "N\u00ba" || raw.trim() === "N°") return "N\u00ba";
  // Busca case-insensitive nas keys (fallback)
  const nl = n.toLowerCase();
  for (const k of Object.keys(COL_CANON)) {
    if (k.toLowerCase() === nl) return COL_CANON[k];
  }
  return raw;
};
function formatValor(raw) {
  if (!raw) return "";
  raw = String(raw).trim().replace(/^[Rr]\$\s*/, "");
  if (raw.includes(",")) {
    const [int_, dec_] = raw.replace(/\./g, "").split(",");
    const cents = (dec_ || "").slice(0, 2).padEnd(2, "0");
    const num = parseInt(int_.replace(/\D/g, "") || "0", 10);
    return `${num.toLocaleString("pt-BR")},${cents}`;
  }
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 2) return `0,${d.padEnd(2, "0")}`;
  return `${parseInt(d.slice(0, -2), 10).toLocaleString("pt-BR")},${d.slice(-2)}`;
}
function formatData(raw) {
  if (!raw) return "";
  const s = String(raw).trim();

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  }

  // dd/mm/yyyy (já formatado)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // "31 de agosto de 2023" — formato extenso vindo da planilha
  const mesesExt = { janeiro:1,fevereiro:2,"março":3,marco:3,abril:4,maio:5,junho:6,
    julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
  const mExt = s.match(/^(\d{1,2})\s+de\s+([\w\u00C0-\u017E]+)\s+de\s+(\d{4})$/i);
  if (mExt) {
    const dia = String(mExt[1]).padStart(2,"0");
    const mesNum = mesesExt[mExt[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")];
    const mes = String(mesNum || 1).padStart(2,"0");
    return `${dia}/${mes}/${mExt[3]}`;
  }

  // dd-mm-yyyy ou ddmmyyyy numérico
  const d = s.replace(/\D/g, "");
  if (d.length >= 8) return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4,8)}`;
  return s;
}
function dtExt(d) {
  if (!d) return "";
  if (d instanceof Date) return `${d.getDate()} de ${MESES[d.getMonth() + 1]} de ${d.getFullYear()}`;
  const digs = String(d).replace(/\D/g, "");
  if (digs.length >= 8) return `${parseInt(digs.slice(0, 2))} de ${MESES[parseInt(digs.slice(2, 4))]} de ${digs.slice(4, 8)}`;
  return String(d);
}
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// Converte qualquer formato de data para yyyy-mm-dd (para usar em <input type="date">)
function toISO(raw) {
  if (!raw) return todayISO();
  const s = String(raw).trim();
  // já é yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  // fallback: retira dígitos
  const d = s.replace(/\D/g, "");
  if (d.length >= 8) return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
  return todayISO();
}

// Exibe data no formato dd/mm/yyyy (para mostrar em tela e salvar no storage)
function fmtD(raw) {
  return formatData(raw); // já existe: converte yyyy-mm-dd → dd/mm/yyyy
}

// ─── [C2] Sistema de Auditoria de Numeração ──────────────────────────────────
// Garante que o próximo número:
//  1. Parte sempre do MAIOR número existente nos processos + 1
//  2. Nunca repete um número já usado
//  3. Persiste o último número base no storage (âncora)
//  4. Após importar planilha, ancora no maior número REAL (ignora fórmulas =LN+1)

// Extrai apenas inteiros positivos reais — ignora fórmulas, strings, NaN
function _numsSeguros(processos) {
  return (processos || [])
    .map(p => {
      const raw = String(p["NÚMERO DO DOCUMENTO"] || "").trim();
      // Ignorar fórmulas Excel (=L2+1 etc.) que possam ter escapado da importação
      if (raw.startsWith("=")) return NaN;
      const n = parseInt(raw, 10);
      // Limite razoável: números de processo não chegam a 99999
      return (!isNaN(n) && n > 0 && n < 99999) ? n : NaN;
    })
    .filter(n => !isNaN(n));
}

function proxNumero(processos) {
  const nums = _numsSeguros(processos);
  if (!nums.length) return 1;
  const usados = new Set(nums);
  let next = nums.reduce((a,b) => a > b ? a : b, 0) + 1;
  while (usados.has(next)) next++;
  return next;
}

// Verifica se um número específico já está em uso
function numeroDuplicado(num, processos, numOriginalEdicao) {
  const n = parseInt(String(num).trim(), 10);
  if (isNaN(n) || n <= 0) return false;
  return processos.some(p => {
    const raw = String(p["NÚMERO DO DOCUMENTO"] || "").trim();
    if (raw.startsWith("=")) return false;
    const pn = parseInt(raw, 10);
    if (numOriginalEdicao && pn === parseInt(String(numOriginalEdicao).trim(), 10)) return false;
    return pn === n;
  });
}

// Calcula o maior número REAL (ignora fórmulas) de um conjunto de processos
function maiorNumero(processos) {
  const nums = _numsSeguros(processos);
  return nums.length ? nums.reduce((a,b) => a > b ? a : b, 0) : 0;
}

// ─── [A1] Máscara CNPJ/CPF ────────────────────────────────────────────────────
function mascararCnpjCpf(raw) {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 11) {
    const p1 = d.slice(0, 3),
      p2 = d.slice(3, 6),
      p3 = d.slice(6, 9),
      p4 = d.slice(9, 11);
    if (d.length <= 3) return p1;
    if (d.length <= 6) return `${p1}.${p2}`;
    if (d.length <= 9) return `${p1}.${p2}.${p3}`;
    return `${p1}.${p2}.${p3}-${p4}`;
  }
  const p1 = d.slice(0, 2),
    p2 = d.slice(2, 5),
    p3 = d.slice(5, 8),
    p4 = d.slice(8, 12),
    p5 = d.slice(12, 14);
  if (d.length <= 2) return p1;
  if (d.length <= 5) return `${p1}.${p2}`;
  if (d.length <= 8) return `${p1}.${p2}.${p3}`;
  if (d.length <= 12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
}
function validarCnpjCpf(raw) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 0) return true;
  if (d.length === 11) return validarCPF(d);
  if (d.length === 14) return validarCNPJ(d);
  return false;
}
function validarCPF(d) {
  if (/^(\d)\1{10}$/.test(d)) return false; // todos iguais
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r >= 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r >= 10) r = 0;
  return r === parseInt(d[10]);
}
function validarCNPJ(d) {
  if (/^(\d)\1{13}$/.test(d)) return false; // todos iguais
  const calc = (n) => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += parseInt(d[i]) * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}


// ─── [J-F4] Status de tramitação ─────────────────────────────────────────────
const STATUS_MAP = {
  analise:   { label: "Em análise",              cor: "#d97706", emoji: "🟡" },
  aguardando:{ label: "Aguardando complementação",cor: "#7c3aed", emoji: "🟣" },
  aprovado:  { label: "Aprovado p/ pagamento",   cor: "#16a34a", emoji: "🟢" },
  pago:      { label: "Pago",                    cor: "#0f172a", emoji: "⚫" },
  devolvido: { label: "Devolvido",               cor: "#dc2626", emoji: "🔴" }
};

// ─── MapData ──────────────────────────────────────────────────────────────────
// [M-P2] Cache: só recalcula quando o array de processos realmente muda
let _mapDataCache = null;
let _mapDataKey = null;
function _mapDataHash(processos) {
  if (!processos.length) return "0:";
  const last = processos[processos.length - 1];
  return `${processos.length}:${last["NÚMERO DO DOCUMENTO"] || ""}`;
}
function buildMapData(processos) {
  const key = _mapDataHash(processos);
  if (_mapDataKey === key && _mapDataCache) return _mapDataCache;
  _mapDataKey = key;
  _mapDataCache = _buildMapDataInner(processos);
  return _mapDataCache;
}
function _buildMapDataInner(processos) {
  const dct = (kC, vC) => {
    const m = {};
    for (const p of processos) {
      const k = String(p[kC] || "").trim(),
        v = String(p[vC] || "").trim();
      if (k && v) m[k] = v;
    }
    return m;
  };
  const lst = col => {
    const s = new Set();
    for (const p of processos) {
      const v = String(p[col] || "").trim();
      if (v) s.add(v);
    }
    return [...s].sort();
  };
  const multi = (kC, vC) => {
    const m = {};
    for (const p of processos) {
      const k = String(p[kC] || "").trim(),
        v = String(p[vC] || "").trim();
      if (!k || !v) continue;
      if (!m[k]) m[k] = new Set();
      m[k].add(v);
    }
    const out = {};
    for (const k in m) out[k] = [...m[k]].sort();
    return out;
  };
  return {
    orgaoSecretario: dct("ORGÃO", "SECRETARIO"),
    orgaoContrato: dct("ORGÃO", "CONTRATO"),
    orgaoModalidade: dct("ORGÃO", "MODALIDADE"),
    fornCnpj: dct("FORNECEDOR", "CNPJ"),
    fornObjeto: dct("FORNECEDOR", "OBJETO"),
    fornModalidade: dct("FORNECEDOR", "MODALIDADE"),
    fornContrato: dct("FORNECEDOR", "CONTRATO"),
    fornNf: dct("FORNECEDOR", "Nº"),
    fornTipDoc: dct("FORNECEDOR", "DOCUMENTO FISCAL"),
    fornTipNf: dct("FORNECEDOR", "TIPO"),
    fornPeriodo: dct("FORNECEDOR", "PERÍODO DE REFERÊNCIA"),
    fornOrdemCompra: dct("FORNECEDOR", "N° ORDEM DE COMPRA"),
    fornObjetosList: multi("FORNECEDOR", "OBJETO"),
    fornContratosList: multi("FORNECEDOR", "CONTRATO"),
    fornModalidadesList: multi("FORNECEDOR", "MODALIDADE"),
    cnpjForn: dct("CNPJ", "FORNECEDOR"),
    modalContrato: dct("MODALIDADE", "CONTRATO"),
    modalContratosList: multi("MODALIDADE", "CONTRATO"),
    objModalidade: dct("OBJETO", "MODALIDADE"),
    objContrato: dct("OBJETO", "CONTRATO"),
    allSecretarios: lst("SECRETARIO"),
    allCnpjs: lst("CNPJ"),
    allContratos: lst("CONTRATO"),
    allObjsHist: lst("OBJETO"),
    allDocFiscais: lst("DOCUMENTO FISCAL"),
    allTiposNf: lst("TIPO"),
    allModalidades: lst("MODALIDADE"),
    allOrgaos: lst("ORGÃO"),
    allFornecedores: lst("FORNECEDOR"),
    orgaoContratosList: multi("ORGÃO", "CONTRATO"),
    orgaoModalidadesList: multi("ORGÃO", "MODALIDADE")
  };
} // end _buildMapDataInner

// ─── Auth ─────────────────────────────────────────────────────────────────────
// [FIX1] Versão do schema de usuários — incrementar aqui força recriação do admin
// se o código de hash mudar entre deploys, evitando login quebrado.
const USERS_SCHEMA_V = 3;

async function hashSenha(salt, senha) {
  const e = new TextEncoder(),
    b = await crypto.subtle.digest("SHA-256", e.encode(salt + senha));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function loadUsers() {
  let u = await ST.get("users");
  // Recria admin se: não existe, ou schemaV desatualizado (hash de versão anterior)
  if (!u || u.__schemaV !== USERS_SCHEMA_V) {
    const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const hash = await hashSenha(salt, "admin123");
    // Preserva outros usuários se existirem, apenas garante admin válido
    const admExistente = u?.admin;
    u = {
      ...(u || {}),
      admin: admExistente && u.__schemaV === USERS_SCHEMA_V ? admExistente : {
        senha: hash,
        salt,
        nome: "Administrador",
        perfil: "admin",
        ativo: true
      },
      __schemaV: USERS_SCHEMA_V
    };
    await ST.set("users", u);
  }
  return u;
}
async function checkLogin(login, senha) {
  const us = await loadUsers(),
    u = us[login];
  if (!u || !u.ativo) return null;
  return (await hashSenha(u.salt, senha)) === u.senha ? u : null;
}

// ─── Excel ────────────────────────────────────────────────────────────────────
async function importarExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

  // ── Descobrir índice de cada coluna pelo cabeçalho (linha 1) ──────────────
  const colIdx = {}; // canonName → índice
  for (let c = 0; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell && cell.v) colIdx[canonCol(String(cell.v))] = c;
  }
  const numDocIdx = colIdx["NÚMERO DO DOCUMENTO"];

  // ── Valor da ÚLTIMA LINHA com dado em NÚMERO DO DOCUMENTO ─────────────────
  // Estratégia correta: pegar o valor da última linha preenchida,
  // independente de ser fórmula ou não (o Excel já calculou o valor correto).
  // Isso resolve planilhas com sequências =L2+1 que chegam ao número certo (2591).
  let lastNum = 0;
  if (numDocIdx !== undefined) {
    for (let r = 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: numDocIdx })];
      if (cell && cell.v !== undefined && cell.v !== "") {
        const n = parseInt(String(cell.v).trim(), 10);
        if (!isNaN(n) && n > 0 && n < 99999) lastNum = n; // sobrescreve → fica com o último
      }
    }
  }

  // ── Ler todas as linhas de dados ──────────────────────────────────────────
  const rows = [];
  for (let r = 1; r <= range.e.r; r++) {
    const row = {};
    let temDado = false;
    for (let c = 0; c <= range.e.c; c++) {
      const hCell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (!hCell || !hCell.v) continue;
      const colName = canonCol(String(hCell.v));
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      let valor = cell ? cell.v : "";
      if (valor === undefined || valor === null) valor = "";

      // Datas: converter para dd/mm/yyyy
      if (valor instanceof Date) {
        const dia = String(valor.getDate()).padStart(2, "0");
        const mes = String(valor.getMonth() + 1).padStart(2, "0");
        const ano = valor.getFullYear();
        valor = `${dia}/${mes}/${ano}`;
      }

      // NÚMERO DO DOCUMENTO: garantir inteiro
      if (colName === "NÚMERO DO DOCUMENTO") {
        const n = parseInt(String(valor).trim(), 10);
        valor = (!isNaN(n) && n > 0 && n < 99999) ? n : "";
      }

      if (valor !== "") temDado = true;
      row[colName] = valor;
    }
    // Só incluir linhas do BLOCO VIGENTE:
    // - Nº do documento válido
    // - Nº <= lastNum (descarta bloco antigo com números maiores que o período vigente)
    //   Ex: planilha tem linhas antigas com Nº 2774-3095 → descartadas (> 2591)
    //       e linhas vigentes com Nº 1-2591 → mantidas (<= 2591)
    const nd = row["NÚMERO DO DOCUMENTO"];
    const ndNum = parseInt(String(nd ?? "").trim(), 10);
    const ehValido = temDado && !isNaN(ndNum) && ndNum > 0;
    const ehBlocoVigente = lastNum === 0 || ndNum <= lastNum;
    if (ehValido && ehBlocoVigente) rows.push(row);
  }

  // Retornar junto com a âncora de numeração
  rows._lastNum = lastNum;
  return rows;
}
function exportarExcel(processos, historico) {
  const wb = XLSX.utils.book_new();
  // Planilha principal — formato compatível com importação (mesmas colunas)
  const COLS_ORDER = ["OBJETO", "ORGÃO", "MODALIDADE", "CONTRATO", "FORNECEDOR", "NOME FANTASIA", "CNPJ", "DOCUMENTO FISCAL", "Nº", "TIPO", "VALOR", "NÚMERO DO DOCUMENTO", "DATA", "SECRETARIO", "N° ORDEM DE COMPRA", "DATA NF", "PERÍODO DE REFERÊNCIA", "_tipoKey", "_decisao"];
  const procRows = processos.map(p => {
    const r = {};
    COLS_ORDER.forEach(c => r[c] = p[c] !== undefined ? p[c] : "");
    return r;
  });
  const ws1 = XLSX.utils.json_to_sheet(procRows, {
    header: COLS_ORDER
  });
  XLSX.utils.book_append_sheet(wb, ws1, "Planilha1");
  // Aba histórico
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historico), "Histórico");
  XLSX.writeFile(wb, `ControleGeral_${todayISO()}.xlsx`);
}


// ─── [G-I1] Exportação SIAFEM/TCE-MA ─────────────────────────────────────────
function exportarSIAFEM(processos) {
  // Formato CSV compatível com TCE-MA / SIAFEM
  const header = [
    "NR_PROCESSO","DT_PAGAMENTO","CD_ORGAO","SECRETARIA","NR_CNPJ_CPF",
    "NM_CREDOR","VL_PAGAMENTO","DS_OBJETO","NR_CONTRATO","TP_LICITACAO",
    "NR_NF","DT_NF","TP_DECISAO","NR_DOC_FISCAL"
  ];
  const parseBRL = v => {
    const s = String(v||"").replace(/\./g,"").replace(",",".");
    const n = parseFloat(s.replace(/[^\d.]/g,""));
    return isNaN(n) ? "0.00" : n.toFixed(2);
  };
  const fmtData = raw => {
    const d = String(raw||"").replace(/\D/g,"");
    if (d.length >= 8) return `${d.slice(4,8)}-${d.slice(2,4)}-${d.slice(0,2)}`;
    return "";
  };
  const esc = v => `"${String(v||"").replace(/"/g,"'")}"`;
  const rows = [header.join(";")];
  processos.forEach(p => {
    rows.push([
      esc(p["NÚMERO DO DOCUMENTO"]),
      esc(fmtData(p["DATA"])),
      esc(""),
      esc(p["ORGÃO"]),
      esc((p["CNPJ"]||"").replace(/\D/g,"")),
      esc(p["FORNECEDOR"]),
      parseBRL(p["VALOR"]),
      esc(p["OBJETO"]),
      esc(p["CONTRATO"]),
      esc(p["MODALIDADE"]),
      esc(p["Nº"]),
      esc(fmtData(p["DATA NF"])),
      esc(p["_decisao"]==="deferir"?"DEFERIDO":p["_decisao"]==="indeferir"?"INDEFERIDO":"PENDENTE"),
      esc(p["DOCUMENTO FISCAL"])
    ].join(";"));
  });
  const csv = rows.join("\n");
  const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SIAFEM_${todayISO()}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2000);
}


// ─── [M-P3] Web Worker inline para importação de Excel ───────────────────────
// Roda em thread separada — não trava a UI com planilhas grandes
const _EXCEL_WORKER_SRC = `
self.onmessage = async function(e) {
  const { buffer, sheetJsUrl } = e.data;
  try {
    // Importa SheetJS no worker
    importScripts(sheetJsUrl);
    const XLSX = self.XLSX;
    const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true, raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    // Descobrir colunas pelo cabeçalho
    const COL_CANON_WORKER = {
      "ORGAO":"ORGÃO","SECRETARIA ORGAO":"ORGÃO","UNIDADE":"ORGÃO","DEPARTAMENTO":"ORGÃO",
      "FORNECEDOR":"FORNECEDOR","EMPRESA":"FORNECEDOR","CREDOR":"FORNECEDOR","NOME":"FORNECEDOR",
      "CNPJ":"CNPJ","CPF":"CNPJ","CNPJ/CPF":"CNPJ","VALOR":"VALOR","VALOR TOTAL":"VALOR",
      "NUMERO DO DOCUMENTO":"NÚMERO DO DOCUMENTO","PROCESSO":"NÚMERO DO DOCUMENTO",
      "DATA":"DATA","OBJETO":"OBJETO","DESCRICAO":"OBJETO","CONTRATO":"CONTRATO",
      "MODALIDADE":"MODALIDADE","SECRETARIO":"SECRETARIO","DOCUMENTO FISCAL":"DOCUMENTO FISCAL",
      "PERIODO DE REFERENCIA":"PERÍODO DE REFERÊNCIA","N ORDEM DE COMPRA":"N° ORDEM DE COMPRA",
      "DATA NF":"DATA NF","TIPO":"TIPO","NF":"Nº","NOTA FISCAL":"Nº"
    };
    const normW = c => {
      let s = String(c).trim().toUpperCase().replace(/[\u00C0-\u017E]/g, m =>
        "AAAAACEEEEIIIIDNOOOOOUUUUYBSS"["ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞSS".indexOf(m)] || m
      ).replace(/\s+/g," ").trim();
      return s;
    };
    const canonW = raw => {
      const n = normW(raw);
      return COL_CANON_WORKER[n] || raw;
    };

    const colIdx = {};
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell && cell.v) colIdx[canonW(String(cell.v))] = c;
    }
    const numDocIdx = colIdx["NÚMERO DO DOCUMENTO"];

    let lastNum = 0, total = range.e.r;
    if (numDocIdx !== undefined) {
      for (let r = 1; r <= range.e.r; r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: numDocIdx })];
        if (cell && cell.v !== undefined && cell.v !== "") {
          const n = parseInt(String(cell.v).trim(), 10);
          if (!isNaN(n) && n > 0 && n < 99999) lastNum = n;
        }
        if (r % 200 === 0) self.postMessage({ type: "progress", pct: Math.round(r/total*80) });
      }
    }

    const rows = [];
    for (let r = 1; r <= range.e.r; r++) {
      const row = {};
      let temDado = false;
      for (let c = 0; c <= range.e.c; c++) {
        const hCell = ws[XLSX.utils.encode_cell({ r: 0, c })];
        if (!hCell || !hCell.v) continue;
        const colName = canonW(String(hCell.v));
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let valor = cell ? cell.v : "";
        if (valor === undefined || valor === null) valor = "";
        if (valor instanceof Date) {
          valor = String(valor.getDate()).padStart(2,"0") + "/" +
                  String(valor.getMonth()+1).padStart(2,"0") + "/" + valor.getFullYear();
        }
        if (colName === "NÚMERO DO DOCUMENTO") {
          const n = parseInt(String(valor).trim(), 10);
          valor = (!isNaN(n) && n > 0 && n < 99999) ? n : "";
        }
        if (valor !== "") temDado = true;
        row[colName] = valor;
      }
      const nd = row["NÚMERO DO DOCUMENTO"];
      const ndNum = parseInt(String(nd ?? "").trim(), 10);
      const ehValido = temDado && !isNaN(ndNum) && ndNum > 0;
      const ehBlocoVigente = lastNum === 0 || ndNum <= lastNum;
      if (ehValido && ehBlocoVigente) rows.push(row);
      if (r % 200 === 0) self.postMessage({ type: "progress", pct: 80 + Math.round(r/total*20) });
    }
    self.postMessage({ type: "done", rows, lastNum });
  } catch(err) {
    self.postMessage({ type: "error", message: err.message });
  }
};
`;

let _excelWorkerUrl = null;
function _getExcelWorkerUrl() {
  if (!_excelWorkerUrl) {
    const blob = new Blob([_EXCEL_WORKER_SRC], { type: "application/javascript" });
    _excelWorkerUrl = URL.createObjectURL(blob);
  }
  return _excelWorkerUrl;
}

async function importarExcelWorker(file, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(_getExcelWorkerUrl());
      worker.onmessage = e => {
        if (e.data.type === "progress" && onProgress) onProgress(e.data.pct);
        else if (e.data.type === "done") {
          const rows = e.data.rows;
          rows._lastNum = e.data.lastNum;
          worker.terminate();
          resolve(rows);
        } else if (e.data.type === "error") {
          worker.terminate();
          reject(new Error(e.data.message));
        }
      };
      worker.onerror = err => { worker.terminate(); reject(err); };
      file.arrayBuffer().then(buffer => {
        worker.postMessage({
          buffer,
          sheetJsUrl: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
        }, [buffer]);
      });
    } catch(e) {
      // Fallback para importarExcel síncrono se Worker não suportado
      importarExcel(file).then(resolve).catch(reject);
    }
  });
}

// ─── SQLite reader ────────────────────────────────────────────────────────────
async function readSqliteDB(file) {
  try {
    const SQL = await loadSqlJs();
    if (!SQL) return {
      error: "sql.js não carregou."
    };
    const buf = await file.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buf));
    const processos = [],
      historico = [],
      orgaosConfig = {};
    try {
      const r = db.exec("SELECT * FROM processos");
      if (r[0]) {
        const {
          columns,
          values
        } = r[0];
        for (const row of values) {
          const o = {};
          columns.forEach((c, i) => {
            o[canonCol(c)] = row[i] ?? "";
          });
          processos.push(o);
        }
      }
    } catch {}
    try {
      const r = db.exec("SELECT * FROM historico");
      if (r[0]) {
        const {
          columns,
          values
        } = r[0];
        for (const row of values) {
          const o = {};
          columns.forEach((c, i) => {
            o[c] = row[i] ?? "";
          });
          historico.push(o);
        }
      }
    } catch {}
    try {
      const r = db.exec("SELECT * FROM orgaos_config");
      if (r[0]) {
        const {
          columns,
          values
        } = r[0];
        for (const row of values) {
          const o = {};
          columns.forEach((c, i) => {
            o[c] = row[i] ?? "";
          });
          if (o.orgao) orgaosConfig[o.orgao] = {
            secretario: o.secretario || "",
            ativo: o.ativo !== 0 && o.ativo !== "0"
          };
        }
      }
    } catch {}
    db.close();
    return {
      processos,
      historico,
      orgaosConfig
    };
  } catch (e) {
    return {
      error: e.message || "Erro ao ler banco."
    };
  }
}

// ─── [M6] cleanBrasaoAsync ────────────────────────────────────────────────────
function cleanBrasaoAsync(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = id.data;
        for (let i = 0; i < px.length; i += 4) if (px[i] > 220 && px[i + 1] > 220 && px[i + 2] > 220) px[i + 3] = 0;
        ctx.putImageData(id, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

// ─── jsPDF loader ─────────────────────────────────────────────────────────────
let _jspdf = null;
async function loadJsPDF() {
  if (_jspdf) return _jspdf;
  return new Promise((res, rej) => {
    if (window.jspdf) {
      _jspdf = window.jspdf;
      res(_jspdf);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => window.jspdf ? (_jspdf = window.jspdf, res(_jspdf)) : rej(new Error("jsPDF não carregou"));
    s.onerror = () => rej(new Error("Falha ao carregar jsPDF"));
    document.head.appendChild(s);
  });
}

// ─── docx.js loader ───────────────────────────────────────────────────────────
let _docxLib = null;
async function loadDocxLib() {
  if (_docxLib) return _docxLib;
  return new Promise((res, rej) => {
    if (window.docx) {
      _docxLib = window.docx;
      res(_docxLib);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/docx@7.8.2/build/index.umd.js";
    s.onload = () => window.docx ? (_docxLib = window.docx, res(_docxLib)) : rej(new Error("docx.js não carregou"));
    s.onerror = () => rej(new Error("Falha ao carregar docx.js"));
    document.head.appendChild(s);
  });
}


// ─── [M-AU3/G-R1] Relatório mensal PDF ───────────────────────────────────────
async function gerarRelatorioPDF(processos, mesAno, appConfig) {
  const lib = await loadJsPDF();
  if (!lib) return { error: "jsPDF não disponível." };
  const { jsPDF } = lib;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, fv = v => v && String(v).trim() ? String(v).trim() : "—";

  // Filtrar processos do mês
  const [mes, ano] = mesAno.split("/");
  const chave = `${ano}-${mes.padStart(2,"0")}`;
  const filtrados = processos.filter(p => {
    const raw = String(p["DATA"] || "");
    if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return (raw.slice(6,10)+"-"+raw.slice(3,5)) === chave;
    if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0,7) === chave;
    return false;
  });

  const parseBRL = v => { const s=String(v||"").replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,""); const n=parseFloat(s); return isNaN(n)?0:n; };
  const fmtBRL = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

  // Totais por órgão
  const porOrgao = {};
  filtrados.forEach(p => {
    const o = p["ORGÃO"] || "Sem órgão";
    if (!porOrgao[o]) porOrgao[o] = { n: 0, total: 0, def: 0, indef: 0 };
    porOrgao[o].n++;
    porOrgao[o].total += parseBRL(p["VALOR"]);
    if (p["_decisao"] === "deferir") porOrgao[o].def++;
    else if (p["_decisao"] === "indeferir") porOrgao[o].indef++;
  });
  const totalGeral = filtrados.reduce((a,p) => a + parseBRL(p["VALOR"]), 0);
  const ctrl = appConfig?.controlador || {};

  // ── Cabeçalho ──
  if (window.BRASAO_B64) {
    try { doc.addImage(window.BRASAO_B64, "PNG", (W-25)/2, 8, 25, 18); } catch {}
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("ESTADO DO MARANHÃO", W/2, 30, { align: "center" });
  doc.text("PREFEITURA MUNICIPAL DE GOVERNADOR EDISON LOBÃO", W/2, 35, { align: "center" });
  doc.text("CONTROLADORIA DO MUNICÍPIO", W/2, 40, { align: "center" });
  doc.setLineWidth(0.5); doc.line(19, 43, W-19, 43);

  doc.setFontSize(14); doc.setFont("helvetica", "bold");
  const nomeMes = ["","JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
    "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  doc.text(`RELATÓRIO MENSAL DE PAGAMENTOS — ${nomeMes[parseInt(mes)] || mes}/${ano}`, W/2, 52, { align: "center" });

  // ── Sumário ──
  let y = 62;
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  [
    ["Total de processos:", filtrados.length.toString()],
    ["Deferidos:", filtrados.filter(p=>p["_decisao"]==="deferir").length.toString()],
    ["Indeferidos:", filtrados.filter(p=>p["_decisao"]==="indeferir").length.toString()],
    ["Pendentes:", filtrados.filter(p=>!p["_decisao"]).length.toString()],
    ["Valor total:", fmtBRL(totalGeral)]
  ].forEach(([l,v]) => {
    doc.setFont("helvetica","bold"); doc.text(l, 25, y);
    doc.setFont("helvetica","normal"); doc.text(v, 85, y);
    y += 6;
  });

  // ── Tabela por órgão ──
  y += 4;
  doc.setLineWidth(0.3); doc.line(19, y, W-19, y); y += 4;
  doc.setFont("helvetica","bold"); doc.setFontSize(10);
  doc.text("Órgão / Secretaria", 22, y);
  doc.text("Qtd", 118, y, { align: "right" });
  doc.text("Deferidos", 138, y, { align: "right" });
  doc.text("Total R$", W-20, y, { align: "right" });
  y += 2; doc.line(19, y, W-19, y); y += 4;

  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  Object.entries(porOrgao).sort(([,a],[,b])=>b.total-a.total).forEach(([org, dados]) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const orgLabel = org.slice(0,55);
    doc.text(orgLabel, 22, y);
    doc.text(dados.n.toString(), 118, y, { align: "right" });
    doc.text(dados.def.toString(), 138, y, { align: "right" });
    doc.text(fmtBRL(dados.total), W-20, y, { align: "right" });
    y += 5;
  });

  y += 2; doc.setLineWidth(0.5); doc.line(19, y, W-19, y); y += 5;
  doc.setFont("helvetica","bold"); doc.setFontSize(10);
  doc.text("TOTAL GERAL", 22, y);
  doc.text(filtrados.length.toString(), 118, y, { align: "right" });
  doc.text(fmtBRL(totalGeral), W-20, y, { align: "right" });

  // ── Lista de processos ──
  y += 10;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.text("Nº", 22, y); doc.text("Fornecedor", 32, y);
  doc.text("Valor", W-50, y, { align: "right" }); doc.text("Decisão", W-20, y, { align: "right" });
  y += 2; doc.setLineWidth(0.2); doc.line(19, y, W-19, y); y += 4;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  filtrados.forEach(p => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(String(p["NÚMERO DO DOCUMENTO"]||""), 22, y);
    doc.text((p["FORNECEDOR"]||"").slice(0,48), 32, y);
    doc.text(fmtBRL(parseBRL(p["VALOR"])), W-50, y, { align: "right" });
    const dec = p["_decisao"]==="deferir"?"DEF":p["_decisao"]==="indeferir"?"INDEF":"PEND";
    doc.text(dec, W-20, y, { align: "right" });
    y += 4;
  });

  // ── Assinatura ──
  if (y > 250) { doc.addPage(); y = 20; }
  y += 10;
  const ctrlNome = fv(ctrl.nome) || "Thiago Soares Lima";
  const ctrlCargo = fv(ctrl.cargo) || "Controlador Geral";
  const ctrlPortaria = fv(ctrl.portaria) || "";
  const hoje = new Date();
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(`Governador Edison Lobão/MA, ${hoje.getDate()} de ${["","janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][hoje.getMonth()+1]} de ${hoje.getFullYear()}`, W-19, y, { align: "right" });
  y += 16;
  doc.text(ctrlNome, W/2, y, { align: "center" });
  y += 5; doc.text(ctrlCargo, W/2, y, { align: "center" });
  if (ctrlPortaria) { y += 5; doc.text(ctrlPortaria, W/2, y, { align: "center" }); }

  // ── Rodapé ──
  const totalPgs = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= totalPgs; pg++) {
    doc.setPage(pg); doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(150,150,150);
    doc.text(FOOTER_TXT, W/2, 291, { align: "center" });
    doc.text(`Pág. ${pg}/${totalPgs}`, W-19, 291, { align: "right" });
    doc.setTextColor(0,0,0);
  }

  const blob = doc.output("blob");
  return { blob, name: `Relatorio_${ano}_${mes.padStart(2,"0")}.pdf` };
}

// ─── gerarPDF ─────────────────────────────────────────────────────────────────
async function gerarPDF(d, tipo, deferir, checklist, sits) {
  try {
    const lib = await loadJsPDF();
    if (!lib) return {
      error: "jsPDF não disponível."
    };
    const {
      jsPDF
    } = lib;
    const fv = v => v && String(v).trim() ? String(v).trim() : "";
    const W = 210,
      H = 297,
      SAFE = H - 13; // margem inferior segura

    // ── Tick / Cross na coluna Situação ──────────────────────────────────────
    function tick(doc, cx, cy) {
      doc.setDrawColor(0, 100, 0);
      doc.setLineWidth(0.5);
      doc.line(cx - 2.2, cy, cx - 0.5, cy + 2.2);
      doc.line(cx - 0.5, cy + 2.2, cx + 2.5, cy - 1.8);
    }
    function cross(doc, cx, cy) {
      doc.setDrawColor(180, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(cx - 2, cy - 2, cx + 2, cy + 2);
      doc.line(cx + 2, cy - 2, cx - 2, cy + 2);
    }

    // ── Cabeçalho (brasão + 3 linhas + linha opcional) ────────────────────────
    function cabecalho(doc, withLine) {
      const bW = 30.7,
        bH = 22.5,
        bX = (W - bW) / 2,
        bY = 8;
      try {
        doc.addImage(window.BRASAO_B64, "PNG", bX, bY, bW, bH);
      } catch (e) {}
      let y = bY + bH + 4.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text("ESTADO DO MARANHÃO", W / 2, y, {
        align: "center"
      });
      y += 5;
      doc.text("PREFEITURA MUNICIPAL DE GOVERNADOR EDISON LOBÃO", W / 2, y, {
        align: "center"
      });
      y += 5;
      doc.text("CONTROLADORIA DO MUNICÍPIO", W / 2, y, {
        align: "center"
      });
      y += 5;
      if (withLine) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.6);
        doc.line(19, y, W - 19, y);
        y += 1;
      }
      return y;
    }

    // ── Garantir espaço — adiciona página nova se necessário ──────────────────
    function ensureSpace(doc, needed) {
      if (y + needed > SAFE) {
        doc.addPage();
        y = cabecalho(doc, true) + 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FS);
        doc.setTextColor(0, 0, 0);
      }
    }

    // ── Dimensões base página 2 ───────────────────────────────────────────────
    const CAB2_H = 52,
      TOP_GAP = 8,
      FOOTER_MARGIN = 13;
    const AVAIL = H - CAB2_H - TOP_GAP - FOOTER_MARGIN; // ≈ 224mm

    // ── Constantes de layout ──────────────────────────────────────────────────
    const FS0 = 12,
      LH0 = 5.5,
      MIN_ROW0 = 7.5,
      PAD0 = 3.0;
    const pW = W - 30 - 19; // 161mm
    const DML = 28.0;
    const DC = [24.9, 22.6, 24.4, 32.5, 33.1, 34.4];
    const CK1 = 12.7,
      CK2 = 139.8,
      CK3 = 19.4;
    const ckX = DML;

    // ── Pré-calcular tamanho do conteúdo (escala base) ────────────────────────
    const doc0 = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    doc0.setFont("helvetica", "normal");
    doc0.setFontSize(FS0);
    function nL(text, w) {
      return doc0.splitTextToSize(fv(text), w).length;
    }
    function rH0(text, w) {
      return Math.max(MIN_ROW0, nL(text, w) * LH0 + PAD0);
    }
    const vw0 = DC[1] + DC[2] + DC[3] + DC[4] + DC[5];
    const vw1 = DC[2] + DC[3] + DC[4] + DC[5];

    // Soma do conteúdo a escala 1.0
    const lbParecer = doc0.splitTextToSize("PARECER DE VERIFICAÇÃO E ANÁLISE DOCUMENTAL Nº " + fv(d.processo) + " (LIBERAÇÃO PARA PAGAMENTO)", pW);
    const lbOrgao = doc0.splitTextToSize("Órgão / Departamento: " + fv(d.orgao), pW);
    const lbObs = d.obs ? doc0.splitTextToSize(d.obs.trim(), pW) : [];
    const lbApos = doc0.splitTextToSize("Após análise e verificação da documentação constante no processo de pagamento acima citado, constatamos o seguinte:", pW);
    const ckRowsH = checklist.map(it => Math.max(MIN_ROW0, nL(it, CK2 - 4) * LH0 + PAD0));
    const dtH = [rH0(d.objeto, vw0), rH0(d.orgao, vw1), rH0(d.fornecedor, vw1), rH0(d.modalidade, vw1), rH0(d.contrato, vw1), rH0(d.cnpj, vw1), Math.max(MIN_ROW0, nL(d.tipo_doc, DC[2] - 3) * LH0 + PAD0)];
    let total = 0;
    total += lbParecer.length * 5.8 + 7;
    total += 5.5 + lbOrgao.length * LH0 + 5 + 5.5 + 7;
    total += dtH.reduce((a, b) => a + b, 0) + 6;
    total += lbApos.length * LH0 + 6;
    total += MIN_ROW0 + ckRowsH.reduce((a, b) => a + b, 0) + 8;
    total += 6 + (lbObs.length > 0 ? lbObs.length * LH0 + 5 : 8);
    total += 6 + LH0 * 5 + 22; // assinatura

    // ── Fator de escala ───────────────────────────────────────────────────────
    // Tenta caber em 1 página, mas se não couber adiciona páginas (nunca corta conteúdo)
    let scale = total > AVAIL ? Math.max(AVAIL / total, 0.65) : 1.0;
    const FS = FS0 * scale;
    const LH = LH0 * scale;
    const MIN_ROW = MIN_ROW0 * scale;
    const PAD = PAD0 * scale;
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    doc.setFontSize(FS);
    doc.setFont("helvetica", "normal");
    function splitS(text, w) {
      return doc.splitTextToSize(fv(text), w);
    }
    function rowH(text, w) {
      return Math.max(MIN_ROW, splitS(text, w).length * LH + PAD);
    }
    let y = 0; // será definido ao iniciar cada página

    // ═══════════════════════════════════════════════════
    // PÁGINA 1 — CAPA
    // ═══════════════════════════════════════════════════
    y = cabecalho(doc, false) + 14;
    const CML = 22.4,
      CCW = 165.1,
      CCA = 47.6,
      CCB = 117.5;

    // Título da capa
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(CML, y, CCW, 10, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("PROCESSO DE PAGAMENTO", CML + CCW / 2, y + 7, {
      align: "center"
    });
    y += 10;

    // Linhas de dados da capa
    const capaRows = [["Órgão:", fv(d.orgao)], ["Processo:", fv(d.processo)], ["Fornecedor:", fv(d.fornecedor)], ["CNPJ:", fv(d.cnpj)], ["NF/Fatura:", fv(d.nf)], ["Contrato:", fv(d.contrato)], ["Modalidade:", fv(d.modalidade)], ["Período de ref.:", fv(d.periodo_ref)], ["N° Ordem de C.:", fv(d.ordem_compra || "")], ["Data da NF.:", fv(d.data_nf)], ["Secretário(a):", fv(d.secretario)], ["Data do ateste:", fv(d.data_ateste)]];
    doc.setFontSize(14);
    for (const [lbl, val] of capaRows) {
      const vL = doc.splitTextToSize(val, CCB - 4);
      const rH = Math.max(10, vL.length * 6.8 + 3);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(CML, y, CCA, rH, "S");
      doc.rect(CML + CCA, y, CCB, rH, "S");
      const TY = y + 7;
      doc.setFont("helvetica", "bold");
      doc.text(lbl, CML + 2.5, TY);
      doc.setFont("helvetica", "normal");
      if (val) {
        vL.forEach((l, li) => doc.text(l, CML + CCA + 2.5, TY + li * 6.8));
      }
      y += rH;
    }

    // Caixa Obs. — sempre vazia na capa (obs. aparece só no Parecer)
    y += 3;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(CML, y, CCW, 30, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Obs.:", CML + 2.5, y + 8);
    // Não avança y — página 1 termina aqui

    // ═══════════════════════════════════════════════════
    // PÁGINA 2 — PARECER
    // ═══════════════════════════════════════════════════
    doc.addPage();
    y = cabecalho(doc, true) + TOP_GAP;

    // PARECER heading
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FS);
    doc.setTextColor(0, 0, 0);
    const pL = splitS("PARECER DE VERIFICAÇÃO E ANÁLISE DOCUMENTAL Nº " + fv(d.processo) + " (LIBERAÇÃO PARA PAGAMENTO)", pW);
    ensureSpace(doc, pL.length * 5.8 * scale + 7);
    doc.text(pL, 30, y, {
      align: "justify",
      maxWidth: pW
    });
    y += pL.length * 5.8 * scale + 7;

    // Ao / Órgão / Ref
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FS);
    ensureSpace(doc, LH * 2 + 10);
    doc.text("Ao", 30, y);
    y += LH;
    const orgL = splitS("Órgão / Departamento: " + fv(d.orgao), pW);
    doc.text(orgL, 30, y);
    y += orgL.length * LH + 5 * scale;
    ensureSpace(doc, LH + 7);
    doc.text("Ref. Processo de Pagamento de Despesa.", 30, y);
    y += LH + 1.5 * scale;

    // ── Tabela de dados ───────────────────────────────────────────────────────
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    function dRow(lbl, val, lW, vW) {
      const vL = splitS(val, vW - 3);
      const rH = Math.max(MIN_ROW, vL.length * LH + PAD);
      ensureSpace(doc, rH);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(DML, y, lW, rH, "S");
      doc.rect(DML + lW, y, vW, rH, "S");
      const TY = y + LH * 0.9;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FS);
      doc.text(lbl, DML + 2.5, TY);
      doc.setFont("helvetica", "normal");
      if (val) {
        vL.forEach((l, li) => doc.text(l, DML + lW + 2.5, TY + li * LH));
      }
      y += rH;
    }
    dRow("OBJETO:", d.objeto, DC[0], vw0);
    dRow("Secretaria/Programa:", d.orgao, DC[0] + DC[1], vw1);
    dRow("Fornecedor/Credor:", d.fornecedor, DC[0] + DC[1], vw1);
    dRow("Modalidade", d.modalidade, DC[0] + DC[1], vw1);
    dRow("Contrato", d.contrato, DC[0] + DC[1], vw1);
    dRow("CNPJ/CPF Nº", d.cnpj, DC[0] + DC[1], vw1);

    // Linha Documento Fiscal (5 colunas)
    {
      const c0 = DC[0] + DC[1],
        c1 = DC[2],
        c2 = DC[3],
        c3 = DC[4],
        c4 = DC[5];
      const x0 = DML,
        x1 = DML + c0,
        x2 = x1 + c1,
        x3 = x2 + c2,
        x4 = x3 + c3;
      const dfL = splitS(d.tipo_doc, c1 - 3);
      const dfH = Math.max(MIN_ROW, dfL.length * LH + PAD);
      ensureSpace(doc, dfH);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(x0, y, c0, dfH, "S");
      doc.rect(x1, y, c1, dfH, "S");
      doc.rect(x2, y, c2, dfH, "S");
      doc.rect(x3, y, c3, dfH, "S");
      doc.rect(x4, y, c4, dfH, "S");
      const mid = y + dfH / 2 + LH * 0.35;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FS);
      doc.text("Documento Fiscal", x0 + 2.5, mid);
      doc.setFont("helvetica", "normal");
      dfL.forEach((l, li) => doc.text(l, x1 + 2.5, mid + (li - Math.floor(dfL.length / 2)) * LH));
      doc.setFont("helvetica", "bold");
      doc.text("Nº ", x2 + 2.5, mid);
      const nW = doc.getTextWidth("Nº ");
      doc.setFont("helvetica", "normal");
      if (d.nf) {
        const t = doc.splitTextToSize(fv(d.nf), c2 - 4 - nW);
        doc.text(t[0], x2 + 2.5 + nW, mid);
      }
      doc.setFont("helvetica", "bold");
      doc.text("Tipo ", x3 + 2.5, mid);
      const tW = doc.getTextWidth("Tipo ");
      doc.setFont("helvetica", "normal");
      if (d.tipo_nf) {
        const t = doc.splitTextToSize(fv(d.tipo_nf), c3 - 4 - tW);
        doc.text(t[0], x3 + 2.5 + tW, mid);
      }
      doc.setFont("helvetica", "bold");
      doc.text("R$ ", x4 + 2.5, mid);
      const rW2 = doc.getTextWidth("R$ ");
      doc.setFont("helvetica", "normal");
      if (d.valor) {
        const t = doc.splitTextToSize(fv(d.valor), c4 - 4 - rW2);
        doc.text(t[0], x4 + 2.5 + rW2, mid);
      }
      y += dfH;
    }
    y += 6 * scale;

    // Após análise...
    const aposL = splitS("Após análise e verificação da documentação constante no processo de pagamento acima citado, constatamos o seguinte:", pW);
    ensureSpace(doc, aposL.length * LH + 6 * scale);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FS);
    doc.setTextColor(0, 0, 0);
    doc.text(aposL, 30, y);
    y += aposL.length * LH + 6 * scale;

    // ── Checklist ──────────────────────────────────────────────────────────────
    const ckHH = Math.max(MIN_ROW, LH + PAD);
    ensureSpace(doc, ckHH);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(ckX, y, CK1, ckHH, "S");
    doc.rect(ckX + CK1, y, CK2, ckHH, "S");
    doc.rect(ckX + CK1 + CK2, y, CK3, ckHH, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FS);
    doc.text("Item", ckX + CK1 / 2, y + ckHH / 2 + LH * 0.35, {
      align: "center"
    });
    doc.text("Descrição: Documentos \u2013 Ato", ckX + CK1 + CK2 / 2, y + ckHH / 2 + LH * 0.35, {
      align: "center"
    });
    doc.setFontSize(FS * 0.85);
    doc.text("Situação", ckX + CK1 + CK2 + CK3 / 2, y + ckHH / 2 + LH * 0.35, {
      align: "center"
    });
    doc.setFontSize(FS);
    y += ckHH;
    for (let i = 0; i < checklist.length; i++) {
      const dL = splitS(checklist[i], CK2 - 4);
      const rH = Math.max(MIN_ROW, dL.length * LH + PAD);
      ensureSpace(doc, rH);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      doc.rect(ckX, y, CK1, rH, "S");
      doc.rect(ckX + CK1, y, CK2, rH, "S");
      doc.rect(ckX + CK1 + CK2, y, CK3, rH, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FS);
      doc.setTextColor(0, 0, 0);
      const ckTY = y + LH * 0.9;
      doc.text(String(i + 1), ckX + CK1 / 2, ckTY, {
        align: "center"
      });
      dL.forEach((l, li) => doc.text(l, ckX + CK1 + 2.5, ckTY + li * LH));
      const sx = ckX + CK1 + CK2 + CK3 / 2,
        sy = y + rH / 2;
      if (sits[i]) tick(doc, sx, sy);else cross(doc, sx, sy);
      y += rH;
    }
    y += 8 * scale;

    // ── OBSERVAÇÃO — sempre visível, nunca cortada ────────────────────────────
    ensureSpace(doc, LH * 2 + 4 * scale); // só precisa de 2 linhas de espaço mínimo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FS);
    doc.setTextColor(0, 0, 0);
    doc.text("OBSERVAÇÃO:", 30, y);
    y += 6 * scale;
    if (d.obs && d.obs.trim()) {
      const oL = splitS(d.obs.trim(), pW);
      // Garante espaço para cada linha, adicionando página se precisar
      for (let li = 0; li < oL.length; li++) {
        ensureSpace(doc, LH + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FS);
        doc.text(oL[li], 30, y);
        y += LH;
      }
      y += 5 * scale;
    } else {
      y += 10 * scale;
    }

    // ── Assinatura — só vai para nova página se realmente não couber ──────────
    // sigH_min = conteúdo real sem espaço em branco excessivo
    const sigH_min = LH * 5 + 12 * scale; // 12mm para espaço de assinatura manuscrita
    const pre_gap = 3 * scale;
    // Só adiciona página se o conteúdo realmente não cabe (com margem de 3mm)
    if (y + pre_gap + sigH_min + 3 * scale > SAFE) {
      doc.addPage();
      y = cabecalho(doc, true) + TOP_GAP;
    }
    y += pre_gap;
    const ctrl = d.controlador || {};
    const ctrlNome = fv(ctrl.nome) || "Thiago Soares Lima";
    const ctrlCargo = fv(ctrl.cargo) || "Controlador Geral";
    const ctrlPortaria = fv(ctrl.portaria) || "Portaria 002/2025";
    const decTxt = deferir ? "DEFERIMOS O PAGAMENTO:" : "INDEFERIMOS O PAGAMENTO:";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FS);
    doc.setTextColor(0, 0, 0);
    doc.text("Governador Edison Lobão/MA, " + fv(d.data_ateste || dtExt(new Date())), W - 19, y, {
      align: "right"
    });
    y += LH;
    doc.text("Nestes Termos:", 90, y);
    y += LH;
    doc.text(decTxt, 90, y);
    y += 12 * scale;
    doc.text(ctrlNome, W / 2, y, {
      align: "center"
    });
    y += LH;
    doc.text(ctrlCargo, W / 2, y, {
      align: "center"
    });
    y += LH;
    if (ctrlPortaria) doc.text(ctrlPortaria, W / 2, y, {
      align: "center"
    });

    // ── Rodapé em todas as páginas ─────────────────────────────────────────────
    const totalPgs = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= totalPgs; pg++) {
      doc.setPage(pg);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(FOOTER_TXT, W / 2, H - 6, {
        align: "center"
      });
    }
    const blob = doc.output("blob");
    return {
      blob,
      name: "PROCESSO_" + fv(d.processo || "doc") + "_" + tipo.toUpperCase() + ".pdf"
    };
  } catch (e) {
    return {
      error: e.message || "Erro ao gerar PDF."
    };
  }
}

// ─── gerarWordDoc ─────────────────────────────────────────────────────────────
async function gerarWordDoc(d, tipo, deferir, checklist, sits) {
  const lib = await loadDocxLib();
  if (!lib) throw new Error("docx.js não disponível.");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType
  } = lib;
  const fv = v => v && String(v).trim() ? String(v).trim() : "—";
  const dataRows = [["Órgão", fv(d.orgao)], ["Processo", fv(d.processo)], ["Fornecedor", fv(d.fornecedor)], ["CNPJ", fv(d.cnpj)], ["Contrato", fv(d.contrato)], ["Modalidade", fv(d.modalidade)], ["Objeto", fv(d.objeto)], ["Valor", "R$ " + fv(d.valor)], ["Data NF", fv(d.data_nf)], ["Secretário(a)", fv(d.secretario)]];
  const mkRow = cells => new TableRow({
    children: cells.map(([txt, bold, pct]) => new TableCell({
      width: {
        size: pct,
        type: WidthType.PERCENTAGE
      },
      children: [new Paragraph({
        children: [new TextRun({
          text: txt,
          bold,
          size: 22
        })]
      })]
    }))
  });
  const tableRows = dataRows.map(([l, v]) => mkRow([[l, true, 30], [v, false, 70]]));
  const chkRows = checklist.map((item, i) => new TableRow({
    children: [new TableCell({
      width: {
        size: 8,
        type: WidthType.PERCENTAGE
      },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: String(i + 1),
          size: 20
        })]
      })]
    }), new TableCell({
      width: {
        size: 77,
        type: WidthType.PERCENTAGE
      },
      children: [new Paragraph({
        children: [new TextRun({
          text: item,
          size: 20
        })]
      })]
    }), new TableCell({
      width: {
        size: 15,
        type: WidthType.PERCENTAGE
      },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: sits[i] ? "✓" : "✗",
          bold: true,
          size: 20,
          color: sits[i] ? "00AA00" : "CC0000"
        })]
      })]
    })]
  }));
  const dec = deferir ? "Com base na análise realizada, manifestamo-nos pelo DEFERIMENTO do processo." : "Com base na análise realizada, manifestamo-nos pelo INDEFERIMENTO do processo.";
  const docObj = new Document({
    sections: [{
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "ESTADO DO MARANHÃO",
          bold: true,
          size: 28
        })]
      }), new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "PREFEITURA MUNICIPAL DE GOVERNADOR EDISON LOBÃO",
          bold: true,
          size: 26
        })]
      }), new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: "CONTROLADORIA DO MUNICÍPIO",
          bold: true,
          size: 26
        })]
      }), new Paragraph({
        text: ""
      }), new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: `PROCESSO DE PAGAMENTO Nº ${fv(d.processo)}`,
          bold: true,
          size: 28
        })]
      }), new Paragraph({
        text: ""
      }), new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE
        },
        rows: tableRows
      }), new Paragraph({
        text: ""
      }), new Paragraph({
        children: [new TextRun({
          text: "CHECKLIST DE VERIFICAÇÃO",
          bold: true,
          size: 24
        })]
      }), new Table({
        width: {
          size: 100,
          type: WidthType.PERCENTAGE
        },
        rows: chkRows
      }), new Paragraph({
        text: ""
      }), new Paragraph({
        children: [new TextRun({
          text: dec,
          size: 22
        })]
      }), new Paragraph({
        text: ""
      }), new Paragraph({
        children: [new TextRun({
          text: `Governador Edison Lobão/MA, ${dtExt(new Date())}`,
          size: 22
        })]
      }), new Paragraph({
        text: ""
      }), new Paragraph({
        children: [new TextRun({
          text: "________________________________",
          size: 22
        })]
      }), new Paragraph({
        children: [new TextRun({
          text: "Controlador Municipal",
          bold: true,
          size: 22
        })]
      }), new Paragraph({
        text: ""
      }), new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: FOOTER_TXT,
          size: 18,
          color: "666666"
        })]
      })]
    }]
  });
  const blob = await Packer.toBlob(docObj);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PROCESSO_${fv(d.processo)}_${tipo.toUpperCase()}.docx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
const LS = dark => ({
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 4,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: dark ? "#4a6494" : "#64748b"
});
const IS = dark => ({
  width: "100%",
  padding: "8px 12px",
  fontSize: 13,
  borderRadius: 9,
  border: `1.5px solid ${dark ? MUN.greenDk : "#c8d8b8"}`,
  background: dark ? "rgba(0,60,0,.35)" : "#f8faf4",
  color: dark ? T.textMainDark : T.textMain,
  outline: "none",
  marginBottom: 14,
  transition: "border .15s"
});
const BS = (v = "primary", dis = false, dark = false) => {
  const base = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 18px 0 10px",
    height: 40,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: dis ? "not-allowed" : "pointer",
    border: "none",
    transition: "all .15s",
    opacity: dis ? .55 : 1,
    whiteSpace: "nowrap"
  };
  const vv = {
    primary: {
      background: MUN.green,
      color: "#fff",
      boxShadow: "3px 3px 0 0 " + MUN.greenDk
    },
    secondary: {
      background: dark ? "#004d00" : "#eaf2ea",
      color: dark ? MUN.gold : MUN.green,
      border: `1.5px solid ${dark ? MUN.greenDk : "#b8d4b8"}`
    },
    success: {
      background: "#16a34a",
      color: "#fff",
      boxShadow: "3px 3px 0 0 #15803d"
    },
    danger: {
      background: "#dc2626",
      color: "#fff",
      boxShadow: "3px 3px 0 0 #b91c1c"
    },
    orange: {
      background: "#ea580c",
      color: "#fff",
      boxShadow: "3px 3px 0 0 #c2410c"
    },
    ghost: {
      background: "transparent",
      color: dark ? "#8aab7a" : "#4a6640",
      border: `1px solid ${dark ? MUN.greenDk : "#c0d4b0"}`
    }
  };
  return {
    ...base,
    ...(vv[v] || vv.primary)
  };
};
const BtnIco = ({
  emoji
}) => /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 14,
    marginRight: 2
  }
}, emoji);
function useDebounce(val, ms) {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setD(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return d;
}
function useToast() {
  const [ts, setTs] = useState([]);
  const toast = useCallback((msg, type = "success", undoFn = null) => {
    const id = Date.now() + Math.random();
    setTs(p => [...p, { id, msg, type, undoFn }]);
    setTimeout(() => setTs(p => p.filter(t => t.id !== id)), undoFn ? 5000 : 4200);
  }, []);
  return {
    toasts: ts,
    toast
  };
}
function Toast({
  toasts
}) {
  if (!toasts.length) return null;
  const bg = {
    success: "#0d2318",
    error: "#450a0a",
    warn: "#451a03",
    info: "#0c1a3a"
  };
  const bd = {
    success: "#16a34a",
    error: "#dc2626",
    warn: "#d97706",
    info: "#2563eb"
  };
  const cl = {
    success: "#86efac",
    error: "#fca5a5",
    warn: "#fcd34d",
    info: "#93c5fd"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, toasts.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    style: {
      padding: "12px 18px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      background: bg[t.type] || bg.success,
      color: cl[t.type] || cl.success,
      border: `1px solid ${bd[t.type] || bd.success}`,
      boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      maxWidth: 380,
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", { style: { flex: 1 } }, t.msg),
  t.undoFn && /*#__PURE__*/React.createElement("button", {
    onClick: () => { t.undoFn(); },
    style: {
      background: "rgba(255,255,255,.2)", border: "1px solid rgba(255,255,255,.4)",
      borderRadius: 6, color: "#fff", fontSize: 11, fontWeight: 700,
      padding: "3px 10px", cursor: "pointer", whiteSpace: "nowrap"
    }
  }, "↩ Desfazer"))));
}
function KPICard({
  label,
  value,
  gradient,
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: gradient,
      borderRadius: 14,
      padding: "16px 18px",
      color: "#fff",
      boxShadow: "0 4px 20px rgba(0,0,0,.15)",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -10,
      right: -10,
      width: 56,
      height: 56,
      borderRadius: "50%",
      background: "rgba(255,255,255,.12)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      marginBottom: 4
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      lineHeight: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      opacity: .8,
      marginTop: 4,
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, label));
}
function PageHeader({
  icon,
  title,
  sub,
  cor = "#2563eb",
  dark,
  actions
}) {
  const cBg = MUN.green,
    bdr = MUN.green;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: cBg,
      borderBottom: "none",
      padding: "14px 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: "rgba(255,255,255,.15)",
      border: "1.5px solid rgba(255,255,255,.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 21
    }
  }, icon), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: "#ffffff"
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "rgba(255,255,255,.75)",
      marginTop: 1
    }
  }, sub))), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, actions));
}
function SH({
  icon,
  title,
  dark
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginBottom: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      color: dark ? MUN.gold : MUN.green
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: dark ? "#007a20" : "#c8d8b8",
      marginLeft: 4
    }
  }));
}
function SearchSelect({
  label,
  value,
  options = [],
  onChange,
  dark,
  required = false,
  placeholder = "Selecione ou digite..."
}) {
  const [open, setOpen] = useState(false);
  const [localVal, setLocalVal] = useState(value || "");
  const ref = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  // Sincronizar quando value muda externamente
  useEffect(() => {
    setLocalVal(value || "");
  }, [value]);
  const filtered = useMemo(() => {
    const q = localVal.trim();
    if (!q) return options.slice(0, 80);
    return options.filter(o => o.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  }, [options, localVal]);
  // Fechar ao clicar fora — sem chamar onChange (usuário já digitou)
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const choose = v => {
    onChangeRef.current(v);
    setLocalVal(v);
    setOpen(false);
  };
  const handleInput = e => {
    const v = e.target.value;
    setLocalVal(v);
    onChangeRef.current(v);
    setOpen(true);
  };
  const bdr = dark ? "#1e2d40" : "#e2e8f0";
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "relative",
      marginBottom: 14
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, label, required && " *"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: localVal,
    onChange: handleInput,
    onFocus: () => setOpen(true),
    onKeyDown: e => {
      if (e.key === "Escape") {
        setOpen(false);
      }
      if (e.key === "Enter" && filtered.length > 0) {
        choose(filtered[0]);
      }
    },
    placeholder: placeholder,
    style: {
      ...IS(dark),
      marginBottom: 0,
      paddingRight: 24,
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    onMouseDown: e => {
      e.preventDefault();
      setOpen(o => !o);
    },
    style: {
      position: "absolute",
      right: 7,
      cursor: "pointer",
      fontSize: 10,
      color: "#94a3b8",
      userSelect: "none"
    }
  }, open ? "▲" : "▼")), open && filtered.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      zIndex: 200,
      background: dark ? "#003d00" : "#fff",
      border: `1.5px solid ${dark ? MUN.green : "#bfdbfe"}`,
      borderRadius: 8,
      marginTop: 2,
      boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 210,
      overflowY: "auto"
    }
  }, filtered.map(o => /*#__PURE__*/React.createElement("div", {
    key: o,
    onMouseDown: e => {
      e.preventDefault();
      choose(o);
    },
    style: {
      padding: "9px 14px",
      fontSize: 12.5,
      cursor: "pointer",
      color: dark ? "#e2e8f0" : "#1e293b",
      background: o === value ? dark ? "#004d00" : "#eff6ff" : "transparent",
      borderBottom: `1px solid ${dark ? "#0f1a2e" : "#f8fafc"}`
    },
    onMouseEnter: e => e.currentTarget.style.background = dark ? "#005200" : "#f0f9ff",
    onMouseLeave: e => e.currentTarget.style.background = o === value ? dark ? "#004d00" : "#eff6ff" : "transparent"
  }, o)))));
}
function FilterBadge({
  count,
  fonte,
  isFiltered
}) {
  if (!isFiltered) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: "#7c3aed",
      fontWeight: 700,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: "#f5f3ff",
      padding: "1px 7px",
      borderRadius: 5,
      border: "1px solid #ddd6fe"
    }
  }, "\uD83D\uDD17 ", count, " filtradas \xB7 ", String(fonte || "").slice(0, 28)));
}
function PeriodoInput({
  value,
  onChange,
  dark,
  style
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || "");
  const ref = useRef(null);
  // [FIX Bug C] Sincronizar estado local quando value muda externamente (ex: ao carregar edição)
  useEffect(() => { setQ(value || ""); }, [value]);
  const sug = useMemo(() => {
    const ms = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    const now = new Date();
    const res = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
      for (let mi = 11; mi >= 0; mi--) {
        const s = `${ms[mi]}/${y}`;
        if (!q.trim() || s.includes(q.toUpperCase())) res.push(s);
        if (res.length >= 8) break;
      }
      if (res.length >= 8) break;
    }
    return res;
  }, [q]);
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const escolher = v => {
    setQ(v);
    onChange(v);
    setOpen(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      position: "relative",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => {
      setQ(e.target.value);
      onChange(e.target.value);
      setOpen(true);
    },
    onFocus: () => q.trim() && setOpen(true),
    onKeyDown: e => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter" && sug.length === 1) escolher(sug[0]);
    },
    placeholder: "Ex: MAR\xC7O/2026",
    autoComplete: "off",
    style: style
  }), open && sug.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      zIndex: 200,
      background: dark ? "#0d1421" : "#fff",
      border: `1.5px solid ${dark ? "#7c3aed" : "#a78bfa"}`,
      borderRadius: 8,
      marginTop: 2,
      boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      overflow: "hidden"
    }
  }, sug.map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    onMouseDown: () => escolher(s),
    style: {
      padding: "8px 14px",
      fontSize: 13,
      cursor: "pointer",
      color: dark ? "#e2e8f0" : "#1e293b",
      fontWeight: 600,
      borderBottom: `1px solid ${dark ? "#1e2d40" : "#f1f5f9"}`
    },
    onMouseEnter: e => e.currentTarget.style.background = dark ? "#1e2d40" : "#f5f3ff",
    onMouseLeave: e => e.currentTarget.style.background = "transparent"
  }, "\uD83D\uDCC5 ", s))));
}
function ShortcutsModal({
  onClose,
  dark
}) {
  const bg = dark ? "#004010" : "#fff",
    bdr = dark ? "#1e2d40" : "#e8ecf4",
    tc = dark ? "#e2e8f0" : "#1e293b";
  const atalhos = [["Ctrl+S", "Salvar processo"], ["Ctrl+P", "Gerar PDF"], ["Ctrl+L", "Limpar formulário"], ["Ctrl+D", "Duplicar último"], ["?", "Esta janela"], ["Esc", "Fechar dropdown"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.55)",
      zIndex: 9997,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 16,
      padding: "26px 30px",
      maxWidth: 400,
      width: "90%",
      boxShadow: "0 24px 64px rgba(0,0,0,.35)",
      border: `1px solid ${bdr}`
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 800,
      color: tc
    }
  }, "\u2328\uFE0F Atalhos de Teclado"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: "transparent",
      border: "none",
      fontSize: 18,
      cursor: "pointer",
      color: "#64748b"
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 7
    }
  }, atalhos.map(([k, desc]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "7px 12px",
      borderRadius: 8,
      background: dark ? "#003800" : "#f8fafc",
      border: `1px solid ${bdr}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: dark ? "#94a3b8" : "#64748b"
    }
  }, desc), /*#__PURE__*/React.createElement("kbd", {
    style: {
      background: dark ? "#005c1a" : "#e2e8f0",
      color: tc,
      padding: "2px 10px",
      borderRadius: 6,
      fontSize: 12,
      fontFamily: "monospace",
      fontWeight: 700,
      border: `1px solid ${dark ? "#2d4060" : "#cbd5e1"}`
    }
  }, k))))));
}
function PdfInstrucoes({
  fileName,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.55)",
      zIndex: 9998,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      borderRadius: 16,
      padding: "28px 32px",
      maxWidth: 440,
      width: "90%",
      boxShadow: "0 24px 64px rgba(0,0,0,.3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      textAlign: "center",
      marginBottom: 12
    }
  }, "\uD83D\uDCC4"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 10px",
      textAlign: "center",
      color: "#0f172a",
      fontSize: 16
    }
  }, "Arquivo baixado!"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: "#64748b",
      lineHeight: 1.7,
      marginBottom: 18
    }
  }, "O arquivo ", /*#__PURE__*/React.createElement("b", null, fileName), " foi baixado.", /*#__PURE__*/React.createElement("br", null), "Para converter em PDF:", /*#__PURE__*/React.createElement("br", null), "1. Abra no navegador", /*#__PURE__*/React.createElement("br", null), "2. Pressione ", /*#__PURE__*/React.createElement("b", null, "Ctrl+P"), /*#__PURE__*/React.createElement("br", null), "3. Escolha ", /*#__PURE__*/React.createElement("b", null, "\"Salvar como PDF\"")), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      ...BS("primary", false, false),
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\u2713"
  }), "Entendido")));
}
function Brasao({
  size = 56,
  style = {}
}) {
  const [src, setSrc] = React.useState(window.BRASAO_B64 || null);
  React.useEffect(() => {
    if (!src && window.BRASAO_B64) setSrc(window.BRASAO_B64);
    // Poll até o brasão estar disponível (caso brasao.js carregue depois)
    if (!window.BRASAO_B64) {
      const t = setInterval(() => {
        if (window.BRASAO_B64) { setSrc(window.BRASAO_B64); clearInterval(t); }
      }, 100);
      return () => clearInterval(t);
    }
  }, []);
  if (!src) return null;
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "Bras\xE3o Gov. Edison Lob\xE3o",
    width: size,
    height: size,
    style: {
      objectFit: "contain",
      flexShrink: 0,
      ...style
    }
  });
}

// ─── [FIX9] ConfirmModal — substitui window.confirm em todo o sistema ─────────
function ConfirmModal({ msg, titulo, onOk, onCancel, dark, tipo = "warn" }) {
  const cores = {
    warn:    { bg: "#854d0e", bd: "#eab308", txt: "#fef08a", ico: "⚠️" },
    danger:  { bg: "#7f1d1d", bd: "#dc2626", txt: "#fca5a5", ico: "🗑️" },
    info:    { bg: "#1e3a5f", bd: "#3b82f6", txt: "#bfdbfe", ico: "ℹ️" }
  };
  const c = cores[tipo] || cores.warn;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
      zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center"
    },
    onClick: onCancel
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: dark ? "#1a2820" : "#fff",
      borderRadius: 16, padding: "28px 30px", maxWidth: 420, width: "90%",
      boxShadow: "0 24px 64px rgba(0,0,0,.4)",
      border: `1.5px solid ${c.bd}`
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 32, textAlign: "center", marginBottom: 12 }
  }, c.ico),
  titulo && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 15, fontWeight: 700, color: dark ? c.txt : "#0f172a",
             textAlign: "center", marginBottom: 8 }
  }, titulo),
  /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 13, color: dark ? "#e2e8f0" : "#475569",
             lineHeight: 1.7, textAlign: "center", marginBottom: 22, whiteSpace: "pre-line" }
  }, msg),
  /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", gap: 10, justifyContent: "center" }
  },
  /*#__PURE__*/React.createElement("button", {
    onClick: onCancel,
    style: { ...BS("ghost", false, dark), flex: 1, justifyContent: "center", height: 40 }
  }, "Cancelar"),
  /*#__PURE__*/React.createElement("button", {
    onClick: onOk,
    style: {
      flex: 1, height: 40, justifyContent: "center",
      ...BS(tipo === "danger" ? "danger" : "primary", false, dark)
    }
  }, "Confirmar"))));
}

// ─── [FIX3] ModalSenha — substitui window.prompt para redefinir senha ─────────
function ModalSenha({ login, onOk, onCancel, dark }) {
  const [senha, setSenha] = React.useState("");
  const [ver, setVer] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
      zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center"
    },
    onClick: onCancel
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: dark ? "#1a2820" : "#fff",
      borderRadius: 16, padding: "28px 30px", maxWidth: 380, width: "90%",
      boxShadow: "0 24px 64px rgba(0,0,0,.4)",
      border: `1.5px solid ${MUN.goldDk}`
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 15, fontWeight: 700, color: dark ? "#e2e8f0" : "#0f172a",
             marginBottom: 6 }
  }, "🔑 Redefinir senha"),
  /*#__PURE__*/React.createElement("p", {
    style: { fontSize: 12.5, color: "#94a3b8", marginBottom: 16 }
  }, `Nova senha para "${login}"`),
  /*#__PURE__*/React.createElement("div", { style: { position: "relative" } },
    /*#__PURE__*/React.createElement("input", {
      type: ver ? "text" : "password",
      value: senha,
      onChange: e => setSenha(e.target.value),
      onKeyDown: e => e.key === "Enter" && senha.trim() && onOk(senha.trim()),
      placeholder: "Digite a nova senha",
      autoFocus: true,
      style: { ...IS(dark), paddingRight: 36 }
    }),
    /*#__PURE__*/React.createElement("button", {
      onClick: () => setVer(v => !v),
      style: {
        position: "absolute", right: 8, top: 8, background: "transparent",
        border: "none", cursor: "pointer", fontSize: 14, color: "#94a3b8"
      }
    }, ver ? "🙈" : "👁️")
  ),
  /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 10, marginTop: 4 } },
    /*#__PURE__*/React.createElement("button", {
      onClick: onCancel,
      style: { ...BS("ghost", false, dark), flex: 1, justifyContent: "center", height: 38 }
    }, "Cancelar"),
    /*#__PURE__*/React.createElement("button", {
      onClick: () => senha.trim() && onOk(senha.trim()),
      disabled: !senha.trim(),
      style: { ...BS("success", !senha.trim(), dark), flex: 1, justifyContent: "center", height: 38 }
    }, "Salvar"))));
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage({
  onLogin
}) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  // [FIX7] Tentativas persistidas em sessionStorage — resiste a F5
  const [tent, setTent] = useState(() => {
    try { return parseInt(sessionStorage.getItem("cgel_login_tent") || "0", 10); } catch { return 0; }
  });
  const [bloq, setBloq] = useState(() => {
    try { return sessionStorage.getItem("cgel_login_bloq") === "1"; } catch { return false; }
  });
  const [count, setCount] = useState(() => {
    try {
      const exp = parseInt(sessionStorage.getItem("cgel_login_exp") || "0", 10);
      const rem = Math.max(0, Math.ceil((exp - Date.now()) / 1000));
      return rem;
    } catch { return 0; }
  });
  useEffect(() => {
    if (!bloq || count <= 0) return;
    const t = setInterval(() => setCount(c => {
      if (c <= 1) {
        clearInterval(t);
        setBloq(false);
        return 0;
      }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [bloq, count]);
  const handle = async () => {
    if (bloq) return;
    setLoading(true);
    setErro("");
    const u = await checkLogin(login.trim(), senha);
    setLoading(false);
    if (u) {
      try { sessionStorage.removeItem("cgel_login_tent"); sessionStorage.removeItem("cgel_login_bloq"); sessionStorage.removeItem("cgel_login_exp"); } catch {}
      onLogin({
        ...u,
        login: login.trim()
      });
    } else {
      const nt = tent + 1;
      setTent(nt);
      try { sessionStorage.setItem("cgel_login_tent", String(nt)); } catch {}
      if (nt >= 5) {
        const exp = Date.now() + 300000;
        setBloq(true);
        setCount(300);
        try { sessionStorage.setItem("cgel_login_bloq", "1"); sessionStorage.setItem("cgel_login_exp", String(exp)); } catch {}
        setErro("Muitas tentativas. Aguarde 5 minutos.");
      } else setErro(`Credenciais inválidas. Tentativa ${nt}/5.`);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#006000"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: "#003d00",
      borderRadius: 20,
      padding: "40px 36px",
      boxShadow: "0 32px 80px rgba(0,0,0,.5)",
      border: "2px solid " + MUN.gold
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(Brasao, {
    size: 72,
    style: {
      margin: "0 auto 14px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: MUN.gold,
      letterSpacing: ".03em"
    }
  }, "PREFEITURA DE GOV. EDISON LOB\xC3O"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#4a6494",
      marginTop: 4
    }
  }, "Controladoria Geral \u2014 Sistema de Pagamentos")), erro && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#450a0a",
      border: "1px solid #dc2626",
      borderRadius: 8,
      padding: "10px 14px",
      marginBottom: 16,
      fontSize: 12,
      color: "#fca5a5",
      fontWeight: 600
    }
  }, "\u26A0\uFE0F ", erro), /*#__PURE__*/React.createElement("label", {
    style: LS(true)
  }, "Login"), /*#__PURE__*/React.createElement("input", {
    value: login,
    onChange: e => setLogin(e.target.value),
    onKeyDown: e => e.key === "Enter" && handle(),
    placeholder: "admin",
    autoFocus: true,
    style: {
      ...IS(true),
      background: "rgba(0,0,0,.3)",
      border: "1.5px solid rgba(239,209,3,.5)"
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(true)
  }, "Senha"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: senha,
    onChange: e => setSenha(e.target.value),
    onKeyDown: e => e.key === "Enter" && handle(),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      ...IS(true),
      background: "#0d1421",
      border: "1.5px solid #1e2d40"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handle,
    disabled: loading || bloq,
    style: {
      ...BS("primary", loading || bloq, true),
      width: "100%",
      justifyContent: "center",
      height: 46,
      fontSize: 14,
      marginTop: 4
    }
  }, bloq ? `Aguarde ${Math.floor(count / 60)}m${count % 60}s…` : loading ? "Verificando…" : "→ Entrar")));
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  page,
  setPage,
  user,
  onLogout,
  onSync,
  proxNum,
  dark,
  onToggleDark,
  formPct,
  sbOnline,
  pendentesAtrasados = 0,
  onExportExcel
}) {
  const isAdmin = user?.perfil === "admin";
  const isOnline = sbOnline ?? _sbLive;
  const nav = [{
    k: "processos",
    icon: "📄",
    label: "Novo Processo"
  }, {
    k: "buscar",
    icon: "🔍",
    label: "Buscar & Editar"
  }, {
    k: "dashboard",
    icon: "📊",
    label: "Dashboard"
  }, {
    k: "historico",
    icon: "🕐",
    label: "Histórico"
  }];
  // [G-R3] Badge de pendentes atrasados
  const adm = [{
    k: "usuarios",
    icon: "👥",
    label: "Usuários"
  }, {
    k: "orgaos",
    icon: "🏛️",
    label: "Órgãos"
  }, {
    k: "config",
    icon: "⚙️",
    label: "Configurações"
  }];
  const NavItem = ({
    k,
    icon,
    label
  }) => {
    const active = page === k;
    return /*#__PURE__*/React.createElement("div", {
      onClick: () => setPage(k),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        marginBottom: 3,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all .15s",
        background: active ? MUN.green : "transparent",
        border: active ? "1px solid " + MUN.green : "1px solid transparent"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        width: 20,
        textAlign: "center"
      }
    }, icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        color: active ? "#ffffff" : "rgba(255,255,255,.65)"
      }
    }, label, k === "historico" && pendentesAtrasados > 0 && /*#__PURE__*/React.createElement("span", {
        style: { background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700,
                 borderRadius: 99, padding: "1px 5px", marginLeft: 4 }
      }, pendentesAtrasados)));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "#0040E0",
      height: "100vh",
      position: "sticky",
      top: 0,
      borderRight: "1px solid rgba(0,0,0,.15)",
      overflowY: "auto",
      overflowX: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 16px 14px",
      borderBottom: "2px solid " + MUN.gold,
      textAlign: "center",
      background: "#002da0"
    }
  }, /*#__PURE__*/React.createElement(Brasao, {
    size: 52,
    style: {
      margin: "0 auto 10px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: MUN.gold,
      lineHeight: 1.4
    }
  }, "CONTROLADORIA", /*#__PURE__*/React.createElement("br", null), "GERAL"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: MUN.goldDk,
      marginTop: 3
    }
  }, "Pref. Gov. Edison Lob\xE3o / MA")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "10px 10px 0",
      padding: "8px 12px",
      background: "rgba(239,209,3,.08)",
      borderRadius: 10,
      border: "1px solid rgba(239,209,3,.25)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: "#e2e8f0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, user?.nome), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: MUN.goldDk,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      fontWeight: 600,
      marginTop: 2
    }
  }, user?.perfil)), page === "processos" && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "8px 10px 0",
      padding: "8px 12px",
      background: "rgba(255,255,255,.05)",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,.08)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: "rgba(255,255,255,.45)",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, "Preenchimento"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      color: formPct === 100 ? "#4ade80" : formPct > 60 ? "#fbbf24" : "#93c5fd"
    }
  }, formPct, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      background: "rgba(255,255,255,.1)",
      borderRadius: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${formPct}%`,
      borderRadius: 4,
      transition: "width .4s",
      background: formPct === 100 ? "#22c55e" : formPct > 60 ? "#f59e0b" : "#3b82f6"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "8px 10px 0",
      padding: "8px 12px",
      background: MUN.green,
      borderRadius: 10,
      border: "1.5px solid rgba(255,255,255,.3)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9.5,
      color: "rgba(255,255,255,.85)",
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "Pr\xF3ximo N\xBA"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: "#ffffff"
    }
  }, proxNum || "—")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 8px",
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 8.5,
      fontWeight: 700,
      color: "rgba(255,255,255,.25)",
      textTransform: "uppercase",
      letterSpacing: ".1em",
      padding: "4px 8px 6px"
    }
  }, "Principal"), nav.map(n => /*#__PURE__*/React.createElement(NavItem, {
    key: n.k,
    k: n.k,
    icon: n.icon,
    label: n.label
  })), isAdmin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "rgba(255,255,255,.08)",
      margin: "10px 4px 8px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 8.5,
      fontWeight: 700,
      color: "rgba(255,255,255,.25)",
      textTransform: "uppercase",
      letterSpacing: ".1em",
      padding: "4px 8px 6px"
    }
  }, "Admin"), adm.map(n => /*#__PURE__*/React.createElement(NavItem, {
    key: n.k,
    k: n.k,
    icon: n.icon,
    label: n.label
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 10px 12px",
      borderTop: "2px solid " + MUN.gold,
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, proxNum > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: onExportExcel,
    style: {
      background: MUN.green,
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "7px 10px",
      cursor: "pointer",
      fontSize: 11.5,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      gap: 6,
      width: "100%",
      justifyContent: "center",
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\uD83D\uDCBE"
  }), "Salvar Planilha Excel"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onSync,
    style: {
      height: 34,
      background: "rgba(239,209,3,.15)",
      border: "1px solid rgba(239,209,3,.4)",
      borderRadius: 8,
      color: MUN.gold,
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4
    }
  }, "\uD83D\uDD04 Sync"), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    style: {
      height: 34,
      background: "rgba(220,38,38,.2)",
      border: "1px solid rgba(220,38,38,.3)",
      borderRadius: 8,
      color: "#fca5a5",
      fontSize: 11,
      fontWeight: 600,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4
    }
  }, "\u23CF Sair")), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleDark,
    style: {
      height: 32,
      background: "rgba(239,209,3,.1)",
      border: "1px solid rgba(239,209,3,.25)",
      borderRadius: 8,
      color: MUN.gold,
      fontSize: 11,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      fontWeight: 600
    }
  }, dark ? "☀️ Modo Claro" : "🌙 Modo Escuro"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 8,
      color: "rgba(255,255,255,.15)",
      textAlign: "center",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 5
    }
  }, "v3.3 \xB7 2026", /*#__PURE__*/React.createElement("span", {
    title: isOnline ? "Supabase conectado" : "Supabase offline — dados locais",
    style: { fontSize: 10, cursor: "default", display: "flex", alignItems: "center", gap: 3 }
  }, isOnline ? "\u2601\uFE0F" : "\uD83D\uDD34", /*#__PURE__*/React.createElement("span", { style: { fontSize: 8, fontWeight: 700, color: isOnline ? "#4ade80" : "#f87171" } }, isOnline ? "Online" : "Offline")))));
}

// ─── NovoProcessoPage ─────────────────────────────────────────────────────────
function NovoProcessoPage({
  processos,
  orgaosConfig,
  onSave,
  onSaveEdit,
  toast,
  dark,
  onPctChange,
  duplicarData,
  onDuplicarConsumed,
  editarData,
  onEditarConsumed,
  onPdfDownload,
  onShowShortcuts,
  appConfig,
  nextProcessoNumber,
  user,
  onEditModeChange
}) {
  const mp = useMemo(() => buildMapData(processos), [processos]);
  const orgAtivos = useMemo(() => mp.allOrgaos.filter(o => orgaosConfig[o]?.ativo !== false), [mp, orgaosConfig]);
  const blankForm = useCallback(() => ({
    numDoc: String(nextProcessoNumber || proxNumero(processos)),
    dataDoc: todayISO(),
    periodo: "",
    orgao: "",
    secretario: "",
    fornecedor: "",
    cnpj: "",
    nomeFan: "",
    modalidade: "",
    contrato: "",
    ordemCompra: "",
    tipDoc: "",
    numNf: "",
    tipNf: "",
    valor: "",
    dataNf: todayISO(),
    objeto: "",
    dataAteste: todayISO(),
    decisao: "deferir",
    status: "analise",
    obs: "",
    notas: "",
    tipo: "padrao"
  }), [processos, nextProcessoNumber]);
  const formFromRow = useCallback(row => ({
    numDoc: String(nextProcessoNumber || proxNumero(processos)),
    dataDoc: todayISO(),
    periodo: row["PERÍODO DE REFERÊNCIA"] || row["PERIODO DE REFERENCIA"] || row["PERIODO"] || "",
    orgao: row["ORGÃO"] || row["ORGAO"] || "",
    secretario: row["SECRETARIO"] || row["SECRETÁRIO"] || "",
    fornecedor: row["FORNECEDOR"] || row["EMPRESA"] || row["CREDOR"] || "",
    cnpj: row["CNPJ"] || row["CNPJ/CPF"] || row["CPF/CNPJ"] || row["CPF"] || "",
    nomeFan: row["NOME FANTASIA"] || row["FANTASIA"] || "",
    modalidade: row["MODALIDADE"] || "",
    contrato: row["CONTRATO"] || row["NUMERO CONTRATO"] || "",
    ordemCompra: row["N° ORDEM DE COMPRA"] || row["ORDEM DE COMPRA"] || row["OC"] || "",
    tipDoc: row["DOCUMENTO FISCAL"] || row["DOC FISCAL"] || "",
    numNf: row["Nº"] || row["N°"] || row["NF"] || row["NF/FATURA"] || "",
    tipNf: row["TIPO"] || row["TIPO NF"] || "",
    valor: "",
    dataNf: todayISO(),
    objeto: row["OBJETO"] || row["DESCRICAO"] || row["DESCRIÇÃO"] || "",
    dataAteste: todayISO(),
    decisao: "deferir",
    status: "analise",
    obs: "",
    notas: "",
    tipo: "padrao"
  }), [processos, nextProcessoNumber]);
  const [form, setForm] = useState(blankForm);
  const [chks, setChks] = useState({});
  const [tab, setTab] = useState(0);
  const [editMode, setEditMode] = useState(null);
  const [modMode, setModMode] = useState("forn");
  const [contMode, setContMode] = useState("forn");
  const [objMode, setObjMode] = useState("historico");
  const [loading, setLoading] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [compact, setCompact] = useState(false);
  const [draftSaved, setDraftSaved] = useState(null);
  const [cnpjErro, setCnpjErro] = useState("");
  const [autoFillMsg, setAutoFillMsg] = useState(""); // [J-F3] auto-fill chip
  // [FIX9] Estado do ConfirmModal — substitui window.confirm
  const [confirmModal, setConfirmModal] = useState(null); // {msg,titulo,tipo,onOk}
  // [M2] Notifica o App quando entra/sai do modo edição → pausa polling
  useEffect(() => {
    if (onEditModeChange) onEditModeChange(!!editMode);
  }, [editMode]);
  const upd = f => v => setForm(p => ({
    ...p,
    [f]: v
  }));
  useEffect(() => {
    if (!duplicarData) return;
    setForm(formFromRow(duplicarData));
    setChks({});
    setPdfBlob(null);
    setTab(0);
    setEditMode(null);
    if (onDuplicarConsumed) onDuplicarConsumed();
  }, [duplicarData]);
  useEffect(() => {
    if (!editarData) return;
    const row = editarData;
    setForm({
      numDoc: row["NÚMERO DO DOCUMENTO"] || row["NUMERO DO DOCUMENTO"] || "",
      dataDoc: toISO(row["DATA"]) || todayISO(),
      periodo: row["PERÍODO DE REFERÊNCIA"] || row["PERIODO DE REFERENCIA"] || row["PERIODO"] || "",
      orgao: row["ORGÃO"] || row["ORGAO"] || "",
      secretario: row["SECRETARIO"] || row["SECRETÁRIO"] || "",
      fornecedor: row["FORNECEDOR"] || row["EMPRESA"] || row["CREDOR"] || "",
      cnpj: row["CNPJ"] || row["CNPJ/CPF"] || row["CPF/CNPJ"] || row["CPF"] || "",
      nomeFan: row["NOME FANTASIA"] || row["FANTASIA"] || "",
      modalidade: row["MODALIDADE"] || "",
      contrato: row["CONTRATO"] || row["NUMERO CONTRATO"] || "",
      ordemCompra: row["N° ORDEM DE COMPRA"] || row["ORDEM DE COMPRA"] || row["OC"] || "",
      tipDoc: row["DOCUMENTO FISCAL"] || row["DOC FISCAL"] || "",
      numNf: row["Nº"] || row["N°"] || row["NF"] || row["NF/FATURA"] || row["FATURA"] || "",
      tipNf: row["TIPO"] || row["TIPO NF"] || "",
      valor: row["VALOR"] || row["VALOR TOTAL"] || "",
      dataNf: toISO(row["DATA NF"]) || toISO(row["DATA DA NF"]) || todayISO(),
      objeto: row["OBJETO"] || row["DESCRICAO"] || row["DESCRIÇÃO"] || "",
      dataAteste: toISO(row["DATA"]) || todayISO(),
      decisao: row["_decisao"] || "deferir",
      obs: row["_obs"] || row["OBSERVACAO"] || row["OBSERVAÇÃO"] || "",
      notas: row["NOTAS"] || row["NOTA INTERNA"] || "",
      tipo: row["_tipoKey"] || "padrao"
    });
    // [FIX Bug D] Restaurar estado do checklist a partir de _sits salvo
    {
      const sits = row["_sits"];
      const tipoKey = row["_tipoKey"] || "padrao";
      const chkLen = (CHK[tipoKey] || []).length;
      if (Array.isArray(sits) && sits.length === chkLen && chkLen > 0) {
        setChks({ [tipoKey]: sits });
      } else {
        setChks({});
      }
    }
    setPdfBlob(null);
    setTab(0);
    setEditMode(row["NÚMERO DO DOCUMENTO"] || null);
    if (onEditarConsumed) onEditarConsumed();
  }, [editarData]);
  useEffect(() => {
    const t = setInterval(async () => {
      if (editMode) return;
      if (form.orgao || form.fornecedor || form.objeto) {
        await ST.set("draft_form", form);
        const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const cloudOk = await ST.set("draft_form", form).then(r=>r.cloud).catch(()=>false);
        setDraftSaved({ hora, cloud: cloudOk });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [form, editMode]);
  useEffect(() => {
    if (editarData) return;
    ST.get("draft_form").then(d => {
      if (d && d.orgao !== undefined && (d.orgao || d.fornecedor)) setForm(p => ({ ...p, ...d }));
    });
  }, []);
  const pct = useMemo(() => {
    const req = ["numDoc", "orgao", "fornecedor", "cnpj", "valor", "objeto"];
    return Math.round(req.filter(k => form[k]).length / req.length * 100);
  }, [form]);
  useEffect(() => onPctChange(pct), [pct, onPctChange]);
  const handleSalvarRef = useRef(null);
  const handleGerarPDFRef = useRef(null);
  const handleLimparRef = useRef(null);
  const handleDuplicarUltimoRef = useRef(null);
  useEffect(() => {
    const h = e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s" || e.key === "S") { e.preventDefault(); handleSalvarRef.current?.(); }
        if (e.key === "p" || e.key === "P") { e.preventDefault(); handleGerarPDFRef.current?.(); }
        if (e.key === "l" || e.key === "L") { e.preventDefault(); handleLimparRef.current?.(); }
        if (e.key === "d" || e.key === "D") { e.preventDefault(); handleDuplicarUltimoRef.current?.(); }
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onShowShortcuts && onShowShortcuts();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const onOrgChange = v => setForm(f => ({
    ...f,
    orgao: v,
    secretario: f.secretario || mp.orgaoSecretario[v] || "",
    contrato: f.contrato || mp.orgaoContrato[v] || "",
    modalidade: f.modalidade || mp.orgaoModalidade[v] || ""
  }));
  const onFornChange = v => {
    const hasDados = mp.fornCnpj[v] || mp.fornObjeto[v] || mp.fornContrato[v];
    setForm(f => ({
      ...f,
      fornecedor: v,
      cnpj: f.cnpj || mp.fornCnpj[v] || "",
      objeto: f.objeto || mp.fornObjeto[v] || "",
      modalidade: f.modalidade || mp.fornModalidade[v] || "",
      contrato: f.contrato || mp.fornContrato[v] || "",
      tipDoc: f.tipDoc || mp.fornTipDoc[v] || "",
      tipNf: f.tipNf || mp.fornTipNf[v] || "",
      periodo: f.periodo || mp.fornPeriodo[v] || ""
    }));
    if (hasDados) {
      setAutoFillMsg(v ? `Dados do histórico aplicados para "${v.slice(0,30)}"` : "");
      setTimeout(() => setAutoFillMsg(""), 4000);
    }
  };
  const onCnpjChange = v => {
    const m = mascararCnpjCpf(v);
    setForm(f => ({
      ...f,
      cnpj: m,
      fornecedor: f.fornecedor || mp.cnpjForn[v] || ""
    }));
    const valido = validarCnpjCpf(m);
    setCnpjErro(valido ? "" : "CNPJ/CPF inválido — verifique os dígitos");
    // [M-AU1] Consulta BrasilAPI ao completar CNPJ com 14 dígitos válidos
    const digits = m.replace(/\D/g, "");
    if (digits.length === 14 && valido) {
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          setForm(f => ({
            ...f,
            fornecedor: f.fornecedor || d.razao_social || "",
            nomeFan: f.nomeFan || d.nome_fantasia || "",
            _cnpjStatus: d.descricao_situacao_cadastral || ""
          }));
          if (d.razao_social) toast("🏢 " + d.razao_social.slice(0,40) + " — dados preenchidos pela Receita", "info");
        })
        .catch(() => {});
    }
  };
  const onObjChange = v => setForm(f => ({
    ...f,
    objeto: v,
    modalidade: f.modalidade || mp.objModalidade[v] || "",
    contrato: f.contrato || mp.objContrato[v] || ""
  }));
  const onModalChange = v => setForm(f => ({
    ...f,
    modalidade: v,
    contrato: f.contrato || mp.modalContrato[v] || ""
  }));
  const getChks = t => {
    const n = CHK[t]?.length || 0;
    const c = chks[t];
    return c && c.length === n ? c : Array(n).fill(true);
  };
  const setChk = (t, i, v) => {
    const arr = [...getChks(t)];
    arr[i] = v;
    setChks(p => ({
      ...p,
      [t]: arr
    }));
  };
  const mFF = form.fornecedor ? mp.fornModalidadesList[form.fornecedor] || [] : [];
  const mShow = modMode === "forn" && mFF.length ? mFF : mp.allModalidades;
  const mFiltered = modMode === "forn" && Boolean(mFF.length);
  const cFF = form.fornecedor ? mp.fornContratosList[form.fornecedor] || [] : [];
  const cShow = contMode === "forn" && cFF.length ? cFF : mp.allContratos;
  const cFiltered = contMode === "forn" && Boolean(cFF.length);
  const oFF = form.fornecedor ? mp.fornObjetosList[form.fornecedor] || [] : [];
  const oShow = objMode === "historico" && oFF.length ? oFF : mp.allObjsHist;
  const secSug = form.orgao && !form.secretario ? mp.orgaoSecretario[form.orgao] : "";
  const secsOpts = mp.allSecretarios;
  // Usa numeroDuplicado() do sistema de auditoria: verifica duplicata respeitando edição
  const checarDuplicata = num => numeroDuplicado(num, processos, editMode);
  const makeDados = () => {
    // Auto-completar campos vazios com dados do histórico — SOMENTE em modo criação.
    // Em modo edição (editMode), usa apenas o valor do formulário para garantir que
    // alterações feitas pelo usuário sejam refletidas exatamente no PDF gerado.
    const forn = form.fornecedor;
    const org = form.orgao;
    const useMap = !editMode; // false em edição: sem fallback histórico
    const cnpj      = form.cnpj      || (useMap ? mp.fornCnpj[forn] || "" : "");
    const contrato  = form.contrato  || (useMap ? mp.fornContrato[forn] || mp.orgaoContrato[org] || "" : "");
    const modalidade= form.modalidade|| (useMap ? mp.fornModalidade[forn] || mp.orgaoModalidade[org] || "" : "");
    const secretario= form.secretario|| (useMap ? mp.orgaoSecretario[org] || "" : "");
    const objeto    = form.objeto    || (useMap ? mp.fornObjeto[forn] || "" : "");
    const tipDoc    = form.tipDoc    || (useMap ? mp.fornTipDoc[forn] || "" : "");
    const periodo   = form.periodo   || (useMap ? mp.fornPeriodo[forn] || "" : "");
    const tipNf     = form.tipNf     || (useMap ? mp.fornTipNf[forn] || "" : "");
    return {
      processo:    form.numDoc,
      orgao:       org,
      secretario:  secretario,
      fornecedor:  forn,
      cnpj:        cnpj,
      nf:          form.numNf,
      contrato:    contrato,
      modalidade:  modalidade,
      periodo_ref: periodo,
      ordem_compra: form.ordemCompra,
      data_nf:     formatData(form.dataNf),
      data_ateste: dtExt(formatData(form.dataAteste)),
      objeto:      objeto,
      valor:       form.valor,
      tipo_doc:    tipDoc,
      tipo_nf:     tipNf,
      obs:         form.obs,
      controlador: appConfig?.controlador || {}
    };
  };
  const handleGerarPDF = async () => {    if (loading) return;
    if (!form.orgao && !form.fornecedor) {
      toast("⚠️ Preencha pelo menos Órgão ou Fornecedor antes de gerar o PDF.", "warn");
      return;
    }
    setLoading(true);
    try {
      const t = form.tipo,
        s = getChks(t);
      const r = await gerarPDF(makeDados(), t, form.decisao === "deferir", CHK[t], s);
      if (r.error) {
        toast(`❌ PDF: ${r.error}`, "error");
        return;
      }
      setPdfBlob(r.blob);
      setPdfName(r.name || "documento.pdf");
      if (onPdfDownload) onPdfDownload(r.blob, r.name);else {
        const url = URL.createObjectURL(r.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = r.name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
        toast("✅ PDF gerado!");
      }
    } catch (err) {
      toast("❌ Erro ao gerar PDF: " + err.message, "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const handleSalvar = async () => {
    if (!form.orgao || !form.fornecedor || !form.valor) {
      toast("Preencha Órgão, Fornecedor e Valor.", "error");
      return;
    }
    if (cnpjErro) {
      toast("Corrija o CNPJ/CPF antes de salvar.", "error");
      return;
    }
    if (checarDuplicata(form.numDoc) && !editMode) {
      // [FIX9] Usa ConfirmModal em vez de window.confirm
      setConfirmModal({
        titulo: "Número duplicado",
        msg: `⚠️ Número ${form.numDoc} já está em uso!\n\nClique em Confirmar para usar automaticamente o Nº ${nextProcessoNumber} (próximo disponível).\nClique em Cancelar para corrigir manualmente.`,
        tipo: "warn",
        onOk: () => {
          setConfirmModal(null);
          upd("numDoc")(String(nextProcessoNumber));
          setForm(f => ({ ...f, numDoc: String(nextProcessoNumber) }));
          toast(`🔢 Número corrigido automaticamente para ${nextProcessoNumber}`, "info");
        }
      });
      return;
    }
    setLoading(true);
    try {
      const row = {
        "NÚMERO DO DOCUMENTO": form.numDoc,
        "DATA": fmtD(form.dataDoc),
        "PERÍODO DE REFERÊNCIA": form.periodo,
        "ORGÃO": form.orgao,
        "SECRETARIO": form.secretario,
        "FORNECEDOR": form.fornecedor,
        "CNPJ": form.cnpj,
        "NOME FANTASIA": form.nomeFan,
        "MODALIDADE": form.modalidade,
        "CONTRATO": form.contrato,
        "N° ORDEM DE COMPRA": form.ordemCompra,
        "DOCUMENTO FISCAL": form.tipDoc,
        "Nº": form.numNf,
        "TIPO": form.tipNf,
        "VALOR": form.valor,
        "DATA NF": fmtD(form.dataNf),
        "OBJETO": form.objeto,
        "NOTAS": form.notas,
        "_sits": getChks(form.tipo),
        "_tipoKey": form.tipo,
        "_status": form.status || "analise"
      };
      if (editMode) {
        await onSaveEdit(row, form, editMode, user);
        setEditMode(null);
      } else {
        await onSave(row, form, user);
      }
      await ST.del("draft_form");
      setDraftSaved(null);
      setForm(blankForm());
      setChks({});
      setPdfBlob(null);
      setTab(0);
    } finally {
      setLoading(false);
    }
  };
  const handleDL = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfName || "documento.pdf";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
    toast("✅ PDF baixado!");
  };
  const handleImprimir = () => {
    if (!pdfBlob) {
      toast("Gere o PDF primeiro.", "warn");
      return;
    }
    const url = URL.createObjectURL(pdfBlob);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    iframe.src = url;
    const cleanup = () => {
      try { document.body.removeChild(iframe); } catch {}
      URL.revokeObjectURL(url);
    };
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.open(url, "_blank");
      }
      setTimeout(cleanup, 60000);
    };
    iframe.onerror = () => { cleanup(); toast("Erro ao abrir PDF para impressão.", "warn"); };
  };
  const handleLimpar = () => {
    // [FIX9] Usa ConfirmModal em vez de window.confirm
    const temDados = form.orgao || form.fornecedor || form.valor || form.objeto || form.cnpj;
    const msg = temDados
      ? "Existem dados preenchidos no formulário.\n\nTem certeza que deseja limpar tudo? Esta ação não pode ser desfeita."
      : "Limpar todos os campos do formulário?";
    setConfirmModal({
      titulo: "Limpar formulário",
      msg,
      tipo: temDados ? "danger" : "warn",
      onOk: () => {
        setConfirmModal(null);
        setForm(blankForm());
        setChks({});
        setPdfBlob(null);
        ST.del("draft_form");
        setDraftSaved(null);
        setEditMode(null);
        toast("🗑️ Formulário limpo.");
      }
    });
  };
  const ultimoProcesso = processos[processos.length - 1] || null;
  const handleDuplicarUltimo = () => {
    if (!ultimoProcesso) {
      toast("Nenhum processo salvo.", "warn");
      return;
    }
    setForm(formFromRow(ultimoProcesso));
    setChks({});
    setPdfBlob(null);
    setTab(0);
    toast(`📋 Duplicado: ${ultimoProcesso["NÚMERO DO DOCUMENTO"]}`);
  };
  // [Bug 4 FIX] Atualiza refs dos atalhos a cada render — sem stale closures
  handleSalvarRef.current = handleSalvar;
  handleGerarPDFRef.current = handleGerarPDF;
  handleLimparRef.current = handleLimpar;
  handleDuplicarUltimoRef.current = handleDuplicarUltimo;
  const ti = TINFO[form.tipo];
  const chkItems = CHK[form.tipo] || [];
  const sits = getChks(form.tipo);
  const pctChk = chkItems.length ? Math.round(sits.filter(Boolean).length / chkItems.length * 100) : 100;
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg;
  const bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const iStyle = IS(dark);
  const tabSt = i => ({
    padding: "9px 16px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    borderBottom: `2px solid ${tab === i ? "#3b6ef8" : "transparent"}`,
    color: tab === i ? "#3b6ef8" : "#9ca3af",
    transition: "color .15s"
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, editMode && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "#854d0e",
      borderBottom: "2px solid #eab308",
      padding: "8px 22px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 13,
      fontWeight: 700,
      color: "#fef08a"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u26A0\uFE0F"), "Voc\xEA est\xE1 editando o Processo #" + editMode + " \u2014 salve para confirmar.", /*#__PURE__*/React.createElement("button", {
    onClick: () => { setEditMode(null); setForm(blankForm()); setChks({}); setPdfBlob(null); },
    style: {
      marginLeft: "auto",
      background: "rgba(0,0,0,.25)",
      border: "1px solid rgba(255,255,255,.3)",
      borderRadius: 6,
      color: "#fef08a",
      fontSize: 11,
      fontWeight: 700,
      padding: "3px 10px",
      cursor: "pointer"
    }
  }, "\u2715 Cancelar")), /*#__PURE__*/React.createElement(PageHeader, {
    icon: ti?.icon || "📄",
    title: editMode ? `✏️ Editando Processo #${editMode}` : "Novo Processo",
    sub: editMode ? "Alterações substituirão o registro original" : "Preencha os dados e gere os documentos",
    dark: dark,
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, editMode && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setEditMode(null);
        setForm(blankForm());
        setChks({});
        setPdfBlob(null);
      },
      style: {
        ...BS("ghost", false, dark),
        height: 34,
        fontSize: 11
      }
    }, "\u2715 Cancelar Edi\xE7\xE3o"), /*#__PURE__*/React.createElement("button", {
      onClick: handleDuplicarUltimo,
      disabled: !ultimoProcesso,
      style: {
        ...BS("secondary", !ultimoProcesso, dark),
        height: 34,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement(BtnIco, {
      emoji: "\u29C9"
    }), "Duplicar \xDAltimo"), /*#__PURE__*/React.createElement("button", {
      onClick: () => onShowShortcuts && onShowShortcuts(),
      style: {
        ...BS("ghost", false, dark),
        height: 34,
        fontSize: 11
      }
    }, "\u2328\uFE0F Atalhos"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 22px"
    }
  }, autoFillMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5, fontWeight: 600, marginBottom: 8, padding: "7px 12px",
      background: dark ? "#003d00" : "#f0fdf4",
      border: "1px solid #16a34a33", borderRadius: 8, color: "#16a34a",
      display: "flex", alignItems: "center", gap: 6
    }
  }, "\u2728 ", autoFillMsg),
  draftSaved && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5, marginBottom: 10,
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      background: draftSaved.cloud ? (dark?"#052e16":"#f0fdf4") : (dark?"#1c1400":"#fefce8"),
      borderRadius: 20, border: "1px solid " + (draftSaved.cloud?"#16a34a33":"#ca8a0433"),
      width: "fit-content"
    }
  },
  /*#__PURE__*/React.createElement("span", {style:{fontSize:10}}, draftSaved.cloud ? "\u2601\uFE0F" : "\uD83D\uDCBE"),
  /*#__PURE__*/React.createElement("span", {style:{color: draftSaved.cloud?"#16a34a":"#d97706", fontWeight:600}},
    draftSaved.cloud ? "Salvo na nuvem " : "Salvo localmente ",
    draftSaved.hora || ""
  )), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(KPICard, {
    label: "Processos",
    value: processos.length.toLocaleString(),
    gradient: T.kpi2,
    icon: "\uD83D\uDCC4"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "\xD3rg\xE3os",
    value: mp.allOrgaos.length,
    gradient: T.kpi1,
    icon: "\uD83C\uDFDB\uFE0F"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Credores",
    value: mp.allFornecedores.length,
    gradient: T.kpi5,
    icon: "\uD83C\uDFE2"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Pr\xF3ximo N\xBA",
    value: nextProcessoNumber || proxNumero(processos),
    gradient: T.kpi4,
    icon: "\uD83D\uDD22"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5,1fr)",
      gap: 8,
      marginBottom: 16
    }
  }, Object.entries(TINFO).map(([tk, ti2]) => {
    const act = form.tipo === tk;
    return /*#__PURE__*/React.createElement("div", {
      key: tk,
      onClick: () => setForm(f => ({
        ...f,
        tipo: tk
      })),
      style: {
        border: `1.5px solid ${act ? ti2.cor : bdr}`,
        background: act ? ti2.cor + "12" : cardBg,
        borderRadius: 10,
        padding: "8px 6px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all .15s",
        position: "relative",
        overflow: "hidden",
        minWidth: 0
      }
    }, act && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: ti2.cor
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 18,
        marginBottom: 3
      }
    }, ti2.icon), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: act ? 700 : 500,
        color: act ? ti2.cor : dark ? "#4a6494" : "#64748b",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, ti2.label));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1px solid ${bdr}`,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: `1px solid ${bdr}`,
      padding: "0 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex"
    }
  }, ["🏢 Dados", "📜 Contrato", "✅ Ateste"].map((t, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    style: tabSt(i),
    onClick: () => setTab(i)
  }, t))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCompact(c => !c),
    style: {
      ...BS("ghost", false, dark),
      height: 30,
      fontSize: 11,
      padding: "0 10px"
    }
  }, compact ? "↕ Normal" : "↔ Compacto")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: compact ? "12px 16px" : "20px 24px"
    }
  }, tab === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDD22",
    title: "Identifica\xE7\xE3o",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "N\xBA Documento *"), /*#__PURE__*/React.createElement("input", {
    value: form.numDoc,
    onChange: e => upd("numDoc")(e.target.value),
    style: {
      ...iStyle,
      borderColor: checarDuplicata(form.numDoc) && !editMode
        ? "#dc2626"
        : form.numDoc && !checarDuplicata(form.numDoc) && !editMode
          ? "#16a34a"
          : iStyle.borderColor
    }
  }), checarDuplicata(form.numDoc) && !editMode
    ? /*#__PURE__*/React.createElement("div", {
        style: { fontSize: 10.5, color: "#dc2626", marginTop: -10, marginBottom: 8,
                 display: "flex", alignItems: "center", justifyContent: "space-between" }
      },
        /*#__PURE__*/React.createElement("span", null, "\u26A0\uFE0F N\xFAmero ", form.numDoc, " j\xE1 em uso!"),
        /*#__PURE__*/React.createElement("button", {
          onClick: () => { upd("numDoc")(String(nextProcessoNumber)); setForm(f => ({...f, numDoc: String(nextProcessoNumber)})); },
          style: { fontSize: 10, background: "#16a34a", color: "#fff", border: "none",
                   borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontWeight: 700 }
        }, "\uD83D\uDD22 Usar Nº ", nextProcessoNumber)
      )
    : form.numDoc && !editMode
      ? /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 10.5, color: "#16a34a", marginTop: -10, marginBottom: 8 }
        }, "\u2705 N\xFAmero dispon\xEDvel")
      : null), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Data *"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dataDoc,
    onChange: e => upd("dataDoc")(e.target.value),
    style: iStyle
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Per\xEDodo Ref."), /*#__PURE__*/React.createElement(PeriodoInput, {
    value: form.periodo,
    onChange: upd("periodo"),
    dark: dark,
    style: {
      ...iStyle,
      marginBottom: 0
    }
  }))), /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83C\uDFDB\uFE0F",
    title: "\xD3rg\xE3o e Secretaria",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SearchSelect, {
    label: "\xD3rg\xE3o / Secretaria",
    required: true,
    value: form.orgao,
    options: orgAtivos,
    onChange: onOrgChange,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", null, secSug && /*#__PURE__*/React.createElement("div", {
    onClick: () => setForm(f => ({
      ...f,
      secretario: secSug
    })),
    style: {
      fontSize: 9.5,
      color: "#3b6ef8",
      fontWeight: 600,
      marginBottom: 4,
      cursor: "pointer"
    }
  }, "\uD83D\uDCA1 Sugest\xE3o (clique para usar): ", /*#__PURE__*/React.createElement("b", null, secSug.slice(0, 45))), /*#__PURE__*/React.createElement(SearchSelect, {
    label: "Secret\xE1rio(a)",
    value: form.secretario,
    options: secsOpts,
    onChange: v => setForm(f => ({
      ...f,
      secretario: v
    })),
    dark: dark
  }))), /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83C\uDFE2",
    title: "Credor / Fornecedor",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "2fr 1.5fr 1fr",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(SearchSelect, {
    label: "Credor *",
    required: true,
    value: form.fornecedor,
    options: mp.allFornecedores,
    onChange: onFornChange,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "CNPJ / CPF *"), /*#__PURE__*/React.createElement("input", {
    value: form.cnpj,
    onChange: e => onCnpjChange(e.target.value),
    placeholder: "00.000.000/0001-00",
    style: iStyle
  }), cnpjErro && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "#dc2626",
      marginTop: -10,
      marginBottom: 8
    }
  }, "\u26A0\uFE0F ", cnpjErro)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Nome Fantasia"), /*#__PURE__*/React.createElement("input", {
    value: form.nomeFan,
    onChange: e => upd("nomeFan")(e.target.value),
    placeholder: "Opcional",
    style: iStyle
  })))), tab === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDCDC",
    title: "Licita\xE7\xE3o",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(FilterBadge, {
    count: mShow.length,
    fonte: form.fornecedor,
    isFiltered: mFiltered
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Modalidade"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(SearchSelect, {
    value: form.modalidade,
    options: mShow,
    onChange: onModalChange,
    dark: dark,
    label: ""
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setModMode(m => m === "forn" ? "todos" : "forn"),
    title: modMode === "forn" ? "Ver todas" : "Filtrar por fornecedor",
    style: {
      width: 36,
      height: 36,
      flexShrink: 0,
      background: dark ? "#0f1c2e" : "#f1f5f9",
      border: `1.5px solid ${bdr}`,
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 15,
      alignSelf: "flex-start",
      marginTop: 1
    }
  }, modMode === "forn" ? "📂" : "🏢"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(FilterBadge, {
    count: cShow.length,
    fonte: form.fornecedor,
    isFiltered: cFiltered
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "N\xBA Contrato"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(SearchSelect, {
    value: form.contrato,
    options: cShow,
    onChange: v => setForm(f => ({
      ...f,
      contrato: v
    })),
    dark: dark,
    label: ""
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setContMode(m => m === "forn" ? "todos" : "forn"),
    title: contMode === "forn" ? "Ver todas" : "Filtrar por fornecedor",
    style: {
      width: 36,
      height: 36,
      flexShrink: 0,
      background: dark ? "#0f1c2e" : "#f1f5f9",
      border: `1.5px solid ${bdr}`,
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 15,
      alignSelf: "flex-start",
      marginTop: 1
    }
  }, contMode === "forn" ? "📂" : "🏢"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 19
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "N\xB0 Ordem de Compra"), /*#__PURE__*/React.createElement("input", {
    value: form.ordemCompra,
    onChange: e => upd("ordemCompra")(e.target.value),
    placeholder: "Preencher manualmente",
    style: {
      ...iStyle,
      marginBottom: 0
    }
  }))), /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83E\uDDFE",
    title: "Documento Fiscal",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(SearchSelect, {
    label: "Tipo Doc. Fiscal",
    value: form.tipDoc,
    options: mp.allDocFiscais.filter(v => !["BANCO DO BRASIL", "BANCO INTER", "BOLETO BANCÁRIO", "BRADESCO", "CAIXA ECONÔMICA FEDERAL", "MERCADO PAGO"].includes(v)),
    onChange: v => setForm(f => ({
      ...f,
      tipDoc: v
    })),
    dark: dark
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "N\xBA NF"), /*#__PURE__*/React.createElement("input", {
    value: form.numNf,
    onChange: e => upd("numNf")(e.target.value),
    placeholder: "229",
    style: iStyle
  })), /*#__PURE__*/React.createElement(SearchSelect, {
    label: "Tipo NF",
    value: form.tipNf,
    options: mp.allTiposNf,
    onChange: v => setForm(f => ({
      ...f,
      tipNf: v
    })),
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Valor (R$) *"), /*#__PURE__*/React.createElement("input", {
    value: form.valor,
    onChange: e => upd("valor")(e.target.value),
    onBlur: e => upd("valor")(formatValor(e.target.value)),
    placeholder: "43.088,62",
    style: iStyle
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Data NF"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dataNf,
    onChange: e => upd("dataNf")(e.target.value),
    style: iStyle
  })))), tab === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDCDD",
    title: "Objeto",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(FilterBadge, {
    count: oShow.length,
    fonte: form.fornecedor,
    isFiltered: objMode === "historico" && Boolean(oFF.length)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(SearchSelect, {
    label: "Objeto *",
    value: form.objeto,
    options: oShow,
    onChange: onObjChange,
    dark: dark
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setObjMode(m => m === "historico" ? "todos" : "historico"),
    style: {
      width: 38,
      height: 38,
      flexShrink: 0,
      background: dark ? "#0f1c2e" : "#f1f5f9",
      border: `1.5px solid ${bdr}`,
      borderRadius: 8,
      cursor: "pointer",
      fontSize: 16,
      marginBottom: 14
    }
  }, objMode === "historico" ? "📂" : "🏢"))), /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDCC5",
    title: "Ateste e Decis\xE3o",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Data Ateste"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dataAteste,
    onChange: e => upd("dataAteste")(e.target.value),
    style: iStyle
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Decis\xE3o"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      height: 38,
      alignItems: "center"
    }
  }, [["deferir", "✅ Deferir", "#16a34a"], ["indeferir", "❌ Indeferir", "#dc2626"]].map(([v, l, c]) => /*#__PURE__*/React.createElement("label", {
    key: v,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      cursor: "pointer",
      fontWeight: form.decisao === v ? 700 : 400,
      color: form.decisao === v ? c : tc,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    value: v,
    checked: form.decisao === v,
    onChange: () => setForm(f => ({
      ...f,
      decisao: v
    }))
  }), l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", { style: { marginBottom: 14 } },
  /*#__PURE__*/React.createElement("label", { style: LS(dark) }, "Status de Tramita\xE7\xE3o"),
  /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
    Object.entries(STATUS_MAP).map(([k, s]) =>
      /*#__PURE__*/React.createElement("button", {
        key: k,
        onClick: () => setForm(f => ({ ...f, status: k })),
        style: {
          padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${form.status === k ? s.cor : bdr}`,
          background: form.status === k ? s.cor + "20" : cardBg,
          color: form.status === k ? s.cor : tc,
          fontWeight: form.status === k ? 700 : 400,
          fontSize: 12, cursor: "pointer", transition: "all .15s"
        }
      }, s.emoji + " " + s.label)
    )
  )
),
/*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Observa\xE7\xE3o (aparece no PDF)"), /*#__PURE__*/React.createElement("textarea", {
    value: form.obs,
    onChange: e => upd("obs")(e.target.value),
    rows: 3,
    style: {
      ...iStyle,
      height: "auto",
      resize: "vertical"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "\uD83D\uDCCC Notas Internas"), /*#__PURE__*/React.createElement("textarea", {
    value: form.notas,
    onChange: e => upd("notas")(e.target.value),
    placeholder: "N\xE3o aparecem no PDF",
    rows: 3,
    style: {
      ...iStyle,
      height: "auto",
      resize: "vertical",
      borderColor: dark ? "#3b4f6b" : "#fde68a",
      background: dark ? "#3d3100" : "#fffbeb"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: dark ? "#003800" : "#f8faff",
      borderRadius: 12,
      padding: "14px 16px",
      border: `1px solid ${bdr}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      marginBottom: 10,
      color: tc
    }
  }, "\u2611 Checklist \u2014 ", ti.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 4
    }
  }, chkItems.map((item, i) => /*#__PURE__*/React.createElement("label", {
    key: `${form.tipo}-${i}`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      fontSize: 12.5,
      marginBottom: 4,
      color: tc
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: sits[i],
    onChange: e => setChk(form.tipo, i, e.target.checked),
    style: {
      width: 14,
      height: 14,
      flexShrink: 0,
      accentColor: "#3b6ef8"
    }
  }), item))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      background: dark ? "#1e2d40" : "#e2e8f0",
      borderRadius: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${pctChk}%`,
      borderRadius: 4,
      transition: "width .3s",
      background: pctChk === 100 ? "#16a34a" : "#f59e0b"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: "#64748b",
      marginTop: 3
    }
  }, sits.filter(Boolean).length, "/", chkItems.length, " itens verificados")))))), form.fornecedor && !form.cnpj && mp.fornCnpj[form.fornecedor] && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#f59e0b",
      fontWeight: 600,
      marginBottom: 8,
      padding: "6px 10px",
      background: "rgba(245,158,11,.1)",
      borderRadius: 7,
      border: "1px solid rgba(245,158,11,.3)"
    }
  }, "\uD83D\uDCA1 Dados dispon\xEDveis no hist\xF3rico para \"", form.fornecedor, "\". Clique em ", /*#__PURE__*/React.createElement("b", null, "Gerar PDF"), " para aplicar automaticamente."), form.fornecedor && !form.cnpj && !mp.fornCnpj[form.fornecedor] && processos.length < 5 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#f87171",
      fontWeight: 600,
      marginBottom: 8,
      padding: "6px 10px",
      background: "rgba(248,113,113,.1)",
      borderRadius: 7,
      border: "1px solid rgba(248,113,113,.3)"
    }
  }, "\u26A0\uFE0F Importe a planilha Excel em ", /*#__PURE__*/React.createElement("b", null, "Configura\xE7\xF5es"), " para habilitar o auto-preenchimento de CNPJ, Contrato, Modalidade etc."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleGerarPDF,
    disabled: loading,
    style: {
      ...BS("primary", loading, dark),
      flex: "1 1 130px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: loading ? "⏳" : "📄"
  }), loading ? "Gerando..." : "Gerar PDF"), /*#__PURE__*/React.createElement("button", {
    onClick: handleSalvar,
    disabled: loading,
    style: {
      ...BS("success", loading, dark),
      flex: "1 1 130px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: loading ? "⏳" : "💾"
  }), loading ? "Salvando..." : editMode ? "Salvar Edição" : "Salvar"), /*#__PURE__*/React.createElement("button", {
    onClick: handleDL,
    disabled: !pdfBlob,
    style: {
      ...BS(pdfBlob ? "secondary" : "ghost", !pdfBlob, dark),
      flex: "1 1 100px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\u2B07\uFE0F"
  }), "Baixar PDF"), /*#__PURE__*/React.createElement("button", {
    onClick: handleImprimir,
    disabled: !pdfBlob,
    style: {
      ...BS(pdfBlob ? "secondary" : "ghost", !pdfBlob, dark),
      flex: "1 1 100px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\uD83D\uDDA8\uFE0F"
  }), "Imprimir"), /*#__PURE__*/React.createElement("button", {
    onClick: handleLimpar,
    style: {
      ...BS("ghost", false, dark),
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\uD83D\uDDD1\uFE0F"
  }), "Limpar")))); 
}

// ─── BuscarPage ───────────────────────────────────────────────────────────────
function BuscarPage({
  processos,
  onCarregar,
  onEditar,
  onGerarPDF,
  toast,
  dark,
  user
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({
    col: "NÚMERO DO DOCUMENTO",
    dir: -1 // do último para o primeiro por padrão
  });
  // [FIX5] Filtros avançados
  const [filtTipo, setFiltTipo] = useState("");
  const [filtDec, setFiltDec] = useState("");
  const [filtAno, setFiltAno] = useState("");
  const [lPDF, setLPDF] = useState(null);
  const dq = useDebounce(q, 300);
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  // Anos disponíveis para filtro
  const anosDisp = useMemo(() => {
    const s = new Set();
    processos.forEach(p => { const m = String(p["DATA"] || "").match(/\d{4}/); if (m) s.add(m[0]); });
    return [...s].sort().reverse();
  }, [processos]);
  const filtered = useMemo(() => {
    let r = processos;
    if (dq.trim()) {
      const ql = dq.toLowerCase();
      r = r.filter(p => ["NÚMERO DO DOCUMENTO", "FORNECEDOR", "ORGÃO", "OBJETO", "CONTRATO", "VALOR", "DATA", "CNPJ"].some(c => String(p[c] || "").toLowerCase().includes(ql)));
    }
    if (filtTipo) r = r.filter(p => (p["_tipoKey"] || "padrao") === filtTipo);
    if (filtDec) {
      if (filtDec === "PENDENTE") r = r.filter(p => !p["_decisao"]);
      else if (filtDec === "deferir") r = r.filter(p => p["_decisao"] === "deferir");
      else r = r.filter(p => p["_decisao"] === "indeferir");
    }
    if (filtAno) r = r.filter(p => String(p["DATA"] || "").includes(filtAno));
    return [...r].sort((a, b) => {
      const va = a[sort.col] ?? "";
      const vb = b[sort.col] ?? "";
      // Ordenação numérica para NÚMERO DO DOCUMENTO
      if (sort.col === "NÚMERO DO DOCUMENTO") {
        const na = parseInt(String(va).trim(), 10);
        const nb = parseInt(String(vb).trim(), 10);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * sort.dir;
      }
      return String(va).localeCompare(String(vb), "pt-BR") * sort.dir;
    });
  }, [processos, dq, sort, filtTipo, filtDec, filtAno]);
  const limitado = filtered.length > 100;
  const exibidos = filtered.slice(0, 100);
  const cols = ["NÚMERO DO DOCUMENTO", "ORGÃO", "FORNECEDOR", "CNPJ", "VALOR", "DATA", "OBJETO", "_usuario"];
  const colLabel = c => c === "NÚMERO DO DOCUMENTO" ? "Nº DOC" : c === "_usuario" ? "Usuário" : c === "CNPJ" ? "CNPJ/CPF" : c;
  const toggleSort = col => setSort(s => s.col === col ? {
    col,
    dir: s.dir * -1
  } : {
    col,
    dir: col === "NÚMERO DO DOCUMENTO" ? -1 : 1 // Nº sempre começa decrescente
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    icon: "\uD83D\uDD0D",
    title: "Buscar & Editar",
    sub: "Pesquise, edite e gere PDFs",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "\uD83D\uDD0E  N\xBA, fornecedor, CNPJ, \xF3rg\xE3o, objeto, valor...",
    style: {
      ...IS(dark),
      marginBottom: 10,
      fontSize: 14,
      padding: "10px 14px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }
  },
    /*#__PURE__*/React.createElement("select", {
      value: filtTipo, onChange: e => setFiltTipo(e.target.value),
      style: { ...IS(dark), width: "auto", minWidth: 140, padding: "7px 10px", marginBottom: 0, fontSize: 12 }
    },
      /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os tipos"),
      Object.entries(TINFO).map(([k, v]) => /*#__PURE__*/React.createElement("option", { key: k, value: k }, v.label))
    ),
    /*#__PURE__*/React.createElement("select", {
      value: filtDec, onChange: e => setFiltDec(e.target.value),
      style: { ...IS(dark), width: "auto", minWidth: 140, padding: "7px 10px", marginBottom: 0, fontSize: 12 }
    },
      /*#__PURE__*/React.createElement("option", { value: "" }, "Todas as decisões"),
      /*#__PURE__*/React.createElement("option", { value: "deferir" }, "✅ Deferido"),
      /*#__PURE__*/React.createElement("option", { value: "indeferir" }, "❌ Indeferido"),
      /*#__PURE__*/React.createElement("option", { value: "PENDENTE" }, "⏳ Pendente")
    ),
    /*#__PURE__*/React.createElement("select", {
      value: filtAno, onChange: e => setFiltAno(e.target.value),
      style: { ...IS(dark), width: "auto", minWidth: 110, padding: "7px 10px", marginBottom: 0, fontSize: 12 }
    },
      /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os anos"),
      anosDisp.map(a => /*#__PURE__*/React.createElement("option", { key: a, value: a }, a))
    ),
    (filtTipo || filtDec || filtAno) && /*#__PURE__*/React.createElement("button", {
      onClick: () => { setFiltTipo(""); setFiltDec(""); setFiltAno(""); },
      style: { fontSize: 11, padding: "6px 12px", background: "#fee2e2",
        border: "1px solid #fecaca", borderRadius: 7, color: "#dc2626", cursor: "pointer", whiteSpace: "nowrap" }
    }, "✕ Limpar filtros"),
    /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#94a3b8", marginLeft: "auto" } },
      filtered.length, " resultado(s)")
  ), limitado && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#d97706",
      fontWeight: 600,
      marginBottom: 10,
      padding: "8px 12px",
      background: "#451a03",
      borderRadius: 8,
      border: "1px solid #92400e"
    }
  }, "\u26A0\uFE0F Exibindo 100 de ", filtered.length, " resultados. Refine a busca para ver mais."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 12,
      border: `1.5px solid ${bdr}`,
      overflow: "hidden",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      maxHeight: 520,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("thead", {
    style: {
      position: "sticky",
      top: 0,
      background: dark ? "#003d0a" : "#f2f7ee",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: `1.5px solid ${bdr}`
    }
  }, cols.map(c => /*#__PURE__*/React.createElement("th", {
    key: c,
    onClick: () => toggleSort(c),
    style: {
      padding: "10px 12px",
      textAlign: "left",
      fontWeight: 700,
      color: "#475569",
      whiteSpace: "nowrap",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      cursor: "pointer",
      userSelect: "none",
      background: sort.col === c ? dark ? "#2d1f4e" : "#f5f3ff" : "transparent"
    }
  }, colLabel(c), " ", sort.col === c ? sort.dir === 1 ? "↑" : "↓" : "")), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "10px 12px",
      width: 200,
      textAlign: "center",
      fontSize: 11,
      fontWeight: 700,
      color: "#475569",
      textTransform: "uppercase"
    }
  }, "A\xE7\xF5es"))), /*#__PURE__*/React.createElement("tbody", null, exibidos.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: cols.length + 1,
    style: {
      padding: "24px",
      textAlign: "center",
      color: "#94a3b8"
    }
  }, "Nenhum resultado")) : exibidos.map((p, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    style: {
      borderBottom: `1px solid ${bdr}`,
      background: i % 2 === 0 ? cardBg : dark ? "#131f2e" : "#fafbfc"
    },
    onMouseEnter: e => e.currentTarget.style.background = dark ? "#1e2d40" : "#eff6ff",
    onMouseLeave: e => e.currentTarget.style.background = i % 2 === 0 ? cardBg : dark ? "#131f2e" : "#fafbfc"
  }, cols.map(c => /*#__PURE__*/React.createElement("td", {
    key: c,
    style: {
      padding: "9px 12px",
      maxWidth: 160,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: tc
    }
  }, c === "DATA" || c === "DATA NF" ? fmtD(String(p[c] || "")) : c === "_usuario" ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: dark ? "#1e2d40" : "#f1f5f9",
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 11,
        fontWeight: 600,
        color: dark ? "#93c5fd" : "#1e40af"
      }
    }, "\uD83D\uDC64 ", String(p[c] || "—")) : String(p[c] || "").slice(0, 60))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "6px 10px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 5,
      justifyContent: "center"
    }
  }, onGerarPDF && /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      if (lPDF !== null) return;
      setLPDF(i);
      try {
        await onGerarPDF(p, {
          _dummy: true
        });
      } finally {
        setLPDF(null);
      }
    },
    disabled: lPDF !== null,
    style: {
      ...BS("danger", lPDF !== null, dark),
      height: 32,
      fontSize: 11,
      padding: "0 10px 0 5px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: lPDF === i ? "⏳" : "📄"
  }), lPDF === i ? "..." : "PDF"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onEditar && onEditar(p),
    style: {
      ...BS("orange", false, dark),
      height: 32,
      fontSize: 11,
      padding: "0 12px 0 5px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\u270F\uFE0F"
  }), "Editar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => onCarregar(p),
    style: {
      ...BS("secondary", false, dark),
      height: 32,
      fontSize: 11,
      padding: "0 10px 0 5px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\u29C9"
  })))))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#94a3b8"
    }
  }, "Exibindo ", exibidos.length, " de ", filtered.length, " \xB7 Total: ", processos.length)));
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
function DashboardPage({
  processos,
  historico,
  dark,
  appConfig,
  toast
}) {
  const [filtOrg, setFiltOrg] = useState("");
  const [filtAno, setFiltAno] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const mp = useMemo(() => buildMapData(processos), [processos]);
  const anos = useMemo(() => {
    const s = new Set();
    processos.forEach(p => {
      const d = String(p["DATA"] || "");
      const m = d.match(/\d{4}/);
      if (m) s.add(m[0]);
    });
    return [...s].sort().reverse();
  }, [processos]);
  const filtered = useMemo(() => processos.filter(p => {
    if (filtOrg && p["ORGÃO"] !== filtOrg) return false;
    if (filtAno && !String(p["DATA"] || "").includes(filtAno)) return false;
    return true;
  }), [processos, filtOrg, filtAno]);

  // Processos por mês (últimos 12)
  const porMes = useMemo(() => {
    const m = {};
    filtered.forEach(p => {
      const raw = String(p["DATA"] || "");
      // dd/mm/yyyy → yyyy-mm
      let chave = "";
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
        chave = raw.slice(6, 10) + "-" + raw.slice(3, 5);
      } else if (/^\d{4}-\d{2}/.test(raw)) {
        chave = raw.slice(0, 7);
      }
      if (chave && chave !== "NaT") m[chave] = (m[chave] || 0) + 1;
    });
    return Object.entries(m).sort(([a], [b]) => a < b ? -1 : 1).slice(-12).map(([mes, n]) => ({ mes, n }));
  }, [filtered]);

  // [FIX8] Total financeiro — soma campo VALOR de todos os processos filtrados
  const parseBRL = v => {
    if (!v) return 0;
    const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const totalGeral = useMemo(() =>
    filtered.reduce((acc, p) => acc + parseBRL(p["VALOR"]), 0),
  [filtered]);
  const fmtBRL = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Top 8 órgãos
  const topOrg = useMemo(() => {
    const m = {};
    const mv = {};
    filtered.forEach(p => {
      const o = String(p["ORGÃO"] || "").trim();
      if (o) {
        m[o] = (m[o] || 0) + 1;
        mv[o] = (mv[o] || 0) + parseBRL(p["VALOR"]);
      }
    });
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 8).map(([o, n]) => ({ orgao: o, n, valor: mv[o] || 0 }));
  }, [filtered]);

  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;


  // [G-R2] Comparativo: mês atual vs anterior
  const comparativo = useMemo(() => {
    const now = new Date();
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const ant = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const mesAnt = `${ant.getFullYear()}-${String(ant.getMonth()+1).padStart(2,"0")}`;
    const getChave = p => {
      const raw = String(p["DATA"] || "");
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.slice(6,10)+"-"+raw.slice(3,5);
      if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0,7);
      return "";
    };
    const cur = filtered.filter(p => getChave(p) === mesAtual);
    const prv = filtered.filter(p => getChave(p) === mesAnt);
    const parseBRLLocal = v => { const s=String(v||"").replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,""); const n=parseFloat(s); return isNaN(n)?0:n; };
    const curVal = cur.reduce((a,p)=>a+parseBRLLocal(p["VALOR"]),0);
    const prvVal = prv.reduce((a,p)=>a+parseBRLLocal(p["VALOR"]),0);
    const pctN = prv.length ? Math.round((cur.length-prv.length)/prv.length*100) : null;
    const pctV = prvVal ? Math.round((curVal-prvVal)/prvVal*100) : null;
    return { curN: cur.length, prvN: prv.length, curVal, prvVal, pctN, pctV, mesAtual, mesAnt };
  }, [filtered]);

  // ── Gráfico de linha SVG ─────────────────────────────────────────────────
  const LineChartSVG = ({ data }) => {
    if (!data.length) return null;
    const W = 600, H = 160, PL = 36, PR = 12, PT = 12, PB = 28;
    const cW = W - PL - PR, cH = H - PT - PB;
    const maxN = Math.max(...data.map(d => d.n), 1);
    const xs = data.map((_, i) => PL + (i / Math.max(data.length - 1, 1)) * cW);
    const ys = data.map(d => PT + cH - (d.n / maxN) * cH);
    const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
    const area = `M${PL},${PT + cH} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(" ") + ` L${xs[xs.length-1]},${PT+cH} Z`;
    return /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto" } },
      /*#__PURE__*/React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", minWidth: 300, height: H } },
        // grid lines
        [0.25, 0.5, 0.75, 1].map(f => {
          const y = PT + cH - f * cH;
          return /*#__PURE__*/React.createElement("line", { key: f, x1: PL, y1: y, x2: W - PR, y2: y,
            stroke: dark ? "#1e2d40" : "#e2e8f0", strokeWidth: 1, strokeDasharray: "3 3" });
        }),
        // Y labels
        [0, Math.round(maxN / 2), maxN].map((v, i) => {
          const y = PT + cH - (v / maxN) * cH;
          return /*#__PURE__*/React.createElement("text", { key: i, x: PL - 6, y: y + 4,
            textAnchor: "end", fontSize: 9, fill: "#94a3b8" }, v);
        }),
        // area fill
        /*#__PURE__*/React.createElement("path", { d: area, fill: "#3b6ef820" }),
        // line
        /*#__PURE__*/React.createElement("polyline", { points: polyline, fill: "none", stroke: "#3b6ef8", strokeWidth: 2.5, strokeLinejoin: "round" }),
        // dots + X labels
        data.map((d, i) => /*#__PURE__*/React.createElement(React.Fragment, { key: i },
          /*#__PURE__*/React.createElement("circle", {
            cx: xs[i], cy: ys[i], r: 5,
            fill: "#3b6ef8", stroke: dark ? "#1e3528" : "#fff", strokeWidth: 2,
            style: { cursor: "pointer" },
            onMouseEnter: e => setTooltip({ x: xs[i], y: ys[i], label: d.mes, val: d.n }),
            onMouseLeave: () => setTooltip(null)
          }),
          /*#__PURE__*/React.createElement("text", { x: xs[i], y: H - 4, textAnchor: "middle", fontSize: 9, fill: "#94a3b8" },
            d.mes.slice(5) + "/" + d.mes.slice(2, 4))
        )),
        // tooltip
        tooltip && /*#__PURE__*/React.createElement(React.Fragment, null,
          /*#__PURE__*/React.createElement("rect", { x: tooltip.x - 28, y: tooltip.y - 28, width: 56, height: 22, rx: 5,
            fill: dark ? "#1e3528" : "#0f172a" }),
          /*#__PURE__*/React.createElement("text", { x: tooltip.x, y: tooltip.y - 13, textAnchor: "middle", fontSize: 10,
            fill: "#fff", fontWeight: 700 }, tooltip.val + " proc.")
        )
      )
    );
  };

  // ── Gráfico de barras CSS ─────────────────────────────────────────────────

  // [J-V1] Gráfico de pizza SVG — distribuição por tipo de processo
  const porTipo = useMemo(() => {
    const m = {};
    filtered.forEach(p => {
      const k = p["_tipoKey"] || "padrao";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).map(([k, n]) => ({
      key: k, label: TINFO[k]?.label || k,
      cor: TINFO[k]?.cor || "#888", n,
      pct: filtered.length ? (n / filtered.length) * 100 : 0
    })).sort((a,b) => b.n - a.n);
  }, [filtered]);

  const PieChartSVG = ({ data }) => {
    if (!data.length) return null;
    const R = 70, CX = 90, CY = 90;
    let start = -Math.PI / 2;
    const slices = data.map(d => {
      const angle = (d.pct / 100) * 2 * Math.PI;
      const x1 = CX + R * Math.cos(start);
      const y1 = CY + R * Math.sin(start);
      const x2 = CX + R * Math.cos(start + angle);
      const y2 = CY + R * Math.sin(start + angle);
      const large = angle > Math.PI ? 1 : 0;
      const path = `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`;
      const mid = start + angle / 2;
      const lx = CX + (R * 0.65) * Math.cos(mid);
      const ly = CY + (R * 0.65) * Math.sin(mid);
      start += angle;
      return { ...d, path, lx, ly };
    });
    return /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" } },
      /*#__PURE__*/React.createElement("svg", { viewBox: "0 0 180 180", style: { width: 180, height: 180, flexShrink: 0 } },
        slices.map((s,i) => /*#__PURE__*/React.createElement(React.Fragment, { key: s.key },
          /*#__PURE__*/React.createElement("path", { d: s.path, fill: s.cor, stroke: dark ? "#1a2820" : "#fff", strokeWidth: 2 }),
          s.pct > 8 && /*#__PURE__*/React.createElement("text", {
            x: s.lx, y: s.ly, textAnchor: "middle", dominantBaseline: "central",
            fontSize: 10, fontWeight: 700, fill: "#fff"
          }, Math.round(s.pct) + "%")
        ))
      ),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        data.map(d => /*#__PURE__*/React.createElement("div", { key: d.key, style: { display: "flex", alignItems: "center", gap: 8 } },
          /*#__PURE__*/React.createElement("div", { style: { width: 12, height: 12, borderRadius: 3, background: d.cor, flexShrink: 0 } }),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 12, color: tc } }, d.label),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#94a3b8", marginLeft: 4 } }, d.n)
        ))
      )
    );
  };

  const BarChartCSS = ({ data }) => {
    if (!data.length) return null;
    const maxN = Math.max(...data.map(d => d.n), 1);
    const cores = ["#3b6ef8","#16a34a","#7c3aed","#d97706","#0891b2","#dc2626","#059669","#be185d"];
    return /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      data.map((d, i) => /*#__PURE__*/React.createElement("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8 } },
        /*#__PURE__*/React.createElement("div", {
          style: { width: 145, fontSize: 11, color: tc, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, textAlign: "right" }
        }, d.orgao),
        /*#__PURE__*/React.createElement("div", { style: { flex: 1, background: dark ? "#1e2d40" : "#f1f5f9", borderRadius: 4, height: 22, overflow: "hidden" } },
          /*#__PURE__*/React.createElement("div", {
            style: {
              width: `${(d.n / maxN) * 100}%`, minWidth: 28, height: "100%",
              background: cores[i % cores.length], borderRadius: 4,
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              paddingRight: 6, fontSize: 10, fontWeight: 700, color: "#fff",
              transition: "width .4s ease"
            }
          }, d.n)
        ),
        /*#__PURE__*/React.createElement("div", {
          style: { fontSize: 10, color: dark ? "#4ade80" : "#059669", fontWeight: 700,
            whiteSpace: "nowrap", minWidth: 80, textAlign: "right", flexShrink: 0 }
        }, d.valor > 0 ? fmtBRL(d.valor) : "")
      ))
    );
  };

  return /*#__PURE__*/React.createElement("div", {
    style: { flex: 1, overflowY: "auto", background: bg }
  },
    /*#__PURE__*/React.createElement(PageHeader, {
      icon: "\uD83D\uDCCA",
      title: "Dashboard",
      sub: _sbReady ? "\u2601\uFE0F Sincronizado \u2014 atualiza a cada 20s" : "Vis\xE3o anal\xEDtica",
      cor: "#4d7cfe",
      dark: dark
    }),
    /*#__PURE__*/React.createElement("div", { style: { padding: "20px 24px" } },
      // ── Filtros ──
      /*#__PURE__*/React.createElement("div", {
        style: { background: cardBg, borderRadius: 12, border: `1.5px solid ${bdr}`,
          padding: "14px 20px", marginBottom: 20, display: "flex", gap: 16,
          alignItems: "center", flexWrap: "wrap" }
      },
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: "#64748b" } }, "\uD83D\uDD0D Filtrar:"),
        /*#__PURE__*/React.createElement("select", {
          value: filtOrg, onChange: e => setFiltOrg(e.target.value),
          style: { ...IS(dark), width: "auto", minWidth: 180, padding: "6px 10px", marginBottom: 0 }
        },
          /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os \xF3rg\xE3os"),
          mp.allOrgaos.map(o => /*#__PURE__*/React.createElement("option", { key: o, value: o }, o.slice(0, 50)))
        ),
        /*#__PURE__*/React.createElement("select", {
          value: filtAno, onChange: e => setFiltAno(e.target.value),
          style: { ...IS(dark), width: "auto", minWidth: 100, padding: "6px 10px", marginBottom: 0 }
        },
          /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os anos"),
          anos.map(a => /*#__PURE__*/React.createElement("option", { key: a, value: a }, a))
        ),
        (filtOrg || filtAno) && /*#__PURE__*/React.createElement("button", {
          onClick: () => { setFiltOrg(""); setFiltAno(""); },
          style: { fontSize: 12, padding: "6px 12px", background: "#fee2e2",
            border: "1px solid #fecaca", borderRadius: 7, color: "#dc2626", cursor: "pointer" }
        }, "\u2715 Limpar"),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: "#94a3b8", marginLeft: "auto" } },
          filtered.length, " processo(s)")
      ),
      // ── KPIs ──
      /*#__PURE__*/React.createElement("div", {
        style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 24 }
      },
        /*#__PURE__*/React.createElement(KPICard, { label: "Processos", value: filtered.length.toLocaleString(), gradient: T.kpi2, icon: "\uD83D\uDCCA" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "\xD3rg\xE3os",      value: mp.allOrgaos.length,           gradient: T.kpi1, icon: "\uD83C\uDFDB\uFE0F" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "Fornecedores", value: mp.allFornecedores.length,       gradient: T.kpi5, icon: "\uD83C\uDFE2" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "Hist\xF3rico",  value: (historico || []).length.toLocaleString(), gradient: T.kpi4, icon: "\uD83D\uDD50" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "Total R$", value: totalGeral > 0 ? fmtBRL(totalGeral) : "—", gradient: "linear-gradient(135deg,#059669,#047857)", icon: "\uD83D\uDCB0" })
      ),
      // ── [M-AU3/G-R1] Botão relatório mensal ──
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", justifyContent: "flex-end", marginBottom: 16 }
      },
        /*#__PURE__*/React.createElement("button", {
          onClick: async () => {
            const now = new Date();
            const mStr = String(now.getMonth()+1).padStart(2,"0");
            const mesAno = `${mStr}/${now.getFullYear()}`;
            toast("⏳ Gerando relatório...", "info");
            const r = await gerarRelatorioPDF(filtered.length ? filtered : processos, mesAno, appConfig || {});
            if (r.error) { toast("❌ " + r.error, "error"); return; }
            const url = URL.createObjectURL(r.blob);
            const a = document.createElement("a"); a.href = url; a.download = r.name;
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
            toast("✅ Relatório mensal gerado!");
          },
          style: { ...BS("success", false, dark), height: 36, fontSize: 12 }
        }, /*#__PURE__*/React.createElement(BtnIco, { emoji: "\uD83D\uDCC4" }), "Relatório do M\xEAs (PDF)")
      ),
      // ── [G-R2] Comparativo mês atual vs anterior ──
      (comparativo.curN > 0 || comparativo.prvN > 0) && /*#__PURE__*/React.createElement("div", {
        style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`,
                 padding: "16px 20px", marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap" }
      },
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#64748b", width: "100%", marginBottom: 8 } },
          "\uD83D\uDCC6 Comparativo: mês atual vs anterior"),
        ...[
          { lbl: "Processos", cur: comparativo.curN, prv: comparativo.prvN, pct: comparativo.pctN, fmt: v => v.toString() },
          { lbl: "Total R$", cur: comparativo.curVal, prv: comparativo.prvVal, pct: comparativo.pctV,
            fmt: v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
        ].map(({ lbl, cur, prv, pct, fmt }) => /*#__PURE__*/React.createElement("div", {
          key: lbl, style: { flex: "1 1 160px", minWidth: 140 }
        },
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, color: "#94a3b8", marginBottom: 4 } }, lbl),
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 18, fontWeight: 700, color: dark ? "#e2e8f0" : "#0f172a" } }, fmt(cur)),
          /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 } },
            pct !== null && /*#__PURE__*/React.createElement("span", {
              style: { color: pct >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }
            }, pct >= 0 ? "▲" : "▼", " ", Math.abs(pct), "%"),
            /*#__PURE__*/React.createElement("span", { style: { color: "#94a3b8" } }, "vs ", fmt(prv))
          )
        ))
      ),
      // ── Linha: processos por mês ──
      porMes.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`,
          padding: "20px 24px", marginBottom: 20 }
      },
        /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 14, marginBottom: 14, color: dark ? "#e2e8f0" : "#0f172a" } },
          "Processos por M\xEAs"),
        /*#__PURE__*/React.createElement(LineChartSVG, { data: porMes })
      ),
      // ── Barras: top órgãos ──
      topOrg.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px", marginBottom: 20 }
      },
        /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 14, marginBottom: 16, color: dark ? "#e2e8f0" : "#0f172a" } },
          "Top \xD3rg\xE3os"),
        /*#__PURE__*/React.createElement(BarChartCSS, { data: topOrg })
      ),
      // ── [J-V1] Pizza: distribuição por tipo ──
      porTipo.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px" }
      },
        /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 14, marginBottom: 16, color: dark ? "#e2e8f0" : "#0f172a" } },
          "Distribui\xE7\xE3o por Tipo de Processo"),
        /*#__PURE__*/React.createElement(PieChartSVG, { data: porTipo })
      )
    )
  );
}

// ─── HistoricoPage ────────────────────────────────────────────────────────────
function HistoricoPage({
  historico,
  dark,
  onDuplicar,
  onGerarPDF,
  onEditar,
  truncado
}) {
  const [q, setQ] = useState("");
  const [filtDec, setFiltDec] = useState("");
  // [FIX2] Paginação real — 50 por página
  const [pagAtual, setPagAtual] = useState(0);
  const PER_PAGE = 50;
  const [lPDF, setLPDF] = useState(null);
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const filtered = useMemo(() => {
    let r = historico;
    if (q.trim()) {
      const ql = q.toLowerCase();
      r = r.filter(h => ["Processo", "Órgão", "Fornecedor", "Tipo", "Valor", "CNPJ"].some(c => String(h[c] || "").toLowerCase().includes(ql)));
    }
    if (filtDec) {
      if (filtDec === "PENDENTE") {
        r = r.filter(h => !String(h["Decisão"] || ""));
      } else {
        r = r.filter(h => String(h["Decisão"] || "").includes(filtDec));
      }
    }
    return r;
  }, [historico, q, filtDec]);
  // Reset página ao filtrar
  useEffect(() => { setPagAtual(0); }, [q, filtDec]);
  const totalPags = Math.ceil(filtered.length / PER_PAGE);
  const exibidos = useMemo(() => filtered.slice(pagAtual * PER_PAGE, (pagAtual + 1) * PER_PAGE), [filtered, pagAtual]);
  const def = useMemo(() => historico.filter(h => {
    const d = String(h["Decisão"] || "");
    return d.includes("DEFERIDO") && !d.includes("INDE");
  }).length, [historico]);
  const indef = useMemo(() => historico.filter(h =>
    String(h["Decisão"] || "").includes("INDE")
  ).length, [historico]);
  const handlePDF = async (h, idx) => {
    if (lPDF !== null) return;
    setLPDF(idx);
    try {
      await onGerarPDF(h, {
        _dummy: true
      });
    } finally {
      setLPDF(null);
    }
    ;
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    icon: "\uD83D\uDD50",
    title: "Hist\xF3rico",
    sub: _sbReady ? "\u2601\uFE0F Sincronizado \u2014 atualiza a cada 20s" : "Documentos processados",
    cor: "#7c3aed",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px"
    }
  }, truncado && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#fbbf24",
      fontWeight: 600,
      marginBottom: 12,
      padding: "8px 14px",
      background: "#451a03",
      borderRadius: 8,
      border: "1px solid #92400e"
    }
  }, "\u26A0\uFE0F Exibindo os 1000 registros mais recentes. Exporte o Excel para ver o hist\xF3rico completo."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(KPICard, {
    label: "Total",
    value: historico.length,
    gradient: T.kpi1,
    icon: "\uD83D\uDD50"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Deferidos",
    value: def,
    gradient: T.kpi5,
    icon: "\u2705"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Indeferidos",
    value: indef,
    gradient: T.kpi3,
    icon: "\u274C"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Pendentes",
    value: historico.length - def - indef,
    gradient: T.kpi4,
    icon: "\u23F3"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "\uD83D\uDD0E  Processo, fornecedor...",
    style: {
      ...IS(dark),
      flex: 1,
      fontSize: 13,
      padding: "8px 12px",
      marginBottom: 0
    }
  }), /*#__PURE__*/React.createElement("select", {
    value: filtDec,
    onChange: e => setFiltDec(e.target.value),
    style: {
      ...IS(dark),
      width: "auto",
      minWidth: 130,
      padding: "8px 10px",
      fontSize: 12,
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), /*#__PURE__*/React.createElement("option", {
    value: "DEFERIDO"
  }, "\u2705 Deferido"), /*#__PURE__*/React.createElement("option", {
    value: "INDEFERIDO"
  }, "\u274C Indeferido"), /*#__PURE__*/React.createElement("option", {
    value: "PENDENTE"
  }, "\u23F3 Pendente"))), filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "60px 24px",
      color: dark ? "#2e4a6e" : "#94a3b8",
      fontSize: 13
    }
  }, "Nenhum registro encontrado.") : /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 12,
      border: `1.5px solid ${bdr}`,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto",
      maxHeight: 560,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 12.5
    }
  }, /*#__PURE__*/React.createElement("thead", {
    style: {
      position: "sticky",
      top: 0,
      background: dark ? "#030c03" : "#f2f7ee",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: `1.5px solid ${bdr}`
    }
  }, ["Processo", "Data", "Órgão", "Fornecedor", "Valor", "Tipo", "Usuário", "Registrado em", "Decisão"].map(c => /*#__PURE__*/React.createElement("th", {
    key: c,
    style: {
      padding: "10px 12px",
      textAlign: "left",
      fontWeight: 700,
      color: "#475569",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: ".06em",
      whiteSpace: "nowrap"
    }
  }, c)), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: "10px 12px",
      textAlign: "center",
      fontSize: 11,
      fontWeight: 700,
      color: "#475569",
      textTransform: "uppercase"
    }
  }, "A\xE7\xF5es"))), /*#__PURE__*/React.createElement("tbody", null, exibidos.map((h, i) => {
    const dec = String(h["Decisão"] || "");
    const isDef = dec.includes("DEFERIDO") && !dec.includes("INDE");
    const isIndef = dec.includes("INDE");
    const isPend = !isDef && !isIndef;
    return /*#__PURE__*/React.createElement("tr", {
      key: i,
      style: {
        borderBottom: `1px solid ${bdr}`,
        background: i % 2 === 0 ? cardBg : dark ? "#131f2e" : "#fafbfc"
      },
      onMouseEnter: e => e.currentTarget.style.background = dark ? "#1e2d40" : "#f0f9ff",
      onMouseLeave: e => e.currentTarget.style.background = i % 2 === 0 ? cardBg : dark ? "#131f2e" : "#fafbfc"
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        fontWeight: 700
      }
    }, h["Processo"] || ""), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        whiteSpace: "nowrap"
      }
    }, h["Data"] || ""), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        maxWidth: 120,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, String(h["Órgão"] || "").slice(0, 30)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        maxWidth: 140,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, String(h["Fornecedor"] || "").slice(0, 35)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        whiteSpace: "nowrap"
      }
    }, h["Valor"] || ""), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc
      }
    }, h["Tipo"] || ""), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        whiteSpace: "nowrap",
        fontSize: 11.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: dark ? "#1e2d40" : "#f1f5f9",
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 11,
        fontWeight: 600,
        color: dark ? "#93c5fd" : "#1e40af"
      }
    }, "\uD83D\uDC64 ", h["_usuario"] || "—")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px",
        color: tc,
        whiteSpace: "nowrap",
        fontSize: 11,
        fontFamily: "monospace"
      }
    }, h["_registradoEm"] ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: dark ? "#0f1a0f" : "#f0fdf4",
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 11,
        color: dark ? "#4ade80" : "#166534",
        fontWeight: 600
      }
    }, "\uD83D\uDD52 ", h["_registradoEm"]) : /*#__PURE__*/React.createElement("span", {
      style: { color: "#94a3b8", fontSize: 11 }
    }, "—")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "8px 12px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 5,
        background: isDef ? "#0d2318" : isIndef ? "#450a0a" : "#1c1400",
        color: isDef ? "#86efac" : isIndef ? "#fca5a5" : "#fde68a",
        border: `1px solid ${isDef ? "#16a34a" : isIndef ? "#dc2626" : "#ca8a04"}`
      }
    }, isDef ? "✅ DEFERIDO" : isIndef ? "❌ INDEFERIDO" : "⏳ PENDENTE")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 5,
        justifyContent: "center",
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => handlePDF(h, i),
      disabled: lPDF !== null,
      style: {
        ...BS("danger", lPDF !== null, dark),
        height: 30,
        fontSize: 11,
        padding: "0 8px 0 4px"
      }
    }, /*#__PURE__*/React.createElement(BtnIco, {
      emoji: lPDF === i ? "⏳" : "📄"
    }), lPDF === i ? "..." : "PDF"), /*#__PURE__*/React.createElement("button", {
      onClick: () => onEditar && onEditar(h),
      style: {
        ...BS("orange", false, dark),
        height: 30,
        fontSize: 11,
        padding: "0 8px 0 4px"
      }
    }, /*#__PURE__*/React.createElement(BtnIco, {
      emoji: "\u270F\uFE0F"
    }), "Editar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => onDuplicar && onDuplicar(h),
      style: {
        ...BS("secondary", false, dark),
        height: 30,
        fontSize: 11,
        padding: "0 8px 0 4px"
      }
    }, /*#__PURE__*/React.createElement(BtnIco, {
      emoji: "\u29C9"
    }), "Dup."))));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 10, flexWrap: "wrap", gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 11, color: "#94a3b8" }
  }, "Exibindo ", exibidos.length, " de ", filtered.length, " filtrado(s) \xB7 Total no banco: ", historico.length),
  totalPags > 1 && /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", alignItems: "center", gap: 6 }
  },
  /*#__PURE__*/React.createElement("button", {
    onClick: () => setPagAtual(p => Math.max(0, p - 1)),
    disabled: pagAtual === 0,
    style: { ...BS("secondary", pagAtual === 0, dark), height: 30, padding: "0 12px", fontSize: 12 }
  }, "← Anterior"),
  /*#__PURE__*/React.createElement("span", {
    style: { fontSize: 12, color: dark ? "#94a3b8" : "#64748b", minWidth: 80, textAlign: "center" }
  }, "Pág. ", pagAtual + 1, " de ", totalPags),
  /*#__PURE__*/React.createElement("button", {
    onClick: () => setPagAtual(p => Math.min(totalPags - 1, p + 1)),
    disabled: pagAtual >= totalPags - 1,
    style: { ...BS("secondary", pagAtual >= totalPags - 1, dark), height: 30, padding: "0 12px", fontSize: 12 }
  }, "Próxima →")))));
}

// ─── UsuariosPage ─────────────────────────────────────────────────────────────
function UsuariosPage({
  dark,
  toast
}) {
  const [users, setUsers] = useState({});
  const [novoLogin, setNovoLogin] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoPerfil, setNovoPerfil] = useState("operador");
  const [loading, setLoading] = useState(false);
  // [FIX3] Modal de redefinição de senha — substitui window.prompt
  const [modalSenha, setModalSenha] = useState(null); // { login }
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const iStyle = IS(dark);
  useEffect(() => {
    loadUsers().then(setUsers);
  }, []);
  const handleAdicionar = async () => {
    if (!novoLogin.trim() || !novaSenha.trim() || !novoNome.trim()) {
      toast("Preencha todos os campos.", "error");
      return;
    }
    if (users[novoLogin]) {
      toast("Login já existe.", "error");
      return;
    }
    setLoading(true);
    try {
      const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
      const hash = await hashSenha(salt, novaSenha);
      const updated = {
        ...users,
        [novoLogin]: {
          senha: hash,
          salt,
          nome: novoNome,
          perfil: novoPerfil,
          ativo: true
        }
      };
      await ST.set("users", updated);
      setUsers(updated);
      setNovoLogin("");
      setNovaSenha("");
      setNovoNome("");
      toast("✅ Usuário criado!");
    } finally {
      setLoading(false);
    }
  };
  const toggleAtivo = async login => {
    if (login === "admin") {
      toast("Não é possível desativar o admin.", "warn");
      return;
    }
    const updated = {
      ...users,
      [login]: {
        ...users[login],
        ativo: !users[login].ativo
      }
    };
    await ST.set("users", updated);
    setUsers(updated);
    toast(updated[login].ativo ? "✅ Usuário ativado." : "⚠️ Usuário desativado.", "info");
  };
  const handleResetSenha = async login => {
    // [FIX3] Usa ModalSenha em vez de window.prompt (funciona em Safari iOS)
    setModalSenha({ login });
  };
  const confirmarResetSenha = async (login, ns) => {
    const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const hash = await hashSenha(salt, ns.trim());
    const updated = {
      ...users,
      [login]: {
        ...users[login],
        senha: hash,
        salt
      }
    };
    await ST.set("users", updated);
    setUsers(updated);
    setModalSenha(null);
    toast("✅ Senha redefinida!");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    icon: "\uD83D\uDC65",
    title: "Usu\xE1rios",
    sub: "Gerenciar contas de acesso",
    cor: "#7c3aed",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\u2795",
    title: "Novo Usu\xE1rio",
    dark: dark
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Login"), /*#__PURE__*/React.createElement("input", {
    value: novoLogin,
    onChange: e => setNovoLogin(e.target.value),
    placeholder: "ex: joao.silva",
    style: iStyle
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Nome completo"), /*#__PURE__*/React.createElement("input", {
    value: novoNome,
    onChange: e => setNovoNome(e.target.value),
    placeholder: "Jo\xE3o Silva",
    style: iStyle
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Senha"), /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: novaSenha,
    onChange: e => setNovaSenha(e.target.value),
    placeholder: "Senha inicial",
    style: iStyle
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Perfil"), /*#__PURE__*/React.createElement("select", {
    value: novoPerfil,
    onChange: e => setNovoPerfil(e.target.value),
    style: {
      ...iStyle
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "operador"
  }, "Operador"), /*#__PURE__*/React.createElement("option", {
    value: "admin"
  }, "Administrador")), /*#__PURE__*/React.createElement("button", {
    onClick: handleAdicionar,
    disabled: loading,
    style: {
      ...BS("success", loading, dark),
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\u2795"
  }), "Criar Usu\xE1rio")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDC64",
    title: "Usu\xE1rios Cadastrados",
    dark: dark
  }), Object.entries(users).map(([login, u]) => /*#__PURE__*/React.createElement("div", {
    key: login,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 14px",
      borderRadius: 10,
      marginBottom: 8,
      background: dark ? "#003800" : "#f8fafc",
      border: `1px solid ${bdr}`
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: tc
    }
  }, u.nome), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#64748b"
    }
  }, login, " \xB7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: u.perfil === "admin" ? "#7c3aed" : "#2563eb"
    }
  }, u.perfil))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleResetSenha(login),
    style: {
      ...BS("secondary", false, dark),
      height: 30,
      fontSize: 11,
      padding: "0 8px 0 5px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\uD83D\uDD11"
  }), "Senha"), /*#__PURE__*/React.createElement("button", {
    onClick: () => toggleAtivo(login),
    style: {
      ...BS(u.ativo ? "danger" : "success", false, dark),
      height: 30,
      fontSize: 11,
      padding: "0 8px 0 5px"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: u.ativo ? "🚫" : "✅"
  }), u.ativo ? "Desativar" : "Ativar")))))), modalSenha && /*#__PURE__*/React.createElement(ModalSenha, { login: modalSenha.login, dark: dark, onOk: ns => confirmarResetSenha(modalSenha.login, ns), onCancel: () => setModalSenha(null) }));
}

// ─── OrgaosPage ───────────────────────────────────────────────────────────────
function OrgaosPage({
  processos,
  orgaosConfig,
  onOrgaosChange,
  dark,
  toast
}) {
  const mp = useMemo(() => buildMapData(processos), [processos]);
  const [novoOrg, setNovoOrg] = useState("");
  const [novoSec, setNovoSec] = useState("");
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const iStyle = IS(dark);

  // Merge dos órgãos dos processos com a config
  const allOrgs = useMemo(() => {
    const s = new Set([...mp.allOrgaos, ...Object.keys(orgaosConfig)]);
    return [...s].sort();
  }, [mp.allOrgaos, orgaosConfig]);
  const toggleAtivo = async org => {
    const cur = orgaosConfig[org] || {
      secretario: "",
      ativo: true
    };
    const updated = {
      ...orgaosConfig,
      [org]: {
        ...cur,
        ativo: !cur.ativo
      }
    };
    await ST.set("orgaos_config", updated);
    onOrgaosChange(updated);
    toast(updated[org].ativo ? "✅ Órgão ativado." : "⚠️ Órgão desativado.", "info");
  };
  const handleAdicionar = async () => {
    if (!novoOrg.trim()) {
      toast("Nome do órgão obrigatório.", "error");
      return;
    }
    const updated = {
      ...orgaosConfig,
      [novoOrg.trim()]: {
        secretario: novoSec.trim(),
        ativo: true
      }
    };
    await ST.set("orgaos_config", updated);
    onOrgaosChange(updated);
    setNovoOrg("");
    setNovoSec("");
    toast("✅ Órgão adicionado!");
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    icon: "\uD83C\uDFDB\uFE0F",
    title: "\xD3rg\xE3os",
    sub: "Gerenciar secretarias e departamentos",
    cor: "#0f766e",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px",
      display: "grid",
      gridTemplateColumns: "1fr 2fr",
      gap: 20,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\u2795",
    title: "Novo \xD3rg\xE3o",
    dark: dark
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Nome do \xD3rg\xE3o / Secretaria"), /*#__PURE__*/React.createElement("input", {
    value: novoOrg,
    onChange: e => setNovoOrg(e.target.value),
    placeholder: "SEC. DE SA\xDADE",
    style: iStyle
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Secret\xE1rio(a) padr\xE3o"), /*#__PURE__*/React.createElement("input", {
    value: novoSec,
    onChange: e => setNovoSec(e.target.value),
    placeholder: "Nome do secret\xE1rio",
    style: iStyle
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleAdicionar,
    style: {
      ...BS("success", false, dark),
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\u2795"
  }), "Adicionar")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83C\uDFDB\uFE0F",
    title: `${allOrgs.length} Órgãos`,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 500,
      overflowY: "auto"
    }
  }, allOrgs.map(org => {
    const cfg = orgaosConfig[org] || {
      secretario: "",
      ativo: true
    };
    const ativo = cfg.ativo !== false;
    return /*#__PURE__*/React.createElement("div", {
      key: org,
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderRadius: 10,
        marginBottom: 6,
        background: dark ? "#0d1421" : "#f8fafc",
        border: `1px solid ${ativo ? bdr : "#991b1b"}`,
        opacity: ativo ? 1 : .6
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        color: tc
      }
    }, org), cfg.secretario && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        color: "#64748b"
      }
    }, cfg.secretario)), /*#__PURE__*/React.createElement("button", {
      onClick: () => toggleAtivo(org),
      style: {
        ...BS(ativo ? "danger" : "success", false, dark),
        height: 30,
        fontSize: 11,
        padding: "0 10px 0 5px"
      }
    }, /*#__PURE__*/React.createElement(BtnIco, {
      emoji: ativo ? "🚫" : "✅"
    }), ativo ? "Desativar" : "Ativar"));
  })))));
}

// ─── ControladorForm ──────────────────────────────────────────────────────────
function ControladorForm({ appConfig, setAppConfig, dark, toast }) {
  const ctrl = appConfig?.controlador || {};
  const [nome,     setNome]     = useState(ctrl.nome     || "");
  const [cargo,    setCargo]    = useState(ctrl.cargo    || "");
  const [portaria, setPortaria] = useState(ctrl.portaria || "");
  const [salvando, setSalvando] = useState(false);
  const [salvo,    setSalvo]    = useState(false);

  // Sincronizar se appConfig mudar externamente
  useEffect(() => {
    const c = appConfig?.controlador || {};
    setNome(c.nome     || "");
    setCargo(c.cargo   || "");
    setPortaria(c.portaria || "");
  }, [appConfig]);

  const handleSalvar = async () => {
    if (!nome.trim()) { toast("⚠️ Nome do controlador é obrigatório.", "warn"); return; }
    setSalvando(true);
    const u = {
      ...appConfig,
      controlador: { nome: nome.trim(), cargo: cargo.trim(), portaria: portaria.trim() }
    };
    setAppConfig(u);
    await ST.set("app_config", u);
    setSalvando(false);
    setSalvo(true);
    toast("✅ Dados do controlador salvos com sucesso!");
    setTimeout(() => setSalvo(false), 3000);
  };

  const iStyle = IS(dark);
  const alterado =
    nome     !== (ctrl.nome     || "") ||
    cargo    !== (ctrl.cargo    || "") ||
    portaria !== (ctrl.portaria || "");

  return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("label", { style: LS(dark) }, "Nome completo *"),
    /*#__PURE__*/React.createElement("input", {
      value: nome,
      onChange: e => { setNome(e.target.value); setSalvo(false); },
      placeholder: "Ex: Grazielle Alves da Silva",
      style: iStyle
    }),
    /*#__PURE__*/React.createElement("label", { style: LS(dark) }, "Cargo"),
    /*#__PURE__*/React.createElement("input", {
      value: cargo,
      onChange: e => { setCargo(e.target.value); setSalvo(false); },
      placeholder: "Ex: Controladora-Geral",
      style: iStyle
    }),
    /*#__PURE__*/React.createElement("label", { style: LS(dark) }, "Portaria / Designa\xE7\xE3o"),
    /*#__PURE__*/React.createElement("input", {
      value: portaria,
      onChange: e => { setPortaria(e.target.value); setSalvo(false); },
      placeholder: "Ex: Portaria 031/2026",
      onKeyDown: e => e.key === "Enter" && handleSalvar(),
      style: iStyle
    }),
    /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: 10, marginTop: 4 }
    },
      /*#__PURE__*/React.createElement("button", {
        onClick: handleSalvar,
        disabled: salvando || !alterado,
        style: {
          ...BS(salvo ? "success" : "primary", salvando || !alterado, dark),
          flex: 1,
          justifyContent: "center",
          height: 40
        }
      },
        salvando
          ? /*#__PURE__*/React.createElement(BtnIco, { emoji: "\u23F3" })
          : salvo
            ? /*#__PURE__*/React.createElement(BtnIco, { emoji: "\u2705" })
            : /*#__PURE__*/React.createElement(BtnIco, { emoji: "\uD83D\uDCBE" }),
        salvando ? "Salvando..." : salvo ? "Salvo!" : "Salvar Altera\xE7\xF5es"
      ),
      alterado && !salvo && /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 10.5, color: "#f59e0b", fontWeight: 700,
          display: "flex", alignItems: "center", gap: 4
        }
      }, "\u26A0\uFE0F N\xE3o salvo")
    ),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 10.5, color: "#64748b", marginTop: 8 }
    }, "Aparece na assinatura de todos os PDFs gerados.")
  );
}

// ─── ConfigPage ───────────────────────────────────────────────────────────────
function ConfigPage({
  processos,
  historico,
  orgaosConfig,
  appConfig,
  setAppConfig,
  onImport,
  onSyncDB,
  dark,
  toast,
  user,
  onLimparBanco
}) {
  const [importLoading, setImportLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [showApagar, setShowApagar] = useState(false);
  const [senhaApagar, setSenhaApagar] = useState("");
  const [apagarErr, setApagarErr] = useState("");
  const [apagarLoading, setApagarLoading] = useState(false);
  const isAdmin = user?.perfil === "admin";
  const handleConfirmarApagar = async () => {
    if (!senhaApagar.trim()) {
      setApagarErr("Digite sua senha.");
      return;
    }
    setApagarLoading(true);
    setApagarErr("");
    try {
      const ok = await checkLogin(user.login, senhaApagar.trim());
      if (!ok) {
        setApagarErr("Senha incorreta. Tente novamente.");
        return;
      }
      await onLimparBanco();
      setShowApagar(false);
      setSenhaApagar("");
    } finally {
      setApagarLoading(false);
    }
  };
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const handleExportExcel = () => {
    exportarExcel(processos, historico);
    toast("✅ Excel exportado!");
  };
  // [G-S2] Restaurar backup
  const [backupList, setBackupList] = React.useState([]);
  React.useEffect(() => {
    ST.list("backup_").then(rows => {
      if (rows) setBackupList(rows.sort((a,b) => b.key.localeCompare(a.key)).slice(0,4));
    });
  }, []);
  const handleRestaurarBackup = async (item) => {
    if (!window.confirm("Restaurar backup de " + item.key.replace("backup_","") + "?\n\nIsso substituirá os dados atuais.")) return;
    const snap = item.value;
    if (snap?.processos) { await ST.set("processos", snap.processos); }
    if (snap?.historico) { await ST.set("historico", snap.historico); }
    toast("✅ Backup restaurado! Recarregando...", "info");
    setTimeout(() => location.reload(), 1500);
  };
  const [importPct, setImportPct] = React.useState(0); // [M-P3] progresso
  const handleImportExcel = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportPct(0);
    try {
      // [M-P3] Usa Web Worker para não travar a UI
      const rows = await importarExcelWorker(file, pct => setImportPct(pct));
      onImport(rows, rows._lastNum || 0);
      toast(`✅ Importados ${rows.length} registros.`);
    } catch (err) {
      toast(`❌ Erro: ${err.message}`, "error");
    } finally {
      setImportLoading(false);
      setImportPct(0);
      e.target.value = "";
    }
  };
  const handleImportDB = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDbLoading(true);
    try {
      const res = await readSqliteDB(file);
      if (res.error) {
        toast(`❌ SQLite: ${res.error}`, "error");
        return;
      }
      onSyncDB(res);
      toast(`✅ DB importado: ${res.processos.length} processos.`);
    } catch (err) {
      toast(`❌ ${err.message}`, "error");
    } finally {
      setDbLoading(false);
      e.target.value = "";
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    icon: "\u2699\uFE0F",
    title: "Configura\xE7\xF5es",
    sub: "Importar, exportar e gerenciar dados",
    cor: "#64748b",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "12px 24px 0",
      padding: "12px 16px",
      background: _sbLive ? "#052e16" : _sbReady ? "#1c1400" : "#431407",
      borderRadius: 10,
      border: `1.5px solid ${_sbLive ? "#16a34a" : _sbReady ? "#ca8a04" : "#ea580c"}`,
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 13,
      flexShrink: 0
    }
  },
  /*#__PURE__*/React.createElement("span", {style:{fontSize:18}}, _sbLive ? "\u2705" : _sbReady ? "\u26A0\uFE0F" : "\u274C"),
  /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", {style:{fontWeight:700, color: _sbLive ? "#86efac" : _sbReady ? "#fde047" : "#fed7aa"}},
      _sbLive
        ? "\u2601\uFE0F Supabase ON-LINE \u2014 todos os usu\xE1rios sincronizados"
        : _sbReady
          ? "\u26A0\uFE0F Supabase CONFIGURADO mas sem resposta \u2014 processos salvos s\xF3 neste navegador"
          : "\u274C Supabase N\xC3O configurado \u2014 dados salvos apenas neste navegador"
    ),
    /*#__PURE__*/React.createElement("div", {style:{fontSize:11, color: _sbLive ? "#4ade80" : _sbReady ? "#fbbf24" : "#fb923c", marginTop:2}},
      _sbReady ? ("URL: " + SUPABASE_URL) : "Preencha SUPABASE_URL e SUPABASE_ANON_KEY no in\xEDcio do arquivo app.js"
    )
  )
  ), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDCE4",
    title: "Exportar",
    dark: dark
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleExportExcel,
    style: {
      ...BS("success", false, dark),
      width: "100%",
      justifyContent: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\uD83D\uDCCA"
  }), "Exportar Excel"),
  /*#__PURE__*/React.createElement("button", {
    onClick: () => { exportarSIAFEM(processos); toast("✅ SIAFEM/TCE-MA exportado!"); },
    style: {
      ...BS("secondary", false, dark),
      width: "100%",
      justifyContent: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(BtnIco, { emoji: "\uD83C\uDFDB\uFE0F" }), "Exportar SIAFEM / TCE-MA"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#64748b"
    }
  }, processos.length, " processos \xB7 ", historico.length, " hist\xF3rico")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDCE5",
    title: "Importar Excel",
    dark: dark
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...BS("primary", importLoading, dark),
      width: "100%",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: importLoading ? "⏳" : "📥"
  }), importLoading ? (importPct > 0 ? `Processando... ${importPct}%` : "Importando...") : "Selecionar Excel (.xlsx)", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: ".xlsx,.xls",
    onChange: handleImportExcel,
    style: {
      display: "none"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#64748b",
      marginTop: 8
    }
  }, "Importa e mescla com dados existentes.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDDC4\uFE0F",
    title: "Importar SQLite (.db)",
    dark: dark
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...BS("orange", dbLoading, dark),
      width: "100%",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: dbLoading ? "⏳" : "🗄️"
  }), dbLoading ? "Lendo banco..." : "Selecionar arquivo .db", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: ".db,.sqlite,.sqlite3",
    onChange: handleImportDB,
    style: {
      display: "none"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#64748b",
      marginTop: 8
    }
  }, "L\xEA processos, hist\xF3rico e configura\xE7\xF5es de \xF3rg\xE3os."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\u2139\uFE0F",
    title: "Informa\xE7\xF5es do Sistema",
    dark: dark
  }), [["Versão", "v3.2"], ["Processos salvos", processos.length], ["Histórico", historico.length], ["Órgãos configurados", Object.keys(orgaosConfig).length]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "7px 0",
      borderBottom: `1px solid ${bdr}`,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#64748b"
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: tc
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px" }
  },
  /*#__PURE__*/React.createElement(SH, { icon: "\uD83D\uDCBE", title: "Backups Semanais", dark: dark }),
  backupList.length === 0
    ? /*#__PURE__*/React.createElement("div", { style: { fontSize: 12, color: "#94a3b8" } }, "Nenhum backup encontrado. O sistema cria automaticamente toda segunda-feira.")
    : backupList.map(item => /*#__PURE__*/React.createElement("div", {
        key: item.key,
        style: { display: "flex", alignItems: "center", justifyContent: "space-between",
                 padding: "8px 12px", borderRadius: 8, marginBottom: 6,
                 background: dark ? "#003800" : "#f8fafc", border: `1px solid ${bdr}` }
      },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: tc } }, item.key.replace("backup_","")),
        /*#__PURE__*/React.createElement("div", { style: { fontSize: 11, color: "#94a3b8" } },
          (item.value?.processos?.length || 0), " processos · ", (item.value?.historico?.length || 0), " histórico")
      ),
      /*#__PURE__*/React.createElement("button", {
        onClick: () => handleRestaurarBackup(item),
        style: { ...BS("secondary", false, dark), height: 30, fontSize: 11, padding: "0 10px 0 6px" }
      }, /*#__PURE__*/React.createElement(BtnIco, { emoji: "\u21A9\uFE0F" }), "Restaurar")
    ))
  ),
  /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\u270D\uFE0F",
    title: "Dados do Controlador (PDF)",
    dark: dark
  }), /*#__PURE__*/React.createElement(ControladorForm, {
    appConfig: appConfig,
    setAppConfig: setAppConfig,
    dark: dark,
    toast: toast
  })))), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 24px 24px",
      background: cardBg,
      borderRadius: 14,
      border: "1.5px solid #dc2626",
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement(SH, {
    icon: "\u26A0\uFE0F",
    title: "Zona de Perigo",
    dark: dark
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: dark ? "#fca5a5" : "#991b1b",
      marginBottom: 14,
      lineHeight: 1.6
    }
  }, "Apaga ", /*#__PURE__*/React.createElement("strong", null, "todos os dados"), ": processos, hist\xF3rico, \xF3rg\xE3os e configura\xE7\xF5es.", /*#__PURE__*/React.createElement("br", null), "Esta opera\xE7\xE3o \xE9 ", /*#__PURE__*/React.createElement("strong", null, "irrevers\xEDvel"), "."), !showApagar ? /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowApagar(true);
      setSenhaApagar("");
      setApagarErr("");
    },
    style: {
      ...BS("danger", false, dark),
      width: "100%",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: "\uD83D\uDDD1\uFE0F"
  }), "Apagar banco de dados") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: dark ? "#fca5a5" : "#991b1b"
    }
  }, "\uD83D\uDD10 Confirme sua senha de administrador:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Sua senha de login",
    value: senhaApagar,
    onChange: e => {
      setSenhaApagar(e.target.value);
      setApagarErr("");
    },
    onKeyDown: e => e.key === "Enter" && handleConfirmarApagar(),
    autoFocus: true,
    style: {
      ...IS(dark),
      flex: 1,
      border: "1.5px solid #dc2626",
      marginBottom: 0,
      minWidth: 180
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: handleConfirmarApagar,
    disabled: apagarLoading,
    style: {
      ...BS("danger", apagarLoading, dark),
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(BtnIco, {
    emoji: apagarLoading ? "⏳" : "🗑️"
  }), apagarLoading ? "Apagando..." : "Confirmar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowApagar(false);
      setSenhaApagar("");
      setApagarErr("");
    },
    style: {
      ...BS("ghost", false, dark)
    }
  }, "Cancelar")), apagarErr && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#dc2626",
      fontWeight: 700
    }
  }, "\u274C ", apagarErr))));
}



// ─── [v4.0] ETag — polling inteligente ───────────────────────────────────────
// Grava _versao_banco a cada save; polling verifica antes de recarregar tudo
let _versaoLocal = null;

async function _incrementarVersao() {
  try {
    const atual = (await ST.get("_versao_banco")) || 0;
    await _sbFetch("POST", "_versao_banco", JSON.stringify(Number(atual) + 1));
    _versaoLocal = Number(atual) + 1;
  } catch {}
}

async function _versaoBancoCambou() {
  if (!_sbReady) return true;
  try {
    const raw = await _sbFetch("GET", "_versao_banco");
    const remota = raw !== null ? JSON.parse(raw) : 0;
    if (remota !== _versaoLocal) { _versaoLocal = remota; return true; }
    return false;
  } catch { return true; }
}

// ─── [G-S2] Backup automático semanal ────────────────────────────────────────
async function verificarEFazerBackup(processos, historico) {
  try {
    const hoje = new Date();
    const ehSegunda = hoje.getDay() === 1; // 0=dom, 1=seg
    if (!ehSegunda) return;
    const chaveBackup = `backup_${hoje.toISOString().slice(0,10)}`;
    const jaFez = await ST.get(chaveBackup);
    if (jaFez) return; // já fez backup hoje
    const snapshot = { processos, historico, ts: hoje.toISOString(), v: "3.5" };
    await ST.set(chaveBackup, snapshot);
    // Mantém apenas 4 backups — remove o mais antigo
    const backups = await ST.list("backup_");
    if (backups.length > 4) {
      backups.sort((a,b) => a.key.localeCompare(b.key));
      await ST.del(backups[0].key);
    }
    console.info("[Backup] Snapshot semanal salvo:", chaveBackup);
  } catch (e) { console.warn("[Backup] Falhou:", e.message); }
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
  const [sbOnline, setSbOnline] = useState(_sbLive); // [FIX-G] React state mirrors _sbLive for re-renders
  const [pendentesAtrasados, setPendentesAtrasados] = useState([]); // [G-R3]
  const [processos, setProcessos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [orgaosConfig, setOrgaosConfig] = useState({});
  const [appConfig, setAppConfig] = useState({
    controlador: {
      nome: "Thiago Soares Lima",
      cargo: "Controlador Geral",
      portaria: "Portaria 002/2025"
    }
  });
  const [page, setPage] = useState("processos");
  const [dark, setDark] = useState(false);
  const [formPct, setFormPct] = useState(0);
  const [duplicarData, setDuplicarData] = useState(null);
  const [editarData, setEditarData] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true); // [J-M1] mobile drawer
  // [FIX9] ConfirmModal global no App (para sair sem salvar)
  const [appConfirmModal, setAppConfirmModal] = useState(null);
  // [FIX11] Indicador de carregamento inicial
  const [carregando, setCarregando] = useState(true);
  const [erroRede, setErroRede] = useState("");
  // Âncora de numeração: garante que após importar planilha o próximo nº seja maxPlanilha+1
  const [importedMaxNum, setImportedMaxNum] = useState(0);
  // [M2] Ref para pausar polling durante modo edição (evita sobrescrever dados editados)
  const editModeRef = useRef(false);
  // [FIX6] Timer de sessão — expira após 8h de inatividade
  const sessaoTimerRef = useRef(null);
  const reiniciarTimerSessao = useCallback(() => {
    if (sessaoTimerRef.current) clearTimeout(sessaoTimerRef.current);
    sessaoTimerRef.current = setTimeout(() => {
      setUser(null);
      toast("⏰ Sessão expirada por inatividade. Faça login novamente.", "warn");
    }, 8 * 60 * 60 * 1000); // 8 horas
  }, []);
  const {
    toasts,
    toast
  } = useToast();

  // [M-A3] Service Worker registration for offline support
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(reg => console.info("[SW] Registered:", reg.scope))
        .catch(err => console.warn("[SW] Registration failed:", err.message));
    }
  }, []);

  // [J-M3] PWA manifest injection
  useEffect(() => {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = {
        name: "ControleGeral – Pref. Gov. Edison Lobão",
        short_name: "ControleGeral",
        start_url: "/",
        display: "standalone",
        background_color: "#006000",
        theme_color: "#006000"
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("link");
      link.rel = "manifest"; link.href = url;
      document.head.appendChild(link);
    }
    // theme-color meta
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement("meta");
      meta.name = "theme-color"; meta.content = "#006000";
      document.head.appendChild(meta);
    }
  }, []);

  // [FIX6] Inicia timer de sessão ao logar
  useEffect(() => {
    if (user) {
      reiniciarTimerSessao();
      // [FIX10] Pré-carrega jsPDF e docx.js silenciosamente após login
      loadJsPDF().catch(() => {});
      loadDocxLib().catch(() => {});
    }
    return () => { if (sessaoTimerRef.current) clearTimeout(sessaoTimerRef.current); };
  }, [user]);

  // [FIX6] Reinicia timer a cada interação do usuário
  useEffect(() => {
    if (!user) return;
    const eventos = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => reiniciarTimerSessao();
    eventos.forEach(e => document.addEventListener(e, handler, { passive: true }));
    return () => eventos.forEach(e => document.removeEventListener(e, handler));
  }, [user, reiniciarTimerSessao]);

  // [B1] Zera formPct ao sair de "processos"
  const handleSetPage = useCallback(p => {
    // [FIX9] Usa ConfirmModal em vez de window.confirm ao sair sem salvar
    if (p !== "processos" && editModeRef.current) {
      setAppConfirmModal({
        titulo: "Sair sem salvar?",
        msg: "⚠️ Você está editando um processo.\n\nDeseja sair sem salvar as alterações?",
        tipo: "warn",
        onOk: () => {
          setAppConfirmModal(null);
          editModeRef.current = false;
          setFormPct(0);
          setPage(p);
        }
      });
      return;
    }
    if (p !== "processos") setFormPct(0);
    setPage(p);
  }, []);

  // [POLL] Carga inicial + sincronização a cada 20s + ao voltar para a aba
  useEffect(() => {
    const refresh = async (isFirst = false) => {
      // [M2] Não atualiza se o usuário está editando um processo
      if (editModeRef.current) return;
      try {
        const [p, h, o, a, n] = await Promise.all([
          loadAllProcessos(),
          loadAllHistorico(),
          ST.get("orgaos_config"),
          ST.get("app_config"),
          ST.get("imported_max_num")
        ]);
        // [FIX11] Limpa erro de rede ao carregar com sucesso
        if (isFirst) { setErroRede(""); setCarregando(false); }
        setSbOnline(_sbLive);
        setProcessos(p || []);
        setHistorico(h || []);
        // [G-S2] Verifica se deve fazer backup semanal
        if (isFirst) verificarEFazerBackup(p || [], h || []).catch(()=>{});
        // [G-R3] Calcula processos pendentes há mais de 5 dias úteis
        const hoje = new Date();
        const atrasados = (h || []).filter(hh => {
          if (hh["Decisão"]) return false; // já decidido
          if (!hh["_registradoEm"]) return false;
          // _registradoEm: "dd/mm/aaaa, HH:MM:SS"
          const parts = String(hh["_registradoEm"]).split(", ")[0].split("/");
          if (parts.length < 3) return false;
          const dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          const diff = (hoje - dt) / (1000 * 60 * 60 * 24);
          return diff >= 5;
        });
        setPendentesAtrasados(atrasados);
        if (o) setOrgaosConfig(o);
        if (a) setAppConfig(a);
        if (n && Number.isInteger(n) && n > 0) setImportedMaxNum(n);
      } catch (err) {
        // [FIX11] Mostra erro explícito se carga inicial falhar
        if (isFirst) {
          setErroRede("Falha ao carregar dados. Verifique a conexão.");
          setCarregando(false);
        }
      }
    };
    refresh(true); // primeira carga — mostra indicador e erro de rede se necessário
    // [v4.0] ETag: só recarrega se versão mudou — reduz 90% das chamadas
    const interval = setInterval(async () => {
      const mudou = await _versaoBancoCambou();
      if (mudou) refresh(false);
    }, 20000); // [M7] 20 s
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const salvarProcessos = async p => {
    setProcessos(p);
    await ST.set("processos", p);
  };
  const salvarHistorico = async h => {
    setHistorico(h);
    await ST.set("historico", h);
  };
  const salvarOrgaos = async o => {
    setOrgaosConfig(o);
    await ST.set("orgaos_config", o);
  };
  const onSave = useCallback(async (row, form, user) => {
    const numSalvo = String(row["NÚMERO DO DOCUMENTO"] || "").trim();
    const usuario = user?.login || user?.nome || "sistema";
    // [G-S1] Operadores só criam — não editam processos existentes
    const novoItem = {
      ...row,
      "_tipoKey": form.tipo,
      "_decisao": form.decisao,
      "_obs": form.obs,
      "_usuario": usuario
    };

    // [ATOM] Grava processo em chave individual
    const resPoc = await ST.set(`proc_${numSalvo}`, novoItem);

    // Atualiza âncora de numeração
    const numInt = parseInt(numSalvo, 10);
    const currentMaxNum = (await ST.get("imported_max_num")) || 0;
    if (!isNaN(numInt) && numInt > currentMaxNum) {
      setImportedMaxNum(numInt);
      await ST.set("imported_max_num", numInt);
    }

    // Histórico individual — chave "hist_NUM"
    const hRow = {
      "Processo": row["NÚMERO DO DOCUMENTO"],
      "Data": dtExt(fmtD(row["DATA"])),
      "Órgão": row["ORGÃO"],
      "Fornecedor": row["FORNECEDOR"],
      "Valor": row["VALOR"],
      "Tipo": TINFO[form.tipo]?.label || form.tipo,
      "TipoKey": form.tipo,
      "Decisão": form.decisao === "deferir" ? "DEFERIDO" : "INDEFERIDO",
      "CNPJ": row["CNPJ"] || "",
      "MODALIDADE": row["MODALIDADE"] || "",
      "CONTRATO": row["CONTRATO"] || "",
      "OBJETO": row["OBJETO"] || "",
      "DOCUMENTO FISCAL": row["DOCUMENTO FISCAL"] || "",
      "Nº": row["Nº"] || "",
      "TIPO": row["TIPO"] || "",
      "SECRETARIO": row["SECRETARIO"] || "",
      "PERÍODO DE REFERÊNCIA": row["PERÍODO DE REFERÊNCIA"] || "",
      "N° ORDEM DE COMPRA": row["N° ORDEM DE COMPRA"] || "",
      "DATA NF": row["DATA NF"] || "",
      "NÚMERO DO DOCUMENTO": row["NÚMERO DO DOCUMENTO"] || "",
      "_obs": form.obs,
      "_sits": row["_sits"] || [],
      "_usuario": usuario,
      "_registradoEm": new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    // [v4.0] Salva também na tabela separada cgel_historico
    _sbFetch("HIST_POST", null, {
      num_processo: String(hRow["Processo"]||""), orgao: hRow["Órgão"]||"",
      fornecedor: hRow["Fornecedor"]||"", cnpj: hRow["CNPJ"]||"",
      valor: hRow["Valor"]||"", tipo_key: hRow["TipoKey"]||"",
      decisao: hRow["Decisão"]||"", status: hRow["_status"]||"analise",
      usuario: hRow["_usuario"]||"", dados: hRow
    }).catch(()=>{});
    await ST.set(`hist_${numSalvo}`, hRow);

    // [v4.0] ETag: incrementa versão para notificar outros clientes
    _incrementarVersao().catch(()=>{});
    // [M-AU2] Audit log — registra criação
    await ST.set(`audit_${numSalvo}_${Date.now()}`, {
      acao: "criar", num: numSalvo, usuario,
      ts: new Date().toISOString(),
      campos: { orgao: row["ORGÃO"], fornecedor: row["FORNECEDOR"], valor: row["VALOR"], decisao: form.decisao }
    }).catch(() => {});

    // Re-carrega estado completo (reflete todos os usuários)
    const [p, h] = await Promise.all([loadAllProcessos(), loadAllHistorico()]);
    setProcessos(p || []);
    setHistorico(h || []);

    // Feedback: informa se salvou na nuvem ou só localmente
    if (resPoc.cloud) {
      toast(`✅ Processo ${row["NÚMERO DO DOCUMENTO"]} salvo na nuvem ☁️`);
    } else {
      toast(`⚠️ Processo ${row["NÚMERO DO DOCUMENTO"]} salvo localmente — verifique a conexão com o Supabase.`, "warn");
    }
  }, []);

  const onSaveEdit = useCallback(async (row, form, numOriginal, user) => {
    const numStr = String(numOriginal);
    const usuario = user?.login || user?.nome || "sistema";
    // [G-S1] Apenas admins podem editar processos de outros usuários
    if (user?.perfil !== "admin") {
      // Busca o processo original para verificar dono
      const procOriginal = processos.find(p => String(p["NÚMERO DO DOCUMENTO"]) === numStr);
      if (procOriginal && procOriginal["_usuario"] && procOriginal["_usuario"] !== usuario) {
        toast("⛔ Sem permissão para editar processo de outro usuário.", "error");
        return;
      }
    }
    const novoItem = {
      ...row,
      "_tipoKey": form.tipo,
      "_decisao": form.decisao,
      "_obs": form.obs,
      "_sits": row["_sits"] || [],
      "_usuario": usuario
    };

    // [ATOM] Upsert individual — não sobrescreve outros processos
    const resProc = await ST.set(`proc_${numStr}`, novoItem);

    // [FIX] Grava hist completo com TODOS os campos atualizados do row.
    // Antes: usava ...histExist que propagava dados antigos (ex: CONTRATO velho)
    // para o hist_* de maior prioridade, sobrescrevendo os dados novos do proc_*.
    const hRow = {
      "Processo":              row["NÚMERO DO DOCUMENTO"] || "",
      "Data":                  dtExt(fmtD(row["DATA"] || "")),
      "Órgão":                 row["ORGÃO"] || "",
      "Fornecedor":            row["FORNECEDOR"] || "",
      "Valor":                 row["VALOR"] || "",
      "Tipo":                  TINFO[form.tipo]?.label || form.tipo,
      "TipoKey":               form.tipo,
      "Decisão":               form.decisao === "deferir" ? "DEFERIDO" : "INDEFERIDO",
      "CNPJ":                  row["CNPJ"] || "",
      "MODALIDADE":            row["MODALIDADE"] || "",
      "CONTRATO":              row["CONTRATO"] || "",
      "OBJETO":                row["OBJETO"] || "",
      "DOCUMENTO FISCAL":      row["DOCUMENTO FISCAL"] || "",
      "Nº":                    row["Nº"] || "",
      "TIPO":                  row["TIPO"] || "",
      "SECRETARIO":            row["SECRETARIO"] || "",
      "PERÍODO DE REFERÊNCIA": row["PERÍODO DE REFERÊNCIA"] || "",
      "N° ORDEM DE COMPRA":    row["N° ORDEM DE COMPRA"] || "",
      "DATA NF":               row["DATA NF"] || "",
      "NÚMERO DO DOCUMENTO":   row["NÚMERO DO DOCUMENTO"] || "",
      "_obs":                  form.obs,
      "_sits":                 row["_sits"] || [],
      "_tipoKey":              form.tipo,
      "_decisao":              form.decisao,
      "_usuario":              usuario,
      "_registradoEm":         new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    // [v4.0] Salva na tabela separada cgel_historico
    _sbFetch("HIST_POST", null, {
      num_processo: String(hRow["Processo"]||""), orgao: hRow["Órgão"]||"",
      fornecedor: hRow["Fornecedor"]||"", cnpj: hRow["CNPJ"]||"",
      valor: hRow["Valor"]||"", tipo_key: hRow["TipoKey"]||"",
      decisao: hRow["Decisão"]||"", status: hRow["_status"]||"analise",
      usuario: hRow["_usuario"]||"", dados: hRow
    }).catch(()=>{});
    await ST.set(`hist_${numStr}`, hRow);

    // [v4.0] ETag: incrementa versão
    _incrementarVersao().catch(()=>{});
    // [M-AU2] Audit log — registra edição
    await ST.set(`audit_${numStr}_${Date.now()}`, {
      acao: "editar", num: numStr, usuario,
      ts: new Date().toISOString(),
      campos: { orgao: row["ORGÃO"], fornecedor: row["FORNECEDOR"], valor: row["VALOR"], decisao: form.decisao }
    }).catch(() => {});

    // Re-carrega estado completo
    const [p, h] = await Promise.all([loadAllProcessos(), loadAllHistorico()]);
    setProcessos(p || []);
    setHistorico(h || []);

    if (resProc.cloud) {
      toast(`✅ Processo ${row["NÚMERO DO DOCUMENTO"]} atualizado na nuvem ☁️`, "info");
    } else {
      toast(`⚠️ Processo ${row["NÚMERO DO DOCUMENTO"]} atualizado localmente — verifique Supabase.`, "warn");
    }
  }, []);
  const handleEditar = useCallback(row => {
    setEditarData(row);
    handleSetPage("processos");
  }, [handleSetPage]);
  const handleDuplicar = useCallback(row => {
    setDuplicarData(row);
    handleSetPage("processos");
  }, [handleSetPage]);
  const handleGerarPDFBusca = useCallback(async row => {
    const tipo = row["_tipoKey"] || "padrao";
    const chk = CHK[tipo] || [];
    // sits: usa checklist salvo em _sits se houver, senão todos marcados
    const sitsRaw = row["_sits"] || row["_chks"];
    const sits = Array.isArray(sitsRaw) && sitsRaw.length === chk.length ? sitsRaw : Array(chk.length).fill(true);
    // Detectar decisão: processos têm _decisao, histórico tem "Decisão"
    const decRaw = row["_decisao"] || row["Decisão"] || "deferir";
    const isDeferido = decRaw !== "indeferir" && !String(decRaw).toUpperCase().includes("INDE");
    // Buscar dados completos do processo na tabela de processos (pode ter mais dados)
    const procCompleto = processos.find(p => String(p["NÚMERO DO DOCUMENTO"]) === String(row["NÚMERO DO DOCUMENTO"] || row["Processo"] || ""));
    const r2 = procCompleto || row;
    // Também buscar dados do fornecedor no histórico para auto-completar
    const mpBusca = buildMapData(processos);
    const forn2 = r2["FORNECEDOR"] || r2["Fornecedor"] || row["Fornecedor"] || "";
    const org2 = r2["ORGÃO"] || r2["Órgão"] || row["Órgão"] || "";
    // [FIX] Usa APENAS os dados do processo salvo, sem fallbacks históricos.
    // Fallbacks por fornecedor/órgão podiam sobrescrever campos que o usuário
    // editou e salvou, fazendo o PDF mostrar dados antigos (ex: CONTRATO velho).
    const d = {
      processo:    r2["NÚMERO DO DOCUMENTO"] || row["Processo"] || "",
      orgao:       org2,
      secretario:  r2["SECRETARIO"] || "",
      fornecedor:  forn2,
      cnpj:        r2["CNPJ"] || "",
      nf:          r2["Nº"] || "",
      contrato:    r2["CONTRATO"] || "",
      modalidade:  r2["MODALIDADE"] || "",
      periodo_ref: r2["PERÍODO DE REFERÊNCIA"] || "",
      ordem_compra: r2["N° ORDEM DE COMPRA"] || "",
      data_nf:     formatData(r2["DATA NF"] || row["Data"] || ""),
      data_ateste: dtExt(formatData(r2["DATA"] || row["Data"] || "")),
      objeto:      r2["OBJETO"] || "",
      valor:       r2["VALOR"] || r2["Valor"] || row["Valor"] || "",
      tipo_doc:    r2["DOCUMENTO FISCAL"] || "",
      tipo_nf:     r2["TIPO"] || "",
      obs:         r2["_obs"] || "",
      controlador: appConfig?.controlador || {}
    };
    const r = await gerarPDF(d, tipo, isDeferido, chk, sits);
    if (r.error) {
      toast("❌ PDF: " + r.error, "error");
      return;
    }
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 2000);
    toast("✅ PDF gerado!");
  }, [appConfig, processos]);
  const handleSync = useCallback(async () => {
    if (!_sbReady) {
      toast("⚠️ Supabase não configurado — dados salvos apenas neste navegador.", "warn");
      return;
    }
    toast("🔄 Sincronizando...", "info");

    // Carrega dados frescos do banco local/memória
    const [p, h, o] = await Promise.all([
      loadAllProcessos(),
      loadAllHistorico(),
      ST.get("orgaos_config")
    ]);

    // Envia cada processo individualmente (proc_NUM)
    const procJobs = (p || []).map(proc => {
      const num = String(proc["NÚMERO DO DOCUMENTO"] || "").trim();
      if (!num) return Promise.resolve();
      return ST.set(`proc_${num}`, proc);
    });

    // Envia cada histórico individualmente (hist_NUM)
    const histJobs = (h || []).map(hist => {
      const num = String(hist["Processo"] || hist["NÚMERO DO DOCUMENTO"] || "").trim();
      if (!num) return Promise.resolve();
      return ST.set(`hist_${num}`, hist);
    });

    // Envia blob de órgãos (pequeno, sem problema de conflito)
    const orgJob = o ? ST.set("orgaos_config", o) : Promise.resolve();

    await Promise.all([...procJobs, ...histJobs, orgJob]);

    // Recarrega estado com dados confirmados
    const [pFresh, hFresh] = await Promise.all([loadAllProcessos(), loadAllHistorico()]);
    setProcessos(pFresh || []);
    setHistorico(hFresh || []);

    setSbOnline(_sbLive);
    toast(`☁️ Sincronizado! ${(p||[]).length} processos · ${(h||[]).length} histórico`, "info");
  }, []);
  const handleImport = useCallback((rows, lastNum) => {
    // Importa planilha e enriquece processos manuais (campos vazios) com dados do histórico
    const rowMap = {};
    rows.forEach(r => {
      rowMap[String(r["NÚMERO DO DOCUMENTO"])] = r;
    });
    const fornMap = {};
    rows.forEach(r => {
      const f = String(r["FORNECEDOR"] || "").trim();
      if (f) fornMap[f] = r;
    });
    const enriched = processos.filter(p => !rowMap[String(p["NÚMERO DO DOCUMENTO"])]).map(p => {
      const forn = String(p["FORNECEDOR"] || "").trim();
      const ref = fornMap[forn];
      if (!ref) return p;
      return {
        ...p,
        "CNPJ": p["CNPJ"] || ref["CNPJ"] || "",
        "MODALIDADE": p["MODALIDADE"] || ref["MODALIDADE"] || "",
        "CONTRATO": p["CONTRATO"] || ref["CONTRATO"] || "",
        "DOCUMENTO FISCAL": p["DOCUMENTO FISCAL"] || ref["DOCUMENTO FISCAL"] || "",
        "TIPO": p["TIPO"] || ref["TIPO"] || "",
        "OBJETO": p["OBJETO"] || ref["OBJETO"] || "",
        "SECRETARIO": p["SECRETARIO"] || ref["SECRETARIO"] || ""
      };
    });
    const merged = [...rows, ...enriched];
    salvarProcessos(merged);
    // ── Auditoria de numeração ────────────────────────────────────────────────
    // ÂNCORA = lastNum (valor da ÚLTIMA LINHA da planilha, ex: 2591)
    // Isso respeita planilhas com fórmulas =L2+1 cumulativas
    // Também considera processos manuais já salvos (edge case)
    // ÂNCORA = lastNum = valor da ÚLTIMA LINHA da planilha (ex: 2591)
    // NÃO usar maiorNumero(rows) pois pode ter valores históricos maiores na planilha
    // lastNum é calculado em importarExcel() percorrendo linha a linha e pegando o último
    const novaAncora = lastNum || 0;
    const proximoNum = novaAncora + 1;
    if (novaAncora > 0) {
      setImportedMaxNum(novaAncora);
      ST.set("imported_max_num", novaAncora);
    }
    toast(
      "✅ " + rows.length + " registros importados." +
      (novaAncora > 0 ? " Último Nº: " + novaAncora + " | Próximo: " + proximoNum : ""),
      "info"
    );
  }, [processos, toast]);
  const handleSyncDB = useCallback(res => {
    if (res.processos?.length) salvarProcessos(res.processos);
    if (res.historico?.length) salvarHistorico(res.historico);
    if (Object.keys(res.orgaosConfig || {}).length) salvarOrgaos(res.orgaosConfig);
  }, []);

  // [C4] Histórico truncado check
  const histTruncado = historico.length >= 1000;
  // [C2] Próximo número com auditoria completa:
  // Quando importedMaxNum existe (planilha importada), ele É a fonte da verdade.
  // NÃO usar Math.max com proxNumero(processos) pois a planilha pode ter
  // valores históricos altos (ex: 3095) que inflam o resultado.
  const nextProcessoNumber = useMemo(() => {
    // Números de processos cadastrados MANUALMENTE após a importação
    // (processos normais da planilha são ignorados — a âncora já os cobre)
    const manuais = new Set(
      processos
        .map(p => parseInt(String(p["NÚMERO DO DOCUMENTO"] || "").trim(), 10))
        .filter(n => !isNaN(n) && n > 0 && n < 99999)
    );

    if (importedMaxNum > 0) {
      // Âncora definida: próximo = último da planilha + 1, pulando manuais
      let next = importedMaxNum + 1;
      while (manuais.has(next)) next++;
      return next;
    }

    // Sem âncora (banco ainda vazio): usa maior número existente + 1
    const nums = [...manuais];
    if (!nums.length) return 1;
    let next = nums.reduce((a,b) => a > b ? a : b, 0) + 1;
    while (manuais.has(next)) next++;
    return next;
  }, [processos, importedMaxNum]);

  // [FIX11] Tela de carregamento inicial
  if (carregando) return /*#__PURE__*/React.createElement("div", {
    style: { minHeight: "100vh", display: "flex", flexDirection: "column",
             alignItems: "center", justifyContent: "center", background: "#006000", gap: 18 }
  }, /*#__PURE__*/React.createElement(Brasao, { size: 64 }),
     /*#__PURE__*/React.createElement("div", {
       style: { fontSize: 13, color: "#4ade80", fontWeight: 600, letterSpacing: ".04em" }
     }, erroRede || "Carregando sistema..."),
     !erroRede && /*#__PURE__*/React.createElement("div", {
       style: { width: 180, height: 3, background: "rgba(255,255,255,.15)", borderRadius: 3, overflow: "hidden" }
     }, /*#__PURE__*/React.createElement("div", {
       style: { height: "100%", background: MUN.gold, borderRadius: 3,
                animation: "slideIn .8s ease-in-out infinite alternate",
                width: "60%" }
     })),
     erroRede && /*#__PURE__*/React.createElement("button", {
       onClick: () => { setCarregando(true); setErroRede(""); window.location.reload(); },
       style: { marginTop: 8, padding: "8px 20px", background: MUN.gold, color: "#000",
                border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }
     }, "🔄 Tentar novamente"));

  if (!user) return /*#__PURE__*/React.createElement(LoginPage, {
    onLogin: setUser
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      minHeight: "100vh",
      fontFamily: "'Inter',system-ui,sans-serif",
      background: dark ? T.appBgDark : T.appBg,
      backgroundAttachment: "fixed"
    }
  }, /*#__PURE__*/React.createElement("style", null, `*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e2d40;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#2d4060}input,select,textarea{font-family:inherit}@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.page-enter{animation:fadeIn .18s ease-out both}@media(max-width:768px){.sidebar-hidden{display:none!important}.main-full{margin-left:0!important}}@media(max-width:640px){.grid-1col{grid-template-columns:1fr!important}}`), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSidebarOpen(o => !o),
    style: {
      position: "fixed", top: 12, left: 12, zIndex: 1000,
      background: MUN.green, border: "none", borderRadius: 8,
      width: 38, height: 38, cursor: "pointer", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,.3)"
    },
    className: "hamburger-btn"
  },
  ...[0,1,2].map(i => /*#__PURE__*/React.createElement("div", { key: i,
    style: { width: 18, height: 2, background: "#fff", borderRadius: 1 }
  }))
),
sidebarOpen && /*#__PURE__*/React.createElement("div", {
  onClick: () => setSidebarOpen(false),
  style: {
    display: "none", position: "fixed", inset: 0,
    background: "rgba(0,0,0,.5)", zIndex: 998
  },
  className: "sidebar-overlay"
}),
/*#__PURE__*/React.createElement(Sidebar, {
    page: page,
    setPage: handleSetPage,
    user: user,
    onLogout: () => setUser(null),
    onSync: handleSync,
    proxNum: nextProcessoNumber,
    dark: dark,
    onToggleDark: () => setDark(d => !d),
    formPct: formPct,
    sbOnline: sbOnline,
    pendentesAtrasados: pendentesAtrasados.length,
    onExportExcel: () => {
      exportarExcel(processos, historico);
      toast("✅ Planilha Excel salva!");
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0
    }
  }, processos.length < 5 && page !== "config" && /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "12px 16px 0",
      padding: "12px 16px",
      background: "#7c2d12",
      borderRadius: 10,
      border: "1.5px solid #ea580c",
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      color: "#fed7aa",
      fontSize: 13
    }
  }, "Nenhum dado importado \u2014 o sistema est\xE1 vazio"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "#fdba74",
      marginTop: 2
    }
  }, "V\xE1 em ", /*#__PURE__*/React.createElement("b", null, "Configura\xE7\xF5es"), " e clique em ", /*#__PURE__*/React.createElement("b", null, "Selecionar Excel (.xlsx)"), " para importar a planilha de processos. Sem isso os campos do PDF ficam em branco.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleSetPage("config"),
    style: {
      background: "#ea580c",
      color: "#fff",
      border: "none",
      borderRadius: 7,
      padding: "7px 14px",
      fontWeight: 700,
      cursor: "pointer",
      fontSize: 12,
      whiteSpace: "nowrap"
    }
  }, "\uD83D\uDCE5 Ir para Configura\xE7\xF5es")), page === "processos" && /*#__PURE__*/React.createElement(NovoProcessoPage, {
    processos: processos,
    orgaosConfig: orgaosConfig,
    onSave: onSave,
    onSaveEdit: onSaveEdit,
    toast: toast,
    dark: dark,
    onPctChange: setFormPct,
    duplicarData: duplicarData,
    onDuplicarConsumed: () => setDuplicarData(null),
    editarData: editarData,
    onEditarConsumed: () => setEditarData(null),
    onShowShortcuts: () => setShowShortcuts(true),
    appConfig: appConfig,
    nextProcessoNumber: nextProcessoNumber,
    user: user,
    onEditModeChange: isEditing => { editModeRef.current = isEditing; }
  }), page === "buscar" && /*#__PURE__*/React.createElement(BuscarPage, {
    processos: processos,
    onCarregar: handleDuplicar,
    onEditar: handleEditar,
    onGerarPDF: handleGerarPDFBusca,
    toast: toast,
    dark: dark,
    user: user
  }), page === "dashboard" && /*#__PURE__*/React.createElement(DashboardPage, {
    processos: processos,
    historico: historico,
    dark: dark,
    appConfig: appConfig,
    toast: toast
  }), page === "historico" && /*#__PURE__*/React.createElement(HistoricoPage, {
    historico: historico,
    dark: dark,
    processos: processos,
    onDuplicar: handleDuplicar,
    onGerarPDF: handleGerarPDFBusca,
    onEditar: h => {
      // buscar o processo completo pelo número
      const proc = processos.find(p => String(p["NÚMERO DO DOCUMENTO"]) === String(h["Processo"]));
      if (proc) {
        handleEditar(proc);
      } else {
        toast("Processo não encontrado em Processos.", "warn");
      }
    },
    truncado: histTruncado
  }), page === "usuarios" && /*#__PURE__*/React.createElement(UsuariosPage, {
    dark: dark,
    toast: toast
  }), page === "orgaos" && /*#__PURE__*/React.createElement(OrgaosPage, {
    processos: processos,
    orgaosConfig: orgaosConfig,
    onOrgaosChange: o => {
      setOrgaosConfig(o);
      ST.set("orgaos_config", o);
    },
    dark: dark,
    toast: toast
  }), page === "config" && /*#__PURE__*/React.createElement(ConfigPage, {
    processos: processos,
    historico: historico,
    orgaosConfig: orgaosConfig,
    appConfig: appConfig,
    setAppConfig: setAppConfig,
    onImport: handleImport,
    onSyncDB: handleSyncDB,
    dark: dark,
    toast: toast,
    user: user,
    onLimparBanco: async () => {
      // Remove blobs legados e chaves individuais
      await Promise.all([
        ST.del("processos"),
        ST.del("historico"),
        ST.del("orgaos_config"),
        ST.del("app_config"),
        ST.del("draft_form"),
        ST.del("imported_max_num"),
        ST.del_prefix("proc_"),
        ST.del_prefix("hist_")
      ]);
      setProcessos([]);
      setHistorico([]);
      setOrgaosConfig({});
      setImportedMaxNum(0);
      toast("🗑️ Banco de dados apagado com sucesso.", "info");
    }
  })), showShortcuts && /*#__PURE__*/React.createElement(ShortcutsModal, {
    onClose: () => setShowShortcuts(false),
    dark: dark
  }),
  /*#__PURE__*/React.createElement(Toast, { toasts: toasts }),
  appConfirmModal && /*#__PURE__*/React.createElement(ConfirmModal, {
    titulo: appConfirmModal.titulo,
    msg: appConfirmModal.msg,
    tipo: appConfirmModal.tipo || "warn",
    dark: dark,
    onOk: appConfirmModal.onOk,
    onCancel: () => setAppConfirmModal(null)
  }));
}
window.App = App;
