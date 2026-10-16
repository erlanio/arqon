#!/usr/bin/env python3
"""Abre o ARQON Software Engineering Studio localmente, sem serviços ou dependências online."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser


APP_DIRECTORY = Path(__file__).resolve().parent
DEFAULT_PORT = 4173  # Mantém a mesma origem para localStorage e IndexedDB.


class LocalFileHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404, "Arquivo não encontrado")
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def port_number(value):
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("a porta deve ser um número") from error
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("a porta deve estar entre 1 e 65535")
    return port


def main(argv=None):
    parser = argparse.ArgumentParser(description="Executa o ARQON Software Engineering Studio somente neste computador.")
    parser.add_argument("--port", type=port_number, default=DEFAULT_PORT, help="porta local (padrão: 4173)")
    parser.add_argument("--no-browser", action="store_true", help="não abrir o navegador automaticamente")
    args = parser.parse_args(argv)

    if not (APP_DIRECTORY / "index.html").is_file():
        print("Erro: index.html não foi encontrado junto ao lançador.", file=sys.stderr)
        return 1

    handler = partial(LocalFileHandler, directory=str(APP_DIRECTORY))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        print(f"Erro ao iniciar a porta local {args.port}: {error}", file=sys.stderr)
        return 1

    url = f"http://127.0.0.1:{args.port}/"
    print(f"ARQON Software Engineering Studio disponível em {url}", flush=True)
    print("Pressione Ctrl+C para encerrar.", flush=True)
    if not args.no_browser and not webbrowser.open_new_tab(url):
        print("Abra o endereço acima no navegador.", flush=True)

    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\nARQON Software Engineering Studio encerrado.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
