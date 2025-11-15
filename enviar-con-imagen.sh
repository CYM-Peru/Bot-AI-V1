#!/bin/bash
# Script SÚPER FÁCIL para enviar campañas con imagen
# Uso: bash /opt/flow-builder/enviar-con-imagen.sh

echo ""
echo "═══════════════════════════════════════════════════"
echo "   📱 ENVIAR CAMPAÑA CON IMAGEN - VERSIÓN SIMPLE"
echo "═══════════════════════════════════════════════════"
echo ""

# Pedir URL de imagen
read -p "📸 Pega el link de tu imagen (Google Drive, etc.): " IMAGE_URL
echo ""

# Pedir números
read -p "📞 Pega los números (separados por comas): " NUMBERS
echo ""

# Confirmar
echo "═══════════════════════════════════════════════════"
echo "📋 VAS A ENVIAR:"
echo "   Plantilla: lanzamiento_octubre"
echo "   Imagen: ${IMAGE_URL:0:50}..."
echo "   A: $NUMBERS"
echo "═══════════════════════════════════════════════════"
echo ""
read -p "¿Continuar? (si/no): " CONFIRM

if [ "$CONFIRM" != "si" ] && [ "$CONFIRM" != "s" ]; then
    echo "❌ Cancelado"
    exit 0
fi

echo ""
echo "⏳ Procesando..."
echo ""

# Ejecutar script Node
node /opt/flow-builder/scripts/enviar-campana-rapido.js "$IMAGE_URL" "$NUMBERS"
