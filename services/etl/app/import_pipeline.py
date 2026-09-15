from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO

from openpyxl import load_workbook

from app.alterdata import bp_para_mapa, extract_text_from_pdf, parse_alterdata_text
from app.aliases import alias_dre
from app.models import Balanco, DadosImportados, DRE, Modo, Premissas


@dataclass
class PipelineResult:
    dados: DadosImportados
    avisos: list[str] = field(default_factory=list)
    unmatched_accounts: list[str] = field(default_factory=list)
    match_stats: dict = field(default_factory=dict)


def _ano_from_br(date_br: str | None, fallback: int) -> int:
    if not date_br:
        return fallback
    parts = date_br.split("/")
    if len(parts) == 3 and parts[2].isdigit():
        return int(parts[2])
    return fallback


def _series(anos: list[int], valores_por_ano: dict[int, float]) -> list[float]:
    return [float(valores_por_ano.get(a, 0.0)) for a in anos]


def _balanco_from_agg(anos: list[int], por_ano: dict[int, dict[str, float]]) -> Balanco:
    def col(campo: str) -> list[float]:
        return [float(por_ano.get(a, {}).get(campo, 0.0)) for a in anos]

    caixa = col("caixa")
    receber = col("contasReceber")
    estoques = col("estoques")
    impostos_rec = col("impostosRecuperar")
    fornecedores = [abs(x) for x in col("fornecedores")]
    impostos_pag = [abs(x) for x in col("impostosRecolher")]
    salarios = [abs(x) for x in col("salarios")]
    pl = col("patrimonioLiquido")

    ativo_circ = [caixa[i] + receber[i] + estoques[i] + impostos_rec[i] for i in range(len(anos))]
    ativo_nc = [0.0] * len(anos)
    ativo_total = [ativo_circ[i] + ativo_nc[i] for i in range(len(anos))]
    passivo_circ = [fornecedores[i] + impostos_pag[i] + salarios[i] for i in range(len(anos))]
    emp_cp = [0.0] * len(anos)
    emp_lp = [0.0] * len(anos)
    passivo_nc = list(emp_lp)
    passivo_total = [passivo_circ[i] + passivo_nc[i] + pl[i] for i in range(len(anos))]

    return Balanco(
        caixa=caixa,
        contasReceber=receber,
        estoques=estoques,
        ativoCirculante=ativo_circ,
        ativoNaoCirculante=ativo_nc,
        ativoTotal=ativo_total,
        fornecedores=fornecedores,
        emprestimosCP=emp_cp,
        passivoCirculante=passivo_circ,
        emprestimosLP=emp_lp,
        passivoNaoCirculante=passivo_nc,
        patrimonioLiquido=pl,
        passivoTotal=passivo_total,
    )


def _equilibrio(balanco: Balanco) -> list[str]:
    avisos: list[str] = []
    for i, (a, p) in enumerate(zip(balanco.ativoTotal, balanco.passivoTotal, strict=False)):
        diff = round(a - p, 2)
        if abs(diff) > 0.05:
            avisos.append(f"Equação não fecha no índice {i}: Ativo {a:.2f} vs Passivo+PL {p:.2f} (Δ {diff:.2f})")
    return avisos


def process_pdf_bp(data: bytes, modo: Modo) -> PipelineResult:
    texto = extract_text_from_pdf(data)
    parsed = parse_alterdata_text(texto)
    ano_atual = _ano_from_br(parsed.periodo_atual, datetime.now().year)
    ano_ant = _ano_from_br(parsed.periodo_anterior, ano_atual - 1)

    atual_map, ant_map, unmatched = bp_para_mapa(parsed.contas)
    # Preferir exercício atual; anterior só se houver valores
    anos = [ano_atual]
    por_ano = {ano_atual: atual_map}
    if ant_map:
        anos = [ano_ant, ano_atual]
        por_ano[ano_ant] = ant_map

    balanco = _balanco_from_agg(anos, por_ano) if modo == "completa" else None
    avisos = list(parsed.avisos)
    if unmatched:
        avisos.append("Contas sem alias: " + ", ".join(unmatched[:12]))
    if balanco:
        avisos.extend(_equilibrio(balanco))

    n = len(anos)
    zeros = [0.0] * n
    dados = DadosImportados(
        modo=modo,
        empresaPlanilha=parsed.empresa or "ALTERDATA",
        anos=anos,
        dre=DRE(
            receitaBruta=zeros,
            deducoes=zeros,
            receitaLiquida=zeros,
            cmv=zeros,
            lucroBruto=zeros,
            despOperacionais=zeros,
            ebitda=zeros,
            depreciacao=zeros,
            ebit=zeros,
            resultadoFinanceiro=zeros,
            lair=zeros,
            impostos=zeros,
            lucroLiquido=zeros,
        ),
        balanco=balanco,
        premissas=Premissas(),
    )
    return PipelineResult(
        dados=dados,
        avisos=avisos,
        unmatched_accounts=unmatched,
        match_stats={
            "contas_total": len(parsed.contas),
            "matched": len(parsed.contas) - len(unmatched),
            "unmatched": len(unmatched),
            "periodo_atual": parsed.periodo_atual,
        },
    )


def process_xlsx_marketplace(data: bytes, modo: Modo, horizonte: int) -> PipelineResult:
    wb = load_workbook(BytesIO(data), data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return PipelineResult(
            dados=DadosImportados(modo=modo, anos=[datetime.now().year], dre=DRE(), balanco=None),
            avisos=["Planilha vazia"],
        )

    header = [str(c or "").strip() for c in rows[0]]
    ano = datetime.now().year
    anos = list(range(ano - max(horizonte - 1, 0), ano + 1))[-horizonte:]
    agg: dict[str, float] = {}
    unmatched: list[str] = []
    for row in rows[1:]:
        if not row:
            continue
        nome = str(row[0] or "").strip()
        if not nome:
            continue
        dest = alias_dre(nome)
        # tenta última coluna numérica como valor
        valor = 0.0
        for cell in reversed(row[1:]):
            if isinstance(cell, (int, float)):
                valor = float(cell)
                break
            if isinstance(cell, str) and cell.strip():
                try:
                    valor = float(cell.replace(".", "").replace(",", "."))
                    break
                except ValueError:
                    continue
        if not dest:
            unmatched.append(nome)
            continue
        agg[dest] = agg.get(dest, 0.0) + valor

    n = len(anos)
    def fill(key: str) -> list[float]:
        v = float(agg.get(key, 0.0))
        return [0.0] * (n - 1) + [v]

    receita = fill("receitaBruta")
    ded = fill("deducoes")
    cmv = fill("cmv")
    liquida = [receita[i] - ded[i] for i in range(n)]
    bruto = [liquida[i] - cmv[i] for i in range(n)]
    zeros = [0.0] * n
    dre = DRE(
        receitaBruta=receita,
        deducoes=ded,
        receitaLiquida=liquida,
        cmv=cmv,
        lucroBruto=bruto,
        despOperacionais=zeros,
        ebitda=bruto,
        depreciacao=zeros,
        ebit=bruto,
        resultadoFinanceiro=zeros,
        lair=bruto,
        impostos=zeros,
        lucroLiquido=bruto,
    )
    avisos = []
    if unmatched:
        avisos.append("Colunas/linhas DRE sem alias: " + ", ".join(unmatched[:12]))
    return PipelineResult(
        dados=DadosImportados(
            modo=modo,
            empresaPlanilha=header[0] if header else "Planilha",
            anos=anos,
            dre=dre,
            balanco=None if modo == "basica" else Balanco(
                caixa=zeros,
                contasReceber=zeros,
                estoques=zeros,
                ativoCirculante=zeros,
                ativoNaoCirculante=zeros,
                ativoTotal=zeros,
                fornecedores=zeros,
                emprestimosCP=zeros,
                passivoCirculante=zeros,
                emprestimosLP=zeros,
                passivoNaoCirculante=zeros,
                patrimonioLiquido=zeros,
                passivoTotal=zeros,
            ),
            premissas=Premissas(),
        ),
        avisos=avisos,
        unmatched_accounts=unmatched,
        match_stats={"matched": len(agg), "unmatched": len(unmatched)},
    )


def process_upload(data: bytes, filename: str, modo: Modo = "completa", horizonte_anos: int = 5) -> PipelineResult:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return process_pdf_bp(data, modo)
    if lower.endswith((".xlsx", ".xlsm", ".xls")):
        return process_xlsx_marketplace(data, modo, horizonte_anos)
    # tenta PDF por magic
    if data[:4] == b"%PDF":
        return process_pdf_bp(data, modo)
    return PipelineResult(
        dados=DadosImportados(modo=modo, anos=[datetime.now().year], dre=DRE(), balanco=None),
        avisos=[f"Formato não suportado: {filename}"],
        unmatched_accounts=[],
        match_stats={},
    )
