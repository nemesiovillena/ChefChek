#!/usr/bin/env python3
"""
Compara la extracción de albaranes por IA con y sin el texto de EasyOCR.

Variantes por foto (mismo modelo):
  A  foto + texto EasyOCR            (comportamiento actual)
  B  foto, sin texto OCR             (propuesta: saltar EasyOCR)
  C  solo texto EasyOCR + hints      (paso "refine" actual; requiere --hints)

No es un test de CI: las variantes A/B/C gastan llamadas reales al proveedor
de IA. Sin OCR_COMPARE_API_KEY solo ejecuta y cachea EasyOCR (gratis).

Uso (desde backend/ocr-microservice, con el python del venv del servicio):
  OCR_COMPARE_API_KEY=... python tests/compare_ai_with_and_without_ocr_text.py \
      <carpeta_fotos> <carpeta_salida> [--hints hints.json] [--model openrouter-gemini-flash]

hints.json: lista de {"name": "<proveedor>", "hints": {...ocrLayoutHints}}.
"""
import argparse
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

from app.services.ai_extraction_service import AIExtractionService  # noqa: E402
from app.services.document_processor import _resize_if_needed  # noqa: E402
from app.services.image_preprocessing import ImagePreprocessor  # noqa: E402

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
HEADER_FIELDS = ["supplier_name", "supplier_cif", "document_number", "document_date", "total_amount"]
LINE_FIELDS = ["quantity", "unit", "unit_price", "total_price", "vat_percent", "lot"]


def load_image_like_production(path: Path) -> np.ndarray:
    """Misma carga que DocumentProcessor.process_image: EXIF + RGB + resize."""
    pil_image = ImageOps.exif_transpose(Image.open(io.BytesIO(path.read_bytes())))
    image = cv2.cvtColor(np.array(pil_image.convert("RGB")), cv2.COLOR_RGB2BGR)
    return _resize_if_needed(image)


def run_easyocr(image: np.ndarray, ocr_service, preprocessor) -> dict:
    start = time.time()
    preprocessed, _ = preprocessor.preprocess_image(image)
    preprocess_time = time.time() - start
    result = ocr_service.process_image(preprocessed)
    return {
        "raw_text": result.get("raw_text", ""),
        "confidence": result.get("confidence", 0.0),
        "preprocess_time": round(preprocess_time, 2),
        "ocr_time": round(result.get("processing_time", 0.0), 2),
    }


def find_hints(supplier_name, hints_list):
    """Empareja por nombre normalizado (contención en cualquier sentido)."""
    if not supplier_name:
        return None
    wanted = supplier_name.lower().strip()
    for entry in hints_list:
        known = (entry.get("name") or "").lower().strip()
        if known and (known in wanted or wanted in known):
            return entry["hints"]
    return None


def timed_extract(ai, **kwargs):
    start = time.time()
    result = ai.extract(**kwargs)
    return result, round(time.time() - start, 2)


def same_value(a, b) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) < 0.011
    if isinstance(a, str) and isinstance(b, str):
        return a.strip().lower() == b.strip().lower()
    return a == b


def diff_extractions(base: dict, other: dict) -> dict:
    """Discrepancias de `other` respecto a `base` (líneas emparejadas por orden)."""
    if not base or not other:
        return {"missing": True}
    header = [f for f in HEADER_FIELDS if not same_value(base.get(f), other.get(f))]
    base_lines, other_lines = base.get("products", []), other.get("products", [])
    line_diffs = []
    for index, (bl, ol) in enumerate(zip(base_lines, other_lines)):
        fields = [f for f in LINE_FIELDS if not same_value(bl.get(f), ol.get(f))]
        if fields:
            line_diffs.append({"line": index + 1, "fields": fields})
    return {
        "header": header,
        "line_count": [len(base_lines), len(other_lines)],
        "line_diffs": line_diffs,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("images_dir", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--hints", type=Path)
    parser.add_argument("--model", default="openrouter-gemini-flash")
    args = parser.parse_args()

    api_key = os.environ.get("OCR_COMPARE_API_KEY", "")
    hints_list = json.loads(args.hints.read_text()) if args.hints else []
    args.out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(p for p in args.images_dir.iterdir() if p.suffix.lower() in IMAGE_EXTENSIONS)
    ai = AIExtractionService()
    ocr_service = preprocessor = None
    summary = []

    for path in images:
        out_file = args.out_dir / f"{path.stem}.json"
        record = json.loads(out_file.read_text()) if out_file.exists() else {"file": path.name}
        image = load_image_like_production(path)

        if "ocr" not in record:
            if ocr_service is None:
                # Import perezoso: cargar EasyOCR tarda y no hace falta si todo está cacheado
                from app.services.ocr_service import OCRService
                ocr_service, preprocessor = OCRService(language="es", use_gpu=False), ImagePreprocessor()
            record["ocr"] = run_easyocr(image, ocr_service, preprocessor)
            out_file.write_text(json.dumps(record, ensure_ascii=False, indent=2, default=str))
        print(f"{path.name}: EasyOCR {record['ocr']['ocr_time']}s conf={record['ocr']['confidence']:.2f}", flush=True)

        if not api_key:
            continue

        _, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 85])
        image_base64 = base64.b64encode(encoded).decode("utf-8")
        raw_text = record["ocr"]["raw_text"]

        if not record.get("A"):
            record["A"], record["A_time"] = timed_extract(
                ai, ocr_text=raw_text, image_base64=image_base64, model=args.model, api_key=api_key)
        if not record.get("B"):
            record["B"], record["B_time"] = timed_extract(
                ai, ocr_text="", image_base64=image_base64, model=args.model, api_key=api_key)
        if not record.get("C"):
            hints = find_hints((record["A"] or {}).get("supplier_name"), hints_list)
            record["C_hints_found"] = bool(hints)
            if hints:
                record["C"], record["C_time"] = timed_extract(
                    ai, ocr_text=raw_text, image_base64="", model=args.model, api_key=api_key,
                    supplier_hints=hints)

        record["diff_B_vs_A"] = diff_extractions(record.get("A"), record.get("B"))
        if record.get("C"):
            record["diff_C_vs_A"] = diff_extractions(record.get("A"), record.get("C"))
        out_file.write_text(json.dumps(record, ensure_ascii=False, indent=2, default=str))
        summary.append(record)
        print(f"  A {record.get('A_time')}s  B {record.get('B_time')}s  "
              f"C {record.get('C_time', '-')}s  B-vs-A {json.dumps(record['diff_B_vs_A'])}", flush=True)

    if summary:
        (args.out_dir / "_summary.json").write_text(json.dumps([
            {k: r.get(k) for k in ("file", "A_time", "B_time", "C_time", "C_hints_found",
                                   "diff_B_vs_A", "diff_C_vs_A")} | {"ocr_time": r["ocr"]["ocr_time"]}
            for r in summary
        ], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
