"""Memoria de repeticao (replay buffer).

Existe por um motivo que vale dizer em aula: frames consecutivos do jogo
sao quase identicos. Treinar na ordem em que a experiencia chega faria a
rede ver 64 exemplos praticamente iguais por lote, e ela oscilaria atras
do ultimo trecho vivido.

Sorteando de uma memoria grande, cada lote mistura situacoes distantes no
tempo - o que aproxima o treino da condicao de dados independentes que o
aprendizado supervisionado assume.

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""

import random

import numpy as np


class Memoria:
    def __init__(self, capacidade=50000, semente=None):
        self.capacidade = capacidade
        self._itens = []
        self._proximo = 0          # escrita circular: descarta o mais antigo
        self._rng = random.Random(semente)

    def __len__(self):
        return len(self._itens)

    def guardar(self, estado, acao, recompensa, proximo_estado, terminal):
        item = (
            np.asarray(estado, dtype=float),
            int(acao),
            float(recompensa),
            np.asarray(proximo_estado, dtype=float),
            bool(terminal),
        )
        if len(self._itens) < self.capacidade:
            self._itens.append(item)
        else:
            self._itens[self._proximo] = item
        self._proximo = (self._proximo + 1) % self.capacidade

    def amostrar(self, n):
        n = min(n, len(self._itens))
        lote = self._rng.sample(self._itens, n)
        return (
            np.stack([t[0] for t in lote]),
            np.array([t[1] for t in lote], dtype=np.int64),
            np.array([t[2] for t in lote], dtype=float),
            np.stack([t[3] for t in lote]),
            np.array([t[4] for t in lote], dtype=bool),
        )

    def exportar(self, entradas):
        """Vetores numericos, sem pickle, na ordem do mais antigo ao mais novo."""
        itens = self._itens
        if len(itens) == self.capacidade:
            itens = itens[self._proximo:] + itens[:self._proximo]
        return {
            "mem_estados": np.array([t[0] for t in itens], dtype=float).reshape(-1, entradas),
            "mem_acoes": np.array([t[1] for t in itens], dtype=np.int64),
            "mem_recompensas": np.array([t[2] for t in itens], dtype=float),
            "mem_proximos": np.array([t[3] for t in itens], dtype=float).reshape(-1, entradas),
            "mem_terminais": np.array([t[4] for t in itens], dtype=bool),
        }

    def restaurar(self, dados):
        self._itens.clear()
        self._proximo = 0
        for transicao in zip(dados["mem_estados"], dados["mem_acoes"],
                             dados["mem_recompensas"], dados["mem_proximos"],
                             dados["mem_terminais"]):
            self.guardar(*transicao)
