# Kosakata Al-Qur'an

Web app untuk belajar kosakata Al-Qur'an dari kata yang paling sering muncul.
**300 lemma teratas mencakup ±74% dari 77.429 kata Al-Qur'an**, dan 1.000 lemma mencakup ±89%.

Fitur:
- **Kosakata**: 4.871 lemma diurutkan berdasarkan frekuensi. Bisa dicari lewat arti, latin, atau huruf Arab, dan difilter per jenis kata atau status hafalan.
- **Detail kata**: arti, jenis kata, bentuk kata kerja (I–XII), akar, kata-kata seakar, dan semua ayat tempat kata itu muncul (disorot) beserta terjemah Kemenag.
- **Akar kata**: 1.642 akar beserta rumpun katanya.
- **Baca surah**: 114 surah kata per kata (arti Indonesia + transliterasi) dan terjemah Kemenag per ayat. Ketuk kata untuk membuka detailnya.
- **Latihan**: flashcard dengan pengulangan berjarak dan kuis pilihan ganda. Progres ditampilkan sebagai persentase kata Al-Qur'an yang sudah dikuasai. Progres disimpan di browser (localStorage).

## Menjalankan

```bash
cd web && python3 -m http.server 8000
```

Buka http://localhost:8000. Folder `web/` berisi situs statis yang siap di-host di GitHub Pages atau Netlify.

## Membangun ulang data

```bash
python3 scripts/fetch_qurancom.py   # unduh data Quran.com ke data/raw/qurancom/
python3 scripts/build_data.py       # gabungkan dengan Corpus menjadi web/data/
```

Lihat [docs/SUMBER-DATA.md](docs/SUMBER-DATA.md) untuk endpoint, format, dan catatan lisensi.

## Sumber & lisensi data

- **Quran.com API v4**: teks Utsmani, arti per kata bahasa Indonesia, transliterasi, dan terjemah Kemenag RI (resource 33).
- **Quranic Arabic Corpus v0.4** © 2011 Kais Dukes, GNU GPL: akar, lemma, dan jenis kata.
  File `data/raw/quranic-corpus-morphology-0.4.txt` disimpan verbatim sesuai syarat penggunaannya.
  Karena data turunannya dibundel, aplikasi ini sebaiknya dirilis di bawah GPL.
- Teks Al-Qur'an berbasis Tanzil.
