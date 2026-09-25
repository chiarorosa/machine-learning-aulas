"""O cerebro. Um so, compartilhado pelas 20 pistas.

A unica linha genuinamente nova em relacao ao aprendizado supervisionado
que os alunos ja conhecem esta em _alvos():

    alvo = recompensa + gama * max Q(proximo_estado)

Dali para baixo e backprop comum, com erro quadratico. O que muda no
Aprendizado por Reforco nao e COMO a rede aprende - e DE ONDE VEM O ALVO.

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""

import json
import os
import tempfile

import numpy as np

from agente.memoria import Memoria
from agente.rede import ENTRADAS, SAIDAS, Rede


class Agente:
    def __init__(self, semente=None, gama=0.99, taxa=0.001,
                 epsilon_inicial=1.0, epsilon_final=0.05,
                 transicoes_decaimento=200000, capacidade=50000,
                 lote=64, sincronizar_alvo=500):
        self.gama = gama
        self.taxa = taxa
        self.epsilon_inicial = epsilon_inicial
        self.epsilon_final = epsilon_final
        self.transicoes_decaimento = transicoes_decaimento
        self.lote = lote
        self.sincronizar_alvo = sincronizar_alvo

        self.rede = Rede(semente=semente)
        self.rede_alvo = Rede(semente=semente)
        self.rede_alvo.copiar_de(self.rede)

        self.memoria = Memoria(capacidade=capacidade, semente=semente)
        self._rng = np.random.RandomState(semente)

        self.passos = 0          # passos de gradiente
        self.transicoes = 0      # experiencias vividas
        self.demonstracoes = 0   # experiencias fornecidas pelo jogador
        self.episodios = 0
        self.ultima_perda = 0.0

    # ---------- exploracao ----------

    @property
    def epsilon(self):
        """Decai com a EXPERIENCIA vivida, nao com os passos de gradiente.

        Sao coisas diferentes: 20 pistas rodando geram 20 transicoes por
        frame. Amarrar epsilon ao numero de passos de gradiente faria a
        exploracao encolher ou esticar sempre que mudassemos quanto se
        treina por transicao coletada - que e uma decisao de otimizacao,
        nao de exploracao.
        """
        if self.transicoes >= self.transicoes_decaimento:
            return self.epsilon_final
        fracao = self.transicoes / self.transicoes_decaimento
        return self.epsilon_inicial + fracao * (self.epsilon_final - self.epsilon_inicial)

    def escolher(self, estados):
        """epsilon-greedy em lote: com probabilidade epsilon, sorteia."""
        estados = np.asarray(estados, dtype=float).reshape(-1, ENTRADAS)
        melhores = np.argmax(self.rede.prever(estados), axis=1)
        explorar = self._rng.rand(len(estados)) < self.epsilon
        aleatorias = self._rng.randint(0, SAIDAS, size=len(estados))
        return [int(aleatorias[i]) if explorar[i] else int(melhores[i])
                for i in range(len(estados))]

    def melhores(self, estados):
        """Greedy puro: so o que ja aprendeu. E o modo Assistir."""
        estados = np.asarray(estados, dtype=float).reshape(-1, ENTRADAS)
        return [int(v) for v in np.argmax(self.rede.prever(estados), axis=1)]

    def valores_q(self, estado):
        return [float(v) for v in self.rede.prever(np.asarray(estado).reshape(1, ENTRADAS))[0]]

    # ---------- aprendizado ----------

    def lembrar(self, estado, acao, recompensa, proximo, terminal, humana=False):
        self.memoria.guardar(estado, acao, recompensa, proximo, terminal)
        self.transicoes += 1
        if humana:
            self.demonstracoes += 1
        if terminal:
            self.episodios += 1

    def _alvos(self, estados, acoes, recompensas, proximos, terminais):
        # Partimos da propria previsao: assim as duas acoes NAO tomadas ficam
        # com alvo igual a previsao e nao geram erro nenhum. So a acao
        # efetivamente executada recebe informacao nova.
        alvos = self.rede.prever(estados).copy()

        melhor_futuro = self.rede_alvo.prever(proximos).max(axis=1)
        # Num estado terminal nao ha futuro a somar: o alvo e so a recompensa.
        # E daqui que o prejuizo da morte comeca a caminhar para tras.
        melhor_futuro = np.where(terminais, 0.0, melhor_futuro)

        alvos[np.arange(len(acoes)), acoes] = recompensas + self.gama * melhor_futuro
        return alvos

    def treinar_um_passo(self):
        if len(self.memoria) < self.lote:
            return None

        estados, acoes, recompensas, proximos, terminais = self.memoria.amostrar(self.lote)
        alvos = self._alvos(estados, acoes, recompensas, proximos, terminais)
        self.ultima_perda = self.rede.treinar(estados, alvos, self.taxa)

        self.passos += 1
        if self.passos % self.sincronizar_alvo == 0:
            # Sem esta copia congelada, o alvo se move junto com a previsao
            # e a rede persegue a propria sombra.
            self.rede_alvo.copiar_de(self.rede)

        return self.ultima_perda

    # ---------- persistencia ----------

    def salvar(self, caminho):
        p = self.rede.pesos()
        # A rampa de exploracao tambem faz parte do treino, nao so os pesos.
        nomes = ("gama", "taxa", "epsilon_inicial", "epsilon_final",
                 "transicoes_decaimento", "lote", "sincronizar_alvo")
        hiper = {nome: getattr(self, nome) for nome in nomes}
        hiper["capacidade"] = self.memoria.capacidade
        alvo = {"alvo_" + k: v for k, v in self.rede_alvo.pesos().items()}
        # Troca atomica: um avaliador nunca le metade de um checkpoint.
        pasta = os.path.dirname(os.path.abspath(caminho))
        with tempfile.NamedTemporaryFile(dir=pasta, suffix=".npz", delete=False) as f:
            temporario = f.name
        try:
            np.savez_compressed(temporario, **p, **alvo, versao=3,
                     **self.memoria.exportar(ENTRADAS), demonstracoes=self.demonstracoes,
                     passos=self.passos, episodios=self.episodios,
                     transicoes=self.transicoes, hiper=json.dumps(hiper))
            os.replace(temporario, caminho)
        finally:
            if os.path.exists(temporario):
                os.unlink(temporario)

    @classmethod
    def carregar(cls, caminho, **hiper):
        with np.load(caminho, allow_pickle=False) as dados:
            if dados["W1"].shape[0] != ENTRADAS:
                raise ValueError(
                    f"Modelo antigo com {dados['W1'].shape[0]} entradas; "
                    f"esta aula usa {ENTRADAS}. Inicie um treino novo, sem --continuar."
                )
            if "transicoes" not in dados or "hiper" not in dados:
                raise ValueError("Checkpoint sem estado de exploracao. Inicie um treino novo.")
            configuracao = json.loads(str(dados["hiper"]))
            configuracao.update(hiper)
            agente = cls(**configuracao)
            for nome, peso in agente.rede.pesos().items():
                if dados[nome].shape != peso.shape:
                    raise ValueError("Arquitetura do checkpoint difere da rede atual.")
                setattr(agente.rede, nome, dados[nome].copy())
                setattr(agente.rede_alvo, nome, dados["alvo_" + nome].copy())
            agente.passos = int(dados["passos"])
            agente.episodios = int(dados["episodios"])
            agente.transicoes = int(dados["transicoes"])
            # Checkpoints de seis entradas anteriores a esta revisao nao tinham replay.
            if "mem_estados" in dados:
                agente.memoria.restaurar(dados)
            if "demonstracoes" in dados:
                agente.demonstracoes = int(dados["demonstracoes"])
        return agente
