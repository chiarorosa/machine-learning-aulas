// O mesmo conjunto de testes do navegador, com uma saida de texto no terminal.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
global.document = {createElement: () => ({}), title: ""};
for (const nome of ["testes.js", "aleatorio.js", "motor.js", "avaliacao.js", "casos.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, nome), "utf8"));
}
const resultado = Testes.executar({appendChild: linha => {
  if (linha.className !== "ok") console.log(linha.textContent);
}});
process.exitCode = resultado.falhou ? 1 : 0;
