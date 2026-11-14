import * as THREE from "three";
import { normalizarTexto } from "./calcClient";
import {
  IfcElementRenderData,
  ParsedIfcModel,
} from "./ifcEngine";
import {
  BitacoraRow,
  ClientsProjectData,
  ConsolidationResult,
  GanttTask,
  LiquidationParams,
  PayrollProjectData,
  ProjectConfig,
  SstProjectData,
  SuppliersProjectData,
} from "./types";

export const DEMO_SHOWCASE_PROJECT_ID = "demo_showcase";

function isoOffsetDays(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function buildDemoGanttTasks(): GanttTask[] {
  return [
    {
      id: "1",
      uid: "1",
      wbs: "1",
      nombre: "PHASE 1 — STRUCTURE & MASONRY SHELL",
      capitulo: "1. ESTRUCTURA & CIMENTACIÓN",
      inicio: isoOffsetDays(-20),
      fin: isoOffsetDays(-6),
      duracionDias: 14,
      pesoPct: 0,
      rutaCritica: true,
      esResumen: true,
    },
    {
      id: "2",
      uid: "2",
      wbs: "1.1",
      nombre: "Zapatas y vigas de cimentación f'c=21 MPa",
      capitulo: "1. ESTRUCTURA & CIMENTACIÓN",
      inicio: isoOffsetDays(-20),
      fin: isoOffsetDays(-13),
      duracionDias: 7,
      pesoPct: 18,
      rutaCritica: true,
      responsable: "Cuadrilla Estructura",
      matchItem: "1.1",
    },
    {
      id: "3",
      uid: "3",
      wbs: "1.2",
      nombre: "Columnas y pórtico estructural concreto",
      capitulo: "1. ESTRUCTURA & CIMENTACIÓN",
      inicio: isoOffsetDays(-14),
      fin: isoOffsetDays(-8),
      duracionDias: 6,
      pesoPct: 14,
      rutaCritica: true,
      predecesoras: ["2"],
      responsable: "Cuadrilla Estructura",
      matchItem: "1.2",
    },
    {
      id: "4",
      uid: "4",
      wbs: "1.3",
      nombre: "Muros en mampostería bloque No. 12",
      capitulo: "2. MAMPOSTERÍA & PAÑETES",
      inicio: isoOffsetDays(-10),
      fin: isoOffsetDays(-3),
      duracionDias: 7,
      pesoPct: 13,
      rutaCritica: true,
      predecesoras: ["3"],
      responsable: "Cuadrilla Mampostería",
      matchItem: "2.1",
    },
    {
      id: "5",
      uid: "5",
      wbs: "2",
      nombre: "PHASE 2 — ENVELOPE, FLOORS & INSULATION",
      capitulo: "3. PISOS & ENCHAPES",
      inicio: isoOffsetDays(-6),
      fin: isoOffsetDays(8),
      duracionDias: 14,
      pesoPct: 0,
      rutaCritica: true,
      esResumen: true,
    },
    {
      id: "6",
      uid: "6",
      wbs: "2.1",
      nombre: "Pañete y mortero de revoco en muros",
      capitulo: "2. MAMPOSTERÍA & PAÑETES",
      inicio: isoOffsetDays(-6),
      fin: isoOffsetDays(1),
      duracionDias: 7,
      pesoPct: 10,
      rutaCritica: true,
      predecesoras: ["4"],
      responsable: "Cuadrilla Pañete",
      matchItem: "2.2",
    },
    {
      id: "7",
      uid: "7",
      wbs: "2.2",
      nombre: "Montaje de cubierta termoacústica / Eternit",
      capitulo: "6. CUBIERTA",
      inicio: isoOffsetDays(-7),
      fin: isoOffsetDays(-1),
      duracionDias: 6,
      pesoPct: 10,
      rutaCritica: false,
      predecesoras: ["3"],
      responsable: "Cuadrilla Metálica",
      matchItem: "6.1",
    },
    {
      id: "8",
      uid: "8",
      wbs: "2.3",
      nombre: "Plantilla de concreto e=7cm & piso porcelanato 51x51",
      capitulo: "3. PISOS & ENCHAPES",
      inicio: isoOffsetDays(-2),
      fin: isoOffsetDays(6),
      duracionDias: 8,
      pesoPct: 14,
      rutaCritica: true,
      predecesoras: ["6"],
      responsable: "Cuadrilla Acabados",
      matchItem: "3.1",
    },
    {
      id: "9",
      uid: "9",
      wbs: "2.4",
      nombre: "Cielo raso suspendido + aislamiento Frescasa Eco 2-1/2\"",
      capitulo: "4. CIELOS RASOS & FRESCASA",
      inicio: isoOffsetDays(1),
      fin: isoOffsetDays(8),
      duracionDias: 7,
      pesoPct: 9,
      rutaCritica: true,
      predecesoras: ["7"],
      responsable: "Cuadrilla Liviana",
      matchItem: "4.1",
    },
    {
      id: "10",
      uid: "10",
      wbs: "3",
      nombre: "PHASE 3 — ARCHITECTURAL FINISHES & COMMISSIONING",
      capitulo: "5. CARPINTERÍA & PINTURA",
      inicio: isoOffsetDays(7),
      fin: isoOffsetDays(18),
      duracionDias: 11,
      pesoPct: 0,
      rutaCritica: true,
      esResumen: true,
    },
    {
      id: "11",
      uid: "11",
      wbs: "3.1",
      nombre: "Estuco plástico y pintura vinílica en muros",
      capitulo: "5. CARPINTERÍA & PINTURA",
      inicio: isoOffsetDays(7),
      fin: isoOffsetDays(14),
      duracionDias: 7,
      pesoPct: 7,
      rutaCritica: true,
      predecesoras: ["8", "9"],
      responsable: "Cuadrilla Pintura",
      matchItem: "5.1",
    },
    {
      id: "12",
      uid: "12",
      wbs: "3.2",
      nombre: "Ventanería aluminio y puertas acústicas",
      capitulo: "5. CARPINTERÍA & PINTURA",
      inicio: isoOffsetDays(11),
      fin: isoOffsetDays(17),
      duracionDias: 6,
      pesoPct: 5,
      rutaCritica: true,
      predecesoras: ["9"],
      responsable: "Cuadrilla Carpintería",
      matchItem: "5.2",
    },
    {
      id: "13",
      uid: "13",
      wbs: "3.3",
      nombre: "Milestone: BIM 5D As-Built Handover (ISO 19650)",
      capitulo: "CIERRE",
      inicio: isoOffsetDays(18),
      fin: isoOffsetDays(18),
      duracionDias: 0,
      pesoPct: 0,
      rutaCritica: true,
      esHito: true,
      predecesoras: ["11", "12"],
      responsable: "BIM Manager",
    },
  ];
}

export function getDemoShowcaseProject(): ProjectConfig {
  return {
    id: DEMO_SHOWCASE_PROJECT_ID,
    tipo: "bim",
    nombre: "Northbridge Corporate Hub (BIM 5D Showcase)",
    contratante: "Northbridge Capital Partners",
    cedula_cliente: "",
    contratista: "JGM ConTech Engineering Team",
    cedula_contratista: "",
    cargo_contratista: "Project Controls & BIM 5D Director",
    ubicacion: "Barranquilla / Miami / Madrid • ISO 19650 OpenBIM Demo",
    modelo_bim: "Northbridge_Hub_BIM5D.ifc (OpenBIM Three.js)",
    badge: "ISO 19650 • BIM 5D DEMO",
    logo: "NB",
    firma_residente: "PROJECT DIRECTOR / LEAD ENGINEER\nJGM ConTech Showcase Platform",
    firma_interventor: "OWNER'S REPRESENTATIVE\nNorthbridge Capital Partners",
    a_def: 8.0,
    i_def: 2.0,
    u_def: 5.0,
    ant_def: 20.0,
    gar_def: 5.0,
    ppto_base: [
      {
        Item: "1.1",
        Capitulo: "1. ESTRUCTURA & CIMENTACIÓN",
        Actividad: "Concreto en zapatas y vigas de cimentación f'c=21 MPa",
        Unidad: "m³",
        Cantidad_Contratada: 28.0,
        Precio_Unitario: 685000,
        match_keys: ["zapatas", "vigas de cimentacion", "cimentacion"],
      },
      {
        Item: "1.2",
        Capitulo: "1. ESTRUCTURA & CIMENTACIÓN",
        Actividad: "Concreto en columnas y pórtico estructural f'c=24 MPa",
        Unidad: "m³",
        Cantidad_Contratada: 18.0,
        Precio_Unitario: 790000,
        match_keys: ["columnas", "portico", "pedestal"],
      },
      {
        Item: "2.1",
        Capitulo: "2. MAMPOSTERÍA & PAÑETES",
        Actividad: "Muros en mampostería de bloques de concreto No. 12",
        Unidad: "m²",
        Cantidad_Contratada: 210.0,
        Precio_Unitario: 52000,
        match_keys: ["mamposteria", "bloque", "muros"],
      },
      {
        Item: "2.2",
        Capitulo: "2. MAMPOSTERÍA & PAÑETES",
        Actividad: "Pañete y mortero de revoco en muros dos caras",
        Unidad: "m²",
        Cantidad_Contratada: 420.0,
        Precio_Unitario: 25500,
        match_keys: ["panete", "revoco"],
      },
      {
        Item: "3.1",
        Capitulo: "3. PISOS & ENCHAPES",
        Actividad: "Instalación de piso en porcelanato 51x51 cm y plantilla",
        Unidad: "m²",
        Cantidad_Contratada: 140.0,
        Precio_Unitario: 64000,
        match_keys: ["porcelanato", "plantilla", "piso"],
      },
      {
        Item: "4.1",
        Capitulo: "4. CIELOS RASOS & FRESCASA",
        Actividad: "Cielo raso suspendido Drywall + Aislamiento Frescasa Eco 2-1/2\"",
        Unidad: "m²",
        Cantidad_Contratada: 140.0,
        Precio_Unitario: 56000,
        match_keys: ["cielo raso", "cielorraso", "frescasa", "aislamiento", "drywall"],
      },
      {
        Item: "5.1",
        Capitulo: "5. CARPINTERÍA & PINTURA",
        Actividad: "Estuco plástico y pintura vinílica arquitectónica en muros",
        Unidad: "m²",
        Cantidad_Contratada: 420.0,
        Precio_Unitario: 18000,
        match_keys: ["estuco", "pintura", "vinilica"],
      },
      {
        Item: "5.2",
        Capitulo: "5. CARPINTERÍA & PINTURA",
        Actividad: "Ventanería aluminio termoacústica y puertas interiores",
        Unidad: "und",
        Cantidad_Contratada: 14.0,
        Precio_Unitario: 420000,
        match_keys: ["ventana", "ventaneria", "puerta"],
      },
      {
        Item: "6.1",
        Capitulo: "6. CUBIERTA",
        Actividad: "Montaje de cubierta termoacústica Eternit y caballetes",
        Unidad: "m²",
        Cantidad_Contratada: 155.0,
        Precio_Unitario: 49000,
        match_keys: ["cubierta", "eternit", "teja"],
      },
    ],
    gantt_base: buildDemoGanttTasks(),
    zonas_bim: [
      {
        id: "demo_lobby_piso",
        room: "Lobby Principal",
        activityKey: "enchape",
        activityLabel: "Porcelanato 51x51",
        sourceComment: "Lobby Principal - Porcelanato",
        unit: "m²",
        quantity: 48,
      },
      {
        id: "demo_lobby_cr",
        room: "Lobby Principal",
        activityKey: "cielorraso",
        activityLabel: "Cielo Raso + Frescasa Eco",
        sourceComment: "Lobby Principal - Cielo Raso",
        unit: "m²",
        quantity: 48,
      },
      {
        id: "demo_oficina_piso",
        room: "Oficina Norte",
        activityKey: "enchape",
        activityLabel: "Porcelanato 51x51",
        sourceComment: "Oficina Norte - Porcelanato",
        unit: "m²",
        quantity: 52,
      },
      {
        id: "demo_oficina_cr",
        room: "Oficina Norte",
        activityKey: "cielorraso",
        activityLabel: "Cielo Raso + Frescasa Eco",
        sourceComment: "Oficina Norte - Cielo Raso",
        unit: "m²",
        quantity: 52,
      },
      {
        id: "demo_juntas_piso",
        room: "Sala de Juntas",
        activityKey: "enchape",
        activityLabel: "Porcelanato 51x51",
        sourceComment: "Sala de Juntas - Porcelanato",
        unit: "m²",
        quantity: 40,
      },
      {
        id: "demo_juntas_cr",
        room: "Sala de Juntas",
        activityKey: "cielorraso",
        activityLabel: "Cielo Raso + Frescasa Eco",
        sourceComment: "Sala de Juntas - Cielo Raso",
        unit: "m²",
        quantity: 40,
      },
    ],
  };
}

export function getDemoBitacoraRows(): BitacoraRow[] {
  let nextId = 901;
  const rows: BitacoraRow[] = [];
  const pushShifts = (
    actividad: string,
    unidad: string,
    startOffset: number,
    dailyQtys: number[],
    desperdicio: number
  ) => {
    dailyQtys.forEach((cantidad, idx) => {
      const fecha = isoOffsetDays(startOffset + idx);
      rows.push({
        id: nextId++,
        fecha,
        actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] ${actividad}`,
        unidad,
        cantidad,
        desperdicio,
        created_at: `${fecha}T17:10:00Z`,
      });
    });
  };

  // Real-world daily crew outputs matching Colombia (Construdata/Camacol) & RSMeans benchmarks:
  // 1.1 Footings (3.2 m3/day target -> 8 shifts totaling 28.0 m3 => 3.50 m3/day = 109.4% efficiency)
  pushShifts(
    "Concreto en zapatas y vigas de cimentación f'c=21 MPa",
    "m³",
    -24,
    [3.4, 3.6, 3.5, 3.3, 3.8, 3.4, 3.6, 3.4],
    2.2
  );
  // 1.2 Structural columns (2.4 m3/day target -> 8 shifts totaling 18.0 m3 => 2.25 m3/day = 93.8% efficiency)
  pushShifts(
    "Concreto en columnas y pórtico estructural f'c=24 MPa",
    "m³",
    -19,
    [2.3, 2.4, 2.2, 2.1, 2.3, 2.2, 2.3, 2.2],
    1.8
  );
  // 2.1 CMU concrete block walls (10.5 m2/day target -> 19 shifts totaling 210.0 m2 => 11.05 m2/day = 105.2% efficiency)
  pushShifts(
    "Muros en mampostería de bloques de concreto No. 12",
    "m²",
    -20,
    [
      11.0, 10.5, 11.5, 10.0, 12.0, 11.2, 10.8, 11.5, 10.5, 11.0,
      11.8, 10.6, 11.2, 11.4, 10.8, 11.2, 10.5, 11.5, 11.0,
    ],
    3.5
  );
  // 6.1 Thermo-acoustic corrugated roofing & ridge caps (20.0 m2/day target -> 8 shifts totaling 155.0 m2 => 19.38 m2/day = 96.9% efficiency)
  pushShifts(
    "Montaje de cubierta termoacústica Eternit y caballetes",
    "m²",
    -11,
    [18.5, 19.5, 20.0, 19.0, 20.5, 19.5, 18.0, 20.0],
    2.0
  );
  // 2.2 Two-sided cement stucco plaster (14.0 m2/day target -> 18 shifts totaling 255.0 m2 => 14.17 m2/day = 101.2% efficiency)
  pushShifts(
    "Pañete y mortero de revoco en muros dos caras",
    "m²",
    -18,
    [
      13.8, 14.5, 14.0, 13.5, 14.8, 14.2, 13.6, 14.4, 14.2,
      13.9, 14.6, 14.1, 13.8, 14.5, 14.0, 14.3, 14.6, 14.2,
    ],
    3.2
  );
  // 3.1 Porcelain tile & sub-slab in Main Lobby (9.0 m2/day target -> 6 shifts totaling 48.0 m2 => 8.00 m2/day = 88.9% efficiency - watch front <90%)
  pushShifts(
    "Instalación de piso en porcelanato 51x51 cm y plantilla (Lobby Principal)",
    "m²",
    -6,
    [7.5, 8.0, 7.5, 8.2, 8.3, 8.5],
    4.5
  );

  return rows;
}

export function getDemoSstState(): SstProjectData {
  return {
    diasSinLti: 48,
    horasHombreAcum: 3840,
    permisos: [
      {
        id: "sst-ptar-1",
        codigo: "PTAR-NB-001",
        fecha: isoOffsetDays(0),
        tipo: "alturas",
        frente: "Cubierta Cumbrera — Zona Norte",
        frenteEn: "Roof Ridge Deck — North Bay",
        responsable: "Cuadrilla Metálica (Líder Montaje)",
        responsableEn: "Roofing & Steel Crew (Lead Erector)",
        alturaM: 4.15,
        ptarChecklistOk: true,
        arlVerificada: true,
        estado: "vigente",
        notas: "Línea de vida certificada 22 kN, arnés cuerpo completo y puntos de anclaje revisados.",
        notasEn: "Certified 5,000 lb (22 kN) horizontal lifeline, full-body harness & anchors inspected.",
      },
      {
        id: "sst-ptar-2",
        codigo: "PTAR-NB-002",
        fecha: isoOffsetDays(0),
        tipo: "electrico",
        frente: "Tablero Temporal — Oficina Norte",
        frenteEn: "Temporary Power Panel — North Office",
        responsable: "Técnico Eléctrico Certificado",
        responsableEn: "Licensed Site Electrician",
        ptarChecklistOk: true,
        arlVerificada: true,
        estado: "vigente",
        notas: "Bloqueo y etiquetado LOTO aplicado; prueba de ausencia de tensión con multímetro CAT III.",
        notasEn: "Lockout/Tagout (LOTO) verified; zero-energy check completed with CAT III meter.",
      },
      {
        id: "sst-ptar-3",
        codigo: "PTAR-NB-003",
        fecha: isoOffsetDays(-1),
        tipo: "caliente",
        frente: "Pórtico Eje B — Soldadura Anclajes",
        frenteEn: "Gridline B Frame — Anchor Welding",
        responsable: "Oficial Soldador Certificado",
        responsableEn: "Certified Structural Welder",
        ptarChecklistOk: true,
        arlVerificada: true,
        estado: "pendiente",
        notas: "Pendiente verificación de extintor multipropósito ABC de 20 lb y mampara ignífuga.",
        notasEn: "Pending final check of 20 lb ABC fire extinguisher & spark containment blanket.",
      },
      {
        id: "sst-ptar-4",
        codigo: "PTAR-NB-004",
        fecha: isoOffsetDays(-6),
        tipo: "excavacion",
        frente: "Cimentación Zapatas Z-1 a Z-6",
        frenteEn: "Spread Footings F-1 to F-6",
        responsable: "Cuadrilla Estructura",
        responsableEn: "Structural Concrete Crew",
        alturaM: 1.85,
        ptarChecklistOk: true,
        arlVerificada: true,
        estado: "cerrado",
        notas: "Excavación rellenada y compactada tras vaciado de zapatas sin novedades.",
        notasEn: "Trench backfilled & compacted after footing pour with zero safety findings.",
      },
    ],
    charlas: [
      {
        id: "sst-talk-1",
        fecha: isoOffsetDays(0),
        frente: "Lobby Principal & Cubierta",
        frenteEn: "Main Lobby & Roof Deck",
        tema: "Uso obligatorio de línea de vida, inspección de arnés y orden en zona de corte de porcelanato",
        temaEn: "100% Tie-Off lifeline protocol, harness pre-use inspection & wet-saw silica control",
        instructor: "Coordinación HSE / Inspector SST",
        instructorEn: "HSE Lead / Site Safety Officer",
        asistentes: 14,
        atsCompletado: true,
      },
      {
        id: "sst-talk-2",
        fecha: isoOffsetDays(-1),
        frente: "Oficina Norte — Andamio Tubular",
        frenteEn: "North Office — Tubular Scaffold",
        tema: "Armado seguro de andamios certificados, rodapiés y verificación de bases nivelantes",
        temaEn: "Safe tubular scaffold erection, toe-boards & base-plate leveling check",
        instructor: "Coordinación HSE / Inspector SST",
        instructorEn: "HSE Lead / Site Safety Officer",
        asistentes: 12,
        atsCompletado: true,
      },
      {
        id: "sst-talk-3",
        fecha: isoOffsetDays(-2),
        frente: "Muros Eje Sur — Pañete",
        frenteEn: "South Elevation — Stucco Plaster",
        tema: "Prevención de riesgos químicos con cemento y protección respiratoria/ocular",
        temaEn: "Portland cement skin/eye protection & dust respiratory hazard briefing",
        instructor: "Residente Técnico de Obra",
        instructorEn: "Resident Site Engineer",
        asistentes: 11,
        atsCompletado: true,
      },
    ],
    eppTrabajadores: [
      {
        id: "sst-w-1",
        codigo: "NBR-01",
        rol: "Líder Estructuras y Concreto",
        rolEn: "Structural Concrete Lead Tech",
        cuadrilla: "Cuadrilla Estructura",
        cargoCertAltura: true,
        venceCertAltura: isoOffsetDays(180),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: true,
        guantes: true,
        gafas: true,
      },
      {
        id: "sst-w-2",
        codigo: "NBR-02",
        rol: "Montador Cubierta Metálica #1",
        rolEn: "Roof & Steel Erector #1",
        cuadrilla: "Cuadrilla Metálica",
        cargoCertAltura: true,
        venceCertAltura: isoOffsetDays(95),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: true,
        guantes: true,
        gafas: true,
      },
      {
        id: "sst-w-3",
        codigo: "NBR-03",
        rol: "Oficial Mampostería & Pañete #1",
        rolEn: "Masonry & Stucco Lead #1",
        cuadrilla: "Cuadrilla Mampostería",
        cargoCertAltura: true,
        venceCertAltura: isoOffsetDays(210),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: true,
        guantes: true,
        gafas: true,
      },
      {
        id: "sst-w-4",
        codigo: "NBR-04",
        rol: "Enchapador Acabados & Porcelanato",
        rolEn: "Porcelain Flooring Specialist",
        cuadrilla: "Cuadrilla Acabados",
        cargoCertAltura: false,
        venceCertAltura: isoOffsetDays(12),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: false,
        guantes: true,
        gafas: true,
      },
      {
        id: "sst-w-5",
        codigo: "NBR-05",
        rol: "Ayudante Logística & Cielo Raso",
        rolEn: "Ceiling & Logistics Helper",
        cuadrilla: "Cuadrilla Liviana",
        cargoCertAltura: true,
        venceCertAltura: isoOffsetDays(145),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: true,
        guantes: true,
        gafas: false,
      },
    ],
    incidentes: [
      {
        id: "sst-inc-1",
        fecha: isoOffsetDays(-1),
        tipo: "condicion_insegura",
        frente: "Cubierta Borde Alero Este",
        frenteEn: "Roof East Eave Perimeter",
        descripcion: "Falta de rodapié perimetral en plataforma auxiliar previo a fijación de caballete.",
        descripcionEn: "Missing toe-board on auxiliary work platform prior to ridge cap installation.",
        accionCapa: "Instalar rodapié de 15 cm y señalizar zona de exclusión inferior con cinta.",
        accionCapaEn: "Install 6-inch toe-board and barricade lower drop zone perimeter.",
        responsable: "Cuadrilla Metálica",
        fechaLimite: isoOffsetDays(1),
        cerrado: false,
      },
      {
        id: "sst-inc-2",
        fecha: isoOffsetDays(-4),
        tipo: "cuasi_accidente",
        frente: "Lobby Principal — Zona Corte",
        frenteEn: "Main Lobby — Tile Cutting Bay",
        descripcion: "Extensión eléctrica sin protección GFCI cruzando zona húmeda de cortadora.",
        descripcionEn: "Power cord lacking GFCI protection routed across wet tile-saw floor zone.",
        accionCapa: "Reubicar cable aéreo sobre ganchos aislados e instalar tablero con diferencial GFCI.",
        accionCapaEn: "Elevate cord on insulated hooks and connect through GFCI-protected breaker box.",
        responsable: "Inspector SST / Eléctrico",
        fechaLimite: isoOffsetDays(-3),
        cerrado: true,
      },
    ],
  };
}

export function getDemoPayrollState(data: ConsolidationResult): PayrollProjectData {
  const findQty = (itemCode: string, fallback: number): number => {
    const match = data.df_5d.find((r) => String(r.Item) === itemCode);
    return match ? Number(match.Cantidad_Ejecutada || 0) : fallback;
  };

  return {
    periodo: isoOffsetDays(-14).slice(0, 7) + " Q1",
    registros: [
      {
        id: "pay-nb-1",
        codigo: "EMP-01",
        nombreRol: "Dirección Residente de Obra",
        nombreRolEn: "Resident Civil Engineer",
        especialidad: "Dirección Técnica & Control 4D/5D",
        especialidadEn: "Site Supervision & 4D/5D Controls",
        modalidad: "jornal",
        unidadPago: "día",
        tarifaBaseCop: 165000,
        diasTrabajados: 12,
        horasExtra: 4,
        cantidadDestajoMetric: 0,
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "aprobada",
        notas: "Control técnico de frente estructural y cierre de bitácora BIM.",
      },
      {
        id: "pay-nb-2",
        codigo: "EMP-02",
        nombreRol: "Inspector HSE / Coordinación SST",
        nombreRolEn: "Site HSE / Safety Inspector",
        especialidad: "Seguridad Industrial & PTAR",
        especialidadEn: "OSHA / ISO 45001 Safety Compliance",
        modalidad: "jornal",
        unidadPago: "día",
        tarifaBaseCop: 120000,
        diasTrabajados: 12,
        horasExtra: 2,
        cantidadDestajoMetric: 0,
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "aprobada",
        notas: "Inspecciones PTAR alturas, charlas diarias y matriz EPP.",
      },
      {
        id: "pay-nb-3",
        codigo: "EMP-03",
        nombreRol: "Almacenista & Pañol de Obra",
        nombreRolEn: "Warehouse & Tool Crib Lead",
        especialidad: "Kardex Materiales & Custodia",
        especialidadEn: "Inventory Control & Tool Custody",
        modalidad: "jornal",
        unidadPago: "día",
        tarifaBaseCop: 95000,
        diasTrabajados: 12,
        horasExtra: 0,
        cantidadDestajoMetric: 0,
        prestamoDescuentoCop: 80000,
        afiliadoArlRiesgoV: true,
        estado: "pagada",
        notas: "Descuento cuota #2 préstamo herramienta menor.",
      },
      {
        id: "pay-nb-4",
        codigo: "CREW-21",
        nombreRol: "Cuadrilla Mampostería (1 Of + 1 Ayud)",
        nombreRolEn: "Masonry Crew (1 Lead + 1 Helper)",
        especialidad: "Muros bloque concreto No. 12",
        especialidadEn: "Concrete Masonry Unit (CMU) Walls",
        modalidad: "destajo",
        unidadPago: "m²",
        tarifaBaseCop: 22000,
        diasTrabajados: 10,
        horasExtra: 0,
        cantidadDestajoMetric: findQty("2.1", 210),
        actividadMatchItem: "2.1",
        prestamoDescuentoCop: 150000,
        afiliadoArlRiesgoV: true,
        estado: "aprobada",
        notas: "Corte quincenal medido 100% contra BIM Bitácora.",
      },
      {
        id: "pay-nb-5",
        codigo: "CREW-22",
        nombreRol: "Cuadrilla Pañete & Revoco (1 Of + 1 Ayud)",
        nombreRolEn: "Plastering Crew (1 Lead + 1 Helper)",
        especialidad: "Pañete y mortero dos caras",
        especialidadEn: "Two-Sided Cement Stucco Screeding",
        modalidad: "destajo",
        unidadPago: "m²",
        tarifaBaseCop: 14500,
        diasTrabajados: 9,
        horasExtra: 0,
        cantidadDestajoMetric: findQty("2.2", 255),
        actividadMatchItem: "2.2",
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "borrador",
        notas: "Avance parcial sujeto a recibo de plomo e hilada.",
      },
      {
        id: "pay-nb-6",
        codigo: "CREW-31",
        nombreRol: "Cuadrilla Pisos & Enchapes",
        nombreRolEn: "Porcelain Flooring Crew",
        especialidad: "Piso porcelanato 51x51 cm + plantilla",
        especialidadEn: "20\"x20\" Porcelain Tile & Sub-Slab",
        modalidad: "destajo",
        unidadPago: "m²",
        tarifaBaseCop: 26000,
        diasTrabajados: 6,
        horasExtra: 0,
        cantidadDestajoMetric: findQty("3.1", 48),
        actividadMatchItem: "3.1",
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "borrador",
        notas: "Ejecución Lobby Principal verificada en zonas BIM.",
      },
      {
        id: "pay-nb-7",
        codigo: "CREW-61",
        nombreRol: "Cuadrilla Cubierta Metálica (2 Montadores)",
        nombreRolEn: "Roofing & Steel Crew (2 Erectors)",
        especialidad: "Montaje cubierta termoacústica y caballetes",
        especialidadEn: "Thermo-Acoustic Roofing & Ridge Assembly",
        modalidad: "destajo",
        unidadPago: "m²",
        tarifaBaseCop: 21000,
        diasTrabajados: 8,
        horasExtra: 0,
        cantidadDestajoMetric: findQty("6.1", 155),
        actividadMatchItem: "6.1",
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "aprobada",
        notas: "Cubierta 100% instalada con PTAR Alturas #001 cerrado/aprobado.",
      },
    ],
  };
}

export function getDemoSuppliersState(): SuppliersProjectData {
  return {
    proveedores: [
      {
        id: "sup-nb-1",
        codigo: "PROV-01",
        razonSocial: "Northbridge Ready-Mix & Precast",
        razonSocialEn: "Northbridge Ready-Mix & Precast",
        nitTaxId: "TAX-900-412-001",
        categoria: "concreto",
        especialidad: "Concreto Premezclado f'c 21 / 24 MPa + Bombeo",
        especialidadEn: "Ready-Mix Concrete 3,000 / 3,500 PSI & Pump",
        contactoRol: "Despacho Planta Central",
        condicionPago: "Crédito 15 días",
        condicionPagoEn: "Net 15",
        calificacion: 4.9,
        retencionPct: 2.5,
      },
      {
        id: "sup-nb-2",
        codigo: "PROV-02",
        razonSocial: "Aceros & Bloques Estructurales S.A.",
        razonSocialEn: "Andina Structural Steel & CMU Supply",
        nitTaxId: "TAX-900-518-044",
        categoria: "aceros_mamposteria",
        especialidad: "Bloque No. 12, Acero Refuerzo y Cemento Tipo I",
        especialidadEn: "CMU Blocks, Rebar & Type-I Structural Cement",
        contactoRol: "Asesor Comercial Mayorista",
        condicionPago: "Crédito 30 días",
        condicionPagoEn: "Net 30",
        calificacion: 4.7,
        retencionPct: 2.5,
      },
      {
        id: "sup-nb-3",
        codigo: "PROV-03",
        razonSocial: "Porcelana & Drywall Architectural Co.",
        razonSocialEn: "Porcelana & Drywall Architectural Co.",
        nitTaxId: "TAX-800-741-920",
        categoria: "acabados",
        especialidad: "Porcelanato 51x51 cm, Drywall, Frescasa Eco y Pintura",
        especialidadEn: '20"x20" Porcelain Tile, Drywall & Acoustic Insulation',
        contactoRol: "Coordinación Logística Acabados",
        condicionPago: "Crédito 15 días",
        condicionPagoEn: "Net 15",
        calificacion: 4.6,
        retencionPct: 2.5,
      },
      {
        id: "sup-nb-4",
        codigo: "PROV-04",
        razonSocial: "Eternit & Thermal Aluminum Envelope",
        razonSocialEn: "Eternit & Thermal Aluminum Envelope",
        nitTaxId: "TAX-901-203-774",
        categoria: "cubierta_carpinteria",
        especialidad: "Cubierta Termoacústica, Ventanería Aluminio & Puertas",
        especialidadEn: "Thermo-Acoustic Roofing, Aluminum Glazing & Doors",
        contactoRol: "Ingeniería de Envolvente",
        condicionPago: "50% Anticipo / 50% Entrega",
        condicionPagoEn: "50% Deposit / 50% Delivery",
        calificacion: 4.8,
        retencionPct: 4.0,
      },
      {
        id: "sup-nb-5",
        codigo: "PROV-05",
        razonSocial: "CertiSafe Industrial PPE & Anchors",
        razonSocialEn: "CertiSafe Industrial PPE & Anchors",
        nitTaxId: "TAX-901-609-118",
        categoria: "equipos_sst",
        especialidad: "Arneses ANSI Z359, Líneas de Vida, Cascos y Botas",
        especialidadEn: "ANSI Z359 Harnesses, Lifelines & Jobsite PPE",
        contactoRol: "Suministro HSE Certificado",
        condicionPago: "Contado",
        condicionPagoEn: "Due on Receipt",
        calificacion: 5.0,
        retencionPct: 0,
      },
    ],
    ordenes: [
      {
        id: "oc-nb-101",
        codigo: "OC-NB-101",
        fecha: isoOffsetDays(-19),
        fechaEntrega: isoOffsetDays(-14),
        proveedorId: "sup-nb-1",
        proveedorNombre: "Northbridge Ready-Mix & Precast",
        concepto: "Concreto Premezclado Zapatas y Columnas (21/24 MPa)",
        conceptoEn: "Ready-Mix Concrete Footings & Columns (3,000/3,500 PSI)",
        unidad: "m³",
        cantidad: 46,
        precioUnitarioCop: 525000,
        bimMaterialMatch: "Concreto Premezclado",
        porcentajeRecibido: 100,
        pagadoCop: 24150000,
        estado: "pagada",
        notas: "Despachos 100% verificados con cilindros ASTM C39.",
      },
      {
        id: "oc-nb-102",
        codigo: "OC-NB-102",
        fecha: isoOffsetDays(-15),
        fechaEntrega: isoOffsetDays(-10),
        proveedorId: "sup-nb-2",
        proveedorNombre: "Aceros & Bloques Estructurales S.A.",
        concepto: "Bloque de Concreto No. 12 + Cemento Gris Sacos 50kg",
        conceptoEn: "CMU Concrete Block No. 12 + Type-I Cement Bags",
        unidad: "m²",
        cantidad: 210,
        precioUnitarioCop: 41000,
        bimMaterialMatch: "Bloque de Concreto No. 12",
        porcentajeRecibido: 100,
        pagadoCop: 4305000,
        estado: "recibida",
        notas: "Material completo en patio; saldo pendiente vencimiento 30d.",
      },
      {
        id: "oc-nb-103",
        codigo: "OC-NB-103",
        fecha: isoOffsetDays(-11),
        fechaEntrega: isoOffsetDays(-6),
        proveedorId: "sup-nb-4",
        proveedorNombre: "Eternit & Thermal Aluminum Envelope",
        concepto: "Teja Ondulada Termoacústica Eternit y Caballetes",
        conceptoEn: "Thermo-Acoustic Corrugated Roof Panels & Ridge Caps",
        unidad: "m²",
        cantidad: 155,
        precioUnitarioCop: 58000,
        bimMaterialMatch: "Cubierta Termoacústica",
        porcentajeRecibido: 100,
        pagadoCop: 8990000,
        estado: "pagada",
        notas: "Instalación completada al 100% según Bitácora.",
      },
      {
        id: "oc-nb-104",
        codigo: "OC-NB-104",
        fecha: isoOffsetDays(-4),
        fechaEntrega: isoOffsetDays(2),
        proveedorId: "sup-nb-3",
        proveedorNombre: "Porcelana & Drywall Architectural Co.",
        concepto: 'Porcelanato 51x51 cm Tráfico 5 + Rollos Frescasa Eco 2-1/2"',
        conceptoEn: '20"x20" Porcelain Floor Tile + Frescasa Eco 2-1/2" Rolls',
        unidad: "m²",
        cantidad: 140,
        precioUnitarioCop: 74000,
        bimMaterialMatch: "Porcelanato 51x51",
        porcentajeRecibido: 45,
        pagadoCop: 4144000,
        estado: "en_obra",
        notas: "Primer lote entregado en Lobby Principal; saldo drywall en tránsito.",
      },
      {
        id: "oc-nb-105",
        codigo: "OC-NB-105",
        fecha: isoOffsetDays(-1),
        fechaEntrega: isoOffsetDays(5),
        proveedorId: "sup-nb-4",
        proveedorNombre: "Eternit & Thermal Aluminum Envelope",
        concepto: "Ventanería Aluminio Termoacústica y Puertas Acceso (14 und)",
        conceptoEn: "Thermo-Acoustic Aluminum Windows & Interior Doors (14 ea)",
        unidad: "und",
        cantidad: 14,
        precioUnitarioCop: 820000,
        bimMaterialMatch: "Ventanería Aluminio",
        porcentajeRecibido: 0,
        pagadoCop: 5740000,
        estado: "emitida",
        notas: "Anticipo 50% pagado para fabricación en taller de aluminio.",
      },
    ],
  };
}

export function getDemoClientsState(
  proyecto: ProjectConfig,
  data: ConsolidationResult,
  params: LiquidationParams
): ClientsProjectData {
  const pctAiu = (params.pct_a + params.pct_i + params.pct_u) / 100;
  const valorContrato = Math.round(data.totals.total_ppto_contratado * (1 + pctAiu));
  const ejecutadoBruto = Math.round(data.totals.total_costo_ejecutado * (1 + pctAiu));

  const pctAnt = params.pct_anticipo / 100;
  const pctGar = params.pct_garantia / 100;
  const pctIvaSobreU = (params.pct_u / 100) * 0.19;

  // Anticipo contractual (20% sobre total contratado)
  const anticipoBruto = Math.round(valorContrato * (pctAnt > 0 ? pctAnt : 0.2));

  // Acta #1: Primer tramo (aprox 55% de lo ejecutado actual) ya aprobado y recaudado
  const acta1Bruto = Math.max(12000000, Math.round(ejecutadoBruto * 0.55));
  const acta1Ant = Math.round(acta1Bruto * pctAnt);
  const acta1Gar = Math.round(acta1Bruto * pctGar);
  const acta1Iva = Math.round(
    (acta1Bruto / (1 + pctAiu)) * pctIvaSobreU
  );
  const acta1Neto = acta1Bruto - acta1Ant - acta1Gar + acta1Iva;

  // Acta #2: Segundo tramo (aprox 35% de lo ejecutado actual) radicada por cobrar
  const acta2Bruto = Math.max(6000000, Math.round(ejecutadoBruto * 0.35));
  const acta2Ant = Math.round(acta2Bruto * pctAnt);
  const acta2Gar = Math.round(acta2Bruto * pctGar);
  const acta2Iva = Math.round(
    (acta2Bruto / (1 + pctAiu)) * pctIvaSobreU
  );

  return {
    clienteNombre: proyecto.contratante || "Northbridge Capital Partners",
    clienteIdFiscal: "ENTITY-US-CO-901884210",
    representanteRol: "Gerencia de Inversión & Interventoría",
    representanteRolEn: "Capital Investment & Owner's Rep",
    condicionCobro: "Actas Quincenales • Pago 15 días radicación",
    condicionCobroEn: "Bi-weekly Progress Certificates • Net 15",
    cupoAprobadoCop: Math.round(valorContrato * 1.15),
    facturas: [
      {
        id: "cli-nb-1",
        numero: "ANT-NB-001",
        fechaEmision: isoOffsetDays(-21),
        fechaVencimiento: isoOffsetDays(-16),
        tipo: "anticipo",
        concepto: "Anticipo Contractual Inicial (Inicio Obra BIM 5D)",
        conceptoEn: "Contract Mobilization Advance Payment (BIM 5D Kickoff)",
        valorBrutoCop: anticipoBruto,
        amortizacionAnticipoCop: 0,
        retencionGarantiaCop: 0,
        ivaCop: 0,
        recaudadoCop: anticipoBruto,
        estado: "pagada",
        notas: "Desembolso completo contra póliza de buen manejo de anticipo.",
      },
      {
        id: "cli-nb-2",
        numero: "ACTA-NB-001",
        fechaEmision: isoOffsetDays(-10),
        fechaVencimiento: isoOffsetDays(-2),
        tipo: "acta_avance",
        concepto: "Acta de Corte #1 — Cimentación, Estructura & Cubierta",
        conceptoEn: "Progress Certificate #1 — Foundations, Frame & Roof Deck",
        valorBrutoCop: acta1Bruto,
        amortizacionAnticipoCop: acta1Ant,
        retencionGarantiaCop: acta1Gar,
        ivaCop: acta1Iva,
        recaudadoCop: acta1Neto,
        estado: "pagada",
        notas: "Aprobada por Interventoría contra corte físico 3D/Bitácora.",
      },
      {
        id: "cli-nb-3",
        numero: "ACTA-NB-002",
        fechaEmision: isoOffsetDays(-1),
        fechaVencimiento: isoOffsetDays(14),
        tipo: "acta_avance",
        concepto: "Acta de Corte #2 — Mampostería, Pañetes & Porcelanato Parcial",
        conceptoEn: "Progress Certificate #2 — CMU Walls, Stucco & Partial Flooring",
        valorBrutoCop: acta2Bruto,
        amortizacionAnticipoCop: acta2Ant,
        retencionGarantiaCop: acta2Gar,
        ivaCop: acta2Iva,
        recaudadoCop: 0,
        estado: "radicada",
        notas: "Radicada para aprobación y desembolso dentro de 15 días.",
      },
    ],
  };
}

/**
 * Genera un gemelo digital 3D paramétrico en Three.js compatible con ParsedIfcModel
 * para demostraciones públicas en LinkedIn o previsualización sin cargar archivos .IFC locales.
 */
export function buildShowcaseIfcModel(
  projectName = "Northbridge Showcase",
  lang: "es" | "en" = "es"
): ParsedIfcModel {
  const isEn = lang === "en";
  const L = (esText: string, enText: string) => (isEn ? enText : esText);

  const elements: IfcElementRenderData[] = [];
  const boundingBox = new THREE.Box3();
  let nextId = 1001;

  const pushGeometry = (opts: {
    ifcType: string;
    name: string;
    objectType: string;
    comments: string;
    level: string;
    material: string;
    bimTags?: string;
    color: number;
    opacity?: number;
    geom: THREE.BufferGeometry;
  }) => {
    opts.geom.computeVertexNormals();
    opts.geom.computeBoundingBox();
    if (opts.geom.boundingBox) {
      boundingBox.union(opts.geom.boundingBox);
    }

    const searchTextNorm = normalizarTexto(
      `${opts.ifcType} ${opts.name} ${opts.objectType} ${opts.comments} ${opts.material} ${opts.level} ${opts.bimTags || ""}`
    );

    const id = nextId++;
    elements.push({
      expressID: id,
      meta: {
        expressID: id,
        ifcType: opts.ifcType,
        name: opts.name,
        objectType: opts.objectType,
        description: `${projectName} OpenBIM Element`,
        tag: `BIM-${id}`,
        comments: opts.comments,
        level: opts.level,
        materialNames: [opts.material],
        rawProps: {
          "GlobalId / Tag": `NB-${id}`,
          Pset_BIM5D: opts.comments,
          Material: opts.material,
        },
        searchTextNorm,
      },
      parts: [
        {
          geometry: opts.geom,
          originalColor: new THREE.Color(opts.color),
          originalOpacity: opts.opacity ?? 1,
        },
      ],
    });
  };

  const pushBox = (opts: {
    ifcType: string;
    name: string;
    objectType: string;
    comments: string;
    level: string;
    material: string;
    bimTags?: string;
    color: number;
    opacity?: number;
    w: number;
    h: number;
    d: number;
    x: number;
    y: number;
    z: number;
    rotZ?: number;
  }) => {
    const geom = new THREE.BoxGeometry(opts.w, opts.h, opts.d);
    if (opts.rotZ) {
      geom.rotateZ(opts.rotZ);
    }
    geom.translate(opts.x, opts.y, opts.z);
    pushGeometry({ ...opts, geom });
  };

  // Structural envelope geometry constants (in meters):
  // Footprint frame centers X in [-5.5, 5.5], Z in [-3.5, 3.5]
  // Eave bottom: 3.20 m | Ridge underside: 4.15 m
  const EAVE_Y = 3.2;
  const RIDGE_Y = 4.15;
  const HALF_SPAN = 5.5;
  const HALF_DEPTH = 3.5;
  const ROOF_SLOPE_RAD = Math.atan2(RIDGE_Y - EAVE_Y, HALF_SPAN);

  // 1. Spread footings, grade tie-beams, columns, upper bond beams & rafters
  const colPositions: [number, number][] = [
    [-5.5, -3.5],
    [0, -3.5],
    [5.5, -3.5],
    [-5.5, 3.5],
    [0, 3.5],
    [5.5, 3.5],
  ];
  colPositions.forEach(([cx, cz], idx) => {
    const isCenterRidgeCol = Math.abs(cx) < 0.01;
    const colTopY = isCenterRidgeCol ? RIDGE_Y : EAVE_Y;

    pushBox({
      ifcType: "IFCFOOTING",
      name: L(`Zapata Cimentación Z-${idx + 1}`, `Spread Footing F-${idx + 1}`),
      objectType: "Footing: Rectangular Concrete 110x110cm",
      comments: L("Zapatas y vigas de cimentación", "Spread footings & grade beams"),
      bimTags: "zapatas vigas de cimentacion cimentacion",
      level: L("Nivel 0 - Cimentación", "Level 0 - Foundations"),
      material: isEn ? "Reinforced Concrete f'c=3,000 PSI" : "Concreto f'c=21 MPa",
      color: 0x64748b,
      w: 1.1,
      h: 0.35,
      d: 1.1,
      x: cx,
      y: -0.175,
      z: cz,
    });
    pushBox({
      ifcType: "IFCCOLUMN",
      name: L(
        `Columna Estructural C-${idx + 1}${isCenterRidgeCol ? " (Cumbrera)" : ""}`,
        `Structural Column C-${idx + 1}${isCenterRidgeCol ? " (Ridge)" : ""}`
      ),
      objectType: "Column: Reinforced Concrete 32x32cm",
      comments: L("Columnas y pórtico estructural", "Structural frame columns"),
      bimTags: "columnas portico pedestal",
      level: L("Nivel 1", "Level 1"),
      material: isEn ? "Reinforced Concrete f'c=3,500 PSI" : "Concreto f'c=24 MPa",
      color: 0x94a3b8,
      w: 0.32,
      h: colTopY,
      d: 0.32,
      x: cx,
      y: colTopY / 2,
      z: cz,
    });
  });

  // Ground grade beams tying all 6 footings continuously
  ([-3.5, 3.5] as const).forEach((gz, i) => {
    pushBox({
      ifcType: "IFCBEAM",
      name: L(
        `Viga de Cimentación Longitudinal VC-${i + 1}`,
        `Longitudinal Grade Beam GB-${i + 1}`
      ),
      objectType: "Beam: Concrete Grade Tie-Beam 30x28cm",
      comments: L("Zapatas y vigas de cimentación", "Spread footings & grade beams"),
      bimTags: "zapatas vigas de cimentacion cimentacion",
      level: L("Nivel 0 - Cimentación", "Level 0 - Foundations"),
      material: isEn ? "Reinforced Concrete f'c=3,000 PSI" : "Concreto f'c=21 MPa",
      color: 0x64748b,
      w: 11.32,
      h: 0.28,
      d: 0.3,
      x: 0,
      y: -0.02,
      z: gz,
    });
  });
  ([-5.5, 0, 5.5] as const).forEach((gx, i) => {
    pushBox({
      ifcType: "IFCBEAM",
      name: L(
        `Viga de Cimentación Transversal VCT-${i + 1}`,
        `Transverse Grade Beam TGB-${i + 1}`
      ),
      objectType: "Beam: Concrete Grade Tie-Beam 30x28cm",
      comments: L("Zapatas y vigas de cimentación", "Spread footings & grade beams"),
      bimTags: "zapatas vigas de cimentacion cimentacion",
      level: L("Nivel 0 - Cimentación", "Level 0 - Foundations"),
      material: isEn ? "Reinforced Concrete f'c=3,000 PSI" : "Concreto f'c=21 MPa",
      color: 0x64748b,
      w: 0.3,
      h: 0.28,
      d: 7.0,
      x: gx,
      y: -0.02,
      z: 0,
    });
  });

  // Upper eave bond beams (connect corner columns & support roof eaves cleanly)
  ([-5.5, 5.5] as const).forEach((ex, i) => {
    pushBox({
      ifcType: "IFCBEAM",
      name: L(
        `Viga Corona / Amarre Alero VA-${i + 1}`,
        `Perimeter Eave Bond Beam EBB-${i + 1}`
      ),
      objectType: "Beam: Concrete Eave Tie-Beam 32x25cm",
      comments: L("Columnas y pórtico estructural", "Structural frame columns & tie beams"),
      bimTags: "columnas portico pedestal",
      level: L("Cubierta", "Roof Level"),
      material: isEn ? "Reinforced Concrete f'c=3,500 PSI" : "Concreto f'c=24 MPa",
      color: 0x94a3b8,
      w: 0.32,
      h: 0.25,
      d: 7.32,
      x: ex,
      y: EAVE_Y - 0.125,
      z: 0,
    });
  });

  // Center structural ridge beam connecting C-2 and C-5 directly beneath roof apex
  pushBox({
    ifcType: "IFCBEAM",
    name: L("Viga Estructural de Cumbrera VC-01", "Structural Ridge Beam RB-01"),
    objectType: "Beam: Concrete / Steel Ridge Girder",
    comments: L("Columnas y pórtico estructural", "Structural frame columns & ridge beam"),
    bimTags: "columnas portico cubierta techo",
    level: L("Cubierta", "Roof Level"),
    material: isEn ? "Reinforced Concrete f'c=3,500 PSI" : "Concreto f'c=24 MPa",
    color: 0x94a3b8,
    w: 0.3,
    h: 0.25,
    d: 7.32,
    x: 0,
    y: RIDGE_Y - 0.125,
    z: 0,
  });

  // Sloped structural frame rafters connecting center ridge column to corner eave columns
  const halfSlopeLen = Math.hypot(HALF_SPAN, RIDGE_Y - EAVE_Y);
  ([-3.5, 3.5] as const).forEach((rz, zi) => {
    pushBox({
      ifcType: "IFCBEAM",
      name: L(`Viga Inclinada Pórtico Oeste VI-O${zi + 1}`, `Sloped Rafter Beam West SRB-W${zi + 1}`),
      objectType: "Beam: Sloped Concrete Portal Rafter",
      comments: L("Columnas y pórtico estructural", "Sloped structural portal rafters"),
      bimTags: "columnas portico cubierta",
      level: L("Cubierta", "Roof Level"),
      material: isEn ? "Reinforced Concrete f'c=3,500 PSI" : "Concreto f'c=24 MPa",
      color: 0x94a3b8,
      w: halfSlopeLen,
      h: 0.22,
      d: 0.28,
      x: -HALF_SPAN / 2,
      y: (RIDGE_Y + EAVE_Y) / 2 - 0.11,
      z: rz,
      rotZ: ROOF_SLOPE_RAD,
    });
    pushBox({
      ifcType: "IFCBEAM",
      name: L(`Viga Inclinada Pórtico Este VI-E${zi + 1}`, `Sloped Rafter Beam East SRB-E${zi + 1}`),
      objectType: "Beam: Sloped Concrete Portal Rafter",
      comments: L("Columnas y pórtico estructural", "Sloped structural portal rafters"),
      bimTags: "columnas portico cubierta",
      level: L("Cubierta", "Roof Level"),
      material: isEn ? "Reinforced Concrete f'c=3,500 PSI" : "Concreto f'c=24 MPa",
      color: 0x94a3b8,
      w: halfSlopeLen,
      h: 0.22,
      d: 0.28,
      x: HALF_SPAN / 2,
      y: (RIDGE_Y + EAVE_Y) / 2 - 0.11,
      z: rz,
      rotZ: -ROOF_SLOPE_RAD,
    });
  });

  // 2. Interior porcelain floor slabs (flush inside perimeter masonry walls, zero overhang)
  pushBox({
    ifcType: "IFCSLAB",
    name: L("Piso Porcelanato 51x51 - Lobby Principal", "20x20 Porcelain Floor - Main Lobby"),
    objectType: "Floor: Porcelain Tile + Leveling Sub-Slab",
    comments: L("Lobby Principal - Porcelanato", "Main Lobby - Porcelain Tile"),
    bimTags: "lobby principal porcelanato piso plantilla",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Executive Gray Porcelain Tile" : "Porcelanato Gris Ejecutivo",
    color: 0xdbeafe,
    w: 5.335,
    h: 0.12,
    d: 6.82,
    x: -2.7425,
    y: 0.06,
    z: 0,
  });
  pushBox({
    ifcType: "IFCSLAB",
    name: L("Piso Porcelanato 51x51 - Oficina Norte", "20x20 Porcelain Floor - North Office"),
    objectType: "Floor: Porcelain Tile + Leveling Sub-Slab",
    comments: L("Oficina Norte - Porcelanato", "North Office - Porcelain Tile"),
    bimTags: "oficina norte porcelanato piso plantilla",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Executive Gray Porcelain Tile" : "Porcelanato Gris Ejecutivo",
    color: 0xe2e8f0,
    w: 5.335,
    h: 0.12,
    d: 3.335,
    x: 2.7425,
    y: 0.06,
    z: -1.7425,
  });
  pushBox({
    ifcType: "IFCSLAB",
    name: L("Piso Porcelanato 51x51 - Sala de Juntas", "20x20 Porcelain Floor - Boardroom"),
    objectType: "Floor: Porcelain Tile + Leveling Sub-Slab",
    comments: L("Sala de Juntas - Porcelanato", "Boardroom - Porcelain Tile"),
    bimTags: "sala de juntas porcelanato piso plantilla",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Executive Gray Porcelain Tile" : "Porcelanato Gris Ejecutivo",
    color: 0xe2e8f0,
    w: 5.335,
    h: 0.12,
    d: 3.335,
    x: 2.7425,
    y: 0.06,
    z: 1.7425,
  });

  // 3. Full-height Perimeter & Partition Masonry Walls (tight column-to-column & up to bond beam)
  // Posterior wall: X in [-5.34, +5.34], Y in [0.12, 3.20]
  pushBox({
    ifcType: "IFCWALL",
    name: L("Muro Perimetral Posterior - Mampostería Bloque No. 12", "Rear Perimeter Wall - CMU Block No. 12"),
    objectType: "Basic Wall: CMU No. 12 + Stucco Plaster",
    comments: L("Mampostería y Pañete Muros", "Masonry & Two-Side Plaster"),
    bimTags: "mamposteria bloque muros panete revoco",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU Concrete Block No. 12" : "Bloque Concreto No. 12",
    color: 0xcbd5e1,
    w: 10.68,
    h: 3.08,
    d: 0.18,
    x: 0,
    y: 1.66,
    z: -HALF_DEPTH,
  });
  // Left & Right side walls: Z in [-3.34, +3.34], Y in [0.12, 2.95] meeting eave bond beams flush
  pushBox({
    ifcType: "IFCWALL",
    name: L("Muro Lateral Oeste - Estuco y Pintura", "West Exterior Wall - Stucco & Paint"),
    objectType: "Basic Wall: Skim Coat & Architectural Paint",
    comments: L("Estuco plástico y pintura", "Skim coat & latex paint"),
    bimTags: "estuco pintura vinilica mamposteria muros",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Skim Coat + Latex Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 0.18,
    h: 2.83,
    d: 6.68,
    x: -HALF_SPAN,
    y: 1.535,
    z: 0,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Muro Lateral Este - Mampostería Bloque No. 12", "East Exterior Wall - CMU Block No. 12"),
    objectType: "Basic Wall: CMU No. 12 + Finish",
    comments: L("Mampostería Bloque 12", "CMU Block No. 12"),
    bimTags: "mamposteria bloque muros",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU Concrete Block No. 12" : "Bloque Concreto No. 12",
    color: 0xcbd5e1,
    w: 0.18,
    h: 2.83,
    d: 6.68,
    x: HALF_SPAN,
    y: 1.535,
    z: 0,
  });

  // Front facade framed masonry piers, sills, and lintel headers (eliminates gaps around windows & door)
  pushBox({
    ifcType: "IFCWALL",
    name: L("Antepecho Fachada Frontal Oeste - Bloque No. 12", "Front West Facade Sill Wall - CMU"),
    objectType: "Basic Wall: Facade Sill Masonry",
    comments: L("Mampostería y Pañete Muros", "Facade Masonry Sill & Plaster"),
    bimTags: "mamposteria bloque muros panete",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU Block + Stucco Finish" : "Bloque Concreto + Pañete",
    color: 0xe2e8f0,
    w: 5.18,
    h: 0.78,
    d: 0.18,
    x: -2.75,
    y: 0.51,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Mocheta Lateral Izquierda Ventana V-01", "Left Jamb Pier Window V-01"),
    objectType: "Basic Wall: Facade Pier",
    comments: L("Mampostería y Pañete Muros", "Facade Pier Masonry"),
    bimTags: "mamposteria bloque muros estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU + Stucco Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 0.54,
    h: 2.3,
    d: 0.18,
    x: -5.07,
    y: 2.05,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Mocheta Central Ventana V-01", "Center-Left Jamb Pier Window V-01"),
    objectType: "Basic Wall: Facade Pier",
    comments: L("Estuco plástico y pintura", "Facade Pier Finish"),
    bimTags: "mamposteria muros estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU + Stucco Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 0.34,
    h: 2.3,
    d: 0.18,
    x: -0.33,
    y: 2.05,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Dintel Superior Fachada Frontal Oeste", "Front West Facade Lintel Header Wall"),
    objectType: "Basic Wall: Lintel Masonry Header",
    comments: L("Pañete y mortero de revoco", "Header Stucco & Plaster"),
    bimTags: "mamposteria panete revoco estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU + Stucco Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 4.3,
    h: 0.7,
    d: 0.18,
    x: -2.65,
    y: 2.85,
    z: HALF_DEPTH,
  });

  pushBox({
    ifcType: "IFCWALL",
    name: L("Antepecho Fachada Frontal Este - Bloque No. 12", "Front East Facade Sill Wall - CMU"),
    objectType: "Basic Wall: Facade Sill Masonry",
    comments: L("Mampostería Bloque 12", "Facade Masonry Sill"),
    bimTags: "mamposteria bloque muros panete",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU Block + Stucco Finish" : "Bloque Concreto + Pañete",
    color: 0xe2e8f0,
    w: 3.99,
    h: 0.78,
    d: 0.18,
    x: 3.345,
    y: 0.51,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Mocheta Puerta-Ventana P-01 / V-02", "Door-Window Divider Pier P-01 / V-02"),
    objectType: "Basic Wall: Facade Pier",
    comments: L("Estuco plástico y pintura", "Facade Pier Finish"),
    bimTags: "mamposteria muros estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU + Stucco Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 0.3,
    h: 2.3,
    d: 0.18,
    x: 1.5,
    y: 2.05,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Mocheta Derecha Ventana V-02", "Right Jamb Pier Window V-02"),
    objectType: "Basic Wall: Facade Pier",
    comments: L("Estuco plástico y pintura", "Facade Pier Finish"),
    bimTags: "mamposteria muros estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU + Stucco Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 0.34,
    h: 2.3,
    d: 0.18,
    x: 5.17,
    y: 2.05,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Dintel Superior Fachada Frontal Este", "Front East Facade Lintel Header Wall"),
    objectType: "Basic Wall: Lintel Masonry Header",
    comments: L("Pañete y mortero de revoco", "Header Stucco & Plaster"),
    bimTags: "mamposteria panete revoco estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "CMU + Stucco Paint" : "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 5.18,
    h: 0.7,
    d: 0.18,
    x: 2.75,
    y: 2.85,
    z: HALF_DEPTH,
  });

  // Interior partition walls reaching ceiling cleanly
  pushBox({
    ifcType: "IFCWALL",
    name: L("Muro Divisorio Central - Pañete y Pintura", "Center Spine Partition Wall - Stucco Finish"),
    objectType: "Basic Wall: Interior Partition",
    comments: L("Pañete y mortero de revoco", "Cement stucco & architectural paint"),
    bimTags: "panete revoco estuco pintura mamposteria",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "1:4 Cement Plaster + Latex" : "Mortero Pañete 1:4 + Vinilo",
    color: 0xd1d5db,
    w: 0.15,
    h: 2.7,
    d: 4.84,
    x: 0,
    y: 1.47,
    z: -0.92,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Dintel Paso Interior Lobby-Juntas", "Interior Passage Lintel Wall"),
    objectType: "Basic Wall: Interior Door Header",
    comments: L("Pañete y mortero de revoco", "Cement stucco header"),
    bimTags: "panete revoco estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "1:4 Cement Plaster" : "Mortero Pañete 1:4",
    color: 0xd1d5db,
    w: 0.15,
    h: 0.52,
    d: 1.84,
    x: 0,
    y: 2.56,
    z: 2.42,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: L("Muro Divisorio Oficina Norte / Sala de Juntas", "North Office / Boardroom Cross Partition"),
    objectType: "Basic Wall: Interior Acoustic Partition",
    comments: L("Estuco plástico y pintura", "Acoustic interior masonry partition"),
    bimTags: "mamposteria panete estuco pintura",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Stucco + Acoustic Paint" : "Estuco + Pintura Vinílica",
    color: 0xe2e8f0,
    w: 5.335,
    h: 2.7,
    d: 0.15,
    x: 2.7425,
    y: 1.47,
    z: 0,
  });

  // Triangular Gable End Walls (Z = -3.5 and Z = +3.5) sealing space from eave (3.20) up to roof peak (4.15)
  ([-HALF_DEPTH - 0.09, HALF_DEPTH - 0.09] as const).forEach((zStart, idx) => {
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-HALF_SPAN, EAVE_Y);
    gableShape.lineTo(0, RIDGE_Y);
    gableShape.lineTo(HALF_SPAN, EAVE_Y);
    gableShape.closePath();

    const gableGeom = new THREE.ExtrudeGeometry(gableShape, {
      depth: 0.18,
      bevelEnabled: false,
    });
    gableGeom.translate(0, 0, zStart);
    pushGeometry({
      ifcType: "IFCWALL",
      name: L(
        `Tímpano / Frontón Cumbrera ${idx === 0 ? "Posterior" : "Frontal"}`,
        `${idx === 0 ? "Rear" : "Front"} Gable End Wall`
      ),
      objectType: "Basic Wall: Gable Masonry Enclosure",
      comments: L("Mampostería y Pañete Muros", "Gable masonry roof closure"),
      bimTags: "mamposteria bloque muros panete estuco pintura",
      level: L("Cubierta", "Roof Level"),
      material: isEn ? "CMU Block + Stucco" : "Bloque No. 12 + Estuco",
      color: 0xe2e8f0,
      geom: gableGeom,
    });
  });

  // 4. Aluminum Windows & Acoustic Entry Door fitted inside framed openings
  pushBox({
    ifcType: "IFCWINDOW",
    name: L("Ventanería Aluminio Termoacústica Lobby V-01", "Lobby Aluminum Acoustic Window V-01"),
    objectType: "Window: Aluminum Acoustic Glazing",
    comments: L("Ventanería aluminio termoacústica", "Aluminum acoustic glazing"),
    bimTags: "ventana ventaneria aluminio vidrio",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Laminated Acoustic Glass + Anodized Aluminum" : "Vidrio Laminado + Aluminio Anodizado",
    color: 0x38bdf8,
    opacity: 0.5,
    w: 4.3,
    h: 1.6,
    d: 0.1,
    x: -2.65,
    y: 1.7,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCWINDOW",
    name: L("Ventanería Aluminio Sala de Juntas V-02", "Boardroom Aluminum Acoustic Window V-02"),
    objectType: "Window: Aluminum Acoustic Glazing",
    comments: L("Ventanería aluminio", "Aluminum window glazing"),
    bimTags: "ventana ventaneria aluminio vidrio",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Laminated Glass + Aluminum" : "Vidrio Laminado",
    color: 0x38bdf8,
    opacity: 0.5,
    w: 3.35,
    h: 1.6,
    d: 0.1,
    x: 3.325,
    y: 1.7,
    z: HALF_DEPTH,
  });
  pushBox({
    ifcType: "IFCDOOR",
    name: L("Puerta Acceso Ejecutivo P-01", "Executive Entry Door P-01"),
    objectType: "Door: Acoustic Walnut Frame",
    comments: L("Puertas interiores y acceso", "Entry & interior doors"),
    bimTags: "puerta puertas acceso",
    level: L("Nivel 1", "Level 1"),
    material: isEn ? "Acoustic Solid Core Walnut" : "Madera Acústica Nogal",
    color: 0x78350f,
    w: 1.19,
    h: 2.38,
    d: 0.14,
    x: 0.755,
    y: 1.31,
    z: HALF_DEPTH,
  });

  // 5. Suspended Drywall Ceiling & Frescasa Insulation engaging inner wall perimeter flush (w=10.84, d=6.84)
  pushBox({
    ifcType: "IFCCOVERING",
    name: L("Cielo Raso Suspendido Drywall - Lobby y Oficinas", "Suspended Drywall Ceiling - Lobby & Offices"),
    objectType: "Ceiling: Acoustic Drywall 1/2\"",
    comments: L("Lobby Principal - Cielo Raso", "Main Lobby - Suspended Ceiling"),
    bimTags: "cielo raso cielorraso drywall lobby oficina juntas",
    level: L("Cielo Raso", "Ceiling Plenum"),
    material: isEn ? "Acoustic Gypsum Board" : "Drywall Acústico",
    color: 0xf8fafc,
    w: 10.84,
    h: 0.08,
    d: 6.84,
    x: 0,
    y: 2.75,
    z: 0,
  });
  pushBox({
    ifcType: "IFCCOVERING",
    name: L(
      "Aislamiento Termoacústico Frescasa Eco 2-1/2\" sobre Cielo Raso",
      "Frescasa Eco 2-1/2\" Thermal-Acoustic Fiberglass Insulation"
    ),
    objectType: "Insulation: Fiberglass Batts 2-1/2\"",
    comments: L("Aislamiento Frescasa Eco 2-1/2", "Frescasa Eco 2-1/2 Insulation"),
    bimTags: "frescasa aislamiento cielo raso cielorraso",
    level: L("Cielo Raso", "Ceiling Plenum"),
    material: isEn ? "Frescasa Eco 2-1/2\" Fiberglass" : "Fibra de Vidrio Frescasa Eco",
    color: 0xa3e635,
    opacity: 0.88,
    w: 10.76,
    h: 0.08,
    d: 6.76,
    x: 0,
    y: 2.83,
    z: 0,
  });

  // 6. Pitched Fiber-Cement Roof Panels & Ridge Cap seated flush on top of portal rafters, eave beams & gable walls
  const overhang = 0.35;
  const roofPanelW = halfSlopeLen + overhang;
  const roofH = 0.1;
  const localMid = roofPanelW / 2 - 0.02;
  const normalOffset = roofH / 2;

  const westCx = -localMid * Math.cos(ROOF_SLOPE_RAD) - normalOffset * Math.sin(ROOF_SLOPE_RAD);
  const westCy = RIDGE_Y - localMid * Math.sin(ROOF_SLOPE_RAD) + normalOffset * Math.cos(ROOF_SLOPE_RAD);
  const eastCx = localMid * Math.cos(ROOF_SLOPE_RAD) + normalOffset * Math.sin(ROOF_SLOPE_RAD);
  const eastCy = RIDGE_Y - localMid * Math.sin(ROOF_SLOPE_RAD) + normalOffset * Math.cos(ROOF_SLOPE_RAD);

  pushBox({
    ifcType: "IFCROOF",
    name: L("Cubierta Termoacústica Eternit - Faldón Oeste", "Thermo-Acoustic Corrugated Roof - West Slope"),
    objectType: "Roof: Corrugated Fiber-Cement Panels",
    comments: L("Cubierta teja Eternit", "Corrugated thermo-acoustic roof"),
    bimTags: "cubierta eternit teja",
    level: L("Cubierta", "Roof Level"),
    material: isEn ? "Corrugated Fiber-Cement Panel" : "Teja Ondulada Eternit",
    color: 0x475569,
    w: roofPanelW,
    h: roofH,
    d: 7.6,
    x: westCx,
    y: westCy,
    z: 0,
    rotZ: ROOF_SLOPE_RAD,
  });
  pushBox({
    ifcType: "IFCROOF",
    name: L("Cubierta Termoacústica Eternit - Faldón Este", "Thermo-Acoustic Corrugated Roof - East Slope"),
    objectType: "Roof: Corrugated Fiber-Cement Panels",
    comments: L("Cubierta teja Eternit", "Corrugated thermo-acoustic roof"),
    bimTags: "cubierta eternit teja",
    level: L("Cubierta", "Roof Level"),
    material: isEn ? "Corrugated Fiber-Cement Panel" : "Teja Ondulada Eternit",
    color: 0x475569,
    w: roofPanelW,
    h: roofH,
    d: 7.6,
    x: eastCx,
    y: eastCy,
    z: 0,
    rotZ: -ROOF_SLOPE_RAD,
  });
  pushBox({
    ifcType: "IFCROOF",
    name: L("Caballete de Cumbrera Cubierta Eternit", "Roof Ridge Cap Flashing"),
    objectType: "Roof: Ridge Flashing",
    comments: L("Cubierta teja Eternit", "Roof ridge flashing assembly"),
    bimTags: "cubierta eternit teja caballete",
    level: L("Cubierta", "Roof Level"),
    material: isEn ? "Fiber-Cement Ridge Cap" : "Caballete Articulado Eternit",
    color: 0x334155,
    w: 0.44,
    h: 0.12,
    d: 7.64,
    x: 0,
    y: RIDGE_Y + 0.08,
    z: 0,
  });

  return {
    filename: "Northbridge_Hub_BIM5D_Showcase.ifc",
    sizeBytes: 864200,
    elements,
    boundingBox,
  };
}
