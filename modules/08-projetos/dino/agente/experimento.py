"""Treino sem tela para o professor; usa o mesmo motor e a mesma Sessao da aula.

python -m agente.experimento --transicoes 300000 --modelo modelos/experimento.npz
Requer Node.js. As avaliacoes ficam num CSV separado do score exploratorio.

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""
import argparse
import csv
import json
from pathlib import Path
import subprocess

from agente.agente import Agente
from agente.avaliar import avaliar
from agente.servidor import Sessao


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--transicoes", type=int, default=300000)
    p.add_argument("--semente", type=int, default=2026)
    p.add_argument("--modelo", default="modelos/experimento.npz")
    p.add_argument("--continuar", action="store_true")
    args = p.parse_args()
    a = Agente.carregar(args.modelo) if args.continuar else Agente(semente=args.semente)
    sessao = Sessao(a, quantidade=20)
    caminho = Path(args.modelo)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    script = Path(__file__).resolve().parents[1] / "jogo" / "ambientes-node.js"
    processo = subprocess.Popen(["node", str(script)], stdin=subprocess.PIPE,
                               stdout=subprocess.PIPE, text=True, bufsize=1)
    def trocar(acoes):
        processo.stdin.write(json.dumps(acoes) + "\n")
        processo.stdin.flush()
        return json.loads(processo.stdout.readline())

    arquivo = caminho.with_suffix(".avaliacao.csv")
    novo = not args.continuar or not arquivo.exists()
    try:
        with arquivo.open("w" if novo else "a", newline="", encoding="utf-8") as f:
            campos = ["transicoes", "media", "mediana", "minimo", "maximo", "limitados"]
            csv_saida = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
            if novo:
                csv_saida.writeheader()
            def medir():
                r = avaliar(a)
                r["transicoes"] = a.transicoes
                csv_saida.writerow(r)
                f.flush()
                a.salvar(caminho)
                print(json.dumps({k: r[k] for k in campos}), flush=True)
            medir()
            proxima = a.transicoes + 25000
            mensagem = trocar(None)
            while a.transicoes < args.transicoes:
                resposta = sessao.processar(mensagem)
                mensagem = trocar(resposta["acoes"])
                if a.transicoes >= proxima:
                    medir()
                    sessao.gravar_historico(caminho.with_suffix(".csv"))
                    proxima = a.transicoes + 25000
            medir()
    finally:
        a.salvar(caminho)
        sessao.gravar_historico(caminho.with_suffix(".csv"))
        processo.terminate()
        processo.wait()


if __name__ == "__main__":
    main()
