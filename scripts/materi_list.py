"""Daftar kata materi per jenjang, dikelompokkan per kelas & jenis kata (bahasa Indonesia).

    python3 materi_list.py ISIM FIIL HARF [JUDUL] [+bw,+bw ...]
    contoh: python3 materi_list.py 91 30 30 "Jenjang 70%" +hal,+kayof,...  ->  materi/kata-90-30-30.md
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


# Kelompok berdasarkan jenis kata dalam bahasa Indonesia (bukan istilah nahwu).
# Urutan di sini = urutan tampil. Nilai: (nama kelompok, contoh arti).
GROUPS = {
    "h": [("Kata sambung", "dan, lalu, atau, bahkan, bahwa, kecuali, agar"), ("Kata depan", "dari, di, ke, untuk, dengan"),
          ("Kata keterangan", "sungguh, telah, tidak, belum, akan"),
          ("Kata tanya, syarat & seru", "apakah, bagaimana, jika, seandainya, wahai")],
    "i": [("Kata ganti orang", "dia, kamu, kami, mereka"), ("Kata tunjuk", "ini, itu"),
          ("Kata penghubung", "yang, siapa, apa"), ("Nama", "Allah, nama nabi, dll."),
          ("Sifat-sifat Allah", "Maha …"), ("Keterangan waktu", "ketika, sebelum, sesudah"),
          ("Keterangan tempat", "antara, di sisi, bersama"), ("Kata sifat", "baik, besar, pertama, lebih …"),
          ("Kata jumlah", "setiap, sebagian, selain"), ("Kata seru", "wahai"),
          ("Kata benda: orang & makhluk", "Tuhan, rasul, manusia, hamba"),
          ("Kata benda: benda & hal", "bumi, hari, kitab, rahmat")],
    "f": [("Kata kerja", "berkata, mengetahui, menjadikan"), ("Kata kerja bantu", "adalah, bukan")],
}
BY_JENIS = {
    "Harf 'athf": "Kata sambung", "Harf idhrab": "Kata sambung", "Harf mashdari": "Kata sambung",
    "Adat istitsna'": "Kata sambung", "Harf istidrak": "Kata sambung", "Harf tafshil": "Kata sambung",
    "Harf jar": "Kata depan", "Harf taukid": "Kata keterangan", "Harf tahqiq": "Kata keterangan",
    "Harf nafy": "Kata keterangan", "Harf jazm": "Kata keterangan", "Harf istifham": "Kata tanya, syarat & seru",
    "Adat syarth": "Kata tanya, syarat & seru",
    "Harf nida'": "Kata tanya, syarat & seru", "Harf istiqbal": "Kata keterangan",
    "Isim dhamir": "Kata ganti orang", "Isim isyarah": "Kata tunjuk", "Isim maushul": "Kata penghubung",
    "Isim istifham": "Kata tanya, syarat & seru", "Isim 'alam": "Nama", "Shighah mubalaghah": "Sifat-sifat Allah",
    "Zharaf zaman": "Keterangan waktu", "Zharaf makan": "Keterangan tempat",
    "Isim tafdhil": "Kata sifat", "Fi'il naqish": "Kata kerja bantu",
}
BY_BW = {  # pengecualian per kata
    "<in~": "Kata keterangan", "baSiyr": "Sifat-sifat Allah", ">an~": "Kata sambung", "laEal~": "Kata sambung",
    "Sa`liH": "Kata sifat", "m~ubiyn": "Kata sifat", "EaZiym": "Kata sifat", "xayor": "Kata sifat", "A^xir": "Kata sifat",
    "kul~": "Kata jumlah", "baEoD": "Kata jumlah", "gayor": "Kata jumlah", ">ay~uhaA": "Kata seru",
    "rab~": "Kata benda: orang & makhluk", "qawom": "Kata benda: orang & makhluk", "rasuwl": "Kata benda: orang & makhluk",
    "n~aAs": "Kata benda: orang & makhluk", "mu&omin": "Kata benda: orang & makhluk", "kaAfir": "Kata benda: orang & makhluk",
    "ZaAlim": "Kata benda: orang & makhluk", "<ila`h": "Kata benda: orang & makhluk", "{bon": "Kata benda: orang & makhluk",
    "Eabod": "Kata benda: orang & makhluk", ">ahol": "Kata benda: orang & makhluk", ">abN": "Kata benda: orang & makhluk",
    "SaY`Hib": "Kata benda: orang & makhluk", "malak": "Kata benda: orang & makhluk", "waliY~": "Kata benda: orang & makhluk",
    ">ax": "Kata benda: orang & makhluk", "*uw": "Kata benda: orang & makhluk", "nafos": "Kata benda: orang & makhluk",
}


NOTE = {
    "Kata kerja": "Ditulis madhi – mudhari'. Satu kata kerja mewakili **semua bentuknya**: madhi (lampau), "
                  "mudhari' (sekarang/akan datang), dan amr (perintah), termasuk perubahan untuk dia/kamu/mereka. "
                  "Jumlah kemunculan (×) sudah menghitung semuanya. Contoh: قَالَ mencakup قَالُوا، يَقُولُ، "
                  "نَقُولُ، قُلْ، قُولُوا.",
    "Kata kerja bantu": "Sama seperti kata kerja: كَانَ mencakup يَكُونُ، كَانُوا، كُنْ, dan seterusnya.",
    "Kata ganti orang": "Setiap kata ganti punya dua bentuk dengan arti sama: **terpisah** (berdiri sendiri) dan "
                        "**bersambung** (menempel di akhir kata, ditandai ـ). هُمْ ditulis sama dalam kedua bentuk, "
                        "jadi dihitung satu kata.",
}
# kata ganti orang: (orang, kunci terpisah, kunci bersambung, contoh bersambung)
PRON_PAIRS = [("dia (laki-laki)", "PRON:hw", "PRON:h", "لَهُ (baginya)"),
              ("dia (perempuan)", "PRON:hy", "PRON:hA", "بِهَا (dengannya)"),
              ("mereka", "PRON:hm", "PRON:hm", "لَهُمْ (bagi mereka)"),
              ("kamu", "PRON:>nt", "PRON:k", "رَبُّكَ (Tuhanmu)"),
              ("kalian", "PRON:>ntm", "PRON:km", "لَكُمْ (bagi kalian)"),
              ("aku", "PRON:>nA", "PRON:y", "لِي (bagiku)"),
              ("kami", "PRON:nHn", "PRON:nA", "رَبَّنَا (Tuhan kami)")]


def num(n):
    return f"{n:,}".replace(",", ".")


def pron_table(ys):
    have = {x["bw"]: x for x in ys}
    rows = ["| Orang | Terpisah | Bersambung | Contoh | × |", "|---|---|---|---|---|"]
    used = set()
    for orang, a, b, contoh in PRON_PAIRS:
        if a not in have and b not in have:
            continue
        ta = have[a]["ar"] if a in have else "—"
        tb = "ـ" + have[b]["ar"] if b in have else "—"
        n = num(have[a]["n"]) if a == b else " · ".join(num(have[k]["n"]) for k in (a, b) if k in have)
        rows.append(f"| {orang} | {ta} | {tb} | {contoh} | {n} |")
        used |= {a, b}
    rest = [x for x in ys if x["bw"] not in used]
    assert not rest, [x["bw"] for x in rest]
    return rows


def group_of(x):
    if x["bw"] in BY_BW:
        return BY_BW[x["bw"]]
    if x["jenis"][0] in BY_JENIS:
        return BY_JENIS[x["jenis"][0]]
    return {"h": "Kata sambung", "i": "Kata benda: benda & hal", "f": "Kata kerja"}[x["k"]]


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
    g = collections.defaultdict(list)
    for x in xs:
        g[group_of(x)].append(x)
    out += [f"## {name} {ar} ({len(xs)} kata · {pct(xs)}%)", ""]
    for j, contoh in GROUPS[k]:
        ys = g.pop(j, [])
        if not ys:
            continue
        out += [f"### {j} ({len(ys)} kata · {pct(ys)}%)", "", f"_{contoh}_", ""]
        if j in NOTE:
            out += [NOTE[j], ""]
        if j == "Kata ganti orang":
            out += pron_table(ys) + [""]
            continue
        out += ["| No. | Kata | Arti | × |", "|---|---|---|---|"]
        for x in ys:
            w = x["ar"] + ("ـ" if x.get("menempel") else "")
            if x.get("mudhari"):
                w += " – " + x["mudhari"]
            out.append(f"| {x['id'] + 1} | {w} | {'; '.join(x['mean'][:3])} | {str(f"{x['n']:,}").replace(",", ".")} |")
        out.append("")
    assert not g, f"kelompok tak terdaftar: {list(g)}"

os.makedirs(os.path.join(ROOT, "materi"), exist_ok=True)
path = os.path.join(ROOT, "materi", f"kata-{ni}-{nf}-{nh}.md")
open(path, "w").write("\n".join(out))
print(path, pct(ALL))
