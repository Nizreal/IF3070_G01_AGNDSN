# Tugas Besar 1 IF3070 Dasar Inteligensi Artifisial

Repository ini dibuat untuk Tugas Besar 1 mata kuliah IF3070 Dasar Inteligensi Artifisial, yang berfokus pada pencarian penempatan kendaraan yang optimal di deck kapal menggunakan local search. Dalam prosesnya, program mempertimbangkan ukuran deck dan kapasitas muatan kapal. Program ini menggunakan interface web dengan Flask untuk memvisualisasikan algoritma dan melihat hasilnya.

## Setup dan Menjalankan Program

**Prasyarat:** Python 3.11 atau lebih baru.

1. Ekstrak repository, lalu buka terminal di **folder utama repository** (folder yang berisi `requirements.txt` dan `src/`).
2. Jalankan seluruh perintah sesuai sistem operasi yang digunakan.

**Windows (PowerShell):**

```powershell
py -3 --version
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m flask --app src.app run --host 127.0.0.1 --port 5000
```

**Linux/macOS:**

```bash
python3 --version
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m flask --app src.app run --host 127.0.0.1 --port 5000
```

3. Setelah server berjalan, buka **http://127.0.0.1:5000** di browser.
4. Data contoh akan dimuat otomatis dari `data/example.json`. Untuk mengimport data JSON secara manual, upload file JSON yang diinginkan.
5. Pilih algoritma dan klik **Run**, atau ubah data kapal dan kendaraan terlebih dahulu. Hasil simulasi ditampilkan di halaman web dan disimpan dalam folder `output/`.

Biarkan terminal server tetap berjalan selama menggunakan aplikasi. 

## Pembagian Tugas

| Nama | NIM | Tugas |
| --- | --- | --- |
| Nizham Rafa Lazuardi | 18224049 | Struktur data, Steepest-Ascent Hill Climbing, Genetic Algorithm |
| Adrian Akhdan Assyauqi | 18224055 | Random-Restart Hill Climbing, Simulated Annealing |
| Muhammad Azikra Wira Pratama | 18224089 | Hill Climbing with Sideways Moves, Stochastic Hill Climbing, visualisasi |
