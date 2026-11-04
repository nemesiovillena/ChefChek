"""Neto de línea calculado a partir de printed_amount y discount_amount de la IA.

Ejecutar desde backend/ocr-microservice:  python3 -m unittest tests.test_line_net_amount_from_ai_response
"""
import json
import unittest

from app.services.ai_extraction_service import AIExtractionService


def parse_line(**fields):
    service = object.__new__(AIExtractionService)
    line = {"name": "x", "unit": "ud", "vat_percent": 21, **fields}
    return service._parse_json_response(json.dumps({"products": [line]}))["products"][0]


class LineNetAmountTest(unittest.TestCase):
    def test_discount_in_subrow_is_subtracted_from_printed_amount(self):
        # Coca-Cola: importe 35,04 y subfila «Dto. Fijo 16,47-».
        line = parse_line(quantity=1, unit_price=35.04, printed_amount=35.04, discount_amount=16.47)
        self.assertEqual(line["total_price"], 18.57)
        self.assertEqual(line["discount_amount"], 16.47)

    def test_per_unit_discount_column_is_not_subtracted_twice(self):
        # Bodegas Ruiz: 2 × 39,81, columna Dto. 19,91 €/caja, importe ya neto 39,81.
        line = parse_line(quantity=2, unit_price=39.81, printed_amount=39.81, discount_amount=19.91)
        self.assertEqual(line["total_price"], 39.81)
        self.assertIsNone(line["discount_amount"])

    def test_per_unit_discount_column_on_several_units(self):
        line = parse_line(quantity=2, unit_price=135.22, printed_amount=114.80, discount_amount=77.82)
        self.assertEqual(line["total_price"], 114.80)

    def test_printed_rounding_without_discount_keeps_printed_amount(self):
        # Punto verde: 6 × 0,07 impreso como 0,40.
        line = parse_line(quantity=6, unit_price=0.07, printed_amount=0.40)
        self.assertEqual(line["total_price"], 0.40)


if __name__ == "__main__":
    unittest.main()
