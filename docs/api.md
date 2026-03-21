# OpenMAPS/CL — Especificación de la API REST

**Versión:** 0.1 &nbsp;|&nbsp; **Formato:** JSON &nbsp;|&nbsp; **Autenticación:** Bearer token

---

## Descripción general

OpenMAPS/CL define tres operaciones de API. Todo sistema consumidor que implemente OpenMAPS/CL debe exponer estos endpoints. Todo vendor que implemente OpenMAPS/CL debe ser capaz de invocarlos (para publicar disponibilidad) y recibirlos (para confirmar reservas).

La API es intencionalmente minimalista. Características avanzadas como filtrado, paginación o análisis de datos son responsabilidad del sistema implementador.

---

## Autenticación

Todas las llamadas requieren un Bearer token emitido por el sistema consumidor durante el proceso de registro del vendor.

```http
Authorization: Bearer {token_del_vendor}
Content-Type: application/json
Accept: application/json
```

---

## Endpoints

### 1. Publicar disponibilidad

El vendor publica su disponibilidad hacia el sistema consumidor. Es el punto de integración principal.

```
POST /openmaps-cl/v1/slots
```

**Cuerpo de la solicitud** — objeto `availability_payload`:

```json
{
  "schema": "openmaps-cl/0.1",
  "vendor_id": "mi-software-de-agenda",
  "generated_at": "2026-03-21T00:00:00Z",
  "providers": [
    {
      "provider_id": "PROV-001",
      "name": "Centro Médico Ejemplo",
      "provider_type": "medical_center",
      "rut_provider": "76.543.210-1",
      "accepts_fonasa": true,
      "fonasa_accreditation_level": "2",
      "libre_eleccion": true,
      "location": {
        "address": "Av. Providencia 1234",
        "commune": "Providencia",
        "city": "Santiago",
        "region": "Región Metropolitana",
        "country": "CL",
        "latitude": -33.4294,
        "longitude": -70.6148
      },
      "contact": {
        "phone": "+56223456789",
        "email": "contacto@centromedico.cl"
      }
    }
  ],
  "slots": [
    {
      "slot_id": "VENDOR-20260321-DER-001",
      "provider_id": "PROV-001",
      "specialty": {
        "sis_code": "10",
        "sis_name": "DERMATOLOGÍA"
      },
      "professional_name": "Dra. María González",
      "rut_professional": "15.234.567-8",
      "start_datetime": "2026-03-21T10:00:00-03:00",
      "end_datetime": "2026-03-21T10:30:00-03:00",
      "duration_minutes": 30,
      "status": "available",
      "modality": "in_person",
      "accepts_fonasa": true,
      "fonasa_accreditation_level": "2",
      "insurance_accepted": ["FONASA-B", "FONASA-C", "FONASA-D", "FONASA-LE", "ISAPRE", "PARTICULAR"],
      "libre_eleccion": true,
      "ges": { "is_ges": false },
      "base_price": 48000,
      "currency": "CLP",
      "_schema": "openmaps-cl/0.1"
    }
  ]
}
```

**Respuesta exitosa:**

```json
{
  "status": "accepted",
  "slots_received": 1,
  "slots_indexed": 1,
  "slots_rejected": 0,
  "errors": []
}
```

**Códigos de respuesta HTTP:**

| Código | Significado |
|---|---|
| `202 Accepted` | Payload recibido e indexado correctamente |
| `400 Bad Request` | JSON malformado |
| `401 Unauthorized` | Token inválido o ausente |
| `422 Unprocessable Entity` | Esquema válido pero datos rechazados (ej. `provider_id` desconocido, RUT inválido) |
| `429 Too Many Requests` | Límite de tasa excedido — respetar el encabezado `Retry-After` |
| `5xx` | Error en el sistema consumidor — reintentar con backoff exponencial |

---

### 2. Actualizar una hora (cambios en tiempo real)

El vendor notifica al sistema consumidor sobre el cambio de estado de una hora específica. Es más eficiente que una re-sincronización completa: solo se transmite el cambio.

```
PATCH /openmaps-cl/v1/slots/{slot_id}
```

**Cuándo debe enviarse este llamado:**
- La hora fue reservada por otro canal (teléfono, presencial, otra plataforma)
- Una reserva fue cancelada y la hora vuelve a estar disponible
- La hora fue bloqueada (médico con licencia, cierre imprevisto del centro)
- Se abrió una nueva hora no contemplada en la sincronización anterior

**Cuerpo de la solicitud:**

```json
{
  "slot_id": "VENDOR-20260321-DER-001",
  "status": "booked"
}
```

Para liberar una hora previamente ocupada:

```json
{
  "slot_id": "VENDOR-20260321-DER-001",
  "status": "available"
}
```

**Respuesta exitosa:**

```json
{
  "status": "updated",
  "slot_id": "VENDOR-20260321-DER-001"
}
```

---

### 3. Reservar una hora

El sistema consumidor solicita la reserva de una hora al vendor, en nombre de un paciente. El vendor registra la reserva en el sistema del prestador y responde con confirmación o rechazo.

```
POST /openmaps-cl/v1/bookings
```

**Cuerpo de la solicitud** — objeto `booking_request`:

```json
{
  "slot_id": "VENDOR-20260321-DER-001",
  "patient": {
    "name": "Juan Pérez",
    "phone": "+56912345678",
    "email": "juan@example.com"
  },
  "insurance_type": "FONASA-C",
  "notes": "Primera consulta. El paciente tiene derivación de médico de cabecera."
}
```

**Respuesta — hora confirmada:**

```json
{
  "status": "confirmed",
  "booking_id": "BK-20260321-00142",
  "confirmation_code": "ABC-7823",
  "message": "Hora confirmada para el sábado 21 de marzo a las 10:00 en Centro Médico Ejemplo.",
  "slot": { "...objeto slot con status actualizado..." }
}
```

**Respuesta — hora rechazada:**

```json
{
  "status": "rejected",
  "booking_id": null,
  "rejection_reason": "slot_unavailable",
  "message": "Esta hora ya no se encuentra disponible. Por favor, seleccione otra opción."
}
```

**Códigos de rechazo:**

| Código | Significado |
|---|---|
| `slot_unavailable` | La hora fue reservada por otro paciente de forma simultánea |
| `provider_inactive` | El prestador no está recibiendo reservas temporalmente |
| `insurance_not_accepted` | El tipo de previsión del paciente no es aceptado para esta hora |
| `validation_error` | Campos requeridos ausentes o con formato inválido |
| `other` | Otro motivo — ver el campo `message` para más detalle |

**El vendor debe responder en un máximo de 5 segundos.** Si la confirmación requiere más tiempo (sistemas lentos o procesos asincrónicos), responder con `status: "pending"` e implementar el evento webhook `booking.confirmed` cuando la confirmación esté disponible.

---

## Eventos webhook (vendor → consumidor)

Además del endpoint `PATCH /slots/{id}`, los vendors pueden enviar notificaciones asincrónicas de eventos relacionados a reservas. Registrar la URL del webhook en el portal de vendors del sistema consumidor.

### `booking.confirmed`

Se envía cuando el vendor confirma una reserva de forma asincrónica (casos donde la respuesta inicial fue `pending`):

```json
{
  "event": "booking.confirmed",
  "booking_id": "BK-20260321-00142",
  "slot_id": "VENDOR-20260321-DER-001",
  "confirmation_code": "ABC-7823",
  "timestamp": "2026-03-21T08:45:00Z"
}
```

### `booking.cancelled`

Se envía cuando una reserva es cancelada, ya sea por el paciente o por el prestador:

```json
{
  "event": "booking.cancelled",
  "booking_id": "BK-20260321-00142",
  "slot_id": "VENDOR-20260321-DER-001",
  "cancelled_by": "patient",
  "reason": "patient_request",
  "timestamp": "2026-03-21T09:00:00Z"
}
```

El campo `cancelled_by` puede ser `patient` o `provider`. El campo `reason` es de libre texto.

---

## Límites de tasa recomendados

Los sistemas consumidores deben documentar sus propios límites. Como referencia:

| Entorno | Solicitudes / minuto | Slots por lote |
|---|---|---|
| Sandbox | 10 | 100 |
| Producción | 300 | 5.000 |

---

## Versionado

La versión de la API forma parte de la ruta (`/v1/`). Los cambios que rompen compatibilidad incrementan el número de versión. Las adiciones no disruptivas (campos opcionales nuevos) no incrementan la versión pero quedan registradas en el CHANGELOG.

---

## Entorno sandbox

Los sistemas consumidores deben proveer un entorno de sandbox para que los vendors prueben su integración antes de pasar a producción. Prácticas recomendadas:

- URL base separada (ej. `https://sandbox.api.tudominio.cl/openmaps-cl/v1`)
- Espacio de tokens independiente del de producción
- Datos reseteados cada 24 horas
- Respuestas realistas que simulan casos de éxito y de error
- Acceso disponible sin costo para equipos de desarrollo
