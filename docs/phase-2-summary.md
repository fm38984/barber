# Fase 2 — Resumen: Integración WhatsApp Business Cloud API

**Fecha de completado:** 2024-01-01  
**Estado:** Completo — pendiente confirmación para avanzar a Fase 3

---

## Qué se construyó

### WhatsApp Module (`apps/api/src/whatsapp/`)

| Archivo | Responsabilidad |
|---------|----------------|
| `whatsapp.controller.ts` | Endpoints GET (handshake Meta) y POST (webhook receiver) |
| `whatsapp-signature.guard.ts` | Verificación HMAC-SHA256 con `timingSafeEqual` |
| `whatsapp-webhook.service.ts` | Parsea payload, encola jobs por cada mensaje entrante |
| `whatsapp-sender.service.ts` | Envía mensajes (text, interactive buttons, interactive list, template) + persiste en `messages` |

### Queue Module (`apps/api/src/queue/`)

| Archivo | Responsabilidad |
|---------|----------------|
| `queue.module.ts` | BullMQ setup con Redis, 3 reintentos exponenciales, 2 colas (incoming-whatsapp, appointment-reminders) |
| `queue.constants.ts` | Nombres de colas y jobs como constantes tipadas |
| `queue.types.ts` | `IncomingMessageJobData` — payload del job |
| `processors/incoming-message.processor.ts` | Worker que resuelve tenant → upsert customer → upsert conversation → persiste mensaje |

### Customer & Conversation Services

- `CustomerService.upsertByPhone()` — find-or-create, normaliza a E.164 (`+${from}`)
- `ConversationService.upsertForCustomer()` — una conversación por (tenant, customer), estado IDLE inicial
- Ambos usan `prisma.forTenant(tenantId)` → RLS activo

### Flujo completo

```
Meta → POST /api/v1/webhooks/whatsapp
     ↓ WhatsAppSignatureGuard (HMAC-SHA256)
     ↓ WhatsAppController.receive() → responde 200 inmediatamente
     ↓ WhatsAppWebhookService.handleWebhook() → enqueue job (dedup por messageId)
     ↓ IncomingMessageProcessor.process()
         ├── resolveByPhoneNumberId() → tenant
         ├── upsertByPhone() → customer (RLS activo)
         ├── upsertForCustomer() → conversation
         └── message.create() → persiste mensaje IN
```

---

## Qué se probó (`test/whatsapp/whatsapp-webhook.spec.ts`)

### GET Handshake (3 casos)
- Token correcto → retorna `hub.challenge`
- Token incorrecto → 400
- Modo incorrecto → 400

### POST Firma (4 casos)
- Firma válida → 200
- Body adulterado → 401
- Header ausente → 401
- Formato inválido → 401

### Procesamiento (3 casos — controller con queue mockeado)
- Mensaje de texto → job encolado con datos correctos
- Botón interactivo → job encolado con `interactiveReply`
- Status update → NO se encola job

### Processor (3 casos — con DB real)
- Mensaje nuevo → crea customer + conversation + message (scoped al tenant correcto por RLS)
- Mensaje repetido → idempotente (1 customer, segunda message)
- `phone_number_id` desconocido → silencioso, 0 customers creados

---

## Decisiones tomadas

| Decisión | Ver |
|----------|-----|
| BullMQ para procesamiento asíncrono + deduplicación por jobId | [ADR 004](adr/004-bullmq-async-processing.md) |

---

## Notas de seguridad

- La verificación de firma usa `timingSafeEqual` para prevenir timing attacks
- El verify token para el handshake viene de env, no hardcoded
- El access token de WhatsApp viene de env, nunca en código
- El webhook endpoint está excluido del `TenantMiddleware` (no tiene JWT)

---

## Deuda técnica pendiente

1. **Status updates** (`delivered`, `read`): se loguean pero no actualizan `messages.status`. Se implementa en Fase 3.
2. **Tenant suspendido**: el processor descarta el mensaje pero no envía respuesta al cliente ("servicio no disponible"). Se implementa en Fase 7.
3. **Worker separado**: actualmente el processor corre en el mismo proceso que la API. Para escalar, extraer a un worker service separado en Railway.
4. **Rate limit por número**: Meta puede enviar muchos mensajes del mismo usuario rápido. BullMQ con concurrencia 1 por queue serializa el procesamiento, pero falta rate limit explícito por cliente.

---

## Cómo probar manualmente

```bash
# 1. Levantar servicios
docker compose up -d

# 2. API en dev
pnpm dev

# 3. Simular handshake de Meta
curl "http://localhost:3001/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=test123"
# → responde: test123

# 4. Simular mensaje entrante (requiere firma correcta)
BODY='{"object":"whatsapp_business_account","entry":[...]}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "TU_APP_SECRET" | awk '{print "sha256="$2}')
curl -X POST http://localhost:3001/api/v1/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$BODY"
# → 200 OK, job encolado, worker procesa en background
```
