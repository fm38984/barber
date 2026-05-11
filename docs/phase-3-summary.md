# Fase 3 — Resumen: Bot conversacional (máquina de estados)

**Fecha de completado:** 2024-01-01  
**Estado:** Completo — pendiente confirmación para avanzar a Fase 4

---

## Qué se construyó

### Máquina de estados determinista (`apps/api/src/bot/`)

| Módulo | Descripción |
|--------|-------------|
| `bot.service.ts` | Router central: recibe mensaje → lee estado actual → dispatch al handler → persiste nuevo estado → trigger onEnter si el estado cambió |
| `availability.service.ts` | Calcula slots disponibles: parsing de `working_hours_json`, filtrado de breaks y citas existentes, soporte completo de timezones con `date-fns-tz` |
| `bot.messages.ts` | Todas las cadenas en español LATAM neutro — un solo lugar para editar copy |

### Estados y handlers

| Estado | Handler | Descripción |
|--------|---------|-------------|
| `IDLE` | `idle.handler.ts` | Saludo + menú principal. Clasifica intent por ID de botón o keywords. |
| `CHOOSING_SERVICE` | `choosing-service.handler.ts` | Lista servicios activos del tenant como interactive list |
| `CHOOSING_BARBER` | `choosing-barber.handler.ts` | Lista barberos activos + opción "Cualquier barbero" |
| `CHOOSING_DATE` | `choosing-date.handler.ts` | Consulta `AvailabilityService` → hasta 5 fechas con disponibilidad |
| `CHOOSING_TIME` | `choosing-time.handler.ts` | Consulta slots para fecha + barbero → hasta 10 horarios |
| `CONFIRMING` | `confirming.handler.ts` | Muestra resumen con botones Confirmar/Cancelar. En confirmación: crea `appointment` en DB. |
| `MY_APPOINTMENTS` | `my-appointments.handler.ts` | Muestra próximas citas formateadas en texto |
| `CANCELLING_SELECT` | `cancelling.handler.ts` | Lista citas cancelables (si 1, va directo a confirmación) |
| `CANCELLING_CONFIRM` | `cancelling.handler.ts` | Confirma o aborta la cancelación |

### Flujo principal (happy path)

```
IDLE ──[RESERVAR]──→ CHOOSING_SERVICE
                           │ [serviceId]
                           ↓
                    CHOOSING_BARBER
                           │ [barberId / ANY]
                           ↓
                    CHOOSING_DATE
                           │ [YYYY-MM-DD]
                           ↓
                    CHOOSING_TIME
                           │ [ISO datetime]
                           ↓
                    CONFIRMING
                           │ [CONFIRMAR]
                           ↓
                    IDLE ← cita creada en DB
```

### Escalación a humano

```
IDLE ──[HUMANO]──→ conversation.status = ESCALATED
                     Bot deja de responder hasta que admin libere desde dashboard (Fase 4)
```

### Diseño sin LLMs

El clasificador de intent en `IDLE` usa regex simples:
- `/reserv|cita|agendar|turno|quiero|hora|servi/i` → RESERVAR
- `/mis citas|ver cita|cuándo/i` → MIS_CITAS  
- `/cancel/i` → CANCELAR
- `/humano|persona|asesor|agente/i` → HUMANO

Los botones e interactive lists envían IDs predefinidos → el bot interpreta directamente sin ambigüedad. El fallback de LLM para texto libre queda como hook en `IdleHandler.classifyIntent()` (Fase futura).

### Formato de mensajes WhatsApp

| Situación | Tipo |
|-----------|------|
| Menú principal | Interactive list (4 opciones) |
| Servicios | Interactive list |
| Barberos | Interactive list |
| Fechas | Interactive list |
| Horarios | Interactive list |
| Confirmación de cita | Interactive buttons (Confirmar / Cancelar) |
| Confirmación de cancelación | Interactive buttons (Sí cancelar / No conservar) |
| Mis citas | Text (formateado) |
| Sin disponibilidad | Interactive buttons (Cambiar fecha / Cancelar) |

### Arquitectura de módulos (sin dependencias circulares)

```
WhatsAppModule  ←──────────────────────────┐
  └─ WhatsAppSenderService (export)        │
                                           │
BotModule ────────────────────────────────→┘
  ├─ BotService (token BOT_SERVICE_TOKEN)
  ├─ Handlers (8)
  ├─ AvailabilityService
  └─ IncomingMessageProcessor
       └─ @Inject(BOT_SERVICE_TOKEN) BotService
```

Se usa un token de interfaz (`BOT_SERVICE_TOKEN`) para inyectar `BotService` en el processor sin crear un ciclo real.

---

## Dependencias añadidas

| Paquete | Justificación |
|---------|---------------|
| `date-fns` | Aritmética de fechas limpia (addMinutes, addDays, isBefore, isAfter) |
| `date-fns-tz` | Conversión UTC ↔ timezone DST-correcta. `Intl` solo para formateo; no soporta aritmética bi-direccional confiable con DST |

---

## Qué se probó (`test/bot/bot-conversation.spec.ts`)

| Test | Verifica |
|------|----------|
| Saludo → menú principal | Bot responde con interactive list de 4 opciones |
| Botón RESERVAR → CHOOSING_SERVICE | Transición de estado + lista de servicios enviada |
| **Happy path completo** | Flujo de 5 pasos → cita creada en DB con status CONFIRMED, scoped al tenant correcto |
| Escalación → conversación ESCALATED | Mensaje al cliente + bot silencioso en mensajes posteriores |
| Input desconocido en IDLE | Reenvía menú principal |
| MIS_CITAS sin citas | Mensaje de "no tienes citas" |

---

## Deuda técnica pendiente

1. **Notificación al admin en escalación**: `IdleHandler.escalate()` tiene un hook comentado. En Fase 4 se conecta con el número WhatsApp del admin del tenant.
2. **Fallback LLM**: `IdleHandler.classifyIntent()` tiene el hook preparado. No implementado en MVP.
3. **"Cualquier barbero" en CONFIRMING**: cuando el usuario elige "ANY", el barber se resuelve al momento de elegir el slot. Si entre la selección del slot y la confirmación alguien más reserva, puede haber una race condition. Mitigación Fase 8: transacción con bloqueo optimista.
4. **Notificación al barbero de cita nueva**: hook en `ConfirmingHandler` comentado. Fase 5.
5. **Status update de mensajes**: cuando Meta confirma entrega/lectura del reply, actualizar `messages.status`. Fase 8.

---

## Cómo correr los tests

```bash
docker compose up -d postgres_test
pnpm db:migrate:deploy  # asegurar migraciones aplicadas
pnpm --filter @barberflow/api test:integration
```
