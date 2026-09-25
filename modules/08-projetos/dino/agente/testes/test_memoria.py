import numpy as np

from agente.memoria import Memoria


def transicao(valor):
    return ([valor] * 4, valor % 3, float(valor), [valor + 1] * 4, valor % 7 == 0)


def test_comeca_vazia():
    assert len(Memoria()) == 0


def test_guarda_e_cresce():
    m = Memoria()
    for i in range(10):
        m.guardar(*transicao(i))
    assert len(m) == 10


def test_respeita_a_capacidade_descartando_o_mais_antigo():
    m = Memoria(capacidade=5)
    for i in range(12):
        m.guardar(*transicao(i))
    assert len(m) == 5
    _, _, recompensas, _, _ = m.amostrar(5)
    assert recompensas.min() >= 7.0


def test_amostrar_devolve_as_formas_certas():
    m = Memoria(semente=0)
    for i in range(100):
        m.guardar(*transicao(i))
    estados, acoes, recompensas, proximos, terminais = m.amostrar(16)
    assert estados.shape == (16, 4)
    assert acoes.shape == (16,)
    assert recompensas.shape == (16,)
    assert proximos.shape == (16, 4)
    assert terminais.shape == (16,)
    assert acoes.dtype.kind == "i"
    assert terminais.dtype == bool


def test_amostrar_com_memoria_pequena_devolve_o_que_tem():
    m = Memoria(semente=0)
    for i in range(3):
        m.guardar(*transicao(i))
    assert m.amostrar(16)[0].shape[0] == 3


def test_amostragem_e_reproduzivel():
    def rodar():
        m = Memoria(semente=42)
        for i in range(200):
            m.guardar(*transicao(i))
        return m.amostrar(8)[2]
    assert np.allclose(rodar(), rodar())


def test_amostragem_nao_e_sempre_a_mesma():
    m = Memoria(semente=42)
    for i in range(200):
        m.guardar(*transicao(i))
    assert not np.allclose(m.amostrar(8)[2], m.amostrar(8)[2])
