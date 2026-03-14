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
        _sqlJs = SQL; res(SQL);
      } catch { res(null); }
    };
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
}

// ─── [C1] Storage durável ─────────────────────────────────────────────────────
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
  // Modo escuro: fundo verde-escuro profundo baseado nas cores do brasão
  appBgDark:"linear-gradient(160deg,#020c02 0%,#04120a 40%,#030818 100%)",
  cardBgDark:"#071008",
  borderDark:"#1a3014",
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

function formatData(raw) {
  if (!raw) return "";
  const s = String(raw).trim().split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y,m,d]=s.split("-"); return `${d}/${m}/${y}`; }
  const d = s.replace(/\D/g,"");
  if (d.length>=8) return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4,8)}`;
  return d;
}

function dtExt(d) {
  if (!d) return "";
  if (d instanceof Date) return `${d.getDate()} de ${MESES[d.getMonth()+1]} de ${d.getFullYear()}`;
  const digs = String(d).replace(/\D/g,"");
  if (digs.length>=8) return `${parseInt(digs.slice(0,2))} de ${MESES[parseInt(digs.slice(2,4))]} de ${digs.slice(4,8)}`;
  return String(d);
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

// ─── [C2] proxNumero ──────────────────────────────────────────────────────────
function proxNumero(processos) {
  const nums = processos
    .map(p => parseInt(String(p["NÚMERO DO DOCUMENTO"]||"").trim(),10))
    .filter(n => !isNaN(n));
  if (!nums.length) return 1;
  const set = new Set(nums);
  let next = Math.max(...nums)+1;
  while (set.has(next)) next++;
  return next;
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
      try{doc.addImage(window.BRASAO_B64,"PNG",bX,bY,bW,bH);}catch(e){}
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
      ["Data da NF.:",fv(d.data_nf)],["Secretário(a):",fv(d.secretario)],
      ["Data do ateste:",fv(d.data_ateste)],
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
    doc.text("Governador Edison Lobão/MA, "+fv(d.data_ateste||dtExt(new Date())),W-19,y,{align:"right"});
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
const IS=(dark)=>({width:"100%",padding:"8px 12px",fontSize:13,borderRadius:9,border:`1.5px solid ${dark?MUN.greenDk:"#c8d8b8"}`,background:dark?"#040d04":"#f8faf4",color:dark?T.textMainDark:T.textMain,outline:"none",marginBottom:14,transition:"border .15s"});
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
  const cBg=dark?"#061008":"#f8faf4",bdr=dark?MUN.greenDk:"#c8d8b8";
  return(<div style={{background:cBg,borderBottom:`1.5px solid ${bdr}`,padding:"14px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:12,background:cor+"18",border:`1.5px solid ${cor}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21}}>{icon}</div><div><div style={{fontSize:16,fontWeight:800,color:dark?"#e2e8f0":"#0f172a"}}>{title}</div>{sub&&<div style={{fontSize:11.5,color:"#64748b",marginTop:1}}>{sub}</div>}</div></div>{actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}</div>);
}

function SH({icon,title,dark}){return(<div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10,marginTop:4}}><span style={{fontSize:14}}>{icon}</span><span style={{fontSize:11.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:dark?MUN.gold:MUN.green}}>{title}</span><div style={{flex:1,height:1,background:dark?MUN.greenDk:"#c8d8b8",marginLeft:4}}/></div>);}

function SearchSelect({label,value,options=[],onChange,dark,required=false,placeholder="Selecione ou digite..."}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState("");const ref=useRef(null);
  const filtered=useMemo(()=>q.trim()?options.filter(o=>o.toLowerCase().includes(q.toLowerCase())):options,[options,q]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const choose=v=>{onChange(v);setQ("");setOpen(false);};
  const bdr=dark?"#1e2d40":"#e2e8f0";
  return(<div ref={ref} style={{position:"relative",marginBottom:14}}>{label&&<label style={LS(dark)}>{label}{required&&" *"}</label>}<div onClick={()=>setOpen(o=>!o)} style={{...IS(dark),marginBottom:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",userSelect:"none"}}><span style={{color:value?(dark?"#e2e8f0":"#1e293b"):"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{value||placeholder}</span><span style={{fontSize:10,color:"#94a3b8",marginLeft:6}}>{open?"▲":"▼"}</span></div>{open&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:dark?"#0d1421":"#fff",border:`1.5px solid ${dark?"#2d4060":"#bfdbfe"}`,borderRadius:8,marginTop:2,boxShadow:"0 8px 24px rgba(0,0,0,.18)",overflow:"hidden"}}><input value={q} onChange={e=>setQ(e.target.value)} autoFocus placeholder="Filtrar..." onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="Enter"&&filtered.length===1)choose(filtered[0]);}} style={{...IS(dark),marginBottom:0,borderRadius:0,border:"none",borderBottom:`1px solid ${bdr}`}}/><div style={{maxHeight:210,overflowY:"auto"}}>{filtered.length===0&&<div style={{padding:"10px 14px",fontSize:12,color:"#94a3b8"}}>Nenhum resultado</div>}{filtered.map(o=>(<div key={o} onMouseDown={()=>choose(o)} style={{padding:"9px 14px",fontSize:12.5,cursor:"pointer",color:dark?"#e2e8f0":"#1e293b",background:o===value?(dark?"#1e2d40":"#eff6ff"):"transparent",borderBottom:`1px solid ${dark?"#0f1a2e":"#f8fafc"}`}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#1e2d40":"#f0f9ff"} onMouseLeave={e=>e.currentTarget.style.background=o===value?(dark?"#1e2d40":"#eff6ff"):"transparent"}>{o}</div>))}</div></div>)}</div>);
}

function FilterBadge({count,fonte,isFiltered}){if(!isFiltered)return null;return(<div style={{fontSize:9.5,color:"#7c3aed",fontWeight:700,marginBottom:4}}><span style={{background:"#f5f3ff",padding:"1px 7px",borderRadius:5,border:"1px solid #ddd6fe"}}>🔗 {count} filtradas · {String(fonte||"").slice(0,28)}</span></div>);}

function PeriodoInput({value,onChange,dark,style}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState(value||"");const ref=useRef(null);
  const sug=useMemo(()=>{const ms=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];const now=new Date();const res=[];for(let y=now.getFullYear();y>=now.getFullYear()-2;y--){for(let mi=11;mi>=0;mi--){const s=`${ms[mi]}/${y}`;if(!q.trim()||s.includes(q.toUpperCase()))res.push(s);if(res.length>=8)break;}if(res.length>=8)break;}return res;},[q]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const escolher=v=>{setQ(v);onChange(v);setOpen(false);};
  return(<div ref={ref} style={{position:"relative",width:"100%"}}><input value={q} onChange={e=>{setQ(e.target.value);onChange(e.target.value);setOpen(true);}} onFocus={()=>q.trim()&&setOpen(true)} onKeyDown={e=>{if(e.key==="Escape")setOpen(false);if(e.key==="Enter"&&sug.length===1)escolher(sug[0]);}} placeholder="Ex: MARÇO/2026" autoComplete="off" style={style}/>{open&&sug.length>0&&(<div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:200,background:dark?"#0d1421":"#fff",border:`1.5px solid ${dark?"#7c3aed":"#a78bfa"}`,borderRadius:8,marginTop:2,boxShadow:"0 8px 24px rgba(0,0,0,.18)",overflow:"hidden"}}>{sug.map(s=>(<div key={s} onMouseDown={()=>escolher(s)} style={{padding:"8px 14px",fontSize:13,cursor:"pointer",color:dark?"#e2e8f0":"#1e293b",fontWeight:600,borderBottom:`1px solid ${dark?"#1e2d40":"#f1f5f9"}`}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#1e2d40":"#f5f3ff"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>📅 {s}</div>))}</div>)}</div>);
}

function ShortcutsModal({onClose,dark}){
  const bg=dark?"#111827":"#fff",bdr=dark?"#1e2d40":"#e8ecf4",tc=dark?"#e2e8f0":"#1e293b";
  const atalhos=[["Ctrl+S","Salvar processo"],["Ctrl+P","Gerar PDF"],["Ctrl+W","Gerar Word"],["Ctrl+L","Limpar formulário"],["Ctrl+D","Duplicar último"],["?","Esta janela"],["Esc","Fechar dropdown"]];
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9997,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}><div style={{background:bg,borderRadius:16,padding:"26px 30px",maxWidth:400,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.35)",border:`1px solid ${bdr}`}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:15,fontWeight:800,color:tc}}>⌨️ Atalhos de Teclado</span><button onClick={onClose} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#64748b"}}>✕</button></div><div style={{display:"flex",flexDirection:"column",gap:7}}>{atalhos.map(([k,desc])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",borderRadius:8,background:dark?"#0d1421":"#f8fafc",border:`1px solid ${bdr}`}}><span style={{fontSize:12.5,color:dark?"#94a3b8":"#64748b"}}>{desc}</span><kbd style={{background:dark?"#1e2d40":"#e2e8f0",color:tc,padding:"2px 10px",borderRadius:6,fontSize:12,fontFamily:"monospace",fontWeight:700,border:`1px solid ${dark?"#2d4060":"#cbd5e1"}`}}>{k}</kbd></div>))}</div></div></div>);
}

function PdfInstrucoes({fileName,onClose}){
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{background:"#fff",borderRadius:16,padding:"28px 32px",maxWidth:440,width:"90%",boxShadow:"0 24px 64px rgba(0,0,0,.3)"}}><div style={{fontSize:36,textAlign:"center",marginBottom:12}}>📄</div><h3 style={{margin:"0 0 10px",textAlign:"center",color:"#0f172a",fontSize:16}}>Arquivo baixado!</h3><p style={{fontSize:13,color:"#64748b",lineHeight:1.7,marginBottom:18}}>O arquivo <b>{fileName}</b> foi baixado.<br/>Para converter em PDF:<br/>1. Abra no navegador<br/>2. Pressione <b>Ctrl+P</b><br/>3. Escolha <b>"Salvar como PDF"</b></p><button onClick={onClose} style={{...BS("primary",false,false),width:"100%",justifyContent:"center"}}><BtnIco emoji="✓"/>Entendido</button></div></div>);
}


function Brasao({size=56,style={}}){
  return(
    <img src={window.BRASAO_B64} alt="Brasão Gov. Edison Lobão"
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
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#020b01 0%,#051a04 60%,#030820 100%)"}}>
      <div style={{width:380,background:"#081007",borderRadius:20,padding:"40px 36px",boxShadow:"0 32px 80px rgba(0,0,0,.6)",border:"1px solid "+MUN.greenDk}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <Brasao size={72} style={{margin:"0 auto 14px"}}/>
          <div style={{fontSize:13,fontWeight:800,color:MUN.gold,letterSpacing:".03em"}}>PREFEITURA DE GOV. EDISON LOBÃO</div>
          <div style={{fontSize:11,color:"#4a6494",marginTop:4}}>Controladoria Geral — Sistema de Pagamentos</div>
        </div>
        {erro&&<div style={{background:"#450a0a",border:"1px solid #dc2626",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#fca5a5",fontWeight:600}}>⚠️ {erro}</div>}
        <label style={LS(true)}>Login</label>
        <input value={login} onChange={e=>setLogin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="admin" autoFocus style={{...IS(true),background:"#0d1421",border:"1.5px solid #1e2d40"}}/>
        <label style={LS(true)}>Senha</label>
        <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handle()} placeholder="••••••••" style={{...IS(true),background:"#0d1421",border:"1.5px solid #1e2d40"}}/>
        <button onClick={handle} disabled={loading||bloq} style={{...BS("primary",loading||bloq,true),width:"100%",justifyContent:"center",height:46,fontSize:14,marginTop:4}}>
          {bloq?`Aguarde ${Math.floor(count/60)}m${count%60}s…`:loading?"Verificando…":"→ Entrar"}
        </button>

      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({page,setPage,user,onLogout,onSync,proxNum,dark,onToggleDark,formPct}){
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
      <div onClick={()=>setPage(k)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",marginBottom:3,borderRadius:10,cursor:"pointer",transition:"all .15s",background:active?"rgba(59,110,248,.22)":"transparent",border:active?"1px solid rgba(59,110,248,.35)":"1px solid transparent"}}>
        <span style={{fontSize:15,width:20,textAlign:"center"}}>{icon}</span>
        <span style={{fontSize:12.5,fontWeight:active?700:500,color:active?MUN.gold:"rgba(255,255,255,.55)"}}>{label}</span>
      </div>
    );
  };
  return(
    <div style={{width:220,flexShrink:0,display:"flex",flexDirection:"column",background:"linear-gradient(180deg,#061a04 0%,#02080a 60%,#030d1a 100%)",height:"100vh",position:"sticky",top:0,borderRight:"1px solid "+MUN.greenDk,overflowY:"auto",overflowX:"hidden"}}>
      <div style={{padding:"18px 16px 14px",borderBottom:"1px solid "+MUN.greenDk,textAlign:"center"}}>
        <Brasao size={52} style={{margin:"0 auto 10px"}}/>
        <div style={{fontSize:11,fontWeight:700,color:MUN.gold,lineHeight:1.4}}>CONTROLADORIA<br/>GERAL</div>
        <div style={{fontSize:9,color:MUN.goldDk,marginTop:3}}>Pref. Gov. Edison Lobão / MA</div>
      </div>
      <div style={{margin:"10px 10px 0",padding:"8px 12px",background:"rgba(255,255,255,.06)",borderRadius:10,border:"1px solid rgba(255,255,255,.1)"}}>
        <div style={{fontSize:11.5,fontWeight:700,color:"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.nome}</div>
        <div style={{fontSize:9.5,color:MUN.goldDk,textTransform:"uppercase",letterSpacing:".06em",fontWeight:600,marginTop:2}}>{user?.perfil}</div>
      </div>
      {page==="processos"&&(
        <div style={{margin:"8px 10px 0",padding:"8px 12px",background:"rgba(255,255,255,.05)",borderRadius:10,border:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:9,color:"rgba(255,255,255,.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>Preenchimento</span>
            <span style={{fontSize:9,fontWeight:800,color:formPct===100?"#4ade80":formPct>60?"#fbbf24":"#93c5fd"}}>{formPct}%</span>
          </div>
          <div style={{height:4,background:"rgba(255,255,255,.1)",borderRadius:4}}>
            <div style={{height:"100%",width:`${formPct}%`,borderRadius:4,transition:"width .4s",background:formPct===100?"#22c55e":formPct>60?"#f59e0b":"#3b82f6"}}/>
          </div>
        </div>
      )}
      <div style={{margin:"8px 10px 0",padding:"8px 12px",background:"rgba(0,64,224,.18)",borderRadius:10,border:"1px solid rgba(0,64,224,.35)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:9.5,color:"rgba(255,255,255,.45)",fontWeight:700,textTransform:"uppercase"}}>Próximo Nº</span>
        <span style={{fontSize:18,fontWeight:800,color:MUN.gold}}>{proxNum||"—"}</span>
      </div>
      <div style={{padding:"10px 8px",flex:1}}>
        <div style={{fontSize:8.5,fontWeight:700,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:".1em",padding:"4px 8px 6px"}}>Principal</div>
        {nav.map(n=><NavItem key={n.k} k={n.k} icon={n.icon} label={n.label}/>)}
        {isAdmin&&<>
          <div style={{height:1,background:"rgba(255,255,255,.08)",margin:"10px 4px 8px"}}/>
          <div style={{fontSize:8.5,fontWeight:700,color:"rgba(255,255,255,.25)",textTransform:"uppercase",letterSpacing:".1em",padding:"4px 8px 6px"}}>Admin</div>
          {adm.map(n=><NavItem key={n.k} k={n.k} icon={n.icon} label={n.label}/>)}
        </>}
      </div>
      <div style={{padding:"10px 10px 12px",borderTop:"1px solid "+MUN.greenDk,display:"flex",flexDirection:"column",gap:6}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <button onClick={onSync} style={{height:34,background:"rgba(0,64,224,.2)",border:"1px solid rgba(0,64,224,.35)",borderRadius:8,color:MUN.gold,fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>🔄 Sync</button>
          <button onClick={onLogout} style={{height:34,background:"rgba(220,38,38,.2)",border:"1px solid rgba(220,38,38,.3)",borderRadius:8,color:"#fca5a5",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>⏏ Sair</button>
        </div>
        <button onClick={onToggleDark} style={{height:32,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"rgba(255,255,255,.5)",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontWeight:600}}>
          {dark?"☀️ Modo Claro":"🌙 Modo Escuro"}
        </button>
        <div style={{fontSize:8,color:"rgba(255,255,255,.15)",textAlign:"center"}}>v3.0 · 2025</div>
      </div>
    </div>
  );
}

// ─── NovoProcessoPage ─────────────────────────────────────────────────────────
function NovoProcessoPage({processos,orgaosConfig,onSave,onSaveEdit,toast,dark,onPctChange,
                           duplicarData,onDuplicarConsumed,editarData,onEditarConsumed,
                           onPdfDownload,onShowShortcuts}){
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

  useEffect(()=>{
    if(!duplicarData)return;
    setForm(formFromRow(duplicarData));setChks({});setPdfBlob(null);setTab(0);setEditMode(null);
    if(onDuplicarConsumed)onDuplicarConsumed();
  },[duplicarData]);

  useEffect(()=>{
    if(!editarData)return;
    const row=editarData;
    setForm({
      numDoc:row["NÚMERO DO DOCUMENTO"]||"",dataDoc:row["DATA"]||todayISO(),
      periodo:row["PERÍODO DE REFERÊNCIA"]||"",orgao:row["ORGÃO"]||"",
      secretario:row["SECRETARIO"]||"",fornecedor:row["FORNECEDOR"]||"",
      cnpj:row["CNPJ"]||"",nomeFan:row["NOME FANTASIA"]||"",
      modalidade:row["MODALIDADE"]||"",contrato:row["CONTRATO"]||"",
      ordemCompra:row["N° ORDEM DE COMPRA"]||"",tipDoc:row["DOCUMENTO FISCAL"]||"",
      numNf:row["Nº"]||"",tipNf:row["TIPO"]||"",valor:row["VALOR"]||"",
      dataNf:row["DATA NF"]||todayISO(),objeto:row["OBJETO"]||"",
      dataAteste:row["DATA"]||todayISO(),
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

  const makeDados=()=>({
    processo:form.numDoc,orgao:form.orgao,secretario:form.secretario,
    fornecedor:form.fornecedor,cnpj:form.cnpj,nf:form.numNf,
    contrato:form.contrato,modalidade:form.modalidade,periodo_ref:form.periodo,
    ordem_compra:form.ordemCompra,
    data_nf:formatData(form.dataNf),data_ateste:dtExt(formatData(form.dataAteste)),
    objeto:form.objeto,valor:form.valor,tipo_doc:form.tipDoc,tipo_nf:form.tipNf,obs:form.obs,
    controlador:appConfig?.controlador||{},
  });

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
    if(checarDuplicata(form.numDoc)&&!editMode){if(!window.confirm(`Número ${form.numDoc} já existe. Continuar?`))return;}
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
      else{await onSave(row,form);}
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
                  <input value={form.numDoc} onChange={e=>upd("numDoc")(e.target.value)} style={iStyle}/>
                  {checarDuplicata(form.numDoc)&&<div style={{fontSize:10.5,color:"#dc2626",marginTop:-10,marginBottom:8}}>⚠️ Este número já existe</div>}
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
                    <button onClick={()=>setModMode(m=>m==="forn"?"todos":"forn")} style={{width:38,height:38,flexShrink:0,background:dark?"#0f1c2e":"#f1f5f9",border:`1.5px solid ${bdr}`,borderRadius:8,cursor:"pointer",fontSize:16,marginBottom:14}}>{modMode==="forn"?"📂":"🏢"}</button>
                  </div>
                </div>
                <div>
                  <FilterBadge count={cShow.length} fonte={form.fornecedor} isFiltered={cFiltered}/>
                  <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
                    <div style={{flex:1}}><SearchSelect label="Nº Contrato" value={form.contrato} options={cShow} onChange={v=>setForm(f=>({...f,contrato:v}))} dark={dark}/></div>
                    <button onClick={()=>setContMode(m=>m==="forn"?"todos":"forn")} style={{width:38,height:38,flexShrink:0,background:dark?"#0f1c2e":"#f1f5f9",border:`1.5px solid ${bdr}`,borderRadius:8,cursor:"pointer",fontSize:16,marginBottom:14}}>{contMode==="forn"?"📂":"🏢"}</button>
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
                  <button onClick={()=>setObjMode(m=>m==="historico"?"todos":"historico")} style={{width:38,height:38,flexShrink:0,background:dark?"#0f1c2e":"#f1f5f9",border:`1.5px solid ${bdr}`,borderRadius:8,cursor:"pointer",fontSize:16,marginBottom:14}}>{objMode==="historico"?"📂":"🏢"}</button>
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
                <div><label style={LS(dark)}>📌 Notas Internas</label><textarea value={form.notas} onChange={e=>upd("notas")(e.target.value)} placeholder="Não aparecem no PDF" rows={3} style={{...iStyle,height:"auto",resize:"vertical",borderColor:dark?"#3b4f6b":"#fde68a",background:dark?"#100d00":"#fffbeb"}}/></div>
              </div>
              <div style={{background:dark?"#0d1421":"#f8faff",borderRadius:12,padding:"14px 16px",border:`1px solid ${bdr}`}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:tc}}>☑ Checklist — {ti.label}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {chkItems.map((item,i)=>(
                    <label key={`${form.tipo}-${i}`} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12.5,marginBottom:4,color:tc}}>
                      <input type="checkbox" checked={sits[i]} onChange={e=>setChk(form.tipo,i,e.target.checked)} style={{width:14,height:14,flexShrink:0,accentColor:"#3b6ef8"}}/>{item}
                    </label>
                  ))}
                </div>
                <div style={{marginTop:10}}>
                  <div style={{height:4,background:dark?"#1e2d40":"#e2e8f0",borderRadius:4}}>
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
              <thead style={{position:"sticky",top:0,background:dark?"#030c03":"#f2f7ee",zIndex:1}}>
                <tr style={{borderBottom:`1.5px solid ${bdr}`}}>
                  {cols.map(c=>(<th key={c} onClick={()=>toggleSort(c)} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:"#475569",whiteSpace:"nowrap",fontSize:11,textTransform:"uppercase",letterSpacing:".06em",cursor:"pointer",userSelect:"none",background:sort.col===c?(dark?"#2d1f4e":"#f5f3ff"):"transparent"}}>{colLabel(c)} {sort.col===c?(sort.dir===1?"↑":"↓"):""}</th>))}
                  <th style={{padding:"10px 12px",width:200,textAlign:"center",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase"}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {exibidos.length===0?<tr><td colSpan={cols.length+1} style={{padding:"24px",textAlign:"center",color:"#94a3b8"}}>Nenhum resultado</td></tr>
                :exibidos.map((p,i)=>(
                  <tr key={i} style={{borderBottom:`1px solid ${bdr}`,background:i%2===0?cardBg:(dark?"#131f2e":"#fafbfc")}}
                    onMouseEnter={e=>e.currentTarget.style.background=dark?"#1e2d40":"#eff6ff"}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?cardBg:(dark?"#131f2e":"#fafbfc")}>
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
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#1e2d40":"#f1f5f9"}/>
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
              <CartesianGrid strokeDasharray="3 3" stroke={dark?"#1e2d40":"#f1f5f9"}/>
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
                <thead style={{position:"sticky",top:0,background:dark?"#030c03":"#f2f7ee",zIndex:1}}>
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
                      <tr key={i} style={{borderBottom:`1px solid ${bdr}`,background:i%2===0?cardBg:(dark?"#131f2e":"#fafbfc")}}
                        onMouseEnter={e=>e.currentTarget.style.background=dark?"#1e2d40":"#f0f9ff"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?cardBg:(dark?"#131f2e":"#fafbfc")}>
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

// ─── UsuariosPage ─────────────────────────────────────────────────────────────
function UsuariosPage({dark,toast}){
  const[users,setUsers]=useState({});
  const[novoLogin,setNovoLogin]=useState("");
  const[novaSenha,setNovaSenha]=useState("");
  const[novoNome,setNovoNome]=useState("");
  const[novoPerfil,setNovoPerfil]=useState("operador");
  const[loading,setLoading]=useState(false);
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
      const updated={...users,[novoLogin]:{senha:hash,salt,nome:novoNome,perfil:novoPerfil,ativo:true}};
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

  const handleResetSenha=async(login)=>{
    const ns=window.prompt(`Nova senha para "${login}":`);
    if(!ns||!ns.trim())return;
    const salt=crypto.randomUUID().replace(/-/g,"").slice(0,32);
    const hash=await hashSenha(salt,ns.trim());
    const updated={...users,[login]:{...users[login],senha:hash,salt}};
    await ST.set("users",updated);setUsers(updated);
    toast("✅ Senha redefinida!");
  };

  return(
    <div style={{flex:1,overflowY:"auto",background:bg}}>
      <PageHeader icon="👥" title="Usuários" sub="Gerenciar contas de acesso" cor="#7c3aed" dark={dark}/>
      <div style={{padding:"20px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
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
          <button onClick={handleAdicionar} disabled={loading} style={{...BS("success",loading,dark),width:"100%",justifyContent:"center"}}>
            <BtnIco emoji="➕"/>Criar Usuário
          </button>
        </div>
        <div style={{background:cardBg,borderRadius:14,border:`1.5px solid ${bdr}`,padding:"20px 24px"}}>
          <SH icon="👤" title="Usuários Cadastrados" dark={dark}/>
          {Object.entries(users).map(([login,u])=>(
            <div key={login} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,marginBottom:8,background:dark?"#0d1421":"#f8fafc",border:`1px solid ${bdr}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:tc}}>{u.nome}</div>
                <div style={{fontSize:11,color:"#64748b"}}>{login} · <span style={{color:u.perfil==="admin"?"#7c3aed":"#2563eb"}}>{u.perfil}</span></div>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>handleResetSenha(login)} style={{...BS("secondary",false,dark),height:30,fontSize:11,padding:"0 8px 0 5px"}}><BtnIco emoji="🔑"/>Senha</button>
                <button onClick={()=>toggleAtivo(login)} style={{...BS(u.ativo?"danger":"success",false,dark),height:30,fontSize:11,padding:"0 8px 0 5px"}}>
                  <BtnIco emoji={u.ativo?"🚫":"✅"}/>{u.ativo?"Desativar":"Ativar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
    await ST.set("orgaos_config",updated);onOrgaosChange(updated);
    toast(updated[org].ativo?"✅ Órgão ativado.":"⚠️ Órgão desativado.","info");
  };

  const handleAdicionar=async()=>{
    if(!novoOrg.trim()){toast("Nome do órgão obrigatório.","error");return;}
    const updated={...orgaosConfig,[novoOrg.trim()]:{secretario:novoSec.trim(),ativo:true}};
    await ST.set("orgaos_config",updated);onOrgaosChange(updated);
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
                <div key={org} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:10,marginBottom:6,background:dark?"#0d1421":"#f8fafc",border:`1px solid ${ativo?bdr:"#991b1b"}`,opacity:ativo?1:.6}}>
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
            <input value={appConfig?.controlador?.nome||""} onChange={e=>{const u={...appConfig,controlador:{...appConfig.controlador,nome:e.target.value}};setAppConfig(u);ST.set("app_config",u);}} placeholder="Ex: Thiago Soares Lima" style={IS(dark)}/>
            <label style={LS(dark)}>Cargo</label>
            <input value={appConfig?.controlador?.cargo||""} onChange={e=>{const u={...appConfig,controlador:{...appConfig.controlador,cargo:e.target.value}};setAppConfig(u);ST.set("app_config",u);}} placeholder="Ex: Controlador Geral" style={IS(dark)}/>
            <label style={LS(dark)}>Portaria / Designação</label>
            <input value={appConfig?.controlador?.portaria||""} onChange={e=>{const u={...appConfig,controlador:{...appConfig.controlador,portaria:e.target.value}};setAppConfig(u);ST.set("app_config",u);}} placeholder="Ex: Portaria 002/2025" style={IS(dark)}/>
            <div style={{fontSize:10.5,color:"#64748b",marginTop:-10}}>Aparece na assinatura de todos os PDFs gerados.</div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App(){
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

  // Carrega dados do storage
  useEffect(()=>{
    ST.get("processos").then(d=>{if(d)setProcessos(d);});
    ST.get("historico").then(d=>{if(d)setHistorico(d);});
    ST.get("orgaos_config").then(d=>{if(d)setOrgaosConfig(d);});
    ST.get("app_config").then(d=>{if(d)setAppConfig(d);});
  },[]);

  const salvarProcessos=async(p)=>{setProcessos(p);await ST.set("processos",p);};
  const salvarHistorico=async(h)=>{setHistorico(h);await ST.set("historico",h);};
  const salvarOrgaos=async(o)=>{setOrgaosConfig(o);await ST.set("orgaos_config",o);};

  const onSave=useCallback(async(row,form)=>{
    const novoItem={...row,"_tipoKey":form.tipo,"_decisao":form.decisao,"_obs":form.obs};
    const novosProcessos=[novoItem,...processos];
    await salvarProcessos(novosProcessos);
    // Histórico
    const hRow={
      "Processo":row["NÚMERO DO DOCUMENTO"],"Data":row["DATA"],
      "Órgão":row["ORGÃO"],"Fornecedor":row["FORNECEDOR"],
      "Valor":row["VALOR"],"Tipo":TINFO[form.tipo]?.label||form.tipo,
      "TipoKey":form.tipo,"Decisão":form.decisao==="deferir"?"DEFERIDO":"INDEFERIDO",
    };
    // [C4] Limita histórico a 200
    const novoHist=[hRow,...historico].slice(0,200);
    await salvarHistorico(novoHist);
    toast(`✅ Processo ${row["NÚMERO DO DOCUMENTO"]} salvo!`);
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
      data_nf:formatData(row["DATA NF"]),
      data_ateste:dtExt(formatData(row["DATA"])),
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
    await ST.set("processos",processos);
    await ST.set("historico",historico);
    await ST.set("orgaos_config",orgaosConfig);
    toast("✅ Dados sincronizados!","info");
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
      <style>{`*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e2d40;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#2d4060}input,select,textarea{font-family:inherit}@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <Sidebar
        page={page} setPage={handleSetPage}
        user={user} onLogout={()=>setUser(null)}
        onSync={handleSync}
        proxNum={proxNumero(processos)}
        dark={dark} onToggleDark={()=>setDark(d=>!d)}
        formPct={formPct}
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
        {page==="usuarios"&&<UsuariosPage dark={dark} toast={toast}/>}
        {page==="orgaos"&&(
          <OrgaosPage
            processos={processos} orgaosConfig={orgaosConfig}
            onOrgaosChange={o=>{setOrgaosConfig(o);ST.set("orgaos_config",o);}}
            dark={dark} toast={toast}
          />
        )}
        {page==="config"&&(
          <ConfigPage
            processos={processos} historico={historico} orgaosConfig={orgaosConfig}
            appConfig={appConfig} setAppConfig={setAppConfig}
            onImport={handleImport} onSyncDB={handleSyncDB}
            dark={dark} toast={toast}
          />
        )}
      </div>
      {showShortcuts&&<ShortcutsModal onClose={()=>setShowShortcuts(false)} dark={dark}/>}
      <Toast toasts={toasts}/>
    </div>
  );
}
window.App=App;
