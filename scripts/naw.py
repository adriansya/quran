"""Jenis kata (anwa' al-kalimah) dengan istilah Arab + padanan Indonesia, dan
penentuan munsarif / mamnu' minash sharf untuk menulis isim dalam bentuk marfu' nakirah.
"""
import re

# kode -> (istilah latin, istilah Arab, padanan Indonesia)
TERMS = {
    # isim
    "alam": ("Isim 'alam", "اسْمُ عَلَمٍ", "nama diri"),
    "dhamir": ("Isim dhamir", "ضَمِيرٌ", "kata ganti"),
    "isyarah": ("Isim isyarah", "اسْمُ إِشَارَةٍ", "kata tunjuk"),
    "maushul": ("Isim maushul", "اسْمٌ مَوْصُولٌ", "kata ganti penghubung"),
    "zharaf_zaman": ("Zharaf zaman", "ظَرْفُ زَمَانٍ", "keterangan waktu"),
    "zharaf_makan": ("Zharaf makan", "ظَرْفُ مَكَانٍ", "keterangan tempat"),
    "istifham_isim": ("Isim istifham", "اسْمُ اسْتِفْهَامٍ", "kata tanya"),
    "masdar": ("Masdar", "مَصْدَرٌ", "kata dasar perbuatan"),
    "masdar_mimi": ("Masdar mimi", "مَصْدَرٌ مِيمِيٌّ", "kata dasar perbuatan berawalan mim"),
    "fail": ("Isim fa'il", "اسْمُ فَاعِلٍ", "pelaku"),
    "maful": ("Isim maf'ul", "اسْمُ مَفْعُولٍ", "yang dikenai perbuatan"),
    "tafdhil": ("Isim tafdhil", "اسْمُ تَفْضِيلٍ", "lebih/paling"),
    "musyabbahah": ("Shifah musyabbahah", "صِفَةٌ مُشَبَّهَةٌ", "kata sifat tetap"),
    "mubalaghah": ("Shighah mubalaghah", "صِيغَةُ مُبَالَغَةٍ", "sifat yang sangat"),
    "makan": ("Isim makan", "اسْمُ مَكَانٍ", "kata benda tempat"),
    "zaman": ("Isim zaman", "اسْمُ زَمَانٍ", "kata benda waktu"),
    "alat": ("Isim alat", "اسْمُ آلَةٍ", "alat"),
    "nisbah": ("Isim nisbah", "اسْمٌ مَنْسُوبٌ", "kata sifat penisbatan"),
    "tasghir": ("Isim tasghir", "اسْمُ تَصْغِيرٍ", "bentuk pengecilan"),
    "jamak": ("Isim jamak", "اسْمُ جَمْعٍ", "kata benda jamak"),
    "fil_isim": ("Isim fi'l", "اسْمُ فِعْلٍ", "kata benda bermakna perintah"),
    "adad": ("Isim 'adad", "اسْمُ عَدَدٍ", "bilangan"),
    "isim": ("Isim", "اسْمٌ", "kata benda"),
    # fi'il
    "f_mujarrad": ("Fi'il tsulatsi mujarrad", "فِعْلٌ ثُلَاثِيٌّ مُجَرَّدٌ", "kata kerja tiga huruf asli"),
    "f_mazid": ("Fi'il tsulatsi mazid", "فِعْلٌ ثُلَاثِيٌّ مَزِيدٌ", "kata kerja tiga huruf berimbuhan"),
    "f_rubai": ("Fi'il ruba'i", "فِعْلٌ رُبَاعِيٌّ", "kata kerja empat huruf"),
    "f_naqish": ("Fi'il naqish", "فِعْلٌ نَاقِصٌ", "kāna dan saudara-saudaranya"),
    "f_jamid": ("Fi'il jamid", "فِعْلٌ جَامِدٌ", "kata kerja tak berubah bentuk"),
    # harf
    "jar": ("Harf jar", "حَرْفُ جَرٍّ", "kata depan"),
    "athf": ("Harf 'athf", "حَرْفُ عَطْفٍ", "kata sambung"),
    "nafy": ("Harf nafy", "حَرْفُ نَفْيٍ", "kata pengingkar"),
    "nahy": ("Harf nahy", "حَرْفُ نَهْيٍ", "larangan"),
    "nashb": ("Harf nashb", "حَرْفُ نَصْبٍ", "inna dan saudara-saudaranya"),
    "mashdari": ("Harf mashdari", "حَرْفٌ مَصْدَرِيٌّ", "pembentuk masdar"),
    "syarth": ("Adat syarth", "أَدَاةُ شَرْطٍ", "kata syarat"),
    "istifham": ("Harf istifham", "حَرْفُ اسْتِفْهَامٍ", "kata tanya"),
    "istitsna": ("Adat istitsna'", "أَدَاةُ اسْتِثْنَاءٍ", "pengecualian"),
    "tahqiq": ("Harf tahqiq", "حَرْفُ تَحْقِيقٍ", "penegas (sungguh)"),
    "istiqbal": ("Harf istiqbal", "حَرْفُ اسْتِقْبَالٍ", "penanda masa depan"),
    "nida": ("Harf nida'", "حَرْفُ نِدَاءٍ", "panggilan"),
    "istiftah": ("Harf istiftah", "حَرْفُ اسْتِفْتَاحٍ", "pembuka/perhatian"),
    "jawab": ("Harf jawab", "حَرْفُ جَوَابٍ", "jawaban"),
    "istidrak": ("Harf istidrak", "حَرْفُ اسْتِدْرَاكٍ", "akan tetapi"),
    "idhrab": ("Harf idhrab", "حَرْفُ إِضْرَابٍ", "bahkan/melainkan"),
    "tahdhidh": ("Harf tahdhidh", "حَرْفُ تَحْضِيضٍ", "dorongan (mengapa tidak)"),
    "fujaah": ("Harf fuja'ah", "حَرْفُ فُجَاءَةٍ", "tiba-tiba"),
    "tafsir": ("Harf tafsir", "حَرْفُ تَفْسِيرٍ", "yaitu"),
    "rad": ("Harf rad'", "حَرْفُ رَدْعٍ", "sekali-kali tidak"),
    "zaid": ("Harf za'id", "حَرْفٌ زَائِدٌ", "tambahan penguat"),
    "tafshil": ("Harf tafshil", "حَرْفُ تَفْصِيلٍ", "adapun"),
    "kaffah": ("Ma kaffah", "مَا الْكَافَّةُ", "pencegah amal"),
    "taukid": ("Harf taukid", "حَرْفُ تَوْكِيدٍ", "penegas"),
    "tanbih": ("Harf tanbih", "حَرْفُ تَنْبِيهٍ", "penarik perhatian"),
    "jazm": ("Harf jazm", "حَرْفُ جَزْمٍ", "lam amr: hendaklah"),
    "muqathaah": ("Huruf muqaththa'ah", "الْحُرُوفُ الْمُقَطَّعَةُ", "huruf pembuka surah"),
    "harf": ("Harf", "حَرْفٌ", "partikel"),
}
KELAS = {"i": ("Isim", "اسْمٌ", "kata benda"), "f": ("Fi'il", "فِعْلٌ", "kata kerja"), "h": ("Harf", "حَرْفٌ", "partikel")}

POS_HARF = {
    "P": "jar", "CONJ": "athf", "SUB": "mashdari", "ACC": "nashb", "NEG": "nafy", "PRO": "nahy",
    "COND": "syarth", "INTG": "istifham", "RES": "istitsna", "EXP": "istitsna", "CERT": "tahqiq",
    "FUT": "istiqbal", "VOC": "nida", "INC": "istiftah", "ANS": "jawab", "AMD": "istidrak", "RET": "idhrab",
    "EXH": "tahdhidh", "SUR": "fujaah", "INT": "tafsir", "AVR": "rad", "SUP": "zaid", "EXL": "tafshil",
    "PREV": "kaffah", "EMPH": "taukid", "CAUS": "harf", "INL": "muqathaah", "IMPN": "fil_isim",
}
POS_ISIM = {"PN": "alam", "PRON": "dhamir", "DEM": "isyarah", "REL": "maushul", "T": "zharaf_zaman", "LOC": "zharaf_makan"}
# Kata tanya yang berupa isim (bukan harf هَل / أَ)
ISTIFHAM_ISIM = {"kayofa", ">ayona", "mataY`", "kam", ">an~aY`", ">ay~aAn", ">ay~", "maA", "man", "maA*aA"}
KANA = {"kaAna", ">aSobaHa", ">amosaY`", ">aDoHaY`", "Zal~a", "baAta", "SaAra", "laysa", "zaAla", "fati}a", "baraHa",
        "{nfak~a", "daAma"}
JAMID = {"laysa", "EasaY`", "niEoma", "bi}osa", "habo", "haAti", "hayota", "taEaAlaY`"}


def template(bw, root):
    """Ganti huruf akar dengan 1-2-3(-4) (mis. >aSoHaAb, SHb -> >a1o2aA3). None bila tak terbaca.
    w/y saling menggantikan; hamzah akar (A) cocok dengan semua kursinya; mudha'af: huruf bertasydid = 2 huruf akar."""
    if not root or len(root) not in (3, 4):
        return None
    bw = re.sub(r"^(.)~", r"\1", bw).replace("^", "").replace("Y`", "Y").replace("`", "A")
    out, ri = [], 0
    for i, c in enumerate(bw):
        r = root[ri] if ri < len(root) else None
        ok = r and c not in "aiuo~FNK`^" and (c == r or (r in "wy" and c in "wy") or (r == "A" and c in "'><&}|")
                                                or (r in "wy" and c == "Y" and ri == len(root) - 1))
        if ok:
            out.append(str(ri + 1))
            ri += 1
            # mudha'af: ضَرَّاء (Drr) -> huruf bertasydid mewakili huruf akar ke-2 dan ke-3
            if ri < len(root) and root[ri] == c and i + 1 < len(bw) and bw[i + 1] == "~":
                out.append(str(ri + 1))
                ri += 1
        else:
            out.append(c)
    return "".join(out) if ri == len(root) else None


COLOR_DEFECT = {"Hwy", "byD", "swd", "Hmr", "Sfr", "xDr", "zrq", "bkm", "Erj", "Emy", "kmh", "brS", "$yb", "Ejf", "Smm",
                "btr", "glf", "Ewr", "Erb", "xrs"}
# Zharaf: jenis (zaman/makan) + tulisan sesuai pemakaiannya (manshub 'ala azh-zharfiyyah, atau mabni).
ZHARAF = {
    # zharaf zaman
    "qabol": ("zharaf_zaman", "قَبْلَ"), "baEod": ("zharaf_zaman", "بَعْدَ"), "<i*aA": ("zharaf_zaman", "إِذَا"),
    "<i*": ("zharaf_zaman", "إِذْ"), "lam~aA": ("zharaf_zaman", "لَمَّا"), "yawoma}i*": ("zharaf_zaman", "يَوْمَئِذٍ"),
    ">abadFA": ("zharaf_zaman", "أَبَدًا"), "kul~amaA": ("zharaf_zaman", "كُلَّمَا"), "_#a`n": ("zharaf_zaman", "الْآنَ"),
    ">aSiyl": ("zharaf_zaman", "أَصِيلًا"), "bukorap": ("zharaf_zaman", "بُكْرَةً"), ">aHoqaAb": ("zharaf_zaman", "أَحْقَابًا"),
    # zharaf makan
    "bayon": ("zharaf_makan", "بَيْنَ"), "Eind": ("zharaf_makan", "عِنْدَ"), "maE": ("zharaf_makan", "مَعَ"),
    "waraA^'": ("zharaf_makan", "وَرَاءَ"), "laday": ("zharaf_makan", "لَدَى"), "ladaY": ("zharaf_makan", "لَدَى"),
    "$aTor": ("zharaf_makan", "شَطْرَ"), "qibal": ("zharaf_makan", "قِبَلَ"), "vam~": ("zharaf_makan", "ثَمَّ"),
    "hunaAlik": ("zharaf_makan", "هُنَالِكَ"), ">amaAm": ("zharaf_makan", "أَمَامَ"), "duwn": ("zharaf_makan", "دُونَ"),
    "taHot": ("zharaf_makan", "تَحْتَ"), "fawoq": ("zharaf_makan", "فَوْقَ"), "xalof": ("zharaf_makan", "خَلْفَ"),
    "Hawol": ("zharaf_makan", "حَوْلَ"), "tiloqaA^'": ("zharaf_makan", "تِلْقَاءَ"), "Hayov": ("zharaf_makan", "حَيْثُ"),
    "ladun": ("zharaf_makan", "لَدُنْ"),
}
ADAD_ROOTS = {"wHd", "Ahd", "vny", "vlv", "rbE", "xms", "sds", "stt", "sbE", "vmn", "tsE", "E$r", "mAy", "Alf"}
ALAT = {"miSobaAH", "mifotaH", "mikoyaAl", "miyzaAn", "miqomaE", "mivoqaAl"}
NOT_MAKAN = {"maEo$ar", "mayosir", "maroHab"}
# Wazan مَفْعَل/مَفْعِل: pembeda makan vs zaman vs masdar mimi adalah makna di ayatnya.
MAFAL = {
    "maTolaE": "zaman",      # حَتَّى مَطْلَعِ الْفَجْرِ
    "m~awoEid": "zaman",     # مَوْعِدُكُمْ يَوْمُ الزِّينَةِ
    "maholik": "zaman",      # لِمَهْلِكِهِمْ مَوْعِدًا
    "m~agoram": "masdar_mimi", "m~awoviq": "masdar_mimi", "mabolag": "masdar_mimi", "m~a$ohad": "masdar_mimi",
    "mawolaY`": "isim", "magonam": "isim", "manokib": "isim",
}


def classify(k, pos, root, feats, means, form, verb_vowel=None):
    """k: lemma kanonik (Buckwalter), pos: POS Corpus, feats: Counter fitur, means: daftar arti."""
    base = re.sub(r"\d+$", "", k.split(":", 1)[-1])
    if pos == "V":
        if base in JAMID:
            return "f_jamid"
        if base in KANA:
            return "f_naqish"
        if root and len(root) == 4:
            return "f_rubai"
        return "f_mujarrad" if form in (None, "I") else "f_mazid"
    if k in ZHARAF:  # persis (homograf bernomor seperti إِذَا fuja'iyyah / مَعَ harf jar tidak ikut)
        return ZHARAF[k][0]
    if pos == "INTG" and base in ISTIFHAM_ISIM:
        return "istifham_isim"
    if pos in POS_ISIM:
        return POS_ISIM[pos]
    if pos in POS_HARF:
        return POS_HARF[pos]
    if pos not in ("N", "ADJ"):
        return "harf"
    n = sum(feats.values()) or 1
    t = template(base, root) or ""
    if feats.get("VN", 0) >= 0.5 * feats.get("_n", 1):
        return "masdar_mimi" if re.match(r"^ma1o2", t) else "masdar"
    if feats.get("PCPL_ACT", 0) >= 0.5 * feats.get("_n", 1):
        return "fail"
    if feats.get("PCPL_PASS", 0) >= 0.5 * feats.get("_n", 1):
        return "maful"
    if root in ADAD_ROOTS and any(re.search(r"\b(satu|esa|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|"
                                              r"seratus|seribu|ribu|ratus|puluh|sepertiga|seperempat|seperenam|"
                                              r"seperdelapan|seperlima|sepersepuluh|berdua)", m, re.I) for m in means):
        return "adad"
    if base in (">atoqaY`", ">atoqaY"):
        return "tafdhil"  # أَتْقَى (و akar luluh menjadi ت)
    if re.fullmatch(r">a1o2a3|>a1a23~", t):
        # أَفْعَل = isim tafdhil, kecuali warna/cacat (shifah musyabbahah) dan أَجْمَع/أَيْمَن
        if root in COLOR_DEFECT or base in (">ajomaE", ">ayoman"):
            return "musyabbahah"
        return "tafdhil"
    if root in ADAD_ROOTS and any(re.search(r"\b(satu|esa|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|"
                                              r"seratus|seribu|ribu|ratus|puluh|sepertiga|seperempat|seperenam|"
                                              r"seperdelapan|seperlima|sepersepuluh|berdua)", m, re.I) for m in means):
        return "adad"
    if base.endswith("iy~") and len(base) > 4 and root and root[-1] not in "wy":
        return "nisbah"  # ya' nisbah bukan huruf akar (عَرَبِيّ، حَوَارِيّ)
    intens = pos == "ADJ" and any(re.match(r"(Maha|sangat|amat|banyak)", m, re.I) for m in means)
    if intens and re.fullmatch(r"1a2~aA3|1a2uw3|mi1o2aA3|1i2~iy3", t):
        return "mubalaghah"  # فَعَّال، فَعُول، مِفْعَال، فِعِّيل bermakna intensif
    # فَعِيل bermakna "Maha …" dari fi'il yang bukan فَعُلَ (عَلِيم، رَحِيم، سَمِيع): mubalaghah;
    # dari فَعُلَ (كَبِير، قَرِيب، كَرِيم): shifah musyabbahah
    if re.fullmatch(r"1a2iy3", t) and pos == "ADJ" and any(m.startswith("Maha") for m in means) and verb_vowel != "u":
        return "mubalaghah"
    if re.fullmatch(r"1u2ayo3", t):
        return "tasghir"
    if base in ALAT:
        return "alat"
    if base in MAFAL:
        return MAFAL[base]
    if re.fullmatch(r"ma1o2a3|ma1o2i3", t) and base not in NOT_MAKAN:
        return "makan"
    if pos == "ADJ":
        return "musyabbahah"
    return "isim"


# ---------------------------------------------------------------- munsarif / mamnu'
def _skel(ar):
    s = re.sub(r"[ً-ٰٟ]", "", ar)
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ٱ", "ا")):
        s = s.replace(a, b)
    return s


def smj(ar):
    """Shighah muntahal jumu': فَعَالِل/مَفَاعِل/مَفَاعِيل — huruf 1 & 2 berfathah, lalu alif, lalu huruf berkasrah
    (atau bertasydid: دَوَابّ). Bukan nisbah ـِيّ dan bukan masdar تَفَاعُل."""
    if ar.endswith("يّ") or ar.endswith("ة"):
        return False
    return bool(re.match(r"^[^\u064B-\u0652]\u064E[^\u064B-\u0652]\u0651?\u064E?ا[^\u064B-\u0652](\u0650|\u0651)", ar)) and len(_skel(ar)) >= 5


def mamnu_by_rule(ar, bw, root, kind, pos, pattern_only=False):
    """Kaidah ghairu munsharif bila tak ada bukti di Al-Qur'an."""
    t = template(re.sub(r"^(.)~", r"\1", re.sub(r"\d+$", "", bw)).replace("Y`", "Y").replace("`", "A").replace("^", ""), root) or ""
    if ar in MUNSARIF_EXTRA:
        return False
    if kind == "alam" and not pattern_only:
        return len(_skel(ar)) >= 4  # 'alam > 3 huruf: umumnya 'ajam/muannats/wazan fi'il (إِبْرَاهِيمُ، مَرْيَمُ)
    if re.fullmatch(r">a1o2a3|>a1a23~", t) and (pos == "ADJ" or kind in ("tafdhil", "musyabbahah")) and ar not in MUNSARIF_EXTRA:
        return True  # أَفْعَل sifat/tafdhil: أَكْثَرُ، أَبْيَضُ
    if re.fullmatch(r"1a2o3aAn", t) and (pos == "ADJ" or kind in ("musyabbahah", "mubalaghah") or ar in FALAN):
        return True  # فَعْلَان sifat (muannatsnya فَعْلَى): كَسْلَانُ، سَكْرَانُ، رَحْمٰنُ — bukan isim (مَرْجَانٌ)
    if re.search(r"3[^123]*aA'$", t):
        return True  # alif ta'nith mamdudah: semua huruf akar sebelum اء (فَعْلَاء، فُعَلَاء، أَفْعِلَاء)
    if re.search(r"3~?(aY|Y|aA)`?$", t):
        return True  # alif ta'nith maqshurah (semua huruf akar sebelum ى): فُعْلَى، ذِكْرَى، دُنْيَا
    if smj(ar) or ar in MAMNU_EXTRA:
        return True
    return False


MAMNU_EXTRA = {"أَشْيَاء", "أَتْقَى"}
MUNSARIF_EXTRA = {"أَرْبَع", "مَالِك"}  # أَرْبَعٌ: wazan أَفْعَل tapi isim (bilangan), munsarif
FALAN = {"كَسْلَان", "رَحْمٰن", "سَكْرَان", "غَضْبَان", "حَيْرَان"}
# Tulisan baku harf & isim mabni dengan harakat bina'-nya (Corpus tidak menulis harakat akhir).
MABNI_FORM = {
    # tulisan kamus yang tidak bisa diturunkan dari kaidah umum
    ">ay~uhaA": "أَيُّهَا", ">ay~atuhaA": "أَيَّتُهَا", "*uw": "ذُو", ">uwliY": "أُولُو", "kilaA": "كِلَا", "kilotaA": "كِلْتَا",
    ">aqoSaA": "أَقْصَى", "S~afaA": "الصَّفَا", "kita`biY": "كِتَابِيَهْ", "raA^d~iY": "رَادٌّ",
    "min": "مِنْ", "Ean": "عَنْ", "qad": "قَدْ", "lam": "لَمْ", "lan": "لَنْ", "bal": "بَلْ", "hal": "هَلْ",
    ">am": "أَمْ", "<in": "إِنْ", ">an": "أَنْ", "man": "مَنْ", "kam": "كَمْ", "naEam": "نَعَمْ",
    "la`kin": "لٰكِنْ", "<il~am": "إِلَّمْ", "<in~": "إِنَّ", ">an~": "أَنَّ", "vum~": "ثُمَّ",
    "laEal~": "لَعَلَّ", "la`kin~": "لٰكِنَّ", "ka>an~": "كَأَنَّ", "wayoka>an~": "وَيْكَأَنَّ",
    "kayof": "كَيْفَ", ">ayon": "أَيْنَ", ">ay~aAn": "أَيَّانَ", "sawof": "سَوْفَ", "layot": "لَيْتَ",
    ">aw": "أَوْ", "law": "لَوْ", "kaY": "كَيْ", "<iY": "إِيْ",
    "maE2": "مَعَ", "Hayov2": "حَيْثُ", "haA^&um": "هَاؤُمُ", "misaAs": "مِسَاسَ", ">aY~": "أَيٌّ",
}
MABNI = {"لَدُن", "لَدُنْ"}  # pengecualian masyhur (أَشْيَاءُ ghairu munsharif)
DAMMA, TANWIN_D, TANWIN_F, TANWIN_K, FATHA = "\u064F", "\u064C", "\u064B", "\u064D", "\u064E"


def marfu_ar(ar, munsarif, plural=False):
    """Tulis isim dalam bentuk marfu' nakirah (gaya kamus) langsung pada teks Arab."""
    if not ar or ar in MABNI or re.search(r"[\u064E\u064F\u0650]\u0651?$|\u0651[\u064E\u064F\u0650]$", ar):
        return ar  # mabni / sudah berharakat akhir (اللّٰهُمَّ، الْيَسَعَ، اثْنَانِ)
    if ar.endswith(TANWIN_K) or ar.endswith(TANWIN_F + "ى") or ar.endswith(TANWIN_F + "ا"):
        return ar  # مُتَّقٍ، هُدًى، عَصًا — sudah lengkap
    if ar.endswith("\u0652ى"):
        ar = ar[:-1] + "ي"  # ya' sesudah sukun adalah huruf, bukan alif maqshurah: خِزْيٌ، وَحْيٌ
    if ar.endswith("ى"):
        if not munsarif:
            return ar  # ذِكْرَى، الْعُزَّى
        return (ar[:-2] if ar[-2] == FATHA else ar[:-1]) + TANWIN_F + "ى"
    if ar.endswith("\u0650ي") and smj(ar):
        return ar[:-2] + TANWIN_K  # manqush ghairu munsharif: tanwin 'iwadh (نَوَاصٍ، ثَمَانٍ)
    if ar.endswith("\u0650ي") and munsarif and not plural:
        return ar[:-2] + TANWIN_K  # manqush nakirah: ya' dibuang, tanwin kasrah (وَادٍ، دَاعٍ، ثَانٍ)
    if ar.startswith("ال"):
        return ar + DAMMA  # ma'rifah dengan al-: اللّٰهُ، الْيَسَعُ
    if ar.endswith(FATHA + "ا") and len(ar) > 3:
        return ar[:-2] + TANWIN_F + "ا" if munsarif else ar
    if plural and (ar.endswith("ون") or ar.endswith("ين")):
        return ar + FATHA  # jamak mudzakkar salim: كَافِرُونَ
    return ar + (TANWIN_D if munsarif else DAMMA)
