"""Curvas do treino, para o slide.

O HUD mostra o agora; isto mostra a trajetoria. Le o CSV que o servidor
grava e salva modelos/curvas.png.

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""

import csv
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

PASTA = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "modelos"))


def media_movel(valores, janela=25):
    if len(valores) < 2:
        return list(valores)
    saida, soma = [], 0.0
    for i, v in enumerate(valores):
        soma += v
        if i >= janela:
            soma -= valores[i - janela]
        saida.append(soma / min(i + 1, janela))
    return saida


def ler(caminho):
    with open(caminho, encoding="utf-8") as arquivo:
        return list(csv.DictReader(arquivo))


def gerar(caminho_csv=None, caminho_png=None):
    caminho_csv = caminho_csv or os.path.join(PASTA, "treino_6entradas.csv")
    caminho_png = caminho_png or os.path.join(PASTA, "curvas.png")

    if not os.path.exists(caminho_csv):
        raise SystemExit(f"{caminho_csv} nao existe — treine antes de gerar as curvas")

    linhas = ler(caminho_csv)
    if not linhas:
        raise SystemExit("historico.csv esta vazio — treine antes de gerar as curvas")

    episodios = [int(l["episodio"]) for l in linhas]
    scores = [int(l["score"]) for l in linhas]
    perdas = [max(1e-8, float(l["perda"])) for l in linhas]
    epsilons = [float(l["epsilon"]) for l in linhas]

    fig, eixos = plt.subplots(3, 1, figsize=(9, 8), sharex=True)

    eixos[0].plot(episodios, scores, linewidth=0.6, color="#c9c9c9", label="score")
    eixos[0].plot(episodios, media_movel(scores), linewidth=2, color="#b56a00",
                  label="média móvel (25)")
    eixos[0].set_ylabel("score")
    eixos[0].legend(loc="upper left")
    eixos[0].set_title("Dino RL — treino")

    eixos[1].plot(episodios, perdas, linewidth=0.8, color="#d13b3b")
    eixos[1].set_ylabel("perda")
    eixos[1].set_yscale("log")

    eixos[2].plot(episodios, epsilons, linewidth=1.5, color="#2f9e44")
    eixos[2].set_ylabel("épsilon")
    eixos[2].set_xlabel("episódio")

    fig.tight_layout()
    fig.savefig(caminho_png, dpi=130)
    print(f"[graficos] salvo em {caminho_png}")


if __name__ == "__main__":
    gerar()
