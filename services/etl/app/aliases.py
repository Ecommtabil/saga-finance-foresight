from __future__ import annotations

import re
import unicodedata


def normalizar(texto: str) -> str:
    t = unicodedata.normalize("NFD", texto.strip().lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", t)


# conta origem normalizada → campo Balanco / agregação
BP_ALIASES: dict[str, str] = {
    "caixa": "caixa",
    "bancos": "caixa",
    "bancodobrasil": "caixa",
    "bancodobrasilsa": "caixa",
    "mercadopago": "caixa",
    "disponibilidades": "caixa",
    "bancoscontamovimento": "caixa",
    "duplicatasareceber": "contasReceber",
    "contasareceber": "contasReceber",
    "clientes": "contasReceber",
    "mercadoria": "estoques",
    "mercadorias": "estoques",
    "estoque": "estoques",
    "estoques": "estoques",
    "icmsarecuperar": "impostosRecuperar",
    "cofinsarecuperar": "impostosRecuperar",
    "pisarecuperar": "impostosRecuperar",
    "impostosarecuperar": "impostosRecuperar",
    "fornecedoresapagar": "fornecedores",
    "fornecedores": "fornecedores",
    "difalicms": "impostosRecolher",
    "icmsarecolher": "impostosRecolher",
    "cofinsarecolher": "impostosRecolher",
    "impostosarecolher": "impostosRecolher",
    "decimoterceirosalarioapagar": "salarios",
    "feriasapagar": "salarios",
    "fgtsarecolher": "salarios",
    "inssarecolher": "salarios",
    "salariosapagar": "salarios",
    "capitalsocial": "patrimonioLiquido",
    "capitalsocialsubscrito": "patrimonioLiquido",
    "lucrosacumulados": "patrimonioLiquido",
    "prejuizosacumulados": "patrimonioLiquido",
}

DRE_ALIASES: dict[str, str] = {
    "receitabruta": "receitaBruta",
    "receitaporproduto": "receitaBruta",
    "cmv": "cmv",
    "custodasmercadorias": "cmv",
    "deducoes": "deducoes",
    "tarifadevendaeimpostos": "deducoes",
}


def alias_bp(nome: str) -> str | None:
    n = normalizar(nome)
    if n in BP_ALIASES:
        return BP_ALIASES[n]
    for chave, dest in sorted(BP_ALIASES.items(), key=lambda x: -len(x[0])):
        if len(chave) >= 8 and chave in n:
            return dest
    if n.startswith("banco"):
        return "caixa"
    if "arecuperar" in n:
        return "impostosRecuperar"
    if "arecolher" in n and "fgts" not in n and "inss" not in n:
        return "impostosRecolher"
    return None


def alias_dre(nome: str) -> str | None:
    n = normalizar(nome)
    if n in DRE_ALIASES:
        return DRE_ALIASES[n]
    for chave, dest in sorted(DRE_ALIASES.items(), key=lambda x: -len(x[0])):
        if len(chave) >= 6 and chave in n:
            return dest
    return None
