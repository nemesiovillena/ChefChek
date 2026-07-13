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


# Modelos soportados por provider
SUPPORTED_MODELS = {
    # OpenAI
    "gpt-4o-mini": "openai",
    "gpt-4o": "openai",
    # Google
    "gemini-2.0-flash": "google",
    "gemini-2.5-flash": "google",
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
    ) -> Optional[dict]:
        """
        Extraer datos estructurados usando IA.

        Args:
            ocr_text: Texto extraído por OCR
            image_base64: Imagen en base64 para visión multimodal
            model: Nombre del modelo (ej: 'gpt-4o-mini')
            api_key: API key del provider
            supplier_hints: Hints de layout del proveedor (opcional)

        Returns:
            Dict con datos extraídos o None si falla
        """
        provider = get_provider_for_model(model)
        if not provider:
            logger.error(f"Modelo no soportado: {model}. Soportados: {list(SUPPORTED_MODELS.keys())}")
            return None

        # Build prompt with optional supplier hints
        prompt = self._build_prompt(ocr_text, supplier_hints)

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

    def _build_prompt(self, ocr_text: str, supplier_hints: Optional[dict] = None) -> str:
        """Construye el prompt de extracción, incluyendo hints de proveedor si existen."""
        # No usar str.format(): el template contiene JSON de ejemplo con llaves sin escapar
        base_prompt = ALBARAN_EXTRACTION_PROMPT.replace("{ocr_text}", ocr_text)

        if not supplier_hints:
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

        return data
