import * as THREE from "three";
import { normalizarTexto } from "./calcClient";
import {
  classifyRevitActivityAndRoom,
  computeExecutedByRoomItem,
  getInitialRoomItemsForProject,
} from "./revitRooms";
import {
  BudgetItem,
  ConsolidationResult,
  ProjectConfig,
  RoomActivityItem,
  RoomActivityKey,
} from "./types";

export interface IfcElementMeta {
  expressID: number;
  ifcType: string;
  name: string;
  objectType: string;
  description: string;
  tag: string;
  comments: string;
  level: string;
  materialNames: string[];
  rawProps: Record<string, string>;
  searchTextNorm: string;
}

export interface IfcGeometryPart {
  geometry: THREE.BufferGeometry;
  originalColor: THREE.Color;
  originalOpacity: number;
}

export interface IfcElementRenderData {
  expressID: number;
  meta: IfcElementMeta;
  parts: IfcGeometryPart[];
}

export interface ParsedIfcModel {
  filename: string;
  sizeBytes: number;
  elements: IfcElementRenderData[];
  boundingBox: THREE.Box3;
}

export interface StoredIfcRecord {
  projectId: string;
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  buffer: ArrayBuffer;
}

export type ElementExecutionStatus = "done" | "partial" | "pending" | "unmapped";

export interface ElementMatchResult {
  expressID: number;
  matchedBudgetItem?: string;
  matchedBudgetName?: string;
  matchedRoom?: string;
  matchedRoomActivityKey?: RoomActivityKey;
  matchedRoomItemId?: string;
  executionPct: number;
  status: ElementExecutionStatus;
}

const DB_NAME = "jgm_contech_ifc_cache";
const STORE_NAME = "ifc_models";
const DB_VERSION = 1;

function openIfcDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB no disponible en este navegador."));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("No se pudo abrir caché local IFC."));
  });
}

export async function saveIfcToIndexedDb(record: StoredIfcRecord): Promise<void> {
  try {
    const db = await openIfcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignorar silenciosamente en modo incógnito sin IndexedDB
  }
}

export async function loadIfcFromIndexedDb(projectId: string): Promise<StoredIfcRecord | null> {
  try {
    const db = await openIfcDb();
    const rec = await new Promise<StoredIfcRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(projectId);
      req.onsuccess = () => resolve((req.result as StoredIfcRecord) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rec;
  } catch {
    return null;
  }
}

export async function deleteIfcFromIndexedDb(projectId: string): Promise<void> {
  try {
    const db = await openIfcDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignorar fallo de limpieza
  }
}

function readIfcTextVal(field: any): string {
  if (field === null || field === undefined) return "";
  if (typeof field === "string" || typeof field === "number" || typeof field === "boolean") {
    return String(field).trim();
  }
  if (typeof field === "object" && "value" in field && field.value !== null && field.value !== undefined) {
    return String(field.value).trim();
  }
  return "";
}

function extractRefIds(arr: any): number[] {
  if (!Array.isArray(arr)) return [];
  const ids: number[] = [];
  for (const item of arr) {
    if (typeof item === "number") ids.push(item);
    else if (item && typeof item === "object" && typeof item.value === "number") ids.push(item.value);
  }
  return ids;
}

function collectMaterialNames(matObj: any, ifcApi: any, modelID: number): string[] {
  if (!matObj || typeof matObj !== "object") return [];
  const names: string[] = [];
  const directName = readIfcTextVal(matObj.Name);
  if (directName) names.push(directName);

  const layerSetRef = matObj.ForLayerSet?.value;
  const matLayers = Array.isArray(matObj.MaterialLayers) ? matObj.MaterialLayers : [];
  for (const mlRef of matLayers) {
    const mlId = typeof mlRef === "number" ? mlRef : mlRef?.value;
    if (!mlId) continue;
    try {
      const mlLine = ifcApi.GetLine(modelID, mlId, false);
      const mId = mlLine?.Material?.value;
      if (mId) {
        const mLine = ifcApi.GetLine(modelID, mId, false);
        const nm = readIfcTextVal(mLine?.Name);
        if (nm) names.push(nm);
      }
    } catch {
      // Ignorar referencia rota
    }
  }

  if (layerSetRef) {
    try {
      const ls = ifcApi.GetLine(modelID, layerSetRef, false);
      names.push(...collectMaterialNames(ls, ifcApi, modelID));
    } catch {
      // Ignorar
    }
  }

  const innerList = Array.isArray(matObj.Materials) ? matObj.Materials : [];
  for (const mRef of innerList) {
    const mId = typeof mRef === "number" ? mRef : mRef?.value;
    if (!mId) continue;
    try {
      const mLine = ifcApi.GetLine(modelID, mId, false);
      const nm = readIfcTextVal(mLine?.Name);
      if (nm) names.push(nm);
    } catch {
      // Ignorar
    }
  }
  return Array.from(new Set(names));
}

function convertFlatVertsToGeometry(verts: Float32Array, indices: Uint32Array, flatMatrix: number[]): THREE.BufferGeometry {
  const vertexCount = Math.floor(verts.length / 6);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  let hasNormal = false;
  for (let i = 0; i < vertexCount; i++) {
    const src = i * 6;
    const dst = i * 3;
    positions[dst] = verts[src];
    positions[dst + 1] = verts[src + 1];
    positions[dst + 2] = verts[src + 2];
    normals[dst] = verts[src + 3];
    normals[dst + 1] = verts[src + 4];
    normals[dst + 2] = verts[src + 5];
    if (!hasNormal && (normals[dst] !== 0 || normals[dst + 1] !== 0 || normals[dst + 2] !== 0)) {
      hasNormal = true;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

  if (Array.isArray(flatMatrix) && flatMatrix.length === 16) {
    const mat = new THREE.Matrix4().fromArray(flatMatrix);
    geometry.applyMatrix4(mat);
  }
  if (!hasNormal) {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function extractCommentsFromRawProps(rawProps: Record<string, string>): string {
  const targetKeys = ["comments", "comentarios", "comentario", "hubicacion", "ubicacion", "mark", "marca"];
  for (const [k, v] of Object.entries(rawProps)) {
    const baseKey = k.includes(".") ? k.split(".").pop() || k : k;
    if (targetKeys.includes(normalizarTexto(baseKey)) && v.trim()) {
      return v.trim();
    }
  }
  return "";
}

/**
 * Abre un archivo .IFC en memoria WASM (web-ifc), extrae geometrías Three.js
 * y consolida todos los PropertySets / `Comments` / Materiales de Revit en un único paso rápido.
 */
export async function parseIfcFileBuffer(
  buffer: ArrayBuffer,
  filename: string
): Promise<ParsedIfcModel> {
  const WebIFC = await import("web-ifc");
  const ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath("/wasm/", true);
  await ifcApi.Init(undefined, true);

  const uint8 = new Uint8Array(buffer);
  const modelID = ifcApi.OpenModel(uint8, {
    COORDINATE_TO_ORIGIN: true,
    CIRCLE_SEGMENTS: 12,
  });

  if (modelID < 0) {
    ifcApi.Dispose();
    throw new Error("No se pudo abrir el archivo .IFC. Verifica que no esté corrupto.");
  }

  try {
    // 1. Indexar niveles espaciales (IfcBuildingStorey) -> elementos
    const elementLevelMap = new Map<number, string>();
    try {
      const relSpatialIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
      for (let i = 0; i < relSpatialIds.size(); i++) {
        const rel = ifcApi.GetLine(modelID, relSpatialIds.get(i), false);
        const structId = rel?.RelatingStructure?.value;
        if (!structId) continue;
        const structLine = ifcApi.GetLine(modelID, structId, false);
        const levelName = readIfcTextVal(structLine?.Name) || readIfcTextVal(structLine?.LongName);
        if (!levelName) continue;
        for (const elId of extractRefIds(rel?.RelatedElements)) {
          elementLevelMap.set(elId, levelName);
        }
      }
    } catch {
      // Continuar si el IFC omite estructura espacial
    }

    // 2. Indexar PropertySets y Quantities (incluye `Comments`, `Comentarios`, `Mark`, `Area`)
    const elementPropsMap = new Map<number, Record<string, string>>();
    const attachProps = (elId: number, psetId: number) => {
      if (!psetId) return;
      try {
        const pset = ifcApi.GetLine(modelID, psetId, false);
        const psetName = readIfcTextVal(pset?.Name);
        const props = elementPropsMap.get(elId) || {};

        const hasProps = Array.isArray(pset?.HasProperties) ? pset.HasProperties : [];
        for (const pRef of hasProps) {
          const pId = typeof pRef === "number" ? pRef : pRef?.value;
          if (!pId) continue;
          const propLine = ifcApi.GetLine(modelID, pId, false);
          const pKey = readIfcTextVal(propLine?.Name);
          const pVal = readIfcTextVal(propLine?.NominalValue);
          if (pKey && pVal) {
            props[pKey] = pVal;
            if (psetName) props[`${psetName}.${pKey}`] = pVal;
          }
        }

        const quants = Array.isArray(pset?.Quantities) ? pset.Quantities : [];
        for (const qRef of quants) {
          const qId = typeof qRef === "number" ? qRef : qRef?.value;
          if (!qId) continue;
          const qLine = ifcApi.GetLine(modelID, qId, false);
          const qName = readIfcTextVal(qLine?.Name);
          const qVal =
            readIfcTextVal(qLine?.AreaValue) ||
            readIfcTextVal(qLine?.VolumeValue) ||
            readIfcTextVal(qLine?.LengthValue) ||
            readIfcTextVal(qLine?.CountValue);
          if (qName && qVal) props[qName] = qVal;
        }
        elementPropsMap.set(elId, props);
      } catch {
        // Ignorar PropertySet individual no legible
      }
    };

    try {
      const relPropIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
      for (let i = 0; i < relPropIds.size(); i++) {
        const rel = ifcApi.GetLine(modelID, relPropIds.get(i), false);
        const psetId = rel?.RelatingPropertyDefinition?.value;
        if (!psetId) continue;
        for (const elId of extractRefIds(rel?.RelatedObjects)) {
          attachProps(elId, psetId);
        }
      }
    } catch {
      // Ignorar si faltan PropertySets
    }

    // 3. Indexar relaciones de Tipo (IfcRelDefinesByType) para heredar Type name / HasPropertySets
    const elementTypeTextMap = new Map<number, string>();
    try {
      const relTypeIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYTYPE);
      for (let i = 0; i < relTypeIds.size(); i++) {
        const rel = ifcApi.GetLine(modelID, relTypeIds.get(i), false);
        const typeId = rel?.RelatingType?.value;
        if (!typeId) continue;
        const typeObj = ifcApi.GetLine(modelID, typeId, false);
        const typeText = [
          readIfcTextVal(typeObj?.Name),
          readIfcTextVal(typeObj?.Description),
          readIfcTextVal(typeObj?.ElementType),
        ]
          .filter(Boolean)
          .join(" ");
        const typePsets = extractRefIds(typeObj?.HasPropertySets);
        for (const elId of extractRefIds(rel?.RelatedObjects)) {
          if (typeText) elementTypeTextMap.set(elId, typeText);
          for (const tpId of typePsets) attachProps(elId, tpId);
        }
      }
    } catch {
      // Ignorar
    }

    // 4. Indexar materiales asociados (IfcRelAssociatesMaterial)
    const elementMaterialsMap = new Map<number, string[]>();
    try {
      const relMatIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELASSOCIATESMATERIAL);
      for (let i = 0; i < relMatIds.size(); i++) {
        const rel = ifcApi.GetLine(modelID, relMatIds.get(i), false);
        const matId = rel?.RelatingMaterial?.value;
        if (!matId) continue;
        const matLine = ifcApi.GetLine(modelID, matId, false);
        const matNames = collectMaterialNames(matLine, ifcApi, modelID);
        if (matNames.length === 0) continue;
        for (const elId of extractRefIds(rel?.RelatedObjects)) {
          const prev = elementMaterialsMap.get(elId) || [];
          elementMaterialsMap.set(elId, Array.from(new Set([...prev, ...matNames])));
        }
      }
    } catch {
      // Ignorar
    }

    // 5. Transmitir todas las mallas 3D desde Web-IFC hacia Three.js
    const elements: IfcElementRenderData[] = [];
    const boundingBox = new THREE.Box3();

    ifcApi.StreamAllMeshes(modelID, (mesh) => {
      try {
        const expressID = mesh.expressID;
        const parts: IfcGeometryPart[] = [];
        const geomCount = mesh.geometries.size();

        for (let gIdx = 0; gIdx < geomCount; gIdx++) {
          const placed = mesh.geometries.get(gIdx);
          const ifcGeom = ifcApi.GetGeometry(modelID, placed.geometryExpressID);
          const vSize = ifcGeom.GetVertexDataSize();
          const iSize = ifcGeom.GetIndexDataSize();

          if (vSize > 0 && iSize > 0) {
            const verts = ifcApi.GetVertexArray(ifcGeom.GetVertexData(), vSize);
            const indices = ifcApi.GetIndexArray(ifcGeom.GetIndexData(), iSize);
            const threeGeom = convertFlatVertsToGeometry(verts, indices, placed.flatTransformation);

            if (threeGeom.boundingBox && !threeGeom.boundingBox.isEmpty()) {
              boundingBox.union(threeGeom.boundingBox);
            }

            const originalColor = new THREE.Color(placed.color.x, placed.color.y, placed.color.z);
            const originalOpacity = placed.color.w > 0 ? placed.color.w : 1;
            parts.push({ geometry: threeGeom, originalColor, originalOpacity });
          }
          (ifcGeom as { delete?: () => void }).delete?.();
        }

        if (parts.length > 0) {
          const line = ifcApi.GetLine(modelID, expressID, false);
          const typeCode = ifcApi.GetLineType(modelID, expressID);
          const ifcType = String(ifcApi.GetNameFromTypeCode(typeCode) || "IFCELEMENT").toUpperCase();
          const name = readIfcTextVal(line?.Name);
          const objectType = readIfcTextVal(line?.ObjectType);
          const description = readIfcTextVal(line?.Description);
          const tag = readIfcTextVal(line?.Tag);
          const level = elementLevelMap.get(expressID) || "";
          const materialNames = elementMaterialsMap.get(expressID) || [];
          const rawProps = elementPropsMap.get(expressID) || {};
          const typeText = elementTypeTextMap.get(expressID) || "";

          const comments = extractCommentsFromRawProps(rawProps);

          const searchCorpus = [
            ifcType,
            name,
            objectType,
            description,
            tag,
            comments,
            typeText,
            level,
            ...materialNames,
            ...Object.values(rawProps),
          ]
            .filter(Boolean)
            .join(" ");

          elements.push({
            expressID,
            meta: {
              expressID,
              ifcType,
              name,
              objectType,
              description,
              tag,
              comments,
              level,
              materialNames,
              rawProps,
              searchTextNorm: normalizarTexto(searchCorpus),
            },
            parts,
          });
        }
      } finally {
        (mesh as { delete?: () => void }).delete?.();
      }
    });

    if (elements.length === 0) {
      throw new Error("El archivo .IFC se abrió pero no contiene geometría 3D visible.");
    }

    return {
      filename,
      sizeBytes: buffer.byteLength,
      elements,
      boundingBox,
    };
  } finally {
    ifcApi.CloseModel(modelID);
    ifcApi.Dispose();
  }
}

const IFC_TYPE_FALLBACK_KEYWORDS: Record<string, string[]> = {
  IFCCOVERING: ["cielo raso", "cielorraso", "ceiling"],
  IFCFOOTING: ["zapata", "zapatas", "cimentacion", "solado"],
  IFCCOLUMN: ["columna", "pedestal", "pedestales", "hea"],
  IFCBEAM: ["viga", "vigas", "ipe", "viga cinta"],
  IFCROOF: ["cubierta", "eternit", "teja", "techo"],
  IFCWALL: ["bloque", "mamposteria", "muro"],
  IFCWALLSTANDARDCASE: ["bloque", "mamposteria", "muro"],
  IFCWALLELEMENTEDCASE: ["bloque", "mamposteria", "muro"],
  IFCDOOR: ["puerta", "puertas"],
  IFCWINDOW: ["ventana", "ventanas", "ventaneria"],
  IFCSLAB: ["placa", "losa", "plantilla", "porcelanato", "enchape", "solado"],
  IFCSTAIR: ["escalera"],
  IFCRAILING: ["baranda", "pasamano"],
};

function findBestBudgetRowMatch(
  meta: IfcElementMeta,
  pptoBase: BudgetItem[]
): BudgetItem | undefined {
  if (!pptoBase || pptoBase.length === 0) return undefined;
  const txt = meta.searchTextNorm;

  // 1. Coincidencia prioritaria contra las match_keys del presupuesto del proyecto
  let bestRow: BudgetItem | undefined;
  let bestScore = 0;

  for (const row of pptoBase) {
    const keys = row.match_keys || [];
    let score = 0;
    for (const k of keys) {
      const kNorm = normalizarTexto(k);
      if (kNorm && txt.includes(kNorm)) {
        score += kNorm.length >= 7 ? 3 : 2;
      }
    }
    // Refuerzo por palabras significativas del nombre de la actividad
    const actNorm = normalizarTexto(row.Actividad);
    if (actNorm.includes("plantilla") && txt.includes("plantilla")) score += 4;
    if (actNorm.includes("porcelanato") && (txt.includes("porcelanato") || txt.includes("enchape"))) score += 4;
    if (actNorm.includes("frescasa") && (txt.includes("frescasa") || txt.includes("aislamiento") || txt.includes("fibra"))) score += 6;
    if (actNorm.includes("cielo raso") && !actNorm.includes("frescasa") && (txt.includes("cielo") || meta.ifcType === "IFCCOVERING")) score += 4;

    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (bestRow && bestScore >= 2) {
    return bestRow;
  }

  // 2. Respaldo por clase IFC (cuando el exportador omitió nombres detallados)
  const fallbackWords = IFC_TYPE_FALLBACK_KEYWORDS[meta.ifcType] || [];
  if (fallbackWords.length > 0) {
    for (const row of pptoBase) {
      const rowTxt = normalizarTexto(`${row.Actividad} ${(row.match_keys || []).join(" ")}`);
      if (fallbackWords.some((fw) => rowTxt.includes(fw))) {
        return row;
      }
    }
  }

  return undefined;
}

/**
 * Cruza cada elemento geométrico IFC contra el avance en Bitácora (`df_5d`) y,
 * cuando existen `Comments` o nombres por habitación, contra la ejecución por habitación.
 */
export function matchIfcElementsToProject(
  elements: IfcElementRenderData[],
  proyecto: ProjectConfig,
  data: ConsolidationResult
): Map<number, ElementMatchResult> {
  const result = new Map<number, ElementMatchResult>();
  const roomItems: RoomActivityItem[] = getInitialRoomItemsForProject(proyecto);
  const executedByRoom = computeExecutedByRoomItem(roomItems, data.obra_activa);
  const dfMap = new Map<string, number>();
  for (const row of data.df_5d || []) {
    dfMap.set(String(row.Item), Number(row["Avance_%"]) || 0);
  }

  for (const el of elements) {
    const { meta } = el;
    const budgetMatch = findBestBudgetRowMatch(meta, proyecto.ppto_base);

    // Detección de habitación/actividad a partir de Comments o Nombre de Revit
    let matchedRoom: string | undefined;
    let matchedRoomActivityKey: RoomActivityKey | undefined;
    let matchedRoomItemId: string | undefined;
    let roomPct: number | undefined;

    if (roomItems.length > 0) {
      const sourceForRoom = meta.comments || `${meta.name} ${meta.objectType}`;
      const classified = classifyRevitActivityAndRoom(sourceForRoom, `${meta.name} ${meta.objectType}`);
      const candidateItem = roomItems.find(
        (ri) =>
          normalizarTexto(ri.room) === normalizarTexto(classified.room) &&
          ri.activityKey === classified.activityKey
      );
      if (candidateItem) {
        matchedRoom = candidateItem.room;
        matchedRoomActivityKey = candidateItem.activityKey;
        matchedRoomItemId = candidateItem.id;
        const execQty = executedByRoom[candidateItem.id] || 0;
        roomPct = candidateItem.quantity > 0 ? (execQty / candidateItem.quantity) * 100 : 0;
      }
    }

    const dfPct = budgetMatch ? dfMap.get(String(budgetMatch.Item)) || 0 : 0;
    const finalPct = roomPct !== undefined && roomPct > 0 ? roomPct : dfPct;

    let status: ElementExecutionStatus = "unmapped";
    if (budgetMatch || matchedRoomItemId) {
      if (finalPct >= 99.5) status = "done";
      else if (finalPct > 0) status = "partial";
      else status = "pending";
    }

    result.set(meta.expressID, {
      expressID: meta.expressID,
      matchedBudgetItem: budgetMatch?.Item,
      matchedBudgetName: budgetMatch?.Actividad,
      matchedRoom,
      matchedRoomActivityKey,
      matchedRoomItemId,
      executionPct: Number(finalPct.toFixed(1)),
      status,
    });
  }

  return result;
}
