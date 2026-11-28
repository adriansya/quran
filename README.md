# Kosakata Al-Qur'an

Web app untuk belajar kosakata Al-Qur'an dari kata yang paling sering muncul.
**300 kata dasar teratas mencakup ±79% Al-Qur'an**, dan 1.000 kata dasar ±92%. Hitungannya memakai 97.722 satuan: 77.429 kata ditambah 20.293 huruf yang menempel (وَ، فَ، بِ، لِ، لَ، كَ، سَ، أَ، يَا …), karena huruf-huruf itu juga dijadikan kartu. اَلْ (penanda ma'rifat) tidak dihitung.

Fitur:
- **Latihan (SRS ala Anki)**: soal pilihan ganda A–D, lalu nilai sendiri Lagi/Sulit/Baik/Mudah. Kartu baru melewati langkah 1 dan 10 menit, lalu jaraknya dikali faktor kemudahan. Kata baru bisa diambil dari kata yang **paling sering** muncul atau **urut mushaf** per juz/halaman, dan bisa difilter Fi'il/Isim/Harf. Setiap jawaban menampilkan arti, kata dasar, akar, dan konteks ayat dengan terjemah Kemenag. Ada juga latihan kata yang sering lupa, kuis cepat, dan pintasan keyboard.
- **Gamifikasi**: streak harian, target harian, lencana pencapaian, dan "% kata Al-Qur'an yang kamu pahami", total maupun per juz.
- **Statistik**: aktivitas 30 hari, jadwal ulangan, pemahaman per juz, serta cadangan dan pemulihan progres (file JSON).
- **Kosakata**: 4.871 kata dasar (lemma) diurutkan berdasarkan frekuensi, dengan pencarian Arab/latin/arti.
- **Detail kata, akar kata, dan baca surah** kata per kata (arti Indonesia, transliterasi, terjemah Kemenag).

Mesin latihan diadaptasi dari aplikasi latihan kosakata juz 1–2 (artifact "Kosakata Al-Qur'an").
Progres tersimpan di browser (localStorage).

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
