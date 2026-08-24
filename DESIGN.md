---
name: Kopi Migi POS
description: Sistem desain antarmuka kasir & operasional kedai kopi Kopi Migi
colors:
  primary: "#00349b"
  primary-hover: "#002979"
  primary-soft: "#eaf0ff"
  sidebar-bg: "#001b52"
  sidebar-muted: "#a9b8e8"
  neutral-bg: "#faf8ff"
  neutral-paper: "#f3effb"
  neutral-soft: "#f8f5ff"
  neutral-dark: "#101426"
  neutral-mid: "#313854"
  neutral-muted: "#707692"
  neutral-line: "#e6e1f1"
  success: "#2f7a46"
  success-soft: "#eaf6ee"
  warning: "#c9861e"
  warning-soft: "#fdf2de"
  danger: "#b84040"
  danger-soft: "#fdeaea"
typography:
  display:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 3vw, 42px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  label:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
  micro:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "9.5px"
    fontWeight: 700
    lineHeight: 1.1
rounded:
  xs: "4px"
  sm: "6px"
  md: "9px"
  lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.md}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  card:
    backgroundColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "18px"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-dark}"
    rounded: "{rounded.md}"
    padding: "9px 11px"
---

# Design System: Kopi Migi POS

## Overview

**Creative North Star: "The Focused Roastery Terminal"**

Kopi Migi POS adalah sistem antarmuka operasional yang dirancang untuk kecepatan transaksi di meja kasir dan kejernihan pemantauan bagi pemilik kedai. Menggabungkan ketegasan fungsional aplikasi Point of Sale dengan kehangatan keramahan kedai kopi lokal, antarmuka ini mengutamakan keterbacaan instan dalam berbagai kondisi pencahayaan bar kopi dan kenyamanan layar sentuh tablet.

Sistem ini menolak kompleksitas visual yang tidak perlu (*zero slop*), tata letak kartu bersarang (*no cards in cards*), dan ketidakjelasan nominal transaksi. Seluruh angka keuangan dan waktu operasional disajikan dengan presisi monospaced, sementara tombol aksi transaksi diberi penekanan visual yang tegas tanpa distraksi.

**Key Characteristics:**
- **High-Velocity Scannability:** Tata letak dua zona terpisah (navigasi kontrol di kiri, workspace transaksi di kanan) untuk alur kerja kasir yang ritmis.
- **Monospace Financial Precision:** Seluruh nilai rupiah, kode transaksi, jam shift, dan kuantitas menggunakan font `DM Mono` berangka rata (*tabular figures*).
- **Tactile Touch Targets:** Kontrol layar sentuh tablet dioptimalkan dengan target sentuh minimal 32–44px untuk mencegah kesalahan input di jam sibuk.
- **Offline & Role Clarity:** Kontrol akses owner dan kasir terisolasi rapi, dengan sinyal visual multi-status pada perangkat keras (printer, kas laci).

## Colors

Palet warna Kopi Migi berpusat pada warna biru laut pekat (*Midnight Navy* dan *Kopi Migi Blue*) yang dipadukan dengan latar belakang kertas bernuansa lembut (*Cool Paper / Soft Lilac-White*) dan aksen semantik yang disiplin.

### Primary
- **Kopi Migi Blue** (`#00349b`): Aksen interaktif utama. Digunakan untuk tombol primer (*Bayar & Cetak*, *Proses Pesanan*), status aktif navigasi, dan indikator pilihan menu.
- **Kopi Migi Blue Dark** (`#002979`): State hover dan active pada tombol primer.
- **Midnight Navy** (`#001b52`): Latar belakang sidebar navigasi kasir yang berwibawa dan tidak menyilaukan mata saat layar aktif sepanjang shift.

### Neutral
- **Roastery Ink** (`#101426`): Warna teks utama ber-kontras tinggi (≥12:1) untuk judul dan total harga.
- **Roastery Ink Soft** (`#313854`): Teks sekunder dan label pembantu.
- **Muted Steel** (`#707692`): Teks metadata, placeholder, dan label form uppercase.
- **Clean Border** (`#e6e1f1`): Garis pembatas panel dan pemisah modul (1px solid).
- **Soft Paper** (`#f3effb`): Latar belakang area kerja (*workspace*).
- **Pure Surface** (`#faf8ff`): Latar belakang kartu menu, modal dialog, dan input form.

### Feedback
- **Sage Success** (`#2f7a46`): Indikator stok aman, status shift aktif, dan konfirmasi transaksi sukses.
- **Amber Warning** (`#c9861e`): Status stok menipis, peringatan printer label belum tersambung, dan badge Shift 1.
- **Danger Red** (`#b84040`): Tombol hapus, status printer struk terputus, dan pesan error.

### Named Rules
**The Single Dominant Blue Rule.** Warna biru `#00349b` hanya digunakan untuk elemen yang dapat diklik atau status yang sedang aktif. Tidak ada elemen teks statis biasa yang diwarnai biru agar pengguna tidak salah mengira teks sebagai tombol.

**The Semantic Status Isolation Rule.** Warna hijau (`#2f7a46`), kuning (`#c9861e`), dan merah (`#b84040`) dicadangkan secara ketat untuk status operasional (kesehatan stok, konektivitas printer, dan notifikasi). Warna-warna ini tidak boleh digunakan sebagai dekorasi.

## Typography

**Display & Body Font:** `DM Sans` (dengan fallback `ui-sans-serif, system-ui, sans-serif`)  
**Financial & Monospace Font:** `DM Mono` (dengan fallback `ui-monospace, monospace`)

Karakter tipografi memadukan keramahan humanist `DM Sans` untuk navigasi dan nama menu dengan kejernihan mekanis `DM Mono` untuk seluruh data kuantitatif dan finansial.

### Hierarchy
- **Display** (800, `clamp(24px, 3vw, 42px)`, line-height 1): Digunakan pada judul utama login dan angka besar shift.
- **Headline** (700, `18px`, line-height 1.2): Digunakan pada judul modal (*Order Aktif*), subtotal grand total, dan ringkasan order.
- **Title** (700, `16px`, line-height 1.25): Digunakan pada judul section panel (*Keranjang*, *Daftar Pesanan*, *Kategori Menu*).
- **Body** (400/600, `13.5px`, line-height 1.45): Digunakan pada nama menu, opsi penyajian, dan teks deskripsi.
- **Label** (700, `10.5px`, letter-spacing 0.07em, uppercase): Digunakan pada label kolom input form dan status badge kecil.
- **Monospace Numerals** (500/700, `13–19px`, `DM Mono`): Digunakan pada harga menu, subtotal, total akhir (*Grand Total*), kembalian uang kasir, dan kode voucher.

### Named Rules
**The Monospace Money Rule.** Setiap nominal rupiah yang melibatkan perhitungan (keranjang, kembalian, laporan kas, harga modal) wajib menggunakan `font-family: var(--font-mono)` agar posisi koma dan digit selalu simetris saat dipindai cepat.

## Layout

Antarmuka Kasir Kopi Migi menggunakan model layout dua kolom asimetris yang dioptimalkan untuk orientasi landscape tablet (iPad/Android POS) dan desktop kasir.

- **Sidebar Kiri (Fixed Width: 220–250px):** Navigasi permanen dengan background *Midnight Navy*, berisi logo Kopi Migi, status jam shift aktif, menu kasir, dan tombol shift end.
- **Workspace Kanan (Fluid Flex):** Area kerja utama dengan lebar kontainer maksimum `1440px`, padding horizontal `clamp(18px, 2.2vw, 32px)`, dan padding vertikal `clamp(16px, 2vw, 28px)`.
- **POS Grid Split:** Panel katalog menu mendominasi 70–75% area (`minmax(0, 1fr)`), sedangkan panel keranjang checkout mengambil 25–30% (`minmax(300px, 360px)`) di sisi kanan.
- **Responsive Breakpoint:** Pada layar portrait/mobile (<900px), sidebar bertransformasi menjadi navigasi compact atau drawer, dan keranjang belanja beralih menjadi bottom dock.

## Elevation & Depth

Sistem ini menganut prinsip **Tonal & Spatial Layering** dengan bayangan halus (*soft blur shadows*). Kedalaman antarmuka dicapai melalui kontras warna bidang (navy pekat ke putih lembut) dan garis batas tipis 1px, bukan bayangan tebal yang memberatkan mata.

### Shadow Vocabulary
- **Subtle Rest (`--shadow-sm`):** `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` — Digunakan pada segmented switch aktif dan badge kuantitas menu.
- **Card Hover (`--shadow`):** `0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)` — Digunakan saat kartu menu atau baris transaksi disentuh/hover.
- **Modal Elevation (`--shadow-lg`):** `0 12px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)` — Digunakan pada popup modal checkout dan toast notification.

### Named Rules
**The Flat-in-Panel Rule.** Elemen form di dalam panel atau modal tidak menggunakan bayangan sendiri; kedalaman modul dibentuk oleh border `1px solid var(--line)` dan perbedaan latar belakang.

## Shapes

- **Kontainer & Modal:** Sudut membulat modern (`12px–16px radius`) memberikan kesan ramah dan mutakhir.
- **Tombol & Input Form:** Sudut membulat sedang (`8px–9px radius`) memastikan area sentuh nyaman dan presisi.
- **Pills & Badges:** Sudut lingkaran penuh (`999px radius`) untuk badge kuantitas menu, badge shift, dan switch status.

## Components

### Buttons
- **Primary Button:** Latar belakang `{colors.primary}`, teks putih, radius `{rounded.md}`, padding `11px 18px`, `font-weight: 700`.
- **Secondary Button:** Latar belakang putih, border `1px solid {colors.neutral-line}`, teks `{colors.neutral-dark}`.
- **Ghost Button:** Latar belakang transparan dengan hover `{colors.neutral-soft}` untuk aksi sekunder seperti tombol tutup atau hapus item.
- **Disabled State:** Opasitas `0.60` dengan `cursor: not-allowed` dan tanpa respon hover.

### Menu Cards
- **Card Base:** Latar belakang putih, border `1px solid {colors.neutral-line}`, radius `12px`, padding `18px`.
- **Selected State:** Border dan shadow aksen saat item sudah masuk ke dalam keranjang belanja.
- **Quantity Pill:** Kontainer mengambang `74×32px` dengan radius `999px` di pojok kartu, memuat tombol `-` dan `+` berukuran `24×24px` untuk kecepatan penambahan pesanan.

### Inputs & Selects
- **Base Style:** Border `1.5px solid {colors.neutral-line}`, background putih, radius `9px`, tinggi minimal `40px`.
- **Accessible Focus:** Outline `2px solid {colors.primary}` dengan ring bayangan `0 0 0 3px rgba(0, 52, 155, 0.28)`.

### Modals & Dialogs
- **Backdrop:** `rgba(18, 20, 36, 0.74)` dengan `backdrop-filter: blur(10px)`.
- **Card Structure:** Maksimal `min(840px, calc(100vw - 24px))`, background putih, terbagi menjadi ringkasan pesanan di kiri dan rincian pembayaran di kanan.

## Do's and Don'ts

### Do:
- **Do** gunakan `font-family: var(--font-mono)` untuk semua angka harga, total, kembalian, dan jam operasional shift.
- **Do** sediakan konfirmasi konfirmasi sebelum aksi yang berpotensi menghapus data (mengosongkan keranjang, menghapus crew, mereset kehadiran).
- **Do** pertahankan ukuran area sentuh (*touch target*) minimal 32px untuk semua kontrol interaktif tablet.
- **Do** gunakan bahasa Indonesia yang konsisten dan ramah (*Teman Migi*, *Proses Pesanan*, *Bayar Nanti*).

### Don't:
- **Don't** membungkus kotak-kotak form di dalam modal dengan border nested card bertingkat (*avoid cards inside cards*).
- **Don't** menggunakan warna biru brand `#00349b` untuk teks informasi non-klik.
- **Don't** mengganti teks status atau icon SVG dengan teks karakter darurat seperti `"v"`.
- **Don't** mencampur istilah tombol bahasa Inggris (*Process Order*) ke dalam antarmuka bahasa Indonesia.
