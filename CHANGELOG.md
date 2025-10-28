# Changelog

## 2025-10-28 - Integración Completa para Producción
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
