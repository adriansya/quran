"""Unduh kata per kata (arti Indonesia) + terjemah Kemenag (#33) dari Quran.com API v4.

Hasil: data/raw/qurancom/{surah:03}.json  (satu file per surah, list ayat)
"""
import json
import pathlib
import time
import urllib.request

API = "https://api.quran.com/api/v4"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / "qurancom"
FIELDS = "text_uthmani,text_imlaei,location"


def get(url, tries=5):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "quran-vocab-builder/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print("  retry", url, e)
            time.sleep(2 ** i)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    chapters = get(f"{API}/chapters?language=id")["chapters"]
    (OUT / "chapters.json").write_text(json.dumps(chapters, ensure_ascii=False))
    for ch in chapters:
        n = ch["id"]
        path = OUT / f"{n:03}.json"
        if path.exists():
            continue
        verses, page = [], 1
        while True:
            d = get(
                f"{API}/verses/by_chapter/{n}?language=id&words=true&word_fields={FIELDS}"
                f"&translations=33&per_page=50&page={page}"
            )
            verses += d["verses"]
            if not d["pagination"]["next_page"]:
                break
            page += 1
        assert len(verses) == ch["verses_count"], (n, len(verses))
        path.write_text(json.dumps(verses, ensure_ascii=False))
        print(f"surah {n}: {len(verses)} ayat")


if __name__ == "__main__":
    main()
