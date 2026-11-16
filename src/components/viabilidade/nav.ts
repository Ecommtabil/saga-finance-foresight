import { Home, PackagePlus, Building, Cog, Users, FolderOpen } from "lucide-react";

export const NAV_VIABILIDADE = [
  { title: "Início", curto: "Início", url: "/viabilidade", icon: Home },
  { title: "Nova Linha de Produtos", curto: "Nova Linha", url: "/viabilidade/nova-linha", icon: PackagePlus },
  { title: "Comprar ou Alugar", curto: "Comprar ou Alugar", url: "/viabilidade/comprar-alugar", icon: Building },
  { title: "Máquina: Compra vs Leasing", curto: "Compra vs Leasing", url: "/viabilidade/maquina-leasing", icon: Cog },
  { title: "Equipe Interna vs Terceirizar", curto: "Interno vs Terceirizar", url: "/viabilidade/equipe-terceirizar", icon: Users },
  { title: "Meus cenários", curto: "Meus cenários", url: "/viabilidade/cenarios", icon: FolderOpen },
] as const;

export const ICONE_ESTUDO = {
  "nova-linha": PackagePlus,
  "comprar-alugar": Building,
  "maquina-leasing": Cog,
  "equipe-terceirizar": Users,
} as const;
