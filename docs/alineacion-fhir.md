# OpenMAPS/CL — Alineación con HL7 FHIR R4

OpenMAPS/CL es un perfil simplificado de HL7 FHIR R4 para el agendamiento médico en Chile. Este documento explica en detalle la relación entre ambos estándares.

---

## ¿Qué son HL7 y FHIR?

**HL7** (*Health Level Seven*) es la organización internacional responsable de definir estándares para el intercambio de datos de salud. Publica múltiples estándares, el más moderno de los cuales es **FHIR**.

**FHIR** (*Fast Healthcare Interoperability Resources*) es el estándar que HL7 publicó en 2019 en su versión Release 4 (R4). Define "recursos" — objetos JSON estructurados para cada concepto clínico. Es el estándar adoptado por el MINSAL en Chile mediante la Ley 21.668.

### La diferencia entre HL7 v2 y FHIR R4

Es importante distinguir ambas versiones, pues coexisten en el sistema de salud chileno:

| Aspecto | HL7 v2 | FHIR R4 |
|---|---|---|
| Año de origen | 1987 | 2019 |
| Formato | Texto delimitado por pipes (`\|`) | JSON / XML sobre REST |
| Uso actual en Chile | Hospitales con sistemas legados | Estándar mandatado por Ley 21.668 |
| Interoperabilidad | Difícil de extender | Diseñado para integración moderna |

OpenMAPS/CL se alinea con **FHIR R4**, no con HL7 v2. La integración con sistemas legados que hablan HL7 v2 está fuera del alcance de este estándar.

---

## Los recursos FHIR R4 para agendamiento

FHIR R4 define tres recursos específicos para el caso de uso de agendamiento:

### `Schedule`
Representa el contenedor de tiempo disponible de un prestador.

> *"La Dra. González atiende en el Centro Médico Providencia los lunes, miércoles y viernes."*

### `Slot`
Representa un bloque de tiempo específico dentro de un Schedule.

> *"Lunes 21 de marzo de 2026, 10:00 a 10:30 — disponible."*

### `Appointment`
Representa una reserva confirmada de un Slot por parte de un paciente específico.

> *"Juan Pérez reservó la hora del lunes 21 de marzo a las 10:00 con la Dra. González."*

---

## Mapeo con OpenMAPS/CL

| Recurso FHIR R4 | Objeto OpenMAPS/CL |
|---|---|
| `Schedule` | `provider` |
| `Slot` | `slot` |
| `Appointment` (solicitud) | `booking_request` |
| `Appointment` (confirmada) | `booking_response` |

---

## Mapeo de campos

### `provider` ↔ FHIR R4 `Schedule`

| Campo OpenMAPS/CL | Equivalente FHIR R4 | Notas |
|---|---|---|
| `provider_id` | `Schedule.id` | |
| `name` | `Schedule.actor.display` | |
| `provider_type` | `Schedule.serviceType` | Simplificado a enumeración |
| `rut_provider` | `Schedule.actor.identifier` | Específico de Chile — formato RUT |
| `accepts_fonasa` | `Schedule.extension` | Específico de Chile |
| `fonasa_accreditation_level` | `Schedule.extension` | Específico de Chile |
| `libre_eleccion` | `Schedule.extension` | Específico de Chile |
| `location.latitude/longitude` | `Location.position` | Vía recurso `Location` referenciado |
| `superintendencia_code` | `Organization.identifier` | Registro Nacional de Prestadores |

### `slot` ↔ FHIR R4 `Slot`

| Campo OpenMAPS/CL | Equivalente FHIR R4 | Notas |
|---|---|---|
| `slot_id` | `Slot.id` | |
| `provider_id` | `Slot.schedule` (referencia) | |
| `specialty.sis_code` | `Slot.serviceType.coding.code` | Sistema SIS-MINSAL |
| `specialty.sis_name` | `Slot.serviceType.coding.display` | |
| `professional_name` | `Slot.actor.display` | Vía recurso `Practitioner` |
| `rut_professional` | `Slot.actor.identifier` | Específico de Chile |
| `start_datetime` | `Slot.start` | |
| `end_datetime` | `Slot.end` | |
| `status` | `Slot.status` | Los valores del enumerador difieren levemente |
| `modality` | `Slot.extension` | Simplificado |
| `insurance_accepted` | `Slot.extension` | Enumeración específica de Chile |
| `libre_eleccion` | `Slot.extension` | Específico de Chile |
| `ges` | `Slot.extension` | Específico de Chile |
| `base_price` | `Slot.extension` | |

### `booking_request` ↔ FHIR R4 `Appointment`

| Campo OpenMAPS/CL | Equivalente FHIR R4 | Notas |
|---|---|---|
| `slot_id` | `Appointment.slot` (referencia) | |
| `patient.name` | `Appointment.participant.actor.display` | |
| `patient.phone` | `Patient.telecom` | Vía recurso `Patient` referenciado |
| `patient.email` | `Patient.telecom` | Vía recurso `Patient` referenciado |
| `insurance_type` | `Appointment.extension` | Específico de Chile |
| `notes` | `Appointment.comment` | |

---

## Qué simplifica OpenMAPS/CL deliberadamente

Algunos campos y mecanismos de FHIR R4 se omiten en OpenMAPS/CL porque están fuera del alcance de este estándar o porque su gestión corresponde al sistema consumidor:

| Elemento omitido | Justificación |
|---|---|
| Montos de copago | Fuera del alcance del estándar — cada sistema consumidor los determina según la normativa Fonasa vigente |
| Datos clínicos del paciente | Fuera del alcance — privacidad por diseño |
| Información de facturación | Fuera del alcance del agendamiento |
| Notas clínicas | Fuera del alcance |
| Referencias y links FHIR | Reemplazados por identificadores de texto simples |
| OAuth2 / SMART on FHIR | Reemplazado por autenticación Bearer token |
| Servidor FHIR dedicado | Reemplazado por REST sobre HTTP estándar |

Estas simplificaciones reducen el tiempo de implementación de meses a días sin sacrificar la integridad semántica del modelo.

---

## Interoperabilidad con sistemas FHIR nativos

Un sistema que implemente FHIR R4 de forma nativa puede consumir o publicar OpenMAPS/CL mediante una capa de transformación directa. El mapeo semántico es uno a uno — no hay pérdida de información en la traducción.

**Para convertir un `slot` OpenMAPS/CL a un `Slot` FHIR R4:**
1. Mapear los campos según la tabla anterior
2. Encapsular los campos específicos de Chile en extensiones FHIR (`Extension.url` + `Extension.value`)
3. Construir las referencias FHIR requeridas (`Schedule`, `Practitioner`, `Location`)

**Para convertir un `Slot` FHIR R4 a un `slot` OpenMAPS/CL:**
1. Extraer los campos base del recurso
2. Extraer los campos chilenos de las extensiones correspondientes
3. Aplanar las referencias a identificadores simples

---

## Alineación con el MINSAL

La Ley 21.668 y la Guía de Implementación FHIR Chile del MINSAL establecen los siguientes lineamientos que OpenMAPS/CL respeta:

- **Códigos SIS-MINSAL** — OpenMAPS/CL utiliza exactamente los mismos códigos de especialidad definidos por el MINSAL
- **RUT como identificador** — Tanto el MINSAL FHIR IG como OpenMAPS/CL usan el RUT como identificador principal de personas y organizaciones en Chile
- **Estructura FHIR** — Los tres recursos base (Schedule/Slot/Appointment) son los mismos en ambos estándares

La diferencia es de alcance: la Ley 21.668 y el MINSAL FHIR IG abordan la interoperabilidad de fichas clínicas. OpenMAPS/CL aborda la disponibilidad de agendamiento — un dominio complementario que la ley no cubre explícitamente pero que es coherente con su espíritu.

---

## Nota sobre HL7 v2 en Chile

Muchos hospitales chilenos, especialmente los públicos gestionados con Rayen u otros sistemas legados, aún utilizan HL7 v2 para la comunicación interna entre sistemas. HL7 v2 y FHIR R4 no son formatos compatibles entre sí.

## Decisiones de diseño donde OpenMAPS/CL define algo que Core-CL no tiene

### Tipos de cobertura (`insurance_type`)

**Estado:** OpenMAPS define un enum provisional. Propuesta enviada a HL7 Chile (Issue pendiente).

**FHIR Chile Core-CL:** No define perfil `CL Coverage` ni ValueSet para tipos de cobertura.

**OpenMAPS/CL:** Define enum con 9 valores:
- FONASA-A, FONASA-B, FONASA-C, FONASA-D
- FONASA-LE (Libre Elección)
- ISAPRE (privadas)
- DIPRECA (Carabineros)
- CAPREDENA (Fuerzas Armadas)
- PARTICULAR (sin previsión)

**Justificación temporal:**
- Ningún sistema FHIR chileno ha definido estos códigos oficialmente
- El agendamiento médico requiere filtrar horas por tipo de previsión aceptada
- ~550.000 beneficiarios DIPRECA/CAPREDENA necesitan representación en sistemas de salud
- Sin un estándar oficial, cada implementador inventará su propio enum

**Impacto de NO tener este estándar:**
- Sistema A usa "FONASA_C" (guion bajo)
- Sistema B usa "fonasa-c" (minúsculas)
- Sistema C usa "FONASA-TRAMO-C" (nombre largo)
- Sistema D usa código numérico "3"
- **Resultado:** Incompatibilidad entre sistemas "FHIR-compliant"

**Plan futuro:**
- Si HL7 Chile adopta un ValueSet oficial en Core-CL, OpenMAPS lo adoptará inmediatamente
- El enum actual se marcará como `deprecated` en OpenMAPS v0.2.0
- Se mantendrá compatibilidad hacia atrás por 12 meses
- Herramientas de migración automática para vendors

**Base normativa de los códigos propuestos:**
- FONASA tramos A/B/C/D: Ley 18.469 Art. 29
- Libre Elección: D.S. 369/1985 y modificaciones
- DIPRECA: Ley 18.458 (1985)
- CAPREDENA: DFL 1/2007 Ministerio de Defensa
- Superintendencia de Salud: Fuente autoritativa para acreditación

**Crédito:** Gap de interoperabilidad detectado por Jessica Menéndez en [Issue #5](https://github.com/bcajales/openmaps-standard/issues/5).

**Escalamiento:** Propuesta formal enviada a HL7 Chile para agregar perfil CL Coverage a Core-CL. Ver documento completo de la propuesta en [este Issue](link-pendiente).


OpenMAPS/CL se alinea exclusivamente con FHIR R4. La integración con sistemas que hablan HL7 v2 requiere una capa de transformación adicional que está fuera del alcance de este estándar.

## Decisiones de diseño donde OpenMAPS/CL define algo que Core-CL no tiene
 
### Tipos de cobertura (`insurance_type`)
 
**Estado:** OpenMAPS define un enum provisional. Propuesta enviada a HL7 Chile (Issue pendiente).
 
**FHIR Chile Core-CL:** No define perfil `CL Coverage` ni ValueSet para tipos de cobertura.
 
**OpenMAPS/CL:** Define enum con 9 valores:
- FONASA-A, FONASA-B, FONASA-C, FONASA-D
- FONASA-LE (Libre Elección)
- ISAPRE (privadas)
- DIPRECA (Carabineros)
- CAPREDENA (Fuerzas Armadas)
- PARTICULAR (sin previsión)
 
**Justificación temporal:**
- Ningún sistema FHIR chileno ha definido estos códigos oficialmente
- El agendamiento médico requiere filtrar horas por tipo de previsión aceptada
- ~550.000 beneficiarios DIPRECA/CAPREDENA necesitan representación en sistemas de salud
- Sin un estándar oficial, cada implementador inventará su propio enum
 
**Impacto de NO tener este estándar:**
- Sistema A usa "FONASA_C" (guion bajo)
- Sistema B usa "fonasa-c" (minúsculas)
- Sistema C usa "FONASA-TRAMO-C" (nombre largo)
- Sistema D usa código numérico "3"
- **Resultado:** Incompatibilidad entre sistemas "FHIR-compliant"
 
**Plan futuro:**
- Si HL7 Chile adopta un ValueSet oficial en Core-CL, OpenMAPS lo adoptará inmediatamente
- El enum actual se marcará como `deprecated` en OpenMAPS v0.2.0
- Se mantendrá compatibilidad hacia atrás por 12 meses
- Herramientas de migración automática para vendors
 
**Base normativa de los códigos propuestos:**
- FONASA tramos A/B/C/D: Ley 18.469 Art. 29
- Libre Elección: D.S. 369/1985 y modificaciones
- DIPRECA: Ley 18.458 (1985)
- CAPREDENA: DFL 1/2007 Ministerio de Defensa
- Superintendencia de Salud: Fuente autoritativa para acreditación
 
**Crédito:** Gap de interoperabilidad detectado por Jessica Menéndez en [Issue #5](https://github.com/bcajales/openmaps-standard/issues/5).
 
**Escalamiento:** Propuesta formal enviada a HL7 Chile para agregar perfil CL Coverage a Core-CL. Ver documento completo de la propuesta en [este Issue](link-pendiente).
