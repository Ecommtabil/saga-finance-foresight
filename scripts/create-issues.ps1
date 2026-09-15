$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function New-Issue([string]$Title, [string[]]$Labels, [string]$Body) {
  $argsList = @("issue", "create", "--title", $Title, "--body", $Body)
  foreach ($lb in $Labels) {
    $argsList += @("-l", $lb)
  }
  & gh @argsList
}

New-Issue "[Nova função] Documentar CONTEXTO.md e AGENTS.md para agentes/PRs" @("nova-funcao","fase-0") @"
## Objetivo
Criar docs/CONTEXTO.md e atualizar AGENTS.md com fluxo Issues → PR → CI, template de PR, restrições Lovable e princípios de arquitetura.

## Critério de pronto
- Agente qualquer modelo encontra as regras antes de codar
- Template de PR documentado
"@

New-Issue "[Melhoria] CI mínima (typecheck, Biome, Vitest) bloqueando main" @("melhoria","fase-0","qa") @"
## Objetivo
GitHub Actions: typecheck + lint/format Biome + Vitest. Branch protection exige CI green.

## Critério de pronto
- PR sem CI verde não mergeia em main
"@

New-Issue "[Correção] Ignorar pasta Saga/ no repo E-commtabil (repo aninhado)" @("correcao","fase-0") @"
## Objetivo
Adicionar Saga/ ao .gitignore do E-commtabil para não versionar o clone aninhado.
"@

New-Issue "[Nova função] Docker Compose: app + etl + Postgres" @("nova-funcao","fase-1","infra") @"
## Objetivo
docker-compose.yml com serviços app (Node/TanStack), etl (Python FastAPI) e Postgres com volumes.

## Critério de pronto
- docker compose up sobe os 3 serviços localmente
"@

New-Issue "[Nova função] Schema Postgres: grupo, empresa CNPJ, projeto, período, importação" @("nova-funcao","fase-1","infra") @"
## Objetivo
Migrations SQL: grupo_empresas, empresa (CNPJ), projeto, periodo, importacao, artifact.

## Critério de pronto
- Schema aplica no compose; empresas agrupáveis por múltiplos CNPJs
"@

New-Issue "[Nova função] Persistência API+Postgres (sair só de localStorage)" @("nova-funcao","fase-1") @"
## Objetivo
API mínima para salvar/carregar projetos; manter export JSON como backup.

## Critério de pronto
- Projeto sobrevive a refresh sem depender só do browser
"@

New-Issue "[Nova função] ETL POST /etl/import → DadosImportados" @("nova-funcao","fase-2","etl") @"
## Objetivo
Endpoint recebe arquivo + modo + horizonte e devolve JSON compatível com DadosImportados (modo, anos, dre, balanco|null, premissas).

## Critério de pronto
- Contrato tipado alinhado a src/lib/saga/types.ts
"@

New-Issue "[Nova função] Parser ALTERDATA BP (port E-commtabil) com exercício atual" @("nova-funcao","fase-2","etl") @"
## Objetivo
Portar AlterdataBpPdfParser: valores D/C colados, Encerrado em, exercício atual/anterior, equilíbrio Ativo=Passivo+PL.

## Critério de pronto
- Fixture Senzi fecha equação no período atual
"@

New-Issue "[Nova função] Parsers marketplace DRE (ML/Shopee) → linhas DRE Saga" @("nova-funcao","fase-2","etl") @"
## Objetivo
Mapear planilhas marketplace para campos DRE descritivos (Receita Bruta, CMV, tarifas), sem plano Conta Azul.
"@

New-Issue "[Melhoria] UI /upload: importar fonte bruta PDF/Excel via ETL" @("melhoria","fase-2","etl") @"
## Objetivo
Em /upload, opção além da planilha modelo: enviar PDF/Excel bruto ao ETL e pré-visualizar DadosImportados.
"@

New-Issue "[Nova função] GLiNER2 fallback NER para contas sem alias" @("nova-funcao","fase-3","etl") @"
## Objetivo
Após falha de alias determinístico, GLiNER (local ou API Fastino) mapeia conta_origem → linha canônica Saga. Telemetria de taxa de match.
"@

New-Issue "[Melhoria] Sentry no front e no ETL" @("melhoria","fase-4","qa") @"
## Objetivo
Observabilidade mínima com Sentry (não Datadog/New Relic nesta fase).
"@

New-Issue "[Nova função] Rate limit e auth básica na API ETL" @("nova-funcao","fase-4","infra") @"
## Objetivo
Proteger /etl/* com rate limit e token/API key.
"@

New-Issue "[Melhoria] Playwright smoke + Codecov na CI" @("melhoria","fase-4","qa") @"
## Objetivo
Smoke e2e (home + upload) e upload de cobertura Codecov.
"@

New-Issue "[Nova função] Termos de uso e política de privacidade (jurídico)" @("nova-funcao","fase-4","juridico") @"
## Objetivo
Páginas/links de termos e privacidade; texto revisado e aprovado pelo jurídico antes de produção.
"@

New-Issue "[Backlog] OpenTelemetry traces no ETL" @("melhoria","fase-4","qa","backlog") @"
Não bloqueia MVP. Instrumentar ETL com OTel quando Sentry não bastar.
"@

New-Issue "[Backlog] Knip + arch-contract + Stryker" @("melhoria","fase-4","qa","backlog") @"
Ferramentas avançadas de qualidade; ativar após esteira mínima estável.
"@

New-Issue "[Backlog] Escolher um APM adicional (Datadog ou New Relic)" @("melhoria","fase-4","qa","backlog") @"
Somente se Sentry for insuficiente.
"@

New-Issue "[Backlog] Endtest e bridge ETL → Modelagem Simpl/MF2" @("nova-funcao","fase-4","backlog") @"
E2E externo e ponte explícita histórico → projeção.
"@

New-Issue "[Melhoria] Naming da marca (Saga sem registro de patente)" @("melhoria","fase-0","juridico") @"
Reunião: nome Saga não pôde ser registrado. Avaliar marca futura sem bloquear código.
"@

Write-Host "ISSUES_DONE"
gh issue list --limit 40
