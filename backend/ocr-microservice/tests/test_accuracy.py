#!/usr/bin/env python3
"""
Script de pruebas de precisión OCR
Compara EasyOCR vs Tesseract.js usando albaranes reales
"""
import requests
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Any, Tuple
from datetime import datetime


class OCRAccuracyTester:
    """Probador de precisión OCR"""

    def __init__(self, ocr_service_url: str = "http://localhost:8000"):
        """
        Inicializar probador

        Args:
            ocr_service_url: URL del microservicio OCR
        """
        self.ocr_service_url = ocr_service_url
        self.results = []

    def test_image(self, image_path: str, enable_preprocessing: bool = True) -> Dict:
        """
        Procesar imagen con OCR

        Args:
            image_path: Ruta al archivo de imagen (relativa al directorio tests/ o absoluta)
            enable_preprocessing: Habilitar pre-procesamiento

        Returns:
            Dict con resultado del OCR
        """
        # Si es ruta relativa, buscar en el directorio padre (backend/ocr-microservice/)
        if not os.path.isabs(image_path) and not os.path.exists(image_path):
            current_dir = os.path.dirname(os.path.abspath(__file__))
            parent_dir = os.path.dirname(current_dir)
            full_path = os.path.join(parent_dir, image_path)

            if os.path.exists(full_path):
                image_path = full_path

        if not os.path.exists(image_path):
            return {"error": f"Archivo no encontrado: {image_path}"}

        start_time = time.time()

        try:
            with open(image_path, 'rb') as f:
                files = {'file': (os.path.basename(image_path), f, 'image/jpeg')}
                data = {
                    'enable_preprocessing': str(enable_preprocessing).lower(),
                    'enable_validation': str(True).lower()
                }

                response = requests.post(
                    f"{self.ocr_service_url}/ocr/image",
                    files=files,
                    data=data,
                    timeout=30
                )

                processing_time = time.time() - start_time

                if response.status_code == 200:
                    result = response.json()
                    result['processing_time'] = processing_time
                    return result
                else:
                    return {
                        "error": f"Error HTTP {response.status_code}",
                        "processing_time": processing_time,
                        "response": response.text
                    }

        except Exception as e:
            return {
                "error": f"Error de conexión: {str(e)}",
                "processing_time": time.time() - start_time
            }

    def calculate_field_accuracy(self, extracted: str, expected: str) -> float:
        """
        Calcular precisión de un campo específico

        Args:
            extracted: Valor extraído por OCR
            expected: Valor esperado (ground truth)

        Returns:
            Precisión 0-100
        """
        if not expected:
            return 100.0

        if not extracted:
            return 0.0

        # Precisión carácter por carácter
        extracted_lower = extracted.lower().strip()
        expected_lower = expected.lower().strip()

        if extracted_lower == expected_lower:
            return 100.0

        # Calcular Levenshtein distance simplificado
        max_len = max(len(extracted_lower), len(expected_lower))
        if max_len == 0:
            return 100.0

        matches = sum(1 for i in range(min(len(extracted_lower), len(expected_lower)))
                     if extracted_lower[i] == expected_lower[i])

        return (matches / max_len) * 100

    def evaluate_document(self, ocr_result: Dict, ground_truth: Dict) -> Dict:
        """
        Evaluar resultado OCR contra ground truth

        Args:
            ocr_result: Resultado del OCR
            ground_truth: Datos esperados

        Returns:
            Dict con evaluación de precisión
        """
        if not ocr_result.get('success') or not ocr_result.get('document'):
            return {
                "success": False,
                "error": ocr_result.get('error', 'OCR falló'),
                "overall_accuracy": 0.0
            }

        document = ocr_result['document']

        # Evaluar cada campo
        field_accuracies = {}

        # Proveedor
        supplier_acc = self.calculate_field_accuracy(
            document.get('supplier_name', ''),
            ground_truth.get('supplier_name', '')
        )
        field_accuracies['supplier_name'] = supplier_acc

        # Número de documento
        number_acc = self.calculate_field_accuracy(
            str(document.get('document_number', '')),
            str(ground_truth.get('document_number', ''))
        )
        field_accuracies['document_number'] = number_acc

        # Fecha (evaluación simple)
        date_acc = 100.0
        if ground_truth.get('document_date'):
            expected_date = ground_truth['document_date']
            extracted_date = document.get('document_date')
            if extracted_date:
                date_acc = 100.0 if str(extracted_date) == str(expected_date) else 0.0
            else:
                date_acc = 0.0
        field_accuracies['document_date'] = date_acc

        # Productos
        expected_products = ground_truth.get('products', [])
        extracted_products = document.get('products', [])

        product_accuracies = []
        for i, exp_prod in enumerate(expected_products):
            if i < len(extracted_products):
                ext_prod = extracted_products[i]
                name_acc = self.calculate_field_accuracy(
                    ext_prod.get('name', ''),
                    exp_prod.get('name', '')
                )
                qty_acc = 100.0 if abs(ext_prod.get('quantity', 0) - exp_prod.get('quantity', 0)) < 0.01 else 0.0
                price_acc = 100.0 if abs(ext_prod.get('unit_price', 0) - exp_prod.get('unit_price', 0)) < 0.01 else 0.0

                product_acc = (name_acc + qty_acc + price_acc) / 3
                product_accuracies.append(product_acc)
            else:
                product_accuracies.append(0.0)

        field_accuracies['products'] = sum(product_accuracies) / len(product_accuracies) if product_accuracies else 0.0

        # Total
        total_acc = 100.0 if abs(document.get('total_amount', 0) - ground_truth.get('total_amount', 0)) < 0.01 else 0.0
        field_accuracies['total_amount'] = total_acc

        # Precisión global
        overall_accuracy = sum(field_accuracies.values()) / len(field_accuracies)

        return {
            "success": True,
            "field_accuracies": field_accuracies,
            "overall_accuracy": overall_accuracy,
            "confidence": document.get('confidence', 0),
            "processing_time": ocr_result.get('processing_time', 0),
            "validation": ocr_result.get('validation')
        }

    def run_test_suite(self, test_data: List[Dict[str, Any]]) -> Dict:
        """
        Ejecutar suite de pruebas completa

        Args:
            test_data: Lista de casos de prueba con 'image_path' y 'ground_truth'

        Returns:
            Dict con resultados de todas las pruebas
        """
        print(f"=== Iniciando Suite de Pruebas OCR ===")
        print(f"Total casos: {len(test_data)}")
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        overall_accuracies = []
        overall_processing_times = []

        for i, test_case in enumerate(test_data, 1):
            image_path = test_case['image_path']
            ground_truth = test_case['ground_truth']
            test_name = test_case.get('name', f"Caso {i}")

            print(f"Procesando: {test_name}")
            print(f"  Imagen: {os.path.basename(image_path)}")

            # Ejecutar OCR
            ocr_result = self.test_image(image_path)

            if 'error' in ocr_result:
                print(f"  ❌ Error: {ocr_result['error']}")
                evaluation = {"success": False, "error": ocr_result['error']}
            else:
                # Evaluar resultado
                evaluation = self.evaluate_document(ocr_result, ground_truth)

                if evaluation['success']:
                    overall_accuracies.append(evaluation['overall_accuracy'])
                    overall_processing_times.append(evaluation['processing_time'])

                    print(f"  ✅ Precisión: {evaluation['overall_accuracy']:.1f}%")
                    print(f"  📊 Confianza: {evaluation['confidence']:.2f}")
                    print(f"  ⏱️ Tiempo: {evaluation['processing_time']:.2f}s")

                    # Detalles por campo
                    print(f"  📋 Campos:")
                    for field, acc in evaluation['field_accuracies'].items():
                        symbol = "✅" if acc >= 90 else "⚠️" if acc >= 70 else "❌"
                        print(f"     {symbol} {field}: {acc:.1f}%")
                else:
                    print(f"  ❌ Evaluación falló: {evaluation.get('error')}")

            # Guardar resultado
            self.results.append({
                "test_name": test_name,
                "image_path": image_path,
                "ground_truth": ground_truth,
                "ocr_result": ocr_result,
                "evaluation": evaluation
            })

            print()

        # Calcular estadísticas finales
        if overall_accuracies:
            avg_accuracy = sum(overall_accuracies) / len(overall_accuracies)
            avg_processing_time = sum(overall_processing_times) / len(overall_processing_times)
            min_accuracy = min(overall_accuracies)
            max_accuracy = max(overall_accuracies)
        else:
            avg_accuracy = min_accuracy = max_accuracy = avg_processing_time = 0

        final_results = {
            "total_cases": len(test_data),
            "successful_cases": len(overall_accuracies),
            "average_accuracy": avg_accuracy,
            "min_accuracy": min_accuracy,
            "max_accuracy": max_accuracy,
            "average_processing_time": avg_processing_time,
            "success_rate": (len(overall_accuracies) / len(test_data)) * 100 if test_data else 0,
            "detailed_results": self.results
        }

        return final_results

    def generate_report(self, results: Dict, output_file: str = "ocr_accuracy_report.json"):
        """
        Generar reporte de resultados

        Args:
            results: Resultados de pruebas
            output_file: Archivo de salida
        """
        report = {
            "summary": {
                "total_cases": results['total_cases'],
                "successful_cases": results['successful_cases'],
                "average_accuracy": round(results['average_accuracy'], 2),
                "min_accuracy": round(results['min_accuracy'], 2),
                "max_accuracy": round(results['max_accuracy'], 2),
                "average_processing_time": round(results['average_processing_time'], 2),
                "success_rate": round(results['success_rate'], 2),
                "test_date": datetime.now().isoformat()
            },
            "detailed_results": results['detailed_results'],
            "conclusions": self._generate_conclusions(results)
        }

        # Guardar JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        # Imprimir resumen
        print(f"=== RESUMEN DE PRUEBAS ===")
        print(f"✅ Casos exitosos: {results['successful_cases']}/{results['total_cases']}")
        print(f"📊 Precisión promedio: {results['average_accuracy']:.1f}%")
        print(f"📉 Precisión mínima: {results['min_accuracy']:.1f}%")
        print(f"📈 Precisión máxima: {results['max_accuracy']:.1f}%")
        print(f"⏱️ Tiempo promedio: {results['average_processing_time']:.2f}s")
        print(f"🎯 Tasa de éxito: {results['success_rate']:.1f}%")
        print()
        print(f"📄 Reporte guardado en: {output_file}")

        # Imprimir conclusiones
        print(f"\n=== CONCLUSIONES ===")
        for conclusion in report['conclusions']:
            print(f"• {conclusion}")

    def _generate_conclusions(self, results: Dict) -> List[str]:
        """
        Generar conclusiones basadas en resultados

        Args:
            results: Resultados de pruebas

        Returns:
            Lista de conclusiones
        """
        conclusions = []

        if results['average_accuracy'] >= 90:
            conclusions.append("✅ Precisión excelente (≥90%) - Sistema listo para producción")
        elif results['average_accuracy'] >= 80:
            conclusions.append("⚠️ Precisión buena (80-89%) - Recomendado optimizar pre-procesamiento")
        else:
            conclusions.append("❌ Precisión insuficiente (<80%) - Considerar alternativas (PaddleOCR, Nanonets, Rossum)")

        if results['success_rate'] >= 90:
            conclusions.append("✅ Alta tasa de éxito - Sistema confiable")
        else:
            conclusions.append("⚠️ Tasa de éxito baja - Investigar casos fallidos")

        if results['average_processing_time'] <= 5:
            conclusions.append("✅ Tiempo de procesamiento aceptable")
        else:
            conclusions.append("⚠️ Tiempo de procesamiento alto - Considerar optimización")

        return conclusions


def main():
    """Ejecutar pruebas de ejemplo"""
    tester = OCRAccuracyTester()

    # Ejemplo de prueba (reemplazar con albaranes reales)
    test_data = [
        {
            "name": "Albarán de prueba",
            "image_path": "test_albaran.jpg",
            "ground_truth": {
                "supplier_name": "Test SL.",
                "document_number": "TEST-001",
                "document_date": "2024-01-15",
                "total_amount": 70.0,
                "products": [
                    {
                        "name": "Producto 1",
                        "quantity": 10,
                        "unit": "ud",
                        "unit_price": 5.50
                    },
                    {
                        "name": "Producto 2",
                        "quantity": 5,
                        "unit": "kg",
                        "unit_price": 3.25
                    }
                ]
            }
        }
    ]

    # Ejecutar pruebas
    results = tester.run_test_suite(test_data)

    # Generar reporte
    tester.generate_report(results)


if __name__ == "__main__":
    main()