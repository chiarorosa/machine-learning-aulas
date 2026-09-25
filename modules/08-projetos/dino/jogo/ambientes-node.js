// Motor original, sem tela. Usado pelo experimento reproduzivel do professor.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
for (const nome of ["aleatorio.js", "motor.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, nome), "utf8"));
}
const motores = Array.from({length: 20}, (_, i) => Motor.criar(2026 + i * 7919));
const linhas = require("readline").createInterface({input: process.stdin});
linhas.on("line", linha => {
  const acoes = JSON.parse(linha);
  const ambientes = motores.map((m, i) => {
    const r = acoes ? m.passo(acoes[i]) : {recompensa: 0, terminou: false, pausado: false};
    return {id: i, ...r, estado: m.estado(), score: m.snapshot().score};
  });
  console.log(JSON.stringify({ambientes}));
});
