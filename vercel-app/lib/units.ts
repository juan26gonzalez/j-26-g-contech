import { BudgetItem, ConsolidatedRow, ProjectConfig } from "./types";

export type AppLang = "es" | "en";
export type CurrencyCode = "COP" | "USD" | "EUR";
export type UnitSystem = "metric" | "imperial";

export function getUnitSystem(lang: AppLang): UnitSystem {
  return lang === "en" ? "imperial" : "metric";
}

function normalizeUnitKey(unit: string | undefined | null): string {
  return String(unit || "und")
    .trim()
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/³/g, "3");
}

export function unitConversionFactor(metricUnit: string | undefined | null): number {
  const u = normalizeUnitKey(metricUnit);
  if (u === "m2" || u === "m2." || u === "m^2" || u.startsWith("m2/")) return 10.7639104;
  if (u === "m3" || u === "m3." || u === "m^3" || u.startsWith("m3/")) return 1.3079506;
  if (u === "ml" || u === "m" || u === "m.l." || u.startsWith("ml/") || u.startsWith("m/")) {
    return 3.2808399;
  }
  if (u === "kg" || u === "kgs" || u.startsWith("kg/")) return 2.2046226;
  if (u === "l" || u === "lt" || u === "lts" || u === "litro" || u === "litros") return 0.264172;
  return 1;
}

export function convertQty(qtyMetric: number, metricUnit: string | undefined | null, lang: AppLang): number {
  const n = Number(qtyMetric || 0);
  if (lang === "es") return n;
  return n * unitConversionFactor(metricUnit);
}

export function convertUnitLabel(metricUnit: string | undefined | null, lang: AppLang): string {
  const raw = String(metricUnit || "und").trim();
  if (lang === "es") {
    return raw || "und";
  }
  const u = normalizeUnitKey(raw);
  if (u === "m2" || u === "m2." || u === "m^2") return "ft²";
  if (u === "m3" || u === "m3." || u === "m^3") return "yd³";
  if (u === "ml" || u === "m" || u === "m.l.") return "ft";
  if (u === "kg" || u === "kgs") return "lb";
  if (u === "und" || u === "u" || u === "un" || u === "pieza" || u === "pza" || u === "unidades") return "ea";
  if (u === "gl" || u === "glb" || u === "global") return "LS";
  if (u.includes("saco")) return "bags (110 lb)";
  if (u.includes("bulto")) return "bags (55 lb)";
  if (u.includes("cuñete") || u.includes("cunete")) return "5-gal pails";
  if (u.includes("lámina") || u.includes("lamina")) return "4'×8' sheets";
  if (u.includes("rollo")) return "rolls";
  if (u === "gal" || u === "galon" || u === "galones" || u === "g") return "gal";
  if (u === "l" || u === "lt" || u === "lts" || u === "litro" || u === "litros") return "gal";
  if (u === "m2/dia" || u === "m2/día") return "ft²/day";
  if (u === "m3/dia" || u === "m3/día") return "yd³/day";
  if (u === "ml/dia" || u === "ml/día" || u === "m/dia" || u === "m/día") return "ft/day";
  if (u === "kg/dia" || u === "kg/día") return "lb/day";
  if (u === "unidades/dia" || u === "unidades/día" || u === "und/dia" || u === "und/día") return "ea/day";
  return raw;
}

export function convertRateValue(metricValue: number, metricRateUnit: string | undefined | null, lang: AppLang): number {
  const n = Number(metricValue || 0);
  if (lang === "es") return n;
  return n * unitConversionFactor(metricRateUnit);
}

export function convertUnitPriceCopToDisplay(
  priceCopPerMetricUnit: number,
  metricUnit: string | undefined | null,
  currency: CurrencyCode,
  rates: Record<CurrencyCode, number>,
  lang: AppLang
): number {
  const fx = rates[currency] || 1;
  const priceInCurr = Number(priceCopPerMetricUnit || 0) / fx;
  if (lang === "es") return priceInCurr;
  return priceInCurr / unitConversionFactor(metricUnit);
}

const CHAPTER_EN_MAP: Array<[RegExp, string]> = [
  [/^1\.\s*ESTRUCTURA\s*(&|Y)\s*CIMENTACI[ÓO]N$/i, "1. STRUCTURE & FOUNDATIONS"],
  [/^2\.\s*MAMPOSTER[ÍI]A\s*(&|Y)\s*PAÑETES$/i, "2. MASONRY & PLASTERING"],
  [/^1\.\s*MAMPOSTER[ÍI]A$/i, "1. MASONRY & BLOCKWORK"],
  [/^2\.\s*PISOS\s*(&|Y)\s*ENCHAPES$/i, "2. FLOORING & TILING"],
  [/^3\.\s*PISOS\s*(&|Y)\s*ENCHAPES$/i, "3. FLOORING & TILING"],
  [/^3\.\s*CIELOS\s*RASOS\s*(&|Y)\s*FRESCASA$/i, "3. CEILINGS & INSULATION"],
  [/^3\.\s*CIELOS\s*RASOS$/i, "3. CEILINGS & ACOUSTICS"],
  [/^4\.\s*CIELOS\s*RASOS\s*(&|Y)\s*FRESCASA$/i, "4. CEILINGS & INSULATION"],
  [/^4\.\s*ACABADOS\s*(&|Y)\s*PINTURA$/i, "4. FINISHES & PAINTING"],
  [/^5\.\s*CARPINTER[ÍI]A\s*(&|Y)\s*PINTURA$/i, "5. PAINTING & FINISHING"],
  [/^5\.\s*CARPINTER[ÍI]A$/i, "5. DOORS & ALUMINUM GLAZING"],
  [/^6\.\s*CUBIERTA$/i, "6. ROOFING & ENVELOPE"],
  [/^1\.\s*PRELIMINARES$/i, "1. SITE PRELIMINARIES"],
  [/^2\.\s*EXCAVACIONES$/i, "2. EARTHWORK & EXCAVATION"],
  [/^3\.\s*CIMENTACI[ÓO]N$/i, "3. FOUNDATIONS & SLABS"],
  [/^4\.\s*ACERO\s*DE\s*REFUERZO$/i, "4. REINFORCING STEEL (REBAR)"],
  [/^5\.\s*ACERO\s*ESTRUCTURAL$/i, "5. STRUCTURAL STEEL"],
  [/^6\.\s*MAMPOSTER[ÍI]A$/i, "6. MASONRY & BLOCKWORK"],
  [/^7\.\s*LIMPIEZA$/i, "7. FINAL CLEANING & HANDOVER"],
  [/^FASE\s*1\s*[—-]\s*ESTRUCTURA\s*&\s*MAMPOSTER[ÍI]A$/i, "PHASE 1 — STRUCTURE & MASONRY"],
  [/^FASE\s*2\s*[—-]\s*ENVOLVENTE,\s*PISOS\s*&\s*CIELO\s*RASO$/i, "PHASE 2 — ENVELOPE, FLOORING & CEILING"],
  [/^FASE\s*3\s*[—-]\s*ACABADOS\s*ARQUITECT[ÓO]NICOS\s*&\s*ENTREGA$/i, "PHASE 3 — ARCHITECTURAL FINISHES & HANDOVER"],
];

const EXACT_PHRASE_EN: Record<string, string> = {
  "Concreto en zapatas y vigas de cimentación f'c=21 MPa": "Spread footings & grade beams concrete f'c=3,000 PSI",
  "Concreto en columnas y pórtico estructural f'c=24 MPa": "Structural frame columns & tie beams concrete f'c=3,500 PSI",
  "Muros en mampostería de bloques de concreto No. 12": "Concrete masonry unit (CMU No. 12) interior & facade walls",
  "Muros en mampostería de bloques de concreto No. 12 (227.89 m²)": "Concrete masonry unit (CMU No. 12) walls",
  "Pañete y mortero de revoco en muros dos caras": "Cement stucco plaster & screeding on walls (two sides)",
  "Pañete y mortero de revoco en muros (dos caras)": "Cement stucco plaster & screeding on walls (two sides)",
  "Instalación de piso en porcelanato 51x51 cm y plantilla": "20\"×20\" Porcelain tile flooring & 2.75\" leveling sub-slab",
  "Instalación de piso en porcelanato 51×51 cm y plantilla": "20\"×20\" Porcelain tile flooring & 2.75\" leveling sub-slab",
  "Plantilla de concreto e=7cm (base y solado de piso)": "Concrete floor leveling slab (t=2.75\") & mud slab",
  "Instalación de piso en porcelanato 51x51 cm y enchape": "20\"×20\" Porcelain tile flooring & wall cladding",
  "Instalación de piso en porcelanato 51×51 cm y enchape": "20\"×20\" Porcelain tile flooring & wall cladding",
  "Porcelanato 51×51": "20\"×20\" Porcelain Floor Tile",
  "Cielo raso suspendido Drywall + Aislamiento Frescasa Eco 2-1/2\"": "Suspended drywall ceiling + Frescasa Eco 2-1/2\" thermal insulation",
  "Instalación de cielo raso suspendido e=5.3cm": "Suspended drywall ceiling installation (t=2.1\")",
  "Suministro e instalación de aislamiento termoacústico Frescasa Eco 2-1/2\" sobre cielo raso (todas las zonas)": "Frescasa Eco 2-1/2\" thermal-acoustic fiberglass insulation over ceiling",
  "Estuco plástico y pintura vinílica arquitectónica en muros": "Skim coat putty & Grade-1 architectural latex paint on walls",
  "Estuco plástico y pintura vinílica en muros": "Skim coat putty & Grade-1 architectural latex paint on walls",
  "Montaje de cubierta termoacústica en teja Eternit": "Thermo-acoustic corrugated fiber-cement roof & ridge installation",
  "Montaje de cubierta en teja ondulada Eternit y caballetes": "Corrugated fiber-cement roofing & ridge cap assembly",
  "Suministro e instalación de puertas interiores y acceso (7 und)": "Supply & installation of interior & entry doors (7 ea)",
  "Suministro e instalación de ventanería en aluminio y vidrio (8 und)": "Supply & installation of aluminum & glass windows (8 ea)",
  "Suministro e instalación de ventanería y puertas en aluminio": "Aluminum curtain-wall glazing, windows & entry doors assembly",
  "Suministro e instalación de ventanas y accesos": "Aluminum glazing curtain-wall & entry doors assembly",
  "Ventanería aluminio termoacústica y puertas interiores": "Thermo-acoustic aluminum windows & interior doors",
  "Ventanería aluminio y puertas acústicas": "Thermo-acoustic aluminum windows & acoustic doors",
  "Montaje de cubierta termoacústica Eternit y caballetes": "Thermo-acoustic fiber-cement roofing & ridge cap assembly",
  "Montaje de cubierta termoacústica / Eternit": "Thermo-acoustic fiber-cement roof assembly",
  "Porcelanato 51x51": "20\"×20\" Porcelain Floor Tile",
  "Cielo Raso + Frescasa Eco": "Suspended Ceiling + Frescasa Eco 2-1/2\"",
  "Cielo raso": "Suspended Drywall Ceiling",
  "Plantilla de concreto 7cm": "Concrete Floor Screed (t=2.75\")",
  "Enchape piso porcelanato 51x51": "20\"×20\" Porcelain Floor Tile",
  "Enchape piso porcelanato baño 51x51": "Bathroom 20\"×20\" Porcelain Floor Tile",
  "Enchape piso porcelanato cocina 51x51": "Kitchen 20\"×20\" Porcelain Floor Tile",
  "Frescasa Eco 2-1/2\" (sobre cielo raso)": "Frescasa Eco 2-1/2\" Fiberglass Insulation (above ceiling)",
  "Zapatas y vigas de cimentación f'c=21 MPa": "Spread footings & grade beams f'c=3,000 PSI",
  "Columnas y pórtico estructural f'c=24 MPa": "Structural columns & perimeter tie beams f'c=3,500 PSI",
  "Muros en mampostería bloque No. 12": "CMU No. 12 masonry infill & partition walls",
  "Pañete y mortero de revoco dos caras": "Cement stucco plaster & screeding (two sides)",
  "Montaje de cubierta termoacústica Eternit": "Corrugated thermo-acoustic roof assembly",
  "Plantilla de concreto e=7cm + piso porcelanato": "2.75\" sub-slab concrete & 20\"×20\" porcelain tile flooring",
  "Cielo raso suspendido + aislamiento Frescasa 2-1/2\"": "Suspended ceiling + Frescasa 2-1/2\" acoustic insulation",
  "Estuco plástico y pintura arquitectónica": "Skim coat putty & Grade-1 architectural paint",
  "Ventanería en aluminio y puertas de acceso": "Aluminum glazing & architectural entry doors",
  "Nivel 1 - Corporativo": "Level 1 - Corporate",
  "Nivel 1 - Acceso & Corporativo": "Level 1 - Lobby & Corporate",
  "Cubierta y Envolvente": "Roof & Building Envelope",
  "Cubierta & Cielo Raso": "Roof & Suspended Ceiling",
  "Cimentación": "Foundations",
  "Completado": "Completed",
  "En Curso": "In Progress",
  "Sin Iniciar": "Not Started",
  "En Meta": "On Target",
  "Excedido": "Overrun",
  "Ahorro": "Under Budget",
  "Alto Rendimiento": "High Efficiency",
  "En Rango APU": "Within APU Range",
  "Meta Cumplida": "On Target",
  "Rendimiento Bajo": "Below Target",
  "Estándar": "Standard",
  "A Tiempo": "On Schedule",
  "Con Atraso": "Delayed",
  "Sin Avance": "Not Started",
  "Crítico": "Critical",
  "Saludable": "Healthy",
  "Precaución": "Watch",
  "En riesgo": "At Risk",
  "Frente Estructura & Cimentación": "Structure & Foundations Crew",
  "Frente Envolvente, Pisos & Cubierta": "Envelope, Flooring & Roofing Crew",
  "Frente Acabados & Carpintería": "Finishes & Glazing Crew",
  "Operativo / Cuadrilla": "Field Crew / Inspector",
  "Ingeniero Residente • JGM ConTech": "Resident Project Engineer • JGM ConTech",
  "Director de Proyecto / Gerencia BIM": "Project Director / BIM Lead",
  "Representante del Contratante": "Owner's Representative",
};

const MATERIAL_EN_MAP: Array<[RegExp, string]> = [
  [/Bloques?\s+de\s+Concreto\s*(?:No\.?|#)\s*12.*/i, "Concrete Masonry Units (CMU No. 12 — 16\"×8\"×5\")"],
  [/Rollo\s+Frescasa\s+Eco\s+2-1\/2".*/i, "Frescasa Eco 2-1/2\" Fiberglass Roll (25'×48\" = 100.1 ft², +5% waste)"],
  [/Aislamiento\s+Fibra\s+de\s+Vidrio\s+Frescasa\s+Eco.*/i, "Frescasa Eco Fiberglass Thermal Insulation (Area incl. 5% waste)"],
  [/Colchoneta\s+Fibra\s+de\s+Vidrio\s+Frescasa\s+Eco.*/i, "Frescasa Eco 2-1/2\" Fiberglass Insulation Batts"],
  [/Cemento\s+Gris\s+para\s+Pañete.*/i, "Gray Portland Cement for Stucco Plaster (110 lb Bags)"],
  [/Cemento\s+Gris\s+para\s+Pega.*/i, "Gray Portland Cement for Masonry Mortar (110 lb Bags)"],
  [/Cemento\s+Gris\s+para\s+Plantilla.*/i, "Gray Portland Cement for Floor Screed (110 lb Bags)"],
  [/Cemento\s+Gris\s+Base\s+Piso.*/i, "Gray Portland Cement for Sub-Slab Screed (110 lb Bags)"],
  [/Cemento\s+Gris\s+Tipo\s+UG.*/i, "Structural Portland Cement Type I/GU (110 lb Bags)"],
  [/Cemento\s+Estructural.*/i, "Structural Portland Cement (110 lb Bag Equiv.)"],
  [/Cemento\s+Portland\s+Tipo\s+I.*/i, "Portland Cement Type I"],
  [/Arena\s+Lavada\s+para\s+Pañete/i, "Washed River Sand for Stucco Plaster"],
  [/Arena\s+Fina\s+para\s+Mortero\s+de\s+Pega/i, "Fine Washed Masonry Mortar Sand"],
  [/Arena\s+Lavada\s+de\s+R[íi]o/i, "Washed Coarse Concrete Sand"],
  [/Arena\s+de\s+Pañete\s*\/\s*Pegante/i, "Plaster & Masonry Mortar Sand"],
  [/Gravilla\s+Triturada\s+3\/4.*/i, "3/4\" Crushed Coarse Aggregate / Gravel"],
  [/Triturado\s*\/\s*Grava\s+de\s+3\/4"?/i, "3/4\" Crushed Coarse Aggregate / Gravel"],
  [/Agua\s+de\s+Mezcla/i, "Mixing Water"],
  [/Porcelanato\s*\/\s*(?:Baldosa\s+)?Cer[áa]mica?.*/i, "20\"×20\" Porcelain / Ceramic Floor Tile (+5% waste)"],
  [/Cer[áa]mica\s*\/\s*Porcelanato\s+de\s+Pared.*/i, "Wall Ceramic / Porcelain Tile (+8% cut waste)"],
  [/Porcelanato\s+Tr[áa]fico\s+5\s*\+\s*Mortero\s+Pega/i, "PEI-5 Porcelain Tile + Polymer Thin-Set Mortar"],
  [/Pegacor\s+Cer[áa]mico.*/i, "Polymer-Modified Tile Adhesive Mortar (55 lb Bags)"],
  [/Pegacor\s+Blanco\s*\/\s*Cer[áa]mico\s+Pared.*/i, "White Wall Tile Adhesive Mortar (55 lb Bags)"],
  [/Pegante\s+Blanco\s+Especializado.*/i, "White Polymer Tile Adhesive Mortar (55 lb Bags)"],
  [/Boquilla\s+Antimoho\s+para\s+Muro/i, "Mildew-Resistant Wall Tile Grout"],
  [/Boquilla\s+para\s+Junta/i, "Polymer Tile Joint Grout"],
  [/Panel\s+de\s+Cielorraso\s+Suspendido.*/i, "Suspended Drywall Ceiling Board (+5% waste)"],
  [/Panel\s+Yeso\/Fibrocemento\s*\+\s*Perfiler[íi]a\s+Galv\./i, "Gypsum / Fiber-Cement Board + Galv. Stud Framing"],
  [/L[áa]mina\s+Drywall\s*\/\s*PVC.*/i, "Drywall / PVC Ceiling Board (4'×8' Sheets)"],
  [/Perfiler[íi]a\s+(?:Angular\s+y\s+Perfiles\s+Omega|Galvanizada.*)/i, "Galvanized Ceiling Framing (Perimeter Angle & Furring Channels)"],
  [/Estuco\s+Pl[áa]stico\s+Blanco.*/i, "White Acrylic Skim Coat Putty (62 lb Pails)"],
  [/Estuco\s+Pl[áa]stico\s+Listo.*/i, "Ready-Mix Acrylic Skim Coat Putty (5-Gal Pails)"],
  [/Estuco\s+Pl[áa]stico\s*\+\s*Pintura\s+Vin[íi]lica\s+Tipo\s+1/i, "Interior Skim Coat + Grade-1 Architectural Latex Paint"],
  [/Pintura\s+Vin[íi]l(?:o|ica)\s+Tipo\s+1\s*\(Cuñetes.*/i, "Grade-1 Architectural Latex Paint (5-Gal Pails)"],
  [/Pintura\s+Vin[íi]l(?:o|ica)\s+Tipo\s+1.*/i, "Grade-1 Architectural Latex Paint (Gallons)"],
  [/Teja\s+Ondulada\s+Eternit.*/i, "Corrugated Fiber-Cement Roofing Panels (+10% lap & waste)"],
  [/Caballete\s+Articulado\s+Cubierta\s+Eternit/i, "Fiber-Cement Roof Ridge Caps & Flashing"],
  [/Ganchos\s+de\s+Fijaci[óo]n\s+con\s+Golilla/i, "Galvanized J-Hook Roof Fasteners w/ EPDM Washer"],
  [/Puertas?\s+Entamboradas?\s+con\s+Marco\s+y\s+Cerradura/i, "Flush Architectural Interior & Entry Doors w/ Frame & Lockset"],
  [/Puertas?\s+Entamboradas?\s*\+\s*Marco\s*\+\s*Cerradura/i, "Solid-Core Architectural Doors + Frames + Locksets"],
  [/Ventan(?:as|er[íi]a)\s+(?:de\s+|en\s+)?Aluminio\s*(?:y|\+)\s*Vidrio.*/i, "Thermo-Acoustic Extruded Aluminum Windows + Insulated Glass"],
  [/Concreto\s+Simple\s+f'c=14\s+MPa.*/i, "Plain Leveling Concrete f'c=2,000 PSI (2.75\" Screed)"],
  [/Concreto\s+Premezclado\s*\/\s*Obra\s+3000-3500\s+PSI/i, "Ready-Mix / Site Structural Concrete (3,000–3,500 PSI)"],
  [/Concreto\s+Premezclado\s+f'c\s*=\s*21-28\s+MPa.*/i, "Ready-Mix Structural Concrete (3,000–4,000 PSI)"],
  [/Concreto\s+Mezclado\s+en\s+Obra\s+f'c\s*=\s*21\s+MPa.*/i, "Site-Mixed Concrete f'c = 3,000 PSI"],
  [/Acero\s+(?:Corrugado\s+60\s+KSI|de\s+Refuerzo\s+PDR-60|Estructural\s*\/\s*Corrugado).*/i, "Grade 60 Deformed Reinforcing Steel (Rebar)"],
  [/Alambre\s+Negro\s+#18\s+para\s+Amarre/i, "18-Gauge Black Annealed Rebar Tie Wire"],
  [/Aglomerado\s*\/\s*Carpinter[íi]a\s*\+\s*Herrajes/i, "Architectural Millwork & Hardware"],
  [/Insumos\s+Especializados\s+seg[úu]n\s+APU\s+del\s+[íi]tem/i, "Specialized APU Consumables & Fasteners"],
];

const CREW_SPECIALTY_EN: Array<[RegExp, string]> = [
  [/Cuadrilla\s+Carpinter[íi]a\s*&\s*Aluminio/i, "Glazing & Doors Crew"],
  [/Cuadrilla\s+Estructura/i, "Structural Concrete Crew"],
  [/Cuadrilla\s+Mamposter[íi]a/i, "Masonry Crew"],
  [/Cuadrilla\s+Pañete/i, "Plastering Crew"],
  [/Cuadrilla\s+Obra\s+Gris/i, "Slab & Screed Crew"],
  [/Cuadrilla\s+Enchape/i, "Tiling Crew"],
  [/Cuadrilla\s+Pintura/i, "Painting Crew"],
  [/Cuadrilla\s+Estuco/i, "Skim Coat & Painting Crew"],
  [/Cuadrilla\s+Aislamiento/i, "Thermal Insulation Crew"],
  [/Cuadrilla\s+Liviana/i, "Drywall Ceiling Crew"],
  [/Cuadrilla\s+Met[áa]lica/i, "Roofing & Steel Crew"],
  [/Cuadrilla\s+Carpinter[íi]a/i, "Millwork & Doors Crew"],
  [/Cuadrilla\s+Aluminio/i, "Aluminum Glazing Crew"],
  [/Cuadrilla\s+Hidrosanitaria/i, "Plumbing Crew"],
  [/Cuadrilla\s+Armadores/i, "Rebar Ironworkers Crew"],
  [/Cuadrilla\s+Preliminares/i, "Site Prep Crew"],
  [/Cuadrilla\s+Excavaci[óo]n/i, "Excavation Crew"],
  [/Cuadrilla\s+Acabados/i, "Finishes Crew"],
  [/Cuadrilla\s+General/i, "General Trade Crew"],
  [/Cuadrilla\s+Est[áa]ndar/i, "Standard Field Crew"],
  [/Cuadrilla\s+1/i, "Masonry Crew 1"],
  [/Cuadrilla\s+2/i, "Plastering Crew 2"],
  [/Comisi[óo]n\s+Topograf[íi]a\s*\/\s*Oficial/i, "Survey Crew / Lead Tech"],
];

const ROOM_EN_MAP: Record<string, string> = {
  "Lobby Principal": "Main Lobby",
  "Oficina Norte": "North Office",
  "Sala de Juntas": "Executive Boardroom",
  "Habitación Mamá": "Master Suite / Mom's Bedroom",
  "Habitacion Mama": "Master Suite / Mom's Bedroom",
  "Habitación Principal": "Primary Bedroom",
  "Habitación Abuelos": "Grandparents' Bedroom",
  "Habitación Esteban": "Bedroom — Esteban",
  "Habitación Lisbeth": "Bedroom — Lisbeth",
  "Habitación Huésped": "Guest Bedroom",
  "Habitacion Huesped": "Guest Bedroom",
  "Habitación Nan & I": "Suite — Nan & I",
  "Habitación 1": "Bedroom 1",
  "Habitación 2": "Bedroom 2",
  "Sala": "Living Room",
  "Comedor": "Dining Room",
  "Sala / Comedor": "Living / Dining Area",
  "Cocina": "Kitchen",
  "Baño 1": "Bathroom 1",
  "Baño 2": "Bathroom 2",
  "Entrada / Puerta 1": "Main Entry / Door 1",
  "Entrada / Puerta 2": "Secondary Entry / Door 2",
  "Pasillo": "Hallway",
  "Patio": "Patio / Courtyard",
  "Cubierta": "Roof Deck",
  "Zona A — Pórticos & Cimentación": "Zone A — Foundations & Structural Frame",
  "Zona B — Envolvente & Acabados": "Zone B — Envelope & Architectural Finishes",
  "Zona C — Cubierta & Carpintería": "Zone C — Roofing & Glazing",
};

export function localizeRoomName(room: string, lang: AppLang): string {
  const raw = String(room || "").trim();
  if (lang === "es" || !raw) return raw;
  return ROOM_EN_MAP[raw] || localizeTerm(raw, lang);
}

export function localizeChapter(chapter: string, lang: AppLang): string {
  const raw = String(chapter || "").trim();
  if (lang === "es" || !raw) return raw;
  for (const [pattern, replacement] of CHAPTER_EN_MAP) {
    if (pattern.test(raw)) return replacement;
  }
  return raw;
}

export function localizeActivity(activity: string, lang: AppLang): string {
  const raw = String(activity || "").trim();
  if (!raw) return "";
  if (lang === "es") return raw;

  const prefixMatch = raw.match(/^\[BIM[_ ]TAKEOFF\]\s*(.*)$/i);
  const body = prefixMatch ? prefixMatch[1].trim() : raw;
  const translatedBody = EXACT_PHRASE_EN[body] || translateConstructionText(body);
  return prefixMatch ? `[BIM TAKEOFF] ${translatedBody}` : translatedBody;
}

export function localizeMaterialName(name: string, lang: AppLang): string {
  const raw = String(name || "").trim();
  if (lang === "es" || !raw) return raw;
  for (const [pattern, replacement] of MATERIAL_EN_MAP) {
    if (pattern.test(raw)) return replacement;
  }
  return raw;
}

export function localizeCrew(crew: string, lang: AppLang): string {
  const raw = String(crew || "").trim();
  if (lang === "es" || !raw) return raw;
  const parts = raw.split(":");
  let head = parts[0].trim();
  for (const [pattern, replacement] of CREW_SPECIALTY_EN) {
    if (pattern.test(head)) {
      head = replacement;
      break;
    }
  }
  if (parts.length < 2) return head;
  const tail = parts
    .slice(1)
    .join(":")
    .trim()
    .replace(/(\d+)\s+Oficiales\b/gi, (_, n) => `${n} ${n === "1" ? "Lead Tech" : "Skilled Technicians"}`)
    .replace(/(\d+)\s+Oficial\s+Especializado\b/gi, (_, n) => `${n} ${n === "1" ? "Master Tech" : "Master Technicians"}`)
    .replace(/(\d+)\s+Oficial\b/gi, (_, n) => `${n} ${n === "1" ? "Lead Tech" : "Lead Techs"}`)
    .replace(/(\d+)\s+Of\b/gi, (_, n) => `${n} ${n === "1" ? "Lead Tech" : "Lead Techs"}`)
    .replace(/(\d+)\s+Ayudantes?\b/gi, (_, n) => `${n} ${n === "1" ? "Helper" : "Helpers"}`)
    .replace(/(\d+)\s+Ayud\.?/gi, (_, n) => `${n} ${n === "1" ? "Helper" : "Helpers"}`)
    .replace(/\bOficiales\b/gi, "Skilled Technicians")
    .replace(/\bOficial\s+Especializado\b/gi, "Master Technician")
    .replace(/\bOficial\b/gi, "Lead Tech")
    .replace(/\bOf\b/gi, "Lead Tech")
    .replace(/\bEstucador\b/gi, "Drywall Finisher")
    .replace(/\bPintor\b/gi, "Painter")
    .replace(/\bCarpintero\b/gi, "Carpenter")
    .replace(/\bMontadores\b/gi, "Steel & Roof Erectors")
    .replace(/\bAyudantes\b/gi, "Helpers")
    .replace(/\bAyud\.?/gi, "Helper");
  return `${head}: ${tail}`;
}

export function localizeStatus(status: string, lang: AppLang): string {
  const raw = String(status || "").trim();
  if (lang === "es" || !raw) return raw;
  return EXACT_PHRASE_EN[raw] || raw;
}

export function localizeTerm(text: string, lang: AppLang): string {
  const raw = String(text || "").trim();
  if (lang === "es" || !raw) return raw;
  if (EXACT_PHRASE_EN[raw]) return EXACT_PHRASE_EN[raw];
  return translateConstructionText(raw);
}

function translateConstructionText(raw: string): string {
  return raw
    .replace(/Lobby Principal/gi, "Main Lobby")
    .replace(/Oficina Norte/gi, "North Office")
    .replace(/Sala de Juntas/gi, "Executive Boardroom")
    .replace(/Habitaci[óo]n Mam[áa]|H\.?\s*Mom/gi, "Master Suite")
    .replace(/H\.?\s*Abuelos/gi, "Grandparents' Bedroom")
    .replace(/H\.?\s*Esteban/gi, "Bedroom Esteban")
    .replace(/H\.?\s*Lisbeth/gi, "Bedroom Lisbeth")
    .replace(/H\.?\s*Hu[ée]sped|Huesped/gi, "Guest Bedroom")
    .replace(/H\.?\s*Nan\s*(&|y)\s*I/gi, "Suite Nan & I")
    .replace(/Baño Principal/gi, "Master Bathroom")
    .replace(/Baño Social/gi, "Guest Bathroom")
    .replace(/Ba[ñn]o 1/gi, "Bathroom 1")
    .replace(/Habitación Principal/gi, "Master Bedroom")
    .replace(/Habitación\s*(\d+)/gi, "Bedroom $1")
    .replace(/Sala Comedor \/ Recibidor/gi, "Living / Dining / Foyer")
    .replace(/Patio Interior & Lavadero/gi, "Courtyard & Laundry")
    .replace(/Circulación Interior & Pasillos/gi, "Interior Hallways & Circulation")
    .replace(/Cocina/gi, "Kitchen")
    .replace(/\bSala\b/gi, "Living Room")
    .replace(/puerta 1|entrada 1/gi, "Entry Door 1")
    .replace(/puerta 2|entrada 2/gi, "Entry Door 2")
    .replace(/Terraza/gi, "Terrace")
    .replace(/Nivel 1 - Corporativo/gi, "Level 1 - Corporate")
    .replace(/Cubierta y Envolvente/gi, "Roof & Building Envelope")
    .replace(/Cimentación/gi, "Foundations")
    .replace(/Montaje de cubierta termoac[úu]stica(?:\s*\/\s*|\s+)Eternit(?:\s+y\s+caballetes)?/gi, "Thermo-acoustic fiber-cement roofing & ridge cap assembly")
    .replace(/cubierta termoac[úu]stica(?:\s+en\s+teja)?\s*Eternit(?:\s+y\s+caballetes)?/gi, "thermo-acoustic fiber-cement roofing & ridge caps")
    .replace(/cubierta en teja ondulada Eternit y caballetes/gi, "corrugated fiber-cement roofing & ridge caps")
    .replace(/cubierta en teja ondulada/gi, "corrugated roofing sheets")
    .replace(/teja ondulada Eternit/gi, "corrugated fiber-cement roofing")
    .replace(/\bCaballetes?\b/gi, "ridge caps")
    .replace(/Ventaner[íi]a\s+aluminio\s+termoac[úu]stica\s+y\s+puertas\s+interiores/gi, "Thermo-acoustic aluminum windows & interior doors")
    .replace(/Ventaner[íi]a\s+aluminio\s+y\s+puertas\s+ac[úu]sticas/gi, "Thermo-acoustic aluminum glazing & acoustic doors")
    .replace(/ventaner[íi]a en aluminio y vidrio/gi, "aluminum & glass windows")
    .replace(/ventaner[íi]a/gi, "aluminum glazing")
    .replace(/Cielo\s*Raso\s*\+\s*Frescasa\s*Eco/gi, "Suspended Ceiling + Frescasa Eco Insulation")
    .replace(/Cielo\s*raso\s*suspendido/gi, "Suspended Drywall Ceiling")
    .replace(/Cielo\s*raso/gi, "Suspended Ceiling")
    .replace(/Frescasa\s*Eco/gi, "Frescasa Eco Insulation")
    .replace(/Plantilla\s+de\s+concreto\s*(?:e=7cm|7cm)/gi, "Concrete floor screed (t=2.75\")")
    .replace(/Instalaci[óo]n\s+de\s+piso\s+en\s+porcelanato\s+51[x×]51\s*(?:cm)?\s+y\s+plantilla/gi, "20\"×20\" Porcelain tile flooring & 2.75\" leveling sub-slab")
    .replace(/piso\s+en\s+porcelanato\s+51[x×]51\s*(?:cm)?\s+y\s+enchape/gi, "20\"×20\" porcelain tile flooring & wall cladding")
    .replace(/piso\s+en\s+porcelanato/gi, "porcelain tile flooring")
    .replace(/Suministro e instalación de/gi, "Supply & installation of")
    .replace(/Instalación de/gi, "Installation of")
    .replace(/Montaje de/gi, "Erection & assembly of")
    .replace(/Concreto en/gi, "Structural concrete for")
    .replace(/Excavación para/gi, "Excavation for")
    .replace(/Solado de limpieza para/gi, "Lean concrete mud slab for")
    .replace(/Localización, trazado y replanteo/gi, "Site layout, survey & staking")
    .replace(/Limpieza final de obra y entrega técnica/gi, "Final site cleanup & technical handover")
    .replace(/zapatas y vigas de cimentación/gi, "spread footings & grade beams")
    .replace(/columnas y pórtico estructural/gi, "columns & structural frame")
    .replace(/muros en mampostería de bloques de concreto/gi, "concrete masonry block (CMU) walls")
    .replace(/pañete y mortero de revoco/gi, "cement stucco plaster & screeding")
    .replace(/aislamiento termoacústico/gi, "thermal-acoustic insulation")
    .replace(/pintura vinílica/gi, "architectural latex paint")
    .replace(/estuco plástico/gi, "skim coat putty")
    .replace(/Enchape piso/gi, "Floor tile")
    .replace(/porcelanato/gi, "Porcelain Tile")
    .replace(/y\s+plantilla/gi, "& 2.75\" leveling sub-slab")
    .replace(/puertas interiores y acceso/gi, "interior & entry doors")
    .replace(/f'c=21 MPa/gi, "f'c=3,000 PSI")
    .replace(/f'c=24 MPa/gi, "f'c=3,500 PSI")
    .replace(/Fc=24\.5 MPa/gi, "f'c=3,500 PSI")
    .replace(/e=7cm/gi, "t=2.75\"")
    .replace(/e=5\.3cm/gi, "t=2.1\"")
    .replace(/51[x×]51(?:\s*cm)?/gi, "20\"×20\"")
    .replace(/\(dos caras\)|dos caras/gi, "(two sides)")
    .replace(/sin novedades|según planos/gi, "verified per drawings")
    .replace(/Excavación y fundida de zapatas Z-1 a Z-6.*/i, "Spread footings F-1 to F-6 poured and cured per structural specs")
    .replace(/Fundida de 6 columnas estructurales.*cabezales/i, "Poured 6 reinforced concrete frame columns and tie-beam headers")
    .replace(/Levante completo de muros perimetrales.*No\. 12/i, "Completed perimeter CMU No. 12 block walls and partition lintels")
    .replace(/Pañete interior y exterior completado.*/i, "Exterior & interior plastering phase active at 60.7% cumulative progress")
    .replace(/Instalación de estructura de cubierta.*acero/i, "Roof steel purlins & corrugated fiber-cement panels installed cleanly")
    .replace(/Plantilla de nivelación y arranque.*/i, "Concrete leveling sub-slab cured; porcelain tile layout started at 34.3%");
}

export function localizeBitacoraObservacion(obs: string, lang: AppLang): string {
  const raw = String(obs || "").trim();
  if (lang === "es" || !raw) return raw;
  return translateConstructionText(raw)
    .replace(/Registro sincronizado/gi, "Field log synced")
    .replace(/Avance diario reportado/gi, "Daily progress reported");
}

export function sanitizeDemoProject(proy: ProjectConfig, isDemo: boolean, lang: AppLang): ProjectConfig {
  if (!isDemo) return proy;
  return {
    ...proy,
    contratista: lang === "en" ? "JGM ConTech Engineering Team" : "Equipo de Ingeniería JGM ConTech",
    cedula_contratista: "",
    cargo_contratista: lang === "en" ? "Project Controls & BIM 5D Director" : "Dirección de Gerencia & Control BIM 5D",
    firma_residente:
      lang === "en"
        ? "PROJECT DIRECTOR / LEAD ENGINEER\nJGM ConTech Showcase Platform"
        : "DIRECCIÓN DE PROYECTO / INGENIERÍA\nPlataforma Showcase JGM ConTech",
    firma_interventor:
      lang === "en"
        ? "OWNER'S REPRESENTATIVE\nNorthbridge Capital Partners"
        : "REPRESENTANTE DEL CONTRATANTE\nNorthbridge Capital Partners",
    contratante: proy.contratante || "Northbridge Capital Partners",
    cedula_cliente: "",
  };
}

export function buildExportConsolidatedRows(
  rows: ConsolidatedRow[],
  lang: AppLang,
  currency: CurrencyCode,
  rates: Record<CurrencyCode, number>
): ConsolidatedRow[] {
  const fx = rates[currency] || 1;
  return rows.map((r) => {
    const qtyC = convertQty(r.Cantidad_Contratada, r.Unidad, lang);
    const qtyE = convertQty(r.Cantidad_Ejecutada, r.Unidad, lang);
    const qtyS = convertQty(r.Saldo_Cantidad, r.Unidad, lang);
    const qtyM = convertQty(r.Mayor_Cantidad, r.Unidad, lang);
    const priceUnit = convertUnitPriceCopToDisplay(
      r.Precio_Unitario,
      r.Unidad,
      currency,
      rates,
      lang
    );
    return {
      ...r,
      Capitulo: localizeChapter(r.Capitulo, lang),
      Actividad: localizeActivity(r.Actividad, lang),
      Unidad: convertUnitLabel(r.Unidad, lang),
      Cantidad_Contratada: qtyC,
      Cantidad_Ejecutada: qtyE,
      Saldo_Cantidad: qtyS,
      Mayor_Cantidad: qtyM,
      Precio_Unitario: priceUnit,
      Presupuesto_Total: Number(r.Presupuesto_Total || 0) / fx,
      Costo_Ejecutado: Number(r.Costo_Ejecutado || 0) / fx,
      Saldo_Dinero: Number(r.Saldo_Dinero || 0) / fx,
      Sobrecosto_COP: Number(r.Sobrecosto_COP || 0) / fx,
      Estado: localizeStatus(r.Estado, lang),
    };
  });
}

export function buildExportBudgetItems(
  items: BudgetItem[],
  lang: AppLang,
  currency: CurrencyCode,
  rates: Record<CurrencyCode, number>
): BudgetItem[] {
  return items.map((item) => ({
    ...item,
    Capitulo: localizeChapter(item.Capitulo, lang),
    Actividad: localizeActivity(item.Actividad, lang),
    Unidad: convertUnitLabel(item.Unidad, lang),
    Cantidad_Contratada: convertQty(item.Cantidad_Contratada, item.Unidad, lang),
    Precio_Unitario: convertUnitPriceCopToDisplay(item.Precio_Unitario, item.Unidad, currency, rates, lang),
  }));
}
