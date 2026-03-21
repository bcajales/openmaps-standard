# Códigos de Especialidad SIS-MINSAL

**Fuente:** MINSAL — Sistema de Información de Salud (SIS)
**Actualización:** 2026

Estos son los códigos de especialidad oficiales utilizados en OpenMAPS/CL. El campo `specialty.sis_code` de cada hora publicada debe corresponder a uno de estos valores.

---

## Listado completo

| Código | Especialidad |
|---|---|
| 01 | ANATOMÍA PATOLÓGICA |
| 02 | ANESTESIOLOGÍA |
| 03 | CARDIOLOGÍA |
| 04 | CARDIOCIRUGÍA |
| 05 | CIRUGÍA GENERAL |
| 06 | CIRUGÍA PEDIÁTRICA |
| 07 | CIRUGÍA PLÁSTICA Y REPARADORA |
| 08 | CIRUGÍA TORÁCICA |
| 09 | CIRUGÍA VASCULAR PERIFÉRICA |
| 10 | DERMATOLOGÍA |
| 11 | ENDOCRINOLOGÍA |
| 12 | ENFERMEDADES RESPIRATORIAS |
| 13 | GASTROENTEROLOGÍA |
| 14 | GENÉTICA CLÍNICA |
| 15 | GERIATRÍA |
| 16 | GINECOLOGÍA |
| 17 | HEMATOLOGÍA |
| 18 | INFECTOLOGÍA |
| 19 | INMUNOLOGÍA |
| 20 | MEDICINA FÍSICA Y REHABILITACIÓN |
| 21 | MEDICINA INTERNA |
| 22 | MEDICINA NUCLEAR |
| 23 | NEFROLOGÍA |
| 24 | NEONATOLOGÍA |
| 25 | NEUROCIRUGÍA |
| 26 | NEUROLOGÍA |
| 27 | NUTRIOLOGÍA |
| 28 | OBSTETRICIA |
| 29 | OFTALMOLOGÍA |
| 30 | ONCOLOGÍA MÉDICA |
| 31 | ORTOPEDIA Y TRAUMATOLOGÍA |
| 32 | OTORRINOLARINGOLOGÍA |
| 33 | PEDIATRÍA |
| 34 | PSIQUIATRÍA |
| 35 | RADIOLOGÍA |
| 36 | REUMATOLOGÍA |
| 37 | UROLOGÍA |
| 38 | MEDICINA GENERAL/FAMILIAR |
| 39 | ODONTOLOGÍA GENERAL |
| 40 | PSICOLOGÍA |

---

## Notas de implementación

**Formato del código:** Dos dígitos con cero inicial cuando corresponda (ej. `03`, no `3`).

**Kinesiología, fonoaudiología y terapia ocupacional** no tienen código SIS-MINSAL de especialidad asignado. Para prestadores que ofrecen exclusivamente estos servicios, configurar el campo `provider_type` del objeto `provider` como `rehabilitation`. Las horas publicadas pueden omitir el campo `specialty` o usar el código `20` (MEDICINA FÍSICA Y REHABILITACIÓN) cuando el servicio esté supervisado por un médico fisiatra.

**Enfermería y matrona** siguen la configuración del prestador, no de la especialidad de la hora. No existe un código SIS-MINSAL de especialidad para estos profesionales en el contexto ambulatorio.

**Actualización de códigos:** El MINSAL puede incorporar nuevos códigos o modificar los existentes. Consultar periódicamente el sitio web del SIS-MINSAL para mantener la tabla actualizada. Reportar discrepancias abriendo un Issue en este repositorio.
