-- ═══════════════════════════════════════════════════════════════════════════════
-- ControleGeral v5.1.5 — Configuração completa do banco Supabase
-- Execute no SQL Editor: seu-projeto.supabase.co → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabela principal (chave/valor) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cgel_store (
  chave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. Tabela de Histórico indexada (NOVO v4.0) ──────────────────────────────
CREATE TABLE IF NOT EXISTS cgel_historico (
  id            BIGSERIAL     PRIMARY KEY,
  num_processo  TEXT          NOT NULL,
  orgao         TEXT,
  fornecedor    TEXT,
  cnpj          TEXT,
  valor         TEXT,
  tipo_key      TEXT,
  decisao       TEXT,
  status        TEXT          DEFAULT 'analise',
  usuario       TEXT,
  registrado_em TIMESTAMPTZ   DEFAULT NOW(),
  dados         JSONB         NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_num_unico ON cgel_historico(num_processo);
CREATE INDEX        IF NOT EXISTS idx_hist_orgao     ON cgel_historico(orgao);
CREATE INDEX        IF NOT EXISTS idx_hist_decisao   ON cgel_historico(decisao);
CREATE INDEX        IF NOT EXISTS idx_hist_data      ON cgel_historico(registrado_em DESC);

-- ─── 3. Tabela de Auditoria (NOVO v4.0) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS cgel_auditoria (
  id       BIGSERIAL   PRIMARY KEY,
  num_proc TEXT,
  acao     TEXT        NOT NULL,
  usuario  TEXT,
  ts       TIMESTAMPTZ DEFAULT NOW(),
  campos   JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_proc ON cgel_auditoria(num_proc);
CREATE INDEX IF NOT EXISTS idx_audit_ts   ON cgel_auditoria(ts DESC);

-- ─── 4. Row Level Security (autorização por token de app) ───────────────────
ALTER TABLE cgel_store     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgel_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgel_auditoria ENABLE ROW LEVEL SECURITY;

-- Criar políticas de leitura e escrita públicas para acesso simplificado
CREATE POLICY "Acesso público leitura store" ON cgel_store FOR SELECT USING (true);
CREATE POLICY "Acesso público escrita store" ON cgel_store FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público update store" ON cgel_store FOR UPDATE USING (true);
CREATE POLICY "Acesso público delete store" ON cgel_store FOR DELETE USING (true);

CREATE POLICY "Acesso público leitura hist" ON cgel_historico FOR SELECT USING (true);
CREATE POLICY "Acesso público escrita hist" ON cgel_historico FOR INSERT WITH CHECK (true);
CREATE POLICY "Acesso público update hist" ON cgel_historico FOR UPDATE USING (true);

CREATE POLICY "Acesso público leitura aud" ON cgel_auditoria FOR SELECT USING (true);
CREATE POLICY "Acesso público escrita aud" ON cgel_auditoria FOR INSERT WITH CHECK (true);

-- ─── 5. Versão inicial para ETag polling ─────────────────────────────────────
INSERT INTO cgel_store (chave, valor)
VALUES ('_versao_banco', '1')
ON CONFLICT (chave) DO NOTHING;
