"""
OpenMAPS/CL — Ejemplo de implementación en Python
===================================================
Demuestra cómo un software de agenda médica publica
disponibilidad de horas mediante el estándar OpenMAPS/CL.

Autor: Bernardo Cajales Millón
Licencia: MIT
Estándar: https://github.com/bcajales/openmaps-standard
"""

import json
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Optional


# ── Códigos de especialidad SIS-MINSAL ────────────────────────────────────────

SIS_MINSAL = {
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
}



# ── Clases de datos ────────────────────────────────────────────────────────────

@dataclass
class Ubicacion:
    address: str
    commune: str
    city: str
    country: str = "CL"
    region: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@dataclass
class Prestador:
    """
    Prestador de salud en formato OpenMAPS/CL.
    Mapea al recurso Schedule de FHIR R4.
    """
    provider_id: str
    name: str
    provider_type: str      # clinic | hospital | medical_center | independent_professional |
                            # dental | laboratory | imaging_center | rehabilitation
    rut_provider: str       # Formato: XX.XXX.XXX-X
    ubicacion: Ubicacion
    accepts_fonasa: bool = False
    fonasa_accreditation_level: Optional[str] = None   # "1", "2" o "3"
    libre_eleccion: bool = False
    superintendencia_code: Optional[str] = None
    phone: Optional[str] = None     # Formato E.164: +56XXXXXXXXX
    email: Optional[str] = None
    website: Optional[str] = None

    def to_dict(self) -> dict:
        """Serializa el prestador al formato OpenMAPS/CL."""
        d = {
            "provider_id": self.provider_id,
            "name": self.name,
            "provider_type": self.provider_type,
            "rut_provider": self.rut_provider,
            "accepts_fonasa": self.accepts_fonasa,
            "libre_eleccion": self.libre_eleccion,
            "location": {
                "address": self.ubicacion.address,
                "commune": self.ubicacion.commune,
                "city": self.ubicacion.city,
                "country": self.ubicacion.country,
            },
        }
        if self.ubicacion.region:
            d["location"]["region"] = self.ubicacion.region
        if self.ubicacion.latitude is not None:
            d["location"]["latitude"] = self.ubicacion.latitude
            d["location"]["longitude"] = self.ubicacion.longitude
        if self.fonasa_accreditation_level:
            d["fonasa_accreditation_level"] = self.fonasa_accreditation_level
        if self.superintendencia_code:
            d["superintendencia_code"] = self.superintendencia_code
        if self.phone or self.email:
            d["contact"] = {}
            if self.phone:
                d["contact"]["phone"] = self.phone
            if self.email:
                d["contact"]["email"] = self.email
        if self.website:
            d["website"] = self.website
        return d


@dataclass
class Hora:
    """
    Hora médica disponible en formato OpenMAPS/CL.
    Mapea al recurso Slot de FHIR R4.

    Nota: Los copagos NO se incluyen aquí.
    El sistema consumidor los calcula con base_price y fonasa_accreditation_level.
    """
    slot_id: str                    # Identificador único y estable en el sistema del vendor
    provider_id: str
    sis_code: str                   # Código SIS-MINSAL de la especialidad
    start_datetime: datetime        # Con información de zona horaria obligatoria
    duration_minutes: int = 30
    professional_name: Optional[str] = None
    rut_professional: Optional[str] = None
    modality: str = "in_person"     # in_person | telemedicine | home_visit
    accepts_fonasa: bool = False
    fonasa_accreditation_level: Optional[str] = None
    insurance_accepted: list = field(default_factory=lambda: [
        "FONASA-B", "FONASA-C", "FONASA-D", "FONASA-LE", "ISAPRE", "PARTICULAR"
    ])
    libre_eleccion: bool = False
    is_ges: bool = False
    ges_problem_code: Optional[str] = None
    base_price: Optional[float] = None   # Precio particular en CLP

    @property
    def end_datetime(self) -> datetime:
        return self.start_datetime + timedelta(minutes=self.duration_minutes)

    def to_dict(self) -> dict:
        """Serializa la hora al formato OpenMAPS/CL."""
        ges = {"is_ges": self.is_ges}
        if self.is_ges and self.ges_problem_code:
            ges["ges_problem_code"] = self.ges_problem_code

        d = {
            "slot_id": self.slot_id,
            "provider_id": self.provider_id,
            "specialty": {
                "sis_code": self.sis_code,
                "sis_name": SIS_MINSAL.get(self.sis_code, ""),
            },
            "start_datetime": self.start_datetime.isoformat(),
            "end_datetime": self.end_datetime.isoformat(),
            "duration_minutes": self.duration_minutes,
            "status": "available",
            "modality": self.modality,
            "accepts_fonasa": self.accepts_fonasa,
            "insurance_accepted": self.insurance_accepted,
            "libre_eleccion": self.libre_eleccion,
            "ges": ges,
            "currency": "CLP",
            "_schema": "openmaps-cl/0.1",
        }
        if self.professional_name:
            d["professional_name"] = self.professional_name
        if self.rut_professional:
            d["rut_professional"] = self.rut_professional
        if self.fonasa_accreditation_level:
            d["fonasa_accreditation_level"] = self.fonasa_accreditation_level
        if self.base_price is not None:
            d["base_price"] = self.base_price
        return d


# ── Constructor del payload ────────────────────────────────────────────────────

def construir_payload(vendor_id: str, prestadores: list, horas: list) -> dict:
    """
    Construye el payload completo de disponibilidad en formato OpenMAPS/CL
    listo para enviar al endpoint POST /openmaps-cl/v1/slots.
    """
    return {
        "schema": "openmaps-cl/0.1",
        "vendor_id": vendor_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "providers": [p.to_dict() for p in prestadores],
        "slots": [h.to_dict() for h in horas],
    }


# ── Ejemplo de uso ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Zona horaria de Chile (horario estándar). En verano (oct–mar) usar timedelta(hours=-4).
    CHILE_TZ = timezone(timedelta(hours=-3))

    # Definir un prestador
    prestador = Prestador(
        provider_id="MIVDR-PROV-001",
        name="Centro Médico Ejemplo",
        provider_type="medical_center",
        rut_provider="76.543.210-1",
        accepts_fonasa=True,
        fonasa_accreditation_level="2",  # Obtenido del Registro Nacional de Prestadores
        libre_eleccion=True,
        phone="+56223456789",
        email="contacto@centromedico.cl",
        website="https://centromedico.cl",
        ubicacion=Ubicacion(
            address="Av. Providencia 1234",
            commune="Providencia",
            city="Santiago",
            region="Región Metropolitana",
            latitude=-33.4294,
            longitude=-70.6148,
        )
    )

    # Generar horas disponibles para los próximos 3 días
    horas = []
    fecha_base = datetime(2026, 3, 21, tzinfo=CHILE_TZ)
    bloques_horarios = [9, 10, 11, 15, 16]

    for dia in range(3):
        for hora in bloques_horarios:
            inicio = (fecha_base + timedelta(days=dia)).replace(
                hour=hora,
                minute=0,
                second=0,
                microsecond=0,
            )
            hora_medica = Hora(
                slot_id=f"MIVDR-PROV-001-DER-{inicio.strftime('%Y%m%d%H%M')}",
                provider_id="MIVDR-PROV-001",
                sis_code="10",          # DERMATOLOGÍA
                professional_name="Dra. María González",
                rut_professional="15.234.567-8",
                start_datetime=inicio,
                duration_minutes=30,
                accepts_fonasa=True,
                fonasa_accreditation_level="2",
                libre_eleccion=True,
                base_price=48000,       # Precio particular — el consumidor calcula copagos
            )
            horas.append(hora_medica)

    # Construir y mostrar el payload
    payload = construir_payload(
        vendor_id="mi-software-de-agenda",
        prestadores=[prestador],
        horas=horas,
    )

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\n✓ {len(horas)} horas para 1 prestador generadas")
    print(f"  Especialidad: {SIS_MINSAL[horas[0].sis_code]} (código {horas[0].sis_code})")
    print(f"  Precio particular (base_price): ${horas[0].base_price:,.0f} CLP")
    print(f"  Nivel acreditación Fonasa LE: {horas[0].fonasa_accreditation_level}")
    print(f"  El sistema consumidor determina los copagos por tramo")
    print(f"  según el arancel público de Fonasa.")
