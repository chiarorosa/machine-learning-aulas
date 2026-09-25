// Arreio de testes minimo. Sem dependencias: roda no navegador (testes.html).
var Testes = (function () {
  var casos = [];

  function verificar(nome, fn) {
    casos.push({ nome: nome, fn: fn });
  }

  function igual(a, b, msg) {
    if (a !== b) {
      throw new Error((msg || "valores diferentes") + ": esperado " + b + ", veio " + a);
    }
  }

  function perto(a, b, tolerancia, msg) {
    if (Math.abs(a - b) > tolerancia) {
      throw new Error((msg || "fora da tolerancia") + ": esperado " + b +
                      " +/- " + tolerancia + ", veio " + a);
    }
  }

  function verdadeiro(valor, msg) {
    if (!valor) throw new Error(msg || "esperava verdadeiro");
  }

  function executar(destino) {
    var passou = 0, falhou = 0;
    destino.innerHTML = "";
    for (var i = 0; i < casos.length; i++) {
      var linha = document.createElement("div");
      try {
        casos[i].fn();
        linha.className = "ok";
        linha.textContent = "PASSOU  " + casos[i].nome;
        passou++;
      } catch (erro) {
        linha.className = "falha";
        linha.textContent = "FALHOU  " + casos[i].nome + "  ->  " + erro.message;
        falhou++;
      }
      destino.appendChild(linha);
    }
    var resumo = document.createElement("div");
    resumo.className = "resumo";
    resumo.textContent = passou + " passaram, " + falhou + " falharam";
    destino.appendChild(resumo);
    document.title = passou + " passaram, " + falhou + " falharam";
    return { passou: passou, falhou: falhou };
  }

  return { verificar: verificar, igual: igual, perto: perto,
           verdadeiro: verdadeiro, executar: executar };
})();
