# Ejemplo: Prompt Optimizado con TOON para Debugging

## Prompt Original (JSON) - ~450 tokens

```
Analiza el siguiente problema en mi sistema CRM:

{
  "problema": "Chats asignados a asesores offline",
  "contexto": {
    "sistema": "FlowBuilder CRM",
    "fecha": "2025-11-21",
    "hora": "02:00:00"
  },
  "servicios": [
    {
      "nombre": "QueueDistributor",
      "tipo": "polling",
      "intervalo": "10s",
      "estado": "activo"
    },
    {
      "nombre": "QueueAssignmentService",
      "tipo": "event-driven",
      "estado": "activo"
    }
  ],
  "chatsProblematicos": [
    {
      "id": "conv-1",
      "phone": "51930634626",
      "assignedTo": "Carlos",
      "queue": "ATC",
      "timestamp": "2025-11-21T01:30:00Z"
    },
    {
      "id": "conv-2",
      "phone": "51952253120",
      "assignedTo": "Carlos",
      "queue": "ATC",
      "timestamp": "2025-11-21T01:32:00Z"
    }
  ],
  "asesores": [
    {
      "id": "user-1762179224034",
      "nombre": "Carlos",
      "estado": "offline",
      "ultimaConexion": "2025-11-20T23:00:00Z",
      "chatsActivos": 2
    }
  ]
}
```

## Prompt Optimizado (TOON) - ~220 tokens (~51% reducción)

```
Analiza el siguiente problema en mi sistema CRM:

problema: Chats asignados a asesores offline

contexto:
  sistema: FlowBuilder CRM
  fecha: 2025-11-21
  hora: 02:00:00

servicios[2]{nombre,tipo,intervalo,estado}:
  QueueDistributor,polling,10s,activo
  QueueAssignmentService,event-driven,N/A,activo

chatsProblematicos[2]{id,phone,assignedTo,queue,timestamp}:
  conv-1,51930634626,Carlos,ATC,2025-11-21T01:30:00Z
  conv-2,51952253120,Carlos,ATC,2025-11-21T01:32:00Z

asesores[1]{id,nombre,estado,ultimaConexion,chatsActivos}:
  user-1762179224034,Carlos,offline,2025-11-20T23:00:00Z,2
```

---

## Prompt Completo para Análisis de Sistema

```
tarea: Diagnosticar por qué el sistema asigna chats a asesores offline

arquitectura:
  componente1: QueueDistributor (viejo)
    estrategia: Polling cada 10 segundos
    verificacion: advisorPresence.isOnline()
    problema: Race conditions posibles

  componente2: QueueAssignmentService (nuevo)
    estrategia: Event-driven (reactivo)
    eventos:
      - onChatQueued: Cuando bot transfiere a cola
      - onAdvisorOnline: Cuando asesor se loguea
    verificacion: advisorPresence.isOnline() en línea 152

estadoActual:
  fecha: 2025-11-21T02:00:00Z
  ambosServiciosActivos: true
  razon: Despliegue seguro en paralelo

colas[3]{id,nombre,asesoresAsignados,chatsEnEspera}:
  queue-1761859343408,ATC,2,4
  queue-1761859362582,Counter,2,3
  queue-1762287006531,Prospectos,1,14

asesoresEnColas[5]{id,nombre,cola,estadoOnline,chatsActivos}:
  user-1761954566426,Rosario,ATC,offline,1
  user-1761954617719,Angela,ATC,offline,1
  user-1761954747002,Ana,Counter,offline,0
  user-1761954642084,Martha,Counter,offline,0
  user-1762179224034,Carlos,Prospectos,offline,2

incidente[8]{phone,assignedTo,cola,horaAsignacion,problemaDetectado}:
  51930634626,Carlos,ATC,01:30,Asesor offline al momento de asignación
  51952253120,Carlos,ATC,01:32,Asesor offline al momento de asignación
  51949842450,Carlos,ATC,01:35,Asesor offline al momento de asignación
  51970876873,Carlos,Counter,01:38,Asesor offline al momento de asignación
  51912464802,Carlos,Prospectos,01:40,Asesor offline al momento de asignación
  51945105062,Carlos,ATC,01:42,Asesor offline al momento de asignación
  51972818415,Carlos,Counter,01:45,Asesor offline al momento de asignación
  51991013042,Carlos,Prospectos,01:48,Asesor offline al momento de asignación

hallazgos:
  patron: Todos asignados a Carlos
  estadoCarlos: offline desde 2025-11-20T23:00:00Z
  servicioResponsable: Desconocido (QueueDistributor o QueueAssignmentService)
  accionTomada: Implementado QueueAssignmentService event-driven
  estadoActual: Ambos servicios en paralelo

pregunta:
  principal: ¿Cómo identificar en logs cuál servicio falló?
  secundaria: ¿Qué patrones de log distinguen cada servicio?
```

**Tokens estimados:** ~320 tokens (vs ~650 en JSON)
**Ahorro:** ~50%

---

## Respuesta de Sistema de Monitoreo en TOON

```
monitoreoResultados:
  periodo: 60 minutos
  timestampAnalisis: 2025-11-21T02:06:00Z

actividadServicios[2]{servicio,asignacionesRealizadas,warnings,errores}:
  QueueDistributor,0,871,0
  QueueAssignmentService,1,0,0

diagnostico:
  servicioNuevoFuncionando: true
  servicioNuevoAsignaciones: 1
  servicioNuevoErrores: 0
  razonSinAsignaciones: No hay asesores online actualmente

patronesLog:
  queueDistributor:
    frecuencia: Cada 10 segundos
    formatoWarning: "[QueueDistributor] ⚠️  Cola \"XXX\": N chats esperando..."
    formatoAsignacion: "[QueueDistributor] ✅ Chat XXXX asignado a [Nombre]"

  queueAssignmentService:
    frecuencia: Solo en eventos
    formatoEvento1: "[QueueAssignment] 📥 Chat XXX entró a cola YYY"
    formatoEvento2: "[QueueAssignment] 👤 Asesor XXX está ONLINE"
    formatoAsignacion: "[QueueAssignment] ✅ Chat XXXX → [Nombre] (chat_queued|advisor_online)"
    formatoError: "[QueueAssignment] ❌ Error en onChatQueued:"

señalesFallo[5]{señal,descripcion,comando}:
  1,Errores en logs,sudo journalctl -u flowbuilder -n 500 | grep "QueueAssignment.*❌"
  2,Bot transfiere sin evento,Buscar BotTimeoutScheduler sin QueueAssignment posterior
  3,Asesor online sin asignación,Buscar AdvisorPresence sin QueueAssignment posterior
  4,Chats sin asignar con asesores,Comparar query DB con check-online-advisors.ts
  5,QueueDistributor asigna primero,Ver timestamps de asignaciones

conclusion:
  estadoImplementacion: Exitosa
  bugsEncontrados: 0
  serviciosParalelos: true
  proximoPaso: Monitorear 24-48 horas antes de deshabilitar viejo
