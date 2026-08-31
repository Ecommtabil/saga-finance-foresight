import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo } from "@/components/simpl/fields";
import { useMF2 } from "@/lib/mf2/store";
import {
  MOEDAS,
  REGIMES,
  TIPOS_NEGOCIO,
  type Moeda,
  type RegimeTributario,
  type TipoNegocio,
} from "@/lib/mf2/types";

export const Route = createFileRoute("/modelagem-financeira-2/novo")({
  head: () => ({
    meta: [
      { title: "Novo Modelo — Modelagem Financeira 2" },
      {
        name: "description",
        content: "Cadastre empresa, moeda, regime tributário e data de início do modelo.",
      },
      { property: "og:title", content: "Novo Modelo — Modelagem Financeira 2" },
      { property: "og:description", content: "Primeiro passo do wizard de premissas." },
    ],
  }),
  component: NovoModelo,
});

function NovoModelo() {
  const { criarModelo } = useMF2();
  const navigate = useNavigate();
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [unidadeMonetaria, setMoeda] = useState<Moeda>("BRL");
  const [regimeTributario, setRegime] = useState<RegimeTributario>("Simples Nacional");
  const [tipoNegocio, setTipo] = useState<TipoNegocio>("Serviços");
  const [dataInicioModelo, setData] = useState(new Date().toISOString().slice(0, 10));

  const salvar = () => {
    if (!nomeEmpresa.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    const m = criarModelo({
      nomeEmpresa: nomeEmpresa.trim(),
      unidadeMonetaria,
      regimeTributario,
      tipoNegocio,
      dataInicioModelo,
    });
    toast.success("Modelo criado");
    navigate({ to: "/modelagem-financeira-2/$modeloId", params: { modeloId: m.id } });
  };

  return (
    <>
      <PageHeader
        titulo="Novo Modelo"
        subtitulo="Passo 1 de 2 — identificação da empresa. Em seguida você define as premissas."
      />
      <Card className="max-w-3xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome da empresa">
            <Input
              className="h-8"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Ex.: Padaria Modelo Ltda"
            />
          </Campo>
          <Campo label="Unidade monetária">
            <Select value={unidadeMonetaria} onValueChange={(v) => setMoeda(v as Moeda)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOEDAS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo
            label="Regime tributário"
            ajuda="Define quais alíquotas serão usadas: Simples usa DAS; Presumido e Real usam ICMS/ISS/IPI/PIS-COFINS e IRPJ-CSLL."
          >
            <Select
              value={regimeTributario}
              onValueChange={(v) => setRegime(v as RegimeTributario)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Tipo de negócio">
            <Select value={tipoNegocio} onValueChange={(v) => setTipo(v as TipoNegocio)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_NEGOCIO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Data de início do modelo">
            <Input
              type="date"
              className="h-8"
              value={dataInicioModelo}
              onChange={(e) => setData(e.target.value)}
            />
          </Campo>
          <div className="flex items-end">
            <Button size="sm" onClick={salvar}>
              Criar e ir para premissas <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
