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
