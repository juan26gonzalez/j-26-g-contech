"use client";

import React, { useState } from "react";
import {
  Building2,
  ClipboardList,
  Download,
  Loader2,
  Plus,
  Rocket,
  Upload,
  X,
} from "lucide-react";
import {
  callPythonJson,
  downloadPlantillaExcel,
  normalizarTexto,
  parseCsvLocalFallback,
} from "../lib/calcClient";
import { useAppPreferences } from "../lib/i18n";
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
  const { lang, currency, formatMoney } = useAppPreferences();
  const isEn = lang === "en";
  const moneyDecimals = currency === "COP" ? 0 : 2;

  const [tipo, setTipo] = useState<ProjectMode>("presupuesto");
  const [nombre, setNombre] = useState("");
  const [contratante, setContratante] = useState(
    isEn ? "Private Client" : "Cliente Privado"
  );
  const [cedulaCliente, setCedulaCliente] = useState("");
  const [ubicacion, setUbicacion] = useState("Barranquilla / Sabanalarga");
  const [contratista, setContratista] = useState("JGM ConTech Engineering");
  const [badge, setBadge] = useState(
    isEn ? "OFFICIAL BUDGET" : "PRESUPUESTO OFICIAL"
  );
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
            text: isEn
              ? `CSV processed (${res.items.length} activities).`
              : `CSV procesado correctamente (${res.items.length} actividades).`,
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
        text: isEn
          ? `Excel parsed via Pandas (${res.items.length} items detected).`
          : `Excel procesado con Pandas (${res.items.length} actividades detectadas).`,
      });
    } catch (err) {
      setMsg({
        type: "err",
        text: isEn
          ? `Unable to parse on Python server (${String(err)}). Try uploading a .CSV file.`
          : `No se pudo procesar en servidor Python (${String(err)}). Puedes subir un .CSV.`,
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
        Actividad: isEn ? "New construction activity" : "Nueva actividad constructiva",
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
      setMsg({
        type: "err",
        text: isEn
          ? "Please enter an official project name."
          : "Debes ingresar el nombre oficial del proyecto.",
      });
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
      setMsg({
        type: "err",
        text: isEn
          ? "Add at least one valid budget activity."
          : "Agrega al menos una actividad válida en el presupuesto.",
      });
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
      contratante: contratante.trim() || (isEn ? "Private Client" : "Cliente Privado"),
      cedula_cliente: cedulaCliente.trim(),
      contratista: contratista.trim() || "JGM ConTech Engineering",
      cedula_contratista: "",
      cargo_contratista: isEn ? "Lead Project Manager" : "Director Técnico de Obra",
      ubicacion: ubicacion.trim() || "Barranquilla / Sabanalarga",
      badge: badge.trim() || (tipo === "presupuesto" ? "BOQ" : "BIM 5D"),
      a_def: aDef,
      i_def: iDef,
      u_def: uDef,
      ant_def: 15.0,
      gar_def: 5.0,
      modelo_bim:
        tipo === "presupuesto"
          ? isEn
            ? "Direct Contract BOQ"
            : "Presupuesto Contractual Directo"
          : "OpenBIM IFC / Field Log",
      logo: tipo === "presupuesto" ? "PR" : "BM",
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
            <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {isEn ? "New Project Setup Wizard" : "Asistente de Creación de Nuevo Proyecto"}
              </span>
            </h2>
            <p className="text-xs text-slate-300">
              {isEn
                ? "Create official BOQ estimates or live 5D BIM projects with Excel (Pandas) import or inline editing."
                : "Crea presupuestos oficiales o proyectos BIM 5D con carga Excel (Pandas) o edición manual."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
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

          {/* Step 1: Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTipo("presupuesto");
                setBadge(isEn ? "OFFICIAL BUDGET" : "PRESUPUESTO OFICIAL");
              }}
              className={`text-left p-3.5 rounded-xl border-2 transition-all ${
                tipo === "presupuesto"
                  ? "border-slate-800 bg-slate-200/80 shadow-inner"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-700" />
                <span>{isEn ? "Budget / Tender Only" : "Solo Presupuesto"}</span>
              </div>
              <div className="text-slate-600 mt-1">
                {isEn
                  ? "Cost engineering estimates, tender BOQs, and consulting without daily field logs."
                  : "Estudios de costos, licitaciones y consultorías sin seguimiento diario BIM."}
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
                  ? "border-slate-800 bg-slate-200/80 shadow-inner"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-700" />
                <span>{isEn ? "Full 5D BIM Project Controls" : "Control Integral BIM 5D"}</span>
              </div>
              <div className="text-slate-600 mt-1">
                {isEn
                  ? "Live construction tracking linked to Cloud Field Log, S-Curve, and Payment Certificates."
                  : "Control de obra en vivo conectado a Supabase Bitácora, Curva S y Actas de Cobro."}
              </div>
            </button>
          </div>

          {/* Step 2: Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Official Project Name *" : "Nombre Oficial del Proyecto *"}
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={isEn ? "e.g. North Logistics Hub" : "Ej: Bodega Logística Norte"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Client / Owner" : "Contratante / Cliente"}
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
                {isEn ? "Client Tax ID / NIT" : "C.C. / NIT del Cliente"}
              </label>
              <input
                type="text"
                value={cedulaCliente}
                onChange={(e) => setCedulaCliente(e.target.value)}
                placeholder={isEn ? "Optional" : "Opcional"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Site Location" : "Ubicación de la Obra"}
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
                {isEn ? "Contractor / Consultant" : "Contratista / Consultor"}
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
                {isEn ? "Tag / Badge" : "Etiqueta / Badge"}
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          {/* Step 3: Budget table */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold text-slate-800">
                {isEn
                  ? `3. Budget Line Items (${items.length} items • Direct Cost:`
                  : `3. Actividades del Presupuesto (${items.length} ítems • Costo Directo:`}{" "}
                <span className="text-slate-900 font-mono">
                  {formatMoney(totalDirecto, moneyDecimals)}
                </span>
                )
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPlantilla}
                  className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEn ? "Excel Template" : "Plantilla Excel"}</span>
                </button>
                <label className="cursor-pointer steel-btn-primary font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isEn ? "Parsing..." : "Procesando..."}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isEn ? "Upload Excel / CSV" : "Cargar Excel / CSV"}</span>
                    </>
                  )}
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? "Add Row" : "Añadir Fila"}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-lg bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 sticky top-0 text-[11px] font-bold text-slate-700">
                  <tr>
                    <th className="p-2 w-16">{isEn ? "Item" : "Ítem"}</th>
                    <th className="p-2 w-40">{isEn ? "Chapter" : "Capítulo"}</th>
                    <th className="p-2">{isEn ? "Activity" : "Actividad"}</th>
                    <th className="p-2 w-16">{isEn ? "Unit" : "Und"}</th>
                    <th className="p-2 w-24 text-right">{isEn ? "Qty." : "Cant."}</th>
                    <th className="p-2 w-28 text-right">
                      {isEn ? "Unit Rate (COP)" : "P. Unit ($)"}
                    </th>
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
                          className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                        >
                          <X className="w-3.5 h-3.5" />
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
                {isEn ? "Default Admin %" : "% Admin por defecto"}
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
                {isEn ? "Contingencies %" : "% Imprevistos"}
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
                {isEn ? "Profit / Fee %" : "% Utilidad"}
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
              {isEn ? "Cancel" : "Cancelar"}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl steel-btn-primary font-extrabold inline-flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              <span>{isEn ? "Create & Activate Project" : "Crear y Activar Proyecto"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
