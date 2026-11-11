"use client";

import React, { useState } from "react";
import {
  callPythonJson,
  downloadPlantillaExcel,
  normalizarTexto,
  parseCsvLocalFallback,
} from "../lib/calcClient";
import { formatCOP } from "../lib/projects";
import { BudgetItem, ProjectConfig, ProjectMode } from "../lib/types";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSaveProject: (proyecto: ProjectConfig) => void;
}

const DEFAULT_ROW: BudgetItem = {
  Item: "1.1",
  Capitulo: "1. PRELIMINARES",
  Actividad: "Localización, trazado y replanteo de obra",
  Unidad: "m²",
  Cantidad_Contratada: 100,
  Precio_Unitario: 3500,
};

export default function NewProjectModal({
  open,
  onClose,
  onSaveProject,
}: NewProjectModalProps) {
  const [tipo, setTipo] = useState<ProjectMode>("presupuesto");
  const [nombre, setNombre] = useState("");
  const [contratante, setContratante] = useState("Cliente Privado");
  const [cedulaCliente, setCedulaCliente] = useState("");
  const [ubicacion, setUbicacion] = useState("Sabanalarga, Atlántico");
  const [contratista, setContratista] = useState("Ing. Juan González Mendoza");
  const [badge, setBadge] = useState("PRESUPUESTO OFICIAL");
  const [aDef, setADef] = useState(8.0);
  const [iDef, setIDef] = useState(2.0);
  const [uDef, setUDef] = useState(5.0);
  const [items, setItems] = useState<BudgetItem[]>([DEFAULT_ROW]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  if (!open) return null;

  const handleDownloadPlantilla = async () => {
    try {
      setMsg(null);
      await downloadPlantillaExcel();
    } catch (err) {
      setMsg({ type: "err", text: String(err) });
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    setMsg(null);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv")) {
        const text = await file.text();
        const res = parseCsvLocalFallback(text);
        if (res.error) {
          setMsg({ type: "err", text: res.error });
        } else {
          setItems(res.items);
          setMsg({
            type: "ok",
            text: `CSV procesado correctamente (${res.items.length} actividades).`,
          });
        }
        return;
      }

      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const b64 = btoa(binary);

      const res = await callPythonJson<{ ok: boolean; items: BudgetItem[] }>({
        action: "parse_excel",
        filename: file.name,
        file_base64: b64,
      });
      setItems(res.items);
      setMsg({
        type: "ok",
        text: `Excel procesado con Pandas (${res.items.length} actividades detectadas).`,
      });
    } catch (err) {
      setMsg({
        type: "err",
        text: `No se pudo procesar en servidor Python (${String(err)}). Para pruebas locales rápidas sin Vercel CLI puedes subir un .CSV.`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        Item: `${prev.length + 1}.1`,
        Capitulo: prev[prev.length - 1]?.Capitulo || "1. ACTIVIDADES GENERALES",
        Actividad: "Nueva actividad constructiva",
        Unidad: "m²",
        Cantidad_Contratada: 1,
        Precio_Unitario: 0,
      },
    ]);
  };

  const handleUpdateRow = (
    idx: number,
    field: keyof BudgetItem,
    val: string | number
  ) => {
    setItems((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const handleDeleteRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalDirecto = items.reduce(
    (acc, r) => acc + (Number(r.Cantidad_Contratada) || 0) * (Number(r.Precio_Unitario) || 0),
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setMsg({ type: "err", text: "Debes ingresar el nombre oficial del proyecto." });
      return;
    }
    const validItems = items
      .filter((r) => r.Actividad && r.Actividad.trim().length > 0)
      .map((r) => ({
        ...r,
        Cantidad_Contratada: Number(r.Cantidad_Contratada) || 0,
        Precio_Unitario: Number(r.Precio_Unitario) || 0,
        match_keys: normalizarTexto(r.Actividad)
          .split(/\s+/)
          .filter((w) => w.length > 3),
      }));

    if (validItems.length === 0) {
      setMsg({ type: "err", text: "Agrega al menos una actividad válida en el presupuesto." });
      return;
    }

    const cleanId =
      normalizarTexto(nombre)
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 28) || `proy_${Date.now()}`;

    const finalId = `${cleanId}_${String(Date.now()).slice(-4)}`;
    const newProy: ProjectConfig = {
      id: finalId,
      tipo,
      nombre: nombre.trim(),
      contratante: contratante.trim() || "Cliente Privado",
      cedula_cliente: cedulaCliente.trim(),
      contratista: contratista.trim() || "Ing. Juan González Mendoza",
      cedula_contratista: "C.C. 1001867834 • M.P. 021037-0828864 ATL",
      cargo_contratista: "Ingeniero Residente de Obra",
      ubicacion: ubicacion.trim() || "Sabanalarga, Atlántico",
      badge: badge.trim() || (tipo === "presupuesto" ? "PRESUPUESTO OFICIAL" : "BIM 5D"),
      a_def: aDef,
      i_def: iDef,
      u_def: uDef,
      ant_def: 15.0,
      gar_def: 5.0,
      modelo_bim: tipo === "presupuesto" ? "Presupuesto Contractual Directo" : "Revit 2027 / Bitácora",
      logo: tipo === "presupuesto" ? "📋" : "🏗️",
      ppto_base: validItems,
      isCustom: true,
    };

    onSaveProject(newProy);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold">
              🏗️ Asistente de Creación de Nuevo Proyecto
            </h2>
            <p className="text-xs text-slate-300">
              Crea presupuestos oficiales o proyectos BIM 5D con carga Excel (Pandas) o edición manual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white text-lg font-bold px-2"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs">
          {msg && (
            <div
              className={`rounded-xl px-4 py-3 font-semibold border ${
                msg.type === "ok"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Step 1: Modalidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTipo("presupuesto");
                setBadge("PRESUPUESTO OFICIAL");
              }}
              className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                tipo === "presupuesto"
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-extrabold text-sm text-slate-900">
                📋 Solo Presupuesto
              </div>
              <div className="text-slate-600 mt-1">
                Estudios de costos, licitaciones y consultorías sin seguimiento diario BIM.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTipo("bim");
                setBadge("BIM 5D CLOUD");
              }}
              className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                tipo === "bim"
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-extrabold text-sm text-slate-900">
                🏗️ Control Integral BIM 5D
              </div>
              <div className="text-slate-600 mt-1">
                Control de obra en vivo conectado a Supabase Bitácora, Curva S y Actas de Cobro.
              </div>
            </button>
          </div>

          {/* Step 2: Datos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Nombre Oficial del Proyecto *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Bodega Logística Norte"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Contratante / Cliente
              </label>
              <input
                type="text"
                value={contratante}
                onChange={(e) => setContratante(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                C.C. / NIT del Cliente
              </label>
              <input
                type="text"
                value={cedulaCliente}
                onChange={(e) => setCedulaCliente(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ubicación de la Obra
              </label>
              <input
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Contratista / Consultor
              </label>
              <input
                type="text"
                value={contratista}
                onChange={(e) => setContratista(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Etiqueta / Badge
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          {/* Step 3: Excel upload / Table editor */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-slate-800">
                3. Actividades del Presupuesto ({items.length} ítems • Costo Directo:{" "}
                <span className="text-blue-700 font-mono">{formatCOP(totalDirecto)}</span>)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPlantilla}
                  className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg"
                >
                  ⬇️ Plantilla Excel
                </button>
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg">
                  {uploading ? "⏳ Procesando..." : "📤 Cargar Excel / CSV"}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg"
                >
                  ➕ Añadir Fila
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 sticky top-0 text-[11px] font-bold text-slate-700">
                  <tr>
                    <th className="p-2 w-16">Ítem</th>
                    <th className="p-2 w-40">Capítulo</th>
                    <th className="p-2">Actividad</th>
                    <th className="p-2 w-16">Und</th>
                    <th className="p-2 w-24 text-right">Cant.</th>
                    <th className="p-2 w-28 text-right">P. Unit ($)</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5">
                        <input
                          value={r.Item}
                          onChange={(e) => handleUpdateRow(idx, "Item", e.target.value)}
                          className="w-full border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          value={r.Capitulo}
                          onChange={(e) => handleUpdateRow(idx, "Capitulo", e.target.value)}
                          className="w-full border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          value={r.Actividad}
                          onChange={(e) => handleUpdateRow(idx, "Actividad", e.target.value)}
                          className="w-full border border-slate-200 rounded px-1.5 py-1"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          value={r.Unidad}
                          onChange={(e) => handleUpdateRow(idx, "Unidad", e.target.value)}
                          className="w-full border border-slate-200 rounded px-1.5 py-1 text-center"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={r.Cantidad_Contratada}
                          onChange={(e) =>
                            handleUpdateRow(idx, "Cantidad_Contratada", Number(e.target.value))
                          }
                          className="w-full border border-slate-200 rounded px-1.5 py-1 text-right font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="100"
                          value={r.Precio_Unitario}
                          onChange={(e) =>
                            handleUpdateRow(idx, "Precio_Unitario", Number(e.target.value))
                          }
                          className="w-full border border-slate-200 rounded px-1.5 py-1 text-right font-mono"
                        />
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4: Default AIU */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                % Admin por defecto
              </label>
              <input
                type="number"
                step="0.5"
                value={aDef}
                onChange={(e) => setADef(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                % Imprevistos
              </label>
              <input
                type="number"
                step="0.5"
                value={iDef}
                onChange={(e) => setIDef(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                % Utilidad
              </label>
              <input
                type="number"
                step="0.5"
                value={uDef}
                onChange={(e) => setUDef(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md"
            >
              🚀 Crear y Activar Proyecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
