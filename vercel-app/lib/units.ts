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
  if (u.includes("cuñete") || u.includes("cunete")) return "5-gal pails";
  if (u.includes("lámina") || u.includes("lamina")) return "4'×8' sheets";
  if (u.includes("rollo")) return "rolls";
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
  "Plantilla de concreto e=7cm (base y solado de piso)": "Concrete floor leveling slab (t=2.75\") & mud slab",
  "Instalación de piso en porcelanato 51x51 cm y enchape": "20\"×20\" Porcelain tile flooring & wall cladding",
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
  [/Bloques de Concreto #12/i, "#12 Concrete Masonry Units (CMU)"],
  [/Cemento Portland Tipo I/i, "Portland Cement Type I"],
  [/Arena de Pañete \/ Pegante/i, "Plaster & Masonry Mortar Sand"],
  [/Agua de Mezcla/i, "Mixing Water"],
  [/Porcelanato Tráfico 5 \+ Mortero Pega/i, "PEI-5 Porcelain Tile + Polymer Thin-Set Mortar"],
  [/Panel Yeso\/Fibrocemento \+ Perfilería Galv\./i, "Gypsum / Fiber-Cement Board + Galv. Stud Framing"],
  [/Colchoneta Fibra de Vidrio Frescasa Eco 2-1\/2"/i, "Frescasa Eco 2-1/2\" Fiberglass Insulation Batts"],
  [/Estuco Plástico \+ Pintura Vinílica Tipo 1/i, "Interior Skim Coat + Type-1 Architectural Latex Paint"],
  [/Teja Ondulada Eternit #6 \+ Caballetes \+ Ganchos/i, "Corrugated Fiber-Cement Roof Panels + Ridge Caps + Fasteners"],
  [/Puertas Entamboradas \+ Marco \+ Cerradura/i, "Solid-Core Architectural Doors + Frames + Locksets"],
  [/Ventanería Aluminio \+ Vidrio Crudo 5mm/i, "Extruded Aluminum Window Frames + 5mm Clear Glass"],
  [/Concreto Premezclado f'c = 21-28 MPa \(3000-4000 PSI\)/i, "Ready-Mix Structural Concrete (3,000–4,000 PSI)"],
  [/Acero de Refuerzo PDR-60 Corrugado/i, "Grade 60 Deformed Reinforcing Steel (Rebar)"],
  [/Concreto Mezclado en Obra f'c = 21 MPa \(3000 PSI\)/i, "Site-Mixed Concrete f'c = 3,000 PSI"],
  [/Aglomerado \/ Carpintería \+ Herrajes/i, "Architectural Millwork & Hardware"],
  [/Insumos Especializados según APU del ítem/i, "Specialized APU Consumables & Fasteners"],
];

const CREW_EN_MAP: Array<[RegExp, string]> = [
  [/Cuadrilla Estructura: 1 Oficial \+ 4 Ayudantes/i, "Structural Crew: 1 Lead Mason + 4 Helpers"],
  [/Cuadrilla 1: 1 Oficial \+ 3 Ayudantes/i, "Masonry Crew 1: 1 Mason + 3 Helpers"],
  [/Cuadrilla 2: 1 Oficial \+ 1 Ayudante/i, "Plastering Crew 2: 1 Plasterer + 1 Helper"],
  [/Cuadrilla Acabados: 1 Oficial Especializado/i, "Finishing Crew: 1 Master Tile Setter"],
  [/Cuadrilla Acabados: 1 Oficial \+ 1 Ayudante/i, "Finishing Crew: 1 Installer + 1 Helper"],
  [/Cuadrilla Acabados: 1 Oficial/i, "Finishing Crew: 1 Installer"],
  [/Cuadrilla Estuco: 1 Estucador \+ 1 Pintor/i, "Painting Crew: 1 Skim-Coater + 1 Painter"],
  [/Cuadrilla Metálica: 2 Montadores/i, "Roofing Crew: 2 Steel & Roof Erectors"],
  [/Cuadrilla Carpintería: 1 Carpintero \+ 1 Ayudante/i, "Glazing & Doors Crew: 1 Glazier + 1 Helper"],
  [/Cuadrilla Estándar/i, "Standard Field Crew"],
];

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
  for (const [pattern, replacement] of CREW_EN_MAP) {
    if (pattern.test(raw)) return replacement;
  }
  return raw;
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
    .replace(/Baño Principal/gi, "Master Bathroom")
    .replace(/Baño Social/gi, "Guest Bathroom")
    .replace(/Habitación Principal/gi, "Master Bedroom")
    .replace(/Habitación\s*(\d+)/gi, "Bedroom $1")
    .replace(/Sala Comedor \/ Recibidor/gi, "Living / Dining / Foyer")
    .replace(/Patio Interior & Lavadero/gi, "Courtyard & Laundry")
    .replace(/Circulación Interior & Pasillos/gi, "Interior Hallways & Circulation")
    .replace(/Terraza/gi, "Terrace")
    .replace(/Nivel 1 - Corporativo/gi, "Level 1 - Corporate")
    .replace(/Cubierta y Envolvente/gi, "Roof & Building Envelope")
    .replace(/Cimentación/gi, "Foundations")
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
    .replace(/cielo raso suspendido/gi, "suspended drywall ceiling")
    .replace(/aislamiento termoacústico/gi, "thermal-acoustic insulation")
    .replace(/cubierta en teja ondulada/gi, "corrugated roofing sheets")
    .replace(/pintura vinílica/gi, "architectural latex paint")
    .replace(/estuco plástico/gi, "skim coat putty")
    .replace(/porcelanato/gi, "porcelain tile")
    .replace(/puertas interiores y acceso/gi, "interior & entry doors")
    .replace(/ventanería en aluminio y vidrio/gi, "aluminum & glass windows")
    .replace(/f'c=21 MPa/gi, "f'c=3,000 PSI")
    .replace(/f'c=24 MPa/gi, "f'c=3,500 PSI")
    .replace(/Fc=24\.5 MPa/gi, "f'c=3,500 PSI")
    .replace(/e=7cm/gi, "t=2.75\"")
    .replace(/e=5\.3cm/gi, "t=2.1\"")
    .replace(/51x51 cm/gi, "20\"×20\"")
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
