import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, ChevronDown, Eraser, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import {
  CONTAS_OPCIONAIS_ATIVO,
  CONTAS_OPCIONAIS_PASSIVO,
  CONTAS_PRINCIPAIS,
  PREMISSAS_EXEMPLO,
  PREMISSAS_VAZIAS,
  diasDoPeriodo,
  formatarEditavel,
  formatarMoeda,
  parseMoeda,
  saldoMedio,
  type PremissasNCG,
  type SegmentoNCG,
} from "@/lib/ncg/premissas";

const INPUT_AMARELO =
  "bg-[#FFF9DB] text-[#1F3A5F] border-[#1F3A5F]/20 placeholder:text-[#1F3A5F]/40 focus-visible:ring-[#C9A227]";
const INPUT_CALCULADO = "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed";

interface Props {
  premissas: PremissasNCG;
  onChange: (p: PremissasNCG) => void;
}

function CampoMoeda({
  valor,
  onChange,
  placeholder = "R$ 0,00",
}: {
  valor: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  return (
    <Input
      inputMode="decimal"
      className={cn(INPUT_AMARELO, "text-right")}
      placeholder={placeholder}
      value={editando ?? formatarEditavel(valor)}
      onFocus={() => setEditando(formatarEditavel(valor))}
      onChange={(e) => {
        setEditando(e.target.value);
        onChange(parseMoeda(e.target.value));
      }}
      onBlur={() => setEditando(null)}
    />
  );
}

function CampoNumero({
  valor,
  onChange,
  sufixo,
}: {
  valor: number;
  onChange: (v: number) => void;
  sufixo?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        className={cn(INPUT_AMARELO, "text-right", sufixo && "pr-14")}
        value={valor || ""}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      {sufixo && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#1F3A5F]/50">
          {sufixo}
        </span>
      )}
    </div>
  );
}

function SeletorData({
  valor,
  onChange,
  placeholder,
}: {
  valor: string;
  onChange: (iso: string) => void;
  placeholder: string;
}) {
  const data = valor ? new Date(valor + "T00:00:00") : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            INPUT_AMARELO,
            "w-full justify-start text-left font-normal",
            !data && "text-[#1F3A5F]/40"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {data ? format(data, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={data}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
          locale={ptBR}
          initialFocus
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

function Rotulo({ texto, tooltip }: { texto: string; tooltip?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-[#1F3A5F]">
      {texto}
      {tooltip && <InfoTooltip text={tooltip} />}
    </span>
  );
}

function Bloco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(31,58,95,0.08)] md:p-6">
      <h3 className="mb-4 border-l-4 border-[#C9A227] pl-3 text-base font-semibold text-[#1F3A5F]">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function LinhaSaldos({
  rotulo,
  tooltip,
  inicial,
  final,
  onInicial,
  onFinal,
}: {
  rotulo: string;
  tooltip?: string;
  inicial: number;
  final: number;
  onInicial: (v: number) => void;
  onFinal: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 rounded-xl bg-[#F5F7FA] p-3 sm:grid-cols-[1fr_150px_150px_150px] sm:gap-3">
      <Rotulo texto={rotulo} tooltip={tooltip} />
      <CampoMoeda valor={inicial} onChange={onInicial} />
      <CampoMoeda valor={final} onChange={onFinal} />
      <Input
        readOnly
        tabIndex={-1}
        className={cn(INPUT_CALCULADO, "text-right")}
        value={formatarMoeda(saldoMedio({ inicial, final }))}
      />
    </div>
  );
}

export function PremissasForm({ premissas, onChange }: Props) {
  const [opcionaisAberto, setOpcionaisAberto] = useState(false);
  const industria = premissas.segmento === "industria";
  const dias = diasDoPeriodo(premissas);

  const set = <K extends keyof PremissasNCG>(chave: K, valor: PremissasNCG[K]) =>
    onChange({ ...premissas, [chave]: valor });

  const setSaldo = (conta: string, campo: "inicial" | "final", valor: number) =>
    onChange({
      ...premissas,
      saldos: {
        ...premissas.saldos,
        [conta]: { ...premissas.saldos[conta], [campo]: valor },
      },
    });

  return (
    <div className="space-y-5">
      {/* BLOCO 0 – Identificação */}
      <Bloco titulo="Bloco 0 – Identificação">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Rotulo texto="Segmento" />
            <Select
              value={premissas.segmento}
              onValueChange={(v) => set("segmento", v as SegmentoNCG)}
            >
              <SelectTrigger className={INPUT_AMARELO}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comercio">Comércio</SelectItem>
                <SelectItem value="varejo">Varejo</SelectItem>
                <SelectItem value="industria">Indústria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Rotulo texto="Período analisado" />
            <div className="grid grid-cols-2 gap-2">
              <SeletorData
                valor={premissas.dataInicial}
                onChange={(iso) => set("dataInicial", iso)}
                placeholder="Data inicial"
              />
              <SeletorData
                valor={premissas.dataFinal}
                onChange={(iso) => set("dataFinal", iso)}
                placeholder="Data final"
              />
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <Rotulo texto="Dias do período" />
              <label className="flex items-center gap-2 text-xs text-[#1F3A5F]/70">
                <Switch
                  checked={premissas.diasManual}
                  onCheckedChange={(v) => set("diasManual", v)}
                />
                Informar dias manualmente
              </label>
            </div>
            {premissas.diasManual ? (
              <CampoNumero
                valor={premissas.diasInformados}
                onChange={(v) => set("diasInformados", v)}
                sufixo="dias"
              />
            ) : (
              <Input
                readOnly
                tabIndex={-1}
                className={cn(INPUT_CALCULADO, "text-right")}
                value={dias ? `${dias} dias` : "Informe as datas"}
              />
            )}
          </div>
        </div>
      </Bloco>

      {/* BLOCO 1 – Movimento do período */}
      <Bloco titulo="Bloco 1 – Movimento do período (DRE / razão)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Rotulo texto="Vendas brutas no período" tooltip="Base do PMR" />
            <CampoMoeda valor={premissas.vendasBrutas} onChange={(v) => set("vendasBrutas", v)} />
          </div>
          <div className="space-y-1.5">
            <Rotulo
              texto={industria ? "CPV – Custo dos produtos vendidos" : "CMV no período"}
              tooltip="Base do PME"
            />
            <CampoMoeda valor={premissas.cmv} onChange={(v) => set("cmv", v)} />
          </div>
          <div className="space-y-1.5">
            <Rotulo
              texto={
                industria
                  ? "Compras de matérias-primas e insumos no período"
                  : "Compras de mercadorias no período"
              }
              tooltip="Base do PMP – só mercadorias/insumos"
            />
            <CampoMoeda valor={premissas.compras} onChange={(v) => set("compras", v)} />
          </div>
          <div className="space-y-1.5">
            <Rotulo
              texto="Despesas fixas no período"
              tooltip="Folha, aluguel, utilidades, adm. Sem empréstimos, investimentos e impostos sobre vendas"
            />
            <CampoMoeda valor={premissas.despesasFixas} onChange={(v) => set("despesasFixas", v)} />
          </div>
        </div>
      </Bloco>

      {/* BLOCO 2 – Saldos do balanço */}
      <Bloco titulo="Bloco 2 – Saldos do balanço">
        <div className="mb-2 hidden grid-cols-[1fr_150px_150px_150px] gap-3 px-3 text-xs font-medium uppercase tracking-wide text-[#1F3A5F]/50 sm:grid">
          <span>Conta</span>
          <span className="text-right">Saldo inicial</span>
          <span className="text-right">Saldo final</span>
          <span className="text-right">Saldo médio</span>
        </div>
        <div className="space-y-2">
          {CONTAS_PRINCIPAIS.map((c) => (
            <LinhaSaldos
              key={c.chave}
              rotulo={c.rotulo}
              tooltip={c.tooltip || undefined}
              inicial={premissas.saldos[c.chave]?.inicial ?? 0}
              final={premissas.saldos[c.chave]?.final ?? 0}
              onInicial={(v) => setSaldo(c.chave, "inicial", v)}
              onFinal={(v) => setSaldo(c.chave, "final", v)}
            />
          ))}
        </div>

        <Collapsible open={opcionaisAberto} onOpenChange={setOpcionaisAberto} className="mt-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-dashed border-[#1F3A5F]/25 px-4 py-2.5 text-sm font-medium text-[#1F3A5F]/80 hover:bg-[#1F3A5F]/5">
            Outras contas operacionais (opcional)
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", opcionaisAberto && "rotate-180")}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-[#1F3A5F]/50">
              Ativos
            </p>
            {CONTAS_OPCIONAIS_ATIVO.map((c) => (
              <LinhaSaldos
                key={c.chave}
                rotulo={c.rotulo}
                tooltip={c.tooltip || undefined}
                inicial={premissas.saldos[c.chave]?.inicial ?? 0}
                final={premissas.saldos[c.chave]?.final ?? 0}
                onInicial={(v) => setSaldo(c.chave, "inicial", v)}
                onFinal={(v) => setSaldo(c.chave, "final", v)}
              />
            ))}
            <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[#1F3A5F]/50">
              Passivos
            </p>
            {CONTAS_OPCIONAIS_PASSIVO.map((c) => (
              <LinhaSaldos
                key={c.chave}
                rotulo={c.rotulo}
                tooltip={c.tooltip || undefined}
                inicial={premissas.saldos[c.chave]?.inicial ?? 0}
                final={premissas.saldos[c.chave]?.final ?? 0}
                onInicial={(v) => setSaldo(c.chave, "inicial", v)}
                onFinal={(v) => setSaldo(c.chave, "final", v)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </Bloco>

      {/* BLOCO 3 – Outras premissas */}
      <Bloco titulo="Bloco 3 – Outras premissas">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Rotulo
              texto="Prazo médio de pagamento das despesas fixas"
              tooltip="Ex.: folha paga dia 5 do mês seguinte ≈ 20 dias"
            />
            <CampoNumero
              valor={premissas.prazoDespesas}
              onChange={(v) => set("prazoDespesas", v)}
              sufixo="dias"
            />
          </div>
          <div className="space-y-1.5">
            <Rotulo
              texto="Reserva de segurança"
              tooltip="Colchão de proteção – fica fora da NCG técnica"
            />
            <CampoNumero
              valor={premissas.reservaMeses}
              onChange={(v) => set("reservaMeses", v)}
              sufixo={premissas.reservaMeses === 1 ? "mês" : "meses"}
            />
          </div>
          <div className="space-y-1.5">
            <Rotulo texto="Caixa e aplicações disponíveis hoje" />
            <CampoMoeda valor={premissas.caixaDisponivel} onChange={(v) => set("caixaDisponivel", v)} />
          </div>
        </div>
      </Bloco>

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => onChange({ ...PREMISSAS_EXEMPLO, saldos: { ...PREMISSAS_EXEMPLO.saldos } })}
          className="bg-[#C9A227] text-[#1F3A5F] hover:bg-[#C9A227]/90"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Carregar exemplo
        </Button>
        <Button
          variant="outline"
          onClick={() => onChange({ ...PREMISSAS_VAZIAS, saldos: { ...PREMISSAS_VAZIAS.saldos } })}
          className="border-[#1F3A5F]/30 text-[#1F3A5F] hover:bg-[#1F3A5F]/5"
        >
          <Eraser className="mr-2 h-4 w-4" />
          Limpar tudo
        </Button>
      </div>
    </div>
  );
}
