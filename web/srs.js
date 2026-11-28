// Mesin hafalan berulang (SRS) ala Anki — diadaptasi dari aplikasi latihan juz 1–2.
// Kartu baru: langkah 1 mnt → 10 mnt → lulus 1 hari. Setelah lulus, jarak dikali faktor kemudahan (awal 250%).
export const MIN = 60000, DAY = 864e5;
const STEPS = [1, 10], RELEARN = [10], GRAD = 1, EASY_GRAD = 4, START_EASE = 2.5;
export const MASTERED_IV = 21; // jarak ≥ 21 hari = dikuasai

// "Hari" berganti jam 04.00 waktu lokal, seperti Anki.
export const today = (t = Date.now()) => {
  const d = new Date(t - 4 * 3600000);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY);
};
export const dayStart = (n) => { const d = new Date(n * DAY); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4).getTime(); };
export const fmtT = (ms) => {
  const m = Math.round(ms / MIN);
  if (m < 60) return Math.max(1, m) + " mnt";
  const h = Math.round(m / 60);
  if (h < 24) return h + " jam";
  const d = Math.round(ms / DAY);
  return d < 30 ? d + " hr" : d < 365 ? Math.round(d / 30) + " bln" : (d / 365).toFixed(1).replace(".", ",") + " th";
};

// c: {q: 0 baru/belajar | 1 ulang | 2 belajar-ulang, s: langkah, iv: hari, ef: kemudahan, due: ms, r: jumlah ulasan, l: jumlah lupa}
// r: 1 Lagi, 2 Sulit, 3 Baik, 4 Mudah
export function schedule(c, r, now = Date.now()) {
  c = c ? { ...c } : { q: 0, s: 0, iv: 0, ef: START_EASE, due: now, r: 0, l: 0 };
  c.r++;
  const learnStep = (steps, gradIv, from) => {
    if (r === 1) { c.s = 0; c.due = now + steps[0] * MIN; }
    else if (r === 2) { const a = steps[c.s] ?? steps[steps.length - 1], b = steps[c.s + 1] ?? a; c.due = now + (c.s === 0 && steps.length > 1 ? (a + b) / 2 : a) * MIN; }
    else if (r === 3) { c.s++; if (c.s >= steps.length) { c.q = 1; c.iv = gradIv; c.due = dayStart(today(now) + c.iv); } else c.due = now + steps[c.s] * MIN; }
    else { c.q = 1; c.iv = from === 2 ? Math.max(gradIv + 1, c.iv) : EASY_GRAD; c.due = dayStart(today(now) + c.iv); }
  };
  if (c.q === 0) learnStep(STEPS, GRAD, 0);
  else if (c.q === 2) learnStep(RELEARN, Math.max(1, c.iv), 2);
  else {
    const late = Math.max(0, today(now) - today(c.due));
    if (r === 1) { c.l++; c.ef = Math.max(1.3, c.ef - 0.2); c.iv = Math.max(1, Math.round(c.iv * 0.5)); c.q = 2; c.s = 0; c.due = now + RELEARN[0] * MIN; }
    else {
      let iv;
      if (r === 2) { iv = Math.max(c.iv + 1, Math.round(c.iv * 1.2)); c.ef = Math.max(1.3, c.ef - 0.15); }
      else if (r === 3) iv = Math.max(c.iv + 1, Math.round((c.iv + late / 2) * c.ef));
      else { iv = Math.max(c.iv + 2, Math.round((c.iv + late) * c.ef * 1.3)); c.ef += 0.15; }
      if (iv > 2) iv = Math.round(iv * (0.95 + Math.random() * 0.1));
      c.iv = Math.min(iv, 36500); c.due = dayStart(today(now) + c.iv);
    }
  }
  return c;
}
// Perkiraan jarak tiap tombol (tanpa acak) untuk label tombol.
export function preview(c, now = Date.now()) {
  const out = {};
  for (const r of [1, 2, 3, 4]) {
    const n = schedule(c, r, now);
    out[r] = n.due - now;
  }
  return out;
}

// ---------- state ----------
const KEY = "kq.v2";
// Versi nomor kata. v2: kata ganti yang hanya beda tanda mad digabung, nomor bergeser.
export const DATA_VERSION = 8; // v8: review manual seluruh kata; عَظْمٌ, دَعِيٌّ dipisah, تَعَالَ; // v7: huruf menempel (وَ، فَ، بِ، لِ …) jadi kartu, nomor bergeser; // v6: إِين (3:144) disatukan ke إِنْ; // v5: الَّذِي/الَّذِينَ/الَّتِي, هٰذَا/هٰذِهِ/هٰؤُلَاءِ, ذٰلِكَ/تِلْكَ dipisah; // v3: fi'il -> madhi, isim -> mufrad; v4: jamak taksir sisa disatukan
const blank = () => ({ cards: {}, days: {}, extra: {}, w: {}, scope: "all", npd: 10, src: "freq", sk: { d: 0, n: 0 }, badges: [], t: 0, dv: DATA_VERSION });
export let st = blank();
export let canStore = true;

function migrateV1() { // progres versi pertama web ini (kq.srs: {id: {iv, due, reps}})
  try {
    const old = JSON.parse(localStorage.getItem("kq.srs") || "null");
    if (!old) return;
    for (const [id, o] of Object.entries(old)) {
      st.cards[id] = o.iv >= 1
        ? { q: 1, s: 0, iv: o.iv, ef: START_EASE, due: o.due, r: o.reps || 1, l: 0 }
        : { q: 0, s: 0, iv: 0, ef: START_EASE, due: Date.now(), r: o.reps || 0, l: 0 };
    }
    const set = JSON.parse(localStorage.getItem("kq.settings") || "{}");
    if (set.newPerDay) st.npd = set.newPerDay;
    st.t = 1; st.dv = 1;
  } catch { /* abaikan */ }
}
export function load() {
  try {
    localStorage.setItem("kq.t", "1"); localStorage.removeItem("kq.t");
    const v = localStorage.getItem(KEY);
    if (v) { const o = JSON.parse(v); st = Object.assign(blank(), o, { dv: o.dv || 1 }); } else migrateV1();
  } catch { canStore = false; }
}
// Pindahkan progres dari nomor kata lama ke nomor baru (map[lama] = baru). Fungsi murni.
export function remapState(s, map) {
  const cards = {}, w = {};
  for (const [old, c] of Object.entries(s.cards || {})) {
    const n = map[old];
    if (n == null) continue;
    const y = cards[n];
    if (!y || (c.q === 1 && (y.q !== 1 || c.iv > y.iv))) cards[n] = c;
  }
  for (const [old, k] of Object.entries(s.w || {})) { const n = map[old]; if (n != null) w[n] = (w[n] || 0) + k; }
  return { ...s, cards, w, dv: (s.dv || 1) + 1 };
}
export function remapIds(map) { st = remapState(st, map); save(); }

// Gabungkan dua progres (mis. progres di browser + progres di akun). Tidak ada ulasan yang hilang:
// per kartu dipilih yang paling banyak diulas (seri: yang jadwalnya lebih akhir).
export function mergeStates(a, b) {
  a = Object.assign(blank(), a); b = Object.assign(blank(), b);
  const newer = (a.t || 0) >= (b.t || 0) ? a : b;
  const cards = { ...a.cards };
  for (const [id, c] of Object.entries(b.cards)) {
    const y = cards[id];
    if (!y || c.r > y.r || (c.r === y.r && c.due > y.due)) cards[id] = c;
  }
  const days = { ...a.days };
  for (const [k, d] of Object.entries(b.days)) {
    const y = days[k];
    days[k] = !y ? d : { n: Math.max(y.n, d.n), r: Math.max(y.r, d.r), ok: Math.max(y.ok, d.ok) };
  }
  const maxMap = (x, y) => { const o = { ...x }; for (const [k, v] of Object.entries(y)) o[k] = Math.max(o[k] || 0, v); return o; };
  const sk = (a.sk.d > b.sk.d || (a.sk.d === b.sk.d && a.sk.n >= b.sk.n)) ? a.sk : b.sk;
  return {
    ...newer, cards, days, w: maxMap(a.w, b.w), extra: maxMap(a.extra, b.extra), sk,
    badges: [...new Set([...(a.badges || []), ...(b.badges || [])])],
    t: Math.max(a.t || 0, b.t || 0), dv: Math.min(a.dv || 1, b.dv || 1),
  };
}
export const blankState = () => blank();
export const isEmpty = (s) => !s || !Object.keys(s.cards || {}).length;

// Dipanggil setiap kali progres berubah (dipakai untuk sinkron ke akun).
let saveHook = null;
export const onSave = (f) => { saveHook = f; };
export function save() { st.t = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { canStore = false; } saveHook?.(); }
// Ganti progres tanpa memicu sinkron (dipakai saat menerima data dari akun).
export function setLocal(s) { st = Object.assign(blank(), s); try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { canStore = false; } }
export function replaceState(s) { st = Object.assign(blank(), s); save(); }
export function resetAll() { st = blank(); save(); }

export const card = (id) => st.cards[id];
export const level = (id) => { const x = st.cards[id]; if (!x) return 0; if (x.q !== 1) return 1; return x.iv >= MASTERED_IV ? 3 : 2; };
export function dayRec(d = today()) { const k = "d" + d; return st.days[k] || (st.days[k] = { n: 0, r: 0, ok: 0 }); }
export const newLimit = () => st.npd + (st.extra["d" + today()] || 0);

export function touchStreak() {
  const T = today();
  if (st.sk.d === T) return false;
  st.sk.n = st.sk.d === T - 1 ? st.sk.n + 1 : 1; st.sk.d = T;
  return true;
}
export const streak = () => (st.sk.d >= today() - 1 ? st.sk.n : 0);

// Simpan hasil satu ulasan.
export function rate(id, r, isNew) {
  const d = dayRec();
  if (isNew) d.n++;
  d.r++; if (r > 1) d.ok++;
  if (r === 1) st.w[id] = (st.w[id] || 0) + 1;
  st.cards[id] = schedule(st.cards[id], r);
  touchStreak();
  save();
}
