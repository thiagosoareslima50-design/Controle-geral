/*
================================================================================
  SISTEMA DE CONTROLE DE PROCESSOS DE PAGAMENTO — React v3.0
  Controladoria Geral · Prefeitura Gov. Edison Lobão / MA
================================================================================
  [C1] Storage: window.storage → localStorage → MEM
  [C2] proxNumero verifica duplicatas
  [C3] Auto-save não contamina modo edição
  [C4] Histórico avisa quando truncado em 200 registros
  [A1] Máscara e validação automática de CNPJ/CPF
  [A2] Campo Valor preserva posição do cursor
  [M6] cleanBrasaoAsync com crossOrigin = "anonymous"
  [B1] formPct zerado ao navegar para outra página
  [B2] Busca avisa quando resultado limitado a 100
  [B3] Modal de atalhos de teclado
================================================================================
*/

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

// ─── [C1] Storage durável ─────────────────────────────────────────────────────
const MEM = {};
const ST = {
  async get(k) {
    try {
      if (window.storage) {
        const r = await window.storage.get(k);
        return r ? JSON.parse(r.value) : null;
      }
    } catch {}
    try {
      const raw = localStorage.getItem("cgel_" + k);
      if (raw !== null) return JSON.parse(raw);
    } catch {}
    return MEM[k] ?? null;
  },
  async set(k, v) {
    MEM[k] = v;
    try {
      if (window.storage) {
        await window.storage.set(k, JSON.stringify(v));
        return true;
      }
    } catch {}
    try {
      localStorage.setItem("cgel_" + k, JSON.stringify(v));
      return true;
    } catch {}
    return false;
  },
  async del(k) {
    delete MEM[k];
    try {
      if (window.storage) await window.storage.delete(k);
    } catch {}
    try {
      localStorage.removeItem("cgel_" + k);
    } catch {}
    return true;
  }
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CHK = {
  padrao: ["Validação do Documento Fiscal", "Emissão e Autenticação das Certidões Negativas", "Conformidade com o processo Licitatório", "Disponibilidade de Saldos Licitatórios", "Outros: Contratos, Valores, Impostos", "Extrato do Contrato"],
  eng: ["Validação do Documento Fiscal", "Emissão e Autenticação das Certidões Negativas", "Conformidade com o processo Licitatório", "Disponibilidade de Saldos Licitatórios", "Solicitação de pagamento com medição", "Planilha de medição assinada", "Relatório fotográfico", "Cópia Do Contrato", "ART ou RRT"],
  tdf: ["Ofício", "Formulário TFD", "Conformidade com o processo Licitatório", "Laudo Médico", "Documentos pessoais"],
  passagem: ["Prestação de contas diárias", "Documentação comprobatória", "Requerimento de restituição"]
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
  const s = String(raw).trim().split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = s.replace(/\D/g, "");
  if (d.length >= 8) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 8)}`;
  return d;
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

// ─── [C2] proxNumero ──────────────────────────────────────────────────────────
function proxNumero(processos) {
  const nums = processos.map(p => parseInt(String(p["NÚMERO DO DOCUMENTO"] || "").trim(), 10)).filter(n => !isNaN(n));
  if (!nums.length) return 1;
  const set = new Set(nums);
  let next = Math.max(...nums) + 1;
  while (set.has(next)) next++;
  return next;
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
  return d.length === 0 || d.length === 11 || d.length === 14;
}

// ─── MapData ──────────────────────────────────────────────────────────────────
function buildMapData(processos) {
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
    orgaoModalidadesList: multi("ORGÃO", "MODALIDADE"),
    orgaoContrato: dct("ORGÃO", "CONTRATO"),
    orgaoModalidade: dct("ORGÃO", "MODALIDADE")
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function hashSenha(salt, senha) {
  const e = new TextEncoder(),
    b = await crypto.subtle.digest("SHA-256", e.encode(salt + senha));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function loadUsers() {
  let u = await ST.get("users");
  if (!u) {
    const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const hash = await hashSenha(salt, "admin123");
    u = {
      admin: {
        senha: hash,
        salt,
        nome: "Administrador",
        perfil: "admin",
        ativo: true
      }
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
  const wb = XLSX.read(buf, {
    type: "array",
    cellDates: true
  });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: false
  });
  return raw.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) out[canonCol(k)] = v;
    return out;
  });
}
function exportarExcel(processos, historico) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(processos), "Processos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historico), "Histórico");
  XLSX.writeFile(wb, `ControleGeral_${todayISO()}.xlsx`);
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

    // Caixa Obs. — altura dinâmica baseada no conteúdo
    y += 3;
    doc.setFontSize(12);
    const obsLinesP1 = d.obs && d.obs.trim() ? doc.splitTextToSize(d.obs.trim(), CCW - 28) : [];
    const obsBoxH = Math.max(30, obsLinesP1.length > 0 ? obsLinesP1.length * 5.5 + 14 : 30);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(CML, y, CCW, obsBoxH, "S");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text("Obs.:", CML + 2.5, y + 8);
    if (obsLinesP1.length > 0) {
      obsLinesP1.forEach((l, li) => doc.text(l, CML + 24, y + 8 + li * 5.5));
    }
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
      background: MUN.blue,
      color: "#fff",
      boxShadow: "3px 3px 0 0 " + MUN.blueDk
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
  const toast = useCallback((msg, type = "success") => {
    const id = Date.now() + Math.random();
    setTs(p => [...p, {
      id,
      msg,
      type
    }]);
    setTimeout(() => setTs(p => p.filter(t => t.id !== id)), 4200);
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
      maxWidth: 380
    }
  }, t.msg)));
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
  const cBg = MUN.blue,
    bdr = MUN.blue;
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
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const filtered = useMemo(() => q.trim() ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options, [options, q]);
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const choose = v => {
    onChange(v);
    setQ("");
    setOpen(false);
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
    onClick: () => setOpen(o => !o),
    style: {
      ...IS(dark),
      marginBottom: 0,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      userSelect: "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: value ? dark ? "#e2e8f0" : "#1e293b" : "#94a3b8",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      flex: 1
    }
  }, value || placeholder), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: "#94a3b8",
      marginLeft: 6
    }
  }, open ? "▲" : "▼")), open && /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    autoFocus: true,
    placeholder: "Filtrar...",
    onKeyDown: e => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter" && filtered.length === 1) choose(filtered[0]);
    },
    style: {
      ...IS(dark),
      marginBottom: 0,
      borderRadius: 0,
      border: "none",
      borderBottom: `1px solid ${bdr}`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 210,
      overflowY: "auto"
    }
  }, filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 14px",
      fontSize: 12,
      color: "#94a3b8"
    }
  }, "Nenhum resultado"), filtered.map(o => /*#__PURE__*/React.createElement("div", {
    key: o,
    onMouseDown: () => choose(o),
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
  return /*#__PURE__*/React.createElement("img", {
    src: window.BRASAO_B64,
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

// ─── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage({
  onLogin
}) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [tent, setTent] = useState(0);
  const [bloq, setBloq] = useState(false);
  const [count, setCount] = useState(0);
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
      onLogin({
        ...u,
        login: login.trim()
      });
    } else {
      const nt = tent + 1;
      setTent(nt);
      if (nt >= 5) {
        setBloq(true);
        setCount(300);
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
  formPct
}) {
  const isAdmin = user?.perfil === "admin";
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
        background: active ? MUN.blue : "transparent",
        border: active ? "1px solid " + MUN.blue : "1px solid transparent"
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
    }, label));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      background: "#006000",
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
      background: "#003d00"
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
      background: MUN.blue,
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
  }, /*#__PURE__*/React.createElement("div", {
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
      textAlign: "center"
    }
  }, "v3.0 \xB7 2025")));
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
  appConfig
}) {
  const mp = useMemo(() => buildMapData(processos), [processos]);
  const orgAtivos = useMemo(() => mp.allOrgaos.filter(o => orgaosConfig[o]?.ativo !== false), [mp, orgaosConfig]);
  const blankForm = useCallback(() => ({
    numDoc: String(proxNumero(processos)),
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
    obs: "",
    notas: "",
    tipo: "padrao"
  }), [processos]);
  const formFromRow = useCallback(row => ({
    numDoc: String(proxNumero(processos)),
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
    obs: "",
    notas: "",
    tipo: "padrao"
  }), [processos]);
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
    setChks({});
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
        setDraftSaved(new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        }));
      }
    }, 30000);
    return () => clearInterval(t);
  }, [form, editMode]);
  useEffect(() => {
    if (editarData) return;
    ST.get("draft_form").then(d => {
      if (d && (d.orgao || d.fornecedor)) setForm(p => ({
        ...p,
        ...d
      }));
    });
  }, []);
  const pct = useMemo(() => {
    const req = ["numDoc", "orgao", "fornecedor", "cnpj", "valor", "objeto"];
    return Math.round(req.filter(k => form[k]).length / req.length * 100);
  }, [form]);
  useEffect(() => onPctChange(pct), [pct, onPctChange]);
  useEffect(() => {
    const h = e => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          handleSalvar();
        }
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          handleGerarPDF();
        }
        if (e.key === "l" || e.key === "L") {
          e.preventDefault();
          handleLimpar();
        }
        if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          handleDuplicarUltimo();
        }
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onShowShortcuts && onShowShortcuts();
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [form]);
  const onOrgChange = v => setForm(f => ({
    ...f,
    orgao: v,
    secretario: f.secretario || mp.orgaoSecretario[v] || "",
    contrato: f.contrato || mp.orgaoContrato[v] || "",
    modalidade: f.modalidade || mp.orgaoModalidade[v] || ""
  }));
  const onFornChange = v => setForm(f => ({
    ...f,
    fornecedor: v,
    cnpj: f.cnpj || mp.fornCnpj[v] || "",
    objeto: f.objeto || mp.fornObjeto[v] || "",
    modalidade: f.modalidade || mp.fornModalidade[v] || "",
    contrato: f.contrato || mp.fornContrato[v] || ""
  }));
  const onCnpjChange = v => {
    const m = mascararCnpjCpf(v);
    setForm(f => ({
      ...f,
      cnpj: m,
      fornecedor: f.fornecedor || mp.cnpjForn[v] || ""
    }));
    setCnpjErro(validarCnpjCpf(m) ? "" : "Formato inválido (11 dígitos CPF ou 14 CNPJ)");
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
  const checarDuplicata = num => {
    if (!num || editMode) return false;
    const n = parseInt(num, 10);
    return processos.some(p => parseInt(String(p["NÚMERO DO DOCUMENTO"] || ""), 10) === n);
  };
  const makeDados = () => {
    // Auto-completar campos vazios com dados do histórico
    const forn = form.fornecedor;
    const org = form.orgao;
    const cnpj = form.cnpj || mp.fornCnpj[forn] || "";
    const contrato = form.contrato || mp.fornContrato[forn] || mp.orgaoContrato[org] || "";
    const modalidade = form.modalidade || mp.fornModalidade[forn] || mp.orgaoModalidade[org] || "";
    const secretario = form.secretario || mp.orgaoSecretario[org] || "";
    const objeto = form.objeto || mp.fornObjeto[forn] || "";
    const tipDoc = form.tipDoc || mp.allDocFiscais[0] || "";
    return {
      processo: form.numDoc,
      orgao: org,
      secretario: secretario,
      fornecedor: forn,
      cnpj: cnpj,
      nf: form.numNf,
      contrato: contrato,
      modalidade: modalidade,
      periodo_ref: form.periodo,
      ordem_compra: form.ordemCompra,
      data_nf: formatData(form.dataNf),
      data_ateste: dtExt(formatData(form.dataAteste)),
      objeto: objeto,
      valor: form.valor,
      tipo_doc: tipDoc,
      tipo_nf: form.tipNf,
      obs: form.obs,
      controlador: appConfig?.controlador || {}
    };
  };
  const handleGerarPDF = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Auto-preencher campos vazios no form com dados do histórico antes de gerar
      const forn = form.fornecedor,
        org = form.orgao;
      if (forn || org) {
        setForm(f => ({
          ...f,
          cnpj: f.cnpj || mp.fornCnpj[forn] || "",
          contrato: f.contrato || mp.fornContrato[forn] || mp.orgaoContrato[org] || "",
          modalidade: f.modalidade || mp.fornModalidade[forn] || mp.orgaoModalidade[org] || "",
          secretario: f.secretario || mp.orgaoSecretario[org] || "",
          objeto: f.objeto || mp.fornObjeto[forn] || "",
          tipDoc: f.tipDoc || mp.allDocFiscais[0] || ""
        }));
      }
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
      if (!window.confirm(`Número ${form.numDoc} já existe. Continuar?`)) return;
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
        "NOTAS": form.notas
      };
      if (editMode) {
        await onSaveEdit(row, form, editMode);
        setEditMode(null);
      } else {
        await onSave(row, form);
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
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // Fallback: abrir em nova aba para imprimir
        window.open(url, "_blank");
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 60000);
    };
  };
  const handleLimpar = () => {
    if (!window.confirm("Limpar todos os campos?")) return;
    setForm(blankForm());
    setChks({});
    setPdfBlob(null);
    ST.del("draft_form");
    setDraftSaved(null);
    setEditMode(null);
    toast("🗑️ Formulário limpo.");
  };
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
  }, /*#__PURE__*/React.createElement(PageHeader, {
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
  }, draftSaved && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: dark ? "#3d5a85" : "#94a3b8",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "#22c55e",
      display: "inline-block"
    }
  }), "Rascunho salvo \xE0s ", draftSaved), /*#__PURE__*/React.createElement("div", {
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
    value: proxNumero(processos),
    gradient: T.kpi4,
    icon: "\uD83D\uDD22"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
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
        padding: "10px 12px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all .15s",
        position: "relative",
        overflow: "hidden"
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
        fontSize: compact ? 16 : 20,
        marginBottom: 4
      }
    }, ti2.icon), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: act ? 700 : 500,
        color: act ? ti2.cor : dark ? "#4a6494" : "#64748b",
        lineHeight: 1.3
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
    style: iStyle
  }), checarDuplicata(form.numDoc) && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "#dc2626",
      marginTop: -10,
      marginBottom: 8
    }
  }, "\u26A0\uFE0F Este n\xFAmero j\xE1 existe")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
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
    style: {
      fontSize: 9.5,
      color: "#3b6ef8",
      fontWeight: 600,
      marginBottom: 4
    }
  }, "\uD83D\uDCA1 Sugest\xE3o: ", /*#__PURE__*/React.createElement("b", null, secSug.slice(0, 45))), /*#__PURE__*/React.createElement(SearchSelect, {
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
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FilterBadge, {
    count: mShow.length,
    fonte: form.fornecedor,
    isFiltered: mFiltered
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
    label: "Modalidade",
    value: form.modalidade,
    options: mShow,
    onChange: onModalChange,
    dark: dark
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setModMode(m => m === "forn" ? "todos" : "forn"),
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
  }, modMode === "forn" ? "📂" : "🏢"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FilterBadge, {
    count: cShow.length,
    fonte: form.fornecedor,
    isFiltered: cFiltered
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
    label: "N\xBA Contrato",
    value: form.contrato,
    options: cShow,
    onChange: v => setForm(f => ({
      ...f,
      contrato: v
    })),
    dark: dark
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setContMode(m => m === "forn" ? "todos" : "forn"),
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
  }, contMode === "forn" ? "📂" : "🏢"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 18,
      marginBottom: 4
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "N\xB0 Ordem de Compra"), /*#__PURE__*/React.createElement("input", {
    value: form.ordemCompra,
    onChange: e => upd("ordemCompra")(e.target.value),
    placeholder: "Opcional",
    style: iStyle
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
    options: mp.allDocFiscais,
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
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
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
  dark
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({
    col: "NÚMERO DO DOCUMENTO",
    dir: 1
  });
  const [lPDF, setLPDF] = useState(null);
  const dq = useDebounce(q, 300);
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const filtered = useMemo(() => {
    let r = processos;
    if (dq.trim()) {
      const ql = dq.toLowerCase();
      r = r.filter(p => ["NÚMERO DO DOCUMENTO", "FORNECEDOR", "ORGÃO", "OBJETO", "CONTRATO"].some(c => String(p[c] || "").toLowerCase().includes(ql)));
    }
    return [...r].sort((a, b) => String(a[sort.col] || "").localeCompare(String(b[sort.col] || ""), "pt-BR") * sort.dir);
  }, [processos, dq, sort]);
  const limitado = filtered.length > 100;
  const exibidos = filtered.slice(0, 100);
  const cols = ["NÚMERO DO DOCUMENTO", "ORGÃO", "FORNECEDOR", "VALOR", "DATA", "OBJETO"];
  const colLabel = c => c === "NÚMERO DO DOCUMENTO" ? "Nº DOC" : c;
  const toggleSort = col => setSort(s => s.col === col ? {
    col,
    dir: s.dir * -1
  } : {
    col,
    dir: 1
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
    placeholder: "\uD83D\uDD0E  N\xBA, fornecedor, \xF3rg\xE3o, objeto...",
    style: {
      ...IS(dark),
      marginBottom: 16,
      fontSize: 14,
      padding: "10px 14px"
    }
  }), limitado && /*#__PURE__*/React.createElement("div", {
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
  }, c === "DATA" || c === "DATA NF" ? fmtD(String(p[c] || "")) : String(p[c] || "").slice(0, 60))), /*#__PURE__*/React.createElement("td", {
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
  dark
}) {
  const [filtOrg, setFiltOrg] = useState("");
  const [filtAno, setFiltAno] = useState("");
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
  const porMes = useMemo(() => {
    const m = {};
    filtered.forEach(p => {
      const d = String(p["DATA"] || "").slice(0, 7);
      if (d && d !== "NaT") m[d] = (m[d] || 0) + 1;
    });
    return Object.entries(m).sort(([a], [b]) => a < b ? -1 : 1).slice(-12).map(([mes, n]) => ({
      mes,
      n
    }));
  }, [filtered]);
  const topOrg = useMemo(() => {
    const m = {};
    filtered.forEach(p => {
      const o = String(p["ORGÃO"] || "").trim();
      if (o) m[o] = (m[o] || 0) + 1;
    });
    return Object.entries(m).sort(([, a], [, b]) => b - a).slice(0, 8).map(([o, n]) => ({
      orgao: o.slice(0, 32),
      n
    }));
  }, [filtered]);
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: bg
    }
  }, /*#__PURE__*/React.createElement(PageHeader, {
    icon: "\uD83D\uDCCA",
    title: "Dashboard",
    sub: "Vis\xE3o anal\xEDtica",
    cor: "#4d7cfe",
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 12,
      border: `1.5px solid ${bdr}`,
      padding: "14px 20px",
      marginBottom: 20,
      display: "flex",
      gap: 16,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "#64748b"
    }
  }, "\uD83D\uDD0D Filtrar:"), /*#__PURE__*/React.createElement("select", {
    value: filtOrg,
    onChange: e => setFiltOrg(e.target.value),
    style: {
      ...IS(dark),
      width: "auto",
      minWidth: 180,
      padding: "6px 10px",
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos os \xF3rg\xE3os"), mp.allOrgaos.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o.slice(0, 50)))), /*#__PURE__*/React.createElement("select", {
    value: filtAno,
    onChange: e => setFiltAno(e.target.value),
    style: {
      ...IS(dark),
      width: "auto",
      minWidth: 100,
      padding: "6px 10px",
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos os anos"), anos.map(a => /*#__PURE__*/React.createElement("option", {
    key: a,
    value: a
  }, a))), (filtOrg || filtAno) && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setFiltOrg("");
      setFiltAno("");
    },
    style: {
      fontSize: 12,
      padding: "6px 12px",
      background: "#fee2e2",
      border: "1px solid #fecaca",
      borderRadius: 7,
      color: "#dc2626",
      cursor: "pointer"
    }
  }, "\u2715 Limpar"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "#94a3b8",
      marginLeft: "auto"
    }
  }, filtered.length, " processo(s)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: 14,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(KPICard, {
    label: "Processos",
    value: filtered.length.toLocaleString(),
    gradient: T.kpi2,
    icon: "\uD83D\uDCCA"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "\xD3rg\xE3os",
    value: mp.allOrgaos.length,
    gradient: T.kpi1,
    icon: "\uD83C\uDFDB\uFE0F"
  }), /*#__PURE__*/React.createElement(KPICard, {
    label: "Fornecedores",
    value: mp.allFornecedores.length,
    gradient: T.kpi5,
    icon: "\uD83C\uDFE2"
  })), porMes.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px",
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      marginBottom: 14,
      color: dark ? "#e2e8f0" : "#0f172a"
    }
  }, "Processos por M\xEAs"), /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 220
  }, /*#__PURE__*/React.createElement(LineChart, {
    data: porMes,
    margin: {
      top: 5,
      right: 10,
      bottom: 5,
      left: 0
    }
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: dark ? "#1e2d40" : "#f1f5f9"
  }), /*#__PURE__*/React.createElement(XAxis, {
    dataKey: "mes",
    tick: {
      fontSize: 10
    },
    stroke: "#94a3b8"
  }), /*#__PURE__*/React.createElement(YAxis, {
    tick: {
      fontSize: 10
    },
    stroke: "#94a3b8"
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: dark ? "#003d00" : "#fff",
      border: `1px solid ${bdr}`
    }
  }), /*#__PURE__*/React.createElement(Line, {
    type: "monotone",
    dataKey: "n",
    stroke: "#3b6ef8",
    strokeWidth: 2,
    dot: {
      r: 4
    }
  })))), topOrg.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: cardBg,
      borderRadius: 14,
      border: `1.5px solid ${bdr}`,
      padding: "20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      marginBottom: 14,
      color: dark ? "#e2e8f0" : "#0f172a"
    }
  }, "Top \xD3rg\xE3os"), /*#__PURE__*/React.createElement(ResponsiveContainer, {
    width: "100%",
    height: 280
  }, /*#__PURE__*/React.createElement(BarChart, {
    layout: "vertical",
    data: topOrg,
    margin: {
      left: 0,
      right: 10
    }
  }, /*#__PURE__*/React.createElement(CartesianGrid, {
    strokeDasharray: "3 3",
    stroke: dark ? "#1e2d40" : "#f1f5f9"
  }), /*#__PURE__*/React.createElement(XAxis, {
    type: "number",
    tick: {
      fontSize: 10
    },
    stroke: "#94a3b8"
  }), /*#__PURE__*/React.createElement(YAxis, {
    dataKey: "orgao",
    type: "category",
    tick: {
      fontSize: 9.5
    },
    width: 140
  }), /*#__PURE__*/React.createElement(Tooltip, {
    contentStyle: {
      background: dark ? "#1a2535" : "#fff",
      border: `1px solid ${bdr}`
    }
  }), /*#__PURE__*/React.createElement(Bar, {
    dataKey: "n",
    fill: "#3b6ef8",
    radius: [0, 4, 4, 0]
  }))))));
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
  const [lPDF, setLPDF] = useState(null);
  const bg = dark ? T.appBgDark : T.appBg,
    cardBg = dark ? T.cardBgDark : T.cardBg,
    bdr = dark ? T.borderDark : T.border,
    tc = dark ? T.textMainDark : T.textMain;
  const filtered = useMemo(() => {
    let r = historico;
    if (q.trim()) {
      const ql = q.toLowerCase();
      r = r.filter(h => ["Processo", "Órgão", "Fornecedor", "Tipo"].some(c => String(h[c] || "").toLowerCase().includes(ql)));
    }
    if (filtDec) r = r.filter(h => String(h["Decisão"] || "").includes(filtDec));
    return r;
  }, [historico, q, filtDec]);
  const def = useMemo(() => historico.filter(h => String(h["Decisão"] || "").includes("DEFERIDO")).length, [historico]);
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
    sub: "Documentos processados",
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
  }, "\u26A0\uFE0F Exibindo os 200 registros mais recentes. Exporte o Excel para ver o hist\xF3rico completo."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
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
    value: historico.length - def,
    gradient: T.kpi3,
    icon: "\u274C"
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
  }, "\u274C Indeferido"))), filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
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
  }, ["Processo", "Data", "Órgão", "Fornecedor", "Valor", "Tipo", "Decisão"].map(c => /*#__PURE__*/React.createElement("th", {
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
  }, "A\xE7\xF5es"))), /*#__PURE__*/React.createElement("tbody", null, filtered.map((h, i) => {
    const dec = String(h["Decisão"] || "");
    const isDef = dec.includes("DEFERIDO") && !dec.includes("INDE");
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
        padding: "8px 12px"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 5,
        background: isDef ? "#0d2318" : "#450a0a",
        color: isDef ? "#86efac" : "#fca5a5",
        border: `1px solid ${isDef ? "#16a34a" : "#dc2626"}`
      }
    }, isDef ? "✅ DEFERIDO" : "❌ INDEFERIDO")), /*#__PURE__*/React.createElement("td", {
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
      fontSize: 11,
      color: "#94a3b8",
      marginTop: 8
    }
  }, filtered.length, " registro(s) \xB7 Total: ", historico.length)), isAdmin && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1 / -1",
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
      lineHeight: 1.5
    }
  }, "Esta a\xE7\xE3o apaga ", /*#__PURE__*/React.createElement("strong", null, "todos os dados do sistema"), ": processos, hist\xF3rico, \xF3rg\xE3os e configura\xE7\xF5es. Irrevers\xEDvel."), !showApagar ? /*#__PURE__*/React.createElement("button", {
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
      fontWeight: 600,
      color: dark ? "#fca5a5" : "#991b1b"
    }
  }, "\uD83D\uDD10 Confirme sua senha de administrador para continuar:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
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
      marginBottom: 0
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
      fontSize: 11.5,
      color: "#dc2626",
      fontWeight: 600
    }
  }, "\u274C ", apagarErr))));
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
    const ns = window.prompt(`Nova senha para "${login}":`);
    if (!ns || !ns.trim()) return;
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
  }), u.ativo ? "Desativar" : "Ativar")))))));
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
  const handleImportExcel = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const rows = await importarExcel(file);
      onImport(rows);
      toast(`✅ Importados ${rows.length} registros.`);
    } catch (err) {
      toast(`❌ Erro: ${err.message}`, "error");
    } finally {
      setImportLoading(false);
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
  }), "Exportar Excel"), /*#__PURE__*/React.createElement("div", {
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
  }), importLoading ? "Importando..." : "Selecionar Excel (.xlsx)", /*#__PURE__*/React.createElement("input", {
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
  }), [["Versão", "v3.0"], ["Processos salvos", processos.length], ["Histórico", historico.length], ["Órgãos configurados", Object.keys(orgaosConfig).length]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
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
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Nome completo"), /*#__PURE__*/React.createElement("input", {
    value: appConfig?.controlador?.nome || "",
    onChange: e => {
      const u = {
        ...appConfig,
        controlador: {
          ...appConfig.controlador,
          nome: e.target.value
        }
      };
      setAppConfig(u);
      ST.set("app_config", u);
    },
    placeholder: "Ex: Thiago Soares Lima",
    style: IS(dark)
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Cargo"), /*#__PURE__*/React.createElement("input", {
    value: appConfig?.controlador?.cargo || "",
    onChange: e => {
      const u = {
        ...appConfig,
        controlador: {
          ...appConfig.controlador,
          cargo: e.target.value
        }
      };
      setAppConfig(u);
      ST.set("app_config", u);
    },
    placeholder: "Ex: Controlador Geral",
    style: IS(dark)
  }), /*#__PURE__*/React.createElement("label", {
    style: LS(dark)
  }, "Portaria / Designa\xE7\xE3o"), /*#__PURE__*/React.createElement("input", {
    value: appConfig?.controlador?.portaria || "",
    onChange: e => {
      const u = {
        ...appConfig,
        controlador: {
          ...appConfig.controlador,
          portaria: e.target.value
        }
      };
      setAppConfig(u);
      ST.set("app_config", u);
    },
    placeholder: "Ex: Portaria 002/2025",
    style: IS(dark)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      color: "#64748b",
      marginTop: -10
    }
  }, "Aparece na assinatura de todos os PDFs gerados.")))));
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(null);
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
  const {
    toasts,
    toast
  } = useToast();

  // [B1] Zera formPct ao sair de "processos"
  const handleSetPage = useCallback(p => {
    if (p !== "processos") setFormPct(0);
    setPage(p);
  }, []);

  // Carrega dados do storage
  useEffect(() => {
    ST.get("processos").then(d => {
      if (d) setProcessos(d);
    });
    ST.get("historico").then(d => {
      if (d) setHistorico(d);
    });
    ST.get("orgaos_config").then(d => {
      if (d) setOrgaosConfig(d);
    });
    ST.get("app_config").then(d => {
      if (d) setAppConfig(d);
    });
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
  const onSave = useCallback(async (row, form) => {
    const novoItem = {
      ...row,
      "_tipoKey": form.tipo,
      "_decisao": form.decisao,
      "_obs": form.obs
    };
    const novosProcessos = [novoItem, ...processos];
    await salvarProcessos(novosProcessos);
    // Histórico
    const hRow = {
      "Processo": row["NÚMERO DO DOCUMENTO"],
      "Data": fmtD(row["DATA"]),
      "Órgão": row["ORGÃO"],
      "Fornecedor": row["FORNECEDOR"],
      "Valor": row["VALOR"],
      "Tipo": TINFO[form.tipo]?.label || form.tipo,
      "TipoKey": form.tipo,
      "Decisão": form.decisao === "deferir" ? "DEFERIDO" : "INDEFERIDO"
    };
    // [C4] Limita histórico a 200
    const novoHist = [hRow, ...historico].slice(0, 200);
    await salvarHistorico(novoHist);
    toast(`✅ Processo ${row["NÚMERO DO DOCUMENTO"]} salvo!`);
  }, [processos, historico]);
  const onSaveEdit = useCallback(async (row, form, numOriginal) => {
    const novoItem = {
      ...row,
      "_tipoKey": form.tipo,
      "_decisao": form.decisao,
      "_obs": form.obs
    };
    // Atualizar processos
    const updatedProc = processos.map(p => String(p["NÚMERO DO DOCUMENTO"]) === String(numOriginal) ? novoItem : p);
    await salvarProcessos(updatedProc);
    // Atualizar historico — corrigir decisão e tipo do registro editado
    const novaDecisao = form.decisao === "deferir" ? "DEFERIDO" : "INDEFERIDO";
    const updatedHist = historico.map(h => String(h["Processo"]) === String(numOriginal) ? {
      ...h,
      "Decisão": novaDecisao,
      "Tipo": TINFO[form.tipo]?.label || form.tipo,
      "TipoKey": form.tipo
    } : h);
    await salvarHistorico(updatedHist);
    toast(`✅ Processo ${row["NÚMERO DO DOCUMENTO"]} atualizado!`, "info");
  }, [processos, historico]);
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
    const sits = Array(chk.length).fill(true);
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
    const d = {
      processo: r2["NÚMERO DO DOCUMENTO"] || row["Processo"] || "",
      orgao: org2,
      secretario: r2["SECRETARIO"] || mpBusca.orgaoSecretario[org2] || "",
      fornecedor: forn2,
      cnpj: r2["CNPJ"] || mpBusca.fornCnpj[forn2] || "",
      nf: r2["Nº"] || "",
      contrato: r2["CONTRATO"] || mpBusca.fornContrato[forn2] || mpBusca.orgaoContrato[org2] || "",
      modalidade: r2["MODALIDADE"] || mpBusca.fornModalidade[forn2] || mpBusca.orgaoModalidade[org2] || "",
      periodo_ref: r2["PERÍODO DE REFERÊNCIA"] || "",
      ordem_compra: r2["N° ORDEM DE COMPRA"] || "",
      data_nf: formatData(r2["DATA NF"] || row["Data"] || ""),
      data_ateste: dtExt(formatData(r2["DATA"] || row["Data"] || "")),
      objeto: r2["OBJETO"] || mpBusca.fornObjeto[forn2] || "",
      valor: r2["VALOR"] || r2["Valor"] || row["Valor"] || "",
      tipo_doc: r2["DOCUMENTO FISCAL"] || mpBusca.fornTipDoc[forn2] || "",
      tipo_nf: r2["TIPO"] || "",
      obs: r2["_obs"] || "",
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
  }, [appConfig]);
  const handleSync = useCallback(async () => {
    await ST.set("processos", processos);
    await ST.set("historico", historico);
    await ST.set("orgaos_config", orgaosConfig);
    toast("✅ Dados sincronizados!", "info");
  }, [processos, historico, orgaosConfig]);
  const handleImport = useCallback(rows => {
    const merged = [...rows, ...processos.filter(p => !rows.some(r => String(r["NÚMERO DO DOCUMENTO"]) === String(p["NÚMERO DO DOCUMENTO"])))];
    salvarProcessos(merged);
  }, [processos]);
  const handleSyncDB = useCallback(res => {
    if (res.processos?.length) salvarProcessos(res.processos);
    if (res.historico?.length) salvarHistorico(res.historico);
    if (Object.keys(res.orgaosConfig || {}).length) salvarOrgaos(res.orgaosConfig);
  }, []);

  // [C4] Histórico truncado check
  const histTruncado = historico.length >= 200;
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
  }, /*#__PURE__*/React.createElement("style", null, `*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e2d40;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#2d4060}input,select,textarea{font-family:inherit}@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`), /*#__PURE__*/React.createElement(Sidebar, {
    page: page,
    setPage: handleSetPage,
    user: user,
    onLogout: () => setUser(null),
    onSync: handleSync,
    proxNum: proxNumero(processos),
    dark: dark,
    onToggleDark: () => setDark(d => !d),
    formPct: formPct
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
    appConfig: appConfig
  }), page === "buscar" && /*#__PURE__*/React.createElement(BuscarPage, {
    processos: processos,
    onCarregar: handleDuplicar,
    onEditar: handleEditar,
    onGerarPDF: handleGerarPDFBusca,
    toast: toast,
    dark: dark
  }), page === "dashboard" && /*#__PURE__*/React.createElement(DashboardPage, {
    processos: processos,
    dark: dark
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
      await ST.del("processos");
      await ST.del("historico");
      await ST.del("orgaos_config");
      await ST.del("app_config");
      await ST.del("draft_form");
      setProcessos([]);
      setHistorico([]);
      setOrgaosConfig({});
      toast("🗑️ Banco de dados apagado com sucesso.", "info");
    }
  })), showShortcuts && /*#__PURE__*/React.createElement(ShortcutsModal, {
    onClose: () => setShowShortcuts(false),
    dark: dark
  }), /*#__PURE__*/React.createElement(Toast, {
    toasts: toasts
  }));
}
window.App = App;
