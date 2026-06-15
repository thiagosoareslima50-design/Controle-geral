/* ─── src/helpers.js ─────────────────────────────────────────────────── */

function formatData(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = s.replace(/\D/g, "");
  if (d.length >= 8) return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4,8)}`;
  return s;
}

function dtExt(d) {
  if (!d) return "";
  if (d instanceof Date) return `${d.getDate()} de ${MESES[d.getMonth() + 1]} de ${d.getFullYear()}`;
  const digs = String(d).replace(/\D/g, "");
  if (digs.length >= 8) {
    const dia = parseInt(digs.slice(0, 2), 10);
    const mes = parseInt(digs.slice(2, 4), 10);
    const ano = digs.slice(4, 8);
    if (mes >= 1 && mes <= 12) return `${dia} de ${MESES[mes]} de ${ano}`;
  }
  return String(d);
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function toISO(raw) {
  if (!raw) return todayISO();
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  const d = s.replace(/\D/g, "");
  if (d.length >= 8) return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
  return todayISO();
}

function fmtD(raw) {
  return formatData(raw);
}

function formatValor(raw) {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).replace(/[^\d]/g, "");
  if (!s) return "";
  const n = (parseInt(s, 10) / 100).toFixed(2);
  const parts = n.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return "R$ " + parts.join(",");
}

function _numsSeguros(processos) {
  return (processos || [])
    .map(p => {
      const raw = String(p["NÚMERO DO DOCUMENTO"] || "").trim();
      if (raw.startsWith("=")) return NaN;
      const n = parseInt(raw, 10);
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

function maiorNumero(processos) {
  const nums = _numsSeguros(processos);
  return nums.length ? nums.reduce((a,b) => a > b ? a : b, 0) : 0;
}

function mascararCnpjCpf(raw) {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 11) {
    const p1 = d.slice(0, 3), p2 = d.slice(3, 6), p3 = d.slice(6, 9), p4 = d.slice(9, 11);
    if (d.length <= 3) return p1;
    if (d.length <= 6) return `${p1}.${p2}`;
    if (d.length <= 9) return `${p1}.${p2}.${p3}`;
    return `${p1}.${p2}.${p3}-${p4}`;
  }
  const p1 = d.slice(0, 2), p2 = d.slice(2, 5), p3 = d.slice(5, 8), p4 = d.slice(8, 12), p5 = d.slice(12, 14);
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
  if (/^(\d)\1{10}$/.test(d)) return false;
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
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (n) => {
    let s = 0, p = n - 7;
    for (let i = 0; i < n; i++) { s += parseInt(d[i]) * p--; if (p < 2) p = 9; }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}

const STATUS_MAP = {
  analise:   { label: "Em análise", cor: "#d97706", emoji: "🟡" },
  aguardando:{ label: "Aguardando complementação", cor: "#7c3aed", emoji: "🟣" },
  aprovado:  { label: "Aprovado p/ pagamento", cor: "#16a34a", emoji: "🟢" },
  pago:      { label: "Pago", cor: "#0f172a", emoji: "⚫" },
  devolvido: { label: "Devolvido", cor: "#dc2626", emoji: "🔴" }
};

// ─── [U-5] Validação de exportação SIAFEM/TCE-MA ─────────────────────────────
// Retorna array de erros (vazio = válido). Chamada antes de exportarSIAFEM.
function validarSIAFEM(processos) {
  const erros = [];
  processos.forEach((p, i) => {
    const num = p["NÚMERO DO DOCUMENTO"] || "(sem número)";
    const cnpjRaw = String(p["CNPJ"] || "").replace(/\D/g, "");
    const cnpj = p["CNPJ"] || "";

    // CNPJ: deve ter 14 dígitos
    if (cnpj && cnpjRaw.length !== 14) {
      erros.push(`Processo ${num}: CNPJ "${cnpj}" tem ${cnpjRaw.length} dígitos (esperado 14)`);
    }

    // Data: formato dd/mm/yyyy ou yyyy-mm-dd
    const dataRaw = String(p["DATA"] || "");
    if (dataRaw && !/^\d{2}\/\d{2}\/\d{4}$/.test(dataRaw) && !/^\d{4}-\d{2}-\d{2}$/.test(dataRaw)) {
      erros.push(`Processo ${num}: DATA "${dataRaw}" não está no formato dd/mm/yyyy`);
    }

    // Valor: deve ser numérico parseável
    const valorRaw = String(p["VALOR"] || "");
    if (valorRaw) {
      const parseado = parseFloat(valorRaw.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
      if (isNaN(parseado) || parseado < 0) {
        erros.push(`Processo ${num}: VALOR "${valorRaw}" não é numérico válido`);
      }
    }

    // Órgão: não pode estar vazio
    if (!p["ORGÃO"] || !p["ORGÃO"].trim()) {
      erros.push(`Processo ${num}: campo ÓRGÃO está vazio`);
    }

    // CNPJ: dígitos verificadores válidos
    if (cnpjRaw.length === 14 && !validarCNPJ(cnpjRaw)) {
      erros.push(`Processo ${num}: CNPJ "${cnpj}" falhou validação de dígitos`);
    }
  });
  return erros;
}

function normalizarOrgao(raw) {
  if (!raw) return "";
  let s = String(raw).trim().toUpperCase();
  
  // Remove acentos e caracteres especiais para facilitar a comparação
  const normalizado = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, "");
  
  // 1. Secretaria de Transportes / Obras / Serviços Urbanos
  if (normalizado.includes("TRANSPORTES OBRAS") || normalizado.includes("TRANSPORTES, OBRAS") || normalizado.includes("OBRAS E SERVICOS URBANOS") || normalizado.includes("TRANSPORTES OBRAS E SERVICOS")) {
    return "SECRETARIA MUNICIPAL DE TRANSPORTES, OBRAS E SERVIÇOS URBANOS";
  }
  
  // 2. FUNDEB
  if (normalizado.includes("FUNDEB") || normalizado.includes("DESENVOLVIMENTO DA EDUCACAO BASICA")) {
    return "FUNDO DE DESENVOLVIMENTO DA EDUCAÇÃO BÁSICA - FUNDEB";
  }
  
  // 3. Fundo Municipal de Saúde
  if (normalizado.includes("FUNDO MUNICIPAL DE SAUDE") || normalizado.includes("FMS")) {
    return "FUNDO MUNICIPAL DE SAÚDE";
  }
  
  // 4. SAAE
  if (normalizado.includes("SERVICO AUTONOMO DE AGUA") || normalizado.includes("SAAE")) {
    return "SERVIÇO AUTÔNOMO DE ÁGUA E ESGOTO - SAAE";
  }
  
  // 5. Secretaria Municipal de Educação
  if (normalizado === "SECRETARIA DE EDUCACAO" || normalizado === "SECRETARIA MUNICIPAL DE EDUCACAO" || normalizado.includes("SECRETARIA MUNICIPAL DE EDUCACAO")) {
    return "SECRETARIA MUNICIPAL DE EDUCAÇÃO";
  }
  
  // 6. Secretaria Municipal de Administração
  if (normalizado === "SECRETARIA DE ADMINISTRACAO" || normalizado === "SECRETARIA MUNICIPAL DE ADMINISTRACAO" || normalizado.includes("SECRETARIA MUNICIPAL DE ADMINISTRACAO")) {
    return "SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO";
  }
  
  // 7. Secretaria Municipal de Cultura e Turismo
  if (normalizado.includes("CULTURA E TURISMO")) {
    return "SECRETARIA MUNICIPAL DE CULTURA E TURISMO";
  }

  return s;
}
