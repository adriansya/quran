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
import * as S from "./srs.js";
import { initStudy, pageStudy, pageStats, leaveStudy, coverage } from "./study.js";
S.load();
const settings = Object.assign({ showT: true, showM: true }, store.get("settings", {}));
const saveSettings = () => store.set("settings", settings);
const level = S.level;
const mushaf = () => getJSON("data/mushaf.json");
let PAGE_LABEL = {};

// ---------- util ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => (x * 100).toFixed(1).replace(".", ",") + "%";
const fmt = (n) => n.toLocaleString("id-ID");
const stripAr = (s) => s.replace(/[ً-ٰٟۖ-ۭـ]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي");
const rootSpaced = (r) => (r ? [...r].join(" ") : "—");
const audioUrl = (loc) => { const [s, a, w] = loc.split(":"); return `${AUDIO}${s.padStart(3, "0")}_${a.padStart(3, "0")}_${w.padStart(3, "0")}.mp3`; };
const play = (loc) => { new Audio(audioUrl(loc)).play().catch(() => {}); };
// Tulisan di mushaf (rasm Utsmani) bila berbeda dari ejaan standar.
const rasmHTML = (L) => (L.rasm ? `<span class="muted">Di mushaf:</span> <span class="ar">${L.rasm}</span>${L.rasmX ? ' <span class="pill khas">ejaan khas mushaf</span>' : ""}` : "");
// Info sharaf: wazan & mudhari' (fi'il), jamak & muannats (isim), catatan — sebagai pasangan <dt>/<dd>.
function sharafRows(L) {
  const r = [];
  if (L.wazan) r.push(["Wazan", `<span class="ar dar">${L.wazan}</span>${L.vform ? ` <span class="muted small">bentuk ${L.vform}</span>` : ""}`]);
  if (L.mudhari) r.push(["Mudhari'", `<span class="ar dar">${L.mudhari}</span>`]);
  if (L.jamak) r.push(["Jamak", L.jamak.map((j) => `<span class="jm"><span class="ar dar">${j.ar}</span> <span class="muted small">${esc(j.jenis)}</span>${j.wazan ? ` <span class="muted small">wazan</span> <span class="ar wz">${j.wazan}</span>` : ""}</span>`).join("")]);
  if (L.muannats) r.push(["Muannats", `<span class="ar dar">${L.muannats}</span>`]);
  if (L.catatan) r.push(["Catatan", `<span class="small">${esc(L.catatan)}</span>`]);
  if (L.dibentuk) r.push(["Catatan", `<span class="small muted">Bentuk madhi ini tidak tertulis di Al-Qur'an; disusun dari akar dan wazannya.</span>`]);
  return r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
}
const chapterName = (n) => CHAPTERS[n - 1]?.name ?? n;

function lemmaRow(L) {
  return `<a class="vitem" href="#/kata/${L.id}">
    <span class="rank" title="Urutan frekuensi: 1 = paling sering muncul">${fmt(L.id + 1)}</span>
    <span><div class="mean">${esc(L.mean.slice(0, 2).join("; ") || "—")}</div>
      <div class="meta">${esc(L.tr)} · ${L.posId}${L.vform ? " (" + L.vform + ")" : ""} · ${fmt(L.n)}×</div></span>
    <span class="ar-col"><span class="ar-stack"><span class="ar">${L.ar}</span>${L.rasm ? `<span class="ar rasm-sm" title="tulisan mushaf">${L.rasm}</span>` : ""}</span><span class="dot s${level(L.id)}" title="status hafalan"></span></span>
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
  const due = Object.values(S.st.cards).filter((s) => s.due <= Date.now()).length, sk = S.streak();
  $app.innerHTML = `
  <section class="hero">
    <div>
      <h1>Pahami Al-Qur'an, satu kata setiap hari.</h1>
      <p class="muted">Hanya <b>300 kata dasar</b> mencakup sekitar <b>74%</b> dari seluruh ${fmt(TOTAL_WORDS)} kata dalam Al-Qur'an.
      Pelajari dari yang paling sering muncul, lengkap dengan akar kata dan contoh ayat beserta terjemah Kemenag.</p>
      <div class="row"><a class="btn primary" href="#/latihan">Mulai latihan${due ? ` · ${due} perlu diulang` : ""}</a>
      <a class="btn" href="#/kosakata">Jelajahi kosakata</a></div>
      ${sk ? `<p class="small muted">🔥 ${sk} hari beruntun · <a href="#/statistik">lihat statistik</a></p>` : ""}
    </div>
    <div class="card">${curveSVG()}</div>
  </section>
  <h2>Progres kamu</h2>
  <div class="card">
    <div class="row" style="justify-content:space-between"><b>Cakupan kata yang sudah dipelajari</b><b>${pct(c.learned / TOTAL_WORDS)}</b></div>
    <div class="coverage-bar"><div style="width:${(c.learned / TOTAL_WORDS) * 100}%"></div></div>
    <div class="muted small">${fmt(c.nl)} kata dasar lulus · ${fmt(c.lrn)} sedang dipelajari · ${fmt(c.nm)} dikuasai (${pct(c.mastered / TOTAL_WORDS)} kata Al-Qur'an)</div>
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
  <p class="muted">${fmt(LEMMAS.length)} kata dasar (lemma), diurutkan dari yang paling sering muncul. Lihat juga <a href="#/akar">daftar akar kata</a>.</p>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Cari arti, latin, atau Arab…" value="${esc(state.q)}" autocomplete="off">
    <select id="pos"><option value="">Semua jenis</option>
      <option value="N">Kata benda</option><option value="V">Kata kerja</option><option value="ADJ">Kata sifat</option>
      <option value="PN">Nama diri</option><option value="PRON">Kata ganti</option><option value="P">Preposisi</option><option value="X">Partikel lain</option></select>
    <select id="st"><option value="">Semua status</option><option value="0">Belum dipelajari</option><option value="1">Sedang dipelajari</option><option value="2">Sudah lulus</option></select>
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
      if (isAr) return stripAr(L.ar).includes(qa) || stripAr(L.form).includes(qa) || (L.rasm && stripAr(L.rasm).includes(qa)) || (L.root && L.root.includes(qa.replace(/\s/g, "")));
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
  const s = S.card(id);
  $app.innerHTML = `
  <div class="lemma-head">
    <div>
      <div class="row"><span class="pill accent">${L.posId}${L.vform ? " · bentuk " + L.vform : ""}</span><span class="pill rankpill">No. ${fmt(id + 1)} terbanyak</span></div>
      <div class="meanings">${esc(L.mean.join("; ") || "—")}</div>
      <div class="muted">${esc(L.tr)} · muncul <b>${fmt(L.n)}×</b> · akar ${R ? `<a href="#/akar/${encodeURIComponent(R.bw)}" class="ar" style="font-size:20px">${rootSpaced(L.root)}</a>` : "—"}</div>
      ${sharafRows(L) ? `<dl class="det sharaf">${sharafRows(L)}</dl>` : ""}
      ${L.homo ? `<div class="small homo">Tulisannya sama dengan kata lain (homograf): ${L.homo.map((h) => `<a href="#/kata/${h}">${esc(LEMMAS[h].mean[0] || "")}</a>`).join(", ")}</div>` : ""}
      <div class="muted small">Menguasai ${id + 1} kata teratas s.d. kata ini = ${pct(cum / TOTAL_WORDS)} kata Al-Qur'an.</div>
      <div class="row" style="margin-top:12px">
        <button class="btn sm" id="play">▶ Dengarkan</button>
        <button class="btn sm ${s ? "" : "primary"}" id="learn">${s ? (level(id) === 3 ? "✓ Dikuasai" : level(id) === 2 ? "✓ Lulus · ulang " + S.fmtT(Math.max(0, s.due - Date.now())) + " lagi" : "Sedang dipelajari") : "+ Pelajari sekarang"}</button>
        ${s ? "" : `<button class="btn sm" id="known">Sudah hafal</button>`}
        ${s ? `<button class="btn sm" id="reset">Atur ulang</button>` : ""}
      </div>
    </div>
    <div class="big-wrap"><div class="ar big">${L.ar}</div>${L.rasm ? `<div class="rasm">${rasmHTML(L)}</div>` : ""}</div>
  </div>
  ${fam.length ? `<h2>Satu akar kata (${fam.length})</h2><div class="chips">${fam.slice(0, 30).map((F) => `<a class="chip" href="#/kata/${F.id}"><span class="ar">${F.ar}</span><span class="small">${esc(F.mean[0] || "")}</span></a>`).join("")}</div>` : ""}
  <h2>Contoh dalam ayat <span class="muted small">(${fmt(O.length)} kemunculan di ${fmt(groups.length)} ayat)</span></h2>
  <div id="verses"></div>
  <div class="row" style="justify-content:center;margin-top:12px"><button id="more" class="btn">Ayat lainnya</button></div>`;
  const $ = (x) => document.getElementById(x);
  $("play").onclick = () => play(O[0]);
  $("learn").onclick = () => { if (!S.card(id)) { S.st.cards[id] = { q: 0, s: 0, iv: 0, ef: 2.5, due: Date.now(), r: 0, l: 0 }; S.save(); location.hash = "#/latihan"; } };
  if ($("known")) $("known").onclick = () => { S.st.cards[id] = { q: 1, s: 0, iv: 30, ef: 2.5, due: S.dayStart(S.today() + 30), r: 1, l: 0 }; S.save(); pageLemma(id); };
  if ($("reset")) $("reset").onclick = () => { delete S.st.cards[id]; S.save(); pageLemma(id); };
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

function notFound() { $app.innerHTML = `<div class="empty"><h1>Halaman tidak ditemukan</h1><a href="#/">Kembali ke beranda</a></div>`; }

// ---------- router ----------
async function route() {
  const [path, qs] = (location.hash.slice(1) || "/").split("?");
  const q = new URLSearchParams(qs), parts = path.split("/").filter(Boolean);
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === (["kata", "akar"].includes(parts[0]) ? "kosakata" : parts[0] || "home")));
  leaveStudy();
  try {
    switch (parts[0]) {
      case undefined: pageHome(); break;
      case "kosakata": pageVocab(q); break;
      case "kata": await pageLemma(+parts[1]); break;
      case "akar": parts[1] ? await pageRoot(decodeURIComponent(parts[1])) : await pageRoots(q); break;
      case "surah": parts[1] ? await pageSurah(+parts[1], q) : pageSurahList(); break;
      case "latihan": await pageStudy(); break;
      case "statistik": await pageStats(); break;
      default: notFound();
    }
  } catch (e) { console.error(e); $app.innerHTML = `<div class="empty"><h1>Gagal memuat</h1><p class="muted">${esc(e.message)}</p></div>`; }
  if (!q.get("a")) window.scrollTo(0, 0);
}

(async () => {
  let M;
  [LEMMAS, CHAPTERS, M] = await Promise.all([getJSON("data/lemmas.json"), getJSON("data/chapters.json"), mushaf()]);
  // pindahkan progres lama ke nomor kata versi terbaru, bertahap (v1 -> v2 -> v3)
  if (!Object.keys(S.st.cards).length) { S.st.dv = S.DATA_VERSION; S.save(); }
  while (S.st.dv < S.DATA_VERSION) S.remapIds(await getJSON(`data/remap-v${S.st.dv}.json`));
  for (const sn in M) M[sn].p.forEach((p, i) => { if (!PAGE_LABEL[p]) PAGE_LABEL[p] = `${CHAPTERS[sn - 1].name} ${i + 1}`; });
  const fat = await surah(1);
  initStudy({
    app: $app, LEMMAS, CHAPTERS, TOTAL_WORDS, occ, mushaf, verseHTML, esc, fmt, pct, rootSpaced, play,
    pageLabel: (p) => PAGE_LABEL[p] || "", rasmHTML, sharafRows, surahLemmas: { 1: [...new Set(fat.flatMap((v) => v.w.map((w) => w[3])))] },
  });
  window.addEventListener("hashchange", route);
  route();
})();
