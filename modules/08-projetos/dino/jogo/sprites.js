// Sprites desenhados por codigo. Nenhuma imagem externa.
// yBase e sempre o y de canvas da linha de apoio do objeto.
var Sprites = (function () {
  var COR = "#535353";
  var COR_MORTO = "#b62324";

  function bloco(ctx, x, y, largura, altura) {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(largura), Math.round(altura));
  }

  function dino(ctx, x, yBase, agachado, morto, frame, escala) {
    var s = escala || 1;
    ctx.fillStyle = morto ? COR_MORTO : COR;

    if (agachado) {
      var p = Math.floor(frame / 6) % 2;
      bloco(ctx, x + 2 * s,  yBase - 24 * s, 34 * s, 15 * s);   // corpo deitado
      bloco(ctx, x,          yBase - 20 * s, 10 * s, 11 * s);   // rabo
      bloco(ctx, x + 34 * s, yBase - 30 * s, 25 * s, 17 * s);   // cabeca
      bloco(ctx, x + 48 * s, yBase - 14 * s, 11 * s,  4 * s);   // mandibula
      bloco(ctx, x + 10 * s, yBase -  9 * s,  8 * s, (9 - p * 4) * s);
      bloco(ctx, x + 24 * s, yBase -  9 * s,  8 * s, (5 + p * 4) * s);
      ctx.fillStyle = "#ffffff";
      bloco(ctx, x + 50 * s, yBase - 27 * s, 4 * s, 4 * s);     // olho
    } else {
      var A = Motor.CONFIG.dinoAltura * s, L = Motor.CONFIG.dinoLargura * s;
      bloco(ctx, x + 4 * s,  yBase - A + 22 * s, 20 * s, 18 * s);  // tronco
      bloco(ctx, x + 20 * s, yBase - A,          24 * s, 18 * s);  // cabeca
      bloco(ctx, x + 14 * s, yBase - A + 14 * s, 12 * s, 12 * s);  // pescoco
      bloco(ctx, x + 26 * s, yBase - A + 18 * s,  8 * s,  4 * s);  // mandibula
      bloco(ctx, x + 2 * s,  yBase - A + 26 * s,  5 * s,  5 * s);  // bracinho
      var passo = Math.floor(frame / 6) % 2;
      bloco(ctx, x + 6 * s,  yBase - 9 * s, 7 * s, (9 - passo * 4) * s);
      bloco(ctx, x + 16 * s, yBase - 9 * s, 7 * s, (5 + passo * 4) * s);
      ctx.fillStyle = "#ffffff";
      bloco(ctx, x + 36 * s, yBase - A + 5 * s, 4 * s, 4 * s);     // olho
    }
    ctx.fillStyle = COR;
  }

  function umCacto(ctx, x, yBase, largura, altura) {
    var tronco = Math.max(6, largura * 0.42);
    var centro = x + (largura - tronco) / 2;
    var braco = Math.max(4, largura * 0.2);
    bloco(ctx, centro, yBase - altura, tronco, altura);
    if (largura >= 14) {
      bloco(ctx, x, yBase - altura * 0.66, braco, altura * 0.34);
      bloco(ctx, x, yBase - altura * 0.66, centro - x + tronco * 0.5, braco * 0.8);
      bloco(ctx, x + largura - braco, yBase - altura * 0.80, braco, altura * 0.44);
      bloco(ctx, centro + tronco * 0.5, yBase - altura * 0.80,
            x + largura - centro - tronco * 0.5, braco * 0.8);
    }
  }

  // Um cacto largo e um GRUPO de cactos, como no jogo original. Isso nao e
  // enfeite: a hitbox ocupa `largura` inteira, e desenhar so um tronco fino
  // faria o aluno ver o dino morrer no ar.
  function cacto(ctx, x, yBase, largura, altura) {
    ctx.fillStyle = COR;
    var quantidade = Math.max(1, Math.round(largura / 26));
    var passo = largura / quantidade;
    for (var i = 0; i < quantidade; i++) {
      umCacto(ctx, x + i * passo, yBase, passo, altura);
    }
  }

  function ave(ctx, x, yBase, frame, escala) {
    var s = escala || 1;
    ctx.fillStyle = COR;
    var A = Motor.CONFIG.aveAltura * s, L = Motor.CONFIG.aveLargura * s;
    bloco(ctx, x + 8 * s, yBase - A + 12 * s, L - 14 * s, 7 * s);  // corpo
    bloco(ctx, x, yBase - A + 13 * s, 10 * s, 4 * s);              // bico
    if (Math.floor(frame / 8) % 2 === 0) bloco(ctx, x + 16 * s, yBase - A, 20 * s, 12 * s);
    else bloco(ctx, x + 16 * s, yBase - A + 18 * s, 20 * s, 12 * s);
  }

  function chao(ctx, largura, ySolo, deslocamento) {
    ctx.fillStyle = COR;
    bloco(ctx, 0, ySolo, largura, 1);
    var d = Math.floor(deslocamento) % 37;
    for (var i = 0; i < largura + 37; i += 37) {
      var px = i - d;
      bloco(ctx, px, ySolo + 4, 2, 1);
      bloco(ctx, px + 18, ySolo + 7, 3, 1);
    }
  }

  return { dino: dino, cacto: cacto, ave: ave, chao: chao };
})();
