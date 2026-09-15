from __future__ import annotations

import os
from typing import Any


def map_accounts_with_gliner(unmatched: list[str]) -> tuple[list[str], dict[str, Any]]:
    """GLiNER2 fallback — só após falha de alias determinístico."""
    if not unmatched:
        return [], {"enabled": False, "attempted": 0, "matched": 0}

    enabled = os.getenv("GLINER_ENABLED", "false").lower() == "true"
    api_key = os.getenv("PIONEER_API_KEY") or os.getenv("GLINER_API_KEY")
    if not enabled:
        return [
            "GLiNER desabilitado (GLINER_ENABLED=false). Contas sem match: "
            + ", ".join(unmatched[:8])
        ], {"enabled": False, "attempted": len(unmatched), "matched": 0}

    if not api_key:
        return [
            "GLiNER habilitado sem token (PIONEER_API_KEY/GLINER_API_KEY). "
            f"{len(unmatched)} conta(s) pendente(s)."
        ], {"enabled": True, "attempted": len(unmatched), "matched": 0, "mode": "stub"}

    try:
        from gliner2 import API  # type: ignore

        client = API(api_key=api_key)
        labels = [
            "caixa",
            "contas_a_receber",
            "estoques",
            "impostos_a_recuperar",
            "fornecedores",
            "impostos_a_recolher",
            "salarios",
            "capital_social",
            "lucros_acumulados",
            "receita_bruta",
            "cmv",
        ]
        matched = 0
        avisos: list[str] = []
        for nome in unmatched:
            result = client.extract_entities(nome, labels)
            ents = (result or {}).get("entities") or {}
            if any(ents.values()):
                matched += 1
                avisos.append(f"GLiNER: '{nome}' → {ents}")
            else:
                avisos.append(f"GLiNER sem label para '{nome}'")
        return avisos, {
            "enabled": True,
            "attempted": len(unmatched),
            "matched": matched,
            "mode": "api",
        }
    except Exception as exc:  # noqa: BLE001
        return [f"GLiNER falhou: {exc}"], {
            "enabled": True,
            "attempted": len(unmatched),
            "matched": 0,
            "mode": "error",
            "error": str(exc),
        }
