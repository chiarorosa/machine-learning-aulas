// Fisica pura do Dino. Sem DOM, sem Math.random, deterministica por semente.
// Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
//
// Coordenada vertical: altura ACIMA DO SOLO, em pixels.
// Zero = no chao, positivo = no ar. A conversao para o y do canvas
// (que cresce para baixo) acontece apenas em render.js.
//
// O motor nao sabe que existe IA. Ele expoe um unico contrato:
//   passo(acao) -> {estado, recompensa, terminou, pausado}
var Motor = (function () {

  var CONFIG = {
    // altura e so o tamanho do canvas: os 60 px abaixo do solo existem
    // para as reguas de distancia e largura caberem sem cortar.
    largura: 800, altura: 210, solo: 150,

    dinoX: 60,
    dinoLargura: 44, dinoAltura: 47,
    agachadoLargura: 59, agachadoAltura: 30,

    gravidade: 0.6,
    impulso: 10,            // apice 78.4 px, ~33 frames no ar

    velInicial: 6, velMaxima: 11, aceleracao: 0.001,

    // Estes numeros nao sao estetica: decidem se o agente CONSEGUE aprender.
    // Com cactos de ate 75 px de largura e 50 de altura a 13 px/frame, so
    // 5 de 24 distancias de disparo do pulo sobreviviam - a politica boa
    // era uma agulha, e o treino ficava achatado para sempre. Afinando os
    // cactos, a janela vai para 12 de 24 e o agente aprende. Medido, nao
    // chutado: veja a secao 5.2 do design.
    cactoLarguras: [15, 25, 35],
    cactoAlturas: [25, 35],
    aveLargura: 46, aveAltura: 30,
    maiorObstaculo: 46,     // usado no calculo da folga entre obstaculos
    aveBases: [5, 35, 60],  // baixa -> pular, media -> abaixar, alta -> correr
    scoreParaAves: 300,
    chanceAve: 0.35,

    recompensaVivo: 0.1,
    recompensaMorte: -10,
    framesMorto: 30,

    framesDeVoo: 33,        // usado no calculo da folga entre obstaculos
    normDistancia: 800, normLargura: 46, normAltura: 100
  };

  function criar(semente) {
    var rng = Aleatorio.criar(semente);

    var dinoY, dinoVy, agachado, morto, framesMorto;
    var score, velocidade, obstaculos, distanciaProximoSpawn;

    function reiniciar() {
      dinoY = 0; dinoVy = 0; agachado = false;
      morto = false; framesMorto = 0;
      score = 0;
      velocidade = CONFIG.velInicial;
      obstaculos = [];
      distanciaProximoSpawn = 0;
    }

    // ---------- dino ----------

    function aplicarAcao(acao) {
      if (acao === 1 && dinoY === 0) {
        dinoVy = CONFIG.impulso;
        agachado = false;
      } else if (acao === 2) {
        // No ar o agachamento e apenas cosmetico: nao altera a fisica,
        // para o salto continuar legivel em aula.
        agachado = true;
      } else if (acao === 0) {
        agachado = false;
      }
    }

    function avancarDino() {
      if (dinoY > 0 || dinoVy > 0) {
        dinoVy -= CONFIG.gravidade;
        dinoY += dinoVy;
        if (dinoY <= 0) { dinoY = 0; dinoVy = 0; }
      }
    }

    // ---------- mundo ----------

    // Folga minima entre obstaculos, em pixels de espacamento entre as
    // bordas ESQUERDAS. Cobre o voo inteiro na velocidade corrente, mais
    // a maior largura possivel de obstaculo, mais margem de reacao.
    function folgaMinima() {
      return Math.ceil(CONFIG.framesDeVoo * velocidade) + CONFIG.maiorObstaculo + 60;
    }

    function sortearObstaculo() {
      var podeAve = score >= CONFIG.scoreParaAves;
      if (podeAve && rng() < CONFIG.chanceAve) {
        return {
          tipo: "ave",
          x: CONFIG.largura,
          largura: CONFIG.aveLargura,
          altura: CONFIG.aveAltura,
          base: CONFIG.aveBases[Aleatorio.inteiro(rng, 0, CONFIG.aveBases.length - 1)]
        };
      }
      return {
        tipo: "cacto",
        x: CONFIG.largura,
        largura: CONFIG.cactoLarguras[Aleatorio.inteiro(rng, 0, CONFIG.cactoLarguras.length - 1)],
        altura: CONFIG.cactoAlturas[Aleatorio.inteiro(rng, 0, CONFIG.cactoAlturas.length - 1)],
        base: 0
      };
    }

    function avancarMundo() {
      velocidade = Math.min(CONFIG.velMaxima, velocidade + CONFIG.aceleracao);
      score += 1;

      for (var i = 0; i < obstaculos.length; i++) {
        obstaculos[i].x -= velocidade;
      }
      while (obstaculos.length > 0 && obstaculos[0].x + obstaculos[0].largura < -50) {
        obstaculos.shift();
      }

      distanciaProximoSpawn -= velocidade;
      if (distanciaProximoSpawn <= 0) {
        obstaculos.push(sortearObstaculo());
        var minimo = folgaMinima();
        distanciaProximoSpawn = minimo + rng() * minimo * 0.8;
      }
    }

    function obstaculoMaisProximo() {
      for (var i = 0; i < obstaculos.length; i++) {
        if (obstaculos[i].x + obstaculos[i].largura >= CONFIG.dinoX) {
          return obstaculos[i];
        }
      }
      return null;
    }

    // ---------- colisao ----------

    function caixaDino() {
      var encolhido = agachado && dinoY === 0;
      return {
        x: CONFIG.dinoX,
        largura: encolhido ? CONFIG.agachadoLargura : CONFIG.dinoLargura,
        base: dinoY,
        altura: encolhido ? CONFIG.agachadoAltura : CONFIG.dinoAltura
      };
    }

    function sobrepoe(a, b) {
      return a.x < b.x + b.largura &&
             a.x + a.largura > b.x &&
             a.base < b.base + b.altura &&
             a.base + a.altura > b.base;
    }

    function colide() {
      var dino = caixaDino();
      for (var i = 0; i < obstaculos.length; i++) {
        if (sobrepoe(dino, obstaculos[i])) return true;
      }
      return false;
    }

    // ---------- contrato do ambiente ----------

    function estado() {
      var alvo = obstaculoMaisProximo();
      if (!alvo) {
        return [1.0, 0, 0, velocidade / CONFIG.velMaxima,
                dinoY / 100, dinoVy / CONFIG.impulso];
      }
      var distancia = Math.max(0, alvo.x - CONFIG.dinoX);
      return [
        Math.min(1, distancia / CONFIG.normDistancia),
        alvo.largura / CONFIG.normLargura,
        alvo.base / CONFIG.normAltura,
        velocidade / CONFIG.velMaxima,
        dinoY / 100,                 // onde estou no salto?
        dinoVy / CONFIG.impulso      // positivo: subindo; negativo: caindo
      ];
    }

    function passo(acao) {
      if (morto) {
        framesMorto += 1;
        if (framesMorto >= CONFIG.framesMorto) {
          reiniciar();
        } else {
          return { estado: estado(), recompensa: 0, terminou: false, pausado: true };
        }
      }

      // A acao e aplicada ANTES do mundo avancar. Se fosse depois, o agente
      // estaria reagindo a um obstaculo que ja se moveu, e o estado que ele
      // recebeu nao corresponderia a decisao que tomou.
      aplicarAcao(acao);
      avancarDino();
      avancarMundo();

      if (colide()) {
        morto = true;
        framesMorto = 0;
        return { estado: estado(), recompensa: CONFIG.recompensaMorte,
                 terminou: true, pausado: false };
      }

      return { estado: estado(), recompensa: CONFIG.recompensaVivo,
               terminou: false, pausado: false };
    }

    function snapshot() {
      return {
        dinoY: dinoY, dinoVy: dinoVy, agachado: agachado,
        morto: morto, framesMorto: framesMorto,
        score: score, velocidade: velocidade,
        obstaculos: obstaculos, semente: semente
      };
    }

    reiniciar();

    return {
      reiniciar: reiniciar,
      aplicarAcao: aplicarAcao,
      avancarDino: avancarDino,
      avancarMundo: avancarMundo,
      obstaculoMaisProximo: obstaculoMaisProximo,
      colide: colide,
      estado: estado,
      passo: passo,
      snapshot: snapshot,
      // Usado apenas pelos testes, para montar cenarios especificos.
      _interno: {
        obstaculos: function () { return obstaculos; },
        setVelocidade: function (v) { velocidade = v; },
        setScore: function (s) { score = s; }
      }
    };
  }

  return { CONFIG: CONFIG, criar: criar };
})();
