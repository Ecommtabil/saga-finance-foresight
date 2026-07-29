## Contexto
A tabela "Radar de desempenho — visão geral dos indicadores" em `/estatisticas` já exibe as colunas: **Média, Mediana, Desvio, CV, Pior, Melhor, Oscilação %**. Hoje existe apenas um tooltip geral no título do card. O objetivo é tornar cada conceito acessível ao empresário, com explicações individuais e linguagem de negócio.

## O que será feito
1. **Glossário de métricas** — criar um objeto/constante em `src/lib/saga/stats.ts` (ou arquivo auxiliar) com descrições simplificadas de cada conceito, em tom de gestão:
   - **Média**: valor típico do indicador no período.
   - **Mediana**: valor central, menos sensível a meses excepcionais.
   - **Desvio**: quanto os resultados variam em torno da média.
   - **CV (Coeficiente de Variação)**: oscilação relativa, permite comparar indicadores de escalas diferentes.
   - **Pior**: menor valor observado no recorte.
   - **Melhor**: maior valor observado no recorte.
   - **Oscilação %**: variação típica de um período para o outro.

2. **Tooltips nos cabeçalhos da tabela** — adicionar o componente `InfoTooltip` existente ao lado de cada `<th>` do "Radar de desempenho", apontando para a respectiva explicação simplificada.

3. **(Opcional, se couber visualmente)** Adicionar um pequeno card/legendário fixo abaixo da tabela com os 7 conceitos listados de forma resumida, para leitura rápida sem depender do hover.

## Escopo
- Apenas frontend: alteração em `src/routes/estatisticas.tsx` e possível constante em `src/lib/saga/stats.ts`.
- Nenhuma mudança nos cálculos, parser, backend ou rotas.
- Manter o vocabulário de negócio já adotado no módulo (evitar jargão matemático puro).

## Critério de pronto
- Cada cabeçalho da tabela descritiva possui tooltip explicativo individual.
- Textos são curtos, claros e voltados para o empresário.
- Nenhum erro de TypeScript ou regressão visual na tabela.