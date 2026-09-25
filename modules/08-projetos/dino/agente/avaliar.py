"""Avalia um checkpoint sem treinar: python -m agente.avaliar (requer Node.js).

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""
import argparse
import json
from pathlib import Path
import subprocess

from agente.agente import Agente
from agente.servidor import MODELO_PADRAO


def avaliar(agente, quantidade=20, limite=3000):
    if quantidade < 1 or limite < 1:
        raise ValueError("Quantidade e limite precisam ser positivos.")
    script = Path(__file__).resolve().parents[1] / "jogo" / "avaliar-node.js"
    pedido = {"pesos": {k: v.tolist() for k, v in agente.rede.pesos().items()},
              "quantidade": quantidade, "limite": limite}
    resposta = subprocess.run(["node", str(script)], input=json.dumps(pedido),
                              capture_output=True, text=True, check=True)
    return json.loads(resposta.stdout)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--modelo", default=MODELO_PADRAO)
    p.add_argument("--partidas", type=int, default=20)
    p.add_argument("--limite", type=int, default=3000)
    args = p.parse_args()
    try:
        agente = Agente.carregar(args.modelo)
        resultado = avaliar(agente, args.partidas, args.limite)
    except (ValueError, OSError, subprocess.CalledProcessError) as erro:
        p.error(str(erro))
    resultado.update(transicoes=agente.transicoes, passos=agente.passos)
    print(json.dumps(resultado, indent=2))


if __name__ == "__main__":
    main()
