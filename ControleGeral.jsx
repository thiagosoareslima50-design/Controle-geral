/*
================================================================================
  SISTEMA DE CONTROLE DE PROCESSOS DE PAGAMENTO — React v4.0
  Controladoria Geral · Prefeitura Gov. Edison Lobão / MA
================================================================================
  STORAGE
  [C1] DB (shared) — banco único compartilhado entre todos os usuários
       window.storage shared=true → todos lêem/escrevem o mesmo dado
       ST (local) — apenas users e draft_form (dados pessoais)
  [C2] Lock otimista — releitura do DB antes de salvar evita número duplicado
       em uso simultâneo; número conflitante é substituído automaticamente
  [C3] Auto-save de rascunho não contamina modo edição
  [C4] Histórico limitado a 200 registros com aviso
  [C5] Polling 5s — detecta mudanças de outros usuários via hash leve;
       atualiza lista e recalcula Nº sugerido automaticamente
  [C6] syncStatus: syncing | updated | ok — indicador visual na sidebar

  FORMULÁRIO
  [A1] Máscara e validação automática de CNPJ/CPF
  [A2] Campo Valor preserva posição do cursor
  [A3] numExiste() — aviso laranja no campo; bloqueio só no lock otimista

  DATAS
  [D1] normalizaData() — base única: suporta Date, ISO, BR, serial Excel, UTC
  [D2] formatData() — sempre DD/MM/YYYY independente do formato de entrada
  [D3] dtExt() — sempre "D de mês de AAAA"; fallback para hoje se vazio
  [D4] toISO() no edit — normaliza para input type=date independente da origem

  PDF / WORD
  [M1] Escala automática da página 2 para caber em 1 página (exceto eng)
  [M2] Checklist com tick/cross escalados
  [M3] Cabeçalho com brasão em todas as páginas
  [M4] Dados do controlador vêm de appConfig (compartilhado no DB)
  [M5] data_ateste sempre extenso com tripla proteção de fallback
  [M6] cleanBrasaoAsync com crossOrigin = "anonymous"

  USUÁRIOS E SEGURANÇA
  [U1] Proteção de rotas: usuarios/orgaos/config só para admin
  [U2] Modal de senha próprio (sem window.prompt) para qualquer perfil
  [U3] Modal de permissões com 9 permissões em 4 grupos para operadores
  [U4] Operador não acessa área admin mesmo forçando page

  INTERFACE
  [B1] formPct zerado ao navegar para outra página
  [B2] Busca avisa quando resultado limitado a 100
  [B3] Modal de atalhos de teclado
  [B4] Cores municipais por área: sidebar=verde, header=azul, login=verde
================================================================================
*/
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ResponsiveContainer
} from "recharts";

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
        _sqlJs = SQL; res(SQL);
      } catch { res(null); }
    };
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
}

// ─── [C1] Storage durável ─────────────────────────────────────────────────────
// ─── [C1] Storage local — apenas dados pessoais (users, draft) ───────────────
const MEM = {};
const ST = {
  async get(k) {
    try { if (window.storage) { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } } catch {}
    try { const raw = localStorage.getItem("cgel_" + k); if (raw !== null) return JSON.parse(raw); } catch {}
    return MEM[k] ?? null;
  },
  async set(k, v) {
    MEM[k] = v;
    try { if (window.storage) { await window.storage.set(k, JSON.stringify(v)); return true; } } catch {}
    try { localStorage.setItem("cgel_" + k, JSON.stringify(v)); return true; } catch {}
    return false;
  },
  async del(k) {
    delete MEM[k];
    try { if (window.storage) await window.storage.delete(k); } catch {}
    try { localStorage.removeItem("cgel_" + k); } catch {}
    return true;
  },
};

// ─── [DB] Storage compartilhado — banco único para todos os usuários ──────────
// Usa window.storage com shared=true → todos os usuários lêem e escrevem
// o mesmo dado. Fallback para localStorage (prefixo "cgel_db_") quando
// window.storage não está disponível (dev local).
const MEM_DB = {};
const DB = {
  async get(k) {
    try {
      if (window.storage) {
        const r = await window.storage.get(k, true); // shared=true
        return r ? JSON.parse(r.value) : null;
      }
    } catch {}
    try { const raw = localStorage.getItem("cgel_db_" + k); if (raw !== null) return JSON.parse(raw); } catch {}
    return MEM_DB[k] ?? null;
  },
  async set(k, v) {
    MEM_DB[k] = v;
    try {
      if (window.storage) {
        await window.storage.set(k, JSON.stringify(v), true); // shared=true
        return true;
      }
    } catch {}
    try { localStorage.setItem("cgel_db_" + k, JSON.stringify(v)); return true; } catch {}
    return false;
  },
  async del(k) {
    delete MEM_DB[k];
    try { if (window.storage) await window.storage.delete(k, true); } catch {}
    try { localStorage.removeItem("cgel_db_" + k); } catch {}
    return true;
  },
  // Retorna um hash rápido do valor para detectar mudanças sem baixar tudo
  async hash(k) {
    try {
      if (window.storage) {
        const r = await window.storage.get(k, true);
        if (!r) return null;
        // Usa o tamanho + primeiros 60 chars como "hash" leve
        const v = r.value || "";
        return v.length + "|" + v.slice(0, 60);
      }
    } catch {}
    return null;
  },
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const MESES = ["","janeiro","fevereiro","março","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];

const CHK = {
  padrao:   ["Validação do Documento Fiscal",
             "Emissão e Autenticação das Certidões Negativas",
             "Conformidade com o processo Licitatório",
             "Disponibilidade de Saldos Licitatórios",
             "Outros: Contratos, Valores, Impostos",
             "Extrato do Contrato"],
  eng:      ["Validação do Documento Fiscal",
             "Emissão e Autenticação das Certidões Negativas",
             "Conformidade com o processo Licitatório",
             "Disponibilidade de Saldos Licitatórios",
             "Solicitação de pagamento com medição",
             "Planilha de medição assinada",
             "Relatório fotográfico",
             "Cópia Do Contrato",
             "ART ou RRT"],
  tdf:      ["Ofício","Formulário TFD",
             "Conformidade com o processo Licitatório",
             "Laudo Médico","Documentos pessoais"],
  passagem: ["Prestação de contas diárias",
             "Documentação comprobatória",
             "Requerimento de restituição"],
};

const TINFO = {
  padrao:   { label:"Anexo II",             icon:"📄", cor:"#2563eb" },
  eng:      { label:"NF Engenharia",        icon:"🏗️", cor:"#7c3aed" },
  tdf:      { label:"TFD",                  icon:"🏥", cor:"#0f766e" },
  passagem: { label:"Restituição Passagem", icon:"✈️", cor:"#d97706" },
};

const COL_CANON = {
  "ORGAO":"ORGÃO","SECRETARIA":"ORGÃO","SECRETARIO":"SECRETARIO",
  "FORNECEDOR":"FORNECEDOR","EMPRESA":"FORNECEDOR","CREDOR":"FORNECEDOR",
  "CNPJ":"CNPJ","CPF":"CNPJ","MODALIDADE":"MODALIDADE","CONTRATO":"CONTRATO",
  "OBJETO":"OBJETO","DESCRICAO":"OBJETO","VALOR":"VALOR","DATA NF":"DATA NF",
  "NUMERO DO DOCUMENTO":"NÚMERO DO DOCUMENTO","PROCESSO":"NÚMERO DO DOCUMENTO",
  "PERIODO DE REFERENCIA":"PERÍODO DE REFERÊNCIA",
  "N° ORDEM DE COMPRA":"N° ORDEM DE COMPRA","SOLICITANTE":"SOLICITANTE",
  "CPF BENEFICIARIO":"CPF_BENEFICIARIO",
  "DOCUMENTO FISCAL":"DOCUMENTO FISCAL","TIPO":"TIPO","DATA":"DATA",
};

const FOOTER_TXT = "RUA IMPERATRIZ II, Nº 800, CENTRO - GOV. EDISON LOBÃO/MA  |  CEP: 65.928-000";

// ── Cores municipais: Ouro #EFD103 | Verde #006000 | Azul #0040E0 ──
const MUN={
  gold:"#EFD103",goldDk:"#b89d00",goldXdk:"#7a6500",
  green:"#006000",greenDk:"#003d00",greenXdk:"#001800",greenMid:"#1a4a1a",
  blue:"#0040E0",blueDk:"#002da0",blueXdk:"#001560",
};
const T = {
  // Modo claro: fundo creme-esverdeado suave
  appBg:"linear-gradient(160deg,#f5f8f0 0%,#eef3e8 50%,#f0f4ea 100%)",
  cardBg:"#ffffff",
  border:"#c8d8b8",
  textMain:"#1a2310",
  // Modo escuro: fundo neutro escuro — as cores municipais ficam nas áreas de interface
  appBgDark:"#111418",
  cardBgDark:"#1a1f24",
  borderDark:"#2a3540",
  textMainDark:"#d8eecc",
  kpi1:"linear-gradient(135deg,"+MUN.green+","+MUN.greenDk+")",
  kpi2:"linear-gradient(135deg,"+MUN.blue+","+MUN.blueDk+")",
  kpi3:"linear-gradient(135deg,#c0392b,#7b241c)",
  kpi4:"linear-gradient(135deg,"+MUN.gold+","+MUN.goldDk+")",
  kpi5:"linear-gradient(135deg,#1a9e4a,#0e6b30)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normCol = c =>
  String(c).trim().toUpperCase()
    .replace(/\xa0/g," ").replace(/\n|\t/g," ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ").trim();
const canonCol = raw => COL_CANON[normCol(raw)] || raw;

function formatValor(raw) {
  if (!raw) return "";
  raw = String(raw).trim().replace(/^[Rr]\$\s*/,"");
  if (raw.includes(",")) {
    const [int_,dec_] = raw.replace(/\./g,"").split(",");
    const cents = (dec_||"").slice(0,2).padEnd(2,"0");
    const num = parseInt(int_.replace(/\D/g,"")||"0",10);
    return `${num.toLocaleString("pt-BR")},${cents}`;
  }
  const d = raw.replace(/\D/g,"");
  if (!d) return "";
  if (d.length<=2) return `0,${d.padEnd(2,"0")}`;
  return `${parseInt(d.slice(0,-2),10).toLocaleString("pt-BR")},${d.slice(-2)}`;
}

// ─── Normalização de datas — base única para todas as conversões ───────────────
// Aceita: Date nativo, ISO "YYYY-MM-DD", BR "DD/MM/YYYY", número serial Excel, string mista
// Retorna: { dia:number, mes:number(1-12), ano:number } ou null se inválida
function normalizaData(raw) {
  if (!raw && raw !== 0) return null;
  // Objeto Date nativo
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    // Usar UTC para evitar bugs de fuso-horário (Excel salva em UTC)
    return { dia: raw.getUTCDate(), mes: raw.getUTCMonth()+1, ano: raw.getUTCFullYear() };
  }
  const s = String(raw).trim();
  // ISO completo: YYYY-MM-DD (com possível sufixo de hora)
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) {
    const [,y,m,d] = isoM;
    return { dia: parseInt(d,10), mes: parseInt(m,10), ano: parseInt(y,10) };
  }
  // BR: DD/MM/YYYY ou DD-MM-YYYY
  const brM = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (brM) {
    const [,d,m,y] = brM;
    return { dia: parseInt(d,10), mes: parseInt(m,10), ano: parseInt(y,10) };
  }
  // Número serial do Excel (float, ex: 45657.0 = 05/01/2026)
  const numVal = parseFloat(s);
  if (!isNaN(numVal) && numVal > 1000) {
    const dt = new Date(Math.round((numVal - 25569) * 86400 * 1000));
    return { dia: dt.getUTCDate(), mes: dt.getUTCMonth()+1, ano: dt.getUTCFullYear() };
  }
  return null;
}

function formatData(raw) {
  const nd = normalizaData(raw);
  if (!nd) return "";
  const { dia, mes, ano } = nd;
  return `${String(dia).padStart(2,"0")}/${String(mes).padStart(2,"0")}/${ano}`;
}

function dtExt(raw) {
  if (!raw && raw !== 0) return "";
  // Se já é extenso ("5 de janeiro de 2026") — retorna como está
  if (typeof raw === "string" && raw.includes(" de ") && raw.length > 8) return raw;
  const nd = normalizaData(raw);
  if (!nd) return typeof raw === "string" ? raw : "";
  const { dia, mes, ano } = nd;
  if (!MESES[mes]) return formatData(raw); // fallback para DD/MM/YYYY se mês inválido
  return `${dia} de ${MESES[mes]} de ${ano}`;
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

// ─── [C2] proxNumero ──────────────────────────────────────────────────────────
function proxNumero(processos) {
  const nums = processos
    .map(p => parseInt(String(p["NÚMERO DO DOCUMENTO"]||"").trim(),10))
    .filter(n => !isNaN(n) && n > 0);
  if (!nums.length) return 1;
  const set = new Set(nums);
  let next = Math.max(...nums)+1;
  while (set.has(next)) next++;
  return next;
}

// Retorna true se o número já existe na lista informada
function numExiste(processos, num) {
  const n = parseInt(String(num).trim(), 10);
  return !isNaN(n) && processos.some(
    p => parseInt(String(p["NÚMERO DO DOCUMENTO"]||"").trim(),10) === n
  );
}

// ─── [A1] Máscara CNPJ/CPF ────────────────────────────────────────────────────
function mascararCnpjCpf(raw) {
  const d = raw.replace(/\D/g,"");
  if (d.length<=11) {
    const p1=d.slice(0,3),p2=d.slice(3,6),p3=d.slice(6,9),p4=d.slice(9,11);
    if (d.length<=3) return p1;
    if (d.length<=6) return `${p1}.${p2}`;
    if (d.length<=9) return `${p1}.${p2}.${p3}`;
    return `${p1}.${p2}.${p3}-${p4}`;
  }
  const p1=d.slice(0,2),p2=d.slice(2,5),p3=d.slice(5,8),p4=d.slice(8,12),p5=d.slice(12,14);
  if (d.length<=2) return p1;
  if (d.length<=5) return `${p1}.${p2}`;
  if (d.length<=8) return `${p1}.${p2}.${p3}`;
  if (d.length<=12) return `${p1}.${p2}.${p3}/${p4}`;
  return `${p1}.${p2}.${p3}/${p4}-${p5}`;
}
function validarCnpjCpf(raw) {
  const d = raw.replace(/\D/g,"");
  return d.length===0||d.length===11||d.length===14;
}

// ─── MapData ──────────────────────────────────────────────────────────────────
function buildMapData(processos) {
  const dct=(kC,vC)=>{const m={};for(const p of processos){const k=String(p[kC]||"").trim(),v=String(p[vC]||"").trim();if(k&&v)m[k]=v;}return m;};
  const lst=(col)=>{const s=new Set();for(const p of processos){const v=String(p[col]||"").trim();if(v)s.add(v);}return[...s].sort();};
  const multi=(kC,vC)=>{const m={};for(const p of processos){const k=String(p[kC]||"").trim(),v=String(p[vC]||"").trim();if(!k||!v)continue;if(!m[k])m[k]=new Set();m[k].add(v);}const out={};for(const k in m)out[k]=[...m[k]].sort();return out;};
  return {
    orgaoSecretario:dct("ORGÃO","SECRETARIO"),
    fornCnpj:dct("FORNECEDOR","CNPJ"),fornObjeto:dct("FORNECEDOR","OBJETO"),
    fornModalidade:dct("FORNECEDOR","MODALIDADE"),fornContrato:dct("FORNECEDOR","CONTRATO"),
    fornObjetosList:multi("FORNECEDOR","OBJETO"),fornContratosList:multi("FORNECEDOR","CONTRATO"),
    fornModalidadesList:multi("FORNECEDOR","MODALIDADE"),
    cnpjForn:dct("CNPJ","FORNECEDOR"),modalContrato:dct("MODALIDADE","CONTRATO"),
    modalContratosList:multi("MODALIDADE","CONTRATO"),
    objModalidade:dct("OBJETO","MODALIDADE"),objContrato:dct("OBJETO","CONTRATO"),
    allSecretarios:lst("SECRETARIO"),allCnpjs:lst("CNPJ"),allContratos:lst("CONTRATO"),
    allObjsHist:lst("OBJETO"),allDocFiscais:lst("DOCUMENTO FISCAL"),allTiposNf:lst("TIPO"),
    allModalidades:lst("MODALIDADE"),allOrgaos:lst("ORGÃO"),allFornecedores:lst("FORNECEDOR"),
    orgaoContratosList:multi("ORGÃO","CONTRATO"),orgaoModalidadesList:multi("ORGÃO","MODALIDADE"),
    orgaoContrato:dct("ORGÃO","CONTRATO"),orgaoModalidade:dct("ORGÃO","MODALIDADE"),
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function hashSenha(salt,senha){
  const e=new TextEncoder(),b=await crypto.subtle.digest("SHA-256",e.encode(salt+senha));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function loadUsers(){
  let u=await ST.get("users");
  if(!u){
    const salt=crypto.randomUUID().replace(/-/g,"").slice(0,32);
    const hash=await hashSenha(salt,"admin123");
    u={admin:{senha:hash,salt,nome:"Administrador",perfil:"admin",ativo:true}};
    await ST.set("users",u);
  }
  return u;
}
async function checkLogin(login,senha){
  const us=await loadUsers(),u=us[login];
  if(!u||!u.ativo) return null;
  return (await hashSenha(u.salt,senha))===u.senha?u:null;
}

// ─── Excel ────────────────────────────────────────────────────────────────────
async function importarExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf,{type:"array",cellDates:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws,{defval:"",raw:false});
  return raw.map(row=>{const out={};for(const[k,v] of Object.entries(row))out[canonCol(k)]=v;return out;});
}
function exportarExcel(processos,historico) {
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(processos),"Processos");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(historico),"Histórico");
  XLSX.writeFile(wb,`ControleGeral_${todayISO()}.xlsx`);
}

// ─── SQLite reader ────────────────────────────────────────────────────────────
async function readSqliteDB(file) {
  try {
    const SQL=await loadSqlJs();
    if(!SQL) return {error:"sql.js não carregou."};
    const buf=await file.arrayBuffer();
    const db=new SQL.Database(new Uint8Array(buf));
    const processos=[],historico=[],orgaosConfig={};
    try{const r=db.exec("SELECT * FROM processos");if(r[0]){const{columns,values}=r[0];for(const row of values){const o={};columns.forEach((c,i)=>{o[canonCol(c)]=row[i]??""});processos.push(o);}}}catch{}
    try{const r=db.exec("SELECT * FROM historico");if(r[0]){const{columns,values}=r[0];for(const row of values){const o={};columns.forEach((c,i)=>{o[c]=row[i]??""});historico.push(o);}}}catch{}
    try{const r=db.exec("SELECT * FROM orgaos_config");if(r[0]){const{columns,values}=r[0];for(const row of values){const o={};columns.forEach((c,i)=>{o[c]=row[i]??""});if(o.orgao)orgaosConfig[o.orgao]={secretario:o.secretario||"",ativo:o.ativo!==0&&o.ativo!=="0"};}}}catch{}
    db.close();
    return {processos,historico,orgaosConfig};
  } catch(e){ return {error:e.message||"Erro ao ler banco."}; }
}

// ─── [M6] cleanBrasaoAsync ────────────────────────────────────────────────────
function cleanBrasaoAsync(src) {
  return new Promise(resolve=>{
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>{
      try{
        const canvas=document.createElement("canvas");
        canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);
        const id=ctx.getImageData(0,0,canvas.width,canvas.height);
        const px=id.data;
        for(let i=0;i<px.length;i+=4)if(px[i]>220&&px[i+1]>220&&px[i+2]>220)px[i+3]=0;
        ctx.putImageData(id,0,0);resolve(canvas.toDataURL("image/png"));
      }catch{resolve(src);}
    };
    img.onerror=()=>resolve(src);img.src=src;
  });
}

// ─── jsPDF loader ─────────────────────────────────────────────────────────────
let _jspdf=null;
async function loadJsPDF(){
  if(_jspdf)return _jspdf;
  return new Promise((res,rej)=>{
    if(window.jspdf){_jspdf=window.jspdf;res(_jspdf);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload=()=>window.jspdf?(_jspdf=window.jspdf,res(_jspdf)):rej(new Error("jsPDF não carregou"));
    s.onerror=()=>rej(new Error("Falha ao carregar jsPDF"));
    document.head.appendChild(s);
  });
}

// ─── docx.js loader ───────────────────────────────────────────────────────────
let _docxLib=null;
async function loadDocxLib(){
  if(_docxLib)return _docxLib;
  return new Promise((res,rej)=>{
    if(window.docx){_docxLib=window.docx;res(_docxLib);return;}
    const s=document.createElement("script");
    s.src="https://unpkg.com/docx@7.8.2/build/index.umd.js";
    s.onload=()=>window.docx?(_docxLib=window.docx,res(_docxLib)):rej(new Error("docx.js não carregou"));
    s.onerror=()=>rej(new Error("Falha ao carregar docx.js"));
    document.head.appendChild(s);
  });
}

// ─── gerarPDF — fidelidade 100% ao modelo PROC-NF ─────────────────────────────
// Regras de layout:
//   • Página 2 cabe em UMA página para todos os tipos, exceto "eng" (pode usar 2).
//   • Alturas das linhas se ajustam automaticamente ao conteúdo (só altura, nunca largura).
//   • Se o conteúdo total ultrapassar o espaço disponível, aplica-se um fator de
//     compressão uniforme (escala) a fontes, alturas de linha e espaçamentos.
async function gerarPDF(d,tipo,deferir,checklist,sits){
  try{
    const lib=await loadJsPDF();if(!lib)return{error:"jsPDF não disponível."};
    const{jsPDF}=lib;
    const fv=v=>(v&&String(v).trim())?String(v).trim():"";
    const W=210,H=297;

    // ── Tick / Cross ──────────────────────────────────────────────────────────
    function tick(doc,cx,cy,s){
      const r=s||1;
      doc.setDrawColor(0,100,0);doc.setLineWidth(0.5*r);
      doc.line(cx-2.2*r,cy,cx-0.5*r,cy+2.2*r);
      doc.line(cx-0.5*r,cy+2.2*r,cx+2.5*r,cy-1.8*r);
    }
    function cross(doc,cx,cy,s){
      const r=s||1;
      doc.setDrawColor(180,0,0);doc.setLineWidth(0.5*r);
      doc.line(cx-2*r,cy-2*r,cx+2*r,cy+2*r);
      doc.line(cx+2*r,cy-2*r,cx-2*r,cy+2*r);
    }

    // ── Cabeçalho ─────────────────────────────────────────────────────────────
    // Retorna y após o cabeçalho. withLine=true adiciona linha separadora (só pág 2).
    function cabecalho(doc,withLine){
      const bW=30.7,bH=22.5,bX=(W-bW)/2,bY=8;
      try{doc.addImage(BRASAO_B64,"PNG",bX,bY,bW,bH);}catch(e){}
      let y=bY+bH+4.5;
      doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(0,0,0);
      doc.text("ESTADO DO MARANHÃO",W/2,y,{align:"center"});y+=5;
      doc.text("PREFEITURA MUNICIPAL DE GOVERNADOR EDISON LOBÃO",W/2,y,{align:"center"});y+=5;
      doc.text("CONTROLADORIA DO MUNICÍPIO",W/2,y,{align:"center"});y+=5;
      if(withLine){doc.setDrawColor(0,0,0);doc.setLineWidth(0.6);doc.line(19,y,W-19,y);y+=1;}
      return y; // ≈ 51mm
    }

    // ── Dimensões base da página 2 ────────────────────────────────────────────
    const CAB2_H=51;          // altura do cabeçalho pág 2 (com linha sep.)
    const TOP_GAP=8;          // espaço após cabeçalho antes do conteúdo
    const FOOTER_MARGIN=14;   // rodapé + margem inferior
    const AVAIL=H-CAB2_H-TOP_GAP-FOOTER_MARGIN; // ≈ 224mm disponíveis

    // ── Constantes de layout (a serem escaladas) ──────────────────────────────
    const FS0=12, LH0=5.5, MIN_ROW0=7.5, PAD0=3.0;
    const pW=W-30-19;    // 161mm área de texto livre
    const DML=28.0;      // margem esquerda tabela dados
    const DC=[24.9,22.6,24.4,32.5,33.1,34.4]; // 6 colunas dados (172mm total)
    const CK1=12.7, CK2=139.8, CK3=19.4;      // 3 colunas checklist
    const ckX=DML;

    // ── Pré-calcular número de linhas de cada célula (com FS0) ───────────────
    const doc0=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    doc0.setFont("helvetica","normal");doc0.setFontSize(FS0);

    function nLines(text,w){return doc0.splitTextToSize(fv(text),w).length;}
    function rowH0(text,w){return Math.max(MIN_ROW0,nLines(text,w)*LH0+PAD0);}

    const lbParacer=doc0.splitTextToSize(
      "PARECER DE VERIFICAÇÃO E ANÁLISE DOCUMENTAL Nº "+fv(d.processo)+" (LIBERAÇÃO PARA PAGAMENTO)",pW);
    const lbOrgao=doc0.splitTextToSize("Órgão / Departamento: "+fv(d.orgao),pW);
    const lbApos=doc0.splitTextToSize(
      "Após análise e verificação da documentação constante no processo de pagamento acima citado, constatamos o seguinte:",pW);
    const lbObs=d.obs?doc0.splitTextToSize(d.obs.trim(),pW):[];

    // Alturas das linhas da tabela de dados
    const vw0=DC[1]+DC[2]+DC[3]+DC[4]+DC[5];  // val col OBJETO
    const vw1=DC[2]+DC[3]+DC[4]+DC[5];         // val col demais
    const dtH=[
      rowH0(d.objeto,vw0),          // OBJETO
      rowH0(d.orgao,vw1),           // Secretaria
      rowH0(d.fornecedor,vw1),      // Fornecedor/Credor
      rowH0(d.modalidade,vw1),      // Modalidade
      rowH0(d.contrato,vw1),        // Contrato
      rowH0(d.cnpj,vw1),            // CNPJ
      Math.max(MIN_ROW0,nLines(d.tipo_doc,DC[2]-3)*LH0+PAD0), // DocFiscal
    ];

    // Alturas das linhas do checklist
    const ckH=checklist.map(item=>Math.max(MIN_ROW0,nLines(item,CK2-4)*LH0+PAD0));

    // ── Soma total do conteúdo da página 2 (a 100% de escala) ────────────────
    let total=0;
    total+=lbParacer.length*5.8+7;           // PARECER + gap
    total+=5.5;                               // "Ao"
    total+=lbOrgao.length*LH0+5;            // Órgão/Dep + gap
    total+=5.5+7;                            // Ref. + gap
    total+=dtH.reduce((a,b)=>a+b,0);        // tabela dados
    total+=6;                                // gap após tabela
    total+=lbApos.length*LH0+6;             // Após análise + gap
    total+=MIN_ROW0;                         // cabeçalho checklist
    total+=ckH.reduce((a,b)=>a+b,0);        // linhas checklist
    total+=8;                                // gap pós checklist
    total+=6+(lbObs.length>0?lbObs.length*LH0+5:8); // OBSERVAÇÃO
    total+=6+5.5+5.5+22+5.5+5.5+5.5;       // bloco assinatura

    // ── Calcular fator de escala ──────────────────────────────────────────────
    // eng: sem limite (pode usar 2 páginas)  — outros: forçar em 1 página
    const forceOnePage=(tipo!=="eng");
    let scale=1.0;
    if(forceOnePage&&total>AVAIL){
      scale=AVAIL/total;
      scale=Math.max(scale,0.72); // mínimo legível
    }

    // ── Valores escalados ─────────────────────────────────────────────────────
    const FS=FS0*scale;
    const LH=LH0*scale;
    const MIN_ROW=MIN_ROW0*scale;
    const PAD=PAD0*scale;
    const GAP6=6*scale;
    const GAP7=7*scale;
    const GAP8=8*scale;
    const SAFE=H-FOOTER_MARGIN; // limite inferior para quebra de página (só eng)

    // ── Função rowH escalada (usa FS escalado para medir linhas) ─────────────
    const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    doc.setFontSize(FS);doc.setFont("helvetica","normal");

    function rowH(text,w){
      const ls=doc.splitTextToSize(fv(text),w);
      return Math.max(MIN_ROW,ls.length*LH+PAD);
    }
    function splitS(text,w){return doc.splitTextToSize(fv(text),w);}

    // ═══════════════════════════════════════════════════════════════════
    // PÁGINA 1 — CAPA (sem escala, sempre cabe)
    // ═══════════════════════════════════════════════════════════════════
    let y=cabecalho(doc,false);
    y+=14;

    // Tabela capa — label=47.6mm, valor=117.5mm, título full 165.1mm
    const CML=22.4,CCW=165.1,CCA=47.6,CCB=117.5;
    doc.setDrawColor(0,0,0);doc.setLineWidth(0.4);
    doc.rect(CML,y,CCW,10,"S");
    doc.setFont("helvetica","bold");doc.setFontSize(14);doc.setTextColor(0,0,0);
    doc.text("PROCESSO DE PAGAMENTO",CML+CCW/2,y+7,{align:"center"});
    y+=10;

    const capaRows=[
      ["Órgão:",fv(d.orgao)],["Processo:",fv(d.processo)],
      ["Fornecedor:",fv(d.fornecedor)],["CNPJ:",fv(d.cnpj)],
      ["NF/Fatura:",fv(d.nf)],["Contrato:",fv(d.contrato)],
      ["Modalidade:",fv(d.modalidade)],["Período de ref.:",fv(d.periodo_ref)],
      ["N° Ordem de C.:",fv(d.ordem_compra||"")],
      ["Data da NF.:",     formatData(d.data_nf) || formatData(new Date())],
      ["Secretário(a):",   fv(d.secretario)],
      ["Data do ateste:",  (d.data_ateste && d.data_ateste.includes(" de ")) ? d.data_ateste : (dtExt(d.data_ateste) || dtExt(new Date()))],
    ];
    doc.setFontSize(14);
    for(const[lbl,val]of capaRows){
      const vL=doc.splitTextToSize(val,CCB-4);
      // Altura mínima 10mm; cada linha extra soma 6.8mm
      const rH=Math.max(10,vL.length*6.8+3);
      doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
      doc.rect(CML,y,CCA,rH,"S");doc.rect(CML+CCA,y,CCB,rH,"S");
      // TY: posição do baseline da 1ª linha — sempre 7mm abaixo da borda superior
      const TY=y+7;
      doc.setFont("helvetica","bold");doc.text(lbl,CML+2.5,TY);
      doc.setFont("helvetica","normal");
      if(val){vL.forEach((l,li)=>doc.text(l,CML+CCA+2.5,TY+li*6.8));}
      y+=rH;
    }
    // Caixa Obs.
    const obsBoxH=34;
    y+=3;
    doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
    doc.rect(CML,y,CCW,obsBoxH,"S");
    doc.setFont("helvetica","normal");doc.setFontSize(12);doc.setTextColor(0,0,0);
    doc.text("Obs.:",CML+2.5,y+8);
    if(d.obs&&d.obs.trim()){
      const oL=doc.splitTextToSize(d.obs.trim(),CCW-28);
      oL.forEach((l,li)=>doc.text(l,CML+24,y+8+li*5.5));
    }

    // ═══════════════════════════════════════════════════════════════════
    // PÁGINA 2 — PARECER (com escala se necessário)
    // ═══════════════════════════════════════════════════════════════════
    doc.addPage();
    y=cabecalho(doc,true);
    y+=TOP_GAP;

    doc.setFont("helvetica","bold");doc.setFontSize(FS);doc.setTextColor(0,0,0);
    const pTxt="PARECER DE VERIFICAÇÃO E ANÁLISE DOCUMENTAL Nº "+fv(d.processo)+" (LIBERAÇÃO PARA PAGAMENTO)";
    const pL=splitS(pTxt,pW);
    doc.text(pL,30,y,{align:"justify",maxWidth:pW});
    y+=pL.length*5.8*scale+GAP7;

    doc.setFont("helvetica","normal");doc.setFontSize(FS);
    doc.text("Ao",30,y);y+=LH;
    const orgL=splitS("Órgão / Departamento: "+fv(d.orgao),pW);
    doc.text(orgL,30,y);y+=orgL.length*LH+5*scale;
    doc.text("Ref. Processo de Pagamento de Despesa.",30,y);y+=LH+scale*1.5;

    // ── Tabela de dados ───────────────────────────────────────────────────────
    doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);

    function dRow(lbl,val,lW,vW){
      const vL=splitS(val,vW-3);
      const rH=Math.max(MIN_ROW,vL.length*LH+PAD);
      if(forceOnePage===false&&y+rH>SAFE){doc.addPage();y=cabecalho(doc,true);y+=TOP_GAP;}
      doc.rect(DML,y,lW,rH,"S");doc.rect(DML+lW,y,vW,rH,"S");
      // top-padding fixo: nunca vaza acima da borda superior da célula
      const TY=y+LH*0.9;
      doc.setFont("helvetica","bold");doc.setFontSize(FS);
      doc.text(lbl,DML+2.5,TY);
      doc.setFont("helvetica","normal");
      if(val){
        vL.forEach((l,li)=>doc.text(l,DML+lW+2.5,TY+li*LH));
      }
      y+=rH;
    }

    dRow("OBJETO:",       d.objeto,   DC[0], vw0);
    dRow("Secretaria/Programa:", d.orgao,      DC[0]+DC[1], vw1);
    dRow("Fornecedor/Credor:",   d.fornecedor, DC[0]+DC[1], vw1);
    dRow("Modalidade",           d.modalidade, DC[0]+DC[1], vw1);
    dRow("Contrato",             d.contrato,   DC[0]+DC[1], vw1);
    dRow("CNPJ/CPF Nº",         d.cnpj,       DC[0]+DC[1], vw1);

    // Linha Documento Fiscal (5 colunas)
    {
      const c0=DC[0]+DC[1],c1=DC[2],c2=DC[3],c3=DC[4],c4=DC[5];
      const x0=DML,x1=DML+c0,x2=x1+c1,x3=x2+c2,x4=x3+c3;
      const dfL=splitS(d.tipo_doc,c1-3);
      const dfH=Math.max(MIN_ROW,dfL.length*LH+PAD);
      if(forceOnePage===false&&y+dfH>SAFE){doc.addPage();y=cabecalho(doc,true);y+=TOP_GAP;}
      doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
      doc.rect(x0,y,c0,dfH,"S");doc.rect(x1,y,c1,dfH,"S");
      doc.rect(x2,y,c2,dfH,"S");doc.rect(x3,y,c3,dfH,"S");doc.rect(x4,y,c4,dfH,"S");
      const mid=y+dfH/2+LH*0.35;
      doc.setFont("helvetica","bold");doc.setFontSize(FS);
      doc.text("Documento Fiscal",x0+2.5,mid);
      doc.setFont("helvetica","normal");
      dfL.forEach((l,li)=>doc.text(l,x1+2.5,mid+(li-Math.floor(dfL.length/2))*LH));
      doc.setFont("helvetica","bold");doc.text("Nº ",x2+2.5,mid);
      const nW=doc.getTextWidth("Nº ");
      doc.setFont("helvetica","normal");
      if(d.nf){const t=doc.splitTextToSize(fv(d.nf),c2-4-nW);doc.text(t[0],x2+2.5+nW,mid);}
      doc.setFont("helvetica","bold");doc.text("Tipo ",x3+2.5,mid);
      const tW=doc.getTextWidth("Tipo ");
      doc.setFont("helvetica","normal");
      if(d.tipo_nf){const t=doc.splitTextToSize(fv(d.tipo_nf),c3-4-tW);doc.text(t[0],x3+2.5+tW,mid);}
      doc.setFont("helvetica","bold");doc.text("R$ ",x4+2.5,mid);
      const rW2=doc.getTextWidth("R$ ");
      doc.setFont("helvetica","normal");
      if(d.valor){const t=doc.splitTextToSize(fv(d.valor),c4-4-rW2);doc.text(t[0],x4+2.5+rW2,mid);}
      y+=dfH;
    }
    y+=GAP6;

    // Após análise...
    doc.setFont("helvetica","normal");doc.setFontSize(FS);doc.setTextColor(0,0,0);
    const aposL=splitS("Após análise e verificação da documentação constante no processo de pagamento acima citado, constatamos o seguinte:",pW);
    doc.text(aposL,30,y);y+=aposL.length*LH+GAP6;

    // ── Checklist ──────────────────────────────────────────────────────────────
    const ckHH=Math.max(MIN_ROW,LH+PAD);
    if(forceOnePage===false&&y+ckHH>SAFE){doc.addPage();y=cabecalho(doc,true);y+=TOP_GAP;}
    doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
    doc.rect(ckX,y,CK1,ckHH,"S");doc.rect(ckX+CK1,y,CK2,ckHH,"S");doc.rect(ckX+CK1+CK2,y,CK3,ckHH,"S");
    doc.setFont("helvetica","bold");doc.setFontSize(FS);
    doc.text("Item",ckX+CK1/2,y+ckHH/2+LH*0.35,{align:"center"});
    doc.text("Descrição: Documentos \u2013 Ato",ckX+CK1+CK2/2,y+ckHH/2+LH*0.35,{align:"center"});
    doc.setFontSize(FS*0.85);
    doc.text("Situação",ckX+CK1+CK2+CK3/2,y+ckHH/2+LH*0.35,{align:"center"});
    doc.setFontSize(FS);
    y+=ckHH;

    for(let i=0;i<checklist.length;i++){
      const dL=splitS(checklist[i],CK2-4);
      const rH=Math.max(MIN_ROW,dL.length*LH+PAD);
      if(forceOnePage===false&&y+rH>SAFE){doc.addPage();y=cabecalho(doc,true);y+=TOP_GAP;}
      doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
      doc.rect(ckX,y,CK1,rH,"S");doc.rect(ckX+CK1,y,CK2,rH,"S");doc.rect(ckX+CK1+CK2,y,CK3,rH,"S");
      doc.setFont("helvetica","normal");doc.setFontSize(FS);doc.setTextColor(0,0,0);
      const ckTY=y+LH*0.9;
      doc.text(String(i+1),ckX+CK1/2,ckTY,{align:"center"});
      dL.forEach((l,li)=>doc.text(l,ckX+CK1+2.5,ckTY+li*LH));
      const sx=ckX+CK1+CK2+CK3/2,sy=y+rH/2;
      if(sits[i])tick(doc,sx,sy,scale);else cross(doc,sx,sy,scale);
      y+=rH;
    }
    y+=GAP8;

    // OBSERVAÇÃO
    doc.setFont("helvetica","bold");doc.setFontSize(FS);doc.setTextColor(0,0,0);
    doc.text("OBSERVAÇÃO:",30,y);y+=6*scale;
    if(d.obs&&d.obs.trim()){
      doc.setFont("helvetica","normal");
      const oL2=splitS(d.obs.trim(),pW);
      doc.text(oL2,30,y);y+=oL2.length*LH+5*scale;
    }else{y+=8*scale;}

    // ── Assinatura ─────────────────────────────────────────────────────────────
    y+=6*scale;
    const ctrl=d.controlador||{};
    const ctrlNome=fv(ctrl.nome)||"Thiago Soares Lima";
    const ctrlCargo=fv(ctrl.cargo)||"Controlador Geral";
    const ctrlPortaria=fv(ctrl.portaria)||"Portaria 002/2025";
    const decTxt=deferir?"DEFERIMOS O PAGAMENTO:":"INDEFERIMOS O PAGAMENTO:";
    doc.setFont("helvetica","normal");doc.setFontSize(FS);doc.setTextColor(0,0,0);
    const dataAssinatura = (d.data_ateste && d.data_ateste.includes(" de ")) ? d.data_ateste : (dtExt(d.data_ateste) || dtExt(new Date()));
    doc.text("Governador Edison Lobão/MA, "+dataAssinatura,W-19,y,{align:"right"});
    y+=LH;
    doc.text("Nestes Termos:",90,y);y+=LH;
    doc.text(decTxt,90,y);y+=22*scale;
    doc.text(ctrlNome,W/2,y,{align:"center"});y+=LH;
    doc.text(ctrlCargo,W/2,y,{align:"center"});y+=LH;
    if(ctrlPortaria)doc.text(ctrlPortaria,W/2,y,{align:"center"});

    // ── Rodapé em todas as páginas ─────────────────────────────────────────────
    const totalPgs=doc.internal.getNumberOfPages();
    for(let pg=1;pg<=totalPgs;pg++){
      doc.setPage(pg);
      doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(120,120,120);
      doc.text(FOOTER_TXT,W/2,H-6,{align:"center"});
    }
    const blob=doc.output("blob");
    return{blob,name:"PROCESSO_"+fv(d.processo||"doc")+"_"+tipo.toUpperCase()+".pdf"};
  }catch(e){return{error:e.message||"Erro ao gerar PDF."};}
}


// ─── gerarWordDoc ─────────────────────────────────────────────────────────────
async function gerarWordDoc(d,tipo,deferir,checklist,sits){
  const lib=await loadDocxLib();if(!lib)throw new Error("docx.js não disponível.");
  const{Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,AlignmentType}=lib;
  const fv=v=>(v&&String(v).trim())?String(v).trim():"—";
  const dataRows=[
    ["Órgão",fv(d.orgao)],["Processo",fv(d.processo)],["Fornecedor",fv(d.fornecedor)],
    ["CNPJ",fv(d.cnpj)],["Contrato",fv(d.contrato)],["Modalidade",fv(d.modalidade)],
    ["Objeto",fv(d.objeto)],["Valor","R$ "+fv(d.valor)],
    ["Data NF",fv(d.data_nf)],["Secretário(a)",fv(d.secretario)],
  ];
  const mkRow=(cells)=>new TableRow({children:cells.map(([txt,bold,pct])=>new TableCell({
    width:{size:pct,type:WidthType.PERCENTAGE},
    children:[new Paragraph({children:[new TextRun({text:txt,bold,size:22})]})]
  }))});
  const tableRows=dataRows.map(([l,v])=>mkRow([[l,true,30],[v,false,70]]));
  const chkRows=checklist.map((item,i)=>new TableRow({children:[
    new TableCell({width:{size:8,type:WidthType.PERCENTAGE},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:String(i+1),size:20})]})] }),
    new TableCell({width:{size:77,type:WidthType.PERCENTAGE},children:[new Paragraph({children:[new TextRun({text:item,size:20})]})] }),
    new TableCell({width:{size:15,type:WidthType.PERCENTAGE},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:sits[i]?"✓":"✗",bold:true,size:20,color:sits[i]?"00AA00":"CC0000"})]})] }),
  ]}));
  const dec=deferir
    ?"Com base na análise realizada, manifestamo-nos pelo DEFERIMENTO do processo."
    :"Com base na análise realizada, manifestamo-nos pelo INDEFERIMENTO do processo.";
  const docObj=new Document({sections:[{children:[
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"ESTADO DO MARANHÃO",bold:true,size:28})]}),
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"PREFEITURA MUNICIPAL DE GOVERNADOR EDISON LOBÃO",bold:true,size:26})]}),
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:"CONTROLADORIA DO MUNICÍPIO",bold:true,size:26})]}),
    new Paragraph({text:""}),
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`PROCESSO DE PAGAMENTO Nº ${fv(d.processo)}`,bold:true,size:28})]}),
    new Paragraph({text:""}),
    new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:tableRows}),
    new Paragraph({text:""}),
    new Paragraph({children:[new TextRun({text:"CHECKLIST DE VERIFICAÇÃO",bold:true,size:24})]}),
    new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:chkRows}),
    new Paragraph({text:""}),
    new Paragraph({children:[new TextRun({text:dec,size:22})]}),
    new Paragraph({text:""}),
    new Paragraph({children:[new TextRun({text:`Governador Edison Lobão/MA, ${dtExt(new Date())}`,size:22})]}),
    new Paragraph({text:""}),
    new Paragraph({children:[new TextRun({text:"________________________________",size:22})]}),
    new Paragraph({children:[new TextRun({text:"Controlador Municipal",bold:true,size:22})]}),
    new Paragraph({text:""}),
    new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:FOOTER_TXT,size:18,color:"666666"})]}),
  ]}]});
  const blob=await Packer.toBlob(docObj);
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;
  a.download=`PROCESSO_${fv(d.processo)}_${tipo.toUpperCase()}.docx`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2000);
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
const LS=(dark)=>({display:"block",fontSize:11,fontWeight:700,marginBottom:4,letterSpacing:".04em",textTransform:"uppercase",color:dark?"#4a6494":"#64748b"});
const IS=(dark)=>({width:"100%",padding:"8px 12px",fontSize:13,borderRadius:9,border:`1.5px solid ${dark?MUN.greenDk:"#c8d8b8"}`,background:dark?"#1a1f24":"#f8faf4",color:dark?T.textMainDark:T.textMain,outline:"none",marginBottom:14,transition:"border .15s"});
const BS=(v="primary",dis=false,dark=false)=>{
  const base={display:"flex",alignItems:"center",gap:6,padding:"0 18px 0 10px",height:40,borderRadius:10,fontSize:13,fontWeight:700,cursor:dis?"not-allowed":"pointer",border:"none",transition:"all .15s",opacity:dis?.55:1,whiteSpace:"nowrap"};
  const vv={primary:{background:MUN.blue,color:"#fff",boxShadow:"3px 3px 0 0 "+MUN.blueDk},secondary:{background:dark?"#0a1e0a":"#eaf2ea",color:dark?MUN.gold:MUN.green,border:`1.5px solid ${dark?MUN.greenDk:"#b8d4b8"}`},success:{background:"#16a34a",color:"#fff",boxShadow:"3px 3px 0 0 #15803d"},danger:{background:"#dc2626",color:"#fff",boxShadow:"3px 3px 0 0 #b91c1c"},orange:{background:"#ea580c",color:"#fff",boxShadow:"3px 3px 0 0 #c2410c"},ghost:{background:"transparent",color:dark?"#8aab7a":"#4a6640",border:`1px solid ${dark?MUN.greenDk:"#c0d4b0"}`}};
  return{...base,...(vv[v]||vv.primary)};
};
const BtnIco=({emoji})=><span style={{fontSize:14,marginRight:2}}>{emoji}</span>;

function useDebounce(val,ms){const[d,setD]=useState(val);useEffect(()=>{const t=setTimeout(()=>setD(val),ms);return()=>clearTimeout(t);},[val,ms]);return d;}
function useToast(){
  const[ts,setTs]=useState([]);
  const toast=useCallback((msg,type="success")=>{const id=Date.now()+Math.random();setTs(p=>[...p,{id,msg,type}]);setTimeout(()=>setTs(p=>p.filter(t=>t.id!==id)),4200);},[]);
  return{toasts:ts,toast};
}
function Toast({toasts}){
  if(!toasts.length)return null;
  const bg={success:"#0d2318",error:"#450a0a",warn:"#451a03",info:"#0c1a3a"};
  const bd={success:"#16a34a",error:"#dc2626",warn:"#d97706",info:"#2563eb"};
  const cl={success:"#86efac",error:"#fca5a5",warn:"#fcd34d",info:"#93c5fd"};
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>{toasts.map(t=>(<div key={t.id} style={{padding:"12px 18px",borderRadius:10,fontSize:13,fontWeight:600,background:bg[t.type]||bg.success,color:cl[t.type]||cl.success,border:`1px solid ${bd[t.type]||bd.success}`,boxShadow:"0 8px 24px rgba(0,0,0,.4)",maxWidth:380}}>{t.msg}</div>))}</div>);
}

function KPICard({label,value,gradient,icon}){
  return(<div style={{background:gradient,borderRadius:14,padding:"16px 18px",color:"#fff",boxShadow:"0 4px 20px rgba(0,0,0,.15)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:-10,right:-10,width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,.12)"}}/><div style={{fontSize:22,marginBottom:4}}>{icon}</div><div style={{fontSize:22,fontWeight:800,lineHeight:1}}>{value}</div><div style={{fontSize:10.5,opacity:.8,marginTop:4,textTransform:"uppercase",letterSpacing:".05em"}}>{label}</div></div>);
}

function PageHeader({icon,title,sub,cor="#2563eb",dark,actions}){
  const cBg=dark?MUN.blue:"#f8faf4",bdr=dark?MUN.blueDk:"#c8d8b8";
  return(<div style={{background:cBg,borderBottom:`1.5px solid ${bdr}`,padding:"14px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,.18)",border:"1.5px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:21}}>{icon}</div><div><div style={{fontSize:16,fontWeight:800,color:dark?"#ffffff":"#0f172a"}}>{title}</div>{sub&&<div style={{fontSize:11.5,color:dark?"rgba(255,255,255,.7)":"#64748b",marginTop:1}}>{sub}</div>}</div></div>{actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}</div>);
}

function SH({icon,title,dark}){return(<div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10,marginTop:4}}><span style={{fontSize:14}}>{icon}</span><span style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:dark?MUN.gold:MUN.green}}>{title}</span><div style={{flex:1,height:1,background:dark?MUN.greenDk:"#c8d8b8",marginLeft:4}}/></div>);}

function SearchSelect({label,value,options=[],onChange,dark,required=false,placeholder="Selecione ou digite..."}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState("");const ref=useRef(null);
  const filtered=useMemo(()=>q.trim()?options.filter(o=>o.toLowerCase().includes(q.toLowerCase())):options,[options,q]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const choose=v=>{onChange(v);setQ("");setOpen(false);};
  const bdr=dark?"#1a4020":"#e2e8f0";
  return(<div ref={ref} style={{position:"relative",marginBottom:14}}>{label&&<label style={LS(dark)}>{label}{required&&" *"}</label>}<div onClick={()=>setOpen(o=>!o)} style={{...IS(dark),marginBottom:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",userSelect:"none"}}><span style={{color:value?(dark?"#e2e8f0":"#1e293b"):"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{value||placeholder}</span><span style={{fontSize:10,color:"#94a3b8",marginLeft:6}}>{open?"▲":"▼"}</span></div>{open&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:dark?"#1a1f24":"#fff",border:`1.5px solid ${dark?"#0030a0":"#bfdbfe"}`,borderRadius:8,marginTop:2,boxShadow:"0 8px 24px rgba(0,0,0,.18)",overflow:"hidden"}}><input value={q} onChange={e=>setQ(e.target.value)} autoFocus placeholder="Filtrar..." onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="Enter"&&filtered.length===1)choose(filtered[0]);}} style={{...IS(dark),marginBottom:0,borderRadius:0,border:"none",borderBottom:`1px solid ${bdr}`}}/><div style={{maxHeight:210,overflowY:"auto"}}>{filtered.length===0&&<div style={{padding:"10px 14px",fontSize:12,color:"#94a3b8"}}>Nenhum resultado</div>}{filtered.map(o=>(<div key={o} onMouseDown={()=>choose(o)} style={{padding:"9px 14px",fontSize:12.5,cursor:"pointer",color:dark?"#e2e8f0":"#1e293b",background:o===value?(dark?"#1a4020":"#eff6ff"):"transparent",borderBottom:`1px solid ${dark?"#0b2010":"#f8fafc"}`}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#1a4020":"#f0f9ff"} onMouseLeave={e=>e.currentTarget.style.background=o===value?(dark?"#1a4020":"#eff6ff"):"transparent"}>{o}</div>))}</div></div>)}</div>);
}

function FilterBadge({count,fonte,isFiltered}){if(!isFiltered)return null;return(<div style={{fontSize:9.5,color:"#7c3aed",fontWeight:700,marginBottom:4}}><span style={{background:"#f5f3ff",padding:"1px 7px",borderRadius:5,border:"1px solid #ddd6fe"}}>🔗 {count} filtradas · {String(fonte||"").slice(0,28)}</span></div>);}

function PeriodoInput({value,onChange,dark,style}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState(value||"");const ref=useRef(null);
  const sug=useMemo(()=>{const ms=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];const now=new Date();const res=[];for(let y=now.getFullYear();y>=now.getFullYear()-2;y--){for(let mi=11;mi>=0;mi--){const s=`${ms[mi]}/${y}`;if(!q.trim()||s.includes(q.toUpperCase()))res.push(s);if(res.length>=8)break;}if(res.length>=8)break;}return res;},[q]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const escolher=v=>{setQ(v);onChange(v);setOpen(false);};
  return(<div ref={ref} style={{position:"relative",width:"100%"}}><input value={q} onChange={e=>{setQ(e.target.value);onChange(e.target.value);setOpen(true);}} onFocus={()=>q.trim()&&setOpen(true)} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="Enter"&&sug.length===1)escolher(sug[0]);}} placeholder="Ex: MARÇO/2026" autoComplete="off" style={style}/>{open&&sug.length>0&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:dark?"#1a1f24":"#fff",border:`1.5px solid ${dark?"#7c3aed":"#a78bfa"}`,borderRadius:8,marginTop:2,boxShadow:"0 8px 24px rgba(0,0,0,.18)",overflow:"hidden"}}>{sug.map(s=>(<div key={s} onMouseDown={()=>escolher(s)} style={{padding:"8px 14px",fontSize:13,cursor:"pointer",color:dark?"#e2e8f0":"#1e293b",fontWeight:600,borderBottom:`1px solid ${dark?"#1a4020":"#f1f5f9"}`}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#1a4020":"#f5f3ff"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>📅 {s}</div>))}</div>)}</div>);
}

function ShortcutsModal({onClose,dark}){
  const bg=dark?"#111827":"#fff",bdr=dark?"#1a4020":"#e8ecf4",tc=dark?"#e2e8f0":"#1e293b";
  const atalhos=[["Ctrl+S","Salvar processo"],["Ctrl+P","Gerar PDF"],["Ctrl+W","Gerar Word"],["Ctrl+L","Limpar formulário"],["Ctrl+D","Duplicar último"],["?","Esta janela"],["Esc","Fechar dropdown"]];
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9997,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}><div style={{background:bg,borderRadius:16,padding:"26px 30px",maxWidth:400,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.35)",border:`1px solid ${bdr}`}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:15,fontWeight:800,color:tc}}>⌨️ Atalhos de Teclado</span><button onClick={onClose} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#64748b"}}>✕</button></div><div style={{display:"flex",flexDirection:"column",gap:7}}>{atalhos.map(([k,desc])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",borderRadius:8,background:dark?"#1a1f24":"#f8fafc",border:`1px solid ${bdr}`}}><span style={{fontSize:12.5,color:dark?"#94a3b8":"#64748b"}}>{desc}</span><kbd style={{background:dark?"#1a4020":"#e2e8f0",color:tc,padding:"2px 10px",borderRadius:6,fontSize:12,fontFamily:"monospace",fontWeight:700,border:`1px solid ${dark?"#0030a0":"#cbd5e1"}`}}>{k}</kbd></div>))}</div></div></div>);
}

function PdfInstrucoes({fileName,onClose}){
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:16,padding:"28px 32px",maxWidth:440,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.3)"}}><div style={{fontSize:36,textAlign:"center",marginBottom:12}}>📄</div><h3 style={{margin:"0 0 10px",textAlign:"center",color:"#0f172a",fontSize:16}}>Arquivo baixado!</h3><p style={{fontSize:13,color:"#64748b",lineHeight:1.7,marginBottom:18}}>O arquivo <b>{fileName}</b> foi baixado.<br/>Para converter em PDF:<br/>1. Abra no navegador<br/>2. Pressione <b>Ctrl+P</b><br/>3. Escolha <b>"Salvar como PDF"</b></p><button onClick={onClose} style={{...BS("primary",false,false),width:"100%",justifyContent:"center"}}><BtnIco emoji="✓"/>Entendido</button></div></div>);
}

const BRASAO_B64="data:image/png;base64,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";
function Brasao({size=56,style={}}){
  return(
    <img src={BRASAO_B64} alt="Brasão Gov. Edison Lobão"
      width={size} height={size}
      style={{objectFit:"contain",flexShrink:0,...style}}/>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────
function LoginPage({onLogin}){
  const[login,setLogin]=useState("");const[senha,setSenha]=useState("");
  const[loading,setLoading]=useState(false);const[erro,setErro]=useState("");
  const[tent,setTent]=useState(0);const[bloq,setBloq]=useState(false);const[count,setCount]=useState(0);
  useEffect(()=>{if(!bloq||count<=0)return;const t=setInterval(()=>setCount(c=>{if(c<=1){clearInterval(t);setBloq(false);return 0;}return c-1;}),1000);return()=>clearInterval(t);},[bloq,count]);
  const handle=async()=>{if(bloq)return;setLoading(true);setErro("");const u=await checkLogin(login.trim(),senha);setLoading(false);if(u){onLogin({...u,login:login.trim()});}else{const nt=tent+1;setTent(nt);if(nt>=5){setBloq(true);setCount(300);setErro("Muitas tentativas. Aguarde 5 minutos.");}else setErro(`Credenciais inválidas. Tentativa ${nt}/5.`);}};
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:MUN.green}}>
      <div style={{width:380,background:MUN.greenDk,borderRadius:20,padding:"40px 36px",boxShadow:"0 32px 80px rgba(0,0,0,.5)",border:"2px solid "+MUN.gold}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <Brasao size={72} style={{margin:"0 auto 14px"}}/>
          <div style={{fontSize:13,fontWeight:800,color:MUN.gold,letterSpacing:".03em"}}>PREFEITURA DE GOV. EDISON LOBÃO</div>
          <div style={{fontSize:11,color:"#4a6494",marginTop:4}}>Controladoria Geral — Sistema de Pagamentos</div>
        </div>
        {erro&&<div style={{background:"#450a0a",border:"1px solid #dc2626",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#fca5a5",fontWeight:600}}>⚠️ {erro}</div>}
        <label style={LS(true)}>Login</label>
        <input value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="admin" autoFocus style={{...IS(true),background:MUN.greenXdk,border:"1.5px solid "+MUN.goldDk}}/>
        <label style={LS(true)}>Senha</label>
        <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="••••••••" style={{...IS(true),background:MUN.greenXdk,border:"1.5px solid "+MUN.goldDk}}/>
        <button onClick={handle} disabled={loading||bloq} style={{...BS("primary",loading||bloq,true),width:"100%",justifyContent:"center",height:46,fontSize:14,marginTop:4}}>
          {bloq?`Aguarde ${Math.floor(count/60)}m${count%60}s…`:loading?"Verificando…":"→ Entrar"}
        </button>

      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage,user,onLogout,onSync,proxNum,dark,onToggleDark,formPct,syncStatus}){
  const isAdmin=user?.perfil==="admin";
  const nav=[
    {k:"processos",icon:"📄",label:"Novo Processo"},
    {k:"buscar",icon:"🔍",label:"Buscar & Editar"},
    {k:"dashboard",icon:"📊",label:"Dashboard"},
    {k:"historico",icon:"🕐",label:"Histórico"},
  ];
  const adm=[
    {k:"usuarios",icon:"👥",label:"Usuários"},
    {k:"orgaos",icon:"🏛️",label:"Órgãos"},
    {k:"config",icon:"⚙️",label:"Configurações"},
  ];
  const NavItem=({k,icon,label})=>{
    const active=page===k;
    return(
      <div onClick={()=>setPage(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",marginBottom:3,borderRadius:10,cursor:"pointer",transition:"all .15s",background:active?MUN.blue:"transparent",border:active?"1px solid "+MUN.blueDk:"1px solid transparent"}}>
        <span style={{fontSize:15,width:20,textAlign:"center"}}>{icon}</span>
        <span style={{fontSize:12.5,fontWeight:active?700:500,color:active?MUN.gold:"rgba(255,255,255,.55)"}}>{label}</span>
      </div>
    );
  };
  return(
    <div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",background:MUN.green,height:"100vh",position:"sticky",top:0,borderRight:"2px solid "+MUN.greenDk,overflowY:"auto",overflowX:"hidden"}}>
      <div style={{padding:"18px 16px 14px",borderBottom:"2px solid "+MUN.goldDk,textAlign:"center",background:MUN.greenDk}}>
        <Brasao size={52} style={{margin:"0 auto 10px"}}/>
        <div style={{fontSize:11,fontWeight:700,color:MUN.gold,lineHeight:1.4}}>CONTROLADORIA<br/>GERAL</div>
        <div style={{fontSize:9,color:MUN.gold,marginTop:3,opacity:.7}}>Pref. Gov. Edison Lobão / MA</div>
      </div>
      <div style={{margin:"10px 10px 0",padding:"8px 12px",background:"rgba(0,0,0,.2)",borderRadius:10,border:"1px solid rgba(255,255,255,.15)"}}>
        <div style={{fontSize:11.5,fontWeight:700,color:"#ffffff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.nome}</div>
        <div style={{fontSize:9.5,color:MUN.gold,textTransform:"uppercase",letterSpacing:".06em",fontWeight:600,marginTop:2}}>{user?.perfil}</div>
      </div>
      {page==="processos"&&(
        <div style={{margin:"8px 10px 0",padding:"8px 12px",background:"rgba(0,0,0,.2)",borderRadius:10,border:"1px solid rgba(255,255,255,.15)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:9,color:"rgba(255,255,255,.7)",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>Preenchimento</span>
            <span style={{fontSize:9,fontWeight:800,color:formPct===100?"#4ade80":formPct>60?MUN.gold:"#93c5fd"}}>{formPct}%</span>
          </div>
          <div style={{height:4,background:"rgba(255,255,255,.2)",borderRadius:4}}>
            <div style={{height:"100%",width:`${formPct}%`,borderRadius:4,transition:"width .4s",background:formPct===100?"#22c55e":formPct>60?MUN.gold:MUN.blue}}/>
          </div>
        </div>
      )}
      <div style={{margin:"8px 10px 0",padding:"8px 12px",background:MUN.blue,borderRadius:10,border:"1px solid "+MUN.blueDk,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:9.5,color:"rgba(255,255,255,.8)",fontWeight:700,textTransform:"uppercase"}}>Próximo Nº</span>
        <span style={{fontSize:18,fontWeight:800,color:MUN.gold}}>{proxNum||"—"}</span>
      </div>
      <div style={{padding:"10px 8px",flex:1}}>
        <div style={{fontSize:8.5,fontWeight:700,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".1em",padding:"4px 8px 6px"}}>Principal</div>
        {nav.map(n=><NavItem key={n.k} k={n.k} icon={n.icon} label={n.label}/>)}
        {isAdmin&&<>
          <div style={{height:1,background:"rgba(255,255,255,.2)",margin:"10px 4px 8px"}}/>
          <div style={{fontSize:8.5,fontWeight:700,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".1em",padding:"4px 8px 6px"}}>Admin</div>
          {adm.map(n=><NavItem key={n.k} k={n.k} icon={n.icon} label={n.label}/>)}
        </>}
      </div>
      <div style={{padding:"10px 10px 12px",borderTop:"2px solid "+MUN.greenDk,display:"flex",flexDirection:"column",gap:6,background:MUN.greenDk}}>
        {/* Indicador de banco compartilhado */}
        <div style={{padding:"7px 10px",borderRadius:8,background:
          syncStatus==="syncing"?"rgba(251,191,36,.15)":
          syncStatus==="updated"?"rgba(34,197,94,.15)":
          "rgba(0,64,224,.15)",
          border:`1px solid ${syncStatus==="syncing"?"#b45309":syncStatus==="updated"?"#16a34a":MUN.blueDk}`,
          display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:10,
            color:syncStatus==="syncing"?"#fbbf24":syncStatus==="updated"?"#4ade80":"#93c5fd",
            animation:syncStatus==="syncing"?"pulse 1s infinite":"none"}}>
            {syncStatus==="syncing"?"⏳":syncStatus==="updated"?"🔔":"🌐"}
          </span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:9.5,fontWeight:700,color:"rgba(255,255,255,.9)",
              whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {syncStatus==="syncing"?"Sincronizando...":syncStatus==="updated"?"Banco atualizado!":"Banco compartilhado"}
            </div>
            <div style={{fontSize:8.5,color:"rgba(255,255,255,.45)"}}>
              {syncStatus==="syncing"?"Aguarde":syncStatus==="updated"?"Dados de outro usuário":"Todos os usuários conectados"}
            </div>
          </div>
          <button onClick={onSync} title="Sincronizar manualmente" style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,opacity:.7,padding:2,flexShrink:0}}>🔄</button>
        </div>
        <button onClick={onLogout} style={{height:34,background:"#dc2626",border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>⏏ Sair</button>
        <button onClick={onToggleDark} style={{height:32,background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,color:"rgba(255,255,255,.8)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontWeight:600}}>
          {dark?"☀️ Modo Claro":"🌙 Modo Escuro"}
        </button>
        <div style={{fontSize:8,color:"rgba(255,255,255,.3)",textAlign:"center"}}>v3.0 · 2025</div>
      </div>
    </div>
  );
}

// ─── NovoProcessoPage ─────────────────────────────────────────────────────────
function NovoProcessoPage({processos,orgaosConfig,onSave,onSaveEdit,toast,dark,onPctChange,
                           duplicarData,onDuplicarConsumed,editarData,onEditarConsumed,
                           onPdfDownload,onShowShortcuts,appConfig}){
  const mp=useMemo(()=>buildMapData(processos),[processos]);
  const orgAtivos=useMemo(()=>mp.allOrgaos.filter(o=>orgaosConfig[o]?.ativo!==false),[mp,orgaosConfig]);

  const blankForm=useCallback(()=>({
    numDoc:String(proxNumero(processos)),dataDoc:todayISO(),periodo:"",
    orgao:"",secretario:"",fornecedor:"",cnpj:"",nomeFan:"",
    modalidade:"",contrato:"",ordemCompra:"",
    tipDoc:"",numNf:"",tipNf:"",valor:"",dataNf:todayISO(),
    objeto:"",dataAteste:todayISO(),decisao:"deferir",obs:"",notas:"",tipo:"padrao",
  }),[processos]);

  const formFromRow=useCallback((row)=>({
    numDoc:String(proxNumero(processos)),dataDoc:todayISO(),
    periodo:row["PERÍODO DE REFERÊNCIA"]||"",orgao:row["ORGÃO"]||"",
    secretario:row["SECRETARIO"]||"",fornecedor:row["FORNECEDOR"]||"",
    cnpj:row["CNPJ"]||"",nomeFan:row["NOME FANTASIA"]||"",
    modalidade:row["MODALIDADE"]||"",contrato:row["CONTRATO"]||"",
    ordemCompra:row["N° ORDEM DE COMPRA"]||"",tipDoc:row["DOCUMENTO FISCAL"]||"",
    numNf:row["Nº"]||"",tipNf:row["TIPO"]||"",valor:"",dataNf:todayISO(),
    objeto:row["OBJETO"]||"",dataAteste:todayISO(),
    decisao:"deferir",obs:"",notas:"",tipo:"padrao",
  }),[processos]);

  const[form,setForm]=useState(blankForm);
  const[chks,setChks]=useState({});
  const[tab,setTab]=useState(0);
  const[editMode,setEditMode]=useState(null);
  const[modMode,setModMode]=useState("forn");
  const[contMode,setContMode]=useState("forn");
  const[objMode,setObjMode]=useState("historico");
  const[loading,setLoading]=useState(false);
  const[pdfBlob,setPdfBlob]=useState(null);
  const[pdfName,setPdfName]=useState("");
  const[compact,setCompact]=useState(false);
  const[draftSaved,setDraftSaved]=useState(null);
  const[cnpjErro,setCnpjErro]=useState("");

  const upd=f=>v=>setForm(p=>({...p,[f]:v}));

  // Quando o banco atualiza (outro usuário salvou), recalcula o Nº sugerido
  // Só atualiza se o formulário está vazio (não tiver dados preenchidos) e não está em modo edição
  useEffect(()=>{
    if(editMode)return;
    setForm(p=>{
      // Só recalcula se o campo numDoc é o número que calculamos (não foi editado manualmente
      // para um valor diferente do próximo esperado)
      const proxAtual=proxNumero(processos);
      const numAtual=parseInt(p.numDoc,10);
      // Se o número atual já existe na lista atualizada, oferece o próximo disponível
      if(numExiste(processos,p.numDoc)){
        return {...p, numDoc:String(proxAtual)};
      }
      return p;
    });
  },[processos,editMode]);

  useEffect(()=>{
    if(!duplicarData)return;
    setForm(formFromRow(duplicarData));setChks({});setPdfBlob(null);setTab(0);setEditMode(null);
    if(onDuplicarConsumed)onDuplicarConsumed();
  },[duplicarData]);

  useEffect(()=>{
    if(!editarData)return;
    const row=editarData;
    // Normaliza qualquer formato de data para ISO YYYY-MM-DD (requerido pelo input type=date)
    const toISO=v=>{
      if(!v)return todayISO();
      if(v instanceof Date){const d=v;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
      const br=formatData(v); // garante formato DD/MM/YYYY
      if(/^\d{2}\/\d{2}\/\d{4}$/.test(br)){const[dd,mm,yyyy]=br.split("/");return `${yyyy}-${mm}-${dd}`;}
      if(/^\d{4}-\d{2}-\d{2}/.test(String(v)))return String(v).slice(0,10);
      return todayISO();
    };
    setForm({
      numDoc:row["NÚMERO DO DOCUMENTO"]||"",dataDoc:toISO(row["DATA"]),
      periodo:row["PERÍODO DE REFERÊNCIA"]||"",orgao:row["ORGÃO"]||"",
      secretario:row["SECRETARIO"]||"",fornecedor:row["FORNECEDOR"]||"",
      cnpj:row["CNPJ"]||"",nomeFan:row["NOME FANTASIA"]||"",
      modalidade:row["MODALIDADE"]||"",contrato:row["CONTRATO"]||"",
      ordemCompra:row["N° ORDEM DE COMPRA"]||"",tipDoc:row["DOCUMENTO FISCAL"]||"",
      numNf:row["Nº"]||"",tipNf:row["TIPO"]||"",valor:row["VALOR"]||"",
      dataNf:toISO(row["DATA NF"]),objeto:row["OBJETO"]||"",
      dataAteste:toISO(row["DATA"]),
      decisao:row["_decisao"]||"deferir",obs:row["_obs"]||"",notas:row["NOTAS"]||"",
      tipo:row["_tipoKey"]||"padrao",
    });
    setChks({});setPdfBlob(null);setTab(0);
    setEditMode(row["NÚMERO DO DOCUMENTO"]||null);
    if(onEditarConsumed)onEditarConsumed();
  },[editarData]);

  useEffect(()=>{
    const t=setInterval(async()=>{
      if(editMode)return;
      if(form.orgao||form.fornecedor||form.objeto){
        await ST.set("draft_form",form);
        setDraftSaved(new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}));
      }
    },30000);
    return()=>clearInterval(t);
  },[form,editMode]);

  useEffect(()=>{
    if(editarData)return;
    ST.get("draft_form").then(d=>{if(d&&(d.orgao||d.fornecedor))setForm(p=>({...p,...d}));});
  },[]);

  const pct=useMemo(()=>{
    const req=["numDoc","orgao","fornecedor","cnpj","valor","objeto"];
    return Math.round(req.filter(k=>form[k]).length/req.length*100);
  },[form]);
  useEffect(()=>onPctChange(pct),[pct,onPctChange]);

  useEffect(()=>{
    const h=e=>{
      if(e.ctrlKey||e.metaKey){
        if(e.key==="s"||e.key==="S"){e.preventDefault();handleSalvar();}
        if(e.key==="p"||e.key==="P"){e.preventDefault();handleGerarPDF();}
        if(e.key==="w"||e.key==="W"){e.preventDefault();handleGerarWord();}
        if(e.key==="l"||e.key==="L"){e.preventDefault();handleLimpar();}
        if(e.key==="d"||e.key==="D"){e.preventDefault();handleDuplicarUltimo();}
      }
      if(e.key==="?"&&!e.ctrlKey&&!e.metaKey){e.preventDefault();onShowShortcuts&&onShowShortcuts();}
    };
    document.addEventListener("keydown",h);
    return()=>document.removeEventListener("keydown",h);
  },[form]);

  const onOrgChange=v=>setForm(f=>({...f,orgao:v,secretario:f.secretario||mp.orgaoSecretario[v]||"",contrato:f.contrato||mp.orgaoContrato[v]||"",modalidade:f.modalidade||mp.orgaoModalidade[v]||""}));
  const onFornChange=v=>setForm(f=>({...f,fornecedor:v,cnpj:f.cnpj||mp.fornCnpj[v]||"",objeto:f.objeto||mp.fornObjeto[v]||"",modalidade:f.modalidade||mp.fornModalidade[v]||"",contrato:f.contrato||mp.fornContrato[v]||""}));
  const onCnpjChange=v=>{const m=mascararCnpjCpf(v);setForm(f=>({...f,cnpj:m,fornecedor:f.fornecedor||mp.cnpjForn[v]||""}));setCnpjErro(validarCnpjCpf(m)?"":"Formato inválido (11 dígitos CPF ou 14 CNPJ)");};
  const onObjChange=v=>setForm(f=>({...f,objeto:v,modalidade:f.modalidade||mp.objModalidade[v]||"",contrato:f.contrato||mp.objContrato[v]||""}));
  const onModalChange=v=>setForm(f=>({...f,modalidade:v,contrato:f.contrato||mp.modalContrato[v]||""}));

  const getChks=t=>{const n=CHK[t]?.length||0;const c=chks[t];return c&&c.length===n?c:Array(n).fill(true);};
  const setChk=(t,i,v)=>{const arr=[...getChks(t)];arr[i]=v;setChks(p=>({...p,[t]:arr}));};

  const mFF=form.fornecedor?(mp.fornModalidadesList[form.fornecedor]||[]):[];
  const mShow=modMode==="forn"&&mFF.length?mFF:mp.allModalidades;
  const mFiltered=modMode==="forn"&&Boolean(mFF.length);
  const cFF=form.fornecedor?(mp.fornContratosList[form.fornecedor]||[]):[];
  const cShow=contMode==="forn"&&cFF.length?cFF:mp.allContratos;
  const cFiltered=contMode==="forn"&&Boolean(cFF.length);
  const oFF=form.fornecedor?(mp.fornObjetosList[form.fornecedor]||[]):[];
  const oShow=objMode==="historico"&&oFF.length?oFF:mp.allObjsHist;
  const secSug=form.orgao&&!form.secretario?mp.orgaoSecretario[form.orgao]:"";
  const secsOpts=mp.allSecretarios;

  const checarDuplicata=num=>{
    if(!num||editMode)return false;
    const n=parseInt(num,10);return processos.some(p=>parseInt(String(p["NÚMERO DO DOCUMENTO"]||""),10)===n);
  };

  const makeDados=()=>{
    // data_nf: formato curto DD/MM/YYYY para a capa
    const dataNfFmt = formatData(form.dataNf) || formatData(new Date());
    // data_ateste: sempre extenso "DD de MÊS de AAAA" para assinatura e capa
    const dataAtesteRaw = form.dataAteste || form.dataDoc;
    const dataAtesteExt = dtExt(dataAtesteRaw) || dtExt(new Date());
    return {
      processo:form.numDoc,orgao:form.orgao,secretario:form.secretario,
      fornecedor:form.fornecedor,cnpj:form.cnpj,nf:form.numNf,
      contrato:form.contrato,modalidade:form.modalidade,periodo_ref:form.periodo,
      ordem_compra:form.ordemCompra,
      data_nf:dataNfFmt,
      data_ateste:dataAtesteExt,
      objeto:form.objeto,valor:form.valor,tipo_doc:form.tipDoc,tipo_nf:form.tipNf,obs:form.obs,
      controlador:appConfig?.controlador||{},
    };
  };

  const handleGerarPDF=async()=>{
    if(loading)return;setLoading(true);
    try{
      const t=form.tipo,s=getChks(t);
      const r=await gerarPDF(makeDados(),t,form.decisao==="deferir",CHK[t],s);
      if(r.error){toast(`❌ PDF: ${r.error}`,"error");return;}
      setPdfBlob(r.blob);setPdfName(r.name||"documento.pdf");
      if(onPdfDownload)onPdfDownload(r.blob,r.name);
      else{const url=URL.createObjectURL(r.blob);const a=document.createElement("a");a.href=url;a.download=r.name;document.body.appendChild(a);a.click();setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2000);toast("✅ PDF gerado!");}
    }finally{setLoading(false);}
  };

  const handleGerarWord=async()=>{
    if(loading)return;setLoading(true);
    try{
      const t=form.tipo,s=getChks(t);
      await gerarWordDoc(makeDados(),t,form.decisao==="deferir",CHK[t],s);
      toast("✅ Word gerado!");
    }catch(err){toast(`❌ Word: ${err.message}`,"error");}
    finally{setLoading(false);}
  };

  const handleSalvar=async()=>{
    if(!form.orgao||!form.fornecedor||!form.valor){toast("Preencha Órgão, Fornecedor e Valor.","error");return;}
    if(cnpjErro){toast("Corrija o CNPJ/CPF antes de salvar.","error");return;}
    // Nota: conflito de número em uso simultâneo é resolvido automaticamente pelo onSave (lock otimista).
    // O aviso local checarDuplicata ainda aparece no campo mas não bloqueia o salvamento.
    setLoading(true);
    try{
      const row={
        "NÚMERO DO DOCUMENTO":form.numDoc,"DATA":form.dataDoc,
        "PERÍODO DE REFERÊNCIA":form.periodo,"ORGÃO":form.orgao,
        "SECRETARIO":form.secretario,"FORNECEDOR":form.fornecedor,
        "CNPJ":form.cnpj,"NOME FANTASIA":form.nomeFan,
        "MODALIDADE":form.modalidade,"CONTRATO":form.contrato,
        "N° ORDEM DE COMPRA":form.ordemCompra,"DOCUMENTO FISCAL":form.tipDoc,
        "Nº":form.numNf,"TIPO":form.tipNf,"VALOR":form.valor,
        "DATA NF":form.dataNf,"OBJETO":form.objeto,"NOTAS":form.notas,
      };
      if(editMode){await onSaveEdit(row,form,editMode);setEditMode(null);}
      else{
        const proximoNum=await onSave(row,form);
        await ST.del("draft_form");setDraftSaved(null);
        setForm(p=>({...blankForm(),numDoc:String(proximoNum||proxNumero(processos))}));
        setChks({});setPdfBlob(null);setTab(0);
        return;
      }
      await ST.del("draft_form");setDraftSaved(null);
      setForm(blankForm());setChks({});setPdfBlob(null);setTab(0);
    }finally{setLoading(false);}
  };

  const handleDL=()=>{
    if(!pdfBlob)return;
    const url=URL.createObjectURL(pdfBlob);const a=document.createElement("a");
    a.href=url;a.download=pdfName||"documento.pdf";
    document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2000);
    toast("✅ PDF baixado!");
  };

  const handleLimpar=()=>{
    if(!window.confirm("Limpar todos os campos?"))return;
    setForm(blankForm());setChks({});setPdfBlob(null);
    ST.del("draft_form");setDraftSaved(null);setEditMode(null);
    toast("🗑️ Formulário limpo.");
  };

  const ultimoProcesso=processos[0]||null;
  const handleDuplicarUltimo=()=>{
    if(!ultimoProcesso){toast("Nenhum processo salvo.","warn");return;}
    setForm(formFromRow(ultimoProcesso));setChks({});setPdfBlob(null);setTab(0);
    toast(`📋 Duplicado: ${ultimoProcesso["NÚMERO DO DOCUMENTO"]}`);
  };

  const ti=TINFO[form.tipo];
  const chkItems=CHK[form.tipo]||[];
  const sits=getChks(form.tipo);
  const pctChk=chkItems.length?Math.round(sits.filter(Boolean).length/chkItems.length*100):100;
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg;
  const bdr=dark?T.borderDark:T.border,tc=dark?T.textMainDark:T.textMain;
  const iStyle=IS(dark);
  const tabSt=i=>({padding:"9px 16px",fontSize:12.5,fontWeight:600,cursor:"pointer",border:"none",background:"transparent",borderBottom:`2px solid ${tab===i?"#3b6ef8":"transparent"}`,color:tab===i?"#3b6ef8":"#9ca3af",transition:"color .15s"});

  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon={ti?.icon||"📄"}
        title={editMode?`✏️ Editando Processo #${editMode}`:"Novo Processo"}
        sub={editMode?"Alterações substituirão o registro original":"Preencha os dados e gere os documentos"}
        dark={dark}
        actions={<>
          {editMode&&<button onClick={()=>{setEditMode(null);setForm(blankForm());setChks({});setPdfBlob(null);}} style={{...BS("ghost",false,dark),height:34,fontSize:11}}>✕ Cancelar Edição</button>}
          <button onClick={handleDuplicarUltimo} disabled={!ultimoProcesso} style={{...BS("secondary",!ultimoProcesso,dark),height:34,fontSize:11}}><BtnIco emoji="⧉"/>Duplicar Último</button>
          <button onClick={()=>onShowShortcuts&&onShowShortcuts()} style={{...BS("ghost",false,dark),height:34,fontSize:11}}>⌨️ Atalhos</button>
        </>}/>
      <div style={{padding:"16px 22px"}}>
        {draftSaved&&<div style={{fontSize:10.5,color:dark?"#3d5a85":"#94a3b8",marginBottom:10,display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",display:"inline-block"}}/>Rascunho salvo às {draftSaved}</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
          <KPICard label="Processos" value={processos.length.toLocaleString()} gradient={T.kpi2} icon="📄"/>
          <KPICard label="Órgãos" value={mp.allOrgaos.length} gradient={T.kpi1} icon="🏛️"/>
          <KPICard label="Credores" value={mp.allFornecedores.length} gradient={T.kpi5} icon="🏢"/>
          <KPICard label="Próximo Nº" value={proxNumero(processos)} gradient={T.kpi4} icon="🔢"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
          {Object.entries(TINFO).map(([tk,ti2])=>{
            const act=form.tipo===tk;
            return(<div key={tk} onClick={()=>setForm(f=>({...f,tipo:tk}))} style={{border:`1.5px solid ${act?ti2.cor:bdr}`,background:act?ti2.cor+"12":cardBg,borderRadius:10,padding:"10px 12px",textAlign:"center",cursor:"pointer",transition:"all .15s",position:"relative",overflow:"hidden"}}>
              {act&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:ti2.cor}}/>}
              <div style={{fontSize:compact?16:20,marginBottom:4}}>{ti2.icon}</div>
              <div style={{fontSize:11,fontWeight:act?700:500,color:act?ti2.cor:(dark?"#4a6494":"#64748b"),lineHeight:1.3}}>{ti2.label}</div>
            </div>);
          })}
        </div>
        <div style={{background:cardBg,borderRadius:14,border:`1px solid ${bdr}`,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${bdr}`,padding:"0 16px"}}>
            <div style={{display:"flex"}}>
              {["🏢 Dados","📜 Contrato","✅ Ateste"].map((t,i)=>(<button key={i} style={tabSt(i)} onClick={()=>setTab(i)}>{t}</button>))}
            </div>
            <button onClick={()=>setCompact(c=>!c)} style={{...BS("ghost",false,dark),height:30,fontSize:11,padding:"0 10px"}}>{compact?"↕ Normal":"↔ Compacto"}</button>
          </div>
          <div style={{padding:compact?"12px 16px":"20px 24px"}}>
            {tab===0&&<>
              <SH icon="🔢" title="Identificação" dark={dark}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <label style={LS(dark)}>Nº Documento *</label>
                  <input value={form.numDoc} onChange={e=>upd("numDoc")(e.target.value)}
                    style={{...iStyle, borderColor: checarDuplicata(form.numDoc)?"#f59e0b":undefined}}/>
                  {checarDuplicata(form.numDoc)&&!editMode&&(
                    <div style={{fontSize:10.5,color:"#d97706",marginTop:-10,marginBottom:8,
                      display:"flex",alignItems:"center",gap:4}}>
                      ⚠️ Número já existe localmente — ao salvar, será atribuído o próximo disponível automaticamente.
                    </div>
                  )}
                </div>
                <div><label style={LS(dark)}>Data *</label><input type="date" value={form.dataDoc} onChange={e=>upd("dataDoc")(e.target.value)} style={iStyle}/></div>
                <div><label style={LS(dark)}>Período Ref.</label><PeriodoInput value={form.periodo} onChange={upd("periodo")} dark={dark} style={{...iStyle,marginBottom:0}}/></div>
              </div>
              <SH icon="🏛️" title="Órgão e Secretaria" dark={dark}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <SearchSelect label="Órgão / Secretaria" required value={form.orgao} options={orgAtivos} onChange={onOrgChange} dark={dark}/>
                <div>
                  {secSug&&<div style={{fontSize:9.5,color:"#3b6ef8",fontWeight:600,marginBottom:4}}>💡 Sugestão: <b>{secSug.slice(0,45)}</b></div>}
                  <SearchSelect label="Secretário(a)" value={form.secretario} options={secsOpts} onChange={v=>setForm(f=>({...f,secretario:v}))} dark={dark}/>
                </div>
              </div>
              <SH icon="🏢" title="Credor / Fornecedor" dark={dark}/>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr",gap:14}}>
                <SearchSelect label="Credor *" required value={form.fornecedor} options={mp.allFornecedores} onChange={onFornChange} dark={dark}/>
                <div>
                  <label style={LS(dark)}>CNPJ / CPF *</label>
                  <input value={form.cnpj} onChange={e=>onCnpjChange(e.target.value)} placeholder="00.000.000/0001-00" style={iStyle}/>
                  {cnpjErro&&<div style={{fontSize:10.5,color:"#dc2626",marginTop:-10,marginBottom:8}}>⚠️ {cnpjErro}</div>}
                </div>
                <div><label style={LS(dark)}>Nome Fantasia</label><input value={form.nomeFan} onChange={e=>upd("nomeFan")(e.target.value)} placeholder="Opcional" style={iStyle}/></div>
              </div>
            </>}
            {tab===1&&<>
              <SH icon="📜" title="Licitação" dark={dark}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                <div>
                  <FilterBadge count={mShow.length} fonte={form.fornecedor} isFiltered={mFiltered}/>
                  <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
                    <div style={{flex:1}}><SearchSelect label="Modalidade" value={form.modalidade} options={mShow} onChange={onModalChange} dark={dark}/></div>
                    <button onClick={()=>setModMode(m=>m==="forn"?"todos":"forn")} style={{width:38,height:38,flexShrink:0,background:dark?"#1a1f24":"#f1f5f9",border:`1.5px solid ${bdr}`,borderRadius:8,cursor:"pointer",fontSize:16,marginBottom:14}}>{modMode==="forn"?"📂":"🏢"}</button>
                  </div>
                </div>
                <div>
                  <FilterBadge count={cShow.length} fonte={form.fornecedor} isFiltered={cFiltered}/>
                  <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
                    <div style={{flex:1}}><SearchSelect label="Nº Contrato" value={form.contrato} options={cShow} onChange={v=>setForm(f=>({...f,contrato:v}))} dark={dark}/></div>
                    <button onClick={()=>setContMode(m=>m==="forn"?"todos":"forn")} style={{width:38,height:38,flexShrink:0,background:dark?"#1a1f24":"#f1f5f9",border:`1.5px solid ${bdr}`,borderRadius:8,cursor:"pointer",fontSize:16,marginBottom:14}}>{contMode==="forn"?"📂":"🏢"}</button>
                  </div>
                </div>
                <div><label style={LS(dark)}>Ordem de Compra</label><input value={form.ordemCompra} onChange={e=>upd("ordemCompra")(e.target.value)} placeholder="Opcional" style={iStyle}/></div>
              </div>
              <SH icon="🧾" title="Documento Fiscal" dark={dark}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:14}}>
                <SearchSelect label="Tipo Doc. Fiscal" value={form.tipDoc} options={mp.allDocFiscais} onChange={v=>setForm(f=>({...f,tipDoc:v}))} dark={dark}/>
                <div><label style={LS(dark)}>Nº NF</label><input value={form.numNf} onChange={e=>upd("numNf")(e.target.value)} placeholder="229" style={iStyle}/></div>
                <SearchSelect label="Tipo NF" value={form.tipNf} options={mp.allTiposNf} onChange={v=>setForm(f=>({...f,tipNf:v}))} dark={dark}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div>
                  <label style={LS(dark)}>Valor (R$) *</label>
                  <input value={form.valor} onChange={e=>upd("valor")(e.target.value)} onBlur={e=>upd("valor")(formatValor(e.target.value))} placeholder="43.088,62" style={iStyle}/>
                </div>
                <div><label style={LS(dark)}>Data NF</label><input type="date" value={form.dataNf} onChange={e=>upd("dataNf")(e.target.value)} style={iStyle}/></div>
              </div>
            </>}
            {tab===2&&<>
              <SH icon="📝" title="Objeto" dark={dark}/>
              <div style={{marginBottom:14}}>
                <FilterBadge count={oShow.length} fonte={form.fornecedor} isFiltered={objMode==="historico"&&Boolean(oFF.length)}/>
                <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
                  <div style={{flex:1}}><SearchSelect label="Objeto *" value={form.objeto} options={oShow} onChange={onObjChange} dark={dark}/></div>
                  <button onClick={()=>setObjMode(m=>m==="historico"?"todos":"historico")} style={{width:38,height:38,flexShrink:0,background:dark?"#1a1f24":"#f1f5f9",border:`1.5px solid ${bdr}`,borderRadius:8,cursor:"pointer",fontSize:16,marginBottom:14}}>{objMode==="historico"?"📂":"🏢"}</button>
                </div>
              </div>
              <SH icon="📅" title="Ateste e Decisão" dark={dark}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div><label style={LS(dark)}>Data Ateste</label><input type="date" value={form.dataAteste} onChange={e=>upd("dataAteste")(e.target.value)} style={iStyle}/></div>
                <div>
                  <label style={LS(dark)}>Decisão</label>
                  <div style={{display:"flex",gap:16,height:38,alignItems:"center"}}>
                    {[["deferir","✅ Deferir","#16a34a"],["indeferir","❌ Indeferir","#dc2626"]].map(([v,l,c])=>(
                      <label key={v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontWeight:form.decisao===v?700:400,color:form.decisao===v?c:tc,fontSize:13}}>
                        <input type="radio" value={v} checked={form.decisao===v} onChange={()=>setForm(f=>({...f,decisao:v}))}/>{l}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div><label style={LS(dark)}>Observação (aparece no PDF)</label><textarea value={form.obs} onChange={e=>upd("obs")(e.target.value)} rows={3} style={{...iStyle,height:"auto",resize:"vertical"}}/></div>
                <div><label style={LS(dark)}>📌 Notas Internas</label><textarea value={form.notas} onChange={e=>upd("notas")(e.target.value)} placeholder="Não aparecem no PDF" rows={3} style={{...iStyle,height:"auto",resize:"vertical",borderColor:dark?"#3b4f6b":"#fde68a",background:dark?"#1a1f24":"#fffbeb"}}/></div>
              </div>
              <div style={{background:dark?"#1a1f24":"#f8faff",borderRadius:12,padding:"14px 16px",border:`1px solid ${bdr}`}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:tc}}>☑ Checklist — {ti.label}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {chkItems.map((item,i)=>(
                    <label key={`${form.tipo}-${i}`} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12.5,marginBottom:4,color:tc}}>
                      <input type="checkbox" checked={sits[i]} onChange={e=>setChk(form.tipo,i,e.target.checked)} style={{width:14,height:14,flexShrink:0,accentColor:"#3b6ef8"}}/>{item}
                    </label>
                  ))}
                </div>
                <div style={{marginTop:10}}>
                  <div style={{height:4,background:dark?"#1a4020":"#e2e8f0",borderRadius:4}}>
                    <div style={{height:"100%",width:`${pctChk}%`,borderRadius:4,transition:"width .3s",background:pctChk===100?"#16a34a":"#f59e0b"}}/>
                  </div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:3}}>{sits.filter(Boolean).length}/{chkItems.length} itens verificados</div>
                </div>
              </div>
            </>}
          </div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={handleGerarPDF} disabled={loading} style={{...BS("primary",loading,dark),flex:"1 1 130px"}}><BtnIco emoji={loading?"⏳":"📄"}/>{loading?"Gerando...":"Gerar PDF"}</button>
          <button onClick={handleGerarWord} disabled={loading} style={{...BS("orange",loading,dark),flex:"1 1 130px"}}><BtnIco emoji={loading?"⏳":"📝"}/>{loading?"Gerando...":"Gerar Word"}</button>
          <button onClick={handleSalvar} disabled={loading} style={{...BS("success",loading,dark),flex:"1 1 130px"}}><BtnIco emoji={loading?"⏳":"💾"}/>{loading?"Salvando...":(editMode?"Salvar Edição":"Salvar")}</button>
          <button onClick={handleDL} disabled={!pdfBlob} style={{...BS(pdfBlob?"secondary":"ghost",!pdfBlob,dark),flex:"1 1 100px"}}><BtnIco emoji="🖨️"/>Imprimir</button>
          <button onClick={handleLimpar} style={{...BS("ghost",false,dark),flex:"0 0 auto"}}><BtnIco emoji="🗑️"/>Limpar</button>
        </div>
      </div>
    </div>
  );
}

// ─── BuscarPage ───────────────────────────────────────────────────────────────
function BuscarPage({processos,onCarregar,onEditar,onGerarPDF,toast,dark}){
  const[q,setQ]=useState("");const[sort,setSort]=useState({col:"NÚMERO DO DOCUMENTO",dir:1});const[lPDF,setLPDF]=useState(null);
  const dq=useDebounce(q,300);
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg,bdr=dark?T.borderDark:T.border,tc=dark?T.textMainDark:T.textMain;
  const filtered=useMemo(()=>{
    let r=processos;
    if(dq.trim()){const ql=dq.toLowerCase();r=r.filter(p=>["NÚMERO DO DOCUMENTO","FORNECEDOR","ORGÃO","OBJETO","CONTRATO"].some(c=>String(p[c]||"").toLowerCase().includes(ql)));}
    return[...r].sort((a,b)=>String(a[sort.col]||"").localeCompare(String(b[sort.col]||""),"pt-BR")*sort.dir);
  },[processos,dq,sort]);
  const limitado=filtered.length>100;
  const exibidos=filtered.slice(0,100);
  const cols=["NÚMERO DO DOCUMENTO","ORGÃO","FORNECEDOR","VALOR","DATA","OBJETO"];
  const colLabel=c=>c==="NÚMERO DO DOCUMENTO"?"Nº DOC":c;
  const toggleSort=col=>setSort(s=>s.col===col?{col,dir:s.dir*-1}:{col,dir:1});
  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="🔍" title="Buscar & Editar" sub="Pesquise, edite e gere PDFs" dark={dark}/>
      <div style={{padding:"20px 24px"}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔎  Nº, fornecedor, órgão, objeto..." style={{...IS(dark),marginBottom:16,fontSize:14,padding:"10px 14px"}}/>
        {limitado&&<div style={{fontSize:11.5,color:"#d97706",fontWeight:600,marginBottom:10,padding:"8px 12px",background:"#451a03",borderRadius:8,border:"1px solid #92400e"}}>⚠️ Exibindo 100 de {filtered.length} resultados. Refine a busca para ver mais.</div>}
        <div style={{background:cardBg,borderRadius:12,border:`1.5px solid ${bdr}`,overflow:"hidden",marginBottom:12}}>
          <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
              <thead style={{position:"sticky",top:0,background:dark?"#0d1117":"#f2f7ee",zIndex:1}}>
                <tr style={{borderBottom:`1.5px solid ${bdr}`}}>
                  {cols.map(c=>(<th key={c} onClick={()=>toggleSort(c)} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#475569",whiteSpace:"nowrap",fontSize:11,textTransform:"uppercase",letterSpacing:".06em",cursor:"pointer",userSelect:"none",background:sort.col===c?(dark?"#2d1f4e":"#f5f3ff"):"transparent"}}>{colLabel(c)} {sort.col===c?(sort.dir===1?"↑":"↓"):""}</th>))}
                  <th style={{padding:"10px 12px",width:200,textAlign:"center",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase"}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {exibidos.length===0?<tr><td colSpan={cols.length+1} style={{padding:"24px",textAlign:"center",color:"#94a3b8"}}>Nenhum resultado</td></tr>
                :exibidos.map((p,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${bdr}`,background:i%2===0?cardBg:(dark?"#1e242c":"#fafbfc")}}
                    onMouseEnter={e=>e.currentTarget.style.background=dark?"#1a4020":"#eff6ff"}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?cardBg:(dark?"#1e242c":"#fafbfc")}>
                    {cols.map(c=>(<td key={c} style={{padding:"9px 12px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:tc}}>{String(p[c]||"").slice(0,60)}</td>))}
                    <td style={{padding:"6px 10px"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                        {onGerarPDF&&<button onClick={async()=>{if(lPDF!==null)return;setLPDF(i);try{await onGerarPDF(p,{_dummy:true});}finally{setLPDF(null);}}} disabled={lPDF!==null} style={{...BS("danger",lPDF!==null,dark),height:32,fontSize:11,padding:"0 10px 0 5px"}}><BtnIco emoji={lPDF===i?"⏳":"📄"}/>{lPDF===i?"...":"PDF"}</button>}
                        <button onClick={()=>onEditar&&onEditar(p)} style={{...BS("orange",false,dark),height:32,fontSize:11,padding:"0 12px 0 5px"}}><BtnIco emoji="✏️"/>Editar</button>
                        <button onClick={()=>onCarregar(p)} style={{...BS("secondary",false,dark),height:32,fontSize:11,padding:"0 10px 0 5px"}}><BtnIco emoji="⧉"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{fontSize:11,color:"#94a3b8"}}>Exibindo {exibidos.length} de {filtered.length} · Total: {processos.length}</div>
      </div>
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────
function DashboardPage({processos,dark}){
  const[filtOrg,setFiltOrg]=useState("");const[filtAno,setFiltAno]=useState("");
  const mp=useMemo(()=>buildMapData(processos),[processos]);
  const anos=useMemo(()=>{const s=new Set();processos.forEach(p=>{const d=String(p["DATA"]||"");const m=d.match(/\d{4}/);if(m)s.add(m[0]);});return[...s].sort().reverse();},[processos]);
  const filtered=useMemo(()=>processos.filter(p=>{if(filtOrg&&p["ORGÃO"]!==filtOrg)return false;if(filtAno&&!String(p["DATA"]||"").includes(filtAno))return false;return true;}),[processos,filtOrg,filtAno]);
  const porMes=useMemo(()=>{const m={};filtered.forEach(p=>{const d=String(p["DATA"]||"").slice(0,7);if(d&&d!=="NaT")m[d]=(m[d]||0)+1;});return Object.entries(m).sort(([a],[b])=>a<b?-1:1).slice(-12).map(([mes,n])=>({mes,n}));},[filtered]);
  const topOrg=useMemo(()=>{const m={};filtered.forEach(p=>{const o=String(p["ORGÃO"]||"").trim();if(o)m[o]=(m[o]||0)+1;});return Object.entries(m).sort(([,a],[,b])=>b-a).slice(0,8).map(([o,n])=>({orgao:o.slice(0,32),n}));},[filtered]);
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg,bdr=dark?T.borderDark:T.border;
  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="📊" title="Dashboard" sub="Visão analítica" cor="#4d7cfe" dark={dark}/>
      <div style={{padding:"20px 24px"}}>
        <div style={{background:cardBg,borderRadius:12,border:`1.5px solid ${bdr}`,padding:"14px 20px",marginBottom:20,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#64748b"}}>🔍 Filtrar:</span>
          <select value={filtOrg} onChange={e=>setFiltOrg(e.target.value)} style={{...IS(dark),width:"auto",minWidth:180,padding:"6px 10px",marginBottom:0}}>
            <option value="">Todos os órgãos</option>
            {mp.allOrgaos.map(o=><option key={o} value={o}>{o.slice(0,50)}</option>)}
          </select>
          <select value={filtAno} onChange={e=>setFiltAno(e.target.value)} style={{...IS(dark),width:"auto",minWidth:100,padding:"6px 10px",marginBottom:0}}>
            <option value="">Todos os anos</option>
            {anos.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          {(filtOrg||filtAno)&&<button onClick={()=>{setFiltOrg("");setFiltAno("");}} style={{fontSize:12,padding:"6px 12px",background:"#fee2e2",border:"1px solid #fecaca",borderRadius:7,color:"#dc2626",cursor:"pointer"}}>✕ Limpar</button>}
          <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} processo(s)</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
          <KPICard label="Processos" value={filtered.length.toLocaleString()} gradient={T.kpi2} icon="📊"/>
          <KPICard label="Órgãos" value={mp.allOrgaos.length} gradient={T.kpi1} icon="🏛️"/>
          <KPICard label="Fornecedores" value={mp.allFornecedores.length} gradient={T.kpi5} icon="🏢"/>
        </div>
        {porMes.length>0&&<div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px",marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:dark?"#e2e8f0":"#0f172a"}}>Processos por Mês</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={porMes} margin={{top:5,right:10,bottom:5,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#1a4020":"#f1f5f9"}/>
              <XAxis dataKey="mes" tick={{fontSize:10}} stroke="#94a3b8"/>
              <YAxis tick={{fontSize:10}} stroke="#94a3b8"/>
              <Tooltip contentStyle={{background:dark?"#1a2535":"#fff",border:`1px solid ${bdr}`}}/>
              <Line type="monotone" dataKey="n" stroke="#3b6ef8" strokeWidth={2} dot={{r:4}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>}
        {topOrg.length>0&&<div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:dark?"#e2e8f0":"#0f172a"}}>Top Órgãos</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={topOrg} margin={{left:0,right:10}}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#1a4020":"#f1f5f9"}/>
              <XAxis type="number" tick={{fontSize:10}} stroke="#94a3b8"/>
              <YAxis dataKey="orgao" type="category" tick={{fontSize:9.5}} width={140}/>
              <Tooltip contentStyle={{background:dark?"#1a2535":"#fff",border:`1px solid ${bdr}`}}/>
              <Bar dataKey="n" fill="#3b6ef8" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>}
      </div>
    </div>
  );
}

// ─── HistoricoPage ────────────────────────────────────────────────────────────
function HistoricoPage({historico,dark,onDuplicar,onGerarPDF,onEditar,truncado}){
  const[q,setQ]=useState("");const[filtDec,setFiltDec]=useState("");const[lPDF,setLPDF]=useState(null);
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg,bdr=dark?T.borderDark:T.border,tc=dark?T.textMainDark:T.textMain;
  const filtered=useMemo(()=>{
    let r=historico;
    if(q.trim()){const ql=q.toLowerCase();r=r.filter(h=>["Processo","Órgão","Fornecedor","Tipo"].some(c=>String(h[c]||"").toLowerCase().includes(ql)));}
    if(filtDec)r=r.filter(h=>String(h["Decisão"]||"").includes(filtDec));
    return r;
  },[historico,q,filtDec]);
  const def=useMemo(()=>historico.filter(h=>String(h["Decisão"]||"").includes("DEFERIDO")).length,[historico]);
  const handlePDF=async(h,idx)=>{if(lPDF!==null)return;setLPDF(idx);try{await onGerarPDF(h,{_dummy:true});}finally{setLPDF(null);};};
  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="🕐" title="Histórico" sub="Documentos processados" cor="#7c3aed" dark={dark}/>
      <div style={{padding:"16px 20px"}}>
        {truncado&&<div style={{fontSize:11.5,color:"#fbbf24",fontWeight:600,marginBottom:12,padding:"8px 14px",background:"#451a03",borderRadius:8,border:"1px solid #92400e"}}>⚠️ Exibindo os 200 registros mais recentes. Exporte o Excel para ver o histórico completo.</div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          <KPICard label="Total" value={historico.length} gradient={T.kpi1} icon="🕐"/>
          <KPICard label="Deferidos" value={def} gradient={T.kpi5} icon="✅"/>
          <KPICard label="Indeferidos" value={historico.length-def} gradient={T.kpi3} icon="❌"/>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔎  Processo, fornecedor..." style={{...IS(dark),flex:1,fontSize:13,padding:"8px 12px",marginBottom:0}}/>
          <select value={filtDec} onChange={e=>setFiltDec(e.target.value)} style={{...IS(dark),width:"auto",minWidth:130,padding:"8px 10px",fontSize:12,marginBottom:0}}>
            <option value="">Todos</option><option value="DEFERIDO">✅ Deferido</option><option value="INDEFERIDO">❌ Indeferido</option>
          </select>
        </div>
        {filtered.length===0
          ?<div style={{textAlign:"center",padding:"60px 24px",color:dark?"#2e4a6e":"#94a3b8",fontSize:13}}>Nenhum registro encontrado.</div>
          :<div style={{background:cardBg,borderRadius:12,border:`1.5px solid ${bdr}`,overflow:"hidden"}}>
            <div style={{overflowX:"auto",maxHeight:560,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                <thead style={{position:"sticky",top:0,background:dark?"#0d1117":"#f2f7ee",zIndex:1}}>
                  <tr style={{borderBottom:`1.5px solid ${bdr}`}}>
                    {["Processo","Data","Órgão","Fornecedor","Valor","Tipo","Decisão"].map(c=>(
                      <th key={c} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:11,textTransform:"uppercase",letterSpacing:".06em",whiteSpace:"nowrap"}}>{c}</th>
                    ))}
                    <th style={{padding:"10px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase"}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h,i)=>{
                    const dec=String(h["Decisão"]||"");
                    const isDef=dec.includes("DEFERIDO")&&!dec.includes("INDE");
                    return(
                      <tr key={i} style={{borderBottom:`1px solid ${bdr}`,background:i%2===0?cardBg:(dark?"#1e242c":"#fafbfc")}}
                        onMouseEnter={e=>e.currentTarget.style.background=dark?"#1a4020":"#f0f9ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?cardBg:(dark?"#1e242c":"#fafbfc")}>
                        <td style={{padding:"8px 12px",color:tc,fontWeight:700}}>{h["Processo"]||""}</td>
                        <td style={{padding:"8px 12px",color:tc,whiteSpace:"nowrap"}}>{h["Data"]||""}</td>
                        <td style={{padding:"8px 12px",color:tc,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(h["Órgão"]||"").slice(0,30)}</td>
                        <td style={{padding:"8px 12px",color:tc,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{String(h["Fornecedor"]||"").slice(0,35)}</td>
                        <td style={{padding:"8px 12px",color:tc,whiteSpace:"nowrap"}}>{h["Valor"]||""}</td>
                        <td style={{padding:"8px 12px",color:tc}}>{h["Tipo"]||""}</td>
                        <td style={{padding:"8px 12px"}}>
                          <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5,
                            background:isDef?"#0d2318":"#450a0a",
                            color:isDef?"#86efac":"#fca5a5",
                            border:`1px solid ${isDef?"#16a34a":"#dc2626"}`}}>
                            {isDef?"✅ DEFERIDO":"❌ INDEFERIDO"}
                          </span>
                        </td>
                        <td style={{padding:"6px 10px"}}>
                          <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                            <button onClick={()=>handlePDF(h,i)} disabled={lPDF!==null} style={{...BS("danger",lPDF!==null,dark),height:30,fontSize:11,padding:"0 8px 0 4px"}}><BtnIco emoji={lPDF===i?"⏳":"📄"}/>{lPDF===i?"...":"PDF"}</button>
                            <button onClick={()=>onDuplicar&&onDuplicar(h)} style={{...BS("secondary",false,dark),height:30,fontSize:11,padding:"0 8px 0 4px"}}><BtnIco emoji="⧉"/>Dup.</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>}
        <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>{filtered.length} registro(s) · Total: {historico.length}</div>
      </div>
    </div>
  );
}

// ─── Permissões sugeridas para operador ──────────────────────────────────────
const PERMISSOES_SUGERIDAS=[
  {id:"criar_processo",   label:"Criar novos processos",         grupo:"Processos"},
  {id:"editar_processo",  label:"Editar processos existentes",   grupo:"Processos"},
  {id:"gerar_pdf",        label:"Gerar PDF / Word",              grupo:"Processos"},
  {id:"buscar",           label:"Buscar e visualizar processos", grupo:"Processos"},
  {id:"ver_historico",    label:"Visualizar histórico",          grupo:"Relatórios"},
  {id:"ver_dashboard",    label:"Visualizar dashboard",          grupo:"Relatórios"},
  {id:"importar_excel",   label:"Importar planilhas Excel",      grupo:"Dados"},
  {id:"exportar_excel",   label:"Exportar para Excel",           grupo:"Dados"},
  {id:"gerenciar_orgaos", label:"Gerenciar órgãos e secretarias",grupo:"Configuração"},
];

// ─── Modal alterar senha ──────────────────────────────────────────────────────
function ModalSenha({login,nome,dark,onConfirm,onClose}){
  const[nova,setNova]=useState("");
  const[conf,setConf]=useState("");
  const[erro,setErro]=useState("");
  const bg=dark?T.cardBgDark:"#fff",tc=dark?T.textMainDark:"#0f172a",bdr=dark?T.borderDark:"#e2e8f0";
  const iS=IS(dark);
  const handle=()=>{
    if(!nova.trim()){setErro("Informe a nova senha.");return;}
    if(nova.length<4){setErro("Mínimo de 4 caracteres.");return;}
    if(nova!==conf){setErro("As senhas não coincidem.");return;}
    onConfirm(nova.trim());
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9990,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:bg,borderRadius:16,padding:"28px 32px",maxWidth:380,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.35)",border:`1.5px solid ${bdr}`}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div><div style={{fontSize:15,fontWeight:800,color:tc}}>🔑 Alterar Senha</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>{nome} ({login})</div></div>
          <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#64748b"}}>✕</button>
        </div>
        {erro&&<div style={{background:"#450a0a",border:"1px solid #dc2626",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:"#fca5a5",fontWeight:600}}>⚠️ {erro}</div>}
        <label style={LS(dark)}>Nova Senha</label>
        <input type="password" value={nova} onChange={e=>{setNova(e.target.value);setErro("");}} placeholder="Nova senha" autoFocus style={iS}/>
        <label style={LS(dark)}>Confirmar Senha</label>
        <input type="password" value={conf} onChange={e=>{setConf(e.target.value);setErro("");}} placeholder="Repita a senha" onKeyDown={e=>e.key==="Enter"&&handle()} style={iS}/>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={onClose} style={{...BS("ghost",false,dark),flex:1,justifyContent:"center"}}>Cancelar</button>
          <button onClick={handle} style={{...BS("primary",false,dark),flex:2,justifyContent:"center"}}><BtnIco emoji="🔑"/>Salvar Senha</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal permissões de operador ────────────────────────────────────────────
function ModalPermissoes({login,nome,permissoes=[],dark,onConfirm,onClose}){
  const[sel,setSel]=useState(()=>{
    if(permissoes.length===0) return PERMISSOES_SUGERIDAS.map(p=>p.id); // padrão: todas
    return permissoes;
  });
  const bg=dark?T.cardBgDark:"#fff",tc=dark?T.textMainDark:"#0f172a",bdr=dark?T.borderDark:"#e2e8f0";
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const grupos=[...new Set(PERMISSOES_SUGERIDAS.map(p=>p.grupo))];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:9990,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:bg,borderRadius:16,padding:"28px 32px",maxWidth:480,width:"94%",maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,.35)",border:`1.5px solid ${bdr}`}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div><div style={{fontSize:15,fontWeight:800,color:tc}}>🛡️ Permissões do Operador</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>{nome} ({login})</div></div>
          <button onClick={onClose} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#64748b"}}>✕</button>
        </div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:14,padding:"8px 12px",background:dark?"rgba(0,64,224,.1)":"#eff6ff",borderRadius:8,border:`1px solid ${dark?MUN.blueDk:"#bfdbfe"}`}}>
          💡 Selecione quais funcionalidades este operador poderá acessar.
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {grupos.map(grupo=>(
            <div key={grupo} style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:dark?MUN.gold:MUN.green,marginBottom:6}}>{grupo}</div>
              {PERMISSOES_SUGERIDAS.filter(p=>p.grupo===grupo).map(p=>(
                <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,cursor:"pointer",marginBottom:4,background:sel.includes(p.id)?(dark?"rgba(0,64,224,.15)":"#eff6ff"):"transparent",border:`1px solid ${sel.includes(p.id)?(dark?MUN.blue:"#bfdbfe"):bdr}`,transition:"all .12s"}}>
                  <input type="checkbox" checked={sel.includes(p.id)} onChange={()=>toggle(p.id)} style={{width:15,height:15,cursor:"pointer",accentColor:MUN.blue}}/>
                  <span style={{fontSize:12.5,color:tc,fontWeight:sel.includes(p.id)?600:400}}>{p.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16,paddingTop:14,borderTop:`1px solid ${bdr}`}}>
          <button onClick={()=>setSel([])} style={{...BS("ghost",false,dark),fontSize:11,padding:"0 12px"}}>Nenhuma</button>
          <button onClick={()=>setSel(PERMISSOES_SUGERIDAS.map(p=>p.id))} style={{...BS("ghost",false,dark),fontSize:11,padding:"0 12px"}}>Todas</button>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{...BS("ghost",false,dark),justifyContent:"center"}}>Cancelar</button>
          <button onClick={()=>onConfirm(sel)} style={{...BS("primary",false,dark),justifyContent:"center"}}><BtnIco emoji="✅"/>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

// ─── UsuariosPage ─────────────────────────────────────────────────────────────
function UsuariosPage({dark,toast}){
  const[users,setUsers]=useState({});
  const[novoLogin,setNovoLogin]=useState("");
  const[novaSenha,setNovaSenha]=useState("");
  const[novoNome,setNovoNome]=useState("");
  const[novoPerfil,setNovoPerfil]=useState("operador");
  const[loading,setLoading]=useState(false);
  const[modalSenha,setModalSenha]=useState(null);      // login string
  const[modalPerm,setModalPerm]=useState(null);        // login string
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg,bdr=dark?T.borderDark:T.border,tc=dark?T.textMainDark:T.textMain;
  const iStyle=IS(dark);

  useEffect(()=>{loadUsers().then(setUsers);},[]);

  const handleAdicionar=async()=>{
    if(!novoLogin.trim()||!novaSenha.trim()||!novoNome.trim()){toast("Preencha todos os campos.","error");return;}
    if(users[novoLogin]){toast("Login já existe.","error");return;}
    setLoading(true);
    try{
      const salt=crypto.randomUUID().replace(/-/g,"").slice(0,32);
      const hash=await hashSenha(salt,novaSenha);
      const updated={...users,[novoLogin]:{senha:hash,salt,nome:novoNome,perfil:novoPerfil,ativo:true,permissoes:novoPerfil==="operador"?PERMISSOES_SUGERIDAS.map(p=>p.id):[]}};
      await ST.set("users",updated);setUsers(updated);
      setNovoLogin("");setNovaSenha("");setNovoNome("");
      toast("✅ Usuário criado!");
    }finally{setLoading(false);}
  };

  const toggleAtivo=async(login)=>{
    if(login==="admin"){toast("Não é possível desativar o admin.","warn");return;}
    const updated={...users,[login]:{...users[login],ativo:!users[login].ativo}};
    await ST.set("users",updated);setUsers(updated);
    toast(updated[login].ativo?"✅ Usuário ativado.":"⚠️ Usuário desativado.","info");
  };

  const handleConfirmSenha=async(novaSenhaVal)=>{
    const login=modalSenha;
    const salt=crypto.randomUUID().replace(/-/g,"").slice(0,32);
    const hash=await hashSenha(salt,novaSenhaVal);
    const updated={...users,[login]:{...users[login],senha:hash,salt}};
    await ST.set("users",updated);setUsers(updated);
    setModalSenha(null);
    toast("✅ Senha alterada com sucesso!");
  };

  const handleConfirmPerm=async(novasPerm)=>{
    const login=modalPerm;
    const updated={...users,[login]:{...users[login],permissoes:novasPerm}};
    await ST.set("users",updated);setUsers(updated);
    setModalPerm(null);
    toast(`✅ Permissões de ${users[login].nome} atualizadas!`);
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="👥" title="Usuários" sub="Gerenciar contas de acesso" dark={dark}/>
      <div style={{padding:"20px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>

        {/* ── Novo usuário ── */}
        <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
          <SH icon="➕" title="Novo Usuário" dark={dark}/>
          <label style={LS(dark)}>Login</label>
          <input value={novoLogin} onChange={e=>setNovoLogin(e.target.value)} placeholder="ex: joao.silva" style={iStyle}/>
          <label style={LS(dark)}>Nome completo</label>
          <input value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder="João Silva" style={iStyle}/>
          <label style={LS(dark)}>Senha</label>
          <input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} placeholder="Senha inicial" style={iStyle}/>
          <label style={LS(dark)}>Perfil</label>
          <select value={novoPerfil} onChange={e=>setNovoPerfil(e.target.value)} style={{...iStyle}}>
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
          {novoPerfil==="operador"&&(
            <div style={{fontSize:11,color:"#64748b",marginTop:-8,marginBottom:12,padding:"7px 10px",background:dark?"rgba(0,64,224,.08)":"#eff6ff",borderRadius:8,border:`1px solid ${dark?MUN.blueDk:"#bfdbfe"}`}}>
              💡 O operador será criado com todas as permissões ativas. Você pode ajustá-las depois clicando em <b>Permissões</b>.
            </div>
          )}
          <button onClick={handleAdicionar} disabled={loading} style={{...BS("success",loading,dark),width:"100%",justifyContent:"center"}}>
            <BtnIco emoji="➕"/>Criar Usuário
          </button>
        </div>

        {/* ── Lista de usuários ── */}
        <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
          <SH icon="👤" title="Usuários Cadastrados" dark={dark}/>
          {Object.entries(users).map(([login,u])=>{
            const isAdmin=login==="admin";
            const qtdPerm=(u.permissoes||[]).length;
            return(
              <div key={login} style={{borderRadius:10,marginBottom:10,background:dark?"#1a1f24":"#f8fafc",border:`1px solid ${bdr}`,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:tc}}>{u.nome}</div>
                    <div style={{fontSize:11,marginTop:2}}>
                      <span style={{background:u.perfil==="admin"?"#7c3aed":MUN.blue,color:"#fff",padding:"1px 8px",borderRadius:5,fontSize:10,fontWeight:700}}>{u.perfil==="admin"?"Admin":"Operador"}</span>
                      {!isAdmin&&<span style={{color:"#64748b",marginLeft:6}}>{qtdPerm}/{PERMISSOES_SUGERIDAS.length} permissões</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
                    <button onClick={()=>setModalSenha(login)} style={{...BS("secondary",false,dark),height:30,fontSize:11,padding:"0 8px 0 5px"}}><BtnIco emoji="🔑"/>Senha</button>
                    {!isAdmin&&(
                      <>
                        <button onClick={()=>setModalPerm(login)} style={{...BS("secondary",false,dark),height:30,fontSize:11,padding:"0 8px 0 5px"}}><BtnIco emoji="🛡️"/>Permissões</button>
                        <button onClick={()=>toggleAtivo(login)} style={{...BS(u.ativo?"danger":"success",false,dark),height:30,fontSize:11,padding:"0 8px 0 5px"}}>
                          <BtnIco emoji={u.ativo?"🚫":"✅"}/>{u.ativo?"Desativar":"Ativar"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* barra de permissões para operadores */}
                {!isAdmin&&u.perfil==="operador"&&(
                  <div style={{padding:"0 14px 10px"}}>
                    <div style={{height:3,background:dark?"rgba(255,255,255,.08)":"#e2e8f0",borderRadius:4}}>
                      <div style={{height:"100%",width:`${(qtdPerm/PERMISSOES_SUGERIDAS.length)*100}%`,borderRadius:4,background:qtdPerm===PERMISSOES_SUGERIDAS.length?"#16a34a":qtdPerm>0?MUN.blue:"#dc2626",transition:"width .3s"}}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modais */}
      {modalSenha&&(
        <ModalSenha
          login={modalSenha}
          nome={users[modalSenha]?.nome||modalSenha}
          dark={dark}
          onConfirm={handleConfirmSenha}
          onClose={()=>setModalSenha(null)}
        />
      )}
      {modalPerm&&(
        <ModalPermissoes
          login={modalPerm}
          nome={users[modalPerm]?.nome||modalPerm}
          permissoes={users[modalPerm]?.permissoes||[]}
          dark={dark}
          onConfirm={handleConfirmPerm}
          onClose={()=>setModalPerm(null)}
        />
      )}
    </div>
  );
}

// ─── OrgaosPage ───────────────────────────────────────────────────────────────
function OrgaosPage({processos,orgaosConfig,onOrgaosChange,dark,toast}){
  const mp=useMemo(()=>buildMapData(processos),[processos]);
  const[novoOrg,setNovoOrg]=useState("");
  const[novoSec,setNovoSec]=useState("");
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg,bdr=dark?T.borderDark:T.border,tc=dark?T.textMainDark:T.textMain;
  const iStyle=IS(dark);

  // Merge dos órgãos dos processos com a config
  const allOrgs=useMemo(()=>{
    const s=new Set([...mp.allOrgaos,...Object.keys(orgaosConfig)]);
    return[...s].sort();
  },[mp.allOrgaos,orgaosConfig]);

  const toggleAtivo=async(org)=>{
    const cur=orgaosConfig[org]||{secretario:"",ativo:true};
    const updated={...orgaosConfig,[org]:{...cur,ativo:!cur.ativo}};
    await DB.set("orgaos_config",updated);onOrgaosChange(updated);
    toast(updated[org].ativo?"✅ Órgão ativado.":"⚠️ Órgão desativado.","info");
  };

  const handleAdicionar=async()=>{
    if(!novoOrg.trim()){toast("Nome do órgão obrigatório.","error");return;}
    const updated={...orgaosConfig,[novoOrg.trim()]:{secretario:novoSec.trim(),ativo:true}};
    await DB.set("orgaos_config",updated);onOrgaosChange(updated);
    setNovoOrg("");setNovoSec("");
    toast("✅ Órgão adicionado!");
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="🏛️" title="Órgãos" sub="Gerenciar secretarias e departamentos" cor="#0f766e" dark={dark}/>
      <div style={{padding:"20px 24px",display:"grid",gridTemplateColumns:"1fr 2fr",gap:20,alignItems:"start"}}>
        <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
          <SH icon="➕" title="Novo Órgão" dark={dark}/>
          <label style={LS(dark)}>Nome do Órgão / Secretaria</label>
          <input value={novoOrg} onChange={e=>setNovoOrg(e.target.value)} placeholder="SEC. DE SAÚDE" style={iStyle}/>
          <label style={LS(dark)}>Secretário(a) padrão</label>
          <input value={novoSec} onChange={e=>setNovoSec(e.target.value)} placeholder="Nome do secretário" style={iStyle}/>
          <button onClick={handleAdicionar} style={{...BS("success",false,dark),width:"100%",justifyContent:"center"}}>
            <BtnIco emoji="➕"/>Adicionar
          </button>
        </div>
        <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
          <SH icon="🏛️" title={`${allOrgs.length} Órgãos`} dark={dark}/>
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {allOrgs.map(org=>{
              const cfg=orgaosConfig[org]||{secretario:"",ativo:true};
              const ativo=cfg.ativo!==false;
              return(
                <div key={org} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,marginBottom:6,background:dark?"#1a1f24":"#f8fafc",border:`1px solid ${ativo?bdr:"#991b1b"}`,opacity:ativo?1:.6}}>
                  <div>
                    <div style={{fontSize:12.5,fontWeight:700,color:tc}}>{org}</div>
                    {cfg.secretario&&<div style={{fontSize:11,color:"#64748b"}}>{cfg.secretario}</div>}
                  </div>
                  <button onClick={()=>toggleAtivo(org)} style={{...BS(ativo?"danger":"success",false,dark),height:30,fontSize:11,padding:"0 10px 0 5px"}}>
                    <BtnIco emoji={ativo?"🚫":"✅"}/>{ativo?"Desativar":"Ativar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ConfigPage ───────────────────────────────────────────────────────────────
function ConfigPage({processos,historico,orgaosConfig,appConfig,setAppConfig,onImport,onSyncDB,dark,toast}){
  const[importLoading,setImportLoading]=useState(false);
  const[dbLoading,setDbLoading]=useState(false);
  const bg=dark?T.appBgDark:T.appBg,cardBg=dark?T.cardBgDark:T.cardBg,bdr=dark?T.borderDark:T.border,tc=dark?T.textMainDark:T.textMain;

  const handleExportExcel=()=>{
    exportarExcel(processos,historico);
    toast("✅ Excel exportado!");
  };

  const handleImportExcel=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setImportLoading(true);
    try{
      const rows=await importarExcel(file);
      onImport(rows);
      toast(`✅ Importados ${rows.length} registros.`);
    }catch(err){toast(`❌ Erro: ${err.message}`,"error");}
    finally{setImportLoading(false);e.target.value="";}
  };

  const handleImportDB=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    setDbLoading(true);
    try{
      const res=await readSqliteDB(file);
      if(res.error){toast(`❌ SQLite: ${res.error}`,"error");return;}
      onSyncDB(res);
      toast(`✅ DB importado: ${res.processos.length} processos.`);
    }catch(err){toast(`❌ ${err.message}`,"error");}
    finally{setDbLoading(false);e.target.value="";}
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="⚙️" title="Configurações" sub="Importar, exportar e gerenciar dados" cor="#64748b" dark={dark}/>
      <div style={{padding:"20px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
            <SH icon="📤" title="Exportar" dark={dark}/>
            <button onClick={handleExportExcel} style={{...BS("success",false,dark),width:"100%",justifyContent:"center",marginBottom:10}}>
              <BtnIco emoji="📊"/>Exportar Excel
            </button>
            <div style={{fontSize:11,color:"#64748b"}}>{processos.length} processos · {historico.length} histórico</div>
          </div>
          <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
            <SH icon="📥" title="Importar Excel" dark={dark}/>
            <label style={{...BS("primary",importLoading,dark),width:"100%",justifyContent:"center",cursor:"pointer"}}>
              <BtnIco emoji={importLoading?"⏳":"📥"}/>{importLoading?"Importando...":"Selecionar Excel (.xlsx)"}
              <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} style={{display:"none"}}/>
            </label>
            <div style={{fontSize:11,color:"#64748b",marginTop:8}}>Importa e mescla com dados existentes.</div>
          </div>
          <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
            <SH icon="🗄️" title="Importar SQLite (.db)" dark={dark}/>
            <label style={{...BS("orange",dbLoading,dark),width:"100%",justifyContent:"center",cursor:"pointer"}}>
              <BtnIco emoji={dbLoading?"⏳":"🗄️"}/>{dbLoading?"Lendo banco...":"Selecionar arquivo .db"}
              <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleImportDB} style={{display:"none"}}/>
            </label>
            <div style={{fontSize:11,color:"#64748b",marginTop:8}}>Lê processos, histórico e configurações de órgãos.</div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
            <SH icon="📋" title="Guia de Importação Excel" dark={dark}/>
            <div style={{fontSize:12,color:tc,lineHeight:1.7}}>
              <p style={{margin:"0 0 10px",fontSize:11.5,color:"#64748b",padding:"8px 12px",background:dark?"rgba(0,64,224,.08)":"#eff6ff",borderRadius:8,border:`1px solid ${dark?MUN.blueDk:"#bfdbfe"}`}}>
                📌 Use este guia para migrar seus dados após colocar o sistema na nuvem.
              </p>

              {/* Passo 1 */}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:12,color:dark?MUN.gold:MUN.green,marginBottom:4}}>① Prepare a planilha Excel</div>
                <div style={{fontSize:11.5,color:"#64748b",marginBottom:6}}>O arquivo <b>.xlsx</b> deve ter as seguintes colunas (os nomes são flexíveis — o sistema reconhece automaticamente):</div>
                <div style={{background:dark?"#0d1117":"#f8fafc",borderRadius:8,padding:"10px 12px",border:`1px solid ${bdr}`,fontFamily:"monospace",fontSize:10.5,color:dark?"#93c5fd":"#1e40af",lineHeight:2}}>
                  {["ORGÃO / SECRETARIA","SECRETARIO","FORNECEDOR / CREDOR / EMPRESA","CNPJ / CPF","MODALIDADE","CONTRATO","OBJETO / DESCRICAO","VALOR","DATA NF","NUMERO DO DOCUMENTO / PROCESSO","PERIODO DE REFERENCIA","N° ORDEM DE COMPRA","DOCUMENTO FISCAL","TIPO"].map(c=>(
                    <div key={c} style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:MUN.gold,fontSize:10}}>▸</span>{c}
                    </div>
                  ))}
                </div>
              </div>

              {/* Passo 2 */}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:12,color:dark?MUN.gold:MUN.green,marginBottom:4}}>② Exporte do sistema atual (se houver)</div>
                <div style={{fontSize:11.5,color:"#64748b"}}>Se você já tem dados no sistema, clique em <b>"Exportar Excel"</b> ao lado para baixar tudo. Abra o arquivo, complete com os dados legados e salve novamente.</div>
              </div>

              {/* Passo 3 */}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:12,color:dark?MUN.gold:MUN.green,marginBottom:4}}>③ Acesse o sistema na nuvem</div>
                <div style={{fontSize:11.5,color:"#64748b"}}>Abra o sistema pelo link da nuvem, faça login como <b>administrador</b> e vá em <b>⚙️ Configurações</b>.</div>
              </div>

              {/* Passo 4 */}
              <div style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:12,color:dark?MUN.gold:MUN.green,marginBottom:4}}>④ Importe o arquivo</div>
                <div style={{fontSize:11.5,color:"#64748b",marginBottom:6}}>Clique em <b>"Selecionar Excel (.xlsx)"</b>, escolha o arquivo e aguarde. O sistema:</div>
                <div style={{fontSize:11,color:"#64748b",paddingLeft:8}}>
                  {["Lê todas as linhas da primeira aba","Normaliza os nomes das colunas automaticamente","Mescla com dados existentes (evita duplicatas por Nº do Documento)","Exibe um toast com o total de registros importados"].map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:6,marginBottom:3}}>
                      <span style={{color:"#16a34a",fontWeight:700,flexShrink:0}}>{i+1}.</span>{s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Aviso */}
              <div style={{background:dark?"rgba(220,38,38,.1)":"#fef2f2",border:`1px solid ${dark?"#7f1d1d":"#fecaca"}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:dark?"#fca5a5":"#b91c1c"}}>
                ⚠️ <b>Atenção:</b> A importação <b>não apaga</b> dados existentes. Processos com o mesmo Nº de Documento são ignorados (mantém o já salvo). Para substituir, exclua o processo antigo antes de importar.
              </div>
            </div>
          </div>
          <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
            <SH icon="ℹ️" title="Informações do Sistema" dark={dark}/>
            {[["Versão","v3.0"],["Processos salvos",processos.length],["Histórico",historico.length],["Órgãos configurados",Object.keys(orgaosConfig).length]].map(([l,v])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${bdr}`,fontSize:13}}>
                <span style={{color:"#64748b"}}>{l}</span>
                <span style={{fontWeight:700,color:tc}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
            <SH icon="✍️" title="Dados do Controlador (PDF)" dark={dark}/>
            <label style={LS(dark)}>Nome completo</label>
            <input value={appConfig?.controlador?.nome||""} onChange={e=>{const u={...appConfig,controlador:{...appConfig.controlador,nome:e.target.value}};setAppConfig(u);DB.set("app_config",u);}} placeholder="Ex: Thiago Soares Lima" style={IS(dark)}/>
            <label style={LS(dark)}>Cargo</label>
            <input value={appConfig?.controlador?.cargo||""} onChange={e=>{const u={...appConfig,controlador:{...appConfig.controlador,cargo:e.target.value}};setAppConfig(u);DB.set("app_config",u);}} placeholder="Ex: Controlador Geral" style={IS(dark)}/>
            <label style={LS(dark)}>Portaria / Designação</label>
            <input value={appConfig?.controlador?.portaria||""} onChange={e=>{const u={...appConfig,controlador:{...appConfig.controlador,portaria:e.target.value}};setAppConfig(u);DB.set("app_config",u);}} placeholder="Ex: Portaria 002/2025" style={IS(dark)}/>
            <div style={{fontSize:10.5,color:"#64748b",marginTop:-10}}>Aparece na assinatura de todos os PDFs gerados.</div>
          </div>

          {/* ── Status do banco compartilhado ── */}
          <div style={{background:cardBg,borderRadius:14,border:`2px solid ${dark?MUN.blue:MUN.blue}`,padding:"20px 24px"}}>
            <SH icon="🌐" title="Banco de Dados Compartilhado" dark={dark}/>

            {/* Status em tempo real */}
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
              background:dark?"rgba(34,197,94,.1)":"#f0fdf4",
              border:`1px solid ${dark?"#16a34a":"#bbf7d0"}`,borderRadius:10,marginBottom:16}}>
              <span style={{fontSize:18}}>✅</span>
              <div>
                <div style={{fontSize:12.5,fontWeight:700,color:dark?"#4ade80":"#16a34a"}}>Banco compartilhado ativo</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:1}}>
                  Todos os usuários lêem e escrevem no mesmo banco de dados. Processos cadastrados por qualquer usuário ficam visíveis para todos imediatamente.
                </div>
              </div>
            </div>

            {/* Como funciona */}
            <div style={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:11.5,color:dark?MUN.gold:MUN.green,marginBottom:8}}>Como funciona</div>
              {[
                ["🌐","Banco único","Todos os usuários acessam os mesmos processos, histórico e configurações de órgãos."],
                ["🔄","Atualização automática","O sistema verifica a cada 30 segundos se outro usuário fez alguma alteração e atualiza automaticamente."],
                ["🔔","Notificação","Quando outro usuário cadastra ou edita um processo, você vê um aviso 'Banco atualizado!' na barra lateral."],
                ["🔑","Dados pessoais separados","Apenas o rascunho do formulário e as senhas de acesso ficam salvos localmente no seu navegador."],
              ].map(([ico,tit,desc])=>(
                <div key={tit} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start",
                  padding:"8px 12px",borderRadius:8,background:dark?"rgba(255,255,255,.03)":"#f8fafc",
                  border:`1px solid ${bdr}`}}>
                  <span style={{fontSize:16,flexShrink:0}}>{ico}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:tc,marginBottom:2}}>{tit}</div>
                    <div style={{fontSize:11.5,color:"#64748b"}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Como carregar o Excel no banco compartilhado */}
            <div style={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:11.5,color:dark?MUN.gold:MUN.green,marginBottom:8}}>
                📥 Como carregar o Excel para o banco compartilhado
              </div>
              <div style={{fontSize:11.5,color:"#64748b",marginBottom:10}}>
                Quando o administrador importa um Excel aqui em <b>⚙️ Configurações</b>, os dados são gravados diretamente no banco compartilhado — ficando visíveis para <b>todos os usuários instantaneamente</b>, sem necessidade de nenhuma outra ação.
              </div>
              {[
                ["①","Prepare o Excel","Certifique-se de que o arquivo .xlsx tem as colunas: ORGÃO, SECRETARIO, FORNECEDOR, CNPJ, MODALIDADE, CONTRATO, OBJETO, VALOR, DATA NF, NUMERO DO DOCUMENTO, PERÍODO DE REFERÊNCIA."],
                ["②","Faça login como Administrador","Somente o perfil admin pode importar dados para o banco."],
                ["③","Vá em ⚙️ Configurações","Clique em 📥 Importar Excel e selecione o arquivo."],
                ["④","Aguarde a confirmação","O sistema exibe o total de registros importados. Os dados já estão no banco compartilhado."],
                ["⑤","Outros usuários atualizam automaticamente","Em até 30 segundos todos os usuários logados verão os novos dados. Quem acabar de fazer login recebe os dados imediatamente."],
              ].map(([n,tit,desc])=>(
                <div key={n} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start"}}>
                  <span style={{background:MUN.blue,color:"#fff",borderRadius:8,padding:"2px 7px",
                    fontSize:11,fontWeight:800,flexShrink:0,marginTop:1,lineHeight:1.6}}>{n}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:tc,marginBottom:1}}>{tit}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dica de sync manual */}
            <div style={{padding:"8px 12px",background:dark?"rgba(239,209,3,.08)":"#fefce8",
              border:`1px solid ${dark?MUN.goldDk:"#fde68a"}`,borderRadius:8,fontSize:11,
              color:dark?MUN.gold:"#92400e"}}>
              💡 <b>Sync manual:</b> clique em 🔄 na barra lateral a qualquer momento para forçar a gravação dos dados no banco compartilhado e atualizar os hashes de controle.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[user,setUser]=useState(null);
  const[processos,setProcessos]=useState([]);
  const[historico,setHistorico]=useState([]);
  const[orgaosConfig,setOrgaosConfig]=useState({});
  const[appConfig,setAppConfig]=useState({controlador:{nome:"Thiago Soares Lima",cargo:"Controlador Geral",portaria:"Portaria 002/2025"}});
  const[page,setPage]=useState("processos");
  const[dark,setDark]=useState(true);
  const[formPct,setFormPct]=useState(0);
  const[duplicarData,setDuplicarData]=useState(null);
  const[editarData,setEditarData]=useState(null);
  const[showShortcuts,setShowShortcuts]=useState(false);
  const{toasts,toast}=useToast();

  // [B1] Zera formPct ao sair de "processos"
  const handleSetPage=useCallback((p)=>{
    if(p!=="processos")setFormPct(0);
    setPage(p);
  },[]);

  const[syncStatus,setSyncStatus]=useState("ok"); // "ok"|"syncing"|"updated"
  const syncHashRef=useRef({processos:null,historico:null,orgaos:null,config:null});

  // Carrega dados do banco compartilhado (DB) na inicialização
  useEffect(()=>{
    setSyncStatus("syncing");
    Promise.all([
      DB.get("processos").then(d=>{if(d)setProcessos(d);}),
      DB.get("historico").then(d=>{if(d)setHistorico(d);}),
      DB.get("orgaos_config").then(d=>{if(d)setOrgaosConfig(d);}),
      DB.get("app_config").then(d=>{if(d)setAppConfig(d);}),
    ]).then(async()=>{
      // Salva hashes iniciais para detectar mudanças de outros usuários
      syncHashRef.current = {
        processos: await DB.hash("processos"),
        historico: await DB.hash("historico"),
        orgaos:    await DB.hash("orgaos_config"),
        config:    await DB.hash("app_config"),
      };
      setSyncStatus("ok");
    });
  },[]);

  // Polling: verifica a cada 5s se outro usuário atualizou o banco
  useEffect(()=>{
    const poll=setInterval(async()=>{
      let changed=false;
      const hP=await DB.hash("processos");
      if(hP&&hP!==syncHashRef.current.processos){
        const d=await DB.get("processos");
        if(d){
          setProcessos(d);
          syncHashRef.current.processos=hP;
          changed=true;
        }
      }
      const hH=await DB.hash("historico");
      if(hH&&hH!==syncHashRef.current.historico){
        const d=await DB.get("historico");if(d)setHistorico(d);
        syncHashRef.current.historico=hH;changed=true;
      }
      const hO=await DB.hash("orgaos_config");
      if(hO&&hO!==syncHashRef.current.orgaos){
        const d=await DB.get("orgaos_config");if(d)setOrgaosConfig(d);
        syncHashRef.current.orgaos=hO;changed=true;
      }
      if(changed){
        setSyncStatus("updated");
        setTimeout(()=>setSyncStatus("ok"),4000);
      }
    },5000); // 5 segundos — detecta conflitos rapidamente em uso simultâneo
    return()=>clearInterval(poll);
  },[]);

  const salvarProcessos=async(p)=>{
    setProcessos(p);
    await DB.set("processos",p);
    syncHashRef.current.processos=await DB.hash("processos");
  };
  const salvarHistorico=async(h)=>{
    setHistorico(h);
    await DB.set("historico",h);
    syncHashRef.current.historico=await DB.hash("historico");
  };
  const salvarOrgaos=async(o)=>{
    setOrgaosConfig(o);
    await DB.set("orgaos_config",o);
    syncHashRef.current.orgaos=await DB.hash("orgaos_config");
  };

  const onSave=useCallback(async(row,form)=>{
    // ── Lock otimista: relê o banco compartilhado AGORA para ter a lista mais fresca ──
    // Isso evita colisão quando dois usuários salvam ao mesmo tempo.
    const listaFresca = await DB.get("processos") || processos;

    // Se o número que o usuário digitou já existe na lista fresca (outro usuário acabou de usar),
    // substituímos automaticamente pelo próximo disponível.
    let numFinal = String(row["NÚMERO DO DOCUMENTO"]).trim();
    if (numExiste(listaFresca, numFinal)) {
      numFinal = String(proxNumero(listaFresca));
      toast(`⚠️ Nº ${row["NÚMERO DO DOCUMENTO"]} já foi usado. Atribuído automaticamente o Nº ${numFinal}.`, "warn");
    }

    const novoItem = {
      ...row,
      "NÚMERO DO DOCUMENTO": numFinal,
      "_tipoKey": form.tipo,
      "_decisao": form.decisao,
      "_obs": form.obs,
    };

    // Mescla com a lista fresca (não com o state local que pode estar defasado)
    const novosProcessos = [novoItem, ...listaFresca.filter(
      p => String(p["NÚMERO DO DOCUMENTO"]).trim() !== numFinal
    )];

    await salvarProcessos(novosProcessos);

    // Atualiza o state local com a lista fresca + novo item
    setProcessos(novosProcessos);

    // Histórico
    const hRow = {
      "Processo": numFinal,
      "Data": row["DATA"],
      "Órgão": row["ORGÃO"],
      "Fornecedor": row["FORNECEDOR"],
      "Valor": row["VALOR"],
      "Tipo": TINFO[form.tipo]?.label||form.tipo,
      "TipoKey": form.tipo,
      "Decisão": form.decisao==="deferir"?"DEFERIDO":"INDEFERIDO",
    };
    const novoHist = [hRow, ...historico].slice(0,200);
    await salvarHistorico(novoHist);

    toast(`✅ Processo ${numFinal} salvo!`);

    // Retorna o próximo número calculado sobre a lista já gravada
    return proxNumero(novosProcessos);
  },[processos,historico]);

  const onSaveEdit=useCallback(async(row,form,numOriginal)=>{
    const novoItem={...row,"_tipoKey":form.tipo,"_decisao":form.decisao,"_obs":form.obs};
    const updated=processos.map(p=>
      String(p["NÚMERO DO DOCUMENTO"])===String(numOriginal)?novoItem:p
    );
    await salvarProcessos(updated);
    toast(`✅ Processo ${row["NÚMERO DO DOCUMENTO"]} atualizado!`,"info");
  },[processos]);

  const handleEditar=useCallback((row)=>{
    setEditarData(row);
    handleSetPage("processos");
  },[handleSetPage]);

  const handleDuplicar=useCallback((row)=>{
    setDuplicarData(row);
    handleSetPage("processos");
  },[handleSetPage]);

  const handleGerarPDFBusca=useCallback(async(row)=>{
    const tipo=row["_tipoKey"]||"padrao";
    const chk=CHK[tipo]||[];
    const sits=Array(chk.length).fill(true);
    const d={
      processo:row["NÚMERO DO DOCUMENTO"],orgao:row["ORGÃO"],
      secretario:row["SECRETARIO"],fornecedor:row["FORNECEDOR"],
      cnpj:row["CNPJ"],nf:row["Nº"],contrato:row["CONTRATO"],
      modalidade:row["MODALIDADE"],periodo_ref:row["PERÍODO DE REFERÊNCIA"],
      ordem_compra:row["N° ORDEM DE COMPRA"]||"",
      data_nf:formatData(row["DATA NF"]) || formatData(new Date()),
      data_ateste:dtExt(row["DATA"]) || dtExt(new Date()),
      objeto:row["OBJETO"],valor:row["VALOR"],
      tipo_doc:row["DOCUMENTO FISCAL"],tipo_nf:row["TIPO"],
      obs:row["_obs"]||"",
      controlador:appConfig?.controlador||{},
    };
    const r=await gerarPDF(d,tipo,row["_decisao"]!=="indeferir",chk,sits);
    if(r.error){toast(`❌ PDF: ${r.error}`,"error");return;}
    const url=URL.createObjectURL(r.blob);const a=document.createElement("a");
    a.href=url;a.download=r.name;document.body.appendChild(a);a.click();
    setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},2000);
    toast("✅ PDF gerado!");
  },[]);

  const handleSync=useCallback(async()=>{
    setSyncStatus("syncing");
    await Promise.all([
      DB.set("processos",processos),
      DB.set("historico",historico),
      DB.set("orgaos_config",orgaosConfig),
    ]);
    syncHashRef.current = {
      processos: await DB.hash("processos"),
      historico: await DB.hash("historico"),
      orgaos:    await DB.hash("orgaos_config"),
      config:    syncHashRef.current.config,
    };
    setSyncStatus("ok");
    toast("✅ Banco compartilhado sincronizado!","info");
  },[processos,historico,orgaosConfig]);

  const handleImport=useCallback((rows)=>{
    const merged=[...rows,...processos.filter(p=>
      !rows.some(r=>String(r["NÚMERO DO DOCUMENTO"])===String(p["NÚMERO DO DOCUMENTO"]))
    )];
    salvarProcessos(merged);
  },[processos]);

  const handleSyncDB=useCallback((res)=>{
    if(res.processos?.length)salvarProcessos(res.processos);
    if(res.historico?.length)salvarHistorico(res.historico);
    if(Object.keys(res.orgaosConfig||{}).length)salvarOrgaos(res.orgaosConfig);
  },[]);

  // [C4] Histórico truncado check
  const histTruncado=historico.length>=200;

  if(!user) return <LoginPage onLogin={setUser}/>;

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",
                 background:dark?T.appBgDark:T.appBg,backgroundAttachment:"fixed"}}>
      <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a4020;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#0030a0}input,select,textarea{font-family:inherit}@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <Sidebar
        page={page} setPage={handleSetPage}
        user={user} onLogout={()=>setUser(null)}
        onSync={handleSync}
        proxNum={proxNumero(processos)}
        dark={dark} onToggleDark={()=>setDark(d=>!d)}
        formPct={formPct}
        syncStatus={syncStatus}
      />
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {page==="processos"&&(
          <NovoProcessoPage
            processos={processos} orgaosConfig={orgaosConfig}
            onSave={onSave} onSaveEdit={onSaveEdit}
            toast={toast} dark={dark}
            onPctChange={setFormPct}
            duplicarData={duplicarData} onDuplicarConsumed={()=>setDuplicarData(null)}
            editarData={editarData} onEditarConsumed={()=>setEditarData(null)}
            onShowShortcuts={()=>setShowShortcuts(true)}
            appConfig={appConfig}
          />
        )}
        {page==="buscar"&&(
          <BuscarPage
            processos={processos}
            onCarregar={handleDuplicar}
            onEditar={handleEditar}
            onGerarPDF={handleGerarPDFBusca}
            toast={toast} dark={dark}
          />
        )}
        {page==="dashboard"&&<DashboardPage processos={processos} dark={dark}/>}
        {page==="historico"&&(
          <HistoricoPage
            historico={historico} dark={dark}
            onDuplicar={handleDuplicar}
            onGerarPDF={handleGerarPDFBusca}
            onEditar={handleEditar}
            truncado={histTruncado}
          />
        )}
        {page==="usuarios"&&user?.perfil==="admin"&&<UsuariosPage dark={dark} toast={toast}/>}
        {page==="orgaos"&&user?.perfil==="admin"&&(
          <OrgaosPage
            processos={processos} orgaosConfig={orgaosConfig}
            onOrgaosChange={o=>{setOrgaosConfig(o);DB.set("orgaos_config",o);}}
            dark={dark} toast={toast}
          />
        )}
        {page==="config"&&user?.perfil==="admin"&&(
          <ConfigPage
            processos={processos} historico={historico} orgaosConfig={orgaosConfig}
            appConfig={appConfig} setAppConfig={setAppConfig}
            onImport={handleImport} onSyncDB={handleSyncDB}
            dark={dark} toast={toast}
          />
        )}
        {(page==="usuarios"||page==="orgaos"||page==="config")&&user?.perfil!=="admin"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:dark?T.appBgDark:T.appBg}}>
            <div style={{textAlign:"center",padding:40}}>
              <div style={{fontSize:48,marginBottom:16}}>🔒</div>
              <div style={{fontSize:18,fontWeight:800,color:dark?"#e2e8f0":"#0f172a",marginBottom:8}}>Acesso Restrito</div>
              <div style={{fontSize:13,color:"#64748b"}}>Esta área é exclusiva para administradores.</div>
            </div>
          </div>
        )}
      </div>
      {showShortcuts&&<ShortcutsModal onClose={()=>setShowShortcuts(false)} dark={dark}/>}
      <Toast toasts={toasts}/>
    </div>
  );
}
