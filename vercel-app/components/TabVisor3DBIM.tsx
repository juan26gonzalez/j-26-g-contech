"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Box,
  Building2,
  Crosshair,
  DollarSign,
  DoorOpen,
  FolderOpen,
  Home,
  Lightbulb,
  Loader2,
  Package,
  Palette,
  Radio,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { normalizarTexto } from "../lib/calcClient";
import { buildShowcaseIfcModel, DEMO_SHOWCASE_PROJECT_ID } from "../lib/demoData";
import {
  deleteIfcFromIndexedDb,
  ElementMatchResult,
  loadIfcFromIndexedDb,
  matchIfcElementsToProject,
  ParsedIfcModel,
  parseIfcFileBuffer,
  saveIfcToIndexedDb,
} from "../lib/ifcEngine";
import { useAppPreferences } from "../lib/i18n";
import { BITACORA_APP_URL } from "../lib/projects";
import {
  CASA_MENDOZA_ROOM_ORDER,
  getInitialRoomItemsForProject,
  resolveUnitPriceForRoomItem,
} from "../lib/revitRooms";
import { ConsolidationResult, LiquidationParams, ProjectConfig, TabKey } from "../lib/types";
import { localizeActivity, localizeBitacoraObservacion, localizeTerm } from "../lib/units";

interface TabVisor3DBIMProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  onNavigateTab: (tab: TabKey) => void;
  isDemo?: boolean;
}

type ViewerMode = "semaforo" | "foco" | "caja3d" | "original";
type InspectorTab = "actividades" | "habitaciones" | "elemento";

function localizeRoomName(room: string, lang: "es" | "en"): string {
  if (lang === "es") return room;
  const fixed: Record<string, string> = {
    "Habitación Mamá": "Master Suite / Mom's Bedroom",
    "Habitacion Mama": "Master Suite / Mom's Bedroom",
    "Habitación Principal": "Primary Bedroom",
    "Habitación 1": "Bedroom 1",
    "Habitación 2": "Bedroom 2",
    "Sala": "Living Room",
    "Comedor": "Dining Room",
    "Sala / Comedor": "Living / Dining Area",
    "Cocina": "Kitchen",
    "Baño 1": "Bathroom 1",
    "Baño 2": "Bathroom 2",
    "Entrada / Puerta 1": "Main Entry / Door 1",
    "Pasillo": "Hallway",
    "Patio": "Patio / Courtyard",
    "Cubierta": "Roof Deck",
    "Zona A — Pórticos & Cimentación": "Zone A — Foundations & Structural Frame",
    "Zona B — Envolvente & Acabados": "Zone B — Envelope & Architectural Finishes",
    "Zona C — Cubierta & Carpintería": "Zone C — Roofing & Glazing",
  };
  return fixed[room] || localizeTerm(room, lang);
}

function formatLocalizedActivityTag(raw: string, lang: "es" | "en"): string {
  const m = /^(\[[^\]]+\]\s*)(.*)$/.exec(raw || "");
  if (m) return `${m[1]}${localizeActivity(m[2], lang)}`;
  return localizeActivity(localizeBitacoraObservacion(raw || "", lang), lang);
}

function disposeModelGeometries(model: ParsedIfcModel | null) {
  if (!model) return;
  for (const el of model.elements) {
    for (const part of el.parts) {
      part.geometry.dispose();
    }
  }
}

function fitCameraToBox(
  box: THREE.Box3,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  direction: THREE.Vector3 = new THREE.Vector3(1.15, 0.85, 1.15)
) {
  if (box.isEmpty()) return;
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fovRad = THREE.MathUtils.degToRad(camera.fov);
  const dist = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.45;
  const dirNorm = direction.clone().normalize();

  camera.position.copy(center).addScaledVector(dirNorm, dist);
  camera.near = Math.max(0.05, dist / 200);
  camera.far = Math.max(500, dist * 20);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

export default function TabVisor3DBIM({
  proyecto,
  data,
  params,
  onNavigateTab,
  isDemo = false,
}: TabVisor3DBIMProps) {
  const { lang, currency, unitSystem, rates, formatMoney, formatQty, unitLabel } =
    useAppPreferences();
  const isEn = lang === "en";
  const fxRate = rates[currency] ?? 1;
  const moneyDecimals = currency === "COP" ? 0 : 2;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 100));

  const meshMapRef = useRef<
    Map<number, { mesh: THREE.Mesh; originalColor: THREE.Color; originalOpacity: number }[]>
  >(new Map());
  const highlightedIdsRef = useRef<Set<number>>(new Set());
  const lastProjectIdRef = useRef<string | null>(null);
  const lastFittedSigRef = useRef<string>("");

  const [parsedModel, setParsedModel] = useState<ParsedIfcModel | null>(null);
  const [loadingIfc, setLoadingIfc] = useState<boolean>(false);
  const [ifcError, setIfcError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const [viewerMode, setViewerMode] = useState<ViewerMode>("semaforo");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("actividades");
  const [selectedBudgetItem, setSelectedBudgetItem] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedExpressId, setSelectedExpressId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Quick 3D cashflow simulator stored in COP
  const [cashBudget, setCashBudget] = useState<number>(3_000_000);
  const [cashRoomIds, setCashRoomIds] = useState<Record<string, boolean>>({});

  // Section Cut Z plane
  const [clipEnabled, setClipEnabled] = useState<boolean>(false);
  const [clipHeight, setClipHeight] = useState<number>(3.0);

  // Load cached IFC model (or rebuild localized OpenBIM demo showcase on language toggle)
  useEffect(() => {
    let cancelled = false;
    if (lastProjectIdRef.current !== proyecto.id) {
      setSelectedBudgetItem(null);
      setSelectedRoom(null);
      setSelectedExpressId(null);
      setIfcError(null);
      lastProjectIdRef.current = proyecto.id;
    }

    const loadCached = async () => {
      setLoadingIfc(true);
      try {
        const cached = await loadIfcFromIndexedDb(proyecto.id);
        if (cancelled) return;
        if (!cached) {
          if (proyecto.id === DEMO_SHOWCASE_PROJECT_ID || isDemo) {
            const showcase = buildShowcaseIfcModel(proyecto.nombre, lang);
            setParsedModel((prev) => {
              disposeModelGeometries(prev);
              return showcase;
            });
            return;
          }
          setParsedModel((prev) => {
            disposeModelGeometries(prev);
            return null;
          });
          return;
        }
        const model = await parseIfcFileBuffer(cached.buffer, cached.filename);
        if (cancelled) {
          disposeModelGeometries(model);
          return;
        }
        setParsedModel((prev) => {
          disposeModelGeometries(prev);
          return model;
        });
      } catch (err) {
        if (!cancelled) {
          setIfcError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoadingIfc(false);
      }
    };

    loadCached();
    return () => {
      cancelled = true;
    };
  }, [proyecto.id, proyecto.nombre, isDemo, lang]);

  const handleLoadShowcaseModel = useCallback(() => {
    setIfcError(null);
    setLoadingIfc(true);
    try {
      const showcase = buildShowcaseIfcModel(proyecto.nombre, lang);
      lastFittedSigRef.current = "";
      setParsedModel((prev) => {
        disposeModelGeometries(prev);
        return showcase;
      });
    } finally {
      setLoadingIfc(false);
    }
  }, [proyecto.nombre, lang]);

  const matchMap = useMemo(() => {
    if (!parsedModel) return new Map<number, ElementMatchResult>();
    return matchIfcElementsToProject(parsedModel.elements, proyecto, data);
  }, [parsedModel, proyecto, data]);

  const roomItems = useMemo(() => getInitialRoomItemsForProject(proyecto), [proyecto]);
  const aiuFactor = 1 + (params.pct_a + params.pct_i + params.pct_u) / 100;

  const groupedRooms = useMemo(() => {
    const map = new Map<string, { room: string; items: typeof roomItems; totalAiu: number }>();
    for (const it of roomItems) {
      const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base);
      const val = it.quantity * pu * aiuFactor;
      const entry = map.get(it.room) || { room: it.room, items: [], totalAiu: 0 };
      entry.items.push(it);
      entry.totalAiu += val;
      map.set(it.room, entry);
    }
    return Array.from(map.values()).sort((a, b) => {
      const ia = CASA_MENDOZA_ROOM_ORDER.indexOf(a.room);
      const ib = CASA_MENDOZA_ROOM_ORDER.indexOf(b.room);
      return (ia >= 0 ? ia : 999) - (ib >= 0 ? ib : 999);
    });
  }, [roomItems, proyecto.ppto_base, aiuFactor]);

  const countByBudgetItem = useMemo(() => {
    const counts = new Map<string, number>();
    matchMap.forEach((m) => {
      if (m.matchedBudgetItem) {
        counts.set(m.matchedBudgetItem, (counts.get(m.matchedBudgetItem) || 0) + 1);
      }
    });
    return counts;
  }, [matchMap]);

  const latestBitacoraEntry = useMemo(() => {
    for (const row of data.obra_activa || []) {
      const n = normalizarTexto(row.actividad);
      if (!n || n.includes("bim_takeoff") || n.includes("takeoff")) continue;
      return row;
    }
    return null;
  }, [data.obra_activa]);

  const { activeHighlightIds, statsSemaforo } = useMemo(() => {
    const hl = new Set<number>();
    let done = 0;
    let partial = 0;
    let pending = 0;
    let unmapped = 0;

    if (!parsedModel) {
      return { activeHighlightIds: hl, statsSemaforo: { done, partial, pending, unmapped } };
    }

    const qNorm = normalizarTexto(searchQuery);
    const activeCashRoomNames = new Set<string>();
    for (const it of roomItems) {
      if (cashRoomIds[it.id]) activeCashRoomNames.add(normalizarTexto(it.room));
    }

    for (const el of parsedModel.elements) {
      const match = matchMap.get(el.meta.expressID);
      const status = match?.status || "unmapped";
      if (status === "done") done++;
      else if (status === "partial") partial++;
      else if (status === "pending") pending++;
      else unmapped++;

      if (qNorm && el.meta.searchTextNorm.includes(qNorm)) {
        hl.add(el.expressID);
        continue;
      }

      if (viewerMode === "caja3d" && activeCashRoomNames.size > 0) {
        if (
          (match?.matchedRoom && activeCashRoomNames.has(normalizarTexto(match.matchedRoom))) ||
          Array.from(activeCashRoomNames).some((rn) => el.meta.searchTextNorm.includes(rn))
        ) {
          hl.add(el.expressID);
        }
      } else if (selectedBudgetItem && match?.matchedBudgetItem === selectedBudgetItem) {
        hl.add(el.expressID);
      } else if (selectedRoom) {
        const rNorm = normalizarTexto(selectedRoom);
        if (
          (match?.matchedRoom && normalizarTexto(match.matchedRoom) === rNorm) ||
          el.meta.searchTextNorm.includes(rNorm)
        ) {
          hl.add(el.expressID);
        }
      }
    }

    return {
      activeHighlightIds: hl,
      statsSemaforo: { done, partial, pending, unmapped },
    };
  }, [
    parsedModel,
    matchMap,
    viewerMode,
    selectedBudgetItem,
    selectedRoom,
    searchQuery,
    roomItems,
    cashRoomIds,
  ]);

  useEffect(() => {
    highlightedIdsRef.current = activeHighlightIds;
  }, [activeHighlightIds]);

  const handleLoadIfcFile = async (file: File) => {
    setLoadingIfc(true);
    setIfcError(null);
    try {
      const buffer = await file.arrayBuffer();
      const model = await parseIfcFileBuffer(buffer, file.name);
      await saveIfcToIndexedDb({
        projectId: proyecto.id,
        filename: file.name,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        buffer,
      });
      lastFittedSigRef.current = "";
      setParsedModel((prev) => {
        disposeModelGeometries(prev);
        return model;
      });
      setSelectedBudgetItem(null);
      setSelectedRoom(null);
      setSelectedExpressId(null);
    } catch (err) {
      setIfcError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingIfc(false);
    }
  };

  const handleClearIfcModel = async () => {
    await deleteIfcFromIndexedDb(proyecto.id);
    lastFittedSigRef.current = "";
    setParsedModel((prev) => {
      disposeModelGeometries(prev);
      return null;
    });
    setSelectedBudgetItem(null);
    setSelectedRoom(null);
    setSelectedExpressId(null);
  };

  const focusOnExpressIds = useCallback((ids: Set<number>) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl || ids.size === 0) return;

    const focusBox = new THREE.Box3();
    ids.forEach((id) => {
      const entries = meshMapRef.current.get(id);
      if (!entries) return;
      for (const e of entries) {
        if (!e.mesh.geometry.boundingBox) e.mesh.geometry.computeBoundingBox();
        if (e.mesh.geometry.boundingBox) focusBox.union(e.mesh.geometry.boundingBox);
      }
    });
    if (!focusBox.isEmpty()) {
      fitCameraToBox(focusBox, cam, ctrl);
    }
  }, []);

  // Init Three.js WebGL scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 480;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(12, 9, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.localClippingEnabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 1.05);
    scene.add(hemi);
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.15);
    dir1.position.set(18, 28, 16);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight(0x94a3b8, 0.55);
    dir2.position.set(-16, 12, -14);
    scene.add(dir2);

    const grid = new THREE.GridHelper(36, 36, 0x334155, 0x1e293b);
    scene.add(grid);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    modelGroupRef.current = modelGroup;
    gridRef.current = grid;

    const raycaster = new THREE.Raycaster();
    const pointerDownPos = { x: 0, y: 0 };
    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos.x = ev.clientX;
      pointerDownPos.y = ev.clientY;
    };
    const onPointerUp = (ev: PointerEvent) => {
      const moveDist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (moveDist > 6 || !modelGroupRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(modelGroupRef.current.children, false);
      if (hits.length > 0) {
        const eid = Number(hits[0].object.userData?.expressID);
        if (eid) {
          setSelectedExpressId(eid);
          setInspectorTab("elemento");
        }
      } else {
        setSelectedExpressId(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    ro.observe(container);

    let rafId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      rafId = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const pulse = 0.25 + 0.22 * (0.5 + 0.5 * Math.sin(t * 4.2));

      highlightedIdsRef.current.forEach((id) => {
        const entries = meshMapRef.current.get(id);
        if (!entries) return;
        for (const e of entries) {
          const mat = e.mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = pulse;
          }
        }
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Rebuild meshes when parsed IFC model changes
  useEffect(() => {
    const group = modelGroupRef.current;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    const grid = gridRef.current;
    if (!group || !cam || !ctrl) return;

    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      group.remove(child);
      const m = child.material as THREE.Material;
      if (m && typeof m.dispose === "function") m.dispose();
    }
    meshMapRef.current.clear();

    if (!parsedModel) return;

    for (const el of parsedModel.elements) {
      const entries: { mesh: THREE.Mesh; originalColor: THREE.Color; originalOpacity: number }[] = [];
      for (const part of el.parts) {
        const mat = new THREE.MeshStandardMaterial({
          color: part.originalColor.clone(),
          roughness: 0.55,
          metalness: 0.12,
          side: THREE.DoubleSide,
          transparent: part.originalOpacity < 0.99,
          opacity: part.originalOpacity,
        });
        const mesh = new THREE.Mesh(part.geometry, mat);
        mesh.userData = { expressID: el.expressID };
        group.add(mesh);
        entries.push({
          mesh,
          originalColor: part.originalColor.clone(),
          originalOpacity: part.originalOpacity,
        });
      }
      meshMapRef.current.set(el.expressID, entries);
    }

    const sig = `${proyecto.id}::${parsedModel.filename}`;
    if (!parsedModel.boundingBox.isEmpty() && lastFittedSigRef.current !== sig) {
      lastFittedSigRef.current = sig;
      if (grid) {
        grid.position.y = parsedModel.boundingBox.min.y - 0.02;
      }
      setClipHeight(Number((parsedModel.boundingBox.max.y + 0.05).toFixed(2)));
      fitCameraToBox(parsedModel.boundingBox, cam, ctrl);
    }
  }, [parsedModel, proyecto.id]);

  // Reactive materials & section clipping
  useEffect(() => {
    if (!parsedModel) return;
    clipPlaneRef.current.constant = clipHeight;
    const hasFilterFocus = activeHighlightIds.size > 0;

    for (const el of parsedModel.elements) {
      const entries = meshMapRef.current.get(el.expressID);
      if (!entries) continue;

      const match = matchMap.get(el.expressID);
      const isSelected = selectedExpressId === el.expressID;
      const isHighlighted = activeHighlightIds.has(el.expressID);

      for (const { mesh, originalColor, originalOpacity } of entries) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.clippingPlanes = clipEnabled ? [clipPlaneRef.current] : [];

        if (isSelected) {
          mat.color.setHex(0x38bdf8);
          mat.emissive.setHex(0x0284c7);
          mat.emissiveIntensity = 0.45;
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
        } else if (hasFilterFocus) {
          if (isHighlighted) {
            if (match?.status === "done") {
              mat.color.setHex(0x10b981);
              mat.emissive.setHex(0x059669);
            } else if (viewerMode === "caja3d") {
              mat.color.setHex(0x2dd4bf);
              mat.emissive.setHex(0x0d9488);
            } else {
              mat.color.setHex(0xf59e0b);
              mat.emissive.setHex(0xd97706);
            }
            mat.emissiveIntensity = 0.35;
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
          } else {
            mat.color.setHex(0x475569);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
            mat.transparent = true;
            mat.opacity = 0.14;
            mat.depthWrite = false;
          }
        } else if (viewerMode === "original") {
          mat.color.copy(originalColor);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
          mat.transparent = originalOpacity < 0.99;
          mat.opacity = originalOpacity;
          mat.depthWrite = originalOpacity >= 0.99;
        } else {
          if (match?.status === "done") {
            mat.color.setHex(0x10b981);
            mat.emissive.setHex(0x047857);
            mat.emissiveIntensity = 0.18;
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
          } else if (match?.status === "partial") {
            mat.color.setHex(0xf59e0b);
            mat.emissive.setHex(0xb45309);
            mat.emissiveIntensity = 0.18;
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
          } else if (match?.status === "pending") {
            mat.color.setHex(0xcbd5e1);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
            mat.transparent = true;
            mat.opacity = 0.42;
            mat.depthWrite = true;
          } else {
            mat.color.copy(originalColor);
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
            mat.transparent = true;
            mat.opacity = Math.min(originalOpacity, 0.35);
            mat.depthWrite = false;
          }
        }
        mat.needsUpdate = true;
      }
    }
  }, [
    parsedModel,
    matchMap,
    viewerMode,
    activeHighlightIds,
    selectedExpressId,
    clipEnabled,
    clipHeight,
  ]);

  const handleSelectBudgetActivity = (itemCode: string) => {
    const next = selectedBudgetItem === itemCode ? null : itemCode;
    setSelectedBudgetItem(next);
    setSelectedRoom(null);
    if (next) {
      setViewerMode("foco");
      const ids = new Set<number>();
      matchMap.forEach((m, eid) => {
        if (m.matchedBudgetItem === next) ids.add(eid);
      });
      if (ids.size > 0) focusOnExpressIds(ids);
    } else {
      setViewerMode("semaforo");
    }
  };

  const handleSelectRoom = (roomName: string) => {
    const next = selectedRoom === roomName ? null : roomName;
    setSelectedRoom(next);
    setSelectedBudgetItem(null);
    if (next && parsedModel) {
      setViewerMode("foco");
      const rNorm = normalizarTexto(next);
      const ids = new Set<number>();
      for (const el of parsedModel.elements) {
        const m = matchMap.get(el.expressID);
        if ((m?.matchedRoom && normalizarTexto(m.matchedRoom) === rNorm) || el.meta.searchTextNorm.includes(rNorm)) {
          ids.add(el.expressID);
        }
      }
      if (ids.size > 0) focusOnExpressIds(ids);
    } else {
      setViewerMode("semaforo");
    }
  };

  const handleIluminarUltimoAvance = () => {
    if (!latestBitacoraEntry || !parsedModel) return;
    const actNorm = normalizarTexto(latestBitacoraEntry.actividad);

    for (const grp of groupedRooms) {
      const rNorm = normalizarTexto(grp.room);
      if (actNorm.includes(`[${rNorm}]`) || actNorm.includes(rNorm)) {
        handleSelectRoom(grp.room);
        setInspectorTab("habitaciones");
        return;
      }
    }

    for (const row of proyecto.ppto_base) {
      const keys = row.match_keys || [];
      if (keys.some((k) => actNorm.includes(normalizarTexto(k)))) {
        handleSelectBudgetActivity(row.Item);
        setInspectorTab("actividades");
        return;
      }
    }
  };

  const handleAutoSugerirCaja3D = () => {
    let acc = 0;
    const next: Record<string, boolean> = {};
    for (const grp of groupedRooms) {
      if (grp.totalAiu > 0 && acc + grp.totalAiu <= cashBudget) {
        for (const it of grp.items) next[it.id] = true;
        acc += grp.totalAiu;
      }
    }
    setCashRoomIds(next);
    setViewerMode("caja3d");
    setSelectedBudgetItem(null);
    setSelectedRoom(null);
  };

  const selectedElement = useMemo(() => {
    if (!parsedModel || selectedExpressId === null) return null;
    return parsedModel.elements.find((e) => e.expressID === selectedExpressId) || null;
  }, [parsedModel, selectedExpressId]);

  const selectedElementMatch = useMemo(() => {
    if (selectedExpressId === null) return null;
    return matchMap.get(selectedExpressId) || null;
  }, [matchMap, selectedExpressId]);

  const setCameraPreset = (preset: "iso" | "top" | "front" | "side") => {
    if (!parsedModel || !cameraRef.current || !controlsRef.current) return;
    const dirs: Record<typeof preset, THREE.Vector3> = {
      iso: new THREE.Vector3(1.15, 0.85, 1.15),
      top: new THREE.Vector3(0.01, 1.8, 0.01),
      front: new THREE.Vector3(0, 0.25, 1.5),
      side: new THREE.Vector3(1.5, 0.25, 0),
    };
    fitCameraToBox(parsedModel.boundingBox, cameraRef.current, controlsRef.current, dirs[preset]);
  };

  const clipBounds = useMemo(() => {
    if (!parsedModel || parsedModel.boundingBox.isEmpty()) return { min: 0, max: 5 };
    return {
      min: Number((parsedModel.boundingBox.min.y + 0.1).toFixed(2)),
      max: Number((parsedModel.boundingBox.max.y + 0.1).toFixed(2)),
    };
  }, [parsedModel]);

  const clipDisplayLabel =
    unitSystem === "imperial"
      ? `${(clipHeight * 3.28084).toFixed(1)} ft`
      : `${clipHeight.toFixed(2)} m`;
  const displayCashInput = Math.round(cashBudget / fxRate);

  return (
    <div className="space-y-4">
      {/* Header & IFC Controls */}
      <div className="bento-card flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Box className="w-4 h-4 text-slate-800 shrink-0" />
            <span>
              {isEn
                ? "Reactive 3D BIM Digital Twin (.IFC OpenBIM / Revit)"
                : "Visor 3D BIM Reactivo (.IFC Autodesk Revit)"}
            </span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {isEn ? (
              <>
                The 3D twin updates live from <b>Cloud Field Logs</b>, highlights <b>5D BOQ</b> items, and projects your <b>Cashflow Simulator</b> directly onto building zones.
              </>
            ) : (
              <>
                El modelo 3D reacciona automáticamente a <b>Bitácora Cloud</b>, ilumina actividades del <b>Presupuesto 5D</b> y proyecta tu <b>Simulador de Caja</b> sobre las habitaciones.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {parsedModel && (
            <span className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 border border-slate-300 text-[11px] font-bold text-slate-800 inline-flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-600" />
              <span>
                {parsedModel.filename} ({(parsedModel.sizeBytes / 1024).toFixed(0)} KB •{" "}
                {parsedModel.elements.length} {isEn ? "elem." : "elem."})
              </span>
            </span>
          )}

          <label className="cursor-pointer steel-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5">
            {loadingIfc ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isEn ? "Loading IFC..." : "Cargando IFC..."}</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{isEn ? "Upload Revit .IFC" : "Cargar .IFC de Revit"}</span>
              </>
            )}
            <input
              type="file"
              accept=".ifc"
              disabled={loadingIfc}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLoadIfcFile(f);
                e.target.value = "";
              }}
              className="hidden"
            />
          </label>

          {parsedModel && (
            <button
              type="button"
              onClick={handleClearIfcModel}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-700 inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isEn ? "Remove" : "Quitar"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Field Log Banner */}
      {latestBitacoraEntry && (
        <div className="steel-panel-dark rounded-2xl px-4 py-2.5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
              <Radio className="w-3 h-3" />
              <span>{isEn ? "Latest Field Progress" : "Último Avance en Vivo"}</span>
            </span>
            <span className="font-semibold text-slate-100">
              {formatLocalizedActivityTag(latestBitacoraEntry.actividad, lang)}
            </span>
            <span className="font-mono text-emerald-300">
              ({formatQty(latestBitacoraEntry.cantidad, latestBitacoraEntry.unidad || "m²", 1)}{" "}
              {unitLabel(latestBitacoraEntry.unidad || "m²")})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleIluminarUltimoAvance}
              disabled={!parsedModel}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold disabled:opacity-40 transition inline-flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isEn ? "Highlight in 3D" : "Iluminar en 3D"}</span>
            </button>
            <a
              href={BITACORA_APP_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition inline-flex items-center gap-1"
            >
              <span>{isEn ? "Field App" : "Abrir Bitácora"}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {ifcError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{ifcError}</span>
        </div>
      )}

      {/* Main Split: 3D Viewport + Interactive BIM 5D Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* 3D CANVAS COLUMN */}
        <div className="xl:col-span-8 space-y-3">
          {/* Toolbar */}
          <div className="bento-card !p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  key: "semaforo" as const,
                  label: isEn ? "Status Heatmap" : "Semáforo Avance",
                  icon: <Activity className="w-3.5 h-3.5" />,
                },
                {
                  key: "foco" as const,
                  label: isEn ? "Isolate Focus" : "Foco Selección",
                  icon: <Crosshair className="w-3.5 h-3.5" />,
                },
                {
                  key: "caja3d" as const,
                  label: isEn ? "3D Cashflow" : "Caja 3D",
                  icon: <Sparkles className="w-3.5 h-3.5" />,
                },
                {
                  key: "original" as const,
                  label: isEn ? "Revit Materials" : "Revit Original",
                  icon: <Palette className="w-3.5 h-3.5" />,
                },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setViewerMode(m.key);
                    if (m.key === "semaforo" || m.key === "original") {
                      setSelectedBudgetItem(null);
                      setSelectedRoom(null);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition inline-flex items-center gap-1.5 ${
                    viewerMode === m.key
                      ? "steel-btn-primary text-white"
                      : "bg-slate-200/75 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {m.icon}
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(["iso", "top", "front", "side"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={!parsedModel}
                  onClick={() => setCameraPreset(preset)}
                  className="px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 disabled:opacity-40"
                >
                  {preset === "iso"
                    ? "Iso"
                    : preset === "top"
                    ? isEn
                      ? "Top"
                      : "Planta"
                    : preset === "front"
                    ? isEn
                      ? "Front"
                      : "Frente"
                    : isEn
                    ? "Side"
                    : "Lateral"}
                </button>
              ))}

              <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clipEnabled}
                  disabled={!parsedModel}
                  onChange={(e) => setClipEnabled(e.target.checked)}
                  className="accent-slate-900"
                />
                {isEn ? "Section Z" : "Corte Z"}
              </label>

              {clipEnabled && parsedModel && (
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="range"
                    min={clipBounds.min}
                    max={clipBounds.max}
                    step={0.05}
                    value={clipHeight}
                    onChange={(e) => setClipHeight(Number(e.target.value))}
                    className="w-24 accent-slate-900"
                    title={
                      isEn
                        ? `Section elevation: ${clipDisplayLabel}`
                        : `Altura de corte: ${clipDisplayLabel}`
                    }
                  />
                  <span className="font-mono text-[10px] font-bold text-slate-600">
                    {clipDisplayLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* WebGL Viewport + Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.name.toLowerCase().endsWith(".ifc")) {
                handleLoadIfcFile(file);
              }
            }}
            className={`relative rounded-2xl overflow-hidden border transition-all h-[500px] ${
              isDragOver ? "border-emerald-400 ring-4 ring-emerald-400/30" : "border-slate-700/70"
            }`}
          >
            <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Empty Overlay */}
            {!parsedModel && !loadingIfc && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6 text-center">
                <div className="max-w-lg space-y-4">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 border border-slate-600 text-emerald-400">
                    <Box className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-extrabold text-white">
                    {isEn
                      ? `Drag & drop your .IFC model for ${proyecto.nombre}`
                      : `Arrastra aquí tu modelo .IFC de ${proyecto.nombre}`}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isEn
                      ? "Your IFC file runs 100% locally in your browser and stays cached in IndexedDB for instant reopening."
                      : "Tu modelo se procesará 100% en tu navegador y quedará guardado en caché local (IndexedDB) para abrir instantáneamente."}
                  </p>
                  <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 text-left text-[11px] text-slate-300 space-y-1">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isEn
                          ? "Autodesk Revit Tip for Zone Mapping (Comments):"
                          : "Tip en Autodesk Revit 2027 para incluir habitaciones (Comments):"}
                      </span>
                    </div>
                    <div>
                      1. <b>File → Export → IFC → Modify Setup… → Property Sets</b>
                    </div>
                    <div>
                      2.{" "}
                      {isEn
                        ? "Enable Export Revit property sets (IFC2x3 Coordination View 2.0) to stream Comments & Materials."
                        : "Marca Export Revit property sets (y IFC2x3 Coordination View 2.0) para que viajen Comments y materiales."}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg transition">
                      <FolderOpen className="w-4 h-4" />
                      <span>{isEn ? "Select .IFC File" : "Seleccionar Archivo .IFC"}</span>
                      <input
                        type="file"
                        accept=".ifc"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLoadIfcFile(f);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleLoadShowcaseModel}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-500 px-4 py-2.5 text-xs font-extrabold text-white shadow-lg transition"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>
                        {isEn
                          ? "Load OpenBIM 3D Demo Twin"
                          : "Cargar Modelo Demo 3D (OpenBIM)"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Floating Legend */}
            {parsedModel && (
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-950/80 backdrop-blur px-3 py-1.5 text-[10px] font-bold text-slate-200 border border-slate-700/70">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {isEn ? "100% Built" : "100% Ejec."} ({statsSemaforo.done})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  {isEn ? "In Progress" : "En Curso"} ({statsSemaforo.partial})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  {isEn ? "Pending" : "Pendiente"} ({statsSemaforo.pending})
                </span>
                <span className="text-slate-400">
                  {isEn
                    ? "• Drag: orbit | Wheel: zoom | Click: inspect"
                    : "• Arrastra: rotar | Rueda: zoom | Clic: inspeccionar"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* REACTIVE SIDE INSPECTOR */}
        <div className="xl:col-span-4 bento-card !p-4 flex flex-col gap-3 max-h-[572px]">
          <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setInspectorTab("actividades")}
              className={`py-1.5 rounded-lg transition inline-flex items-center justify-center gap-1 ${
                inspectorTab === "actividades" ? "steel-btn-primary text-white" : "text-slate-700"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{isEn ? `BOQ (${data.df_5d.length})` : `APU (${data.df_5d.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab("habitaciones")}
              className={`py-1.5 rounded-lg transition inline-flex items-center justify-center gap-1 ${
                inspectorTab === "habitaciones" ? "steel-btn-primary text-white" : "text-slate-700"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>{isEn ? `Zones (${groupedRooms.length})` : `Zonas (${groupedRooms.length})`}</span>
            </button>
            <button
              type="button"
              onClick={() => setInspectorTab("elemento")}
              className={`py-1.5 rounded-lg transition inline-flex items-center justify-center gap-1 ${
                inspectorTab === "elemento" ? "steel-btn-primary text-white" : "text-slate-700"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isEn ? "Element" : "Elemento"}</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isEn
                  ? "Filter in 3D (e.g. Slab, Wall, Roof)..."
                  : "Filtrar en 3D (ej. Porcelanato, Mamá, Muro)..."
              }
              className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {inspectorTab === "actividades" &&
              data.df_5d.map((row) => {
                const count3d = countByBudgetItem.get(row.Item) || 0;
                const active = selectedBudgetItem === row.Item;
                return (
                  <button
                    key={row.Item}
                    type="button"
                    onClick={() => handleSelectBudgetActivity(row.Item)}
                    className={`w-full text-left rounded-xl p-2.5 border transition text-xs ${
                      active
                        ? "bg-slate-900 text-white border-slate-900 shadow-md"
                        : "steel-subcard hover:bg-white text-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-extrabold leading-snug">
                        {row.Item}. {localizeActivity(row.Actividad, lang)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 ${
                          active ? "bg-emerald-500 text-slate-950 font-extrabold" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {count3d} 3D
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-90">
                      <span className="font-mono">
                        {formatQty(row.Cantidad_Ejecutada, row.Unidad, 1)} /{" "}
                        {formatQty(row.Cantidad_Contratada, row.Unidad, 1)} {unitLabel(row.Unidad)}
                      </span>
                      <span className="font-bold">{row["Avance_%"].toFixed(1)}%</span>
                    </div>
                  </button>
                );
              })}

            {inspectorTab === "habitaciones" && (
              <>
                <div className="steel-subcard rounded-xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-700 inline-flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                      <span>
                        {isEn ? `Cash today (${currency}):` : `Caja hoy (${currency}):`}
                      </span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={currency === "COP" ? 250000 : 100}
                      value={displayCashInput}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setCashBudget(fxRate > 0 ? val * fxRate : val);
                      }}
                      className="w-32 rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono font-bold text-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoSugerirCaja3D}
                    disabled={groupedRooms.length === 0}
                    className="w-full steel-btn-primary py-1.5 rounded-lg text-xs font-extrabold disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {isEn
                        ? "Highlight in 3D what fits this budget"
                        : "Iluminar en 3D qué alcanza con esta caja"}
                    </span>
                  </button>
                </div>

                {groupedRooms.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    {isEn ? "No zones configured yet. Import them in " : "Este proyecto aún no tiene habitaciones configuradas. Puedes importarlas en "}
                    <button
                      type="button"
                      onClick={() => onNavigateTab("habitaciones")}
                      className="font-bold text-slate-800 underline"
                    >
                      {isEn ? "Zones & Cashflow" : "Habitaciones & Caja"}
                    </button>
                    .
                  </div>
                ) : (
                  groupedRooms.map((grp) => {
                    const active = selectedRoom === grp.room;
                    return (
                      <button
                        key={grp.room}
                        type="button"
                        onClick={() => handleSelectRoom(grp.room)}
                        className={`w-full text-left rounded-xl p-2.5 border transition text-xs ${
                          active
                            ? "bg-slate-900 text-white border-slate-900 shadow-md"
                            : "steel-subcard hover:bg-white text-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold inline-flex items-center gap-1.5">
                            <DoorOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
                            <span>{localizeRoomName(grp.room, lang)}</span>
                          </span>
                          <span className="font-mono font-bold">
                            {formatMoney(grp.totalAiu, moneyDecimals)}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] opacity-80">
                          {grp.items
                            .map(
                              (it) =>
                                `${localizeActivity(it.activityLabel, lang)}: ${formatQty(
                                  it.quantity,
                                  it.unit,
                                  1
                                )} ${unitLabel(it.unit)}`
                            )
                            .join(" • ")}
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {inspectorTab === "elemento" && (
              <>
                {!selectedElement ? (
                  <div className="steel-subcard rounded-xl p-6 text-center text-xs text-slate-500">
                    {isEn
                      ? "Click any slab, wall, ceiling, column, roof, or beam in the 3D viewport to inspect its OpenBIM IFC parameters and 5D BOQ execution state."
                      : "Haz clic sobre cualquier piso, muro, cielo raso, columna o viga en el visor 3D para inspeccionar sus parámetros IFC de Revit y su estado en el Presupuesto 5D."}
                  </div>
                ) : (
                  <div className="steel-subcard rounded-xl p-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-extrabold text-slate-900">
                        #{selectedElement.expressID} • {selectedElement.meta.ifcType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedElementMatch?.status === "done"
                            ? "bg-emerald-100 text-emerald-800"
                            : selectedElementMatch?.status === "partial"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {selectedElementMatch?.executionPct ?? 0}% {isEn ? "built" : "ejec."}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div>
                        <b>{isEn ? "Name:" : "Nombre:"}</b> {selectedElement.meta.name || "—"}
                      </div>
                      <div>
                        <b>{isEn ? "Type / Family:" : "Tipo / Familia:"}</b>{" "}
                        {selectedElement.meta.objectType || "—"}
                      </div>
                      <div>
                        <b>{isEn ? "Comments (Revit):" : "Comments (Revit):"}</b>{" "}
                        <span className="font-mono text-emerald-800 font-bold">
                          {selectedElement.meta.comments ||
                            (isEn ? "Not included in IFC" : "No incluido en IFC")}
                        </span>
                      </div>
                      <div>
                        <b>{isEn ? "Level:" : "Nivel:"}</b> {selectedElement.meta.level || "—"}
                      </div>
                      <div>
                        <b>{isEn ? "Materials:" : "Materiales:"}</b>{" "}
                        {selectedElement.meta.materialNames.length > 0
                          ? selectedElement.meta.materialNames.join(", ")
                          : "—"}
                      </div>
                      <div>
                        <b>{isEn ? "5D BOQ Item:" : "Partida APU:"}</b>{" "}
                        {selectedElementMatch?.matchedBudgetName
                          ? `${selectedElementMatch.matchedBudgetItem}. ${localizeActivity(
                              selectedElementMatch.matchedBudgetName,
                              lang
                            )}`
                          : isEn
                          ? "Unmatched"
                          : "Sin cruce automático"}
                      </div>
                      {selectedElementMatch?.matchedRoom && (
                        <div>
                          <b>{isEn ? "Linked Zone:" : "Habitación vinculada:"}</b>{" "}
                          {localizeRoomName(selectedElementMatch.matchedRoom, lang)}
                        </div>
                      )}
                    </div>

                    {Object.keys(selectedElement.meta.rawProps).length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                          {isEn ? "Detected IFC Properties" : "Propiedades IFC detectadas"}
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-0.5 font-mono text-[10px] text-slate-600">
                          {Object.entries(selectedElement.meta.rawProps)
                            .slice(0, 18)
                            .map(([k, v]) => (
                              <div key={k} className="truncate" title={`${k}: ${v}`}>
                                <b>{k}:</b> {v}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
