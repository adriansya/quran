// Login (Google / email) dan sinkron progres latihan ke akun lewat Supabase.
// Tanpa login aplikasi tetap jalan seperti biasa: progres hanya tersimpan di browser.
// Setelah login, progres disimpan ke tabel `progress` (satu baris per pengguna, kolom `state` JSON)
// dan digabung dengan progres di perangkat lain, jadi tidak ada ulasan yang hilang.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import * as S from "./srs.js";

const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const OWNER = "kq.owner"; // id akun pemilik progres yang tersimpan di browser ini
const DIRTY = "kq.dirty"; // ada perubahan yang belum terkirim
const SYNCT = "kq.syncT"; // cap waktu progres akun saat terakhir sinkron
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* mode privat */ } },
};

let sb = null, user = null, status = "idle", timer = null, busy = null, opts = {};
export const enabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const currentUser = () => user;

// ---------- sinkron ----------
async function fetchRemote() {
  const { data, error } = await sb.from("progress").select("state").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data?.state ? opts.migrate(data.state) : null;
}
// Ambil progres akun, gabung dengan progres di browser, simpan ke keduanya.
async function syncNow({ first = false } = {}) {
  if (!sb || !user) return;
  while (busy) await busy;
  busy = (async () => {
    setStatus("saving");
    try {
      const remote = await fetchRemote();
      const owner = ls.get(OWNER);
      let local = S.st;
      // Akun tidak diubah perangkat lain sejak sinkron terakhir: progres di browser ini yang berlaku
      // (supaya "reset" atau hapus kartu tidak kembali lagi karena digabung).
      const fresh = owner === user.id && remote && (remote.t || 0) <= +(ls.get(SYNCT) || 0);
      if (owner && owner !== user.id) local = null; // progres milik akun lain: jangan dicampur
      else if (first && !owner && !S.isEmpty(local) && remote && !S.isEmpty(remote)) {
        const n = Object.keys(local.cards).length;
        if (!confirm(`Di browser ini ada progres ${n} kata yang belum terhubung ke akun.\nGabungkan ke akunmu?\n\nOK = gabungkan · Batal = pakai progres akun saja`)) local = null;
      }
      const merged = fresh ? local : !remote ? (local || S.blankState()) : local && !S.isEmpty(local) ? S.mergeStates(remote, local) : remote;
      S.setLocal(merged); ls.set(OWNER, user.id);
      const { error } = await sb.from("progress").upsert({ user_id: user.id, state: S.st, updated_at: new Date().toISOString() });
      if (error) throw error;
      ls.set(DIRTY, null); ls.set(SYNCT, String(S.st.t || 0)); setStatus("ok");
    } catch (e) {
      console.warn("sinkron gagal", e); ls.set(DIRTY, "1"); setStatus("err");
    }
  })();
  try { await busy; } finally { busy = null; }
}
// Progres berubah (setiap menilai kartu, ubah pengaturan, dll.): kirim beberapa detik kemudian.
function queue() {
  if (!user) return;
  ls.set(DIRTY, "1"); setStatus("pending");
  clearTimeout(timer); timer = setTimeout(() => syncNow(), 2500);
}
const flush = () => { if (user && ls.get(DIRTY)) { clearTimeout(timer); syncNow(); } };

// ---------- login / keluar ----------
const redirectTo = () => location.origin + location.pathname;
async function loginGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) throw error;
}
async function sendEmail(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}
async function verifyCode(email, token) {
  const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}
async function logout() {
  if (ls.get(DIRTY)) await syncNow();
  if (ls.get(DIRTY) && !confirm("Ada progres yang belum tersimpan ke akun (sedang offline?). Tetap keluar? Progres itu akan hilang dari browser ini.")) return;
  await sb.auth.signOut();
  user = null; S.setLocal(S.blankState()); ls.set(OWNER, null); ls.set(DIRTY, null); ls.set(SYNCT, null);
  setStatus("idle"); render(); opts.onChange?.();
}
async function onUser(u) {
  if ((u?.id || null) === (user?.id || null)) return; // token diperbarui, akun sama
  user = u;
  render();
  if (u) { closeDialog(); await syncNow({ first: true }); opts.onChange?.(); }
}

// ---------- tampilan ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUS = {
  idle: ["", ""], ok: ["ok", "Progres tersimpan di akun"], pending: ["wait", "Menunggu disimpan…"],
  saving: ["wait", "Menyimpan…"], err: ["err", "Belum tersimpan (offline?). Dicoba lagi otomatis."],
};
function setStatus(s) { status = s; const el = document.querySelector(".acct-st"); if (el) { el.className = "acct-st " + STATUS[s][0]; el.textContent = STATUS[s][1]; } const d = document.querySelector(".acct-dot"); if (d) d.className = "acct-dot " + STATUS[s][0]; }
function render() {
  const slot = document.getElementById("acct");
  if (!slot) return;
  if (!sb) { slot.innerHTML = ""; return; }
  if (!user) {
    slot.innerHTML = `<button class="btn sm primary" type="button" id="acctIn">Masuk</button>`;
    slot.querySelector("#acctIn").onclick = openDialog;
    return;
  }
  const m = user.user_metadata || {}, name = m.full_name || m.name || user.email, pic = m.avatar_url || m.picture;
  slot.innerHTML = `
    <details class="acct-menu">
      <summary class="acct-btn" aria-label="Akun">${pic ? `<img src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc((name || "?")[0].toUpperCase())}</span>`}<i class="acct-dot ${STATUS[status][0]}"></i></summary>
      <div class="acct-pop">
        <div class="acct-name">${esc(name)}</div>
        ${name !== user.email ? `<div class="acct-mail">${esc(user.email)}</div>` : ""}
        <div class="acct-st ${STATUS[status][0]}">${STATUS[status][1]}</div>
        <button class="btn sm" type="button" id="acctSync">Sinkron sekarang</button>
        <button class="btn sm" type="button" id="acctOut">Keluar</button>
      </div>
    </details>`;
  slot.querySelector("#acctSync").onclick = () => syncNow();
  slot.querySelector("#acctOut").onclick = () => logout();
}
document.addEventListener("click", (e) => { const d = document.querySelector(".acct-menu[open]"); if (d && !d.contains(e.target)) d.open = false; });

let dlg = null;
function closeDialog() { if (dlg?.open) dlg.close(); }
function openDialog() {
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = "login";
    document.body.append(dlg);
  }
  dlg.innerHTML = `
    <form method="dialog" class="login-x"><button class="btn sm" aria-label="Tutup">✕</button></form>
    <div class="login-ar ar">كَلِمَة</div>
    <h2>Masuk ke akunmu</h2>
    <p class="muted">Progres latihan tersimpan di akun, jadi bisa dilanjutkan di HP maupun laptop dan tidak hilang saat riwayat browser dihapus.</p>
    <button class="btn login-g" type="button" id="lgG"><svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Masuk dengan Google</button>
    <div class="login-or"><span>atau dengan email</span></div>
    <form id="lgMail" class="login-f">
      <input type="email" id="lgEmail" required placeholder="nama@email.com" autocomplete="email">
      <button class="btn primary" type="submit">Kirim kode</button>
    </form>
    <form id="lgCode" class="login-f" hidden>
      <p class="small">Kode masuk sudah dikirim ke <b id="lgTo"></b>. Masukkan kodenya di sini, atau klik tautan di email itu.</p>
      <input id="lgTok" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required placeholder="Kode dari email">
      <button class="btn primary" type="submit">Masuk</button>
      <button class="btn sm" type="button" id="lgBack">Ganti email</button>
    </form>
    <p class="login-msg small" id="lgMsg" role="status"></p>
    <p class="small muted">Tanpa masuk pun aplikasi tetap bisa dipakai; progres hanya tersimpan di browser ini.</p>`;
  const $ = (id) => dlg.querySelector("#" + id), msg = (t, err) => { $("lgMsg").textContent = t; $("lgMsg").classList.toggle("err", !!err); };
  const busyBtn = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { msg(e.message || String(e), true); } finally { btn.disabled = false; } };
  $("lgG").onclick = (e) => busyBtn(e.currentTarget, loginGoogle);
  $("lgMail").onsubmit = (e) => {
    e.preventDefault();
    const email = $("lgEmail").value.trim();
    busyBtn(e.submitter, async () => { msg(""); await sendEmail(email); $("lgTo").textContent = email; $("lgMail").hidden = true; $("lgCode").hidden = false; $("lgTok").focus(); });
  };
  $("lgCode").onsubmit = (e) => { e.preventDefault(); busyBtn(e.submitter, () => verifyCode($("lgEmail").value.trim(), $("lgTok").value.trim())); };
  $("lgBack").onclick = () => { $("lgMail").hidden = false; $("lgCode").hidden = true; msg(""); };
  dlg.showModal();
}

// ---------- mulai ----------
// opts.migrate(state) -> state versi data terbaru; opts.onChange() dipanggil setelah progres berganti.
export async function initSync(o) {
  opts = o;
  if (!enabled()) return;
  try {
    const { createClient } = await import(CDN);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  } catch (e) { console.warn("Supabase tidak termuat", e); return; }
  S.onSave(queue);
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); else if (user) syncNow(); });
  render();
  const { data } = await sb.auth.getSession();
  // bersihkan ?code=… sisa login Google/tautan email dari alamat
  if (/[?&]code=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
  sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => onUser(session?.user || null), 0); });
  await onUser(data.session?.user || null);
}
