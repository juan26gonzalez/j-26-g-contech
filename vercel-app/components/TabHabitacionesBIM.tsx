"use client";

import React, { useEffect, useMemo, useState } from "react";
import { callPythonJson, normalizarTexto } from "../lib/calcClient";
import { formatCOP, formatNum } from "../lib/projects";
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

interface TabHabitacionesBIMProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  onUpdateProyecto: (updated: ProjectConfig) => void;
}

const PRESET_BUDGETS = [1500000, 3000000, 5000000, 8000000, 12000000];

const ACTIVITY_LABELS: Record<RoomActivityKey, string> = {
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
  const roomItems = useMemo(() => getInitialRoomItemsForProject(proyecto), [proyecto]);

  // Estado del simulador de dinero disponible
  const [dineroDisponible, setDineroDisponible] = useState<number>(3000000);
  const [incluirAiu, setIncluirAiu] = useState<boolean>(false);
  const [filtroAct, setFiltroAct] = useState<"ALL" | RoomActivityKey>("ALL");
  const [busqueda, setBusqueda] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const r of roomItems) {
      if (r.room === "Habitación Mamá") init[r.id] = true;
    }
    return init;
  });

  useEffect(() => {
    const next: Record<string, boolean> = {};
    const items = getInitialRoomItemsForProject(proyecto);
    for (const r of items) {
      if (r.room === "Habitación Mamá") next[r.id] = true;
    }
    setSelectedIds(next);
  }, [proyecto.id]);

  // Ajustes rápidos de precio unitario y carga Revit
  const [showPricePanel, setShowPricePanel] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<Partial<Record<RoomActivityKey, number>>>({});
  const [mergeOnImport, setMergeOnImport] = useState(true);
  const [importingRevit, setImportingRevit] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Alta rápida manual de ítem/habitación
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

  // Agrupación ordenada por habitación
  const roomsGrouped = useMemo(() => {
    const map = new Map<string, RoomActivityItem[]>();
    const qNorm = busqueda.trim().toLowerCase();

    for (const item of roomItems) {
      if (filtroAct !== "ALL" && item.activityKey !== filtroAct) continue;
      if (
        qNorm &&
        !item.room.toLowerCase().includes(qNorm) &&
        !item.activityLabel.toLowerCase().includes(qNorm) &&
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
        const totalArea = items.reduce((acc, it) => acc + it.quantity, 0);
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
  }, [roomItems, filtroAct, busqueda, proyecto.ppto_base, priceOverrides, aiuFactor, executedMap]);

  // Totales de toda la base cargada por actividades clave
  const resumenGlobalPorActividad = useMemo(() => {
    const byKey: Record<string, { label: string; m2: number; valor: number }> = {
      plantilla: { label: "Plantillas concreto 7cm", m2: 0, valor: 0 },
      enchape: { label: "Enchape piso porcelanato", m2: 0, valor: 0 },
      enchape_pared: { label: "Enchape pared cerámica", m2: 0, valor: 0 },
      cielorraso: { label: "Cielo raso", m2: 0, valor: 0 },
      frescasa: { label: "Frescasa Eco 2-1/2\"", m2: 0, valor: 0 },
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

  // Totales de la selección actual del simulador
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

    // Intenta completar habitaciones completas en orden prioritario; si una completa no cabe,
    // evalúa actividades sueltas dentro de esa habitación.
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

  const handleUpdateQty = (id: string, nextVal: string) => {
    const num = Math.max(0, Number(nextVal) || 0);
    const updated = roomItems.map((it) =>
      it.id === id ? { ...it, quantity: num, pendingVerify: num === 0 && it.pendingVerify } : it
    );
    onUpdateProyecto({ ...proyecto, zonas_bim: updated });
  };

  const handleRestoreBase = () => {
    const restored =
      proyecto.id === "casa_mendoza"
        ? CASA_MENDOZA_ROOMS_BASE.map((it) => ({ ...it }))
        : [];
    onUpdateProyecto({ ...proyecto, zonas_bim: restored });
    setImportStatus({ type: "ok", msg: "Datos base por habitación de Casa Mendoza restaurados." });
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
        throw new Error("No se encontraron registros válidos en la tabla exportada de Revit.");
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
        msg: `Se importaron ${parsedItems.length} partidas por habitación desde "${file.name}".`,
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
    const qty = Number(newQty) || 0;
    if (!room || qty <= 0) return;

    const id = slugRoomActivityId(room, newActKey);
    const label = ACTIVITY_LABELS[newActKey];
    const nextItem: RoomActivityItem = {
      id,
      room,
      activityKey: newActKey,
      activityLabel: label,
      sourceComment: `${label} ${room}`,
      unit: newActKey === "carpinteria" ? "und" : "m²",
      quantity: qty,
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
      "Habitacion;Actividad;Comment_Revit;Unidad;Cantidad;Precio_Unitario;Costo_Directo;Total_Con_AIU",
    ];
    for (const it of selectedItems) {
      const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
      const direct = it.quantity * pu;
      const conAiu = direct * aiuFactor;
      lines.push(
        `"${it.room}";"${it.activityLabel}";"${it.sourceComment}";"${it.unit}";${it.quantity};${pu};${Math.round(direct)};${Math.round(conAiu)}`
      );
    }
    lines.push("");
    lines.push("EXPLOSION_INSUMOS_SELECCION;;;;;;");
    lines.push("Material;Unidad;Cantidad_Teorica;;;;;");
    for (const mat of materialesSeleccion) {
      lines.push(`"${mat.insumo}";"${mat.unidad}";${mat.cantidad};;;;;`);
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Desglose_Habitaciones_${proyecto.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const hasPendingVerify = roomItems.some((it) => it.pendingVerify);

  return (
    <div className="space-y-5">
      {/* Cabecera & Importador Revit (.txt / .csv / .xlsx) */}
      <div className="bento-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            🏠 Desglose por Habitaciones (Revit `Comments`) &amp; Simulador de Caja
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Evalúa cuánto cuesta cada habitación actividad por actividad (<b>Plantilla</b>, <b>Enchape</b> y <b>Cielo raso</b>) y arma fases de ejecución según el dinero disponible.
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
            Combinar al importar
          </label>

          <label className="cursor-pointer steel-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5">
            {importingRevit ? "⏳ Leyendo Revit..." : "📥 Importar Tabla Revit (.txt/.csv/.xlsx)"}
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
            className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
          >
            💲 Precios Unitarios
          </button>

          {proyecto.id === "casa_mendoza" && (
            <button
              type="button"
              onClick={handleRestoreBase}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
              title="Restaurar mediciones base tomadas de Casa Mendoza 1.1.rvt"
            >
              ↺ Base Revit 1.1
            </button>
          )}
        </div>
      </div>

      {importStatus && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold border ${
            importStatus.type === "err"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {importStatus.msg}
        </div>
      )}

      {/* Aviso transparente sobre fila recortada en scroll & precisión Revit */}
      {hasPendingVerify && proyecto.id === "casa_mendoza" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <b>⚠️ Nota de revisión rápida (Captura Revit Pisos):</b> Todas las filas visibles ya están cargadas con sus áreas exactas mostradas en Revit (`110 m²` Plantillas, `87 m²` Cielo raso). En la captura de Pisos, <b>Cocina (Enchape)</b> quedó fuera del scroll inferior: puedes digitarle sus m² directamente en la tarjeta de <b>Cocina</b> o importar el `.txt` exportado desde Revit (`File → Export → Reports → Schedule` con 2 decimales en <i>Formatting</i>).
          </div>
        </div>
      )}

      {/* Editor rápido de Precios Unitarios para estas 3 partidas */}
      {showPricePanel && (
        <div className="bento-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
              Ajuste rápido de Precio Unitario por m² (Sincronizado por defecto con Presupuesto 5D)
            </h3>
            <button
              type="button"
              onClick={() => setPriceOverrides({})}
              className="text-xs font-bold text-slate-700 underline"
            >
              Usar precios del Presupuesto 5D
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {(["plantilla", "enchape", "enchape_pared", "cielorraso", "frescasa"] as RoomActivityKey[]).map((key) => {
              const current = resolveUnitPriceForRoomItem(
                {
                  id: key,
                  room: "",
                  activityKey: key,
                  activityLabel: ACTIVITY_LABELS[key],
                  sourceComment: "",
                  unit: "m²",
                  quantity: 1,
                },
                proyecto.ppto_base,
                priceOverrides
              );
              return (
                <div key={key} className="steel-subcard rounded-xl p-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    {ACTIVITY_LABELS[key]} (COP / m²)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={current}
                    onChange={(e) =>
                      setPriceOverrides((prev) => ({
                        ...prev,
                        [key]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono font-bold text-slate-900"
                  />
                  {key === "frescasa" && (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Ref. Homecenter: $112.900/rollo (9.30 m² = $12.140/m² mat. + desp./MO).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumen Total de las actividades priorizadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bento-card border-l-4 border-l-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            🧱 Total Plantillas 7cm
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(resumenGlobalPorActividad.byKey.plantilla.valor * aiuFactor)}
          </div>
          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
            {formatNum(resumenGlobalPorActividad.byKey.plantilla.m2)} m² acumulados
          </div>
        </div>

        <div className="bento-card border-l-4 border-l-slate-700">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            🪩 Total Enchape (Piso + Pared)
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(
              (resumenGlobalPorActividad.byKey.enchape.valor +
                resumenGlobalPorActividad.byKey.enchape_pared.valor) *
                aiuFactor
            )}
          </div>
          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
            Piso: {formatNum(resumenGlobalPorActividad.byKey.enchape.m2)} m²
            {resumenGlobalPorActividad.byKey.enchape_pared.m2 > 0
              ? ` • Pared: ${formatNum(resumenGlobalPorActividad.byKey.enchape_pared.m2)} m²`
              : ""}
          </div>
        </div>

        <div className="bento-card border-l-4 border-l-slate-600">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            ☁️ Cielos Rasos + Frescasa Eco
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(
              (resumenGlobalPorActividad.byKey.cielorraso.valor +
                resumenGlobalPorActividad.byKey.frescasa.valor) *
                aiuFactor
            )}
          </div>
          <div className="text-[11px] text-slate-600 font-mono mt-0.5">
            Cielo: {formatNum(resumenGlobalPorActividad.byKey.cielorraso.m2)} m²
            {resumenGlobalPorActividad.byKey.frescasa.m2 > 0
              ? ` • Frescasa: ${formatNum(resumenGlobalPorActividad.byKey.frescasa.m2)} m² (~${Math.ceil(
                  (resumenGlobalPorActividad.byKey.frescasa.m2 * 1.05) / 9.2964
                )} rollos)`
              : ""}
          </div>
        </div>

        <div className="steel-panel-dark rounded-2xl p-4 text-white">
          <div className="text-[11px] font-bold uppercase text-slate-300">
            💎 Total Priorizado {incluirAiu ? `(+ AIU ${pctAiuTotal.toFixed(1)}%)` : "(Costo Directo)"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-emerald-300 mt-1">
            {formatCOP(resumenGlobalPorActividad.totalDirecto * aiuFactor)}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            {roomsGrouped.length} zonas / habitaciones cargadas
          </div>
        </div>
      </div>

      {/* SIMULADOR DE PRESUPUESTO DISPONIBLE */}
      <div className="bento-card border-l-4 border-l-emerald-600 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900">
                💰 Simulador de Intervención por Dinero Disponible
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-200/80 border border-slate-300 px-2.5 py-1 rounded-full cursor-pointer text-slate-800">
                <input
                  type="checkbox"
                  checked={incluirAiu}
                  onChange={(e) => setIncluirAiu(e.target.checked)}
                  className="accent-slate-800"
                />
                Incluir AIU ({pctAiuTotal.toFixed(1)}%)
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">
                  ¿Con cuánto dinero cuentas hoy? ($ COP)
                </span>
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={dineroDisponible}
                  onChange={(e) => setDineroDisponible(Math.max(0, Number(e.target.value) || 0))}
                  className="w-52 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-extrabold font-mono text-slate-900"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-4">
                {PRESET_BUDGETS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDineroDisponible(val)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                      dineroDisponible === val
                        ? "steel-btn-primary text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    ${(val / 1000000).toFixed(1).replace(".0", "")}M
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 shrink-0">
            <div className="steel-subcard rounded-xl px-3.5 py-2.5">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                Costo Selección ({selectedItems.length} ítems)
              </div>
              <div className="text-base font-extrabold font-mono text-slate-900 mt-0.5">
                {formatCOP(seleccionStats.totalPagar)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                {formatNum(seleccionStats.m2Total)} m² • {seleccionStats.roomsCount} hab.
              </div>
            </div>

            <div
              className={`rounded-xl px-3.5 py-2.5 border ${
                seleccionStats.diferencia >= 0
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-rose-50 border-rose-300 text-rose-900"
              }`}
            >
              <div className="text-[10px] font-bold uppercase opacity-80">
                {seleccionStats.diferencia >= 0 ? "✅ Saldo a Favor" : "⚠️ Falta Presupuesto"}
              </div>
              <div className="text-base font-extrabold font-mono mt-0.5">
                {seleccionStats.diferencia >= 0 ? "+" : "-"}
                {formatCOP(Math.abs(seleccionStats.diferencia))}
              </div>
              <div className="text-[10px] font-semibold">
                {seleccionStats.diferencia >= 0 ? "Alcanza con tu caja" : "Excede caja hoy"}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex flex-col justify-center gap-1.5">
              <button
                type="button"
                onClick={handleAutoSugerirPorCaja}
                className="steel-btn-primary px-3 py-2 rounded-xl text-xs font-extrabold text-center"
              >
                ✨ Sugerir qué cabe
              </button>
              <button
                type="button"
                onClick={handleExportCsvSelection}
                disabled={selectedItems.length === 0}
                className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 disabled:opacity-50"
              >
                📑 Exportar Selección CSV
              </button>
            </div>
          </div>
        </div>

        {/* Barra de filtros + acciones rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "ALL" as const, label: "Todas" },
              { key: "plantilla" as const, label: "🧱 Plantillas" },
              { key: "enchape" as const, label: "🪩 Enchape Piso" },
              { key: "enchape_pared" as const, label: "🪵 Enchape Pared" },
              { key: "cielorraso" as const, label: "☁️ Cielo Raso" },
              { key: "frescasa" as const, label: "🌡️ Frescasa Eco" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltroAct(f.key)}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  filtroAct === f.key
                    ? "steel-btn-primary text-white"
                    : "bg-slate-200/70 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}

            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar habitación (ej. Mamá, Sala)..."
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 w-56"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectByActivity("plantilla")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              Marcar Plantillas
            </button>
            <button
              type="button"
              onClick={() => handleSelectByActivity("enchape")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              Marcar Enchapes
            </button>
            <button
              type="button"
              onClick={() => handleSelectByActivity("frescasa")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              Marcar Frescasa
            </button>
            <button
              type="button"
              onClick={() => handleSelectByActivity("ALL")}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              Todo
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds({})}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-rose-50 hover:text-rose-700 text-slate-600"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg font-bold border border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
            >
              ➕ Agregar Ítem
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddManualItem}
            className="steel-subcard rounded-xl p-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs items-end"
          >
            <div>
              <label className="block font-bold text-slate-600 mb-1">Habitación / Zona</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Ej. Cocina / Patio"
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">Actividad</label>
              <select
                value={newActKey}
                onChange={(e) => setNewActKey(e.target.value as RoomActivityKey)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold"
              >
                {Object.entries(ACTIVITY_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-600 mb-1">Cantidad (m² / und)</label>
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
              Guardar en Habitación
            </button>
          </form>
        )}
      </div>

      {/* GRID DE TARJETAS POR HABITACIÓN */}
      {roomsGrouped.length === 0 ? (
        <div className="bento-card text-center py-10 text-xs text-slate-500">
          Este proyecto aún no tiene habitaciones cargadas. Usa <b>📥 Importar Tabla Revit (.txt/.csv/.xlsx)</b> o <b>➕ Agregar Ítem</b>.
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
                      <div className="text-sm font-extrabold text-slate-900 leading-tight">
                        🚪 {grp.room}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {grp.items.length} actividades • {formatNum(grp.totalArea, 1)} m² acumulados
                        {grp.pctEjec > 0 && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {grp.pctEjec.toFixed(0)}% ejecutado
                          </span>
                        )}
                      </div>
                    </div>
                  </label>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      {incluirAiu ? "Total c/ AIU" : "Costo Directo"}
                    </div>
                    <div className="text-base font-extrabold font-mono text-slate-900">
                      {formatCOP(grp.totalConAiu)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <th className="py-1.5 text-left w-6"></th>
                        <th className="py-1.5 text-left">Actividad (`Comments` Revit)</th>
                        <th className="py-1.5 text-right w-20">Cant.</th>
                        <th className="py-1.5 text-right w-20">P. Unit.</th>
                        <th className="py-1.5 text-right w-24">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grp.items.map((it) => {
                        const checked = Boolean(selectedIds[it.id]);
                        const pu = resolveUnitPriceForRoomItem(it, proyecto.ppto_base, priceOverrides);
                        const subtotal = it.quantity * pu * aiuFactor;
                        const execQty = executedMap[it.id] || 0;
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
                                {it.activityLabel}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {it.sourceComment}
                                {execQty > 0 && (
                                  <span className="ml-1.5 text-emerald-700 font-bold">
                                    • Ejec: {formatNum(execQty)} {it.unit}
                                  </span>
                                )}
                              </div>
                              {it.pendingVerify && it.quantity === 0 && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[9px]">
                                  Cortado en scroll — digita m² o sube .txt
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right align-top">
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={it.quantity}
                                  onChange={(e) => handleUpdateQty(it.id, e.target.value)}
                                  className="w-14 text-right rounded border border-slate-300 bg-white px-1 py-0.5 font-mono font-bold text-slate-900 text-xs"
                                />
                                <span className="text-[10px] text-slate-500">{it.unit}</span>
                              </div>
                            </td>
                            <td className="py-2 text-right font-mono text-slate-600 align-top">
                              {formatCOP(pu)}
                            </td>
                            <td className="py-2 text-right font-mono font-extrabold text-slate-900 align-top">
                              {formatCOP(subtotal)}
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

      {/* EXPLOSIÓN DE INSUMOS EXCLUSIVA DE LA SELECCIÓN */}
      <div className="bento-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              🧱 Lista Exacta de Materiales para las Habitaciones Seleccionadas
            </h3>
            <p className="text-xs text-slate-500">
              Calculada exclusivamente sobre los ítems marcados arriba (ideal para pedir materiales solo de esa habitación o fase).
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-900 font-bold text-[11px] border border-slate-300">
            {selectedItems.length} partidas seleccionadas
          </span>
        </div>

        {materialesSeleccion.length === 0 ? (
          <div className="steel-subcard rounded-xl py-6 text-center text-xs text-slate-500">
            Marca al menos una habitación o actividad arriba para calcular los materiales exactos a comprar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2.5">Insumo / Material para esta Fase</th>
                  <th className="p-2.5 text-center w-28">Unidad</th>
                  <th className="p-2.5 text-right w-40">Cantidad Exacta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materialesSeleccion.map((mat) => (
                  <tr key={`${mat.insumo}-${mat.unidad}`} className="hover:bg-slate-100/60">
                    <td className="p-2.5 font-bold text-slate-900">{mat.insumo}</td>
                    <td className="p-2.5 text-center font-mono text-slate-600">{mat.unidad}</td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-slate-900">
                      {formatNum(mat.cantidad)}
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
