import numpy as np
import pytest

from agente.agente import Agente


def test_epsilon_decai_com_a_experiencia_ate_o_minimo():
    a = Agente(semente=1, transicoes_decaimento=100,
               epsilon_inicial=1.0, epsilon_final=0.05)
    assert a.epsilon == pytest.approx(1.0)
    a.transicoes = 50
    assert a.epsilon == pytest.approx(0.525, abs=0.01)
    a.transicoes = 100
    assert a.epsilon == pytest.approx(0.05)
    a.transicoes = 10_000
    assert a.epsilon == pytest.approx(0.05)


def test_epsilon_ignora_os_passos_de_gradiente():
    """Exploracao mede experiencia, nao otimizacao.

    Treinar mais vezes sobre a mesma memoria nao pode encolher o epsilon:
    o agente nao viu nada de novo.
    """
    a = Agente(semente=1, transicoes_decaimento=100, lote=4)
    for _ in range(10):
        a.lembrar([0.1] * 6, 0, 0.1, [0.1] * 6, False)
    antes = a.epsilon
    for _ in range(200):
        a.treinar_um_passo()
    assert a.passos == 200
    assert a.epsilon == pytest.approx(antes)


def test_lembrar_conta_transicoes():
    a = Agente(semente=1)
    for _ in range(7):
        a.lembrar([0.1] * 6, 0, 0.1, [0.1] * 6, False)
    assert a.transicoes == 7


def test_com_epsilon_zero_escolhe_sempre_o_argmax():
    a = Agente(semente=1, epsilon_inicial=0.0, epsilon_final=0.0)
    estados = np.random.RandomState(0).rand(20, 6)
    esperado = [int(v) for v in np.argmax(a.rede.prever(estados), axis=1)]
    assert a.escolher(estados) == esperado


def test_com_epsilon_um_explora_de_verdade():
    a = Agente(semente=1, epsilon_inicial=1.0, epsilon_final=1.0)
    assert set(a.escolher(np.zeros((300, 6)))) == {0, 1, 2}


def test_melhores_ignora_o_epsilon():
    a = Agente(semente=1, epsilon_inicial=1.0, epsilon_final=1.0)
    estados = np.random.RandomState(0).rand(20, 6)
    esperado = [int(v) for v in np.argmax(a.rede.prever(estados), axis=1)]
    assert a.melhores(estados) == esperado


def test_nao_treina_sem_amostra_suficiente():
    a = Agente(semente=1, lote=64)
    for _ in range(10):
        a.lembrar([0.1] * 6, 0, 0.1, [0.1] * 6, False)
    assert a.treinar_um_passo() is None


def test_treina_quando_ha_amostra():
    a = Agente(semente=1, lote=8)
    for i in range(50):
        a.lembrar([0.1] * 6, i % 3, 0.1, [0.2] * 6, False)
    assert isinstance(a.treinar_um_passo(), float)


def test_lembrar_conta_episodios_so_no_terminal():
    a = Agente(semente=1)
    a.lembrar([0.1] * 6, 0, 0.1, [0.1] * 6, False)
    assert a.episodios == 0
    a.lembrar([0.1] * 6, 0, -10.0, [0.1] * 6, True)
    assert a.episodios == 1


def test_alvo_terminal_nao_usa_o_futuro():
    """O passo da morte e onde o prejuizo entra no sistema.

    Num estado terminal o alvo e apenas a recompensa: nao ha futuro a
    somar. E dai que ele comeca a caminhar para tras.
    """
    a = Agente(semente=1, gama=0.99)
    estados = np.zeros((2, 6))
    proximos = np.ones((2, 6))
    alvos = a._alvos(estados, np.array([1, 1]), np.array([-10.0, -10.0]),
                     proximos, np.array([True, False]))

    q_proximo = a.rede_alvo.prever(proximos).max(axis=1)
    assert alvos[0, 1] == pytest.approx(-10.0)
    assert alvos[1, 1] == pytest.approx(-10.0 + 0.99 * q_proximo[1])


def test_alvo_so_mexe_na_acao_tomada():
    a = Agente(semente=1)
    estados = np.zeros((1, 6))
    q_antes = a.rede.prever(estados)[0]
    alvos = a._alvos(estados, np.array([2]), np.array([5.0]),
                     np.zeros((1, 6)), np.array([False]))
    assert alvos[0, 0] == pytest.approx(q_antes[0])
    assert alvos[0, 1] == pytest.approx(q_antes[1])
    assert alvos[0, 2] != pytest.approx(q_antes[2])


def test_rede_alvo_so_sincroniza_na_frequencia_certa():
    a = Agente(semente=1, lote=4, sincronizar_alvo=10, taxa=0.05)
    for i in range(20):
        a.lembrar([0.1] * 6, i % 3, 1.0, [0.9] * 6, False)

    X = np.random.RandomState(0).rand(3, 6)
    for _ in range(5):
        a.treinar_um_passo()
    assert not np.allclose(a.rede.prever(X), a.rede_alvo.prever(X)), \
        "a rede-alvo nao deveria ter acompanhado ainda"

    for _ in range(5):
        a.treinar_um_passo()
    assert np.allclose(a.rede.prever(X), a.rede_alvo.prever(X)), \
        "deveria ter sincronizado no passo 10"


def test_aprende_uma_tarefa_de_brinquedo():
    """Sanidade ponta a ponta: um mundo de um passo so.

    Estado [1,0,0,0, 0, 0] -> a acao 1 vale +1, as outras -1.
    Estado [0,1,0,0, 0, 0] -> a acao 2 vale +1, as outras -1.
    Se o agente nao resolver isto, nada adianta ligar no jogo.
    """
    a = Agente(semente=3, taxa=0.01, lote=32, epsilon_inicial=0.0,
               epsilon_final=0.0, sincronizar_alvo=50)
    mundo = {0: ([1.0, 0, 0, 0, 0, 0], 1), 1: ([0, 1.0, 0, 0, 0, 0], 2)}
    rng = np.random.RandomState(0)
    for _ in range(4000):
        estado, boa = mundo[rng.randint(2)]
        acao = rng.randint(3)
        a.lembrar(estado, acao, 1.0 if acao == boa else -1.0, estado, True)
        a.treinar_um_passo()

    assert a.melhores([[1.0, 0, 0, 0, 0, 0]]) == [1]
    assert a.melhores([[0, 1.0, 0, 0, 0, 0]]) == [2]


def test_salvar_e_carregar(tmp_path):
    a = Agente(semente=1, transicoes_decaimento=500000, epsilon_final=0.1)
    a.passos = 1234
    a.transicoes = 123456
    a.episodios = 321
    a.rede.W1[0, 0] += 0.5  # rede-alvo deve continuar diferente
    caminho = tmp_path / "agente.npz"
    a.salvar(caminho)
    b = Agente.carregar(caminho)
    X = np.random.RandomState(0).rand(4, 6)
    assert np.allclose(a.rede.prever(X), b.rede.prever(X))
    assert b.passos == 1234
    assert b.transicoes == a.transicoes
    assert b.episodios == a.episodios
    assert b.epsilon == pytest.approx(a.epsilon)
    assert np.array_equal(b.rede_alvo.W1, a.rede_alvo.W1)


def test_checkpoint_antigo_tem_erro_claro(tmp_path):
    caminho = tmp_path / "antigo.npz"
    np.savez(caminho, W1=np.zeros((4, 8)))
    with pytest.raises(ValueError, match="Modelo antigo com 4 entradas"):
        Agente.carregar(caminho)
