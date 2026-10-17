"""
Reparto del IVA por línea a partir del desglose del pie del albarán.

Muchos albaranes no imprimen el tipo de IVA en cada línea, solo el desglose
final (base por tipo). La IA lee bien ese desglose pero asigna mal el tipo a
las líneas: elegir qué líneas suman cada base es un problema de sumas que no
resuelve de forma fiable. Aquí se resuelve por fuerza bruta y solo se aplica
cuando el reparto de la IA no cuadra y existe una única solución exacta.
"""
import itertools
import re
from typing import Optional

# Cargos que acompañan al artículo de encima y llevan su mismo IVA
_ATTACHED_CHARGE = re.compile(r"punto\s*verde|eco\s*-?\s*tasa", re.IGNORECASE)
_STANDARD_RATES = (0.0, 4.0, 5.0, 10.0, 21.0)
_TOLERANCE = 0.015
_MAX_COMBINATIONS = 100_000


def _breakdown_entries(vat_breakdown) -> list[tuple[float, float]]:
    """(tipo, base) del desglose; el tipo se corrige con cuota/base si no casa."""
    entries = []
    for entry in vat_breakdown or []:
        try:
            base = float(entry.get("base") or 0)
            rate = float(entry.get("rate") or 0)
            amount = entry.get("amount")
        except (TypeError, ValueError, AttributeError):
            return []
        if base <= 0:
            continue
        if amount is not None:
            implied = float(amount) / base * 100
            if abs(implied - rate) > 1:
                rate = min(_STANDARD_RATES, key=lambda r: abs(r - implied))
        entries.append((rate, base))
    return entries


def _group_lines(products: list[dict]) -> list[list[dict]]:
    """Cada artículo con los cargos (punto verde) que van justo debajo."""
    groups: list[list[dict]] = []
    for product in products:
        if groups and _ATTACHED_CHARGE.search(product.get("name") or ""):
            groups[-1].append(product)
        else:
            groups.append([product])
    return groups


def _matches(sums_by_rate: dict[float, float], entries: list[tuple[float, float]]) -> bool:
    return all(abs(sums_by_rate.get(rate, 0) - base) <= _TOLERANCE for rate, base in entries) and all(
        rate in dict(entries) for rate, total in sums_by_rate.items() if abs(total) > _TOLERANCE
    )


def reconcile_line_vat_with_breakdown(data: dict) -> None:
    """Corrige in situ el vat_percent de las líneas si el desglose lo determina."""
    products = data.get("products") or []
    entries = _breakdown_entries(data.get("vat_breakdown"))
    if not products or not entries:
        return

    groups = _group_lines(products)
    group_totals = [sum(float(p.get("total_price") or 0) for p in g) for g in groups]

    current: dict[float, float] = {}
    for product in products:
        rate = product.get("vat_percent")
        if rate is not None:
            current[float(rate)] = current.get(float(rate), 0) + float(product.get("total_price") or 0)
    if all(p.get("vat_percent") is not None for p in products) and _matches(current, entries):
        return

    rates = [rate for rate, _ in entries]
    if len(rates) ** len(groups) > _MAX_COMBINATIONS:
        return

    solution: Optional[tuple[float, ...]] = None
    for combo in itertools.product(rates, repeat=len(groups)):
        sums: dict[float, float] = {}
        for rate, total in zip(combo, group_totals):
            sums[rate] = sums.get(rate, 0) + total
        if _matches(sums, entries):
            if solution is not None:
                return  # varias soluciones: no hay forma de saber cuál es
            solution = combo

    if solution is None:
        return
    for rate, group in zip(solution, groups):
        for product in group:
            product["vat_percent"] = rate
            if product.get("unit_price"):
                product["price_with_vat"] = round(product["unit_price"] * (1 + rate / 100), 4)
