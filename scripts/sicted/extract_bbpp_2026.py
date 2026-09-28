#!/usr/bin/env python3
"""
Genera el seed del catálogo SICTED 2026 para "Restaurantes y empresas de catering".

Fuentes oficiales (Biblioteca de sicted.es, metodología SICTED 2026):
  - "Índice global de BBPP_20260618.xlsx": QUÉ buenas prácticas aplican al oficio
    (capítulo, eje, módulo, obligatoria/de mejora, esencial en evaluación parcial,
    "no aplica si unipersonal / sin personal / online"). Fuente de verdad.
  - "BP oficios Eje SOST. *.pdf" y "BP intersectoriales Eje SOST. *.pdf": descripción,
    documentación requerida, plantillas, BBPP relacionadas y ODS de cada práctica.

Los PDF son tablas con celdas combinadas y cabeceras en vertical cuya posición varía
por módulo, así que cada celda de datos se asigna a la columna de cabecera que contiene
su centro horizontal (no por índice de columna).

Uso:
  python3 scripts/sicted/extract_bbpp_2026.py <carpeta_manuales_2026> <salida.ts>
Requiere: openpyxl, pdfplumber.
"""
import glob
import json
import os
import re
import sys
import unicodedata

import openpyxl
import pdfplumber

OFICIO = "Restaurantes y empresas de catering"

# Palabra clave (sin tildes ni espacios) → nombre canónico de columna, en orden de
# prioridad. Las cabeceras verticales salen troceadas y al revés ("O|L|U|D|Ó|M"), por
# eso se prueba también el texto invertido; "TITULO" va primero porque a veces la celda
# de título viene fusionada con parte de "OBLIGATORIEDAD".
KEYWORDS = [
    ("TITULO", "title"),
    ("DESCRIPCION", "description"),
    ("OBLIGATORIEDAD", "mandatory"),
    ("CODIGOBP", "code"),
    ("ORDENBP", "order"),
    ("MODULO", "module"),
    ("NOAPLICA", "notApplicable"),
    ("REQUIERE", "requiresDocs"),
    ("DOCUMENTO", "document"),
    ("PLANTILLAS", "templates"),
    ("FORMULAS", "formulas"),
    ("COMPLEMENTARIAS", "formulas"),
    ("RELACIONADAS", "related"),
    ("AMBITO", "competitiveness"),
    ("COMPETITIVIDAD", "competitiveness"),
    ("FORMACI", "training"),
    ("INDICADOR", "indicator"),
    ("ODS", "ods"),
    ("EJE", "eje"),
]


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def label_of(text):
    if not text or not text.strip():
        return None
    forms = [text, text[::-1]]
    for form in forms:
        norm = re.sub(r"[^A-Z]", "", strip_accents(form.upper()))
        for keyword, name in KEYWORDS:
            if keyword in norm:
                # "ODS"/"EJE" son cortas: exigir que sean toda la celda
                if keyword in ("ODS", "EJE") and norm != keyword:
                    continue
                return name
    return None


def clean(text):
    if text is None:
        return ""
    text = text.replace("­", "")
    lines = [ln.strip() for ln in text.split("\n")]
    out = []
    for ln in lines:
        if not ln:
            continue
        # une líneas cortadas a mitad de frase; mantiene viñetas en su propia línea
        if out and not ln.startswith(("•", "-", "·")) and not out[-1].endswith((".", ":", ";")):
            out[-1] = out[-1] + " " + ln
        else:
            out.append(ln)
    return "\n".join(out).strip()


def digits(text):
    return re.sub(r"\D", "", text or "")


def parse_pdf(path):
    """Devuelve {codigoBP: {campo: texto}} para todas las prácticas del PDF."""
    records = {}
    # [(x0, x1, nombre)] en coordenadas relativas a la anchura de la tabla (0..1): la
    # cabecera ocupa varias filas y las páginas de continuación no la repiten y a veces
    # tienen otra escala, así que se compara en posición relativa, no en puntos.
    header = []
    last_code = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.find_tables():
                tx0, _, tx1, _ = table.bbox
                width = (tx1 - tx0) or 1

                def rel(cell):
                    return ((cell[0] - tx0) / width, (cell[2] - tx0) / width)

                for row in table.rows:
                    cells = [c for c in row.cells if c is not None]
                    texts = [page.crop(c).extract_text() or "" for c in cells]
                    if any(t.strip() == "TÍTULO" or "TÍTULO" in t for t in texts):
                        header = []
                    code_cell = None
                    labels = [(c, label_of(t)) for c, t in zip(cells, texts)]
                    if any(name for _, name in labels) and not any(
                        re.fullmatch(r"\d{4}", digits(t)) for t in texts
                    ):
                        header.extend((*rel(c), name) for c, name in labels if name)
                        continue
                    if not header:
                        continue
                    values = {}
                    for c, t in zip(cells, texts):
                        best, best_overlap = None, 0.0
                        cx0, cx1 = rel(c)
                        for x0, x1, name in header:
                            overlap = min(cx1, x1) - max(cx0, x0)
                            if overlap > best_overlap:
                                best, best_overlap = name, overlap
                        if best and t.strip():
                            values[best] = (values.get(best, "") + "\n" + t).strip()
                    # Comprobación de coherencia: la descripción es siempre la columna más
                    # ancha y el título la inmediatamente anterior. Si la cabecera heredada
                    # de otra página no cuadra con eso, se toman título/descripción por
                    # posición y se descartan los demás campos antes que asignarlos mal.
                    filled = [(c, t) for c, t in zip(cells, texts) if t.strip()]
                    if len(filled) >= 7:
                        widest = max(range(len(filled)), key=lambda i: filled[i][0][2] - filled[i][0][0])
                        desc_text = filled[widest][1].strip()
                        if values.get("description", "").strip() != desc_text and widest > 0:
                            values = {
                                k: values[k] for k in ("eje", "module", "code", "order", "mandatory") if k in values
                            }
                            values["description"] = desc_text
                            values["title"] = filled[widest - 1][1]
                            if any("√" in t for _, t in filled[widest + 1:]):
                                values["requiresDocs"] = "√"
                    code = digits(values.get("code"))
                    if len(code) == 4:
                        last_code = code
                        records[code] = values
                    elif last_code and any(values.get(k) for k in ("description", "title")):
                        # fila partida entre páginas: continúa la práctica anterior
                        prev = records[last_code]
                        for k, v in values.items():
                            if v and k not in ("code", "module", "eje", "order"):
                                prev[k] = (prev.get(k, "") + "\n" + v).strip()
    return records


def norm_title(title):
    return re.sub(r"[^A-Z]", "", strip_accents((title or "").upper()))


ACRONYMS = {
    "ia": "IA", "iot": "IoT", "3d": "3D", "ra": "RA", "rv": "RV", "qr": "QR",
    "acs": "ACS", "ods": "ODS", "rsc": "RSC", "google": "Google", "wifi": "wifi",
}


def sentence_case(title):
    t = " ".join(title.split()).strip().lower()
    # "RESTAURACIÓN. COCINA" → "Restauración. Cocina"
    t = re.sub(r"(^|\.\s+)(\w)", lambda m: m.group(1) + m.group(2).upper(), t)
    # Siglas y nombres propios que el paso a minúsculas estropea
    return re.sub(r"\b(\w+)\b", lambda m: ACRONYMS.get(m.group(1), m.group(1)), t)


def codes_list(text):
    """Códigos BP de 4 dígitos; el PDF parte números entre líneas ("0045;00\n76")."""
    compact = re.sub(r"\s+", "", text or "")
    return [c for c in re.split(r"[;,]", compact) if re.fullmatch(r"\d{4}", c)]


def ods_list(text):
    """"4; 8;10", "4;5;1 0", "9, 13" → "4;8;10" (el PDF mete espacios y comas)."""
    compact = re.sub(r"\s+", "", text or "").replace(",", ";")
    return ";".join(p for p in compact.split(";") if p.isdigit()) or None


def main(folder, out_path):
    xlsx = glob.glob(os.path.join(folder, "*ndice global de BBPP*.xlsx"))[0]
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    rows = list(wb["BBPP por oficio"].iter_rows(values_only=True))
    col = next(i for i, h in enumerate(rows[1]) if h == OFICIO)

    pdf_records = {}
    for path in sorted(glob.glob(os.path.join(folder, "BP *.pdf"))):
        for code, rec in parse_pdf(path).items():
            pdf_records.setdefault(code, rec)

    practices, missing = [], []
    for r in rows[2:]:
        if r[col] != "X":
            continue
        scope = (r[col + 1] or "").strip().upper()
        chapter = "COMPLEMENTARIO" if scope.startswith("COMPL") else (
            "INTERSECTORIAL" if r[1] == "INTERSECTORIAL" else "OFICIO")
        code = str(r[5]).zfill(4)
        module_code = str(r[3]).zfill(3)
        rec = pdf_records.get(code)
        if rec is None:
            # Las fuentes oficiales discrepan en algún código (p. ej. el Excel dice 0371 y
            # el PDF 0370 para "Proporcionar un envoltorio..."): se empareja por título.
            wanted = norm_title(r[7])
            rec = next(
                (v for v in pdf_records.values() if norm_title(v.get("title")) == wanted),
                None,
            )
        if rec is None:
            missing.append(code)
            rec = {}
        na = [label for label, flag in (("UNIPERSONAL", r[8]), ("SIN_INSTALACIONES", r[9]), ("ONLINE", r[10])) if flag]
        practices.append({
            "code": code,
            "chapter": chapter,
            "axis": {"ECONÓMICO": "ECONOMICO", "SOCIAL": "SOCIAL", "AMBIENTAL": "AMBIENTAL"}[r[2]],
            "moduleCode": module_code,
            "moduleName": sentence_case(r[4]),
            "title": sentence_case(r[7]),
            "isMandatory": r[6] == "O",
            "isEssential": bool(r[11]),
            "description": clean(rec.get("description")) or None,
            "requiresDocs": "√" in (rec.get("requiresDocs") or ""),
            "requiredDocs": clean(rec.get("document")) or None,
            "templates": clean(rec.get("templates")) or None,
            "relatedCodes": codes_list(rec.get("related")),
            "notApplicableWhen": na,
            "ods": ods_list(rec.get("ods")),
        })

    oficio = [p for p in practices if p["chapter"] != "COMPLEMENTARIO"]
    compl = [p for p in practices if p["chapter"] == "COMPLEMENTARIO"]
    stats = {
        "total": len(practices),
        "oficio": len(oficio),
        "oficioObligatorias": sum(p["isMandatory"] for p in oficio),
        "complementarias": len(compl),
        "complementariasObligatorias": sum(p["isMandatory"] for p in compl),
        "esenciales": sum(p["isEssential"] for p in practices),
        "sinDescripcion": [p["code"] for p in practices if not p["description"]],
        "noEncontradasEnPdf": missing,
    }
    print(json.dumps(stats, ensure_ascii=False, indent=2))

    index_date = re.search(r"(\d{8})", os.path.basename(xlsx)).group(1)
    header = (
        "// AUTOGENERADO por scripts/sicted/extract_bbpp_2026.py — no editar a mano.\n"
        "// Fuente: Biblioteca sicted.es, «Índice global de BBPP_20260618.xlsx» (qué aplica a\n"
        f"// «{OFICIO}») + PDF «BP oficios/intersectoriales Eje SOST.*» (descripciones).\n"
        f"// {stats['oficio']} de oficio ({stats['oficioObligatorias']} obligatorias) + "
        f"{stats['complementarias']} complementarias; {stats['esenciales']} esenciales.\n"
        "// Textos © SEGITTUR (CC BY-NC-ND): uso interno del restaurante, no redistribuir.\n"
        'import { SictedPracticeSeed2026 } from "./sicted-practice-catalog-2026.types";\n\n'
        f'export const SICTED_CATALOG_2026_VERSION = "SICTED 2026 (Índice {index_date})";\n\n'
        "export const SICTED_PRACTICE_CATALOG_2026_SEED: SictedPracticeSeed2026[] = "
    )
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(header + json.dumps(practices, ensure_ascii=False, indent=2) + ";\n")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
