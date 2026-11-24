// Halaman Latihan (SRS + pilihan ganda) dan Statistik.
import * as S from "./srs.js";

let C; // konteks dari app.js: data & util bersama
export const initStudy = (ctx) => { C = ctx; };

const KELAS = { f: "Fi'il", i: "Isim", h: "Harf" };
const KIND = { n: "baru", l: "belajar", r: "ulang", x: "latihan" };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const answerOf = (L) => L.mean[0];

// ---------- indeks kemunculan per halaman/juz (dibangun sekali) ----------
let IDX = null;
export async function index() {
  if (IDX) return IDX;
  const [O, M] = await Promise.all([C.occ(), C.mushaf()]);
  const occ = [], juzTok = new Array(31).fill(0), juzLem = Array.from({ length: 31 }, () => new Map());
  const pageJuz = {}, juzPages = Array.from({ length: 31 }, () => new Set());
  for (const s in M) M[s].p.forEach((p, i) => { pageJuz[p] = M[s].j[i]; juzPages[M[s].j[i]].add(p); });
  O.forEach((locs, id) => {
    occ[id] = locs.map((loc) => {
      const [s, a, w] = loc.split(":").map(Number);
      const p = M[s].p[a - 1], j = M[s].j[a - 1];
      juzTok[j]++; juzLem[j].set(id, (juzLem[j].get(id) || 0) + 1);
      return { loc, key: s * 1e6 + a * 1e3 + w, p, j };
    });
  });
  IDX = { occ, juzTok, juzLem, pageJuz, juzPages: juzPages.map((x) => [...x].sort((a, b) => a - b)), O };
  return IDX;
}

// ---------- kumpulan kartu ----------
const inType = (L) => (S.st.scope === "all" || L.k === S.st.scope) && L.mean.length > 0;
const inRange = (o, src) => (src[0] === "j" ? o.j === +src.slice(1) : o.p === +src.slice(1));
let newCache = { key: "", list: [] };
function newPool() {
  const src = S.st.src, key = src + "|" + S.st.scope;
  if (newCache.key !== key) {
    let list;
    if (src === "freq") list = C.LEMMAS.filter(inType).map((L) => L.id);
    else {
      const first = [];
      IDX.occ.forEach((os, id) => {
        if (!inType(C.LEMMAS[id])) return;
        let k = Infinity;
        for (const o of os) if (inRange(o, src) && o.key < k) k = o.key;
        if (k < Infinity) first.push([k, id]);
      });
      list = first.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    }
    newCache = { key, list };
  }
  return newCache.list.filter((id) => !S.card(id));
}
const reviewPool = () => Object.keys(S.st.cards).map(Number).filter((id) => inType(C.LEMMAS[id]));

function counts(now = Date.now()) {
  let lrn = 0, rev = 0;
  for (const id of reviewPool()) {
    const x = S.card(id);
    if (x.q === 1) { if (x.due <= now) rev++; } else if (x.due <= now + 20 * S.MIN) lrn++;
  }
  const nw = Math.max(0, Math.min(S.newLimit() - S.dayRec().n, newPool().length));
  return { nw, lrn, rev };
}
function pick(cur, now = Date.now()) {
  let lrnDue = null, revDue = null, lrnSoon = null;
  for (const id of reviewPool()) {
    const x = S.card(id);
    if (x.q !== 1) {
      if (x.due <= now) { if (!lrnDue || x.due < lrnDue.x.due) lrnDue = { id, x }; }
      else if (x.due <= now + 20 * S.MIN && (!lrnSoon || x.due < lrnSoon.x.due)) lrnSoon = { id, x };
    } else if (x.due <= now && (!revDue || x.due < revDue.x.due)) revDue = { id, x };
  }
  if (lrnDue && (lrnDue.id !== cur || !revDue)) return { id: lrnDue.id, kind: "l" };
  if (revDue) return { id: revDue.id, kind: "r" };
  if (counts(now).nw > 0) { const id = newPool()[0]; if (id !== undefined) return { id, kind: "n" }; }
  if (lrnDue) return { id: lrnDue.id, kind: "l" };
  if (lrnSoon) return { id: lrnSoon.id, kind: "l", wait: lrnSoon.x.due - now };
  return null;
}
function options(L) {
  const out = [L], seen = new Set([norm(answerOf(L))]);
  const ok = (M) => M !== L && M.mean.length && !seen.has(norm(answerOf(M))) && !L.mean.some((m) => norm(m) === norm(answerOf(M))) && (!L.root || M.root !== L.root) && M.ar !== L.ar;
  const near = C.LEMMAS.slice(Math.max(0, L.id - 80), L.id + 80).filter((M) => M.k === L.k);
  for (const pool of [shuffle(near), shuffle(C.LEMMAS.slice(0, 1500).filter((M) => M.k === L.k)), shuffle(C.LEMMAS.slice(0, 1500))])
    for (const M of pool) { if (out.length >= 4) break; if (ok(M)) { out.push(M); seen.add(norm(answerOf(M))); } }
  return shuffle(out);
}

// ---------- capaian (gamifikasi) ----------
function coverage() {
  let learned = 0, mastered = 0, nl = 0, nm = 0, lrn = 0;
  for (const id in S.st.cards) {
    const lv = S.level(id), n = C.LEMMAS[id]?.n || 0;
    if (lv === 1) lrn++;
    if (lv >= 2) { learned += n; nl++; }
    if (lv === 3) { mastered += n; nm++; }
  }
  return { learned, mastered, nl, nm, lrn };
}
export { coverage };
function juzStats() {
  return Array.from({ length: 30 }, (_, i) => {
    const j = i + 1, lem = IDX.juzLem[j];
    let tok = 0, nl = 0;
    for (const [id, n] of lem) if (S.level(id) >= 2) { tok += n; nl++; }
    return { j, tok, total: IDX.juzTok[j], nl, lemmas: lem.size };
  });
}
function badgeDefs() {
  const cv = coverage(), sk = S.streak(), js = juzStats();
  const d = [];
  for (const n of [10, 25, 50, 100, 250, 500, 1000, 2000]) d.push({ id: "n" + n, t: `${C.fmt(n)} kata`, s: `Lulus ${n} kata`, ok: cv.nl >= n });
  for (const p of [25, 50, 60, 70, 80, 90]) d.push({ id: "c" + p, t: `Paham ${p}%`, s: `${p}% kata Al-Qur'an`, ok: cv.learned / C.TOTAL_WORDS * 100 >= p });
  for (const n of [3, 7, 30, 100]) d.push({ id: "s" + n, t: `${n} hari beruntun`, s: "Streak latihan", ok: sk >= n });
  const fat = C.surahLemmas?.[1];
  d.push({ id: "fatihah", t: "Al-Fātiḥah", s: "Semua kata Al-Fātiḥah", ok: !!fat && fat.every((id) => S.level(id) >= 2) });
  for (const x of js) d.push({ id: "j" + x.j, t: `Juz ${x.j} 90%`, s: `Paham 90% kata juz ${x.j}`, ok: x.tok / x.total >= 0.9, juz: true });
  return d;
}
function checkBadges() {
  const got = [];
  for (const b of badgeDefs()) if (b.ok && !S.st.badges.includes(b.id)) { S.st.badges.push(b.id); got.push(b); }
  if (got.length) { S.save(); got.forEach((b, i) => setTimeout(() => toast(`🏅 Lencana baru: <b>${C.esc(b.t)}</b> · ${C.esc(b.s)}`), i * 1800)); }
}
function toast(html) {
  const t = document.createElement("div");
  t.className = "toast"; t.innerHTML = html; document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("on"));
  setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 400); }, 3200);
}

// ---------- halaman Latihan ----------
let keyHandler = null;
document.addEventListener("keydown", (e) => { if (keyHandler && !e.target.closest?.("input,select,textarea")) keyHandler(e); });
export const leaveStudy = () => { keyHandler = null; };

export async function pageStudy() {
  C.app.innerHTML = `<p class="muted">Menyiapkan kartu…</p>`;
  await index();
  const juzName = (j) => { const p = IDX.juzPages[j][0]; return C.pageLabel(p); };
  C.app.innerHTML = `
  <section class="study-head">
    <div class="sh-top">
      <div><h1>Latihan</h1><div class="muted small" id="srcLab"></div></div>
      <div class="cnt" aria-live="polite">
        <div><b id="cNew" class="c-new">–</b><span>baru</span></div>
        <div><b id="cLrn" class="c-lrn">–</b><span>belajar</span></div>
        <div><b id="cRev" class="c-rev">–</b><span>ulang</span></div>
        <div><b id="cStk" class="c-stk">–</b><span>hari 🔥</span></div>
      </div>
    </div>
    <div class="goal"><div class="progress"><div id="goalBar"></div></div><span class="small muted" id="goalTxt"></span></div>
  </section>
  <div class="study-wrap">
    <div>
      <section class="mcard" id="card" aria-live="polite">
        <div class="q"><span class="lab" id="qLab"></span><span id="qMeta" class="small muted"></span></div>
        <div class="ar word" id="word"></div>
        <p class="hint" id="hint"></p>
        <p class="rasm" id="rasm"></p>
      </section>
      <div class="opts" id="opts" role="group" aria-label="Pilihan jawaban"></div>
      <button class="idk" id="idk" type="button">Saya belum tahu, tampilkan jawabannya</button>
      <section class="res" id="res" hidden>
        <p class="verdict" id="verdict"></p>
        <div class="rate" id="rate">
          <button type="button" data-r="1">Lagi<small id="i1"></small></button>
          <button type="button" data-r="2">Sulit<small id="i2"></small></button>
          <button type="button" data-r="3">Baik<small id="i3"></small></button>
          <button type="button" data-r="4">Mudah<small id="i4"></small></button>
        </div>
        <button class="btn primary next" id="dNext" type="button" hidden>Lanjut</button>
        <dl class="det" id="det"></dl>
        <div class="blk"><div class="cxnav"><button type="button" class="btn sm" id="cxPrev" aria-label="Ayat sebelumnya">‹</button><span id="cxLab" class="small muted"></span><button type="button" class="btn sm" id="cxNext" aria-label="Ayat berikutnya">›</button></div>
          <div id="cx"></div></div>
      </section>
      <section class="mcard done" id="done" hidden>
        <div class="done-ic">🌿</div><h2 id="doneH">Selesai untuk sekarang</h2><p id="doneTxt" class="muted"></p>
        <div class="row" style="justify-content:center">
          <button class="btn primary" id="moreNew" type="button">Pelajari 10 kata baru lagi</button>
          <button class="btn" id="drillWeak" type="button"></button>
          <button class="btn" id="drillQuick" type="button">Kuis cepat · 10 soal</button>
        </div>
      </section>
    </div>
    <aside class="side card">
      <h3>Ambil kata baru dari</h3>
      <div class="seg" id="srcMode"><button data-m="freq">Paling sering</button><button data-m="mushaf">Urut mushaf</button></div>
      <div id="mushafSel" class="row" hidden>
        <select id="juz" aria-label="Juz">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Juz ${i + 1} · ${C.esc(juzName(i + 1))}</option>`).join("")}</select>
        <select id="hal" aria-label="Halaman"></select>
      </div>
      <p class="small muted" id="srcNote"></p>
      <h3>Kata baru per hari</h3>
      <div class="seg" id="npd">${[5, 10, 20, 30].map((n) => `<button data-v="${n}">${n}</button>`).join("")}</div>
      <h3>Jenis kata</h3>
      <div class="seg" id="scope"><button data-v="all">Semua</button><button data-v="f">Fi'il</button><button data-v="i">Isim</button><button data-v="h">Harf</button></div>
      <details class="how"><summary>Cara kerja hafalannya</summary><ul class="small">
        <li>Pilih arti yang benar (A–D). Salah atau “Saya belum tahu” → kartu dinilai <b>Lagi</b> dan muncul lagi 1 menit kemudian.</li>
        <li>Kalau benar, nilai sendiri: <b>Sulit</b>, <b>Baik</b>, atau <b>Mudah</b>. Jarak ulangan berikutnya tertulis di tiap tombol.</li>
        <li>Kata baru melewati langkah 1 dan 10 menit, lalu lulus ke ulangan 1 hari. Setelah itu jaraknya makin panjang. Jarak ≥ 21 hari = <b>dikuasai</b>.</li>
        <li>Satu kartu = satu kata dasar (lemma) dari Quranic Arabic Corpus, jadi semua bentuknya (رَزَقْنَاهُمْ, يُرْزَقُونَ, …) ikut dipahami.</li>
        <li>Keyboard: A–D atau 1–4 memilih jawaban; lalu 1–4 menilai; Spasi/Enter = Baik.</li>
      </ul></details>
    </aside>
  </div>`;
  const $ = (id) => document.getElementById(id);
  let cur = null, answered = false, right = false, cxList = [], cxi = 0, drill = null, timer = null;

  // --- panel pengaturan ---
  function syncSide() {
    const mode = S.st.src === "freq" ? "freq" : "mushaf";
    $("srcMode").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
    $("npd").querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.v === S.st.npd));
    $("scope").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.st.scope));
    $("mushafSel").hidden = mode !== "mushaf";
    if (mode === "mushaf") {
      const j = S.st.src[0] === "j" ? +S.st.src.slice(1) : IDX.pageJuz[+S.st.src.slice(1)];
      $("juz").value = j;
      $("hal").innerHTML = `<option value="j${j}">Semua halaman juz ${j}</option>` + IDX.juzPages[j].map((p) => `<option value="p${p}">Hal. ${p} · ${C.esc(C.pageLabel(p))}</option>`).join("");
      $("hal").value = S.st.src;
    }
    const left = newPool().length;
    $("srcLab").textContent = mode === "freq" ? "Kata baru: paling sering muncul dulu" : `Kata baru: urut mushaf, ${S.st.src[0] === "j" ? "juz " + S.st.src.slice(1) : "hal. " + S.st.src.slice(1)}`;
    $("srcNote").textContent = left ? `${C.fmt(left)} kata baru tersisa di sumber ini.` : "Semua kata di sumber ini sudah mulai dipelajari.";
  }
  const setSrc = (src) => { S.st.src = src; S.save(); syncSide(); if (!answered && !drill) next(); };
  $("srcMode").onclick = (e) => { const m = e.target.dataset.m; if (!m) return; setSrc(m === "freq" ? "freq" : "j" + (IDX.pageJuz[+S.st.src.slice(1)] || +S.st.src.slice(1) || 1)); };
  $("juz").onchange = (e) => setSrc("j" + e.target.value);
  $("hal").onchange = (e) => setSrc(e.target.value);
  $("npd").onclick = (e) => { if (!e.target.dataset.v) return; S.st.npd = +e.target.dataset.v; S.save(); syncSide(); updateCounts(); if (!cur && !drill) next(); };
  $("scope").onclick = (e) => { if (!e.target.dataset.v) return; S.st.scope = e.target.dataset.v; S.save(); syncSide(); if (!answered && !drill) next(); };

  function updateCounts() {
    const c = counts(), d = S.dayRec();
    $("cNew").textContent = c.nw; $("cLrn").textContent = c.lrn; $("cRev").textContent = c.rev; $("cStk").textContent = S.streak();
    const total = d.r + c.nw + c.lrn + c.rev, pctDone = total ? d.r / total : 1;
    $("goalBar").style.width = pctDone * 100 + "%";
    $("goalTxt").textContent = `Hari ini: ${d.r} ulasan · ${d.n} kata baru${d.r ? ` · ${Math.round((d.ok / d.r) * 100)}% benar` : ""}`;
  }

  // --- kartu ---
  function show(L, kind) {
    cur = L.id; answered = false; right = false;
    $("done").hidden = true; $("res").hidden = true; $("idk").hidden = false;
    ["card", "opts"].forEach((x) => ($(x).hidden = false));
    $("card").classList.remove("in"); void $("card").offsetWidth; $("card").classList.add("in");
    $("qLab").innerHTML = `Apa artinya? <span class="tag ${kind}">${KIND[kind]}</span>`;
    $("qMeta").textContent = `No. ${C.fmt(L.id + 1)} · ${KELAS[L.k]}${L.homo ? " · " + L.posId : ""} · ${C.fmt(L.n)}× dalam Al-Qur'an`;
    $("word").textContent = L.ar;
    $("hint").textContent = L.tr;
    $("rasm").innerHTML = C.rasmHTML(L);
    $("opts").innerHTML = options(L).map((M, i) => `<button class="opt" type="button" data-id="${M.id}"><span class="k">${"ABCD"[i]}</span><span class="t">${C.esc(answerOf(M))}</span></button>`).join("");
    $("opts").querySelectorAll(".opt").forEach((b) => (b.onclick = () => answer(+b.dataset.id)));
  }
  function answer(choice) {
    if (answered) return;
    answered = true; right = choice === cur;
    const L = C.LEMMAS[cur];
    $("opts").querySelectorAll(".opt").forEach((b) => {
      b.disabled = true;
      if (+b.dataset.id === cur) b.classList.add("ok"); else if (+b.dataset.id === choice) b.classList.add("no");
    });
    $("idk").hidden = true; $("res").hidden = false;
    $("verdict").className = "verdict " + (right ? "ok" : "no");
    $("verdict").textContent = choice === null ? "Jawabannya:" : right ? "Benar!" : "Belum tepat.";
    if (drill) { $("rate").hidden = true; $("dNext").hidden = false; if (right) drill.right++; else S.st.w[cur] = (S.st.w[cur] || 0) + 1; }
    else if (right) {
      $("rate").hidden = false; $("dNext").hidden = true;
      const pv = S.preview(S.card(cur));
      for (const r of [1, 2, 3, 4]) { $("i" + r).textContent = S.fmtT(pv[r]); }
    } else { $("rate").hidden = true; $("dNext").hidden = false; }
    // detail kata
    $("det").innerHTML = `
      <dt>Arti</dt><dd><b>${C.esc(L.mean.join("; "))}</b></dd>
      <dt>Kata dasar</dt><dd><a href="#/kata/${L.id}" class="ar dar">${L.ar}</a> <span class="muted">${C.esc(L.tr)} · ${L.posId}${L.vform ? " " + L.vform : ""}</span></dd>
      ${L.rasm ? `<dt>Tulisan mushaf</dt><dd class="rasm-dd"><span class="ar">${L.rasm}</span>${L.rasmX ? ' <span class="pill khas">ejaan khas mushaf</span>' : ""}</dd>` : ""}
      <dt>Akar</dt><dd>${L.root ? `<span class="ar dar">${C.rootSpaced(L.root)}</span>` : "—"} <span class="muted">· muncul ${C.fmt(L.n)}×</span></dd>`;
    // konteks: utamakan ayat di sumber yang dipilih
    const os = IDX.occ[cur], src = S.st.src;
    const sorted = src === "freq" ? os : [...os.filter((o) => inRange(o, src)), ...os.filter((o) => !inRange(o, src))];
    const groups = [];
    for (const o of sorted) {
      const k = o.loc.split(":").slice(0, 2).join(":"), g = groups.find((x) => x.k === k);
      if (g) g.locs.push(o.loc); else groups.push({ k, locs: [o.loc], p: o.p });
      if (groups.length >= 40) break;
    }
    cxList = groups; cxi = 0; showCx();
    C.play(sorted[0].loc);
    updateCounts();
  }
  async function showCx() {
    const g = cxList[cxi];
    $("cxLab").textContent = `Ayat ${cxi + 1} dari ${cxList.length}${cxList.length >= 40 ? "+" : ""} · hal. ${g.p}`;
    $("cxPrev").disabled = cxi === 0; $("cxNext").disabled = cxi >= cxList.length - 1;
    $("cx").innerHTML = await C.verseHTML(g.locs);
  }
  $("cxPrev").onclick = () => { if (cxi > 0) { cxi--; showCx(); } };
  $("cxNext").onclick = () => { if (cxi < cxList.length - 1) { cxi++; showCx(); } };
  $("idk").onclick = () => answer(null);
  $("rate").querySelectorAll("button").forEach((b) => (b.onclick = () => grade(+b.dataset.r)));
  $("dNext").onclick = () => (drill ? drillNext() : grade(1));

  function grade(r) {
    if (!answered || drill) return;
    const isNew = !S.card(cur);
    S.rate(cur, r, isNew);
    checkBadges();
    next();
  }
  function next() {
    clearTimeout(timer);
    updateCounts(); syncSide();
    const p = pick(cur);
    if (!p || p.wait) return finish(p);
    show(C.LEMMAS[p.id], p.kind);
  }
  function finish(p) {
    cur = null; answered = false;
    ["card", "opts", "idk", "res"].forEach((x) => ($(x).hidden = true));
    $("done").hidden = false;
    const cv = coverage(), d = S.dayRec();
    $("doneH").textContent = p?.wait ? "Istirahat sebentar" : "Selesai untuk sekarang";
    $("doneTxt").innerHTML = (p?.wait ? `Kartu berikutnya muncul dalam ${S.fmtT(p.wait)}. ` : "") +
      `Hari ini ${d.r} ulasan, ${d.n} kata baru. Kamu sudah lulus ${C.fmt(cv.nl)} kata dasar, mencakup <b>${C.pct(cv.learned / C.TOTAL_WORDS)}</b> kata Al-Qur'an.`;
    const weak = weakPool();
    $("drillWeak").textContent = `Latih kata yang sering lupa (${weak.length})`; $("drillWeak").disabled = !weak.length;
    $("drillQuick").disabled = Object.keys(S.st.cards).length < 4;
    $("moreNew").disabled = !newPool().length;
    if (p?.wait) timer = setTimeout(next, Math.min(p.wait + 500, 2147e6));
  }
  const weakPool = () => Object.keys(S.st.cards).map(Number).filter((id) => (S.st.w[id] || 0) + (S.card(id).l || 0) > 0)
    .sort((a, b) => (S.st.w[b] || 0) + S.card(b).l - (S.st.w[a] || 0) - S.card(a).l).slice(0, 20);
  $("moreNew").onclick = () => { const k = "d" + S.today(); S.st.extra[k] = (S.st.extra[k] || 0) + 10; S.save(); next(); };
  $("drillWeak").onclick = () => startDrill("Kata yang sering lupa", weakPool());
  $("drillQuick").onclick = () => startDrill("Kuis cepat", shuffle(Object.keys(S.st.cards).map(Number)).slice(0, 10));
  function startDrill(name, ids) { drill = { name, ids, i: 0, right: 0 }; drillNext(true); }
  function drillNext(first) {
    if (!first) drill.i++;
    if (drill.i >= drill.ids.length) {
      const d = drill; drill = null; finish(null);
      $("doneH").textContent = `${d.name}: ${d.right}/${d.ids.length} benar`;
      return;
    }
    show(C.LEMMAS[drill.ids[drill.i]], "x");
    $("qMeta").textContent = `${drill.name} · ${drill.i + 1}/${drill.ids.length} · tidak mengubah jadwal`;
  }

  keyHandler = (e) => {
    const k = e.key.toLowerCase();
    if (!cur) return;
    if (!answered) {
      const i = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
      if (i >= 0) { const b = $("opts").querySelectorAll(".opt")[i]; if (b) { e.preventDefault(); b.click(); } }
      else if (k === "?" || k === "0") answer(null);
      return;
    }
    if (!$("dNext").hidden && (k === " " || k === "enter")) { e.preventDefault(); $("dNext").click(); return; }
    if (!$("rate").hidden) {
      if ("1234".includes(k) && k) { e.preventDefault(); grade(+k); }
      else if (k === " " || k === "enter") { e.preventDefault(); grade(3); }
    }
  };
  syncSide(); next();
}

// ---------- halaman Statistik ----------
export async function pageStats() {
  C.app.innerHTML = `<p class="muted">Menghitung…</p>`;
  await index();
  const cv = coverage(), js = juzStats(), sk = S.streak(), badges = badgeDefs();
  const T = S.today(), days = Array.from({ length: 30 }, (_, i) => { const d = T - 29 + i; return { d, ...(S.st.days["d" + d] || { n: 0, r: 0, ok: 0 }) }; });
  const due = Object.values(S.st.cards).filter((x) => x.due <= Date.now()).length;
  const forecast = Array.from({ length: 7 }, (_, i) => Object.values(S.st.cards).filter((x) => x.q === 1 && (i === 0 ? S.today(x.due) <= T : S.today(x.due) === T + i)).length);
  const maxR = Math.max(5, ...days.map((x) => x.r));
  const W = 600, H = 160, P = 24, bw = (W - P - 4) / 30;
  const y = (v) => H - P - (v / maxR) * (H - P - 12);
  const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ulasan 30 hari terakhir">
    <line class="ax" x1="${P}" y1="${H - P}" x2="${W}" y2="${H - P}"/>
    <text x="${P - 4}" y="${y(maxR) + 4}" text-anchor="end">${maxR}</text><text x="${P - 4}" y="${H - P}" text-anchor="end">0</text>
    ${days.map((x, i) => `<rect class="b-rev" x="${P + 2 + i * bw}" y="${y(x.r)}" width="${bw - 3}" height="${H - P - y(x.r)}"><title>${new Date(S.dayStart(x.d)).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: ${x.r} ulasan, ${x.n} baru</title></rect>
      <rect class="b-new" x="${P + 2 + i * bw}" y="${y(x.n)}" width="${bw - 3}" height="${H - P - y(x.n)}"/>`).join("")}
    <text x="${P + 2}" y="${H - 6}">30 hari lalu</text><text x="${W - 2}" y="${H - 6}" text-anchor="end">hari ini</text>
  </svg>`;
  const got = badges.filter((b) => b.ok);
  C.app.innerHTML = `<h1>Statistik</h1>
  <div class="grid stats">
    <div class="card stat"><div class="v">${C.pct(cv.learned / C.TOTAL_WORDS)}</div><div class="k">kata Al-Qur'an yang kamu pahami</div></div>
    <div class="card stat"><div class="v">${C.fmt(cv.nl)}</div><div class="k">kata dasar lulus · ${C.fmt(cv.nm)} dikuasai</div></div>
    <div class="card stat"><div class="v">${C.fmt(cv.lrn)}</div><div class="k">sedang dipelajari · ${due} jatuh tempo</div></div>
    <div class="card stat"><div class="v">${sk} 🔥</div><div class="k">hari beruntun</div></div>
  </div>
  <h2>Aktivitas 30 hari</h2>
  <div class="card"><div class="leg small"><span><i class="sw rev"></i>Ulasan</span><span><i class="sw new"></i>Kata baru</span></div>${chart}
    <div class="small muted">Jadwal ulangan 7 hari ke depan: ${forecast.map((n, i) => `${i === 0 ? "hari ini" : "+" + i}: <b>${n}</b>`).join(" · ")}</div></div>
  <h2>Pemahaman per juz</h2>
  <p class="muted small">Persentase kata di juz itu (dihitung semua kemunculan) yang kata dasarnya sudah kamu lulus. Klik untuk belajar urut mushaf dari juz tersebut.</p>
  <div class="juzgrid">${js.map((x) => { const p = x.tok / x.total; return `<a class="jz" href="#/latihan" data-j="${x.j}" style="--p:${p}">
      <b>Juz ${x.j}</b><span class="small muted">${C.esc(C.pageLabel(IDX.juzPages[x.j][0]))}</span>
      <div class="progress"><div style="width:${p * 100}%"></div></div><span class="small"><b>${Math.round(p * 100)}%</b> · ${x.nl}/${x.lemmas} kata dasar</span></a>`; }).join("")}</div>
  <h2>Lencana <span class="muted small">(${got.length}/${badges.length})</span></h2>
  <div class="badges">${badges.filter((b) => !b.juz || b.ok || [1, 2, 30].includes(+b.id.slice(1))).map((b) => `<div class="badge ${b.ok ? "on" : ""}" title="${C.esc(b.s)}"><span class="medal">${b.ok ? "🏅" : "○"}</span><b>${C.esc(b.t)}</b><span class="small muted">${C.esc(b.s)}</span></div>`).join("")}</div>
  <h2>Cadangan progres</h2>
  <div class="card"><p class="small muted" style="margin-top:0">Progres tersimpan di browser ini${S.canStore ? "" : " (penyimpanan browser tidak tersedia, progres hilang saat halaman ditutup)"}. Unduh cadangan untuk dipindah ke perangkat lain.</p>
    <div class="row"><button class="btn" id="exp">Unduh cadangan</button><label class="btn" for="imp">Pulihkan dari file</label><input type="file" id="imp" accept=".json,application/json" hidden>
    <button class="btn danger" id="rst">Hapus semua progres</button></div><p class="small" id="msg"></p></div>`;
  document.querySelectorAll(".jz[data-j]").forEach((a) => (a.onclick = () => { S.st.src = "j" + a.dataset.j; S.save(); }));
  const msg = (t) => (document.getElementById("msg").textContent = t);
  document.getElementById("exp").onclick = () => {
    const blob = new Blob([JSON.stringify({ app: "kosakata-quran", v: 2, state: S.st })], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `kosakata-quran-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove(); msg("Cadangan diunduh.");
  };
  document.getElementById("imp").onchange = async (e) => {
    try {
      const j = JSON.parse(await e.target.files[0].text());
      if (j.app !== "kosakata-quran" || !j.state?.cards) throw new Error();
      S.replaceState(j.state); msg(`Dipulihkan: ${Object.keys(j.state.cards).length} kartu.`); setTimeout(pageStats, 600);
    } catch { msg("File tidak dikenali. Pilih file cadangan dari tombol “Unduh cadangan”."); }
  };
  let armed = false;
  document.getElementById("rst").onclick = (e) => {
    if (!armed) { armed = true; e.target.textContent = "Yakin? Klik lagi untuk menghapus"; return; }
    S.resetAll(); pageStats();
  };
}
