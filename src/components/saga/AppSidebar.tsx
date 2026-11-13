import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Building2,
  Upload,
  FileText,
  Scale,
  Waves,
  Gauge,
  Percent,
  Calculator,
  BarChart3,
  Sliders,
  GraduationCap,
  Stethoscope,
  ChevronRight,
  LayoutDashboard,
  ArrowDownUp,
  Receipt,
  Zap,
  Wallet,
  ClipboardList,
  Landmark,
  Activity,
  TrendingUp,

} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSaga } from "@/lib/saga/context";

type SubItem = { title: string; url: string; icon: React.ElementType; apenasCompleta?: boolean };
type MenuItem = SubItem & { children?: SubItem[] };

const PRINCIPAL: SubItem[] = [
  { title: "Cadastro", url: "/empresa", icon: Building2 },
  { title: "Dados", url: "/", icon: Home },
  { title: "Importação", url: "/upload", icon: Upload },
  { title: "Índices Econômicos", url: "/indices", icon: Percent },
];

const MODELAGEM: MenuItem[] = [
  {
    title: "3 Stats",
    url: "#",
    icon: LayoutDashboard,
    children: [
      { title: "DRE", url: "/dre", icon: FileText, apenasCompleta: false },
      { title: "Fluxo de Caixa", url: "/fluxo-caixa", icon: Waves, apenasCompleta: false },
      { title: "Balanço Patrimonial", url: "/balanco", icon: Scale, apenasCompleta: false },
    ],
  },
  { title: "Indicadores", url: "/indicadores", icon: Gauge, apenasCompleta: false },
  { title: "Diagnóstico", url: "/diagnostico", icon: Stethoscope, apenasCompleta: true },
  { title: "Valuation (DCF)", url: "/valuation", icon: Calculator, apenasCompleta: true },
  { title: "DCF Explicado", url: "/dcf-explicado", icon: GraduationCap, apenasCompleta: true },
  { title: "Simuladores", url: "/simuladores", icon: Sliders, apenasCompleta: true },
];

const MODELAGEM_SIMPLIFICADA: SubItem[] = [
  { title: "Modelagem Simplificada 1", url: "/modelagem-simplificada", icon: Zap, apenasCompleta: false },
  { title: "Modelagem Simplificada 2", url: "/modelagem-financeira-2", icon: LayoutDashboard, apenasCompleta: false },
  { title: "Modelagem Simplificada 3", url: "/modelagem-simplificada-3", icon: Calculator, apenasCompleta: false },
];

const ORCAMENTO: SubItem[] = [
  { title: "Base Zero", url: "/orcamento", icon: Wallet, apenasCompleta: false },
  { title: "Planejamento Orçamentário", url: "/planejamento", icon: ClipboardList, apenasCompleta: false },
  { title: "Rolling Forecast", url: "/orcamento/rolling", icon: Wallet, apenasCompleta: false },
];


const ANALISE_DADOS: SubItem[] = [
  { title: "Estatísticas", url: "/estatisticas", icon: BarChart3, apenasCompleta: false },
  { title: "DRE - Vendas", url: "/dre-vendas", icon: Receipt, apenasCompleta: false },
  { title: "Fluxo de Caixa Reverso", url: "/fluxo-reverso", icon: ArrowDownUp, apenasCompleta: false },
  { title: "Calculadora de NCG", url: "/ncg", icon: Landmark, apenasCompleta: false },
  { title: "Estudo de Volatilidade", url: "/volatilidade", icon: Activity, apenasCompleta: false },
  { title: "Análise PVM", url: "/pvm", icon: TrendingUp, apenasCompleta: false },
];


function filterItems<T extends { apenasCompleta?: boolean }>(items: T[], modo: string | null): T[] {
  return items.filter((i) => (i.apenasCompleta ? modo === "completa" : true));
}

function MenuLink({ item, active }: { item: SubItem; active: boolean }) {
  return (
    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
      <Link to={item.url}>
        <item.icon className="h-4 w-4" />
        <span>{item.title}</span>
      </Link>
    </SidebarMenuButton>
  );
}

export function AppSidebar() {
  const { modo } = useSaga();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => pathname === u;

  const modelagemItems = MODELAGEM.map((item) => ({
    ...item,
    children: item.children ? filterItems(item.children, modo) : undefined,
  })).filter((item) => {
    if (item.children) return item.children.length > 0;
    return item.apenasCompleta ? modo === "completa" : true;
  });

  const analiseDadosItems = filterItems(ANALISE_DADOS, modo);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            S
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">SAGA</span>
            <span className="text-[10px] uppercase text-muted-foreground">
              {modo === "completa"
                ? "Contab. Completa"
                : modo === "basica"
                  ? "Dados Básicos"
                  : "Sem modo"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRINCIPAL.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <MenuLink item={item} active={isActive(item.url)} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Modelagem Financeira</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modelagemItems.map((item) => {
                if (item.children && item.children.length > 0) {
                  const open = item.children.some((child) => isActive(child.url));
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Collapsible defaultOpen={open}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => (
                              <SidebarMenuSubItem key={child.url}>
                                <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                                  <Link to={child.url}>
                                    <child.icon className="h-4 w-4" />
                                    <span>{child.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </SidebarMenuItem>
                  );
                }
                return (
                  <SidebarMenuItem key={item.url}>
                    <MenuLink item={item} active={isActive(item.url)} />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Modelagem Simplificada</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MODELAGEM_SIMPLIFICADA.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <MenuLink item={item} active={isActive(item.url)} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Orçamento</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ORCAMENTO.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <MenuLink item={item} active={pathname.startsWith(item.url)} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Análise de Dados</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analiseDadosItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <MenuLink item={item} active={isActive(item.url)} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
