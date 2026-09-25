// Uma prova sempre igual: pesos congelados, sementes fixas, sem exploracao.
// Usa o MESMO motor do jogo, em pistas separadas das pistas de treino.
var Avaliacao = (function () {
  function valores(p, estado) {
    var ocultas = p.b1.map(function (b, j) {
      return Math.max(0, estado.reduce(function (s, x, i) {
        return s + x * p.W1[i][j];
      }, b));
    });
    return p.b2.map(function (b, j) {
      return ocultas.reduce(function (s, x, i) { return s + x * p.W2[i][j]; }, b);
    });
  }

  function executar(pesos, quantidade, limite) {
    quantidade = quantidade || 20;
    limite = limite || 3000;
    var scores = [], limitados = 0;
    for (var i = 0; i < quantidade; i++) {
      var motor = Motor.criar(900001 + i * 7919);
      var resultado;
      for (var t = 0; t < limite; t++) {
        var q = valores(pesos, motor.estado());
        resultado = motor.passo(q.indexOf(Math.max.apply(null, q)));
        if (resultado.terminou) break;
      }
      scores.push(motor.snapshot().score);
      if (!resultado.terminou) limitados++;
    }
    var ordenados = scores.slice().sort(function (a, b) { return a - b; });
    return {
      media: scores.reduce(function (a, b) { return a + b; }, 0) / quantidade,
      mediana: (ordenados[Math.floor((quantidade - 1) / 2)] + ordenados[Math.floor(quantidade / 2)]) / 2,
      minimo: ordenados[0], maximo: ordenados[quantidade - 1],
      quantidade: quantidade, limite: limite, limitados: limitados, scores: scores
    };
  }
  return { executar: executar, valores: valores };
})();
