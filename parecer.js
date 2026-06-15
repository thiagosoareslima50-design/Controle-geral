/* ─── parecer.js v2 — Parecer Técnico de Controle Interno ──────────────────
   Texto jurídico 100% fiel ao modelo PDF (4 páginas: STJ, TJ-AL, TJ-DF, TCU).
   Dados puxados dos processos do banco Supabase via prop `processos`.
   Exporta: window.ParecerPage
   ─────────────────────────────────────────────────────────────────────────── */

const CERTIDOES_LIST = [
  { key: "cnd_federal",   label: "Certidão de Regularidade Fiscal — CND"            },
  { key: "cnd_estadual",  label: "Certidão Negativa de Débitos Estadual — CND"      },
  { key: "cda_estadual",  label: "Certidão de Dívida Ativa Estadual — CDA"          },
  { key: "cndt",          label: "Certidão Negativa de Débitos Trabalhistas — CNDT" },
  { key: "crf",           label: "Certidão de Regularidade Fiscal — CRF (FGTS)"    },
  { key: "cda_municipal", label: "Certidão de Dívida Ativa Municipal — CDA"        },
  { key: "cnd_municipal", label: "Certidão Negativa de Débitos Municipal — CND"    },
];

function _fv(v) { return v && String(v).trim() ? String(v).trim() : ""; }
function _fvd(v) { return _fv(v) || "—"; }

function _fmtVal(raw) {
  const s = String(raw || "").replace(/[^\d]/g, "");
  if (!s) return _fv(raw) || "—";
  const n = parseInt(s, 10) / 100;
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _valorExt(raw) {
  const s = String(raw || "").replace(/[^\d]/g, "");
  if (!s) return "";
  const n = parseInt(s, 10) / 100;
  const un = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze",
               "doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dz = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
  const ct = ["","cem","duzentos","trezentos","quatrocentos","quinhentos",
               "seiscentos","setecentos","oitocentos","novecentos"];
  function tw(x) {
    if (!x) return "";
    if (x < 20) return un[x];
    if (x < 100) return dz[Math.floor(x/10)] + (x%10 ? " e " + un[x%10] : "");
    if (x === 100) return "cem";
    if (x < 1000) return ct[Math.floor(x/100)] + (x%100 ? " e " + tw(x%100) : "");
    const m = Math.floor(x/1000);
    return (m === 1 ? "mil" : tw(m) + " mil") + (x%1000 ? " e " + tw(x%1000) : "");
  }
  const rei = Math.floor(n), cen = Math.round((n - rei) * 100);
  let e = tw(rei) + (rei === 1 ? " real" : " reais");
  if (cen) e += " e " + tw(cen) + (cen === 1 ? " centavo" : " centavos");
  return e.charAt(0).toUpperCase() + e.slice(1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GERAÇÃO DO PDF — texto 100% fiel ao modelo de 4 páginas
   ═══════════════════════════════════════════════════════════════════════════ */
function gerarPDFParecer(d) {
  const lib = window.jspdf;
  if (!lib) throw new Error("jsPDF não disponível. Verifique se o CDN carregou.");
  const { jsPDF } = lib;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210, H = 297, ML = 19, MR = 19, MT = 10;
  const TW = W - ML - MR;
  const FS = 10.5, LH = 5.6;
  let y = MT;
  const SAFE = H - 20;

  /* ── cabeçalho institucional ── */
  function cabecalho() {
    if (window.BRASAO_B64) {
      try { 
        doc.addImage(window.BRASAO_B64, "PNG", (W - 20) / 2, y, 20, 17, "BRASAO"); 
        y += 19;
      } catch (e) {
        console.error("Erro ao adicionar brasão:", e);
      }
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0, 0, 0);
    doc.text("ESTADO DO MARANH\u00c3O", W/2, y, { align: "center" }); y += 5;
    doc.text("PREFEITURA MUNICIPAL DE JOÃO LISBOA", W/2, y, { align: "center" }); y += 5;
    doc.text("CONTROLADORIA DO MUNIC\u00cdPIO", W/2, y, { align: "center" }); y += 4;
    doc.setLineWidth(0.6); doc.line(ML, y, W - MR, y); y += 5;
  }
  cabecalho();

  /* ── título ── */
  const numP = _fv(d.numParecer) || "___/____";
  const tL = doc.splitTextToSize("PARECER TÉCNICO CONTROLE INTERNO Nº " + numP, TW);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(tL, W/2, y, { align: "center" }); y += tL.length * 5.5 + 7;

  /* ── tabela ── */
  const certVenc = (d.certVencidas || []).join("; ") || "—";
  const vFX = _fmtVal(d.valor) + (_valorExt(d.valor) ? " (" + _valorExt(d.valor) + ")" : "");
  const rows = [
    ["DA:",         "CONTROLADORIA GERAL DO MUNICIPIO"],
    ["PARA:",       "SECRETARIA MUNICIPAL DE FINANÇAS"],
    ["ASSUNTO:",    "PARECER PARA PAGAMENTO"],
    ["PROCESSO:",   _fvd(d.processo)],
    ["EMPRESA",     _fvd(d.fornecedor)],
    ["OBJETO",      _fvd(d.objeto)],
    ["DOCUMENTO",   _fv(d.nf) ? "Nota fiscal eletrônica nº " + _fv(d.nf) : "—"],
    ["VALOR",       vFX],
    ["PENDENCIA",   certVenc],
    ["CONTRATANTE", _fvd(d.orgao)],
  ];
  const LC = 40, VC = TW - LC;
  doc.setFontSize(FS);
  for (const [lbl, val] of rows) {
    const vL = doc.splitTextToSize(val, VC - 4);
    const rH = Math.max(7, vL.length * 5 + 3);
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3);
    doc.rect(ML, y, LC, rH, "S"); doc.rect(ML + LC, y, VC, rH, "S");
    const ty = y + rH / 2 + 1.5;
    doc.setFont("helvetica", "bold"); doc.text(lbl, ML + 2, ty);
    doc.setFont("helvetica", "normal");
    const base = ty - ((vL.length - 1) * 5) / 2;
    vL.forEach((l, i) => doc.text(l, ML + LC + 2, base + i * 5));
    y += rH;
  }
  y += 7;

  /* ── helpers de paginação e texto ── */
  function novaP() {
    doc.addPage(); y = MT; cabecalho();
  }
  function ey(n) { if (y + n > SAFE) novaP(); }

  function par(txt, indent, bold, italic) {
    const ind = indent ? 14 : 0;
    const lin = doc.splitTextToSize(txt, TW - ind);
    ey(lin.length * LH + 4);
    doc.setFont("helvetica", bold ? "bold" : italic ? "italic" : "normal");
    doc.setFontSize(FS);
    doc.text(lin, ML + ind, y, { align: "justify", maxWidth: TW - ind });
    y += lin.length * LH + 4;
    doc.setFont("helvetica", "normal");
  }

  function bq(txt) {
    // blockquote com recuo de 32mm dos dois lados
    const lin = doc.splitTextToSize(txt, TW - 32);
    lin.forEach(l => {
      ey(6);
      doc.setFont("helvetica", "italic"); doc.setFontSize(FS - 0.5);
      doc.text(l, ML + 32, y);
      y += 5;
    });
    y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(FS);
  }

  function secao(titulo) {
    ey(LH + 10);
    doc.setLineWidth(0.4); doc.line(ML, y - 1, W - MR, y - 1); y += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(FS);
    doc.text(titulo, ML, y);
    doc.line(ML, y + 2, W - MR, y + 2); y += LH + 5;
    doc.setFont("helvetica", "normal");
  }

  /* ── variáveis do documento ── */
  const fo      = _fv(d.fornecedor);
  const obj     = _fv(d.objeto) || "fornecimento do objeto";
  const nf      = _fv(d.nf);
  const ct      = _fv(d.contrato);
  const dataV   = _fv(d.dataVencimento);
  const periodo = _fv(d.periodo);
  const fl      = _fv(d.fl) || "16";
  const dec     = d.decisao || "possibilidade";
  const certStr = (d.certVencidas && d.certVencidas.length)
                  ? d.certVencidas[0].split(" (")[0] : "Certidão de Regularidade Fiscal";

  doc.setFontSize(FS); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);

  /* ══ PARÁGRAFOS DO CORPO ══ */

  par("Versam os presentes autos sobre solicitação de pagamento referente ao " +
      obj + " para atender as demandas do município de João Lisboa" +
      (nf ? ", relativo a NF " + nf : "") +
      ". No valor de " + vFX +
      (ct ? ", oriundo do Contrato nº " + ct : "") + ".", true);

  par("Constam nos autos os seguintes documentos: Solicitação de pagamento do " +
      "fornecedor; Nota Fiscal devidamente atestada; Documentos de regularidade fiscal.", true);

  par("É o relatório.", true, true);

  par("Os autos retornaram a esta Controladoria Geral do Município para análise e " +
      "emissão de parecer acerca da possibilidade do pagamento, uma vez que as " +
      certStr + ", juntada a fl. " + fl +
      (dataV ? ", vencida em " + dataV : "") +
      ", anterior a emissão da nota fiscal para se proceder com o processo de pagamento.", true);

  par("Em primeira linha, verifica-se pela análise dos documentos constantes nos autos " +
      "que a empresa juntou todas as Certidões de Regularidade Fiscal, todavia no período da " +
      "tramitação processual a " + certStr +
      (dataV ? ", encontra-se vencida desde " + dataV : "") + ".", true);

  if (periodo) {
    par("Urge mencionar, que a empresa requer o pagamento de " + obj.toLowerCase() +
        " no " + (periodo.startsWith("mês") ? periodo : "mês de " + periodo) +
        ", período em que a empresa se encontrava inadimplente.", true);
  }

  if (dec === "possibilidade") {

    par("Não obstante a irregularidade, a referida execução dos serviços produz efeitos no " +
        "mundo jurídico, em razão do princípio da vedação ao enriquecimento ilícito que, no âmbito dos " +
        "contratos administrativos, encontra respaldo no parágrafo único do art. 59 da Lei de Licitações.", true);

    bq("Parágrafo único. A nulidade não exonera a Administração do dever de indenizar o " +
       "contratado pelo que este houver executado até a data em que ela for declarada e por outros " +
       "prejuízos regularmente comprovados, contanto que não lhe seja imputável, promovendo-se a " +
       "responsabilidade de quem lhe deu causa.");

    par("Ademais, o próprio TCU no informativo 103/2012, do Tribunal de Contas da União " +
        "manifestou o mesmo posicionamento:", true);

    bq("A perda da regularidade fiscal no curso de contratos de execução continuada ou " +
       "parcelada justifica a imposição de sanções à contratada, mas não autoriza a retenção de " +
       "pagamentos por serviços prestados (Acórdão n.º 964/2012-Plenário, TC 017.371/2011-2, rel. " +
       "Min. Walton Alencar Rodrigues, 25.4.2012) [grifo nosso].");

    par("A situação fática apresentada se amolda ao consubstanciado no dispositivo retro " +
        "mencionado, de modo que a contratada fará jus ao recebimento da contraprestação pecuniária " +
        "correspondente, já que não consta dos autos que ela tenha dado causa à ilegalidade apresentada.", true);

    par("Independentemente da existência da Certidão de Regularidade dos Tributos Federais e " +
        "Estaduais, o prestador fará jus ao recebimento dos produtos fornecidos, deve ser notificado " +
        "o fornecedor para que regularize e apresente as mesmas condições de habilitação cabíveis as " +
        "sanções previstas no art.78 da Lei Federal 8666/93.", true);

    par("Nesse diapasão, o Colendo Superior Tribunal de Justiça já decidiu que:", true);

    bq("ADMINISTRATIVO. MANDADO DE SEGURANÇA. CONTRATO. RESCISÃO. IRREGULARIDADE FISCAL. " +
       "RETENÇÃO DE PAGAMENTO.\n" +
       "1. É necessária a comprovação de regularidade fiscal do licitante como requisito para sua " +
       "habilitação, conforme preconizam os arts. 27 e 29 da Lei nº 8.666/93, exigência que encontra " +
       "respaldo no art. 195, § 3º, da CF.\n" +
       "2. A exigência de regularidade fiscal deve permanecer durante toda a execução do contrato, " +
       "a teor do art. 55, XIII, da Lei nº 8.666/93, que dispõe ser \"obrigação do contratado de " +
       "manter, durante toda a execução do contrato, em compatibilidade com as obrigações por ele " +
       "assumidas, todas as condições de habilitação e qualificação exigidas na licitação\".\n" +
       "[...]\n" +
       "5. Pode a Administração rescindir o contrato em razão de descumprimento de uma de suas " +
       "cláusulas e ainda imputar penalidade ao contratado descumpridor. Todavia a retenção do " +
       "pagamento devido, por não constar do rol do art. 87 da Lei nº 8.666/93, ofende o princípio " +
       "da legalidade, insculpido na Carta Magna.");

    par("Tribunais de Justiça também vem reafirmando este mesmo posicionamento, in verbis:", true);

    bq("ADMINISTRATIVO.CONTRATO. REGULARIDADE FISCAL. CONDICIONAMENTO PARA O PAGAMENTO PELOS " +
       "SERVIÇOS PRESTADOR POR PARTICULAR. IMPOSSIBILIDADE. RECURSO CONHECIDO E IMPROVIDO. " +
       "DECISÃO UNÂNIME. O ato impugnado pela ação constitucional foi praticado pelo Secretário " +
       "de Estado da Defesa Social de Alagoas, o que torna evidente a competência da Justiça " +
       "estadual para apreciar a demanda. Não obstante o poder conferido à Administração de exigir " +
       "a comprovação de regularidade fiscal durante toda a vigência do contrato, não pode proceder " +
       "à retenção do pagamento pelos serviços comprovadamente prestados, sob pena de caracterizar " +
       "enriquecimento ilícito.\n" +
       "(TJ-AL – AI: 08011231320168020000 AL 0801123-13.2016.8.02.0000, Relator: Des. Celyrio " +
       "Adamastor Tenório Accioly, Data de Julgamento: 29/09/2016, 3ª Câmara Cível, " +
       "Data de Publicação: 07/10/2016)");

    bq("DIREITO PROCESSUAL CIVIL. TUTELA PROVISÓRIA. CONTRATO ADMINISTRATIVO. PRESTAÇÃO DE " +
       "SERVIÇO. RETENÇÃO DO PAGAMENTO ATÉ COMPROVAÇÃO DE REGULARIDADE FISCAL. FALTA DE AMPARO " +
       "LEGAL. I. Não há amparo legal para que a Administração Pública condicione o pagamento de " +
       "serviço prestado à comprovação da regularidade fiscal da empresa contratada que o executou. " +
       "II. Recurso conhecido e provido.\n" +
       "(TJ-DF 07094592320178070000 DF 0709459-23.2017.8.07.0000, Relator: JAMES EDUARDO " +
       "OLIVEIRA, Data de Julgamento: 21/03/2018, 4ª Turma Cível, Data de Publicação: " +
       "Publicado no DJE: 06/04/2018. Pág.: Sem Página Cadastrada.)");

    bq("APELAÇÃO E REEXAME NECESSÁRIO. MANDADO DE SEGURANÇA. DIREITO ADMINISTRATIVO. CONTRATO " +
       "ADMINISTRATIVO. PAGAMENTO DE SERVIÇOS PRESTADOS. RETENÇÃO. APRESENTAÇÃO DE CERTIDÕES " +
       "NEGATIVAS. INADMISSIBILIDADE. 1 – Ilegítima a exigência de apresentação de certidões " +
       "negativas de débito, quando a empresa contratada efetivamente cumpriu com sua obrigação, " +
       "sob pena de afronta ao princípio da legalidade e enriquecimento sem causa da Administração. " +
       "2 – A aplicação da penalidade de retenção de pagamentos não consta nas sanções elencadas " +
       "no artigo 87 da Lei de Licitações. 3 – Recurso e remessa necessária desprovidos. Sentença mantida.\n" +
       "(TJ-DF – APO: 20130111733715 DF 0009762-63.2013.8.07.0018, Relator: GILBERTO PEREIRA " +
       "DE OLIVEIRA, Data de Julgamento: 03/09/2014, 3ª Turma Cível, Data de Publicação: " +
       "Publicado no DJE: 11/09/2014. Pág.: 107)");

    par("Além deste posicionamento, o Tribunal de Contas da União nos traz um respaldo jurídico " +
        "referente à dispensa da documentação prevista no art. 29, III, da Lei nº 8.666/1993, nos " +
        "casos de contratações diretas, in verbis:", true);

    bq("\"(...)\nA comprovação de regularidade com a Fazenda Federal, a que se refere o art. 29, " +
       "III, da Lei nº 8.666/1993, poderá ser dispensada nos casos de contratações realizadas " +
       "mediante dispensa de licitação com fulcro no art. 24, incisos I e II, dessa mesma lei.'\"\n" +
       "(TCU. Acórdão nº 1.661/2011 – Plenário. Rel. Min. Weder de Oliveira. " +
       "Julgado em: 22 jun. 2011).(grifo nosso)");

    par("No caso em tela, resta configurado, por não haver previsão legal, não ser possível " +
        "a retenção do pagamento de serviço prestado pela empresa contratada " +
        (fo || "contratada") +
        ", por falta de apresentação da certidão de Regularidade dos Tributos Estadual, e mesmo " +
        "que esteja inadimplente perante o Fisco. Cabendo à Administração Pública o dever de " +
        "observar os procedimentos previstos em lei e desta forma efetuar o devido pagamento " +
        "para não dar causa ao enriquecimento ilícito.", true);

    /* notificação */
    par("Ainda cabe informar que a empresa foi notificada a apresentar no prazo de 5 " +
        "(cinco) dias úteis:", true);
    ey(LH * 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(FS);
    ["I. Justificativa para situação irregular;",
     "II. Medidas para saneamento da irregularidade;",
     "III. Requerer prazo razoável para sua efetiva regularização."]
    .forEach(item => { doc.text(item, ML + 28, y); y += LH; });
    y += 5;

  } else {
    par("Analisados os documentos constantes nos autos, verifica-se que a empresa não se " +
        "encontra em conformidade com as exigências de regularidade fiscal previstas na " +
        "legislação vigente. A manutenção da regularidade fiscal durante toda a execução " +
        "contratual é obrigação imposta pelo art. 55, XIII, da Lei nº 8.666/93. Diante da " +
        "irregularidade constatada, opina-se pela impossibilidade do pagamento até a devida " +
        "regularização.", true);
  }

  /* ══ CONCLUSÃO ══ */
  secao("3. CONCLUSÃO");

  par("Ante o exposto, analisados os documentos acostados aos autos, o pedido e a " +
      "legislação aplicável, opina-se pela " +
      (dec === "possibilidade" ? "POSSIBILIDADE" : "IMPOSSIBILIDADE") +
      " do pagamento da despesa, em favor da empresa " +
      (fo || "contratada") +
      ", cujo valor total corresponde à " + vFX + ".", true);

  ey(LH * 2 + 10); y += 4;
  doc.setFont("helvetica", "italic"); doc.setFontSize(FS);
  doc.text("É o parecer.", ML + 14, y); y += LH;
  doc.text("Salvo melhor Juízo.", ML + 14, y); y += LH + 7;

  /* ══ ASSINATURA ══ */
  const cNome = "Thiago Soares Lima";
  const cCarg = "Contador de Controle Interno";
  const cPort = "Portaria 030/2026";
  const hoje  = new Date();
  const MSES  = ["","janeiro","fevereiro","março","abril","maio","junho",
                 "julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataStr = "João Lisboa - MA, " + hoje.getDate() +
                  " de " + MSES[hoje.getMonth() + 1] + " de " + hoje.getFullYear() + ".";
  ey(42); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(FS);
  doc.text(dataStr, W - MR, y, { align: "right" }); y += 16;
  doc.setFont("helvetica", "bold");
  doc.text(cNome, W / 2, y, { align: "center" }); y += LH;
  doc.text(cCarg, W / 2, y, { align: "center" }); y += LH;
  doc.text(cPort, W / 2, y, { align: "center" });

  /* ══ RODAPÉ EM TODAS AS PÁGINAS ══ */
  const FTXT = (typeof FOOTER_TXT !== "undefined" ? FOOTER_TXT :
    "Av. Imperatriz, 1331 – Centro – João Lisboa – MA  |  CEP: 65.922-000  |  CNPJ: 07.000.300/0001-10");
  const total = doc.internal.getNumberOfPages();
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(110, 110, 110);
    doc.text(FTXT, W / 2, H - 6, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  /* ══ DOWNLOAD DIRETO ══ */
  doc.save("Liberação_Pagamento_" + (_fv(d.processo) || "doc") + ".pdf");
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE REACT
   ═══════════════════════════════════════════════════════════════════════════ */
function ParecerPage({ processos, dark, toast, appConfig }) {
  const [procSel,    setProcSel]    = React.useState("");
  const [numParecer, setNumParecer] = React.useState("");
  const [decisao,    setDecisao]    = React.useState("possibilidade");
  const [fl,         setFl]         = React.useState("16");
  const [periodo,    setPeriodo]    = React.useState("");
  const [certChecks, setCertChecks] = React.useState({});
  const [certDatas,  setCertDatas]  = React.useState({});
  const [gerando,    setGerando]    = React.useState(false);
  const [gerado,     setGerado]     = React.useState(false);
  const [erro,       setErro]       = React.useState("");

  const anoAtual = new Date().getFullYear();

  const procAtual = React.useMemo(() =>
    (processos || []).find(p => String(p["NÚMERO DO DOCUMENTO"] || "") === procSel) || null,
    [procSel, processos]);

  const procOrdenados = React.useMemo(() =>
    [...(processos || [])].sort((a, b) =>
      parseInt(b["NÚMERO DO DOCUMENTO"] || 0, 10) -
      parseInt(a["NÚMERO DO DOCUMENTO"] || 0, 10)),
    [processos]);

  function buildDados() {
    const p = procAtual || {};
    const certVencidas = CERTIDOES_LIST
      .filter(c => certChecks[c.key])
      .map(c => c.label + (certDatas[c.key] ? " (vencida em " + certDatas[c.key] + ")" : ""));
    const dataVencimento = CERTIDOES_LIST
      .filter(c => certChecks[c.key] && certDatas[c.key])
      .map(c => certDatas[c.key])[0] || "";
    return {
      numParecer:      numParecer ? numParecer + "/" + anoAtual : "",
      processo:        _fv(p["NÚMERO DO DOCUMENTO"]),
      orgao:           _fv(p["ORGÃO"]),
      fornecedor:      _fv(p["FORNECEDOR"]),
      cnpj:            _fv(p["CNPJ"]),
      objeto:          _fv(p["OBJETO"]),
      nf:              _fv(p["Nº"]),
      contrato:        _fv(p["CONTRATO"]),
      valor:           _fv(p["VALOR"]),
      certVencidas, dataVencimento, fl, periodo, decisao,
      controlador: appConfig && appConfig.controlador ? appConfig.controlador : {},
    };
  }

  function handleGerar() {
    if (!procSel)    { setErro("Selecione um processo."); return; }
    if (!numParecer) { setErro("Informe o número do parecer."); return; }
    if (!CERTIDOES_LIST.some(c => certChecks[c.key])) {
      setErro("Marque ao menos uma certidão vencida."); return;
    }
    setErro(""); setGerando(true); setGerado(false);
    setTimeout(function() {
      try {
        gerarPDFParecer(buildDados());
        setGerado(true);
        if (typeof toast === "function") toast("✅ PDF gerado e baixado com sucesso!");
      } catch (e) {
        setErro("Erro ao gerar PDF: " + e.message);
        if (typeof toast === "function") toast("❌ " + e.message, "error");
      } finally {
        setGerando(false);
      }
    }, 50);
  }

  const bg   = dark ? "#1a2820" : "#f2f4f7";
  const card = dark ? "#1e3528" : "#ffffff";
  const bdr  = dark ? "#005c1a" : "#c8d8b8";
  const tc   = dark ? "#f0fae8" : "#1a2310";
  const G    = "#006000";
  const iS   = { width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 9,
                  border: "1.5px solid " + bdr, background: dark ? "#162a1c" : "#f8faf4",
                  color: tc, outline: "none", boxSizing: "border-box" };
  const cS   = { background: card, border: "1px solid " + bdr, borderRadius: 14,
                  padding: "18px 22px", marginBottom: 18 };
  const sT   = { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase",
                  color: G, marginBottom: 14, paddingBottom: 6, borderBottom: "2px solid " + G };
  const lS   = { display: "block", fontSize: 11, fontWeight: 700, marginBottom: 5,
                  letterSpacing: ".04em", textTransform: "uppercase",
                  color: dark ? "#9ca3af" : "#64748b" };

  function Btn(props) {
    return React.createElement("button", {
      onClick: props.onClick, disabled: props.disabled,
      style: { background: props.disabled ? "#9ca3af" : (props.color || G), color: "#fff",
                border: "none", borderRadius: 10, padding: "11px 28px", fontSize: 14,
                fontWeight: 800, cursor: props.disabled ? "not-allowed" : "pointer",
                opacity: props.disabled ? 0.75 : 1, letterSpacing: ".02em" }
    }, props.children);
  }

  return React.createElement("div", { style: { flex: 1, overflowY: "auto", background: bg } },

    React.createElement("div", { style: { background: G, padding: "14px 24px",
        display: "flex", alignItems: "center", gap: 12 } },
      React.createElement("span", { style: { fontSize: 22 } }, "📝"),
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: "#fff" } },
          "Parecer Técnico — Controle Interno"),
        React.createElement("div", { style: { fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 2 } },
          "Liberação de Pagamento — dados do banco Supabase"))),

    React.createElement("div", { style: { maxWidth: 880, margin: "0 auto", padding: "18px 22px" } },

      /* PROCESSO */
      React.createElement("div", { style: cS },
        React.createElement("div", { style: sT }, "1. Selecionar Processo"),
        React.createElement("label", { style: lS }, "Processo de Pagamento"),
        React.createElement("select", {
          value: procSel,
          onChange: function(e) { setProcSel(e.target.value); setGerado(false); },
          style: Object.assign({}, iS, { fontWeight: 600 })
        },
          React.createElement("option", { value: "" }, "— Selecione um processo —"),
          procOrdenados.map(function(p) {
            var n = p["NÚMERO DO DOCUMENTO"] || "";
            var f = (p["FORNECEDOR"] || "").slice(0, 42);
            var v = p["VALOR"] ? " | " + _fmtVal(p["VALOR"]) : "";
            return React.createElement("option", { key: n, value: n },
              "Processo " + n + (f ? " — " + f : "") + v);
          })
        ),
        procAtual && React.createElement("div", {
          style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14,
                    padding: "12px 14px", background: dark ? "#003d0018" : "#f0fdf4",
                    border: "1px solid #16a34a44", borderRadius: 10 }
        },
          [["Processo", procAtual["NÚMERO DO DOCUMENTO"]], ["Empresa", procAtual["FORNECEDOR"]],
           ["Valor", _fmtVal(procAtual["VALOR"])], ["Órgão", procAtual["ORGÃO"]],
           ["Objeto", procAtual["OBJETO"]], ["NF nº", procAtual["Nº"]],
           ["Contrato", procAtual["CONTRATO"]], ["CNPJ", procAtual["CNPJ"]],
           ["Modalidade", procAtual["MODALIDADE"]]]
          .map(function(kv) {
            return kv[1] ? React.createElement("div", { key: kv[0], style: { minWidth: 0 } },
              React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: "#16a34a",
                  textTransform: "uppercase", letterSpacing: ".04em" } }, kv[0]),
              React.createElement("div", { style: { fontSize: 12, color: tc, marginTop: 2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, kv[1])) : null;
          })
        )
      ),

      /* DADOS DO PARECER */
      React.createElement("div", { style: cS },
        React.createElement("div", { style: sT }, "2. Dados do Parecer"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 } },
          React.createElement("div", null,
            React.createElement("label", { style: lS }, "Nº do Parecer"),
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("input", { type: "text", value: numParecer, placeholder: "024",
                onChange: function(e) { setNumParecer(e.target.value.replace(/\D/g, "")); },
                style: Object.assign({}, iS, { width: 90 }) }),
              React.createElement("span", { style: { fontSize: 18, fontWeight: 700, color: "#9ca3af" } }, "/"),
              React.createElement("span", { style: { fontSize: 15, fontWeight: 800, color: tc } }, anoAtual))),
          React.createElement("div", null,
            React.createElement("label", { style: lS }, "Fl. da Certidão nos Autos"),
            React.createElement("input", { type: "text", value: fl, placeholder: "16",
              onChange: function(e) { setFl(e.target.value); },
              style: iS }),
            React.createElement("div", { style: { fontSize: 11, color: "#9ca3af", marginTop: 4, fontStyle: "italic" } },
              "Folha onde consta a certidão")),
          React.createElement("div", null,
            React.createElement("label", { style: lS }, "Período da Inadimplência"),
            React.createElement("input", { type: "text", value: periodo,
              placeholder: "fevereiro e março de 2024",
              onChange: function(e) { setPeriodo(e.target.value); },
              style: iS }),
            React.createElement("div", { style: { fontSize: 11, color: "#9ca3af", marginTop: 4, fontStyle: "italic" } },
              "Opcional"))
        ),
        React.createElement("label", { style: lS }, "Decisão"),
        React.createElement("div", { style: { display: "flex", gap: 12, marginTop: 4 } },
          ["possibilidade", "impossibilidade"].map(function(op) {
            return React.createElement("label", { key: op, style: {
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              padding: "10px 16px", borderRadius: 9,
              border: "2px solid " + (decisao === op ? G : bdr),
              background: decisao === op ? (dark ? "#003d00" : "#f0fdf4") : card,
              color: decisao === op ? G : tc, fontWeight: 700, fontSize: 13, userSelect: "none"
            }},
              React.createElement("input", { type: "radio", name: "dec_parecer", value: op,
                checked: decisao === op, onChange: function() { setDecisao(op); },
                style: { accentColor: G } }),
              op === "possibilidade" ? "✅ POSSIBILIDADE" : "❌ IMPOSSIBILIDADE");
          })
        )
      ),

      /* CERTIDÕES */
      React.createElement("div", { style: cS },
        React.createElement("div", { style: sT }, "3. Certidões Vencidas / Pendentes"),
        React.createElement("p", { style: { fontSize: 12, color: dark ? "#9ca3af" : "#6b7280", marginBottom: 14 } },
          "Marque as certidões vencidas e informe a data. O nome da 1ª marcada entra no texto do parecer."),
        CERTIDOES_LIST.map(function(cert) {
          return React.createElement("div", { key: cert.key, style: {
            display: "flex", alignItems: "center", gap: 10, marginBottom: 9,
            padding: "9px 12px", borderRadius: 8, flexWrap: "wrap",
            border: "1.5px solid " + (certChecks[cert.key] ? G : bdr),
            background: certChecks[cert.key] ? (dark ? "#003d0020" : "#f0fdf4") : (dark ? "#162a1c" : "#f9fbf7")
          }},
            React.createElement("input", { type: "checkbox", id: "ck_" + cert.key,
              checked: !!certChecks[cert.key],
              onChange: function(e) { setCertChecks(function(p) { var n=Object.assign({},p); n[cert.key]=e.target.checked; return n; }); setGerado(false); },
              style: { width: 17, height: 17, accentColor: G, cursor: "pointer", flexShrink: 0 } }),
            React.createElement("label", { htmlFor: "ck_" + cert.key, style: {
              flex: 1, fontSize: 13, cursor: "pointer", userSelect: "none", minWidth: 200,
              fontWeight: certChecks[cert.key] ? 700 : 400,
              color: certChecks[cert.key] ? tc : (dark ? "#9ca3af" : "#9ca3af")
            }}, cert.label),
            certChecks[cert.key] && React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 } },
              React.createElement("span", { style: { fontSize: 11, color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" } }, "Vencida em:"),
              React.createElement("input", { type: "date",
                value: certDatas[cert.key] ? certDatas[cert.key].split("/").reverse().join("-") : "",
                onChange: function(e) {
                  var iso = e.target.value;
                  setCertDatas(function(p) {
                    var n = Object.assign({}, p);
                    if (iso) { var parts = iso.split("-"); n[cert.key] = parts[2]+"/"+parts[1]+"/"+parts[0]; }
                    else { n[cert.key] = ""; }
                    return n;
                  });
                  setGerado(false);
                },
                style: Object.assign({}, iS, { width: 165, padding: "6px 10px", fontSize: 12 }) })
            )
          );
        })
      ),

      /* GERAR */
      React.createElement("div", { style: cS },
        React.createElement("div", { style: sT }, "4. Gerar PDF"),
        erro && React.createElement("div", { style: { marginBottom: 14, padding: "10px 14px",
            borderRadius: 8, background: "#fef2f2", border: "1px solid #fca5a5",
            color: "#dc2626", fontWeight: 600, fontSize: 13 } }, "⚠️ " + erro),
        gerado && React.createElement("div", { style: { marginBottom: 14, padding: "12px 16px",
            borderRadius: 8, background: dark ? "#003d0030" : "#f0fdf4",
            border: "1px solid #4ade8088", color: "#15803d", fontWeight: 700, fontSize: 13 } },
          "✅ PDF gerado! O download foi iniciado automaticamente para a pasta Downloads."),
        React.createElement(Btn, { onClick: handleGerar, disabled: gerando },
          gerando ? "⏳ Gerando PDF..." : (gerado ? "🖨️ Gerar Novamente" : "🖨️ Gerar PDF")),
        React.createElement("div", { style: { marginTop: 12, fontSize: 11.5, color: dark ? "#6b7280" : "#9ca3af" } },
          "Arquivo: ", React.createElement("b", null, "Liberação_Pagamento_" + (procSel || "[processo]") + ".pdf"),
          " · texto jurídico completo — STJ, TCU, TJ-AL, TJ-DF")
      )
    )
  );
}

window.ParecerPage = ParecerPage;
