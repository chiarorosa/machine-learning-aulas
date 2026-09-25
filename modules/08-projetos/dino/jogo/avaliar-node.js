// Adaptador de terminal; a avaliacao em si tambem roda no navegador.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
for (const nome of ["aleatorio.js", "motor.js", "avaliacao.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, nome), "utf8"));
}
const pedido = JSON.parse(fs.readFileSync(0, "utf8"));
console.log(JSON.stringify(Avaliacao.executar(pedido.pesos, pedido.quantidade, pedido.limite)));
