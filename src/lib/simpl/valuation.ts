import type { Cenario, EmpresaSimpl } from "./types";
import type { Projecao } from "./engine";

export interface DcfResultado {
  ke: number;
  kd: number;
  kdLiquido: number;
  wacc: number;
  aliqIR: number;
  anos: {
    rotulo: string;
    nopat: number;
    da: number;
    capex: number;
    varNcg: number;
    fcff: number;
    fatorDesconto: number;
    vp: number;
  }[];
  somaVp: number;
  valorTerminal: number;
  vpTerminal: number;
  enterpriseValue: number;
  dividaLiquida: number;
  equityValue: number;
  evEbitda: number;
  ebitdaUltimo: number;
}

export function calcularDcf(
  empresa: EmpresaSimpl,
  cenario: Cenario,
  proj: Projecao,
): DcfResultado {
  const v = cenario.valuation;
  const aliqIR = empresa.regime === "real" ? 0.34 : empresa.regime === "presumido" ? 0.24 : 0;
  const cdi = cenario.premissas.selic[0] ?? 0.105;
  const ke = v.rf + v.beta * v.erp + v.riscoPais + v.riscoEspecifico;
  const kd = cdi + v.spreadDivida;
  const kdLiquido = kd * (1 - aliqIR);
  const we = Math.min(1, Math.max(0, v.pesoEquity));
  const wacc = we * ke + (1 - we) * kdLiquido;

  const anos = proj.anual.map((a, i) => {
    const nopat = a.ebit * (1 - aliqIR);
    const fcff = nopat + a.depreciacao - a.capex - a.variacaoNcg;
    const fator = Math.pow(1 + wacc, i + 1);
    return {
      rotulo: a.rotulo,
      nopat,
      da: a.depreciacao,
      capex: a.capex,
      varNcg: a.variacaoNcg,
      fcff,
      fatorDesconto: 1 / fator,
      vp: fcff / fator,
    };
  });

  const somaVp = anos.reduce((s, a) => s + a.vp, 0);
  const ultimo = anos[anos.length - 1];
  const g = v.gPerp;
  const valorTerminal = wacc > g && ultimo ? (ultimo.fcff * (1 + g)) / (wacc - g) : 0;
  const vpTerminal = valorTerminal / Math.pow(1 + wacc, anos.length);
  const enterpriseValue = somaVp + vpTerminal;

  const ultimoMes = proj.mensal[proj.mensal.length - 1];
  const dividaLiquida = ultimoMes
    ? ultimoMes.dividaCP + ultimoMes.dividaLP + ultimoMes.rotativoSaldo - ultimoMes.caixa
    : 0;
  const ebitdaUltimo = proj.anual[proj.anual.length - 1]?.ebitda ?? 0;

  return {
    ke,
    kd,
    kdLiquido,
    wacc,
    aliqIR,
    anos,
    somaVp,
    valorTerminal,
    vpTerminal,
    enterpriseValue,
    dividaLiquida,
    equityValue: enterpriseValue - dividaLiquida,
    ebitdaUltimo,
    evEbitda: ebitdaUltimo ? enterpriseValue / ebitdaUltimo : 0,
  };
}

export function gradeSensibilidade(
  base: DcfResultado,
  gBase: number,
): { waccs: number[]; gs: number[]; ev: number[][] } {
  const waccs = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => base.wacc + d);
  const gs = [-0.01, -0.005, 0, 0.005, 0.01].map((d) => gBase + d);
  const ev = waccs.map((w) =>
    gs.map((g) => {
      if (w <= g) return NaN;
      const somaVp = base.anos.reduce((s, a, i) => s + a.fcff / Math.pow(1 + w, i + 1), 0);
      const ultimo = base.anos[base.anos.length - 1];
      const tv = ultimo ? (ultimo.fcff * (1 + g)) / (w - g) : 0;
      return somaVp + tv / Math.pow(1 + w, base.anos.length);
    }),
  );
  return { waccs, gs, ev };
}
