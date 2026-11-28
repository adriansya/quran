# Sumber Data — Aplikasi Kosakata Al-Qur'an

Hasil pengecekan langsung (23 Nov 2026) terhadap tiga sumber utama.

## 1. Quran.com API v4 — teks & terjemah per kata

Base: `https://api.quran.com/api/v4` — publik, tanpa auth.

| Kebutuhan | Endpoint |
|---|---|
| Daftar surah (nama Indonesia) | `GET /chapters?language=id` |
| Ayat + kata per kata (Indonesia) | `GET /verses/by_chapter/{surah}?words=true&language=id&word_fields=text_uthmani,text_imlaei,location&translations=33&per_page=50&page=N` |
| Satu ayat | `GET /verses/by_key/{surah}:{ayat}?words=true&language=id&...` |
| Terjemah Kemenag satu surah utuh | `GET /quran/translations/33?chapter_number={surah}` |
| Daftar terjemahan | `GET /resources/translations` |

Contoh hasil kata per kata (QS 1:2, `language=id`):

```
1:2:1  ٱلْحَمْدُ        pujian           al-ḥamdu
1:2:2  لِلَّهِ          bagi Allah       lillahi
1:2:3  رَبِّ            Tuhan            rabbi
1:2:4  ٱلْعَـٰلَمِينَ    alam semesta     l-ʿālamīna
1:2:5  ٢               (2)              ← char_type_name = "end", abaikan
```

Field per kata: `id, position, location (s:a:k), text_uthmani, text_imlaei, translation.text,
transliteration.text, audio_url (wbw/001_002_001.mp3), page_number, line_number, char_type_name`.

Terjemahan Indonesia yang tersedia: **33 = Indonesian Islamic Affairs Ministry (Kemenag)**,
134 = King Fahad Quran Complex, 141 = The Sabiq Company.

**Batasan:** API v4 publik **tidak** menyediakan root/lemma per kata → ambil dari Quranic Corpus.

## 2. Quranic Arabic Corpus — morfologi (akar kata, lemma, POS)

- File: *Quranic Arabic Corpus morphology v0.4* (`quranic-corpus-morphology-0.4.txt`).
- Lisensi: **GNU GPL**, © Kais Dukes. Syarat: hanya boleh menyalin/mendistribusikan **verbatim**
  dan wajib menyertakan copyright notice. Konsekuensi: kode aplikasi yang membundel data ini
  sebaiknya ikut GPL, dan file asli disimpan apa adanya (hasil olahan dibuat terpisah).
- Unduh: form di `https://corpus.quran.com/download/` mewajibkan alamat email. File sudah diunduh ke
  `data/raw/quranic-corpus-morphology-0.4.txt` (128.276 segmen, 77.429 kata, cocok 100% dengan lokasi kata Quran.com).
- Format (TSV, satu baris per *segmen*): `LOCATION  FORM  TAG  FEATURES`
  - `LOCATION` = `(surah:ayat:kata:segmen)` → digabung ke kata Quran.com lewat `surah:ayat:kata`.
  - `FEATURES` berisi `STEM|POS:N|LEM:...|ROOT:...` dll., teks dalam transliterasi Buckwalter.
- Situs baru `qurancorpus.app` (repo `kaisdukes/quranic-corpus`, GPL-3.0) belum merilis data unduhan.

## 3. Kemenag RI — terjemah, tafsir, transliterasi

- Situs resmi `quran.kemenag.go.id` memakai API `https://web-api.qurankemenag.net` dengan endpoint
  `quran-surah`, `quran-surah/{n}`, `quran-ayah`, `quran-tafsir/{id}`.
  Akses langsung dari luar situs → **HTTP 403** (tidak untuk publik).
- Alternatif yang terbuka: **equran.id** (mencantumkan sumber "Al-Quran: Kemenag RI").
  - `GET https://equran.id/api/v2/surat/{n}` → `nomor, nama, namaLatin, jumlahAyat, tempatTurun,
    arti, deskripsi, audioFull, ayat[]` dengan ayat: `nomorAyat, teksArab, teksLatin, teksIndonesia, audio`.
  - `GET https://equran.id/api/v2/tafsir/{n}` → `tafsir[]: {ayat, teks}` (tafsir Kemenag).
- Terjemah Kemenag juga ada di Quran.com (resource 33), jadi itu jalur utama untuk terjemah ayat.

## Rencana penggabungan

```
Quran.com (kata + arti per kata ID + transliterasi + audio)
        └─ join by surah:ayat:kata ─ Quranic Corpus (root, lemma, POS)
Kemenag via Quran.com #33 / equran.id (terjemah ayat, transliterasi, tafsir)
```

Hasil: tabel `words` (±77.4 ribu kata), `lemmas`, `roots` → kosakata dikelompokkan per akar/lemma,
dengan frekuensi kemunculan dan contoh ayat beserta terjemah Kemenag.

## Normalisasi kata dasar (sharaf)

Lemma Quranic Arabic Corpus tidak selalu dalam bentuk kamus. `scripts/canon.py` menormalkannya:

| Jenis | Bentuk kamus | Contoh perbaikan |
|---|---|---|
| Fi'il | madhi, dhamir huwa, ma'lum | يُوقِنُ → أَيْقَنَ · بُشِّرَ → بَشَّرَ · عَقَلُوا → عَقَلَ |
| Isim jamak salim | mufrad | كَافِرُون → كَافِر · مُتَّقِين → مُتَّقٍ · صَالِحَات → صَالِح |
| Isim jamak taksir | mufrad | أَصْحَاب → صَاحِب · أَلْبَاب → لُبّ · رِجَال → رَجُل |
| Muannats sifat/isim fa'il/maf'ul | mudzakkar | وَاحِدَة → وَاحِد · مُؤْمِنَة → مُؤْمِن |

- Fi'il: jika bentuk madhi huwa ma'lum tertulis di Al-Qur'an, bentuk itu dipakai. Jika tidak, dibentuk dari
  akar + wazan oleh `scripts/morph.py` (bentuk I–X, mu'tal, mudha'af, mahmuz). Harakat 'ain bentuk I diambil
  dari kemunculan madhi, mudhari'/amr, atau tetapan kamus (`VERB_VOWEL`). Divalidasi terhadap 558 fi'il yang
  madhi-nya tertulis: 91% cocok persis, sisanya beda rasm saja.
- Isim jamak taksir dipetakan manual ke mufradnya (`BROKEN`); isim jamak tanpa mufrad dari lafaznya
  (نَاس، نِسَاء، أَبَابِيل) tetap berdiri sendiri dengan catatan (`PLURAL_ONLY`).
- Homograf (tulisan sama, kata berbeda) tetap dipisah: beda jenis kata (أَعْلَى fi'il / isim tafdhil) atau
  beda makna yang ditandai Corpus (صَالِح / Nabi Saleh).
- Info per kata: wazan & mudhari' (fi'il); bentuk jamak + jenisnya (mudzakkar salim, muannats salim,
  taksir + wazan) & muannats (isim) — semuanya diambil dari kemunculan di Al-Qur'an.
- Nomor kata berubah tiap versi; `web/data/remap-v1.json`, `remap-v2.json` memindahkan progres pengguna.

## Bentuk kamus (marfu' nakirah) & jenis kata

- Isim ditulis marfu' nakirah seperti kamus (`scripts/naw.py`): munsarif bertanwin (كِتَابٌ، رَبٌّ),
  ghairu munsharif berdhammah (إِبْرَاهِيمُ، أَكْبَرُ، عُلَمَاءُ، ذِكْرَى), manqush/maqshur (مُتَّقٍ، هُدًى، نَوَاصٍ).
  Penentuan: bukti di Al-Qur'an dulu (bentuk bertanwin = munsarif; 'alam majrur berfathah = mamnu'),
  lalu kaidah: أَفْعَل sifat/tafdhil, فَعْلَان sifat, alif ta'nith mamdudah/maqshurah, shighah muntahal jumu',
  'alam 'ajam/muannats. Isim mabni (dhamir, isyarah, maushul, zharaf) tidak diberi akhiran.
- Jenis kata memakai istilah Arab + padanan Indonesia: fi'il tsulatsi mujarrad/mazid, ruba'i, naqish, jamid;
  isim fa'il, maf'ul, masdar, tafdhil, shifah musyabbahah, shighah mubalaghah, isim makan/zaman, alat, nisbah,
  'adad, 'alam, dhamir, isyarah, maushul, zharaf; harf jar, 'athf, nafy, nashb, mashdari, syarth, dst.
- Nomor kata v3 -> v4 dipetakan lewat lokasi tiap kata di Al-Qur'an (`remap-v3.json`).


## Huruf yang menempel

Awalan dari Corpus (`PREFIX|w:CONJ+`, `bi+`, `l:P+`, `sa+` dan seterusnya) dijadikan 12 kartu harf tersendiri (lihat `PREFIX` di `scripts/build_data.py`): وَ dan فَ masing-masing satu kartu untuk semua fungsinya; لِ jar, لَ taukid dan لِ amr dipisah. `Al+` (اَلْ) tidak dijadikan kartu. Kemunculannya ditambahkan ke `occ.json` pada lokasi kata yang ditempelinya, sehingga total satuan = 77.429 + 20.293 = 97.722.
