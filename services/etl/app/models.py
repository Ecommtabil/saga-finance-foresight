from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Modo = Literal["basica", "completa"]


class DRE(BaseModel):
    receitaBruta: list[float] = Field(default_factory=list)
    deducoes: list[float] = Field(default_factory=list)
    receitaLiquida: list[float] = Field(default_factory=list)
    cmv: list[float] = Field(default_factory=list)
    lucroBruto: list[float] = Field(default_factory=list)
    despOperacionais: list[float] = Field(default_factory=list)
    ebitda: list[float] = Field(default_factory=list)
    depreciacao: list[float] = Field(default_factory=list)
    ebit: list[float] = Field(default_factory=list)
    resultadoFinanceiro: list[float] = Field(default_factory=list)
    lair: list[float] = Field(default_factory=list)
    impostos: list[float] = Field(default_factory=list)
    lucroLiquido: list[float] = Field(default_factory=list)


class Balanco(BaseModel):
    caixa: list[float] = Field(default_factory=list)
    contasReceber: list[float] = Field(default_factory=list)
    estoques: list[float] = Field(default_factory=list)
    ativoCirculante: list[float] = Field(default_factory=list)
    ativoNaoCirculante: list[float] = Field(default_factory=list)
    ativoTotal: list[float] = Field(default_factory=list)
    fornecedores: list[float] = Field(default_factory=list)
    emprestimosCP: list[float] = Field(default_factory=list)
    passivoCirculante: list[float] = Field(default_factory=list)
    emprestimosLP: list[float] = Field(default_factory=list)
    passivoNaoCirculante: list[float] = Field(default_factory=list)
    patrimonioLiquido: list[float] = Field(default_factory=list)
    passivoTotal: list[float] = Field(default_factory=list)


class Premissas(BaseModel):
    selic: float = 0.105
    cdi: float = 0.105
    ipca: float = 0.045
    rf: float = 0.06
    beta: float = 1.0
    erp: float = 0.05
    aliquotaIR: float = 0.34
    custoDivida: float = 0.12
    dividaTotal: float = 0.0
    equityMercado: float = 0.0
    crescimentoPerp: float = 0.025
    crescimentoProj: float = 0.05


class DadosImportados(BaseModel):
    modo: Modo
    empresaPlanilha: str = ""
    anos: list[int] = Field(default_factory=list)
    dre: DRE = Field(default_factory=DRE)
    balanco: Balanco | None = None
    premissas: Premissas = Field(default_factory=Premissas)


class ProjetoCreate(BaseModel):
    grupo_nome: str
    cnpj: str
    razao_social: str
    nome_fantasia: str | None = None
    nome: str
    modo: Modo
    payload: DadosImportados


class ProjetoOut(BaseModel):
    id: str
    nome: str
    modo: Modo
    payload: DadosImportados
