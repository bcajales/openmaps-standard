/**
 * OpenMAPS/CL — Ejemplo de implementación en JavaScript / Node.js
 * ================================================================
 * Demuestra cómo un software de agenda médica publica disponibilidad
 * de horas mediante el estándar OpenMAPS/CL.
 *
 * Autor: Bernardo Cajales Millón
 * Licencia: MIT
 * Estándar: https://github.com/bcajales/openmaps-standard
 */

"use strict";

// ── Códigos de especialidad SIS-MINSAL ────────────────────────────────────────

const SIS_MINSAL = {
  "01": "ANATOMÍA PATOLÓGICA",
  "02": "ANESTESIOLOGÍA",
  "03": "CARDIOLOGÍA",
  "04": "CARDIOCIRUGÍA",
  "05": "CIRUGÍA GENERAL",
  "10": "DERMATOLOGÍA",
  "11": "ENDOCRINOLOGÍA",
  "13": "GASTROENTEROLOGÍA",
  "16": "GINECOLOGÍA",
  "21": "MEDICINA INTERNA",
  "26": "NEUROLOGÍA",
  "29": "OFTALMOLOGÍA",
  "31": "ORTOPEDIA Y TRAUMATOLOGÍA",
  "32": "OTORRINOLARINGOLOGÍA",
  "33": "PEDIATRÍA",
  "34": "PSIQUIATRÍA",
  "36": "REUMATOLOGÍA",
  "37": "UROLOGÍA",
  "38": "MEDICINA GENERAL/FAMILIAR",
  "39": "ODONTOLOGÍA GENERAL",
  "40": "PSICOLOGÍA",
};


// ── Constructor de prestador ───────────────────────────────────────────────────

/**
 * Construye un objeto provider en formato OpenMAPS/CL.
 * Mapea al recurso Schedule de FHIR R4.
 *
 * @param {Object} params
 * @returns {Object} Objeto provider OpenMAPS/CL
 */
function construirPrestador({
  providerId,
  name,
  providerType,               // clinic | hospital | medical_center | independent_professional |
                              // dental | laboratory | imaging_center | rehabilitation
  rutProvider,                // Formato: XX.XXX.XXX-X
  acceptsFonasa = false,
  fonasaAccreditationLevel = null,   // "1", "2" o "3"
  libreEleccion = false,
  superintendenciaCode = null,
  address,
  commune,
  city,
  region = null,
  lat = null,
  lng = null,
  phone = null,               // Formato E.164: +56XXXXXXXXX
  email = null,
  website = null,
}) {
  const provider = {
    provider_id: providerId,
    name,
    provider_type: providerType,
    rut_provider: rutProvider,
    accepts_fonasa: acceptsFonasa,
    libre_eleccion: libreEleccion,
    location: { address, commune, city, country: "CL" },
  };

  if (region) provider.location.region = region;
  if (lat !== null) { provider.location.latitude = lat; provider.location.longitude = lng; }
  if (fonasaAccreditationLevel) provider.fonasa_accreditation_level = fonasaAccreditationLevel;
  if (superintendenciaCode) provider.superintendencia_code = superintendenciaCode;
  if (phone || email) {
    provider.contact = {};
    if (phone) provider.contact.phone = phone;
    if (email) provider.contact.email = email;
  }
  if (website) provider.website = website;

  return provider;
}

// ── Constructor de hora médica ────────────────────────────────────────────────

/**
 * Construye un objeto slot en formato OpenMAPS/CL.
 * Mapea al recurso Slot de FHIR R4.
 *
 * Nota: Los copagos NO se incluyen. El sistema consumidor los calcula
 * usando base_price y fonasa_accreditation_level con el arancel público de Fonasa.
 *
 * @param {Object} params
 * @returns {Object} Objeto slot OpenMAPS/CL
 */
function construirHora({
  slotId,                     // Identificador único y estable en el sistema del vendor
  providerId,
  sisCode,                    // Código SIS-MINSAL de la especialidad
  startDatetime,              // ISO 8601 con offset de zona horaria obligatorio
  durationMinutes = 30,
  professionalName = null,
  rutProfessional = null,
  modality = "in_person",     // in_person | telemedicine | home_visit
  acceptsFonasa = false,
  fonasaAccreditationLevel = null,
  insuranceAccepted = ["FONASA-B", "FONASA-C", "FONASA-D", "FONASA-LE", "ISAPRE", "PARTICULAR"],
  libreEleccion = false,
  isGes = false,
  gesProblemCode = null,
  basePrice = null,           // Precio particular en CLP
}) {
  const inicio = new Date(startDatetime);
  const termino = new Date(inicio.getTime() + durationMinutes * 60 * 1000);

  const ges = { is_ges: isGes };
  if (isGes && gesProblemCode) ges.ges_problem_code = gesProblemCode;

  const slot = {
    slot_id: slotId,
    provider_id: providerId,
    specialty: {
      sis_code: sisCode,
      sis_name: SIS_MINSAL[sisCode] || "",
    },
    start_datetime: inicio.toISOString(),
    end_datetime: termino.toISOString(),
    duration_minutes: durationMinutes,
    status: "available",
    modality,
    accepts_fonasa: acceptsFonasa,
    insurance_accepted: insuranceAccepted,
    libre_eleccion: libreEleccion,
    ges,
    currency: "CLP",
    _schema: "openmaps-cl/0.1",
  };

  if (professionalName) slot.professional_name = professionalName;
  if (rutProfessional) slot.rut_professional = rutProfessional;
  if (fonasaAccreditationLevel) slot.fonasa_accreditation_level = fonasaAccreditationLevel;
  if (basePrice !== null) slot.base_price = basePrice;

  return slot;
}

// ── Constructor del payload ────────────────────────────────────────────────────

/**
 * Construye el payload completo de disponibilidad en formato OpenMAPS/CL
 * listo para enviar al endpoint POST /openmaps-cl/v1/slots.
 *
 * @param {string} vendorId
 * @param {Object[]} prestadores
 * @param {Object[]} horas
 * @returns {Object} Payload OpenMAPS/CL completo
 */
function construirPayload(vendorId, prestadores, horas) {
  return {
    schema: "openmaps-cl/0.1",
    vendor_id: vendorId,
    generated_at: new Date().toISOString(),
    providers: prestadores,
    slots: horas,
  };
}

// ── Ejemplo de uso ────────────────────────────────────────────────────────────

const prestador = construirPrestador({
  providerId: "MIVDR-PROV-001",
  name: "Centro Médico Ejemplo",
  providerType: "medical_center",
  rutProvider: "76.543.210-1",
  acceptsFonasa: true,
  fonasaAccreditationLevel: "2",   // Obtenido del Registro Nacional de Prestadores
  libreEleccion: true,
  address: "Av. Providencia 1234",
  commune: "Providencia",
  city: "Santiago",
  region: "Región Metropolitana",
  lat: -33.4294,
  lng: -70.6148,
  phone: "+56223456789",
  email: "contacto@centromedico.cl",
  website: "https://centromedico.cl",
});

// Generar horas disponibles para los próximos 3 días
const horas = [];
const bloquesHorarios = [9, 10, 11, 15, 16];
const fechaBase = new Date("2026-03-21T09:00:00-03:00");

for (let dia = 0; dia < 3; dia++) {
  for (const hora of bloquesHorarios) {
    const inicio = new Date(fechaBase);
    inicio.setDate(inicio.getDate() + dia);
    inicio.setHours(hora, 0, 0, 0);

    horas.push(construirHora({
      slotId: `MIVDR-PROV001-DER-${inicio.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`,
      providerId: "MIVDR-PROV-001",
      sisCode: "10",                  // DERMATOLOGÍA
      startDatetime: inicio.toISOString(),
      durationMinutes: 30,
      professionalName: "Dra. María González",
      rutProfessional: "15.234.567-8",
      acceptsFonasa: true,
      fonasaAccreditationLevel: "2",
      libreEleccion: true,
      basePrice: 48000,               // Precio particular — el consumidor calcula copagos
    }));
  }
}

console.log(JSON.stringify(payload, null, 2));
console.log(`\n✓ ${horas.length} horas para 1 prestador generadas`);
console.log(`  Especialidad: ${SIS_MINSAL["10"]} (código 10)`);
console.log(`  Precio particular (base_price): $${(48000).toLocaleString("es-CL")} CLP`);
console.log(`  Nivel acreditación Fonasa LE: 2`);
console.log(`  El sistema consumidor determina los copagos por tramo`);
console.log(`  según el arancel público de Fonasa.`);

// Exportar para uso como módulo
module.exports = {
  construirPrestador,
  construirHora,
  construirPayload,
  SIS_MINSAL,
};
