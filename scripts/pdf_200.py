"""Membuat materi "200 Kata Kunci Al-Qur'an" (HTML siap cetak -> PDF).

    python3 pdf_200.py [FONTDIR]   ->  materi/200-kata-kunci.html
Lalu cetak ke PDF dengan Chromium (lihat materi/render.js).
"""
import base64, collections, html, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "materi", "fonts")
L = json.load(open(os.path.join(ROOT, "web", "data", "lemmas.json")))
TOTAL = 97722  # semua kata + huruf menempel (tanpa ال)
N = 200
A = L[:N]
esc = html.escape


def pct(xs):
    return sum(x["n"] for x in xs) / TOTAL * 100


def fmt(p):
    return f"{p:.1f}".replace(".", ",")


def font(name, file, weight=400):
    p = os.path.join(FONTS, file)
    b = base64.b64encode(open(p, "rb").read()).decode()
    return f"@font-face{{font-family:'{name}';src:url(data:font/woff2;base64,{b}) format('woff2');font-weight:{weight}}}"


# ---------- pengelompokan ----------
CLASS = [("h", "Harf", "حَرْفٌ", "kata tugas: kata depan, kata sambung, dll."),
         ("i", "Isim", "اسْمٌ", "kata benda, kata ganti, nama, sifat"),
         ("f", "Fi'il", "فِعْلٌ", "kata kerja (madhi – mudhari')")]
ISIM_ORDER = ["Isim 'alam", "Shighah mubalaghah", "Isim dhamir", "Isim isyarah", "Isim maushul", "Zharaf zaman",
              "Zharaf makan", "Isim fa'il", "Masdar", "Shifah musyabbahah", "Isim tafdhil", "Isim"]
ISIM_LABEL = {"Isim": "Isim umum (kata benda)", "Shighah mubalaghah": "Shighah mubalaghah (Asmaul Husna)"}


def groups(k):
    xs = [x for x in A if x["k"] == k]
    g = collections.OrderedDict()
    for x in xs:
        g.setdefault(x["jenis"][0], []).append(x)
    if k == "i":
        keys = [j for j in ISIM_ORDER if j in g] + [j for j in g if j not in ISIM_ORDER]
    else:  # urut dari kelompok yang paling sering muncul
        keys = sorted(g, key=lambda j: -sum(x["n"] for x in g[j]))
    return [(j, g[j]) for j in keys]


def row(x):
    ar = x["ar"]
    if x.get("mudhari"):
        ar = f'{x["ar"]} <span class="mu">– {x["mudhari"]}</span>'
    elif x.get("menempel"):
        ar = f'{x["ar"]}<span class="dash">ـ</span>'
    mean = "; ".join(x["mean"][:3])
    return (f'<tr><td class="no">{x["id"] + 1}</td><td class="a" dir="rtl" lang="ar">{ar}</td>'
            f'<td class="m">{esc(mean)}</td><td class="n">{x["n"]:,}×</td></tr>').replace(",", ".")


def section(k, name, arname, desc):
    xs = [x for x in A if x["k"] == k]
    out = [f'<section class="cls cls-{k}"><header class="ch"><div><span class="arh" lang="ar">{arname}</span>'
           f'<h2>{name} <small>{len(xs)} kata</small></h2><p>{desc}</p></div>'
           f'<div class="cp"><b>{fmt(pct(xs))}%</b><span>dari seluruh kata<br>Al-Qur\'an</span></div></header>']
    for j, ys in groups(k):
        label = ISIM_LABEL.get(j, j)
        ar = ys[0]["jenis"][1]
        out.append(f'<div class="grp{" small" if len(ys) <= 10 else ""}"><h3>{esc(label)} <span lang="ar">{ar}</span><em>{len(ys)} kata · {fmt(pct(ys))}%</em></h3>'
                   f'<table>{"".join(row(y) for y in ys)}</table></div>')
    out.append("</section>")
    return "".join(out)


steps = [(n, pct(L[:n])) for n in (50, 100, 150, 200)]
cnt = collections.Counter(x["k"] for x in A)
pfx = [x for x in A if x.get("menempel")]

bars = "".join(f'<div class="st{" main" if n == N else ""}"><div class="bar"><i style="height:{p:.1f}%"></i></div>'
               f'<b>{fmt(p)}%</b><span>{n} kata</span></div>' for n, p in steps)

CSS = (font("AmiriQ", "amiriq.woff2") + font("Amiri", "amiri-400.woff2") + font("Amiri", "amiri-700.woff2", 700)) + """
@page{size:A4;margin:14mm 13mm 16mm}
*{box-sizing:border-box}
:root{--text:#141a2e;--muted:#5a6276;--line:#e1e5ee;--accent:#2a4a9b;--soft:#e7edfb;--gold:#a57a24;--goldsoft:#f8f0de;--paper:#fff}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--paper);color:var(--text);font:10pt/1.45 Inter,"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif}
[lang=ar],.a{font-family:AmiriQ,Amiri,serif}
.cover{height:265mm;display:flex;flex-direction:column;page-break-after:always;padding:6mm 4mm 0}
.brand{display:flex;align-items:center;gap:8px;color:var(--muted);font-weight:600;letter-spacing:.02em}
.brand span{font-family:AmiriQ,serif;color:var(--accent);font-size:20pt;line-height:1}
.kick{margin:22mm 0 0;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:.14em;font-size:9pt}
h1{font-size:34pt;line-height:1.08;margin:4mm 0 0;letter-spacing:-.02em}
.big{display:flex;align-items:flex-end;gap:7mm;margin:12mm 0 0}
.big b{font-size:88pt;line-height:.85;color:var(--accent);letter-spacing:-.04em}
.big span{font-size:14pt;color:var(--muted);padding-bottom:3mm;max-width:70mm;line-height:1.3}
.lead{font-size:11.5pt;max-width:150mm;margin:10mm 0 0;color:#2c3348}
.steps{display:flex;gap:6mm;margin:12mm 0 0;align-items:flex-end}
.st{width:24mm;text-align:center}
.st .bar{height:40mm;background:#f1f3f8;border-radius:4px;position:relative;overflow:hidden}
.st .bar i{position:absolute;left:0;right:0;bottom:0;background:#b8c6ea;border-radius:4px 4px 0 0}
.st.main .bar i{background:var(--accent)}
.st b{display:block;font-size:13pt;margin-top:2mm}.st span{color:var(--muted);font-size:9pt}
.st.main b{color:var(--accent)}
.mix{display:flex;gap:4mm;margin:12mm 0 0}
.mix div{flex:1;border:1px solid var(--line);border-radius:10px;padding:3.5mm 4mm}
.mix b{font-size:18pt;display:block}.mix span{color:var(--muted);font-size:9pt}
.mix [lang=ar]{float:right;font-size:16pt;color:var(--gold);line-height:1}
.foot{margin-top:auto;border-top:1px solid var(--line);padding-top:4mm;color:var(--muted);font-size:8.5pt;display:flex;justify-content:space-between;gap:8mm}
.how{page-break-after:always}
.how h2{font-size:17pt;margin:0 0 4mm}
.how ol{padding-left:5mm;margin:0}.how li{margin:0 0 3mm}
.how .box{background:var(--soft);border-radius:10px;padding:4mm 5mm;margin:6mm 0}
.how .box p{margin:0 0 2mm}.how .box p:last-child{margin:0}
.ex{display:flex;gap:4mm;margin:5mm 0}
.ex div{flex:1;border:1px solid var(--line);border-radius:10px;padding:3mm 4mm;text-align:center}
.ex [lang=ar]{font-size:22pt;display:block;line-height:1.6}
.ex .p{color:var(--accent);font-weight:700}.ex small{color:var(--muted)}
.cls{page-break-before:always}
.cls:first-of-type{page-break-before:auto}
.ch{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid var(--accent);padding-bottom:3mm;margin-bottom:4mm}
.ch h2{margin:0;font-size:20pt}.ch h2 small{font-size:10pt;color:var(--muted);font-weight:500}
.ch p{margin:1mm 0 0;color:var(--muted)}
.arh{font-size:22pt;color:var(--gold);line-height:1.2;display:block}
.cp{text-align:right}.cp b{font-size:24pt;color:var(--accent);display:block;line-height:1}
.cp span{font-size:8pt;color:var(--muted)}
.grp{margin:0 0 5mm}.grp.small{break-inside:avoid-page}
h3{break-after:avoid}
h3{font-size:10.5pt;margin:0 0 1.5mm;display:flex;align-items:baseline;gap:3mm;color:var(--accent)}
h3 span{font-size:13pt;color:var(--gold);font-weight:400}
h3 em{margin-left:auto;font-style:normal;color:var(--muted);font-weight:500;font-size:8.5pt}
table{width:100%;border-collapse:collapse}
tr{break-inside:avoid}
td{border-top:1px solid var(--line);padding:.6mm 1.5mm;vertical-align:middle}
td.no{width:9mm;color:var(--muted);font-size:8pt;font-variant-numeric:tabular-nums}
td.a{width:34mm;font-size:15pt;line-height:1.35;padding-top:1.2mm;padding-bottom:1.2mm;text-align:right;white-space:nowrap}
.cls-f td.a{width:50mm}
td.a .mu{color:var(--muted);font-size:13pt}
td.a .dash{color:var(--muted)}
td.m{padding-left:5mm}
td.n{width:17mm;text-align:right;color:var(--muted);font-size:8.5pt;font-variant-numeric:tabular-nums}
.end{page-break-before:always;padding-top:20mm;text-align:center}
.end h2{font-size:20pt;margin:0 0 4mm}
.end p{max-width:135mm;margin:0 auto 3mm;color:#2c3348}
.end .url{display:inline-block;margin-top:6mm;background:var(--accent);color:#fff;padding:3mm 7mm;border-radius:999px;font-weight:700;text-decoration:none}
.end .ar{font-family:AmiriQ,serif;font-size:22pt;color:var(--gold);margin:14mm 0 2mm}
"""

ex = [x for x in A if x["bw"] in ("PFX:wa", "PFX:bi", "PFX:li")]
pfx_names = "، ".join(x["ar"] for x in pfx)

doc = f"""<!doctype html><html lang="id"><head><meta charset="utf-8"><title>200 Kata Kunci Al-Qur'an</title>
<style>{CSS}</style></head><body>
<div class="cover">
  <div class="brand"><span>كَلِمَة</span> Kosakata Al-Qur'an</div>
  <div class="kick">Materi gratis · daftar kata</div>
  <h1>200 Kata Kunci<br>Al-Qur'an</h1>
  <div class="big"><b>{round(pct(A))}%</b><span>dari seluruh kata dalam Al-Qur'an tersusun dari 200 kata ini</span></div>
  <p class="lead">Al-Qur'an berisi lebih dari 77 ribu kata, tetapi sebagian besarnya adalah pengulangan dari
  kata-kata yang sama. Daftar ini memuat <b>200 kata dasar yang paling sering muncul</b>, dikelompokkan per jenis
  supaya mudah dihafal.</p>
  <div class="steps">{bars}</div>
  <div class="mix">
    <div><span lang="ar">اسْمٌ</span><b>{cnt['i']}</b><span>Isim</span></div>
    <div><span lang="ar">فِعْلٌ</span><b>{cnt['f']}</b><span>Fi'il</span></div>
    <div><span lang="ar">حَرْفٌ</span><b>{cnt['h']}</b><span>Harf</span></div>
  </div>
  <div class="foot"><span>Data: Quranic Arabic Corpus, dihitung per kata dasar (lemma).</span><span>adriansya.github.io/quran</span></div>
</div>

<div class="how">
  <h2>Cara membaca daftar ini</h2>
  <ol>
    <li><b>Satu baris = satu kata dasar.</b> Semua bentuk turunannya ikut dihitung. Misalnya, قَالَ juga mencakup
    يَقُولُ، قَالُوا، قُلْ.</li>
    <li><b>Nomor</b> di kiri adalah peringkat dari kata yang paling sering muncul. <b>Angka ×</b> di kanan adalah
    jumlah kemunculannya di seluruh Al-Qur'an.</li>
    <li><b>Fi'il</b> ditulis dua bentuk: madhi (lampau) – mudhari' (sekarang/akan datang). <b>Isim</b> ditulis
    dalam bentuk tunggal (mufrad).</li>
    <li>Persentase dihitung dari <b>{TOTAL:,} satuan kata</b>: semua kata Al-Qur'an ditambah huruf yang menempel
    di depan kata (seperti {pfx_names}). Alif-lam (ال) tidak dihitung sebagai kata tersendiri.</li>
  </ol>
  <div class="box">
    <p><b>Kenapa huruf menempel dihitung?</b> Dalam tulisan Arab, beberapa huruf ditulis menyatu dengan kata
    sesudahnya. Padahal masing-masing punya arti sendiri dan sangat sering muncul.</p>
  </div>
  <div class="ex">
    {"".join(f'<div><span lang="ar">{x["form"]}</span><span class="p" lang="ar">{x["ar"]}</span> = {esc(x["mean"][0])}<br><small>{x["n"]:,}× di Al-Qur&#39;an</small></div>'.replace(",", ".") for x in ex)}
  </div>
  <div class="box">
    <p><b>Saran menghafal:</b> 10–15 kata baru per hari, lalu ulangi kata lama secara berkala. Dengan ritme ini,
    200 kata selesai dalam 2–3 minggu.</p>
    <p>Aplikasi gratis <b>adriansya.github.io/quran</b> mengatur jadwal pengulangannya otomatis dan menampilkan
    contoh ayat untuk setiap kata.</p>
  </div>
</div>

{"".join(section(*c) for c in CLASS)}

<div class="end">
  <div class="ar">وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ</div>
  <p style="color:var(--muted)">"Dan sungguh, telah Kami mudahkan Al-Qur'an untuk peringatan." (Al-Qamar: 17)</p>
  <h2>Lanjutkan ke 300, 500, dan 1.000 kata</h2>
  <p>200 kata ini adalah awal. 300 kata mencakup {fmt(pct(L[:300]))}%, 500 kata {fmt(pct(L[:500]))}%, dan 1.000 kata
  {fmt(pct(L[:1000]))}% dari seluruh kata Al-Qur'an.</p>
  <p>Latihan kartu, jadwal pengulangan, dan contoh ayat untuk setiap kata tersedia gratis di aplikasinya.</p>
  <a class="url" href="https://adriansya.github.io/quran/">adriansya.github.io/quran</a>
</div>
</body></html>"""

os.makedirs(os.path.join(ROOT, "materi"), exist_ok=True)
out = os.path.join(ROOT, "materi", "200-kata-kunci.html")
open(out, "w").write(doc)
print(out, f"{fmt(pct(A))}%", dict(cnt), [(n, fmt(p)) for n, p in steps])
