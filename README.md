# SAGA Finance Insights

Quero criar o **SAGA**, um sistema web de análise e avaliação de empresas. Por enquanto, construa **apenas o frontend** — sem backend, sem banco de dados, sem autenticação. Todos os dados devem viver em memória / estado da aplicação (React state), o suficiente para navegar e visualizar os módulos com dados reais carregados pelo usuário.

### Conceito central do produto

O SAGA avalia empresas com dois níveis de profundidade de dados:

1. **Empresa com Contabilidade Completa** — o usuário tem DRE e Balanço Patrimonial detalhados.

2. **Empresa com Dados Básicos** — o usuário só tem informações simplificadas (receita, custos, poucos dados de balanço).

O usuário escolhe esse modo logo na entrada, e isso determina quais módulos/indicadores ficam disponíveis (indicadores que dependem de Balanço completo — liquidez, endividamento, eficiência/ciclo de caixa — só aparecem no modo "Contabilidade Completa").

### Regra mais importante do produto: entrada de dados 100% via planilha modelo

**Não construa formulários manuais de entrada de dados linha a linha.** A única forma de inserir dados financeiros no sistema é:

1. O usuário clica em **"Baixar Planilha Modelo"** e recebe um arquivo `.xlsx` pré-formatado (pode ser um arquivo estático servido pelo frontend, com abas: Premissas, DRE, Balanço Patrimonial, e uma versão simplificada para o modo "Dados Básicos").

2. O usuário preenche essa planilha **no Excel, fora do sistema**.

3. O usuário volta ao SAGA e faz **upload** desse arquivo `.xlsx` preenchido.

4. O sistema lê o arquivo **no navegador** (client-side, sem enviar a nenhum servidor por enquanto) usando uma biblioteca de leitura de planilhas (ex.: SheetJS/xlsx), valida se a estrutura bate com o modelo esperado, e usa esses dados para popular todas as telas (DRE, Balanço, Fluxo de Caixa, Indicadores, Índices Econômicos, DCF, Estatísticas).

5. Se o arquivo não seguir o modelo esperado (aba faltando, coluna faltando), mostrar uma mensagem de erro clara dizendo qual aba/coluna está incorreta — nunca falhar silenciosamente.

6. Deve haver uma tela de **"Dados Carregados"** mostrando um resumo do que foi importado (nome da empresa, período, ano base) antes de o usuário navegar para os módulos de análise, com opção de **substituir a planilha** a qualquer momento.

Isso é uma decisão de produto deliberada: o usuário já pensa e trabalha em Excel, então a planilha é a interface de entrada — o sistema é a camada de visualização, cálculo e análise em cima dela.

### Estrutura de módulos (páginas)

1. **Home / Seleção de Modo** — escolher "Contabilidade Completa" ou "Dados Básicos", e a partir daí ir para upload.

2. **Cadastro da Empresa** — nome, setor, porte, moeda (apenas alguns campos simples de identificação — isso pode ser formulário manual, já que não é dado financeiro recorrente).

3. **Upload / Importação de Dados** — a tela central descrita acima (download do modelo, upload, validação, resumo).

4. **DRE** — visualização da Demonstração do Resultado em tabela, 5 anos lado a lado, com margens.

5. **Balanço Patrimonial** — visualização em tabela, Ativo / Passivo / PL, 5 anos.

6. **Fluxo de Caixa** — duas abas/toggle: Método Direto e Método Indireto, com um indicador visual confirmando que os dois batem no caixa final.

7. **Indicadores** — painel com cards/gráficos agrupados por categoria: Liquidez, Endividamento, Rentabilidade, Eficiência (Ciclo de Caixa), Fluxo de Caixa, Crescimento. Mostrar evolução dos 5 anos em gráfico de linha para os principais indicadores.

8. **Índices Econômicos** — tela para o usuário revisar/ajustar as premissas macro trazidas da planilha (Selic, CDI, IPCA, Beta, ERP etc.) antes de rodar o valuation.

9. **Valuation (DCF)** — apresentação do FCFF projetado, WACC, Valor Terminal, Enterprise Value e Equity Value, com um gráfico de "ponte" (waterfall) do EV até o Equity Value, e uma tabela de sensibilidade (WACC x g).

10. **Análises Estatísticas** — estatística descritiva, tendência/regressão, matriz de correlação (como heatmap), volatilidade — com aviso visível de que a amostra é pequena (5 anos).

11. **Simuladores** — uma tela inicial simples (pode ser um placeholder funcional) onde o usuário altera manualmente 2–3 premissas-chave (crescimento, WACC, margem) via sliders e vê o Equity Value recalcular em tempo real, só para prova de conceito.

### Requisitos de UI/UX

- Visual profissional de dashboard financeiro/fintech: paleta sóbria (azul-marinho, cinza, branco, um único tom de destaque), tipografia limpa, bastante uso de tabelas e gráficos (recharts) — nada de gradientes chamativos ou estilo "genérico de IA".

- Navegação lateral fixa (sidebar) com os módulos listados, desabilitando/ocultando os que não se aplicam ao modo escolhido (Contabilidade Completa vs Dados Básicos).

- Todas as tabelas financeiras devem ter formatação correta: negativos entre parênteses, separador de milhar, percentuais com uma casa decimal.

- Estado vazio (antes do upload) deve orientar claramente o usuário a baixar o modelo e depois subir os dados — não mostrar telas de módulo vazias/quebradas.

- Modo claro apenas por enquanto (dark mode não é prioridade nesta fase).

- Responsivo o suficiente para uso em notebook/desktop (não precisa ser mobile-first).

### Fora de escopo nesta fase (não implementar agora)

- Backend, banco de dados, autenticação de usuários, múltiplas empresas salvas, histórico entre sessões.

- Conexão com APIs externas de índices econômicos (Bacen, IBGE etc.) — os valores vêm só da planilha por enquanto.

- Módulo de ETL completo — por enquanto, a "importação" é apenas o upload da planilha modelo descrito acima.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/29122592-cdf1-4299-bd98-cb7f74709d41).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
