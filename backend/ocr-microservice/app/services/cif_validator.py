"""
Validador de CIF/NIF españoles para extracción de documentos OCR

Propósito: Extraer, validar y puntuar confianza para identificadores fiscales españoles
"""
import re
import logging
from typing import Optional, Dict, Tuple, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TaxIdExtraction:
    """Resultado de extracción de CIF/NIF"""
    cif: Optional[str] = None
    nif: Optional[str] = None
    confidence: float = 0.0
    validation_errors: List[str] = None

    def __post_init__(self):
        if self.validation_errors is None:
            self.validation_errors = []


class CifNifValidator:
    """Validador de CIF/NIF españoles"""

    # Letras tipo entidad CIF
    CIF_ENTITY_TYPES = {
        'A': 'Sociedad Anónima',
        'B': 'Sociedad Limitada',
        'C': 'Sociedad Colectiva',
        'D': 'Comunidad de Bienes',
        'E': 'Comunidad de Propietarios',
        'F': 'Cooperativa',
        'G': 'Asociación',
        'H': 'Instituciones de Inversión Colectiva',
        'J': 'Sociedades Civiles',
        'N': 'Entidad Extranjera',
        'P': 'Corporación Local',
        'Q': 'Organismo Público',
        'R': 'Congregación Religiosa',
        'S': 'Órgano de la Administración',
        'U': 'Unión Temporal de Empresas',
        'V': 'Fondo de Pensiones',
        'W': 'Entidad de Garantía de Depósitos'
    }

    # CIF pattern: Letra + 7 dígitos + dígito de control
    # También soporta variantes con puntos o guiones
    CIF_PATTERN = re.compile(r'[A-Z][-]?\d{7}[-]?[0-9A-Z]')

    # NIF pattern: 8 dígitos + letra O X/Y/Z + 7 dígitos + letra (NIE)
    # También soporta variantes con puntos
    NIF_PATTERN = re.compile(r'(?:[0-9]{8}[A-Z]|[XYZ]\d{7}[A-Z])')

    # Patrones con prefijos explícitos (CIF:, NIF:, C.I.F., N.I.F.)
    PREFIX_PATTERN = re.compile(
        r'(?:C\.?I\.?F\.?|N\.?I\.?F\.?|CIF|NIF)[:\s]*([A-Z0-9-]+)',
        re.IGNORECASE
    )

    def __init__(self):
        """Inicializar validador"""
        logger.info("CifNifValidator inicializado")

    def extract_from_text(self, text: str) -> TaxIdExtraction:
        """
        Extrae CIF y NIF del texto OCR

        Args:
            text: Texto extraído por OCR

        Returns:
            TaxIdExtraction con CIF/NIF encontrados
        """
        result = TaxIdExtraction()

        # Primero buscar con prefijos explícitos (mayor confianza)
        prefix_matches = list(self.PREFIX_PATTERN.finditer(text))
        for match in prefix_matches:
            tax_id = self._clean_tax_id(match.group(1))
            cif_candidate, nif_candidate = self._classify_tax_id(tax_id)

            if cif_candidate:
                cif_valid, cif_message = self.validate_cif(cif_candidate)
                if cif_valid:
                    result.cif = cif_candidate
                    result.confidence = min(0.95, result.confidence + 0.3)
                    result.validation_errors.append(f"✅ CIF válido: {cif_candidate}")
                else:
                    result.validation_errors.append(f"⚠️ CIF inválido: {cif_candidate} - {cif_message}")

            if nif_candidate:
                nif_valid, nif_message = self.validate_nif(nif_candidate)
                if nif_valid:
                    result.nif = nif_candidate
                    result.confidence = min(0.95, result.confidence + 0.3)
                    result.validation_errors.append(f"✅ NIF válido: {nif_candidate}")
                else:
                    result.validation_errors.append(f"⚠️ NIF inválido: {nif_candidate} - {nif_message}")

        # Si no se encontró con prefijos, buscar formato sin prefijos
        if not result.cif and not result.nif:
            cif_matches = list(self.CIF_PATTERN.finditer(text))
            nif_matches = list(self.NIF_PATTERN.finditer(text))

            # Usar el primer match de CIF si existe
            if cif_matches:
                cif_candidate = self._clean_tax_id(cif_matches[0].group())
                cif_valid, cif_message = self.validate_cif(cif_candidate)
                if cif_valid:
                    result.cif = cif_candidate
                    result.confidence = min(0.8, result.confidence + 0.2)
                    result.validation_errors.append(f"✅ CIF detectado: {cif_candidate}")
                else:
                    result.validation_errors.append(f"⚠️ CIF detectado inválido: {cif_candidate}")

            # Usar el primer match de NIF si existe
            if nif_matches:
                nif_candidate = self._clean_tax_id(nif_matches[0].group())
                nif_valid, nif_message = self.validate_nif(nif_candidate)
                if nif_valid:
                    result.nif = nif_candidate
                    result.confidence = min(0.8, result.confidence + 0.2)
                    result.validation_errors.append(f"✅ NIF detectado: {nif_candidate}")
                else:
                    result.validation_errors.append(f"⚠️ NIF detectado inválido: {nif_candidate}")

        logger.info(f"Extracción completada: CIF={result.cif}, NIF={result.nif}, "
                   f"confianza={result.confidence:.2f}")
        return result

    def extract_and_validate(self, text: str) -> Dict[str, Optional[str]]:
        """
        Extrae y valida CIF/NIF del texto (formato simplificado)

        Args:
            text: Texto extraído por OCR

        Returns:
            Dict con 'cif', 'nif', 'confidence'
        """
        extraction = self.extract_from_text(text)
        return {
            'cif': extraction.cif,
            'nif': extraction.nif,
            'confidence': extraction.confidence
        }

    def validate_cif(self, cif: str) -> Tuple[bool, str]:
        """
        Valida CIF usando algoritmo de verificación

        Args:
            cif: CIF a validar

        Returns:
            (is_valid, message) - Si es válido y mensaje descriptivo
        """
        # Limpiar y normalizar
        cif_clean = self._clean_tax_id(cif)

        if len(cif_clean) != 9:
            return False, "Longitud incorrecta (debe ser 9 caracteres)"

        entity_letter = cif_clean[0].upper()
        num_part = cif_clean[1:8]
        control_char = cif_clean[8].upper()

        # Verificar letra de entidad
        if entity_letter not in self.CIF_ENTITY_TYPES:
            return False, f"Letra de entidad inválida: {entity_letter}"

        # Verificar que los 7 dígitos sean numéricos
        if not num_part.isdigit():
            return False, "Parte numérica inválida"

        # Calcular dígito de control
        calculated_control = self._calculate_cif_control_digit(entity_letter, num_part)

        # Validar dígito de control
        if calculated_control != control_char:
            return False, (f"Dígito de control inválido (esperado: {calculated_control}, "
                           f"recibido: {control_char})")

        return True, "CIF válido"

    def validate_nif(self, nif: str) -> Tuple[bool, str]:
        """
        Valida NIF/NIE usando algoritmo de verificación

        Args:
            nif: NIF a validar

        Returns:
            (is_valid, message) - Si es válido y mensaje descriptivo
        """
        # Limpiar y normalizar
        nif_clean = self._clean_tax_id(nif)

        if len(nif_clean) != 9:
            return False, "Longitud incorrecta (debe ser 9 caracteres)"

        # Extraer primera letra (puede ser X/Y/Z para NIE)
        first_char = nif_clean[0].upper()
        num_part = nif_clean[1:8]
        control_letter = nif_clean[8].upper()

        # Reemplazar X/Y/Z por 0/1/2 para NIE
        if first_char in ['X', 'Y', 'Z']:
            replacement = {'X': '0', 'Y': '1', 'Z': '2'}
            first_char = replacement[first_char]
        elif not first_char.isdigit():
            return False, f"Primer carácter inválido: {first_char}"

        # Verificar que los 7 dígitos sean numéricos
        if not num_part.isdigit() and not first_char.isdigit():
            return False, "Parte numérica inválida"

        # Combinar primer carácter (convertido si es NIE) con num_part
        if first_char.isdigit():
            num_str = first_char + num_part
        else:
            num_str = num_part

        # Calcular dígito de control
        calculated_control = self._calculate_nif_control_letter(num_str)

        # Validar dígito de control
        if calculated_control != control_letter:
            return False, (f"Dígito de control inválido (esperado: {calculated_control}, "
                           f"recibido: {control_letter})")

        return True, "NIF válido"

    def _calculate_cif_control_digit(self, entity_letter: str, num_part: str) -> str:
        """
        Calcula el dígito de control para CIF

        Args:
            entity_letter: Letra tipo entidad
            num_part: Parte numérica del CIF (7 dígitos)

        Returns:
            Dígito de control calculado
        """
        # Sumar posiciones pares
        sum_even = sum(int(num_part[i]) for i in range(1, 7, 2))

        # Multiplicar y sumar posiciones impares
        odd_values = [int(num_part[i]) * 2 for i in range(0, 7, 2)]
        sum_odd = 0
        for val in odd_values:
            sum_odd += (val // 10) + (val % 10)

        total = sum_even + sum_odd
        calculated_control = (10 - (total % 10)) % 10

        # Para entidades Q/S, el dígito de control es letra
        if entity_letter in ['Q', 'S']:
            control_letters = 'JABCDEFGHI'
            return control_letters[calculated_control]

        # Para otras entidades, el dígito de control es número
        return str(calculated_control)

    def _calculate_nif_control_letter(self, num_str: str) -> str:
        """
        Calcula la letra de control para NIF/NIE

        Args:
            num_str: Parte numérica del NIF (8 dígitos)

        Returns:
            Letra de control calculada
        """
        # Calcular dígito de control
        num = int(num_str)
        remainder = num % 23
        control_letters = 'TRWAGMYFPDXBNJZSQVHLCKE'

        return control_letters[remainder]

    def _clean_tax_id(self, tax_id: str) -> str:
        """
        Limpia el identificador fiscal eliminando caracteres especiales

        Args:
            tax_id: CIF/NIF original

        Returns:
            CIF/NIF limpio (solo letras y números)
        """
        # Remover espacios, puntos, guiones
        cleaned = re.sub(r'[\s.-]', '', tax_id)

        # Convertir a mayúsculas
        cleaned = cleaned.upper()

        # Corrección de errores OCR comunes
        cleaned = cleaned.replace('O', '0')
        cleaned = cleaned.replace('I', '1')

        return cleaned

    def _classify_tax_id(self, tax_id: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Clasifica un identificador fiscal como CIF o NIF

        Args:
            tax_id: Identificador fiscal limpio

        Returns:
            (cif_candidate, nif_candidate) - Tupla con el clasificado
        """
        tax_id_upper = tax_id.upper()

        # Si empieza con letra de entidad CIF, es CIF
        if tax_id_upper[0] in self.CIF_ENTITY_TYPES:
            return tax_id_upper, None

        # Si empieza con X/Y/Z, es NIE
        if tax_id_upper[0] in ['X', 'Y', 'Z']:
            return None, tax_id_upper

        # Si empieza con número, puede ser NIF o CIF (B, N, etc.)
        if tax_id_upper[0].isdigit():
            # Verificar si tiene formato NIF (8 dígitos + letra)
            if len(tax_id_upper) == 9 and tax_id_upper[-1].isalpha():
                return None, tax_id_upper
            # Si no, no podemos clasificar
            return None, None

        return None, None