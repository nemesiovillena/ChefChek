#!/usr/bin/env python3
"""
Script de debug para ver qué está extrayendo realmente el OCR
"""
import requests
import sys
import json

# Ruta a un albarán de prueba (se puede cambiar)
TEST_IMAGE_PATH = sys.argv[1] if len(sys.argv) > 1 else "test_albaran.jpg"

print("=" * 80)
print("DEBUG OCR - Análisis de texto extraído")
print("=" * 80)

# Leer la imagen
try:
    with open(TEST_IMAGE_PATH, 'rb') as f:
        image_data = f.read()
    print(f"✅ Imagen cargada: {TEST_IMAGE_PATH} ({len(image_data)} bytes)")
except Exception as e:
    print(f"❌ Error cargando imagen: {e}")
    sys.exit(1)

# Enviar al servicio OCR
print("\nEnviando al servicio OCR...")
url = "http://localhost:8000/ocr/image"

files = {
    'file': (TEST_IMAGE_PATH, image_data, 'image/jpeg')
}
data = {
    'enable_preprocessing': 'true',
    'enable_validation': 'true'
}

try:
    response = requests.post(url, files=files, data=data, timeout=30)
    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        result = response.json()

        print(f"\nSuccess: {result.get('success', False)}")
        print(f"Processing time: {result.get('processing_time', 0):.2f}s")

        if result.get('document'):
            doc = result['document']
            print(f"\n--- DOCUMENTO EXTRAÍDO ---")
            print(f"Proveedor: {doc.get('supplier_name', 'No detectado')}")
            print(f"Fecha: {doc.get('document_date', 'No detectada')}")
            print(f"Número: {doc.get('document_number', 'No detectado')}")
            print(f"Total: {doc.get('total_amount', 0)}€")
            print(f"Confianza: {(doc.get('confidence', 0) * 100):.1f}%")

            products = doc.get('products', [])
            print(f"\n--- PRODUCTOS EXTRAÍDOS ({len(products)}) ---")
            for i, p in enumerate(products, 1):
                print(f"{i}. {p.get('name', 'Sin nombre')} | "
                      f"{p.get('quantity', 0)} {p.get('unit', 'ud')} | "
                      f"€{p.get('unit_price', 0):.2f} | "
                      f"confianza: {(p.get('confidence', 0) * 100):.1f}%")

        if result.get('metadata'):
            meta = result['metadata']
            print(f"\n--- METADATA ---")
            print(f"File type: {meta.get('file_type', 'unknown')}")
            print(f"File size: {meta.get('file_size', 0)} bytes")
            print(f"Preprocessing: {meta.get('preprocessing_applied', False)}")
            print(f"Validation: {meta.get('validation_applied', False)}")

        # TEXTO CRUDO DEL OCR - LO MÁS IMPORTANTE PARA DEBUG
        print("\n" + "=" * 80)
        print("TEXTO CRUDO DEL OCR (raw_text)")
        print("=" * 80)
        if doc.get('raw_text'):
            raw_text = doc['raw_text']
            print(raw_text)
            print(f"\nLongitud: {len(raw_text)} caracteres")
            print(f"Líneas: {len(raw_text.split(chr(10)))}")

            # Guardar en archivo para análisis
            with open('debug_ocr_output.txt', 'w', encoding='utf-8') as f:
                f.write(raw_text)
            print(f"\n✅ Texto guardado en: debug_ocr_output.txt")
        else:
            print("⚠️ No hay texto crudo disponible")

        # DETALLE OCR
        if result.get('metadata', {}).get('ocr_metadata'):
            ocr_meta = result['metadata']['ocr_metadata']
            print(f"\n--- METADATA OCR ---")
            print(f"Confianza global: {ocr_meta.get('confidence', 0):.2f}")
            print(f"Líneas detectadas: {ocr_meta.get('line_count', 0)}")
            print(f"Idioma: {ocr_meta.get('language', 'unknown')}")

    else:
        print(f"❌ Error en respuesta: {response.text}")

except Exception as e:
    print(f"❌ Error en petición: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)