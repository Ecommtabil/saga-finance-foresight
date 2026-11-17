import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, FileDown, FileSpreadsheet, History, Pencil, Undo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Bloco } from "@/components/viabilidade/ui";
import { EmpresaForm } from "@/components/simples/EmpresaForm";
import { BlocoAnoAnterior, GradeAnexo } from "@/components/simples/Entradas";
import { ResultadoAnexo } from "@/components/simples/ResultadoAnexo";
import { ResumoConsolidado } from "@/components/simples/Resumo";
import { TabelasEditor } from "@/components/simples/TabelasEditor";
import { ImportarReceitas } from "@/components/simples/ImportarReceitas";
import { CaixaAlerta } from "@/components/simples/ui";
import { NOME_ORIGEM, useSimples, type EmpresaSimples } from "@/lib/simples/store";
import { calcularEmpresa } from "@/lib/simples/calculo";
import { NOME_ANEXO, tabelaParaAno, type AnexoId } from "@/lib/simples/tabelas";
import { brl, nomeArquivoSimples } from "@/lib/simples/formato";
import { baixarArquivo } from "@/lib/ncg/download";

const TITULO = "Cálculo do Simples Nacional — Empresa | Ecommtabil";
const DESC = "Receitas mês a mês por anexo, RBT12 automático, alíquota efetiva, partilha por tributo e DAS consolidado com exportação em Excel e PDF.";

export const Route = createFileRoute("/calculadoras/simples-nacional/$empresaId")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESC },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmpresaPagina,
});

type Aba = AnexoId | "resumo" | "tabelas";

function EmpresaPagina() {
  const { empresaId } = Route.useParams();
  const empresa = useSimples((s) => s.empresas.find((e) => e.id === empresaId));
  if (!empresa) {
    return (
      <div className="rounded-xl border border-via-border bg-via-surface p-8 text-center">
        <p className="text-via-ink">Empresa não encontrada neste projeto.</p>
        <Link to="/calculadoras/simples-nacional" className="mt-3 inline-block text-sm font-medium text-via-blue underline">Voltar para a lista</Link>
      </div>
    );
  }
  return <TooltipProvider delayDuration={150}><Conteudo empresa={empresa} /></TooltipProvider>;
}

function Conteudo({ empresa }: { empresa: EmpresaSimples }) {
  const { atualizarEmpresa, tabelasPorAno, historico, desfazerUltima } = useSimples();
  const [aba, setAba] = useState<Aba>(empresa.anexos[0]);
  const [editar, setEditar] = useState(false);
  const [importar, setImportar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const tabela = tabelaParaAno(tabelasPorAno, empresa.ano);
  const r = useMemo(() => calcularEmpresa(empresa, tabela.tabelas), [empresa, tabela.tabelas]);
  const atualizar = (f: (e: EmpresaSimples) => EmpresaSimples) => atualizarEmpresa(empresa.id, f);
  const hist = historico.filter((h) => h.empresaId === empresa.id);
  const abaValida: Aba = aba === "resumo" || aba === "tabelas" || empresa.anexos.includes(aba) ? aba : empresa.anexos[0];
  const abas: Array<{ id: Aba; nome: string }> = [
    ...empresa.anexos.map((a) => ({ id: a as Aba, nome: `Anexo ${a}` })),
    { id: "resumo", nome: "Resumo consolidado" },
    { id: "tabelas", nome: "Tabelas do Simples" },
  ];

  const pdf = async () => {
    setGerando(true);
    try {
      const { gerarPdfSimples } = await import("@/lib/simples/export-pdf");
      baixarArquivo(await gerarPdfSimples(empresa, r), nomeArquivoSimples(empresa.razaoSocial, empresa.ano, "pdf"));
    } catch { toast.error("Não foi possível gerar o PDF."); } finally { setGerando(false); }
  };
  const excel = async () => {
    try {
      const { exportarExcelSimples } = await import("@/lib/simples/export-excel");
      await exportarExcelSimples(empresa, r);
    } catch { toast.error("Não foi possível gerar o Excel."); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to="/calculadoras/simples-nacional" className="inline-flex items-center gap-1 text-xs font-medium text-via-muted hover:text-via-ink"><ArrowLeft className="h-3.5 w-3.5" />Empresas</Link>
          <h1 className="mt-1 truncate text-2xl font-bold text-via-ink">{empresa.razaoSocial}</h1>
          <p className="mt-1 text-sm text-via-muted">
            {empresa.cnpj ? `CNPJ ${empresa.cnpj} · ` : ""}Ano-calendário {empresa.ano} · {empresa.anexos.map((a) => `Anexo ${a}`).join(", ")} · DAS no ano <strong className="tabular-nums text-via-ink">{brl(r.consolidado.das)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditar(true)}><Pencil className="h-4 w-4" />Editar cadastro</Button>
          <Button onClick={() => setImportar(true)} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90"><Upload className="h-4 w-4 text-via-gold" />Importar receitas</Button>
          <Button variant="outline" onClick={() => void excel()}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" disabled={gerando} onClick={() => void pdf()}><FileDown className="h-4 w-4" />{gerando ? "Gerando…" : "PDF"}</Button>
        </div>
      </div>

      {r.alertasGerais.length > 0 && <div className="space-y-2">{r.alertasGerais.map((a) => <CaixaAlerta key={a.texto} nivel={a.nivel}>{a.texto}</CaixaAlerta>)}</div>}

      <BlocoAnoAnterior empresa={empresa} atualizar={atualizar} />

      <div className="sn-scroll -mx-1 px-1">
        <div role="tablist" aria-label="Seções" className="inline-flex min-w-full gap-1 rounded-xl border border-via-border bg-via-surface p-1 shadow-[var(--via-shadow)]">
          {abas.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={abaValida === a.id} onClick={() => setAba(a.id)}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${abaValida === a.id ? "bg-via-ink text-via-on-ink" : "text-via-muted hover:bg-via-paper hover:text-via-ink"}`}>
              {a.nome}
            </button>
          ))}
        </div>
      </div>

      {abaValida !== "resumo" && abaValida !== "tabelas" && (
        <div className="space-y-6" role="tabpanel">
          <p className="text-sm text-via-muted">{NOME_ANEXO[abaValida]} · tabela versão {tabela.ano}</p>
          {abaValida === "IV" && <CaixaAlerta nivel="info">No Anexo IV a CPP (INSS patronal) não está no DAS: é recolhida à parte, via GPS/DCTFWeb.</CaixaAlerta>}
          <Bloco numero={1} titulo="Receitas do mês">
            <p className="mb-3 text-xs text-via-muted">Separe a receita por tipo. Dá para colar um bloco do Excel (várias linhas e colunas) a partir de qualquer célula. Valores negativos não são aceitos.</p>
            <GradeAnexo empresa={empresa} anexo={abaValida} rbt12={r.rbt12} atualizar={atualizar} />
          </Bloco>
          {r.anexos[abaValida] && (
            <Bloco numero={2} titulo="Resultado — DAS do mês">
              <ResultadoAnexo anexo={abaValida} meses={r.anexos[abaValida]!.meses} totais={r.anexos[abaValida]!.totais} />
            </Bloco>
          )}
        </div>
      )}
      {abaValida === "resumo" && <div role="tabpanel"><ResumoConsolidado anexos={empresa.anexos} r={r} /></div>}
      {abaValida === "tabelas" && <div role="tabpanel"><TabelasEditor anoEmpresa={empresa.ano} anexosEmpresa={empresa.anexos} /></div>}

      <Bloco titulo="Histórico de importações" acao={hist[0]?.antes ? (
        <Button variant="outline" size="sm" onClick={() => { if (desfazerUltima(empresa.id)) toast.success("Última importação desfeita."); }}><Undo2 className="h-4 w-4" />Desfazer última</Button>
      ) : undefined}>
        {hist.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-via-muted"><History className="h-4 w-4" />Nenhuma importação ainda.</p>
        ) : (
          <div className="sn-scroll">
            <table className="sn-table">
              <thead><tr><th scope="col">Data</th><th scope="col" className="!text-left">Usuário</th><th scope="col" className="!text-left">Origem</th><th scope="col" className="!text-left">Arquivo</th><th scope="col">Meses</th><th scope="col">Sobrescritos</th><th scope="col">Ignorados</th></tr></thead>
              <tbody>
                {hist.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="!text-left">{h.usuario}</td>
                    <td className="!text-left">{NOME_ORIGEM[h.origem]}</td>
                    <td className="!text-left max-w-[18rem] truncate" title={h.arquivo}>{h.arquivo}</td>
                    <td>{h.meses}</td><td>{h.sobrescritos}</td><td>{h.ignorados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      <EmpresaForm aberto={editar} onFechar={() => setEditar(false)} titulo="Editar cadastro"
        inicial={{ razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj, ano: empresa.ano, anexos: empresa.anexos }}
        onSalvar={(d) => { atualizar((e) => ({ ...e, ...d })); setEditar(false); toast.success("Cadastro atualizado."); }} />
      <ImportarReceitas empresa={empresa} aberto={importar} onFechar={() => setImportar(false)} />
    </div>
  );
}
