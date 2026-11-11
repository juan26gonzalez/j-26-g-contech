import { BitacoraRow, HonorariosConfig, ProjectConfig } from "./types";

export const SUPABASE_URL = "https://ktxbonxgrnpzearsgvtc.supabase.co";
export const SUPABASE_KEY = "sb_publishable_VUiAXSbX0Snwe-jvO4yEgA_8WLCK0Do";
export const BITACORA_APP_URL = "https://jagm2000-jgmcontech-bitacora.vercel.app";
export const CUSTOM_PROJECTS_STORAGE_KEY = "jgm_contech_custom_projects_v1";

export const DEFAULT_HONORARIOS: HonorariosConfig = {
  incluir: false,
  escenario: "anexo_aiu",
  modo_calculo: "fijo",
  valor_fijo: 200000,
  porcentaje: 5.0,
  bonificable: true,
  incluir_iva_hon: false,
  incluir_visita: false,
  valor_visita: 70000,
};

export const PROYECTOS_BASE: Record<string, ProjectConfig> = {
  casa_mendoza: {
    id: "casa_mendoza",
    tipo: "bim",
    nombre: "Remodelación Casa Mendoza",
    contratante: "Familia Mendoza",
    cedula_cliente: "",
    contratista: "Ing. Juan González Mendoza",
    cedula_contratista: "C.C. 1001867834 • M.P. 021037-0828864 ATL",
    cargo_contratista: "Ingeniero Residente de Obra",
    ubicacion: "Calle 20D # 1 - 19. Sabanalarga, Atlántico",
    badge: "REVIT 2027 BIM 5D",
    a_def: 8.0,
    i_def: 2.0,
    u_def: 5.0,
    ant_def: 15.0,
    gar_def: 5.0,
    modelo_bim: "Casa Mendoza 1.1.rvt (Autodesk Revit 2027)",
    logo: "🏡",
    firma_residente: "ING. JUAN GONZÁLEZ MENDOZA\nIngeniero Residente • JGM ConTech",
    firma_interventor: "PROPIETARIO / SUPERVISOR\nFamilia Mendoza",
    ppto_base: [
      { Item: "1.1", Capitulo: "1. MAMPOSTERIA", Actividad: "Muros en mampostería de bloques de concreto No. 12", Unidad: "m²", Cantidad_Contratada: 227.89, Precio_Unitario: 47500, match_keys: ["mamposteria", "bloque", "bloques", "muro"] },
      { Item: "1.2", Capitulo: "1. MAMPOSTERIA", Actividad: "Pañete y mortero de revoco en muros (dos caras)", Unidad: "m²", Cantidad_Contratada: 455.78, Precio_Unitario: 24000, match_keys: ["panete", "revoco"] },
      { Item: "2.1", Capitulo: "2. PISOS Y ENCHAPES", Actividad: "Plantilla de concreto e=7cm (base y solado de piso)", Unidad: "m²", Cantidad_Contratada: 106.24, Precio_Unitario: 34000, match_keys: ["plantilla", "solado", "base de piso"] },
      { Item: "2.2", Capitulo: "2. PISOS Y ENCHAPES", Actividad: "Instalación de piso en porcelanato 51x51 cm y enchape", Unidad: "m²", Cantidad_Contratada: 107.1, Precio_Unitario: 58000, match_keys: ["porcelanato", "piso ceramico", "enchape", "ceramica", "piso"] },
      { Item: "3.1", Capitulo: "3. CIELOS RASOS", Actividad: "Instalación de cielo raso suspendido e=5.3cm", Unidad: "m²", Cantidad_Contratada: 86.65, Precio_Unitario: 38000, match_keys: ["cielorraso", "cielo raso", "ceiling"] },
      { Item: "4.1", Capitulo: "4. ACABADOS Y PINTURA", Actividad: "Estuco plástico y pintura vinílica en muros", Unidad: "m²", Cantidad_Contratada: 455.78, Precio_Unitario: 16500, match_keys: ["estuco", "pintura", "vinilica"] },
      { Item: "5.1", Capitulo: "5. CARPINTERIA", Actividad: "Suministro e instalación de puertas interiores y acceso (7 und)", Unidad: "und", Cantidad_Contratada: 7.0, Precio_Unitario: 390000, match_keys: ["puertas", "puerta", "door"] },
      { Item: "5.2", Capitulo: "5. CARPINTERIA", Actividad: "Suministro e instalación de ventanería en aluminio y vidrio (8 und)", Unidad: "und", Cantidad_Contratada: 8.0, Precio_Unitario: 280000, match_keys: ["ventanas", "ventana", "window", "ventaneria"] },
      { Item: "6.1", Capitulo: "6. CUBIERTA", Actividad: "Montaje de cubierta en teja ondulada Eternit y caballetes", Unidad: "m²", Cantidad_Contratada: 132.05, Precio_Unitario: 45000, match_keys: ["cubierta", "eternit", "techo", "teja"] },
    ],
  },
  mezzanine: {
    id: "mezzanine",
    tipo: "bim",
    nombre: "Mezzanine 3 Niveles",
    contratante: "DOLMEN S.A. E.S.P.",
    cedula_cliente: "NIT: 802.015.442-1",
    contratista: "Ing. Juan González Mendoza",
    cedula_contratista: "C.C. 1001867834 • M.P. 021037-0828864 ATL",
    cargo_contratista: "Ingeniero Residente de Obra",
    ubicacion: "Barranquilla, Atlántico",
    badge: "ENTERPRISE BIM 5D",
    a_def: 10.0,
    i_def: 3.0,
    u_def: 5.0,
    ant_def: 20.0,
    gar_def: 5.0,
    modelo_bim: "Revit 2027 • Estructura & Acero",
    logo: "🏢",
    firma_residente: "ING. JUAN GONZÁLEZ MENDOZA\nIngeniero Residente • JGM ConTech",
    firma_interventor: "INTERVENTOR TÉCNICO DELEGADO\nSupervisor de Obra • DOLMEN S.A. E.S.P.",
    ppto_base: [
      { Item: "1.1", Capitulo: "1. PRELIMINARES", Actividad: "Localización, trazado y replanteo", Unidad: "m²", Cantidad_Contratada: 180.0, Precio_Unitario: 3500, match_keys: ["localizacion", "trazado", "replanteo"] },
      { Item: "1.2", Capitulo: "1. PRELIMINARES", Actividad: "Cerramiento perimetral en polisombra negra al 90%", Unidad: "ml", Cantidad_Contratada: 156.0, Precio_Unitario: 14000, match_keys: ["cerramiento", "polisombra"] },
      { Item: "1.3", Capitulo: "1. PRELIMINARES", Actividad: "Demolición y retiro de material (plantillas, muros)", Unidad: "m³", Cantidad_Contratada: 48.68, Precio_Unitario: 85000, match_keys: ["demolicion", "retiro"] },
      { Item: "1.4", Capitulo: "1. PRELIMINARES", Actividad: "Demolición de piso en porcelanato y plantilla", Unidad: "m²", Cantidad_Contratada: 35.11, Precio_Unitario: 22000, match_keys: ["demolicion piso", "porcelanato"] },
      { Item: "1.5", Capitulo: "1. PRELIMINARES", Actividad: "Relleno con material seleccionado, nivelación y compactación", Unidad: "m³", Cantidad_Contratada: 25.0, Precio_Unitario: 68000, match_keys: ["relleno", "compactacion", "nivelacion"] },
      { Item: "2.2", Capitulo: "2. EXCAVACIONES", Actividad: "Excavación para zapatas, vigas de cimentación y foso ascensor", Unidad: "m³", Cantidad_Contratada: 42.0, Precio_Unitario: 58000, match_keys: ["excavacion", "excavación"] },
      { Item: "3.1", Capitulo: "3. CIMENTACION", Actividad: "Solado de limpieza para zapatas, vigas y foso ascensor e=0.05m", Unidad: "m²", Cantidad_Contratada: 25.3, Precio_Unitario: 28000, match_keys: ["solado", "plantilla de concreto", "limpieza"] },
      { Item: "3.2", Capitulo: "3. CIMENTACION", Actividad: "Concreto para zapatas Fc=24.5 MPa (3500 PSI)", Unidad: "m³", Cantidad_Contratada: 8.82, Precio_Unitario: 620000, match_keys: ["zapatas", "cimentacion", "cimentación"] },
      { Item: "3.3", Capitulo: "3. CIMENTACION", Actividad: "Concreto para vigas de cimentación y enlace Fc=24.5 MPa", Unidad: "m³", Cantidad_Contratada: 5.13, Precio_Unitario: 680000, match_keys: ["vigas de cimentacion", "vigas de amarre", "vigas"] },
      { Item: "3.4", Capitulo: "3. CIMENTACION", Actividad: "Concreto para pedestales Fc=24.5 MPa", Unidad: "m³", Cantidad_Contratada: 3.59, Precio_Unitario: 720000, match_keys: ["pedestales", "columnas estructurales", "columnas"] },
      { Item: "3.5", Capitulo: "3. CIMENTACION", Actividad: "Placa en concreto para piso e=12 cm Fc=21 MPa", Unidad: "m²", Cantidad_Contratada: 52.0, Precio_Unitario: 98000, match_keys: ["placa", "piso en concreto"] },
      { Item: "3.6", Capitulo: "3. CIMENTACION", Actividad: "Losa en concreto para metaldeck e=11 cm Fc=21 MPa", Unidad: "m²", Cantidad_Contratada: 150.0, Precio_Unitario: 145000, match_keys: ["losa", "metaldeck"] },
      { Item: "3.7", Capitulo: "3. CIMENTACION", Actividad: "Concreto para muro foso ascensor Fc=24.5 MPa", Unidad: "m³", Cantidad_Contratada: 3.04, Precio_Unitario: 750000, match_keys: ["foso", "ascensor", "muro foso"] },
      { Item: "3.8", Capitulo: "3. CIMENTACION", Actividad: "Suministro e instalación de barras roscadas 5/8 pulg anclajes", Unidad: "und", Cantidad_Contratada: 48.0, Precio_Unitario: 38000, match_keys: ["barras roscadas", "anclajes", "pernos"] },
      { Item: "4.1", Capitulo: "4. ACERO DE REFUERZO", Actividad: "Acero de refuerzo figurado para zapatas, vigas y pedestales (60 KSI)", Unidad: "kg", Cantidad_Contratada: 1525.0, Precio_Unitario: 5800, match_keys: ["acero de refuerzo", "figurado"] },
      { Item: "5.1", Capitulo: "5. ACERO ESTRUCTURAL", Actividad: "Perfilería estructural (HEA 320 columnas, vigas IPE 300, 160, 180)", Unidad: "kg", Cantidad_Contratada: 13948.0, Precio_Unitario: 14500, match_keys: ["perfileria", "hea", "ipe", "metalica", "cubierta", "eternit"] },
      { Item: "5.2", Capitulo: "5. ACERO ESTRUCTURAL", Actividad: "Conexiones para perfiles estructurales (platinas, pernos A325)", Unidad: "kg", Cantidad_Contratada: 185.0, Precio_Unitario: 16500, match_keys: ["conexiones", "platinas"] },
      { Item: "5.3", Capitulo: "5. ACERO ESTRUCTURAL", Actividad: "Mortero autonivelante sin contracción placa base (Sika Grout 212)", Unidad: "und", Cantidad_Contratada: 6.0, Precio_Unitario: 125000, match_keys: ["sika grout", "mortero autonivelante", "grout"] },
      { Item: "6.1", Capitulo: "6. MAMPOSTERIA", Actividad: "Levante de muro en bloque de cemento No. 12 con dovelas", Unidad: "m²", Cantidad_Contratada: 367.5, Precio_Unitario: 48000, match_keys: ["bloque", "mamposteria", "bloques"] },
      { Item: "6.2", Capitulo: "6. MAMPOSTERIA", Actividad: "Viga cinta o superior en concreto reforzado 0.15x0.20", Unidad: "ml", Cantidad_Contratada: 35.0, Precio_Unitario: 45000, match_keys: ["viga cinta"] },
      { Item: "6.3", Capitulo: "6. MAMPOSTERIA", Actividad: "Alfajía remate muro superior en concreto 0.07x0.15", Unidad: "ml", Cantidad_Contratada: 32.0, Precio_Unitario: 38000, match_keys: ["alfajia", "alfajía"] },
      { Item: "6.4", Capitulo: "6. MAMPOSTERIA", Actividad: "Pañete interior relación 1:4 e=0.015", Unidad: "m²", Cantidad_Contratada: 735.0, Precio_Unitario: 24000, match_keys: ["panete", "revoco", "estuco", "pintura"] },
      { Item: "7.1", Capitulo: "7. LIMPIEZA", Actividad: "Limpieza final de obra y entrega técnica", Unidad: "gl", Cantidad_Contratada: 1.0, Precio_Unitario: 1500000, match_keys: ["limpieza final", "entrega"] },
    ],
  },
};

export function loadCustomProjects(): Record<string, ProjectConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_PROJECTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, ProjectConfig>;
  } catch {
    // Ignorar error de parseo local
  }
  return {};
}

export function saveCustomProjects(projects: Record<string, ProjectConfig>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Quota storage fallback
  }
}

export async function fetchBitacoraCloud(): Promise<BitacoraRow[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_obra?select=*&order=id.desc`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function insertBitacoraCloud(payload: {
  fecha: string;
  actividad: string;
  unidad: string;
  cantidad: number;
  desperdicio: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_obra`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 200 || res.status === 201 || res.status === 204) {
      return { ok: true };
    }
    const text = await res.text();
    return { ok: false, error: `HTTP ${res.status}: ${text}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export function formatCOP(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })
    .format(num)
    .replace("$", "$ ");
}

export function formatNum(value: number, decimals = 2): string {
  const num = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function getColombiaNow(): { fechaStr: string; horaStr: string } {
  const now = new Date();
  const fmtDate = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const fmtTime = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return {
    fechaStr: fmtDate.format(now),
    horaStr: fmtTime.format(now),
  };
}

export function formatColombiaTimestamp(iso?: string, fallbackFecha?: string): string {
  if (!iso) return fallbackFecha || "Fecha N/D";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return fallbackFecha || iso;
    return new Intl.DateTimeFormat("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return fallbackFecha || iso;
  }
}
