/**
 * All user-facing Spanish LATAM message templates.
 * Tone: professional but close. Max one emoji per message.
 */

export const MSG = {
  GREETING: (name: string) =>
    `¡Hola${name ? `, ${name}` : ''}! 👋 Bienvenido. ¿En qué te podemos ayudar?`,

  MAIN_MENU_BODY: 'Elige una opción para continuar:',
  MAIN_MENU_BUTTON: 'Ver opciones',
  MAIN_MENU_OPTIONS: [
    { id: 'RESERVAR',    title: 'Reservar cita',       description: 'Agenda una nueva cita' },
    { id: 'MIS_CITAS',  title: 'Mis citas',            description: 'Ver tus próximas citas' },
    { id: 'CANCELAR',   title: 'Cancelar una cita',    description: 'Cancela una cita existente' },
    { id: 'HUMANO',     title: 'Hablar con alguien',   description: 'Un asesor te atenderá' },
  ],

  CHOOSE_SERVICE: 'Elige el servicio que deseas:',
  CHOOSE_SERVICE_BUTTON: 'Ver servicios',

  CHOOSE_BARBER: '¿Con qué barbero prefieres atenderte?',
  CHOOSE_BARBER_BUTTON: 'Ver barberos',
  ANY_BARBER: { id: 'ANY', title: 'Cualquier barbero', description: 'El primero disponible' },

  CHOOSE_DATE: '¿Qué día prefieres para tu cita?',
  CHOOSE_DATE_BUTTON: 'Ver fechas',
  NO_AVAILABILITY_DATE:
    'Lo sentimos, no hay fechas disponibles en los próximos días. Intenta con otro barbero o servicio.',

  CHOOSE_TIME: (date: string) => `Horarios disponibles para el *${date}*:`,
  CHOOSE_TIME_BUTTON: 'Ver horarios',
  NO_AVAILABILITY_TIME:
    'No hay horarios disponibles para ese día. ¿Quieres elegir otra fecha?',
  NO_AVAILABILITY_TIME_BUTTONS: [
    { id: 'CAMBIAR_FECHA', title: 'Elegir otra fecha' },
    { id: 'CANCELAR_FLUJO', title: 'Cancelar' },
  ],

  CONFIRM_SUMMARY: (params: {
    serviceName: string;
    barberName: string;
    dateFormatted: string;
    timeFormatted: string;
    price: string;
  }) =>
    `Revisa los detalles de tu cita:\n\n` +
    `📋 *Servicio:* ${params.serviceName}\n` +
    `💈 *Barbero:* ${params.barberName}\n` +
    `📅 *Fecha:* ${params.dateFormatted}\n` +
    `⏰ *Hora:* ${params.timeFormatted}\n` +
    `💰 *Precio:* ${params.price}\n\n` +
    `¿Confirmamos tu cita?`,
  CONFIRM_BUTTONS: [
    { id: 'CONFIRMAR', title: 'Confirmar' },
    { id: 'CANCELAR_FLUJO', title: 'Cancelar' },
  ],

  CONFIRMED: (barberName: string, dateFormatted: string, timeFormatted: string) =>
    `✅ ¡Listo! Tu cita quedó confirmada con *${barberName}* el *${dateFormatted}* a las *${timeFormatted}*. Te enviaremos un recordatorio. ¡Hasta pronto!`,

  NO_UPCOMING_APPOINTMENTS: 'No tienes citas próximas registradas.',
  MY_APPOINTMENTS_HEADER: 'Tus próximas citas:',
  MY_APPOINTMENTS_FOOTER: 'Para cancelar una, escribe *cancelar* en cualquier momento.',

  CANCEL_SELECT_TITLE: '¿Cuál cita deseas cancelar?',
  CANCEL_SELECT_BUTTON: 'Ver citas',
  CANCEL_CONFIRM: (service: string, date: string, time: string) =>
    `¿Confirmas que deseas cancelar tu cita de *${service}* del *${date}* a las *${time}*?`,
  CANCEL_CONFIRM_BUTTONS: [
    { id: 'CONFIRMAR_CANCELAR', title: 'Sí, cancelar' },
    { id: 'NO_CANCELAR', title: 'No, conservarla' },
  ],
  CANCEL_SUCCESS: '✅ Tu cita fue cancelada. Si necesitas agendar otra, estamos aquí. 👋',
  CANCEL_ABORTED: 'De acuerdo, tu cita sigue en pie. ¿Hay algo más en que te pueda ayudar?',
  NO_APPOINTMENTS_TO_CANCEL: 'No tienes citas activas para cancelar.',

  ESCALATION_CLIENT:
    '🙏 Enseguida un asesor te atenderá. Por favor espera un momento.',
  ESCALATED_ALREADY:
    'Ya hay un asesor atendiéndote. Por favor espera su respuesta.',

  ESCALATION_ADMIN: (customerPhone: string, customerName: string | null) =>
    `🔔 *Solicitud de atención humana*\n\nEl cliente ${customerName ?? customerPhone} (${customerPhone}) pidió hablar con un asesor. Por favor atiéndelo directamente.`,

  FLOW_CANCELLED: 'De acuerdo, no hay problema. Si necesitas algo más, escríbeme. 👋',

  UNKNOWN_INPUT: 'No entendí tu mensaje. Elige una de las opciones disponibles:',

  ERROR_GENERIC:
    'Ocurrió un error al procesar tu solicitud. Por favor intenta de nuevo en un momento.',
} as const;
