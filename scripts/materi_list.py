"""Daftar kata materi per jenjang, dikelompokkan per kelas & jenis.

    python3 materi_list.py ISIM FIIL HARF [JUDUL]
    contoh: python3 materi_list.py 90 30 30 "Jenjang 70%"  ->  materi/kata-90-30-30.md
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(ROOT, "web", "data", "lemmas.json")))
TOTAL = 97722  # semua kata + huruf menempel (tanpa ال)
ni, nf, nh = (int(a) for a in sys.argv[1:4])
judul = sys.argv[4] if len(sys.argv) > 4 else f"{ni} isim · {nf} fi'il · {nh} harf"

by = {k: [x for x in L if x["k"] == k] for k in "ihf"}
pick = {"h": by["h"][:nh], "i": by["i"][:ni], "f": by["f"][:nf]}
ALL = pick["h"] + pick["i"] + pick["f"]


def pct(xs):
    return f"{sum(x['n'] for x in xs) / TOTAL * 100:.1f}".replace(".", ",")


ISIM_ORDER = ["Isim 'alam", "Shighah mubalaghah", "Isim dhamir", "Isim isyarah", "Isim maushul", "Isim istifham",
              "Zharaf zaman", "Zharaf makan", "Isim fa'il", "Isim maf'ul", "Masdar", "Shifah musyabbahah",
              "Isim tafdhil", "Isim 'adad", "Isim makan", "Isim"]
LABEL = {"Isim": "Isim umum (kata benda)", "Shighah mubalaghah": "Shighah mubalaghah (Asmaul Husna)"}
CLASS = [("h", "Harf", "حَرْفٌ"), ("i", "Isim", "اسْمٌ"), ("f", "Fi'il", "فِعْلٌ")]

out = [f"# Materi {judul}", "",
       f"**{len(ALL)} kata dasar = {pct(ALL)}% dari seluruh kata dalam Al-Qur'an**", "",
       "| Kelas | Jumlah kata | Cakupan |", "|---|---|---|"]
for k, name, ar in CLASS:
    out.append(f"| {name} {ar} | {len(pick[k])} | {pct(pick[k])}% |")
out += ["", "Keterangan kolom:",
        "- **No.** adalah peringkat kata di seluruh Al-Qur'an (1 = paling sering muncul).",
        "- **×** adalah jumlah kemunculan, termasuk semua bentuk turunannya.",
        "- Fi'il ditulis madhi – mudhari'; isim dalam bentuk tunggal; ـ menandai huruf yang menempel pada kata sesudahnya.",
        "- Persentase dihitung dari 97.722 satuan kata (semua kata + huruf menempel; ال tidak dihitung).", ""]

for k, name, ar in CLASS:
    xs = pick[k]
    g = collections.OrderedDict()
    for x in xs:
        g.setdefault(x["jenis"][0], []).append(x)
    if k == "i":
        keys = [j for j in ISIM_ORDER if j in g] + [j for j in g if j not in ISIM_ORDER]
    else:
        keys = sorted(g, key=lambda j: -sum(x["n"] for x in g[j]))
    out += [f"## {name} {ar} ({len(xs)} kata · {pct(xs)}%)", ""]
    for j in keys:
        ys = g[j]
        out += [f"### {LABEL.get(j, j)} {ys[0]['jenis'][1]} ({len(ys)} kata · {pct(ys)}%)", "",
                "| No. | Kata | Arti | × |", "|---|---|---|---|"]
        for x in ys:
            w = x["ar"] + ("ـ" if x.get("menempel") else "")
            if x.get("mudhari"):
                w += " – " + x["mudhari"]
            out.append(f"| {x['id'] + 1} | {w} | {'; '.join(x['mean'][:3])} | {str(f"{x['n']:,}").replace(",", ".")} |")
        out.append("")

os.makedirs(os.path.join(ROOT, "materi"), exist_ok=True)
path = os.path.join(ROOT, "materi", f"kata-{ni}-{nf}-{nh}.md")
open(path, "w").write("\n".join(out))
print(path, pct(ALL))
