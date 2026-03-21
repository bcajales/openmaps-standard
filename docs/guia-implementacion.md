# OpenMAPS/CL — Guía de Implementación para Vendors

Esta guía describe los pasos necesarios para que un software de agenda médica publique disponibilidad mediante OpenMAPS/CL.

**Tiempo estimado de implementación: 3 a 5 días hábiles.**

---

## Requisitos previos

Antes de comenzar, verificar que el sistema cuenta con:

- Capacidad de realizar llamadas a APIs REST externas
- Capacidad de recibir y responder webhooks HTTP
- Una cuenta registrada en el sistema consumidor con el que se integrará (para obtener el token de API)
- Acceso al Registro Nacional de Prestadores de la Superintendencia de Salud para obtener el nivel de acreditación Fonasa Libre Elección de los prestadores gestionados

---

## Paso 1 — Mapear el modelo de datos interno

El primer paso es identificar cómo los conceptos de OpenMAPS/CL se corresponden con los objetos del sistema propio:

| OpenMAPS/CL | Equivalente en su sistema |
|---|---|
| `provider` | Clínica, centro médico o prestador |
| `slot` | Hora o bloque de tiempo disponible |
| `specialty.sis_code` | Especialidad o tipo de atención |
| `professional_name` | Médico o profesional asignado |
| `booking_request` | Solicitud de reserva entrante |
| `booking_response` | Confirmación o rechazo de reserva |

---

## Paso 2 — Mapear los códigos de especialidad SIS-MINSAL

Cada hora publicada debe incluir el código de especialidad oficial SIS-MINSAL. Construir una tabla de equivalencia entre los nombres internos del sistema y los códigos oficiales:

| Nombre interno (ejemplo) | Código SIS-MINSAL | Nombre oficial |
|---|---|---|
| Dermato / Piel | 10 | DERMATOLOGÍA |
| Cardio | 03 | CARDIOLOGÍA |
| Traumato / Ortopedia | 31 | ORTOPEDIA Y TRAUMATOLOGÍA |
| Gineco | 16 | GINECOLOGÍA |
| Médico general | 38 | MEDICINA GENERAL/FAMILIAR |
| Psicólogo | 40 | PSICOLOGÍA |
| Dentista | 39 | ODONTOLOGÍA GENERAL |
| Nutricionista | 27 | NUTRIOLOGÍA |

Listado completo: [`docs/codigos-sis-minsal.md`](codigos-sis-minsal.md)

Para los servicios de kinesiología, fonoaudiología y terapia ocupacional, no existe un código SIS-MINSAL de especialidad. En estos casos, configurar el campo `provider_type` del prestador como `rehabilitation`.

---

## Paso 3 — Obtener el nivel de acreditación Fonasa

Para que el sistema consumidor pueda procesar correctamente la información de previsión, cada prestador que acepta Fonasa debe incluir su nivel de acreditación Libre Elección (`fonasa_accreditation_level`): `"1"`, `"2"` o `"3"`.

Este dato es público y puede obtenerse desde el Registro Nacional de Prestadores de la Superintendencia de Salud:
`https://rnpi.superdesalud.gob.cl/`

Buscar por RUT del prestador y registrar el nivel de acreditación Libre Elección correspondiente.

**Importante:** Los vendors no calculan ni incluyen montos de copago en el payload. Solo se informa `base_price` (precio particular) y `fonasa_accreditation_level`. El sistema consumidor determina cómo usar esa información.

---

## Paso 4 — Construir el payload de disponibilidad

El payload sigue la estructura `availability_payload` definida en el esquema:

```json
{
  "schema": "openmaps-cl/0.1",
  "vendor_id": "identificador-del-sistema",
  "generated_at": "2026-03-21T00:00:00Z",
  "providers": [ ...objetos provider... ],
  "slots": [ ...objetos slot... ]
}
```

**Consideraciones importantes:**

- **Fechas y horas** deben incluir el offset de zona horaria: `-03:00` en horario estándar, `-04:00` en horario de verano (marzo a octubre en Chile)
- **`slot_id`** debe ser estable — usar siempre el mismo identificador para la misma hora en sincronizaciones sucesivas
- **Prefijos en `slot_id`** — incluir un prefijo que identifique al vendor para evitar colisiones: `MIVDR-PROV001-DER-20260321-1000`
- **Datos del prestador** — incluir el objeto `provider` solo cuando la información del prestador cambia; los sistemas consumidores guardan caché de estos datos

---

## Paso 5 — Publicar disponibilidad (sincronización inicial)

Realizar una sincronización completa al iniciar la integración y luego una vez al día en horario de baja carga:

```bash
curl -X POST https://{url-del-consumidor}/openmaps-cl/v1/slots \
  -H "Authorization: Bearer {tu-token}" \
  -H "Content-Type: application/json" \
  -d @payload.json
```

**Para lotes grandes**, dividir los slots en grupos de 1.000 a 5.000 y enviarlos de forma secuencial, no en paralelo.

La respuesta indica cuántos slots fueron indexados y cuáles fueron rechazados con su motivo:

```json
{
  "status": "accepted",
  "slots_received": 250,
  "slots_indexed": 248,
  "slots_rejected": 2,
  "errors": [
    {
      "slot_id": "VENDOR-001-ERR",
      "error": "invalid_rut",
      "message": "El formato del RUT del profesional es inválido"
    }
  ]
}
```

---

## Paso 6 — Enviar actualizaciones en tiempo real

Cuando el estado de una hora cambia en el sistema propio, notificar al consumidor inmediatamente mediante `PATCH`. No esperar a la siguiente sincronización diaria.

```bash
# Una hora fue reservada por otro canal
curl -X PATCH https://{url-del-consumidor}/openmaps-cl/v1/slots/VENDOR-20260321-001 \
  -H "Authorization: Bearer {tu-token}" \
  -H "Content-Type: application/json" \
  -d '{"slot_id": "VENDOR-20260321-001", "status": "booked"}'

# Una reserva fue cancelada — la hora vuelve a estar disponible
curl -X PATCH https://{url-del-consumidor}/openmaps-cl/v1/slots/VENDOR-20260321-001 \
  -H "Authorization: Bearer {tu-token}" \
  -H "Content-Type: application/json" \
  -d '{"slot_id": "VENDOR-20260321-001", "status": "available"}'
```

**Eventos que deben disparar un PATCH:**
- Una hora es reservada por teléfono, de forma presencial o mediante otra plataforma
- Una reserva es cancelada y la hora queda disponible nuevamente
- Una hora es bloqueada (médico con licencia, cierre imprevisto, mantenimiento)
- Se abre una nueva hora que no estaba en la sincronización anterior

---

## Paso 7 — Recibir y responder solicitudes de reserva

Cuando un paciente reserva a través del sistema consumidor, el vendor recibirá una `booking_request`. El sistema debe:

1. Verificar que la hora sigue disponible
2. Registrar la reserva en el sistema del prestador (marcar la hora como ocupada)
3. Responder con una `booking_response` en un máximo de **5 segundos**

**Caso exitoso:**

```json
{
  "status": "confirmed",
  "booking_id": "ID-INTERNO-DE-RESERVA",
  "confirmation_code": "CODIGO-LEGIBLE",
  "message": "Hora confirmada para el sábado 21 de marzo a las 10:00 en Centro Médico Ejemplo."
}
```

**Caso de rechazo (hora ya no disponible):**

```json
{
  "status": "rejected",
  "booking_id": null,
  "rejection_reason": "slot_unavailable",
  "message": "Esta hora ya no se encuentra disponible."
}
```

Si la confirmación requiere un proceso asincrónico que toma más de 5 segundos, responder con `status: "pending"` y enviar el evento webhook `booking.confirmed` cuando la reserva quede confirmada en el sistema del prestador.

---

## Paso 8 — Pruebas en el entorno sandbox

Antes de pasar a producción, completar las siguientes pruebas en el entorno sandbox del consumidor:

1. **Publicar** un conjunto pequeño de horas (10 a 20 slots) y verificar que aparecen correctamente indexadas
2. **Actualizar** el estado de una hora con PATCH y verificar que el cambio se refleja
3. **Recibir** una solicitud de reserva de prueba y verificar que la respuesta es correcta
4. **Cancelar** una reserva y verificar que la hora queda disponible nuevamente
5. **Verificar el comportamiento ante errores** — enviar datos inválidos y comprobar que el sistema los rechaza correctamente

---

## Convención de nombrado de `slot_id`

Usar un formato consistente que identifique unívocamente cada hora:

```
{PREFIJO_VENDOR}-{CODIGO_PRESTADOR}-{ESPECIALIDAD}-{FECHA}-{HORA}

Ejemplos:
  AGP-PROV001-DER-20260321-1000
  RSV-CENT042-GIN-20260322-0830
  DNL-CLNC07-ODO-20260323-1530
```

El prefijo del vendor evita colisiones de `slot_id` entre distintos sistemas integrados al mismo consumidor.

---

## Manejo de errores

| Código HTTP | Acción recomendada |
|---|---|
| `202 Accepted` | Éxito — revisar si `slots_rejected > 0` para corregir errores parciales |
| `400 Bad Request` | Corregir el JSON malformado antes de reintentar |
| `401 Unauthorized` | Token expirado o inválido — re-autenticar |
| `422 Unprocessable Entity` | Corregir los errores de datos listados en el campo `errors` |
| `429 Too Many Requests` | Límite de tasa excedido — esperar el tiempo indicado en `Retry-After` |
| `5xx Server Error` | Error en el sistema consumidor — reintentar con backoff exponencial |

---

## Lista de verificación antes del paso a producción

Verificar cada punto antes de activar la integración en producción:

- [ ] Todos los prestadores tienen RUT en formato `XX.XXX.XXX-X`
- [ ] Todos los profesionales tienen RUT en formato `XX.XXX.XXX-X`
- [ ] Todos los slots tienen código de especialidad SIS-MINSAL válido
- [ ] Todas las fechas y horas incluyen el offset de zona horaria
- [ ] Los `slot_id` son estables — el mismo identificador en sincronizaciones sucesivas
- [ ] El campo `fonasa_accreditation_level` está configurado para todos los prestadores que aceptan Fonasa
- [ ] El PATCH se dispara automáticamente ante cada cambio de estado de una hora
- [ ] El handler de `booking_request` responde en menos de 5 segundos
- [ ] Las pruebas en sandbox cubren los flujos de confirmación y rechazo
- [ ] El sistema maneja correctamente los errores HTTP `422` y `429`
