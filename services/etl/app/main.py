from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Any

import psycopg
import sentry_sdk
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.gliner_client import map_accounts_with_gliner
from app.import_pipeline import process_upload
from app.models import DadosImportados, Modo, ProjetoCreate, ProjetoOut

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saga:saga@localhost:5432/saga")
ETL_API_KEY = os.getenv("ETL_API_KEY", "dev-etl-key")
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "30"))
SENTRY_DSN = os.getenv("SENTRY_DSN", "")

if SENTRY_DSN:
    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0.1)

app = FastAPI(title="SAGA ETL", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rate_bucket: dict[str, list[float]] = defaultdict(list)


def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    if not x_api_key or x_api_key != ETL_API_KEY:
        raise HTTPException(status_code=401, detail="API key inválida")


def rate_limit(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    key = x_api_key or "anon"
    now = time.time()
    window = _rate_bucket[key]
    _rate_bucket[key] = [t for t in window if now - t < 60]
    if len(_rate_bucket[key]) >= RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="Rate limit excedido")
    _rate_bucket[key].append(now)


def db() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/projetos", response_model=ProjetoOut, dependencies=[Depends(require_api_key), Depends(rate_limit)])
def criar_projeto(body: ProjetoCreate) -> ProjetoOut:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO grupo_empresas (nome)
                VALUES (%s)
                RETURNING id
                """,
                (body.grupo_nome,),
            )
            grupo_id = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO empresa (grupo_id, cnpj, razao_social, nome_fantasia)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (grupo_id, body.cnpj, body.razao_social, body.nome_fantasia),
            )
            empresa_id = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO projeto (empresa_id, nome, modo, payload_json)
                VALUES (%s, %s, %s, %s::jsonb)
                RETURNING id, nome, modo, payload_json
                """,
                (empresa_id, body.nome, body.modo, body.payload.model_dump_json()),
            )
            row = cur.fetchone()
            for ano in body.payload.anos:
                cur.execute(
                    "INSERT INTO periodo (projeto_id, ano) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (row[0], ano),
                )
            conn.commit()
            return ProjetoOut(id=str(row[0]), nome=row[1], modo=row[2], payload=DadosImportados.model_validate(row[3]))


@app.get("/projetos/{projeto_id}", response_model=ProjetoOut, dependencies=[Depends(require_api_key), Depends(rate_limit)])
def obter_projeto(projeto_id: str) -> ProjetoOut:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, nome, modo, payload_json FROM projeto WHERE id = %s",
                (projeto_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Projeto não encontrado")
            return ProjetoOut(
                id=str(row[0]),
                nome=row[1],
                modo=row[2],
                payload=DadosImportados.model_validate(row[3]),
            )


class ImportResponse(BaseModel):
    ok: bool = True
    dados: DadosImportados
    avisos: list[str] = Field(default_factory=list)
    match_stats: dict[str, Any] = Field(default_factory=dict)


@app.post("/etl/import", response_model=ImportResponse, dependencies=[Depends(require_api_key), Depends(rate_limit)])
async def etl_import(
    file: UploadFile = File(...),
    modo: Modo = Form("completa"),
    horizonte_anos: int = Form(5),
    use_gliner: bool = Form(False),
) -> ImportResponse:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    nome = file.filename or "upload.bin"
    resultado = process_upload(raw, nome, modo=modo, horizonte_anos=horizonte_anos)

    if use_gliner or os.getenv("GLINER_ENABLED", "false").lower() == "true":
        mapped, stats = map_accounts_with_gliner(resultado.unmatched_accounts)
        resultado.avisos.extend(mapped)
        resultado.match_stats.update(stats)

    return ImportResponse(
        ok=True,
        dados=resultado.dados,
        avisos=resultado.avisos,
        match_stats=resultado.match_stats,
    )
