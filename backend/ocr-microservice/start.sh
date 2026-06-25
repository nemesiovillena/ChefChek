#!/bin/bash

# Script de inicio para el Microservicio OCR ChefChek

set -e

echo "🚀 Iniciando Microservicio OCR ChefChek..."

# Verificar entorno virtual
if [ ! -d "venv" ]; then
    echo "❌ Entorno virtual no encontrado. Ejecuta install.sh primero"
    exit 1
fi

# Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source venv/bin/activate

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️  Archivo .env no encontrado. Creando desde .env.example..."
    cp .env.example .env
fi

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p logs uploads

# Iniciar servicio
echo "🎯 Iniciando servicio en http://localhost:8000"
echo "📚 Documentación disponible en http://localhost:8000/docs"
echo ""
echo "Presiona Ctrl+C para detener el servicio"
echo ""

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000