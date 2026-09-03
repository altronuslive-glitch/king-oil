"""Статический сервер для разработки: отдаёт src/ и запрещает кэширование,
чтобы правки в CSS и JS были видны сразу после перезагрузки страницы.

    python dev-server.py           # http://localhost:5173
    python dev-server.py 8080      # другой порт
"""

import sys
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    handler = partial(NoCacheHandler, directory="src")
    print(f"King-Oil: http://localhost:{port}  (Ctrl+C — остановить)")
    HTTPServer(("127.0.0.1", port), handler).serve_forever()
