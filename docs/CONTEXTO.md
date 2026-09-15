# Contexto do projeto SAGA (Finance Insights)

Este arquivo é **obrigatório** para qualquer agente (qualquer modelo) antes de implementar mudanças.

## Produto

- **Repo canônico:** `ftsmazzo/saga-finance-insights-a80750e9`
- **UI:** TanStack Start + React + TypeScript (Lovable)
- **Modelos de negócio:** `basica` | `completa`, delimitados por **período/anos** (`DadosImportados` em `src/lib/saga/types.ts`)
- **ETL:** serviço Python em `services/etl` (parsers determinísticos + GLiNER como fallback)
- **Persistência alvo:** Postgres (Docker); `localStorage`/export JSON como backup
- **Referência legada:** E-commtabil (PHP) — reaproveitar lógica de parsers/aliases, **não** a UI Framediz

## Fluxo de trabalho (obrigatório)

1. Toda tarefa começa como **Issue** no GitHub, com **um** label de tipo:
   - `correcao` — bug / comportamento errado
   - `melhoria` — aprimorar o que já existe
   - `nova-funcao` — capacidade nova
2. Labels de fase/área quando couber: `fase-0`…`fase-4`, `etl`, `infra`, `qa`, `juridico`, `backlog`
3. Implementação **sempre** em branch de feature → **Pull Request** → merge em `main` só com CI verde
4. **Nunca** force-push / rebase destrutivo em histórico já publicado (sync Lovable)

### Template obrigatório de descrição de PR

```markdown
## Issue
Closes #N

## O que mudou
- …

## Como foi validado
- [ ] unit
- [ ] integração
- [ ] e2e
- [ ] manual

## Riscos e limitações
- …

## Próximos passos
- …
```

## Esteira de qualidade (antes de entrar em `main`)

Mínimo na CI:

- Typecheck TypeScript
- Biome (lint/format)
- Vitest (unit)
- Playwright smoke (quando a Issue da fase 4 estiver ativa)
- Codecov (cobertura; não bloqueia no início se token ausente)

Observabilidade MVP: **Sentry** (front + ETL).  
Backlog (não bloquear MVP): OpenTelemetry, Knip, arch-contract, Stryker, Endtest, 2º APM.

Segurança/ops MVP: rate limit + API key no ETL; separar front e ETL; termos/privacidade via Issue jurídica.

## Arquitetura — princípios

- Evitar overengineering e bottlenecks absurdo
- Componentizar desde o início; reutilizar `src/components/ui` e `src/components/saga`
- DRY com critério — sem abstrações prematuras
- **Impedir** reconstruir componentes/engines que já existem (`mf2`, `simpl`, `saga/calculations`)
- ETL devolve JSON compatível com `DadosImportados` — não reescrever engines de modelagem
- GLiNER só após falha de alias determinístico

## Contrato ETL → UI

```ts
// Alinhado a src/lib/saga/types.ts
{
  modo: "basica" | "completa";
  empresaPlanilha: string;
  anos: number[];
  dre: DRE;
  balanco: Balanco | null; // null no modo basica
  premissas: Premissas;
}
```

## Lovable

Ver bloco LOVABLE em `AGENTS.md`. Commits em `main` sincronizam com o editor — manter `main` saudável.
