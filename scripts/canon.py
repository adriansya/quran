"""Kanonisasi lemma Quranic Arabic Corpus menurut kaidah sharaf:

- Fi'il  -> madhi, dhamir huwa, ma'lum (bentuk kamus). Jika bentuk itu muncul di
            Al-Qur'an, dipakai apa adanya; jika tidak, dibentuk dari akar + wazan.
- Isim   -> mufrad mudzakkar. Jamak salim, jamak taksir, dan muannats (untuk sifat/
            isim fa'il/maf'ul) disatukan ke mufradnya.

Keluaran: {lemma_corpus: lemma_kanonik} (Buckwalter), plus info mengapa diubah.
"""
import collections
import re

from arabic_std import std
from morph import impf_vowel, madhi, madhi_vowel_from_impf

# Bentuk muannats yang merupakan isim tersendiri, bukan muannats dari sifat.
FEM_NOUN = {"muSiybap", "waAqiEap", "m~uSiybap"}

FORMS = ("I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII")

# ---------------------------------------------------------------- fi'il
# Harakat 'ain bentuk I yang tidak bisa dipastikan dari teks (ditetapkan dari kamus).
VERB_VOWEL = {
    "fqh": "i", "lEb": "i", "TmE": "i", "Emh": "i", "rhq": "i", "jhl": "i", "rgb": "i",
    "rhb": "i", "lHq": "i", "brH": "i", "blE": "i", "glZ": "u", "Thr": "u", "SEd": "i",
    "mrH": "i", "sEd": "i", "SHb": "i", "Hmd": "i", "wly": "i", "kwy": "a", "DHw": "i",
    "ftA": "i", "ZmA": "i", "Ent": "i", "sAm": "i", "wTA": "i", "qrb": "i", "H*r": "i",
    "Hzn": "i", "Sly": "i", "xfy": "i", "Evw": "i", "Asy": "i", "$qw": "i", "Alm": "i",
    "lqf": "i", "rqy": "i", "rdy": "i", "Ery": "i", "Ebv": "i", "Hnv": "i", "xzy": "i",
    "rkn": "i", "Hmy": "i", "mlA": "a", "drA": "a", "jAr": "a", "xsA": "a", "klA": "a",
    "brA": "a", "Sdr": "a", "Hzr": "i",
}
# Lemma fi'il yang wazannya salah tercatat sebagai bentuk I, atau kasus khusus.
VERB_FIX = {
    "yuwSiy": ">awoSaY", "yuroDiEo": ">aroDaEa", "tusaw~aY`": "saw~aY", "tatajaAfaY`": "tajaAfaY",
    "talaZ~aY`": "talaZ~aY", "taHar~a": "taHar~aY", "taDar~aEu": "taDar~aEa", ">arosaY`": ">arosaY",
    "tamaAra": "tamaAraY", "yafotariy": "{fotaraY", "tanaAda": "tanaAdaY", "hayota": "hayota",
    "haAtu": "haAti", "yuHaA^d~u": "HaAd~a", "yuhoraEu": ">ahoraEa",
}
WAZAN = {
    "II": "فَعَّلَ", "III": "فَاعَلَ", "IV": "أَفْعَلَ", "V": "تَفَعَّلَ", "VI": "تَفَاعَلَ",
    "VII": "انْفَعَلَ", "VIII": "افْتَعَلَ", "IX": "افْعَلَّ", "X": "اسْتَفْعَلَ",
}

# ---------------------------------------------------------------- isim
# Jamak taksir / jamak yang tercatat sebagai lemma sendiri -> mufradnya.
BROKEN = {
    ">aSoHa`b": "SaAHib", "A^baA'": ">ab", "rijaAl": "rajul", "Zuluma`t": "Zulomap",
    ">ahowaA^'": "hawFY", ">aloba`b": "lub~", "Huduwd": "Had~", ">aroHaAm": "raHim",
    ">afowa`h": "fam", "faA": "fam", "juluwd": "jilod", ">asa`Tiyr": ">usoTuwrap",
    "xazaA^}in": "xizaAnap", "xazanat": "xaAzin", "viyaAb": "vawob", "mana`fiE": "manofaEap",
    "SuHuf": "SaHiyfap", "zubur": "zabuwr", "zubar": "zuborap", "n~axiyl": "naxol",
    "<ixowapN": ">ax", "surur": "sariyr", ">andaAd": "nid~", "xuTuwa`t": "xuTowap",
    ">asaAwir": "siwaAr", ">araA^}ik": ">ariykap", ">aSonaAm": "Sanam",
    "magaAnim": "magonam", "kisaf": "kisofap", "fuj~aAr": "faAjir", "buruwj": "buroj",
    "Huwr": "HaworaA'", ">asoliHat": "silaAH", ">akowaAb": "kuwb", ">aHobaAr": "Hibor",
    ">a*il~ap": "*aliyl", "$aEa`^}ir": "$aEiyrap", "suka`raY`": "sakoraAn",
    "sara`biyl": "sirobaAl", "ruhoba`n": "raAhib", "qiradap": "qirod", "qawaAriyraA": "qaAruwrap",
    "qawaAEid": "qaAEidap", "m~awaADiE": "mawoDiE", "mafaAtiH": "mifotaH",
    "madaA^}in": "madiynap", "maDaAjiE": "maDojaE", "jawaAr": "jaAriyap", "fitoyap": "fataY`",
    "fataya`t": "fataAp", ">awova`n": "wavan", ">awotaAd": "watid", ">atoraAb": "tirob",
    ">ajodaAv": "jadav", ">a*oqaAn": "*aqan", "'aAnaA^'": "<inaY`", "$~ahawa`t": "$ahowap",
    "zumar": "zumorap", "xawaAlif": "xaAlifap", "t~amaAviyl": "timovaAl", "quTuwf": "qiTof",
    "qiTaE": "qiToEap", "qala`^}id": "qilaAdap", "n~uhaY`": "nuhoyap", "mawa`liY": "mawolaY`",
    "mawa`liy": "mawolaY`", "mawaAxir": "maAxirap", "maqaAliyd": "miqoliyd", "manaAzil": "manozil",
    "maEaArij": "maEoraj", "jiviy~": "jaAviy", "gulof": ">agolaf", "buwr": "baA}ir",
    "SinowaAn": "Sinow", "Huruma`t": "Huromap", "HanaAjir": "Hanojarap", "EijaAf": ">aEojaf",
    "EiSiy~": "EaSaA2", ">azola`m": "zalam", ">axodaAn": "xidon", ">awodiyap": "waAdiy",
    ">asofaAr": "sifor", ">aqoTaAr": "quTor", ">anfaAl": "nafal", ">akomaAm": "kim~",
    ">aSofaAd": "Safad", ">aSa`biE": "<iSobaE", ">aEolawon": ">aEolaY`", ">aEola`m": "Ealam",
    ">aEojaAz": "Eajuz", ">aDoga`n": "Digon", "z~ur~aAE": "zaAriE", "zuroq": ">azoraq",
    "xun~as": "xaAnis", "xumur": "ximaAr", "xulaTaA^'": "xaliyT", "xu$ub": "xa$abap",
    "xiyaAm": "xayomap", "wuHuw$": "waHo$", "t~araA^}ib": "tariybap", "s~araA^}ir": "sariyrap",
    "suwd": ">asowad", "suhuwl": "sahol", "ruquwd": "raAqid", "rukobaAn": "raAkib",
    "rimaAH": "rumoH", "riha`n": "rahon", "rawaAkid": "raAkid", "raba`^}ib": "rabiybap",
    "quruw^'": "quro'", "quduwr": "qidor", "qinowaAn": "qinow", "qidad": "qid~ap",
    "qatolaY": "qatiyl", "qabaA^}il": "qabiylap", "n~af~a`va`t": "naf~aAvap",
    "namaAriq": "numoruqap", "m~aqa`miE": "miqomaE", "m~aHa`riyb": "miHoraAb",
    "mawa`qiE": "mawoqiE", "mawaATin": "mawoTin", "mavula`t": "muvolap", "maraADiE": "muroDiEap",
    "maqaAbir": "maqobarap", "manaAkib": "manokib", "maja`lis": "majolis", "maga`ra`t": "magaArap",
    "ma_#aArib": "ma>orabap", "maSaAniE": "maSonaE", "libad": "libodap", "lawa`qiH": "laAqiH",
    "kun~as": "kaAnis", "kubaraA^'": "kabiyr", "kawaAfir": "kaAfirap", "kawaAEib": "kaAEib",
    "juruwH": "jaroH", "judur": "jidaAr", "judad": "jud~ap", "jiyaAd": "jawaAd",
    "jima`lat": "jamal", "jifaAn": "jafonap", "jibaAh": "jabohap", "jawaAriH": "jaAriHap",
    "jawaAb2": "jaAbiyap", "jala`biyb": "jilobaAb", "hamaza`t": "hamozap", "guz~FY": "gaAziy",
    "gulob": ">agolab", "garaAbiyb": "girobiyb", "dusur": "disaAr", "dara`him": "diroham",
    "bukiy~": "baAkiy", "biyaE": "biyEap", "bigaAl": "bagol", "bayoD": ">aboyaD",
    "Sufor": ">aSofar", "SiHaAf": "SaHofap", "Sawa`miE": "SawomaEap", "SawaA^f~": "SaA^f~",
    "SaroEaY`": "SariyE", "Humor": "HimaAr", "Huliy~": "Hiloyap", "Huk~aAm": "HaAkim",
    "Hujura`t": "Hujorap", "Hubuk": "HibaAk", "Hijaj": "Huj~ap", "HawaAyaA^": "HaAwiyap",
    "Hala`^}il": "Haliylap", "Hafadap": "HaAfid", "Eurub": "Earuwb", "Euquwd": "Eaqod",
    "EiSam": "EiSomap", "Ei$aAr": "Ea$oraA'", "Eala`ma`t": "EalaAmap", "D~afaAdiE": "DifodaE",
    ">ayoqaAZ": "yaqiZ", ">aya`maY`": ">ay~im", ">awobaAr": "wabar", ">arojaA^}": "rajFA",
    ">aqowa`t": "quwt", ">aqofaAl": "qufol", ">anka`v": "nikov", ">ankaAl": "nikol",
    ">anaAmil": ">unomulap", ">amoEaA^'": "miEFY", ">amo$aAj": "ma$iyj", ">aloqa`b": "laqab",
    ">akona`n": "kin~", ">ajin~ap": "janiyn", ">ahil~ap": "hilaAl", ">afonaAn": "fanan",
    ">abaAriyq": "<iboriyq", ">aTowaAr": "Tawor", ">aSowaAf": "Suwf", ">aHib~a`^&": "Habiyb",
    ">a$oraAT": "$araT", "$ur~aE": "$aAriE", "$uHuwm": "$aHom", "$uEuwb": "$aEob",
    "$uEab": "$uEobap", "$iyb": ">a$oyab", ">aEoraAb": ">aEoraAbiy~", "'aAlaA^'": "<ilFY",
    "muSoTafayon": "muSoTafaY`", "mufotaraya`t": "mufotaraY", "Saduqa`t": "Saduqap",
    "HaADiriY": "HaADir", "EaAbiriY": "EaAbir", "muqoniEiY": "muqoniE", "muholikiY": "muholik",
    "muHil~iY": "muHil~", "ZaAlimiY^": "ZaAlim",
    "HadaA^}iq": "Hadiyqap", "fawa`kih": "fa`kihap", "$amaA^}il": "$imaAl", "fura`daY`": "farod",
    "kusaAlaY`": "kasolaAn", "maEa`yi$": "maEiy$ap", "m~avaAniY": "mavonaY`", ">aqaAwiyl": "qawol",
    "SayaASiy": "SiySiyap", "d~awaA^}ir": "daA^}irap", "maEaA*iyr": "maEo*irap", "maraAfiq": "mirofaq",
    "n~awa`SiY": "naASiyap", "t~araAqiY": "taroquwap", "naD~aAxataAn": "naD~aAxap",
    "bunaY~": "{bon", "rab~a`niy~in": "rab~aAniy~", "S~a`bi_#iyn": "SaAbi}", "maroDaAt": "maroDaAp", "siniyn": "sanap", "banaAt": "binot", ">a$otaAt": "$at~", "rawaAsiY": "raAsiyap",
    "rawa`siY": "raAsiyap", ">asobaAT": "siboT",
}
# Varian tulisan kata yang sama (semua jenis kata).
ALIAS = {"laday": "ladaY", "<iyn": "<in", "*aA": "*uw"}  # أَفَإِي۟ن (3:144) = إِنْ; ya' tambahan rasm tak dibaca

# Isim jamak / jamak tanpa mufrad dari lafaznya: tetap berdiri sendiri, diberi keterangan.
PLURAL_ONLY = {
    "n~aAs": "isim jamak (tidak punya mufrad dari lafaznya)",
    "nisaA^'": "jamak tanpa mufrad dari lafaznya; mufrad maknawinya: امْرَأَة",
    ">abaAbiyl": "jamak tanpa mufrad",
    "z~abaAniyap": "jamak; mufradnya زِبْنِيَة",
    "raforaf": "isim jamak",
    "qum~al": "isim jinis jamak",
}
# Jangan diperlakukan sebagai jamak salim walau berakhiran -ين/-ون.
NOT_SOUND_PLURAL = {">uwliY", "diyn", "duwn", "Hiyn", "misokiyn", "yamiyn", "m~ubiyn", "Eil~iy~uwn", "sijl~iyn",
                    "Ea$iyn", "zayotuwn", "nuwn", "giSoliyn", "TuwrisiyniynaN", "sayonaA^'", "qa`ruwn",
                    "fir'Eawon", "ha`ruwn", "ha`ruwt", "ma`ruwt", "jaAluwt", "TaAluwt", "Eiliy~iyn"}


def _num(fs):
    if any(x in ("MP", "FP", "P") for x in fs):
        return "P"
    if any(x in ("MD", "FD", "D") for x in fs):
        return "D"
    return "S"


def _root(fs):
    return next((x[5:] for x in fs if x.startswith("ROOT:")), None)


def _form(fs):
    return next((x.strip("()") for x in fs if x.startswith("(") and x.strip("()") in FORMS), "I")


def _key(bw):
    """Kunci pembanding: ejaan standar tanpa harakat akhir/tanwin, tanpa digit."""
    s = std(re.sub(r"\d+$", "", bw))
    s = re.sub(r"[ً-ْ]+$", "", s)  # harakat/tanwin akhir
    s = s.replace("ة", "ت") if s.endswith("ة") else s
    return s


def verb_canonical(lem, occ, root, form):
    if lem in VERB_FIX:
        return VERB_FIX[lem], "koreksi wazan"
    gold = collections.Counter(st for st, fs, _ in occ if "PERF" in fs and "3MS" in fs and "PASS" not in fs)
    if gold:
        return gold.most_common(1)[0][0], "madhi di Al-Qur'an"
    if form in ("XI", "XII") or not root:
        return lem, "apa adanya"
    rr = root
    if form == "I" and len(rr) == 3:
        if rr in VERB_VOWEL:
            v = VERB_VOWEL[rr]
        else:
            vs = collections.Counter()
            r = "".join("'" if c in "'><&}A" else c for c in rr)
            for st, fs, _ in occ:
                s = "".join("'" if c in "><&}" else c for c in st)
                if "PERF" in fs and "PASS" not in fs:
                    m = re.match(rf"^{re.escape(r[0])}a{re.escape(r[1])}([aiu]){re.escape(r[2])}", s)
                    if m:
                        vs[m.group(1)] += 3
                if ("IMPF" in fs or "IMPV" in fs) and "PASS" not in fs and not re.match(r"^[ytn>]u", st):
                    iv = impf_vowel(st, rr)
                    if iv:
                        vs[madhi_vowel_from_impf(iv, rr)] += 1
            v = vs.most_common(1)[0][0] if vs else "a"
    else:
        v = "a"
    g = madhi(rr, form, v)
    return (g or lem), "dibentuk dari akar & wazan"


def build(occ_by_lemma):
    """occ_by_lemma: {lemma_corpus: [(stem, feats, pos), ...]} -> (canon, notes)"""
    info = {}
    for lem, occ in occ_by_lemma.items():
        pos = collections.Counter(p for _, _, p in occ).most_common(1)[0][0]
        root = _root(occ[0][1])
        form = collections.Counter(_form(fs) for _, fs, _ in occ).most_common(1)[0][0]
        nums = collections.Counter(_num(fs) for _, fs, _ in occ)
        fem = sum(1 for _, fs, _ in occ if any(x in ("F", "FS", "FD", "FP") for x in fs))
        pcpl = any("PCPL" in fs for _, fs, _ in occ)
        info[lem] = dict(pos=pos, root=root, form=form, nums=nums, n=len(occ), fem=fem, pcpl=pcpl)

    canon, notes = {}, {}
    # indeks lemma isim per akar untuk mencari mufrad yang sudah ada
    by_root = collections.defaultdict(dict)
    for lem, d in info.items():
        if d["pos"] in ("N", "ADJ"):
            by_root[d["root"]][_key(lem)] = lem

    def resolve(cands, root):
        for c in cands:
            hit = by_root.get(root, {}).get(_key(c))
            if hit:
                return hit
        return cands[0]

    for lem, d in info.items():
        base = re.sub(r"\d+$", "", lem)
        if d["pos"] == "V":
            c, why = verb_canonical(lem, occ_by_lemma[lem], d["root"], d["form"])
            if c != base:
                canon[lem], notes[lem] = c, why
            continue
        if lem in ALIAS:
            canon[lem], notes[lem] = ALIAS[lem], "varian tulisan"
            continue
        if d["pos"] not in ("N", "ADJ"):
            continue
        plural_share = d["nums"]["P"] / d["n"]
        if lem in PLURAL_ONLY:
            notes[lem] = PLURAL_ONLY[lem]
            continue
        if lem in BROKEN:
            canon[lem] = resolve([BROKEN[lem]], d["root"])
            notes[lem] = "jamak -> mufrad"
            continue
        m = re.match(r"^(.*?)(uwn|iyn|uwA@?|uw|iY\^?|iy)$", base)
        if m and plural_share >= 0.8 and base not in NOT_SOUND_PLURAL and len(m.group(1)) >= 3:
            stem = m.group(1)
            weak_end = d["root"] and d["root"][-1] in "wyY"
            cands = [stem, stem + "iy", stem + "K"] if weak_end else [stem]
            target = resolve(cands, d["root"])
            if target == cands[0] and weak_end:
                target = stem + "K"  # isim manqush: مُتَّقٍ، مُهْتَدٍ
            canon[lem], notes[lem] = target, "jamak mudzakkar salim -> mufrad"
            continue
        m = re.match(r"^(.*?)aAt$|^(.*?)a`t$", base)
        if m and plural_share >= 0.8:
            stem = m.group(1) or m.group(2)
            adj = d["pos"] == "ADJ" or d["pcpl"]
            if adj and d["root"] and d["root"][-1] in "wy" and stem.endswith("iy"):
                stem = stem[:-2] + "K"
            cands = ([stem, stem + "ap"] if adj else [stem + "ap", stem])
            hit = resolve(cands, d["root"])
            canon[lem] = hit if hit in info else (stem if adj else stem + "ap")
            notes[lem] = "jamak muannats salim -> mufrad"
            continue
        if base.endswith("ap") and lem not in FEM_NOUN and (d["pos"] == "ADJ" or d["pcpl"]) and d["fem"] >= 0.8 * d["n"]:
            hit = by_root.get(d["root"], {}).get(_key(base[:-2]))
            if hit and hit != lem:
                canon[lem], notes[lem] = hit, "muannats -> mudzakkar"

    # varian rasm / hasil normalisasi yang ternyata kata yang sama: jenis kata, akar & ejaan standar sama
    # (صَىٰحِب = صَاحِب، تَٰٓئِب = تَائِب، لَّعَلّ = لَعَلّ). Homograf bernomor di Corpus (صَالِح2) tidak disentuh.
    cls = lambda pos: "N" if pos in ("N", "ADJ") else pos  # noqa: E731
    groups = collections.defaultdict(list)
    for lem, d in info.items():
        if lem in PLURAL_ONLY or re.search(r"\d$", lem):
            continue
        t = canon.get(lem, lem)
        if re.search(r"\d$", t):
            continue
        groups[(cls(d["pos"]), d["root"], _key(t))].append(lem)
    for (_, root, _), lems in groups.items():
        targets = {canon.get(x, x) for x in lems}
        if len(targets) < 2:
            continue
        weight = collections.Counter()
        for x in lems:
            weight[canon.get(x, x)] += info[x]["n"] + (1000 if canon.get(x, x) in info else 0)
        head = weight.most_common(1)[0][0]
        for x in lems:
            if canon.get(x, x) != head:
                canon[x], notes[x] = head, notes.get(x) or "varian rasm"

    # rantai (mis. muna`fiqa`t -> muna`fiq <- muna`fiquwn): ikuti sampai stabil
    for _ in range(5):
        for k, v in list(canon.items()):
            if v in canon and canon[v] != v:
                canon[k] = canon[v]
    return canon, notes, info


def verb_wazan(form, bw):
    if form == "I":
        m = re.search(r"a.(a|i|u)", re.sub(r"^[>|']", "", bw))
        return {"a": "فَعَلَ", "i": "فَعِلَ", "u": "فَعُلَ"}.get(m.group(1) if m else "a", "فَعَلَ")
    return WAZAN.get(form)


# ---------------------------------------------------------------- wazan jamak
_EQ = {"w": "wy'", "y": "wyY'"}


def plural_wazan(stem, root):
    """Wazan jamak taksir: ganti huruf akar dengan ف ع ل (ل kedua untuk ruba'i)."""
    if not root or len(root) not in (3, 4):
        return None
    # akar berhamzah / naqis: wazan tidak bisa dibaca mekanis dengan aman (آبَاء، أَيْدِي)
    if "A" in root or root[-1] in "wyY" or stem.startswith("|") or "#" in stem:
        return None
    letters = "fEll" if len(root) == 4 else "fEl"
    out, ri = [], 0
    s = re.sub(r"^(.)~", r"\1", stem)
    for i, c in enumerate(s):
        if ri < len(root):
            r = root[ri]
            ok = c == r or c in _EQ.get(r, "") or (r in "'A" and c in "'><&}")
            if ok and c not in "aiuo~FNK`^":
                out.append(letters[ri])
                ri += 1
                continue
        out.append(c)
    if ri < len(root):
        return None
    pat = "".join(out)
    # rasm mushaf sering tak menulis sukun: huruf wazan diikuti konsonan -> beri sukun (أَنفُس -> أَفْعُل)
    pat = re.sub(r"([fEl])(?=[fElbtvjHxd*rzs$SDTZgqkmnh'><&}])", r"\1o", pat)
    return std(pat)
