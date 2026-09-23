"""Offline roulette server. Python standard library only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class AppHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description="Wedding roulette")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent / "public"
    handler = partial(AppHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(("0.0.0.0", args.port), handler)
    except OSError as error:
        parser.exit(1, f"Cannot start server: {error}\nTry --port {args.port + 1}\n")
    print(f"Open http://localhost:{args.port} in your Windows browser. Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
