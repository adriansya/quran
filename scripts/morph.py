"""Pembentuk fi'il madhi (dhamir huwa, ma'lum) dari akar + wazan (bentuk I–X).

Dipakai untuk menormalkan lemma fi'il di Quranic Arabic Corpus yang tercatat
dalam bentuk mudhari' (يُوقِنُ) atau majhul (زُلْزِلَ) menjadi madhi ma'lum
(أَيْقَنَ، زَلْزَلَ), sesuai bentuk kamus bahasa Arab.

Notasi Buckwalter (Corpus): ' hamzah, > أ, w و, y ي, A alif, Y alif maqshurah.
"""
import re

HAMZA = set("'><&}A")  # Corpus menulis hamzah pada akar sebagai A
GUTTURAL = set("HEhxg'")  # huruf halq: fa'ala/yaf'alu


def _norm_root(root):
    return "".join("'" if c in HAMZA else c for c in root)


def _hamza_init(s):
    """Hamzah di awal kata: 'a -> >a, 'u -> >u, 'i -> <i."""
    if s.startswith("'a"):
        return ">" + s[1:]
    if s.startswith("'u"):
        return ">" + s[1:]
    if s.startswith("'i"):
        return "<" + s[1:]
    return s


def fix_hamza(s):
    """Letakkan hamzah (') pada kursinya menurut kaidah imla'."""
    out = list(s)
    for i, c in enumerate(s):
        if c != "'":
            continue
        if i == 0:
            continue
        prev = s[i - 1]
        nxt = s[i + 1] if i + 1 < len(s) else ""
        pv = next((x for x in reversed(s[:i]) if x in "aiuo"), "")
        if prev in "Awy" and not (prev in "wy" and i >= 2 and s[i - 2] in "aiu" and s[i - 2] + prev not in ("uw", "iy")):
            seat = "}" if nxt == "i" else "'"  # setelah huruf panjang: di atas garis (جَاءَ، سَاءَ)
        elif pv == "i" or nxt == "i":
            seat = "}"
        elif pv == "u" or nxt == "u":
            seat = "&"
        elif nxt == "A" and pv == "a":
            seat = "|"
        else:
            seat = ">"
        out[i] = seat
    s = "".join(out).replace("|A", "|")
    return s


SPECIAL = {("rAy", "IV"): ">araY", ("rAy", "I"): "ra>aY"}


def madhi(root, form="I", vowel="a"):
    if (root, form) in SPECIAL:
        return SPECIAL[(root, form)]
    out = _madhi(root, form, vowel)
    if out:
        out = fix_hamza(out)
    # alif maqshurah setelah ya' ditulis alif: أَحْيَا، اسْتَحْيَا
    return re.sub(r"yaY$", "yaA", out) if out else out


def _madhi(root, form, vowel):
    """root: 3-4 huruf Buckwalter, form: 'I'..'X', vowel: harakat 'ain madhi bentuk I (a/i/u)."""
    r = _norm_root(root)
    if len(r) == 4:  # ruba'i: fa'lala (زَلْزَلَ، وَسْوَسَ)
        f, e, l, l2 = r
        if form == "II":  # tafa'lala
            return f"ta{f}a{e}o{l}a{l2}a"
        return _hamza_init(f"{f}a{e}o{l}a{l2}a")
    if len(r) != 3:
        return None
    f, e, l = r
    defect = l in "wy"
    hollow = e in "wy" and not defect  # lafif (سوي، حيي) diperlakukan sebagai naqis
    doubled = e == l and not defect

    if form == "I":
        if doubled:
            return _hamza_init(f"{f}a{e}~a")
        if hollow:
            return _hamza_init(f"{f}aA{l}a")
        if defect:
            if vowel == "i":
                return _hamza_init(f"{f}a{e}i{'y'}a")  # رَضِيَ، خَشِيَ
            return _hamza_init(f"{f}a{e}" + ("aY" if l == "y" else "aA"))  # رَمَى، دَعَا
        return _hamza_init(f"{f}a{e}{vowel}{l}a")
    if form == "II":
        if defect:
            return _hamza_init(f"{f}a{e}~aY")  # سَمَّى، زَكَّى
        return _hamza_init(f"{f}a{e}~a{l}a")
    if form == "III":
        if defect:
            return _hamza_init(f"{f}aA{e}aY")  # نَادَى
        return _hamza_init(f"{f}aA{e}a{l}a")
    if form == "IV":
        if doubled:
            return f">a{f}a{e}~a"  # أَحَلَّ
        if hollow:
            return f">a{f}aA{l}a"  # أَقَامَ
        if f == "'":
            return f"|{e}aY" if defect else f"|{e}a{l}a"  # آتَى، آمَنَ
        if defect:
            return f">a{f}o{e}aY"  # أَعْطَى
        return f">a{f}o{e}a{l}a"
    if form == "V":
        if defect:
            return f"ta{f}a{e}~aY"  # تَوَلَّى
        return f"ta{f}a{e}~a{l}a"
    if form == "VI":
        if defect:
            return f"ta{f}aA{e}aY"  # تَعَالَى
        if doubled:
            return f"ta{f}aA{e}~a"
        return f"ta{f}aA{e}a{l}a"
    if form == "VII":
        if doubled:
            return f"{{no{f}a{e}~a"
        if hollow:
            return f"{{no{f}aA{l}a"  # انْقَادَ
        if defect:
            return f"{{no{f}a{e}aY"
        return f"{{no{f}a{e}a{l}a"
    if form == "VIII":
        # huruf ta' ifta'ala berasimilasi
        if f in "wy" or f == "'":
            pre = "{t~a"  # اتَّقَى، اتَّخَذَ
        elif f in "TZ":
            pre = f"{{{f}~a"  # اطَّلَعَ
        elif f in "SD":
            pre = f"{{{f}oTa"  # اصْطَبَرَ، اضْطَرَّ
        elif f == "d":
            pre = "{d~a"
        elif f == "*":
            pre = "{d~a"  # ادَّكَرَ
        elif f == "z":
            pre = "{zoda"  # ازْدَجَرَ
        elif f == "t":
            pre = "{t~a"
        else:
            pre = f"{{{f}ota"
        if doubled:
            return f"{pre}{e}~a"
        if hollow:
            return f"{pre.rstrip('a')}aA{l}a"  # اخْتَارَ
        if defect:
            return f"{pre}{e}aY"  # اهْتَدَى، اتَّقَى
        return f"{pre}{e}a{l}a"
    if form == "IX":
        return f"{{{f}o{e}a{l}~a"
    if form == "X":
        if doubled:
            return f"{{sota{f}a{e}~a"
        if hollow:
            return f"{{sota{f}aA{l}a"  # اسْتَقَامَ
        if defect:
            return f"{{sota{f}o{e}aY"  # اسْتَحْيَا -> اسْتَحْيَى
        return f"{{sota{f}o{e}a{l}a"
    return None


def impf_vowel(stem, root):
    """Harakat 'ain mudhari' bentuk I dari satu kemunculan (يَفْعُلُ/يَفْعِلُ/يَفْعَلُ)."""
    r = _norm_root(root)
    if len(r) != 3:
        return None
    s = re.sub(r"^[ytn>A&']", "", stem)
    s = s.replace(">", "'").replace("<", "'").replace("&", "'").replace("}", "'")
    m = re.match(rf"^[aiu]{re.escape(r[0])}o{re.escape(r[1])}([aiu])", s)
    return m.group(1) if m else None


def madhi_vowel_from_impf(v, root):
    """Kaidah umum: yaf'ulu/yaf'ilu -> fa'ala; yaf'alu -> fa'ila, kecuali huruf halq -> fa'ala."""
    r = _norm_root(root)
    if v == "a":
        return "a" if (r[1] in GUTTURAL or r[2] in GUTTURAL) else "i"
    return "a"
