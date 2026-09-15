from __future__ import annotations

import re
from dataclasses import dataclass, field
from io import BytesIO

from pypdf import PdfReader

from app.aliases import alias_bp, normalizar


@dataclass
class ContaBp:
    nome: str
    atual: float
    anterior: float


@dataclass
class ParseBpResult:
    empresa: str
    periodo_atual: str | None
    periodo_anterior: str | None
    contas: list[ContaBp] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)


def _parse_valor_dc(raw: str) -> tuple[float, str]:
    raw = raw.strip()
    lado = raw[-1].upper() if raw else ""
    num = re.sub(r"[^\d,]", "", raw)
    num = num.replace(".", "").replace(",", ".")
    try:
        valor = float(num) if num else 0.0
    except ValueError:
        valor = 0.0
    return valor, lado if lado in {"D", "C"} else ""


def _valor_contabil(valor: float, lado: str, classificacao: str, nome: str) -> float:
    if abs(valor) < 1e-9:
        return 0.0
    n = nome.lower()
    if "prejuízo" in n or "prejuizo" in n or "(-)" in nome:
        return -abs(valor)
    if classificacao.startswith("1."):
        return -abs(valor) if lado == "C" else abs(valor)
    if classificacao.startswith("2.3"):
        return abs(valor) if lado == "C" else -abs(valor)
    if classificacao.startswith("2."):
        return -abs(valor) if lado == "C" else abs(valor)
    return -abs(valor) if lado == "C" else abs(valor)


def _parse_linha(linha: str) -> ContaBp | None:
    linha = re.sub(r"\s+", " ", linha).strip()
    # Senzi: 18.231,36D0,00D Nome (63) 1.1.01...
    m = re.match(
        r"^(?P<atual>[\d.*]+,\d{2}\s*[DC])\s*(?P<anterior>[\d.*]+,\d{2}\s*[DC])\s+(?P<resto>.+)$",
        linha,
        re.I,
    )
    if not m:
        return None
    resto = m.group("resto").strip()
    if resto.startswith("=") or resto.startswith("*") or "total" in normalizar(resto):
        return None
    classif = ""
    cm = re.search(r"(\d+(?:\.\d+){2,})\s*$", resto)
    if cm:
        classif = cm.group(1)
        resto = resto[: -len(cm.group(0))].strip()
    resto = re.sub(r"\s*\(\d+\)\s*$", "", resto).strip()
    if not classif:
        return None
    v_atual, lado_a = _parse_valor_dc(m.group("atual"))
    v_ant, lado_b = _parse_valor_dc(m.group("anterior"))
    return ContaBp(
        nome=resto,
        atual=_valor_contabil(v_atual, lado_a, classif, resto),
        anterior=_valor_contabil(v_ant, lado_b, classif, resto),
    )


def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def parse_alterdata_text(texto: str) -> ParseBpResult:
    empresa = ""
    m_emp = re.search(r"^([^\n(]+)\(\d+\)", texto, re.M)
    if m_emp:
        empresa = m_emp.group(1).strip()

    periodo_atual = None
    m_enc = re.search(r"Encerrado\s+em\s+(\d{2}/\d{2}/\d{4})", texto, re.I)
    if m_enc:
        periodo_atual = m_enc.group(1)
    periodo_anterior = None
    if periodo_atual:
        d, mth, y = periodo_atual.split("/")
        periodo_anterior = f"{d}/{mth}/{int(y) - 1}"

    contas: list[ContaBp] = []
    seen: set[str] = set()
    for linha in texto.splitlines():
        parsed = _parse_linha(linha)
        if not parsed:
            continue
        key = normalizar(parsed.nome)
        if key in seen:
            continue
        seen.add(key)
        contas.append(parsed)

    avisos: list[str] = []
    if not contas:
        avisos.append("Nenhuma conta analítica ALTERDATA encontrada.")
    return ParseBpResult(
        empresa=empresa,
        periodo_atual=periodo_atual,
        periodo_anterior=periodo_anterior,
        contas=contas,
        avisos=avisos,
    )


def bp_para_mapa(contas: list[ContaBp]) -> tuple[dict[str, float], dict[str, float], list[str]]:
    """Agrega contas do exercício atual/anterior nos campos do Balanco Saga (+ extras)."""
    atual: dict[str, float] = {}
    anterior: dict[str, float] = {}
    unmatched: list[str] = []
    for c in contas:
        dest = alias_bp(c.nome)
        if not dest:
            unmatched.append(c.nome)
            continue
        if abs(c.atual) >= 1e-9:
            atual[dest] = atual.get(dest, 0.0) + c.atual
        if abs(c.anterior) >= 1e-9:
            anterior[dest] = anterior.get(dest, 0.0) + c.anterior
    return atual, anterior, unmatched
