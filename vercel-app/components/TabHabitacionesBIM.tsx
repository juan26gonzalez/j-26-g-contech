"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CloudCog,
  DollarSign,
  DoorOpen,
  FileSpreadsheet,
  Gem,
  Layers,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  SquareStack,
  Thermometer,
  Upload,
  Wallet,
} from "lucide-react";
import { callPythonJson, normalizarTexto } from "../lib/calcClient";
import { useAppPreferences } from "../lib/i18n";
import {
  CASA_MENDOZA_ROOM_ORDER,
  CASA_MENDOZA_ROOMS_BASE,
  computeExecutedByRoomItem,
  computeMaterialsForRoomSelection,
  getInitialRoomItemsForProject,
  parseRevitScheduleLocal,
  resolveUnitPriceForRoomItem,
  slugRoomActivityId,
} from "../lib/revitRooms";
import {
  ConsolidationResult,
  LiquidationParams,
  ProjectConfig,
  RoomActivityItem,
  RoomActivityKey,
} from "../lib/types";
import {
  convertQty,
  convertUnitLabel,
  localizeActivity,
  localizeMaterialName,
  localizeRoomName,
  localizeTerm,
  unitConversionFactor,
} from "../lib/units";

interface TabHabitacionesBIMProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  onUpdateProyecto: (updated: ProjectConfig) => void;
}

const PRESET_BUDGETS_COP = [1_500_000, 3_000_000, 5_000_000, 8_000_000, 12_000_000];
const PRESET_BUDGETS_FX = [500, 1_000, 2_000, 3_500, 5_000];

const ACTIVITY_LABELS_ES: Record<RoomActivityKey, string> = {
  plantilla: "Plantilla de concreto 7cm",
  enchape: "Enchape piso porcelanato 51x51",
  enchape_pared: "Enchape pared cerámica / porcelanato",
  cielorraso: "Cielo raso",
  frescasa: "Frescasa Eco 2-1/2\" (sobre cielo raso)",
  mamposteria: "Muros mampostería bloque No. 12",
  panete: "Pañete muros",
  pintura: "Estuco y pintura",
  carpinteria: "Carpintería (puertas/ventanas)",
  cubierta: "Cubierta Eternit",
  otro: "Otra actividad BIM",
};

const ACTIVITY_LABELS_EN: Record<RoomActivityKey, string> = {
  plantilla: "Concrete floor screed 2.75 in",
  enchape: "Porcelain floor tile 20x20 in",
  enchape_pared: "Ceramic / porcelain wall tile",
  cielorraso: "Suspended ceiling",
  frescasa: "Frescasa Eco 2-1/2\" (above ceiling)",
  mamposteria: "CMU block masonry walls",
  panete: "Stucco & plaster render",
  pintura: "Skim coat & architectural paint",
  carpinteria: "Doors & glazing millwork",
  cubierta: "Corrugated roofing",
  otro: "Other BIM activity",
};

const ROOM_MATERIAL_EN: Record<string, string> = {
  "Concreto Simple f'c=14 MPa (Plantilla e=7cm)": "Plain concrete f'c=2,000 PSI (2.75 in screed)",
  "Cemento Gris para Plantilla (Sacos 50kg)": "Gray Portland cement for screed (110 lb bags)",
  "Porcelanato / Cerámica 51x51 cm (inc. 5% desp.)": "Porcelain / ceramic tile 20x20 in (incl. 5% waste)",
  "Pegacor Cerámico (Bultos 25kg)": "Polymer tile adhesive mortar (55 lb bags)",
  "Boquilla para Junta": "Tile grout for joints",
  "Cerámica / Porcelanato de Pared (inc. 8% desp. cortes)": "Wall ceramic / porcelain tile (incl. 8% cut waste)",
  "Pegacor Blanco / Cerámico Pared (Bultos 25kg)": "White wall tile adhesive (55 lb bags)",
  "Boquilla Antimoho para Muro": "Mildew-resistant wall grout",
  "Panel de Cielorraso Suspendido (inc. 5% desp.)": "Suspended drywall ceiling panel (incl. 5% waste)",
  "Perfilería Angular y Perfiles Omega": "Perimeter angle & furring channel grid",
  "Rollo Frescasa Eco 2-1/2\" (7.62×1.22m = 9.30 m², inc. 5% desp.)": "Frescasa Eco 2-1/2\" fiberglass roll (100 ft², incl. 5% waste)",
  "Aislamiento Fibra de Vidrio Frescasa Eco (Área c/ 5% desp.)": "Frescasa Eco fiberglass insulation (net area + 5%)",
  "Bloque de Concreto No. 12 (40x20x12)": "Concrete masonry unit CMU (16x8x5 in)",
  "Cemento Gris para Pega (Sacos 50kg)": "Gray Portland cement for mortar (110 lb bags)",
  "Arena Fina para Mortero de Pega": "Fine washed masonry sand",
  "Cemento Gris para Pañete (Sacos 50kg)": "Gray Portland cement for plaster (110 lb bags)",
  "Arena Lavada para Pañete": "Washed plastering sand",
  "Estuco Plástico Listo (Cuñetes)": "Ready-mix acrylic skim coat (5-gal pails)",
  "Pintura Vinilo Tipo 1 (Galones)": "Architectural latex paint Type 1 (gal)",
  "Teja Ondulada Eternit No. 6/8": "Corrugated fiber-cement roofing panel",
  "Ganchos de Fijación con Golilla": "Roofing J-hooks with EPDM washer",
};

function localizeRoomMaterialUnit(unit: string, lang: "es" | "en"): string {
  if (lang === "es") return unit;
  return convertUnitLabel(unit, lang);
}

function localizeRoomMaterialName(insumo: string, lang: "es" | "en"): string {
  if (lang === "es") return insumo;
  return ROOM_MATERIAL_EN[insumo] || localizeMaterialName(insumo, "en");
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function TabHabitacionesBIM({
  proyecto,
  data,
  params,
  onUpdateProyecto,
}: TabHabitacionesBIMProps) {
  const {
    lang,
    currency,
    unitSystem,
    rates,
    formatMoney,
    formatConvertedMoney,
    formatUnitMoney,
    formatQty,
    convertQtyValue,
    unitLabel,
  } = useAppPreferences();
  const isEn = lang === "en";
  const fxRate = rates[currency] ?? 1;
  const actLabels = isEn ? ACTIVITY_LABELS_EN : ACTIVITY_LABELS_ES;

  const roomItems = useMemo(() => getInitialRoomItemsForProject(proyecto), [proyecto]);

  // Budget simulator state stored internally in COP
  const [dineroDisponible, setDineroDisponible] = useState<number>(3_000_000);
  const [incluirAiu, setIncluirAiu] = useState<boolean>(false);
  const [filtroAct, setFiltroAct] = useState<"ALL" | RoomActivityKey>("ALL");
  const [busqueda, setBusqueda] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    const hasMama = roomItems.some((r) => r.room === "Habitación Mamá");
    if (hasMama) {
      for (const r of roomItems) {
        if (r.room === "Habitación Mamá") init[r.id] = true;
      }
    } else if (roomItems.length > 0) {
      const firstRoom = roomItems[0].room;
      for (const r of roomItems) {
        if (r.room === firstRoom) init[r.id] = true;
      }
    }
    return init;
  });

  useEffect(() => {
    const next: Record<string, boolean> = {};
    const items = getInitialRoomItemsForProject(proyecto);
    const hasMama = items.some((r) => r.room === "Habitación Mamá");
    if (hasMama) {
      for (const r of items) {
        if (r.room === "Habitación Mamá") next[r.id] = true;
      }
    } else if (items.length > 0) {
      const firstRoom = items[0].room;
      for (const r of items) {
        if (r.room === firstRoom) next[r.id] = true;
      }
    }
    setSelectedIds(next);
  }, [proyecto.id]);

  // Quick unit price overrides & Revit import
  const [showPricePanel, setShowPricePanel] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Partial<Record<RoomActivityKey, number>>>({});
  const [mergeOnImport, setMergeOnImport] = useState(true);
  const [importingRevit, setImportingRevit] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Manual quick item entry
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newActKey, setNewActKey] = useState<RoomActivityKey>("plantilla");
  const [newQty, setNewQty] = useState("");

  const aiuFactor = 1 + (incluirAiu ? (params.pct_a + params.pct_i + params.pct_u) / 100 : 0);
  const pctAiuTotal = params.pct_a + params.pct_i + params.pct_u;

  const executedMap = useMemo(
    () => computeExecutedByRoomItem(roomItems, data.obra_activa),
    [roomItems, data.obra_activa]
  );

  // Group items by room/zone
  const roomsGrouped = useMemo(() => {
    const map = new Map<string, RoomActivityItem[]>();
    const qNorm = busqueda.trim().toLowerCase();

    for (const item of roomItems) {
      if (filtroAct !== "ALL" && item.activityKey !== filtroAct) continue;
      const roomEn = localizeRoomName(item.room, lang).toLowerCase();
      const actEn = localizeActivity(item.activityLabel, lang).toLowerCase();
      if (
        qNorm &&
        !item.room.toLowerCase().includes(qNorm) &&
        !roomEn.includes(qNorm) &&
        !item.activityLabel.toLowerCase().includes(qNorm) &&
        !actEn.includes(qNorm) &&
        !item.sourceComment.toLowerCase().includes(qNorm)
      ) {
        continue;
      }
      const arr = map.get(item.room) || [];
      arr.push(item);
      map.set(item.room, arr);
    }

    const orderIdx = (name: string) => {
      const idx = CASA_MENDOZA_ROOM_ORDER.indexOf(name);
      return idx >= 0 ? idx : 999;
    };

    return Array.from(map.entries())
      .sort((a, b) => {
        const diff = orderIdx(a[0]) - orderIdx(b[0]);
        return diff !== 0 ? diff : a[0].localeCompare(b[0]);
      })
      .map(([room, items]) => {
        const totalDirecto = items.reduce((acc, it) => {
          const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
          return acc + it.quantity * pu;
        }, 0);
        const totalArea = items.reduce(
          (acc, it) => acc + (it.unit.includes("m") ? it.quantity : 0),
          0
        );
        const execValue = items.reduce((acc, it) => {
          const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
          const execQty = executedMap[it.id] || 0;
          return acc + execQty * pu;
        }, 0);
        return {
          room,
          items,
          totalDirecto,
          totalConAiu: totalDirecto * aiuFactor,
          totalArea,
          pctEjec: totalDirecto > 0 ? Math.min(100, (execValue / totalDirecto) * 100) : 0,
        };
      });
  }, [roomItems, filtroAct, busqueda, lang, proyecto.ppto_base, priceOverrides, aiuFactor, executedMap]);

  // Global summary by prioritized activity
  const resumenGlobalPorActividad = useMemo(() => {
    const byKey: Record<string, { m2: number; valor: number }> = {
      plantilla: { m2: 0, valor: 0 },
      enchape: { m2: 0, valor: 0 },
      enchape_pared: { m2: 0, valor: 0 },
      cielorraso: { m2: 0, valor: 0 },
      frescasa: { m2: 0, valor: 0 },
    };
    let otrosValor = 0;
    let totalDirecto = 0;

    for (const it of roomItems) {
      const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
      const sub = it.quantity * pu;
      totalDirecto += sub;
      if (byKey[it.activityKey]) {
        byKey[it.activityKey].m2 += it.quantity;
        byKey[it.activityKey].valor += sub;
      } else {
        otrosValor += sub;
      }
    }
    return { byKey, otrosValor, totalDirecto };
  }, [roomItems, proyecto.ppto_base, priceOverrides]);

  // Current simulator selection totals
  const selectedItems = useMemo(
    () => roomItems.filter((it) => selectedIds[it.id]),
    [roomItems, selectedIds]
  );

  const seleccionStats = useMemo(() => {
    let directo = 0;
    let m2Total = 0;
    const roomsTouched = new Set<string>();
    for (const it of selectedItems) {
      const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
      directo += it.quantity * pu;
      if (it.unit.includes("m")) m2Total += it.quantity;
      if (it.quantity > 0) roomsTouched.add(it.room);
    }
    const totalPagar = directo * aiuFactor;
    const diferencia = dineroDisponible - totalPagar;
    return {
      directo,
      totalPagar,
      m2Total,
      roomsCount: roomsTouched.size,
      diferencia,
    };
  }, [selectedItems, proyecto.ppto_base, priceOverrides, aiuFactor, dineroDisponible]);

  const materialesSeleccion = useMemo(
    () => computeMaterialsForRoomSelection(selectedItems),
    [selectedItems]
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleRoomAll = (items: RoomActivityItem[]) => {
    const allChecked = items.every((it) => selectedIds[it.id]);
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const it of items) next[it.id] = !allChecked;
      return next;
    });
  };

  const handleSelectByActivity = (key: RoomActivityKey | "ALL") => {
    const next: Record<string, boolean> = {};
    for (const it of roomItems) {
      if ((key === "ALL" || it.activityKey === key) && it.quantity > 0) {
        next[it.id] = true;
      }
    }
    setSelectedIds(next);
  };

  const handleAutoSugerirPorCaja = () => {
    const cap = Number(dineroDisponible) || 0;
    if (cap <= 0) {
      setSelectedIds({});
      return;
    }
    let acumulado = 0;
    const next: Record<string, boolean> = {};

    for (const grp of roomsGrouped) {
      const activos = grp.items.filter((it) => it.quantity > 0);
      if (activos.length === 0) continue;
      const roomCost = activos.reduce((sum, it) => {
        const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
        return sum + it.quantity * pu * aiuFactor;
      }, 0);

      if (acumulado + roomCost <= cap) {
        for (const it of activos) next[it.id] = true;
        acumulado += roomCost;
      } else {
        for (const it of activos) {
          const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
          const itemCost = it.quantity * pu * aiuFactor;
          if (itemCost > 0 && acumulado + itemCost <= cap) {
            next[it.id] = true;
            acumulado += itemCost;
          }
        }
      }
    }
    setSelectedIds(next);
  };

  const handleUpdateQtyDisplay = (id: string, unit: string, displayValStr: string) => {
    const displayNum = Math.max(0, Number(displayValStr) || 0);
    const factor = unitSystem === "imperial" ? unitConversionFactor(unit) : 1;
    const metricVal = factor > 0 ? displayNum / factor : displayNum;
    const updated = roomItems.map((it) =>
      it.id === id
        ? { ...it, quantity: Number(metricVal.toFixed(4)), pendingVerify: metricVal === 0 && it.pendingVerify }
        : it
    );
    onUpdateProyecto({ ...proyecto, zonas_bim: updated });
  };

  const handleRestoreBase = () => {
    const restored =
      proyecto.id === "casa_mendoza"
        ? CASA_MENDOZA_ROOMS_BASE.map((it) => ({ ...it }))
        : [];
    onUpdateProyecto({ ...proyecto, zonas_bim: restored });
    setImportStatus({
      type: "ok",
      msg: isEn
        ? "Casa Mendoza room baseline restored."
        : "Datos base por habitación de Casa Mendoza restaurados.",
    });
  };

  const handleUploadRevitSchedule = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingRevit(true);
    setImportStatus(null);

    try {
      let parsedItems: RoomActivityItem[] = [];
      try {
        const b64 = await fileToBase64(file);
        const res = await callPythonJson<{ ok: boolean; items: RoomActivityItem[]; error?: string }>({
          action: "parse_revit_schedule",
          filename: file.name,
          file_base64: b64,
        });
        if (res?.ok && Array.isArray(res.items)) {
          parsedItems = res.items;
        }
      } catch {
        const txt = await file.text();
        const local = parseRevitScheduleLocal(txt);
        if (local.error) throw new Error(local.error);
        parsedItems = local.items;
      }

      if (parsedItems.length === 0) {
        throw new Error(
          isEn
            ? "No valid records were found in the exported Revit schedule."
            : "No se encontraron registros válidos en la tabla exportada de Revit."
        );
      }

      let nextList: RoomActivityItem[];
      if (mergeOnImport && roomItems.length > 0) {
        const mergedMap = new Map<string, RoomActivityItem>();
        const keyOf = (it: RoomActivityItem) => `${normalizarTexto(it.room)}||${it.activityKey}`;
        for (const existing of roomItems) {
          mergedMap.set(keyOf(existing), { ...existing });
        }
        for (const incoming of parsedItems) {
          const k = keyOf(incoming);
          const prev = mergedMap.get(k);
          mergedMap.set(k, {
            ...incoming,
            id: prev?.id || incoming.id,
            unitPrice: prev?.unitPrice ?? incoming.unitPrice,
            pendingVerify: false,
          });
        }
        nextList = Array.from(mergedMap.values());
      } else {
        nextList = parsedItems;
      }

      onUpdateProyecto({ ...proyecto, zonas_bim: nextList });
      setImportStatus({
        type: "ok",
        msg: isEn
          ? `Imported ${parsedItems.length} room items from "${file.name}".`
          : `Se importaron ${parsedItems.length} partidas por habitación desde "${file.name}".`,
      });
    } catch (err) {
      setImportStatus({
        type: "err",
        msg: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setImportingRevit(false);
      e.target.value = "";
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const room = newRoomName.trim();
    const displayQty = Number(newQty) || 0;
    if (!room || displayQty <= 0) return;

    const unit = newActKey === "carpinteria" ? "und" : "m²";
    const factor = unitSystem === "imperial" ? unitConversionFactor(unit) : 1;
    const metricQty = factor > 0 ? displayQty / factor : displayQty;

    const id = slugRoomActivityId(room, newActKey);
    const label = ACTIVITY_LABELS_ES[newActKey];
    const nextItem: RoomActivityItem = {
      id,
      room,
      activityKey: newActKey,
      activityLabel: label,
      sourceComment: `${label} ${room}`,
      unit,
      quantity: Number(metricQty.toFixed(4)),
    };

    const exists = roomItems.some((it) => it.id === id);
    const nextList = exists
      ? roomItems.map((it) => (it.id === id ? nextItem : it))
      : [...roomItems, nextItem];
    onUpdateProyecto({ ...proyecto, zonas_bim: nextList });
    setSelectedIds((prev) => ({ ...prev, [id]: true }));
    setNewRoomName("");
    setNewQty("");
    setShowAddForm(false);
  };

  const handleExportCsvSelection = () => {
    const lines = [
      isEn
        ? `Room;Activity;Revit_Comment;Unit;Quantity;Unit_Price_${currency};Direct_Cost_${currency};Total_With_Indirects_${currency}`
        : `Habitacion;Actividad;Comment_Revit;Unidad;Cantidad;Precio_Unitario_${currency};Costo_Directo_${currency};Total_Con_AIU_${currency}`,
    ];
    for (const it of selectedItems) {
      const puCop = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
      const dispQty = convertQty(it.quantity, it.unit, lang);
      const dispUnit = unitLabel(it.unit);
      const factor = unitSystem === "imperial" ? unitConversionFactor(it.unit) : 1;
      const puDisplay = ((puCop / factor) / fxRate).toFixed(2);
      const direct = ((it.quantity * puCop) / fxRate).toFixed(2);
      const conAiu = ((it.quantity * puCop * aiuFactor) / fxRate).toFixed(2);
      lines.push(
        `"${localizeRoomName(it.room, lang)}";"${localizeActivity(it.activityLabel, lang)}";"${localizeTerm(
          it.sourceComment,
          lang
        )}";"${dispUnit}";${dispQty.toFixed(2)};${puDisplay};${direct};${conAiu}`
      );
    }
    lines.push("");
    lines.push(isEn ? "MATERIAL_TAKEOFF_SELECTION;;;;;;;" : "EXPLOSION_INSUMOS_SELECCION;;;;;;;");
    lines.push(isEn ? "Material;Unit;Theoretical_Quantity;;;;;" : "Material;Unidad;Cantidad_Teorica;;;;;");
    for (const mat of materialesSeleccion) {
      const dispQty = convertQty(mat.cantidad, mat.unidad, lang);
      const dispUnit = localizeRoomMaterialUnit(mat.unidad, lang);
      lines.push(`"${localizeRoomMaterialName(mat.insumo, lang)}";"${dispUnit}";${dispQty.toFixed(2)};;;;;`);
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isEn
      ? `Rooms_Zones_Takeoff_${proyecto.id}_${unitSystem.toUpperCase()}.csv`
      : `Desglose_Habitaciones_${proyecto.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const hasPendingVerify = roomItems.some((it) => it.pendingVerify);
  const displayCashValue = Math.round(dineroDisponible / fxRate);
  const decimalsMoney = currency === "COP" ? 0 : 2;
  const displayAreaUnit = unitLabel("m²");

  return (
    <div className="space-y-5">
      {/* Header & Revit importer */}
      <div className="bento-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-800 shrink-0" />
            <span>
              {isEn
                ? "Zone & Room Breakdown (Revit Comments) & Cashflow Simulator"
                : "Desglose por Habitaciones (Revit Comments) & Simulador de Caja"}
            </span>
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {isEn ? (
              <>
                Evaluate per-zone costs activity by activity (<b>Screeds</b>, <b>Tile</b>, <b>Ceilings</b>) and prioritize execution phases to fit available liquidity.
              </>
            ) : (
              <>
                Evalúa cuánto cuesta cada habitación actividad por actividad (<b>Plantilla</b>, <b>Enchape</b> y <b>Cielo raso</b>) y arma fases de ejecución según el dinero disponible.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-200/70 border border-slate-300 px-2.5 py-1.5 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={mergeOnImport}
              onChange={(e) => setMergeOnImport(e.target.checked)}
              className="accent-slate-800"
            />
            {isEn ? "Merge on import" : "Combinar al importar"}
          </label>

          <label className="cursor-pointer steel-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5">
            {importingRevit ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isEn ? "Parsing Revit..." : "Leyendo Revit..."}</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? "Import Revit Schedule (.txt/.csv/.xlsx)"
                    : "Importar Tabla Revit (.txt/.csv/.xlsx)"}
                </span>
              </>
            )}
            <input
              type="file"
              accept=".txt,.csv,.xlsx,.xls"
              onChange={handleUploadRevitSchedule}
              disabled={importingRevit}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowPricePanel((v) => !v)}
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 inline-flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>{isEn ? "Unit Prices" : "Precios Unitarios"}</span>
          </button>

          {proyecto.id === "casa_mendoza" && (
            <button
              type="button"
              onClick={handleRestoreBase}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1.5"
              title={
                isEn
                  ? "Restore baseline measurements from Casa Mendoza 1.1.rvt"
                  : "Restaurar mediciones base tomadas de Casa Mendoza 1.1.rvt"
              }
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEn ? "Revit 1.1 Baseline" : "Base Revit 1.1"}</span>
            </button>
          )}
        </div>
      </div>

      {importStatus && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold border flex items-center gap-2 ${
            importStatus.type === "err"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {importStatus.type === "err" ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{importStatus.msg}</span>
        </div>
      )}

      {hasPendingVerify && proyecto.id === "casa_mendoza" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <b>{isEn ? "Quick Audit Note:" : "Nota de revisión rápida (Captura Revit Pisos):"}</b>{" "}
            {isEn
              ? "All visible rows carry Revit quantities. Kitchen tile was below the viewport scroll — enter the exact area or upload the exported Revit Schedule (.txt)."
              : "Todas las filas visibles ya están cargadas con sus áreas exactas mostradas en Revit (`110 m²` Plantillas, `87 m²` Cielo raso). En la captura de Pisos, Cocina (Enchape) quedó fuera del scroll inferior: puedes digitarle sus m² directamente o importar el `.txt` exportado desde Revit."}
          </div>
        </div>
      )}

      {/* Quick Unit Price Editor */}
      {showPricePanel && (
        <div className="bento-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              {isEn
                ? `Quick Unit Price Override per ${displayAreaUnit} (Synced by default with 5D Budget)`
                : `Ajuste rápido de Precio Unitario por ${displayAreaUnit} (Sincronizado con Presupuesto 5D)`}
            </h3>
            <button
              type="button"
              onClick={() => setPriceOverrides({})}
              className="text-xs font-bold text-slate-700 underline"
            >
              {isEn ? "Use 5D Budget prices" : "Usar precios del Presupuesto 5D"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {(["plantilla", "enchape", "enchape_pared", "cielorraso", "frescasa"] as RoomActivityKey[]).map((key) => {
              const currentCop = resolveUnitPriceForRoomItem(
                {
                  id: key,
                  room: "",
                  activityKey: key,
                  activityLabel: ACTIVITY_LABELS_ES[key],
                  sourceComment: "",
                  unit: "m²",
                  quantity: 1,
                },
                proyecto.ppto_base,
                priceOverrides
              );
              const factor = unitSystem === "imperial" ? unitConversionFactor("m²") : 1;
              const displayPu = (currentCop / factor) / fxRate;
              return (
                <div key={key} className="steel-subcard rounded-xl p-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    {actLabels[key]} ({currency} / {displayAreaUnit})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={currency === "COP" ? 500 : 0.25}
                    value={currency === "COP" ? Math.round(displayPu) : Number(displayPu.toFixed(2))}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      const copPerM2 = val * fxRate * factor;
                      setPriceOverrides((prev) => ({
                        ...prev,
                        [key]: copPerM2,
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                  {key === "frescasa" && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      {isEn
                        ? `Ref.: ${formatMoney(112900, decimalsMoney)}/roll (100 ft² mat. + waste/labor).`
                        : "Ref. Homecenter: $112.900/rollo (9.30 m² = $12.140/m² mat. + desp./MO)."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bento-card border-l-4 border-l-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>{isEn ? "Concrete Floor Screeds" : "Total Plantillas 7cm"}</span>
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(resumenGlobalPorActividad.byKey.plantilla.valor * aiuFactor, decimalsMoney)}
          </div>
          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
            {formatQty(resumenGlobalPorActividad.byKey.plantilla.m2, "m²", 1)} {displayAreaUnit}{" "}
            {isEn ? "cumulative" : "acumulados"}
          </div>
        </div>

        <div className="bento-card border-l-4 border-l-slate-700">
          <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
            <SquareStack className="w-3.5 h-3.5 text-slate-600" />
            <span>{isEn ? "Total Tiling (Floor + Wall)" : "Total Enchape (Piso + Pared)"}</span>
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(
              (resumenGlobalPorActividad.byKey.enchape.valor +
                resumenGlobalPorActividad.byKey.enchape_pared.valor) *
                aiuFactor,
              decimalsMoney
            )}
          </div>
          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
            {isEn ? "Floor:" : "Piso:"}{" "}
            {formatQty(resumenGlobalPorActividad.byKey.enchape.m2, "m²", 1)} {displayAreaUnit}
            {resumenGlobalPorActividad.byKey.enchape_pared.m2 > 0
              ? ` • ${isEn ? "Wall:" : "Pared:"} ${formatQty(
                  resumenGlobalPorActividad.byKey.enchape_pared.m2,
                  "m²",
                  1
                )} ${displayAreaUnit}`
              : ""}
          </div>
        </div>

        <div className="bento-card border-l-4 border-l-slate-600">
          <div className="text-[11px] font-bold uppercase text-slate-500 flex items-center gap-1.5">
            <CloudCog className="w-3.5 h-3.5 text-slate-600" />
            <span>{isEn ? "Ceilings + Fiberglass" : "Cielos Rasos + Frescasa Eco"}</span>
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(
              (resumenGlobalPorActividad.byKey.cielorraso.valor +
                resumenGlobalPorActividad.byKey.frescasa.valor) *
                aiuFactor,
              decimalsMoney
            )}
          </div>
          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
            {isEn ? "Ceiling:" : "Cielo:"}{" "}
            {formatQty(resumenGlobalPorActividad.byKey.cielorraso.m2, "m²", 1)} {displayAreaUnit}
            {resumenGlobalPorActividad.byKey.frescasa.m2 > 0
              ? ` • ${isEn ? "Insul.:" : "Frescasa:"} ${formatQty(
                  resumenGlobalPorActividad.byKey.frescasa.m2,
                  "m²",
                  1
                )} ${displayAreaUnit} (~${Math.ceil(
                  (resumenGlobalPorActividad.byKey.frescasa.m2 * 1.05) / 9.2964
                )} ${isEn ? "rolls" : "rollos"})`
              : ""}
          </div>
        </div>

        <div className="steel-panel-dark rounded-2xl p-4 text-white">
          <div className="text-[11px] font-bold uppercase text-slate-300 flex items-center gap-1.5">
            <Gem className="w-3.5 h-3.5 text-emerald-300" />
            <span>
              {isEn ? "Total Zone Scope" : "Total Priorizado"}{" "}
              {incluirAiu
                ? isEn
                  ? `(+ Indirects ${pctAiuTotal.toFixed(1)}%)`
                  : `(+ AIU ${pctAiuTotal.toFixed(1)}%)`
                : isEn
                ? "(Direct Cost)"
                : "(Costo Directo)"}
            </span>
          </div>
          <div className="kpi-num text-xl font-extrabold text-emerald-300 mt-1">
            {formatMoney(resumenGlobalPorActividad.totalDirecto * aiuFactor, decimalsMoney)}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            {roomsGrouped.length} {isEn ? "zones / rooms loaded" : "zonas / habitaciones cargadas"}
          </div>
        </div>
      </div>

      {/* AVAILABLE CASH SIMULATOR */}
      <div className="bento-card border-l-4 border-l-emerald-600 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-700" />
                <span>
                  {isEn
                    ? "Cashflow Intervention Simulator"
                    : "Simulador de Intervención por Dinero Disponible"}
                </span>
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-200/80 border border-slate-300 px-2.5 py-1 rounded-full cursor-pointer text-slate-800">
                <input
                  type="checkbox"
                  checked={incluirAiu}
                  onChange={(e) => setIncluirAiu(e.target.checked)}
                  className="accent-slate-800"
                />
                {isEn
                  ? `Include AIU Indirects (${pctAiuTotal.toFixed(1)}%)`
                  : `Incluir AIU (${pctAiuTotal.toFixed(1)}%)`}
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">
                  {isEn
                    ? `Available cash today (${currency})`
                    : `¿Con cuánto dinero cuentas hoy? (${currency})`}
                </span>
                <input
                  type="number"
                  min={0}
                  step={currency === "COP" ? 100000 : 100}
                  value={displayCashValue}
                  onChange={(e) => {
                    const disp = Math.max(0, Number(e.target.value) || 0);
                    setDineroDisponible(fxRate > 0 ? disp * fxRate : disp);
                  }}
                  className="w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-extrabold font-mono text-slate-900"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-4">
                {(currency === "COP" ? PRESET_BUDGETS_COP : PRESET_BUDGETS_FX).map((val) => {
                  const copTarget = currency === "COP" ? val : val * fxRate;
                  const isActive = Math.abs(displayCashValue - val) < 5;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setDineroDisponible(copTarget)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                        isActive
                          ? "steel-btn-primary text-white"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {currency === "COP"
                        ? `$${(val / 1_000_000).toFixed(1).replace(".0", "")}M`
                        : formatConvertedMoney(val, 0)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">
            <div className="steel-subcard rounded-xl px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                {isEn
                  ? `Selection Cost (${selectedItems.length} items)`
                  : `Costo Selección (${selectedItems.length} ítems)`}
              </div>
              <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                {formatMoney(seleccionStats.totalPagar, decimalsMoney)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {formatQty(seleccionStats.m2Total, "m²", 1)} {displayAreaUnit} •{" "}
                {seleccionStats.roomsCount} {isEn ? "zones" : "hab."}
              </div>
            </div>

            <div
              className={`rounded-xl px-3.5 py-2.5 border ${
                seleccionStats.diferencia >= 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}
            >
              <div className="text-[10px] font-bold uppercase opacity-80 flex items-center gap-1">
                {seleccionStats.diferencia >= 0 ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertTriangle className="w-3 h-3" />
                )}
                <span>
                  {seleccionStats.diferencia >= 0
                    ? isEn
                      ? "Cash Surplus"
                      : "Saldo a Favor"
                    : isEn
                    ? "Budget Gap"
                    : "Falta Presupuesto"}
                </span>
              </div>
              <div className="text-base font-extrabold font-mono mt-0.5">
                {seleccionStats.diferencia >= 0 ? "+" : "-"}
                {formatMoney(Math.abs(seleccionStats.diferencia), decimalsMoney)}
              </div>
              <div className="text-[10px] font-semibold">
                {seleccionStats.diferencia >= 0
                  ? isEn
                    ? "Fits current cash"
                    : "Alcanza con tu caja"
                  : isEn
                  ? "Exceeds cash today"
                  : "Excede caja hoy"}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex flex-col justify-center gap-1.5">
              <button
                type="button"
                onClick={handleAutoSugerirPorCaja}
                className="steel-btn-primary px-3 py-2 rounded-xl text-xs font-extrabold text-center inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isEn ? "Auto-Fit Cash" : "Sugerir qué cabe"}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsvSelection}
                disabled={selectedItems.length === 0}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isEn ? "Export Selection CSV" : "Exportar Selección CSV"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar + quick actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "ALL" as const, label: isEn ? "All" : "Todas", icon: null },
              {
                key: "plantilla" as const,
                label: isEn ? "Screeds" : "Plantillas",
                icon: <Layers className="w-3 h-3" />,
              },
              {
                key: "enchape" as const,
                label: isEn ? "Floor Tile" : "Enchape Piso",
                icon: <SquareStack className="w-3 h-3" />,
              },
              {
                key: "enchape_pared" as const,
                label: isEn ? "Wall Tile" : "Enchape Pared",
                icon: <Package className="w-3 h-3" />,
              },
              {
                key: "cielorraso" as const,
                label: isEn ? "Ceilings" : "Cielo Raso",
                icon: <CloudCog className="w-3 h-3" />,
              },
              {
                key: "frescasa" as const,
                label: "Frescasa Eco",
                icon: <Thermometer className="w-3 h-3" />,
              },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltroAct(f.key)}
                className={`px-3 py-1.5 rounded-lg font-bold transition inline-flex items-center gap-1.5 ${
                  filtroAct === f.key
                    ? "steel-btn-primary text-white"
                    : "bg-slate-200/70 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.icon}
                <span>{f.label}</span>
              </button>
            ))}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={isEn ? "Search room or zone..." : "Buscar habitación (ej. Mamá, Sala)..."}
                className="rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 py-1.5 text-xs text-slate-900 w-56"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectByActivity("plantilla")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              {isEn ? "Select Screeds" : "Marcar Plantillas"}
            </button>
            <button
              type="button"
              onClick={() => handleSelectByActivity("enchape")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              {isEn ? "Select Tiling" : "Marcar Enchapes"}
            </button>
            <button
              type="button"
              onClick={() => handleSelectByActivity("frescasa")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              {isEn ? "Select Insulation" : "Marcar Frescasa"}
            </button>
            <button
              type="button"
              onClick={() => handleSelectByActivity("ALL")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              {isEn ? "All" : "Todo"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds({})}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-600"
            >
              {isEn ? "Clear" : "Limpiar"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? "Add Item" : "Agregar Ítem"}</span>
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddManualItem}
            className="steel-subcard rounded-xl p-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs items-end"
          >
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                {isEn ? "Room / Zone" : "Habitación / Zona"}
              </label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder={isEn ? "e.g. Kitchen / Lobby" : "Ej. Cocina / Patio"}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                {isEn ? "Activity" : "Actividad"}
              </label>
              <select
                value={newActKey}
                onChange={(e) => setNewActKey(e.target.value as RoomActivityKey)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold"
              >
                {Object.entries(actLabels).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">
                {isEn
                  ? `Quantity (${newActKey === "carpinteria" ? "ea" : displayAreaUnit})`
                  : `Cantidad (${newActKey === "carpinteria" ? "und" : "m²"})`}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
              />
            </div>
            <button type="submit" className="steel-btn-primary px-3 py-2 rounded-lg font-bold">
              {isEn ? "Save to Zone" : "Guardar en Habitación"}
            </button>
          </form>
        )}
      </div>

      {/* GRID OF ROOM CARDS */}
      {roomsGrouped.length === 0 ? (
        <div className="bento-card text-center py-10 text-xs text-slate-500">
          {isEn ? (
            <>
              No rooms loaded yet. Use <b>Import Revit Schedule (.txt/.csv/.xlsx)</b> or{" "}
              <b>Add Item</b>.
            </>
          ) : (
            <>
              Este proyecto aún no tiene habitaciones cargadas. Usa{" "}
              <b>Importar Tabla Revit (.txt/.csv/.xlsx)</b> o <b>Agregar Ítem</b>.
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {roomsGrouped.map((grp) => {
            const allChecked = grp.items.every((it) => selectedIds[it.id]);
            const someChecked = grp.items.some((it) => selectedIds[it.id]);
            return (
              <div
                key={grp.room}
                className={`bento-card !p-4 space-y-3 transition-all ${
                  someChecked ? "ring-2 ring-slate-800/80" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => toggleRoomAll(grp.items)}
                      className="accent-slate-900 w-4 h-4 rounded"
                    />
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 leading-tight flex items-center gap-1.5">
                        <DoorOpen className="w-4 h-4 text-slate-700 shrink-0" />
                        <span>{localizeRoomName(grp.room, lang)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {grp.items.length} {isEn ? "activities" : "actividades"} •{" "}
                        {formatQty(grp.totalArea, "m²", 1)} {displayAreaUnit}{" "}
                        {isEn ? "area" : "acumulados"}
                        {grp.pctEjec > 0 && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {grp.pctEjec.toFixed(0)}% {isEn ? "completed" : "ejecutado"}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      {incluirAiu
                        ? isEn
                          ? "Total w/ Indirects"
                          : "Total c/ AIU"
                        : isEn
                        ? "Direct Cost"
                        : "Costo Directo"}
                    </div>
                    <div className="text-base font-extrabold font-mono text-slate-900">
                      {formatMoney(grp.totalConAiu, decimalsMoney)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <th className="py-1.5 text-left w-6"></th>
                        <th className="py-1.5 text-left">
                          {isEn ? "Activity (Revit Comments)" : "Actividad (Comments Revit)"}
                        </th>
                        <th className="py-1.5 text-right w-20">{isEn ? "Qty." : "Cant."}</th>
                        <th className="py-1.5 text-right w-24">
                          {isEn ? "Unit Price" : "P. Unit."}
                        </th>
                        <th className="py-1.5 text-right w-24">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grp.items.map((it) => {
                        const checked = Boolean(selectedIds[it.id]);
                        const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
                        const subtotal = it.quantity * pu * aiuFactor;
                        const execQty = executedMap[it.id] || 0;
                        const dispQty = convertQty(it.quantity, it.unit, lang);
                        const dispUnit = unitLabel(it.unit);
                        return (
                          <tr key={it.id} className={checked ? "bg-slate-200/45" : ""}>
                            <td className="py-2 pr-1 align-top">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleItem(it.id)}
                                className="accent-slate-900 mt-0.5"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <div className="font-bold text-slate-900 leading-snug">
                                {localizeActivity(it.activityLabel, lang)}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {localizeTerm(it.sourceComment, lang)}
                                {execQty > 0 && (
                                  <span className="ml-1.5 text-emerald-700 font-bold">
                                    • {isEn ? "Exec:" : "Ejec:"} {formatQty(execQty, it.unit, 1)}{" "}
                                    {dispUnit}
                                  </span>
                                )}
                              </div>
                              {it.pendingVerify && it.quantity === 0 && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[9px]">
                                  {isEn
                                    ? `Cut in scroll — enter ${dispUnit} or upload .txt`
                                    : "Cortado en scroll — digita m² o sube .txt"}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right align-top">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={Number(dispQty.toFixed(2))}
                                  onChange={(e) =>
                                    handleUpdateQtyDisplay(it.id, it.unit, e.target.value)
                                  }
                                  className="w-16 text-right rounded border border-slate-300 bg-white px-1 py-0.5 font-mono font-bold text-slate-900 text-xs"
                                />
                                <span className="text-[10px] text-slate-500">{dispUnit}</span>
                              </div>
                            </td>
                            <td className="py-2 text-right font-mono text-slate-600 align-top">
                              {formatUnitMoney(pu, it.unit)}
                            </td>
                            <td className="py-2 text-right font-mono font-extrabold text-slate-900 align-top">
                              {formatMoney(subtotal, decimalsMoney)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SELECTION MATERIAL TAKEOFF */}
      <div className="bento-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-700" />
              <span>
                {isEn
                  ? "Exact Material Purchase List for Selected Zones"
                  : "Lista Exacta de Materiales para las Habitaciones Seleccionadas"}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {isEn
                ? "Calculated exclusively from the checked items above (ideal for zone-by-zone purchasing)."
                : "Calculada exclusivamente sobre los ítems marcados arriba (ideal para pedir materiales solo de esa habitación o fase)."}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-900 font-bold text-[11px] border border-slate-300">
            {selectedItems.length} {isEn ? "selected line items" : "partidas seleccionadas"}
          </span>
        </div>

        {materialesSeleccion.length === 0 ? (
          <div className="steel-subcard rounded-xl py-6 text-center text-xs text-slate-500">
            {isEn
              ? "Check at least one zone or activity above to compute exact material quantities."
              : "Marca al menos una habitación o actividad arriba para calcular los materiales exactos a comprar."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2.5">
                    {isEn ? "Material / Resource for Phase" : "Insumo / Material para esta Fase"}
                  </th>
                  <th className="p-2.5 text-center w-28">{isEn ? "Unit" : "Unidad"}</th>
                  <th className="p-2.5 text-right w-40">
                    {isEn ? "Exact Quantity" : "Cantidad Exacta"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materialesSeleccion.map((mat) => (
                  <tr key={`${mat.insumo}-${mat.unidad}`} className="hover:bg-slate-100/60">
                    <td className="p-2.5 font-bold text-slate-900">
                      {localizeRoomMaterialName(mat.insumo, lang)}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {localizeRoomMaterialUnit(mat.unidad, lang)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-slate-900">
                      {formatQty(mat.cantidad, mat.unidad, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
