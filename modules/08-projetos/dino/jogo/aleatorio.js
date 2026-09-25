// mulberry32: gerador rapido, deterministico, 32 bits.
// Existe para que o treino seja reproduzivel: mesma semente, mesma aula.
var Aleatorio = (function () {

  function criar(semente) {
    var estado = semente >>> 0;
    return function () {
      estado = (estado + 0x6D2B79F5) >>> 0;
      var t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function inteiro(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  return { criar: criar, inteiro: inteiro };
})();
