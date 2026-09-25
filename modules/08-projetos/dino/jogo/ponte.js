// Cliente WebSocket. Uma ida e volta por passo do motor, com as 20 pistas juntas.
// Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
var Ponte = (function () {
  var URL = "ws://localhost:8765";
  var LIMITE_RESPOSTA = 5000;   // ms

  var socket = null;
  var ligada = false;
  var aoMudar = function () {};
  var ultimaInfo = {};

  // FILA de respostas esperadas, nao um slot unico.
  // O laco do jogo e a troca de modo podem enviar mensagens quase juntas;
  // com um slot so, a segunda sobrescrevia a primeira e a promessa da
  // primeira nunca resolvia - o laco do jogo travava para sempre.
  // O WebSocket preserva a ordem, e o servidor responde uma vez por
  // mensagem, entao atender em FIFO casa cada resposta com seu pedido.
  var fila = [];

  function conectar(callback) {
    if (callback) aoMudar = callback;
    try {
      socket = new WebSocket(URL);
    } catch (e) {
      agendarReconexao();
      return;
    }

    socket.onopen = function () { ligada = true; aoMudar(true); };

    socket.onmessage = function (evento) {
      var dados = JSON.parse(evento.data);
      if (dados.info) ultimaInfo = dados.info;
      var proximo = fila.shift();
      if (proximo) proximo.resolver(dados);
    };

    socket.onclose = function () {
      ligada = false;
      aoMudar(false);
      esvaziarFila();
      agendarReconexao();
    };

    socket.onerror = function () { /* onclose cuida da reconexao */ };
  }

  function esvaziarFila() {
    var presos = fila.splice(0);
    for (var i = 0; i < presos.length; i++) presos[i].resolver(null);
  }

  function agendarReconexao() {
    setTimeout(function () { conectar(); }, 2000);
  }

  function enviar(mensagem) {
    if (!ligada) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var item = { resolver: resolve };
      // Rede de seguranca: uma resposta perdida nao pode parar o jogo.
      var alarme = setTimeout(function () {
        var posicao = fila.indexOf(item);
        if (posicao >= 0) fila.splice(posicao, 1);
        resolve(null);
      }, LIMITE_RESPOSTA);

      item.resolver = function (valor) { clearTimeout(alarme); resolve(valor); };
      fila.push(item);
      socket.send(JSON.stringify(mensagem));
    });
  }

  return {
    conectar: conectar,
    configurar: function (opcoes) {
      return enviar({ tipo: "configurar", modo: opcoes.modo,
                      quantidade: opcoes.quantidade });
    },
    enviarPasso: function (ambientes) {
      return enviar({ tipo: "passo", ambientes: ambientes });
    },
    enviarHumano: function (transicao) {
      return enviar({ tipo: "humano", transicao: transicao });
    },
    estaLigada: function () { return ligada; },
    pendentes: function () { return fila.length; },
    info: function () { return ultimaInfo; }
  };
})();
