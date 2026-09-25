// Laco principal. Orquestra 20 motores e a conversa com o cerebro em Python.
// Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
//
// A simulacao e o desenho sao desacoplados de proposito: o laco corre o
// mais rapido que a ponte permite, e o desenho acontece a 60fps sobre o
// estado corrente. Em 10x o aluno ve avanco rapido, nao perda de visao.
var App = (function () {
  var QUANTIDADE = 20;
  var SEMENTE_MESTRA = 2026;

  var motores = [];
  var ultimoResultado = [];
  var historicoScores = [];

  var indiceFoco = 0;
  var modo = "humano";
  var turbo = false;
  var frame = 0;
  var acaoTeclado = 0;
  var conectado = false;
  var versaoModo = 0;
  var primeiraAvaliacao = null;

  function resultadoZerado() {
    return { recompensa: 0, terminou: false, pausado: false };
  }

  function iniciar() {
    for (var i = 0; i < QUANTIDADE; i++) {
      motores.push(Motor.criar(SEMENTE_MESTRA + i * 7919));
      ultimoResultado.push(resultadoZerado());
    }
    Render.iniciar(document.getElementById("telaDestaque"),
                   document.getElementById("telaPopulacao"));
    ligarTeclado();
    ligarBotoes();

    Ponte.conectar(function (estaLigada) {
      conectado = estaLigada;
      var etiqueta = document.getElementById("conexao");
      etiqueta.textContent = estaLigada ? "Python conectado" : "Python desconectado";
      etiqueta.className = estaLigada ? "ligado" : "desligado";
      if (estaLigada) avisarPython();
    });

    laco();
    desenhar();
  }

  function avisarPython() {
    if (!Ponte.estaLigada()) return;
    Ponte.configurar({ modo: modo, quantidade: QUANTIDADE });
  }

  function ligarTeclado() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft")  { indiceFoco = (indiceFoco - 1 + QUANTIDADE) % QUANTIDADE; e.preventDefault(); }
      if (e.key === "ArrowRight") { indiceFoco = (indiceFoco + 1) % QUANTIDADE; e.preventDefault(); }
      if (e.key === "ArrowUp")    { acaoTeclado = 1; e.preventDefault(); }
      if (e.key === "ArrowDown")  { acaoTeclado = 2; e.preventDefault(); }
    });
    document.addEventListener("keyup", function (e) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") acaoTeclado = 0;
    });
  }

  function ligarBotoes() {
    function grupo(seletor, aoEscolher) {
      var botoes = document.querySelectorAll(seletor + " button");
      Array.prototype.forEach.call(botoes, function (b) {
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(botoes, function (o) {
            o.classList.toggle("ativo", o === b);
          });
          aoEscolher(b);
        });
      });
    }

    grupo("#modos", function (b) {
      modo = b.dataset.modo;
      versaoModo++;
      indiceFoco = 0;
      for (var i = 0; i < QUANTIDADE; i++) {
        motores[i].reiniciar();
        ultimoResultado[i] = resultadoZerado();
      }
      historicoScores.length = 0;
      avisarPython();
    });

    grupo("#velocidades", function (b) {
      turbo = b.dataset.vel === "turbo";
    });
  }

  function registrarFim(indice, resultado) {
    if (!resultado.terminou) return;
    historicoScores.push(motores[indice].snapshot().score);
    if (historicoScores.length > 400) historicoScores.shift();
  }

  function umPasso() {
    if (modo === "humano") {
      var motor = motores[indiceFoco];
      var estadoAntes = motor.estado();
      var estavaMorto = motor.snapshot().morto;
      var acao = acaoTeclado;
      var resultado = motor.passo(acao);
      registrarFim(indiceFoco, resultado);
      // Envia a acao REAL e o resultado juntos. Assim a ultima jogada ja
      // esta completa antes de trocar de modo ou de pista.
      // A pausa e o renascimento automatico nao sao decisoes do jogador.
      if (conectado && !estavaMorto && !resultado.pausado) {
        return Ponte.enviarHumano({
          estado: estadoAntes, acao: acao, recompensa: resultado.recompensa,
          proximo: resultado.estado, terminal: resultado.terminou
        });
      }
      return Promise.resolve();
    }

    if (!conectado) {
      return new Promise(function (resolve) { setTimeout(resolve, 200); });
    }

    // A pista em foco vai sempre na posicao 0, para o painel poder ler
    // info.q[0] sem precisar procurar. O `id` viaja junto, entao o
    // servidor continua pareando as transicoes corretamente.
    var ordem = [indiceFoco];
    for (var i = 0; i < QUANTIDADE; i++) if (i !== indiceFoco) ordem.push(i);

    var ambientes = ordem.map(function (i) {
      return {
        id: i,
        estado: motores[i].estado(),
        recompensa: ultimoResultado[i].recompensa,
        terminou: ultimoResultado[i].terminou,
        pausado: ultimoResultado[i].pausado,
        score: motores[i].snapshot().score
      };
    });
    var pedidoModo = versaoModo;

    return Ponte.enviarPasso(ambientes).then(function (resposta) {
      // Pode chegar null (queda de conexao) ou a resposta de um
      // "configurar"; so agimos sobre uma resposta de acoes.
      if (!resposta || resposta.tipo !== "acoes") return;
      // Uma resposta antiga nao pode dar um passo depois de trocar de modo.
      if (pedidoModo !== versaoModo) return;
      if (resposta.info.avaliar) {
        var a = Avaliacao.executar(resposta.info.avaliar);
        a.transicoes = resposta.info.transicoes;
        if (!primeiraAvaliacao || a.transicoes < primeiraAvaliacao.transicoes) primeiraAvaliacao = a;
        document.getElementById("avaliacao").textContent =
          "Média inicial: " + primeiraAvaliacao.media.toFixed(1) +
          " | média atual: " + a.media.toFixed(1) +
          " | mediana: " + a.mediana.toFixed(1) +
          " | chegaram ao limite: " + a.limitados + "/" + a.quantidade +
          " | experiências: " + a.transicoes;
      }
      for (var k = 0; k < ordem.length; k++) {
        var indice = ordem[k];
        var r = motores[indice].passo(resposta.acoes[k]);
        ultimoResultado[indice] = r;
        registrarFim(indice, r);
      }
    });
  }

  // O Chrome congela os timers de abas em segundo plano: com
  // setTimeout(1000/60) no caminho, o treino simplesmente PARA quando o
  // professor troca para os slides. Eventos de WebSocket nao sofrem esse
  // throttling, entao no turbo o laco e conduzido pela resposta do Python,
  // sem timer nenhum. No ritmo real o timer fica, porque ali alguem esta
  // olhando a tela de qualquer forma.
  function laco() {
    if (turbo && modo !== "humano") {
      umPasso().then(laco);
    } else {
      umPasso().then(function () { setTimeout(laco, 1000 / 60); });
    }
  }

  function desenhar() {
    frame++;
    Render.desenharDestaque(motores[indiceFoco], frame, true);
    Render.desenharPopulacao(motores, indiceFoco, frame);
    Painel.atualizar(motores[indiceFoco], historicoScores, modo);
    requestAnimationFrame(desenhar);
  }

  document.addEventListener("DOMContentLoaded", iniciar);

  return {
    motores: motores,
    historico: function () { return historicoScores; },
    foco: function () { return indiceFoco; },
    modo: function () { return modo; }
  };
})();
