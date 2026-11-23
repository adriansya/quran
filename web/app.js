// Kosakata Al-Qur'an — single-page app statis (tanpa build step).
const $app = document.getElementById("app");
const TOTAL_WORDS = 77429;
const AUDIO = "https://audio.qurancdn.com/wbw/";

// ---------- data ----------
const cache = new Map();
const getJSON = (p) => {
  if (!cache.has(p)) cache.set(p, fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); }));
  return cache.get(p);
};
let LEMMAS = [], CHAPTERS = [];
const surah = (n) => getJSON(`data/surah/${String(n).padStart(3, "0")}.json`);
const occ = () => getJSON("data/occ.json");
const roots = () => getJSON("data/roots.json");

// ---------- penyimpanan progres (per perangkat) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("kq." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("kq." + k, JSON.stringify(v)); } catch { /* mode privat */ } },
};
let SRS = store.get("srs", {}); // id -> {iv: hari, due: ms, reps}
const settings = Object.assign({ newPerDay: 10, contentOnly: false, showT: true, showM: true }, store.get("settings", {}));
const saveSRS = () => store.set("srs", SRS);
const saveSettings = () => store.set("settings", settings);
const DAY = 864e5;
const level = (id) => { const s = SRS[id]; if (!s) return 0; return s.iv >= 21 ? 3 : s.iv >= 4 ? 2 : 1; };
function coverage() {
  let learned = 0, mastered = 0, nl = 0, nm = 0;
  for (const id in SRS) {
    const L = LEMMAS[id], lv = level(id);
    if (!L || !lv) continue;
    learned += L.n; nl++;
    if (lv >= 2) { mastered += L.n; nm++; }
  }
  return { learned, mastered, nl, nm };
}

// ---------- util ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x * 100).toFixed(1).replace(".", ",") + "%";
const fmt = (n) => n.toLocaleString("id-ID");
const stripAr = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي");
const rootSpaced = (r) => (r ? [...r].join(" ") : "—");
const CONTENT_POS = new Set(["N", "V", "ADJ", "PN"]);
const audioUrl = (loc) => { const [s, a, w] = loc.split(":"); return `${AUDIO}${s.padStart(3, "0")}_${a.padStart(3, "0")}_${w.padStart(3, "0")}.mp3`; };
const play = (loc) => { new Audio(audioUrl(loc)).play().catch(() => {}); };
const chapterName = (n) => CHAPTERS[n - 1]?.name ?? n;

function lemmaRow(L) {
  return `<a class="vitem" href="#/kata/${L.id}">
    <span class="rank">#${L.id + 1}</span>
    <span><div class="mean">${esc(L.mean.slice(0, 2).join("; ") || "—")}</div>
      <div class="meta">${esc(L.tr)} · ${L.posId}${L.vform ? " (" + L.vform + ")" : ""} · ${fmt(L.n)}×</div></span>
    <span class="ar-col"><span class="ar">${L.ar}</span><span class="dot s${level(L.id)}" title="status hafalan"></span></span>
  </a>`;
}

// ---------- halaman ----------
function curveSVG() {
  const W = 420, H = 170, P = 30, max = 2000;
  let cum = 0; const pts = [];
  for (let i = 0; i < max; i++) { cum += LEMMAS[i].n; if (i % 10 === 0 || i === max - 1) pts.push([i + 1, cum / TOTAL_WORDS]); }
  const x = (i) => P + (i / max) * (W - P - 10), y = (v) => H - P - v * (H - P - 10);
  const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const marks = [100, 300, 1000].map((m) => { let c = 0; for (let i = 0; i < m; i++) c += LEMMAS[i].n; return [m, c / TOTAL_WORDS]; });
  return `<svg class="curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kurva cakupan kosakata">
    <line class="ax" x1="${P}" y1="${H - P}" x2="${W - 10}" y2="${H - P}"/><line class="ax" x1="${P}" y1="10" x2="${P}" y2="${H - P}"/>
    <path class="area" d="${d}L${x(max)},${y(0)}L${x(0)},${y(0)}Z"/><path d="${d}"/>
    ${marks.map(([m, v]) => `<circle cx="${x(m)}" cy="${y(v)}" r="4"/><text x="${x(m) + 6}" y="${y(v) + 14}">${m} kata → ${Math.round(v * 100)}%</text>`).join("")}
    <text x="${P}" y="${H - 10}">0</text><text x="${W - 10}" y="${H - 10}" text-anchor="end">${max} lemma</text>
    <text x="2" y="16">100%</text>
  </svg>`;
}

function pageHome() {
  const c = coverage();
  const due = Object.values(SRS).filter((s) => s.due <= Date.now()).length;
  $app.innerHTML = `
  <section class="hero">
    <div>
      <h1>Pahami Al-Qur'an, satu kata setiap hari.</h1>
      <p class="muted">Hanya <b>300 kata dasar</b> mencakup sekitar <b>74%</b> dari seluruh ${fmt(TOTAL_WORDS)} kata dalam Al-Qur'an.
      Pelajari dari yang paling sering muncul, lengkap dengan akar kata dan contoh ayat beserta terjemah Kemenag.</p>
      <div class="row"><a class="btn primary" href="#/latihan">Mulai latihan${due ? ` · ${due} perlu diulang` : ""}</a>
      <a class="btn" href="#/kosakata">Jelajahi kosakata</a></div>
    </div>
    <div class="card">${curveSVG()}</div>
  </section>
  <h2>Progres kamu</h2>
  <div class="card">
    <div class="row" style="justify-content:space-between"><b>Cakupan kata yang sudah dipelajari</b><b>${pct(c.learned / TOTAL_WORDS)}</b></div>
    <div class="coverage-bar"><div style="width:${(c.learned / TOTAL_WORDS) * 100}%"></div></div>
    <div class="muted small">${fmt(c.nl)} lemma dipelajari · ${fmt(c.nm)} lemma sudah mantap (${pct(c.mastered / TOTAL_WORDS)} kata Al-Qur'an)</div>
  </div>
  <div class="grid stats" style="margin-top:12px">
    <div class="card stat"><div class="v">${fmt(TOTAL_WORDS)}</div><div class="k">kata dalam Al-Qur'an</div></div>
    <div class="card stat"><div class="v">${fmt(LEMMAS.length)}</div><div class="k">lemma (kata dasar)</div></div>
    <div class="card stat"><div class="v">1.642</div><div class="k">akar kata</div></div>
    <div class="card stat"><div class="v">114</div><div class="k">surah, kata per kata</div></div>
  </div>
  <h2>10 kata paling sering</h2>
  <div class="vlist">${LEMMAS.slice(0, 10).map(lemmaRow).join("")}</div>`;
}

function pageVocab(q) {
  const state = { q: q.get("q") || "", pos: q.get("pos") || "", st: q.get("st") || "", limit: 100 };
  $app.innerHTML = `<h1>Kosakata</h1>
  <p class="muted">${fmt(LEMMAS.length)} lemma, diurutkan dari yang paling sering muncul.</p>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Cari arti, latin, atau Arab…" value="${esc(state.q)}" autocomplete="off">
    <select id="pos"><option value="">Semua jenis</option>
      <option value="N">Kata benda</option><option value="V">Kata kerja</option><option value="ADJ">Kata sifat</option>
      <option value="PN">Nama diri</option><option value="PRON">Kata ganti</option><option value="P">Preposisi</option><option value="X">Partikel lain</option></select>
    <select id="st"><option value="">Semua status</option><option value="0">Belum dipelajari</option><option value="1">Sedang dipelajari</option><option value="2">Sudah mantap</option></select>
  </div>
  <div id="count" class="muted small"></div>
  <div id="list" class="vlist" style="margin-top:8px"></div>
  <div class="row" style="justify-content:center;margin-top:12px"><button id="more" class="btn">Tampilkan lebih banyak</button></div>`;
  const $ = (id) => document.getElementById(id);
  $("pos").value = state.pos; $("st").value = state.st;
  const MAIN = new Set(["N", "V", "ADJ", "PN", "PRON", "P"]);
  function filtered() {
    const qs = state.q.trim().toLowerCase(), qa = stripAr(qs);
    const isAr = /[؀-ۿ]/.test(qs);
    return LEMMAS.filter((L) => {
      if (state.pos && (state.pos === "X" ? MAIN.has(L.pos) : L.pos !== state.pos)) return false;
      if (state.st !== "") { const lv = level(L.id); if (state.st === "2" ? lv < 2 : String(Math.min(lv, 2)) !== state.st) return false; }
      if (!qs) return true;
      if (isAr) return stripAr(L.ar).includes(qa) || stripAr(L.form).includes(qa) || (L.root && L.root.includes(qa.replace(/\s/g, "")));
      return L.mean.some((m) => m.toLowerCase().includes(qs)) || L.tr.toLowerCase().includes(qs);
    });
  }
  function render() {
    const items = filtered();
    $("count").textContent = `${fmt(items.length)} hasil`;
    $("list").innerHTML = items.slice(0, state.limit).map(lemmaRow).join("") || `<div class="empty muted">Tidak ada hasil.</div>`;
    $("more").style.display = items.length > state.limit ? "" : "none";
    const p = new URLSearchParams(); if (state.q) p.set("q", state.q); if (state.pos) p.set("pos", state.pos); if (state.st) p.set("st", state.st);
    history.replaceState(null, "", "#/kosakata" + (p.toString() ? "?" + p : ""));
  }
  let t; $("q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.limit = 100; render(); }, 150); });
  $("pos").onchange = (e) => { state.pos = e.target.value; state.limit = 100; render(); };
  $("st").onchange = (e) => { state.st = e.target.value; state.limit = 100; render(); };
  $("more").onclick = () => { state.limit += 200; render(); };
  render();
}

// locs: satu lokasi "s:a:k" atau beberapa lokasi dalam ayat yang sama
async function verseHTML(locs) {
  locs = [].concat(locs);
  const [s, a] = locs[0].split(":").map(Number);
  const hl = new Set(locs.map((l) => +l.split(":")[2]));
  const v = (await surah(s))[a - 1];
  const ar = v.w.map((x, i) => (hl.has(i + 1) ? `<mark>${x[0]}</mark>` : x[0])).join(" ");
  return `<div class="verse"><div class="ref"><a href="#/surah/${s}?a=${a}">QS ${chapterName(s)} ${s}:${a}</a></div>
    <div class="ar">${ar}</div><div class="tr">${esc(v.t)}</div></div>`;
}

async function pageLemma(id) {
  const L = LEMMAS[id];
  if (!L) return notFound();
  const O = (await occ())[id];
  const groups = []; // kelompokkan per ayat agar ayat tidak berulang
  for (const loc of O) {
    const key = loc.split(":").slice(0, 2).join(":");
    if (groups.length && groups[groups.length - 1].key === key) groups[groups.length - 1].locs.push(loc);
    else groups.push({ key, locs: [loc] });
  }
  const R = L.root ? (await roots()).find((r) => r.root === L.root) : null;
  const fam = R ? R.lemmas.filter((x) => x !== L.id).map((x) => LEMMAS[x]) : [];
  const cum = LEMMAS.slice(0, id + 1).reduce((a, x) => a + x.n, 0);
  const s = SRS[id];
  $app.innerHTML = `
  <div class="lemma-head">
    <div>
      <div class="row"><span class="pill accent">${L.posId}${L.vform ? " · bentuk " + L.vform : ""}</span><span class="pill">peringkat #${id + 1}</span></div>
      <div class="meanings">${esc(L.mean.join("; ") || "—")}</div>
      <div class="muted">${esc(L.tr)} · muncul <b>${fmt(L.n)}×</b> · akar ${R ? `<a href="#/akar/${encodeURIComponent(R.bw)}" class="ar" style="font-size:20px">${rootSpaced(L.root)}</a>` : "—"}</div>
      <div class="muted small">Menguasai ${id + 1} kata teratas s.d. kata ini = ${pct(cum / TOTAL_WORDS)} kata Al-Qur'an.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn sm" id="play">▶ Dengarkan</button>
        <button class="btn sm ${s ? "" : "primary"}" id="learn">${s ? (level(id) >= 2 ? "✓ Sudah mantap" : "Sedang dipelajari") : "+ Pelajari"}</button>
        ${s ? "" : `<button class="btn sm" id="known">Sudah hafal</button>`}
        ${s ? `<button class="btn sm" id="reset">Atur ulang</button>` : ""}
      </div>
    </div>
    <div class="ar big">${L.ar}</div>
  </div>
  ${fam.length ? `<h2>Satu akar kata (${fam.length})</h2><div class="chips">${fam.slice(0, 30).map((F) => `<a class="chip" href="#/kata/${F.id}"><span class="ar">${F.ar}</span><span class="small">${esc(F.mean[0] || "")}</span></a>`).join("")}</div>` : ""}
  <h2>Contoh dalam ayat <span class="muted small">(${fmt(O.length)} kemunculan di ${fmt(groups.length)} ayat)</span></h2>
  <div id="verses"></div>
  <div class="row" style="justify-content:center;margin-top:12px"><button id="more" class="btn">Ayat lainnya</button></div>`;
  const $ = (x) => document.getElementById(x);
  $("play").onclick = () => play(O[0]);
  $("learn").onclick = () => { if (!SRS[id]) { SRS[id] = { iv: 0, due: Date.now(), reps: 0 }; saveSRS(); pageLemma(id); } };
  if ($("known")) $("known").onclick = () => { SRS[id] = { iv: 30, due: Date.now() + 30 * DAY, reps: 1 }; saveSRS(); pageLemma(id); };
  if ($("reset")) $("reset").onclick = () => { delete SRS[id]; saveSRS(); pageLemma(id); };
  let shown = 0;
  async function more() {
    const next = groups.slice(shown, shown + 10); shown += next.length;
    const html = await Promise.all(next.map((g) => verseHTML(g.locs)));
    $("verses").insertAdjacentHTML("beforeend", html.join(""));
    $("more").style.display = shown < groups.length ? "" : "none";
  }
  $("more").onclick = more;
  await more();
}

async function pageRoots(q) {
  const R = await roots();
  $app.innerHTML = `<h1>Akar kata</h1>
  <p class="muted">${fmt(R.length)} akar. Kata-kata Arab dibentuk dari akar 3–4 huruf; mempelajari akar membantu menebak arti kata baru.</p>
  <div class="toolbar"><input id="q" type="search" placeholder="Cari akar (mis. ك ت ب) atau arti…" value="${esc(q.get("q") || "")}"></div>
  <div id="list" class="rgrid"></div>`;
  const render = (qs) => {
    qs = qs.trim(); const qa = stripAr(qs).replace(/\s/g, ""), isAr = /[؀-ۿ]/.test(qs), ql = qs.toLowerCase();
    const items = R.filter((r) => !qs || (isAr ? r.root.includes(qa) : r.lemmas.some((id) => LEMMAS[id].mean.some((m) => m.toLowerCase().includes(ql)))));
    document.getElementById("list").innerHTML = items.slice(0, 300).map((r) => `<a class="rcard" href="#/akar/${encodeURIComponent(r.bw)}">
      <div class="ar">${rootSpaced(r.root)}</div><div class="small">${esc(LEMMAS[r.lemmas[0]].mean[0] || "")}</div>
      <div class="muted small">${fmt(r.n)}× · ${r.lemmas.length} kata</div></a>`).join("") || `<div class="empty muted">Tidak ada hasil.</div>`;
  };
  let t; document.getElementById("q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => render(e.target.value), 150); });
  render(q.get("q") || "");
}

async function pageRoot(bw) {
  const r = (await roots()).find((x) => x.bw === bw);
  if (!r) return notFound();
  $app.innerHTML = `<p><a href="#/akar">← Semua akar</a></p>
  <div class="row" style="justify-content:space-between"><h1>Akar <span class="ar" style="letter-spacing:.2em">${rootSpaced(r.root)}</span></h1>
  <span class="pill accent">${fmt(r.n)} kemunculan · ${r.lemmas.length} kata</span></div>
  <div class="vlist">${r.lemmas.map((id) => lemmaRow(LEMMAS[id])).join("")}</div>`;
}

function pageSurahList() {
  $app.innerHTML = `<h1>Baca per surah</h1><p class="muted">Kata per kata dengan arti, transliterasi, dan terjemah Kemenag. Ketuk kata untuk melihat kosakatanya.</p>
  <div class="toolbar"><input id="q" type="search" placeholder="Cari surah…"></div><div id="list" class="slist"></div>`;
  const render = (qs) => {
    qs = qs.toLowerCase();
    document.getElementById("list").innerHTML = CHAPTERS.filter((c) => !qs || `${c.n} ${c.name} ${c.arti}`.toLowerCase().includes(qs)).map((c) => `
      <a class="scard" href="#/surah/${c.n}"><span class="num">${c.n}</span>
      <span><b>${esc(c.name)}</b><div class="muted small">${esc(c.arti)} · ${c.ayat} ayat</div></span><span class="ar">${c.ar}</span></a>`).join("");
  };
  document.getElementById("q").addEventListener("input", (e) => render(e.target.value));
  render("");
}

async function pageSurah(n, q) {
  const c = CHAPTERS[n - 1]; if (!c) return notFound();
  const V = await surah(n);
  $app.innerHTML = `<p><a href="#/surah">← Semua surah</a></p>
  <div class="row" style="justify-content:space-between"><div><h1 style="margin-bottom:0">${c.n}. ${esc(c.name)}</h1>
  <div class="muted">${esc(c.arti)} · ${c.ayat} ayat · ${c.place === "makkah" ? "Makkiyah" : "Madaniyah"}</div></div>
  <div class="ar" style="font-size:36px">${c.ar}</div></div>
  <div class="toolbar"><label class="small"><input type="checkbox" id="m" ${settings.showM ? "checked" : ""}> Arti per kata</label>
  <label class="small"><input type="checkbox" id="t" ${settings.showT ? "checked" : ""}> Transliterasi</label></div>
  <div id="ayat" class="${settings.showM ? "" : "hide-m"} ${settings.showT ? "" : "hide-t"}">${V.map((v) => `
    <div class="ayah" id="a${v.n}"><span class="num">${v.n}</span>
      <div class="words">${v.w.map((w) => `<a class="word ${level(w[3]) >= 2 ? "known" : ""}" href="#/kata/${w[3]}"><span class="ar">${w[0]}</span><span class="m">${esc(w[1])}</span><span class="t">${esc(w[2])}</span></a>`).join("")}</div>
      <div class="tr">${esc(v.t)}</div></div>`).join("")}</div>
  <div class="row" style="justify-content:space-between;margin-top:16px">
    ${n > 1 ? `<a class="btn" href="#/surah/${n - 1}">← ${esc(CHAPTERS[n - 2].name)}</a>` : "<span></span>"}
    ${n < 114 ? `<a class="btn" href="#/surah/${n + 1}">${esc(CHAPTERS[n].name)} →</a>` : ""}</div>`;
  const box = document.getElementById("ayat");
  document.getElementById("m").onchange = (e) => { settings.showM = e.target.checked; saveSettings(); box.classList.toggle("hide-m", !settings.showM); };
  document.getElementById("t").onchange = (e) => { settings.showT = e.target.checked; saveSettings(); box.classList.toggle("hide-t", !settings.showT); };
  const a = q.get("a"); if (a) document.getElementById("a" + a)?.scrollIntoView({ block: "center" });
}

// ---------- latihan (spaced repetition sederhana) ----------
function buildQueue() {
  const now = Date.now();
  const due = Object.entries(SRS).filter(([, s]) => s.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => +id);
  const today = new Date().toDateString();
  const log = store.get("newlog", { day: today, n: 0 });
  if (log.day !== today) { log.day = today; log.n = 0; store.set("newlog", log); }
  const fresh = [];
  for (const L of LEMMAS) {
    if (fresh.length >= Math.max(0, settings.newPerDay - log.n)) break;
    if (SRS[L.id] || !L.mean.length) continue;
    if (settings.contentOnly && !CONTENT_POS.has(L.pos)) continue;
    fresh.push(L.id);
  }
  return { due, fresh };
}

function grade(id, g) { // g: 0 lupa, 1 ingat, 2 mudah
  const isNew = !SRS[id];
  const s = SRS[id] || { iv: 0, due: 0, reps: 0 };
  if (isNew) { const log = store.get("newlog", { day: new Date().toDateString(), n: 0 }); log.n++; store.set("newlog", log); }
  if (g === 0) { s.iv = 0; s.due = Date.now() + 60e3; }
  else { s.iv = s.iv < 1 ? (g === 2 ? 4 : 1) : Math.round(s.iv * (g === 2 ? 3.5 : 2.5)); s.due = Date.now() + s.iv * DAY; }
  s.reps++; SRS[id] = s; saveSRS();
}

function pagePractice() {
  let mode = store.get("mode", "kartu");
  const { due, fresh } = buildQueue();
  let queue = [...due, ...fresh], done = 0;
  const total = queue.length;
  $app.innerHTML = `<div class="study">
    <div class="row" style="justify-content:space-between"><h1 style="margin:16px 0 4px">Latihan</h1>
      <div class="tabs"><button data-m="kartu">Kartu</button><button data-m="kuis">Kuis</button></div></div>
    <div class="muted small">${due.length} ulangan · ${fresh.length} kata baru hari ini</div>
    <div class="progress" style="margin:10px 0"><div id="bar" style="width:0"></div></div>
    <div id="stage"></div>
    <details class="card" style="margin-top:16px"><summary><b>Pengaturan</b></summary>
      <div class="toolbar" style="margin-bottom:0"><label class="row small">Kata baru per hari
        <select id="npd">${[5, 10, 15, 20, 30, 50].map((x) => `<option ${x === settings.newPerDay ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="row small"><input type="checkbox" id="co" ${settings.contentOnly ? "checked" : ""}> Hanya kata benda/kerja/sifat</label></div>
    </details></div>`;
  const $ = (x) => document.getElementById(x);
  document.querySelectorAll(".tabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.m === mode);
    b.onclick = () => { mode = b.dataset.m; store.set("mode", mode); document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); next(); };
  });
  $("npd").onchange = (e) => { settings.newPerDay = +e.target.value; saveSettings(); pagePractice(); };
  $("co").onchange = (e) => { settings.contentOnly = e.target.checked; saveSettings(); pagePractice(); };

  function finish(id, g) {
    grade(id, g); queue.shift();
    if (g === 0) queue.push(id); else done++;
    $("bar").style.width = (done / Math.max(total, 1)) * 100 + "%";
    next();
  }
  function next() {
    const id = queue[0];
    if (id === undefined) {
      const c = coverage();
      $("stage").innerHTML = `<div class="card empty"><div style="font-size:40px">🌿</div><h2>Selesai untuk hari ini</h2>
        <p class="muted">Kamu sudah mempelajari ${fmt(c.nl)} lemma, mencakup <b>${pct(c.learned / TOTAL_WORDS)}</b> kata Al-Qur'an.</p>
        <div class="row" style="justify-content:center"><a class="btn" href="#/surah/1">Baca Al-Fatihah</a><a class="btn" href="#/kosakata">Lihat kosakata</a></div></div>`;
      return;
    }
    const L = LEMMAS[id], isNew = !SRS[id];
    if (mode === "kuis" && !isNew) return quiz(L);
    card(L, isNew);
  }
  function card(L, isNew) {
    $("stage").innerHTML = `<div class="card flash">
      ${isNew ? `<div><span class="pill accent">kata baru · #${L.id + 1}</span></div>` : ""}
      <div class="ar big">${L.ar}</div><div class="muted">${esc(L.tr)}</div>
      <div id="ans" class="answer" hidden><div class="meanings">${esc(L.mean.join("; "))}</div>
        <div class="muted small">${L.posId} · akar ${rootSpaced(L.root)} · ${fmt(L.n)}× dalam Al-Qur'an</div>
        <div id="ex" class="small" style="text-align:right"></div></div>
      <button id="show" class="btn primary">Tampilkan arti</button>
      <div id="gr" class="grade" hidden>
        <button class="btn again" data-g="0">Lupa<small>&lt;1 menit</small></button>
        <button class="btn good" data-g="1">Ingat<small>${isNew ? "1 hari" : Math.round((SRS[L.id]?.iv || 1) * 2.5) + " hari"}</small></button>
        <button class="btn easy" data-g="2">Mudah<small>${isNew ? "4 hari" : Math.round((SRS[L.id]?.iv || 1) * 3.5) + " hari"}</small></button>
      </div></div>`;
    const reveal = async () => {
      $("ans").hidden = false; $("show").hidden = true; $("gr").hidden = false;
      const o = (await occ())[L.id][0]; play(o);
      $("ex").innerHTML = await verseHTML(o);
    };
    $("show").onclick = reveal;
    $("gr").querySelectorAll("button").forEach((b) => (b.onclick = () => finish(L.id, +b.dataset.g)));
  }
  function quiz(L) {
    const pool = LEMMAS.slice(Math.max(0, L.id - 60), L.id + 60).filter((x) => x.id !== L.id && x.mean[0] && x.mean[0] !== L.mean[0]);
    const same = pool.filter((x) => x.pos === L.pos);
    const src = same.length >= 3 ? same : pool, opts = new Set();
    while (opts.size < 3 && opts.size < src.length) opts.add(src[Math.floor(Math.random() * src.length)].mean[0]);
    const choices = [...opts, L.mean[0]].sort(() => Math.random() - 0.5);
    $("stage").innerHTML = `<div class="card flash"><div class="muted small">Apa arti kata ini?</div>
      <div class="ar big">${L.ar}</div><div class="muted">${esc(L.tr)}</div>
      <div class="opts">${choices.map((c) => `<button class="btn opt">${esc(c)}</button>`).join("")}</div>
      <div id="fb" class="small"></div></div>`;
    document.querySelectorAll(".opt").forEach((b) => (b.onclick = () => {
      const ok = b.textContent === L.mean[0];
      document.querySelectorAll(".opt").forEach((x) => { x.disabled = true; if (x.textContent === L.mean[0]) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      $("fb").innerHTML = `<p>${ok ? "✓ Benar!" : "✗ Belum tepat."} <b>${esc(L.mean.join("; "))}</b></p><button class="btn primary" id="go">Lanjut</button>`;
      $("go").onclick = () => finish(L.id, ok ? 1 : 0);
    }));
  }
  next();
}

function notFound() { $app.innerHTML = `<div class="empty"><h1>Halaman tidak ditemukan</h1><a href="#/">Kembali ke beranda</a></div>`; }

// ---------- router ----------
async function route() {
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const q = new URLSearchParams(qs), parts = path.split("/").filter(Boolean);
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === (parts[0] === "kata" ? "kosakata" : parts[0] || "home")));
  try {
    switch (parts[0]) {
      case undefined: pageHome(); break;
      case "kosakata": pageVocab(q); break;
      case "kata": await pageLemma(+parts[1]); break;
      case "akar": parts[1] ? await pageRoot(decodeURIComponent(parts[1])) : await pageRoots(q); break;
      case "surah": parts[1] ? await pageSurah(+parts[1], q) : pageSurahList(); break;
      case "latihan": pagePractice(); break;
      default: notFound();
    }
  } catch (e) { console.error(e); $app.innerHTML = `<div class="empty"><h1>Gagal memuat</h1><p class="muted">${esc(e.message)}</p></div>`; }
  if (!q.get("a")) window.scrollTo(0, 0);
}

(async () => {
  [LEMMAS, CHAPTERS] = await Promise.all([getJSON("data/lemmas.json"), getJSON("data/chapters.json")]);
  window.addEventListener("hashchange", route);
  route();
})();
