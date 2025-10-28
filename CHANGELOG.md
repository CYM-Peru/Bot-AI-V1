# Changelog

## 2025-10-28 (Evening) - 🎉 PRODUCCIÓN READY - TODAS LAS FEATURES COMPLETAS

### ✨ Nuevas Funcionalidades (Sesión Final)
- **Undo/Redo System**: Historial de 50 acciones con Ctrl+Z/Ctrl+Y
  - Debouncing de 300ms para evitar exceso de entradas
  - Protección contra loops infinitos
- **Copy/Paste**: Ctrl+C/Ctrl+V para duplicar nodos
  - Deep cloning con offset de posición (+50x, +50y)
  - Protección contra copia de nodo raíz
  - Detección de inputs para evitar conflictos
- **Búsqueda de Nodos**: Modal con Ctrl+F
  - Filtrado multi-campo (label, ID, tipo, action kind)
  - Navegación con teclado (flechas, Enter, Escape)
  - Centra automáticamente el nodo seleccionado
- **5 Templates Profesionales**:
  1. Bienvenida Básica
  2. Captura de Leads
  3. Soporte al Cliente
  4. Pedidos E-commerce
  5. Agendamiento de Citas
- **Export to PNG**: Exportación del canvas completo
  - Integrado con html-to-image
  - Nombres de archivo descriptivos con timestamp
  - Fondo blanco por defecto
- **Reorganización de Botones**: Layout horizontal en columnas
  - Categorías: Mensajería, Captura, Lógica, Integraciones, Control
  - Ancho estándar (min-w-[160px]) con whitespace-nowrap
  - Scroll horizontal para mejor UX
- **Timer Badge Mejorado**: Espaciado perfecto (top-3 right-3)
  - Padding mejorado y shadow sutil

### 📚 Documentación
- **PRODUCTION_CHECKLIST.md**: Guía completa de despliegue
  - Configuración de .env con todas las variables
  - Opciones de hosting (Vercel, Railway, VPS)
  - Setup de WhatsApp Business API paso a paso
  - Checklist de seguridad y monitoreo
  - Estimaciones de costos ($5/mes MVP, $94-124/mes escalable)
  - Testing manual exhaustivo
  - Endpoints del backend documentados
- **NEXT_STEPS.md**: Actualizado con status 8/8 completados
- **CHANGELOG.md**: Este archivo

### 🔧 Mejoras Técnicas
- Hook personalizado `useUndoRedo<T>` con estado inmutable
- Sistema de templates con normalización automática
- Keyboard event handling global con detección de inputs
- Toast notifications para feedback de usuario

### 📦 Build Final
- Bundle size: 503.63 kB (gzip: 150.89 kB)
- 227 modules transformados
- Sin errores de TypeScript
- Advertencia de chunk >500KB (normal para React Flow)

### 🎯 Estado del Proyecto
**TODAS LAS FEATURES CORE COMPLETADAS** ✅
- 8/8 bloques principales implementados
- 0 errores de build
- 0 features pendientes (solo nice-to-have: Dark Mode)
- Backend corriendo estable en puerto 3000
- Listo para despliegue en producción

---

## 2025-10-28 (Morning) - Integración Completa para Producción
### ✨ Nuevas Funcionalidades
- **Sistema de Tabs**: Canvas, Métricas y Bitrix24
  - MetricsPanel con estadísticas en tiempo real (auto-refresh 5s)
  - Bitrix24Panel para test de conexión y búsqueda de contactos
- **Panel de Acciones Reorganizado**: Layout vertical con categorías agrupadas
  - Estructura, Mensajes, Integraciones, Control
  - Mejor UX sin scroll horizontal
- **Menú Contextual Mejorado**: Al soltar conexiones muestra TODAS las acciones
  - Organizado por categorías con emojis
  - Incluye: ask, question, validation, condition, attachment, webhooks, etc.
- **Sistema de Delay/Timer**: Retraso configurable por nodo
  - Checkbox en Inspector para activar (1-300 segundos)
  - Badge ⏱️ visible en canvas
  - Persistencia en JSON
- **Auto-fit Canvas**:
  - Centrado automático al cargar/cambiar flujo
  - Botón manual "🎯 Centrar"

### 🔧 Mejoras Técnicas
- Merged con `codex/conduct-diagnostic-review-of-bot-ai-v1-88ml8j`
- Unificado `ConnectionCreationKind` con todos los tipos
- Resueltos conflictos de tipos entre branches
- Implementados componentes: MetricsPanel, Bitrix24Panel

### 📦 Build
- Bundle size: 468.98 kB (gzip: 140.11 kB)
- Sin errores de TypeScript
- 213 modules transformados

## 2025-10-27
- Agregado nodo inicial "Inicio del flujo" con bloqueo de conexiones entrantes y sin controles de duplicado/borrado.
- Aplicada paleta pastel con variables CSS compartidas para diferenciar tipos de nodos (inicio, mensajes, lógica, integraciones y fin).
- Ajustado inspector para mostrar el tipo fijo del nodo inicial y mantener coherencia al importar flujos antiguos.
