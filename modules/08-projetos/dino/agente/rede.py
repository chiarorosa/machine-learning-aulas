"""Rede 6 -> 8 -> 3: seis observacoes, oito neuronios, tres acoes.

Escrita a mao em NumPy, de proposito. Os alunos ja viram tudo o que esta
aqui em aprendizado supervisionado: camada densa, ReLU, erro quadratico,
regra da cadeia.

A unica coisa que muda no Aprendizado por Reforco e DE ONDE VEM O ALVO -
e isso acontece em agente.py, nao aqui.

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""

import numpy as np

ENTRADAS = 6
OCULTAS = 8
SAIDAS = 3


class Rede:
    def __init__(self, entradas=ENTRADAS, ocultas=OCULTAS, saidas=SAIDAS, semente=None):
        rng = np.random.RandomState(semente)
        # Inicializacao de He: mantem a escala do sinal atravessando a ReLU.
        self.W1 = rng.randn(entradas, ocultas) * np.sqrt(2.0 / entradas)
        self.b1 = np.zeros(ocultas)
        self.W2 = rng.randn(ocultas, saidas) * np.sqrt(2.0 / ocultas)
        self.b2 = np.zeros(saidas)

    # ---------- passagem para a frente ----------

    def _frente(self, X):
        z1 = X @ self.W1 + self.b1
        a1 = np.maximum(0.0, z1)          # ReLU
        z2 = a1 @ self.W2 + self.b2       # saida linear: sao valores Q, nao probabilidades
        return z1, a1, z2

    def prever(self, X):
        X = np.asarray(X, dtype=float).reshape(-1, self.W1.shape[0])
        return self._frente(X)[2]

    def perda(self, X, alvos):
        X = np.asarray(X, dtype=float)
        alvos = np.asarray(alvos, dtype=float)
        erro = self._frente(X)[2] - alvos
        return float(np.mean(erro ** 2))

    # ---------- passagem para tras ----------

    def gradientes(self, X, alvos):
        X = np.asarray(X, dtype=float)
        alvos = np.asarray(alvos, dtype=float)
        n, saidas = alvos.shape

        z1, a1, z2 = self._frente(X)

        # d(perda)/d(z2) para perda = media((z2 - alvo)^2)
        dz2 = 2.0 * (z2 - alvos) / (n * saidas)

        dW2 = a1.T @ dz2
        db2 = dz2.sum(axis=0)

        da1 = dz2 @ self.W2.T
        dz1 = da1 * (z1 > 0)              # derivada da ReLU

        dW1 = X.T @ dz1
        db1 = dz1.sum(axis=0)

        return {"W1": dW1, "b1": db1, "W2": dW2, "b2": db2}

    def treinar(self, X, alvos, taxa):
        g = self.gradientes(X, alvos)
        self.W1 -= taxa * g["W1"]
        self.b1 -= taxa * g["b1"]
        self.W2 -= taxa * g["W2"]
        self.b2 -= taxa * g["b2"]
        return self.perda(X, alvos)

    # ---------- utilidades ----------

    def pesos(self):
        """Devolve as matrizes VIVAS, nao copias.

        O teste de gradiente por diferencas finitas depende disso para
        perturbar um peso no lugar - e e por isso que copiar_de precisa
        do .copy() explicito.
        """
        return {"W1": self.W1, "b1": self.b1, "W2": self.W2, "b2": self.b2}

    def copiar_de(self, outra):
        p = outra.pesos()
        self.W1 = p["W1"].copy()
        self.b1 = p["b1"].copy()
        self.W2 = p["W2"].copy()
        self.b2 = p["b2"].copy()

    def salvar(self, caminho):
        np.savez(caminho, W1=self.W1, b1=self.b1, W2=self.W2, b2=self.b2)

    @classmethod
    def carregar(cls, caminho):
        dados = np.load(caminho)
        rede = cls()
        rede.W1, rede.b1 = dados["W1"], dados["b1"]
        rede.W2, rede.b2 = dados["W2"], dados["b2"]
        return rede
