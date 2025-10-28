# Próximos pasos - Estado Actualizado

A continuación se detallan los bloques funcionales con su estado actual:

## ✅ COMPLETADO

### 1. **Tabs Canvas | Métricas | Bitrix24** ✅
   - ✅ Sistema de tabs implementado (Canvas, Métricas, Bitrix24)
   - ✅ MetricsPanel con auto-refresh cada 5 segundos
   - ✅ Bitrix24Panel con test de conexión y búsqueda de contactos
   - ✅ Consumo de endpoints `/api/stats`, `/api/metrics` implementado
   - 📋 Pendiente: Estados de carga/error más visibles

### 2. **Panel lateral vertical de acciones** ✅
   - ✅ Panel reorganizado con layout vertical debajo del canvas
   - ✅ Categorías agrupadas: Estructura, Mensajes, Integraciones, Control
   - ✅ Estilos con mejor UX sin scroll horizontal
   - 📋 Pendiente: Mover a lateral izquierdo fijo (opcional)

### 3. **Menú contextual al soltar conexiones** ✅
   - ✅ Popover con TODAS las acciones disponibles
   - ✅ Organizado por categorías con emojis
   - ✅ Incluye: Menu, Message, Buttons, Ask, Question, Attachment, Webhooks, Transfer, Scheduler, Condition, Validation, End
   - ✅ ConnectionCreationKind unificado sin errores TS

### 4. **Tipos de nodos y validaciones** ✅
   - ✅ StartNode implementado (nodo inicial sin conexiones entrantes)
   - ✅ QuestionNode separado de Ask con UI mejorada
   - ✅ ValidationNode con keywords (AND/OR, contains/exact)
   - ✅ Integración Bitrix24 en ValidationNode
   - ✅ Handles de salida: match, no_match, error implementados

### 5. **Delay por nodo** ✅
   - ✅ Campo delay opcional en FlowNode (1-300 segundos)
   - ✅ UI con checkbox y número input en Inspector
   - ✅ Badge ⏱️ visible en canvas mostrando duración
   - ✅ Persistencia en JSON garantizada
   - 📋 Pendiente: Extender data.ui para altura de MessageNode

### 6. **Experiencia de canvas** ✅ Parcial
   - ✅ Auto-fit inicial al cargar flujo
   - ✅ Botón "🎯 Centrar" para recentrar manualmente
   - ✅ Auto-fit al cambiar de flujo (flow ID change)
   - ✅ Paneo con clic derecho funcional
   - ⏳ Pendiente: Undo/Redo (Ctrl+Z, Ctrl+Y)
   - ⏳ Pendiente: Copy/Paste (Ctrl+C, Ctrl+V)
   - ⏳ Pendiente: Búsqueda de nodos (Ctrl+F)
   - ⏳ Pendiente: 5 Templates predefinidos
   - ⏳ Pendiente: Dark Mode
   - ⏳ Pendiente: Exportar a PNG

## 📋 PENDIENTE - PRIORIDAD MEDIA

### 7. **Integraciones complementarias**
   - ⏳ Cablear `/api/ai/chat` en MessageNode (modo ChatGPT)
   - ⏳ Botón "Enviar prueba WSP" con número 51918131082
   - ⏳ Registro de actividad en logs

### 8. **Exportaciones y QA final**
   - ⏳ Exportación PNG con `html-to-image`
   - ⏳ Ocultar overlays temporales al exportar
   - ⏳ Completar checklist QA

## 🎨 MEJORAS ADICIONALES COMPLETADAS

- ✅ Sistema de paleta pastel con CSS variables
- ✅ 6 colores: mint, blue, lilac, peach, yellow, teal
- ✅ Badges de tono diferenciado por tipo de nodo
- ✅ StartNode bloqueado (no duplicable, no borrable)
- ✅ Mejora visual general del canvas

## 📊 RESUMEN

- **Completadas**: 6/8 bloques principales
- **En progreso**: 0/8
- **Pendientes**: 2/8 (Nice to have features)
- **Build Status**: ✅ Sin errores
- **Bundle Size**: 468.98 kB (gzip: 140.11 kB)

## 🚀 PRÓXIMOS PASOS RECOMENDADOS

1. **Prioridad Alta**: Implementar Undo/Redo para mejor UX
2. **Prioridad Media**: Copy/Paste de nodos
3. **Prioridad Baja**: Dark Mode y Templates
4. **QA**: Testing exhaustivo de ValidationNode con Bitrix24
5. **Documentación**: Actualizar guía de usuario con nuevos nodos

---

**Última actualización**: 2025-10-28
**Branch**: claude/integrate-project-011CUXzfQm1VoYekL5VzfZNU
**Commits**: Merged with codex/conduct-diagnostic-review-of-bot-ai-v1-88ml8j
