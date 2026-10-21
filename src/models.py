from dataclasses import dataclass


@dataclass
class Vehicle:
    id: str
    width: int
    length: int
    weight: float
    shipping_fee: float
    eta: int

@dataclass
class Ship:
    width: int
    length: int
    max_capacity: float

@dataclass
class Placement:
    x: int
    y: int
    rotated: bool

@dataclass
class State:
    placements: dict[str, Placement | None]
    
    def key(self):
        return tuple(sorted(self.placements.items()))
