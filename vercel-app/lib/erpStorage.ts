import {
  getDemoClientsState,
  getDemoPayrollState,
  getDemoSstState,
  getDemoSuppliersState,
} from "./demoData";
import type { AppLang } from "./i18n";
import type {
  ClientInvoiceEntry,
  ClientsProjectData,
  ConsolidationResult,
  LiquidationParams,
  PayrollProjectData,
  PayrollWorkerEntry,
  ProjectConfig,
  PurchaseOrder,
  SstProjectData,
  SuppliersProjectData,
} from "./types";

const SST_STORAGE_PREFIX = "jgm_contech_sst_v1_";
const PAYROLL_STORAGE_PREFIX = "jgm_contech_payroll_v1_";
const SUPPLIERS_STORAGE_PREFIX = "jgm_contech_suppliers_v1_";
const CLIENTS_STORAGE_PREFIX = "jgm_contech_clients_v1_";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function offsetIsoDays(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function safeProjectKey(projectId: string): string {
  return String(projectId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildDefaultRealSstState(proyecto: ProjectConfig): SstProjectData {
  const f0 = proyecto.nombre || "Obra Principal";
  return {
    diasSinLti: 18,
    horasHombreAcum: 960,
    permisos: [
      {
        id: `ptar-${safeProjectKey(proyecto.id)}-1`,
        codigo: "PTAR-001",
        fecha: todayIso(),
        tipo: "alturas",
        frente: `${f0} • Estructura & Cubierta`,
        frenteEn: `${f0} • Structure & Roof`,
        responsable: "Inspector SST / Residente",
        responsableEn: "HSE Inspector / Site Lead",
        alturaM: 3.4,
        ptarChecklistOk: true,
        arlVerificada: true,
        estado: "vigente",
        notas: "Línea de vida, anclaje certificado y arnés de cuerpo completo verificados.",
        notasEn: "Certified lifeline, anchor points, and full-body harness verified.",
      },
    ],
    charlas: [
      {
        id: `talk-${safeProjectKey(proyecto.id)}-1`,
        fecha: todayIso(),
        frente: "Todos los Frentes de Obra",
        frenteEn: "All Active Crews",
        tema: "Inspección pre-operacional de herramientas, EPP y trabajo seguro en alturas",
        temaEn: "Pre-shift tool inspection, mandatory PPE & working at heights safety",
        instructor: "Coordinación HSE / Residente",
        instructorEn: "HSE Lead / Site Supervisor",
        asistentes: 6,
        atsCompletado: true,
      },
    ],
    eppTrabajadores: [
      {
        id: `epp-${safeProjectKey(proyecto.id)}-1`,
        codigo: "OP-01",
        rol: "Oficial Estructura & Albañilería",
        rolEn: "Lead Structural Mason",
        cuadrilla: "Frente Estructura",
        cargoCertAltura: true,
        venceCertAltura: offsetIsoDays(180),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: true,
        guantes: true,
        gafas: true,
      },
      {
        id: `epp-${safeProjectKey(proyecto.id)}-2`,
        codigo: "OP-02",
        rol: "Ayudante de Obra & Logística",
        rolEn: "Construction Helper & Logistics",
        cuadrilla: "Frente Estructura",
        cargoCertAltura: true,
        venceCertAltura: offsetIsoDays(150),
        estadoAfiliacion: "activa",
        casco: true,
        botas: true,
        arnes: true,
        guantes: true,
        gafas: true,
      },
    ],
    incidentes: [],
  };
}

function buildDefaultRealPayrollState(
  proyecto: ProjectConfig,
  data: ConsolidationResult
): PayrollProjectData {
  const firstItem = data.df_5d[0];
  return {
    periodo: `${todayIso().slice(0, 7)} Q1`,
    registros: [
      {
        id: `pay-${safeProjectKey(proyecto.id)}-1`,
        codigo: "EMP-01",
        nombreRol: "Dirección Residente de Obra",
        nombreRolEn: "Resident Civil Engineer",
        especialidad: "Control Técnico BIM & Supervisión",
        especialidadEn: "BIM Site Controls & Supervision",
        modalidad: "jornal",
        unidadPago: "día",
        tarifaBaseCop: 155000,
        diasTrabajados: 12,
        horasExtra: 0,
        cantidadDestajoMetric: 0,
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "borrador",
        notas: "Seguimiento diario de presupuesto y bitácora.",
      },
      {
        id: `pay-${safeProjectKey(proyecto.id)}-2`,
        codigo: "CREW-01",
        nombreRol: "Cuadrilla Principal de Ejecución",
        nombreRolEn: "Primary Production Crew",
        especialidad: firstItem ? firstItem.Actividad.slice(0, 48) : "Ejecución Obra General",
        especialidadEn: firstItem ? firstItem.Actividad.slice(0, 48) : "General Field Production",
        modalidad: "destajo",
        unidadPago: firstItem?.Unidad || "m²",
        tarifaBaseCop: firstItem ? Math.max(12000, Math.round(firstItem.Precio_Unitario * 0.28)) : 18500,
        diasTrabajados: 10,
        horasExtra: 0,
        cantidadDestajoMetric: firstItem ? Number(firstItem.Cantidad_Ejecutada || 0) : 0,
        actividadMatchItem: firstItem ? String(firstItem.Item) : undefined,
        prestamoDescuentoCop: 0,
        afiliadoArlRiesgoV: true,
        estado: "borrador",
        notas: "Vinculado automáticamente con ítem ejecutable del control 5D.",
      },
    ],
  };
}

export function loadSstProjectState(
  proyecto: ProjectConfig,
  isDemo: boolean
): SstProjectData {
  if (isDemo || proyecto.id === "demo_showcase") {
    return getDemoSstState();
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        `${SST_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SstProjectData>;
        if (
          parsed &&
          Array.isArray(parsed.permisos) &&
          Array.isArray(parsed.charlas) &&
          Array.isArray(parsed.eppTrabajadores) &&
          Array.isArray(parsed.incidentes)
        ) {
          return {
            diasSinLti: Number(parsed.diasSinLti ?? 0),
            horasHombreAcum: Number(parsed.horasHombreAcum ?? 0),
            permisos: parsed.permisos,
            charlas: parsed.charlas,
            eppTrabajadores: parsed.eppTrabajadores,
            incidentes: parsed.incidentes,
          };
        }
      }
    } catch {
      // Ignore malformed local state and re-seed cleanly
    }
  }
  return buildDefaultRealSstState(proyecto);
}

export function saveSstProjectState(
  proyecto: ProjectConfig,
  state: SstProjectData,
  isDemo: boolean
): void {
  if (isDemo || proyecto.id === "demo_showcase") return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${SST_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPayrollProjectState(
  proyecto: ProjectConfig,
  data: ConsolidationResult,
  isDemo: boolean
): PayrollProjectData {
  if (isDemo || proyecto.id === "demo_showcase") {
    return getDemoPayrollState(data);
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        `${PAYROLL_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PayrollProjectData>;
        if (parsed && Array.isArray(parsed.registros)) {
          return {
            periodo: String(parsed.periodo || `${todayIso().slice(0, 7)} Q1`),
            registros: parsed.registros,
          };
        }
      }
    } catch {
      // Ignore malformed local state and re-seed cleanly
    }
  }
  return buildDefaultRealPayrollState(proyecto, data);
}

export function savePayrollProjectState(
  proyecto: ProjectConfig,
  state: PayrollProjectData,
  isDemo: boolean
): void {
  if (isDemo || proyecto.id === "demo_showcase") return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${PAYROLL_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export interface SstSummaryMetrics {
  diasSinLti: number;
  horasHombreAcum: number;
  permisosActivos: number;
  charlasTotales: number;
  eppPct: number;
  capasAbiertas: number;
  trir: number;
}

export function computeSstSummary(sst: SstProjectData): SstSummaryMetrics {
  const permisosActivos = sst.permisos.filter(
    (p) => p.estado === "vigente" || p.estado === "pendiente"
  ).length;
  const capasAbiertas = sst.incidentes.filter((i) => !i.cerrado).length;
  const totalWorkers = sst.eppTrabajadores.length;
  let checkedItems = 0;
  for (const w of sst.eppTrabajadores) {
    if (w.casco) checkedItems += 1;
    if (w.botas) checkedItems += 1;
    if (w.arnes) checkedItems += 1;
    if (w.guantes) checkedItems += 1;
    if (w.gafas) checkedItems += 1;
  }
  const eppPct =
    totalWorkers > 0
      ? Math.round((checkedItems / (totalWorkers * 5)) * 100)
      : 100;

  const recordables = sst.incidentes.filter(
    (i) => i.tipo === "incidente_leve" || i.tipo === "accidente_lti"
  ).length;
  const trir =
    sst.horasHombreAcum > 0
      ? Math.round(((recordables * 200000) / sst.horasHombreAcum) * 100) / 100
      : 0;

  return {
    diasSinLti: sst.diasSinLti,
    horasHombreAcum: sst.horasHombreAcum,
    permisosActivos,
    charlasTotales: sst.charlas.length,
    eppPct,
    capasAbiertas,
    trir,
  };
}

export interface WorkerPayBreakdown {
  salarioOrdinarioCop: number;
  recargoExtrasCop: number;
  devengadoBrutoCop: number;
  deduccionLeyCop: number;
  arlObraCop: number;
  seguridadSocialYPrestacionesCop: number;
  cargaEmpleadorCop: number;
  netoPagarCop: number;
  costoTotalEmpresaCop: number;
}

export function computeWorkerPayRow(
  entry: PayrollWorkerEntry,
  lang: AppLang
): WorkerPayBreakdown {
  const baseRate = Math.max(0, Number(entry.tarifaBaseCop || 0));
  const days = Math.max(0, Number(entry.diasTrabajados || 0));
  const otHours = Math.max(0, Number(entry.horasExtra || 0));
  const pieceQty = Math.max(0, Number(entry.cantidadDestajoMetric || 0));
  const loanDiscount = Math.max(0, Number(entry.prestamoDescuentoCop || 0));

  const salarioOrdinarioCop =
    entry.modalidad === "destajo"
      ? Math.round(baseRate * pieceQty)
      : Math.round(baseRate * days);

  const hourlyRef =
    entry.modalidad === "destajo"
      ? salarioOrdinarioCop / Math.max(1, days || 10) / 8
      : baseRate / 8;
  const otMultiplier = lang === "en" ? 1.5 : 1.25;
  const recargoExtrasCop = Math.round(hourlyRef * otMultiplier * otHours);

  const devengadoBrutoCop = salarioOrdinarioCop + recargoExtrasCop;

  // Worker statutory deductions (ES: Salud 4% + Pensión 4% = 8% | EN: FICA/Medicare 7.65%)
  const employeeRate = lang === "en" ? 0.0765 : 0.08;
  const deduccionLeyCop = Math.round(devengadoBrutoCop * employeeRate);

  // Employer statutory burden:
  // ES Colombia: ARL Clase V (6.96%) or I (0.522%) + Pensión Empleador 12% + CCF 4% + Prestaciones Sociales 21.83%
  // EN US/EU Certified Payroll: Workers' Comp (6.5% structural vs 1.5% low-risk) + Employer FICA/FUTA (8.25%)
  const arlRate =
    lang === "en"
      ? entry.afiliadoArlRiesgoV
        ? 0.065
        : 0.015
      : entry.afiliadoArlRiesgoV
        ? 0.0696
        : 0.00522;
  const socialAndBenefitsRate = lang === "en" ? 0.0825 : 0.16 + 0.2183;

  const arlObraCop = Math.round(devengadoBrutoCop * arlRate);
  const seguridadSocialYPrestacionesCop = Math.round(
    devengadoBrutoCop * socialAndBenefitsRate
  );
  const cargaEmpleadorCop = arlObraCop + seguridadSocialYPrestacionesCop;

  const netoPagarCop = Math.max(0, devengadoBrutoCop - deduccionLeyCop - loanDiscount);
  const costoTotalEmpresaCop = devengadoBrutoCop + cargaEmpleadorCop;

  return {
    salarioOrdinarioCop,
    recargoExtrasCop,
    devengadoBrutoCop,
    deduccionLeyCop,
    arlObraCop,
    seguridadSocialYPrestacionesCop,
    cargaEmpleadorCop,
    netoPagarCop,
    costoTotalEmpresaCop,
  };
}

export interface PayrollSummaryMetrics {
  periodo: string;
  trabajadores: number;
  devengadoBrutoCop: number;
  deduccionesCop: number;
  cargaEmpleadorCop: number;
  netoPagarCop: number;
  costoTotalEmpresaCop: number;
  destajoTotalCop: number;
  jornalTotalCop: number;
  pagadosCount: number;
}

export function computePayrollSummary(
  payroll: PayrollProjectData,
  lang: AppLang
): PayrollSummaryMetrics {
  let devengadoBrutoCop = 0;
  let deduccionesCop = 0;
  let cargaEmpleadorCop = 0;
  let netoPagarCop = 0;
  let costoTotalEmpresaCop = 0;
  let destajoTotalCop = 0;
  let jornalTotalCop = 0;
  let pagadosCount = 0;

  for (const row of payroll.registros) {
    const calc = computeWorkerPayRow(row, lang);
    devengadoBrutoCop += calc.devengadoBrutoCop;
    deduccionesCop += calc.deduccionLeyCop + Math.max(0, Number(row.prestamoDescuentoCop || 0));
    cargaEmpleadorCop += calc.cargaEmpleadorCop;
    netoPagarCop += calc.netoPagarCop;
    costoTotalEmpresaCop += calc.costoTotalEmpresaCop;
    if (row.modalidad === "destajo") {
      destajoTotalCop += calc.devengadoBrutoCop;
    } else {
      jornalTotalCop += calc.devengadoBrutoCop;
    }
    if (row.estado === "pagada") pagadosCount += 1;
  }

  return {
    periodo: payroll.periodo,
    trabajadores: payroll.registros.length,
    devengadoBrutoCop,
    deduccionesCop,
    cargaEmpleadorCop,
    netoPagarCop,
    costoTotalEmpresaCop,
    destajoTotalCop,
    jornalTotalCop,
    pagadosCount,
  };
}

export function syncPayrollDestajoWith5D(
  payroll: PayrollProjectData,
  data: ConsolidationResult
): { next: PayrollProjectData; updatedCount: number } {
  let updatedCount = 0;
  const nextRegistros = payroll.registros.map((entry) => {
    if (entry.modalidad !== "destajo" || !entry.actividadMatchItem) {
      return entry;
    }
    const targetCode = entry.actividadMatchItem.trim();
    const matched = data.df_5d.find(
      (item) => String(item.Item).trim() === targetCode
    );
    if (!matched) return entry;
    const newQty = Number(matched.Cantidad_Ejecutada || 0);
    if (Math.abs(newQty - Number(entry.cantidadDestajoMetric || 0)) > 0.0001) {
      updatedCount += 1;
    }
    return {
      ...entry,
      cantidadDestajoMetric: newQty,
      unidadPago: matched.Unidad || entry.unidadPago,
    };
  });

  return {
    next: {
      ...payroll,
      registros: nextRegistros,
    },
    updatedCount,
  };
}

// =============================================================================
// FASE 2: PROVEEDORES & COMPRAS (AP) + CLIENTES & CARTERA (AR)
// =============================================================================

function buildDefaultRealSuppliersState(
  proyecto: ProjectConfig,
  data: ConsolidationResult
): SuppliersProjectData {
  const key = safeProjectKey(proyecto.id);
  const firstInsumo = data.insumos_demanda[0];
  const firstQty = firstInsumo ? Math.max(1, Math.round(firstInsumo.Total_Teorico)) : 20;
  return {
    proveedores: [
      {
        id: `sup-${key}-1`,
        codigo: "PROV-01",
        razonSocial: "Suministros & Materiales de Construcción",
        razonSocialEn: "Core Construction Materials Supply",
        nitTaxId: "NIT-900-000-001",
        categoria: "aceros_mamposteria",
        especialidad: "Cementos, Agregados, Aceros & Bloques",
        especialidadEn: "Cement, Aggregates, Rebar & Masonry",
        contactoRol: "Ejecutivo de Cuenta Obra",
        condicionPago: "Crédito 30 días",
        condicionPagoEn: "Net 30",
        calificacion: 4.8,
        retencionPct: 2.5,
      },
      {
        id: `sup-${key}-2`,
        codigo: "PROV-02",
        razonSocial: "Acabados, Pisos & Carpintería Técnica",
        razonSocialEn: "Architectural Finishes & Glazing Co.",
        nitTaxId: "NIT-900-000-002",
        categoria: "acabados",
        especialidad: "Porcelanatos, Drywall, Pintura & Carpintería",
        especialidadEn: "Porcelain Tile, Drywall, Latex & Doors",
        contactoRol: "Despachos & Logística",
        condicionPago: "Crédito 15 días",
        condicionPagoEn: "Net 15",
        calificacion: 4.7,
        retencionPct: 2.5,
      },
    ],
    ordenes: firstInsumo
      ? [
          {
            id: `oc-${key}-1`,
            codigo: "OC-001",
            fecha: offsetIsoDays(-3),
            fechaEntrega: offsetIsoDays(4),
            proveedorId: `sup-${key}-1`,
            proveedorNombre: "Suministros & Materiales de Construcción",
            concepto: firstInsumo.Insumo,
            conceptoEn: firstInsumo.Insumo,
            unidad: firstInsumo.Unidad || "und",
            cantidad: firstQty,
            precioUnitarioCop: 36500,
            bimMaterialMatch: firstInsumo.Insumo,
            porcentajeRecibido: 50,
            pagadoCop: Math.round(firstQty * 36500 * 0.5),
            estado: "en_obra",
            notas: "Orden inicial generada desde explosión de insumos BIM 5D.",
          },
        ]
      : [],
  };
}

export function loadSuppliersProjectState(
  proyecto: ProjectConfig,
  data: ConsolidationResult,
  isDemo: boolean
): SuppliersProjectData {
  if (isDemo || proyecto.id === "demo_showcase") {
    return getDemoSuppliersState();
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        `${SUPPLIERS_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SuppliersProjectData>;
        if (parsed && Array.isArray(parsed.proveedores) && Array.isArray(parsed.ordenes)) {
          return {
            proveedores: parsed.proveedores,
            ordenes: parsed.ordenes,
          };
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }
  return buildDefaultRealSuppliersState(proyecto, data);
}

export function saveSuppliersProjectState(
  proyecto: ProjectConfig,
  state: SuppliersProjectData,
  isDemo: boolean
): void {
  if (isDemo || proyecto.id === "demo_showcase") return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${SUPPLIERS_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore quota errors
  }
}

export function computeOrderTotalCop(order: PurchaseOrder): number {
  return Math.round(
    Math.max(0, Number(order.cantidad || 0)) *
      Math.max(0, Number(order.precioUnitarioCop || 0))
  );
}

export interface SuppliersSummaryMetrics {
  proveedoresCount: number;
  ordenesTotales: number;
  ordenesAbiertas: number;
  totalComprometidoCop: number;
  totalPagadoCop: number;
  cuentasPorPagarCop: number;
  cumplimientoEntregaPct: number;
  calificacionPromedio: number;
}

export function computeSuppliersSummary(
  state: SuppliersProjectData
): SuppliersSummaryMetrics {
  let totalComprometidoCop = 0;
  let totalPagadoCop = 0;
  let ordenesAbiertas = 0;
  let sumRecibido = 0;

  for (const oc of state.ordenes) {
    totalComprometidoCop += computeOrderTotalCop(oc);
    totalPagadoCop += Math.max(0, Number(oc.pagadoCop || 0));
    sumRecibido += Math.min(100, Math.max(0, Number(oc.porcentajeRecibido || 0)));
    if (oc.estado !== "pagada") ordenesAbiertas += 1;
  }

  const cuentasPorPagarCop = Math.max(0, totalComprometidoCop - totalPagadoCop);
  const cumplimientoEntregaPct =
    state.ordenes.length > 0 ? Math.round(sumRecibido / state.ordenes.length) : 100;

  const calificacionPromedio =
    state.proveedores.length > 0
      ? Math.round(
          (state.proveedores.reduce((acc, p) => acc + Number(p.calificacion || 4.5), 0) /
            state.proveedores.length) *
            10
        ) / 10
      : 5.0;

  return {
    proveedoresCount: state.proveedores.length,
    ordenesTotales: state.ordenes.length,
    ordenesAbiertas,
    totalComprometidoCop,
    totalPagadoCop,
    cuentasPorPagarCop,
    cumplimientoEntregaPct,
    calificacionPromedio,
  };
}

function buildDefaultRealClientsState(
  proyecto: ProjectConfig,
  data: ConsolidationResult,
  params: LiquidationParams
): ClientsProjectData {
  const key = safeProjectKey(proyecto.id);
  const pctAiu = (params.pct_a + params.pct_i + params.pct_u) / 100;
  const valorContrato = Math.round(data.totals.total_ppto_contratado * (1 + pctAiu));
  const anticipoPct = params.pct_anticipo > 0 ? params.pct_anticipo / 100 : 0.15;
  const anticipoVal = Math.round(valorContrato * anticipoPct);

  return {
    clienteNombre: proyecto.contratante || "Cliente Contratante",
    clienteIdFiscal: proyecto.cedula_cliente || "NIT / ID Fiscal por definir",
    representanteRol: "Interventoría / Supervisión Técnica",
    representanteRolEn: "Client Representative / Supervision",
    condicionCobro: "Actas de Corte Mensuales • Pago 15 días",
    condicionCobroEn: "Monthly Progress Certificates • Net 15",
    cupoAprobadoCop: Math.round(valorContrato * 1.15),
    facturas:
      anticipoVal > 0
        ? [
            {
              id: `cli-${key}-1`,
              numero: "ANT-001",
              fechaEmision: offsetIsoDays(-7),
              fechaVencimiento: todayIso(),
              tipo: "anticipo",
              concepto: `Anticipo Contractual (${Math.round(anticipoPct * 100)}%)`,
              conceptoEn: `Contract Advance Payment (${Math.round(anticipoPct * 100)}%)`,
              valorBrutoCop: anticipoVal,
              amortizacionAnticipoCop: 0,
              retencionGarantiaCop: 0,
              ivaCop: 0,
              recaudadoCop: anticipoVal,
              estado: "pagada",
              notas: "Base contractual inicial del proyecto.",
            },
          ]
        : [],
  };
}

export function loadClientsProjectState(
  proyecto: ProjectConfig,
  data: ConsolidationResult,
  params: LiquidationParams,
  isDemo: boolean
): ClientsProjectData {
  if (isDemo || proyecto.id === "demo_showcase") {
    return getDemoClientsState(proyecto, data, params);
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(
        `${CLIENTS_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClientsProjectData>;
        if (parsed && Array.isArray(parsed.facturas)) {
          return {
            clienteNombre: String(parsed.clienteNombre || proyecto.contratante || "Cliente"),
            clienteIdFiscal: String(parsed.clienteIdFiscal || proyecto.cedula_cliente || ""),
            representanteRol: String(parsed.representanteRol || "Supervisión Técnica"),
            representanteRolEn: String(parsed.representanteRolEn || "Client Representative"),
            condicionCobro: String(parsed.condicionCobro || "Pago 15 días"),
            condicionCobroEn: String(parsed.condicionCobroEn || "Net 15"),
            cupoAprobadoCop: Number(parsed.cupoAprobadoCop ?? 0),
            facturas: parsed.facturas,
          };
        }
      }
    } catch {
      // Ignore malformed storage
    }
  }
  return buildDefaultRealClientsState(proyecto, data, params);
}

export function saveClientsProjectState(
  proyecto: ProjectConfig,
  state: ClientsProjectData,
  isDemo: boolean
): void {
  if (isDemo || proyecto.id === "demo_showcase") return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CLIENTS_STORAGE_PREFIX}${safeProjectKey(proyecto.id)}`,
      JSON.stringify(state)
    );
  } catch {
    // Ignore quota errors
  }
}

export function computeInvoiceNetCop(inv: ClientInvoiceEntry): number {
  return Math.max(
    0,
    Math.round(
      Number(inv.valorBrutoCop || 0) -
        Number(inv.amortizacionAnticipoCop || 0) -
        Number(inv.retencionGarantiaCop || 0) +
        Number(inv.ivaCop || 0)
    )
  );
}

export interface ClientsSummaryMetrics {
  valorContratoTotalCop: number;
  valorEjecutadoBrutoCop: number;
  totalFacturadoNetoCop: number;
  totalFacturadoBrutoAvanceCop: number;
  totalRecaudadoCop: number;
  cuentasPorCobrarCop: number;
  porFacturarDeEjecucionCop: number;
  fondoGarantiaRetenidoCop: number;
  facturasVencidasCount: number;
  facturasCount: number;
}

export function computeClientsSummary(
  state: ClientsProjectData,
  data: ConsolidationResult,
  params: LiquidationParams
): ClientsSummaryMetrics {
  const pctAiu = (params.pct_a + params.pct_i + params.pct_u) / 100;
  const valorContratoTotalCop = Math.round(
    Number(data.totals?.total_ppto_contratado || 0) * (1 + pctAiu)
  );
  const valorEjecutadoBrutoCop = Math.round(
    Number(data.totals?.total_costo_ejecutado || 0) * (1 + pctAiu)
  );

  let totalFacturadoNetoCop = 0;
  let totalFacturadoBrutoAvanceCop = 0;
  let totalRecaudadoCop = 0;
  let fondoGarantiaRetenidoCop = 0;
  let facturasVencidasCount = 0;

  for (const inv of state.facturas) {
    const net = computeInvoiceNetCop(inv);
    if (inv.estado !== "borrador") {
      totalFacturadoNetoCop += net;
      if (inv.tipo === "acta_avance" || inv.tipo === "adicional") {
        totalFacturadoBrutoAvanceCop += Number(inv.valorBrutoCop || 0);
      }
      if (inv.tipo === "liberacion_garantia") {
        fondoGarantiaRetenidoCop = Math.max(
          0,
          fondoGarantiaRetenidoCop - Number(inv.valorBrutoCop || 0)
        );
      } else {
        fondoGarantiaRetenidoCop += Number(inv.retencionGarantiaCop || 0);
      }
    }
    totalRecaudadoCop += Math.max(0, Number(inv.recaudadoCop || 0));
    if (inv.estado === "vencida") facturasVencidasCount += 1;
  }

  const cuentasPorCobrarCop = Math.max(0, totalFacturadoNetoCop - totalRecaudadoCop);
  const porFacturarDeEjecucionCop = Math.max(
    0,
    valorEjecutadoBrutoCop - totalFacturadoBrutoAvanceCop
  );

  return {
    valorContratoTotalCop,
    valorEjecutadoBrutoCop,
    totalFacturadoNetoCop,
    totalFacturadoBrutoAvanceCop,
    totalRecaudadoCop,
    cuentasPorCobrarCop,
    porFacturarDeEjecucionCop,
    fondoGarantiaRetenidoCop,
    facturasVencidasCount,
    facturasCount: state.facturas.length,
  };
}

export function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function downloadCsvUtf8(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const quoteCell = (val: string | number): string => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(";")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(quoteCell).join(","),
    ...rows.map((row) => row.map(quoteCell).join(",")),
  ];
  const csvContent = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openExecutivePrintSheet(opts: {
  docTitle: string;
  badge: string;
  projectTitle: string;
  clientName: string;
  periodOrDate: string;
  bodyHtml: string;
  footerNote: string;
  lang: AppLang;
}): boolean {
  if (typeof window === "undefined") return false;
  const popup = window.open("", "_blank", "width=1024,height=840");
  if (!popup) return false;

  const isEn = opts.lang === "en";
  const html = `<!DOCTYPE html>
<html lang="${isEn ? "en" : "es"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.docTitle)} - ${escapeHtml(opts.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 28px 34px;
      font-size: 12px;
      line-height: 1.45;
    }
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .badge {
      display: inline-block;
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .meta {
      font-size: 11px;
      color: #475569;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #334155;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 12px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .kpi {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 11px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 3px;
    }
    .kpi-val {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    h2 {
      font-size: 13px;
      font-weight: 700;
      margin: 16px 0 8px 0;
      color: #0f172a;
      border-left: 3px solid #0284c7;
      padding-left: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
    }
    td {
      border-bottom: 1px solid #e2e8f0;
      padding: 6px 8px;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 9.5px;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
    }
    .footer {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #cbd5e1;
      font-size: 10px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 12px 16px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">${escapeHtml(opts.badge)}</div>
      <h1>${escapeHtml(opts.docTitle)}</h1>
      <div class="meta"><strong>${escapeHtml(opts.projectTitle)}</strong> • ${escapeHtml(opts.clientName)}</div>
    </div>
    <div class="meta-box">
      <div><strong>${isEn ? "Period / Date" : "Periodo / Fecha"}:</strong> ${escapeHtml(opts.periodOrDate)}</div>
      <div><strong>${isEn ? "Issued" : "Generado"}:</strong> ${escapeHtml(todayIso())}</div>
    </div>
  </div>
  ${opts.bodyHtml}
  <div class="footer">
    <span>JGM ConTech • ${isEn ? "Real-time technical and financial civil construction control." : "Dirección técnica y financiera de obra civil en tiempo real."}</span>
    <span>${escapeHtml(opts.footerNote)}</span>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 250); };
  </script>
</body>
</html>`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  return true;
}
