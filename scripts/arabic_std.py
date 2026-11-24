"""Ubah lemma Quranic Arabic Corpus (Buckwalter ejaan mushaf/rasm Utsmani)
menjadi ejaan Arab standar (imla'i), untuk tampilan kosakata.

Contoh: kita`b -> كِتَاب, Salaw`p -> صَلَاة, EalaY` -> عَلَى, {t~aqaY` -> اتَّقَى,
samaA^' -> سَمَاء, say~i_#aAt -> سَيِّئَات, maso_#uwl -> مَسْؤُول, yarojuwA@ -> يَرْجُو.
"""
import re

BW = {
    "'": "ء", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "|": "آ",
    "A": "ا", "b": "ب", "p": "ة", "t": "ت", "v": "ث",
    "j": "ج", "H": "ح", "x": "خ", "d": "د", "*": "ذ",
    "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ",
    "f": "ف", "q": "ق", "k": "ك", "l": "ل",
    "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى",
    "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ",
    "u": "ُ", "i": "ِ", "~": "ّ", "o": "ْ", "`": "ٰ",
}
VOWELS = "aiuoFNK~"
# Kata yang dalam ejaan standar tetap memakai alif kecil (tanpa alif penuh).
EXACT = {
    "ha`*aA": "هٰذَا", "ha`*a`n": "هٰذَان", "ha`&ulaA^'": "هٰؤُلَاء", "ha`ka*aA": "هٰكَذَا",
    "*a`lik": "ذٰلِك", "la`kin": "لٰكِن", "la`kin~": "لٰكِنّ", "<ila`h": "إِلٰه",
    ">uwla`^}ik": "أُولٰئِك", "{d~a`ra`#o": "ادَّارَأَ", "{mora>at": "امْرَأَة", "r~aHoma`n": "رَحْمٰن", "{ll~ah": "اللّٰه", "{ll~ahum~a": "اللّٰهُمَّ",
}
# Konsonan yang menentukan identitas kata ganti/huruf (tanpa harakat & tanda mushaf).
CONS = set("'><&}AbptvjHxd*rzs$SDTZEgfqklmnhwYy")


def consonant_key(bw):
    return "".join(c for c in bw if c in CONS).replace("Y", "y")


def _hamza_seat(prev, nxt):
    """Kursi hamzah tengah kata menurut kaidah imla'."""
    if prev == "i" or nxt == "i" or prev == "y":
        return "}"
    if prev == "u" or nxt == "u":
        return "&"
    return ">"


def std(bw):
    if bw in EXACT:
        return EXACT[bw]
    s = bw
    s = re.sub(r"^(.)~", r"\1", s)  # syaddah dari al- yang melebur (رِّبَا -> رِبَا)
    s = s.replace("{l~a`", "All~aA", 1)  # اللَّاتِي، اللَّائِي (rasm mushaf menulis satu lam)
    s = s.replace("_#a`", "|")  # آن
    # hamzah dengan kursi kecil (_#): tentukan kursi menurut harakat sekitar
    def seat(m):
        before = s[: m.start()]
        prev = next((c for c in reversed(before) if c in "aiuoy"), "")
        if prev == "o":
            prev = ""
        after = s[m.end():]
        if after == "" or (len(after) == 1 and after in "aiu"):
            # hamzah akhir: kursi mengikuti harakat sebelumnya; setelah huruf mati/panjang di atas garis
            return {"a": ">", "u": "&", "i": "}"}.get(prev, "'")
        if after.startswith("aA") and prev in ("a", ""):  # hamzah + alif -> آ
            return "|"
        nxt = after[:1]
        return _hamza_seat(prev, nxt)
    s = re.sub(r"\^?_#", seat, s)
    s = s.replace("|aA", "|").replace("|A", "|")
    # kata kerja dengan alif "tidak dibaca" di akhir: yarojuwA@ -> yarojuw, yadora&uA@ -> yadora>u
    s = re.sub(r"&uA@$", ">u", s)
    s = re.sub(r"uwA@$", "uw", s)
    # hamzah di awal kata
    s = re.sub(r"^'aA", "|", s)
    s = re.sub(r"^'([au])", r">\1", s)
    s = re.sub(r"^'i", "<i", s)
    s = re.sub(r"o'aA", "o|", s)  # qurо'aAn -> قُرْآن
    if s == "ra'aA":
        s = "ra>aY"
    # alif + mad: hanya di awal kata (آتَى، آخِر); selain itu mad dibuang
    s = re.sub(r"^A\^", "|", s)
    s = s.replace("^", "")
    # alif kecil (dagger)
    s = re.sub(r"Y`(?=.)", "aA", s).replace("aaA", "aA")  # التَّوْرَىٰة -> التَّوْرَاة
    s = re.sub(r"Y`", "Y", s)
    s = re.sub(r"aw`A", "aA", s)
    s = re.sub(r"aw`", "aA", s)
    s = re.sub(r"a`", "aA", s)
    s = s.replace("`", "A")
    # alif wasla -> alif biasa
    s = s.replace("{", "A")
    # wawu/ya kecil = huruf tertulis dalam ejaan standar
    s = s.replace(",", "w").replace(".", "y")
    # tanda-tanda waqaf/kecil khas mushaf dibuang
    s = re.sub(r"[@:\"\[;!\-+%\]_]", "", s)
    # nun/mim sebelum huruf lain: rasm mushaf tidak menulis sukun (ikhfa/idgham) -> beri sukun
    s = re.sub(r"([nm])(?=[bptvjHxd*rzs$SDTZEgfqklmnhwy'><&}])", r"\1o", s)
    # ya di tengah kata selalu bertitik; ى setelah kasrah di akhir kata ditulis ي (فِي، الَّذِي)
    s = re.sub(r"Y(?=.)", "y", s)
    s = re.sub(r"iY$", "iy", s)
    return "".join(BW.get(c, c) for c in s)


# Kata ganti (tidak punya lemma di Corpus): kunci konsonan -> (tulisan, arti)
PRONOUNS = {
    "hm": ("هُمْ", ["mereka, -nya (mereka)"]),
    "h": ("هُ", ["dia (laki-laki), -nya"]),
    "hw": ("هُوَ", ["dia (laki-laki)"]),
    "km": ("كُمْ", ["kalian, -mu (jamak)"]),
    ">ntm": ("أَنْتُمْ", ["kalian"]),
    "hA": ("هَا", ["dia (perempuan), -nya"]),
    "nHn": ("نَحْنُ", ["kami"]),
    "k": ("كَ", ["kamu, -mu"]),
    ">nt": ("أَنْتَ", ["kamu, engkau"]),
    "nA": ("نَا", ["kami, -kami"]),
    "y": ("ي", ["aku, -ku"]),
    "hy": ("هِيَ", ["dia (perempuan)"]),
    ">nA": ("أَنَا", ["aku"]),
    "hn": ("هُنَّ", ["mereka (perempuan)"]),
    "hmA": ("هُمَا", ["mereka berdua"]),
    "kmA": ("كُمَا", ["kalian berdua"]),
    ">ntmA": ("أَنْتُمَا", ["kalian berdua"]),
    "kn": ("كُنَّ", ["kalian (perempuan)"]),
    ">ntn": ("أَنْتُنَّ", ["kalian (perempuan)"]),
    "hyh": ("هِيَهْ", ["dia (perempuan)"]),
}
