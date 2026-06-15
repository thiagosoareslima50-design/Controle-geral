/*
================================================================================
  SISTEMA DE CONTROLE DE PROCESSOS DE PAGAMENTO — React v4.6 (Sync Lock)
  Controladoria Geral · Prefeitura Municipal de João Lisboa / MA
  v5.1.5-20260603 — UX Dashboard: grid 2 colunas, chips/tags, KPI badges, tooltips, paleta dark
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
  ── v4.1 (correções de bugs — auditoria completa) ─────────────────────────────
  [B4.1-01] filtrados (Protocolo/Processos): String() defensivo em todos os
            campos de itensHist e no useMemo filtradosReg — previne TypeError
            ao chamar .toLowerCase() em campos numéricos vindo de Excel
  [B4.1-02] onSaveEdit useCallback([processos]): deps corretas eliminam stale
            closure que tornava a verificação de permissão inoperante — operador
            podia editar processo de qualquer usuário
  [B4.1-03] docx.js: versão unificada para 8.5.0 nos três pontos de carga
            (index.html CDN primário, fallback onerror e loadDocxLib fallback)
            — elimina crash na geração de Word quando SW servia versão antiga
  [B4.1-04] handleSync: substituído Promise.all irrestrito por batching em
            lotes de 30 — previne erro 429 do Supabase com >500 processos
  [B4.1-05] gerarRelatorioPDF: validação de mesAno antes do split("/") —
            previne TypeError "Cannot read properties of undefined"
  [B4.1-06] audit_* limpeza automática: mantém apenas os 200 registros mais
            recentes de auditoria para não saturar o storage
  [B4.1-07] filtro PENDENTE unificado: HistoricoPage usa a mesma lógica de
            BuscaPage (!h["_decisao"]) — elimina divergência nos contadores
  [B4.1-08] nextProcessoNumber: localStorage movido para useEffect + ref —
            elimina leitura de DOM síncrona dentro de useMemo
  ── v4.2 (correções residuais) ───────────────────────────────────────────────
  [R1] handleImprimir: URL não é revogada quando fallback window.open é acionado
       — previne PDF em branco na aba aberta; timeout 60s → 5min
  [R2] pendentesAtrasados: verificação dupla (_decisao + Decisão) elimina badge
       vermelho falso positivo na sidebar para processos já decididos
  ── v4.3 (hardening final) ───────────────────────────────────────────────────
  [P1] parseInt(mes, 10) no relatório PDF — base explícita, elimina risco de
       interpretação octal em "08"/"09" por engines não-ES6
  [P2] parseInt(v, 10) e parseInt(JSON.parse(local), 10) em _nextProtocoloNum —
       mesma correção de base explícita na sequência de protocolos
  [P3] canonW (Web Worker de importação Excel): lógica igualada a canonCol —
       tratamento especial de "Nº" e busca case-insensitive adicionados;
       elimina divergência de reconhecimento de colunas entre Worker e importador síncrono
  ── v4.4 (hardening de sincronização — 3 usuários simultâneos) ───────────────
  [FIX-SYNC-BLOB]    salvarProcessos/salvarHistorico removidos como gravadores
                     de blob global — gravavam "processos"/"historico" inteiros
                     criando race condition clássica (User A sobrescreve User B).
                     Agora apenas atualizam estado React local; chaves atômicas
                     proc_/hist_ são a única fonte de gravação no Supabase.
  [FIX-STALE-CLOSURE] onSaveEdit verificava dono do processo em `processos`
                      (closure desatualizado). Com 3 usuários, o processo pode
                      ter mudado desde o último refresh. Agora lê diretamente
                      ST.get(`proc_NUM`) antes de verificar.
  [FIX-IMPORT-ATOMIC] handleImport chamava salvarProcessos(merged) que gravava
                      blob inteiro. Agora grava cada proc individualmente via
                      runBatch de proc_NUM — consistente com o resto do sistema.
  [FIX-SYNCDB-ATOMIC] handleSyncDB idem: grava atomicamente proc_/hist_ em vez
                      de usar salvarProcessos/salvarHistorico (que não gravam mais).
  [FIX-SYNC-ORGAOS]  salvarOrgaos agora chama _incrementarVersao() para
                     notificar outros clientes sobre mudanças de configuração.
  [FIX-DUPLICATA-REMOTA] handleSalvar faz ST.get(`proc_NUM`) antes de salvar —
                         detecta número ocupado simultaneamente por outro usuário
                         e oferece o próximo disponível automaticamente.
  ── v4.5 (latência e sincronização — auditoria completa) ─────────────────────
  [PERF-PARALLEL-SAVE]    onSave/onSaveEdit gravavam proc_NUM e hist_NUM em
                          sequência (await + await = 2× round-trip ~800ms).
                          Agora em Promise.all paralelo (~400ms).
  [PERF-OPTIMISTIC-UPDATE] onSave/onSaveEdit chamavam loadAllCombined (4
                           chamadas de rede) após cada save. Substituído por
                           atualização otimista do estado local. O polling de
                           20s garante consistência. Economiza 4 chamadas e
                           ~400-800ms por save.
  [FIX-WRITE-QUEUE]       ST.set sem serialização podia intercalar escritas
                          concorrentes para a mesma chave de config (users,
                          orgaos_config, app_config). Fila por chave resolve.
  [FIX-REFRESH-OVERLAP]   setInterval iniciava novo refresh mesmo com o
                          anterior ainda em execução (rede lenta = chamadas
                          duplicadas + race condition no setState).
================================================================================
*/

// ─── React hooks — extraídos do UMD global para uso sem prefixo ───────────────
var { useState, useEffect, useCallback, useMemo, useRef } = React;

// Injetar CSS responsivo global
(function() {
  const style = document.createElement("style");
  style.textContent = `
    @media (max-width: 640px) {
      .cgel-ident-row { grid-template-columns: 1fr !important; }
      .cgel-kpi-grid  { grid-template-columns: repeat(2,1fr) !important; }
      .cgel-form-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 900px) {
      .hamburger-btn { display: flex !important; }
    }
    @media (min-width: 901px) {
      .hamburger-btn { display: none !important; }
    }
    .cgel-sidebar-overlay {
      display: none;
    }
    @media (max-width: 900px) {
      .cgel-sidebar-overlay { display: block; position: fixed; inset: 0;
        background: rgba(0,0,0,.5); z-index: 998; }
    }
    .cgel-sidebar-mobile {
      position: fixed !important; left: 0; top: 0; height: 100vh;
      z-index: 999; box-shadow: 4px 0 24px rgba(0,0,0,.4);
    }
    @keyframes cgel-slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
    .cgel-sidebar-mobile { animation: cgel-slide-in .2s cubic-bezier(.22,1,.36,1); }
  `;
  document.head.appendChild(style);
})();

// ─── canonCol — normaliza cabeçalhos de planilha para nomes canônicos ─────────
// Usada em importarExcel (síncrono) e readSqliteDB. O Worker usa canonW (cópia interna).
function _normColStr(raw) {
  return String(raw).trim().toUpperCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();
}
function canonCol(raw) {
  const n = _normColStr(raw);
  if (COL_CANON[n]) return COL_CANON[n];
  // Tratamento especial "Nº" literal
  const t = String(raw).trim();
  if (t === "Nº" || t === "Nº" || t === "N°" || t === "Nº") return "Nº";
  // Fallback: busca case-insensitive
  const nl = n.toLowerCase();
  for (const k of Object.keys(COL_CANON)) {
    if (k.toLowerCase() === nl) return COL_CANON[k];
  }
  return raw;
}


// SheetJS (Excel) — carregado via CDN como window.XLSX (não redeclarar aqui)
// XLSX está disponível como variável global via CDN no index.html



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
// [ Sugestão 3 ] Storage e Configurações movidos para /src/storage.js e /src/constants.js
// ST, _sb e constantes agora são carregados globalmente pelo index.html

// ─── [ATOM] Carregadores atômicos ─────────────────────────────────────────────
//
// [FIX-CONC1] Extração das funções de montagem para permitir loadAllCombined():
// quando processos + histórico são carregados juntos (onSave, refresh, etc.),
// proc_ e processos eram buscados DUAS vezes (1x em loadAllProcessos + 1x em
// loadAllHistorico) = 6 chamadas Supabase onde deveriam ser 4.
// Com loadAllCombined() são sempre 4 chamadas paralelas, independente do número
// de usuários simultâneos.

// Auxiliar compartilhado: converte registro de processo em linha de histórico
function _procToHist(p) {
  const tipoKey = p["_tipoKey"] || "";
  const dec = p["_decisao"];
  const dataExt = dtExt(formatData(p["DATA"] || p["Data"] || p["data"] || ""));
  return {
    "Processo":            p["NÚMERO DO DOCUMENTO"] || "",
    "Data":                dataExt,
    "Órgão":               p["ORGÃO"] || "",
    "Fornecedor":          p["FORNECEDOR"] || "",
    "Valor":               p["VALOR"] || "",
    "Tipo":                tipoKey ? (TINFO[tipoKey]?.label || tipoKey) : "",
    "TipoKey":             tipoKey,
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
}

function _buildProcessosFromData(atomProcs, procBlob, atomHist, histBlob, tableHist) {
  const map = new Map();
  const merge = (item) => {
    if (!item) return;
    const k = String(item["NÚMERO DO DOCUMENTO"] || item["Processo"] || "").trim();
    if (!k) return;
    // hRow salvos no tableHist já contêm as chaves de processo (NÚMERO DO DOCUMENTO, ORGÃO, etc.)
    // então o merge direto funciona para restaurar o estado de busca.
    map.set(k, { ...(map.get(k) || {}), ...item });
  };

  if (Array.isArray(histBlob)) histBlob.forEach(h => merge(h));
  if (Array.isArray(atomHist)) atomHist.forEach(r => merge(r.value));
  if (Array.isArray(tableHist)) tableHist.forEach(h => merge(h));
  if (Array.isArray(procBlob)) procBlob.forEach(p => merge(p));
  if (Array.isArray(atomProcs)) atomProcs.forEach(r => merge(r.value));

  return [...map.values()].sort((a, b) => {
    const na = parseInt(String(a["NÚMERO DO DOCUMENTO"] || "0"), 10);
    const nb = parseInt(String(b["NÚMERO DO DOCUMENTO"] || "0"), 10);
    const valA = isNaN(na) ? 0 : na;
    const valB = isNaN(nb) ? 0 : nb;
    if (valA !== valB) return valB - valA;
    const strA = String(a["NÚMERO DO DOCUMENTO"] || "");
    const strB = String(b["NÚMERO DO DOCUMENTO"] || "");
    return strB > strA ? 1 : (strB < strA ? -1 : 0);
  });
}

function _buildHistoricoFromData(atomProcs, procBlob, atomHist, histBlob, tableHist) {
  const map = new Map();
  const merge = (item, isProc = false) => {
    if (!item) return;
    const k = String(item["Processo"] || item["NÚMERO DO DOCUMENTO"] || "").trim();
    if (!k) return;
    const base = isProc ? _procToHist(item) : item;
    map.set(k, { ...(map.get(k) || {}), ...base, "Processo": k });
  };
  if (Array.isArray(procBlob)) procBlob.forEach(p => merge(p, true));
  if (Array.isArray(atomProcs)) atomProcs.forEach(r => merge(r.value, true));
  if (Array.isArray(histBlob)) histBlob.forEach(h => merge(h));
  // [FIX-HIST-PRIORITY] tableHist (cgel_historico) processado ANTES de atomHist (hist_):
  // hist_ do cgel_store é sempre mais recente (atualizado em cada save/edit),
  // portanto deve vencer sobre cgel_historico para eliminar divergência entre abas.
  if (Array.isArray(tableHist)) tableHist.forEach(h => merge(h));
  if (Array.isArray(atomHist)) atomHist.forEach(r => merge(r.value));

  return [...map.values()].sort((a, b) => {
    const na = parseInt(String(a["Processo"] || "0"), 10);
    const nb = parseInt(String(b["Processo"] || "0"), 10);
    const valA = isNaN(na) ? 0 : na;
    const valB = isNaN(nb) ? 0 : nb;
    if (valA !== valB) return valB - valA;
    const strA = String(a["Processo"] || "");
    const strB = String(b["Processo"] || "");
    return strB > strA ? 1 : (strB < strA ? -1 : 0);
  });
}

async function loadAllProcessos() {
  const [atomProcs, procBlob, atomHist, histBlob, tableHist] = await Promise.all([
    ST.list("proc_"), ST.get("processos"), ST.list("hist_"), ST.get("historico"), ST.listHistorico()
  ]);
  return _buildProcessosFromData(atomProcs, procBlob, atomHist, histBlob, tableHist);
}

async function loadAllHistorico() {
  const [atomProcs, procBlob, atomHist, histBlob, tableHist] = await Promise.all([
    ST.list("proc_"), ST.get("processos"), ST.list("hist_"), ST.get("historico"), ST.listHistorico()
  ]);
  return _buildHistoricoFromData(atomProcs, procBlob, atomHist, histBlob, tableHist);
}

async function loadAllCombined() {
  const [atomProcs, procBlob, atomHist, histBlob, tableHist] = await Promise.all([
    ST.list("proc_"), ST.get("processos"), ST.list("hist_"), ST.get("historico"), ST.listHistorico()
  ]);
  return {
    processos: _buildProcessosFromData(atomProcs, procBlob, atomHist, histBlob, tableHist),
    historico:  _buildHistoricoFromData(atomProcs, procBlob, atomHist, histBlob, tableHist)
  };
}

// [ Sugestão 3 ] Funções auxiliares, Constantes e Status movidos para /src/storage.js, /src/constants.js e /src/helpers.js
// Estes agora são carregados globalmente pelo index.html

// ─── [v4.0-E / v4.0-I] Controle de versão do banco para sync multi-usuário ───
// _incrementarVersao(): grava um timestamp em "_versao_banco" → dispara evento
//   realtime nos outros clientes e serve de ETag para o polling de 60s.
// _versaoBancoCambou(): compara o valor atual com o último lido; retorna true
//   quando outro usuário salvou algo desde o último polling.
let _ultVersaoBanco = null;
async function _incrementarVersao() {
  const ts = Date.now();
  await ST.set("_versao_banco", ts);
  return ts;
}
async function _versaoBancoCambou() {
  try {
    const v = await ST.get("_versao_banco");
    if (v === null) return false;
    const changed = _ultVersaoBanco !== null && v !== _ultVersaoBanco;
    _ultVersaoBanco = v;
    return changed;
  } catch { return false; }
}

// ─── [AUTO-NUM] Alocação atômica de número de processo ────────────────────────
// Garante numeração sequencial sem lacunas e sem colisão em acesso simultâneo.
//
// Algoritmo (otimistic-claim):
//  1. Lê processo_seq (maior número já alocado no banco) e os processos locais.
//  2. Calcula candidato = max(seq, maior_local) + 1, pulando usados.
//  3. Escreve placeholder de reserva em proc_{candidato} com token de sessão único.
//  4. Aguarda 80 ms (janela de concorrência) e relê proc_{candidato}.
//  5. Se o token é o nosso → ganhamos. Atualiza processo_seq e retorna.
//  6. Caso contrário (outro usuário venceu) → incrementa e repete até MAX_TENT.
//
// O placeholder é substituído pelo dado real em ST.set(`proc_${num}`, novoItem)
// na sequência normal do save, portanto não há lixo no banco.

const _SESSAO_ID = `s${Date.now()}_${Math.random().toString(36).slice(2)}`;

async function _alocarNumeroAtomico(processosAtuais) {
  const MAX_TENT = 8;
  for (let t = 0; t < MAX_TENT; t++) {
    const usados = new Set(
      (processosAtuais || [])
        .map(p => parseInt(String(p["NÚMERO DO DOCUMENTO"] || "").trim(), 10))
        .filter(n => !isNaN(n) && n > 0 && n < 99999)
    );
    let cand = usados.size ? Math.max(...usados) + 1 : 1;
    if (!isFinite(cand) || cand < 1) cand = 1;
    while (usados.has(cand) && cand < 99999) cand++;

    // Lê sequência e candidato em paralelo (economiza 1 RTT)
    const [seqBanco, jaExisteInicial] = await Promise.all([
      ST.get("processo_seq"),
      ST.get(`proc_${cand}`)
    ]);
    const seq = (typeof seqBanco === "number" && seqBanco > 0) ? seqBanco : 0;

    // Se sequência do banco é maior, avança cand e RE-LÊ para o novo slot
    // (evita usar jaExiste do slot anterior — bug que causava loop infinito)
    let jaExiste = jaExisteInicial;
    if (seq >= cand) {
      cand = seq + 1;
      while (usados.has(cand) && cand < 99999) cand++;
      jaExiste = await ST.get(`proc_${cand}`);
    }

    // Slot ocupado: dados reais OU placeholder de outra sessão → pula
    if (jaExiste) {
      if (!jaExiste._reservado) {
        // Dado real: atualiza seq e pula
        await ST.set("processo_seq", cand).catch(() => {});
      }
      // Placeholder de outra sessão: não sobrescreve — incrementa cand e tenta o próximo
      cand++;
      while (usados.has(cand) && cand < 99999) cand++;
      continue;
    }

    // Tenta reservar o slot (proc_cand estava null)
    await ST.set(`proc_${cand}`, { _reservado: true, _sessao: _SESSAO_ID, _ts: Date.now() });
    await new Promise(r => setTimeout(r, 80 + t * 40));
    const leitura = await ST.get(`proc_${cand}`);
    if (leitura && leitura._reservado && leitura._sessao === _SESSAO_ID) {
      await ST.set("processo_seq", cand).catch(() => {});
      return cand;
    }
    // Outro usuário venceu → seqBanco no próximo loop pega número acima
  }
  throw new Error(`Não foi possível alocar número único após ${MAX_TENT} tentativas.`);
}

// ─── MapData ──────────────────────────────────────────────────────────────────
// [M-P2] Cache: só recalcula quando o array de processos realmente muda
let _mapDataCache = null;
let _mapDataKey = null;
function _mapDataHash(processos) {
  if (!processos.length) return "0:";
  // Hash por conteúdo real: detecta edições no meio do array
  let h = processos.length + ":";
  for (let i = 0; i < processos.length; i++) {
    const p = processos[i];
    h += (p["NÚMERO DO DOCUMENTO"]||"") + "|" + (p["FORNECEDOR"]||"") + "|" + (p["VALOR"]||"") + ";";
    if (h.length > 2000) { h += i; break; } // limite para não explodir em bases grandes
  }
  return h;
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
    // Mapas inversos para auto-fill por contrato
    contratoForn: dct("CONTRATO", "FORNECEDOR"),
    contratoOrgao: dct("CONTRATO", "ORGÃO"),
    contratoModal: dct("CONTRATO", "MODALIDADE"),
    contratoObjeto: dct("CONTRATO", "OBJETO"),
    // Mapa inverso: secretário → órgão
    secretarioOrgao: dct("SECRETARIO", "ORGÃO"),
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
        if (!isNaN(n) && n > 0 && n < 99999) {
          if (n > lastNum) lastNum = n; // Correção: mantém o MAIOR número encontrado, suportando planilhas em ordem decrescente
        }
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
      "ORGAO": "ORGÃO",
      "SECRETARIA ORGAO": "ORGÃO",
      "ORGAO SECRETARIA": "ORGÃO",
      "UNIDADE": "ORGÃO",
      "DEPARTAMENTO": "ORGÃO",
      "SECRETARIA MUNICIPAL": "ORGÃO",
      "SECRETARIO": "SECRETARIO",
      "ORDENADOR": "SECRETARIO",
      "GESTOR": "SECRETARIO",
      "RESPONSAVEL": "SECRETARIO",
      "ORDENADOR DE DESPESA": "SECRETARIO",
      "FORNECEDOR": "FORNECEDOR",
      "EMPRESA": "FORNECEDOR",
      "CREDOR": "FORNECEDOR",
      "RAZAO SOCIAL": "FORNECEDOR",
      "NOME": "FORNECEDOR",
      "BENEFICIARIO": "FORNECEDOR",
      "CNPJ": "CNPJ",
      "CPF": "CNPJ",
      "CNPJ/CPF": "CNPJ",
      "CPF/CNPJ": "CNPJ",
      "CNPJ CPF": "CNPJ",
      "CPF CNPJ": "CNPJ",
      "INSCRICAO": "CNPJ",
      "MODALIDADE": "MODALIDADE",
      "MODALIDADE LICITACAO": "MODALIDADE",
      "TIPO LICITACAO": "MODALIDADE",
      "CONTRATO": "CONTRATO",
      "NUMERO CONTRATO": "CONTRATO",
      "N CONTRATO": "CONTRATO",
      "NO CONTRATO": "CONTRATO",
      "CONTRATO N": "CONTRATO",
      "OBJETO": "OBJETO",
      "DESCRICAO": "OBJETO",
      "DESCRICAO DO OBJETO": "OBJETO",
      "SERVICO": "OBJETO",
      "PRODUTO": "OBJETO",
      "DESCRICAO SERVICO": "OBJETO",
      "VALOR": "VALOR",
      "VALOR TOTAL": "VALOR",
      "VALOR PAGO": "VALOR",
      "VALOR LIQUIDO": "VALOR",
      "VALOR BRUTO": "VALOR",
      "MONTANTE": "VALOR",
      "NO": "Nº",
      "N°": "Nº",
      "NF": "Nº",
      "NUMERO NF": "Nº",
      "NO NF": "Nº",
      "NF/FATURA": "Nº",
      "NUMERO DA NF": "Nº",
      "NUMERO NOTA": "Nº",
      "NOTA FISCAL": "Nº",
      "NUMERO DOCUMENTO FISCAL": "Nº",
      "FATURA": "Nº",
      "NUMERO FATURA": "Nº",
      "TIPO": "TIPO",
      "TIPO NF": "TIPO",
      "TIPO NOTA": "TIPO",
      "TIPO DOCUMENTO FISCAL": "TIPO",
      "ESPECIE": "TIPO",
      "DOCUMENTO FISCAL": "DOCUMENTO FISCAL",
      "DOC FISCAL": "DOCUMENTO FISCAL",
      "TIPO DOCUMENTO": "DOCUMENTO FISCAL",
      "ESPECIE DOCUMENTO": "DOCUMENTO FISCAL",
      "DATA NF": "DATA NF",
      "DATA DA NF": "DATA NF",
      "DATA NOTA": "DATA NF",
      "DATA EMISSAO": "DATA NF",
      "EMISSAO": "DATA NF",
      "NUMERO DO DOCUMENTO": "NÚMERO DO DOCUMENTO",
      "PROCESSO": "NÚMERO DO DOCUMENTO",
      "NUMERO PROCESSO": "NÚMERO DO DOCUMENTO",
      "N PROCESSO": "NÚMERO DO DOCUMENTO",
      "PROTOCOLO": "NÚMERO DO DOCUMENTO",
      "NUMERO": "NÚMERO DO DOCUMENTO",
      "PERIODO DE REFERENCIA": "PERÍODO DE REFERÊNCIA",
      "PERIODO": "PERÍODO DE REFERÊNCIA",
      "COMPETENCIA": "PERÍODO DE REFERÊNCIA",
      "REFERENCIA": "PERÍODO DE REFERÊNCIA",
      "MES REFERENCIA": "PERÍODO DE REFERÊNCIA",
      "N° ORDEM DE COMPRA": "N° ORDEM DE COMPRA",
      "ORDEM DE COMPRA": "N° ORDEM DE COMPRA",
      "N ORDEM": "N° ORDEM DE COMPRA",
      "ORDEM": "N° ORDEM DE COMPRA",
      "NUMERO ORDEM": "N° ORDEM DE COMPRA",
      "OC": "N° ORDEM DE COMPRA",
      "NOME FANTASIA": "NOME FANTASIA",
      "FANTASIA": "NOME FANTASIA",
      "APELIDO": "NOME FANTASIA",
      "SOLICITANTE": "SOLICITANTE",
      "CPF BENEFICIARIO": "CPF_BENEFICIARIO",
      "OBSERVACAO": "_obs",
      "OBS": "_obs",
      "NOTAS": "NOTAS",
      "NOTA INTERNA": "NOTAS",
      "DATA": "DATA",
      "DATA ATESTE": "DATA",
      "DATA DO ATESTE": "DATA"
    };
    const normW = c => {
      let s = String(c).trim().toUpperCase().replace(/[\u00C0-\u017E]/g, m =>
        "AAAAACEEEEIIIIDNOOOOOUUUUYBSS"["ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞSS".indexOf(m)] || m
      ).replace(/\s+/g," ").trim();
      return s;
    };
    const canonW = raw => {
      const n = normW(raw);
      // [P3 FIX] Busca exata primeiro
      if (COL_CANON_WORKER[n]) return COL_CANON_WORKER[n];
      // Tratamento especial do "Nº" literal (cabeçalho mais comum nas planilhas)
      const trimmed = String(raw).trim();
      if (trimmed === "N\u00BA" || trimmed === "N\u00ba" || trimmed === "N°") return "N\u00BA";
      // Busca case-insensitive como fallback (captura variações não mapeadas)
      const nl = n.toLowerCase();
      for (const k of Object.keys(COL_CANON_WORKER)) {
        if (k.toLowerCase() === nl) return COL_CANON_WORKER[k];
      }
      return raw;
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
          if (!isNaN(n) && n > 0 && n < 99999) {
            if (n > lastNum) lastNum = n; // Correção: mantém o maior número em planilhas decrescentes
          }
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
  if (window.jspdf) { _jspdf = window.jspdf; return _jspdf; }
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => window.jspdf ? (_jspdf = window.jspdf, res(_jspdf)) : rej(new Error("jsPDF não carregou"));
    s.onerror = () => rej(new Error("Falha ao carregar jsPDF"));
    document.head.appendChild(s);
  });
}

// ─── docx.js loader ───────────────────────────────────────────────────────────
let _docxLib = null;
// docx.js carregado via CDN no index.html
async function loadDocxLib() {
  if (_docxLib) return _docxLib;
  // Usar docx já carregado via CDN no index.html
  if (window.docx) { _docxLib = window.docx; return _docxLib; }
  return new Promise((res, rej) => {
    if (window.docx) {
      _docxLib = window.docx;
      res(_docxLib);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";
    s.onload = () => window.docx ? (_docxLib = window.docx, res(_docxLib)) : rej(new Error("docx.js não carregou"));
    s.onerror = () => rej(new Error("Falha ao carregar docx.js"));
    document.head.appendChild(s);
  });
}


// ─── [M-AU3/G-R1] Relatório mensal PDF ───────────────────────────────────────
async function gerarRelatorioPDF(processos, mesAno, appConfig) {
  try {
    const lib = await loadJsPDF();
    if (!lib) return { error: "jsPDF não disponível." };
    const { jsPDF } = lib;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210, fv = v => v && String(v).trim() ? String(v).trim() : "—";
    const ML2 = 14;
    const HDR_H = 22;

    function drawHdr(doc) {
      doc.setFillColor(0, 96, 0);
      doc.rect(0, 0, W, HDR_H, "F");
      try { doc.addImage(window.BRASAO_B64, "PNG", ML2, 1.5, 20, 17, "BH_REL"); } catch(e) {}
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
      doc.text("ESTADO DO MARANHÃO", ML2 + 20, 7.5);
      doc.text("PREFEITURA MUNICIPAL DE JOÃO LISBOA", ML2 + 20, 12.5);
      doc.setFontSize(9);
      doc.text("CONTROLADORIA GERAL DO MUNICÍPIO - CGM", ML2 + 20, 17.5);
    }

    // Filtrar processos do mês (somente se mesAno for fornecido no formato MM/AAAA)
    let filtrados = processos;
    let tituloRelatorio = "";
    let mes = "";
    let ano = "";

    if (mesAno && mesAno.includes("/")) {
      const parts = mesAno.split("/");
      mes = parts[0];
      ano = parts[1];
      const chave = `${ano}-${mes.padStart(2,"0")}`;
      filtrados = processos.filter(p => {
        const raw = String(p["DATA"] || "");
        if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return (raw.slice(6,10)+"-"+raw.slice(3,5)) === chave;
        if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0,7) === chave;
        return false;
      });
      const nomeMes = ["","JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
        "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
      tituloRelatorio = `RELATÓRIO MENSAL DE PAGAMENTOS — ${nomeMes[parseInt(mes, 10)] || mes}/${ano}`;
    } else {
      // Se não houver mês específico, usa o título personalizado ou um padrão
      tituloRelatorio = mesAno ? String(mesAno).toUpperCase() : "RELATÓRIO DE PAGAMENTOS FILTRADOS";
      if (!tituloRelatorio.includes("PAGAMENTOS")) {
        tituloRelatorio = "RELATÓRIO DE PAGAMENTOS — " + tituloRelatorio;
      }
    }

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

    // Primeiro cabeçalho
    drawHdr(doc);
    let y = HDR_H + 8;

    // Caixa de título verde (Ateste/Parecer style)
    const titLines = doc.splitTextToSize(tituloRelatorio, W - 38);
    const titH = Math.max(12, titLines.length * 5.8 + 6);
    doc.setFillColor(0, 96, 0);
    doc.rect(19, y, W - 38, titH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
    const titBase = y + (titH - (titLines.length - 1) * 5.8) / 2 + 3.2;
    titLines.forEach(function(l, li) {
      doc.text(l, W / 2, titBase + li * 5.8, { align: "center" });
    });
    y += titH + 8;

    // ── Sumário (Ateste/Parecer style) ──
    doc.setFontSize(10);
    [
      ["Total de processos:", filtrados.length.toString()],
      ["Deferidos:", filtrados.filter(p=>p["_decisao"]==="deferir").length.toString()],
      ["Indeferidos:", filtrados.filter(p=>p["_decisao"]==="indeferir").length.toString()],
      ["Pendentes:", filtrados.filter(p=>!p["_decisao"]).length.toString()],
      ["Valor total:", fmtBRL(totalGeral)]
    ].forEach(([l,v], ri) => {
      // Alinha no layout com caixa de fundo suave alternada
      const rH = 7;
      doc.setFillColor(ri % 2 === 0 ? 235 : 245, ri % 2 === 0 ? 248 : 252, ri % 2 === 0 ? 235 : 245);
      doc.setDrawColor(185, 225, 185); doc.setLineWidth(0.15);
      doc.rect(19, y - 4.5, W - 38, rH, "FD");

      doc.setFont("helvetica","bold"); doc.setTextColor(0, 80, 0);
      doc.text(l, 25, y);
      doc.setFont("helvetica","normal"); doc.setTextColor(20, 20, 20);
      doc.text(v, 85, y);
      y += rH;
    });

    // ── Tabela por órgão (Ateste/Parecer style) ──
    y += 6;
    doc.setFillColor(0, 96, 0);
    doc.rect(19, y - 4.5, W - 38, 7.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text("Órgão / Secretaria", 22, y);
    doc.text("Qtd", 118, y, { align: "right" });
    doc.text("Deferidos", 138, y, { align: "right" });
    doc.text("Total R$", W-22, y, { align: "right" });
    y += 4.5;

    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    Object.entries(porOrgao).sort(([,a],[,b])=>b.total-a.total).forEach(([org, dados], ri) => {
      const orgLines = doc.splitTextToSize(org, 85);
      const rH = Math.max(6.2, orgLines.length * 4.2 + 2);
      if (y + rH > 275) {
        doc.addPage();
        drawHdr(doc);
        y = 32;
        doc.setFillColor(0, 96, 0);
        doc.rect(19, y - 4.5, W - 38, 7.5, "F");
        doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
        doc.text("Órgão / Secretaria", 22, y);
        doc.text("Qtd", 118, y, { align: "right" });
        doc.text("Deferidos", 138, y, { align: "right" });
        doc.text("Total R$", W-22, y, { align: "right" });
        y += 4.5;
        doc.setFont("helvetica","normal"); doc.setFontSize(9);
      }
      doc.setFillColor(ri % 2 === 0 ? 230 : 242, ri % 2 === 0 ? 245 : 250, ri % 2 === 0 ? 230 : 242);
      doc.setDrawColor(180, 220, 180); doc.setLineWidth(0.2);
      doc.rect(19, y - 4.2, W - 38, rH, "FD");

      doc.setTextColor(20, 20, 20);
      orgLines.forEach((line, index) => {
        doc.text(line, 22, y + index * 4.2);
      });
      doc.text(dados.n.toString(), 118, y, { align: "right" });
      doc.text(dados.def.toString(), 138, y, { align: "right" });
      doc.text(fmtBRL(dados.total), W-22, y, { align: "right" });
      y += rH;
    });

    y += 2;
    doc.setFillColor(200, 235, 200); doc.setDrawColor(180, 220, 180); doc.setLineWidth(0.25);
    doc.rect(19, y - 4.2, W - 38, 7, "FD");
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(0, 80, 0);
    doc.text("TOTAL GERAL", 22, y + 0.8);
    doc.text(filtrados.length.toString(), 118, y + 0.8, { align: "right" });
    doc.text(fmtBRL(totalGeral), W-22, y + 0.8, { align: "right" });
    y += 12;

    // ── Lista de processos (Ateste/Parecer style) ──
    if (y > 250) { doc.addPage(); drawHdr(doc); y = 32; }
    doc.setFillColor(0, 96, 0);
    doc.rect(19, y - 4.5, W - 38, 7.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    doc.text("Nº", 22, y); doc.text("Fornecedor", 32, y);
    doc.text("Valor", W-50, y, { align: "right" }); doc.text("Decisão", W-22, y, { align: "right" });
    y += 4.5;

    doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
    filtrados.forEach((p, ri) => {
      if (y > 270) {
        doc.addPage();
        drawHdr(doc);
        y = 32;
        doc.setFillColor(0, 96, 0);
        doc.rect(19, y - 4.5, W - 38, 7.5, "F");
        doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
        doc.text("Nº", 22, y); doc.text("Fornecedor", 32, y);
        doc.text("Valor", W-50, y, { align: "right" }); doc.text("Decisão", W-22, y, { align: "right" });
        y += 4.5;
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      }
      const rH = 5.5;
      doc.setFillColor(ri % 2 === 0 ? 235 : 245, ri % 2 === 0 ? 248 : 252, ri % 2 === 0 ? 235 : 245);
      doc.setDrawColor(185, 225, 185); doc.setLineWidth(0.15);
      doc.rect(19, y - 3.8, W - 38, rH, "FD");

      doc.setTextColor(20, 20, 20);
      doc.text(String(p["NÚMERO DO DOCUMENTO"]||""), 22, y);
      doc.text((p["FORNECEDOR"]||"").slice(0,48), 32, y);
      doc.text(fmtBRL(parseBRL(p["VALOR"])), W-50, y, { align: "right" });
      const dec = p["_decisao"]==="deferir"?"DEF":p["_decisao"]==="indeferir"?"INDEF":"PEND";
      
      if (dec === "DEF") doc.setTextColor(22, 163, 74);
      else if (dec === "INDEF") doc.setTextColor(220, 38, 38);
      else doc.setTextColor(217, 119, 6);
      doc.setFont("helvetica","bold");
      doc.text(dec, W-22, y, { align: "right" });
      doc.setFont("helvetica","normal");

      y += rH;
    });

    // ── Assinatura (Ateste/Parecer style) ──
    if (y > 240) { doc.addPage(); drawHdr(doc); y = 32; }
    y += 12;
    const ctrlNome = fv(ctrl.nome) || "";
    const ctrlCargo = fv(ctrl.cargo) || "";
    const ctrlPortaria = fv(ctrl.portaria) || "";
    const hoje = new Date();
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(`João Lisboa/MA, ${hoje.getDate()} de ${["","janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][hoje.getMonth()+1]} de ${hoje.getFullYear()}`, W-19, y, { align: "right" });
    y += 16;
    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.4);
    doc.line(W/2 - 35, y, W/2 + 35, y);
    y += 5.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(0, 0, 0);
    doc.text(ctrlNome, W/2, y, { align: "center" });
    y += 5; doc.text(ctrlCargo, W/2, y, { align: "center" });
    if (ctrlPortaria) { y += 5; doc.text(ctrlPortaria, W/2, y, { align: "center" }); }

    // ── Rodapé (Ateste/Parecer style) ──
    const totalPgs = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= totalPgs; pg++) {
      doc.setPage(pg);
      doc.setFillColor(0, 96, 0);
      doc.rect(0, 297 - 12, W, 12, "F");
      // Pin (círculo duplo branco)
      doc.setFillColor(255, 255, 255); doc.circle(16, 297 - 6, 2.6, "F");
      doc.setFillColor(0, 96, 0);  doc.circle(16, 297 - 6, 1.3, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(255, 255, 255);
      doc.text(FOOTER_TXT, W / 2 + 4, 297 - 4, { align: "center" });
      doc.text(`Pág. ${pg}/${totalPgs}`, W - 19, 297 - 4, { align: "right" });
    }

    const blob = doc.output("blob");
    const reportName = `relatorio_${(mesAno || "geral").replace(/[\/\\?%*:|"<>\s]+/g, "_")}.pdf`;
    return { blob, name: reportName };
  } catch (e) {
    console.error("[gerarRelatorioPDF] Erro ao gerar PDF:", e);
    return { error: e.message || "Erro ao gerar PDF do relatório." };
  }
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
      doc.text("PREFEITURA MUNICIPAL DE JOÃO LISBOA", W / 2, y, {
        align: "center"
      });
      y += 5;
      doc.text("CONTROLADORIA GERAL DO MUNICÍPIO - CGM", W / 2, y, {
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
    // PÁGINA 1 — CAPA  (layout v5.1.5 — fiel ao modelo)
    // ═══════════════════════════════════════════════════
    const CML = 19, CCW = 172;
    y = cabecalho(doc, false) + 3;

    // Separador duplo verde abaixo do cabeçalho institucional (mesmo verde do ateste)
    doc.setDrawColor(0, 96, 0); doc.setLineWidth(0.85);
    doc.line(CML, y, CML + CCW, y); y += 2.5;
    doc.setLineWidth(0.22);
    doc.line(CML, y, CML + CCW, y); y += 7;

    // Banner verde preenchido "PROCESSO DE PAGAMENTO" (mesmo verde do ateste)
    doc.setFillColor(0, 96, 0);
    doc.rect(CML, y, CCW, 14, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(255, 255, 255);
    doc.text("PROCESSO DE PAGAMENTO", CML + CCW / 2, y + 10, { align: "center" });
    y += 14 + 10;

    // Campos — Com caixas e fundo alternado (igual ao ateste)
    const capaRows = [
      ["Org\u00e3o:", fv(d.orgao)],
      ["Processo:", fv(d.processo)],
      ["Fornecedor:", fv(d.fornecedor)],
      ["CNPJ:", fv(d.cnpj)],
      ["NF/Fature:", fv(d.nf)],
      ["Contrato:", fv(d.contrato)],
      ["Modalidade:", fv(d.modalidade)],
      ["Per\u00edodo de ref.:", fv(d.periodo_ref)],
      ["N\u00b0 Ordem de C.:", fv(d.ordem_compra || "")],
      ["Data da NF.:", fv(d.data_nf)],
      ["Secret\u00e1rio(a):", fv(d.secretario)],
      ["Data do Ateste:", fv(d.data_ateste)]
    ];
    const C_LW = 40; // Largura fixa do label para alinhamento vertical perfeito
    for (let ri = 0; ri < capaRows.length; ri++) {
      const lbl = capaRows[ri][0], val = capaRows[ri][1];
      const vL = doc.splitTextToSize(val || "\u2014", CCW - C_LW - 5);
      const rH = Math.max(9.2, vL.length * LH + 3.0);
      
      // Cores alternadas (idênticas às do ateste)
      doc.setFillColor(ri % 2 === 0 ? 230 : 242, ri % 2 === 0 ? 245 : 250, ri % 2 === 0 ? 230 : 242);
      doc.setDrawColor(180, 220, 180); doc.setLineWidth(0.2);
      doc.rect(CML, y, CCW, rH, "FD");
      
      // Linha vertical divisória
      doc.line(CML + C_LW, y, CML + C_LW, y + rH);
      
      // Texto do label (negrito verde)
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(0, 80, 0);
      doc.text(lbl, CML + 2.5, y + LH * 0.9);
      
      // Texto do valor (normal cinza escuro)
      doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
      vL.forEach(function(l, li) { doc.text(l, CML + C_LW + 3, y + LH * 0.9 + li * LH); });
      
      y += rH;
    }
    // Página 1 termina aqui

    // ═══════════════════════════════════════════════════
    // PÁGINA 2 — PARECER  (layout v5.1.5 — fiel ao modelo)
    // ═══════════════════════════════════════════════════
    doc.addPage();
    const ML2 = 14, MW2 = 182;

    // ── Barra de cabeçalho verde-escuro (full-width) ─────────────────────────
    const HDR_H = 22;
    doc.setFillColor(0, 96, 0);
    doc.rect(0, 0, W, HDR_H, "F");
    try { doc.addImage(window.BRASAO_B64, "PNG", ML2, 1.5, 20, 17, "BH"); } catch(e) {}
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
    doc.text("ESTADO DO MARANH\u00c3O", ML2 + 20, 7.5);
    doc.text("PREFEITURA MUNICIPAL DE JOÃO LISBOA", ML2 + 20, 12.5);
    doc.setFontSize(9);
    doc.text("CONTROLADORIA GERAL DO MUNIC\u00cdPIO - CGM", ML2 + 20, 17.5);
    y = HDR_H + 7;

    // ── Caixa de título verde ─────────────────────────────────────────────────
    const titLines = doc.splitTextToSize(
      "PARECER DE VERIFICA\u00c7\u00c3O E AN\u00c1LISE DOCUMENTAL N\u00ba " + fv(d.processo) +
      " (LIBERA\u00c7\u00c3O PARA PAGAMENTO)", MW2 - 10
    );
    const titH = Math.max(14, titLines.length * 5.8 * scale + 8);
    doc.setFillColor(0, 96, 0); doc.rect(ML2, y, MW2, titH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(FS * 0.92); doc.setTextColor(255, 255, 255);
    const titBase = y + (titH - (titLines.length - 1) * 5.8 * scale) / 2 + FS * 0.35;
    titLines.forEach(function(l, li) { doc.text(l, ML2 + MW2 / 2, titBase + li * 5.8 * scale, { align: "center" }); });
    y += titH + 8;

    // ── Helper: cabeçalho de seção ────────────────────────────────────────────
    // ic = [R,G,B, tipo] onde tipo: "doc"|"chk"|"talk"|"pen"
    function secHeader2(label, ic) {
      ensureSpace(doc, 16);
      // Traço curto esquerdo
      doc.setDrawColor(0, 96, 0); doc.setLineWidth(0.6);
      doc.line(ML2, y + 5.8, ML2 + 4, y + 5.8);
      // Quadrado colorido do ícone (9 × 9 mm)
      const iX = ML2 + 6, iY = y + 0.8, iS = 9.5;
      doc.setFillColor(ic[0], ic[1], ic[2]); doc.rect(iX, iY, iS, iS, "F");
      // Ícone interno branco (linhas horizontais = "documento")
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.55);
      var t = ic[3];
      if (t === "doc") {
        doc.line(iX+2, iY+3,   iX+iS-2, iY+3);
        doc.line(iX+2, iY+5.2, iX+iS-2, iY+5.2);
        doc.line(iX+2, iY+7.4, iX+iS-2, iY+7.4);
      } else if (t === "chk") {
        doc.line(iX+2,   iY+5.5, iX+3.8, iY+7.5);
        doc.line(iX+3.8, iY+7.5, iX+7.5, iY+2.5);
      } else if (t === "talk") {
        doc.setDrawColor(255,255,255); doc.setLineWidth(0.6);
        doc.roundedRect(iX+1.5, iY+1.5, iS-3, 5.5, 1.2, 1.2, "S");
        doc.line(iX+3, iY+7.2, iX+2, iY+9);
      } else { // pen (desenho de caneta mais nítido)
        doc.line(iX+3.5, iY+6,   iX+7.5, iY+2);
        doc.line(iX+4.5, iY+7,   iX+8.5, iY+3);
        doc.line(iX+7.5, iY+2,   iX+8.5, iY+3);
        doc.line(iX+1.5, iY+8,   iX+3.5, iY+6);
        doc.line(iX+1.5, iY+8,   iX+4.5, iY+7);
        doc.line(iX+1,   iY+8.5, iX+4,   iY+8.5);
      }
      // Label negrito azul
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0, 80, 0);
      doc.text(label, ML2 + 18, y + 7.5);
      const lw2 = doc.getTextWidth(label);
      // Traço longo direito
      doc.setDrawColor(0, 96, 0); doc.setLineWidth(0.6);
      doc.line(ML2 + 18 + lw2 + 2, y + 5.8, ML2 + MW2, y + 5.8);
      y += 14;
    }

    // ── DADOS DO PROCESSO ─────────────────────────────────────────────────────
    secHeader2("Dados do Processo", [0, 96, 0, "doc"]);

    var dtRows = [
      ["\u00d3rg\u00e3o/Departamento:", fv(d.orgao)],
      ["Objeto:", fv(d.objeto)],
      ["Secretaria/Programa:", fv(d.orgao)],
      ["Fornecedor/Credor:", fv(d.fornecedor)],
      ["Modalidade:", fv(d.modalidade)],
      ["Contrato:", fv(d.contrato)]
    ];
    var DT_LW = 52;
    doc.setFontSize(FS * 0.88);
    for (var ri = 0; ri < dtRows.length; ri++) {
      var lbl2 = dtRows[ri][0], val2 = dtRows[ri][1];
      var vL2 = doc.splitTextToSize(val2 || "\u2014", MW2 - DT_LW - 5);
      var rH2 = Math.max(MIN_ROW, vL2.length * LH + PAD);
      ensureSpace(doc, rH2);
      doc.setFillColor(ri % 2 === 0 ? 230 : 242, ri % 2 === 0 ? 245 : 250, ri % 2 === 0 ? 230 : 242);
      doc.setDrawColor(180, 220, 180); doc.setLineWidth(0.2);
      doc.rect(ML2, y, MW2, rH2, "FD");
      doc.setDrawColor(180, 220, 180); doc.line(ML2 + DT_LW, y, ML2 + DT_LW, y + rH2);
      doc.setFont("helvetica", "bold"); doc.setFontSize(FS * 0.87); doc.setTextColor(0, 80, 0);
      doc.text(lbl2, ML2 + 2.5, y + LH * 0.9);
      doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
      vL2.forEach(function(l, li) { doc.text(l, ML2 + DT_LW + 3, y + LH * 0.9 + li * LH); });
      y += rH2;
    }
    // Última linha: CNPJ/CPF | Nº | Tipo | Valor R$
    {
      var lastH = Math.max(MIN_ROW, LH + PAD);
      ensureSpace(doc, lastH);
      doc.setFillColor(200, 235, 200); doc.setDrawColor(180, 220, 180); doc.setLineWidth(0.2);
      doc.rect(ML2, y, MW2, lastH, "FD");
      var valorLimpo = fv(d.valor).replace("R$", "").trim();
      var cols4 = [
        { l: "CNPJ/CPF:", v: fv(d.cnpj),             w: 60 },
        { l: "N\u00ba",  v: fv(d.nf),                w: 30 },
        { l: "Tipo",      v: fv(d.tipo_nf||d.tipo_doc), w: 42 },
        { l: "Valor R$",  v: valorLimpo,              w: MW2 - 132 }
      ];
      var cx4 = ML2;
      cols4.forEach(function(c, ci) {
        if (ci > 0) { doc.setDrawColor(180,220,180); doc.line(cx4, y, cx4, y + lastH); }
        doc.setFont("helvetica", "bold"); doc.setFontSize(FS * 0.85); doc.setTextColor(0, 80, 0);
        doc.text(c.l, cx4 + 2.5, y + lastH / 2 + LH * 0.35);
        var lw4 = doc.getTextWidth(c.l) + 2;
        doc.setFont("helvetica", "normal"); doc.setTextColor(20, 20, 20);
        doc.text(c.v || "\u2014", cx4 + lw4 + 2, y + lastH / 2 + LH * 0.35);
        cx4 += c.w;
      });
      y += lastH;
    }
    y += 7 * scale;

    // ── VERIFICAÇÃO DOCUMENTAL ────────────────────────────────────────────────
    secHeader2("Verifica\u00e7\u00e3o Documental", [200, 95, 15, "chk"]);

    doc.setFontSize(FS * 0.9);
    for (var i = 0; i < checklist.length; i++) {
      var dL2 = doc.splitTextToSize(checklist[i], MW2 - 32);
      var rH3 = Math.max(MIN_ROW, dL2.length * LH + PAD);
      ensureSpace(doc, rH3);
      doc.setFillColor(i % 2 === 0 ? 235 : 245, i % 2 === 0 ? 248 : 252, i % 2 === 0 ? 235 : 245);
      doc.setDrawColor(185, 225, 185); doc.setLineWidth(0.15);
      doc.rect(ML2, y, MW2, rH3, "FD");
      // Badge círculo verde-escuro com número branco (escalado para não sobrepor)
      var bCX = ML2 + 9, bCY = y + rH3 / 2;
      var cR = 3.0 * scale;
      doc.setFillColor(0, 70, 0); doc.circle(bCX, bCY, cR, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5 * scale); doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), bCX, bCY + 1.0 * scale, { align: "center" });
      // Texto do item — negrito
      doc.setFont("helvetica", "bold"); doc.setFontSize(FS * 0.9); doc.setTextColor(15, 15, 15);
      dL2.forEach(function(l, li) { doc.text(l, ML2 + 18, y + LH * 0.9 + li * LH); });
      // Checkbox verde (checked) ou vermelho (unchecked) - escalado para não sobrepor
      var chkW = 6.0 * scale;
      var chkX = ML2 + MW2 - 3 - chkW;
      var chkY = y + rH3 / 2 - chkW / 2;
      doc.setLineWidth(0.55 * scale);
      if (sits[i]) {
        doc.setFillColor(34, 197, 94); doc.rect(chkX, chkY, chkW, chkW, "F");
        doc.setDrawColor(255, 255, 255);
        doc.line(chkX + 0.2 * chkW, chkY + 0.5 * chkW, chkX + 0.4 * chkW, chkY + 0.73 * chkW);
        doc.line(chkX + 0.4 * chkW, chkY + 0.73 * chkW, chkX + 0.79 * chkW, chkY + 0.26 * chkW);
      } else {
        doc.setFillColor(220, 50, 50); doc.rect(chkX, chkY, chkW, chkW, "F");
        doc.setDrawColor(255, 255, 255);
        doc.line(chkX + 0.2 * chkW, chkY + 0.2 * chkW, chkX + 0.8 * chkW, chkY + 0.8 * chkW);
        doc.line(chkX + 0.8 * chkW, chkY + 0.2 * chkW, chkX + 0.2 * chkW, chkY + 0.8 * chkW);
      }
      y += rH3;
    }
    y += 7 * scale;

    // ── OBSERVAÇÃO ───────────────────────────────────────────────────────────
    secHeader2("Observa\u00e7\u00e3o", [20, 108, 120, "talk"]);

    ensureSpace(doc, LH * 3 + 6 * scale);
    doc.setFont("helvetica", "normal"); doc.setFontSize(FS * 0.93); doc.setTextColor(40, 40, 40);
    doc.text("João Lisboa/MA, " + fv(d.data_ateste) + ".", ML2 + MW2 - 4, y, { align: "right" }); y += LH * 1.15;
    doc.text("Nestes termos:", ML2 + 4, y); y += LH;
    if (d.obs && d.obs.trim()) {
      var oL2 = doc.splitTextToSize(d.obs.trim(), MW2 - 8);
      oL2.forEach(function(ol) { ensureSpace(doc, LH + 2); doc.text(ol, ML2 + 4, y); y += LH; });
      y += 3 * scale;
    } else {
      y += 3 * scale;
    }
    var decTxt = deferir ? "DEFERIMOS O PAGAMENTO." : "INDEFERIMOS O PAGAMENTO.";
    ensureSpace(doc, 10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(FS * 1.05); doc.setTextColor(0, 80, 0);
    doc.text(decTxt, ML2 + MW2 / 2, y, { align: "center" });
    y += 9 * scale;

    // ── ASSINATURA ───────────────────────────────────────────────────────────
    secHeader2("Assinatura", [200, 75, 15, "pen"]);

    var ctrl = d.controlador || {};
    var ctrlNome = fv(ctrl.nome) || "";
    var ctrlCargo = fv(ctrl.cargo) || "";
    var ctrlPortaria = fv(ctrl.portaria) || "";
    var sigH2 = LH * 4 + 16 * scale;
    if (y + sigH2 > SAFE) {
      doc.addPage();
      doc.setFillColor(0, 96, 0); doc.rect(0, 0, W, HDR_H, "F");
      try { doc.addImage(window.BRASAO_B64, "PNG", ML2, 1.5, 20, 17, "BH2"); } catch(e) {}
      doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(255,255,255);
      doc.text("ESTADO DO MARANH\u00c3O", ML2+20, 7.5);
      doc.text("PREFEITURA MUNICIPAL DE JOÃO LISBOA", ML2+20, 12.5);
      doc.setFontSize(9); doc.text("CONTROLADORIA GERAL DO MUNIC\u00cdPIO - CGM", ML2+20, 17.5);
      y = HDR_H + 18;
    }
    y += 13 * scale;
    doc.setDrawColor(60, 60, 60); doc.setLineWidth(0.4);
    doc.line(ML2 + MW2 / 2 - 35, y, ML2 + MW2 / 2 + 35, y);
    y += 5.5 * scale;
    doc.setFont("helvetica", "bold"); doc.setFontSize(FS); doc.setTextColor(0, 0, 0);
    doc.text(ctrlNome, ML2 + MW2 / 2, y, { align: "center" });
    y += LH;
    doc.setFont("helvetica", "normal");
    doc.text(ctrlCargo, ML2 + MW2 / 2, y, { align: "center" });
    y += LH;
    if (ctrlPortaria) doc.text(ctrlPortaria, ML2 + MW2 / 2, y, { align: "center" });

    // ── Rodapé diferenciado por página ──────────────────────────────────────────
    var totalPgs = doc.internal.getNumberOfPages();
    for (var pg = 1; pg <= totalPgs; pg++) {
      doc.setPage(pg);
      if (pg === 1) {
        // Capa — barra verde-escuro, texto branco
        doc.setFillColor(0, 96, 0);
        doc.rect(0, H - 12, W, 12, "F");
        // Pin (círculo duplo branco)
        doc.setFillColor(255, 255, 255); doc.circle(16, H - 6, 2.6, "F");
        doc.setFillColor(0, 96, 0);  doc.circle(16, H - 6, 1.3, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(255, 255, 255);
        doc.text(FOOTER_TXT, W / 2 + 4, H - 4, { align: "center" });
      } else {
        // Parecer — rodapé idêntico ao da primeira página (barra verde de ponta a ponta)
        doc.setFillColor(0, 96, 0);
        doc.rect(0, H - 12, W, 12, "F");
        // Pin (círculo duplo branco)
        doc.setFillColor(255, 255, 255); doc.circle(16, H - 6, 2.6, "F");
        doc.setFillColor(0, 96, 0);  doc.circle(16, H - 6, 1.3, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(255, 255, 255);
        doc.text(FOOTER_TXT, W / 2 + 4, H - 4, { align: "center" });
      }
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
  const dataRows = [["Órgão", fv(d.orgao)], ["Processo", fv(d.processo)], ["Fornecedor", fv(d.fornecedor)], ["CNPJ", fv(d.cnpj)], ["Contrato", fv(d.contrato)], ["Modalidade", fv(d.modalidade)], ["Objeto", fv(d.objeto)], ["Valor", fv(d.valor).startsWith("R$") ? fv(d.valor) : "R$ " + fv(d.valor)], ["Data NF", fv(d.data_nf)], ["Secretário(a)", fv(d.secretario)]];
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
          text: "PREFEITURA MUNICIPAL DE JOÃO LISBOA",
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
          text: `João Lisboa/MA, ${dtExt(new Date())}`,
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
    info: "#052e16"
  };
  const bd = {
    success: "#16a34a",
    error: "#dc2626",
    warn: "#d97706",
    info: "#15803d"
  };
  const cl = {
    success: "#86efac",
    error: "#fca5a5",
    warn: "#fcd34d",
    info: "#86efac"
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
function KPICard({ label, value, gradient, icon }) {
  const [hov, setHov] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      background: gradient,
      borderRadius: 16,
      padding: "18px 20px",
      color: "#fff",
      boxShadow: hov ? "0 12px 32px rgba(0,0,0,.28)" : "0 4px 20px rgba(0,0,0,.15)",
      position: "relative",
      overflow: "hidden",
      transform: hov ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)",
      transition: "transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease",
      cursor: "default"
    }
  },
    // Círculo decorativo fundo
    /*#__PURE__*/React.createElement("div", { style: {
      position: "absolute", top: -14, right: -14,
      width: 70, height: 70, borderRadius: "50%",
      background: "rgba(255,255,255,.12)"
    }}),
    // Círculo menor
    /*#__PURE__*/React.createElement("div", { style: {
      position: "absolute", bottom: -8, left: -8,
      width: 40, height: 40, borderRadius: "50%",
      background: "rgba(255,255,255,.07)"
    }}),
    /*#__PURE__*/React.createElement("div", { style: { fontSize: 24, marginBottom: 6, lineHeight: 1 }}, icon),
    /*#__PURE__*/React.createElement("div", { style: {
      fontSize: 26, fontWeight: 800, lineHeight: 1,
      fontFamily: "'Outfit', 'Inter', sans-serif",
      letterSpacing: "-.02em"
    }}, value),
    /*#__PURE__*/React.createElement("div", { style: {
      fontSize: 10, opacity: .8, marginTop: 5,
      textTransform: "uppercase", letterSpacing: ".08em",
      fontWeight: 600
    }}, label)
  );
}
function PageHeader({ icon, title, sub, cor = "#16a34a", dark, actions }) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "linear-gradient(135deg, " + MUN.green + " 0%, " + MUN.greenDk + " 100%)",
      borderBottom: "3px solid " + MUN.gold,
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
      boxShadow: "0 2px 12px rgba(0,60,0,.25)",
      position: "relative",
      overflow: "hidden"
    }
  },
    // Brilho decorativo
    /*#__PURE__*/React.createElement("div", { style: {
      position: "absolute", top: 0, right: 0,
      width: 220, height: "100%",
      background: "linear-gradient(90deg, transparent, rgba(255,255,255,.04))",
      pointerEvents: "none"
    }}),
    /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 14 }},
      /*#__PURE__*/React.createElement("div", { style: {
        width: 44, height: 44, borderRadius: 13,
        background: "rgba(255,255,255,.15)",
        border: "1.5px solid rgba(255,255,255,.30)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22,
        boxShadow: "0 2px 8px rgba(0,0,0,.15)"
      }}, icon),
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("div", { style: {
          fontSize: 17, fontWeight: 800, color: "#ffffff",
          fontFamily: "'Outfit', 'Inter', sans-serif",
          letterSpacing: "-.01em", lineHeight: 1.1
        }}, title),
        sub && /*#__PURE__*/React.createElement("div", { style: {
          fontSize: 11, color: "rgba(255,255,255,.72)",
          marginTop: 3, fontWeight: 500, letterSpacing: ".02em"
        }}, sub)
      )
    ),
    actions && /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }}, actions)
  );
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
      border: `1.5px solid ${dark ? MUN.green : "#bbf7d0"}`,
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
      background: o === value ? dark ? "#004d00" : "#f0fdf4" : "transparent",
      borderBottom: `1px solid ${dark ? "#0f1a2e" : "#f8fafc"}`
    },
    onMouseEnter: e => e.currentTarget.style.background = dark ? "#005200" : "#f0fdf4",
    onMouseLeave: e => e.currentTarget.style.background = o === value ? dark ? "#004d00" : "#f0fdf4" : "transparent"
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
// Comprime o brasão PNG para WebP 85% na primeira carga — reduz ~85% do tamanho
function _comprimirBrasao(b64) {
  if (!b64 || window._BRASAO_WEBP) return;
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const webp = cv.toDataURL("image/webp", 0.82);
        if (webp && webp !== "data:,") {
          window._BRASAO_WEBP = webp;
          const orig = b64.length, comp = webp.length;
          console.info("[Brasão] WebP comprimido: " + Math.round(comp/orig*100) + "% do original (" + Math.round(comp/1024) + "KB)");
        }
      } catch {}
    };
    img.src = b64;
  } catch {}
}
if (window.BRASAO_B64) _comprimirBrasao(window.BRASAO_B64);

function Brasao({
  size = 56,
  style = {}
}) {
  // Usa versão WebP comprimida se disponível, senão o original
  const getSrc = () => window._BRASAO_WEBP || window.BRASAO_B64 || null;
  const [src, setSrc] = React.useState(getSrc);
  React.useEffect(() => {
    const webp = window._BRASAO_WEBP;
    const orig = window.BRASAO_B64;
    const best = webp || orig;
    if (best && src !== best) { setSrc(best); return; }
    if (!orig) {
      let t = 0;
      const iv = setInterval(() => {
        t++;
        const w = window._BRASAO_WEBP || window.BRASAO_B64;
        if (w) { setSrc(w); clearInterval(iv); }
        else if (t >= 30) clearInterval(iv);
        if (window.BRASAO_B64 && !window._BRASAO_WEBP) _comprimirBrasao(window.BRASAO_B64);
      }, 100);
      return () => clearInterval(iv);
    }
  }, []);
  if (!src) return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size, height: size, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0, ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 100 100", width: size, height: size,
    xmlns: "http://www.w3.org/2000/svg"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "100", height: "100", rx: "18", fill: "#003d00"
  }), /*#__PURE__*/React.createElement("text", {
    y: ".9em", fontSize: "78", textAnchor: "middle", x: "50"
  }, "\u2696\uFE0F")));
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "Brasão Pref. João Lisboa",
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
    info:    { bg: "#14532d", bd: "#16a34a", txt: "#bbf7d0", ico: "ℹ️" }
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
  }, "PREFEITURA MUNICIPAL DE JOÃO LISBOA"), /*#__PURE__*/React.createElement("div", {
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
  const [mini, setMini] = React.useState(() => {
    try { return localStorage.getItem("cgel_sidebar_mini") === "1"; } catch { return false; }
  });
  const toggleMini = () => setMini(m => {
    const nm = !m;
    try { localStorage.setItem("cgel_sidebar_mini", nm ? "1" : "0"); } catch {}
    return nm;
  });
  const W = mini ? 60 : 220;
  const nav = [{
    k: "processos",
    icon: "📄",
    label: "Novo"
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
  }, {
    k: "protocolo",
    icon: "📋",
    label: "Protocolo"
  }, {
    k: "parecer",
    icon: "📝",
    label: "Parecer"
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
      title: mini ? label : undefined,
      style: {
        display: "flex",
        alignItems: "center",
        gap: mini ? 0 : 10,
        padding: mini ? "10px 0" : "9px 12px",
        justifyContent: mini ? "center" : "flex-start",
        marginBottom: 3,
        borderRadius: 10,
        cursor: "pointer",
        transition: "all .15s",
        background: active ? MUN.green : "transparent",
        border: active ? "1px solid " + MUN.green : "1px solid transparent",
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: { fontSize: mini ? 18 : 15, width: mini ? "100%" : 20, textAlign: "center" }
    }, icon),
    !mini && /*#__PURE__*/React.createElement("span", {
      style: { fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? "#ffffff" : "rgba(255,255,255,.65)" }
    }, label, k === "historico" && pendentesAtrasados > 0 && /*#__PURE__*/React.createElement("span", {
        style: { background: "#dc2626", color: "#fff", fontSize: 9, fontWeight: 700,
                 borderRadius: 99, padding: "1px 5px", marginLeft: 4 }
      }, pendentesAtrasados)),
    mini && k === "historico" && pendentesAtrasados > 0 && /*#__PURE__*/React.createElement("span", {
      style: { position: "absolute", top: 4, right: 4, background: "#dc2626", color: "#fff",
               fontSize: 8, fontWeight: 700, borderRadius: 99, padding: "1px 4px" }
    }, pendentesAtrasados));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: W,
      minWidth: W,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "#006000",
      height: "100vh",
      position: "sticky",
      top: 0,
      borderRight: "1px solid rgba(0,0,0,.15)",
      overflowY: "auto",
      overflowX: "hidden",
      transition: "width .2s cubic-bezier(.22,1,.36,1)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: mini ? "12px 4px 10px" : "18px 16px 14px",
      borderBottom: "2px solid " + MUN.gold,
      textAlign: "center",
      background: "#003d00",
      position: "relative"
    }
  },
  /*#__PURE__*/React.createElement(Brasao, {
    size: mini ? 32 : 52,
    style: { margin: "0 auto " + (mini ? "0" : "10px") }
  }),
  !mini && /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 11, fontWeight: 700, color: MUN.gold, lineHeight: 1.4 }
    }, "CONTROLADORIA", /*#__PURE__*/React.createElement("br", null), "GERAL"),
    /*#__PURE__*/React.createElement("div", {
      style: { fontSize: 9, color: MUN.goldDk, marginTop: 3 }
    }, "Pref. Municipal de João Lisboa / MA")
  ),
  /*#__PURE__*/React.createElement("button", {
    onClick: toggleMini,
    title: mini ? "Expandir menu" : "Recolher menu",
    style: {
      position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,.1)",
      border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer",
      color: "rgba(255,255,255,.7)", fontSize: 12, display: "flex",
      alignItems: "center", justifyContent: "center"
    }
  }, mini ? "▶" : "◀")), /*#__PURE__*/React.createElement("div", {
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
      color: formPct === 100 ? "#4ade80" : formPct > 60 ? "#fbbf24" : "#86efac"
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
      background: formPct === 100 ? "#22c55e" : formPct > 60 ? "#f59e0b" : "#16a34a"
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
  }, "v5.1.5 \xB7 2026", /*#__PURE__*/React.createElement("span", {
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
    // [DUPL] Data NF preservada do processo original como sugestão editável
    dataNf: toISO(row["DATA NF"]) || toISO(row["DATA DA NF"]) || todayISO(),
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
  const [isDuplicating, setIsDuplicating] = useState(false); // [DUPL] highlight campos a revisar
  const [isManualNum, setIsManualNum] = useState(false);
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
    setIsDuplicating(true); // [DUPL] ativa destaque dos campos a revisar
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
      status: row["_status"] || "analise",
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
        const res = await ST.set("draft_form", form).catch(() => ({ ok: true, cloud: false }));
        const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setDraftSaved({ hora, cloud: res.cloud === true });
      }
    }, 30000);
    return () => clearInterval(t);
  }, [form, editMode]);
  useEffect(() => {
    if (editarData) return;
    // [FIX-DRAFT] Se o usuário clicou Limpar, ignora o rascunho salvo
    if (sessionStorage.getItem('draft_form_cleared') === '1') {
      sessionStorage.removeItem('draft_form_cleared');
      ST.del("draft_form"); // garante limpeza no Supabase também
      return;
    }
    ST.get("draft_form").then(d => {
      if (d && d.orgao !== undefined && (d.orgao || d.fornecedor)) setForm(p => ({ ...p, ...d }));
    });
  }, []);
  const pct = useMemo(() => {
    const req = ["orgao", "fornecedor", "cnpj", "valor", "objeto"];
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
  // Máscara monetária em tempo real
  const onValorChange = e => {
    const raw = e.target.value.replace(/\D/g, "");
    const formatted = raw ? formatValor(raw) : "";
    setForm(f => ({ ...f, valor: formatted }));
  };
  const onOrgChange = v => setForm(f => ({
    ...f,
    orgao: v,
    secretario: f.secretario || mp.orgaoSecretario[v] || "",
    contrato: f.contrato || mp.orgaoContrato[v] || "",
    modalidade: f.modalidade || mp.orgaoModalidade[v] || ""
  }));
  const onSecChange = v => setForm(f => ({
    ...f,
    secretario: v,
    orgao: f.orgao || mp.secretarioOrgao[v] || ""
  }));
  const [fornHistorial, setFornHistorial] = React.useState(null); // {forn, processos[]}
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
    // Mostrar últimos 3 processos do fornecedor
    if (v) {
      const recentes = processos
        .filter(p => (p["FORNECEDOR"]||"") === v)
        .sort((a,b) => parseInt(b["NÚMERO DO DOCUMENTO"]||0,10) - parseInt(a["NÚMERO DO DOCUMENTO"]||0,10))
        .slice(0, 3);
      if (recentes.length > 0) setFornHistorial({ forn: v, recentes });
      else setFornHistorial(null);
    } else {
      setFornHistorial(null);
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
    // [M-AU1] Consulta CNPJ: BrasilAPI c/ timeout 4s + fallback ReceitaWS + cache local
    const digits = m.replace(/\D/g, "");
    if (digits.length === 14 && valido) {
      // Cache local de CNPJs já consultados (evita chamadas repetidas)
      const _cnpjCache = window._cgel_cnpj_cache || (window._cgel_cnpj_cache = {});
      if (_cnpjCache[digits]) {
        const d = _cnpjCache[digits];
        setForm(f => ({
          ...f,
          fornecedor: f.fornecedor || d.razao_social || "",
          nomeFan: f.nomeFan || d.nome_fantasia || "",
          _cnpjStatus: d.situacao || ""
        }));
        toast("🏢 " + (d.razao_social||"").slice(0,40) + " (cache)", "info");
      } else {
        const _fetchCnpj = async (cnpj) => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 4000);
          // Tenta BrasilAPI primeiro
          try {
            const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctrl.signal });
            clearTimeout(timer);
            if (r.ok) {
              const d = await r.json();
              return { razao_social: d.razao_social, nome_fantasia: d.nome_fantasia, situacao: d.descricao_situacao_cadastral };
            }
          } catch (e) { clearTimeout(timer); }
          // Fallback: ReceitaWS
          try {
            const ctrl2 = new AbortController();
            const timer2 = setTimeout(() => ctrl2.abort(), 4000);
            const r2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, { signal: ctrl2.signal });
            clearTimeout(timer2);
            if (r2.ok) {
              const d2 = await r2.json();
              if (!d2.status || d2.status !== "ERROR")
                return { razao_social: d2.nome, nome_fantasia: d2.fantasia, situacao: d2.situacao };
            }
          } catch {}
          return null;
        };
        _fetchCnpj(digits).then(d => {
          if (!d) { toast("⚠️ CNPJ não encontrado na Receita — preencha manualmente", "warn"); return; }
          _cnpjCache[digits] = d;
          setForm(f => ({
            ...f,
            fornecedor: f.fornecedor || d.razao_social || "",
            nomeFan: f.nomeFan || d.nome_fantasia || "",
            _cnpjStatus: d.situacao || ""
          }));
          if (d.razao_social) toast("🏢 " + d.razao_social.slice(0,40) + " — dados preenchidos", "info");
        }).catch(() => toast("⚠️ API indisponível — preencha fornecedor manualmente", "warn"));
      }
    }
  };
  const onObjChange = v => setForm(f => ({
    ...f,
    objeto: v,
    modalidade: f.modalidade || mp.objModalidade[v] || "",
    contrato: f.contrato || mp.objContrato[v] || ""
  }));
  const onContratoChange = v => {
    // Preenche campos em cascata ao selecionar contrato do histórico
    const forn = mp.contratoForn[v] || "";
    const org  = mp.contratoOrgao[v] || "";
    const mod  = mp.contratoModal[v] || "";
    const obj  = mp.contratoObjeto[v] || "";
    setForm(f => ({
      ...f,
      contrato: v,
      fornecedor: f.fornecedor || forn,
      orgao:      f.orgao      || org,
      modalidade: f.modalidade || mod,
      objeto:     f.objeto     || obj,
      cnpj:       f.cnpj       || (forn ? mp.fornCnpj[forn] || "" : ""),
      secretario: f.secretario || (org ? mp.orgaoSecretario[org] || "" : "")
    }));
    if (forn || org) {
      setAutoFillMsg(`Contrato ${v} — campos preenchidos automaticamente`);
      setTimeout(() => setAutoFillMsg(""), 4000);
    }
  };
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
      processo:    editMode || "Nº automático",
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
  const handleGerarPDF = async () => {
    if (loading) return;
    if (!form.orgao && !form.fornecedor) {
      toast("⚠️ Preencha pelo menos Órgão ou Fornecedor antes de gerar o PDF.", "warn");
      return;
    }
    
    // [FIX-PDF-NUM] Snapshot dos dados antes do salvamento/limpeza do formulário
    const snapshotDados = makeDados();
    const snapshotTipo = form.tipo;
    const snapshotDecisao = form.decisao === "deferir";
    const snapshotSits = getChks(snapshotTipo);

    let idFinal = editMode;
    if (!editMode) {
      toast("⚙️ Salvando processo para gerar número definitivo...", "info");
      idFinal = await handleSalvar(true);
      if (!idFinal) return;
      // Injeta o número real obtido do banco no snapshot
      snapshotDados.processo = idFinal;
    } else {
      // [EDIT-PDF-SAVE] Em modo edição: salva os dados editados em proc_NUM
      // (histórico preservado por onSaveEdit) e usa o número já conhecido no PDF.
      toast("⚙️ Salvando edições antes de gerar PDF...", "info");
      const savedId = await handleSalvar(true);
      if (!savedId) return;
      snapshotDados.processo = savedId;
    }

    setLoading(true);
    try {
      const r = await gerarPDF(snapshotDados, snapshotTipo, snapshotDecisao, CHK[snapshotTipo], snapshotSits);
      if (r.error) {
        toast("❌ PDF: " + r.error, "error");
        return;
      }
      setPdfBlob(r.blob);
      setPdfName(r.name || "documento.pdf");
      if (onPdfDownload) onPdfDownload(r.blob, r.name); else {
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
  const handleSalvar = async (retornarId = false) => {
    if (!form.orgao || !form.fornecedor || !form.valor) {
      toast("Preencha Órgão, Fornecedor e Valor.", "error");
      return null;
    }
    if (cnpjErro) {
      toast("Corrija o CNPJ/CPF antes de salvar.", "error");
      return null;
    }
    setLoading(true);
    let idSalvo = editMode;
    try {
      const row = {
        "NÚMERO DO DOCUMENTO": "0", 
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
        idSalvo = await onSaveEdit(row, form, editMode, user);
        setEditMode(null);
      } else {
        // Passa flag de manual se o usuário ativou o campo
        idSalvo = await onSave(row, { ...form, _isManualNum: isManualNum }, user);
      }
      await ST.del("draft_form");
      setDraftSaved(null);
      setForm(blankForm());
      setChks({});
      setPdfBlob(null);
      setTab(0);
      setIsDuplicating(false);
    } finally {
      setLoading(false);
    }
    if (retornarId) return idSalvo;
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
    // [R1 FIX] Não revogar URL quando fallback window.open é usado — senão a aba
    // aberta fica com PDF em branco. Timeout aumentado para 5 min.
    let usouBlank = false;
    const cleanup = (revogar = true) => {
      try { document.body.removeChild(iframe); } catch {}
      if (revogar && !usouBlank) URL.revokeObjectURL(url);
    };
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => cleanup(true), 5 * 60 * 1000);
      } catch (e) {
        usouBlank = true;
        window.open(url, "_blank");
        cleanup(false);
      }
    };
    iframe.onerror = () => { cleanup(true); toast("Erro ao abrir PDF para impressão.", "warn"); };
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
        // [FIX-DRAFT] Seta flag antes do delete para bloquear recarregamento
        sessionStorage.setItem('draft_form_cleared', '1');
        ST.del("draft_form");
        setDraftSaved(null);
        setEditMode(null);
        setIsDuplicating(false);
        toast("🗑️ Formulário limpo.");
      }
    });
  };
  // [FIX-DUPL] Array ordenado DECRESCENTE (maior número primeiro) → [0] é o mais recente
  const ultimoProcesso = processos[0] || null;
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
    borderBottom: `2px solid ${tab === i ? "#16a34a" : "transparent"}`,
    color: tab === i ? "#16a34a" : "#9ca3af",
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
    title: editMode ? `✏️ Editando Processo #${editMode}` : "Novo",
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
  fornHistorial && !editMode && /*#__PURE__*/React.createElement("div", {
    style: {
      background: dark?"#052e16":"#f0fdf4",
      border: "1px solid "+(dark?"#14532d":"#bbf7d0"),
      borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 8
    }
  },
  /*#__PURE__*/React.createElement("div", {
    style: { fontWeight:700, color:dark?"#86efac":"#166534", marginBottom:8,
             display:"flex", justifyContent:"space-between", alignItems:"center" }
  }, "📋 Últimos processos deste fornecedor",
    /*#__PURE__*/React.createElement("button", {
      onClick: () => setFornHistorial(null),
      style: { background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:16, lineHeight:1 }
    }, "×")
  ),
  fornHistorial.recentes.map((p, i) =>
    /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display:"flex", alignItems:"center", gap:10, padding:"6px 8px",
        borderRadius: 7, marginBottom: 3, cursor:"pointer",
        background: dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.03)"
      },
      title: "Clique para usar estes dados",
      onClick: () => {
        setForm(f => ({
          ...f,
          cnpj:       f.cnpj       || p["CNPJ"]      || "",
          contrato:   f.contrato   || p["CONTRATO"]   || "",
          modalidade: f.modalidade || p["MODALIDADE"] || "",
          objeto:     f.objeto     || p["OBJETO"]     || "",
          tipDoc:     f.tipDoc     || p["DOCUMENTO FISCAL"] || "",
          ordemCompra: f.ordemCompra || p["N° ORDEM DE COMPRA"] || ""
        }));
        setAutoFillMsg("Dados do processo N\xBA " + p["N\xDAMERO DO DOCUMENTO"] + " aplicados");
        setTimeout(() => setAutoFillMsg(""), 3500);
        setFornHistorial(null);
      }
    },
    /*#__PURE__*/React.createElement("span", { style:{fontWeight:700, color:MUN.gold, minWidth:32, fontSize:11} }, "N\xBA"+p["N\xDAMERO DO DOCUMENTO"]),
    /*#__PURE__*/React.createElement("span", { style:{flex:1, color:dark?"#cbd5e1":"#475569", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:11} },
      (p["OBJETO"]||"").slice(0,35) || p["MODALIDADE"] || "\u2014"),
    /*#__PURE__*/React.createElement("span", { style:{color:dark?"#4ade80":"#16a34a", fontWeight:600, flexShrink:0, fontSize:11} }, p["VALOR"]||""),
    /*#__PURE__*/React.createElement("span", { style:{fontSize:10, color:"#94a3b8", flexShrink:0} }, p["DATA"]||"")
    )
  )),
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
  }, tab === 0 && /*#__PURE__*/React.createElement(React.Fragment, null,
  isDuplicating && /*#__PURE__*/React.createElement("div", {
    style: {
      background: dark ? "#422006" : "#fef3c7",
      border: "1.5px solid #f59e0b",
      borderRadius: 10,
      padding: "10px 16px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 13,
      color: dark ? "#fcd34d" : "#92400e"
    }
  },
    /*#__PURE__*/React.createElement("span", { style: { fontSize: 18 } }, "📋"),
    /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("strong", null, "Processo duplicado — verifique os campos destacados em laranja:"),
      /*#__PURE__*/React.createElement("span", { style: { marginLeft: 8 } }, "Valor · Nº Ordem de Compra · Data NF")
    ),
    /*#__PURE__*/React.createElement("button", {
      onClick: () => setIsDuplicating(false),
      style: { marginLeft: "auto", background: "transparent", border: "none",
               cursor: "pointer", fontSize: 16, color: "#f59e0b", flexShrink: 0 }
    }, "✕")
  ),
  /*#__PURE__*/React.createElement(SH, {
    icon: "\uD83D\uDD22",
    title: "Identifica\xE7\xE3o",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    className: "ident-row",
    style: { display: "grid", gridTemplateColumns: "42% 27% 31%", gap: 10, marginBottom: 14, alignItems: "end" }
  }, /*#__PURE__*/React.createElement("div", {
    style: { minWidth: 0 }
  }, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "N\xBA Documento"), editMode
    ? /*#__PURE__*/React.createElement("input", {
        value: editMode, readOnly: true,
        style: { ...iStyle, marginBottom: 0, background: dark ? "#1a3a2a" : "#f0f7f0",
                 borderColor: "#16a34a", color: dark ? "#4ade80" : "#15803d",
                 fontWeight: 700, cursor: "default" }
      })
    : /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", gap: 6, alignItems: "center" }
      }, /*#__PURE__*/React.createElement("input", {
        value: isManualNum ? form.numDoc : "Automático " + (nextProcessoNumber ? `(Nº ${nextProcessoNumber})` : ""),
        onChange: e => isManualNum && upd("numDoc")(e.target.value.replace(/\D/g, "")),
        readOnly: !isManualNum,
        placeholder: "Nº Processo",
        style: {
          ...iStyle,
          marginBottom: 0,
          flex: 1,
          background: isManualNum ? iStyle.background : (dark ? "#0f2a1a" : "#f0faf0"),
          borderColor: isManualNum ? bdr : "#16a34a",
          color: isManualNum ? tc : (dark ? "#4ade80" : "#15803d"),
          fontWeight: 700,
          cursor: isManualNum ? "text" : "default"
        }
      }), /*#__PURE__*/React.createElement("button", {
        onClick: () => {
          if (!isManualNum) {
            upd("numDoc")(String(nextProcessoNumber || ""));
          }
          setIsManualNum(!isManualNum);
        },
        title: isManualNum ? "Voltar para automático" : "Digitar número manualmente",
        style: {
          background: isManualNum ? "#ea580c" : (dark ? "#1a3a2a" : "#e6f4ea"),
          border: "1.5px solid " + (isManualNum ? "#ea580c" : "#16a34a"),
          borderRadius: 8, width: 38, height: 38, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          flexShrink: 0
        }
      }, isManualNum ? "🔓" : "🔒"))
    ), /*#__PURE__*/React.createElement("div", {
    style: { minWidth: 0 }
  }, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Data *"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dataDoc,
    onChange: e => upd("dataDoc")(e.target.value),
    style: { ...iStyle, marginBottom: 0, width: "100%" }
  })), /*#__PURE__*/React.createElement("div", {
    style: { minWidth: 0 }
  }, /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Per\xEDodo Ref."), /*#__PURE__*/React.createElement(PeriodoInput, {
    value: form.periodo,
    onChange: upd("periodo"),
    dark: dark,
    style: { ...iStyle, marginBottom: 0 }
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
      color: "#16a34a",
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
  }))))), tab === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SH, {
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
    onChange: onContratoChange,
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
    style: { height: 19 }
  }), /*#__PURE__*/React.createElement("label", {
    style: { ...LS(dark), ...(isDuplicating ? { color: "#d97706", fontWeight: 700 } : {}) }
  }, isDuplicating ? "⚠️ Nº Ordem de Compra" : "Nº Ordem de Compra"), /*#__PURE__*/React.createElement("input", {
    value: form.ordemCompra,
    onChange: e => upd("ordemCompra")(e.target.value),
    placeholder: "Preencher manualmente",
    style: {
      ...iStyle,
      marginBottom: 0,
      ...(isDuplicating ? {
        borderColor: "#f59e0b", background: dark ? "#2d1f00" : "#fffbeb",
        boxShadow: "0 0 0 3px rgba(245,158,11,.25)"
      } : {})
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
    style: { ...LS(dark), ...(isDuplicating ? { color: "#d97706", fontWeight: 700 } : {}) }
  }, isDuplicating ? "⚠️ Valor (R$) *" : "Valor (R$) *"), /*#__PURE__*/React.createElement("input", {
    value: form.valor,
    onChange: e => upd("valor")(e.target.value),
    onBlur: e => upd("valor")(formatValor(e.target.value)),
    placeholder: "43.088,62",
    style: {
      ...iStyle,
      ...(isDuplicating ? {
        borderColor: "#f59e0b", background: dark ? "#2d1f00" : "#fffbeb",
        boxShadow: "0 0 0 3px rgba(245,158,11,.25)"
      } : {})
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: { ...LS(dark), ...(isDuplicating ? { color: "#d97706", fontWeight: 700 } : {}) }
  }, isDuplicating ? "⚠️ Data NF" : "Data NF"),
  /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: form.dataNf,
    onChange: e => upd("dataNf")(e.target.value),
    style: {
      ...iStyle,
      ...(isDuplicating ? {
        borderColor: "#f59e0b", background: dark ? "#2d1f00" : "#fffbeb",
        boxShadow: "0 0 0 3px rgba(245,158,11,.25)"
      } : {})
    }
  }),
  isDuplicating && /*#__PURE__*/React.createElement("div", {
    style: { fontSize: 10.5, color: "#d97706", marginTop: 3 }
  }, "📅 Sugestão do processo anterior — verifique e altere se necessário")
  ))), tab === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SH, {
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
    onChange: e => {
      const v = e.target.value;
      upd("dataAteste")(v);
      // Sugere período = mês anterior à data do ateste (se campo vazio)
      if (v && !form.periodo) {
        try {
          const dt = new Date(v + "T12:00:00");
          dt.setMonth(dt.getMonth() - 1);
          const mesesNome = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO",
                             "JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
          const sugestao = mesesNome[dt.getMonth()] + "/" + dt.getFullYear();
          setForm(f => ({ ...f, periodo: f.periodo || sugestao }));
          setAutoFillMsg("📅 Período sugerido: " + sugestao);
          setTimeout(() => setAutoFillMsg(""), 3500);
        } catch {}
      }
    },
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
      accentColor: "#16a34a"
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
  }), "Limpar")),
  confirmModal && /*#__PURE__*/React.createElement(ConfirmModal, {
    titulo: confirmModal.titulo,
    msg:    confirmModal.msg,
    tipo:   confirmModal.tipo || "warn",
    dark:   dark,
    onOk:   confirmModal.onOk,
    onCancel: () => setConfirmModal(null)
  })
);
}

// ─── BuscarPage ───────────────────────────────────────────────────────────────
function BuscarPage({
  processos,
  onCarregar,
  onEditar,
  onGerarPDF,
  toast,
  dark,
  user,
  initialFilter
}) {
  const [q, setQ] = useState(initialFilter || "");
  const [isGeneratingRel, setIsGeneratingRel] = useState(false);
  useEffect(() => { if (initialFilter) setQ(initialFilter); }, [initialFilter]);
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
  const limitado = filtered.length > 300;
  const exibidos = filtered.slice(0, 300);
  const cols = ["NÚMERO DO DOCUMENTO", "ORGÃO", "FORNECEDOR", "CNPJ", "VALOR", "DATA", "_status_badge", "OBJETO", "_usuario"];
  const colLabel = c => c === "NÚMERO DO DOCUMENTO" ? "Nº DOC" : c === "_usuario" ? "Usuário" : c === "CNPJ" ? "CNPJ/CPF" : c === "_status_badge" ? "Status" : c;
  const toggleSort = col => setSort(s => s.col === col ? {
    col,
    dir: s.dir * -1
  } : {
    col,
    dir: col === "NÚMERO DO DOCUMENTO" ? -1 : 1
  });
  const renderCelula = (col, proc) => {
    if (col === "_status_badge") {
      const dec = proc["_decisao"] || "";
      const st  = proc["_status"]  || "";
      if (dec === "deferir")    return React.createElement("span", { style: { background: "#166534", color: "#86efac", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" } }, "✅ Deferido");
      if (dec === "indeferir")  return React.createElement("span", { style: { background: "#7f1d1d", color: "#fca5a5", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" } }, "❌ Indeferido");
      if (st  === "aguardando") return React.createElement("span", { style: { background: "#4c1d95", color: "#c4b5fd", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" } }, "🟣 Aguardando");
      if (st  === "pago")       return React.createElement("span", { style: { background: "#0f2027", color: "#94a3b8", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" } }, "⚫ Pago");
      return React.createElement("span", { style: { background: "#78350f", color: "#fcd34d", fontSize: 10, fontWeight: 700, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" } }, "🟡 Em análise");
    }
    const v = String(proc[col] || "");
    return v.length > 38 ? v.slice(0, 36) + "…" : v;
  };
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
  }, "\u26A0\uFE0F Exibindo 300 de ", filtered.length, " resultados. Refine a busca para ver mais."), /*#__PURE__*/React.createElement("div", {
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
    onMouseEnter: e => e.currentTarget.style.background = dark ? "#1e2d40" : "#f0fdf4",
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
  }, c === "DATA" || c === "DATA NF" ? fmtD(String((c === "DATA" ? (p["DATA"] || p["Data"] || p["data"]) : p[c]) || "")) : c === "_usuario" ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: dark ? "#1e2d40" : "#f1f5f9",
        borderRadius: 5,
        padding: "2px 7px",
        fontSize: 11,
        fontWeight: 600,
        color: dark ? "#86efac" : "#166534"
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
        await onGerarPDF(p);
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
  toast,
  onNavigate
}) {
  const parseBRL = v => {
    if (!v) return 0;
    const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const [filtOrg, setFiltOrg] = useState("");
  const [filtAno, setFiltAno] = useState("");
  const [filtMes, setFiltMes] = useState("");
  const [filtForn, setFiltForn] = useState("");
  const [tooltip, setTooltip] = useState(null);
  // [UX] Tooltip para BarChartCSS
  const [barTooltip, setBarTooltip] = useState(null);
  const [barTooltip2, setBarTooltip2] = useState(null);

  // [DASH-UNIFY] Une processos ativos e histórico para uma visão completa do banco
  const todos = useMemo(() => {
    const map = new Map();
    const normalize = p => {
      const orgRaw = p["ORGÃO"] || p["Órgão"] || "";
      return {
        ...p,
        "ORGÃO": typeof normalizarOrgao === "function" ? normalizarOrgao(orgRaw) : orgRaw,
        "FORNECEDOR": p["FORNECEDOR"] || p["Fornecedor"] || "",
        "VALOR": p["VALOR"] || p["Valor"] || "0",
        "DATA": p["DATA"] || p["Data"] || "",
        "NÚMERO DO DOCUMENTO": p["NÚMERO DO DOCUMENTO"] || p["Processo"] || ""
      };
    };

    (processos || []).forEach(p => {
      const k = String(p["NÚMERO DO DOCUMENTO"] || "").trim();
      if (k) map.set(k, normalize(p));
    });
    (historico || []).forEach(h => {
      const k = String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "").trim();
      if (k) {
        const exist = map.get(k);
        map.set(k, { ...normalize(h), ...(exist || {}) });
      }
    });
    return [...map.values()];
  }, [processos, historico]);
  const mp = useMemo(() => {
    const orgs = new Set(), forns = new Set();
    todos.forEach(p => {
      const o = String(p["ORGÃO"] || "").trim(); if (o) orgs.add(o);
      const f = String(p["FORNECEDOR"] || "").trim(); if (f) forns.add(f);
    });
    return {
      allOrgaos: [...orgs].sort(),
      allFornecedores: [...forns].sort()
    };
  }, [todos]);

  const anos = useMemo(() => {
    const s = new Set();
    todos.forEach(p => {
      const raw = String(p["DATA"] || "");
      const m = raw.match(/\d{4}/); if (m) s.add(m[0]);
    });
    return [...s].sort().reverse();
  }, [todos]);
  // Meses disponíveis respeitando o ano selecionado
  const meses = useMemo(() => {
    const s = new Set();
    todos.forEach(p => {
      const raw = String(p["DATA"] || "");
      let ym = "";
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) ym = raw.slice(6,10) + "-" + raw.slice(3,5);
      else if (/^\d{4}-\d{2}/.test(raw)) ym = raw.slice(0,7);
      if (ym && (!filtAno || ym.startsWith(filtAno))) s.add(ym);
    });
    return [...s].sort().reverse();
  }, [todos, filtAno]);
  // Fornecedores disponíveis (respeita órgão/ano selecionados)
  const fornecedores = useMemo(() => {
    const s = new Set();
    todos.forEach(p => {
      const f = String(p["FORNECEDOR"] || "").trim();
      if (!f) return;
      if (filtOrg && p["ORGÃO"] !== filtOrg) return;
      if (filtAno && !String(p["DATA"] || "").includes(filtAno)) return;
      s.add(f);
    });
    return [...s].sort((a,b) => a.localeCompare(b, "pt-BR"));
  }, [todos, filtOrg, filtAno]);
  const filtered = useMemo(() => todos.filter(p => {
    if (filtOrg  && p["ORGÃO"] !== filtOrg) return false;
    if (filtForn && String(p["FORNECEDOR"] || "").trim() !== filtForn) return false;
    if (filtAno  && !String(p["DATA"] || "").includes(filtAno)) return false;
    if (filtMes) {
      const raw = String(p["DATA"] || "");
      let ym = "";
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) ym = raw.slice(6,10) + "-" + raw.slice(3,5);
      else if (/^\d{4}-\d{2}/.test(raw)) ym = raw.slice(0,7);
      if (ym !== filtMes) return false;
    }
    return true;
  }), [todos, filtOrg, filtAno, filtMes, filtForn])

  const filteredOrgsCount = useMemo(() => {
    const s = new Set();
    filtered.forEach(p => {
      const o = String(p["ORGÃO"] || "").trim();
      if (o) s.add(o);
    });
    return s.size;
  }, [filtered]);

  const filteredFornsCount = useMemo(() => {
    const s = new Set();
    filtered.forEach(p => {
      const f = String(p["FORNECEDOR"] || "").trim();
      if (f) s.add(f);
    });
    return s.size;
  }, [filtered]);

  // Processos por mês (últimos 12)
  const porMes = useMemo(() => {
    const m = {};
    const val = {};
    filtered.forEach(p => {
      let raw = p["DATA"] || p["Data"];
      if (!raw) return;
      let chave = "";
      
      if (raw instanceof Date) {
        chave = `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,"0")}`;
      } else {
        raw = String(raw).trim();
        if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
          chave = raw.slice(6, 10) + "-" + raw.slice(3, 5);
        } else if (/^\d{4}-\d{2}/.test(raw)) {
          chave = raw.slice(0, 7);
        } else if (raw.includes(" de ")) {
          const pTs = raw.split(" de ");
          if (pTs.length === 3) {
            const mE = pTs[1].toUpperCase();
            const mm = ["","JANEIRO","FEVEREIRO","MAR\xC7O","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"].indexOf(mE);
            if (mm > 0) chave = `${pTs[2]}-${String(mm).padStart(2,"0")}`;
          }
        }
      }
      if (chave && chave !== "NaT") {
        m[chave] = (m[chave] || 0) + 1;
        val[chave] = (val[chave] || 0) + parseBRL(p["VALOR"]);
      }
    });
    return Object.entries(m).sort(([a], [b]) => a < b ? -1 : 1).slice(-60).map(([mes, n]) => ({ mes, n, valor: val[mes] || 0 }));
  }, [filtered]);

  // [FIX8] Total financeiro — soma campo VALOR de todos os processos filtrados
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
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 8).map(([o, n]) => ({
      orgao: o, n, valor: mv[o] || 0,
      pct: filtered.length ? (n / filtered.length * 100).toFixed(1) : "0"
    }));
  }, [filtered]);

  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const _badgeStyle = {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 11, fontWeight: 600, padding: "3px 10px",
    borderRadius: 20, background: dark ? "#1e3a28" : "#dcfce7",
    color: dark ? "#4ade80" : "#15803d",
    border: `1px solid ${dark ? "#166534" : "#bbf7d0"}`
  };


  // [G-R2] Comparativo Dinâmico: mês selecionado (ou último com dados) vs anterior
  const comparativo = useMemo(() => {
    let alvoY, alvoM;

    if (filtMes) {
      [alvoY, alvoM] = filtMes.split("-").map(v => parseInt(v, 10));
    } else if (porMes && porMes.length > 0) {
      const last = porMes[porMes.length - 1].mes;
      [alvoY, alvoM] = last.split("-").map(v => parseInt(v, 10));
    } else {
      const now = new Date();
      alvoY = now.getFullYear(); alvoM = now.getMonth() + 1;
    }

    const mesAtual = `${alvoY}-${String(alvoM).padStart(2, "0")}`;
    const dtAnt = new Date(alvoY, alvoM - 2, 1);
    const mAntStr = `${dtAnt.getFullYear()}-${String(dtAnt.getMonth() + 1).padStart(2, "0")}`;

    const getChave = p => {
      let raw = p["DATA"] || p["Data"];
      if (!raw) return "";
      
      // Se for objeto Date
      if (raw instanceof Date) {
        return `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,"0")}`;
      }

      // Se for número (Excel serial)
      if (typeof raw === "number" && raw > 30000 && raw < 60000) {
        const d = new Date((raw - 25569) * 86400 * 1000);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      }
      
      raw = String(raw).trim();
      if (!raw) return "";

      // Se for string numérica longa (Excel serial em string)
      if (/^\d{5}(\.\d+)?$/.test(raw)) {
        const n = parseFloat(raw);
        if (n > 30000 && n < 60000) {
          const d = new Date((n - 25569) * 86400 * 1000);
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        }
      }

      // 1. dd/mm/yyyy
      if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.slice(6, 10) + "-" + raw.slice(3, 5);
      // 2. yyyy-mm-dd ou yyyy-mm
      if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
      // 3. dd de Mes de yyyy (Extenso)
      if (raw.includes(" de ")) {
        const parts = raw.split(" de ");
        if (parts.length === 3) {
          const mesExt = parts[1].toUpperCase();
          const m = ["","JANEIRO","FEVEREIRO","MAR\xC7O","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"].indexOf(mesExt);
          if (m > 0) return `${parts[2]}-${String(m).padStart(2,"0")}`;
        }
      }
      return "";
    };

    // Usamos 'todos' para garantir que incluímos o histórico na comparação
    const baseParaComp = todos.filter(p => {
      if (filtOrg && String(p["ORGÃO"] || "").trim() !== filtOrg) return false;
      if (filtForn && String(p["FORNECEDOR"] || "").trim() !== filtForn) return false;
      return true;
    });

    const cur = baseParaComp.filter(p => getChave(p) === mesAtual);
    const prv = baseParaComp.filter(p => getChave(p) === mAntStr);
    
    const parseBRLLocal = v => { 
      const s = String(v || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""); 
      const n = parseFloat(s); return isNaN(n) ? 0 : n; 
    };
    const curVal = cur.reduce((a, p) => a + parseBRLLocal(p["VALOR"]), 0);
    const prvVal = prv.reduce((a, p) => a + parseBRLLocal(p["VALOR"]), 0);
    
    const pctN = prv.length > 0 ? Math.round((cur.length - prv.length) / prv.length * 100) : (cur.length > 0 ? 100 : null);
    const pctV = prvVal > 0 ? Math.round((curVal - prvVal) / prvVal * 100) : (curVal > 0 ? 100 : null);
    
    return { 
      curN: cur.length, prvN: prv.length, curVal, prvVal, pctN, pctV, 
      mesAtual: `${String(alvoM).padStart(2,"0")}/${alvoY}`, 
      mesAnt: `${String(dtAnt.getMonth()+1).padStart(2,"0")}/${dtAnt.getFullYear()}` 
    };
  }, [todos, porMes, filtMes, filtOrg, filtForn]);

  // ── [NEW] Tempo médio de tramitação ──
  const tempoMedio = useMemo(() => {
    let sumDays = 0;
    let count = 0;
    (historico || []).forEach(h => {
      if (h["_registradoEm"] && h["Data"]) {
        const dStr = String(h["Data"] || "").trim();
        let start;
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dStr)) {
          start = new Date(dStr.slice(6, 10), dStr.slice(3, 5) - 1, dStr.slice(0, 2));
        } else if (/^\d{4}-\d{2}-\d{2}/.test(dStr)) {
          start = new Date(dStr);
        }
        if (start) {
          const endStr = String(h["_registradoEm"]);
          const p = endStr.split(", ")[0].split("/");
          if (p.length === 3) {
            const end = new Date(p[2], p[1] - 1, p[0]);
            const diffTime = end - start;
            if (diffTime >= 0) {
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              sumDays += diffDays;
              count++;
            }
          }
        }
      }
    });
    return count > 0 ? Math.round(sumDays / count) : 0;
  }, [historico]);

  // ── Gráfico de linha SVG ─────────────────────────────────────────────────
  const LineChartSVG = ({ data, valueKey = "n", isCurrency = false }) => {
    if (!data.length) return null;
    const W = 700, H = 230, PL = 54, PR = 12, PT = 36, PB = 40;
    const cW = W - PL - PR, cH = H - PT - PB;
    const maxVal = Math.max(...data.map(d => d[valueKey]), 1);
    const xs = data.map((_, i) => PL + (i / Math.max(data.length - 1, 1)) * cW);
    const ys = data.map(d => PT + cH - (d[valueKey] / maxVal) * cH);
    const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
    const area = `M${PL},${PT + cH} ` + xs.map((x, i) => `L${x},${ys[i]}`).join(" ") + ` L${xs[xs.length-1]},${PT+cH} Z`;
    // Exibe label no eixo X a cada N pontos para evitar sobreposição
    const skipX = Math.ceil(data.length / 20);
    // Índice do ponto máximo
    const maxIdx = data.reduce((mi, d, i) => d[valueKey] > data[mi][valueKey] ? i : mi, 0);
    
    // Formatação de labels do eixo Y
    const formatY = v => {
      if (isCurrency) {
        if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
        if (v >= 1e3) return (v / 1e3).toFixed(0) + "k";
        return v.toFixed(0);
      }
      return v;
    };

    return /*#__PURE__*/React.createElement("div", { style: { overflowX: "auto", paddingTop: 10 } },
      /*#__PURE__*/React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", minWidth: 400, height: H, overflow: "visible" } },
        // grid lines
        [0.25, 0.5, 0.75, 1].map(f => {
          const y = PT + cH - f * cH;
          return /*#__PURE__*/React.createElement("line", { key: f, x1: PL, y1: y, x2: W - PR, y2: y,
            stroke: dark ? "#1e2936" : "#e2e8f0", strokeWidth: 1, strokeDasharray: "3 3" });
        }),
        // Y labels
        [0, Math.round(maxVal / 2), maxVal].map((v, i) => {
          const y = PT + cH - (v / maxVal) * cH;
          return /*#__PURE__*/React.createElement("text", { key: i, x: PL - 8, y: y + 4,
            textAnchor: "end", fontSize: 11, fill: dark ? T.textMutedDark : "#64748b", fontWeight: 600 }, formatY(v));
        }),
        // area fill
        /*#__PURE__*/React.createElement("path", { d: area, fill: isCurrency ? "#10b98120" : "#16a34a20" }),
        // line
        /*#__PURE__*/React.createElement("polyline", { points: polyline, fill: "none", stroke: isCurrency ? "#10b981" : "#16a34a", strokeWidth: 2.5, strokeLinejoin: "round" }),
        // dots + X labels
        data.map((d, i) => {
          const isPeak = i === maxIdx;
          const labelText = isCurrency ? fmtBRL(d.valor) : d.n + " proc.";
          return /*#__PURE__*/React.createElement(React.Fragment, { key: i },
            // Ponto
            /*#__PURE__*/React.createElement("circle", {
              cx: xs[i], cy: ys[i], r: isPeak ? 7 : 5,
              fill: isPeak ? "#e11d48" : (isCurrency ? "#10b981" : "#16a34a"),
              stroke: dark ? "#1e3528" : "#fff", strokeWidth: 2,
              style: { cursor: "pointer" },
              onMouseEnter: () => setTooltip({ x: xs[i], y: ys[i], val: d.n, valor: d.valor, chartKey: valueKey }),
              onMouseLeave: () => setTooltip(null)
            }),
            // Badge fixo no pico
            isPeak && /*#__PURE__*/React.createElement(React.Fragment, null,
              /*#__PURE__*/React.createElement("rect", {
                x: xs[i] - (isCurrency ? 70 : 65), y: ys[i] + 10, width: isCurrency ? 140 : 130, height: 22, rx: 5,
                fill: "#e11d48"
              }),
              /*#__PURE__*/React.createElement("text", {
                x: xs[i], y: ys[i] + 25, textAnchor: "middle", fontSize: 10,
                fill: "#fff", fontWeight: 700
              }, labelText)
            ),
            // Label eixo X
            (i % skipX === 0 || i === data.length - 1) && /*#__PURE__*/React.createElement("text", {
              x: xs[i], y: H - 8, textAnchor: "middle", fontSize: 11,
              fill: isPeak ? "#e11d48" : "#64748b",
              fontWeight: isPeak ? 700 : 500
            }, d.mes.split("-")[1] + "/" + d.mes.split("-")[0].slice(2))
          );
        }),
        // tooltip hover
        tooltip && tooltip.chartKey === valueKey && /*#__PURE__*/React.createElement(React.Fragment, null, (() => {
          const above = tooltip.y > PT + 30;
          return /*#__PURE__*/React.createElement(React.Fragment, null,
            /*#__PURE__*/React.createElement("rect", {
              x: tooltip.x - 85, y: above ? tooltip.y - 36 : tooltip.y + 10,
              width: 170, height: 26, rx: 6,
              fill: dark ? "#141820" : "#0f172a"
            }),
            /*#__PURE__*/React.createElement("text", {
              x: tooltip.x, y: above ? tooltip.y - 19 : tooltip.y + 27,
              textAnchor: "middle", fontSize: 11, fill: "#fff", fontWeight: 700
            }, tooltip.val + " proc. (" + fmtBRL(tooltip.valor) + ")")
          );
        })())
      )
    );
  };

  // ── Gráfico de barras CSS ─────────────────────────────────────────────────

  // [J-V1] Gráfico de pizza SVG — distribuição por tipo de processo
  const porTipo = useMemo(() => {
    const m = {};
    const val = {};
    filtered.forEach(p => {
      const k = p["_tipoKey"] || "padrao";
      m[k] = (m[k] || 0) + 1;
      val[k] = (val[k] || 0) + parseBRL(p["VALOR"]);
    });
    return Object.entries(m).map(([k, n]) => ({
      key: k, label: TINFO[k]?.label || k,
      cor: TINFO[k]?.cor || "#888", n,
      valor: val[k] || 0,
      pct: filtered.length ? (n / filtered.length) * 100 : 0
    })).sort((a,b) => b.n - a.n);
  }, [filtered]);

  // [UX] Tooltip interativo para PieChartSVG
  const [pieTooltip, setPieTooltip] = useState(null);

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
      /*#__PURE__*/React.createElement("div", { style: { position: "relative" } },
        /*#__PURE__*/React.createElement("svg", { viewBox: "0 0 180 180", style: { width: 180, height: 180, flexShrink: 0 } },
          slices.map((s,i) => /*#__PURE__*/React.createElement(React.Fragment, { key: s.key },
            /*#__PURE__*/React.createElement("path", {
              d: s.path, fill: s.cor,
              stroke: pieTooltip === s.key ? (dark ? "#f1f5f9" : "#0f172a") : (dark ? "#141820" : "#fff"),
              strokeWidth: pieTooltip === s.key ? 3 : 2,
              style: { cursor: "pointer", transition: "stroke-width .15s, fill .15s",
                filter: pieTooltip === s.key ? "brightness(1.15)" : "none" },
              onMouseEnter: () => setPieTooltip(s.key),
              onMouseLeave: () => setPieTooltip(null)
            }),
            s.pct > 8 && /*#__PURE__*/React.createElement("text", {
              x: s.lx, y: s.ly, textAnchor: "middle", dominantBaseline: "central",
              fontSize: 10, fontWeight: 700, fill: "#fff"
            }, Math.round(s.pct) + "%")
          ))
        ),
        // [UX] Tooltip no centro do donut
        pieTooltip && (() => {
          const s = slices.find(sl => sl.key === pieTooltip);
          if (!s) return null;
          return /*#__PURE__*/React.createElement("div", {
            style: {
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              textAlign: "center", pointerEvents: "none"
            }
          },
            /*#__PURE__*/React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: dark ? "#f1f5f9" : "#0f172a" } }, s.n + " proc."),
            /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: dark ? T.accentGreenDark : "#16a34a", margin: "2px 0" } }, fmtBRL(s.valor)),
            /*#__PURE__*/React.createElement("div", { style: { fontSize: 10, color: dark ? T.textMutedDark : "#64748b" } }, s.label)
          );
        })()
      ),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
        data.map(d => /*#__PURE__*/React.createElement("div", {
          key: d.key,
          style: {
            display: "flex", alignItems: "center", gap: 8,
            background: pieTooltip === d.key ? (dark ? "#1e2936" : "#f1f5f9") : "transparent",
            borderRadius: 6, padding: "2px 6px", cursor: "pointer",
            transition: "background .12s"
          },
          onMouseEnter: () => setPieTooltip(d.key),
          onMouseLeave: () => setPieTooltip(null)
        },
          /*#__PURE__*/React.createElement("div", { style: { width: 12, height: 12, borderRadius: 3, background: d.cor, flexShrink: 0 } }),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 12, color: tc, fontWeight: pieTooltip === d.key ? 700 : 400 } }, d.label),
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: dark ? T.textMutedDark : "#94a3b8", marginLeft: 4 } }, `${d.n} (${fmtBRL(d.valor)})`)
        ))
      )
    );
  };

const BarChartCSS = ({ data, onHover }) => {
    if (!data.length) return null;
    const maxN = Math.max(...data.map(d => d.n), 1);
    const cores = ["#22c55e","#16a34a","#7c3aed","#d97706","#0891b2","#dc2626","#059669","#be185d"];
    return /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
      data.map((d, i) => /*#__PURE__*/React.createElement("div", {
        key: i,
        style: { display: "flex", alignItems: "center", gap: 8, position: "relative" },
        onMouseEnter: () => setBarTooltip(d),
        onMouseLeave: () => setBarTooltip(null)
      },
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
            minWidth: 100, textAlign: "left", flexShrink: 0 }
        }, `${d.pct}% (${fmtBRL(d.valor)})`),
        // [UX] Tooltip hover
        barTooltip === d && /*#__PURE__*/React.createElement("div", {
          style: {
            position: "absolute", left: 153, top: -28, zIndex: 20,
            background: dark ? "#1e293b" : "#0f172a",
            border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
            borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600,
            color: "#f1f5f9", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,.3)"
          }
        }, `🏛 ${d.orgao}\n${d.n} proc. (${d.pct}%) \xB7 ${fmtBRL(d.valor)}`)
      )),
      // [UX] Dica se tem mais itens
      data.length >= 8 && /*#__PURE__*/React.createElement("div", {
        style: { fontSize: 10, color: dark ? T.textMutedDark : "#94a3b8", textAlign: "right", marginTop: -2 }
      }, `+ ${data.length - 8} mais — filtre para ver todos`)
    );
  };

// ── [UX] KPI com badge de variação ──
  const KPICard = ({ label, value, gradient, icon, variacao, variacaoVal }) => (
    /*#__PURE__*/React.createElement("div", { style: { background: "transparent", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" } },
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 } },
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 16 } }, icon),
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: dark ? T.textMutedDark : "#64748b", letterSpacing: ".5px", textTransform: "uppercase" } }, label)
      ),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 6 } },
        /*#__PURE__*/React.createElement("span", { style: { fontSize: 22, fontWeight: 800, color: dark ? T.textMainDark : "#0f172a", lineHeight: 1 } }, value),
        variacao !== undefined && variacao !== null && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11, fontWeight: 700,
            color: variacao >= 0 ? (dark ? T.accentGreenDark : "#16a34a") : (dark ? "#f87171" : "#dc2626"),
            background: variacao >= 0
              ? (dark ? "#052e16" : "#dcfce7")
              : (dark ? "#1c1c1c" : "#fee2e2"),
            borderRadius: 6, padding: "1px 6px"
          }
        }, variacao >= 0 ? "▲" : "▼", Math.abs(variacao), variacaoVal ? variacaoVal : "%")
      )
    )
  );

  return /*#__PURE__*/React.createElement("div", {
    style: { flex: 1, overflowY: "auto", background: bg }
  },
    /*#__PURE__*/React.createElement(PageHeader, {
      icon: "\uD83D\uDCCA",
      title: "Dashboard",
      sub: _sbReady ? "\u2601\uFE0F Sincronizado \u2014 atualiza em tempo real" : "Vis\xE3o anal\xEDtica",
      cor: "#4d7cfe",
      dark: dark
    }),
    /*#__PURE__*/React.createElement("div", { style: { padding: "20px 24px" } },
      // ── [UX] Filtros com chips/tags clicáveis (no topo) ──
      /*#__PURE__*/React.createElement("div", {
        style: { background: cardBg, borderRadius: 12, border: `1.5px solid ${bdr}`,
          padding: "14px 20px", marginBottom: 18 }
      },
        /*#__PURE__*/React.createElement("div", {
          style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }
        },
          /*#__PURE__*/React.createElement("span", {
            style: { fontSize: 11, fontWeight: 700, color: dark ? T.textMutedDark : "#64748b", flexShrink: 0, letterSpacing: ".3px", textTransform: "uppercase" }
          }, "\uD83D\uDD0D Filtros"),
          // Órgão
          /*#__PURE__*/React.createElement("select", {
            value: filtOrg, onChange: e => { setFiltOrg(e.target.value); setFiltForn(""); },
            style: { ...IS(dark), width: "auto", minWidth: 170, padding: "6px 10px", marginBottom: 0 }
          },
            /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os \xF3rg\xE3os"),
            mp.allOrgaos.map(o => /*#__PURE__*/React.createElement("option", { key: o, value: o }, o.slice(0, 50)))
          ),
          // Fornecedor
          /*#__PURE__*/React.createElement("select", {
            value: filtForn, onChange: e => setFiltForn(e.target.value),
            style: { ...IS(dark), width: "auto", minWidth: 190, padding: "6px 10px", marginBottom: 0 }
          },
            /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os fornecedores"),
            fornecedores.map(f => /*#__PURE__*/React.createElement("option", { key: f, value: f }, f.slice(0, 55)))
          ),
          // Ano
          /*#__PURE__*/React.createElement("select", {
            value: filtAno, onChange: e => { setFiltAno(e.target.value); setFiltMes(""); },
            style: { ...IS(dark), width: "auto", minWidth: 105, padding: "6px 10px", marginBottom: 0 }
          },
            /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os anos"),
            anos.map(a => /*#__PURE__*/React.createElement("option", { key: a, value: a }, a))
          ),
          // Mês
          /*#__PURE__*/React.createElement("select", {
            value: filtMes, onChange: e => setFiltMes(e.target.value),
            style: { ...IS(dark), width: "auto", minWidth: 130, padding: "6px 10px", marginBottom: 0 }
          },
            /*#__PURE__*/React.createElement("option", { value: "" }, "Todos os meses"),
            meses.map(ym => {
              const [ano, mm] = ym.split("-");
              const nomes = { "01":"Janeiro","02":"Fevereiro","03":"Mar\xE7o","04":"Abril","05":"Maio","06":"Junho",
                              "07":"Julho","08":"Agosto","09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro" };
              return /*#__PURE__*/React.createElement("option", { key: ym, value: ym }, (nomes[mm] || mm) + "/" + ano);
            })
          ),
          // Chips/Tags ativos — clique para remover
          (filtOrg || filtForn || filtAno || filtMes) && /*#__PURE__*/React.createElement("div", {
            style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }
          },
            filtOrg && /*#__PURE__*/React.createElement("span", {
              key: "org", style: {
                background: dark ? "#14532d" : "#dcfce7", border: `1px solid ${dark ? "#16a34a" : "#86efac"}`,
                borderRadius: 8, padding: "3px 8px", fontSize: 11,
                color: dark ? "#86efac" : "#15803d", display: "inline-flex", alignItems: "center", gap: 4,
                fontWeight: 600
              }
            }, "\uD83C\uDFDB\uFE0F ", filtOrg.slice(0, 28),
              /*#__PURE__*/React.createElement("button", {
                onClick: () => setFiltOrg(""),
                style: { background: "none", border: "none", cursor: "pointer",
                  color: "inherit", fontWeight: 700, fontSize: 13, lineHeight: 1, padding: 0 }
              }, "\u2715")),
            filtForn && /*#__PURE__*/React.createElement("span", {
              key: "forn", style: {
                background: dark ? "#1a2e20" : "#dcfce7", border: `1px solid ${dark ? "#22c55e" : "#86efac"}`,
                borderRadius: 8, padding: "3px 8px", fontSize: 11,
                color: dark ? "#86efac" : "#15803d", display: "inline-flex", alignItems: "center", gap: 4,
                fontWeight: 600
              }
            }, "\uD83C\uDFE2 ", filtForn.slice(0, 28),
              /*#__PURE__*/React.createElement("button", {
                onClick: () => setFiltForn(""),
                style: { background: "none", border: "none", cursor: "pointer",
                  color: "inherit", fontWeight: 700, fontSize: 13, lineHeight: 1, padding: 0 }
              }, "\u2715")),
            (filtAno || filtMes) && /*#__PURE__*/React.createElement("span", {
              key: "periodo", style: {
                background: dark ? "#292524" : "#fef3c7", border: `1px solid ${dark ? "#f59e0b" : "#fcd34d"}`,
                borderRadius: 8, padding: "3px 8px", fontSize: 11,
                color: dark ? "#fcd34d" : "#b45309", display: "inline-flex", alignItems: "center", gap: 4,
                fontWeight: 600
              }
            }, "\uD83D\uDCC5 ", filtMes ? filtMes : filtAno,
              /*#__PURE__*/React.createElement("button", {
                onClick: () => { setFiltAno(""); setFiltMes(""); },
                style: { background: "none", border: "none", cursor: "pointer",
                  color: "inherit", fontWeight: 700, fontSize: 13, lineHeight: 1, padding: 0 }
              }, "\u2715"))
          ),
          // Botão limpar total
          (filtOrg || filtAno || filtMes || filtForn) && /*#__PURE__*/React.createElement("button", {
            onClick: () => { setFiltOrg(""); setFiltAno(""); setFiltMes(""); setFiltForn(""); },
            style: { fontSize: 11, padding: "5px 10px", background: dark ? "#2d1a1a" : "#fee2e2",
              border: `1px solid ${dark ? "#ef4444" : "#fecaca"}`, borderRadius: 7,
              color: dark ? "#f87171" : "#dc2626", cursor: "pointer", flexShrink: 0, fontWeight: 700 }
          }, "\u2715 Limpar filtros"),
          /*#__PURE__*/React.createElement("span", {
            style: { fontSize: 11, color: dark ? T.textMutedDark : "#94a3b8", marginLeft: "auto", flexShrink: 0, fontWeight: 600 }
          }, filtered.length, " processo(s)")
        )
      ),
      // ── [UX] KPIs com badges de variação ──
      /*#__PURE__*/React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 } },
        /*#__PURE__*/React.createElement(KPICard, { label: "Processos", value: filtered.length.toLocaleString(), gradient: T.kpi2, icon: "\uD83D\uDCCA", variacao: comparativo.pctN }),
        /*#__PURE__*/React.createElement(KPICard, { label: "\xD3rg\xE3os",      value: filteredOrgsCount,             gradient: T.kpi1, icon: "\uD83C\uDFDB\uFE0F" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "Fornecedores", value: filteredFornsCount,             gradient: T.kpi5, icon: "\uD83C\uDFE2" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "Hist\xF3rico",  value: (historico || []).length.toLocaleString(), gradient: T.kpi4, icon: "\uD83D\uDD50" }),
        tempoMedio > 0 && /*#__PURE__*/React.createElement(KPICard, { label: "Tempo M\xE9dio", value: tempoMedio + " dias", gradient: "linear-gradient(135deg,#f59e0b,#d97706)", icon: "\u23F1\uFE0F" }),
        /*#__PURE__*/React.createElement(KPICard, { label: "Total R$", value: totalGeral > 0 ? fmtBRL(totalGeral) : "—", gradient: "linear-gradient(135deg,#059669,#047857)", icon: "\uD83D\uDCB0", variacao: comparativo.pctV, variacaoVal: "" })
      ),
      // ── [UX] Botão PDF + Comparativo (mesma linha) ──
      /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", gap: 16, alignItems: "stretch", marginBottom: 18 }
      },
        // Botão PDF
        /*#__PURE__*/React.createElement("button", {
          onClick: async () => {
            let titulo = "RELAT\xD3RIO DE PROCESSOS";
            let periodo = "";
            if (filtMes) {
              const [ano, mm] = filtMes.split("-");
              periodo = `${mm}/${ano}`;
            } else if (filtAno) {
              titulo = `RELAT\xD3RIO ANUAL \u2014 EXERC\xCDCIO ${filtAno}`;
              periodo = filtAno;
            } else if (filtOrg) {
              titulo = `RELAT\xD3RIO POR \xD3RG\xC3O: ${filtOrg.slice(0,30)}`;
            }
            toast("\u23F3 Gerando relat\xF3rio...", "info");
            const r = await gerarRelatorioPDF(filtered, (filtMes ? periodo : titulo), appConfig || {});
            if (r.error) { toast("\u274C " + r.error, "error"); return; }
            const url = URL.createObjectURL(r.blob);
            const a = document.createElement("a"); a.href = url; a.download = r.name;
            document.body.appendChild(a); a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
            toast("\u2705 Relat\xF3rio gerado!");
          },
          style: { ...BS("success", false, dark), height: 36, fontSize: 12 }
        }, /*#__PURE__*/React.createElement(BtnIco, { emoji: "\uD83D\uDCC4" }), filtMes || filtAno || filtOrg ? "Gerar PDF Filtrado" : "Relatório do Mês (PDF)"),
        // Comparativo
        (comparativo.curN > 0 || comparativo.prvN > 0) && /*#__PURE__*/React.createElement("div", {
          style: { flex: 1, background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "14px 18px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }
        },
          /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, fontWeight: 700, color: dark ? T.textMutedDark : "#64748b", letterSpacing: ".5px", textTransform: "uppercase", flexShrink: 0 } },
            "\uD83D\uDCC6 vs m\xEAs anterior"),
          ...[
            { lbl: "Processos", cur: comparativo.curN, prv: comparativo.prvN, pct: comparativo.pctN, fmt: v => v.toString() },
            { lbl: "Total R$", cur: comparativo.curVal, prv: comparativo.prvVal, pct: comparativo.pctV,
              fmt: v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
          ].map(({ lbl, cur, prv, pct, fmt }) => /*#__PURE__*/React.createElement("div", { key: lbl, style: { display: "flex", alignItems: "center", gap: 8 } },
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 11, color: dark ? T.textMutedDark : "#94a3b8" } }, lbl + ":"),
            /*#__PURE__*/React.createElement("span", { style: { fontSize: 15, fontWeight: 800, color: dark ? T.textMainDark : "#0f172a" } }, fmt(cur)),
            pct !== null && /*#__PURE__*/React.createElement("span", {
              style: {
                fontSize: 11, fontWeight: 700,
                color: pct >= 0 ? (dark ? T.accentGreenDark : "#16a34a") : (dark ? "#f87171" : "#dc2626"),
                background: pct >= 0 ? (dark ? "#052e16" : "#dcfce7") : (dark ? "#1c1c1c" : "#fee2e2"),
                borderRadius: 6, padding: "1px 6px"
              }
            }, pct >= 0 ? "▲" : "▼", Math.abs(pct), "%")
          ))
        )
      ),
      // ── [UX] Container de gráficos em grid 2 colunas ──
      /*#__PURE__*/React.createElement("div", {
        style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }
      },
        // Coluna esquerda: Top Órgãos
        topOrg.length > 0 && /*#__PURE__*/React.createElement("div", {
          style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px" }
        },
          /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 16, color: dark ? T.textMainDark : "#0f172a", letterSpacing: ".3px" } },
            "Top \xD3rg\xE3os por Processo"),
          /*#__PURE__*/React.createElement(BarChartCSS, { data: topOrg })
        ),
        // Coluna direita: Por Tipo
        porTipo.length > 0 && /*#__PURE__*/React.createElement("div", {
          style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px" }
        },
          /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 16, color: dark ? T.textMainDark : "#0f172a", letterSpacing: ".3px" } },
            "Distribui\xE7\xE3o por Tipo"),
          /*#__PURE__*/React.createElement(PieChartSVG, { data: porTipo })
        )
      ),
      // ── [UX] Linha: Volume por mês (full width) ──
      porMes.length > 0 && /*#__PURE__*/React.createElement("div", {
        style: { display: "flex", flexDirection: "column", gap: 18 }
      },
        /*#__PURE__*/React.createElement("div", {
          style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px" }
        },
          /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 14, color: dark ? T.textMainDark : "#0f172a", letterSpacing: ".3px" } },
            "Volume de Processos por M\xEAs"),
          /*#__PURE__*/React.createElement(LineChartSVG, { data: porMes, valueKey: "n", isCurrency: false })
        ),
        /*#__PURE__*/React.createElement("div", {
          style: { background: cardBg, borderRadius: 14, border: `1.5px solid ${bdr}`, padding: "20px 24px" }
        },
          /*#__PURE__*/React.createElement("div", { style: { fontWeight: 700, fontSize: 13, marginBottom: 14, color: dark ? T.textMainDark : "#0f172a", letterSpacing: ".3px" } },
            "Valores Financeiros por M\xEAs"),
          /*#__PURE__*/React.createElement(LineChartSVG, { data: porMes, valueKey: "valor", isCurrency: true })
        )
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
  truncado,
  initialFilter
}) {
  const [q, setQ] = useState(initialFilter || "");
  const [isGeneratingRel, setIsGeneratingRel] = useState(false);
  useEffect(() => { if (initialFilter) setQ(initialFilter); }, [initialFilter]);
  const [filtDec,    setFiltDec]    = useState("");
  const [filtAno,    setFiltAno]    = useState("");
  const [filtMes,    setFiltMes]    = useState("");
  const [filtTipo,   setFiltTipo]   = useState("");
  const [filtOrgao,  setFiltOrgao]  = useState("");
  const [filtUser,   setFiltUser]   = useState("");
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
        // [B4.1-07] Usa _decisao (campo interno) para consistência com BuscaPage
        r = r.filter(h => !h["_decisao"] && !String(h["Decisão"] || "").includes("DEFERIDO") && !String(h["Decisão"] || "").includes("INDE"));
      } else if (filtDec === "PAGO" || filtDec === "DEVOLVIDO") {
        r = r.filter(h => String(h["_status"] || "").toUpperCase() === filtDec || String(h["_decisao"] || h["Decisão"] || "").toUpperCase().includes(filtDec));
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
      await onGerarPDF(h);
    } finally {
      setLPDF(null);
    }
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
    sub: _sbReady ? "\u2601\uFE0F Sincronizado \u2014 atualiza em tempo real" : "Documentos processados",
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
  }, "\u23F3 Pendente"), /*#__PURE__*/React.createElement("option", {
    value: "PAGO"
  }, "\uD83D\uDCB0 Pago"), /*#__PURE__*/React.createElement("option", {
    value: "DEVOLVIDO"
  }, "\uD83D\uDD04 Devolvido"))), filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
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
      onMouseEnter: e => e.currentTarget.style.background = dark ? "#1e2d40" : "#f0fdf4",
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
    }, h["Data"] || h["DATA"] || h["data"] || ""), /*#__PURE__*/React.createElement("td", {
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
        color: dark ? "#86efac" : "#166534"
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
      color: u.perfil === "admin" ? "#7c3aed" : "#16a34a"
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
    // [FIX-SYNC12] Notifica outros clientes da mudança de configuração de órgãos
    _incrementarVersao().catch(()=>{});
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
    // [FIX-SYNC12] Notifica outros clientes da adição de novo órgão
    _incrementarVersao().catch(()=>{});
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
    // [FIX-SYNC12] Notifica outros clientes da mudança de dados do controlador
    _incrementarVersao().catch(()=>{});
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
  // [FIX-BACKUP] ConfirmModal para restaurar backup (substitui window.confirm)
  const [confirmBackup, setConfirmBackup] = useState(null); // { item }
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
    // [FIX-BACKUP] Usa ConfirmModal em vez de window.confirm (funciona em Safari iOS)
    setConfirmBackup({ item });
  };
  const confirmarRestaurarBackup = async (item) => {
    setConfirmBackup(null);
    const snap = item.value;
    // [FIX-BACKUP-RESTORE-ATOMIC] Restaura cada processo/histórico individualmente
    // em vez de gravar o blob global (que causaria race condition com outros usuários).
    // Usa batches de 30 para não saturar o Supabase (igual ao handleSync).
    const runBatch = async (fns, batchSize = 30) => {
      for (let i = 0; i < fns.length; i += batchSize) {
        await Promise.all(fns.slice(i, i + batchSize).map(f => f()));
      }
    };
    if (snap?.processos?.length) {
      const fns = snap.processos
        .filter(p => String(p["NÚMERO DO DOCUMENTO"] || "").trim())
        .map(p => () => ST.set(`proc_${String(p["NÚMERO DO DOCUMENTO"]).trim()}`, p));
      await runBatch(fns);
    }
    if (snap?.historico?.length) {
      const fns = snap.historico
        .filter(h => String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "").trim())
        .map(h => () => ST.set(`hist_${String(h["Processo"] || h["NÚMERO DO DOCUMENTO"]).trim()}`, h));
      await runBatch(fns);
    }
    // [FIX-SYNC8] Notifica outros clientes que dados foram restaurados
    _incrementarVersao().catch(()=>{});
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
  },
  // [FIX-BACKUP] Modal de confirmação para restaurar backup
  confirmBackup && /*#__PURE__*/React.createElement(ConfirmModal, {
    titulo: "Restaurar Backup",
    msg: "Restaurar backup de " + (confirmBackup.item?.key||"").replace("backup_","") + "?\n\nIsso substituirá todos os dados atuais. Esta ação não pode ser desfeita.",
    tipo: "danger",
    dark: dark,
    onOk: () => confirmarRestaurarBackup(confirmBackup.item),
    onCancel: () => setConfirmBackup(null)
  }),
  /*#__PURE__*/React.createElement(PageHeader, {
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
  }), [["Versão", "v5.1.5"], ["Processos salvos", processos.length], ["Histórico", historico.length], ["Órgãos configurados", Object.keys(orgaosConfig).length]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
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


// ─── CommandPalette — busca global Ctrl+K ──────────────────────────────────
function CommandPalette({ processos, onClose, onEditar, onNavigate, dark }) {
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);
  const dq = q.trim().toLowerCase();
  const resultados = React.useMemo(() => {
    if (!dq) return processos.slice(0, 8);
    return processos.filter(p =>
      ["NÚMERO DO DOCUMENTO","FORNECEDOR","ORGÃO","CNPJ","OBJETO","CONTRATO","VALOR"].some(
        col => String(p[col]||"").toLowerCase().includes(dq)
      )
    ).slice(0, 12);
  }, [processos, dq]);
  React.useEffect(() => { inputRef.current?.focus(); }, []);
  React.useEffect(() => { setSel(0); }, [dq]);
  React.useEffect(() => {
    const h = e => {
      if (e.key === "Escape") { onClose(); }
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s+1, resultados.length-1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
      if (e.key === "Enter" && resultados[sel]) { handleSelect(resultados[sel]); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [resultados, sel]);
  const handleSelect = p => {
    onEditar(p);
    onNavigate("processos");
    onClose();
  };
  const decBadge = p => {
    if (p["_decisao"] === "deferir")   return { bg:"#166534", cl:"#86efac", tx:"✅ Deferido" };
    if (p["_decisao"] === "indeferir") return { bg:"#7f1d1d", cl:"#fca5a5", tx:"❌ Indeferido" };
    return { bg:"#78350f", cl:"#fcd34d", tx:"🟡 Análise" };
  };
  const ovBg  = dark ? "#091a0e" : "#fff";
  const rowBg = dark ? "#141820" : "#f8fafc";
  const tc     = dark ? "#e2e8f0" : "#0f172a";
  const tc2    = dark ? "#94a3b8" : "#64748b";
  return React.createElement("div", {
    style: { position:"fixed", inset:0, background:"rgba(0,0,0,.65)", zIndex:99999,
             display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"12vh" },
    onClick: onClose
  },
  React.createElement("div", {
    style: { width:"100%", maxWidth:600, background:ovBg, borderRadius:16,
             boxShadow:"0 32px 80px rgba(0,0,0,.5)", border:"1.5px solid " + (dark?"#1e2736":"#e2e8f0"),
             overflow:"hidden" },
    onClick: e => e.stopPropagation()
  },
    // Barra de busca
    React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:10,
      padding:"14px 18px", borderBottom:"1px solid "+(dark?"#1e2736":"#e2e8f0") } },
      React.createElement("span", { style:{fontSize:18, color:tc2} }, "🔍"),
      React.createElement("input", {
        ref: inputRef,
        value: q,
        onChange: e => setQ(e.target.value),
        placeholder: "Buscar processo, fornecedor, CNPJ, órgão…",
        style: { flex:1, border:"none", outline:"none", fontSize:15, background:"transparent",
                 color:tc, fontFamily:"inherit" }
      }),
      React.createElement("kbd", { style:{ fontSize:10, background:dark?"#1e2736":"#f1f5f9",
        border:"1px solid "+(dark?"#334155":"#cbd5e1"), borderRadius:4, padding:"2px 6px", color:tc2 } }, "Esc")
    ),
    // Resultados
    resultados.length === 0
      ? React.createElement("div", { style:{ padding:"24px", textAlign:"center", color:tc2, fontSize:13 } }, "Nenhum resultado encontrado")
      : React.createElement("div", { style:{ maxHeight:400, overflowY:"auto" } },
          resultados.map((p, i) => {
            const badge = decBadge(p);
            return React.createElement("div", {
              key: p["NÚMERO DO DOCUMENTO"] + i,
              onClick: () => handleSelect(p),
              style: {
                display:"flex", alignItems:"center", gap:12, padding:"10px 18px",
                cursor:"pointer", background: i===sel ? (dark?"#1a2636":"#e8f4fd") : "transparent",
                borderBottom:"1px solid "+(dark?"#0f1520":"#f1f5f9"),
                transition:"background .1s"
              },
              onMouseEnter: () => setSel(i)
            },
            React.createElement("div", { style:{ fontSize:16, fontWeight:800, color:MUN.gold,
              minWidth:36, textAlign:"center" } }, p["NÚMERO DO DOCUMENTO"]),
            React.createElement("div", { style:{ flex:1, minWidth:0 } },
              React.createElement("div", { style:{ fontSize:13, fontWeight:600, color:tc,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" } },
                p["FORNECEDOR"] || "(sem fornecedor)"),
              React.createElement("div", { style:{ fontSize:11, color:tc2, overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap" } },
                p["ORGÃO"] || "", p["VALOR"] ? " · " + p["VALOR"] : "",
                p["DATA"] ? " · " + p["DATA"] : "")
            ),
            React.createElement("span", { style:{ background:badge.bg, color:badge.cl, fontSize:10,
              fontWeight:700, borderRadius:99, padding:"2px 8px", flexShrink:0 } }, badge.tx)
            );
          })
        ),
    // Rodapé de atalhos
    React.createElement("div", { style:{ padding:"8px 18px", borderTop:"1px solid "+(dark?"#1e2736":"#e2e8f0"),
      display:"flex", gap:16, fontSize:10, color:tc2 } },
      ["↑↓ navegar", "Enter abrir", "Esc fechar"].map(t =>
        React.createElement("span", { key:t }, t)
      )
    )
  ));
}

function App() {
  const [user, setUser] = useState(null);
  const [sbOnline, setSbOnline] = useState(_sbLive);
  const [pendentesAtrasados, setPendentesAtrasados] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [orgaosConfig, setOrgaosConfig] = useState({});
  const [appConfig, setAppConfig] = useState({
    controlador: { nome: "", cargo: "", portaria: "" }
  });
  const [page, setPage] = useState("historico");
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("cgel_dark") === "1"; } catch { return false; }
  });
  const [formPct, setFormPct] = useState(0);
  const [duplicarData, setDuplicarData] = useState(null);
  const [editarData, setEditarData] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appConfirmModal, setAppConfirmModal] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erroRede, setErroRede] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [showCmdK, setShowCmdK] = useState(false);
  const [importedMaxNum, setImportedMaxNum] = useState(0);

  const importedMaxNumRef = useRef(0);
  useEffect(() => { importedMaxNumRef.current = importedMaxNum; }, [importedMaxNum]);

  const processosRef = useRef([]);
  useEffect(() => { processosRef.current = processos; }, [processos]);

  const historicoRef = useRef([]);
  useEffect(() => { historicoRef.current = historico; }, [historico]);

  const localAncoraRef = useRef(0);
  useEffect(() => {
    try {
      const lv = localStorage.getItem("cgel_processo_next_anchor");
      if (lv !== null) {
        const n = parseInt(JSON.parse(lv), 10);
        if (!isNaN(n) && n > 0) localAncoraRef.current = n;
      }
    } catch {}
  }, [importedMaxNum]);

  const editModeRef = useRef(false);
  const savingInProgressRef = useRef(false);
  const refreshRef = useRef(null);
  const refreshInProgressRef = useRef(false);
  const pendingRefreshRef = useRef(false);   // [FIX-RACE] agenda refresh perdido
  const sessaoTimerRef = useRef(null);

  const { toasts, toast } = useToast();
  const handleSetPageCmdK = useCallback(p => setPage(p), []);
  const { locks, setLock, releaseLock } = useLocks(user);

  // Atalho global Ctrl+K
  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setShowCmdK(v => !v);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const reiniciarTimerSessao = useCallback(() => {
    if (sessaoTimerRef.current) clearTimeout(sessaoTimerRef.current);
    sessaoTimerRef.current = setTimeout(() => {
      setUser(null);
      toast("⏰ Sessão expirada por inatividade. Faça login novamente.", "warn");
    }, 8 * 60 * 60 * 1000);
  }, [toast]);

  const verificarEFazerBackup = useCallback(async (p, h) => {
    try {
      const ultimo = await ST.get("last_backup_ts");
      const agora = Date.now();
      if (!ultimo || agora - ultimo > 7 * 24 * 60 * 60 * 1000) {
        const data = { processos: p, historico: h, ts: agora };
        await ST.set("backup_data", data);
        await ST.set("last_backup_ts", agora);
        console.info("[Backup] Semanal realizado.");
      }
    } catch(e) { console.warn("[Backup] Falhou:", e.message); }
  }, []);

  const refresh = useCallback(async (isFirst = false) => {
    if (editModeRef.current) return;
    // [FIX-SAVE-BLOCK] Se save em andamento, agenda refresh para depois
    if (savingInProgressRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    if (refreshInProgressRef.current && !isFirst) {
      pendingRefreshRef.current = true;
      return;
    }
    refreshInProgressRef.current = true;
    try {
      const [combined, o, a, n] = await Promise.all([
        loadAllCombined(),
        ST.get("orgaos_config"),
        ST.get("app_config"),
        ST.get("imported_max_num")
      ]);
      const p = combined.processos;
      const h = combined.historico;
      if (isFirst) { setErroRede(""); setCarregando(false); }
      setSbOnline(_sbLive);
      setProcessos(p || []);
      setHistorico(h || []);
      if (isFirst) verificarEFazerBackup(p || [], h || []).catch(()=>{});
      
      const hoje = new Date();
      const atrasados = (h || []).filter(hh => {
        if (hh["_decisao"] === "deferir" || hh["_decisao"] === "indeferir") return false;
        if (hh["Decisão"] && String(hh["Decisão"]).trim()) return false;
        if (!hh["_registradoEm"]) return false;
        const parts = String(hh["_registradoEm"]).split(", ")[0].split("/");
        if (parts.length < 3) return false;
        const dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        const diff = (hoje - dt) / (1000 * 60 * 60 * 24);
        return diff >= 5;
      });
      setPendentesAtrasados(atrasados);
      if (o) setOrgaosConfig(o);
      if (a) setAppConfig(a);
      if (n && Number.isInteger(n) && n > 0) {
        setImportedMaxNum(n);
        try {
          const localN = parseInt(JSON.parse(localStorage.getItem("cgel_processo_next_anchor")||"0"),10)||0;
          if (n > localN) localStorage.setItem("cgel_processo_next_anchor", JSON.stringify(n));
        } catch {}
      } else if (isFirst && (!p || p.length === 0)) {
        setImportedMaxNum(0);
        localAncoraRef.current = 0;
        try {
          localStorage.removeItem("cgel_processo_next_anchor");
          localStorage.removeItem("cgel_protocolo_seq");
        } catch {}
      }
    } catch (err) {
      if (isFirst) { setErroRede("Falha ao carregar dados. Verifique a conexão."); setCarregando(false); }
    } finally {
      refreshInProgressRef.current = false;
      // [FIX-RACE] Se houve refresh pendente enquanto este corria, executa agora
      if (pendingRefreshRef.current) {
        pendingRefreshRef.current = false;
        setTimeout(() => { if (refreshRef.current) refreshRef.current(false); }, 300);
      }
    }
  }, [verificarEFazerBackup]);

  useEffect(() => {
    refresh(true);
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!_sbReady) return;
    const channel = _sb.channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cgel_store' }, () => refresh(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cgel_historico' }, () => refresh(false))
      .subscribe();
    return () => { _sb.removeChannel(channel); };
  }, [refresh]);

  // Polling adaptativo: 8s logo após save, 45s quando banco estável
  const _pollInterval = useRef(45000);
  const _pollTimer = useRef(null);
  const _scheduleNextPoll = useCallback(() => {
    if (_pollTimer.current) clearTimeout(_pollTimer.current);
    _pollTimer.current = setTimeout(async () => {
      const mudou = await _versaoBancoCambou();
      setSbOnline(_sbLive);
      if (mudou) {
        _pollInterval.current = 8000; // houve mudança → aumentar frequência temporariamente
        refresh(false);
      } else {
        // Nenhuma mudança → aumentar intervalo gradualmente até 60s
        _pollInterval.current = Math.min(_pollInterval.current * 1.5, 60000);
      }
      _scheduleNextPoll();
    }, _pollInterval.current);
  }, [refresh]);
  // Reduz intervalo imediatamente após um save (chamado externamente via window)
  window._pollAfterSave = () => { _pollInterval.current = 8000; _scheduleNextPoll(); };
  useEffect(() => {
    _scheduleNextPoll();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        _pollInterval.current = 8000; // volta ao ativo → aumenta frequência
        _scheduleNextPoll();
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (_pollTimer.current) clearTimeout(_pollTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [_scheduleNextPoll, refresh]);

  useEffect(() => {
    if (user) {
      reiniciarTimerSessao();
      loadJsPDF().catch(() => {});
      loadDocxLib().catch(() => {});
    }
    return () => { if (sessaoTimerRef.current) clearTimeout(sessaoTimerRef.current); };
  }, [user, reiniciarTimerSessao]);

  useEffect(() => {
    if (!user) return;
    const eventos = ["mousedown", "keydown", "touchstart", "scroll"];
    const handler = () => reiniciarTimerSessao();
    eventos.forEach(e => document.addEventListener(e, handler, { passive: true }));
    return () => eventos.forEach(e => document.removeEventListener(e, handler));
  }, [user, reiniciarTimerSessao]);

  const handleSetPage = useCallback((p, filter = "") => {
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
          setGlobalFilter(filter);
        }
      });
      return;
    }
    if (p !== "processos") setFormPct(0);
    setPage(p);
    setGlobalFilter(filter);
  }, []);

  const salvarProcessos = p => { setProcessos(p); };
  const salvarHistorico = h => { setHistorico(h); };
  const salvarOrgaos = async o => {
    setOrgaosConfig(o);
    await ST.set("orgaos_config", o);
    _incrementarVersao().catch(()=>{});
  };

  const onSave = useCallback(async (row, form, user) => {
    savingInProgressRef.current = true;
    let numSalvo = null;
    try {
      let numAlocado;
      const numManual = parseInt(String(form.numDoc || "").trim(), 10);
      const isManual = form._isManualNum && !isNaN(numManual) && numManual > 0;

      if (isManual) {
        // [MANUAL-OVERRIDE] Se o usuário forçou um número, verifica se já existe
        const jaExiste = await ST.get(`proc_${numManual}`);
        if (jaExiste && !jaExiste._reservado) {
          toast(`❌ O número ${numManual} já está em uso por outro processo.`, "error");
          return;
        }
        numAlocado = numManual;
        toast(`⚙️ Usando número manual: ${numAlocado}`, "info");
      } else {
        // [AUTO-NUM] Aloca número automaticamente de forma atômica
        try {
          numAlocado = await _alocarNumeroAtomico(processosRef.current);
        } catch (errAloc) {
          toast(`❌ ${errAloc.message}`, "error");
          return;
        }
      }

      numSalvo = String(numAlocado);
      // Atualiza o row com o número definitivo
      const rowFinal = { ...row, "NÚMERO DO DOCUMENTO": numSalvo };

      const usuario = user?.login || user?.nome || "sistema";
      const novoItem = { ...rowFinal, "_tipoKey": form.tipo, "_decisao": form.decisao, "_obs": form.obs, "_usuario": usuario };

      // Atualiza âncora local e estado para refletir novo número alocado
      try {
        const localAtual = parseInt(JSON.parse(localStorage.getItem("cgel_processo_next_anchor")||"0"),10)||0;
        if (numAlocado > localAtual) localStorage.setItem("cgel_processo_next_anchor", JSON.stringify(numAlocado));
      } catch {}
      if (numAlocado > importedMaxNumRef.current) {
        setImportedMaxNum(numAlocado);
        ST.set("imported_max_num", numAlocado).catch(() => {});
      }

      const hRow = {
        // Chaves de Exibição (Histórico)
        "Processo": numSalvo, 
        "Data": dtExt(fmtD(rowFinal["DATA"])), 
        "Órgão": rowFinal["ORGÃO"],
        "Fornecedor": rowFinal["FORNECEDOR"], 
        "Valor": rowFinal["VALOR"], 
        "Tipo": TINFO[form.tipo]?.label || form.tipo,
        "TipoKey": form.tipo, 
        "Decisão": form.decisao === "deferir" ? "DEFERIDO" : form.decisao === "indeferir" ? "INDEFERIDO" : "",
        "CNPJ": rowFinal["CNPJ"] || "", 
        "MODALIDADE": rowFinal["MODALIDADE"] || "", 
        "CONTRATO": rowFinal["CONTRATO"] || "",
        "OBJETO": rowFinal["OBJETO"] || "", 
        "DOCUMENTO FISCAL": rowFinal["DOCUMENTO FISCAL"] || "", 
        "Nº": rowFinal["Nº"] || "",
        "TIPO": rowFinal["TIPO"] || "", 
        "SECRETARIO": rowFinal["SECRETARIO"] || "", 
        "PERÍODO DE REFERÊNCIA": rowFinal["PERÍODO DE REFERÊNCIA"] || "",
        "N° ORDEM DE COMPRA": rowFinal["N° ORDEM DE COMPRA"] || "", 
        "DATA NF": rowFinal["DATA NF"] || "", 
        
        // Chaves de Processo (Busca/Edição — Fallback)
        "NÚMERO DO DOCUMENTO": numSalvo,
        "ORGÃO": rowFinal["ORGÃO"],
        "FORNECEDOR": rowFinal["FORNECEDOR"],
        "VALOR": rowFinal["VALOR"],
        "DATA": rowFinal["DATA"],
        
        "_obs": form.obs, 
        "_sits": rowFinal["_sits"] || [], 
        "_tipoKey": form.tipo, 
        "_decisao": form.decisao, 
        "_usuario": usuario,
        "_registradoEm": new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      };
      // Atualiza estado local imediatamente (otimista)
      setProcessos(prev => {
        const idx = prev.findIndex(p => String(p["NÚMERO DO DOCUMENTO"]) === numSalvo);
        return idx >= 0 ? [...prev.slice(0,idx), novoItem, ...prev.slice(idx+1)] : [...prev, novoItem];
      });
      setHistorico(prev => {
        const idx = prev.findIndex(h => String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "") === numSalvo);
        return idx >= 0 ? [...prev.slice(0,idx), hRow, ...prev.slice(idx+1)] : [hRow, ...prev];
      });
      // Persiste no Supabase — proc_{N} substitui o placeholder de reserva
      // [FIX-NOTIFY-ORDER] Grava os dados PRIMEIRO, depois notifica outros clientes.
      // Se _incrementarVersao fosse paralelo aos sets, outros clientes receberiam
      // o evento realtime antes de proc_NUM existir no banco → viam lista desatualizada.
      const [resPoc] = await Promise.all([
        ST.set(`proc_${numSalvo}`, novoItem),
        ST.set(`hist_${numSalvo}`, hRow),
        _sbFetch("HIST_POST", null, {
          num_processo: numSalvo, orgao: hRow["Órgão"]||"", fornecedor: hRow["Fornecedor"]||"",
          cnpj: hRow["CNPJ"]||"", valor: hRow["Valor"]||"", tipo_key: hRow["TipoKey"]||"", decisao: hRow["Decisão"]||"",
          status: form.status || "analise", usuario: hRow["_usuario"]||"", dados: hRow
        }).catch(()=>{})
      ]);
      // [FIX-EDIT-STALE] Atualiza MEM explicitamente para garantir que o refresh
      // subsequente leia os dados corretos do cache local.
      try { MEM[`proc_${numSalvo}`] = novoItem; } catch {}
      try { MEM[`hist_${numSalvo}`] = hRow; } catch {}
      // [P-3] Invalida cache buildMapData após save para forçar recalculo
      _mapDataCache = null; _mapDataKey = null;
      // Polling adaptativo: acelera após save
      try { window._pollAfterSave && window._pollAfterSave(); } catch {}
      // Notifica DEPOIS que todos os dados estão no banco
      _incrementarVersao().catch(()=>{});
      if (resPoc.cloud) toast(`✅ Processo Nº ${numSalvo} salvo na nuvem ☁️`);
      else toast(`⚠️ Processo Nº ${numSalvo} salvo localmente — verifique conexão.`, "warn");
    } finally {
      // [FIX-EDIT-STALE] Aguarda 3s antes de liberar savingInProgressRef para
      // dar tempo à fila de escritas do Supabase confirmar proc_NUM.
      setTimeout(() => {
        savingInProgressRef.current = false;
        setTimeout(() => { if (refreshRef.current) refreshRef.current(false); }, 500);
      }, 3000);
    }
    return numSalvo;
  }, [releaseLock, toast]);

  const onSaveEdit = useCallback(async (row, form, numOriginal, user) => {
    savingInProgressRef.current = true;
    let numStr = String(numOriginal);
    // [FIX-EDIT-NUM] row["NÚMERO DO DOCUMENTO"] chega como "0" do handleSalvar.
    // Substitui pelo número correto (numStr) antes de qualquer uso.
    const rowCorrigido = { ...row, "NÚMERO DO DOCUMENTO": numStr };
    try {
      const usuario = user?.login || user?.nome || "sistema";
      if (user?.perfil !== "admin") {
        let procOriginal = null;
        try { procOriginal = await ST.get(`proc_${numStr}`); } catch {}
        if (!procOriginal) procOriginal = processosRef.current?.find(p => String(p["NÚMERO DO DOCUMENTO"]) === numStr);
        if (procOriginal && procOriginal["_usuario"] && procOriginal["_usuario"] !== usuario) {
          toast("⛔ Sem permissão para editar processo de outro usuário.", "error");
          return;
        }
      }
      // [EDIT-PRESERVE-HIST] Ao editar, apenas proc_NUM recebe os dados novos.
      // hist_NUM e cgel_historico preservam os dados ORIGINAIS do cadastro inicial
      // (órgão, fornecedor, valor, data, etc.) para que Histórico, Protocolo e
      // Dashboard continuem mostrando o registro original.
      // Apenas _decisao, _tipoKey, _obs, _sits são atualizados no hist_ para
      // manter a decisão (DEFERIDO/INDEFERIDO/PENDENTE) correta.
      const novoItem = { ...rowCorrigido, "_tipoKey": form.tipo, "_decisao": form.decisao, "_obs": form.obs, "_sits": rowCorrigido["_sits"] || [], "_usuario": usuario };

      // Lê o hist_ original para preservar campos de exibição
      let histOriginal = null;
      try { histOriginal = await ST.get(`hist_${numStr}`); } catch {}
      if (!histOriginal) histOriginal = historicoRef.current?.find(h => String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "") === numStr) || null;

      // Atualiza apenas os campos de controle no hist_ (decisão/tipo/obs/sits),
      // sem alterar os campos de exibição originais (órgão, fornecedor, valor, data...).
      const hRowAtualizado = histOriginal
        ? {
            ...histOriginal,
            "Decisão": form.decisao === "deferir" ? "DEFERIDO" : form.decisao === "indeferir" ? "INDEFERIDO" : (histOriginal["Decisão"] || ""),
            "Tipo": TINFO[form.tipo]?.label || form.tipo || histOriginal["Tipo"] || "",
            "TipoKey": form.tipo || histOriginal["TipoKey"] || "",
            "_tipoKey": form.tipo || histOriginal["_tipoKey"] || "",
            "_decisao": form.decisao || histOriginal["_decisao"] || "",
            "_obs": form.obs || histOriginal["_obs"] || "",
            "_sits": rowCorrigido["_sits"] || histOriginal["_sits"] || []
          }
        : {
            // Fallback: se não existia hist_ (processo antigo), cria com dados atuais
            "Processo": numStr,
            "Data": dtExt(fmtD(rowCorrigido["DATA"] || "")),
            "Órgão": rowCorrigido["ORGÃO"] || "",
            "Fornecedor": rowCorrigido["FORNECEDOR"] || "",
            "Valor": rowCorrigido["VALOR"] || "",
            "Tipo": TINFO[form.tipo]?.label || form.tipo,
            "TipoKey": form.tipo,
            "Decisão": form.decisao === "deferir" ? "DEFERIDO" : form.decisao === "indeferir" ? "INDEFERIDO" : "",
            "CNPJ": rowCorrigido["CNPJ"] || "",
            "MODALIDADE": rowCorrigido["MODALIDADE"] || "",
            "CONTRATO": rowCorrigido["CONTRATO"] || "",
            "OBJETO": rowCorrigido["OBJETO"] || "",
            "DOCUMENTO FISCAL": rowCorrigido["DOCUMENTO FISCAL"] || "",
            "Nº": rowCorrigido["Nº"] || "",
            "TIPO": rowCorrigido["TIPO"] || "",
            "SECRETARIO": rowCorrigido["SECRETARIO"] || "",
            "PERÍODO DE REFERÊNCIA": rowCorrigido["PERÍODO DE REFERÊNCIA"] || "",
            "N° ORDEM DE COMPRA": rowCorrigido["N° ORDEM DE COMPRA"] || "",
            "DATA NF": rowCorrigido["DATA NF"] || "",
            "NÚMERO DO DOCUMENTO": numStr,
            "ORGÃO": rowCorrigido["ORGÃO"],
            "FORNECEDOR": rowCorrigido["FORNECEDOR"],
            "VALOR": rowCorrigido["VALOR"],
            "DATA": rowCorrigido["DATA"],
            "_obs": form.obs,
            "_sits": rowCorrigido["_sits"] || [],
            "_tipoKey": form.tipo,
            "_decisao": form.decisao,
            "_usuario": usuario,
            "_registradoEm": new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
          };

      setProcessos(prev => {
        const idx = prev.findIndex(p => String(p["NÚMERO DO DOCUMENTO"]) === numStr);
        return idx >= 0 ? [...prev.slice(0,idx), novoItem, ...prev.slice(idx+1)] : [...prev, novoItem];
      });
      // [EDIT-PRESERVE-HIST] NÃO atualiza setHistorico com dados novos —
      // o histórico exibido permanece com os dados do cadastro original.
      // Apenas atualiza a decisão/tipo no estado local para manter consistência.
      setHistorico(prev => {
        const idx = prev.findIndex(h => String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "") === numStr);
        return idx >= 0 ? [...prev.slice(0,idx), hRowAtualizado, ...prev.slice(idx+1)] : [hRowAtualizado, ...prev];
      });
      const [resProc] = await Promise.all([
        ST.set(`proc_${numStr}`, novoItem),
        // [EDIT-PRESERVE-HIST] Grava hist_ com dados preservados (apenas decisão/tipo atualizados)
        ST.set(`hist_${numStr}`, hRowAtualizado),
        // [EDIT-PRESERVE-HIST] Atualiza cgel_historico SOMENTE com campos de controle
        // (decisao, tipo_key) — campos de exibição (orgao, fornecedor, valor) permanecem
        // com os valores originais gravados no cadastro inicial.
        _sbFetch("HIST_POST", null, {
          num_processo: numStr,
          orgao: hRowAtualizado["Órgão"] || "",
          fornecedor: hRowAtualizado["Fornecedor"] || "",
          cnpj: hRowAtualizado["CNPJ"] || "",
          valor: hRowAtualizado["Valor"] || "",
          tipo_key: hRowAtualizado["TipoKey"] || "",
          decisao: hRowAtualizado["Decisão"] || "",
          status: "analise",
          usuario: hRowAtualizado["_usuario"] || "",
          dados: hRowAtualizado
        }).catch(() => {})
      ]);
      // [FIX-EDIT-STALE] Garante que MEM e localStorage têm o valor atualizado
      // antes de qualquer refresh disparado pelo realtime ou polling.
      try { MEM[`proc_${numStr}`] = novoItem; } catch {}
      try { MEM[`hist_${numStr}`] = hRowAtualizado; } catch {}
      // Incrementa versão APÓS garantir que o cache local está atualizado.
      _incrementarVersao().catch(()=>{});
      if (resProc.cloud) toast(`✅ Processo ${numStr} atualizado na nuvem ☁️`, "info");
      else toast(`⚠️ Processo ${numStr} atualizado localmente — verifique Supabase.`, "warn");
      releaseLock(numStr);
    } finally {
      // [FIX-EDIT-STALE] Mantém savingInProgressRef=true por 3s para bloquear
      // refreshes prematuros enquanto a fila de escritas do Supabase confirma.
      setTimeout(() => {
        savingInProgressRef.current = false;
        setTimeout(() => { if (refreshRef.current) refreshRef.current(false); }, 500);
      }, 3000);
    }
    return numStr;
  }, [releaseLock, toast]);

  const handleEditar = useCallback(row => {
    setEditarData(row);
    const num = row["NÚMERO DO DOCUMENTO"] || row["NUMERO DO DOCUMENTO"];
    setLock(num);
    handleSetPage("processos");
  }, [handleSetPage, setLock]);

  const handleDuplicar = useCallback(row => {
    setDuplicarData(row);
    handleSetPage("processos");
  }, [handleSetPage]);

  const nextProcessoNumber = useMemo(() => {
    // Se estiver carregando e não tiver processos, não sugerir 1 ainda
    if (carregando && processos.length === 0) return "...";

    // Números de processos cadastrados
    const manuais = new Set(
      processos
        .map(p => parseInt(String(p["NÚMERO DO DOCUMENTO"] || "").trim(), 10))
        .filter(n => !isNaN(n) && n > 0 && n < 99999)
    );

    // [B4.1-08] Usa ref populado no useEffect (não lê localStorage aqui)
    const anchoraEfetiva = Math.max(importedMaxNum, localAncoraRef.current);

    if (anchoraEfetiva > 0) {
      let next = anchoraEfetiva + 1;
      while (manuais.has(next)) next++;
      return next;
    }

    // Sem âncora: usa maior existente + 1
    const nums = [...manuais];
    if (!nums.length) return 1;
    let next = Math.max(...nums) + 1;
    while (manuais.has(next)) next++;
    return next;
  }, [processos, importedMaxNum, carregando]);

  const handleGerarPDFBusca = useCallback(async row => {
    const tipo = row["_tipoKey"] || "padrao";
    const chk = CHK[tipo] || [];
    const sitsRaw = row["_sits"] || row["_chks"];
    const sits = Array.isArray(sitsRaw) && sitsRaw.length === chk.length ? sitsRaw : Array(chk.length).fill(true);
    const decRaw = row["_decisao"] || row["Decisão"] || "deferir";
    const isDeferido = decRaw !== "indeferir" && !String(decRaw).toUpperCase().includes("INDE");
    const procCompleto = processos.find(p => String(p["NÚMERO DO DOCUMENTO"]) === String(row["NÚMERO DO DOCUMENTO"] || row["Processo"] || ""));
    const r2 = procCompleto || row;
    const d = {
      processo: r2["NÚMERO DO DOCUMENTO"] || row["Processo"] || "", orgao: r2["ORGÃO"] || r2["Órgão"] || row["Órgão"] || "",
      secretario: r2["SECRETARIO"] || "", fornecedor: r2["FORNECEDOR"] || r2["Fornecedor"] || row["Fornecedor"] || "",
      cnpj: r2["CNPJ"] || "", nf: r2["Nº"] || "", contrato: r2["CONTRATO"] || "", modalidade: r2["MODALIDADE"] || "",
      periodo_ref: r2["PERÍODO DE REFERÊNCIA"] || "", ordem_compra: r2["N° ORDEM DE COMPRA"] || "",
      data_nf: formatData(r2["DATA NF"] || row["Data"] || ""), data_ateste: dtExt(formatData(r2["DATA"] || row["Data"] || "")),
      objeto: r2["OBJETO"] || "", valor: r2["VALOR"] || r2["Valor"] || row["Valor"] || "", tipo_doc: r2["DOCUMENTO FISCAL"] || "",
      tipo_nf: r2["TIPO"] || "", obs: r2["_obs"] || "", controlador: appConfig?.controlador || {}
    };
    const r = await gerarPDF(d, tipo, isDeferido, chk, sits);
    if (r.error) { toast("❌ PDF: " + r.error, "error"); return; }
    const url = URL.createObjectURL(r.blob);
    const a = document.createElement("a"); a.href = url; a.download = r.name; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    toast("✅ PDF gerado!");
  }, [appConfig, processos, toast]);

  const handleSync = useCallback(async () => {
    if (!_sbReady) { toast("⚠️ Supabase não configurado.", "warn"); return; }
    toast("🔄 Sincronizando e Auditando...", "info");
    const runBatch = async (fns, batchSize = 30) => {
      for (let i = 0; i < fns.length; i += batchSize) await Promise.all(fns.slice(i, i + batchSize).map(f => f()));
    };
    
    // Busca normal
    const [combined0, o] = await Promise.all([loadAllCombined(), ST.get("orgaos_config")]);
    let p = combined0.processos || [];
    let h = combined0.historico || [];

    // --- AUDITORIA DE BURACOS (Ex: se falta o 2775) ---
    const numsPresentes = new Set(p.map(x => parseInt(String(x["NÚMERO DO DOCUMENTO"] || "0"), 10)).filter(n => n > 0));
    if (numsPresentes.size > 0) {
      const max = Math.max(...numsPresentes);
      const min = Math.max(1, max - 100); // audita os últimos 100
      const faltantes = [];
      for (let i = min; i <= max; i++) { if (!numsPresentes.has(i)) faltantes.push(i); }
      
      if (faltantes.length > 0) {
        toast(`🔍 Auditando ${faltantes.length} possíveis processos ocultos...`, "info");
        const resgatados = await Promise.all(faltantes.map(n => ST.get(`proc_${n}`).catch(() => null)));
        resgatados.filter(Boolean).forEach(rp => {
           if (!p.find(px => String(px["NÚMERO DO DOCUMENTO"]) === String(rp["NÚMERO DO DOCUMENTO"]))) {
             p.push(rp);
           }
        });
      }
    }

    const procFns = p.filter(proc => String(proc["NÚMERO DO DOCUMENTO"] || "").trim()).map(proc => () => ST.set(`proc_${String(proc["NÚMERO DO DOCUMENTO"]).trim()}`, proc));
    const histFns = h.filter(hist => String(hist["Processo"] || hist["NÚMERO DO DOCUMENTO"] || "").trim()).map(hist => () => ST.set(`hist_${String(hist["Processo"] || hist["NÚMERO DO DOCUMENTO"]).trim()}`, hist));
    await runBatch(procFns); await runBatch(histFns);
    if (o) await ST.set("orgaos_config", o);
    
    const [freshCombined] = await Promise.all([loadAllCombined(), _incrementarVersao().catch(()=>{})]);
    setProcessos(freshCombined.processos || []); setHistorico(freshCombined.historico || []);
    setSbOnline(_sbLive);
    toast(`☁️ Sincronizado e Auditado! ${p.length} processos encontrados.`, "info");
  }, [toast, processos]);

  const handleImport = useCallback(async (rows, lastNum) => {
    const rowMap = {}; rows.forEach(r => { rowMap[String(r["NÚMERO DO DOCUMENTO"])] = r; });
    const fornMap = {}; rows.forEach(r => { const f = String(r["FORNECEDOR"] || "").trim(); if (f) fornMap[f] = r; });
    const enriched = processos.filter(p => !rowMap[String(p["NÚMERO DO DOCUMENTO"])]).map(p => {
      const forn = String(p["FORNECEDOR"] || "").trim();
      const ref = fornMap[forn];
      if (!ref) return p;
      return { ...p, "CNPJ": p["CNPJ"] || ref["CNPJ"] || "", "MODALIDADE": p["MODALIDADE"] || ref["MODALIDADE"] || "", "CONTRATO": p["CONTRATO"] || ref["CONTRATO"] || "", "DOCUMENTO FISCAL": p["DOCUMENTO FISCAL"] || ref["DOCUMENTO FISCAL"] || "", "TIPO": p["TIPO"] || ref["TIPO"] || "", "OBJETO": p["OBJETO"] || ref["OBJETO"] || "", "SECRETARIO": p["SECRETARIO"] || ref["SECRETARIO"] || "" };
    });
    const merged = [...rows, ...enriched];

    // [FIX-IMPORT-ATOMIC] Grava cada processo em chave individual (proc_NUM)
    // em vez de salvarProcessos(merged) que gravava o blob inteiro — race condition grave
    setProcessos(merged);
    const runBatch = async (fns, batchSize = 30) => {
      for (let i = 0; i < fns.length; i += batchSize) {
        await Promise.all(fns.slice(i, i + batchSize).map(f => f()));
      }
    };
    const procFns = merged
      .filter(proc => String(proc["NÚMERO DO DOCUMENTO"] || "").trim())
      .map(proc => () => ST.set(`proc_${String(proc["NÚMERO DO DOCUMENTO"]).trim()}`, proc));
    runBatch(procFns).catch(() => {}); // fire-and-forget — não bloqueia a UI

    // [FIX-SYNC11] Notifica outros clientes que planilha foi importada
    _incrementarVersao().catch(()=>{});
    // ── Auditoria de numeração ────────────────────────────────────────────────
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
  const handleSyncDB = useCallback(async res => {
    const runBatch = async (fns, batchSize = 30) => {
      for (let i = 0; i < fns.length; i += batchSize) {
        await Promise.all(fns.slice(i, i + batchSize).map(f => f()));
      }
    };
    if (res.processos?.length) {
      salvarProcessos(res.processos);
      // [FIX-SYNCDB-ATOMIC] Grava individualmente — sem race condition
      const fns = res.processos
        .filter(p => String(p["NÚMERO DO DOCUMENTO"] || "").trim())
        .map(p => () => ST.set(`proc_${String(p["NÚMERO DO DOCUMENTO"]).trim()}`, p));
      runBatch(fns).catch(()=>{});
    }
    if (res.historico?.length) {
      salvarHistorico(res.historico);
      const fns = res.historico
        .filter(h => String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "").trim())
        .map(h => () => ST.set(`hist_${String(h["Processo"] || h["NÚMERO DO DOCUMENTO"]).trim()}`, h));
      runBatch(fns).catch(()=>{});
    }
    if (Object.keys(res.orgaosConfig || {}).length) salvarOrgaos(res.orgaosConfig);
    _incrementarVersao().catch(()=>{});
  }, []);

  // [C4] Histórico truncado check
  const histTruncado = historico.length >= 1000;

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
  }, /*#__PURE__*/React.createElement("style", null, `*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e2d40;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#2d4060}input,select,textarea{font-family:inherit}@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.page-enter{animation:fadeIn .18s ease-out both}@media(max-width:768px){.sidebar-hidden{display:none!important}.main-full{margin-left:0!important}}.hamburger-btn{display:none!important}@media(max-width:900px){.hamburger-btn{display:flex!important}}@media(max-width:640px){.grid-1col{grid-template-columns:1fr!important}}`), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSidebarOpen(o => !o),
    style: {
      position: "fixed", top: 12, left: 12, zIndex: 1000,
      background: MUN.green, border: "none", borderRadius: 8,
      width: 38, height: 38, cursor: "pointer", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,.3)"
    },
    className: "hamburger-btn",
    style: {
      position: "fixed", top: 12, left: 12, zIndex: 1000,
      background: MUN.green, border: "none", borderRadius: 8,
      width: 38, height: 38, cursor: "pointer", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,.3)"
    }
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
    onToggleDark: () => setDark(d => {
      const nd = !d;
      try { localStorage.setItem("cgel_dark", nd ? "1" : "0"); } catch {}
      return nd;
    }),
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
    onEditModeChange: isEditing => {
      editModeRef.current = isEditing;
      // [FIX-SYNC4] Ao fechar edição: re-busca imediato para capturar
      // saves de outros usuários que foram bloqueados pelo guard M2
      if (!isEditing && refreshRef.current) refreshRef.current(false);
    }
  }), page === "buscar" && /*#__PURE__*/React.createElement(BuscarPage, {
    processos: processos,
    onCarregar: handleDuplicar,
    onEditar: handleEditar,
    onGerarPDF: handleGerarPDFBusca,
    toast: toast,
    dark: dark,
    user: user,
    initialFilter: globalFilter
  }), page === "dashboard" && /*#__PURE__*/React.createElement(DashboardPage, {
    processos: processos,
    historico: historico,
    dark: dark,
    appConfig: appConfig,
    toast: toast,
    onNavigate: handleSetPage
  }), page === "historico" && /*#__PURE__*/React.createElement(HistoricoPage, {
    historico: historico,
    dark: dark,
    processos: processos,
    initialFilter: globalFilter,
    onDuplicar: handleDuplicar,
    onGerarPDF: handleGerarPDFBusca,
    onEditar: async h => {
      const num = String(h["Processo"] || h["NÚMERO DO DOCUMENTO"] || "");
      if (!num) return;
      // Tenta achar na lista local primeiro
      let proc = processos.find(p => String(p["NÚMERO DO DOCUMENTO"]) === num);
      // Se não achar local, busca detalhes direto no Supabase
      if (!proc) {
        toast("🔍 Buscando dados completos no banco...", "info");
        try { proc = await ST.get(`proc_${num}`); } catch {}
      }
      if (proc) {
        handleEditar(proc);
      } else {
        toast("❌ Detalhes do processo não encontrados.", "warn");
      }
    },
    truncado: histTruncado
  }), page === "protocolo" && /*#__PURE__*/React.createElement(ProtocoloPage, {
    historico: historico,
    processos: processos,
    dark: dark,
    toast: toast,
    appConfig: appConfig
  }), page === "parecer" && /*#__PURE__*/React.createElement(window.ParecerPage || "div", {
    processos: processos,
    dark: dark,
    toast: toast,
    appConfig: appConfig
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
      // [FIX-SYNC7] Notifica outros clientes que o banco foi limpo
      _incrementarVersao().catch(()=>{});
      toast("🗑️ Banco de dados apagado com sucesso.", "info");
    }
  })), showShortcuts && /*#__PURE__*/React.createElement(ShortcutsModal, {
    onClose: () => setShowShortcuts(false),
    dark: dark
  }),
  /*#__PURE__*/React.createElement(Toast, { toasts: toasts }),
    showCmdK && /*#__PURE__*/React.createElement(CommandPalette, {
      processos: processos,
      onClose: () => setShowCmdK(false),
      onEditar: p => setEditarData(p),
      onNavigate: handleSetPageCmdK,
      dark: dark
    }),
  appConfirmModal && /*#__PURE__*/React.createElement(ConfirmModal, {
    titulo: appConfirmModal.titulo,
    msg: appConfirmModal.msg,
    tipo: appConfirmModal.tipo || "warn",
    dark: dark,
    onOk: appConfirmModal.onOk,
    onCancel: () => setAppConfirmModal(null)
  }));
}






// ─── Protocolo Page ────────────────────────────────────────────────────────────
// Numeração persistida em Supabase/localStorage: chave "protocolo_seq"
// Garante sequência sem repetição, pulo ou sobrescrita entre usuários/sessões

// Lock global para evitar corrida entre chamadas simultâneas na mesma aba
let _protoLock = false;
let _protoQueue = [];

async function _nextProtocoloNum() {
  if (_protoLock) {
    await new Promise(res => _protoQueue.push(res));
  }
  _protoLock = true; // seta APÓS sair da fila — correto para esta chamada
  try {
    let atual = 0;
    try {
      const v = await ST.get("protocolo_seq");
      if (v !== null && !isNaN(parseInt(v, 10))) atual = parseInt(v, 10);
    } catch {}
    try {
      const local = localStorage.getItem("cgel_protocolo_seq");
      if (local !== null) {
        const localNum = parseInt(JSON.parse(local), 10);
        if (!isNaN(localNum) && localNum > atual) atual = localNum;
      }
    } catch {}
    const proximo = atual + 1;
    try { localStorage.setItem("cgel_protocolo_seq", JSON.stringify(proximo)); } catch {}
    ST.set("protocolo_seq", proximo).catch(() => {});
    return proximo;
  } finally {
    _protoLock = false;
    if (_protoQueue.length > 0) { const next = _protoQueue.shift(); next(); }
  }
}

// ─── Salvar registro no histórico de protocolos ───────────────────────────────
async function _salvarHistoricoProtocolo(registro) {
  try {
    // Chave única por protocolo: proto_NNNNN_TIMESTAMP
    const chave = `proto_${String(registro.numProto).padStart(5,"0")}_${Date.now()}`;
    await ST.set(chave, registro);
    // [FIX-SYNC2] Notifica outros clientes (ETag) — antes não era chamado aqui
    _incrementarVersao().catch(()=>{});
  } catch(e) { console.warn("[Protocolo] Falha ao salvar histórico:", e.message); }
}

// ─── Carregar histórico de protocolos ─────────────────────────────────────────
async function _carregarHistoricoProtocolos() {
  try {
    const rows = await ST.list("proto_");
    return rows
      .map(r => r.value)
      .filter(Boolean)
      .sort((a,b) => (b.numProto||0) - (a.numProto||0));
  } catch { return []; }
}

// ─── ProtocoloPage ─────────────────────────────────────────────────────────────
function ProtocoloPage({ historico = [], processos = [], dark, toast, appConfig }) {
  const bg   = dark ? T.appBgDark    : T.appBg;
  const card = dark ? T.cardBgDark   : T.cardBg;
  const bdr  = dark ? T.borderDark   : T.border;
  const txt  = dark ? T.textMainDark : T.textMain;

  // modos: "historico" = selecionar processos, "manual" = doc externo, "registro" = hist. de protocolos emitidos
  const [modo, setModo]              = React.useState("historico");
  const [busca, setBusca]            = React.useState("");
  const [buscaReg, setBuscaReg]      = React.useState("");
  const [selecionados, setSel]       = React.useState([]);
  const [gerandoPDF, setGer]         = React.useState(false);
  const [duasVias, setDuasVias]      = React.useState(false);
  const [histProtos, setHistProtos]  = React.useState([]);
  const [carregandoHist, setCarrHist]= React.useState(false);
  // [FIX-PROTO-RELOAD] Contador que força recarga do histórico após cada PDF gerado.
  const [protoReloadKey, setProtoReloadKey] = React.useState(0);

  // ── Documento externo (modo manual) ──
  const docVazio = () => ({ _id: Date.now()+Math.random(), descricao:"", nomeRecebedor:"", local:"João Lisboa – MA" });
  const [docs, setDocs] = React.useState([docVazio()]);

  // ── Carrega histórico de protocolos emitidos ao abrir aba OU após gerar PDF ──
  React.useEffect(() => {
    if (modo !== "registro") return;
    setCarrHist(true);
    _carregarHistoricoProtocolos().then(h => { setHistProtos(h); setCarrHist(false); });
  }, [modo, protoReloadKey]);

  // ── helpers ──
  const parseBRL = v => { const s=String(v||"").replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,""); const n=parseFloat(s); return isNaN(n)?0:n; };
  const fmtBRL   = v => (typeof v==="number"?v:parseBRL(v)).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const MESES_P  = ["","janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

  // ── Itens histórico de processos do sistema ──
  const itensHist = React.useMemo(() => historico.map(h => {
    const proc = processos.find(p => String(p["NÚMERO DO DOCUMENTO"]||"")===String(h["Processo"]||""));
    return {
      _id:       String(h["Processo"]||h["NÚMERO DO DOCUMENTO"]||Math.random()),
      processo:  String(h["Processo"]||h["NÚMERO DO DOCUMENTO"]||""),
      orgao:     String(h["Órgão"]||h["ORGÃO"]||""),
      fornecedor:String(h["Fornecedor"]||h["FORNECEDOR"]||""),
      cnpj:      String(h["CNPJ"]||proc?.["CNPJ"]||""),
      nf:        String(h["Nº"]||proc?.["Nº"]||""),
      valor:     String(h["Valor"]||h["VALOR"]||""),
      data:      String(h["Data"]||h["DATA"]||""),
      objeto:    String(h["OBJETO"]||proc?.["OBJETO"]||""),
    };
  }), [historico, processos]);

  const filtrados = React.useMemo(() => {
    if (!busca.trim()) return itensHist;
    const q = busca.toLowerCase();
    return itensHist.filter(i =>
      String(i.processo||"").toLowerCase().includes(q)||
      String(i.orgao||"").toLowerCase().includes(q)||
      String(i.fornecedor||"").toLowerCase().includes(q)||
      String(i.nf||"").toLowerCase().includes(q)
    );
  }, [itensHist, busca]);

  // ── Filtro do histórico de protocolos emitidos ──
  const filtradosReg = React.useMemo(() => {
    if (!buscaReg.trim()) return histProtos;
    const q = buscaReg.toLowerCase();
    return histProtos.filter(r =>
      String(r.numProto||"").includes(q) ||
      String(r.tipo||"").toLowerCase().includes(q) ||
      String(r.usuario||"").toLowerCase().includes(q) ||
      (r.itens||[]).some(i => String(i.processo||i.descricao||"").toLowerCase().includes(q) ||
                               String(i.fornecedor||"").toLowerCase().includes(q))
    );
  }, [histProtos, buscaReg]);

  const toggleSel   = id => setSel(p => p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleTodos = () => setSel(selecionados.length===filtrados.length?[]:filtrados.map(i=>i._id));
  const updDoc      = (id,campo,val) => setDocs(p=>p.map(d=>d._id===id?{...d,[campo]:val}:d));
  const addDoc      = () => setDocs(p=>[...p,docVazio()]);
  const delDoc      = id => setDocs(p=>p.filter(d=>d._id!==id));

  // ════════════════════════════════════════════════════════════════════════════
  // FUNÇÕES PDF
  // ════════════════════════════════════════════════════════════════════════════
  function _cabPDF(doc, W) {
    const bW=30.7, bH=22.5, bX=(W-bW)/2, bY=8;
    if (window.BRASAO_B64) { try { doc.addImage(window.BRASAO_B64,"PNG",bX,bY,bW,bH); } catch {} }
    let y = bY + bH + 4.5;
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(0,0,0);
    doc.text("ESTADO DO MARANHÃO",                              W/2, y, {align:"center"}); y+=5;
    doc.text("PREFEITURA MUNICIPAL DE JOÃO LISBOA", W/2, y, {align:"center"}); y+=5;
    doc.text("CONTROLADORIA DO MUNICÍPIO",                      W/2, y, {align:"center"}); y+=5;
    doc.setDrawColor(0,0,0); doc.setLineWidth(0.6);
    doc.line(19, y, W-19, y); y+=1;
    return y;
  }

  function _rodapePDF(doc, numStr, ano, hoje, totalPgs) {
    const W=210;
    for(let pg=1;pg<=totalPgs;pg++){
      doc.setPage(pg);
      doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(150,150,150);
      doc.text(FOOTER_TXT, W/2, 291, {align:"center"});
      doc.text(`Protocolo Nº ${numStr}/${ano}  |  Emitido em: ${hoje}  |  Pág. ${pg}/${totalPgs}`, W/2, 286, {align:"center"});
      doc.setTextColor(0,0,0);
    }
  }

  // ── PDF — Processos do Sistema ──────────────────────────────────────────────
  const gerarPDFSistema = async () => {
    const itens = itensHist.filter(i=>selecionados.includes(i._id));
    if (!itens.length) { toast("Selecione ao menos um processo.","warn"); return; }
    setGer(true);
    try {
      const numProto = await _nextProtocoloNum();
      const { jsPDF } = await loadJsPDF();
      const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const W=210, M=19;
      const ctrl = appConfig?.controlador||{};
      const d = new Date();
      const hoje = `${String(d.getDate()).padStart(2,"0")} de ${MESES_P[d.getMonth()+1]} de ${d.getFullYear()}`;
      const ano  = d.getFullYear();
      const numStr = String(numProto).padStart(5,"0");

      const desenharVia = (doc, isSegundaVia) => {
        if (isSegundaVia) doc.addPage();
        let y = _cabPDF(doc, W) + 6;
        doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(0,0,0);
        doc.text("PROTOCOLO DE PROCESSOS", W/2, y, {align:"center"}); y+=6;
        doc.setFontSize(9); doc.setFont("helvetica","normal");
        doc.text(`Protocolo Nº ${numStr}/${ano}`, W/2, y, {align:"center"}); y+=5;
        doc.setFontSize(8);
        doc.text(`Emissão: ${hoje}    |    Total: ${itens.length} processo(s)`, W/2, y, {align:"center"}); y+=4;
        if (isSegundaVia) {
          doc.setFillColor(230,247,230); doc.setDrawColor(0,96,0); doc.setLineWidth(0.3);
          doc.roundedRect(M, y, W-2*M, 7, 2, 2, "FD");
          doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(0,96,0);
          doc.text("2ª VIA — CÓPIA DO INTERESSADO", W/2, y+4.5, {align:"center"});
          doc.setTextColor(0,0,0); y+=9;
        }
        doc.setLineWidth(0.3); doc.line(M, y, W-M, y); y+=4;
        const cols=[
          {label:"Nº Processo", w:20, key:"processo"},
          {label:"Órgão",       w:38, key:"orgao"},
          {label:"Fornecedor",  w:40, key:"fornecedor"},
          {label:"Nº NF",       w:20, key:"nf"},
          {label:"Valor",       w:26, key:"valor"},
          {label:"Data",        w:22, key:"data"},
        ];
        const LINHA_H=4.2, ROW_PAD=3.5, ROW_MIN=7;
        const tHeader = yy => {
          doc.setFillColor(0,96,0); doc.setTextColor(255,255,255);
          doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
          doc.rect(M,yy,W-2*M,ROW_MIN,"F");
          let cx=M; cols.forEach(c=>{ doc.text(c.label,cx+1,yy+4.8,{maxWidth:c.w-2}); cx+=c.w; });
          doc.setTextColor(0,0,0);
          return yy+ROW_MIN;
        };
        y = tHeader(y);
        doc.setTextColor(0,0,0); doc.setFont("helvetica","normal"); doc.setFontSize(7);
        itens.forEach((item,idx)=>{
          // [BUG-FIX] fmtBRL só para valores numéricos — evita "NaN" na célula
          const valorFmt = parseBRL(item.valor||"0") > 0 ? fmtBRL(parseBRL(item.valor)) : (item.valor||"");
          const v={processo:String(item.processo||""),orgao:String(item.orgao||""),fornecedor:String(item.fornecedor||""),nf:String(item.nf||""),valor:valorFmt,data:String(item.data||"")};
          const linhasPorCol = cols.map(c => doc.splitTextToSize(v[c.key]||"—", c.w-2).length);
          const maxLinhas = Math.max(...linhasPorCol);
          const rowH = Math.max(ROW_MIN, maxLinhas * LINHA_H + ROW_PAD);
          if(y+rowH>258){ doc.addPage(); y=_cabPDF(doc,W)+6; y=tHeader(y); doc.setFont("helvetica","normal"); doc.setFontSize(7); }
          if(idx%2===0){ doc.setFillColor(240,248,240); doc.rect(M,y,W-2*M,rowH,"F"); }
          let cx=M;
          cols.forEach(c=>{
            const linhas = doc.splitTextToSize(v[c.key]||"—", c.w-2);
            doc.text(linhas, cx+1, y+4.2);
            cx+=c.w;
          });
          doc.setDrawColor(180,210,180); doc.setLineWidth(0.1);
          let lx=M; cols.forEach(c=>{lx+=c.w; doc.line(lx,y,lx,y+rowH);}); doc.line(M,y,M,y+rowH); doc.line(W-M,y,W-M,y+rowH); doc.line(M,y+rowH,W-M,y+rowH);
          y+=rowH;
        });
        const total=itens.reduce((a,i)=>a+parseBRL(i.valor||"0"),0);
        y+=4; doc.setFont("helvetica","bold"); doc.setFontSize(9);
        doc.text(`VALOR TOTAL: ${fmtBRL(total)}`, W-M, y, {align:"right"}); y+=14;
        if(y>248){ doc.addPage(); y=_cabPDF(doc,W)+8; }
        doc.setFont("helvetica","normal"); doc.setFontSize(10);
        doc.text(`João Lisboa/MA, ${hoje}`, W-M, y, {align:"right"}); y+=12;
        const xLeft=M+(W-2*M)*0.25, xRight=M+(W-2*M)*0.75, sigW=44;
        doc.setLineWidth(0.4);
        doc.line(xLeft-sigW/2, y, xLeft+sigW/2, y);
        doc.line(xRight-sigW/2, y, xRight+sigW/2, y);
        y+=5;
        doc.setFont("helvetica","bold"); doc.setFontSize(9);
        doc.text(ctrl.nome||"Controlador(a) Geral", xLeft, y, {align:"center"});
        doc.text("Recebido por / Assinatura", xRight, y, {align:"center"});
        y+=5;
        doc.setFont("helvetica","normal"); doc.setFontSize(8);
        doc.text(ctrl.cargo||"Controladoria Geral", xLeft, y, {align:"center"});
        doc.line(xRight-sigW/2, y+4, xRight+sigW/2, y+4);
        doc.setFontSize(7.5); doc.text("Data do Recebimento", xRight, y+9, {align:"center"});
        y+=5;
        if(ctrl.portaria){ doc.setFontSize(7.5); doc.text(ctrl.portaria,xLeft,y,{align:"center"}); }
      };

      desenharVia(doc, false);
      if (duasVias) desenharVia(doc, true);
      _rodapePDF(doc, numStr, ano, hoje, doc.getNumberOfPages());
      doc.save(`Protocolo_${numStr}_${new Date().toISOString().slice(0,10)}.pdf`);

      // ── [NOVO] Salva no histórico de protocolos ──
      const totalVal = itens.reduce((a,i)=>a+parseBRL(i.valor||"0"),0);
      await _salvarHistoricoProtocolo({
        numProto,
        numStr,
        ano,
        tipo:    "processos",
        emitidoEm: new Date().toISOString(),
        emitidoFormatado: hoje,
        vias:    duasVias ? 2 : 1,
        totalItens: itens.length,
        valorTotal: totalVal,
        usuario: appConfig?.controlador?.nome || "sistema",
        itens:   itens.map(i => ({
          processo:   i.processo,
          orgao:      i.orgao,
          fornecedor: i.fornecedor,
          nf:         i.nf,
          valor:      i.valor,
          data:       i.data,
        }))
      });
      // [FIX-PROTO-RELOAD] Incrementa reloadKey → useEffect recarrega se aba "registro"
      // está aberta; se não estiver, o próximo acesso à aba já verá o dado atualizado.
      setProtoReloadKey(k => k + 1);

      toast(`✅ Protocolo Nº ${numStr}/${ano} gerado${duasVias?" (2 vias)":""}!`,"ok");
    } catch(e){ toast("Erro ao gerar PDF: "+e.message,"error"); console.error(e); }
    setGer(false);
  };

  // ── PDF — Recebimento de Documento Externo ─────────────────────────────────
  const gerarPDFManual = async () => {
    const itens = docs.filter(d=>d.descricao.trim());
    if (!itens.length) { toast("Descreva ao menos um documento.","warn"); return; }
    setGer(true);
    try {
      const numProto = await _nextProtocoloNum();
      const { jsPDF } = await loadJsPDF();
      const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const W=210, M=19;
      const ctrl = appConfig?.controlador||{};
      const d = new Date();
      const hoje = `${String(d.getDate()).padStart(2,"0")} de ${MESES_P[d.getMonth()+1]} de ${d.getFullYear()}`;
      const ano  = d.getFullYear();
      const numStr = String(numProto).padStart(5,"0");
      const nomeReceb = itens[0]?.nomeRecebedor || ctrl.nome || "Controlador(a) Geral";
      const localReceb= itens[0]?.local || "João Lisboa – MA";

      const desenharViaRecebimento = (doc, isSegundaVia) => {
        if (isSegundaVia) doc.addPage();
        let y = _cabPDF(doc, W) + 6;
        doc.setFontSize(13); doc.setFont("helvetica","bold"); doc.setTextColor(0,0,0);
        doc.text("PROTOCOLO DE RECEBIMENTO DE DOCUMENTO", W/2, y, {align:"center"}); y+=6;
        doc.setFontSize(9); doc.setFont("helvetica","normal");
        doc.text(`Protocolo Nº ${numStr}/${ano}`, W/2, y, {align:"center"}); y+=5;
        doc.setFontSize(8);
        doc.text(`Emissão: ${hoje}    |    Documentos recebidos: ${itens.length}`, W/2, y, {align:"center"}); y+=4;
        if (isSegundaVia) {
          doc.setFillColor(230,247,230); doc.setDrawColor(0,96,0); doc.setLineWidth(0.3);
          doc.roundedRect(M, y, W-2*M, 7, 2, 2, "FD");
          doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(0,96,0);
          doc.text("2ª VIA — CÓPIA DO INTERESSADO", W/2, y+4.5, {align:"center"});
          doc.setTextColor(0,0,0); y+=9;
        }
        doc.setLineWidth(0.3); doc.line(M, y, W-M, y); y+=6;
        itens.forEach((item,idx)=>{
          if(y>240){ doc.addPage(); y=_cabPDF(doc,W)+6; }
          const linhas = doc.splitTextToSize(item.descricao||"—", W-2*M-6);
          const boxH = Math.max(20, 10 + linhas.length*5.5);
          doc.setFillColor(idx%2===0?245:252, idx%2===0?251:252, idx%2===0?245:252);
          doc.setDrawColor(0,96,0); doc.setLineWidth(0.35);
          doc.rect(M, y, W-2*M, boxH, "FD");
          doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(0,96,0);
          doc.text(`Documento ${idx+1}`, M+3, y+6);
          doc.setTextColor(0,0,0);
          doc.setLineWidth(0.15); doc.line(M+3, y+8, W-M-3, y+8);
          doc.setFont("helvetica","normal"); doc.setFontSize(9);
          doc.text(linhas, M+3, y+14);
          y += boxH+4;
        });
        y += 6;
        if(y>245){ doc.addPage(); y=_cabPDF(doc,W)+8; }
        doc.setFont("helvetica","normal"); doc.setFontSize(10);
        doc.text(`${localReceb}, ${hoje}`, W-M, y, {align:"right"}); y+=14;
        const xC=W/2;
        doc.setLineWidth(0.4); doc.line(xC-45,y,xC+45,y); y+=5;
        doc.setFont("helvetica","bold"); doc.setFontSize(10);
        doc.text(nomeReceb, xC, y, {align:"center"}); y+=5;
        doc.setFont("helvetica","normal"); doc.setFontSize(9);
        doc.text(ctrl.cargo||"Controladoria Geral", xC, y, {align:"center"}); y+=5;
        if(ctrl.portaria){ doc.text(ctrl.portaria, xC, y, {align:"center"}); }
      };

      desenharViaRecebimento(doc, false);
      if (duasVias) desenharViaRecebimento(doc, true);
      _rodapePDF(doc, numStr, ano, hoje, doc.getNumberOfPages());
      doc.save(`Protocolo_Recebimento_${numStr}_${new Date().toISOString().slice(0,10)}.pdf`);

      // ── [NOVO] Salva no histórico de protocolos ──
      await _salvarHistoricoProtocolo({
        numProto,
        numStr,
        ano,
        tipo:    "recebimento",
        emitidoEm: new Date().toISOString(),
        emitidoFormatado: hoje,
        vias:    duasVias ? 2 : 1,
        totalItens: itens.length,
        valorTotal: 0,
        usuario: nomeReceb,
        itens:   itens.map(i => ({
          descricao:     i.descricao,
          nomeRecebedor: i.nomeRecebedor,
          local:         i.local,
        }))
      });
      // [FIX-PROTO-RELOAD] Incrementa reloadKey → useEffect recarrega se aba "registro" está aberta.
      setProtoReloadKey(k => k + 1);

      toast(`✅ Protocolo de Recebimento Nº ${numStr}/${ano} gerado${duasVias?" (2 vias)":""}!`,"ok");
    } catch(e){ toast("Erro ao gerar PDF: "+e.message,"error"); console.error(e); }
    setGer(false);
  };

  // ── Estilos ──
  const inp = {background:dark?"#1a3a28":"#fff",border:"1px solid "+bdr,borderRadius:7,color:txt,padding:"6px 10px",fontSize:12,width:"100%",boxSizing:"border-box"};
  const btn = (bg2,col="#fff")=>({background:bg2,color:col,border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,fontSize:12.5,cursor:"pointer"});

  // ── Render ──
  return /*#__PURE__*/React.createElement("div",{style:{flex:1,background:bg,minHeight:"100vh",padding:"28px 28px 60px"}},

    // ── Título ──
    /*#__PURE__*/React.createElement("div",{style:{marginBottom:20}},
      /*#__PURE__*/React.createElement("div",{style:{fontSize:22,fontWeight:800,color:MUN.green}},"📋 Protocolo de Documentos"),
      /*#__PURE__*/React.createElement("div",{style:{fontSize:13,color:txt,opacity:.7,marginTop:3}},
        "Gere protocolos numerados com numeração única e sequencial"
      )
    ),

    // ── Seletor de modo ──
    /*#__PURE__*/React.createElement("div",{style:{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}},
      [
        ["historico", "🕐 Processos do Sistema"],
        ["manual",    "📨 Recebimento de Documento"],
        ["registro",  "📜 Histórico de Protocolos"]
      ].map(([m,label])=>
        /*#__PURE__*/React.createElement("button",{
          key:m, onClick:()=>setModo(m),
          style:{...btn(modo===m?MUN.green:(dark?"#1e3528":"#e8f0e8"),modo===m?"#fff":txt),
                 border:"2px solid "+(modo===m?MUN.green:bdr)}
        },label)
      )
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // MODO: Processos do Sistema
    // ══════════════════════════════════════════════════════════════════════════
    modo==="historico" && /*#__PURE__*/React.createElement("div",null,
      /*#__PURE__*/React.createElement("div",{style:{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}},
        /*#__PURE__*/React.createElement("input",{
          type:"text",placeholder:"🔍 Buscar por processo, órgão, fornecedor, NF...",
          value:busca, onChange:e=>setBusca(e.target.value),
          style:{...inp,maxWidth:380}
        }),
        /*#__PURE__*/React.createElement("button",{onClick:toggleTodos,style:btn(dark?"#1e3528":"#e8f0e8",txt)},
          selecionados.length===filtrados.length&&filtrados.length>0?"☑️ Desmarcar todos":"☐ Selecionar todos"),
        selecionados.length>0&&/*#__PURE__*/React.createElement("span",{style:{color:MUN.green,fontWeight:700,fontSize:13}},
          `${selecionados.length} selecionado(s)`)
      ),
      /*#__PURE__*/React.createElement("div",{style:{background:card,border:"1px solid "+bdr,borderRadius:12,overflow:"hidden",maxHeight:420,overflowY:"auto"}},
        filtrados.length===0
          ? /*#__PURE__*/React.createElement("div",{style:{padding:32,textAlign:"center",color:txt,opacity:.5}},
              "Nenhum registro no histórico.")
          : filtrados.map((item,idx)=>{
              const sel=selecionados.includes(item._id);
              return /*#__PURE__*/React.createElement("div",{
                key:item._id, onClick:()=>toggleSel(item._id),
                style:{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",cursor:"pointer",userSelect:"none",
                  background:sel?(dark?"#0a3a1a":"#e6f9ed"):(idx%2===0?(dark?"#1a2e20":"#f7fbf7"):card),
                  borderBottom:"1px solid "+bdr, borderLeft:"4px solid "+(sel?MUN.green:"transparent"),
                  transition:"background .12s"}
              },
                /*#__PURE__*/React.createElement("input",{type:"checkbox",checked:sel,readOnly:true,style:{width:15,height:15,accentColor:MUN.green,flexShrink:0}}),
                /*#__PURE__*/React.createElement("div",{style:{display:"grid",gridTemplateColumns:"70px 1fr 1fr 80px 90px 80px",gap:8,flex:1,fontSize:11.5}},
                  /*#__PURE__*/React.createElement("span",{style:{fontWeight:700,color:MUN.green}},"Nº "+item.processo),
                  /*#__PURE__*/React.createElement("span",{style:{color:txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},item.orgao),
                  /*#__PURE__*/React.createElement("span",{style:{color:txt,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},item.fornecedor),
                  /*#__PURE__*/React.createElement("span",{style:{color:txt,opacity:.8}},item.nf?"NF "+item.nf:""),
                  /*#__PURE__*/React.createElement("span",{style:{fontWeight:600,color:"#1a7a3a"}},parseBRL(item.valor||"0")>0?fmtBRL(parseBRL(item.valor)):(item.valor||"")),
                  /*#__PURE__*/React.createElement("span",{style:{color:txt,opacity:.7}},item.data)
                )
              );
            })
      )
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // MODO: Recebimento de Documento Externo
    // ══════════════════════════════════════════════════════════════════════════
    modo==="manual" && /*#__PURE__*/React.createElement("div",null,
      docs.map((d,idx)=>
        /*#__PURE__*/React.createElement("div",{
          key:d._id,
          style:{background:card,border:"1px solid "+bdr,borderRadius:12,padding:"16px",marginBottom:14,position:"relative"}
        },
          /*#__PURE__*/React.createElement("div",{style:{fontWeight:700,color:MUN.green,marginBottom:12,fontSize:14}},`📄 Documento ${idx+1}`),
          /*#__PURE__*/React.createElement("div",{style:{marginBottom:12}},
            /*#__PURE__*/React.createElement("label",{style:{fontSize:11,fontWeight:600,color:txt,opacity:.75,display:"block",marginBottom:4}},"Descrição do Documento *"),
            /*#__PURE__*/React.createElement("textarea",{
              value:d.descricao, rows:4,
              placeholder:"Descreva o documento recebido. Ex: Nota Fiscal nº 1234 da empresa XYZ referente ao fornecimento de material de limpeza no valor de R$ 1.500,00.",
              onChange:e=>updDoc(d._id,"descricao",e.target.value),
              style:{...inp,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}
            })
          ),
          /*#__PURE__*/React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
            /*#__PURE__*/React.createElement("div",null,
              /*#__PURE__*/React.createElement("label",{style:{fontSize:11,fontWeight:600,color:txt,opacity:.75,display:"block",marginBottom:4}},"Nome de Quem Recebe"),
              /*#__PURE__*/React.createElement("input",{type:"text",value:d.nomeRecebedor,placeholder:"Nome do servidor que assina o recebimento",onChange:e=>updDoc(d._id,"nomeRecebedor",e.target.value),style:inp})
            ),
            /*#__PURE__*/React.createElement("div",null,
              /*#__PURE__*/React.createElement("label",{style:{fontSize:11,fontWeight:600,color:txt,opacity:.75,display:"block",marginBottom:4}},"Local de Recebimento"),
              /*#__PURE__*/React.createElement("input",{type:"text",value:d.local,onChange:e=>updDoc(d._id,"local",e.target.value),style:inp})
            )
          ),
          docs.length>1&&/*#__PURE__*/React.createElement("button",{
            onClick:()=>delDoc(d._id),
            style:{position:"absolute",top:12,right:14,background:"#dc2626",color:"#fff",border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer",fontWeight:700}
          },"✕")
        )
      ),
      /*#__PURE__*/React.createElement("button",{
        onClick:addDoc,
        style:{...btn(dark?"#1e4a30":"#e8f5ec",MUN.green),border:"2px dashed "+MUN.green,width:"100%",marginBottom:4}
      },"+ Adicionar outro documento")
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // MODO: Histórico de Protocolos Emitidos
    // ══════════════════════════════════════════════════════════════════════════
    modo==="registro" && /*#__PURE__*/React.createElement("div",null,
      // Barra de busca + contador
      /*#__PURE__*/React.createElement("div",{style:{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}},
        /*#__PURE__*/React.createElement("input",{
          type:"text", placeholder:"🔍 Buscar por número, tipo, usuário, processo...",
          value:buscaReg, onChange:e=>setBuscaReg(e.target.value),
          style:{...inp,maxWidth:400}
        }),
        /*#__PURE__*/React.createElement("span",{style:{color:txt,opacity:.6,fontSize:12}},
          carregandoHist ? "Carregando..." : `${filtradosReg.length} protocolo(s) emitido(s)`)
      ),

      // Lista
      carregandoHist
        ? /*#__PURE__*/React.createElement("div",{style:{textAlign:"center",padding:40,color:txt,opacity:.5}},"⏳ Carregando histórico...")
        : filtradosReg.length === 0
          ? /*#__PURE__*/React.createElement("div",{style:{textAlign:"center",padding:40,color:txt,opacity:.5}},
              "Nenhum protocolo emitido ainda. Gere um protocolo na aba \"Processos do Sistema\" ou \"Recebimento de Documento\".")
          : filtradosReg.map((reg, idx) => {
              const ehProc    = reg.tipo === "processos";
              const corTipo   = ehProc ? MUN.green : MUN.greenMid;
              const labelTipo = ehProc ? "📋 Protocolo de Processos" : "📨 Recebimento de Documento";
              const dataFmt   = reg.emitidoEm
                ? new Date(reg.emitidoEm).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})
                : reg.emitidoFormatado||"";
              return /*#__PURE__*/React.createElement("div",{
                key: reg.numProto+"_"+idx,
                style:{background:card,border:"1px solid "+bdr,borderRadius:12,marginBottom:12,overflow:"hidden"}
              },
                // Cabeçalho do card
                /*#__PURE__*/React.createElement("div",{style:{
                  background: dark?"#1a3a1a":"#f0f9f0",
                  borderBottom:"1px solid "+bdr,
                  padding:"12px 16px",
                  display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"
                }},
                  /*#__PURE__*/React.createElement("div",{style:{
                    background:corTipo,color:"#fff",borderRadius:8,
                    padding:"4px 12px",fontWeight:800,fontSize:16,minWidth:110,textAlign:"center"
                  }},`Nº ${reg.numStr||String(reg.numProto||"").padStart(5,"0")}/${reg.ano||""}`),
                  /*#__PURE__*/React.createElement("div",{style:{flex:1}},
                    /*#__PURE__*/React.createElement("div",{style:{fontWeight:700,color:corTipo,fontSize:13}},labelTipo),
                    /*#__PURE__*/React.createElement("div",{style:{fontSize:11,color:txt,opacity:.7,marginTop:2}},
                      `📅 ${dataFmt}  ·  👤 ${reg.usuario||"—"}  ·  📄 ${reg.totalItens||0} item(ns)  ·  🖨️ ${reg.vias||1} via(s)`
                    )
                  ),
                  reg.valorTotal > 0 && /*#__PURE__*/React.createElement("div",{style:{fontWeight:700,color:"#1a7a3a",fontSize:14,whiteSpace:"nowrap"}},
                    fmtBRL(reg.valorTotal)
                  )
                ),
                // Corpo: itens do protocolo
                /*#__PURE__*/React.createElement("div",{style:{padding:"10px 16px"}},
                  (reg.itens||[]).slice(0,5).map((item,ii)=>
                    /*#__PURE__*/React.createElement("div",{
                      key:ii,
                      style:{display:"flex",gap:10,padding:"5px 0",borderBottom:ii<Math.min((reg.itens||[]).length,5)-1?"1px dashed "+bdr:"none",fontSize:12,flexWrap:"wrap"}
                    },
                      ehProc ? /*#__PURE__*/React.createElement(React.Fragment,null,
                        /*#__PURE__*/React.createElement("span",{style:{fontWeight:700,color:MUN.green,minWidth:60}},"Nº "+item.processo),
                        /*#__PURE__*/React.createElement("span",{style:{color:txt,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},item.orgao||""),
                        /*#__PURE__*/React.createElement("span",{style:{color:txt,opacity:.8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}},item.fornecedor||""),
                        parseBRL(item.valor||"0")>0&&/*#__PURE__*/React.createElement("span",{style:{fontWeight:600,color:"#1a7a3a",whiteSpace:"nowrap"}},fmtBRL(parseBRL(item.valor)))
                      ) : /*#__PURE__*/React.createElement("span",{style:{color:txt,opacity:.85}},
                        (item.descricao||"").slice(0,120)+(item.descricao&&item.descricao.length>120?"…":"")
                      )
                    )
                  ),
                  (reg.itens||[]).length > 5 && /*#__PURE__*/React.createElement("div",{style:{fontSize:11,color:txt,opacity:.5,paddingTop:4}},
                    `+ ${(reg.itens.length-5)} item(ns) não exibido(s)`)
                )
              );
            })
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // BOTÕES: 2 vias + gerar (só para modos de geração)
    // ══════════════════════════════════════════════════════════════════════════
    modo!=="registro" && /*#__PURE__*/React.createElement("div",{style:{marginTop:22,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}},
      /*#__PURE__*/React.createElement("button",{
        onClick:modo==="historico"?gerarPDFSistema:gerarPDFManual,
        disabled:gerandoPDF,
        style:{...btn(MUN.green),fontSize:14,padding:"10px 28px",opacity:gerandoPDF?.6:1}
      },gerandoPDF?"⏳ Gerando PDF...":"🖨️ Gerar Protocolo PDF"),
      /*#__PURE__*/React.createElement("label",{
        style:{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:txt,userSelect:"none",
               background:card,border:"1px solid "+bdr,borderRadius:8,padding:"8px 14px"}
      },
        /*#__PURE__*/React.createElement("input",{
          type:"checkbox", checked:duasVias, onChange:e=>setDuasVias(e.target.checked),
          style:{width:16,height:16,accentColor:MUN.green,cursor:"pointer"}
        }),
        /*#__PURE__*/React.createElement("span",null,"Imprimir 2 vias (1ª via + 2ª via em folhas separadas)")
      ),
      modo==="historico"&&selecionados.length>0&&
        /*#__PURE__*/React.createElement("button",{onClick:()=>setSel([]),style:btn("#6b7280")},"Limpar seleção")
    )
  );
}

window.App = App;
