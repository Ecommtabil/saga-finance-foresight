
# SAGA — Plano do Frontend (fase 1, sem backend)

Sistema web de análise e avaliação de empresas. Dados vivem apenas em memória (React state + Context). Entrada exclusivamente via upload de planilha `.xlsx` modelo.

## Stack e bibliotecas

- TanStack Start (já configurado) + TanStack Router para rotas.
- Tailwind v4 + shadcn/ui (Sidebar, Card, Table, Tabs, Dialog, Slider, Alert).
- `xlsx` (SheetJS) — leitura e geração da planilha modelo no navegador.
- `recharts` — gráficos de linha, waterfall (via BarChart), heatmap (grid custom).
- Context global `SagaDataContext` para: modo (Completa/Básica), cadastro da empresa, dados importados, premissas macro.

## Estrutura de rotas (`src/routes/`)

```
__root.tsx          Sidebar fixa + Outlet (layout do app)
index.tsx           Home / Seleção de Modo
empresa.tsx         Cadastro da Empresa
upload.tsx          Download modelo + Upload + Validação + Resumo
dre.tsx             DRE 5 anos
balanco.tsx         Balanço Patrimonial (só modo Completa)
fluxo-caixa.tsx     Fluxo de Caixa (Direto/Indireto, só Completa)
indicadores.tsx     Painel de indicadores por categoria
indices.tsx         Índices Econômicos (editáveis)
valuation.tsx       DCF + Waterfall + Sensibilidade
estatisticas.tsx    Descritiva / Regressão / Correlação / Volatilidade
simuladores.tsx     Sliders → Equity Value recalcula
```

Sidebar oculta/desabilita `balanco`, `fluxo-caixa` e categorias dependentes de balanço quando o modo é "Dados Básicos". Todas as rotas de módulo, se `dadosCarregados === false`, mostram estado vazio com CTA "Baixar Modelo" / "Fazer Upload" (link para `/upload`).

## Fluxo de dados

1. Usuário escolhe modo em `/` → salvo no Context → redireciona para `/empresa`.
2. `/empresa`: formulário simples (nome, setor, porte, moeda) → Context.
3. `/upload`:
   - Botão "Baixar Planilha Modelo" → gera `.xlsx` on-the-fly com `xlsx` (abas: Premissas, DRE, Balanço, ou versão Simplificada). Cabeçalhos e linhas pré-formatados, 5 colunas de anos.
   - Input de arquivo → `readFile` client-side → parser valida abas/colunas esperadas → erros claros por aba/campo em `<Alert>`.
   - Sucesso: tela "Dados Carregados" com resumo (empresa, período, ano base, nº de linhas por aba) + botão "Substituir Planilha".
4. Módulos consomem o Context; se ausente, estado vazio.

## Cálculos (client-side, puros, em `src/lib/saga/`)

- `dre.ts` — margens (bruta, operacional, líquida).
- `balanco.ts` — totais e conferência Ativo = Passivo + PL.
- `fluxo-caixa.ts` — Direto e Indireto a partir de DRE+BP, com validação de bater no caixa final (badge verde/vermelho).
- `indicadores.ts` — Liquidez (corrente, seca), Endividamento, Rentabilidade (ROE, ROA, ROIC), Ciclo de Caixa (PMR, PME, PMP), Crescimento (CAGR receita/lucro).
- `valuation.ts` — FCFF, WACC (via premissas), Valor Terminal (Gordon), EV, Equity Value, matriz sensibilidade WACC×g.
- `estatisticas.ts` — média, desvio, tendência linear, correlação Pearson, volatilidade (σ dos retornos).
- `formatters.ts` — número BR com milhar, negativos entre parênteses, `%` com 1 casa, `x` para múltiplos.

## Design system

Tokens em `src/styles.css` (`@theme`) — paleta:
- `--background` branco / `--foreground` cinza-900.
- `--primary` azul-marinho (ex. `oklch(0.28 0.08 255)`).
- `--accent` um único tom (ex. teal suave) para destaques de KPI.
- Cinzas neutros para tabelas (linhas zebradas leves, cabeçalho semibold).
Sem dark mode nesta fase. Tipografia Inter (via `<link>` em `__root.tsx`).

## Componentes reutilizáveis (`src/components/saga/`)

- `AppSidebar` — navegação com itens filtrados pelo modo.
- `EmptyState` — CTA padrão para módulos sem dados.
- `FinancialTable` — tabela 5 anos com formatação (negativos em parênteses, milhar).
- `KpiCard` — valor + variação + mini-sparkline.
- `IndicatorChart` — linha 5 anos (recharts).
- `WaterfallChart` — EV → ajustes → Equity (BarChart empilhado).
- `SensitivityTable` — heatmap WACC×g.
- `CorrelationHeatmap` — grid colorido por valor.
- `ModeBadge` — mostra modo ativo no topo da sidebar.

## Metadados (head)

Cada rota define seu próprio `head()` com title/description/og pt-BR (ex.: "DRE — SAGA", "Valuation DCF — SAGA"). `__root.tsx` recebe título default "SAGA — Análise e Avaliação de Empresas".

## Fora de escopo (confirmado)

Backend, auth, persistência entre sessões, APIs externas, ETL. Simuladores entregues como MVP funcional (3 sliders: crescimento, WACC, margem operacional → Equity recalculado ao vivo).

## Entregáveis desta fase

Todas as 11 telas navegáveis, geração e leitura real da planilha modelo, cálculos corretos rodando sobre os dados importados, formatação financeira consistente, sidebar reativa ao modo, estados vazios guiando ao upload.
