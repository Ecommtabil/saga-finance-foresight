from app.aliases import alias_bp, normalizar


def test_alias_banco_brasil():
    assert alias_bp("Banco do Brasil S/A.") == "caixa"
    assert alias_bp("Mercado Pago") == "caixa"
    assert alias_bp("Duplicatas a Receber") == "contasReceber"
    assert alias_bp("Mercadoria") == "estoques"
    assert alias_bp("ICMS a Recuperar") == "impostosRecuperar"
    assert alias_bp("DIFAL ICMS") == "impostosRecolher"


def test_normalizar():
    assert normalizar("Exercício Atual") == "exercicioatual"
