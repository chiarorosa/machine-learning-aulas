import numpy as np
import pytest

from agente.agente import Agente
from agente.servidor import Sessao


def mensagem(ambientes):
    return {"tipo": "passo", "ambientes": ambientes}


def ambiente(id_, estado, recompensa=0.1, terminou=False, pausado=False, score=0):
    return {"id": id_, "estado": estado, "recompensa": recompensa,
            "terminou": terminou, "pausado": pausado, "score": score}


def test_devolve_uma_acao_por_ambiente():
    s = Sessao(Agente(semente=1), quantidade=3)
    resposta = s.processar(mensagem([
        ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0]),
        ambiente(1, [0.2, 0.3, 0.0, 0.5, 0, 0]),
        ambiente(2, [0.9, 0.0, 0.0, 0.5, 0, 0]),
    ]))
    assert resposta["tipo"] == "acoes"
    assert len(resposta["acoes"]) == 3
    assert all(a in (0, 1, 2) for a in resposta["acoes"])


def test_primeira_mensagem_nao_guarda_transicao():
    a = Agente(semente=1)
    Sessao(a, quantidade=1).processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    assert len(a.memoria) == 0, "nao ha estado anterior para fechar"


def test_segunda_mensagem_fecha_a_transicao():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1)
    s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    s.processar(mensagem([ambiente(0, [0.4, 0.3, 0.0, 0.5, 0, 0])]))
    assert len(a.memoria) == 1


def test_a_transicao_guardada_e_a_certa():
    a = Agente(semente=1, epsilon_inicial=0.0, epsilon_final=0.0)
    s = Sessao(a, quantidade=1)
    primeiro = [0.5, 0.3, 0.0, 0.5, 0, 0]
    segundo = [0.4, 0.3, 0.0, 0.5, 0, 0]

    acao = s.processar(mensagem([ambiente(0, primeiro)]))["acoes"][0]
    s.processar(mensagem([ambiente(0, segundo, recompensa=-10.0, terminou=True)]))

    estados, acoes, recompensas, proximos, terminais = a.memoria.amostrar(1)
    assert np.allclose(estados[0], primeiro)
    assert acoes[0] == acao
    assert recompensas[0] == pytest.approx(-10.0)
    assert np.allclose(proximos[0], segundo)
    assert terminais[0]


def test_passo_terminal_zera_o_pendente():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1)
    s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    s.processar(mensagem([ambiente(0, [0.1, 0.3, 0.0, 0.5, 0, 0], recompensa=-10.0, terminou=True)]))
    antes = len(a.memoria)
    # o primeiro passo da vida nova nao pode ser costurado na vida anterior
    s.processar(mensagem([ambiente(0, [0.9, 0.0, 0.0, 0.46, 0, 0])]))
    assert len(a.memoria) == antes


def test_passos_pausados_sao_ignorados():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1)
    s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    antes = len(a.memoria)
    for _ in range(5):
        s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0], pausado=True)]))
    assert len(a.memoria) == antes


def test_morte_entra_no_historico_com_o_score():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1)
    s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    s.processar(mensagem([ambiente(0, [0.1, 0.3, 0.0, 0.5, 0, 0],
                                   recompensa=-10.0, terminou=True, score=437)]))
    assert len(s.historico) == 1
    assert s.historico[0]["score"] == 437
    assert s.historico[0]["episodio"] == 1


def test_rejeita_estado_com_numero_errado_de_entradas():
    s = Sessao(Agente(semente=1), quantidade=1)
    with pytest.raises(ValueError, match="5 entradas"):
        s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0.9])]))


def test_estado_errado_nao_suja_a_memoria():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1)
    s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    with pytest.raises(ValueError):
        s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0])]))
    assert len(a.memoria) == 0


def test_treina_uma_vez_por_ambiente():
    """Um passo de gradiente por transicao coletada, como no DQN classico.

    Uma mensagem traz uma transicao POR PISTA. Treinar uma vez por mensagem
    significaria treinar 20x menos do que se coleta - e foi exatamente isso
    que manteve o score achatado na primeira versao.
    """
    a = Agente(semente=1, lote=2)
    s = Sessao(a, quantidade=4)
    ambientes = [ambiente(i, [0.5, 0.3, 0.0, 0.5, 0, 0]) for i in range(4)]

    s.processar(mensagem(ambientes))      # memoria vazia: nada a treinar
    assert a.passos == 0

    s.processar(mensagem(ambientes))      # fecha 4 transicoes
    assert a.passos == 4, "deveria treinar uma vez por pista"

    s.processar(mensagem(ambientes))
    assert a.passos == 8


def test_modo_assistir_nao_treina_nem_memoriza():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1, treinando=False)
    for i in range(10):
        s.processar(mensagem([ambiente(0, [0.5 - i * 0.04, 0.3, 0.0, 0.5, 0, 0])]))
    assert len(a.memoria) == 0
    assert a.passos == 0


def test_modo_assistir_joga_sem_explorar():
    a = Agente(semente=1, epsilon_inicial=1.0, epsilon_final=1.0)
    s = Sessao(a, quantidade=1, treinando=False)
    estado = [0.5, 0.3, 0.0, 0.5, 0, 0]
    esperado = a.melhores([estado])[0]
    for _ in range(10):
        assert s.processar(mensagem([ambiente(0, estado)]))["acoes"] == [esperado]


def test_info_traz_o_que_o_hud_precisa():
    s = Sessao(Agente(semente=1), quantidade=2)
    info = s.processar(mensagem([
        ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0]),
        ambiente(1, [0.2, 0.3, 0.0, 0.5, 0, 0]),
    ]))["info"]
    for chave in ("epsilon", "passos", "episodios", "perda", "q"):
        assert chave in info
    assert len(info["q"]) == 2 and len(info["q"][0]) == 3


def test_pesos_vem_so_de_vez_em_quando():
    s = Sessao(Agente(semente=1), quantidade=1, intervalo_pesos=5)
    vindas = sum(
        1 for _ in range(20)
        if "pesos" in s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))["info"]
    )
    assert 3 <= vindas <= 5, f"mandou pesos {vindas} vezes em 20 passos"


def test_formato_dos_pesos_enviados():
    s = Sessao(Agente(semente=1), quantidade=1, intervalo_pesos=1)
    pesos = s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))["info"]["pesos"]
    assert len(pesos["W1"]) == 6 and len(pesos["W1"][0]) == 8
    assert len(pesos["W2"]) == 8 and len(pesos["W2"][0]) == 3
    assert isinstance(pesos["W1"][0][0], float)


def test_grava_historico_em_csv(tmp_path):
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1)
    s.processar(mensagem([ambiente(0, [0.5, 0.3, 0.0, 0.5, 0, 0])]))
    s.processar(mensagem([ambiente(0, [0.1, 0.3, 0.0, 0.5, 0, 0],
                                   recompensa=-10.0, terminou=True, score=12)]))
    caminho = tmp_path / "historico.csv"
    s.gravar_historico(caminho)
    linhas = caminho.read_text(encoding="utf-8").strip().splitlines()
    assert linhas[0] == "episodio,passos,epsilon,perda,score"
    assert linhas[1].endswith(",12")


def test_pausa_nao_faz_atualizacoes_extras():
    a = Agente(semente=1, lote=1)
    s = Sessao(a, quantidade=1)
    estado = [0.5, 0.3, 0, 0.5, 0, 0]
    s.processar(mensagem([ambiente(0, estado)]))
    s.processar(mensagem([ambiente(0, estado, terminou=True)]))
    antes = a.passos
    for _ in range(10):
        s.processar(mensagem([ambiente(0, estado, pausado=True)]))
    assert a.passos == antes


def test_painel_recebe_acao_executada_e_epsilon_efetivo():
    s = Sessao(Agente(semente=1), quantidade=1, treinando=False)
    r = s.processar(mensagem([ambiente(0, [0.5, 0.3, 0, 0.5, 0, 0])]))
    assert r["info"]["acoes"] == r["acoes"]
    assert r["info"]["epsilon"] == 0


def test_avaliacao_envia_snapshot_no_inicio_e_a_cada_marco():
    a = Agente(semente=1)
    s = Sessao(a, quantidade=1, treinando=False)
    msg = mensagem([ambiente(0, [0.5, 0.3, 0, 0.5, 0, 0])])
    foto = s.processar(msg)["info"]["avaliar"]
    assert set(foto) == {"W1", "b1", "W2", "b2"}
    assert "avaliar" not in s.processar(msg)["info"]
    a.transicoes = 25000
    assert "avaliar" in s.processar(msg)["info"]
    a.rede.W1[:] = 123
    assert not np.all(np.asarray(foto["W1"]) == 123)


def test_historico_acrescenta_sem_duplicar(tmp_path):
    s = Sessao(Agente(), quantidade=1)
    caminho = tmp_path / "historico.csv"
    for episodio in [1, 2]:
        s.historico.append(dict(episodio=episodio, passos=1, epsilon=1, perda=0, score=116))
        s.gravar_historico(caminho)
    s.gravar_historico(caminho)
    assert len(caminho.read_text().splitlines()) == 3
