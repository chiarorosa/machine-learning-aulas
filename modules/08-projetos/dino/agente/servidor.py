"""Ponte entre o jogo (navegador) e o cerebro (Python).

A classe Sessao e a logica do protocolo, sem rede nenhuma - por isso da
para testa-la inteira com pytest. A funcao main() so a embrulha num
servidor websockets.

O contrato: o navegador manda o estado s_t JUNTO com a recompensa da
transicao anterior. A sessao guarda (s_{t-1}, a_{t-1}) por ambiente,
fecha a transicao com r_t e s_t, e so entao escolhe a_t.

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""

import argparse
import asyncio
import json
import os

import numpy as np

from agente.agente import Agente
from agente.rede import ENTRADAS

PORTA = 8765
PASTA_MODELOS = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "modelos"))
MODELO_PADRAO = os.path.join(PASTA_MODELOS, "treino_6entradas.npz")
HISTORICO = os.path.join(PASTA_MODELOS, "treino_6entradas.csv")


class Sessao:
    def __init__(self, agente, quantidade, treinando=True, intervalo_pesos=30):
        self.agente = agente
        self.quantidade = quantidade
        self.treinando = treinando
        self.modo = "treinar" if treinando else "assistir"
        self.intervalo_pesos = intervalo_pesos
        self.historico = []
        self._pendentes = {}       # id do ambiente -> (estado, acao)
        self._contador = 0
        self._ultima_avaliacao = -1

    def configurar(self, mensagem):
        modo = mensagem.get("modo")
        if modo is None:  # compatibilidade com clientes anteriores
            modo = "treinar" if mensagem.get("treinando", True) else "assistir"
        if modo not in ("humano", "treinar", "assistir"):
            raise ValueError("Modo desconhecido: " + str(modo))
        self.modo = modo
        self.treinando = modo == "treinar"
        self.quantidade = int(mensagem.get("quantidade", self.quantidade))
        # Limpa apenas o pareamento de frames; a memoria pertence ao agente.
        self._pendentes.clear()

    def processar_humano(self, mensagem):
        """O jogador ja agiu: guarda a transicao completa, sem escolher nem treinar."""
        if self.modo != "humano":
            raise ValueError("Demonstracoes so sao aceitas no modo Humano.")
        t = mensagem["transicao"]
        for nome in ("estado", "proximo"):
            if len(t[nome]) != ENTRADAS or not np.isfinite(t[nome]).all():
                raise ValueError("Demonstracao com estado invalido.")
        if t["acao"] not in (0, 1, 2) or not np.isfinite(t["recompensa"]):
            raise ValueError("Demonstracao com acao ou recompensa invalida.")
        self.agente.lembrar(t["estado"], t["acao"], t["recompensa"],
                            t["proximo"], bool(t["terminal"]), humana=True)
        self._contador += 1
        info = self._info([t["proximo"]])
        info["acoes"] = [t["acao"]]
        return {"tipo": "memorizado", "info": info}

    def processar(self, mensagem):
        if self.modo == "humano":
            raise ValueError("No modo Humano envie a transicao executada pelo jogador.")
        ambientes = mensagem["ambientes"]
        self._conferir_formato(ambientes)

        antes = self.agente.transicoes
        if self.treinando:
            self._fechar_transicoes(ambientes)

        estados = [amb["estado"] for amb in ambientes]
        if self.treinando:
            # Um passo de gradiente por experiencia nova. Pausa nao e experiencia.
            for _ in range(self.agente.transicoes - antes):
                self.agente.treinar_um_passo()
            acoes = self.agente.escolher(estados)
        else:
            acoes = self.agente.melhores(estados)

        for amb, acao in zip(ambientes, acoes):
            # Um passo pausado (o dino caido) nao e experiencia, e um passo
            # terminal ja encerrou a vida: guardar qualquer um dos dois como
            # pendente costuraria a morte ao renascimento.
            if self.treinando and not amb.get("pausado") and not amb.get("terminou"):
                self._pendentes[amb["id"]] = (amb["estado"], acao)

        self._contador += 1
        info = self._info(estados)
        info["acoes"] = acoes
        return {"tipo": "acoes", "acoes": acoes, "info": info}

    @staticmethod
    def _conferir_formato(ambientes):
        """Rejeita estados com o numero errado de entradas.

        Sem isto o erro aparece la na frente, como um erro de forma dentro
        do NumPy, dificil de ligar a causa. E a causa e banal e comum em
        aula: uma aba antiga do navegador continua conectada (a ponte
        reconecta sozinha) e despeja estados de outro formato na mesma
        memoria, corrompendo o treino em silencio.
        """
        for amb in ambientes:
            if len(amb["estado"]) != ENTRADAS:
                raise ValueError(
                    f"ambiente {amb['id']} enviou {len(amb['estado'])} entradas, "
                    f"mas a rede espera {ENTRADAS}. Feche as outras abas do jogo "
                    f"e recarregue."
                )

    def _fechar_transicoes(self, ambientes):
        for amb in ambientes:
            if amb.get("pausado"):
                continue
            anterior = self._pendentes.get(amb["id"])
            if anterior is None:
                continue

            estado_antes, acao_antes = anterior
            terminou = bool(amb.get("terminou", False))
            self.agente.lembrar(estado_antes, acao_antes, amb["recompensa"],
                                amb["estado"], terminou)

            if terminou:
                self.historico.append({
                    "episodio": self.agente.episodios,
                    "passos": self.agente.passos,
                    "epsilon": round(float(self.agente.epsilon), 4),
                    "perda": round(float(self.agente.ultima_perda), 5),
                    "score": int(amb.get("score", 0)),
                })
                # A vida nova nao pode ser costurada na anterior.
                self._pendentes.pop(amb["id"], None)

    def _info(self, estados):
        info = {
            "epsilon": round(float(self.agente.epsilon), 4) if self.treinando else 0.0,
            "transicoes": self.agente.transicoes,
            "memoria": len(self.agente.memoria),
            "demonstracoes": self.agente.demonstracoes,
            "passos": self.agente.passos,
            "episodios": self.agente.episodios,
            "perda": round(float(self.agente.ultima_perda), 5),
            "q": [[round(v, 3) for v in linha]
                  for linha in self.agente.rede.prever(np.asarray(estados)).tolist()],
        }
        if self._contador == 1 or self._contador % self.intervalo_pesos == 0:
            p = self.agente.rede.pesos()
            info["pesos"] = {
                "W1": [[float(v) for v in linha] for linha in p["W1"]],
                "W2": [[float(v) for v in linha] for linha in p["W2"]],
            }
        # Fotografia congelada: a avaliacao nao altera pesos nem replay.
        marco = self.agente.transicoes // 25000
        if self.modo != "humano" and marco != self._ultima_avaliacao:
            self._ultima_avaliacao = marco
            info["avaliar"] = {k: v.tolist() for k, v in self.agente.rede.pesos().items()}
        return info

    def gravar_historico(self, caminho=HISTORICO):
        novo = not os.path.exists(caminho) or os.path.getsize(caminho) == 0
        with open(caminho, "a", encoding="utf-8") as arquivo:
            if novo:
                arquivo.write("episodio,passos,epsilon,perda,score\n")
            for linha in self.historico:
                arquivo.write("{episodio},{passos},{epsilon},{perda},{score}\n".format(**linha))
        self.historico.clear()


async def atender(websocket, sessao, caminho_modelo):
    ultimo_salvo = sessao.agente.transicoes

    def salvar():
        sessao.agente.salvar(caminho_modelo)
        sessao.gravar_historico(os.path.splitext(caminho_modelo)[0] + ".csv")
    async for bruto in websocket:
        mensagem = json.loads(bruto)

        if mensagem.get("tipo") == "configurar":
            sessao.configurar(mensagem)
            if sessao.agente.transicoes > ultimo_salvo:
                salvar()
                ultimo_salvo = sessao.agente.transicoes
            print(f"[ponte] modo {sessao.modo}, "
                  f"{sessao.quantidade} pistas")
            await websocket.send(json.dumps({"tipo": "configurado"}))
            continue

        resposta = (sessao.processar_humano(mensagem) if mensagem.get("tipo") == "humano"
                    else sessao.processar(mensagem))
        await websocket.send(json.dumps(resposta))

        intervalo = 300 if sessao.modo == "humano" else 5000
        if sessao.agente.transicoes - ultimo_salvo >= intervalo:
            salvar()
            ultimo_salvo = sessao.agente.transicoes
            print(f"[salvo] passos={sessao.agente.passos} "
                  f"episodios={sessao.agente.episodios} "
                  f"epsilon={sessao.agente.epsilon:.3f} -> {caminho_modelo}")


async def servir(args):
    import websockets

    os.makedirs(PASTA_MODELOS, exist_ok=True)

    os.makedirs(os.path.dirname(os.path.abspath(args.modelo)), exist_ok=True)
    if args.continuar or args.assistir:
        if not os.path.exists(args.modelo):
            raise ValueError("Modelo nao encontrado. Treine primeiro, sem --continuar ou --assistir.")
        agente = Agente.carregar(args.modelo, semente=args.semente)
        print(f"[cerebro] retomado de {args.modelo} ({agente.passos} passos de treino)")
    else:
        agente = Agente(semente=args.semente)
        print("[cerebro] novo, do zero")

    async def manipulador(websocket):
        # Cada aba tem suas proprias transicoes pendentes e seu proprio modo.
        sessao = Sessao(agente, quantidade=args.pistas, treinando=not args.assistir)
        transicoes_antes = agente.transicoes
        print("[ponte] navegador conectou")
        try:
            await atender(websocket, sessao, args.modelo)
        finally:
            if agente.transicoes > transicoes_antes:
                agente.salvar(args.modelo)
                sessao.gravar_historico(os.path.splitext(args.modelo)[0] + ".csv")
            print("[ponte] navegador desconectou")

    print(f"[ponte] ouvindo em ws://localhost:{PORTA} — agora abra jogo/index.html")
    async with websockets.serve(manipulador, "localhost", PORTA):
        await asyncio.Future()


def main():
    p = argparse.ArgumentParser(description="Cerebro do Dino RL")
    p.add_argument("--pistas", type=int, default=20)
    p.add_argument("--semente", type=int, default=2026)
    p.add_argument("--modelo", default=MODELO_PADRAO)
    p.add_argument("--continuar", action="store_true",
                   help="retoma o treino a partir do modelo salvo")
    p.add_argument("--assistir", action="store_true",
                   help="nao treina: so joga com o que ja aprendeu")
    args = p.parse_args()
    try:
        asyncio.run(servir(args))
    except KeyboardInterrupt:
        print("\n[ponte] encerrado")
    except ValueError as erro:
        p.error(str(erro))


if __name__ == "__main__":
    main()
