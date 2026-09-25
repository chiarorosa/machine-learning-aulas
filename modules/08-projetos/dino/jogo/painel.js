// O HUD nao e enfeite: e o conteudo da aula.
// Entradas -> rede viva -> saidas, lado a lado, na mesma ordem da ilustracao.
// Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
var Painel = (function () {
  var NOMES_ENTRADA = ["distância", "largura", "base obstáculo", "vel. mundo", "altura dino", "vel. vertical"];
  var NOMES_SAIDA = ["Correr", "Pular", "Abaixar"];

  var elEntradas, elSaidas, elNumeros, ctxRede, ctxGrafico;
  var pesos = null;

  function preparar() {
    elEntradas = document.getElementById("entradas");
    elSaidas = document.getElementById("saidas");
    elNumeros = document.getElementById("numeros");
    ctxRede = document.getElementById("telaRede").getContext("2d");
    ctxGrafico = document.getElementById("telaGrafico").getContext("2d");
  }

  function barra(nome, cru, normalizado, escolhida, comSinal) {
    var largura = comSinal ? Math.min(50, Math.abs(normalizado) * 50)
                          : Math.max(0, Math.min(100, normalizado * 100));
    var inicio = comSinal ? (normalizado < 0 ? 50 - largura : 50) : 0;
    return '<div class="barra' + (escolhida ? " escolhida" : "") + '">' +
             '<div class="rotulo"><span>' + nome + '</span>' +
             '<span>' + cru + ' <b>' + normalizado.toFixed(2) + '</b></span></div>' +
             '<div class="trilho' + (comSinal ? ' com-sinal' : '') + '"><div class="preenchimento" style="margin-left:' +
               inicio + '%;width:' + largura + '%"></div></div>' +
           '</div>';
  }

  function desenharEntradas(motor) {
    var C = Motor.CONFIG;
    var e = motor.estado();
    var alvo = motor.obstaculoMaisProximo();
    var crus = [
      alvo ? Math.round(Math.max(0, alvo.x - C.dinoX)) : C.largura,
      alvo ? alvo.largura : 0,
      alvo ? alvo.base : 0,
      motor.snapshot().velocidade.toFixed(1),
      motor.snapshot().dinoY.toFixed(1),
      motor.snapshot().dinoVy.toFixed(1)
    ];
    var html = "<h3>Entradas <small>x1..x6</small></h3>";
    for (var i = 0; i < 6; i++) html += barra(NOMES_ENTRADA[i], crus[i], e[i], false, i === 5);
    html += '<p class="aviso">Vel. vertical: + subindo, − caindo, 0 no chão ou no ápice.</p>';
    elEntradas.innerHTML = html;
  }

  function desenharSaidas(modo) {
    var q = modo === "humano" ? null : (Ponte.info().q || [])[0];
    if (!q) {
      elSaidas.innerHTML = "<h3>Saídas <small>Q(s, a)</small></h3>" +
        '<p class="aviso">' + (modo === "humano"
          ? "Você decide. Suas jogadas ficam na memória quando o Python está conectado.<br>Em Treinar, a rede aprende com elas."
          : "Aguardando o cérebro em Python…") + "</p>";
      return;
    }
    var escolhida = (Ponte.info().acoes || [])[0];
    // Valores Q podem ser negativos: as barras precisam de um piso comum.
    var menor = Math.min.apply(null, q), maior = Math.max.apply(null, q);
    var faixa = Math.max(0.001, maior - menor);
    var html = "<h3>Saídas <small>Q(s, a)</small></h3>";
    for (var i = 0; i < 3; i++) {
      html += barra(NOMES_SAIDA[i], q[i].toFixed(2), (q[i] - menor) / faixa, i === escolhida);
    }
    html += '<p class="aviso">Destaque: ação enviada. No treino, ela pode ser sorteada.</p>';
    elSaidas.innerHTML = html;
  }

  function posicoesDasCamadas(L, A) {
    var colunas = [110, L / 2 + 20, L - 70];
    return [6, pesos ? pesos.W2.length : 8, 3].map(function (n, c) {
      var p = [];
      for (var i = 0; i < n; i++) p.push({ x: colunas[c], y: (A / (n + 1)) * (i + 1) });
      return p;
    });
  }

  // Conexoes: espessura pela magnitude, cor pelo sinal.
  // E isto que "muda ao vivo" enquanto o treino roda.
  function ligar(ctx, de, para, matriz) {
    var maior = 0.001;
    for (var i = 0; i < matriz.length; i++) {
      for (var j = 0; j < matriz[i].length; j++) {
        maior = Math.max(maior, Math.abs(matriz[i][j]));
      }
    }
    for (var i = 0; i < matriz.length; i++) {
      for (var j = 0; j < matriz[i].length; j++) {
        var forca = Math.abs(matriz[i][j]) / maior;
        ctx.strokeStyle = (matriz[i][j] >= 0 ? "rgba(47,158,68," : "rgba(209,59,59,")
                          + (0.08 + forca * 0.8) + ")";
        ctx.lineWidth = 0.3 + forca * 3.0;
        ctx.beginPath();
        ctx.moveTo(de[i].x, de[i].y);
        ctx.lineTo(para[j].x, para[j].y);
        ctx.stroke();
      }
    }
  }

  function desenharRede(modo) {
    var info = Ponte.info();
    if (info.pesos) {
      pesos = info.pesos;
      document.getElementById("arquitetura").textContent = "6 → " + pesos.W2.length + " → 3";
    }

    var ctx = ctxRede, L = ctx.canvas.width, A = ctx.canvas.height;
    ctx.clearRect(0, 0, L, A);
    ctx.font = "11px ui-monospace, Consolas, monospace";

    if (!pesos) {
      ctx.fillStyle = "#b0b0b0";
      ctx.textAlign = "center";
      ctx.fillText(modo === "humano" ? "a rede acende no modo Treinar"
                                     : "aguardando o cérebro…", L / 2, A / 2);
      ctx.textAlign = "left";
      return;
    }

    var pos = posicoesDasCamadas(L, A);
    ligar(ctx, pos[0], pos[1], pesos.W1);
    ligar(ctx, pos[1], pos[2], pesos.W2);

    var rotulos = [NOMES_ENTRADA, null, NOMES_SAIDA];
    for (var c = 0; c < 3; c++) {
      for (var i = 0; i < pos[c].length; i++) {
        ctx.fillStyle = "#535353";
        ctx.beginPath();
        ctx.arc(pos[c][i].x, pos[c][i].y, 6, 0, Math.PI * 2);
        ctx.fill();
        if (rotulos[c]) {
          ctx.textAlign = c === 0 ? "right" : "left";
          ctx.fillText(rotulos[c][i], pos[c][i].x + (c === 0 ? -11 : 11), pos[c][i].y + 4);
        }
      }
    }
    ctx.textAlign = "left";
  }

  function desenharMetricas(historico) {
    var info = Ponte.info();
    var recorde = historico.length ? Math.max.apply(null, historico) : 0;
    var media = historico.length
      ? Math.round(historico.reduce(function (a, b) { return a + b; }, 0) / historico.length)
      : 0;

    function campo(nome, valor) {
      return "<span>" + nome + " <b>" + (valor === undefined ? "—" : valor) + "</b></span>";
    }
    elNumeros.innerHTML =
      campo("épsilon", info.epsilon !== undefined ? info.epsilon.toFixed(3) : undefined) +
      campo("episódios", info.episodios) +
      campo("memória", info.memoria) +
      campo("jogadas humanas", info.demonstracoes) +
      campo("passos de treino", info.passos) +
      campo("perda", info.perda) +
      campo("score médio", media) +
      campo("recorde", recorde);

    var ctx = ctxGrafico, L = ctx.canvas.width, A = ctx.canvas.height;
    ctx.clearRect(0, 0, L, A);
    ctx.fillStyle = "#9a9a9a";
    ctx.font = "10px ui-monospace, Consolas, monospace";
    if (historico.length < 2) {
      ctx.fillText("score por episódio — aguardando os primeiros episódios", 8, A / 2);
      return;
    }
    var topo = Math.max(10, recorde);
    ctx.strokeStyle = "#b56a00";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var i = 0; i < historico.length; i++) {
      var x = (i / (historico.length - 1)) * (L - 10) + 5;
      var y = A - 8 - (historico[i] / topo) * (A - 22);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillText(String(topo), 7, 13);
    ctx.fillText("score por episódio (últimos " + historico.length + ")", 7, A - 4);
  }

  function atualizar(motor, historico, modo) {
    if (!elEntradas) preparar();
    document.getElementById("estadoMemoria").textContent = modo === "humano"
      ? (Ponte.estaLigada() ? "Humano: guardando suas jogadas para usar em Treinar. Os pesos ainda não mudam."
                           : "Humano: Python desconectado — suas jogadas não estão sendo guardadas.")
      : (modo === "treinar" ? "Treinar: aprendendo com a memória compartilhada, incluindo suas jogadas."
                            : "Assistir: somente execução, sem guardar jogadas nem alterar os pesos.");
    desenharEntradas(motor);
    desenharSaidas(modo);
    desenharRede(modo);
    desenharMetricas(historico);
  }

  return { atualizar: atualizar };
})();
