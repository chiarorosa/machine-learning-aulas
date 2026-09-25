import numpy as np
import pytest

from agente.rede import Rede


def test_formato_da_previsao():
    assert Rede(semente=1).prever(np.zeros((5, 6))).shape == (5, 3)


def test_pesos_tem_as_formas_da_ilustracao():
    p = Rede(semente=1).pesos()
    assert p["W1"].shape == (6, 8)
    assert p["b1"].shape == (8,)
    assert p["W2"].shape == (8, 3)
    assert p["b2"].shape == (3,)


def test_mesma_semente_mesma_rede():
    a, b = Rede(semente=7), Rede(semente=7)
    X = np.random.RandomState(0).rand(3, 6)
    assert np.allclose(a.prever(X), b.prever(X))


def test_treinar_reduz_a_perda():
    rede = Rede(semente=3)
    X = np.random.RandomState(0).rand(64, 6)
    alvos = np.random.RandomState(1).rand(64, 3)
    primeira = rede.treinar(X, alvos, taxa=0.05)
    for _ in range(300):
        ultima = rede.treinar(X, alvos, taxa=0.05)
    assert ultima < primeira * 0.5


def test_gradiente_confere_com_diferencas_finitas():
    """Prova que o backprop escrito a mao esta correto.

    Material de aula: compara o gradiente analitico com a inclinacao
    medida empiricamente, perturbando cada peso um pouquinho.
    """
    rede = Rede(semente=11)
    X = np.random.RandomState(0).rand(6, 6)
    alvos = np.random.RandomState(1).rand(6, 3)

    analitico = rede.gradientes(X, alvos)
    eps = 1e-5

    for nome in ("W1", "b1", "W2", "b2"):
        plano = rede.pesos()[nome].reshape(-1)
        grad_plano = analitico[nome].reshape(-1)
        indices = np.unique(np.linspace(0, plano.size - 1, min(8, plano.size)).astype(int))
        for i in indices:
            guardado = plano[i]
            plano[i] = guardado + eps
            mais = rede.perda(X, alvos)
            plano[i] = guardado - eps
            menos = rede.perda(X, alvos)
            plano[i] = guardado
            numerico = (mais - menos) / (2 * eps)
            assert numerico == pytest.approx(grad_plano[i], abs=1e-6), (
                f"{nome}[{i}]: analitico {grad_plano[i]}, numerico {numerico}"
            )


def test_copiar_de_iguala_as_redes():
    origem, destino = Rede(semente=1), Rede(semente=2)
    X = np.random.RandomState(0).rand(4, 6)
    assert not np.allclose(origem.prever(X), destino.prever(X))
    destino.copiar_de(origem)
    assert np.allclose(origem.prever(X), destino.prever(X))


def test_copiar_de_nao_compartilha_memoria():
    origem, destino = Rede(semente=1), Rede(semente=2)
    destino.copiar_de(origem)
    destino.pesos()["W1"][0, 0] += 1.0
    assert origem.pesos()["W1"][0, 0] != destino.pesos()["W1"][0, 0]


def test_salvar_e_carregar(tmp_path):
    rede = Rede(semente=5)
    caminho = tmp_path / "pesos.npz"
    rede.salvar(caminho)
    recuperada = Rede.carregar(caminho)
    X = np.random.RandomState(0).rand(4, 6)
    assert np.allclose(rede.prever(X), recuperada.prever(X))
