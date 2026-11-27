<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Agentes — leia antes de codar

1. Leia **[`docs/CONTEXTO.md`](docs/CONTEXTO.md)** por completo.
2. Trabalhe só via **Issue → branch → PR** (nunca commit direto em `main` sem PR).
3. Mencione a Issue no PR (`Closes #N`), valide, liste riscos e próximos passos.
4. Não reescreva engines/modelos existentes; estenda via ETL/`DadosImportados`.
5. Preferir soluções simples; GLiNER é fallback, não caminho feliz.
6. O Dashboard do Planejamento é compartilhado entre `/planejamento` e `/planejamento/dashboard`, mantendo a entrada do módulo e o link legado consistentes.
7. A entrada do app passa pela tela de seleção de projeto (`SelecaoProjeto`), controlada pela flag de sessão `saga.selecao.ok` (`CHAVE_SELECAO`) verificada em `src/routes/__root.tsx`; não remover essa barreira.

## NCG presentation
- Keep NCG premise mapping and chart data in a browser-safe presentation module and reuse the existing pure engine for both report and dashboard, so calculations cannot drift between views.
- Adapt NCG simulations through target average balances and call the existing engine; keep simulation controls separate from saved premises so experiments never overwrite source inputs.
- Store NCG analysis snapshots under project-scoped browser keys and recalculate from saved premises on opening/comparison; generate Excel and PDF locally from shared report data and capture the actual dashboard charts for PDF fidelity.

## Estudo de Volatilidade
- Keep volatility statistics in the pure `src/lib/volatilidade/stats.ts` module with unit tests; screens, PDF, Excel and diagnosis all read from it so numbers never drift between views.
- Volatility state lives in a Zustand store persisted under a `saga.*` browser key (rehydrated after mount) so studies follow the active local project; PDF captures the Relatório tab's live charts (`data-vol-chart`) and Excel writes native formulas with cached values.

## Análise PVM
- PVM math lives only in the pure `src/lib/pvm.ts` (tested, including reconciliation Volume + Preço + Mix = R1 − R0); dashboard, insights and exports consume its results. Import/format/export helpers live in `src/lib/analise-pvm/`, and the screen reuses the Ecommtabil UI tokens from `src/components/volatilidade/ui.tsx` via `.vol-tool.pvm-tool`.
- PVM base, client name and controls persist in a Zustand store under a `saga.*` key (rehydrated after mount); styled Excel exports use `xlsx-js-style` because plain SheetJS drops cell styles.

## Análise de Viabilidade
- Financial math (VPL/TIR/payback/CAUE/bisection/pt-BR formatting) lives only in the pure `src/lib/finance.ts`; each study is a pure module in `src/lib/viabilidade/` that returns a generic `RelatorioEstudo` (blocks, KPIs, parecer) so the page, comparator, PDF, Excel and summary text never recompute differently. Reference values are locked in `validacao.test.ts` — fix formulas, never the expected values.
- Study screens share `EstudoPagina` and persist premises, client header and saved scenarios under `saga.viabilidade.*` keys (follow the active local project); opening a scenario writes it to the study key before navigating.

## Cálculo do Simples Nacional
- Simples Nacional math lives only in the pure `src/lib/simples/calculo.ts` (tested, including the 2.825,71 reference case); screens, PDF and Excel read its `ResultadoEmpresa`. Tax tables are versioned by year (`tabelaParaAno` picks the latest version ≤ company year) and stay user-editable, so law changes never require code changes.
- Next-month rate projection (`src/lib/simples/projecao.ts`, tested) only feeds the current-month preview into the shared engine (`rbt12ParaMes`/`calcularMesAnexo`), so projected and calculated rates never diverge; the preview is stored on the company record. The client A4 report (`relatorio-projecao.ts`) only reads `projetarAliquota`/`calcularEmpresa` results, never recalculates.
- Companies, table versions and import history persist in a Zustand store under a `saga.*` key (rehydrated in the `/calculadoras` layout); imports always go through `montarPrevia` → `aplicarPrevia` and snapshot the previous data so the last import can be undone.

## Diagnostic scoring
- Keep deterministic logistic diagnostic scoring and aggregation in the pure `src/lib/saga/diagnostico-score.ts` module, anchored at the existing warning/healthy thresholds; cards, ranking and group scores consume the same unrounded evaluation to avoid premature saturation and divergent scores.
