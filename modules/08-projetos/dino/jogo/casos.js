// ===================== Aleatorio =====================

Testes.verificar("mesma semente produz mesma sequencia", function () {
  var a = Aleatorio.criar(42);
  var b = Aleatorio.criar(42);
  for (var i = 0; i < 100; i++) Testes.igual(a(), b(), "posicao " + i);
});

Testes.verificar("sementes diferentes divergem", function () {
  var a = Aleatorio.criar(1);
  var b = Aleatorio.criar(2);
  Testes.verdadeiro(a() !== b(), "primeiro valor deveria diferir");
});

Testes.verificar("valores ficam em [0,1)", function () {
  var r = Aleatorio.criar(7);
  for (var i = 0; i < 1000; i++) {
    var v = r();
    Testes.verdadeiro(v >= 0 && v < 1, "valor fora de faixa: " + v);
  }
});

Testes.verificar("inteiro respeita os limites inclusivos", function () {
  var r = Aleatorio.criar(99);
  var viuMin = false, viuMax = false;
  for (var i = 0; i < 2000; i++) {
    var v = Aleatorio.inteiro(r, 3, 6);
    Testes.verdadeiro(v >= 3 && v <= 6, "fora dos limites: " + v);
    Testes.igual(v, Math.floor(v), "deveria ser inteiro");
    if (v === 3) viuMin = true;
    if (v === 6) viuMax = true;
  }
  Testes.verdadeiro(viuMin, "nunca sorteou o minimo");
  Testes.verdadeiro(viuMax, "nunca sorteou o maximo");
});

// ===================== Fisica do dino =====================

Testes.verificar("dino nasce no chao, em pe", function () {
  var s = Motor.criar(1).snapshot();
  Testes.igual(s.dinoY, 0, "dinoY inicial");
  Testes.igual(s.agachado, false, "agachado inicial");
});

Testes.verificar("pular tira o dino do chao", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(1);
  m.avancarDino();
  Testes.verdadeiro(m.snapshot().dinoY > 0, "deveria ter subido");
});

Testes.verificar("apice do salto fica em 78.4px (integracao discreta)", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(1);
  var maximo = 0;
  for (var i = 0; i < 40; i++) {
    m.avancarDino();
    maximo = Math.max(maximo, m.snapshot().dinoY);
  }
  Testes.perto(maximo, 78.4, 0.3, "apice");
});

Testes.verificar("salto dura cerca de 33 frames", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(1);
  var frames = 0;
  do { m.avancarDino(); frames++; } while (m.snapshot().dinoY > 0 && frames < 200);
  Testes.perto(frames, 33, 2, "frames no ar");
});

Testes.verificar("nao pula duas vezes no ar", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(1);
  m.avancarDino();
  var antes = m.snapshot().dinoY;
  m.aplicarAcao(1);           // tentativa de pulo duplo
  m.avancarDino();
  var depois = m.snapshot().dinoY;
  Testes.verdadeiro(depois - antes < 10, "aceitou pulo duplo");
});

Testes.verificar("abaixar encolhe o dino no chao", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(2);
  m.avancarDino();
  Testes.igual(m.snapshot().agachado, true, "deveria estar agachado");
});

Testes.verificar("correr desfaz o agachamento", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(2); m.avancarDino();
  m.aplicarAcao(0); m.avancarDino();
  Testes.igual(m.snapshot().agachado, false, "deveria ter levantado");
});

Testes.verificar("abaixar no ar nao encurta o salto", function () {
  var m = Motor.criar(1);
  m.aplicarAcao(1);
  var maximo = 0;
  for (var i = 0; i < 40; i++) {
    m.aplicarAcao(2);         // insiste em abaixar durante todo o voo
    m.avancarDino();
    maximo = Math.max(maximo, m.snapshot().dinoY);
  }
  Testes.perto(maximo, 78.4, 0.3, "apice deveria ser o mesmo");
});

// ===================== Obstaculos e velocidade =====================

Testes.verificar("mundo comeca sem obstaculos e vai povoando", function () {
  var m = Motor.criar(5);
  Testes.igual(m.snapshot().obstaculos.length, 0, "inicio limpo");
  for (var i = 0; i < 400; i++) m.avancarMundo();
  Testes.verdadeiro(m.snapshot().obstaculos.length > 0, "deveria ter surgido obstaculo");
});

Testes.verificar("obstaculos nascem fora da tela pela direita", function () {
  var m = Motor.criar(5);
  for (var i = 0; i < 400; i++) {
    m.avancarMundo();
    var obs = m.snapshot().obstaculos;
    for (var j = 0; j < obs.length; j++) {
      Testes.verdadeiro(obs[j].x <= Motor.CONFIG.largura, "nasceu dentro da tela");
    }
  }
});

Testes.verificar("mundo acelera ate a velocidade maxima e para", function () {
  var m = Motor.criar(5);
  Testes.perto(m.snapshot().velocidade, Motor.CONFIG.velInicial, 0.001, "inicial");
  for (var i = 0; i < 50000; i++) m.avancarMundo();
  Testes.perto(m.snapshot().velocidade, Motor.CONFIG.velMaxima, 0.001, "saturou no maximo");
});

Testes.verificar("sem aves antes do score minimo", function () {
  var m = Motor.criar(5);
  for (var i = 0; i < 2000; i++) {
    m.avancarMundo();
    if (m.snapshot().score >= Motor.CONFIG.scoreParaAves) break;
    var obs = m.snapshot().obstaculos;
    for (var j = 0; j < obs.length; j++) Testes.igual(obs[j].tipo, "cacto", "ave cedo demais");
  }
});

Testes.verificar("aves aparecem depois do score minimo", function () {
  var m = Motor.criar(5);
  m._interno.setScore(Motor.CONFIG.scoreParaAves + 1);
  var viuAve = false;
  for (var i = 0; i < 20000 && !viuAve; i++) {
    m.avancarMundo();
    var obs = m.snapshot().obstaculos;
    for (var j = 0; j < obs.length; j++) if (obs[j].tipo === "ave") viuAve = true;
  }
  Testes.verdadeiro(viuAve, "nunca sorteou uma ave");
});

Testes.verificar("aves usam apenas as tres bases previstas", function () {
  var m = Motor.criar(9);
  m._interno.setScore(Motor.CONFIG.scoreParaAves + 1);
  for (var i = 0; i < 20000; i++) {
    m.avancarMundo();
    var obs = m.snapshot().obstaculos;
    for (var j = 0; j < obs.length; j++) {
      if (obs[j].tipo === "ave") {
        Testes.verdadeiro(Motor.CONFIG.aveBases.indexOf(obs[j].base) >= 0,
                          "base inesperada: " + obs[j].base);
      } else {
        Testes.igual(obs[j].base, 0, "cacto deveria estar no chao");
      }
    }
  }
});

Testes.verificar("o intervalo sempre permite pular o obstaculo", function () {
  // O salto consome 33 frames. Na velocidade corrente isso vale
  // 33 * velocidade pixels, e nenhum par consecutivo pode nascer
  // com folga menor que isso.
  var m = Motor.criar(11);
  var anterior = null, verificados = 0;
  for (var i = 0; i < 30000; i++) {
    m.avancarMundo();
    var s = m.snapshot();
    var ultimo = s.obstaculos[s.obstaculos.length - 1];
    if (ultimo && ultimo !== anterior) {
      // So compara enquanto o anterior ainda esta vivo no vetor,
      // senao a posicao dele estaria congelada e a medida, falsa.
      if (anterior && anterior.x + anterior.largura >= -50) {
        var folga = ultimo.x - (anterior.x + anterior.largura);
        var precisa = Motor.CONFIG.framesDeVoo * s.velocidade;
        Testes.verdadeiro(folga >= precisa,
          "folga " + Math.round(folga) + " menor que o salto " + Math.round(precisa));
        verificados++;
      }
      anterior = ultimo;
    }
  }
  Testes.verdadeiro(verificados > 10, "amostra pequena demais: " + verificados);
});

Testes.verificar("obstaculos somem depois de passar", function () {
  var m = Motor.criar(5);
  for (var i = 0; i < 5000; i++) {
    m.avancarMundo();
    var obs = m.snapshot().obstaculos;
    for (var j = 0; j < obs.length; j++) {
      Testes.verdadeiro(obs[j].x + obs[j].largura >= -50, "lixo acumulado na esquerda");
    }
  }
});

Testes.verificar("obstaculoMaisProximo ignora o que ja passou", function () {
  var m = Motor.criar(5);
  for (var i = 0; i < 3000; i++) {
    m.avancarMundo();
    var alvo = m.obstaculoMaisProximo();
    if (alvo) {
      Testes.verdadeiro(alvo.x + alvo.largura >= Motor.CONFIG.dinoX,
                        "retornou obstaculo ja ultrapassado");
    }
  }
});

// ===================== Colisao, estado e recompensa =====================

function montarCenario(obstaculo) {
  var m = Motor.criar(1);
  var obs = m._interno.obstaculos();
  obs.length = 0;
  obs.push(obstaculo);
  return m;
}

function cacto(x) {
  return { tipo: "cacto", x: x, largura: 25, altura: 50, base: 0 };
}

function ave(x, base) {
  return { tipo: "ave", x: x, largura: Motor.CONFIG.aveLargura,
           altura: Motor.CONFIG.aveAltura, base: base };
}

Testes.verificar("cacto no dino colide quando em pe", function () {
  Testes.igual(montarCenario(cacto(Motor.CONFIG.dinoX)).colide(), true, "deveria colidir");
});

Testes.verificar("agachar nao salva de cacto", function () {
  var m = montarCenario(cacto(Motor.CONFIG.dinoX));
  m.aplicarAcao(2); m.avancarDino();
  Testes.igual(m.colide(), true, "agachado ainda bate no cacto");
});

Testes.verificar("ave baixa (base 5) colide em pe e agachado", function () {
  var m = montarCenario(ave(Motor.CONFIG.dinoX, 5));
  Testes.igual(m.colide(), true, "em pe");
  m.aplicarAcao(2); m.avancarDino();
  Testes.igual(m.colide(), true, "agachado");
});

Testes.verificar("ave media (base 35) colide em pe, passa agachado", function () {
  var m = montarCenario(ave(Motor.CONFIG.dinoX, 35));
  Testes.igual(m.colide(), true, "em pe deveria colidir");
  m.aplicarAcao(2); m.avancarDino();
  Testes.igual(m.colide(), false, "agachado deveria passar");
});

Testes.verificar("ave alta (base 60) nao colide com dino correndo", function () {
  Testes.igual(montarCenario(ave(Motor.CONFIG.dinoX, 60)).colide(), false,
               "correndo deveria passar");
});

Testes.verificar("ave alta mata quem pula", function () {
  // O apice leva os pes a 83px; o corpo cruza a faixa 60..90 da ave.
  var m = montarCenario(ave(Motor.CONFIG.dinoX, 60));
  m.aplicarAcao(1);
  var bateu = false;
  for (var i = 0; i < 40 && !bateu; i++) {
    m.avancarDino();
    if (m.colide()) bateu = true;
  }
  Testes.igual(bateu, true, "pular deveria matar");
});

Testes.verificar("estado traz os 6 numeros normalizados", function () {
  var m = montarCenario(cacto(400));
  m._interno.setVelocidade(6);
  var e = m.estado();
  Testes.igual(e.length, 6, "quantidade de entradas");
  Testes.perto(e[0], (400 - Motor.CONFIG.dinoX) / 800, 0.001, "x1 distancia");
  Testes.perto(e[1], 25 / 46, 0.001, "x2 largura");
  Testes.perto(e[2], 0, 0.001, "x3 altura");
  Testes.perto(e[3], 6 / Motor.CONFIG.velMaxima, 0.001, "x4 velocidade");
  Testes.igual(e[4], 0, "x5 no chao");
  Testes.igual(e[5], 0, "x6 parado verticalmente");
});

Testes.verificar("estado distingue chao, subida e queda sem obstaculo", function () {
  var m = Motor.criar(42);
  var chao = m.estado();
  m.aplicarAcao(1); m.avancarDino();
  var subida = m.estado();
  Testes.igual(JSON.stringify(chao.slice(0, 4)), JSON.stringify(subida.slice(0, 4)));
  Testes.verdadeiro(subida[4] > 0 && subida[5] > 0);
  for (var i = 0; i < 20; i++) m.avancarDino();
  Testes.verdadeiro(m.estado()[4] > 0 && m.estado()[5] < 0);
  for (var j = 0; j < 20; j++) m.avancarDino();
  Testes.igual(m.estado()[4], 0);
  Testes.igual(m.estado()[5], 0);
});

Testes.verificar("sem obstaculo o estado reporta distancia maxima", function () {
  var m = Motor.criar(1);
  m._interno.obstaculos().length = 0;
  var e = m.estado();
  Testes.perto(e[0], 1.0, 0.001, "x1 saturado");
  Testes.perto(e[1], 0, 0.001, "x2 zerado");
  Testes.perto(e[2], 0, 0.001, "x3 zerado");
});

Testes.verificar("estado de ave carrega a altura", function () {
  Testes.perto(montarCenario(ave(300, 35)).estado()[2], 0.35, 0.001,
               "x3 deveria refletir a base da ave");
});

Testes.verificar("passo vivo devolve recompensa positiva", function () {
  var r = Motor.criar(3).passo(0);
  Testes.perto(r.recompensa, Motor.CONFIG.recompensaVivo, 0.0001, "recompensa");
  Testes.igual(r.terminou, false, "nao deveria ter terminado");
});

Testes.verificar("morte devolve penalidade e terminou", function () {
  var r = montarCenario(cacto(Motor.CONFIG.dinoX + 5)).passo(0);
  Testes.perto(r.recompensa, Motor.CONFIG.recompensaMorte, 0.0001, "penalidade");
  Testes.igual(r.terminou, true, "deveria ter terminado");
});

Testes.verificar("pausa apos a morte nao gera recompensa", function () {
  var m = montarCenario(cacto(Motor.CONFIG.dinoX + 5));
  m.passo(0);                                    // o passo da morte
  for (var i = 0; i < Motor.CONFIG.framesMorto - 1; i++) {
    var r = m.passo(0);
    Testes.igual(r.pausado, true, "deveria estar pausado no frame " + i);
    Testes.perto(r.recompensa, 0, 0.0001, "recompensa durante a pausa");
  }
});

Testes.verificar("a pista reinicia sozinha depois da pausa", function () {
  var m = montarCenario(cacto(Motor.CONFIG.dinoX + 5));
  m.passo(0);
  for (var i = 0; i < Motor.CONFIG.framesMorto; i++) m.passo(0);
  var s = m.snapshot();
  Testes.igual(s.morto, false, "deveria ter renascido");
  Testes.igual(s.score, 1, "score zerado e ja contando o novo passo");
  Testes.perto(s.velocidade, Motor.CONFIG.velInicial + Motor.CONFIG.aceleracao,
               0.0001, "velocidade reiniciada");
});

Testes.verificar("mesma semente produz o mesmo episodio", function () {
  function rodar(semente) {
    var m = Motor.criar(semente);
    var soma = 0;
    for (var i = 0; i < 1500; i++) soma += m.passo(i % 3).recompensa;
    return soma;
  }
  Testes.perto(rodar(123), rodar(123), 0.00001, "determinismo");
});

Testes.verificar("estado nunca sai dos limites declarados", function () {
  var m = Motor.criar(77);
  for (var i = 0; i < 20000; i++) {
    var e = m.passo(i % 3).estado;
    for (var j = 0; j < 6; j++) {
      Testes.verdadeiro(e[j] >= (j === 5 ? -1 : 0) && e[j] <= 1.0001,
                        "entrada " + j + " fora de faixa: " + e[j]);
    }
  }
});

// Simula um encontro real: o obstaculo vem andando e o dino reage quando
// ele chega a `gatilho` pixels. Sem isso nao da para testar honestamente
// se uma acao salva - num cenario parado o obstaculo nunca passa.
function encontro(obstaculo, acao, gatilho) {
  var m = montarCenario(obstaculo);
  var obs = m._interno.obstaculos();
  var v = 8;
  m._interno.setVelocidade(v);
  for (var i = 0; i < 300; i++) {
    var distancia = obs[0].x - Motor.CONFIG.dinoX;
    m.aplicarAcao(distancia <= gatilho ? acao : 0);
    m.avancarDino();
    obs[0].x -= v;
    if (m.colide()) return false;
    if (obs[0].x + obs[0].largura < 0) return true;
  }
  return true;
}

Testes.verificar("cada uma das tres acoes e a unica correta em alguma situacao", function () {
  // Este e o teste que sustenta a decisao de projeto de ter 3 saidas:
  // se alguma acao nunca fosse necessaria, a rede teria um neuronio morto.
  var GATILHO = 160;   // 20 frames antes, a 8 px/frame
  var LARGE = Motor.CONFIG.largura / 2;

  Testes.igual(encontro(cacto(LARGE), 1, GATILHO), true,
               "PULAR deveria salvar do cacto");
  Testes.igual(encontro(cacto(LARGE), 0, GATILHO), false,
               "correr no cacto deveria matar");
  Testes.igual(encontro(cacto(LARGE), 2, GATILHO), false,
               "agachar no cacto deveria matar");

  Testes.igual(encontro(ave(LARGE, 5), 1, GATILHO), true,
               "PULAR deveria salvar da ave baixa");
  Testes.igual(encontro(ave(LARGE, 5), 0, GATILHO), false,
               "correr na ave baixa deveria matar");

  Testes.igual(encontro(ave(LARGE, 35), 2, GATILHO), true,
               "ABAIXAR deveria salvar da ave media");
  Testes.igual(encontro(ave(LARGE, 35), 0, GATILHO), false,
               "correr na ave media deveria matar");

  Testes.igual(encontro(ave(LARGE, 60), 0, GATILHO), true,
               "CORRER deveria passar sob a ave alta");
  Testes.igual(encontro(ave(LARGE, 60), 1, GATILHO), false,
               "pular na ave alta deveria matar");
});
