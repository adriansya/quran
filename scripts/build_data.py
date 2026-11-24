"""Gabungkan Quran.com (kata, arti per kata Indonesia, terjemah Kemenag) dengan
Quranic Arabic Corpus (akar, lemma, jenis kata) menjadi JSON statis untuk web app.

Masukan:
  data/raw/qurancom/*.json                     (scripts/fetch_qurancom.py)
  data/raw/quranic-corpus-morphology-0.4.txt   (corpus.quran.com/download)
Keluaran: web/data/
  chapters.json   daftar surah
  lemmas.json     kosakata (lemma) + arti + frekuensi
  roots.json      akar kata + daftar lemma
  occ.json        lokasi kemunculan per lemma
  surah/NNN.json  ayat per surah: kata per kata + terjemah Kemenag
"""
import collections
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from arabic_std import PRONOUNS, consonant_key, std  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "data"

# Extended Buckwalter (Quranic Arabic Corpus) -> Unicode
BW = {
    "'": "ء", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ",
    "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث",
    "j": "ج", "H": "ح", "x": "خ", "d": "د", "*": "ذ",
    "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ",
    "_": "ـ", "f": "ف", "q": "ق", "k": "ك", "l": "ل",
    "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى",
    "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ",
    "u": "ُ", "i": "ِ", "~": "ّ", "o": "ْ", "^": "ٓ",
    "#": "ٔ", "`": "ٰ", "{": "ٱ", ":": "ۜ", "@": "۟",
    '"': "۠", "[": "ۢ", ";": "ۣ", ",": "ۥ", ".": "ۦ",
    "!": "ۨ", "-": "۪", "+": "۫", "%": "۬", "]": "ۭ",
}


def bw2ar(s):
    return "".join(BW.get(c, c) for c in s)


# kelas kata tradisional: fi'il (f), isim (i), harf (h)
ISIM = {"N", "PN", "ADJ", "PRON", "DEM", "REL", "T", "LOC", "IMPN"}
KELAS = lambda pos: "f" if pos == "V" else "i" if pos in ISIM else "h"  # noqa: E731

POS_ID = {
    "N": "Kata benda", "V": "Kata kerja", "PN": "Nama diri", "ADJ": "Kata sifat",
    "PRON": "Kata ganti", "DEM": "Kata tunjuk", "REL": "Kata ganti relatif",
    "P": "Preposisi", "CONJ": "Kata sambung", "SUB": "Kata sambung", "NEG": "Partikel negasi",
    "T": "Keterangan waktu", "LOC": "Keterangan tempat", "COND": "Partikel syarat",
    "INTG": "Kata tanya", "ACC": "Partikel nasab", "VOC": "Panggilan",
}
VERB_FORMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]
TAG_RE = re.compile(r"<sup[^>]*>.*?</sup>|<[^>]+>")


def load_corpus():
    words = collections.defaultdict(list)
    with open(RAW / "quranic-corpus-morphology-0.4.txt", encoding="utf-8") as f:
        for line in f:
            if not line.startswith("("):
                continue
            loc, form, tag, feat = line.rstrip("\n").split("\t")
            key = loc.strip("()").rsplit(":", 1)[0]
            words[key].append((form, tag, feat.split("|")))
    return words


def skel(s):
    """Kerangka huruf: tanpa harakat & tanda; varian alif/hamzah/ya disamakan."""
    s = re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]", "", s)
    for a, b in (("ٱ", "ا"), ("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ى", "ي"), ("ئ", "ي"), ("ؤ", "و"), ("ء", "")):
        s = s.replace(a, b)
    return s


def khas(rasm, ar):
    """Tulisan mushaf berbeda hurufnya dari ejaan standar, selain alif kecil (ٰ) dan ىٰ."""
    norm = lambda x: skel(x.replace("ىٰ", "ى").replace("\u0670", "ا"))  # noqa: E731
    return norm(rasm) != norm(ar) and norm(rasm) != skel(ar)


def analyse(segs):
    """Ambil lemma, akar, POS dan bentuk kata kerja dari segmen STEM."""
    stem = next(s for s in segs if "STEM" in s[2])
    feats = stem[2]
    get = lambda p: next((f[len(p):] for f in feats if f.startswith(p)), None)  # noqa: E731
    lem = get("LEM:")
    pos = get("POS:") or stem[1]
    if lem is None:  # kata ganti dsb. tidak punya lemma di Corpus
        # kunci = konsonan saja, agar نَا/نَآ, هِۦ/هِۦٓ, أَنَا/أَنَا۠ menjadi satu kata
        lem = f"{pos}:{consonant_key(stem[0]) or stem[0]}"
    form = None
    if pos == "V":
        form = next((f.strip("()") for f in feats if f.startswith("(") and f.endswith(")")), "I")
    bare = len(segs) == 1
    return {"lem": lem, "root": get("ROOT:"), "pos": pos, "vform": form, "bare": bare, "stem": stem[0]}


def main():
    corpus = load_corpus()
    chapters = json.loads((RAW / "qurancom" / "chapters.json").read_text())

    lemmas = {}  # bw -> info
    occ = collections.defaultdict(list)
    surah_out = {}
    mushaf = {}  # surah -> halaman & juz per ayat

    for ch in chapters:
        n = ch["id"]
        verses = json.loads((RAW / "qurancom" / f"{n:03}.json").read_text())
        vs = []
        for v in verses:
            ws = []
            for w in v["words"]:
                if w["char_type_name"] != "word":
                    continue
                loc = w["location"]
                a = analyse(corpus[loc])
                L = lemmas.setdefault(a["lem"], {
                    "root": a["root"], "pos": collections.Counter(), "vform": collections.Counter(),
                    "mean": collections.Counter(), "core": collections.Counter(),
                    "forms": collections.Counter(), "stems": collections.Counter(), "tr": {},
                })
                L["pos"][a["pos"]] += 1
                if a["vform"]:
                    L["vform"][a["vform"]] += 1
                meaning = (w["translation"]["text"] or "").strip()
                L["mean"][meaning] += 1
                if a["bare"]:
                    L["core"][meaning] += 1
                L["stems"][a["stem"]] += 1
                L["forms"][w["text_uthmani"]] += 1
                L["tr"].setdefault(w["text_uthmani"], w["transliteration"]["text"])
                occ[a["lem"]].append(loc)
                ws.append([w["text_uthmani"], meaning, w["transliteration"]["text"], a["lem"]])
            tr = TAG_RE.sub("", v["translations"][0]["text"]).strip()
            vs.append({"n": v["verse_number"], "w": ws, "t": tr})
        surah_out[n] = vs
        mushaf[n] = {"p": [v["page_number"] for v in verses], "j": [v["juz_number"] for v in verses]}

    # urutkan lemma berdasarkan frekuensi -> id numerik
    order = sorted(lemmas, key=lambda k: (-len(occ[k]), k))
    lid = {k: i for i, k in enumerate(order)}

    roots = {}
    lemma_list = []
    for k in order:
        L = lemmas[k]
        pos = L["pos"].most_common(1)[0][0]
        top_form = L["forms"].most_common(1)[0][0]
        display = k.split(":", 1)[1] if ":" in k and k.split(":")[0] in POS_ID else k
        display = re.sub(r"\d+$", "", display)
        means = []
        n_all = sum(L["mean"].values())
        cands = L["core"].most_common(3) + L["mean"].most_common(8)
        for i, (m, c) in enumerate(cands):
            if i and c < max(2, 0.03 * n_all):  # buang arti jarang/tidak selaras
                continue
            if m and m not in means:
                means.append(m)
        means = means[:4]
        kind, _, key = k.partition(":") if ":" in k and k.split(":")[0] in POS_ID or k.startswith("INL:") else ("", "", k)
        if kind == "PRON" and key in PRONOUNS:
            ar, means = PRONOUNS[key][0], PRONOUNS[key][1]
        elif kind:  # huruf muqatta'ah dll: pakai tulisan mushaf
            ar = top_form
        else:
            ar = std(display)
        # tulisan di mushaf (rasm Utsmani): lemma Corpus apa adanya; kata ganti: semua variannya
        if kind == "PRON":
            # varian yang beda tulisan saja (mad, wawu/ya kecil), bukan beda harakat
            seen = {}
            for st, _ in L["stems"].most_common():
                f = bw2ar(st)
                seen.setdefault(re.sub(r"[\u064B-\u0652]", "", f), f)
            rasm = "، ".join(list(seen.values())[:4]) if len(seen) > 1 else ar
        elif kind:
            rasm = ar
        else:
            rasm = bw2ar(display)
        item = {
            "id": lid[k],
            "ar": ar,
            **({"rasm": rasm} if rasm != ar else {}),
            # "ejaan khas mushaf": huruf berbeda selain alif kecil (mis. صَلَوٰة, رَءَا, سَيِّـَٔات)
            **({"rasmX": True} if kind != "PRON" and rasm != ar and khas(rasm, ar) else {}),
            "bw": k,
            "root": bw2ar(L["root"]) if L["root"] else None,
            "pos": pos,
            "posId": POS_ID.get(pos, "Partikel"),
            "vform": L["vform"].most_common(1)[0][0] if L["vform"] else None,
            "k": KELAS(pos),
            "n": len(occ[k]),
            "mean": means,
            "form": top_form,
            "tr": L["tr"][top_form],
        }
        lemma_list.append(item)
        if L["root"]:
            r = roots.setdefault(L["root"], {"root": bw2ar(L["root"]), "bw": L["root"], "n": 0, "lemmas": []})
            r["n"] += item["n"]
            r["lemmas"].append(item["id"])

    # homograf: tulisan sama, kata berbeda (mis. صَالِح "saleh" vs Nabi Saleh)
    same = collections.defaultdict(list)
    for it in lemma_list:
        same[it["ar"]].append(it["id"])
    for ids in same.values():
        if len(ids) > 1:
            for i in ids:
                lemma_list[i]["homo"] = [j for j in ids if j != i]

    root_list = sorted(roots.values(), key=lambda r: -r["n"])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "surah").mkdir(exist_ok=True)
    dump = lambda p, o: (OUT / p).write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")))  # noqa: E731
    dump("lemmas.json", lemma_list)
    dump("roots.json", root_list)
    dump("occ.json", [occ[k] for k in order])
    dump("mushaf.json", mushaf)
    dump("chapters.json", [{
        "n": c["id"], "ar": c["name_arabic"], "name": c["name_simple"],
        "arti": c["translated_name"]["name"], "ayat": c["verses_count"], "place": c["revelation_place"],
    } for c in chapters])
    for n, vs in surah_out.items():
        for v in vs:
            for w in v["w"]:
                w[3] = lid[w[3]]
        dump(f"surah/{n:03}.json", vs)

    total = sum(len(o) for o in occ.values())
    print(f"kata: {total}, lemma: {len(lemma_list)}, akar: {len(root_list)}")
    cum, marks = 0, [50, 100, 200, 300, 500, 1000]
    for i, L in enumerate(lemma_list, 1):
        cum += L["n"]
        if i in marks:
            print(f"  {i:>5} lemma teratas = {cum / total:.1%} kata Al-Qur'an")


if __name__ == "__main__":
    main()
