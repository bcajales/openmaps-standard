# Registro de Cambios

Todos los cambios relevantes de OpenMAPS/CL se documentan en este archivo.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [0.1.0] — 21 de marzo de 2026

Primera versión pública.

### Incorporado

**Esquema principal (`openmaps-cl.schema.json`)**
- Objeto `slot` — hora médica disponible con especialidad, fechas, modalidad, previsiones y precio base
- Objeto `provider` — prestador de salud con ubicación, tipo y campos chilenos
- Enumeración `provider_type` — clinic, hospital, medical_center, independent_professional, dental, laboratory, imaging_center, rehabilitation, other
- Objeto `specialty` — códigos SIS-MINSAL (40 especialidades)
- Objeto `ges` — campos para garantías GES/AUGE
- Objetos `booking_request` / `booking_response` — solicitud y confirmación de reserva
- Objeto `availability_payload` — estructura principal para el intercambio vendor → consumidor
- Objeto `patient` — nombre y teléfono únicamente (privacidad por diseño)
- `fonasa_accreditation_level` — niveles de acreditación Libre Elección 1, 2 y 3
- Enumeración `insurance_accepted` — FONASA-A/B/C/D, FONASA-LE, ISAPRE, PARTICULAR
- Campos `rut_provider` / `rut_professional` — con validación de formato RUT chileno
- Documentación del cálculo de copago como responsabilidad del sistema consumidor (no del vendor)
- Alineación semántica con HL7 FHIR R4 (Schedule/Slot/Appointment)
- Referencia explícita a la Guía de Implementación Core-CL de HL7 Chile como base canónica del ecosistema FHIR en Chile
- Mención de la Ley 20.584 (Derechos y Deberes del Paciente) en el marco regulatorio — privacidad por diseño

**Documentación**
- `README.md` — Presentación del estándar, decisiones de diseño y marco regulatorio
- `docs/api.md` — Especificación completa de la API REST (3 endpoints + webhooks)
- `docs/alineacion-fhir.md` — Mapeo campo a campo con HL7 FHIR R4
- `docs/guia-implementacion.md` — Guía paso a paso para vendors
- `docs/codigos-sis-minsal.md` — Listado completo de 40 especialidades SIS-MINSAL

**Ejemplos de código**
- Python: `examples/python/vendor_example.py`
- JavaScript / Node.js: `examples/javascript/vendor_example.js`

### Decisiones de diseño

**Un solo perfil.** OpenMAPS/CL es chileno desde su base. No existe una capa genérica separada. Futuros perfiles para otros países (`/CO`, `/MX`) seguirán la misma estructura.

**Los copagos no los calcula el vendor.** Los vendors envían `base_price` y `fonasa_accreditation_level`. El sistema consumidor aplica las tasas del arancel público de Fonasa. Este diseño simplifica la implementación del vendor y centraliza la lógica en quien tiene acceso al contexto del paciente.

**Ningún sistema consumidor es nombrado.** El estándar es genérico — cualquier vendor o plataforma puede implementarlo.

**Licencia MIT.** Sin restricciones, sin tarifas, sin registro requerido.

**Documentación en español.** La documentación está en español para facilitar la adopción por parte de equipos técnicos en Chile y otros países de habla hispana. Los nombres de campos del esquema JSON permanecen en inglés siguiendo la convención universal de la industria de software.

### Autor

Bernardo Cajales Millón — diseño, especificación e implementación inicial.

---

## Planificado — [0.2.0]

- Especificación OpenAPI 3.0 para la API REST
- Herramienta CLI de validación de payloads contra el esquema
- Perfil OpenMAPS/CO (Colombia — sistema SGSSS, códigos EPS)
- Firmas HMAC para webhooks
- Campos `available_from` / `available_until` para ventanas de reserva anticipada
- Guía de migración desde HL7 v2 para sistemas hospitalarios legados
