"""Daftar kata materi per jenjang, dikelompokkan per kelas & jenis.

    python3 materi_list.py ISIM FIIL HARF [JUDUL] [+bw,+bw ...]
    contoh: python3 materi_list.py 90 30 30 "Jenjang 70%" +hal,+kayof  ->  materi/kata-90-30-30.md
    +bw = kata tambahan yang wajib masuk (kunci Buckwalter).
"""
import collections, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(ROOT, "web", "data", "lemmas.json")))
TOTAL = 97722  # semua kata + huruf menempel (tanpa ال)
ni, nf, nh = (int(a) for a in sys.argv[1:4])
judul = sys.argv[4] if len(sys.argv) > 4 else f"{ni} isim · {nf} fi'il · {nh} harf"
plus = [b.lstrip("+") for b in sys.argv[5].split(",")] if len(sys.argv) > 5 else []

by = {k: [x for x in L if x["k"] == k] for k in "ihf"}
pick = {"h": by["h"][:nh], "i": by["i"][:ni], "f": by["f"][:nf]}
BW = {x["bw"]: x for x in L}
for b in plus:
    x = BW[b]
    if x not in pick[x["k"]]:
        pick[x["k"]] = sorted(pick[x["k"]] + [x], key=lambda y: y["id"])
ALL = pick["h"] + pick["i"] + pick["f"]


def pct(xs):
    return f"{sum(x['n'] for x in xs) / TOTAL * 100:.1f}".replace(".", ",")


# Isim diringkas jadi 5 kelompok supaya mudah dipahami
ISIM_GROUP = {
    "Isim dhamir": "Kata ganti & kata tunjuk", "Isim isyarah": "Kata ganti & kata tunjuk",
    "Isim maushul": "Kata ganti & kata tunjuk", "Isim istifham": "Kata ganti & kata tunjuk",
    "Isim 'alam": "Allah, Asmaul Husna & nama", "Shighah mubalaghah": "Allah, Asmaul Husna & nama",
    "Zharaf zaman": "Keterangan waktu & tempat", "Zharaf makan": "Keterangan waktu & tempat",
    "Isim fa'il": "Kata sifat & pelaku", "Isim maf'ul": "Kata sifat & pelaku",
    "Shifah musyabbahah": "Kata sifat & pelaku", "Isim tafdhil": "Kata sifat & pelaku",
}
ISIM_NOTE = {
    "Kata ganti & kata tunjuk": ("ضَمِيرٌ، إِشَارَةٌ، مَوْصُولٌ", "dia, kamu, ini, itu, yang …"),
    "Allah, Asmaul Husna & nama": ("عَلَمٌ، أَسْمَاءُ اللّٰهِ الْحُسْنَى", "nama diri dan sifat-sifat Allah"),
    "Keterangan waktu & tempat": ("ظَرْفُ زَمَانٍ وَمَكَانٍ", "ketika, sebelum, antara, di sisi …"),
    "Kata sifat & pelaku": ("اسْمُ فَاعِلٍ، صِفَةٌ، تَفْضِيلٌ", "orang yang …, besar, lebih …"),
    "Kata benda": ("اسْمٌ، مَصْدَرٌ", "benda, tempat, perbuatan (masdar)"),
}
ISIM_ORDER = ["Kata ganti & kata tunjuk", "Allah, Asmaul Husna & nama", "Keterangan waktu & tempat",
              "Kata sifat & pelaku", "Kata benda"]
JN = {"Isim dhamir": "dhamir", "Isim isyarah": "isyarah", "Isim maushul": "maushul", "Isim istifham": "istifham",
      "Isim 'alam": "'alam", "Shighah mubalaghah": "Asmaul Husna", "Isim": "isim", "Masdar": "masdar", "Zharaf zaman": "waktu",
      "Zharaf makan": "tempat", "Isim fa'il": "fa'il", "Isim maf'ul": "maf'ul", "Shifah musyabbahah": "musyabbahah",
      "Isim tafdhil": "tafdhil"}
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
        key = ISIM_GROUP.get(x["jenis"][0], "Kata benda") if k == "i" else x["jenis"][0]
        g.setdefault(key, []).append(x)
    if k == "i":
        keys = [j for j in ISIM_ORDER if j in g] + [j for j in g if j not in ISIM_ORDER]
    else:
        keys = sorted(g, key=lambda j: -sum(x["n"] for x in g[j]))
    out += [f"## {name} {ar} ({len(xs)} kata · {pct(xs)}%)", ""]
    for j in keys:
        ys = g[j]
        if k == "i":  # di dalam kelompok: per jenis (urutan JN), lalu dari yang paling sering
            ys = sorted(ys, key=lambda x: (list(JN).index(x["jenis"][0]) if x["jenis"][0] in JN else 99, x["id"]))
        if k == "i":
            ar_j, note = ISIM_NOTE[j]
            head = [f"### {j} ({len(ys)} kata · {pct(ys)}%)", "", f"{ar_j} — {note}", ""]
        else:
            head = [f"### {j} {ys[0]['jenis'][1]} ({len(ys)} kata · {pct(ys)}%)", ""]
        out += head + ["| No. | Kata | Arti | Jenis | × |" if k == "i" else "| No. | Kata | Arti | × |",
                       "|---|---|---|---|---|" if k == "i" else "|---|---|---|---|"]
        for x in ys:
            w = x["ar"] + ("ـ" if x.get("menempel") else "")
            if x.get("mudhari"):
                w += " – " + x["mudhari"]
            jn = f" {JN.get(x['jenis'][0], x['jenis'][0])} |" if k == "i" else ""
            out.append(f"| {x['id'] + 1} | {w} | {'; '.join(x['mean'][:3])} |{jn} {str(f"{x['n']:,}").replace(",", ".")} |")
        out.append("")

os.makedirs(os.path.join(ROOT, "materi"), exist_ok=True)
path = os.path.join(ROOT, "materi", f"kata-{ni}-{nf}-{nh}.md")
open(path, "w").write("\n".join(out))
print(path, pct(ALL))
