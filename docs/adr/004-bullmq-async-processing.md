# ADR 004 — Procesamiento asíncrono de webhooks: BullMQ

**Fecha:** 2024-01-01  
**Estado:** Aceptado

## Contexto

Meta requiere que el endpoint de webhook responda HTTP 200 en menos de 20 segundos, idealmente en milisegundos. El procesamiento real (resolver tenant, upsert customer/conversation, lógica de bot) puede tardar más.

## Decisión

Usar **BullMQ** (Redis-backed) para desacoplar la recepción del webhook del procesamiento.

El webhook controller responde 200 inmediatamente y encola un job. El worker (`IncomingMessageProcessor`) procesa de forma asíncrona con reintentos exponenciales.

## Garantías de entrega

- `jobId: 'wa-msg-${messageId}'` → deduplicación automática. Si Meta reenvía el mismo mensaje (retry), BullMQ lo descarta si ya fue procesado.
- 3 reintentos con backoff exponencial (2s, 4s, 8s) para fallos transitorios.
- `removeOnComplete: { count: 1000 }` → mantiene historial de 1000 jobs completados para debugging.

## Alternativas descartadas

- **Procesamiento síncrono en el webhook**: simple pero bloqueante, riesgoso si la DB está lenta.
- **SQS/PubSub**: excesiva complejidad para MVP. BullMQ sobre Redis (que ya usamos) es suficiente.

## Consecuencias

- Redis es ahora un componente crítico de disponibilidad. Si Redis cae, los mensajes entrantes no se encolan. Mitigación: Railway Managed Redis tiene alta disponibilidad.
- Los workers necesitan estar corriendo. En Railway, el api service incluye el worker (mismo proceso). Para escalar se puede separar en un worker process dedicado.
