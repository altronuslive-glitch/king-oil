"""Раскладывает общие блоки вёрстки по страницам в src/.

Куски разметки, одинаковые на нескольких страницах (спрайт, шапка, футер,
таббар, модалки, отзывы, форма «Напишите нам», FAQ), лежат по одному файлу
в partials/. На странице стоит только пара комментариев:

    <!-- @shared:header -->
    <!-- /@shared:header -->

Скрипт подставляет между ними содержимое partials/header.html. Так шапка
правится в одном месте, а страницы остаются обычным статическим HTML —
никакой сборки для их показа не нужно, в браузер уходит готовый файл.

Запуск: python build-pages.py
"""

import io
import re
from pathlib import Path

SRC = Path("src")
PARTIALS = Path("partials")

BLOCK = re.compile(
    r"(<!-- @shared:(?P<name>[a-z-]+) -->[^\S\n]*\n)"
    r"(?P<body>.*?)"
    r"(\n[^\S\n]*<!-- /@shared:(?P=name) -->)",
    re.S,
)


def read(path):
    return io.open(path, encoding="utf-8").read()


def write(path, text):
    io.open(path, "w", encoding="utf-8", newline="\n").write(text)


def main():
    parts = {p.stem: read(p).rstrip("\n") for p in sorted(PARTIALS.glob("*.html"))}
    if not parts:
        raise SystemExit(f"в {PARTIALS}/ нет ни одного блока")

    changed = 0
    for page in sorted(SRC.glob("*.html")):
        html = read(page)
        used = []

        def replace(m):
            name = m.group("name")
            if name not in parts:
                raise SystemExit(f"{page.name}: нет файла {PARTIALS}/{name}.html")
            used.append(name)
            return m.group(1) + parts[name] + m.group(4)

        new = BLOCK.sub(replace, html)
        if new != html:
            write(page, new)
            changed += 1
        print(f"{page.name}: {', '.join(used) if used else 'общих блоков нет'}")

    print(f"\nблоки: {', '.join(sorted(parts))}")
    print(f"обновлено страниц: {changed}")


if __name__ == "__main__":
    main()
