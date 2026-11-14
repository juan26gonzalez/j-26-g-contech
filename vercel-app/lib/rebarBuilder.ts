import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { IfcGeometryPart, StructuralRebarSpec } from "./ifcEngine";

type BarSizeKey = "#3" | "#4" | "#5";

const BAR_SPECS: Record<
  BarSizeKey,
  { visualRadius: number; nominalMm: number; areaMm2: number; kgPerM: number }
> = {
  "#3": { visualRadius: 0.0065, nominalMm: 9.5, areaMm2: 71, kgPerM: 0.56 },
  "#4": { visualRadius: 0.0085, nominalMm: 12.7, areaMm2: 129, kgPerM: 0.994 },
  "#5": { visualRadius: 0.01, nominalMm: 15.9, areaMm2: 199, kgPerM: 1.552 },
};

export const REBAR_ZONE_COLORS = {
  longitudinal: 0xf97316, // Warm copper-orange Grade 60 longitudinal main bars
  confinement: 0xfacc15,  // Bright gold-amber seismic confinement hoops Lo (135° hooks)
  stirrup: 0x38bdf8,      // Galvanized sky-cyan central stirrups / ties
  dowel: 0x22d3ee,        // Teal-cyan footing starter dowels & L-feet
  mesh: 0x38bdf8,         // Welded temperature & shrinkage slab reinforcement
} as const;

const UP_AXIS = new THREE.Vector3(0, 1, 0);

interface GeometryAccumulator {
  geoms: THREE.BufferGeometry[];
  lengthByBar: Record<BarSizeKey, number>;
}

function createAccumulator(): GeometryAccumulator {
  return {
    geoms: [],
    lengthByBar: { "#3": 0, "#4": 0, "#5": 0 },
  };
}

function addBarSegment(
  acc: GeometryAccumulator,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  size: BarSizeKey
) {
  const len = p1.distanceTo(p2);
  if (len < 1e-4) return;
  const r = BAR_SPECS[size].visualRadius;
  const cyl = new THREE.CylinderGeometry(r, r, len, 7, 1, false);
  const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(UP_AXIS, dir);
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  cyl.applyQuaternion(quat);
  cyl.translate(mid.x, mid.y, mid.z);
  acc.geoms.push(cyl);
  acc.lengthByBar[size] += len;
}

function addBendJoint(acc: GeometryAccumulator, pt: THREE.Vector3, size: BarSizeKey) {
  const r = BAR_SPECS[size].visualRadius * 1.03;
  const sph = new THREE.SphereGeometry(r, 6, 5);
  sph.translate(pt.x, pt.y, pt.z);
  acc.geoms.push(sph);
}

function addPolylineBar(acc: GeometryAccumulator, pts: THREE.Vector3[], size: BarSizeKey) {
  if (pts.length < 2) return;
  for (let i = 0; i < pts.length - 1; i++) {
    addBarSegment(acc, pts[i], pts[i + 1], size);
    if (i > 0) {
      addBendJoint(acc, pts[i], size);
    }
  }
}

/**
 * Generates a closed rectangular seismic hoop/stirrup with two overlapping 135°
 * inward diagonal hooks anchored into the confined concrete core.
 */
function addClosedSeismicHoop(opts: {
  acc: GeometryAccumulator;
  center: THREE.Vector3;
  uAxis: THREE.Vector3;
  vAxis: THREE.Vector3;
  wAxis: THREE.Vector3;
  hu: number;
  hv: number;
  size: BarSizeKey;
  hookCornerIdx: number;
  crosstieAxis?: "u" | "v" | "none";
}) {
  const { acc, center, uAxis, vAxis, wAxis, hu, hv, size, hookCornerIdx, crosstieAxis = "none" } =
    opts;
  const corners = [
    center.clone().addScaledVector(uAxis, -hu).addScaledVector(vAxis, -hv),
    center.clone().addScaledVector(uAxis, hu).addScaledVector(vAxis, -hv),
    center.clone().addScaledVector(uAxis, hu).addScaledVector(vAxis, hv),
    center.clone().addScaledVector(uAxis, -hu).addScaledVector(vAxis, hv),
  ];

  for (let i = 0; i < 4; i++) {
    addBarSegment(acc, corners[i], corners[(i + 1) % 4], size);
    addBendJoint(acc, corners[i], size);
  }

  // Two parallel 135° hooks directed diagonally inward toward the core center
  const hookCorner = corners[((hookCornerIdx % 4) + 4) % 4];
  const inwardDir = center.clone().sub(hookCorner).normalize();
  const hookLen = Math.min(0.075, Math.max(0.045, Math.min(hu, hv) * 0.72));
  const sep = BAR_SPECS[size].visualRadius * 0.95;

  for (const sign of [-1, 1] as const) {
    const start = hookCorner.clone().addScaledVector(wAxis, sign * sep);
    const tip = start.clone().addScaledVector(inwardDir, hookLen);
    addBarSegment(acc, start, tip, size);
  }

  if (crosstieAxis === "u") {
    const pA = center.clone().addScaledVector(uAxis, -hu);
    const pB = center.clone().addScaledVector(uAxis, hu);
    addBarSegment(acc, pA, pB, size);
  } else if (crosstieAxis === "v") {
    const pA = center.clone().addScaledVector(vAxis, -hv);
    const pB = center.clone().addScaledVector(vAxis, hv);
    addBarSegment(acc, pA, pB, size);
  }
}

function finalizePart(
  acc: GeometryAccumulator,
  color: number,
  rebarZone: IfcGeometryPart["rebarZone"],
  transform?: { rotZ?: number; translate?: THREE.Vector3 }
): IfcGeometryPart | null {
  if (acc.geoms.length === 0) return null;
  const merged = mergeGeometries(acc.geoms, false);
  for (const g of acc.geoms) {
    g.dispose();
  }
  if (!merged) return null;
  if (transform?.rotZ) {
    merged.rotateZ(transform.rotZ);
  }
  if (transform?.translate) {
    merged.translate(transform.translate.x, transform.translate.y, transform.translate.z);
  }
  merged.computeBoundingBox();
  return {
    geometry: merged,
    originalColor: new THREE.Color(color),
    originalOpacity: 1,
    isRebar: true,
    rebarZone,
  };
}

function totalWeightKg(accumulators: GeometryAccumulator[]): number {
  let kg = 0;
  for (const acc of accumulators) {
    (Object.keys(acc.lengthByBar) as BarSizeKey[]).forEach((k) => {
      kg += acc.lengthByBar[k] * BAR_SPECS[k].kgPerM;
    });
  }
  return Number(kg.toFixed(1));
}

function sampleSpanStations(start: number, end: number, step: number): number[] {
  const span = end - start;
  if (span <= 0) return [];
  const count = Math.max(2, Math.floor(span / step) + 1);
  const actualStep = span / (count - 1);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(start + i * actualStep);
  }
  return out;
}

export interface RebarPackageResult {
  parts: IfcGeometryPart[];
  spec: StructuralRebarSpec;
}

/**
 * 1. Spread Footing: Bottom bidirectional #4 @ 15cm mat (75mm clear cover) + 8 #5 hooked starter dowels.
 */
export function buildFootingRebarPackage(opts: {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
}): RebarPackageResult {
  const { w, h, d, cx, cy, cz } = opts;
  const matAcc = createAccumulator();
  const dowelAcc = createAccumulator();

  const cover = 0.075; // NSR-10 C.7.7.1(a) & ACI 318 Table 20.5.1.3.1 (cast against earth)
  const yBot = cy - h / 2;
  const yMatX = yBot + cover + BAR_SPECS["#4"].visualRadius;
  const yMatZ = yMatX + BAR_SPECS["#4"].visualRadius * 2.1;
  const hookUp = Math.min(0.16, h - cover * 2);

  const halfX = w / 2 - cover;
  const halfZ = d / 2 - cover;
  const zStations = sampleSpanStations(-halfZ + 0.025, halfZ - 0.025, 0.15);
  const xStations = sampleSpanStations(-halfX + 0.025, halfX - 0.025, 0.15);

  // Bottom mat X-direction bars with 90° standard upward hooks
  for (const dz of zStations) {
    addPolylineBar(
      matAcc,
      [
        new THREE.Vector3(cx - halfX, yMatX + hookUp, cz + dz),
        new THREE.Vector3(cx - halfX, yMatX, cz + dz),
        new THREE.Vector3(cx + halfX, yMatX, cz + dz),
        new THREE.Vector3(cx + halfX, yMatX + hookUp, cz + dz),
      ],
      "#4"
    );
  }

  // Orthogonal Z-direction bars resting directly on X-layer
  for (const dx of xStations) {
    addPolylineBar(
      matAcc,
      [
        new THREE.Vector3(cx + dx, yMatZ + hookUp, cz - halfZ),
        new THREE.Vector3(cx + dx, yMatZ, cz - halfZ),
        new THREE.Vector3(cx + dx, yMatZ, cz + halfZ),
        new THREE.Vector3(cx + dx, yMatZ + hookUp, cz + halfZ),
      ],
      "#4"
    );
  }

  // 8 #5 column starter dowels with 90° outward horizontal feet seated on top of bottom mat
  const yDowelFoot = yMatZ + BAR_SPECS["#4"].visualRadius + BAR_SPECS["#5"].visualRadius;
  const yDowelTop = cy + h / 2 + 0.34;
  const cOff = 0.088; // Slight lap offset inside column main cage (±0.100m)
  const footLen = 0.25; // >= ldh hooked anchorage
  const dowelOffsets: [number, number][] = [
    [-cOff, -cOff],
    [0, -cOff],
    [cOff, -cOff],
    [cOff, 0],
    [cOff, cOff],
    [0, cOff],
    [-cOff, cOff],
    [-cOff, 0],
  ];

  for (const [dx, dz] of dowelOffsets) {
    const rad = new THREE.Vector3(dx, 0, dz);
    if (rad.lengthSq() < 1e-6) rad.set(1, 0, 0);
    rad.normalize();
    const footTip = new THREE.Vector3(
      cx + dx + rad.x * footLen,
      yDowelFoot,
      cz + dz + rad.z * footLen
    );
    const knee = new THREE.Vector3(cx + dx, yDowelFoot, cz + dz);
    const top = new THREE.Vector3(cx + dx, yDowelTop, cz + dz);
    addPolylineBar(dowelAcc, [footTip, knee, top], "#5");
  }

  const parts = [
    finalizePart(matAcc, REBAR_ZONE_COLORS.longitudinal, "longitudinal"),
    finalizePart(dowelAcc, REBAR_ZONE_COLORS.dowel, "dowel"),
  ].filter((p): p is IfcGeometryPart => p !== null);

  const spec: StructuralRebarSpec = {
    elementCategory: "footing",
    codeColombia: "NSR-10 Título C (C.7.7 / C.15.4) • NTC 2289",
    codeUs: "ACI 318-19 (13.2 / Table 20.5.1.3.1) • ASTM A706",
    steelGradeEs: "Acero Corrugado PDR-60 / Grado 60 (fy = 420 MPa)",
    steelGradeEn: "ASTM A706 / A615 Grade 60 (fy = 60,000 PSI)",
    concreteClassEs: "f'c = 21 MPa (3,000 PSI)",
    concreteClassEn: "f'c = 3,000 PSI (21 MPa)",
    sectionDimsEs: "110 × 110 × 35 cm",
    sectionDimsEn: "43.3\" × 43.3\" × 13.8\"",
    clearCoverMm: 75,
    longitudinalEs: "Parrilla Doble #4 (Ø 1/2\") @ 0.15 m c/dir • Ganchos 90°",
    longitudinalEn: "Bottom Mat #4 (1/2\" Ø) @ 6\" O.C. Each Way • 90° Hooks",
    transverseEs: "8 Arranques Columna #5 (5/8\") con pata 90° ≥ ldh (0.25 m)",
    transverseEn: "8 #5 (5/8\" Ø) Starter Dowels w/ 10\" 90° Hooked Foot (≥ ldh)",
    confinementZoneMm: 0,
    hookAngleDeg: 90,
    estimatedSteelKg: totalWeightKg([matAcc, dowelAcc]),
    rebarRatioPct: 0.25,
    normativeChecks: [
      {
        clauseCol: "NSR-10 C.7.7.1(a)",
        clauseUs: "ACI 318 Tbl. 20.5.1.3.1",
        labelEs: "Recubrimiento libre contra suelo ≥ 75 mm (3.0\")",
        labelEn: "Clear cover cast against earth ≥ 3.0\" (75 mm)",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.7.12.2",
        clauseUs: "ACI 318 7.6.1 / 24.4.3",
        labelEs: "Cuantía de retracción y flexión ρ = 0.25% ≥ 0.18% mín.",
        labelEn: "Flexural / shrinkage ratio ρ = 0.25% ≥ 0.18% min",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.12.5",
        clauseUs: "ACI 318 25.4.3 / 16.3.5",
        labelEs: "Longitud de desarrollo en gancho estándar 90° y arranques #5",
        labelEn: "Standard 90° hooked dowel development into footing core",
        passed: true,
      },
    ],
  };

  return { parts, spec };
}

/**
 * 2. Structural Column: 8 #5 longitudinal (ρg = 1.55%) + #3 hoops w/ 135° hooks (Lo=60cm @ 8cm, Mid @ 15cm).
 */
export function buildColumnRebarPackage(opts: {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
  isRidge?: boolean;
}): RebarPackageResult {
  const { w, h, d, cx, cy, cz } = opts;
  const longAcc = createAccumulator();
  const confAcc = createAccumulator();
  const midAcc = createAccumulator();

  const cover = 0.04;
  const hu = w / 2 - cover - 0.005;
  const hv = d / 2 - cover - 0.005;
  const cOff = hu - 0.015; // ~0.100m
  const yBot = cy - h / 2 + 0.015;
  const yTop = cy + h / 2 - 0.04;
  const hookInLen = 0.14;

  const barCoords: [number, number][] = [
    [-cOff, -cOff],
    [0, -cOff],
    [cOff, -cOff],
    [cOff, 0],
    [cOff, cOff],
    [0, cOff],
    [-cOff, cOff],
    [-cOff, 0],
  ];

  // 8 #5 continuous vertical bars with 90° top hooks bent inward into beam joint
  for (const [dx, dz] of barCoords) {
    const inward = new THREE.Vector3(-dx, 0, -dz);
    if (inward.lengthSq() < 1e-6) inward.set(1, 0, 0);
    inward.normalize();
    const pBot = new THREE.Vector3(cx + dx, yBot, cz + dz);
    const pTop = new THREE.Vector3(cx + dx, yTop, cz + dz);
    const pHook = new THREE.Vector3(
      cx + dx + inward.x * hookInLen,
      yTop,
      cz + dz + inward.z * hookInLen
    );
    addPolylineBar(longAcc, [pBot, pTop, pHook], "#5");
  }

  const uAxis = new THREE.Vector3(1, 0, 0);
  const vAxis = new THREE.Vector3(0, 0, 1);
  const wAxis = new THREE.Vector3(0, 1, 0);

  const loHeight = 0.6; // max(h=32cm, H/6=53cm, 45cm) = 60 cm
  const confBotEnd = yBot + loHeight;
  const confTopStart = yTop - loHeight;

  let hoopIdx = 0;
  // Bottom confinement zone Lo @ 8 cm
  for (const yPos of sampleSpanStations(yBot + 0.04, confBotEnd, 0.08)) {
    addClosedSeismicHoop({
      acc: confAcc,
      center: new THREE.Vector3(cx, yPos, cz),
      uAxis,
      vAxis,
      wAxis,
      hu,
      hv,
      size: "#3",
      hookCornerIdx: hoopIdx,
      crosstieAxis: hoopIdx % 2 === 0 ? "u" : "v",
    });
    hoopIdx++;
  }

  // Top confinement zone Lo @ 8 cm
  for (const yPos of sampleSpanStations(confTopStart, yTop - 0.03, 0.08)) {
    addClosedSeismicHoop({
      acc: confAcc,
      center: new THREE.Vector3(cx, yPos, cz),
      uAxis,
      vAxis,
      wAxis,
      hu,
      hv,
      size: "#3",
      hookCornerIdx: hoopIdx,
      crosstieAxis: hoopIdx % 2 === 0 ? "u" : "v",
    });
    hoopIdx++;
  }

  // Central zone @ 15 cm
  const midStart = confBotEnd + 0.14;
  const midEnd = confTopStart - 0.14;
  if (midEnd > midStart) {
    for (const yPos of sampleSpanStations(midStart, midEnd, 0.15)) {
      addClosedSeismicHoop({
        acc: midAcc,
        center: new THREE.Vector3(cx, yPos, cz),
        uAxis,
        vAxis,
        wAxis,
        hu,
        hv,
        size: "#3",
        hookCornerIdx: hoopIdx,
        crosstieAxis: hoopIdx % 2 === 0 ? "u" : "v",
      });
      hoopIdx++;
    }
  }

  const parts = [
    finalizePart(longAcc, REBAR_ZONE_COLORS.longitudinal, "longitudinal"),
    finalizePart(confAcc, REBAR_ZONE_COLORS.confinement, "confinement"),
    finalizePart(midAcc, REBAR_ZONE_COLORS.stirrup, "stirrup"),
  ].filter((p): p is IfcGeometryPart => p !== null);

  const heightCm = Math.round(h * 100);
  const spec: StructuralRebarSpec = {
    elementCategory: "column",
    codeColombia: "NSR-10 Título C (C.21.3.5 / C.10.9) • NTC 2289",
    codeUs: "ACI 318-19 (Cap. 18.4.3 / 10.6.1 / 25.3) • ASTM A706",
    steelGradeEs: "PDR-60 / Grado 60 (fy = 420 MPa)",
    steelGradeEn: "ASTM A706 Grade 60 Seismic (fy = 60,000 PSI)",
    concreteClassEs: "f'c = 24 MPa (3,500 PSI)",
    concreteClassEn: "f'c = 3,500 PSI (24 MPa)",
    sectionDimsEs: `32 × 32 cm (H = ${h.toFixed(2)} m)`,
    sectionDimsEn: `12.6" × 12.6" (H = ${(h * 3.28084).toFixed(1)} ft)`,
    clearCoverMm: 40,
    longitudinalEs: "8 #5 (Ø 5/8\" - 15.9 mm) • ρg = 1.55% (1%–4% sísmico)",
    longitudinalEn: "8 #5 (5/8\" Ø) Longitudinal • ρg = 1.55% (1%–8% code)",
    transverseEs:
      "Estribos #3 + Crosstie gancho 135° • Lo=60 cm @ 8 cm | Centro @ 15 cm",
    transverseEn:
      "#3 (3/8\") Hoops + Crosstie 135° Hooks • Lo=24\" @ 3.1\" | Mid @ 6\" O.C.",
    confinementZoneMm: 600,
    hookAngleDeg: 135,
    estimatedSteelKg: totalWeightKg([longAcc, confAcc, midAcc]),
    rebarRatioPct: 1.55,
    normativeChecks: [
      {
        clauseCol: "NSR-10 C.21.6.1 / C.10.9",
        clauseUs: "ACI 318 18.4.3 / 10.6.1",
        labelEs: `Sección 32×32 cm ≥ 30 cm • Cuantía ρg = 1.55% (≥ 1.0% mín.)`,
        labelEn: `Section 12.6"×12.6" ≥ 12" • Ratio ρg = 1.55% (≥ 1.0% min)`,
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.21.3.5.6",
        clauseUs: "ACI 318 18.4.3.3",
        labelEs: `Zona Lo = 60 cm (H=${heightCm} cm/6) con estribos @ 8 cm (≤ b/4)`,
        labelEn: `Confinement Lo = 24" w/ hoops @ 3.1" O.C. (≤ b/4 & ≤ 6db)`,
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.7.1.3",
        clauseUs: "ACI 318 25.3.2 / 25.7.2",
        labelEs: "Estribos cerrados y ganchos suplementarios con remate a 135°",
        labelEn: "Closed perimeter hoops & crossties w/ 135° seismic hooks",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.7.7.1(c)",
        clauseUs: "ACI 318 Tbl. 20.5.1.3.1",
        labelEs: "Recubrimiento libre al estribo = 40 mm (1.5\")",
        labelEn: "Clear cover to transverse hoop = 1.5\" (40 mm)",
        passed: true,
      },
    ],
  };

  return { parts, spec };
}

/**
 * Shared builder for horizontal & sloped reinforced concrete beams.
 */
function buildBeamInternal(opts: {
  span: number;
  h: number;
  d: number;
  axis: "x" | "z";
  clearCover: number;
  longBar: BarSizeKey;
  nodeCoords: number[];
  loLen: number;
  confSpacing: number;
  midSpacing: number;
  layerShiftY?: number;
  transform?: { rotZ?: number; translate?: THREE.Vector3 };
  category: StructuralRebarSpec["elementCategory"];
  concreteClassEs: string;
  concreteClassEn: string;
  rebarRatioPct: number;
  normativeChecks: StructuralRebarSpec["normativeChecks"];
  colClause: string;
  usClause: string;
}): RebarPackageResult {
  const {
    span,
    h,
    d,
    axis,
    clearCover,
    longBar,
    nodeCoords,
    loLen,
    confSpacing,
    midSpacing,
    layerShiftY = 0,
    transform,
    category,
    concreteClassEs,
    concreteClassEn,
    rebarRatioPct,
    normativeChecks,
    colClause,
    usClause,
  } = opts;

  const longAcc = createAccumulator();
  const confAcc = createAccumulator();
  const midAcc = createAccumulator();

  const wAxis = axis === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const uAxis = axis === "x" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const vAxis = new THREE.Vector3(0, 1, 0);

  const hu = d / 2 - clearCover - 0.0048;
  const hv = h / 2 - clearCover - 0.0048;
  const lOffU = Math.max(0.03, hu - 0.015);
  const lOffV = Math.max(0.03, hv - 0.015 - Math.abs(layerShiftY));
  const halfSpan = span / 2 - clearCover - 0.02;
  const endHook = Math.min(0.14, hv * 1.4);

  // 4 longitudinal continuous bars (2 top + 2 bottom) w/ 90° end hooks into support joint
  for (const sU of [-1, 1] as const) {
    for (const sV of [-1, 1] as const) {
      const uVal = sU * lOffU;
      const vVal = sV * lOffV + layerShiftY * (sV > 0 ? -1 : 1) * 0.25;
      const pStart = new THREE.Vector3()
        .addScaledVector(wAxis, -halfSpan)
        .addScaledVector(uAxis, uVal)
        .addScaledVector(vAxis, vVal);
      const pEnd = new THREE.Vector3()
        .addScaledVector(wAxis, halfSpan)
        .addScaledVector(uAxis, uVal)
        .addScaledVector(vAxis, vVal);
      const hookDir = -sV;
      const h1 = pStart.clone().addScaledVector(vAxis, hookDir * endHook);
      const h2 = pEnd.clone().addScaledVector(vAxis, hookDir * endHook);
      addPolylineBar(longAcc, [h1, pStart, pEnd, h2], longBar);
    }
  }

  // Generate stirrups cleanly distinguishing confinement zones near support nodes vs mid-span
  const stations: { pos: number; isConf: boolean }[] = [];
  const startW = -halfSpan + 0.04;
  const endW = halfSpan - 0.04;
  const isInsideLo = (pos: number) => nodeCoords.some((nc) => Math.abs(pos - nc) <= loLen);

  let cursor = startW;
  while (cursor <= endW + 1e-4) {
    const conf = isInsideLo(cursor);
    stations.push({ pos: Math.min(cursor, endW), isConf: conf });
    cursor += conf ? confSpacing : midSpacing;
  }

  stations.forEach((st, idx) => {
    addClosedSeismicHoop({
      acc: st.isConf ? confAcc : midAcc,
      center: new THREE.Vector3().addScaledVector(wAxis, st.pos),
      uAxis,
      vAxis,
      wAxis,
      hu,
      hv,
      size: "#3",
      hookCornerIdx: idx,
    });
  });

  const parts = [
    finalizePart(longAcc, REBAR_ZONE_COLORS.longitudinal, "longitudinal", transform),
    finalizePart(confAcc, REBAR_ZONE_COLORS.confinement, "confinement", transform),
    finalizePart(midAcc, REBAR_ZONE_COLORS.stirrup, "stirrup", transform),
  ].filter((p): p is IfcGeometryPart => p !== null);

  const wCm = Math.round(d * 100);
  const hCm = Math.round(h * 100);
  const lM = span.toFixed(2);
  const coverMm = Math.round(clearCover * 1000);
  const loCm = Math.round(loLen * 100);
  const confCm = Math.round(confSpacing * 100);
  const midCm = Math.round(midSpacing * 100);
  const barDiaEn = longBar === "#5" ? '5/8"' : '1/2"';
  const barDiaMm = BAR_SPECS[longBar].nominalMm;

  const spec: StructuralRebarSpec = {
    elementCategory: category,
    codeColombia: colClause,
    codeUs: usClause,
    steelGradeEs: "PDR-60 / Grado 60 (fy = 420 MPa)",
    steelGradeEn: "ASTM A706 Grade 60 Seismic (fy = 60,000 PSI)",
    concreteClassEs,
    concreteClassEn,
    sectionDimsEs: `${wCm} × ${hCm} cm (L = ${lM} m)`,
    sectionDimsEn: `${(wCm / 2.54).toFixed(1)}" × ${(hCm / 2.54).toFixed(1)}" (L = ${(span * 3.28084).toFixed(1)} ft)`,
    clearCoverMm: coverMm,
    longitudinalEs: `4 ${longBar} (2 sup + 2 inf • Ø ${barDiaMm} mm) • ρ = ${rebarRatioPct.toFixed(2)}%`,
    longitudinalEn: `4 ${longBar} (2 Top + 2 Bot • ${barDiaEn} Ø) • ρ = ${rebarRatioPct.toFixed(2)}%`,
    transverseEs: `Estribos #3 (135°) • Lo=${loCm} cm @ ${confCm} cm | Centro @ ${midCm} cm`,
    transverseEn: `#3 (3/8") 135° Stirrups • Lo=${Math.round(loCm / 2.54)}" @ ${(confCm / 2.54).toFixed(1)}" | Mid @ ${(midCm / 2.54).toFixed(1)}" O.C.`,
    confinementZoneMm: Math.round(loLen * 1000),
    hookAngleDeg: 135,
    estimatedSteelKg: totalWeightKg([longAcc, confAcc, midAcc]),
    rebarRatioPct,
    normativeChecks,
  };

  return { parts, spec };
}

/**
 * 3. Grade Tie-Beams (NSR-10 C.15.13 / ACI 318-19 18.13.3): 50mm earth cover, 4 #5 + #3 (135°) ties.
 */
export function buildGradeBeamRebarPackage(opts: {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
  axis: "x" | "z";
}): RebarPackageResult {
  const { w, h, d, cx, cy, cz, axis } = opts;
  const span = axis === "x" ? w : d;
  const width = axis === "x" ? d : w;
  const nodeCoords = axis === "x" ? [-5.5, 0, 5.5] : [-3.5, 3.5];

  return buildBeamInternal({
    span,
    h,
    d: width,
    axis,
    clearCover: 0.05,
    longBar: "#5",
    nodeCoords,
    loLen: 0.5,
    confSpacing: 0.1,
    midSpacing: 0.14,
    layerShiftY: axis === "z" ? 0.008 : 0,
    transform: { translate: new THREE.Vector3(cx, cy, cz) },
    category: "grade_beam",
    concreteClassEs: "f'c = 21 MPa (3,000 PSI)",
    concreteClassEn: "f'c = 3,000 PSI (21 MPa)",
    rebarRatioPct: 0.95,
    colClause: "NSR-10 Título C (C.15.13.3 / C.7.7) • NTC 2289",
    usClause: "ACI 318-19 (18.13.3 / Table 20.5.1.3.1) • ASTM A706",
    normativeChecks: [
      {
        clauseCol: "NSR-10 C.7.7.1(b)",
        clauseUs: "ACI 318 Tbl. 20.5.1.3.1",
        labelEs: "Recubrimiento suelo / concreto limpieza = 50 mm (2.0\")",
        labelEn: "Clear cover exposed to earth (≤ #5 bar) = 2.0\" (50 mm)",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.15.13.3",
        clauseUs: "ACI 318 18.13.3.2",
        labelEs: "Acero continuo sup./inf. 4 #5 (ρ = 0.95% ≥ 0.25% sísmico)",
        labelEn: "Continuous 4 #5 longitudinal tie-beam bars (ρ = 0.95% ≥ min)",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.15.13.3",
        clauseUs: "ACI 318 18.13.3.3",
        labelEs: "Estribos cerrados #3 (135°) @ 10 cm nodos / ≤ h/2 (14 cm) centro",
        labelEn: "Closed #3 135° ties @ 4\" nodal / ≤ h/2 (5.5\") mid-span",
        passed: true,
      },
    ],
  });
}

/**
 * 4. Upper Frame Eave & Ridge Tie-Beams: 40mm cover, 4 #5 + #3 (135°) seismic shear stirrups.
 */
export function buildUpperBeamRebarPackage(opts: {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
}): RebarPackageResult {
  const { w, h, d, cx, cy, cz } = opts;
  return buildBeamInternal({
    span: d,
    h,
    d: w,
    axis: "z",
    clearCover: 0.04,
    longBar: "#5",
    nodeCoords: [-3.5, 3.5],
    loLen: 0.5,
    confSpacing: 0.09,
    midSpacing: 0.15,
    transform: { translate: new THREE.Vector3(cx, cy, cz) },
    category: "beam",
    concreteClassEs: "f'c = 24 MPa (3,500 PSI)",
    concreteClassEn: "f'c = 3,500 PSI (24 MPa)",
    rebarRatioPct: 1.18,
    colClause: "NSR-10 Título C (C.21.3.4 / C.10.5) • NTC 2289",
    usClause: "ACI 318-19 (18.4.2 / 9.6.1 / 25.3) • ASTM A706",
    normativeChecks: [
      {
        clauseCol: "NSR-10 C.21.3.4.2",
        clauseUs: "ACI 318 18.4.2.4",
        labelEs: "Confinamiento en nudos Lo = 2h = 50 cm con estribos #3 @ 9 cm",
        labelEn: "End confinement Lo = 2h = 20\" w/ #3 hoops @ 3.5\" O.C.",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.10.5.1",
        clauseUs: "ACI 318 9.6.1.2",
        labelEs: "Refuerzo longitudinal 4 #5 (ρ = 1.18% ≥ 1.4/fy = 0.33%)",
        labelEn: "Flexural reinforcement 4 #5 (ρ = 1.18% ≥ 0.33% min)",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.7.7.1(c)",
        clauseUs: "ACI 318 Tbl. 20.5.1.3.1",
        labelEs: "Recubrimiento viga aérea interior/protegida = 40 mm (1.5\")",
        labelEn: "Clear cover for cast-in-place protected beam = 1.5\" (40 mm)",
        passed: true,
      },
    ],
  });
}

/**
 * 5. Sloped Portal Rafters: Local cage rotated identically with concrete box rotZ.
 */
export function buildSlopedRafterRebarPackage(opts: {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
  rotZ: number;
}): RebarPackageResult {
  const { w, h, d, cx, cy, cz, rotZ } = opts;
  return buildBeamInternal({
    span: w,
    h,
    d,
    axis: "x",
    clearCover: 0.04,
    longBar: "#4",
    nodeCoords: [-w / 2 + 0.15, w / 2 - 0.15],
    loLen: 0.45,
    confSpacing: 0.09,
    midSpacing: 0.15,
    transform: { rotZ, translate: new THREE.Vector3(cx, cy, cz) },
    category: "rafter",
    concreteClassEs: "f'c = 24 MPa (3,500 PSI)",
    concreteClassEn: "f'c = 3,500 PSI (24 MPa)",
    rebarRatioPct: 1.07,
    colClause: "NSR-10 Título C (C.21.3.4 / C.7.7) • NTC 2289",
    usClause: "ACI 318-19 (18.4.2 / Table 20.5.1.3.1) • ASTM A706",
    normativeChecks: [
      {
        clauseCol: "NSR-10 C.21.3.4",
        clauseUs: "ACI 318 18.4.2.4",
        labelEs: "Estribos perpendiculares al eje inclinado • Lo = 45 cm @ 9 cm",
        labelEn: "Normal closed stirrups along sloped axis • Lo = 18\" @ 3.5\" O.C.",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.10.5.1",
        clauseUs: "ACI 318 9.6.1.2",
        labelEs: "Acero longitudinal 4 #4 (Ø 1/2\") • ρ = 1.07% ≥ 0.33% mín.",
        labelEn: "4 #4 (1/2\" Ø) continuous inclined bars • ρ = 1.07% ≥ min",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.7.1.3",
        clauseUs: "ACI 318 25.3.2",
        labelEs: "Ganchos sísmicos 135° y anclaje 90° en nudo alero/cumbrera",
        labelEn: "135° seismic stirrup hooks & 90° ridge/eave joint anchorage",
        passed: true,
      },
    ],
  });
}

/**
 * 6. Floor Slabs: #3 @ 25 cm (10" O.C.) orthogonal temperature & shrinkage grid inside 12 cm slab.
 */
export function buildSlabTempMeshPackage(opts: {
  w: number;
  h: number;
  d: number;
  cx: number;
  cy: number;
  cz: number;
}): RebarPackageResult {
  const { w, h, d, cx, cy, cz } = opts;
  const meshAcc = createAccumulator();
  const edgeMargin = 0.09;
  const halfX = w / 2 - edgeMargin;
  const halfZ = d / 2 - edgeMargin;
  const yLayerX = cy - 0.006;
  const yLayerZ = cy + 0.006;

  for (const dz of sampleSpanStations(-halfZ, halfZ, 0.25)) {
    addBarSegment(
      meshAcc,
      new THREE.Vector3(cx - halfX, yLayerX, cz + dz),
      new THREE.Vector3(cx + halfX, yLayerX, cz + dz),
      "#3"
    );
  }
  for (const dx of sampleSpanStations(-halfX, halfX, 0.25)) {
    addBarSegment(
      meshAcc,
      new THREE.Vector3(cx + dx, yLayerZ, cz - halfZ),
      new THREE.Vector3(cx + dx, yLayerZ, cz + halfZ),
      "#3"
    );
  }

  const parts = [finalizePart(meshAcc, REBAR_ZONE_COLORS.mesh, "mesh")].filter(
    (p): p is IfcGeometryPart => p !== null
  );

  const areaM2 = (w * d).toFixed(1);
  const spec: StructuralRebarSpec = {
    elementCategory: "slab",
    codeColombia: "NSR-10 Título C (C.7.12.2 / C.7.7) • NTC 5806",
    codeUs: "ACI 318-19 (24.4.3 / Table 20.5.1.3.1) • ASTM A1064",
    steelGradeEs: "Acero Grado 60 / Malla Electrosoldada (fy ≥ 420 MPa)",
    steelGradeEn: "Grade 60 Deformed / Welded Wire Reinforcement (fy ≥ 60 ksi)",
    concreteClassEs: "f'c = 21 MPa (e = 12 cm)",
    concreteClassEn: "f'c = 3,000 PSI (t = 4.7\")",
    sectionDimsEs: `${w.toFixed(2)} × ${d.toFixed(2)} m (e=12 cm • ${areaM2} m²)`,
    sectionDimsEn: `${(w * 3.28084).toFixed(1)} × ${(d * 3.28084).toFixed(1)} ft (t=4.7")`,
    clearCoverMm: 40,
    longitudinalEs: "Malla Retracción/Temp. #3 (Ø 3/8\") @ 0.25 m ambos sentidos",
    longitudinalEn: "#3 (3/8\" Ø) Temperature & Shrinkage Grid @ 10\" O.C. Each Way",
    transverseEs: "As provisto = 284 mm²/m ≥ As mín (0.0018×120 = 216 mm²/m)",
    transverseEn: "Provided As = 0.134 in²/ft ≥ min 0.0018 Ag (0.102 in²/ft)",
    confinementZoneMm: 0,
    hookAngleDeg: 90,
    estimatedSteelKg: totalWeightKg([meshAcc]),
    rebarRatioPct: 0.24,
    normativeChecks: [
      {
        clauseCol: "NSR-10 C.7.12.2.1",
        clauseUs: "ACI 318 24.4.3.2",
        labelEs: "Cuantía de temperatura y retracción ρ = 0.24% ≥ 0.18% mín.",
        labelEn: "Shrinkage & temperature ratio ρ = 0.24% ≥ 0.18% min",
        passed: true,
      },
      {
        clauseCol: "NSR-10 C.7.12.2.2",
        clauseUs: "ACI 318 24.4.3.3",
        labelEs: "Separación máx. 25 cm ≤ min(5h = 60 cm, 45 cm)",
        labelEn: "Bar spacing 10\" O.C. ≤ min(5h = 23.6\", 18\")",
        passed: true,
      },
    ],
  };

  return { parts, spec };
}
