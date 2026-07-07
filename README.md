# Sistema de gestión + bot de WhatsApp — Instituto Educare

Sistema en producción para un instituto de clases de apoyo (50–200 alumnos): un **bot de WhatsApp con IA** que agenda, consulta y cancela clases de forma autónoma, y un **panel web de gestión** para el personal administrativo. Ambos operan sobre la misma base de datos (Google Sheets sincronizado con Google Calendar por profesor).

> Proyecto real desarrollado y operado por mí como proveedor tecnológico (Meta Tech Provider oficial). Los tokens y IDs sensibles fueron reemplazados por `*_PLACEHOLDER`.

## Arquitectura

```
WhatsApp (Meta Cloud API)
        │
        ▼
   Chatwoot ──► n8n (queue mode: editor + worker + webhook + Redis)
                 │   27 workflows: agente principal (LangChain) + sub-agentes
                 │   especializados (booking, FAQ, pagos, cancelaciones) +
                 │   tools (check_availability, book_class, send_message...)
                 ▼
   Google Sheets (BD operacional) ◄──► Google Calendar (uno por profesor)
                 ▲
                 │
   Panel web Next.js (gestión.educare.sbs)
```

Todo corre en un VPS con Docker Swarm detrás de Traefik (TLS automático con Let's Encrypt), en una red overlay compartida entre stacks.

## Componentes

### `webapp/` — Panel de gestión (Next.js)

CRUD completo de alumnos, profesores, clases, reservas, clases recurrentes, disponibilidad y bloqueos por profesor. Detalles técnicos destacables:

- **Sincronización bidireccional Sheets ↔ Google Calendar** con retry y verificación.
- **Locks distribuidos en Redis** para evitar race conditions entre el panel y el bot (doble reserva TOCTOU, generación de IDs concurrente, verify-before-write en modificaciones).
- API interna en `pages/api/` consumida también por los workflows de n8n.

### `n8n_workflows/` — Bot conversacional (27 workflows)

- **`main`**: agente conversacional principal (LangChain + RAG sobre Supabase) que enruta a sub-agentes especializados: `booking_agent`, `faq_agent`.
- **Tools de negocio**: `check_availability` (con feriados, bloqueos por profesor y fallback de duración 60→90 min), `book_class`.
- **Mensajería**: `send_message` (con typing indicator nativo de WhatsApp y threading de mensajes), `send_reminders` (recordatorios a alumnos y profesores vía plantillas de Meta), `notify_professor`, `upload_image_to_meta`.
- **Resiliencia**: `chatwoot_polling_recovery` — polling de respaldo cada 5 min que recupera mensajes si el webhook de Chatwoot falla; deduplicación con Redis SET.

## Stack

Next.js · n8n (queue mode) · LangChain · Meta WhatsApp Cloud API · Chatwoot · Google Sheets API · Google Calendar API · Redis · Supabase (pgvector/RAG) · Docker Swarm · Traefik · PostgreSQL
