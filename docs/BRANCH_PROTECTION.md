# Proteção da branch `main`

Configure no GitHub (Settings → Branches → Branch protection rule) para `main`:

1. **Require a pull request before merging**
2. **Require status checks to pass**: `ci`
3. **Do not allow bypassing** (exceto emergências documentadas)
4. **Do not allow force pushes**
5. **Do not allow deletions**

Enquanto a rule não estiver ativa no UI, a equipe e os agentes devem seguir o mesmo padrão manualmente (ver `docs/CONTEXTO.md`).

## Comando de apoio (admin)

```bash
gh api repos/ftsmazzo/saga-finance-insights-a80750e9/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["ci"]}' \
  -F enforce_admins=true \
  -F required_pull_request_reviews='{"required_approving_review_count":0}' \
  -F restrictions= \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

(Ajuste o payload conforme a API atual do GitHub se necessário.)
