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
import canon as CANON  # noqa: E402

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


def noun_bw(bw, root, pcpl):
    """Bentuk kamus isim: ta' marbuthah (bukan ta' maftuhah mushaf), tanpa tanwin, manqush -> ـٍ."""
    s = bw
    if s.endswith("at") and root and root[-1] != "t":
        s = s[:-2] + "ap"
    s = re.sub(r"(?<=[^FY])[NF]$", "", s)
    if pcpl and root and root[-1] in "wy" and s.endswith("iy"):
        s = s[:-2] + "K"
    return s


def _plain(s):
    return skel(std(s))


def norm_stem(st, root=None):
    """Bentuk dasar jamak/muannats: tanpa i'rab, tanwin, tanda mushaf; hamzah & ta' diseragamkan."""
    s = re.sub(r"^(.)~", r"\1", st)
    s = re.sub(r"[\[\]@:\"^;!\-+%]", "", s)  # tanda waqaf/kecil mushaf (hamzah _# dan ۥ ۦ dibiarkan untuk std)
    s = s.replace(",", "w").replace(".", "y")  # wawu/ya kecil = huruf (النَّبِيِّـۧن)
    s = re.sub(r"(?<=[&w]u)A$", "", s)  # عُلَمَاؤُا، يَرْجُوا -> tanpa alif
    s = re.sub(r"uwA$", "uw", s)
    s = re.sub(r"FY$", "aY", s)  # قُرًى -> قُرَى
    s = re.sub(r"FA$", "", s)
    if root and root[-1] in "wy":
        s = re.sub(r"(?<=[^aiuoA~'>&}#t`])K$", "iy", s)  # manqush: لَيَالٍ -> لَيَالِي، أَيْدٍ -> أَيْدِي
    s = re.sub(r"[aiuNFK]+$", "", s)
    s = re.sub(r"[A`][&}>]$", "A'", s)  # آبَاؤُ/آبَائِ/عُلَمَاؤُ -> آبَاء، عُلَمَاء
    if root and root[-1] != "t":
        s = re.sub(r"(?<=[aiu])t$", "p", s)  # ta' maftuhah mushaf -> ta' marbuthah
    s = re.sub(r"^(['>]|_#)aA", "|", s)  # أَالِهَة -> آلِهَة
    return s


def plural_forms(L, lemma_ar):
    """Daftar bentuk jamak + jenis + wazan dari kemunculan di Al-Qur'an."""
    out = {}
    # pangkal jamak salim yang tertulis lengkap (بَنُون) -> bentuk mudhafnya (بَنِي، بَنِيَّ) ikut salim
    salim_base = {_plain(re.sub(r"(uwn|iyn)$", "", norm_stem(st, L["root"]))) for (st, _), _ in L["plural"].items()
                  if re.search(r"(uwn|iyn)$", norm_stem(st, L["root"]))}
    for (st, mp), n in L["plural"].most_common():
        s = norm_stem(st, L["root"])
        kind = None
        lp = _plain(lemma_ar)
        base_ok = lambda b: _plain(b) == lp or (lp.endswith("ي") and _plain(b) == lp[:-1])  # noqa: E731
        if re.search(r"(uwn|iyn)$", s):
            if base_ok(s[:-3]):
                s, kind = s[:-3] + "uwn", "jamak mudzakkar salim"
            elif L["root"] and L["root"][-1] == "n":
                kind = None  # ن huruf akar: jamak taksir (عُيُون)
            else:
                s, kind = s[:-3] + "uwn", "mulhaq jamak mudzakkar salim"
        elif re.search(r"(uw|iy|iY)~?$", s) and (base_ok(re.sub(r"(uw|iy|iY)~?$", "", s)) or _plain(re.sub(r"(uw|iy|iY)~?$", "", s)) in salim_base):
            label = "jamak mudzakkar salim" if base_ok(re.sub(r"(uw|iy|iY)~?$", "", s)) else "mulhaq jamak mudzakkar salim"
            s, kind = re.sub(r"(uw|iy|iY)~?$", "uwn", s), label
        elif False:
            s, kind = re.sub(r"(uw|iy|iY)$", "uwn", s), "jamak mudzakkar salim"
        elif re.search(r"(aAt|a`t)$", s):
            s, kind = re.sub(r"a`t$", "aAt", s), "jamak muannats salim"
        ar = std(s)
        if not ar or skel(ar) == skel(lemma_ar):
            continue
        w = None
        if kind is None:
            kind = "jamak taksir"
            w = CANON.plural_wazan(s.replace("`", "A"), L["root"])
        if ar not in out:
            out[ar] = {"ar": ar, "jenis": kind, "n": 0, **({"wazan": w} if w else {})}
        out[ar]["n"] += n
    # لَيَال & لَيَالِي -> satu (bentuk manqush lengkap)
    for a in list(out):
        if a + "ي" in out or a + "ِي" in out:
            b = out.pop(a)
            (out.get(a + "ي") or out.get(a + "ِي"))["n"] += b["n"]
    return sorted(out.values(), key=lambda x: -x["n"])[:4]


def sharaf_info(k, L, pos, ar, notes):
    info = {}
    if pos == "V":
        form = L["vform"].most_common(1)[0][0] if L["vform"] else "I"
        w = CANON.verb_wazan(form, k)
        if w:
            info["wazan"] = w
        if L["impf"]:
            # utamakan bentuk marfu' (يَدْعُو، يَأْتِي، يَرَى), bukan majzum (يَدْعُ، يَأْتِ)
            ranked = sorted(L["impf"].items(), key=lambda x: (
                0 if re.search(r"(iy|uw|aY`?|aA)$", x[0]) else 1 if x[0].endswith("u") else 2, -x[1]))
            cands = [x[0] for x in ranked]
            info["mudhari"] = std(re.sub(r"^(.)~", r"\1", cands[0]))
    elif pos in ("N", "ADJ"):
        pl = plural_forms(L, ar)
        if pl:
            info["jamak"] = pl
        if L["fem"] and not ar.endswith("ة"):
            f = std(norm_stem(L["fem"].most_common(1)[0][0], L["root"]))
            if f.endswith("ة") and skel(f) != skel(ar):
                info["muannats"] = f
        if L["nums"]["P"] == sum(L["nums"].values()) and k not in L["orig"]:
            info["catatan"] = "Di Al-Qur'an hanya muncul dalam bentuk jamak."
    why = [v for v in notes.values() if v and v not in ("madhi di Al-Qur'an",)]
    plural_only = [CANON.PLURAL_ONLY[o] for o in L["orig"] if o in CANON.PLURAL_ONLY]
    if plural_only:
        info["catatan"] = plural_only[0][0].upper() + plural_only[0][1:] + "."
    if any(v == "dibentuk dari akar & wazan" for v in why) and k not in L["orig"]:
        info["dibentuk"] = True  # madhi tidak tertulis di Al-Qur'an; dibentuk dari kaidah
    return info


CMAP = {}  # lemma Corpus -> lemma kanonik (diisi di main)


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
    orig = lem
    lem = CMAP.get(lem, lem)
    return {"lem": lem, "orig": orig, "root": get("ROOT:"), "pos": pos, "vform": form, "bare": bare,
            "stem": stem[0], "feats": feats}


def main():
    corpus = load_corpus()
    # kanonisasi lemma (fi'il -> madhi; isim -> mufrad mudzakkar)
    by_lem = collections.defaultdict(list)
    for segs in corpus.values():
        st = next(x for x in segs if "STEM" in x[2])
        lem = next((f[4:] for f in st[2] if f.startswith("LEM:")), None)
        if lem:
            pos = next((f[4:] for f in st[2] if f.startswith("POS:")), st[1])
            by_lem[lem].append((st[0], st[2], pos))
    cmap, cnotes, _ = CANON.build(by_lem)
    CMAP.update(cmap)
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
                    "orig": collections.Counter(), "plural": collections.Counter(), "fem": collections.Counter(),
                    "impf": collections.Counter(), "pcpl": 0, "nums": collections.Counter(),
                })
                L["orig"][a["orig"]] += 1
                ft = a["feats"]
                num = "P" if any(x in ("MP", "FP", "P") for x in ft) else "D" if any(x in ("MD", "FD", "D") for x in ft) else "S"
                L["nums"][num] += 1
                if "PCPL" in ft:
                    L["pcpl"] += 1
                if a["pos"] in ("N", "ADJ"):
                    if num == "P":
                        L["plural"][(a["stem"], "MP" in ft)] += 1
                    elif num == "S" and ("F" in ft or "FS" in ft):
                        L["fem"][a["stem"]] += 1
                elif a["pos"] == "V" and "IMPF" in ft and "3MS" in ft and "PASS" not in ft:
                    L["impf"][a["stem"]] += 1
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
            ar = std(noun_bw(display, L["root"], L["pcpl"] > 0) if pos in ("N", "ADJ") else display)
        # bentuk kanonik ini memang tertulis di Al-Qur'an? (kalau dibentuk dari kaidah, tak ada tulisan mushafnya)
        attested = k in L["orig"] or any(cnotes.get(o) == "madhi di Al-Qur'an" for o in L["orig"])
        sharaf = sharaf_info(k, L, pos, ar, {o: cnotes.get(o) for o in L["orig"]})
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
            rasm = bw2ar(display) if attested else ar
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
            **sharaf,
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
