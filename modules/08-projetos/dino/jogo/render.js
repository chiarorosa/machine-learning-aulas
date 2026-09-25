// Desenho. Nao conhece o agente nem a ponte: so le snapshots do motor.
// Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
var Render = (function () {
  var ctxDestaque = null, ctxPopulacao = null;
  var COLUNAS = 5, LINHAS = 4;
  var MINI_LARGURA = 200, MINI_ALTURA = 54, MINI_ESPACO = 6;

  function iniciar(canvasDestaque, canvasPopulacao) {
    ctxDestaque = canvasDestaque.getContext("2d");
    ctxPopulacao = canvasPopulacao.getContext("2d");
    canvasDestaque.width = Motor.CONFIG.largura;
    canvasDestaque.height = Motor.CONFIG.altura;
    canvasPopulacao.width = COLUNAS * (MINI_LARGURA + MINI_ESPACO);
    canvasPopulacao.height = LINHAS * (MINI_ALTURA + MINI_ESPACO);
  }

  function desenharObstaculo(ctx, obs, ySolo, frame, escala) {
    var y = ySolo - obs.base * escala;
    if (obs.tipo === "ave") Sprites.ave(ctx, obs.x * escala, y, frame, escala);
    else Sprites.cacto(ctx, obs.x * escala, y, obs.largura * escala, obs.altura * escala);
  }

  function desenharDestaque(motor, frame, mostrarReguas) {
    var C = Motor.CONFIG, s = motor.snapshot(), ctx = ctxDestaque;
    ctx.clearRect(0, 0, C.largura, C.altura);
    Sprites.chao(ctx, C.largura, C.solo, frame * s.velocidade);

    for (var i = 0; i < s.obstaculos.length; i++) {
      desenharObstaculo(ctx, s.obstaculos[i], C.solo, frame, 1);
    }
    Sprites.dino(ctx, C.dinoX, C.solo - s.dinoY, s.agachado, s.morto, frame, 1);

    ctx.fillStyle = "#535353";
    ctx.font = "bold 16px ui-monospace, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.fillText(("00000" + s.score).slice(-5), C.largura - 12, 26);
    ctx.textAlign = "left";

    if (mostrarReguas) desenharReguas(ctx, motor);
  }

  // Reproduz a leitura de "exemplo de metricas.png": regua vermelha da
  // distancia, verde da largura, azul da altura acima do solo.
  function desenharReguas(ctx, motor) {
    var C = Motor.CONFIG;
    var alvo = motor.obstaculoMaisProximo();
    if (!alvo || alvo.x > C.largura) return;

    var yDistancia = C.solo + 34;
    var yLargura = C.solo + 52;
    var xDino = C.dinoX + C.dinoLargura;
    ctx.lineWidth = 2;
    ctx.font = "bold 13px ui-monospace, Consolas, monospace";

    // x1 — distancia ate o obstaculo
    ctx.strokeStyle = "#d13b3b";
    ctx.beginPath();
    ctx.moveTo(xDino, yDistancia); ctx.lineTo(alvo.x, yDistancia);
    ctx.moveTo(xDino, yDistancia - 4); ctx.lineTo(xDino, yDistancia + 4);
    ctx.moveTo(alvo.x, yDistancia - 4); ctx.lineTo(alvo.x, yDistancia + 4);
    ctx.stroke();
    ctx.fillStyle = "#d13b3b";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.round(alvo.x - C.dinoX)), (xDino + alvo.x) / 2, yDistancia - 7);

    // x2 — largura do obstaculo
    ctx.strokeStyle = "#2f9e44";
    ctx.beginPath();
    ctx.moveTo(alvo.x, yLargura); ctx.lineTo(alvo.x + alvo.largura, yLargura);
    ctx.moveTo(alvo.x, yLargura - 4); ctx.lineTo(alvo.x, yLargura + 4);
    ctx.moveTo(alvo.x + alvo.largura, yLargura - 4);
    ctx.lineTo(alvo.x + alvo.largura, yLargura + 4);
    ctx.stroke();
    ctx.fillStyle = "#2f9e44";
    ctx.textAlign = "left";
    ctx.fillText(String(alvo.largura), alvo.x + alvo.largura + 7, yLargura + 4);

    if (alvo.base > 0) {
      ctx.strokeStyle = "#1c7ed6";
      ctx.beginPath();
      ctx.moveTo(alvo.x - 12, C.solo);
      ctx.lineTo(alvo.x - 12, C.solo - alvo.base);
      ctx.stroke();
      ctx.fillStyle = "#1c7ed6";
      ctx.textAlign = "right";
      ctx.fillText(String(alvo.base), alvo.x - 16, C.solo - alvo.base / 2);
    }
    ctx.textAlign = "left";
  }

  function desenharPopulacao(motores, indiceFoco, frame) {
    var ctx = ctxPopulacao, C = Motor.CONFIG;
    var escala = MINI_LARGURA / C.largura;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (var i = 0; i < motores.length; i++) {
      var ox = (i % COLUNAS) * (MINI_LARGURA + MINI_ESPACO);
      var oy = Math.floor(i / COLUNAS) * (MINI_ALTURA + MINI_ESPACO);
      var s = motores[i].snapshot();

      ctx.save();
      ctx.translate(ox, oy);
      ctx.beginPath();
      ctx.rect(0, 0, MINI_LARGURA, MINI_ALTURA);
      ctx.clip();

      ctx.fillStyle = i === indiceFoco ? "#fff4d6" : "#ffffff";
      ctx.fillRect(0, 0, MINI_LARGURA, MINI_ALTURA);

      var ySolo = MINI_ALTURA - 10;
      ctx.fillStyle = "#535353";
      ctx.fillRect(0, ySolo, MINI_LARGURA, 1);

      for (var j = 0; j < s.obstaculos.length; j++) {
        desenharObstaculo(ctx, s.obstaculos[j], ySolo, frame, escala);
      }
      // Uma escala so para tudo: dino e obstaculos na mesma proporcao,
      // senao a miniatura mentiria sobre quem passa por cima de quem.
      Sprites.dino(ctx, C.dinoX * escala, ySolo - s.dinoY * escala,
                   s.agachado, s.morto, frame, escala);

      ctx.fillStyle = i === indiceFoco ? "#b56a00" : "#9a9a9a";
      ctx.font = "11px ui-monospace, Consolas, monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(s.score), MINI_LARGURA - 5, 13);
      ctx.textAlign = "left";
      ctx.restore();

      if (i === indiceFoco) {
        ctx.strokeStyle = "#b56a00";
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + 1, oy + 1, MINI_LARGURA - 2, MINI_ALTURA - 2);
      }
    }
  }

  return { iniciar: iniciar, desenharDestaque: desenharDestaque,
           desenharPopulacao: desenharPopulacao };
})();
