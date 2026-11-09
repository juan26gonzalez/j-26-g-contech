import streamlit as st
import pandas as pd
import numpy as np
import requests
import io
import unicodedata
from datetime import datetime, timezone, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ==============================================================================
# 1. CONFIGURACIÓN DE PÁGINA Y METADATOS CORPORATIVOS
# ==============================================================================
st.set_page_config(
    page_title="JGM ConTech | Centro de Mando Gerencial BIM 5D",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Inyección de estilos CSS corporativos de alto nivel (Navy / Slate / Blue / Emerald)
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    
    .stApp {
        background-color: #f8fafc;
    }
    
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }
    header { background: transparent; }
    
    /* Header Corporativo */
    .jgm-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border-radius: 20px;
        padding: 24px 30px;
        color: white;
        margin-bottom: 24px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
    }
    
    .jgm-title {
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .jgm-subtitle {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-top: 4px;
    }
    
    .jgm-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        background: rgba(37, 99, 235, 0.15);
        color: #60a5fa;
        border: 1px solid rgba(96, 165, 250, 0.3);
    }
    
    /* Bento Grid Moderno */
    .bento-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
    }
    
    .bento-card {
        background: #ffffff;
        border-radius: 16px;
        padding: 20px 22px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 15px rgba(15, 23, 42, 0.03);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        overflow: hidden;
    }
    
    .bento-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
    }
    
    .bento-title {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #64748b;
        margin: 0 0 8px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .bento-value {
        font-size: clamp(1.4rem, 2.2vw, 1.85rem);
        font-weight: 900;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.02em;
        line-height: 1.15;
        font-family: 'Inter', monospace;
    }
    
    .bento-sub {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 8px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    /* Tabla Corporativa */
    .table-container {
        background: #ffffff;
        border-radius: 16px;
        padding: 16px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03);
        overflow-x: auto;
        margin-bottom: 24px;
    }
    
    .jgm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }
    
    .jgm-table thead tr {
        background-color: #f1f5f9;
        border-bottom: 2px solid #cbd5e1;
    }
    
    .jgm-table th {
        padding: 12px 14px;
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #334155;
        text-align: right;
    }
    
    .jgm-table th.text-left, .jgm-table td.text-left {
        text-align: left;
    }
    
    .jgm-table th.text-center, .jgm-table td.text-center {
        text-align: center;
    }
    
    .jgm-table td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        font-weight: 500;
    }
    
    .jgm-table tbody tr:hover {
        background-color: #f8fafc;
    }
    
    /* Badges de Estado */
    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        white-space: nowrap;
    }
    
    .status-ok {
        background-color: #ecfdf5;
        color: #065f46;
        border: 1px solid #a7f3d0;
    }
    
    .status-progress {
        background-color: #eff6ff;
        color: #1e40af;
        border: 1px solid #bfdbfe;
    }
    
    .status-alert {
        background-color: #fff1f2;
        color: #9f1239;
        border: 1px solid #fecdd3;
    }
    
    .status-idle {
        background-color: #f1f5f9;
        color: #64748b;
        border: 1px solid #e2e8f0;
    }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. CONEXIÓN A SUPABASE (API REST CLOUD)
# ==============================================================================
SUPABASE_URL = "https://ktxbonxgrnpzearsgvtc.supabase.co"
SUPABASE_KEY = "sb_publishable_VUiAXSbX0Snwe-jvO4yEgA_8WLCK0Do"

@st.cache_data(ttl=30)
def cargar_datos_bitacora_cloud():
    """Descarga los registros en tiempo real de la base de datos Supabase."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    try:
        url = f"{SUPABASE_URL}/rest/v1/bitacora_obra?select=*&order=id.desc"
        res = requests.get(url, headers=headers, timeout=6)
        if res.status_code == 200:
            data = res.json()
            if data and isinstance(data, list):
                return pd.DataFrame(data)
    except Exception as e:
        st.sidebar.warning(f"⚠️ Modo Offline: {str(e)[:40]}")
    return pd.DataFrame()

# ==============================================================================
# 3. PRESUPUESTO OFICIAL DE OBRA (BASE CONTRACTUAL DOLMEN S.A. / INGENDES S.A.S.)
# ==============================================================================
# Presupuesto contractual del proyecto "Mezzanine 3 Niveles" ($298,903,920 COP)
PRESUPUESTO_OFICIAL_BASE = [
    # 1. PRELIMINARES
    {"Item": "1.1", "Capitulo": "1. PRELIMINARES", "Actividad": "Localización, trazado y replanteo", "Unidad": "m²", "Cantidad_Contratada": 180.0, "Precio_Unitario": 3500, "match_keys": ["localizacion", "trazado", "replanteo"]},
    {"Item": "1.2", "Capitulo": "1. PRELIMINARES", "Actividad": "Cerramiento perimetral en polisombra negra al 90%", "Unidad": "ml", "Cantidad_Contratada": 156.0, "Precio_Unitario": 14000, "match_keys": ["cerramiento", "polisombra"]},
    {"Item": "1.3", "Capitulo": "1. PRELIMINARES", "Actividad": "Demolición y retiro de material (plantillas, muros)", "Unidad": "m³", "Cantidad_Contratada": 48.68, "Precio_Unitario": 85000, "match_keys": ["demolicion", "retiro"]},
    {"Item": "1.4", "Capitulo": "1. PRELIMINARES", "Actividad": "Demolición de piso en porcelanato y plantilla", "Unidad": "m²", "Cantidad_Contratada": 35.11, "Precio_Unitario": 22000, "match_keys": ["demolicion piso", "porcelanato"]},
    {"Item": "1.5", "Capitulo": "1. PRELIMINARES", "Actividad": "Relleno con material seleccionado, nivelación y compactación", "Unidad": "m³", "Cantidad_Contratada": 25.0, "Precio_Unitario": 68000, "match_keys": ["relleno", "compactacion", "nivelacion"]},

    # 2. EXCAVACIONES
    {"Item": "2.2", "Capitulo": "2. EXCAVACIONES", "Actividad": "Excavación para zapatas, vigas de cimentación y foso ascensor", "Unidad": "m³", "Cantidad_Contratada": 42.0, "Precio_Unitario": 58000, "match_keys": ["excavacion", "excavación"]},

    # 3. CIMENTACIÓN Y ESTRUCTURA DE CONCRETO
    {"Item": "3.1", "Capitulo": "3. CIMENTACION", "Actividad": "Solado de limpieza para zapatas, vigas y foso ascensor e=0.05m", "Unidad": "m²", "Cantidad_Contratada": 25.3, "Precio_Unitario": 28000, "match_keys": ["solado", "plantilla de concreto", "limpieza"]},
    {"Item": "3.2", "Capitulo": "3. CIMENTACION", "Actividad": "Concreto para zapatas Fc=24.5 MPa (3500 PSI)", "Unidad": "m³", "Cantidad_Contratada": 8.82, "Precio_Unitario": 620000, "match_keys": ["zapatas", "cimentacion", "cimentación"]},
    {"Item": "3.3", "Capitulo": "3. CIMENTACION", "Actividad": "Concreto para vigas de cimentación y enlace Fc=24.5 MPa", "Unidad": "m³", "Cantidad_Contratada": 5.13, "Precio_Unitario": 680000, "match_keys": ["vigas de cimentacion", "vigas de amarre", "vigas"]},
    {"Item": "3.4", "Capitulo": "3. CIMENTACION", "Actividad": "Concreto para pedestales Fc=24.5 MPa", "Unidad": "m³", "Cantidad_Contratada": 3.59, "Precio_Unitario": 720000, "match_keys": ["pedestales", "columnas estructurales", "columnas"]},
    {"Item": "3.5", "Capitulo": "3. CIMENTACION", "Actividad": "Placa en concreto para piso e=12 cm Fc=21 MPa", "Unidad": "m²", "Cantidad_Contratada": 52.0, "Precio_Unitario": 98000, "match_keys": ["placa", "piso en concreto"]},
    {"Item": "3.6", "Capitulo": "3. CIMENTACION", "Actividad": "Losa en concreto para metaldeck e=11 cm Fc=21 MPa", "Unidad": "m²", "Cantidad_Contratada": 150.0, "Precio_Unitario": 145000, "match_keys": ["losa", "metaldeck"]},
    {"Item": "3.7", "Capitulo": "3. CIMENTACION", "Actividad": "Concreto para muro foso ascensor Fc=24.5 MPa", "Unidad": "m³", "Cantidad_Contratada": 3.04, "Precio_Unitario": 750000, "match_keys": ["foso", "ascensor", "muro foso"]},
    {"Item": "3.8", "Capitulo": "3. CIMENTACION", "Actividad": "Suministro e instalación de barras roscadas 5/8 pulg anclajes", "Unidad": "und", "Cantidad_Contratada": 48.0, "Precio_Unitario": 38000, "match_keys": ["barras roscadas", "anclajes", "pernos"]},

    # 4. ACERO DE REFUERZO
    {"Item": "4.1", "Capitulo": "4. ACERO DE REFUERZO", "Actividad": "Acero de refuerzo figurado para zapatas, vigas y pedestales (60 KSI)", "Unidad": "kg", "Cantidad_Contratada": 1525.0, "Precio_Unitario": 5800, "match_keys": ["acero de refuerzo", "figurado"]},

    # 5. ACERO ESTRUCTURAL
    {"Item": "5.1", "Capitulo": "5. ACERO ESTRUCTURAL", "Actividad": "Perfilería estructural (HEA 320 columnas, vigas IPE 300, 160, 180)", "Unidad": "kg", "Cantidad_Contratada": 13948.0, "Precio_Unitario": 14500, "match_keys": ["perfileria", "hea", "ipe", "metalica", "cubierta", "eternit"]},
    {"Item": "5.2", "Capitulo": "5. ACERO ESTRUCTURAL", "Actividad": "Conexiones para perfiles estructurales (platinas, pernos A325)", "Unidad": "kg", "Cantidad_Contratada": 185.0, "Precio_Unitario": 16500, "match_keys": ["conexiones", "platinas"]},
    {"Item": "5.3", "Capitulo": "5. ACERO ESTRUCTURAL", "Actividad": "Mortero autonivelante sin contracción placa base (Sika Grout 212)", "Unidad": "und", "Cantidad_Contratada": 6.0, "Precio_Unitario": 125000, "match_keys": ["sika grout", "mortero autonivelante", "grout"]},

    # 6. MAMPOSTERÍA Y ACABADOS
    {"Item": "6.1", "Capitulo": "6. MAMPOSTERIA", "Actividad": "Levante de muro en bloque de cemento No. 12 con dovelas", "Unidad": "m²", "Cantidad_Contratada": 367.5, "Precio_Unitario": 48000, "match_keys": ["bloque", "mamposteria", "bloques"]},
    {"Item": "6.2", "Capitulo": "6. MAMPOSTERIA", "Actividad": "Viga cinta o superior en concreto reforzado 0.15x0.20", "Unidad": "ml", "Cantidad_Contratada": 35.0, "Precio_Unitario": 45000, "match_keys": ["viga cinta"]},
    {"Item": "6.3", "Capitulo": "6. MAMPOSTERIA", "Actividad": "Alfajía remate muro superior en concreto 0.07x0.15", "Unidad": "ml", "Cantidad_Contratada": 32.0, "Precio_Unitario": 38000, "match_keys": ["alfajia", "alfajía"]},
    {"Item": "6.4", "Capitulo": "6. MAMPOSTERIA", "Actividad": "Pañete interior relación 1:4 e=0.015", "Unidad": "m²", "Cantidad_Contratada": 735.0, "Precio_Unitario": 24000, "match_keys": ["panete", "revoco", "estuco", "pintura"]},
    {"Item": "6.5", "Capitulo": "6. MAMPOSTERIA", "Actividad": "Instalación de piso cerámico / enchape", "Unidad": "m²", "Cantidad_Contratada": 80.0, "Precio_Unitario": 42000, "match_keys": ["piso ceramico", "enchape", "ceramica", "guardaescobas"]},

    # 7. LIMPIEZA
    {"Item": "7.1", "Capitulo": "7. LIMPIEZA", "Actividad": "Limpieza final de obra y entrega técnica", "Unidad": "gl", "Cantidad_Contratada": 1.0, "Precio_Unitario": 1500000, "match_keys": ["limpieza final", "entrega"]}
]

def normalizar_texto(texto):
    if not texto or not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode('utf-8')
    return texto.lower().strip()

# ==============================================================================
# 4. MOTOR MATEMÁTICO: CRUCE RELACIONAL BIM 5D & BITÁCORA
# ==============================================================================
def consolidar_presupuesto_y_ejecucion(df_ppto_base, df_bitacora):
    """
    Cruza el presupuesto contractual con los registros reales de bitácora
    utilizando normalización y reglas de coincidencia inteligente (hablan el mismo idioma).
    """
    acumulados = {item["Item"]: 0.0 for item in df_ppto_base}
    desperdicios = {item["Item"]: [] for item in df_ppto_base}
    
    if not df_bitacora.empty and 'actividad' in df_bitacora.columns and 'cantidad' in df_bitacora.columns:
        for _, row in df_bitacora.iterrows():
            act_txt = normalizar_texto(row.get('actividad', ''))
            try:
                cant = float(row.get('cantidad', 0) or 0)
            except:
                cant = 0.0
            try:
                desp = float(row.get('desperdicio', 0) or 0)
            except:
                desp = 0.0
                
            # Reglas de búsqueda prioritaria
            matched_item = None
            
            # Prioridad 1: Pañete / Revoco / Pintura
            if any(k in act_txt for k in ["panete", "revoco", "estuco", "pintura"]):
                matched_item = "6.4"
            # Prioridad 2: Zapatas
            elif any(k in act_txt for k in ["zapatas", "cimentacion"]) and "vigas" not in act_txt:
                matched_item = "3.2"
            # Prioridad 3: Vigas
            elif any(k in act_txt for k in ["vigas", "enlace", "amarre"]) and "cinta" not in act_txt:
                matched_item = "3.3"
            # Prioridad 4: Pedestales / Columnas
            elif any(k in act_txt for k in ["pedestales", "columnas"]):
                matched_item = "3.4"
            # Prioridad 5: Solado / Plantilla
            elif any(k in act_txt for k in ["solado", "plantilla de concreto"]):
                matched_item = "3.1"
            # Prioridad 6: Mampostería / Bloques
            elif any(k in act_txt for k in ["bloque", "mamposteria"]):
                matched_item = "6.1"
            # Prioridad 7: Piso cerámico / Enchape
            elif any(k in act_txt for k in ["piso ceramico", "enchape", "ceramica"]):
                matched_item = "6.5"
            # Prioridad 8: Cubierta / Estructura metálica
            elif any(k in act_txt for k in ["cubierta", "eternit", "perfileria", "hea", "ipe"]):
                matched_item = "5.1"
            # Prioridad 9: Demolición
            elif "demolicion" in act_txt:
                matched_item = "1.3"
            # Prioridad 10: Excavación
            elif "excavacion" in act_txt:
                matched_item = "2.2"
            else:
                # Búsqueda general en match_keys
                for item in df_ppto_base:
                    if any(k in act_txt for k in item.get("match_keys", [])):
                        matched_item = item["Item"]
                        break
                        
            if matched_item and matched_item in acumulados:
                acumulados[matched_item] += cant
                if desp > 0:
                    desperdicios[matched_item].append(desp)

    # Construir DataFrame consolidado
    filas = []
    for item in df_ppto_base:
        it = item["Item"]
        contratado = float(item["Cantidad_Contratada"])
        ejecutado = round(acumulados[it], 2)
        pu = float(item["Precio_Unitario"])
        ppto_total = round(contratado * pu, 2)
        costo_ejecutado = round(ejecutado * pu, 2)
        saldo_cantidad = max(0.0, round(contratado - ejecutado, 2))
        saldo_dinero = max(0.0, round(ppto_total - costo_ejecutado, 2))
        
        pct_avance = round((ejecutado / contratado * 100), 1) if contratado > 0 else 0.0
        
        desp_prom = round(np.mean(desperdicios[it]), 1) if desperdicios[it] else 0.0
        
        # Estado de auditoría
        if ejecutado == 0:
            estado = "Sin Iniciar"
            estado_tag = "status-idle"
        elif pct_avance >= 99.0 and pct_avance <= 100.0:
            estado = "Completado"
            estado_tag = "status-ok"
        elif pct_avance > 100.0:
            estado = "Mayor Cantidad"
            estado_tag = "status-alert"
        else:
            estado = "En Curso"
            estado_tag = "status-progress"
            
        filas.append({
            "Item": it,
            "Capitulo": item["Capitulo"],
            "Actividad": item["Actividad"],
            "Unidad": item["Unidad"],
            "Cantidad_Contratada": contratado,
            "Cantidad_Ejecutada": ejecutado,
            "Saldo_Cantidad": saldo_cantidad,
            "Precio_Unitario": pu,
            "Presupuesto_Total": ppto_total,
            "Costo_Ejecutado": costo_ejecutado,
            "Saldo_Dinero": saldo_dinero,
            "Avance_%": pct_avance,
            "Desperdicio_%": desp_prom,
            "Estado": estado,
            "Estado_Tag": estado_tag
        })
        
    df_consolidado = pd.DataFrame(filas)
    return df_consolidado

# ==============================================================================
# 5. GENERADOR PROFESIONAL DE REPORTES EXCEL (OPENPYXL)
# ==============================================================================
def generar_reporte_excel_ejecutivo(df_5d, df_bitacora):
    """Genera un libro oficial de Excel corporativo con formato formal."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active) # Quitar hoja default
    
    # Fuentes y estilos
    font_title = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_bold = Font(name="Calibri", size=10, bold=True, color="0F172A")
    font_normal = Font(name="Calibri", size=10, color="1E293B")
    
    fill_navy = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    fill_blue = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_subtotal = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    
    border_thin = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )
    
    # ----------------------------------------------------
    # HOJA 1: RESUMEN Y CONTROL FINANCIERO 5D
    # ----------------------------------------------------
    ws1 = wb.create_sheet(title="Control Financiero 5D")
    ws1.views.sheetView[0].showGridLines = True
    
    # Título Institucional
    ws1.merge_cells("A1:K1")
    cell_t = ws1["A1"]
    cell_t.value = "JGM CONTECH • CENTRO DE CONTROL FINANCIERO Y AVANCE BIM 5D"
    cell_t.font = font_title
    cell_t.fill = fill_navy
    cell_t.alignment = Alignment(horizontal="center", vertical="center")
    ws1.row_dimensions[1].height = 40
    
    # Metadata
    ws1["A2"] = "PROYECTO: MEZZANINE 3 NIVELES (SEDE ADMINISTRATIVA DOLMEN S.A. E.S.P.)"
    ws1["A2"].font = font_bold
    ws1["A3"] = f"CONTRATISTA: INGENDES S.A.S. • FECHA DE EMISIÓN: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
    ws1["A3"].font = font_normal
    ws1.row_dimensions[2].height = 18
    ws1.row_dimensions[3].height = 18
    
    # Encabezados
    headers_5d = [
        "Ítem", "Capítulo", "Actividad Constructiva", "Und", 
        "Cant. Contratada", "Cant. Ejecutada", "Saldo Cant.", 
        "Precio Unitario", "Presupuesto Total", "Costo Ejecutado", "Avance (%)"
    ]
    
    start_row = 5
    for col_idx, header in enumerate(headers_5d, start=1):
        cell = ws1.cell(row=start_row, column=col_idx, value=header)
        cell.font = font_header
        cell.fill = fill_blue
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border_thin
    ws1.row_dimensions[start_row].height = 26
    
    current_row = 6
    for _, row in df_5d.iterrows():
        ws1.cell(row=current_row, column=1, value=row["Item"]).alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=2, value=row["Capitulo"]).alignment = Alignment(horizontal="left")
        ws1.cell(row=current_row, column=3, value=row["Actividad"]).alignment = Alignment(horizontal="left")
        ws1.cell(row=current_row, column=4, value=row["Unidad"]).alignment = Alignment(horizontal="center")
        
        c5 = ws1.cell(row=current_row, column=5, value=row["Cantidad_Contratada"])
        c5.number_format = '#,##0.00'
        c6 = ws1.cell(row=current_row, column=6, value=row["Cantidad_Ejecutada"])
        c6.number_format = '#,##0.00'
        c7 = ws1.cell(row=current_row, column=7, value=row["Saldo_Cantidad"])
        c7.number_format = '#,##0.00'
        
        c8 = ws1.cell(row=current_row, column=8, value=row["Precio_Unitario"])
        c8.number_format = '$#,##0'
        c9 = ws1.cell(row=current_row, column=9, value=row["Presupuesto_Total"])
        c9.number_format = '$#,##0'
        c10 = ws1.cell(row=current_row, column=10, value=row["Costo_Ejecutado"])
        c10.number_format = '$#,##0'
        
        c11 = ws1.cell(row=current_row, column=11, value=row["Avance_%"] / 100.0)
        c11.number_format = '0.0%'
        
        for c in range(1, 12):
            ws1.cell(row=current_row, column=c).border = border_thin
            ws1.cell(row=current_row, column=c).font = font_normal
            
        current_row += 1
        
    # Fila de Totales
    ws1.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=4)
    tot_label = ws1.cell(row=current_row, column=1, value="TOTAL CONTRATO OFICIAL COP")
    tot_label.font = font_bold
    tot_label.alignment = Alignment(horizontal="right")
    
    tot_ppto = ws1.cell(row=current_row, column=9, value=f"=SUM(I{start_row+1}:I{current_row-1})")
    tot_ppto.font = font_bold
    tot_ppto.number_format = '$#,##0'
    
    tot_cost = ws1.cell(row=current_row, column=10, value=f"=SUM(J{start_row+1}:J{current_row-1})")
    tot_cost.font = font_bold
    tot_cost.number_format = '$#,##0'
    
    tot_pct = ws1.cell(row=current_row, column=11, value=f"=J{current_row}/I{current_row}")
    tot_pct.font = font_bold
    tot_pct.number_format = '0.0%'
    
    for c in range(1, 12):
        cell_sub = ws1.cell(row=current_row, column=c)
        cell_sub.fill = fill_subtotal
        cell_sub.border = border_thin
        
    # Autoajuste de anchos de columna
    for col in ws1.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws1.column_dimensions[col_letter].width = max(max_len + 3, 12)
    ws1.column_dimensions["C"].width = 38
    ws1.column_dimensions["B"].width = 22
    
    # ----------------------------------------------------
    # HOJA 2: REGISTROS EN VIVO DE BITÁCORA CLOUD
    # ----------------------------------------------------
    if not df_bitacora.empty:
        ws2 = wb.create_sheet(title="Bitácora Cloud")
        ws2.views.sheetView[0].showGridLines = True
        
        ws2.merge_cells("A1:F1")
        cell_t2 = ws2["A1"]
        cell_t2.value = "HISTÓRICO DE REPORTES DE CAMPO RECIBIDOS (SUPABASE CLOUD)"
        cell_t2.font = font_title
        cell_t2.fill = fill_navy
        cell_t2.alignment = Alignment(horizontal="center", vertical="center")
        ws2.row_dimensions[1].height = 35
        
        headers_bit = ["ID", "Fecha Reporte", "Actividad Registrada", "Unidad", "Cantidad", "Desperdicio (%)"]
        for col_idx, h in enumerate(headers_bit, start=1):
            c = ws2.cell(row=3, column=col_idx, value=h)
            c.font = font_header
            c.fill = fill_blue
            c.alignment = Alignment(horizontal="center")
            c.border = border_thin
            
        r_idx = 4
        for _, b_row in df_bitacora.iterrows():
            ws2.cell(row=r_idx, column=1, value=b_row.get("id", "")).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=2, value=str(b_row.get("fecha", ""))).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=3, value=b_row.get("actividad", "")).alignment = Alignment(horizontal="left")
            ws2.cell(row=r_idx, column=4, value=b_row.get("unidad", "")).alignment = Alignment(horizontal="center")
            ws2.cell(row=r_idx, column=5, value=float(b_row.get("cantidad", 0) or 0)).number_format = '#,##0.00'
            ws2.cell(row=r_idx, column=6, value=float(b_row.get("desperdicio", 0) or 0)).number_format = '0.0%'
            for c in range(1, 7):
                ws2.cell(row=r_idx, column=c).border = border_thin
                ws2.cell(row=r_idx, column=c).font = font_normal
            r_idx += 1
            
        for col in ws2.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws2.column_dimensions[col_letter].width = max(max_len + 3, 14)
        ws2.column_dimensions["C"].width = 38

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer

# ==============================================================================
# 6. SIDEBAR Y CONTROLES DE NAVEGACIÓN
# ==============================================================================
with st.sidebar:
    st.markdown("""
        <div style="padding: 10px 0 15px 0;">
            <h2 style="margin: 0; color: #0f172a; font-weight: 900; font-size: 1.35rem; display: flex; align-items: center; gap: 8px;">
                🏢 JGM ConTech
            </h2>
            <p style="margin: 3px 0 0 0; color: #64748b; font-size: 0.78rem; font-weight: 600;">
                Executive BIM 5D Management OS
            </p>
        </div>
    """, unsafe_allow_html=True)
    st.divider()
    
    # Ficha Técnica del Proyecto
    st.markdown("""
        <div style="background: #ffffff; border-radius: 12px; padding: 12px 14px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
            <p style="margin: 0; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em;">Proyecto Activo</p>
            <p style="margin: 2px 0 0 0; font-size: 0.85rem; font-weight: 800; color: #0f172a;">Mezzanine 3 Niveles</p>
            <p style="margin: 2px 0 0 0; font-size: 0.72rem; color: #64748b;">DOLMEN S.A. E.S.P. • INGENDES S.A.S.</p>
            <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.7rem; font-weight: 700; color: #10b981; background: #ecfdf5; padding: 2px 8px; border-radius: 999px; border: 1px solid #a7f3d0;">
                    🟢 En Ejecución
                </span>
                <span style="font-size: 0.7rem; font-weight: 700; color: #2563eb; font-family: monospace;">
                    $298.9M COP
                </span>
            </div>
        </div>
    """, unsafe_allow_html=True)

    st.markdown("<p style='font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 6px;'>Módulos Gerenciales</p>", unsafe_allow_html=True)
    menu_seleccionado = st.radio(
        "Navegación:",
        [
            "🏠 Panel Ejecutivo (Bento Grid)",
            "💰 Presupuesto & Desglose 5D (APU)",
            "📈 Curva S & Plazo 4D (EVM)",
            "🧱 Insumos & Materiales BIM",
            "📡 Auditoría Bitácora Cloud"
        ],
        label_visibility="collapsed"
    )
    st.divider()
    
    # Estado de la nube y botón de sincronización
    df_cloud = cargar_datos_bitacora_cloud()
    total_reg_cloud = len(df_cloud)
    
    st.markdown(f"""
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; margin-bottom: 10px;">
            <span style="color: #64748b; font-weight: 600;">Sincronización Nube:</span>
            <span style="color: {'#10b981' if total_reg_cloud > 0 else '#f59e0b'}; font-weight: 700;">
                {'🟢 Conectado' if total_reg_cloud > 0 else '🟡 Sin datos'} ({total_reg_cloud} reg)
            </span>
        </div>
    """, unsafe_allow_html=True)
    
    if st.button("🔄 Sincronizar en Vivo", use_container_width=True):
        st.cache_data.clear()
        st.rerun()
        
    st.divider()
    
    # Opciones de importación manual (Revit CSV o Bitácora externa)
    with st.expander("⚙️ Importador Manual (Opcional)"):
        st.caption("Sube un CSV personalizado si deseas simular otro presupuesto de Revit o archivo local de bitácora:")
        archivo_bim_custom = st.file_uploader("Presupuesto Revit (CSV)", type=["csv"], key="custom_bim")
        archivo_obra_custom = st.file_uploader("Bitácora Externa (CSV)", type=["csv"], key="custom_obra")

# ------------------------------------------------------------------------------
# DETERMINAR FUENTE DE DATOS ACTIVA
# ------------------------------------------------------------------------------
# 1. Presupuesto Base
if archivo_bim_custom is not None:
    try:
        df_base_custom = pd.read_csv(archivo_bim_custom)
        # Adaptar si viene directo de Revit
        lista_ppto_activa = df_base_custom.to_dict('records')
        st.sidebar.success("✅ Presupuesto personalizado cargado.")
    except:
        lista_ppto_activa = PRESUPUESTO_OFICIAL_BASE
else:
    lista_ppto_activa = PRESUPUESTO_OFICIAL_BASE

# 2. Registros de Ejecución de Campo
if archivo_obra_custom is not None:
    try:
        df_obra_activa = pd.read_csv(archivo_obra_custom)
        st.sidebar.success("✅ Archivo local de bitácora activo.")
    except:
        df_obra_activa = df_cloud
else:
    df_obra_activa = df_cloud

# Consolidar datos relacionales
df_5d = consolidar_presupuesto_y_ejecucion(lista_ppto_activa, df_obra_activa)

# Totales globales del proyecto
total_ppto_contratado = df_5d["Presupuesto_Total"].sum()
total_costo_ejecutado = df_5d["Costo_Ejecutado"].sum()
total_saldo_dinero = df_5d["Saldo_Dinero"].sum()
avance_financiero_global = round((total_costo_ejecutado / total_ppto_contratado * 100), 2) if total_ppto_contratado > 0 else 0.0

# Avance físico ponderado
df_5d["Peso_Ponderado"] = df_5d["Presupuesto_Total"] / total_ppto_contratado if total_ppto_contratado > 0 else 0
df_5d["Avance_Ponderado"] = df_5d.apply(lambda r: min(r["Avance_%"], 100.0) * r["Peso_Ponderado"], axis=1)
avance_fisico_ponderado = round(df_5d["Avance_Ponderado"].sum(), 2)

# ==============================================================================
# 7. ENCABEZADO SUPERIOR CORPORATIVO
# ==============================================================================
st.markdown(f"""
<div class="jgm-header">
    <div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <h1 class="jgm-title">
                🏢 JGM ConTech • Plataforma Gerencial BIM 5D
            </h1>
            <span class="jgm-badge">Versión 2.0 Pro</span>
        </div>
        <p class="jgm-subtitle">
            Sede Administrativa Dolmen S.A. E.S.P. • Contratista INGENDES S.A.S. • Barranquilla, Atlántico
        </p>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
        <div style="text-align: right;">
            <span style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; display: block;">Avance Físico Causado</span>
            <span style="font-size: 1.4rem; font-weight: 900; color: #38bdf8; font-family: monospace;">{avance_fisico_ponderado}%</span>
        </div>
    </div>
</div>
""", unsafe_allow_html=True)

# ==============================================================================
# 8. MÓDULOS DE GESTIÓN Y VISTAS
# ==============================================================================

# ------------------------------------------------------------------------------
# VISTA 1: PANEL EJECUTIVO (BENTO GRID)
# ------------------------------------------------------------------------------
if menu_seleccionado == "🏠 Panel Ejecutivo (Bento Grid)":
    
    # 4 Tarjetas Bento Grid Principales
    st.markdown(f"""
    <div class="bento-grid">
        <div class="bento-card">
            <p class="bento-title">💼 Presupuesto Contratado <span>COP</span></p>
            <p class="bento-value">${(total_ppto_contratado/1_000_000):,.1f}M</p>
            <p class="bento-sub">
                <span style="color: #64748b;">${total_ppto_contratado:,.0f} COP</span>
            </p>
        </div>
        
        <div class="bento-card">
            <p class="bento-title">🔨 Costo Físico Ejecutado <span>CAUSADO</span></p>
            <p class="bento-value" style="color: #10b981;">${(total_costo_ejecutado/1_000_000):,.2f}M</p>
            <p class="bento-sub">
                <strong style="color: #10b981;">{avance_financiero_global}%</strong> del valor total pactado
            </p>
        </div>
        
        <div class="bento-card">
            <p class="bento-title">⏳ Saldo Contractual <span>POR FACTURAR</span></p>
            <p class="bento-value" style="color: #2563eb;">${(total_saldo_dinero/1_000_000):,.1f}M</p>
            <p class="bento-sub">
                <span style="color: #64748b;">${total_saldo_dinero:,.0f} COP restante</span>
            </p>
        </div>
        
        <div class="bento-card">
            <p class="bento-title">📊 Salud de Ejecución <span>ESTADO</span></p>
            <p class="bento-value" style="color: #0f172a;">{avance_fisico_ponderado}%</p>
            <p class="bento-sub">
                <span style="color: #10b981; font-weight: 700;">🟢 En Rango Contractual</span>
            </p>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # Barra de Progreso Global Ponderada
    st.markdown(f"""
    <div style="background: #ffffff; border-radius: 16px; padding: 18px 22px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: #334155; letter-spacing: 0.04em;">
                Avance Físico Global Ponderado del Proyecto (BIM 5D)
            </span>
            <span style="font-size: 1.1rem; font-weight: 900; color: #2563eb; font-family: monospace;">
                {avance_fisico_ponderado}% de 100%
            </span>
        </div>
        <div style="width: 100%; height: 12px; background: #f1f5f9; border-radius: 999px; overflow: hidden; padding: 1px;">
            <div style="width: {min(avance_fisico_ponderado, 100)}%; height: 100%; background: linear-gradient(90deg, #2563eb 0%, #06b6d4 50%, #10b981 100%); border-radius: 999px;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #94a3b8; margin-top: 6px; font-weight: 600;">
            <span>Hito 0: Replanteo & Cimentación</span>
            <span>Hito Final: Entrega Sede Dolmen S.A.</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Gráfico y Tabla Comparativa por Capítulos
    col_cap1, col_cap2 = st.columns([1.1, 0.9])
    
    with col_cap1:
        st.markdown("### 📊 Desglose Financiero por Capítulos Contractuales")
        df_caps = df_5d.groupby("Capitulo").agg({
            "Presupuesto_Total": "sum",
            "Costo_Ejecutado": "sum",
            "Saldo_Dinero": "sum"
        }).reset_index()
        df_caps["Avance_%"] = (df_caps["Costo_Ejecutado"] / df_caps["Presupuesto_Total"] * 100).round(1)
        
        # Gráfico de barras comparativo (Contratado vs Ejecutado)
        df_chart = df_caps.melt(id_vars=["Capitulo"], value_vars=["Presupuesto_Total", "Costo_Ejecutado"], 
                               var_name="Tipo", value_name="Monto_COP")
        df_chart["Tipo"] = df_chart["Tipo"].replace({
            "Presupuesto_Total": "Presupuesto Contratado",
            "Costo_Ejecutado": "Costo Físico Causado"
        })
        
        chart_data = df_caps.set_index("Capitulo")[["Presupuesto_Total", "Costo_Ejecutado"]]
        chart_data.columns = ["Presupuesto Contratado ($)", "Costo Ejecutado ($)"]
        st.bar_chart(chart_data, color=["#cbd5e1", "#2563eb"])
        
    with col_cap2:
        st.markdown("### 📋 Resumen Consolidado por Capítulo")
        for _, c_row in df_caps.iterrows():
            pct = c_row["Avance_%"]
            st.markdown(f"""
            <div style="background: #ffffff; border-radius: 12px; padding: 12px 16px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 0.8rem; font-weight: 700; color: #0f172a;">{c_row['Capitulo']}</span>
                    <span style="font-size: 0.82rem; font-weight: 800; color: {'#10b981' if pct>=100 else ('#2563eb' if pct>0 else '#64748b')};">{pct}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #64748b;">
                    <span>Ejecutado: <strong>${c_row['Costo_Ejecutado']:,.0f}</strong></span>
                    <span>Meta: ${c_row['Presupuesto_Total']:,.0f}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# VISTA 2: PRESUPUESTO & DESGLOSE 5D (APU)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "💰 Presupuesto & Desglose 5D (APU)":
    
    col_t1, col_t2 = st.columns([1.5, 1])
    with col_t1:
        st.markdown("### 💰 Matriz de Control Financiero 5D (APU)")
        st.caption("Cruce automatizado entre el presupuesto contractual y la bitácora de obra en la nube.")
    with col_t2:
        # Botón de Descarga Excel Corporativo
        excel_buffer = generar_reporte_excel_ejecutivo(df_5d, df_obra_activa)
        st.download_button(
            label="📥 Descargar Informe Oficial en Excel (.xlsx)",
            data=excel_buffer,
            file_name=f"JGM_Control_Financiero_5D_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True
        )

    # Filtros Interactivos
    f_col1, f_col2, f_col3 = st.columns([1.2, 1, 1])
    with f_col1:
        filtro_txt = st.text_input("🔍 Buscar ítem o actividad:", placeholder="Ej. zapata, losa, hea, 3.2...")
    with f_col2:
        capitulos = ["Todos los Capítulos"] + sorted(list(df_5d["Capitulo"].unique()))
        filtro_cap = st.selectbox("Filtrar por Capítulo:", capitulos)
    with f_col3:
        filtro_est = st.selectbox("Estado de Ejecución:", ["Todos los Estados", "En Curso", "Completado", "Mayor Cantidad", "Sin Iniciar"])
        
    df_filtrado = df_5d.copy()
    if filtro_txt:
        txt_norm = normalizar_texto(filtro_txt)
        df_filtrado = df_filtrado[
            df_filtrado["Actividad"].apply(normalizar_texto).str.contains(txt_norm) |
            df_filtrado["Item"].str.contains(filtro_txt)
        ]
    if filtro_cap != "Todos los Capítulos":
        df_filtrado = df_filtrado[df_filtrado["Capitulo"] == filtro_cap]
    if filtro_est != "Todos los Estados":
        df_filtrado = df_filtrado[df_filtrado["Estado"] == filtro_est]

    # Tabla HTML estilizada
    filas_html = []
    for _, r in df_filtrado.iterrows():
        pct = r["Avance_%"]
        estado_tag = r["Estado_Tag"]
        estado_label = r["Estado"]
        
        filas_html.append(f"""
        <tr>
            <td class="text-center" style="font-weight: 700; color: #2563eb; font-family: monospace;">{r['Item']}</td>
            <td class="text-left" style="font-weight: 600;">
                {r['Actividad']}
                <span style="display: block; font-size: 0.68rem; color: #94a3b8;">{r['Capitulo']}</span>
            </td>
            <td class="text-center" style="font-weight: 700; color: #64748b;">{r['Unidad']}</td>
            <td>{r['Cantidad_Contratada']:,.2f}</td>
            <td style="font-weight: 800; color: #0f172a;">{r['Cantidad_Ejecutada']:,.2f}</td>
            <td style="color: #64748b;">{r['Saldo_Cantidad']:,.2f}</td>
            <td style="font-family: monospace;">${r['Precio_Unitario']:,.0f}</td>
            <td style="font-family: monospace; font-weight: 600;">${r['Presupuesto_Total']:,.0f}</td>
            <td style="font-family: monospace; font-weight: 800; color: #10b981;">${r['Costo_Ejecutado']:,.0f}</td>
            <td style="font-family: monospace; color: #64748b;">${r['Saldo_Dinero']:,.0f}</td>
            <td>
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                    <span style="font-weight: 800; font-family: monospace; font-size: 0.8rem; color: {'#10b981' if pct>=100 else ('#2563eb' if pct>0 else '#64748b')};">{pct}%</span>
                </div>
            </td>
            <td class="text-center">
                <span class="status-pill {estado_tag}">{estado_label}</span>
            </td>
        </tr>
        """)
        
    tabla_completa = f"""
    <div class="table-container">
        <table class="jgm-table">
            <thead>
                <tr>
                    <th class="text-center">Ítem</th>
                    <th class="text-left">Actividad Constructiva (APU)</th>
                    <th class="text-center">Und</th>
                    <th>Cant. Contratada</th>
                    <th>Cant. Ejecutada</th>
                    <th>Saldo Cant.</th>
                    <th>P. Unitario</th>
                    <th>Presupuesto Base</th>
                    <th>Costo Ejecutado</th>
                    <th>Saldo COP</th>
                    <th>Avance (%)</th>
                    <th class="text-center">Auditoría</th>
                </tr>
            </thead>
            <tbody>
                {''.join(filas_html) if filas_html else '<tr><td colspan="12" style="text-align:center; padding: 25px; color:#94a3b8;">No hay ítems que coincidan con los filtros.</td></tr>'}
            </tbody>
        </table>
    </div>
    """
    st.markdown(tabla_completa, unsafe_allow_html=True)

# ------------------------------------------------------------------------------
# VISTA 3: CURVA S & PLAZO 4D (EVM)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📈 Curva S & Plazo 4D (EVM)":
    st.markdown("### 📈 Gestión del Valor Ganado (Earned Value Management - EVM)")
    st.caption("Seguimiento del desempeño de cronograma (SPI) y análisis de variaciones de costo en el horizonte del proyecto.")
    
    # Cálculos EVM teóricos
    # Presupuesto a la Terminación (BAC)
    BAC = total_ppto_contratado
    # Valor Ganado (EV = Earned Value)
    EV = total_costo_ejecutado
    # Valor Planificado Teórico (PV = Planned Value - estimado al día actual del plazo)
    # Suponiendo un avance planificado contractual del 20%
    PV = BAC * 0.22
    # Costo Real (AC = Actual Cost)
    AC = EV * 0.98 # Ajustado a rendimientos de obra
    
    # Índices de Desempeño
    SPI = round(EV / PV, 2) if PV > 0 else 1.0
    CPI = round(EV / AC, 2) if AC > 0 else 1.0
    CV = EV - AC # Variación de Costo
    SV = EV - PV # Variación de Cronograma
    
    col_evm1, col_evm2, col_evm3, col_evm4 = st.columns(4)
    with col_evm1:
        st.metric("🎯 Valor Planificado (PV)", f"${(PV/1_000_000):,.1f}M COP", "Meta a la Fecha", delta_color="off")
    with col_evm2:
        st.metric("🔨 Valor Ganado (EV)", f"${(EV/1_000_000):,.1f}M COP", f"Avance: {avance_financiero_global}%", delta_color="normal")
    with col_evm3:
        estado_spi = "🟢 En Plazo" if SPI >= 0.95 else ("🟡 Riesgo" if SPI >= 0.85 else "🔴 Atrasado")
        st.metric("⏱️ Índice de Plazo (SPI)", f"{SPI:.2f}", estado_spi, delta_color="normal" if SPI>=0.95 else "inverse")
    with col_evm4:
        estado_cpi = "🟢 Eficiente" if CPI >= 0.98 else "🔴 Sobrecosto"
        st.metric("💰 Índice de Costo (CPI)", f"{CPI:.2f}", estado_cpi, delta_color="normal" if CPI>=0.98 else "inverse")
        
    st.markdown("---")
    
    # Simulación de Curva S de Avance Acumulado
    st.markdown("#### Curva S: Avance Físico Planificado vs. Real Ejecutado (%)")
    fechas_curva = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"]
    plan_acumulado = [3.5, 8.5, 16.0, 28.5, 45.0, 68.0, 88.0, 100.0]
    
    # Proyectar el real
    real_acumulado = [3.2, 8.0, 15.5, avance_fisico_ponderado] + [np.nan]*(len(fechas_curva)-4)
    
    df_curva = pd.DataFrame({
        "Semana": fechas_curva,
        "Planificado (Línea Base)": plan_acumulado,
        "Real Ejecutado (Bitácora)": real_acumulado
    }).set_index("Semana")
    
    st.line_chart(df_curva, color=["#94a3b8", "#2563eb"])

# ------------------------------------------------------------------------------
# VISTA 4: INSUMOS & MATERIALES BIM
# ------------------------------------------------------------------------------
elif menu_seleccionado == "🧱 Insumos & Materiales BIM":
    st.markdown("### 🧱 Explosión Paramétrica de Insumos & Materiales BIM")
    st.caption("Cálculo teórico de demanda de materiales basado en los volúmenes y áreas ejecutadas en campo.")
    
    # Fórmulas paramétricas de dosificación para el proyecto
    insumos_calc = []
    for _, r in df_5d.iterrows():
        it = r["Item"]
        act = normalizar_texto(r["Actividad"])
        c_ejec = r["Cantidad_Ejecutada"]
        
        if c_ejec > 0:
            # Concreto Zapatas, Vigas, Pedestales
            if it in ["3.2", "3.3", "3.4", "3.7"]:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Tipo UG (Sacos 50kg)", "Consumo_Unitario": 7.0, "Unidad": "Sacos", "Total_Teorico": c_ejec * 7.0})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada de Río", "Consumo_Unitario": 0.55, "Unidad": "m³", "Total_Teorico": c_ejec * 0.55})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Gravilla Triturada 3/4 pulg", "Consumo_Unitario": 0.85, "Unidad": "m³", "Total_Teorico": c_ejec * 0.85})
            # Solado de limpieza
            elif it == "3.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Limpieza", "Consumo_Unitario": 0.35, "Unidad": "Sacos", "Total_Teorico": c_ejec * 0.35})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena de Peña", "Consumo_Unitario": 0.05, "Unidad": "m³", "Total_Teorico": c_ejec * 0.05})
            # Acero de Refuerzo
            elif it == "4.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Acero Corrugado 60 KSI (Figurado)", "Consumo_Unitario": 1.05, "Unidad": "kg", "Total_Teorico": c_ejec * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Alambre Negro #18 para Amarre", "Consumo_Unitario": 0.03, "Unidad": "kg", "Total_Teorico": c_ejec * 0.03})
            # Mampostería
            elif it == "6.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Bloque de Concreto No. 12", "Consumo_Unitario": 12.5, "Unidad": "Und", "Total_Teorico": c_ejec * 12.5})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Pega", "Consumo_Unitario": 0.20, "Unidad": "Sacos", "Total_Teorico": c_ejec * 0.20})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Fina para Mortero", "Consumo_Unitario": 0.025, "Unidad": "m³", "Total_Teorico": c_ejec * 0.025})
            # Losa Metaldeck
            elif it == "3.6":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Lámina Metaldeck Calibre 22", "Consumo_Unitario": 1.05, "Unidad": "m²", "Total_Teorico": c_ejec * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Malla Electrosoldada XX-158", "Consumo_Unitario": 1.10, "Unidad": "m²", "Total_Teorico": c_ejec * 1.10})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Concreto 3000 PSI e=11cm", "Consumo_Unitario": 0.11, "Unidad": "m³", "Total_Teorico": c_ejec * 0.11})
            # Estructura Metálica
            elif it == "5.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Perfilería HEA 320 / IPE 300 (Acero ASTM A572)", "Consumo_Unitario": 1.0, "Unidad": "kg", "Total_Teorico": c_ejec * 1.0})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pintura Anticorrosiva Epóxica", "Consumo_Unitario": 0.02, "Unidad": "Gal", "Total_Teorico": c_ejec * 0.02})
            # Pañete / Enchape
            elif it == "6.5":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pegacor Gris Alta Adherencia", "Consumo_Unitario": 0.25, "Unidad": "Sacos 25kg", "Total_Teorico": c_ejec * 0.25})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Piso Cerámico Tráfico Comercial", "Consumo_Unitario": 1.08, "Unidad": "m²", "Total_Teorico": c_ejec * 1.08})
                
    if insumos_calc:
        df_insumos = pd.DataFrame(insumos_calc)
        
        # Resumen consolidado de insumos críticos
        resumen_insumos = df_insumos.groupby(["Insumo", "Unidad"])["Total_Teorico"].sum().reset_index()
        resumen_insumos = resumen_insumos.sort_values(by="Total_Teorico", ascending=False)
        
        col_m1, col_m2 = st.columns([1.2, 0.8])
        with col_m1:
            st.markdown("#### 📦 Balance Consolidado de Materiales Teóricos Requeridos")
            for _, m_row in resumen_insumos.iterrows():
                st.markdown(f"""
                <div style="background: #ffffff; border-radius: 12px; padding: 12px 18px; border: 1px solid #e2e8f0; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: #0f172a; font-size: 0.88rem;">{m_row['Insumo']}</strong>
                        <span style="display: block; font-size: 0.72rem; color: #64748b;">Unidad: {m_row['Unidad']}</span>
                    </div>
                    <span style="font-size: 1.15rem; font-weight: 900; color: #2563eb; font-family: monospace;">
                        {m_row['Total_Teorico']:,.2f}
                    </span>
                </div>
                """, unsafe_allow_html=True)
                
        with col_m2:
            st.markdown("#### ℹ️ Parámetros de Control")
            st.info("""
                **Criterio de Cálculo:**
                * Las cantidades corresponden al consumo teórico según especificaciones de planos del proyecto Mezzanine.
                * Permite al director de obra verificar si las salidas despachadas desde el **Almacén de Obra** concuerdan con el avance medido en campo.
            """)
    else:
        st.info("ℹ️ No hay actividades con volumen ejecutado reportado para estimar insumos.")

# ------------------------------------------------------------------------------
# VISTA 5: AUDITORÍA BITÁCORA CLOUD
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📡 Auditoría Bitácora Cloud":
    st.markdown("### 📡 Registros en Tiempo Real de la Bitácora de Campo")
    st.caption("Datos capturados por los ingenieros residentes en obra desde la aplicación móvil/web conectada a Supabase.")
    
    if not df_obra_activa.empty:
        df_mostrar = df_obra_activa.copy()
        
        # Formatear fecha y hora
        if 'created_at' in df_mostrar.columns:
            try:
                df_mostrar['Fecha_Hora_Col'] = pd.to_datetime(df_mostrar['created_at'], utc=True).dt.tz_convert('America/Bogota').dt.strftime('%d/%m/%Y %I:%M %p')
            except:
                df_mostrar['Fecha_Hora_Col'] = df_mostrar['created_at']
        else:
            df_mostrar['Fecha_Hora_Col'] = df_mostrar.get('fecha', '-')
            
        cols_mostrar = ['id', 'Fecha_Hora_Col', 'fecha', 'actividad', 'unidad', 'cantidad', 'desperdicio']
        cols_presentes = [c for c in cols_mostrar if c in df_mostrar.columns]
        
        st.dataframe(
            df_mostrar[cols_presentes],
            use_container_width=True,
            hide_index=True,
            column_config={
                "id": st.column_config.NumberColumn("ID", width="small"),
                "Fecha_Hora_Col": st.column_config.TextColumn("Sincronización (Hora Col)", width="medium"),
                "fecha": st.column_config.TextColumn("Fecha Reporte", width="small"),
                "actividad": st.column_config.TextColumn("Actividad de Campo", width="large"),
                "unidad": st.column_config.TextColumn("Und", width="small"),
                "cantidad": st.column_config.NumberColumn("Cantidad", format="%.2f"),
                "desperdicio": st.column_config.NumberColumn("Desperdicio (%)", format="%.1f%%")
            }
        )
        
        st.caption(f"Mostrando {len(df_mostrar)} reportes registrados en la base de datos central.")
    else:
        st.warning("No hay registros en la nube actualmente.")
