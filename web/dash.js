// Dashboard analitik kosakata Al-Qur'an (Beranda). Grafik SVG/HTML murni, tanpa library.
// Prinsip: satu sumbu per grafik, warna mengikuti entitas (isim/fi'il/harf selalu sama),
// label angka selektif, tooltip saat hover/fokus, dan tabel data untuk setiap grafik.

let C, tipEl;
const KELAS = [
  { k: "i", lat: "Isim", ar: "اسْمٌ", id: "kata benda", s: "s1" },
  { k: "f", lat: "Fi'il", ar: "فِعْلٌ", id: "kata kerja", s: "s2" },
  { k: "h", lat: "Harf", ar: "حَرْفٌ", id: "partikel", s: "s3" },
];

// ---------- util ----------
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v; // hanya untuk markup buatan sendiri, bukan data
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c) n.append(c);
  return n;
};
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const pct1 = (x) => (x * 100).toFixed(1).replace(".", ",") + "%";
const pct0 = (x) => Math.round(x * 100) + "%";
const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + " rb" : String(n));

// Tooltip bersama. Isi lewat textContent (data bisa berasal dari luar).
function tip(evt, title, rows) {
  if (!tipEl) { tipEl = el("div", { class: "dtip", role: "tooltip" }); document.body.append(tipEl); }
  tipEl.replaceChildren(el("div", { class: "dtip-t", text: title }),
    ...rows.map(([v, k, sw]) => el("div", { class: "dtip-r" }, [sw ? el("i", { class: "dtip-k " + sw }) : null, el("b", { text: v }), el("span", { text: " " + k })])));
  tipEl.style.display = "block";
  const r = evt.currentTarget?.getBoundingClientRect?.();
  const x = evt.clientX ?? (r ? r.left + r.width / 2 : 0), y = evt.clientY ?? (r ? r.top : 0);
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.min(Math.max(8, x + 14), innerWidth - w - 8) + "px";
  tipEl.style.top = Math.max(8, y - h - 12) + "px";
}
const untip = () => { if (tipEl) tipEl.style.display = "none"; };
function hover(node, fn) {
  node.setAttribute("tabindex", "0");
  node.addEventListener("pointermove", fn); node.addEventListener("focus", fn);
  node.addEventListener("pointerleave", untip); node.addEventListener("blur", untip);
}

function card(title, sub, body, table, wide) {
  const c = el("section", { class: "dcard" + (wide ? " wide" : "") }, [
    el("h3", { text: title }), sub ? el("p", { class: "dsub", html: sub }) : null, body,
  ]);
  if (table) {
    const t = el("table", { class: "dtbl" });
    t.append(el("thead", {}, el("tr", {}, table.head.map((h) => el("th", { text: h })))));
    const tb = el("tbody");
    for (const r of table.rows) tb.append(el("tr", {}, r.map((v) => el("td", { text: v }))));
    t.append(tb);
    c.append(el("details", { class: "dtable" }, [el("summary", { text: "Lihat tabel" }), el("div", { class: "dscroll" }, t)]));
  }
  return c;
}

// ---------- komponen grafik ----------
// Batang horizontal berurutan (satu warna). rows: {label, labelAr?, value, note?, href?}
function hbars(rows, fmtv, opts = {}) {
  const max = Math.max(...rows.map((r) => r.value));
  const box = el("div", { class: "hbars" + (opts.ar ? " ar-labels" : "") });
  for (const r of rows) {
    const lab = opts.stack
      ? el("div", { class: "hb-l stack" }, [el("span", { class: "hb-main", text: r.label }), el("span", { class: "ar hb-sub", text: r.labelAr || "" })])
      : el("div", { class: "hb-l" }, [r.labelAr ? el("span", { class: "ar", text: r.labelAr }) : null, el("span", { class: "hb-t", text: r.label })]);
    const bar = el("div", { class: "hb-bar " + (opts.cls || "s1") });
    bar.style.width = `calc(${Math.max(0.015, r.value / max).toFixed(4)} * (100% - 60px))`;
    const track = el(r.href ? "a" : "div", r.href ? { class: "hb-track", href: r.href } : { class: "hb-track" }, [bar, el("span", { class: "hb-v", text: fmtv(r.value) })]);
    hover(track, (e) => tip(e, r.tipTitle || r.label, r.tip || [[fmtv(r.value), ""]]));
    box.append(el("div", { class: "hb-row" }, [lab, track]));
  }
  return box;
}

// Batang tersegmen tinggi: satu keseluruhan dibagi ≤ 6 bagian, angka di dalam blok bila muat.
function segbar(parts, total, fmtv) {
  const wrap = el("div", { class: "sbar-wrap" });
  const bar = el("div", { class: "sbar", role: "img", "aria-label": parts.map((p) => `${p.label} ${pct1(p.value / total)}`).join(", ") });
  for (const p of parts) {
    const share = p.value / total;
    const b = el("div", { class: "sb " + p.s }, share >= 0.09 ? el("span", { text: pct0(share) }) : null);
    b.style.flexGrow = p.value;
    hover(b, (e) => tip(e, p.label, [[fmtv(p.value), p.unit || ""], [pct1(share), "dari total"]]));
    bar.append(b);
  }
  wrap.append(bar);
  return wrap;
}
function legend(items) {
  return el("div", { class: "dleg" }, items.map((it) => el("span", {}, [el("i", { class: "sw " + it.s }), document.createTextNode(it.label)])));
}

// Kolom vertikal (SVG). cols: {label, value, cls?, tip}
function columns(cols, opts) {
  const W = opts.w || 640, H = opts.h || 220, PL = 40, PR = 8, PT = 18, PB = 30;
  const max = opts.max || niceMax(Math.max(...cols.map((c) => c.value)));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "dchart", role: "img", "aria-label": opts.aria });
  const iw = W - PL - PR, ih = H - PT - PB, band = iw / cols.length, bw = Math.min(24, band * 0.62);
  const y = (v) => PT + ih - (v / max) * ih;
  for (const t of ticks(max)) {
    s.append(svg("line", { class: "grid", x1: PL, x2: W - PR, y1: y(t), y2: y(t) }));
    const tx = svg("text", { class: "tick", x: PL - 8, y: y(t) + 4, "text-anchor": "end" }); tx.textContent = opts.fmtTick ? opts.fmtTick(t) : compact(t); s.append(tx);
  }
  s.append(svg("line", { class: "axis", x1: PL, x2: W - PR, y1: y(0), y2: y(0) }));
  cols.forEach((c, i) => {
    const cx = PL + band * i + band / 2, top = y(c.value), hgt = Math.max(0, y(0) - top);
    const g = svg("g", { class: "col" });
    g.append(svg("rect", { class: "hit", x: cx - band / 2, y: PT, width: band, height: ih }));
    g.append(svg("path", { class: "bar " + (c.cls || "s1"), d: roundTop(cx - bw / 2, top, bw, hgt, Math.min(4, hgt)) }));
    if (opts.labelIf ? opts.labelIf(c, i) : false) {
      const tv = svg("text", { class: "val", x: cx, y: top - 6, "text-anchor": "middle" }); tv.textContent = opts.fmt(c.value); g.append(tv);
    }
    if (!opts.xEvery || i % opts.xEvery === 0 || i === cols.length - 1) {
      const tl = svg("text", { class: "tick", x: cx, y: H - 10, "text-anchor": "middle" }); tl.textContent = c.label; g.append(tl);
    }
    hover(g, (e) => tip(e, c.tipTitle || c.label, c.tip));
    s.append(g);
  });
  return s;
}
const roundTop = (x, y, w, h, r) => (h <= 0 ? "" : `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`);
function niceMax(v) { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; }
function ticks(max) { const st = niceMax(max / 4); return [0, st, st * 2, st * 3, st * 4].filter((t) => t <= max + 1e-9); }

// Kurva cakupan: sumbu x logaritmik (1 … semua kata dasar), crosshair + tooltip.
function coverageChart(cum) {
  const narrow = innerWidth < 600;
  const N = cum.length, W = narrow ? 380 : 640, H = narrow ? 240 : 260, PL = 40, PR = 14, PT = 16, PB = 34;
  const lx = (n) => PL + (Math.log10(n) / Math.log10(N)) * (W - PL - PR), y = (v) => PT + (1 - v) * (H - PT - PB);
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "dchart", role: "img", "aria-label": "Kurva cakupan: persentase kata Al-Qur'an yang tercakup oleh N kata dasar teratas" });
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    s.append(svg("line", { class: "grid", x1: PL, x2: W - PR, y1: y(t), y2: y(t) }));
    const tx = svg("text", { class: "tick", x: PL - 8, y: y(t) + 4, "text-anchor": "end" }); tx.textContent = Math.round(t * 100) + "%"; s.append(tx);
  }
  s.append(svg("line", { class: "axis", x1: PL, x2: W - PR, y1: y(0), y2: y(0) }));
  for (const n of [1, 10, 100, 1000, N]) {
    const tx = svg("text", { class: "tick", x: lx(n), y: H - 12, "text-anchor": n === N ? "end" : "middle" }); tx.textContent = n === N ? C.fmt(N) : C.fmt(n); s.append(tx);
  }
  let d = "";
  for (let n = 1; n <= N; n = n < 50 ? n + 1 : Math.ceil(n * 1.04)) d += `${d ? "L" : "M"}${lx(n).toFixed(1)},${y(cum[n - 1]).toFixed(1)}`;
  d += `L${lx(N).toFixed(1)},${y(1).toFixed(1)}`;
  s.append(svg("path", { class: "area s1", d: `${d}L${lx(N)},${y(0)}L${lx(1)},${y(0)}Z` }));
  s.append(svg("path", { class: "line s1", d }));
  for (const n of [100, 300, 1000]) { // label: "N → %" (N kata dasar teratas)
    const v = cum[n - 1];
    s.append(svg("circle", { class: "dot s1", cx: lx(n), cy: y(v), r: 4.5 }));
    const t = svg("text", { class: "val", x: lx(n) + (n === 1000 && narrow ? -6 : 8), y: y(v) + (n === 1000 && narrow ? -10 : 16), "text-anchor": n === 1000 && narrow ? "end" : "start" }); t.textContent = `${C.fmt(n)} → ${pct0(v)}`; s.append(t);
  }
  const xh = svg("line", { class: "xhair", y1: PT, y2: y(0), x1: 0, x2: 0, visibility: "hidden" }), hd = svg("circle", { class: "dot s1", r: 5, visibility: "hidden" });
  const hit = svg("rect", { class: "hit", x: PL, y: PT, width: W - PL - PR, height: H - PT - PB, tabindex: "0" });
  s.append(xh, hd, hit);
  const at = (n) => {
    n = Math.max(1, Math.min(N, Math.round(n)));
    xh.setAttribute("x1", lx(n)); xh.setAttribute("x2", lx(n)); hd.setAttribute("cx", lx(n)); hd.setAttribute("cy", y(cum[n - 1]));
    xh.setAttribute("visibility", "visible"); hd.setAttribute("visibility", "visible");
    return n;
  };
  let kn = 300;
  const show = (e, n) => tip(e, `${C.fmt(n)} kata dasar teratas`, [[pct1(cum[n - 1]), "kata Al-Qur'an tercakup"], [C.fmt(C.LEMMAS[n - 1].n) + "×", `kata ke-${C.fmt(n)} (${C.LEMMAS[n - 1].ar}) muncul`]]);
  hit.addEventListener("pointermove", (e) => {
    const r = s.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    kn = at(10 ** (((px - PL) / (W - PL - PR)) * Math.log10(N))); show(e, kn);
  });
  hit.addEventListener("focus", (e) => { at(kn); show(e, kn); });
  hit.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); kn = at(e.key === "ArrowRight" ? kn * 1.15 + 1 : kn / 1.15); show(e, kn); }
  });
  const off = () => { untip(); xh.setAttribute("visibility", "hidden"); hd.setAttribute("visibility", "hidden"); };
  hit.addEventListener("pointerleave", off); hit.addEventListener("blur", off);
  return s;
}

// ---------- peta target hafalan ----------
// Kata dasar diurutkan dari yang paling sering muncul (urutan default latihan), jadi
// "N kata teratas" = kartu ke-1..N. Lama waktu dihitung dari kata baru per hari milik pengguna.
const lama = (d) => (d < 25 ? `${d} hari` : d <= 45 ? "± 1 bulan" : d < 75 ? `± ${Math.round(d / 7)} minggu` : `± ${Math.round(d / 30)} bulan`);
function targetSection(cum) {
  const npd = C.npd || 10, L = C.LEMMAS;
  const STEPS = [
    { n: 100, nama: "Langkah awal" },
    { n: 300, nama: "Target pertama", utama: true },
    { n: 500, nama: "Lancar" },
    { n: 1000, nama: "Mahir" },
    { n: 2000, nama: "Pakar" },
  ];
  const lulus = (n) => { let k = 0; for (let i = 0; i < n; i++) if (C.level(i) >= 2) k++; return k; };
  const tiles = STEPS.map((s, i) => {
    const p = cum[s.n - 1], got = lulus(s.n), done = got >= s.n, f = got / s.n;
    const t = el("li", { class: "tstep" + (s.utama ? " main" : "") + (done ? " tok" : "") }, [
      el("div", { class: "tdot", "aria-hidden": "true", text: done ? "✓" : String(i + 1) }),
      el("div", { class: "tbody" }, [
        el("div", { class: "tname", text: s.utama ? `${s.nama} ★` : s.nama }),
        el("div", { class: "tn", html: `<b>${C.fmt(s.n)}</b> kata dasar` }),
        el("div", { class: "tp", text: pct0(p) }),
        el("div", { class: "tc", text: "dari seluruh kata dalam Al-Qur'an" }),
        el("div", { class: "tt", text: `⏱ ${lama(Math.ceil(s.n / npd))}` }),
        el("div", { class: "tm", role: "img", "aria-label": `Progres ${got} dari ${s.n}` }, el("div", { style: `width:${Math.min(100, f * 100)}%` })),
        el("div", { class: "tg", text: done ? "Tercapai! 🎉" : got ? `${C.fmt(got)} / ${C.fmt(s.n)} sudah lulus` : "Belum dimulai" }),
      ]),
    ]);
    return t;
  });
  const p300 = cum[299];
  return el("section", { class: "target" }, [
    el("div", { class: "target-h" }, [
      el("div", {}, [
        el("p", { class: "eyebrow", text: "Target hafalan" }),
        el("h3", { html: `Hafal <b>300 kata dasar</b>, kenali <b>${pct0(p300)}</b> dari seluruh kata dalam Al-Qur'an` }),
        el("p", { class: "target-sub", html: `Dari <b>${C.fmt(L.length)}</b> kata dasar, ada yang muncul ribuan kali (<span class="ar" dir="rtl">مِنْ، اللّٰهُ، قَالَ</span>) dan ada <b>${C.fmt(L.filter((x) => x.n === 1).length)}</b> yang hanya muncul sekali. Karena latihan dimulai dari kata yang paling sering, 300 kata pertama sudah mencakup <b>${pct0(p300)}</b> dari seluruh <b>${C.fmt(C.TOTAL_WORDS)}</b> kata dalam Al-Qur'an. Dengan <b>${npd} kata baru per hari</b>, target ini tercapai dalam <b>${lama(Math.ceil(300 / npd))}</b>, cukup 10–15 menit sehari.` }),
      ]),
      el("a", { class: "btn primary", href: "#/latihan", text: "Mulai latihan →" }),
    ]),
    el("ol", { class: "tsteps" }, tiles),
    el("p", { class: "target-note small muted", html: `Lama waktu dihitung dari ${npd} kata baru per hari (bisa diubah di halaman Latihan). Kata yang sudah dihafal tetap diulang sesuai jadwal agar tidak lupa.` }),
  ]);
}

// ---------- dashboard ----------
export async function renderDashboard(root, ctx) {
  C = ctx;
  const L = C.LEMMAS, T = C.TOTAL_WORDS;
  const [ST, R] = await Promise.all([C.getJSON("data/stats.json"), C.roots()]);
  const cum = []; let acc = 0;
  for (const x of L) { acc += x.n; cum.push(acc / T); }
  const hapax = L.filter((x) => x.n === 1).length;
  const N80 = cum.findIndex((v) => v >= 0.8) + 1, N50 = cum.findIndex((v) => v >= 0.5) + 1;

  // Ringkasan + angka utama
  const head = el("div", { class: "dhead" }, [
    el("div", { class: "dhero" }, [
      el("div", { class: "dhero-fig", text: pct0(cum[299]) }),
      el("div", { class: "dhero-txt", html: `kata dalam Al-Qur'an sudah tercakup oleh <b>300 kata dasar</b> yang paling sering muncul (dari ${C.fmt(L.length)}). Cukup <b>${C.fmt(N50)}</b> kata dasar untuk separuhnya, dan <b>${C.fmt(N80)}</b> untuk 80%.` }),
    ]),
    el("div", { class: "kpis" }, [
      ["Kata (kemunculan)", C.fmt(T), `${C.fmt(ST.verses)} ayat · 114 surah`],
      ["Bentuk kata berbeda", C.fmt(ST.forms), "dengan imbuhan & i'rab"],
      ["Kata dasar", C.fmt(L.length), `${C.fmt(R.length)} akar kata`],
      ["Muncul sekali saja", C.fmt(hapax), `${pct0(hapax / L.length)} dari kata dasar (hapax)`],
    ].map(([k, v, s]) => el("div", { class: "kpi" }, [el("div", { class: "kpi-k", text: k }), el("div", { class: "kpi-v", text: v }), el("div", { class: "kpi-s", text: s })]))),
  ]);

  // 1. Kurva cakupan
  const covRows = [10, 50, 100, 200, 300, 500, 1000, 2000, L.length].map((n) => [C.fmt(n), pct1(cum[n - 1])]);
  const c1 = card("Berapa kata yang perlu dihafal?",
    `Persentase kata Al-Qur'an yang tercakup oleh N kata dasar teratas. Sumbu mendatar logaritmik: kurvanya menanjak tajam di awal, lalu melandai. <b>Setiap kata tambahan memberi manfaat yang makin kecil.</b>`,
    coverageChart(cum), { head: ["N kata dasar teratas", "Kata Al-Qur'an tercakup"], rows: covRows }, true);

  // 2. Kelompok frekuensi (ordinal): banyaknya kata dasar vs porsi kemunculan
  const bands = [[1, 1, "1×"], [2, 4, "2–4"], [5, 9, "5–9"], [10, 49, "10–49"], [50, 99, "50–99"], [100, 1e9, "≥100"]];
  const bd = bands.map(([a, b, lab], i) => {
    const xs = L.filter((x) => x.n >= a && x.n <= b);
    return { label: lab, lem: xs.length, tok: xs.reduce((t, x) => t + x.n, 0), q: "q" + [1, 2, 3, 3, 4, 5][i] };
  });
  const twin = el("div", { class: "twin" }, [
    el("div", {}, [el("div", { class: "twin-h", text: "Banyaknya kata dasar" }),
      columns(bd.map((b) => ({ label: b.label, value: b.lem, cls: b.q, tip: [[C.fmt(b.lem), "kata dasar"], [pct1(b.lem / L.length), "dari semua kata dasar"]] })),
        { aria: "Banyaknya kata dasar per kelompok frekuensi", fmt: C.fmt, labelIf: () => true, w: 380, h: 250 })]),
    el("div", {}, [el("div", { class: "twin-h", text: "Porsi kemunculan dalam Al-Qur'an" }),
      columns(bd.map((b) => ({ label: b.label, value: b.tok / T, cls: b.q, tip: [[pct1(b.tok / T), "kata Al-Qur'an"], [C.fmt(b.tok), "kemunculan"]] })),
        { aria: "Porsi kemunculan per kelompok frekuensi", fmt: pct0, fmtTick: (t) => pct0(t), max: 0.7, labelIf: () => true, w: 380, h: 250 })]),
  ]);
  const big = bd[bd.length - 1].lem, bigTok = bd[bd.length - 1].tok;
  const c2 = card("Sedikit kata, sangat sering muncul",
    `Kata dasar dikelompokkan menurut frekuensinya. Hanya <b>${C.fmt(big)}</b> kata dasar yang muncul ≥ 100 kali, tetapi semuanya menyumbang <b>${pct0(bigTok / T)}</b> kata Al-Qur'an. Sebaliknya, <b>${C.fmt(bd[0].lem)}</b> kata dasar hanya muncul sekali.`,
    twin, { head: ["Frekuensi", "Kata dasar", "% kata dasar", "Kemunculan", "% kata Al-Qur'an"], rows: bd.map((b) => [b.label, C.fmt(b.lem), pct1(b.lem / L.length), C.fmt(b.tok), pct1(b.tok / T)]) }, true);

  // 3. Isim / fi'il / harf: dua batang tersegmen
  const kel = KELAS.map((k) => {
    const xs = L.filter((x) => x.k === k.k);
    return { ...k, label: `${k.lat} (${k.id})`, lem: xs.length, tok: xs.reduce((t, x) => t + x.n, 0) };
  });
  const harf = kel[2];
  const c3 = card("Isim, fi'il, dan harf",
    `Harf hanya <b>${C.fmt(harf.lem)}</b> kata dasar (${pct1(harf.lem / L.length)}), tetapi mengisi <b>${pct0(harf.tok / T)}</b> teks Al-Qur'an. Menguasai harf dan dhamir yang sedikit itu membuka banyak ayat.`,
    el("div", { class: "segs" }, [
      el("div", { class: "seg-h", text: "Menurut jumlah kata dasar" }), segbar(kel.map((x) => ({ ...x, value: x.lem, unit: "kata dasar" })), L.length, C.fmt),
      el("div", { class: "seg-h", text: "Menurut kemunculan di Al-Qur'an" }), segbar(kel.map((x) => ({ ...x, value: x.tok, unit: "kemunculan" })), T, C.fmt),
      legend(kel.map((x) => ({ s: x.s, label: `${x.lat} · ${x.id}` }))),
    ]), { head: ["Kelas", "Kata dasar", "%", "Kemunculan", "%"], rows: kel.map((x) => [x.lat, C.fmt(x.lem), pct1(x.lem / L.length), C.fmt(x.tok), pct1(x.tok / T)]) });

  // 4. Jenis kata rinci (diurutkan menurut kemunculan)
  const jen = {};
  for (const x of L) { const j = jen[x.jk] ||= { jenis: x.jenis, lem: 0, tok: 0 }; j.lem++; j.tok += x.n; }
  const jr = Object.values(jen).sort((a, b) => b.tok - a.tok);
  const c4 = card("Jenis kata yang paling sering",
    `Diurutkan menurut kemunculan. Arahkan kursor untuk melihat jumlah kata dasarnya.`,
    hbars(jr.slice(0, 12).map((j) => ({ label: j.jenis[0], labelAr: j.jenis[1], value: j.tok, tipTitle: `${j.jenis[0]} · ${j.jenis[2]}`, tip: [[C.fmt(j.tok), "kemunculan"], [C.fmt(j.lem), "kata dasar"]] })), C.fmt, { stack: true }),
    { head: ["Jenis kata", "Arab", "Kata dasar", "Kemunculan"], rows: jr.map((j) => [j.jenis[0], j.jenis[1], C.fmt(j.lem), C.fmt(j.tok)]) });

  // 5. Penurunan kata (isytiqaq): akar paling produktif
  const rr = [...R].sort((a, b) => b.lemmas.length - a.lemmas.length || b.n - a.n);
  const perRoot = R.reduce((t, r) => t + r.lemmas.length, 0) / R.length;
  const c5 = card("Akar dengan turunan terbanyak",
    `Satu akar menurunkan banyak kata dasar (isytiqaq). Rata-rata <b>${perRoot.toFixed(1).replace(".", ",")}</b> kata dasar per akar; akar teratas menurunkan lebih dari sepuluh.`,
    hbars(rr.slice(0, 12).map((r) => {
      const ex = r.lemmas.slice(0, 4).map((i) => L[i].ar).join("، ");
      return { label: L[r.lemmas[0]].mean[0] || "", labelAr: [...r.root].join(" "), value: r.lemmas.length, href: `#/akar/${encodeURIComponent(r.bw)}`,
        tipTitle: `Akar ${[...r.root].join(" ")}`, tip: [[C.fmt(r.lemmas.length), "kata dasar turunan"], [C.fmt(r.n) + "×", "muncul di Al-Qur'an"], [ex, ""]] };
    }), C.fmt, { ar: true }),
    { head: ["Akar", "Kata dasar turunan", "Kemunculan"], rows: rr.slice(0, 40).map((r) => [[...r.root].join(" "), C.fmt(r.lemmas.length), C.fmt(r.n)]) });

  // 6. Wazan fi'il I–X
  const forms = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const WZ = { I: "فَعَلَ", II: "فَعَّلَ", III: "فَاعَلَ", IV: "أَفْعَلَ", V: "تَفَعَّلَ", VI: "تَفَاعَلَ", VII: "انْفَعَلَ", VIII: "افْتَعَلَ", IX: "افْعَلَّ", X: "اسْتَفْعَلَ" };
  const fv = forms.map((f) => { const xs = L.filter((x) => x.k === "f" && (x.vform || "I") === f); return { f, lem: xs.length, tok: xs.reduce((t, x) => t + x.n, 0) }; });
  const fTot = fv.reduce((t, x) => t + x.lem, 0);
  const c6 = card("Wazan fi'il: tsulatsi mujarrad & mazid",
    `Jumlah fi'il (kata dasar) per wazan. Bentuk I (mujarrad) ${pct0(fv[0].lem / fTot)}; sisanya fi'il mazid yang maknanya bisa ditebak dari wazannya (أَفْعَلَ، فَعَّلَ، افْتَعَلَ, …).`,
    columns(fv.map((x) => ({ label: x.f, value: x.lem, cls: "s2", tipTitle: `Bentuk ${x.f} · ${WZ[x.f]}`, tip: [[C.fmt(x.lem), "fi'il"], [C.fmt(x.tok), "kemunculan"]] })),
      { aria: "Jumlah fi'il per wazan I sampai X", fmt: C.fmt, labelIf: (c) => c.value > 0, w: 420, h: 250 }),
    { head: ["Bentuk", "Wazan", "Fi'il", "Kemunculan"], rows: fv.map((x) => [x.f, WZ[x.f], C.fmt(x.lem), C.fmt(x.tok)]) });

  // 7. Jenis jamak
  const jm = { "jamak taksir": 0, "jamak mudzakkar salim": 0, "jamak muannats salim": 0 };
  for (const x of L) for (const j of x.jamak || []) { const k = j.jenis.includes("taksir") ? "jamak taksir" : j.jenis.includes("muannats") ? "jamak muannats salim" : "jamak mudzakkar salim"; jm[k]++; }
  const jmParts = [["jamak taksir", "s1"], ["jamak mudzakkar salim", "s2"], ["jamak muannats salim", "s3"]].map(([k, s]) => ({ label: k[0].toUpperCase() + k.slice(1), value: jm[k], s, unit: "bentuk jamak" }));
  const jmTot = jmParts.reduce((t, p) => t + p.value, 0);
  const nPl = L.filter((x) => x.jamak).length;
  const c7 = card("Bentuk jamak di Al-Qur'an",
    `${C.fmt(nPl)} isim muncul dalam bentuk jamak. Jamak taksir (pola tak beraturan, harus dihafal) menyumbang <b>${pct0(jm["jamak taksir"] / jmTot)}</b> dari ${C.fmt(jmTot)} bentuk jamak.`,
    el("div", { class: "segs" }, [segbar(jmParts, jmTot, C.fmt), legend(jmParts)]),
    { head: ["Jenis jamak", "Bentuk", "%"], rows: jmParts.map((p) => [p.label, C.fmt(p.value), pct1(p.value / jmTot)]) });

  // 8. Kata dasar baru per juz (urut mushaf)
  const jz = ST.juz;
  const after10 = jz.slice(10).reduce((t, x) => t + x.new, 0) / 20;
  const c8 = card("Kata dasar baru per juz",
    `Kalau belajar urut mushaf: juz 1 memperkenalkan <b>${C.fmt(jz[0].new)}</b> kata dasar baru, juz 2 <b>${C.fmt(jz[1].new)}</b>. Setelah juz 10 rata-rata hanya <b>${Math.round(after10)}</b> per juz. Beban terberat ada di awal.`,
    columns(jz.map((x) => ({ label: String(x.j), value: x.new, cls: "s1", tipTitle: `Juz ${x.j}`, tip: [[C.fmt(x.new), "kata dasar baru"], [C.fmt(x.lem), "kata dasar di juz ini"], [C.fmt(x.tok), "kata"]] })),
      { aria: "Jumlah kata dasar baru per juz", fmt: C.fmt, labelIf: (c, i) => i < 2 || i === 29, xEvery: innerWidth < 600 ? 5 : 1, w: innerWidth < 600 ? 380 : 640, h: 240 }),
    { head: ["Juz", "Kata dasar baru", "Kata dasar di juz", "Kata"], rows: jz.map((x) => [String(x.j), C.fmt(x.new), C.fmt(x.lem), C.fmt(x.tok)]) }, true);

  // 9. Makkiyah & Madaniyah
  const P = ST.place, pl = [
    { label: "Hanya Makkiyah", value: P.makkah.only, s: "s1", unit: "kata dasar" },
    { label: "Keduanya", value: P.both, s: "s2", unit: "kata dasar" },
    { label: "Hanya Madaniyah", value: P.madinah.only, s: "s3", unit: "kata dasar" },
  ];
  const plTot = pl.reduce((t, x) => t + x.value, 0);
  const c9 = card("Makkiyah & Madaniyah",
    `${P.makkah.surah} surah Makkiyah memuat <b>${pct0(P.makkah.tok / T)}</b> kata Al-Qur'an dan ${C.fmt(P.makkah.lem)} kata dasar; ${P.madinah.surah} surah Madaniyah ${pct0(P.madinah.tok / T)} kata dan ${C.fmt(P.madinah.lem)} kata dasar. Sebaran kata dasarnya:`,
    el("div", { class: "segs" }, [segbar(pl, plTot, C.fmt), legend(pl)]),
    { head: ["", "Surah", "Kata", "Kata dasar", "Kata dasar khas"], rows: [["Makkiyah", String(P.makkah.surah), C.fmt(P.makkah.tok), C.fmt(P.makkah.lem), C.fmt(P.makkah.only)], ["Madaniyah", String(P.madinah.surah), C.fmt(P.madinah.tok), C.fmt(P.madinah.lem), C.fmt(P.madinah.only)], ["Keduanya", "", "", C.fmt(P.both), ""]] });

  // 10. 15 kata terbanyak
  const c10 = card("15 kata dasar terbanyak",
    `Lima belas kata ini saja mencakup <b>${pct0(cum[14])}</b> kata Al-Qur'an. Klik untuk membuka kata.`,
    hbars(L.slice(0, 15).map((x) => ({ label: x.mean[0] || "", labelAr: x.ar, value: x.n, href: `#/kata/${x.id}`, tipTitle: `${x.ar} · ${x.mean[0] || ""}`, tip: [[C.fmt(x.n) + "×", "muncul"], [pct1(x.n / T), "kata Al-Qur'an"], [x.jenis[0], ""]] })), C.fmt, { ar: true }),
    { head: ["No.", "Kata", "Arti", "Kemunculan"], rows: L.slice(0, 50).map((x, i) => [String(i + 1), x.ar, x.mean[0] || "", C.fmt(x.n)]) }, true);

  root.replaceChildren(targetSection(cum), head, el("div", { class: "dgrid" }, [c1, c2, c3, c4, c5, c6, c7, c9, c8, c10]));
}
