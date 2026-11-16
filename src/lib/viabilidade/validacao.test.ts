// Prompt 7 — confere os resultados das premissas padrão com tolerância de R$ 1,00 e 0,1 p.p.
import { describe, expect, it } from "vitest";
import { calcularNovaLinha, PADRAO_NOVA_LINHA, parecerNovaLinha, tornadoNovaLinha } from "./nova-linha";
import { calcularComprarAlugar, PADRAO_COMPRAR_ALUGAR, relatorioComprarAlugar, revendaEmpate } from "./comprar-alugar";
import { calcularMaquina, mensalidadeEquilibrio, PADRAO_MAQUINA, relatorioMaquina } from "./maquina-leasing";
import { calcularEquipe, PADRAO_EQUIPE, pontoInflexao, relatorioEquipe, tabelaFuncionarios } from "./equipe-terceirizar";

const reais = (atual: number, esperado: number) => expect(Math.abs(atual - esperado)).toBeLessThanOrEqual(1);
const pp = (atual: number, esperado: number) => expect(Math.abs(atual - esperado)).toBeLessThanOrEqual(0.001);

describe("Nova Linha de Produtos (padrão)", () => {
  const r = calcularNovaLinha(PADRAO_NOVA_LINHA);
  it("DRE do Ano 1 usa custo unitário × volume", () => {
    reais(r.receitaBruta[1], 600000);
    reais(r.custosVar[1], 340000);
    reais(r.lajir[1], 128000);
    reais(r.lucroLiquido[1], 84480);
  });
  it("FCL anual", () => {
    reais(r.fcl[0], -300000);
    for (let t = 1; t <= 4; t++) reais(r.fcl[t], 126480);
    reais(r.fcl[5], 216480);
  });
  it("VPL, TIR, payback e parecer", () => {
    reais(r.vpl, 207000.51);
    pp(r.tir!, 0.351);
    expect(Math.abs(r.pbS! - 2.37)).toBeLessThan(0.01);
    expect(parecerNovaLinha(PADRAO_NOVA_LINHA, r).titulo).toBe("PROJETO VIÁVEL");
  });
  it("prejuízo não gera IR negativo e projeto ruim é inviável", () => {
    const ruim = calcularNovaLinha({ ...PADRAO_NOVA_LINHA, preco: 90 });
    expect(Math.min(...ruim.ir)).toBe(0);
    expect(parecerNovaLinha({ ...PADRAO_NOVA_LINHA, preco: 90 }, ruim).titulo).toBe("PROJETO INVIÁVEL");
  });
  it("horizonte ajusta o número de anos (3 a 10)", () => {
    expect(calcularNovaLinha({ ...PADRAO_NOVA_LINHA, horizonte: 8 }).fcl).toHaveLength(9);
    expect(calcularNovaLinha({ ...PADRAO_NOVA_LINHA, horizonte: 20 }).N).toBe(10);
    expect(calcularNovaLinha({ ...PADRAO_NOVA_LINHA, horizonte: 1 }).N).toBe(3);
  });
  it("tornado ordenado do maior para o menor impacto", () => {
    const t = tornadoNovaLinha(PADRAO_NOVA_LINHA);
    expect(t.itens[0].nome).toBe("Preço");
    for (let i = 1; i < t.itens.length; i++) expect(t.itens[i - 1].amplitude).toBeGreaterThanOrEqual(t.itens[i].amplitude);
  });
});

describe("Comprar ou Alugar (padrão)", () => {
  const r = calcularComprarAlugar(PADRAO_COMPRAR_ALUGAR);
  it("VPLs e parecer", () => {
    reais(r.vplComprar, -392205.93);
    reais(r.vplAlugar, -249641.63);
    reais(r.vplIncremental, -142564.3);
    expect(relatorioComprarAlugar(PADRAO_COMPRAR_ALUGAR).parecer.titulo).toContain("ALUGAR");
  });
  it("revenda de empate zera o VPL incremental", () => {
    const e = revendaEmpate(PADRAO_COMPRAR_ALUGAR)!;
    expect(e).toBeGreaterThan(PADRAO_COMPRAR_ALUGAR.revenda);
    expect(Math.abs(calcularComprarAlugar({ ...PADRAO_COMPRAR_ALUGAR, revenda: e }).vplIncremental)).toBeLessThan(0.01);
  });
  it("sem tributar o ganho, comprar fica melhor", () => {
    expect(calcularComprarAlugar({ ...PADRAO_COMPRAR_ALUGAR, tributarGanho: false }).vplIncremental).toBeGreaterThan(r.vplIncremental);
  });
});

describe("Máquina: Compra vs Leasing (padrão, manutenção inclusa)", () => {
  const r = calcularMaquina(PADRAO_MAQUINA);
  it("VPL, CAUE e parecer", () => {
    reais(r.vplCompra, -154758.3);
    reais(r.caueCompra, -42931.46);
    reais(r.vplLeasing, -119909.28);
    reais(r.caueLeasing, -33264);
    expect(relatorioMaquina(PADRAO_MAQUINA).parecer.titulo).toBe("LEASING (menor custo descontado)");
  });
  it("mensalidade de equilíbrio iguala os VPLs", () => {
    const m = mensalidadeEquilibrio(PADRAO_MAQUINA)!;
    const x = calcularMaquina({ ...PADRAO_MAQUINA, leasingMensal: m });
    expect(Math.abs(x.vplLeasing - x.vplCompra)).toBeLessThan(0.01);
  });
  it("manutenção não inclusa aumenta o custo do leasing", () => {
    const x = calcularMaquina({ ...PADRAO_MAQUINA, manutInclusa: false, manutLeasing: 10000 });
    expect(x.vplLeasing).toBeLessThan(r.vplLeasing);
  });
});

describe("Equipe Interna vs Terceirizar (padrão)", () => {
  const r = calcularEquipe(PADRAO_EQUIPE);
  it("fluxos do Ano 1, VPLs e parecer", () => {
    reais(r.fluxoInterno[1], -344799.16);
    reais(r.fluxoTerc[1], -300960);
    reais(r.vplInterno, -1380777);
    reais(r.vplTerc, -1185797.73);
    expect(relatorioEquipe(PADRAO_EQUIPE).parecer.titulo).toBe("RECOMENDA-SE TERCEIRIZAR (menor custo/risco)");
  });
  it("ponto de inflexão iguala os VPLs", () => {
    const m = pontoInflexao(PADRAO_EQUIPE)!;
    expect(m).toBeGreaterThan(PADRAO_EQUIPE.mensalidade);
    reais(calcularEquipe({ ...PADRAO_EQUIPE, mensalidade: m }).vplTerc, r.vplInterno);
  });
  it("tabela de 1 a 15 funcionários", () => {
    const t = tabelaFuncionarios(PADRAO_EQUIPE);
    expect(t).toHaveLength(15);
    expect(t[0].melhor).toBe("interno");
    expect(t[14].melhor).toBe("terceirizado");
  });
});
