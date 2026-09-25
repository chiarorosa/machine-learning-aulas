"""Serve a pasta da aula sem cache.

Existe por um motivo pratico: `python -m http.server` nao manda
Cache-Control, e o Chrome entao guarda os .js por conta propria. Voce
edita motor.js, recarrega, e continua vendo o comportamento antigo -
que e exatamente o tipo de confusao que estraga uma aula e os
exercicios deste projeto, todos baseados em editar um arquivo e
recarregar.

    python servir.py            # http://localhost:8000/jogo/index.html
    python servir.py --porta 9000

Autor: Pablo Chiaro Rosa <pablo.chiaro.rosa@gmail.com>
"""

import argparse
import http.server
import os
import socketserver

PASTA = os.path.dirname(os.path.abspath(__file__))


class SemCache(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PASTA, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, formato, *args):
        pass          # silencia o log de cada arquivo servido


def main():
    p = argparse.ArgumentParser(description="Servidor estatico sem cache")
    p.add_argument("--porta", type=int, default=8000)
    args = p.parse_args()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", args.porta), SemCache) as servidor:
        print(f"[web] http://localhost:{args.porta}/jogo/index.html")
        print(f"[web] testes: http://localhost:{args.porta}/jogo/testes.html")
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            print("\n[web] encerrado")


if __name__ == "__main__":
    main()
