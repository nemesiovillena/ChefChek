"""
AI Extraction Service — usa modelos de IA (OpenAI, Gemini, Anthropic)
para extraer datos estructurados de albaranes a partir del texto OCR + imagen.

El modelo y API key se reciben como parámetros (no desde .env),
permitiendo al usuario elegir el proveedor desde el frontend.
"""
import logging
import base64
import json
import time
from typing import Optional

from .vat_breakdown_reconciliation import reconcile_line_vat_with_breakdown

logger = logging.getLogger(__name__)

# Prompt optimizado para albaranes españoles
ALBARAN_EXTRACTION_PROMPT = """Eres un experto en la lectura de albaranes y notas de entrega españoles.
A partir del texto OCR y la imagen del documento, extrae los datos estructurados.

REGLAS IMPORTANTES:
1. El PROVEEDOR es la empresa que EMITE el albarán (la que vende). Suele aparecer en la cabecera/logo del documento.
2. El CLIENTE es quien RECIBE la mercancía. NO confundas cliente con proveedor. NO extraigas datos del cliente.
3. Solo incluye productos reales de la tabla de líneas. NO incluyas:
   - Encabezados de tabla (Código, Descripción, Cantidad, Precio, etc.)
   - Líneas de totales, subtotales, IVA, base imponible
   - Datos del cliente, dirección, teléfono, email
   - URLs, información bancaria
   - Texto de pie de página o condiciones
4. Las cantidades usan coma decimal en español (ej: 0,88 = 0.88)
5. Si no puedes determinar un campo con confianza, déjalo como null
6. El registro sanitario del proveedor suele aparecer como "R.S.", "Reg. Sanitario" o "RGSA" seguido de un código.
7. El IVA puede variar por línea (4%, 10%, 21%). Extrae el porcentaje exacto de cada línea.
8. price_with_vat = unit_price × (1 + vat_percent/100). Si aparece en el documento, úsalo; si no, calcúlalo.
9. CARGOS DEL PIE: algunos albaranes ponen fuera de la tabla de líneas, en el bloque de totales, un cargo con importe propio
   que SÍ se suma al total: tasas ("T.S.", "Tasa", "Tasa servicio"), portes o transporte, punto verde, envases, recargo de servicio...
   Suelen tener su propia base y su propio tipo de IVA en el desglose. NO son un total: inclúyelos en "products" como una línea más,
   con name = la etiqueta tal cual aparece (ej: "T.S."), quantity 1, unit "ud", unit_price = su importe sin IVA y su vat_percent.
   Comprobación: la suma de total_price de todas las líneas (incluidos estos cargos) debe coincidir con la base total del albarán.
   El recargo de equivalencia (R.E.) NO es un cargo: no lo incluyas como línea.
10. IMPORTES Y DESCUENTOS: lee, no calcules. Para cada línea:
   - printed_amount = el número que aparece en la columna IMPORTE de ESA misma fila, tal cual (sin restar descuentos de
     subfila). Si la fila no imprime importe, null. Es la referencia: NO lo sustituyas por cantidad × precio.
   - discount_amount = importe en euros de un descuento que va en SUBFILA aparte (ver abajo), en positivo; null si no hay.
     Si el descuento va en una columna de la propia fila ("Dto.", "% Dto"), el importe impreso ya es el neto: printed_amount =
     ese importe y discount_amount null.
   - total_price = importe NETO sin IVA = printed_amount − discount_amount. unit_price es el precio de tarifa.
   - Descuento en SUBFILA debajo del artículo ("Dto. Fijo", "Dto. Promoción", "Descuento", "Rappel"...), con importe negativo
     (signo menos delante o DETRÁS: "16,47-" = -16.47): NO es una línea; va al discount_amount del artículo de encima
     (ej: AQUARIUS 1 × 35,04 importe 35,04, subfila "Dto. Fijo 16,47-" → printed_amount 35.04, discount_amount 16.47,
     total_price 18.57).
   - Subfilas solo informativas ("SUBUNIDADES/NETO", "Neto", "Precio neto unidad", desglose por unidad): NO son líneas ni cargos.
     Ignora TODOS sus números: ni su cantidad (subunidades por caja) ni su importe (suele sumar ya el punto verde) pertenecen a
     otra fila.
   - Subfila "Punto Verde" (o ecotasa/envase) bajo un artículo: SÍ es una línea propia, name "Punto Verde". Esa subfila no imprime
     cantidad propia: quantity = la CANTIDAD del artículo al que acompaña (cajas), nunca las subunidades de la fila de abajo.
     printed_amount = su importe impreso (ej: 6 cajas, precio 0,07, importe 0,40 → printed_amount 0.40 aunque 6 × 0,07 = 0,42),
     total_price = printed_amount, y el mismo vat_percent que su artículo.
   - Comprobación: si el papel trae subtotales ("TOTAL PRODUCTOS", "TOTAL PUNTO VERDE"), la suma de tus líneas debe darlos.
11. PIE DEL ALBARÁN: gross_amount, tax_base, vat_breakdown (base, tipo y cuota de cada fila), vat_total y total_amount se COPIAN
   tal cual están impresos, número a número, aunque no cuadren con tus líneas. NUNCA los recalcules ni los ajustes: se usan
   para comprobar tus líneas, así que un pie inventado esconde el error.
12. IVA SIN COLUMNA: si las líneas no imprimen su tipo de IVA, NO lo adivines: dedúcelo del desglose del pie. Agrupa cada artículo
   con su punto verde y busca qué grupos suman exactamente la base imponible de cada tipo (ej: desglose "10% base 30,00" y
   "21% base 12,50"; grupos 12,50 / 10,00 / 20,00 → el de 12,50 va al 21% y los de 10,00 + 20,00 = 30,00 al 10%).
   Si no lo consigues, deja tu mejor estimación en las líneas pero el pie igual que en el papel. Si el desglose no se lee,
   recuerda en España: agua mineral 10%, refrescos con azúcar añadido 21%, alcohol 21%, alimentos 10% o 4%.

Responde SOLO con JSON válido en este formato exacto:
{
  "supplier_name": "nombre del proveedor o null",
  "supplier_cif": "CIF/NIF del proveedor (formato A12345678) o null",
  "supplier_address": "dirección del proveedor o null",
  "supplier_phone": "teléfono del proveedor o null",
  "supplier_email": "correo del proveedor o null",
  "supplier_sanitary_registry": "nº registro sanitario RGSA del proveedor o null",
  "document_number": "número de albarán o null",
  "document_date": "fecha en formato YYYY-MM-DD o null",
  "products": [
    {
      "article_number": "código de artículo del proveedor o null",
      "name": "descripción del producto",
      "lot": "número de lote o null",
      "quantity": 10.0,
      "unit": "kg|g|l|ml|ud",
      "unit_price": 5.50,
      "vat_percent": 10.0,
      "price_with_vat": 6.05,
      "printed_amount": 55.00,
      "discount_amount": null,
      "total_price": 55.00
    }
  ],
  "gross_amount": 100.00,
  "tax_base": 100.00,
  "vat_breakdown": [
    {"rate": 10.0, "base": 80.00, "amount": 8.00},
    {"rate": 21.0, "base": 20.00, "amount": 4.20}
  ],
  "vat_total": 12.20,
  "total_amount": 112.20
}

Texto OCR del documento:
---
{ocr_text}
---

Extrae los datos del albarán:"""


# Prompt para catálogos/tarifas de proveedor (lista de precios, no un
# albarán): sin cliente, sin IVA por línea necesariamente, sin totales.
# Igual que ALBARAN_EXTRACTION_PROMPT: usa .replace(), nunca .format(),
# porque el JSON de ejemplo tiene llaves sin escapar.
CATALOG_EXTRACTION_PROMPT = """Eres un experto en la lectura de tarifas y catálogos de precios de proveedores de hostelería españoles.
A partir del texto OCR y la imagen del documento, extrae la lista de artículos con su precio.

REGLAS IMPORTANTES:
1. Esto es una TARIFA o CATÁLOGO (lista de precios), NO un albarán de entrega. No hay cliente ni cantidades entregadas.
2. Extrae CADA artículo de la tabla/lista con su precio unitario.
3. NO incluyas encabezados de tabla, condiciones comerciales, pies de página, datos bancarios ni logotipos.
4. El formato de compra (ej: "Caja 5kg", "Garrafa 5L", "Ud") suele ir junto al nombre o en una columna aparte.
5. Las cantidades y precios usan coma decimal en español (ej: 4,50 = 4.50).
6. Si el proveedor aparece identificado en el documento (cabecera/logo), inclúyelo; si no, deja null.
7. Si no puedes determinar un campo con confianza, déjalo como null.

Responde SOLO con JSON válido en este formato exacto:
{
  "supplier_name": "nombre del proveedor o null",
  "products": [
    {
      "article_number": "código de artículo del proveedor o null",
      "name": "descripción del producto",
      "purchase_format": "formato de compra (ej: Caja 5kg) o null",
      "unit_price": 5.50
    }
  ]
}

Texto OCR del documento:
---
{ocr_text}
---

Extrae la tarifa:"""


# Modelos soportados por provider
SUPPORTED_MODELS = {
    # OpenAI
    "gpt-4o-mini": "openai",
    "gpt-4o": "openai",
    # Google
    # gemini-2.5-flash retirado: Google devuelve 404 "no longer available to
    # new users" para keys nuevas (ver logs 2026-07-22). Gemini Flash sigue
    # disponible vía OpenRouter (openrouter-gemini-flash abajo).
    "gemini-2.0-flash": "google",
    "gemini-2.5-pro": "google",
    # Anthropic
    "claude-haiku-4-5-20251001": "anthropic",
    "claude-sonnet-4-20250514": "anthropic",
    # OpenRouter (usa API compatible con OpenAI)
    "openrouter-gpt-4o-mini": "openrouter",
    "openrouter-claude-haiku": "openrouter",
    "openrouter-gemini-flash": "openrouter",
    "openrouter-llama": "openrouter",
}

# Mapeo de modelos OpenRouter a los IDs reales del router
# (verificados contra https://openrouter.ai/api/v1/models — los IDs
# retirados devuelven 404 "No endpoints found" y fuerzan fallback a regex)
OPENROUTER_MODEL_IDS = {
    "openrouter-gpt-4o-mini": "openai/gpt-4o-mini",
    "openrouter-claude-haiku": "anthropic/claude-haiku-4.5",
    "openrouter-gemini-flash": "google/gemini-2.5-flash",
    "openrouter-llama": "meta-llama/llama-4-maverick",
}


def get_provider_for_model(model: str) -> Optional[str]:
    """Devuelve el provider para un modelo dado"""
    return SUPPORTED_MODELS.get(model)


class AIExtractionService:
    """Servicio de extracción de datos con IA multimodal"""

    def extract(
        self,
        ocr_text: str,
        image_base64: str,
        model: str,
        api_key: str,
        supplier_hints: Optional[dict] = None,
        document_type: str = "albaran",
    ) -> Optional[dict]:
        """
        Extraer datos estructurados usando IA.

        Args:
            ocr_text: Texto extraído por OCR
            image_base64: Imagen en base64 para visión multimodal
            model: Nombre del modelo (ej: 'gpt-4o-mini')
            api_key: API key del provider
            supplier_hints: Hints de layout del proveedor (opcional, solo albaranes)
            document_type: "albaran" (default) o "catalog" (tarifa/lista de precios)

        Returns:
            Dict con datos extraídos o None si falla
        """
        provider = get_provider_for_model(model)
        if not provider:
            logger.error(f"Modelo no soportado: {model}. Soportados: {list(SUPPORTED_MODELS.keys())}")
            return None

        # Build prompt with optional supplier hints
        prompt = self._build_prompt(ocr_text, supplier_hints, document_type)

        start_time = time.time()

        try:
            if provider == "openai":
                result = self._extract_openai(prompt, image_base64, model, api_key)
            elif provider == "openrouter":
                result = self._extract_openrouter(prompt, image_base64, model, api_key)
            elif provider == "google":
                result = self._extract_gemini(prompt, image_base64, model, api_key)
            elif provider == "anthropic":
                result = self._extract_anthropic(prompt, image_base64, model, api_key)
            else:
                logger.error(f"Provider no implementado: {provider}")
                return None

            elapsed = time.time() - start_time
            logger.info(f"AI extraction OK con {model} en {elapsed:.2f}s: "
                       f"supplier={result.get('supplier_name')}, "
                       f"products={len(result.get('products', []))}")
            return result

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"AI extraction falló con {model} tras {elapsed:.2f}s: {e}")
            return None

    def _build_prompt(
        self,
        ocr_text: str,
        supplier_hints: Optional[dict] = None,
        document_type: str = "albaran",
    ) -> str:
        """Construye el prompt de extracción, incluyendo hints de proveedor si existen."""
        # No usar str.format(): el template contiene JSON de ejemplo con llaves sin escapar
        template = (
            CATALOG_EXTRACTION_PROMPT if document_type == "catalog" else ALBARAN_EXTRACTION_PROMPT
        )
        base_prompt = template.replace("{ocr_text}", ocr_text)

        # Los catálogos no usan hints de layout de proveedor (solo albaranes)
        if not supplier_hints or document_type == "catalog":
            return base_prompt

        # Build supplier context section
        hints_section = "\n\nCONTEXTO DEL PROVEEDOR:\n"
        hints_section += f"Este albarán es del proveedor \"{supplier_hints.get('supplierName', 'desconocido')}\".\n"
        hints_section += "Formato habitual de este proveedor:\n"

        if supplier_hints.get("columnOrder"):
            cols = ", ".join(supplier_hints["columnOrder"])
            hints_section += f"- Columnas en tabla: {cols}\n"

        if supplier_hints.get("typicalUnits"):
            units = ", ".join(supplier_hints["typicalUnits"])
            hints_section += f"- Unidades típicas: {units}\n"

        if supplier_hints.get("vatPercent"):
            hints_section += f"- IVA habitual: {supplier_hints['vatPercent']}%\n"

        if supplier_hints.get("tableMarker"):
            hints_section += f"- Los productos empiezan después de la línea que contiene \"{supplier_hints['tableMarker']}\"\n"

        if supplier_hints.get("priceDecimalSeparator") == "comma":
            hints_section += "- Los precios usan coma decimal (ej: 4,50 = 4.50)\n"

        # Add example lines as few-shot
        example_lines = supplier_hints.get("exampleLines", [])
        if example_lines:
            hints_section += "- Ejemplo de línea de este proveedor:\n"
            for ex in example_lines[:3]:
                raw = ex.get("raw", "")
                parsed = ex.get("parsed", {})
                if raw:
                    hints_section += f"  RAW: \"{raw}\"\n"
                    hints_section += f"  PARSE: {json.dumps(parsed, ensure_ascii=False)}\n"

        hints_section += "\nUsa este contexto para interpretar correctamente el albarán.\n"

        # Insert hints BEFORE the base prompt
        return hints_section + "\n" + base_prompt

    def _extract_openai(self, prompt: str, image_base64: str, model: str, api_key: str) -> dict:
        """Extracción usando OpenAI API (GPT-4o-mini, GPT-4o)"""
        from openai import OpenAI

        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=8000,
            temperature=0.1,
        )

        return self._parse_json_response(response.choices[0].message.content)

    def _extract_openrouter(self, prompt: str, image_base64: str, model: str, api_key: str) -> dict:
        """Extracción usando OpenRouter API (compatible con OpenAI SDK)"""
        from openai import OpenAI

        # OpenRouter usa la misma API que OpenAI con base_url diferente
        client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )

        # Obtener el ID real del modelo en OpenRouter
        router_model = OPENROUTER_MODEL_IDS.get(model, model)

        response = client.chat.completions.create(
            model=router_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            max_tokens=8000,
            temperature=0.1,
        )

        return self._parse_json_response(response.choices[0].message.content)

    def _extract_gemini(self, prompt: str, image_base64: str, model: str, api_key: str) -> dict:
        """Extracción usando Google Gemini API"""
        import google.generativeai as genai

        genai.configure(api_key=api_key)

        gemini_model = genai.GenerativeModel(model)

        # Preparar imagen para Gemini
        image_bytes = base64.b64decode(image_base64)
        image_part = {
            "mime_type": "image/jpeg",
            "data": image_bytes,
        }

        response = gemini_model.generate_content(
            [prompt, image_part],
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=8000,
            ),
        )

        return self._parse_json_response(response.text)

    def _extract_anthropic(self, prompt: str, image_base64: str, model: str, api_key: str) -> dict:
        """Extracción usando Anthropic API (Claude)"""
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)

        response = client.messages.create(
            model=model,
            max_tokens=8000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )

        # Claude devuelve content blocks
        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text

        return self._parse_json_response(text)

    def _parse_json_response(self, text: str) -> dict:
        """
        Parsear respuesta JSON del modelo IA.
        Maneja markdown code blocks y otros formatos comunes.
        """
        # Limpiar code blocks markdown
        text = text.strip()
        if text.startswith("```"):
            # Quitar ```json y ```
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Intentar encontrar JSON dentro del texto
            import re
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                except json.JSONDecodeError:
                    logger.error(f"No se pudo parsear JSON de la respuesta IA: {text[:200]}")
                    return {"products": [], "supplier_name": None, "total_amount": 0}
            else:
                logger.error(f"No se encontró JSON en la respuesta IA: {text[:200]}")
                return {"products": [], "supplier_name": None, "total_amount": 0}

        # Normalizar campos de productos (snake_case)
        for product in data.get("products", []):
            # Asegurar que unit es válida
            unit = product.get("unit", "ud").lower()
            valid_units = ["kg", "g", "l", "ml", "ud"]
            if unit not in valid_units:
                unit = "ud"
            product["unit"] = unit

            # Asegurar campos numéricos
            product["quantity"] = float(product.get("quantity", 0) or 0)
            product["unit_price"] = float(product.get("unit_price", 0) or 0)
            product["total_price"] = float(product.get("total_price", 0) or 0)

            # article_number y lot: string o null
            product["article_number"] = product.get("article_number") or None
            product["lot"] = product.get("lot") or None

            # vat_percent: float o null (fallback a 10)
            vp = product.get("vat_percent")
            product["vat_percent"] = float(vp) if vp is not None else None

            # price_with_vat: float o null
            pwv = product.get("price_with_vat")
            if pwv is not None:
                product["price_with_vat"] = float(pwv)
            elif product["unit_price"] > 0 and product.get("vat_percent") is not None:
                # Calcular si no viene pero tenemos datos
                product["price_with_vat"] = round(product["unit_price"] * (1 + product["vat_percent"] / 100), 4)
            else:
                product["price_with_vat"] = None

            # Si falta total_price, calcularlo (cantidad × precio sin IVA)
            if product["total_price"] == 0 and product["quantity"] > 0 and product["unit_price"] > 0:
                product["total_price"] = product["quantity"] * product["unit_price"]

            # Neto calculado aquí, no por la IA: importe impreso en la fila menos
            # el descuento leído. La IA a veces toma como neto una subfila
            # informativa que ya suma el punto verde ("SUBUNIDADES/NETO") o
            # recalcula cantidad × precio en vez de leer el importe del papel.
            discount = abs(float(product.get("discount_amount") or 0))
            printed = abs(float(product.get("printed_amount") or 0))
            gross = round(product["quantity"] * product["unit_price"], 2)
            line_base = printed or gross
            if 0 < discount < line_base:
                product["total_price"] = round(line_base - discount, 2)
            elif printed:
                product["total_price"] = printed
            if not discount and product["quantity"] > 0 and product["total_price"] > 0:
                # Sin descuento, una diferencia de medio céntimo por unidad o
                # menos es el precio unitario redondeado en el papel (6 × 0,07
                # impreso como 0,40): manda el importe y se ajusta el precio
                # para que la línea no aparente un descuento que no existe.
                rounding_gap = abs(gross - product["total_price"])
                if 0.005 < rounding_gap <= product["quantity"] * 0.005 + 1e-9:
                    product["unit_price"] = round(product["total_price"] / product["quantity"], 4)
                    if product["vat_percent"] is not None:
                        product["price_with_vat"] = round(product["unit_price"] * (1 + product["vat_percent"] / 100), 4)
            product["discount_amount"] = discount or None

        # Normalizar campos del proveedor
        # Mapear supplier_cif → cif_code (legacy compatibility)
        if data.get("supplier_cif") and not data.get("cif_code"):
            data["cif_code"] = data["supplier_cif"]
        elif data.get("cif_code") and not data.get("supplier_cif"):
            data["supplier_cif"] = data["cif_code"]

        # Normalizar totales
        for field in ["gross_amount", "tax_base", "vat_total"]:
            val = data.get(field)
            data[field] = float(val) if val is not None else None

        # Normalizar vat_breakdown
        vat_bd = data.get("vat_breakdown")
        if vat_bd and isinstance(vat_bd, list):
            for item in vat_bd:
                item["rate"] = float(item.get("rate", 0))
                item["base"] = float(item.get("base", 0))
                item["amount"] = float(item.get("amount", 0))

        reconcile_line_vat_with_breakdown(data)

        return data
