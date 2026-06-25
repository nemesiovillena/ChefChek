#!/bin/bash

# Script de instalación para el Microservicio OCR ChefChek

set -e  # Salir si algún comando falla

echo "🚀 Iniciando instalación del Microservicio OCR ChefChek..."

# Verificar Python
echo "📦 Verificando Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 no encontrado. Por favor instala Python 3.9+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | awk '{print $2}')
echo "✅ Python encontrado: $PYTHON_VERSION"

# Verificar versión de Python
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 9 ]); then
    echo "❌ Python 3.9+ requerido. Versión actual: $PYTHON_VERSION"
    exit 1
fi

# Crear entorno virtual
echo "🔧 Creando entorno virtual..."
python3 -m venv venv

# Activar entorno virtual
echo "✅ Activando entorno virtual..."
source venv/bin/activate

# Actualizar pip
echo "📦 Actualizando pip..."
pip install --upgrade pip setuptools wheel

# Instalar dependencias
echo "📦 Instalando dependencias Python..."
pip install -r requirements.txt

# Verificar Poppler
echo "🔍 Verificando Poppler..."
if command -v pdftoppm &> /dev/null; then
    echo "✅ Poppler encontrado"
else
    echo "⚠️  Poppler no encontrado. Instalando..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install poppler
        else
            echo "❌ Homebrew no encontrado. Por favor instala Homebrew primero"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update
        sudo apt-get install -y poppler-utils
    else
        echo "❌ Sistema operativo no soportado automáticamente"
        exit 1
    fi
fi

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p logs uploads tests

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo "✅ Archivo .env creado. Por favor edita según tus necesidades."
else
    echo "✅ Archivo .env ya existe"
fi

# Crear directorio de services
mkdir -p app/services

# Verificar instalación
echo "🧪 Verificando instalación..."
python -c "
import fastapi
import cv2
import paddleocr
from pdf2image import convert_from_path
print('✅ FastAPI:', fastapi.__version__)
print('✅ OpenCV:', cv2.__version__)
print('✅ PaddleOCR instalado')
print('✅ pdf2image instalado')
"

echo "✅ Instalación completada exitosamente!"
echo ""
echo "🎯 Próximos pasos:"
echo "1. Editar .env según tus necesidades"
echo "2. Ejecutar: source venv/bin/activate"
echo "3. Iniciar servicio: uvicorn app.main:app --reload"
echo "4. Acceder a documentación: http://localhost:8000/docs"
echo ""
echo "📚 Para más información, consulta README.md"