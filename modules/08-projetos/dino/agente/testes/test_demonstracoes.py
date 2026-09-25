"""Humano coleta, Treinar aprende da mesma memoria, Assistir so executa."""
import asyncio
import json

import numpy as np
import pytest

from agente.agente import Agente
from agente.memoria import Memoria
from agente.servidor import Sessao, atender


def jogada(acao=1, terminal=False):
    return {"tipo": "humano", "transicao": {
        "estado": [0.1, 0.5, 0, 0.6, 0, 0], "acao": acao,
        "recompensa": -10 if terminal else 0.1,
        "proximo": [0.09, 0.5, 0, 0.6, 0.094, 0.94], "terminal": terminal}}


def passo():
    return {"ambientes": [{"id": 0, "estado": [0.5, 0.5, 0, 0.6, 0, 0],
                            "recompensa": 0.1, "terminou": False, "pausado": False}]}


def test_humano_guarda_acao_real_e_morte_sem_treinar():
    a = Agente(semente=1)
    s = Sessao(a, 1)
    s.configurar({"modo": "humano"})
    pesos = {k: v.copy() for k, v in a.rede.pesos().items()}
    r = s.processar_humano(jogada(2, terminal=True))
    estados, acoes, recompensas, proximos, terminais = a.memoria.amostrar(1)
    assert acoes.tolist() == [2]
    assert recompensas.tolist() == [-10]
    assert terminais.tolist() == [True]
    assert np.allclose(estados[0], jogada()["transicao"]["estado"])
    assert np.allclose(proximos[0], jogada()["transicao"]["proximo"])
    assert a.passos == 0 and a.demonstracoes == 1 and a.episodios == 1
    assert all(np.array_equal(v, pesos[k]) for k, v in a.rede.pesos().items())
    assert r["info"]["memoria"] == 1
    assert "avaliar" not in r["info"]


def test_treino_amostra_as_demonstracoes_apos_trocar_de_modo():
    a = Agente(semente=1, lote=2)
    s = Sessao(a, 1)
    s.configurar({"modo": "humano"})
    for _ in range(2):
        s.processar_humano(jogada())
    original = a.memoria.amostrar
    lotes = []
    def observar(n):
        lote = original(n)
        lotes.append(lote)
        return lote
    a.memoria.amostrar = observar
    antes = a.rede.W1.copy()
    s.configurar({"modo": "treinar"})
    s.processar(passo())
    s.processar(passo())
    assert len(a.memoria) == 3
    assert a.passos == 1
    assert any(np.allclose(e, jogada()["transicao"]["estado"]) for e in lotes[0][0])
    assert not np.array_equal(a.rede.W1, antes)


def test_assistir_nao_muda_memoria_pesos_ou_contadores():
    a = Agente(semente=1)
    s = Sessao(a, 1)
    s.configurar({"modo": "humano"})
    s.processar_humano(jogada())
    antes = (a.transicoes, a.demonstracoes, a.episodios, a.passos, a.epsilon)
    pesos = {k: v.copy() for k, v in a.rede.pesos().items()}
    s.configurar({"modo": "assistir"})
    for _ in range(5):
        s.processar(passo())
    assert len(a.memoria) == 1 and not s._pendentes
    assert antes == (a.transicoes, a.demonstracoes, a.episodios, a.passos, a.epsilon)
    assert all(np.array_equal(v, pesos[k]) for k, v in a.rede.pesos().items())
    with pytest.raises(ValueError, match="Humano"):
        s.processar_humano(jogada())


def test_checkpoint_restaura_replay_e_ordem_de_descarte(tmp_path):
    a = Agente(semente=1, capacidade=3)
    for i in range(5):
        a.lembrar([i] * 6, i % 3, i, [i + 1] * 6, i == 4, humana=True)
    caminho = tmp_path / "humano.npz"
    a.salvar(caminho)
    b = Agente.carregar(caminho)
    assert b.demonstracoes == 5 and len(b.memoria) == 3
    assert b.epsilon == a.epsilon
    for k, v in a.memoria.exportar(6).items():
        assert np.array_equal(v, b.memoria.exportar(6)[k])
    b.lembrar([5] * 6, 0, 5, [6] * 6, False)
    assert b.memoria.exportar(6)["mem_recompensas"].tolist() == [3, 4, 5]


def test_replay_vazio_e_checkpoint_v2_continuam_compativeis(tmp_path):
    a = Agente(semente=1)
    caminho = tmp_path / "vazio.npz"
    a.salvar(caminho)
    assert len(Agente.carregar(caminho).memoria) == 0
    with np.load(caminho) as dados:
        antigo = {k: dados[k] for k in dados.files if not k.startswith("mem_") and k != "demonstracoes"}
    antigo["versao"] = 2
    np.savez(caminho, **antigo)
    b = Agente.carregar(caminho)
    assert len(b.memoria) == 0 and b.demonstracoes == 0


def test_troca_de_modo_salva_ultima_jogada_no_disco(tmp_path):
    class Socket:
        def __init__(self):
            self.respostas = []
        def __aiter__(self):
            async def mensagens():
                for m in [{"tipo": "configurar", "modo": "humano"}, jogada(2),
                          {"tipo": "configurar", "modo": "treinar"}]:
                    yield json.dumps(m)
            return mensagens()
        async def send(self, texto):
            self.respostas.append(json.loads(texto))
    caminho = tmp_path / "modelo.npz"
    socket = Socket()
    asyncio.run(atender(socket, Sessao(Agente(semente=1), 1), caminho))
    b = Agente.carregar(caminho)
    assert b.demonstracoes == 1 and b.passos == 0
    assert b.memoria.amostrar(1)[1].tolist() == [2]
    assert [r["tipo"] for r in socket.respostas] == ["configurado", "memorizado", "configurado"]


def test_jogada_invalida_nao_contamina_memoria():
    s = Sessao(Agente(), 1)
    s.configurar({"modo": "humano"})
    m = jogada()
    m["transicao"]["proximo"][0] = float("nan")
    with pytest.raises(ValueError):
        s.processar_humano(m)
    assert len(s.agente.memoria) == 0
