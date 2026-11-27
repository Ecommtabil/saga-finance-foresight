# DRE analítico
- [x] Exibir Despesas Operacionais como grupo e Aluguéis como conta filha, sem linha de total duplicada (3 testes e prévia aprovados).
- [x] Preservar contas extras da importação, como Aluguel, sem alterar os resultados já calculados.
- [x] Adicionar visões Gerencial e Analítico, com totais reconciliados e renomeação das contas extras.
- [x] Testar importação, exibição e persistência no navegador (4 testes aprovados; fluxo completo sem erros).

# NCG — relatório e Dashboard
- [x] Conectar premissas ao motor existente e apresentar memorial técnico.
- [x] Criar KPIs, ciclo financeiro, cascata, cobertura e diagnóstico.
- [x] Validar regras com 13 testes e conferir abas em desktop e celular, recarga e atualização com vendas alteradas.

# NCG — simulações
- [x] Reutilizar motor com variações de prazos e vendas e testar limites (20 testes NCG aprovados).
- [x] Criar sliders, comparativo, impacto diário, gráfico e reset.
- [x] Conferir alterações e reset no computador e celular, preservando as premissas originais.

# NCG — análises e exportações locais
- [x] Salvar, buscar, abrir, duplicar e excluir análises por projeto, sem login.
- [x] Comparar períodos da mesma empresa com PMR, PME, PMP e NCG.
- [x] Exportar PDF A4 Ecommtabil e Excel com Premissas e NCG.
- [x] Testar operações, recarga e arquivos baixados (24 testes aprovados).
# Estudo de Volatilidade Financeira
- [x] Módulo estatístico puro com testes (critérios de aceite do exemplo).
- [x] Tela Dados: cabeçalho, upload Excel/CSV, colar, tabela editável, séries dinâmicas, ajustes, filtro, validações, exemplo.
- [x] Estatísticas, faixas de probabilidade, gráficos (curvas, série temporal, histograma, gap).
- [x] Calculadora de probabilidade, diagnóstico editável, configurações, modo escuro e apresentação.
- [x] Estudos salvos/duplicar; exportar PDF A4 e Excel com fórmulas nativas.
- [x] Validar no navegador e com testes (20 testes do estudo; PDF 6 páginas A4 e Excel conferidos).

# Análise PVM (Preço, Volume e Mix)
- [x] Importação Excel/CSV com cabeçalho automático, validações, modelo para download e base persistida.
- [x] Motor puro PVM com testes (valores da planilha por unidade, conciliação, novos/descontinuados).
- [x] Dashboard: controles, KPIs, cascata, comparativo dos 3 níveis, tabela detalhada, ranking.
- [x] Leitura automática, glossário, cliente no topo, exportações Excel e PDF.
- [x] Modos Mês a mês e Acumulado com conciliação.
- [x] Validar no navegador.

# Análise de Viabilidade (Estudos de Viabilidade)
- [x] Motor financeiro puro (VPL, TIR, paybacks, IR, CAUE) com testes.
- [x] Estrutura, visual Ecommtabil, menu e página Início com 4 cards.
- [x] Nova Linha de Produtos: DRE, FCL, indicadores, parecer, gráficos FCL e tornado.
- [x] Comprar ou Alugar: fluxos, incremental, CAUE, revenda de empate, gráficos.
- [x] Máquina Compra vs Leasing: fluxos, CAUE, mensalidade de equilíbrio, gráficos.
- [x] Equipe Interna vs Terceirizar: fluxos, ponto de inflexão, tabela 1–15, riscos qualitativos.
- [x] Cabeçalho do cliente, cenários salvos, comparador, PDF, Excel e copiar resumo.
- [x] Testes de validação com os valores do arquivo e página oculta /viabilidade/debug.
- [x] Validar no navegador (computador e celular).

# Calculadoras — Cálculo do Simples Nacional
- [x] Motor puro (RBT12, faixa, AE, partilha, teto ISS, faixa 6, Anexo IV) com teste do caso 2.825,71.
- [x] Importação: PGDAS-D (PDF), planilha com mapeamento, colagem, prévia, histórico e desfazer.
- [x] Exportações Excel e PDF.
- [x] Telas: empresas, abas por anexo, resumo consolidado, tabelas do Simples.
- [x] Menu "Calculadoras" e validação no navegador.
- [x] Conferir a leitura do PDF do PGDAS-D com um extrato real (out/2026: DAS 3.739,34 confere).

# Fonte numérica em padrão contábil
- [x] Números em Times New Roman (Tinos como reserva web), textos em Inter, algarismos tabulares.
- [x] Conferir no navegador: DRE, Balanço, Indicadores, Valuation e NCG pintando fonte serifada.

# Diagnóstico — pontuação proporcional
- [x] Substituir notas fixas por escala contínua, preservando limites financeiros e pesos.
- [x] Validar notas, ranking, pesos e troca de período com 9 testes e planilha preenchida no navegador, sem erros.

# Diagnóstico — notas mais variadas
- [x] Usar curva gradual sem saturação antecipada, preservando semáforos e pesos.
- [x] Testar pequenas diferenças e notas altas (11 testes aprovados); conferir planilha importada, pesos e troca de período no navegador, sem erros.
