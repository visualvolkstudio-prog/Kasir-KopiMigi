# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Kasir** — staf kedai yang mengoperasikan POS harian: mencatat pesanan, memproses pembayaran, dan mencetak/mengirim struk. Bekerja dalam kondisi ramai, posisi berdiri, layar dibuka terus-menerus saat shift.

**Pemilik / manajer** — memantau laporan penjualan, mengelola menu dan harga, stok bahan, serta data karyawan. Bisa mengakses dari perangkat yang sama atau terpisah.

## Product Purpose

Aplikasi kasir (POS) berbasis web untuk kedai kopi Kopi Migi. Memungkinkan kasir mencatat transaksi cepat dan akurat, serta memberi pemilik visibilitas penuh atas operasional kedai — penjualan, stok, dan karyawan — tanpa ketergantungan pada aplikasi kasir berbayar pihak ketiga.

## Positioning

POS web yang dibangun khusus untuk Kopi Migi: operasional ringan, offline-capable (PWA), dan sepenuhnya dikontrol oleh pemilik tanpa langganan bulanan.

## Operating Context

- Digunakan di dalam kedai saat jam operasional (Shift 1: 10:00–17:00, Shift 2: 17:00–23:00)
- Kasir login per shift dan pilih nama petugas sebelum mulai
- Layar aktif terus-menerus selama shift berlangsung
- Lingkungan bisa ramai, pencahayaan bervariasi
- Koneksi internet tidak selalu stabil — aplikasi harus bisa berjalan offline (PWA)

## Capabilities and Constraints

- **Fitur aktif:** POS / transaksi, manajemen menu, laporan penjualan, manajemen stok/inventori, manajemen karyawan
- **Platform:** Web (PWA, installable), responsif untuk tablet dan desktop/laptop
- **Bahasa antarmuka:** Bahasa Indonesia
- **Stack:** Vanilla HTML/CSS/JS, single-page app, service worker untuk offline
- **Theme color brand:** `#00349b` (biru Kopi Migi)
- **Fonts:** DM Sans (UI), DM Mono (angka/kode)
- **Icons:** Phosphor Icons

## Brand Commitments

- Nama brand: **Kopi Migi**
- Logo resmi tersedia di `/assets/logo-miginew-transparent.png`
- Warna utama: biru `#00349b`
- Bahasa Indonesia sebagai satu-satunya bahasa antarmuka

## Evidence on Hand

- Implementasi visual lengkap ada di `index.html` + `styles.css` + `app.js`
- Logo: `assets/logo-miginew-transparent.png`, `assets/favicon-migi.png`
- PWA manifest: `manifest.json`
- Offline support via `sw.js`

## Product Principles

1. **Kecepatan transaksi di atas segalanya** — kasir tidak boleh terhambat oleh UI yang lambat atau membingungkan.
2. **Andal di kondisi lapangan** — offline-first, ringan, tidak bergantung koneksi stabil.
3. **Kontrol penuh di tangan pemilik** — tidak ada vendor lock-in, pemilik bisa ubah menu, harga, dan karyawan sendiri.
4. **Konsisten dengan identitas Kopi Migi** — tampilan mencerminkan brand yang sudah dikenal pelanggan.
5. **Satu aplikasi, dua peran** — kasir dan pemilik terlayani dalam satu sistem tanpa friksi antar-peran.

## Accessibility & Inclusion

- Antarmuka harus bisa dioperasikan oleh staf dengan latar belakang teknis minimal
- Ukuran tap target memadai untuk layar sentuh tablet
