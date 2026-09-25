"""Integracao: a prova usa o motor real e o forward JS coincide com o NumPy."""
import json
from pathlib import Path
import shutil
import subprocess

import numpy as np
import pytest

from agente.agente import Agente
from agente.avaliar import avaliar

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="Requer Node.js")


def test_avaliacao_reproduzivel_sem_alterar_treino():
    a = Agente(semente=2026)
    pesos = {k: v.copy() for k, v in a.rede.pesos().items()}
    rng = a._rng.get_state()
    antes = (a.passos, a.transicoes, a.episodios, a.epsilon, len(a.memoria))
    primeira = avaliar(a, quantidade=4, limite=300)
    assert primeira == avaliar(a, quantidade=4, limite=300)
    assert antes == (a.passos, a.transicoes, a.episodios, a.epsilon, len(a.memoria))
    assert all(np.array_equal(pesos[k], v) for k, v in a.rede.pesos().items())
    assert np.array_equal(rng[1], a._rng.get_state()[1])


def test_limite_nao_e_registrado_como_morte():
    r = avaliar(Agente(semente=1), quantidade=3, limite=10)
    assert r["limitados"] == 3
    assert r["scores"] == [10, 10, 10]


def test_forward_js_equivale_ao_numpy():
    a = Agente(semente=5)
    estados = np.random.RandomState(8).uniform(-1, 1, (30, 6))
    script = Path(__file__).resolve().parents[2] / "jogo" / "avaliacao.js"
    codigo = """
const fs = require('fs'), vm = require('vm');
vm.runInThisContext(fs.readFileSync(process.argv[1], 'utf8'));
const p = JSON.parse(fs.readFileSync(0, 'utf8'));
console.log(JSON.stringify(p.estados.map(s => Avaliacao.valores(p.pesos, s))));
"""
    pedido = dict(pesos={k: v.tolist() for k, v in a.rede.pesos().items()}, estados=estados.tolist())
    r = subprocess.run(["node", "-e", codigo, str(script)], input=json.dumps(pedido),
                       text=True, capture_output=True, check=True)
    assert np.allclose(json.loads(r.stdout), a.rede.prever(estados), atol=1e-12)
