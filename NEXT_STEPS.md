# Próximos pasos tras la revisión del nodo Start

A continuación se detallan los bloques funcionales que siguen pendientes para cumplir con el alcance completo de la Fase 2:

1. **Tabs Canvas | Métricas | Bitrix24**
   - Implementar polling cada 5 segundos con `fetch` abortable y estados de carga/error visibles.
   - Normalizar los consumos de `/api/metrics`, `/api/logs`, `/api/stats`, `/api/validate` y `/api/bitrix/search`.

2. **Panel lateral vertical de acciones**
   - Reubicar el panel actual (debajo del canvas) hacia un layout fijo vertical a la izquierda.
   - Agrupar categorías tal como especificado: Mensajería, Captura, Lógica, Integraciones, Control.
   - Ajustar estilos para que usen los tokens pastel definidos.

3. **Menú contextual al soltar conexiones**
   - Ampliar las opciones disponibles en el popover para cubrir todos los tipos de nodos requeridos.
   - Centralizar los union types (por ejemplo `ConnectionCreationKind`) para evitar errores TS2322/TS2678.
   - Crear nodo en el cursor y conectar automáticamente mediante `addEdge`.

4. **Tipos de nodos y validaciones**
   - Separar `QuestionNode` de `ValidationNode` con UI y persistencia independiente.
   - Añadir el `ValidationNode` con integración Bitrix (solo lectura) y soporte de keywords (AND/OR, contiene/exacto).
   - Implementar manejadores adicionales: salidas `match`, `no_match`, `error`.

5. **Delay por nodo y persistencia extendida**
   - Validar rango 1–300 s, asegurar badge ⏱️ en el canvas y export/import JSON conservando el valor.
   - Extender `data.ui` para altura persistente de `MessageNode` y `AttachmentNode` con previsualización.

6. **Experiencia de canvas**
   - Garantizar auto-fit inicial + botón "Centrar", paneo con clic derecho (ya iniciado, falta QA) y evitar cascadas al borrar nodos.
   - Implementar Undo/Redo, Copiar/Pegar, buscador (`Ctrl+F`), plantillas y Dark Mode si el tiempo lo permite.

7. **Integraciones complementarias**
   - Cablear `/api/ai/chat` en `MessageNode` (modo ChatGPT) con manejo de timeout/errores.
   - Botón "Enviar prueba WSP" que utilice el número 51918131082 y registre actividad en logs.

8. **Exportaciones y QA final**
   - Añadir exportación PNG con `html-to-image` ocultando overlays temporales.
   - Completar checklist QA indicado en el instructivo para adjuntar en el PR.

Cada bloque requiere revisar y ajustar tipos en `src/flow/types.ts`, utilidades en `src/flow/utils/flow.ts` y componentes bajo `src/flow/components/nodes/`.
