export type ProjectMode = "bim" | "presupuesto";

export type TabKey =
  | "panel"
  | "habitaciones"
  | "visor3d"
  | "presupuesto"
  | "contratos"
  | "actas"
  | "mayores"
  | "rendimiento"
  | "curva_s"
  | "insumos"
  | "bitacora";

export type RoomActivityKey =
  | "plantilla"
  | "enchape"
  | "enchape_pared"
  | "cielorraso"
  | "mamposteria"
  | "panete"
  | "pintura"
  | "carpinteria"
  | "cubierta"
  | "otro";

export interface RoomActivityItem {
  id: string;
  room: string;
  activityKey: RoomActivityKey;
  activityLabel: string;
  sourceComment: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  pendingVerify?: boolean;
}

export interface BudgetItem {
  Item: string;
  Capitulo: string;
  Actividad: string;
  Unidad: string;
  Cantidad_Contratada: number;
  Precio_Unitario: number;
  match_keys?: string[];
}

export interface HonorariosConfig {
  incluir: boolean;
  escenario: "anexo_aiu" | "solo_consultoria";
  modo_calculo: "fijo" | "porcentaje";
  valor_fijo: number;
  porcentaje: number;
  bonificable: boolean;
  incluir_iva_hon: boolean;
  incluir_visita: boolean;
  valor_visita: number;
}

export interface LiquidationParams {
  pct_a: number;
  pct_i: number;
  pct_u: number;
  pct_anticipo: number;
  pct_garantia: number;
}

export interface ProjectConfig {
  id: string;
  tipo?: ProjectMode;
  nombre: string;
  contratante: string;
  cedula_cliente?: string;
  contratista: string;
  cedula_contratista?: string;
  cargo_contratista?: string;
  ubicacion: string;
  badge: string;
  a_def: number;
  i_def: number;
  u_def: number;
  ant_def: number;
  gar_def: number;
  modelo_bim: string;
  logo: string;
  ppto_base: BudgetItem[];
  zonas_bim?: RoomActivityItem[];
  honorarios_consultoria?: HonorariosConfig;
  firma_residente?: string;
  firma_interventor?: string;
  isCustom?: boolean;
}

export interface BitacoraRow {
  id?: number;
  fecha: string;
  actividad: string;
  unidad?: string;
  cantidad: number;
  desperdicio?: number;
  created_at?: string;
}

export interface ConsolidatedRow {
  Item: string;
  Capitulo: string;
  Actividad: string;
  Unidad: string;
  Cantidad_Contratada: number;
  Cantidad_Ejecutada: number;
  Saldo_Cantidad: number;
  Mayor_Cantidad: number;
  Sobrecosto_COP: number;
  Precio_Unitario: number;
  Presupuesto_Total: number;
  Costo_Ejecutado: number;
  Saldo_Dinero: number;
  "Avance_%": number;
  "Desperdicio_%": number;
  Estado: string;
}

export interface ResumenCapitulo {
  Capitulo: string;
  Presupuesto_Total: number;
  Costo_Ejecutado: number;
  Saldo_Dinero: number;
  "Avance_%": number;
}

export interface RendimientoRow {
  Actividad: string;
  Cuadrilla_Asignada: string;
  Total_Producido: number;
  Jornadas: number;
  Rendimiento_Real: string;
  Meta_APU_Teorica: string;
  "Eficiencia_%": number;
  Evaluacion: string;
}

export interface InsumoRow {
  Actividad: string;
  Insumo: string;
  Unidad: string;
  Total_Teorico: number;
}

export interface ConsolidationTotals {
  total_ppto_contratado: number;
  total_costo_ejecutado: number;
  total_saldo_dinero: number;
  total_sobrecosto_cop: number;
  avance_financiero_global: number;
  avance_fisico_ponderado: number;
}

export interface ConsolidationResult {
  df_5d: ConsolidatedRow[];
  resumen_caps: ResumenCapitulo[];
  obra_activa: BitacoraRow[];
  totals: ConsolidationTotals;
  rendimientos: RendimientoRow[];
  insumos_demanda: InsumoRow[];
  insumos_ejecutado: InsumoRow[];
  engine: "pandas" | "client-ts";
}

export interface ClientContractCfg {
  num_contrato: string;
  fecha_firma: string;
  plazo_dias: number;
  garantia_meses: number;
  pct_anticipo: number;
  pct_corte: number;
  pct_saldo: number;
  incluir_iva_u: boolean;
  notas_adicionales: string;
}

export interface SubcontractItem {
  Item: string;
  Actividad: string;
  Unidad: string;
  Cantidad_Contratada: number;
  Tarifa_Mano_Obra: number;
  Subtotal_Estimado?: number;
}

export interface SubcontractCfg {
  num_subcontrato: string;
  nombre_oficial: string;
  cedula_oficial: string;
  telefono_oficial: string;
  especialidad: string;
  pct_retencion: number;
  plazo_dias: number;
  fecha_inicio: string;
  fecha_entrega: string;
}
