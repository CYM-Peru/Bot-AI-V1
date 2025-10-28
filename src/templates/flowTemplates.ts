import type { Flow } from '../flow/types';
import { normalizeFlow } from '../flow/utils/flow';

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  flow: Flow;
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'welcome-basic',
    name: 'Bienvenida Básica',
    description: 'Flujo simple de bienvenida con menú de opciones',
    category: 'Básico',
    flow: normalizeFlow({
      version: 1,
      id: 'template-welcome-basic',
      name: 'Bienvenida Básica',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          label: 'Inicio',
          type: 'start',
          children: ['1'],
        },
        '1': {
          id: '1',
          label: 'Mensaje de Bienvenida',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: '¡Hola! Bienvenido a nuestro servicio. ¿En qué podemos ayudarte hoy?',
            },
          },
          children: ['2'],
        },
        '2': {
          id: '2',
          label: 'Menú Principal',
          type: 'menu',
          menuOptions: [
            { id: 'opt1', label: 'Ver productos', targetId: '3' },
            { id: 'opt2', label: 'Atención al cliente', targetId: '4' },
            { id: 'opt3', label: 'Información de contacto', targetId: '5' },
          ],
          children: ['3', '4', '5'],
        },
        '3': {
          id: '3',
          label: 'Info Productos',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Visita nuestro catálogo en: www.ejemplo.com/productos',
            },
          },
          children: ['6'],
        },
        '4': {
          id: '4',
          label: 'Atención Cliente',
          type: 'action',
          action: {
            kind: 'transfer',
            data: {
              note: 'Transferir a agente humano',
            },
          },
          children: [],
        },
        '5': {
          id: '5',
          label: 'Contacto',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Puedes contactarnos en:\n📧 info@ejemplo.com\n📞 +51 999 999 999',
            },
          },
          children: ['6'],
        },
        '6': {
          id: '6',
          label: 'Finalizar',
          type: 'action',
          action: {
            kind: 'end',
            data: {
              note: 'Gracias por contactarnos',
            },
          },
          children: [],
        },
      },
    }),
  },
  {
    id: 'lead-capture',
    name: 'Captura de Leads',
    description: 'Captura información del cliente (nombre, email, teléfono)',
    category: 'Ventas',
    flow: normalizeFlow({
      version: 1,
      id: 'template-lead-capture',
      name: 'Captura de Leads',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          label: 'Inicio',
          type: 'start',
          children: ['1'],
        },
        '1': {
          id: '1',
          label: 'Saludo',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: '¡Hola! Gracias por tu interés. Para brindarte mejor información, necesito algunos datos.',
            },
          },
          children: ['2'],
        },
        '2': {
          id: '2',
          label: 'Capturar Nombre',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Cuál es tu nombre completo?',
              varName: 'nombre',
              varType: 'text',
              validation: { type: 'none' },
              answerTargetId: '3',
              invalidTargetId: null,
            },
          },
          children: ['3'],
        },
        '3': {
          id: '3',
          label: 'Capturar Email',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Cuál es tu correo electrónico?',
              varName: 'email',
              varType: 'text',
              validation: {
                type: 'regex',
                pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
              },
              retryMessage: 'Por favor, ingresa un email válido',
              answerTargetId: '4',
              invalidTargetId: '3',
            },
          },
          children: ['4'],
        },
        '4': {
          id: '4',
          label: 'Capturar Teléfono',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Cuál es tu número de teléfono?',
              varName: 'telefono',
              varType: 'text',
              validation: {
                type: 'regex',
                pattern: '^\\+?[0-9]{9,15}$',
              },
              retryMessage: 'Por favor, ingresa un teléfono válido',
              answerTargetId: '5',
              invalidTargetId: '4',
            },
          },
          children: ['5'],
        },
        '5': {
          id: '5',
          label: 'Confirmar Datos',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Perfecto {{nombre}}! Hemos registrado tus datos:\n📧 {{email}}\n📞 {{telefono}}\n\nUn asesor se comunicará contigo pronto.',
            },
          },
          children: ['6'],
        },
        '6': {
          id: '6',
          label: 'Enviar a CRM',
          type: 'action',
          action: {
            kind: 'webhook_out',
            data: {
              url: 'https://tu-api.com/leads',
              method: 'POST',
              body: '{"nombre": "{{nombre}}", "email": "{{email}}", "telefono": "{{telefono}}"}',
            },
          },
          children: ['7'],
        },
        '7': {
          id: '7',
          label: 'Finalizar',
          type: 'action',
          action: {
            kind: 'end',
            data: {
              note: 'Lead capturado exitosamente',
            },
          },
          children: [],
        },
      },
    }),
  },
  {
    id: 'customer-support',
    name: 'Soporte al Cliente',
    description: 'Flujo de soporte con validación y horarios',
    category: 'Soporte',
    flow: normalizeFlow({
      version: 1,
      id: 'template-customer-support',
      name: 'Soporte al Cliente',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          label: 'Inicio',
          type: 'start',
          children: ['1'],
        },
        '1': {
          id: '1',
          label: 'Verificar Horario',
          type: 'action',
          action: {
            kind: 'scheduler',
            data: {
              mode: 'custom',
              custom: {
                timezone: 'America/Lima',
                windows: [
                  {
                    weekdays: [1, 2, 3, 4, 5],
                    start: '09:00',
                    end: '18:00',
                  },
                ],
              },
              inWindowTargetId: '2',
              outOfWindowTargetId: '8',
            },
          },
          children: ['2', '8'],
        },
        '2': {
          id: '2',
          label: 'Bienvenida',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Bienvenido a soporte técnico. ¿En qué podemos ayudarte?',
            },
          },
          children: ['3'],
        },
        '3': {
          id: '3',
          label: 'Tipo de Consulta',
          type: 'menu',
          menuOptions: [
            { id: 'opt1', label: 'Problema técnico', targetId: '4' },
            { id: 'opt2', label: 'Consulta de cuenta', targetId: '5' },
            { id: 'opt3', label: 'Facturación', targetId: '6' },
            { id: 'opt4', label: 'Otro', targetId: '7' },
          ],
          children: ['4', '5', '6', '7'],
        },
        '4': {
          id: '4',
          label: 'Problema Técnico',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Te conectaré con un técnico especializado.',
            },
          },
          children: ['9'],
        },
        '5': {
          id: '5',
          label: 'Consulta Cuenta',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Verifica tu cuenta en: www.ejemplo.com/cuenta',
            },
          },
          children: ['10'],
        },
        '6': {
          id: '6',
          label: 'Facturación',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Envianos tu consulta a facturacion@ejemplo.com',
            },
          },
          children: ['10'],
        },
        '7': {
          id: '7',
          label: 'Otro',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Te transferiré con un agente.',
            },
          },
          children: ['9'],
        },
        '8': {
          id: '8',
          label: 'Fuera de Horario',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Gracias por contactarnos. Nuestro horario de atención es de lunes a viernes de 9:00 AM a 6:00 PM. Te responderemos en cuanto estemos disponibles.',
            },
          },
          children: ['10'],
        },
        '9': {
          id: '9',
          label: 'Transferir Agente',
          type: 'action',
          action: {
            kind: 'transfer',
            data: {
              note: 'Transferir a agente humano',
            },
          },
          children: [],
        },
        '10': {
          id: '10',
          label: 'Finalizar',
          type: 'action',
          action: {
            kind: 'end',
            data: {
              note: 'Conversación finalizada',
            },
          },
          children: [],
        },
      },
    }),
  },
  {
    id: 'ecommerce-order',
    name: 'Pedido E-commerce',
    description: 'Flujo completo de pedido con selección de productos',
    category: 'E-commerce',
    flow: normalizeFlow({
      version: 1,
      id: 'template-ecommerce-order',
      name: 'Pedido E-commerce',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          label: 'Inicio',
          type: 'start',
          children: ['1'],
        },
        '1': {
          id: '1',
          label: 'Catálogo',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: '¡Bienvenido a nuestra tienda! 🛍️\n\n¿Qué te gustaría comprar hoy?',
            },
          },
          children: ['2'],
        },
        '2': {
          id: '2',
          label: 'Categorías',
          type: 'menu',
          menuOptions: [
            { id: 'cat1', label: 'Ropa', targetId: '3' },
            { id: 'cat2', label: 'Electrónica', targetId: '4' },
            { id: 'cat3', label: 'Hogar', targetId: '5' },
          ],
          children: ['3', '4', '5'],
        },
        '3': {
          id: '3',
          label: 'Productos Ropa',
          type: 'action',
          action: {
            kind: 'buttons',
            data: {
              items: [
                { id: 'btn1', label: 'Camisetas - $20', value: 'camisa' },
                { id: 'btn2', label: 'Pantalones - $35', value: 'pantalon' },
                { id: 'btn3', label: 'Zapatos - $50', value: 'zapatos' },
              ],
              maxButtons: 3,
              moreTargetId: null,
            },
          },
          children: ['6'],
        },
        '4': {
          id: '4',
          label: 'Productos Electrónica',
          type: 'action',
          action: {
            kind: 'buttons',
            data: {
              items: [
                { id: 'btn1', label: 'Auriculares - $45', value: 'auriculares' },
                { id: 'btn2', label: 'Mouse - $25', value: 'mouse' },
                { id: 'btn3', label: 'Teclado - $60', value: 'teclado' },
              ],
              maxButtons: 3,
              moreTargetId: null,
            },
          },
          children: ['6'],
        },
        '5': {
          id: '5',
          label: 'Productos Hogar',
          type: 'action',
          action: {
            kind: 'buttons',
            data: {
              items: [
                { id: 'btn1', label: 'Lámpara - $30', value: 'lampara' },
                { id: 'btn2', label: 'Cojines - $15', value: 'cojines' },
                { id: 'btn3', label: 'Espejo - $40', value: 'espejo' },
              ],
              maxButtons: 3,
              moreTargetId: null,
            },
          },
          children: ['6'],
        },
        '6': {
          id: '6',
          label: 'Cantidad',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Cuántas unidades deseas?',
              varName: 'cantidad',
              varType: 'number',
              validation: { type: 'none' },
              answerTargetId: '7',
              invalidTargetId: null,
            },
          },
          children: ['7'],
        },
        '7': {
          id: '7',
          label: 'Datos de Envío',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Necesitamos tus datos de envío.',
            },
          },
          children: ['8'],
        },
        '8': {
          id: '8',
          label: 'Dirección',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Cuál es tu dirección de envío?',
              varName: 'direccion',
              varType: 'text',
              validation: { type: 'none' },
              answerTargetId: '9',
              invalidTargetId: null,
            },
          },
          children: ['9'],
        },
        '9': {
          id: '9',
          label: 'Confirmación',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Perfecto! Tu pedido de {{cantidad}} unidad(es) será enviado a: {{direccion}}\n\nTotal: $XX.XX\n\n¿Confirmas el pedido?',
            },
          },
          children: ['10'],
        },
        '10': {
          id: '10',
          label: 'Confirmar',
          type: 'action',
          action: {
            kind: 'buttons',
            data: {
              items: [
                { id: 'yes', label: 'Sí, confirmar', value: 'confirmar', targetId: '11' },
                { id: 'no', label: 'No, cancelar', value: 'cancelar', targetId: '12' },
              ],
              maxButtons: 2,
              moreTargetId: null,
            },
          },
          children: ['11', '12'],
        },
        '11': {
          id: '11',
          label: 'Pedido Confirmado',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: '✅ ¡Pedido confirmado! Recibirás un email con los detalles. Gracias por tu compra.',
            },
          },
          children: ['13'],
        },
        '12': {
          id: '12',
          label: 'Pedido Cancelado',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: 'Pedido cancelado. Si cambias de opinión, estamos aquí para ayudarte.',
            },
          },
          children: ['13'],
        },
        '13': {
          id: '13',
          label: 'Finalizar',
          type: 'action',
          action: {
            kind: 'end',
            data: {
              note: 'Proceso de pedido finalizado',
            },
          },
          children: [],
        },
      },
    }),
  },
  {
    id: 'appointment-booking',
    name: 'Reserva de Citas',
    description: 'Sistema de agendamiento con fecha y hora',
    category: 'Servicios',
    flow: normalizeFlow({
      version: 1,
      id: 'template-appointment-booking',
      name: 'Reserva de Citas',
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          label: 'Inicio',
          type: 'start',
          children: ['1'],
        },
        '1': {
          id: '1',
          label: 'Bienvenida',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: '¡Hola! Bienvenido al sistema de reservas. 📅',
            },
          },
          children: ['2'],
        },
        '2': {
          id: '2',
          label: 'Tipo de Servicio',
          type: 'menu',
          menuOptions: [
            { id: 'serv1', label: 'Consulta Médica', targetId: '3' },
            { id: 'serv2', label: 'Peluquería', targetId: '3' },
            { id: 'serv3', label: 'Asesoría Legal', targetId: '3' },
          ],
          children: ['3'],
        },
        '3': {
          id: '3',
          label: 'Nombre Cliente',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Cuál es tu nombre completo?',
              varName: 'nombre',
              varType: 'text',
              validation: { type: 'none' },
              answerTargetId: '4',
              invalidTargetId: null,
            },
          },
          children: ['4'],
        },
        '4': {
          id: '4',
          label: 'Fecha Deseada',
          type: 'action',
          action: {
            kind: 'question',
            data: {
              questionText: '¿Qué fecha prefieres? (formato: DD/MM/AAAA)',
              varName: 'fecha',
              varType: 'text',
              validation: {
                type: 'regex',
                pattern: '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/20[0-9]{2}$',
              },
              retryMessage: 'Por favor, usa el formato DD/MM/AAAA (ej: 15/12/2025)',
              answerTargetId: '5',
              invalidTargetId: '4',
            },
          },
          children: ['5'],
        },
        '5': {
          id: '5',
          label: 'Hora Disponible',
          type: 'action',
          action: {
            kind: 'buttons',
            data: {
              items: [
                { id: 'h1', label: '09:00 AM', value: '09:00', targetId: '6' },
                { id: 'h2', label: '11:00 AM', value: '11:00', targetId: '6' },
                { id: 'h3', label: '02:00 PM', value: '14:00', targetId: '6' },
              ],
              maxButtons: 3,
              moreTargetId: null,
            },
          },
          children: ['6'],
        },
        '6': {
          id: '6',
          label: 'Confirmar Cita',
          type: 'action',
          action: {
            kind: 'message',
            data: {
              text: '✅ Cita confirmada para:\n\n👤 {{nombre}}\n📅 {{fecha}}\n🕐 {{hora}}\n\nTe enviaremos un recordatorio 24 horas antes.',
            },
          },
          children: ['7'],
        },
        '7': {
          id: '7',
          label: 'Guardar en Sistema',
          type: 'action',
          action: {
            kind: 'webhook_out',
            data: {
              url: 'https://tu-api.com/appointments',
              method: 'POST',
              body: '{"nombre": "{{nombre}}", "fecha": "{{fecha}}", "hora": "{{hora}}"}',
            },
          },
          children: ['8'],
        },
        '8': {
          id: '8',
          label: 'Finalizar',
          type: 'action',
          action: {
            kind: 'end',
            data: {
              note: 'Cita agendada exitosamente',
            },
          },
          children: [],
        },
      },
    }),
  },
];
