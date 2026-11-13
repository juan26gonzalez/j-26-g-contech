import * as THREE from "three";
import { normalizarTexto } from "./calcClient";
import {
  IfcElementRenderData,
  ParsedIfcModel,
} from "./ifcEngine";
import { BitacoraRow, GanttTask, ProjectConfig } from "./types";

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
    contratista: "Ing. Juan González Mendoza (JGM ConTech)",
    ubicacion: "Barranquilla / Miami / Madrid • ISO 19650 OpenBIM Demo",
    modelo_bim: "Northbridge_Hub_BIM5D.ifc (OpenBIM Three.js)",
    badge: "ISO 19650 • BIM 5D DEMO",
    logo: "🏢",
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
  return [
    {
      id: 901,
      fecha: isoOffsetDays(-18),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Concreto en zapatas y vigas de cimentación f'c=21 MPa`,
      unidad: "m³",
      cantidad: 14.0,
      desperdicio: 2.5,
      created_at: `${isoOffsetDays(-18)}T16:30:00Z`,
    },
    {
      id: 902,
      fecha: isoOffsetDays(-15),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Concreto en zapatas y vigas de cimentación f'c=21 MPa`,
      unidad: "m³",
      cantidad: 14.0,
      desperdicio: 2.0,
      created_at: `${isoOffsetDays(-15)}T17:10:00Z`,
    },
    {
      id: 903,
      fecha: isoOffsetDays(-12),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Concreto en columnas y pórtico estructural f'c=24 MPa`,
      unidad: "m³",
      cantidad: 9.2,
      desperdicio: 1.8,
      created_at: `${isoOffsetDays(-12)}T16:45:00Z`,
    },
    {
      id: 904,
      fecha: isoOffsetDays(-10),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Concreto en columnas y pórtico estructural f'c=24 MPa`,
      unidad: "m³",
      cantidad: 8.8,
      desperdicio: 1.5,
      created_at: `${isoOffsetDays(-10)}T16:50:00Z`,
    },
    {
      id: 905,
      fecha: isoOffsetDays(-8),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Muros en mampostería de bloques de concreto No. 12`,
      unidad: "m²",
      cantidad: 72.0,
      desperdicio: 4.0,
      created_at: `${isoOffsetDays(-8)}T17:00:00Z`,
    },
    {
      id: 906,
      fecha: isoOffsetDays(-6),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Muros en mampostería de bloques de concreto No. 12`,
      unidad: "m²",
      cantidad: 68.0,
      desperdicio: 3.5,
      created_at: `${isoOffsetDays(-6)}T17:15:00Z`,
    },
    {
      id: 907,
      fecha: isoOffsetDays(-4),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Muros en mampostería de bloques de concreto No. 12`,
      unidad: "m²",
      cantidad: 70.0,
      desperdicio: 3.0,
      created_at: `${isoOffsetDays(-4)}T17:05:00Z`,
    },
    {
      id: 908,
      fecha: isoOffsetDays(-4),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Montaje de cubierta termoacústica Eternit y caballetes`,
      unidad: "m²",
      cantidad: 78.0,
      desperdicio: 2.0,
      created_at: `${isoOffsetDays(-4)}T17:20:00Z`,
    },
    {
      id: 909,
      fecha: isoOffsetDays(-2),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Montaje de cubierta termoacústica Eternit y caballetes`,
      unidad: "m²",
      cantidad: 77.0,
      desperdicio: 2.0,
      created_at: `${isoOffsetDays(-2)}T16:40:00Z`,
    },
    {
      id: 910,
      fecha: isoOffsetDays(-2),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Pañete y mortero de revoco en muros dos caras`,
      unidad: "m²",
      cantidad: 115.0,
      desperdicio: 3.5,
      created_at: `${isoOffsetDays(-2)}T17:10:00Z`,
    },
    {
      id: 911,
      fecha: isoOffsetDays(-1),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Pañete y mortero de revoco en muros dos caras`,
      unidad: "m²",
      cantidad: 140.0,
      desperdicio: 3.0,
      created_at: `${isoOffsetDays(-1)}T17:10:00Z`,
    },
    {
      id: 912,
      fecha: isoOffsetDays(-1),
      actividad: `[${DEMO_SHOWCASE_PROJECT_ID}] Instalación de piso en porcelanato 51x51 cm y plantilla (Lobby Principal)`,
      unidad: "m²",
      cantidad: 48.0,
      desperdicio: 4.5,
      created_at: `${isoOffsetDays(-1)}T17:30:00Z`,
    },
  ];
}

/**
 * Genera un gemelo digital 3D paramétrico en Three.js compatible con ParsedIfcModel
 * para demostraciones públicas en LinkedIn o previsualización sin cargar archivos .IFC locales.
 */
export function buildShowcaseIfcModel(projectName = "Northbridge Showcase"): ParsedIfcModel {
  const elements: IfcElementRenderData[] = [];
  const boundingBox = new THREE.Box3();
  let nextId = 1001;

  const pushBox = (opts: {
    ifcType: string;
    name: string;
    objectType: string;
    comments: string;
    level: string;
    material: string;
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
    geom.computeBoundingBox();
    if (geom.boundingBox) {
      boundingBox.union(geom.boundingBox);
    }

    const searchTextNorm = normalizarTexto(
      `${opts.ifcType} ${opts.name} ${opts.objectType} ${opts.comments} ${opts.material} ${opts.level}`
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
          "Pset_BIM5D": opts.comments,
          "Material": opts.material,
        },
        searchTextNorm,
      },
      parts: [
        {
          geometry: geom,
          originalColor: new THREE.Color(opts.color),
          originalOpacity: opts.opacity ?? 1,
        },
      ],
    });
  };

  // 1. Zapatas y vigas de cimentación (y = -0.30..0)
  const colPositions: [number, number][] = [
    [-5.5, -3.5],
    [0, -3.5],
    [5.5, -3.5],
    [-5.5, 3.5],
    [0, 3.5],
    [5.5, 3.5],
  ];
  colPositions.forEach(([cx, cz], idx) => {
    pushBox({
      ifcType: "IFCFOOTING",
      name: `Zapata Cimentación Z-${idx + 1}`,
      objectType: "Footing: Rectangular Concrete",
      comments: "Zapatas y vigas de cimentación",
      level: "Nivel 0 - Cimentación",
      material: "Concreto f'c=21 MPa",
      color: 0x64748b,
      w: 1.1,
      h: 0.35,
      d: 1.1,
      x: cx,
      y: -0.18,
      z: cz,
    });
    pushBox({
      ifcType: "IFCCOLUMN",
      name: `Columna Estructural C-${idx + 1}`,
      objectType: "Column: Concrete 30x30",
      comments: "Columnas y pórtico estructural",
      level: "Nivel 1",
      material: "Concreto f'c=24 MPa",
      color: 0x94a3b8,
      w: 0.32,
      h: 3.1,
      d: 0.32,
      x: cx,
      y: 1.55,
      z: cz,
    });
  });

  // 2. Placas de piso en porcelanato (3 zonas)
  pushBox({
    ifcType: "IFCSLAB",
    name: "Piso Porcelanato 51x51 - Lobby Principal",
    objectType: "Floor: Porcelanato 51x51 + Plantilla",
    comments: "Lobby Principal - Porcelanato",
    level: "Nivel 1",
    material: "Porcelanato Gris Ejecutivo",
    color: 0xdbeafe,
    w: 5.3,
    h: 0.12,
    d: 6.7,
    x: -2.75,
    y: 0.06,
    z: 0,
  });
  pushBox({
    ifcType: "IFCSLAB",
    name: "Piso Porcelanato 51x51 - Oficina Norte",
    objectType: "Floor: Porcelanato 51x51 + Plantilla",
    comments: "Oficina Norte - Porcelanato",
    level: "Nivel 1",
    material: "Porcelanato Gris Ejecutivo",
    color: 0xe2e8f0,
    w: 5.3,
    h: 0.12,
    d: 3.3,
    x: 2.75,
    y: 0.06,
    z: -1.7,
  });
  pushBox({
    ifcType: "IFCSLAB",
    name: "Piso Porcelanato 51x51 - Sala de Juntas",
    objectType: "Floor: Porcelanato 51x51 + Plantilla",
    comments: "Sala de Juntas - Porcelanato",
    level: "Nivel 1",
    material: "Porcelanato Gris Ejecutivo",
    color: 0xe2e8f0,
    w: 5.3,
    h: 0.12,
    d: 3.3,
    x: 2.75,
    y: 0.06,
    z: 1.7,
  });

  // 3. Muros de mampostería + Pañete + Pintura
  pushBox({
    ifcType: "IFCWALL",
    name: "Muro Perimetral Posterior - Mampostería Bloque No. 12",
    objectType: "Basic Wall: Mampostería Bloque 12 + Pañete",
    comments: "Mampostería y Pañete Muros",
    level: "Nivel 1",
    material: "Bloque Concreto No. 12",
    color: 0xcbd5e1,
    w: 10.8,
    h: 2.8,
    d: 0.18,
    x: 0,
    y: 1.5,
    z: -3.5,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: "Muro Lateral Izquierdo - Estuco y Pintura",
    objectType: "Basic Wall: Estuco y Pintura Vinílica",
    comments: "Estuco plástico y pintura",
    level: "Nivel 1",
    material: "Estuco + Vinilo Arquitectónico",
    color: 0xf1f5f9,
    w: 0.18,
    h: 2.8,
    d: 6.8,
    x: -5.5,
    y: 1.5,
    z: 0,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: "Muro Lateral Derecho - Mampostería Bloque No. 12",
    objectType: "Basic Wall: Mampostería Bloque 12",
    comments: "Mampostería Bloque 12",
    level: "Nivel 1",
    material: "Bloque Concreto No. 12",
    color: 0xcbd5e1,
    w: 0.18,
    h: 2.8,
    d: 6.8,
    x: 5.5,
    y: 1.5,
    z: 0,
  });
  pushBox({
    ifcType: "IFCWALL",
    name: "Muro Divisorio Central - Pañete y Mortero",
    objectType: "Basic Wall: Pañete Dos Caras",
    comments: "Pañete y mortero de revoco",
    level: "Nivel 1",
    material: "Mortero Pañete 1:4",
    color: 0xd1d5db,
    w: 0.15,
    h: 2.75,
    d: 4.8,
    x: 0,
    y: 1.48,
    z: -1.0,
  });

  // 4. Ventanería aluminio & vidrio + Puerta de acceso
  pushBox({
    ifcType: "IFCWINDOW",
    name: "Fachada Vidrio & Ventanería Aluminio V-01",
    objectType: "Curtain / Window: Aluminum Acoustic Glass",
    comments: "Ventanería aluminio termoacústica",
    level: "Nivel 1",
    material: "Vidrio Laminado + Aluminio Anodizado",
    color: 0x38bdf8,
    opacity: 0.45,
    w: 4.8,
    h: 2.1,
    d: 0.12,
    x: -2.4,
    y: 1.45,
    z: 3.5,
  });
  pushBox({
    ifcType: "IFCWINDOW",
    name: "Ventanería Aluminio Sala de Juntas V-02",
    objectType: "Window: Aluminum Acoustic Glass",
    comments: "Ventanería aluminio",
    level: "Nivel 1",
    material: "Vidrio Laminado",
    color: 0x38bdf8,
    opacity: 0.45,
    w: 3.4,
    h: 1.8,
    d: 0.12,
    x: 3.2,
    y: 1.5,
    z: 3.5,
  });
  pushBox({
    ifcType: "IFCDOOR",
    name: "Puerta Acceso Ejecutivo P-01",
    objectType: "Door: Acoustic Wood Frame",
    comments: "Puertas interiores y acceso",
    level: "Nivel 1",
    material: "Madera Acústica Nogal",
    color: 0x78350f,
    w: 1.15,
    h: 2.25,
    d: 0.14,
    x: 0.75,
    y: 1.24,
    z: 3.5,
  });

  // 5. Cielo raso suspendido + Aislamiento Frescasa Eco 2-1/2"
  pushBox({
    ifcType: "IFCCOVERING",
    name: "Cielo Raso Suspendido Drywall - Lobby y Oficinas",
    objectType: "Ceiling: Drywall 1/2\"",
    comments: "Lobby Principal - Cielo Raso",
    level: "Cielo Raso",
    material: "Drywall Acústico",
    color: 0xf8fafc,
    w: 10.4,
    h: 0.08,
    d: 6.4,
    x: 0,
    y: 2.75,
    z: 0,
  });
  pushBox({
    ifcType: "IFCCOVERING",
    name: "Aislamiento Termoacústico Frescasa Eco 2-1/2\" sobre Cielo Raso",
    objectType: "Insulation: Fiberglass Frescasa Eco",
    comments: "Aislamiento Frescasa Eco 2-1/2",
    level: "Cielo Raso",
    material: "Fibra de Vidrio Frescasa Eco",
    color: 0xa3e635,
    opacity: 0.85,
    w: 10.2,
    h: 0.08,
    d: 6.2,
    x: 0,
    y: 2.86,
    z: 0,
  });

  // 6. Cubierta metálica / teja Eternit
  pushBox({
    ifcType: "IFCROOF",
    name: "Cubierta Termoacústica Eternit - Faldón Oeste",
    objectType: "Roof: Eternit Corrugated Sheet",
    comments: "Cubierta teja Eternit",
    level: "Cubierta",
    material: "Teja Ondulada Eternit",
    color: 0x475569,
    w: 5.9,
    h: 0.12,
    d: 7.4,
    x: -2.85,
    y: 3.55,
    z: 0,
    rotZ: 0.16,
  });
  pushBox({
    ifcType: "IFCROOF",
    name: "Cubierta Termoacústica Eternit - Faldón Este",
    objectType: "Roof: Eternit Corrugated Sheet",
    comments: "Cubierta teja Eternit",
    level: "Cubierta",
    material: "Teja Ondulada Eternit",
    color: 0x475569,
    w: 5.9,
    h: 0.12,
    d: 7.4,
    x: 2.85,
    y: 3.55,
    z: 0,
    rotZ: -0.16,
  });

  return {
    filename: "Northbridge_Hub_BIM5D_Showcase.ifc",
    sizeBytes: 742400,
    elements,
    boundingBox,
  };
}
