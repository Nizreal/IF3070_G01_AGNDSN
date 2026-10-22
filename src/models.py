from dataclasses import dataclass

# Menyimpan data kendaraan beserta ukuran, berat, biaya pengiriman, dan estimasi waktu kedatangan
@dataclass
class Vehicle:
    id: str
    width: int
    length: int
    weight: float
    shipping_fee: float
    eta: int

# Menyimpan ukuran deck kapal dan kapasitas maksimum muatan kapal
@dataclass
class Ship:
    width: int
    length: int
    max_capacity: float

# Menyimpan posisi kendaraan pada deck kapal dan apakah kendaraan dirotasi
@dataclass(frozen=True)
class Placement:
    x: int
    y: int
    rotated: bool

# Menyimpan konfigurasi penempatan seluruh kendaraan, None jika kendaraan tidak ditempatkan
@dataclass
class State:
    placements: dict[str, Placement | None]
    
    def key(self):
        return tuple(sorted(self.placements.items()))
