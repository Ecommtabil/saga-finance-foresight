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
} from "@/components/ui/sidebar";
import { useSaga } from "@/lib/saga/context";

const PRINCIPAL = [
  { title: "Cadastro", url: "/empresa", icon: Building2 },
  { title: "Dados", url: "/", icon: Home },
  { title: "Importação", url: "/upload", icon: Upload },
  { title: "Índices Econômicos", url: "/indices", icon: Percent },
] as const;

const ANALISE = [
  { title: "DRE", url: "/dre", icon: FileText, apenasCompleta: false },
  { title: "Balanço Patrimonial", url: "/balanco", icon: Scale, apenasCompleta: true },
  { title: "Fluxo de Caixa", url: "/fluxo-caixa", icon: Waves, apenasCompleta: true },
  { title: "Indicadores", url: "/indicadores", icon: Gauge, apenasCompleta: false },
  { title: "Diagnóstico", url: "/diagnostico", icon: Stethoscope, apenasCompleta: false },
  { title: "Valuation (DCF)", url: "/valuation", icon: Calculator, apenasCompleta: false },
  { title: "DCF Explicado", url: "/dcf-explicado", icon: GraduationCap, apenasCompleta: false },
  { title: "Estatísticas", url: "/estatisticas", icon: BarChart3, apenasCompleta: false },
  { title: "Simuladores", url: "/simuladores", icon: Sliders, apenasCompleta: false },
] as const;

export function AppSidebar() {
  const { modo } = useSaga();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => pathname === u;
  const items = ANALISE.filter((i) => (i.apenasCompleta ? modo === "completa" : true));

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
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Análise</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}