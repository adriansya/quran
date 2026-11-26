# Login & sinkron progres (Supabase)

Aplikasi tetap bisa dipakai tanpa login (progres di browser). Dengan login, progres tiap akun
disimpan di Supabase sehingga bisa dilanjutkan di perangkat lain. Kodenya ada di `web/sync.js`;
login aktif begitu `web/config.js` diisi.

## 1. Buat project Supabase

1. Daftar/masuk di https://supabase.com → **New project**. Pilih region **Southeast Asia (Singapore)**.
2. Setelah jadi, buka **SQL Editor → New query**, tempel dan jalankan:

```sql
create table public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
create policy "baca milik sendiri" on public.progress
  for select using ((select auth.uid()) = user_id);
create policy "tambah milik sendiri" on public.progress
  for insert with check ((select auth.uid()) = user_id);
create policy "ubah milik sendiri" on public.progress
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- project baru Supabase tidak otomatis memberi izin tabel ke pengguna yang login:
grant select, insert, update on table public.progress to authenticated;
```

3. **Authentication → URL Configuration**
   - Site URL: `https://adriansya.github.io/quran/`
   - Redirect URLs: tambahkan `https://adriansya.github.io/quran/`
4. **Project Settings → API**: salin **Project URL** dan kunci **anon / publishable**, lalu isi
   `web/config.js`. (Kunci ini memang untuk web publik; data dilindungi aturan di atas.
   Jangan pernah memakai kunci `service_role`.)

## 2. Login email (tautan)

Pengguna mengetik email, lalu mengklik tautan **Log In** di email dari Supabase. Tautan boleh dibuka
di browser/perangkat mana pun (token dibawa di alamat, `flowType: "implicit"`), jadi aman walau
email dibuka di aplikasi Gmail. Template email bawaan sudah cukup; tidak perlu diubah.

- Pengiriman email bawaan Supabase sangat dibatasi (±2 email per jam untuk seluruh project), hanya
  cocok untuk uji coba. Untuk banyak pengguna, pasang SMTP sendiri di
  **Authentication → Emails → SMTP Settings** (mis. Resend atau Brevo, ada paket gratis), atau
  andalkan login Google yang tidak memakai email.

## 3. Login Google

1. https://console.cloud.google.com → buat project → **APIs & Services → OAuth consent screen**:
   pilih *External*, isi nama aplikasi & email, lalu **Publish app** supaya semua orang bisa masuk.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*:
   - Authorized JavaScript origins: `https://adriansya.github.io`
   - Authorized redirect URIs: `https://<ID-PROJECT>.supabase.co/auth/v1/callback`
     (alamat persisnya tertera di Supabase pada langkah berikut)
3. Supabase **Authentication → Sign In / Providers → Google**: aktifkan, tempel **Client ID** dan
   **Client Secret**, simpan.

## Cara kerja sinkron

- Setiap progres berubah, data dikirim ±2,5 detik kemudian (juga saat tab ditutup/disembunyikan,
  dan otomatis dicoba lagi saat kembali online).
- Saat masuk pertama kali di browser yang sudah punya progres, pengguna ditanya apakah progres itu
  digabung ke akun. Penggabungan tidak menghilangkan ulasan: per kartu diambil yang paling banyak diulas.
- Bila akun tidak diubah perangkat lain sejak sinkron terakhir, progres di browser yang berlaku
  (jadi "reset" kartu tidak kembali lagi).
- Keluar akan mengosongkan progres di browser itu (tetap aman di akun).
