import { normalizarTexto } from "./calcClient";
import {
  BitacoraRow,
  BudgetItem,
  ProjectConfig,
  RoomActivityItem,
  RoomActivityKey,
} from "./types";

export const CASA_MENDOZA_ROOM_ORDER: string[] = [
  "Habitación Mamá",
  "Habitación Esteban",
  "Habitación Nan & I",
  "Habitación Abuelos",
  "Habitación Lisbeth",
  "Habitación Huésped",
  "Sala",
  "Cocina",
  "Baño 1",
  "Entrada / Puerta 1",
  "Entrada / Puerta 2",
];

/**
 * Dataset desmenuzado por habitación tomado directamente de las tablas de
 * planificación (Schedules) de Revit 2027 — Casa Mendoza 1.1.rvt usando `Comments`.
 * Nota: En la captura de Pisos, la fila inferior tras "Enchape piso H Lisbeth"
 * quedó fuera del scroll vertical (se deja editable `Enchape piso Cocina` como
 * pendiente de verificar hasta importar el archivo .txt/.csv nativo de Revit).
 */
export const CASA_MENDOZA_ROOMS_BASE: RoomActivityItem[] = [
  // Habitación Mamá
  {
    id: "cm-hmom-plantilla",
    room: "Habitación Mamá",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto H mom",
    unit: "m²",
    quantity: 12,
  },
  {
    id: "cm-hmom-enchape",
    room: "Habitación Mamá",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso H Mom",
    unit: "m²",
    quantity: 12,
  },
  {
    id: "cm-hmom-cielorraso",
    room: "Habitación Mamá",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso H Mom",
    unit: "m²",
    quantity: 12,
  },

  // Habitación Esteban
  {
    id: "cm-hesteban-plantilla",
    room: "Habitación Esteban",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto H Esteban",
    unit: "m²",
    quantity: 8,
  },
  {
    id: "cm-hesteban-enchape",
    room: "Habitación Esteban",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso H Esteban",
    unit: "m²",
    quantity: 8,
  },
  {
    id: "cm-hesteban-cielorraso",
    room: "Habitación Esteban",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso H Esteban",
    unit: "m²",
    quantity: 8,
  },

  // Habitación Nan & I
  {
    id: "cm-hnany-plantilla",
    room: "Habitación Nan & I",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto H Nan & I",
    unit: "m²",
    quantity: 10,
  },
  {
    id: "cm-hnany-enchape",
    room: "Habitación Nan & I",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso H Nan y I",
    unit: "m²",
    quantity: 10,
  },
  {
    id: "cm-hnany-cielorraso",
    room: "Habitación Nan & I",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso H nan & I",
    unit: "m²",
    quantity: 10,
  },

  // Habitación Abuelos
  {
    id: "cm-habuelos-plantilla",
    room: "Habitación Abuelos",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto H Abuelos",
    unit: "m²",
    quantity: 7,
  },
  {
    id: "cm-habuelos-enchape",
    room: "Habitación Abuelos",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso H Abuelos",
    unit: "m²",
    quantity: 7,
  },
  {
    id: "cm-habuelos-cielorraso",
    room: "Habitación Abuelos",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso H Abuelos",
    unit: "m²",
    quantity: 7,
  },

  // Habitación Lisbeth
  {
    id: "cm-hlisbeth-plantilla",
    room: "Habitación Lisbeth",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto H Lisbeth",
    unit: "m²",
    quantity: 10,
  },
  {
    id: "cm-hlisbeth-enchape",
    room: "Habitación Lisbeth",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso H Lisbeth",
    unit: "m²",
    quantity: 10,
  },
  {
    id: "cm-hlisbeth-cielorraso",
    room: "Habitación Lisbeth",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso H Lisbeth",
    unit: "m²",
    quantity: 10,
  },

  // Habitación Huésped
  {
    id: "cm-hhuesped-plantilla",
    room: "Habitación Huésped",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto H Huesped",
    unit: "m²",
    quantity: 5,
  },
  {
    id: "cm-hhuesped-enchape",
    room: "Habitación Huésped",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso Huesped",
    unit: "m²",
    quantity: 5,
  },
  {
    id: "cm-hhuesped-cielorraso",
    room: "Habitación Huésped",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso Huesped",
    unit: "m²",
    quantity: 5,
  },

  // Sala
  {
    id: "cm-sala-plantilla",
    room: "Sala",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto Sala",
    unit: "m²",
    quantity: 19,
  },
  {
    id: "cm-sala-enchape",
    room: "Sala",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso Sala",
    unit: "m²",
    quantity: 19,
  },
  {
    id: "cm-sala-cielorraso",
    room: "Sala",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso Sala",
    unit: "m²",
    quantity: 19,
  },

  // Cocina
  {
    id: "cm-cocina-plantilla",
    room: "Cocina",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto Cocina",
    unit: "m²",
    quantity: 14,
  },
  {
    id: "cm-cocina-enchape",
    room: "Cocina",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso Cocina",
    unit: "m²",
    quantity: 0,
    pendingVerify: true,
  },
  {
    id: "cm-cocina-cielorraso",
    room: "Cocina",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso Cocina",
    unit: "m²",
    quantity: 14,
  },

  // Baño 1
  {
    id: "cm-bano1-plantilla",
    room: "Baño 1",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto Baño 1",
    unit: "m²",
    quantity: 3,
  },
  {
    id: "cm-bano1-enchape",
    room: "Baño 1",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato baño 51x51",
    sourceComment: "Enchape piso Baño 1",
    unit: "m²",
    quantity: 3,
  },
  {
    id: "cm-bano1-cielorraso",
    room: "Baño 1",
    activityKey: "cielorraso",
    activityLabel: "Cielo raso",
    sourceComment: "Cielo raso Baño 1",
    unit: "m²",
    quantity: 3,
  },

  // Entrada / Puerta 1
  {
    id: "cm-puerta1-plantilla",
    room: "Entrada / Puerta 1",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto puerta 1",
    unit: "m²",
    quantity: 13,
  },
  {
    id: "cm-puerta1-enchape",
    room: "Entrada / Puerta 1",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso entrada 1",
    unit: "m²",
    quantity: 13,
  },

  // Entrada / Puerta 2
  {
    id: "cm-puerta2-plantilla",
    room: "Entrada / Puerta 2",
    activityKey: "plantilla",
    activityLabel: "Plantilla de concreto 7cm",
    sourceComment: "Plantilla de concreto puerta 2",
    unit: "m²",
    quantity: 9,
  },
  {
    id: "cm-puerta2-enchape",
    room: "Entrada / Puerta 2",
    activityKey: "enchape",
    activityLabel: "Enchape piso porcelanato 51x51",
    sourceComment: "Enchape piso entrada 2",
    unit: "m²",
    quantity: 10,
  },
];

const DEFAULT_ACTIVITY_PRICES: Record<RoomActivityKey, number> = {
  plantilla: 34000,
  enchape: 58000,
  cielorraso: 38000,
  mamposteria: 47500,
  panete: 24000,
  pintura: 16500,
  carpinteria: 390000,
  cubierta: 45000,
  otro: 0,
};

const ACTIVITY_MATCH_HINTS: Record<RoomActivityKey, string[]> = {
  plantilla: ["plantilla", "solado", "base de piso"],
  enchape: ["porcelanato", "enchape", "ceramica", "piso"],
  cielorraso: ["cielo", "cielorraso", "ceiling"],
  mamposteria: ["mamposteria", "bloque", "bloques"],
  panete: ["panete", "revoco"],
  pintura: ["estuco", "pintura", "vinilica"],
  carpinteria: ["puerta", "ventana", "carpinteria"],
  cubierta: ["cubierta", "eternit", "teja"],
  otro: [],
};

export function resolveUnitPriceForRoomItem(
  item: RoomActivityItem,
  pptoBase: BudgetItem[],
  priceOverrides?: Partial<Record<RoomActivityKey, number>>
): number {
  if (typeof item.unitPrice === "number" && item.unitPrice > 0) {
    return item.unitPrice;
  }
  const override = priceOverrides?.[item.activityKey];
  if (typeof override === "number" && override > 0) {
    return override;
  }
  const hints = ACTIVITY_MATCH_HINTS[item.activityKey] || [];
  for (const b of pptoBase || []) {
    const actNorm = normalizarTexto(b.Actividad);
    if (hints.some((h) => actNorm.includes(h))) {
      return Number(b.Precio_Unitario) || 0;
    }
  }
  return DEFAULT_ACTIVITY_PRICES[item.activityKey] ?? 0;
}

export function normalizeRevitRoomName(rawSuffix: string): string {
  const n = normalizarTexto(rawSuffix).replace(/\s+/g, " ");
  if (!n) return "General / Sin Habitación";
  if (n === "h mom" || n === "mom" || n.includes("mama")) return "Habitación Mamá";
  if (n.includes("esteban")) return "Habitación Esteban";
  if (n.includes("nan")) return "Habitación Nan & I";
  if (n.includes("abuelo")) return "Habitación Abuelos";
  if (n.includes("lisbeth")) return "Habitación Lisbeth";
  if (n.includes("huesped")) return "Habitación Huésped";
  if (n.includes("sala")) return "Sala";
  if (n.includes("cocina")) return "Cocina";
  if (n.includes("bano 1") || n === "bano") return "Baño 1";
  if (n.includes("puerta 1") || n.includes("entrada 1")) return "Entrada / Puerta 1";
  if (n.includes("puerta 2") || n.includes("entrada 2")) return "Entrada / Puerta 2";

  return rawSuffix
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function classifyRevitActivityAndRoom(
  rawComment: string,
  rawFamilyType = ""
): {
  activityKey: RoomActivityKey;
  activityLabel: string;
  room: string;
} {
  const cNorm = normalizarTexto(rawComment);
  const fNorm = normalizarTexto(rawFamilyType);
  const combined = `${fNorm} ${cNorm}`;

  let activityKey: RoomActivityKey = "otro";
  let activityLabel = rawFamilyType.trim() || "Actividad BIM Revit";

  if (combined.includes("plantilla") || combined.includes("solado")) {
    activityKey = "plantilla";
    activityLabel = "Plantilla de concreto 7cm";
  } else if (
    combined.includes("enchape") ||
    combined.includes("porcelanato") ||
    combined.includes("piso ")
  ) {
    activityKey = "enchape";
    activityLabel = combined.includes("bano")
      ? "Enchape piso porcelanato baño 51x51"
      : "Enchape piso porcelanato 51x51";
  } else if (
    combined.includes("cielo raso") ||
    combined.includes("cielorraso") ||
    combined.includes("ceiling")
  ) {
    activityKey = "cielorraso";
    activityLabel = "Cielo raso";
  } else if (
    combined.includes("mamposteria") ||
    combined.includes("bloque") ||
    combined.includes("muro")
  ) {
    activityKey = "mamposteria";
    activityLabel = "Muros mampostería bloque No. 12";
  } else if (combined.includes("panete") || combined.includes("revoco")) {
    activityKey = "panete";
    activityLabel = "Pañete y mortero de revoco";
  } else if (combined.includes("estuco") || combined.includes("pintura")) {
    activityKey = "pintura";
    activityLabel = "Estuco y pintura vinílica";
  } else if (combined.includes("cubierta") || combined.includes("eternit") || combined.includes("teja")) {
    activityKey = "cubierta";
    activityLabel = "Cubierta teja Eternit";
  } else if (combined.includes("ventana") || combined.includes("puerta")) {
    activityKey = "carpinteria";
    activityLabel = combined.includes("ventana") ? "Ventanería aluminio y vidrio" : "Puertas interiores y acceso";
  }

  // Remueve el prefijo de actividad del Comment de Revit para aislar la habitación
  const stripped = rawComment
    .replace(/^\s*(plantilla\s+de\s+concreto(\s+7\s*cm)?|enchape\s+piso|enchape|cielo\s*raso|mamposteria\s+bloque|muros?|panete|pintura)\s*/i, "")
    .trim();

  const room = normalizeRevitRoomName(stripped || rawComment);
  return { activityKey, activityLabel, room };
}

export function slugRoomActivityId(room: string, activityKey: RoomActivityKey): string {
  const rSlug = normalizarTexto(room).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${rSlug || "zona"}-${activityKey}`;
}

export function parseNumericArea(rawVal: string): number {
  const cleaned = String(rawVal || "")
    .replace(/m²|m2|und|ml|m3|m³/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(",") && !cleaned.includes(".")
    ? cleaned.replace(",", ".")
    : cleaned.replace(/,/g, "");
  return Number(normalized);
}

/**
 * Respaldo local en TypeScript para parsear tablas exportadas desde Revit (.txt tabulado o .csv),
 * replicando la estructura nativa <TITULO> -> Cabeceras -> Filas detalle -> Totales.
 */
export function parseRevitScheduleLocal(text: string): {
  items: RoomActivityItem[];
  error?: string;
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  let headerIdx = -1;
  let sep = "\t";
  let idxComment = -1;
  let idxArea = -1;
  let idxFamily = -1;

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (line.trim().startsWith("<") && line.trim().endsWith(">")) continue;
    const candidateSep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const cols = line.split(candidateSep).map((c) => normalizarTexto(c.replace(/^"|"$/g, "")));
    const cIdx = cols.findIndex((c) =>
      ["comments", "comentarios", "hubicacion", "ubicacion", "habitacion", "zona", "frente"].some((k) =>
        c.includes(k)
      )
    );
    const aIdx = cols.findIndex((c) =>
      ["area", "cantidad", "metrado", "count", "cant"].some((k) => c.includes(k))
    );
    if (cIdx !== -1 && aIdx !== -1) {
      headerIdx = i;
      sep = candidateSep;
      idxComment = cIdx;
      idxArea = aIdx;
      idxFamily = cols.findIndex((c) =>
        ["family and type", "familia y tipo", "floor assembly", "type", "tipo", "actividad"].some((k) =>
          c.includes(k)
        )
      );
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      items: [],
      error: "No se reconocieron las columnas de Revit (ej. Comments/Hubicación y Área). Exporta con File -> Export -> Reports -> Schedule.",
    };
  }

  const aggMap = new Map<string, RoomActivityItem>();
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const cols = rawLine.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const comment = (cols[idxComment] || "").trim();
    const areaVal = parseNumericArea(cols[idxArea] || "");

    const cNorm = normalizarTexto(comment);
    if (
      !comment ||
      Number.isNaN(areaVal) ||
      areaVal <= 0 ||
      cNorm.startsWith("grand total") ||
      cNorm.startsWith("total ") ||
      /:\s*\d+$/.test(comment)
    ) {
      continue;
    }

    const familyType = idxFamily >= 0 ? cols[idxFamily] || "" : "";
    const parsed = classifyRevitActivityAndRoom(comment, familyType);
    const id = slugRoomActivityId(parsed.room, parsed.activityKey);
    const prev = aggMap.get(id);
    if (prev) {
      prev.quantity = Number((prev.quantity + areaVal).toFixed(2));
    } else {
      aggMap.set(id, {
        id,
        room: parsed.room,
        activityKey: parsed.activityKey,
        activityLabel: parsed.activityLabel,
        sourceComment: comment,
        unit: parsed.activityKey === "carpinteria" ? "und" : "m²",
        quantity: Number(areaVal.toFixed(2)),
      });
    }
  }

  const items = Array.from(aggMap.values());
  if (items.length === 0) {
    return { items: [], error: "La tabla no contiene filas válidas con áreas mayores a 0." };
  }
  return { items };
}

/**
 * Cruza los registros de Bitácora en Supabase contra habitaciones específicas
 * cuando contienen el nombre de la habitación (ej. `[Habitación Mamá]` o `H Mom`).
 */
export function computeExecutedByRoomItem(
  roomItems: RoomActivityItem[],
  obraActiva: BitacoraRow[]
): Record<string, number> {
  const executed: Record<string, number> = {};
  for (const item of roomItems) executed[item.id] = 0;

  for (const row of obraActiva || []) {
    const actRaw = String(row.actividad || "");
    const actNorm = normalizarTexto(actRaw);
    if (!actNorm || actNorm.includes("bim_takeoff") || actNorm.includes("takeoff")) continue;

    const cant = Number(row.cantidad || 0) || 0;
    if (cant <= 0) continue;

    for (const item of roomItems) {
      const roomNorm = normalizarTexto(item.room);
      const roomTokens = roomNorm
        .replace(/habitacion\s+/g, "")
        .replace(/entrada\s*\/\s*/g, "")
        .trim();

      const matchesRoom =
        actNorm.includes(`[${roomNorm}]`) ||
        actNorm.includes(roomNorm) ||
        (roomTokens.length >= 4 && actNorm.includes(roomTokens)) ||
        (item.room === "Habitación Mamá" && (actNorm.includes("h mom") || actNorm.includes("mama"))) ||
        (item.room === "Habitación Nan & I" && (actNorm.includes("nan") && actNorm.includes("i"))) ||
        (item.room === "Entrada / Puerta 1" && (actNorm.includes("puerta 1") || actNorm.includes("entrada 1"))) ||
        (item.room === "Entrada / Puerta 2" && (actNorm.includes("puerta 2") || actNorm.includes("entrada 2")));

      if (!matchesRoom) continue;

      const hints = ACTIVITY_MATCH_HINTS[item.activityKey] || [];
      if (hints.some((h) => actNorm.includes(h))) {
        executed[item.id] = Number(((executed[item.id] || 0) + cant).toFixed(2));
        break;
      }
    }
  }

  return executed;
}

export interface RoomMaterialSummary {
  insumo: string;
  unidad: string;
  cantidad: number;
}

export function computeMaterialsForRoomSelection(
  selectedItems: RoomActivityItem[]
): RoomMaterialSummary[] {
  const map = new Map<string, RoomMaterialSummary>();
  const add = (insumo: string, unidad: string, qty: number) => {
    if (qty <= 0) return;
    const key = `${insumo}||${unidad}`;
    const prev = map.get(key) || { insumo, unidad, cantidad: 0 };
    prev.cantidad += qty;
    map.set(key, prev);
  };

  for (const item of selectedItems) {
    const q = Number(item.quantity || 0);
    if (q <= 0) continue;
    switch (item.activityKey) {
      case "plantilla":
        add("Concreto Simple f'c=14 MPa (Plantilla e=7cm)", "m³", q * 0.07);
        add("Cemento Gris para Plantilla (Sacos 50kg)", "Sacos", q * 0.45);
        break;
      case "enchape":
        add("Porcelanato / Cerámica 51x51 cm (inc. 5% desp.)", "m²", q * 1.05);
        add("Pegacor Cerámico (Bultos 25kg)", "Bultos", q * 0.25);
        add("Boquilla para Junta", "kg", q * 0.35);
        break;
      case "cielorraso":
        add("Panel de Cielorraso Suspendido (inc. 5% desp.)", "m²", q * 1.05);
        add("Perfilería Angular y Perfiles Omega", "ml", q * 1.8);
        break;
      case "mamposteria":
        add("Bloque de Concreto No. 12 (40x20x12)", "Und", q * 12.5);
        add("Cemento Gris para Pega (Sacos 50kg)", "Sacos", q * 12.5 * 0.015);
        add("Arena Fina para Mortero de Pega", "m³", q * 12.5 * 0.002);
        break;
      case "panete":
        add("Cemento Gris para Pañete (Sacos 50kg)", "Sacos", q * 0.22);
        add("Arena Lavada para Pañete", "m³", q * 0.028);
        break;
      case "pintura":
        add("Estuco Plástico Listo (Cuñetes)", "Cuñetes", q * 0.08);
        add("Pintura Vinilo Tipo 1 (Galones)", "Gal", q * 0.12);
        break;
      case "cubierta":
        add("Teja Ondulada Eternit No. 6/8", "m²", q * 1.1);
        add("Ganchos de Fijación con Golilla", "Und", q * 3.0);
        break;
      default:
        break;
    }
  }

  return Array.from(map.values())
    .map((m) => ({ ...m, cantidad: Number(m.cantidad.toFixed(2)) }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export function getInitialRoomItemsForProject(proyecto: ProjectConfig): RoomActivityItem[] {
  if (proyecto.zonas_bim && proyecto.zonas_bim.length > 0) {
    return proyecto.zonas_bim;
  }
  if (proyecto.id === "casa_mendoza") {
    return CASA_MENDOZA_ROOMS_BASE.map((item) => ({ ...item }));
  }
  return [];
}
