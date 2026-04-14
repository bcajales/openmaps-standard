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
  "06": "CIRUGÍA PEDIÁTRICA",
  "07": "CIRUGÍA PLÁSTICA Y REPARADORA",
  "08": "CIRUGÍA TORÁCICA",
  "09": "CIRUGÍA VASCULAR PERIFÉRICA",
  "10": "DERMATOLOGÍA",
  "11": "ENDOCRINOLOGÍA",
  "12": "ENFERMEDADES RESPIRATORIAS",
  "13": "GASTROENTEROLOGÍA",
  "14": "GENÉTICA CLÍNICA",
  "15": "GERIATRÍA",
  "16": "GINECOLOGÍA",
  "17": "HEMATOLOGÍA",
  "18": "INFECTOLOGÍA",
  "19": "INMUNOLOGÍA",
  "20": "MEDICINA FÍSICA Y REHABILITACIÓN",
  "21": "MEDICINA INTERNA",
  "22": "MEDICINA NUCLEAR",
  "23": "NEFROLOGÍA",
  "24": "NEONATOLOGÍA",
  "25": "NEUROCIRUGÍA",
  "26": "NEUROLOGÍA",
  "27": "NUTRIOLOGÍA",
  "28": "OBSTETRICIA",
  "29": "OFTALMOLOGÍA",
  "30": "ONCOLOGÍA MÉDICA",
  "31": "ORTOPEDIA Y TRAUMATOLOGÍA",
  "32": "OTORRINOLARINGOLOGÍA",
  "33": "PEDIATRÍA",
  "34": "PSIQUIATRÍA",
  "35": "RADIOLOGÍA",
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
  if (lat !== null && lng !== null) { provider.location.latitude = lat; provider.location.longitude = lng; }
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

// ── Utilidad de fechas ───────────────────────────────────────────────────────

/**
 * Suma minutos a un string ISO 8601 preservando el offset de zona horaria original.
 * Evita Date.toISOString() que siempre convierte a UTC (sufijo Z).
 *
 * @param {string} isoString — Fecha ISO 8601 con offset (ej. "2026-03-21T10:00:00-03:00")
 * @param {number} minutes — Minutos a sumar
 * @returns {string} Fecha ISO 8601 con el mismo offset
 */
function addMinutesToISO(isoString, minutes) {
  const offsetMatch = isoString.match(/([+-]\d{2}:\d{2})$/);
  const offset = offsetMatch ? offsetMatch[1] : "+00:00";
  const date = new Date(isoString);
  const result = new Date(date.getTime() + minutes * 60 * 1000);
  const offsetSign = offset[0] === "+" ? 1 : -1;
  const offsetH = parseInt(offset.slice(1, 3), 10);
  const offsetM = parseInt(offset.slice(4, 6), 10);
  const offsetMs = offsetSign * (offsetH * 60 + offsetM) * 60 * 1000;
  const local = new Date(result.getTime() + offsetMs);
  const pad = (n) => String(n).padStart(2, "0");
  const y = local.getUTCFullYear();
  const mo = pad(local.getUTCMonth() + 1);
  const d = pad(local.getUTCDate());
  const h = pad(local.getUTCHours());
  const mi = pad(local.getUTCMinutes());
  const s = pad(local.getUTCSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
}

// ── Constructor de hora médica ────────────────────────────────────────────────

/**
 * Construye un objeto slot en formato OpenMAPS/CL.
 * Mapea al recurso Slot de FHIR R4.
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
  const endDatetime = addMinutesToISO(startDatetime, durationMinutes);

  const ges = { is_ges: isGes };
  if (isGes && gesProblemCode) ges.ges_problem_code = gesProblemCode;

  const slot = {
    slot_id: slotId,
    provider_id: providerId,
    specialty: {
      sis_code: sisCode,
      sis_name: SIS_MINSAL[sisCode] || "",
    },
    start_datetime: startDatetime,
    end_datetime: endDatetime,
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

// ── Exportar para uso como módulo ─────────────────────────────────────────────

module.exports = {
  construirPrestador,
  construirHora,
  construirPayload,
  addMinutesToISO,
  SIS_MINSAL,
};

// ── Ejemplo de uso ────────────────────────────────────────────────────────────

if (require.main === module) {
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
  // Se construyen los strings ISO 8601 directamente con offset de Chile (-03:00)
  // para evitar que setHours() opere en la zona horaria local del servidor.
  const horas = [];
  const bloquesHorarios = [9, 10, 11, 15, 16];
  const CHILE_OFFSET = "-03:00"; // Horario de verano de Chile (sep–abr). En invierno (abr–sep) usar "-04:00".
  const fechaBase = new Date(Date.UTC(2026, 2, 21)); // 2026-03-21, solo para aritmética de fechas

  for (let dia = 0; dia < 3; dia++) {
    for (const hora of bloquesHorarios) {
      const d = new Date(fechaBase);
      d.setUTCDate(d.getUTCDate() + dia);
      const year  = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day   = String(d.getUTCDate()).padStart(2, "0");
      const hh    = String(hora).padStart(2, "0");
      const startDatetime = `${year}-${month}-${day}T${hh}:00:00${CHILE_OFFSET}`;
      const slotId = `MIVDR-PROV-001-DER-${year}${month}${day}${hh}00`;

      horas.push(construirHora({
        slotId,
        providerId: "MIVDR-PROV-001",
        sisCode: "10",                  // DERMATOLOGÍA
        startDatetime,
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

  const payload = construirPayload("mi-software-de-agenda", [prestador], horas);

  console.log(JSON.stringify(payload, null, 2));
  console.log(`\n✓ ${horas.length} horas para 1 prestador generadas`);
  console.log(`  Especialidad: ${SIS_MINSAL["10"]} (código 10)`);
  console.log(`  Precio particular (base_price): $${(48000).toLocaleString("es-CL")} CLP`);
  console.log(`  Nivel acreditación Fonasa LE: 2`);
  console.log(`  El sistema consumidor determina los copagos por tramo`);
  console.log(`  según el arancel público de Fonasa.`);
}
