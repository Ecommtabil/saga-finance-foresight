-- SAGA schema inicial: grupos, CNPJs, projetos, períodos, importações
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS grupo_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES grupo_empresas(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cnpj)
);

CREATE INDEX IF NOT EXISTS idx_empresa_grupo ON empresa(grupo_id);

CREATE TABLE IF NOT EXISTS projeto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  modo TEXT NOT NULL CHECK (modo IN ('basica', 'completa')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_empresa ON projeto(empresa_id);

CREATE TABLE IF NOT EXISTS periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES projeto(id) ON DELETE CASCADE,
  ano INT NOT NULL,
  UNIQUE (projeto_id, ano)
);

CREATE TABLE IF NOT EXISTS importacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES projeto(id) ON DELETE CASCADE,
  fonte TEXT NOT NULL,
  modo TEXT NOT NULL CHECK (modo IN ('basica', 'completa')),
  status TEXT NOT NULL DEFAULT 'recebido',
  resultado_json JSONB,
  avisos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artifact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id UUID NOT NULL REFERENCES importacao(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  content_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
