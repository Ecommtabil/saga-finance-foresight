import { useEffect, useRef, useState } from "react";
import { Download, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { baixarArquivo } from "@/lib/ncg/download";
import { rotuloMes } from "@/lib/simples/projecao";
import type { DadosRelatorioProjecao } from "@/lib/simples/relatorio-projecao";

const CHAVE_RESP = "saga.simples.relatorio.responsavel";

function nomePadrao(razao: string, mesProximo: number) {
  const nome = razao.trim().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_").slice(0, 60) || "Empresa";
  return `Ecommtabil_Projecao_Simples_${nome}_${rotuloMes(mesProximo).replace("/", "-")}`;
}

export function RelatorioProjecaoDialog({ aberto, onFechar, dados }: {
  aberto: boolean;
  onFechar: () => void;
  dados: Omit<DadosRelatorioProjecao, "responsavel" | "observacao">;
}) {
  const padrao = nomePadrao(dados.empresa.razaoSocial, dados.projecao.mesProximo);
  const [arquivo, setArquivo] = useState(padrao);
  const [responsavel, setResponsavel] = useState("");
  const [observacao, setObservacao] = useState("");
  const [pdf, setPdf] = useState<{ url: string; blob: Blob } | null>(null);
  const [gerando, setGerando] = useState(false);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  const gerar = async (resp = responsavel, obs = observacao) => {
    setGerando(true);
    try {
      const { gerarRelatorioProjecao } = await import("@/lib/simples/relatorio-projecao");
      const blob = gerarRelatorioProjecao({ ...dadosRef.current, responsavel: resp, observacao: obs });
      setPdf((ant) => { if (ant) URL.revokeObjectURL(ant.url); return { url: URL.createObjectURL(blob), blob }; });
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    } finally { setGerando(false); }
  };

  useEffect(() => {
    if (!aberto) return;
    const resp = localStorage.getItem(CHAVE_RESP) ?? "";
    setResponsavel(resp);
    setArquivo(padrao);
    void gerar(resp, observacao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    if (!aberto && pdf) { URL.revokeObjectURL(pdf.url); setPdf(null); }
  }, [aberto, pdf]);

  const baixar = () => {
    if (!pdf) return;
    localStorage.setItem(CHAVE_RESP, responsavel.trim());
    const nome = (arquivo.trim() || padrao).replace(/\.pdf$/i, "");
    baixarArquivo(pdf.blob, `${nome}.pdf`);
    toast.success("Relatório baixado.");
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="border-b p-5 pb-3">
          <DialogTitle>Relatório para o cliente — projeção da alíquota</DialogTitle>
          <DialogDescription>Relatório em A4 pronto para envio. Ajuste os campos e clique em “Atualizar pré-visualização”.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 md:grid-cols-[290px_1fr]">
          <div className="space-y-4 overflow-y-auto border-b p-4 md:border-b-0 md:border-r">
            <div className="space-y-1.5">
              <Label htmlFor="rp-arquivo">Nome do arquivo</Label>
              <div className="flex items-center gap-1">
                <Input id="rp-arquivo" value={arquivo} onChange={(e) => setArquivo(e.target.value)} placeholder={padrao} />
                <span className="text-xs text-muted-foreground">.pdf</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-resp">Responsável (assinatura)</Label>
              <Input id="rp-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Ex.: Maria Souza — CRC 1SP000000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-obs">Observações do consultor</Label>
              <Textarea id="rp-obs" rows={7} maxLength={800} value={observacao} onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: Recomendamos acompanhar o faturamento até o fim do mês para evitar a mudança de faixa." />
              <p className="text-xs text-muted-foreground">{observacao.length}/800 · aparece em destaque no relatório.</p>
            </div>
            <Button variant="outline" className="w-full" disabled={gerando} onClick={() => void gerar()}>
              <RefreshCw className={`h-4 w-4 ${gerando ? "animate-spin" : ""}`} />Atualizar pré-visualização
            </Button>
          </div>
          <div className="min-h-0 bg-muted">
            {pdf && !gerando ? (
              <iframe title="Pré-visualização do relatório" src={`${pdf.url}#view=FitH`} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" /><p className="text-sm">Gerando pré-visualização…</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-row justify-between border-t p-4 sm:justify-between">
          <Button variant="ghost" onClick={onFechar}><X className="h-4 w-4" />Fechar</Button>
          <Button disabled={!pdf || gerando} onClick={baixar}><Download className="h-4 w-4" />Baixar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
