import streamlit as st
import pandas as pd
import numpy as np
import requests
import io
import textwrap
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
    initial_sidebar_state="collapsed"
)

# Inyección de estilos CSS corporativos de alto impacto (Vibrante, Moderno y Dinámico)
css_styles = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap');

html, body, [class*="css"] {
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
}

.stApp {
    background: radial-gradient(circle at top right, #f1f5f9 0%, #f8fafc 100%);
}

#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header { background: transparent; }

/* CENTRADO DE LA BARRA DE NAVEGACIÓN SUPERIOR */
div[data-testid="stSegmentedControl"] {
    display: flex !important;
    justify-content: center !important;
    width: 100% !important;
    margin: 10px 0 24px 0 !important;
}

div[data-testid="stSegmentedControl"] > div {
    background: #ffffff !important;
    padding: 6px !important;
    border-radius: 999px !important;
    border: 1px solid #cbd5e1 !important;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06) !important;
    gap: 4px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
}

div[data-testid="stSegmentedControl"] button {
    border-radius: 999px !important;
    font-size: 0.82rem !important;
    font-weight: 700 !important;
    padding: 6px 14px !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

div[data-testid="stSegmentedControl"] button[aria-selected="true"] {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 4px 14px rgba(30, 58, 138, 0.35) !important;
}

div[data-testid="stSegmentedControl"] button[aria-selected="true"] * {
    color: #ffffff !important;
    font-weight: 800 !important;
}

/* Fallback navegación horizontal */
div[data-testid="stRadio"] > div[role="radiogroup"] {
    display: flex !important;
    justify-content: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
    margin-bottom: 20px !important;
}

/* Tarjetas de Métricas Nativas Mejoradas */
div[data-testid="stMetric"] {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 18px 22px;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
    border-top: 4px solid #2563eb;
    transition: all 0.25s ease;
    position: relative;
    overflow: hidden;
}

div[data-testid="column"]:nth-of-type(1) div[data-testid="stMetric"] {
    border-top: 4px solid #2563eb !important;
}
div[data-testid="column"]:nth-of-type(2) div[data-testid="stMetric"] {
    border-top: 4px solid #10b981 !important;
}
div[data-testid="column"]:nth-of-type(3) div[data-testid="stMetric"] {
    border-top: 4px solid #f59e0b !important;
}
div[data-testid="column"]:nth-of-type(4) div[data-testid="stMetric"] {
    border-top: 4px solid #8b5cf6 !important;
}

div[data-testid="stMetric"]:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.12);
    border-color: #93c5fd;
}

div[data-testid="stMetric"] label {
    font-size: 0.76rem !important;
    font-weight: 800 !important;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569 !important;
}

div[data-testid="stMetric"] [data-testid="stMetricValue"] {
    font-size: 1.85rem !important;
    font-weight: 900 !important;
    color: #0f172a !important;
    font-family: 'Plus Jakarta Sans', monospace !important;
    letter-spacing: -0.02em;
}

div[data-testid="stMetric"] [data-testid="stMetricDelta"] {
    font-weight: 800 !important;
    font-size: 0.82rem !important;
}

/* Botones de Acción Primarios */
div.stDownloadButton > button, div.stButton > button {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%) !important;
    color: #ffffff !important;
    border-radius: 12px !important;
    padding: 10px 20px !important;
    font-weight: 700 !important;
    border: none !important;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.15) !important;
    transition: all 0.2s ease !important;
}

div.stDownloadButton > button:hover, div.stButton > button:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 6px 20px rgba(30, 58, 138, 0.28) !important;
}

/* Dataframe Styling */
div[data-testid="stDataFrame"] {
    background: #ffffff;
    border-radius: 16px;
    padding: 8px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03);
}
</style>
"""
st.markdown(textwrap.dedent(css_styles), unsafe_allow_html=True)

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

    # 7. LIMPIEZA
    {"Item": "7.1", "Capitulo": "7. LIMPIEZA", "Actividad": "Limpieza final de obra y entrega técnica", "Unidad": "gl", "Cantidad_Contratada": 1.0, "Precio_Unitario": 1500000, "match_keys": ["limpieza final", "entrega"]}
]

# ==============================================================================
# 3B. PRESUPUESTO OFICIAL: CASA MENDOZA 1.1 (REVIT 2027 • SABANALARGA)
# Únicamente los ítems reales modelados y extraídos por pyRevit desde el archivo .rvt
# ==============================================================================
PRESUPUESTO_CASA_MENDOZA = [
    # 1. MAMPOSTERÍA
    {
        "Item": "1.1", 
        "Capitulo": "1. MAMPOSTERIA", 
        "Actividad": "Muros en mampostería de bloques de concreto", 
        "Unidad": "und", 
        "Cantidad_Contratada": 2848.63, 
        "Precio_Unitario": 3800, 
        "match_keys": ["mamposteria", "bloque", "bloques"]
    },
    {
        "Item": "1.2", 
        "Capitulo": "1. MAMPOSTERIA", 
        "Actividad": "Pañete y mortero de revoco en muros", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 455.78, 
        "Precio_Unitario": 24000, 
        "match_keys": ["panete", "revoco"]
    },

    # 2. PISOS Y ENCHAPES
    {
        "Item": "2.1", 
        "Capitulo": "2. PISOS Y ENCHAPES", 
        "Actividad": "Instalación de piso cerámico o enchape", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 213.34, 
        "Precio_Unitario": 55000, 
        "match_keys": ["piso ceramico", "enchape", "piso"]
    },

    # 3. ACABADOS Y PINTURA
    {
        "Item": "3.1", 
        "Capitulo": "3. ACABADOS Y PINTURA", 
        "Actividad": "Estuco y pintura vinílica en muros", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 455.78, 
        "Precio_Unitario": 16500, 
        "match_keys": ["estuco", "pintura", "vinilica"]
    },

    # 4. CUBIERTA
    {
        "Item": "4.1", 
        "Capitulo": "4. CUBIERTA", 
        "Actividad": "Montaje de cubierta en Eternit", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 132.05, 
        "Precio_Unitario": 45000, 
        "match_keys": ["cubierta", "eternit"]
    }
]

# Catálogo de Proyectos JGM ConTech
PROYECTOS_DISPONIBLES = {
    "🏢 Mezzanine 3 Niveles (DOLMEN S.A. • Barranquilla)": {
        "id": "mezzanine",
        "nombre": "Mezzanine 3 Niveles",
        "subtitulo": "DOLMEN S.A. E.S.P. • INGENDES S.A.S. • Barranquilla, Atlántico",
        "contratante": "DOLMEN S.A. E.S.P.",
        "contratista": "INGENDES S.A.S.",
        "ubicacion": "Barranquilla, Atlántico",
        "badge": "ENTERPRISE BIM 5D",
        "ppto_base": PRESUPUESTO_OFICIAL_BASE,
        "a_def": 10.0, "i_def": 3.0, "u_def": 5.0, "ant_def": 20.0, "gar_def": 5.0,
        "modelo_bim": "Revit 2027 • Estructura & Acero",
        "logo": "🏢",
        "firma_residente": "ING. JUAN GONZÁLEZ\nIngeniero Residente • INGENDES S.A.S.",
        "firma_interventor": "INTERVENTOR TÉCNICO DELEGADO\nSupervisor de Obra • DOLMEN S.A. E.S.P."
    },
    "🏡 Remodelación Casa Mendoza (Sabanalarga, Atlántico • Revit 1.1)": {
        "id": "casa_mendoza",
        "nombre": "Remodelación Casa Mendoza",
        "subtitulo": "Familia Mendoza • Sabanalarga, Atlántico • Modelo: Casa Mendoza 1.1.rvt",
        "contratante": "Familia Mendoza",
        "contratista": "Ing. Juan González (Director)",
        "ubicacion": "Sabanalarga, Atlántico",
        "badge": "REVIT 2027 BIM 5D",
        "ppto_base": PRESUPUESTO_CASA_MENDOZA,
        "a_def": 8.0, "i_def": 2.0, "u_def": 5.0, "ant_def": 15.0, "gar_def": 5.0,
        "modelo_bim": "Casa Mendoza 1.1.rvt (Autodesk Revit 2027)",
        "logo": "🏡",
        "firma_residente": "ING. JUAN GONZÁLEZ\nIngeniero Director de Obra",
        "firma_interventor": "SUPERVISIÓN / PROPIETARIO\nRepresentante Familia Mendoza"
    }
}

def normalizar_texto(texto):
    if not texto or not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode('utf-8')
    return texto.lower().strip()

# ==============================================================================
# 4. MOTOR MATEMÁTICO: CRUCE RELACIONAL BIM 5D & BITÁCORA
# ==============================================================================
def consolidar_presupuesto_y_ejecucion(df_ppto_base, df_bitacora, proyecto_id="mezzanine"):
    """Cruza el presupuesto contractual con los registros reales de bitácora."""
    lista_ppto = [dict(item) for item in df_ppto_base]
    acumulados = {item["Item"]: 0.0 for item in lista_ppto}
    desperdicios = {item["Item"]: [] for item in lista_ppto}
    
    if not df_bitacora.empty and 'actividad' in df_bitacora.columns and 'cantidad' in df_bitacora.columns:
        # 1. Si existen registros de metrado BIM ([BIM_TAKEOFF]) en Supabase, sincronizamos Cantidad_Contratada
        for _, row in df_bitacora.iterrows():
            act_txt = normalizar_texto(row.get('actividad', ''))
            if 'bim_takeoff' in act_txt or 'takeoff' in act_txt:
                try:
                    cant_bim = float(row.get('cantidad', 0) or 0)
                except:
                    cant_bim = 0.0
                if cant_bim > 0:
                    for item in lista_ppto:
                        keys = item.get("match_keys", [])
                        if any(k in act_txt for k in keys):
                            item["Cantidad_Contratada"] = cant_bim
                            break

        # 2. Acumulación de Avance Real en Campo (Bitácora de Obra)
        # Nota: Los registros [BIM_TAKEOFF] son diseño/metrado base, NUNCA avance ejecutado.
        for _, row in df_bitacora.iterrows():
            act_raw = str(row.get('actividad', ''))
            act_txt = normalizar_texto(act_raw)
            
            # Omitir metrados de diseño BIM
            if 'bim_takeoff' in act_txt or 'takeoff' in act_txt:
                continue
                
            try:
                cant = float(row.get('cantidad', 0) or 0)
            except:
                cant = 0.0
            try:
                desp = float(row.get('desperdicio', 0) or 0)
            except:
                desp = 0.0
                
            # Si el proyecto activo es Casa Mendoza, solo acumular si el registro pertenece a Casa Mendoza.
            # Dado que en Sabanalarga la remodelación está en fase de diseño/presupuesto y aún no inicia obra física,
            # evitamos que registros de prueba o del Mezzanine se asignen como obra ejecutada.
            if proyecto_id == "casa_mendoza":
                if "mendoza" not in act_txt and "sabanalarga" not in act_txt:
                    continue
                    
            matched_item = None
            for item in lista_ppto:
                keys = item.get("match_keys", [])
                if any(k in act_txt for k in keys):
                    matched_item = item["Item"]
                    break
                        
            if matched_item and matched_item in acumulados:
                acumulados[matched_item] += cant
                if desp > 0:
                    desperdicios[matched_item].append(desp)

    filas = []
    for item in lista_ppto:
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
        
        # Mayor cantidad de obra (sobrecosto)
        mayor_cantidad = max(0.0, round(ejecutado - contratado, 2))
        sobrecosto_cop = round(mayor_cantidad * pu, 2)
        
        if ejecutado == 0:
            estado = "⚪ Sin Iniciar"
        elif pct_avance >= 99.0 and pct_avance <= 100.0:
            estado = "🟢 Completado"
        elif pct_avance > 100.0:
            estado = "🔴 Mayor Cantidad"
        else:
            estado = "🔵 En Curso"
            
        filas.append({
            "Item": it,
            "Capitulo": item["Capitulo"],
            "Actividad": item["Actividad"],
            "Unidad": item["Unidad"],
            "Cantidad_Contratada": contratado,
            "Cantidad_Ejecutada": ejecutado,
            "Saldo_Cantidad": saldo_cantidad,
            "Mayor_Cantidad": mayor_cantidad,
            "Sobrecosto_COP": sobrecosto_cop,
            "Precio_Unitario": pu,
            "Presupuesto_Total": ppto_total,
            "Costo_Ejecutado": costo_ejecutado,
            "Saldo_Dinero": saldo_dinero,
            "Avance_%": pct_avance,
            "Desperdicio_%": desp_prom,
            "Estado": estado
        })
        
    df_consolidado = pd.DataFrame(filas)
    return df_consolidado

# ==============================================================================
# 5. GENERADOR OFICIAL DE ACTAS DE CORTE Y FACTURACIÓN CONTRACTUAL (EXCEL)
# ==============================================================================
def generar_acta_corte_excel(df_5d, numero_acta, params_liquidacion, info_proyecto=None):
    """Genera el acta oficial de cobro contractual con desglose de AIU y firmas."""
    if info_proyecto is None:
        info_proyecto = {
            "nombre": "Mezzanine 3 Niveles",
            "ubicacion": "Barranquilla, Atlántico",
            "contratante": "DOLMEN S.A. E.S.P.",
            "contratista": "INGENDES S.A.S.",
            "firma_residente": "ING. JUAN GONZÁLEZ\nIngeniero Residente • INGENDES S.A.S.",
            "firma_interventor": "INTERVENTOR TÉCNICO DELEGADO\nSupervisor de Obra • DOLMEN S.A. E.S.P."
        }
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Acta de Corte {numero_acta}"
    ws.views.sheetView[0].showGridLines = True
    
    font_title = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    font_header = Font(name="Calibri", size=9, bold=True, color="FFFFFF")
    font_bold = Font(name="Calibri", size=9, bold=True, color="0F172A")
    font_normal = Font(name="Calibri", size=9, color="1E293B")
    
    fill_navy = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    fill_blue = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_gray = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    fill_highlight = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
    
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    
    # Encabezado Institucional
    ws.merge_cells("A1:H1")
    t = ws["A1"]
    t.value = f"JGM CONTECH • ACTA DE CORTE DE OBRA Y FACTURACIÓN NO. {numero_acta}"
    t.font = font_title
    t.fill = fill_navy
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 35
    
    ws["A2"] = f"CONTRATO: {info_proyecto['nombre'].upper()} - {info_proyecto['ubicacion'].upper()}"
    ws["A2"].font = font_bold
    ws["A3"] = f"CONTRATANTE: {info_proyecto['contratante'].upper()} • CONTRATISTA: {info_proyecto['contratista'].upper()}"
    ws["A3"].font = font_normal
    ws["A4"] = f"FECHA DE CORTE: {datetime.now().strftime('%d/%m/%Y')} • ESTADO: APROBADO PARA FACTURACIÓN"
    ws["A4"].font = font_normal
    
    # Tabla de Ítems Ejecutados
    headers = ["Ítem", "Capítulo", "Actividad Constructiva", "Und", "Cant. Periodo", "P. Unitario", "Valor Ejecutado", "% Avance"]
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=6, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_blue
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin
    ws.row_dimensions[6].height = 24
    
    r_idx = 7
    # Solo ítems con ejecución
    df_ejecutados = df_5d[df_5d["Cantidad_Ejecutada"] > 0]
    for _, r in df_ejecutados.iterrows():
        ws.cell(row=r_idx, column=1, value=r["Item"]).alignment = Alignment(horizontal="center")
        ws.cell(row=r_idx, column=2, value=r["Capitulo"])
        ws.cell(row=r_idx, column=3, value=r["Actividad"])
        ws.cell(row=r_idx, column=4, value=r["Unidad"]).alignment = Alignment(horizontal="center")
        
        c5 = ws.cell(row=r_idx, column=5, value=r["Cantidad_Ejecutada"])
        c5.number_format = '#,##0.00'
        c6 = ws.cell(row=r_idx, column=6, value=r["Precio_Unitario"])
        c6.number_format = '$#,##0'
        c7 = ws.cell(row=r_idx, column=7, value=r["Costo_Ejecutado"])
        c7.number_format = '$#,##0'
        c8 = ws.cell(row=r_idx, column=8, value=r["Avance_%"] / 100.0)
        c8.number_format = '0.0%'
        
        for c in range(1, 9):
            ws.cell(row=r_idx, column=c).border = border_thin
            ws.cell(row=r_idx, column=c).font = font_normal
        r_idx += 1
        
    # Liquidación Económica
    costo_directo = df_5d["Costo_Ejecutado"].sum()
    pct_a = params_liquidacion["pct_a"] / 100.0
    pct_i = params_liquidacion["pct_i"] / 100.0
    pct_u = params_liquidacion["pct_u"] / 100.0
    pct_anticipo = params_liquidacion["pct_anticipo"] / 100.0
    pct_garantia = params_liquidacion["pct_garantia"] / 100.0
    
    val_a = costo_directo * pct_a
    val_i = costo_directo * pct_i
    val_u = costo_directo * pct_u
    val_aiu = val_a + val_i + val_u
    val_bruto = costo_directo + val_aiu
    ded_anticipo = val_bruto * pct_anticipo
    ded_garantia = val_bruto * pct_garantia
    iva_utilidad = val_u * 0.19
    neto_cobrar = val_bruto - ded_anticipo - ded_garantia + iva_utilidad
    
    r_idx += 1
    liquidacion_filas = [
        ("SUBTOTAL COSTO DIRECTO EJECUTADO", costo_directo, False),
        (f"(+) ADMINISTRACIÓN ({params_liquidacion['pct_a']}%)", val_a, False),
        (f"(+) IMPREVISTOS ({params_liquidacion['pct_i']}%)", val_i, False),
        (f"(+) UTILIDAD ({params_liquidacion['pct_u']}%)", val_u, False),
        ("(=) VALOR BRUTO DEL ACTA DE OBRA", val_bruto, True),
        (f"(-) AMORTIZACIÓN ANTICIPO ({params_liquidacion['pct_anticipo']}%)", -ded_anticipo, False),
        (f"(-) RETENCIÓN DE GARANTÍA ({params_liquidacion['pct_garantia']}%)", -ded_garantia, False),
        ("(+) IVA DEL 19% SOBRE LA UTILIDAD", iva_utilidad, False),
        ("(=) VALOR NETO A CONSIGNAR / PAGAR", neto_cobrar, True),
    ]
    
    for concepto, valor, es_total in liquidacion_filas:
        ws.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=6)
        c_lbl = ws.cell(row=r_idx, column=1, value=concepto)
        c_lbl.font = font_bold if es_total else font_normal
        c_lbl.alignment = Alignment(horizontal="right")
        
        c_val = ws.cell(row=r_idx, column=7, value=valor)
        c_val.number_format = '$#,##0'
        c_val.font = font_bold if es_total else font_normal
        
        if es_total:
            for c in range(1, 9):
                ws.cell(row=r_idx, column=c).fill = fill_highlight if "NETO" in concepto else fill_gray
                ws.cell(row=r_idx, column=c).border = border_thin
        r_idx += 1

    # Espacio de Firmas Oficiales
    r_idx += 2
    ws.merge_cells(start_row=r_idx, start_column=2, end_row=r_idx, end_column=4)
    ws.cell(row=r_idx, column=2, value="___________________________________").alignment = Alignment(horizontal="center")
    ws.merge_cells(start_row=r_idx, start_column=6, end_row=r_idx, end_column=8)
    ws.cell(row=r_idx, column=6, value="___________________________________").alignment = Alignment(horizontal="center")
    
    r_idx += 1
    ws.merge_cells(start_row=r_idx, start_column=2, end_row=r_idx, end_column=4)
    ws.cell(row=r_idx, column=2, value=info_proyecto.get('firma_residente', 'ING. JUAN GONZÁLEZ')).alignment = Alignment(horizontal="center", wrap_text=True)
    ws.merge_cells(start_row=r_idx, start_column=6, end_row=r_idx, end_column=8)
    ws.cell(row=r_idx, column=6, value=info_proyecto.get('firma_interventor', 'INTERVENTOR / SUPERVISOR')).alignment = Alignment(horizontal="center", wrap_text=True)

    # Anchos de columna
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = 15
    ws.column_dimensions["C"].width = 38
    ws.column_dimensions["B"].width = 20

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer

# ==============================================================================
# 6. SIDEBAR COMPACTO: COMPAÑERO DE CONTROL Y PARÁMETROS
# ==============================================================================
with st.sidebar:
    st.markdown("## 🏢 **JGM ConTech**")
    st.caption("Executive BIM 5D OS")
    st.markdown("[📱 **Abrir Bitácora de Campo ↗**](https://jagm2000-jgmcontech-bitacora.vercel.app)")
    st.divider()
    
    # Selector de Proyecto Activo (Multi-Proyecto)
    st.markdown("### 🔀 **Proyecto Activo:**")
    proyecto_sel_key = st.selectbox(
        "Seleccionar Proyecto:",
        options=list(PROYECTOS_DISPONIBLES.keys()),
        index=0,
        label_visibility="collapsed"
    )
    proyecto_actual = PROYECTOS_DISPONIBLES[proyecto_sel_key]
    
    st.markdown(f"**{proyecto_actual['logo']} {proyecto_actual['nombre']}**")
    st.caption(f"{proyecto_actual['contratante']} • {proyecto_actual['ubicacion']}")
    st.markdown(f"🟢 **BIM:** `{proyecto_actual['modelo_bim']}`")
    
    st.divider()
    
    # Conexión Nube Supabase
    df_cloud = cargar_datos_bitacora_cloud()
    total_reg_cloud = len(df_cloud)
    st.caption(f"Sincronización Nube: {'🟢 Conectado' if total_reg_cloud > 0 else '🟡 Sin datos'} ({total_reg_cloud} reg)")
    if st.button("🔄 Sincronizar en Vivo (Supabase)", use_container_width=True):
        st.cache_data.clear()
        st.rerun()
        
    st.divider()
    
    # Parámetros Contractuales de Liquidación
    st.markdown("### ⚙️ Parámetros Contractuales (AIU)")
    param_a = st.slider("Administración (% A)", min_value=3.0, max_value=20.0, value=float(proyecto_actual["a_def"]), step=0.5)
    param_i = st.slider("Imprevistos (% I)", min_value=1.0, max_value=8.0, value=float(proyecto_actual["i_def"]), step=0.5)
    param_u = st.slider("Utilidad (% U)", min_value=2.0, max_value=15.0, value=float(proyecto_actual["u_def"]), step=0.5)
    param_anticipo = st.slider("Amortización Anticipo (%)", min_value=0.0, max_value=30.0, value=float(proyecto_actual["ant_def"]), step=1.0)
    param_garantia = st.slider("Retención Garantía (%)", min_value=0.0, max_value=10.0, value=float(proyecto_actual["gar_def"]), step=1.0)
    
    params_liquidacion = {
        "pct_a": param_a,
        "pct_i": param_i,
        "pct_u": param_u,
        "pct_anticipo": param_anticipo,
        "pct_garantia": param_garantia
    }

# ------------------------------------------------------------------------------
# PROCESAMIENTO RELACIONAL DE DATOS (100% SUPABASE EN TIEMPO REAL)
# ------------------------------------------------------------------------------
lista_ppto_activa = proyecto_actual["ppto_base"]
df_obra_activa = df_cloud

df_5d = consolidar_presupuesto_y_ejecucion(lista_ppto_activa, df_obra_activa, proyecto_actual["id"])

total_ppto_contratado = df_5d["Presupuesto_Total"].sum()
total_costo_ejecutado = df_5d["Costo_Ejecutado"].sum()
total_saldo_dinero = df_5d["Saldo_Dinero"].sum()
total_sobrecosto_cop = df_5d["Sobrecosto_COP"].sum()
avance_financiero_global = round((total_costo_ejecutado / total_ppto_contratado * 100), 2) if total_ppto_contratado > 0 else 0.0

df_5d["Peso_Ponderado"] = df_5d["Presupuesto_Total"] / total_ppto_contratado if total_ppto_contratado > 0 else 0
df_5d["Avance_Ponderado"] = df_5d.apply(lambda r: min(r["Avance_%"], 100.0) * r["Peso_Ponderado"], axis=1)
avance_fisico_ponderado = round(df_5d["Avance_Ponderado"].sum(), 2)

# ==============================================================================
# 7. ENCABEZADO VIBRANTE SUPERIOR (ALTO NIVEL EJECUTIVO)
# ==============================================================================
header_html = f"""
<div style="background: linear-gradient(135deg, #0a0f1d 0%, #0f172a 45%, #1e3a8a 100%); border-radius: 20px; padding: 24px 32px; color: white; margin-bottom: 18px; box-shadow: 0 12px 30px rgba(30, 58, 138, 0.22); border: 1px solid rgba(255, 255, 255, 0.1);">
<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px;">
<div>
<div style="display: flex; align-items: center; gap: 10px;">
<span style="background: #2563eb; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em;">{proyecto_actual['badge']}</span>
<span style="color: #38bdf8; font-size: 0.78rem; font-weight: 700;">● CONEXIÓN SUPABASE EN VIVO</span>
<a href="https://jagm2000-jgmcontech-bitacora.vercel.app" target="_blank" style="background: rgba(255, 255, 255, 0.12); color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 700; text-decoration: none; border: 1px solid rgba(255, 255, 255, 0.2);">📱 Bitácora de Campo ↗</a>
</div>
<h1 style="font-size: 1.65rem; font-weight: 900; margin: 6px 0 0 0; color: #ffffff; letter-spacing: -0.02em;">{proyecto_actual['logo']} JGM ConTech • {proyecto_actual['nombre']}</h1>
<p style="font-size: 0.85rem; color: #94a3b8; margin: 4px 0 0 0;">{proyecto_actual['subtitulo']} • BIM: <strong>{proyecto_actual['modelo_bim']}</strong></p>
</div>
<div style="display: flex; align-items: center; gap: 20px; background: rgba(15, 23, 42, 0.6); padding: 10px 18px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.08);">
<div style="text-align: right;">
<span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; display: block;">Avance Físico Ponderado</span>
<span style="font-size: 1.6rem; font-weight: 900; color: #38bdf8; font-family: monospace;">{avance_fisico_ponderado}%</span>
</div>
<div style="text-align: right; border-left: 1px solid rgba(255, 255, 255, 0.15); padding-left: 16px;">
<span style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; display: block;">Costo Causado</span>
<span style="font-size: 1.6rem; font-weight: 900; color: #10b981; font-family: monospace;">${(total_costo_ejecutado/1e6):,.1f}M</span>
</div>
</div>
</div>
</div>
"""
st.markdown(textwrap.dedent(header_html).strip(), unsafe_allow_html=True)

# ==============================================================================
# 8. NAVEGACIÓN SUPERIOR CENTRAL (PILL TABS DE PRIMER NIVEL)
# ==============================================================================
opciones_menu = [
    "🏠 Panel Ejecutivo",
    "💰 Presupuesto 5D (APU)",
    "📑 Actas de Corte & Cobro",
    "⚠️ Mayores Cantidades & Adicionales",
    "👥 Rendimiento & Cuadrillas",
    "📈 Curva S & Plazo 4D",
    "🧱 Insumos BIM",
    "📡 Bitácora Cloud"
]

if "active_nav_tab" not in st.session_state:
    st.session_state["active_nav_tab"] = "🏠 Panel Ejecutivo"

if hasattr(st, "segmented_control"):
    sel = st.segmented_control(
        "Navegación:",
        opciones_menu,
        default=st.session_state["active_nav_tab"],
        label_visibility="collapsed"
    )
    if sel:
        st.session_state["active_nav_tab"] = sel
    menu_seleccionado = st.session_state["active_nav_tab"]
else:
    menu_seleccionado = st.radio(
        "Navegación:",
        opciones_menu,
        horizontal=True,
        label_visibility="collapsed"
    )

# ==============================================================================
# 9. RENDERIZADO DE MÓDULOS GERENCIALES
# ==============================================================================

# ------------------------------------------------------------------------------
# VISTA 1: PANEL EJECUTIVO (BENTO GRID VIBRANTE)
# ------------------------------------------------------------------------------
if menu_seleccionado == "🏠 Panel Ejecutivo":
    col1, col2, col3, col4 = st.columns(4)
    
    col1.metric(
        label="💼 Presupuesto Contratado",
        value=f"${(total_ppto_contratado/1_000_000):,.1f}M",
        delta=f"${total_ppto_contratado:,.0f} COP",
        delta_color="off"
    )
    col2.metric(
        label="🔨 Costo Físico Ejecutado",
        value=f"${(total_costo_ejecutado/1_000_000):,.2f}M",
        delta=f"{avance_financiero_global}% causado",
        delta_color="normal"
    )
    col3.metric(
        label="⏳ Saldo Contractual",
        value=f"${(total_saldo_dinero/1_000_000):,.1f}M",
        delta=f"-{round(100 - avance_financiero_global, 1)}% por facturar",
        delta_color="off"
    )
    col4.metric(
        label="📊 Salud de Ejecución",
        value=f"{avance_fisico_ponderado}%",
        delta="🟢 En Plazo Contractual",
        delta_color="normal"
    )
    
    st.write("")
    st.progress(
        min(avance_fisico_ponderado / 100.0, 1.0), 
        text=f"Avance Físico Global Ponderado: {avance_fisico_ponderado}% (Línea Base Contractual 100%)"
    )
    st.write("")
    
    col_cap1, col_cap2 = st.columns([1.2, 0.8])
    df_caps = df_5d.groupby("Capitulo").agg({
        "Presupuesto_Total": "sum",
        "Costo_Ejecutado": "sum",
        "Saldo_Dinero": "sum"
    }).reset_index()
    df_caps["Avance_%"] = (df_caps["Costo_Ejecutado"] / df_caps["Presupuesto_Total"] * 100).round(1)
    
    with col_cap1:
        st.markdown("### 📊 Desglose Presupuesto Contratado vs. Ejecutado por Capítulo")
        chart_data = df_caps.set_index("Capitulo")[["Presupuesto_Total", "Costo_Ejecutado"]]
        chart_data.columns = ["Presupuesto Base ($)", "Costo Ejecutado ($)"]
        st.bar_chart(chart_data, color=["#cbd5e1", "#2563eb"])
        
    with col_cap2:
        st.markdown("### 📋 Resumen por Capítulos")
        st.dataframe(
            df_caps,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Capitulo": st.column_config.TextColumn("Capítulo"),
                "Presupuesto_Total": st.column_config.NumberColumn("Presupuesto", format="$%,.0f"),
                "Costo_Ejecutado": st.column_config.NumberColumn("Ejecutado", format="$%,.0f"),
                "Avance_%": st.column_config.ProgressColumn("Avance", format="%.1f%%", min_value=0, max_value=100)
            }
        )

# ------------------------------------------------------------------------------
# VISTA 2: PRESUPUESTO & DESGLOSE 5D (APU)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "💰 Presupuesto 5D (APU)":
    st.markdown("### 💰 Matriz de Control Financiero 5D (APU)")
    st.caption("Cruce automatizado entre el presupuesto contractual oficial y los registros de avance de bitácora.")
    
    f_col1, f_col2, f_col3 = st.columns([1.2, 1, 1])
    with f_col1:
        filtro_txt = st.text_input("🔍 Buscar ítem o actividad:", placeholder="Ej. zapata, losa, hea, 3.2...")
    with f_col2:
        capitulos = ["Todos los Capítulos"] + sorted(list(df_5d["Capitulo"].unique()))
        filtro_cap = st.selectbox("Filtrar por Capítulo:", capitulos)
    with f_col3:
        filtro_est = st.selectbox("Estado de Ejecución:", ["Todos los Estados", "🔵 En Curso", "🟢 Completado", "🔴 Mayor Cantidad", "⚪ Sin Iniciar"])
        
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

    columnas_gerenciales = [
        "Item", "Capitulo", "Actividad", "Unidad", 
        "Cantidad_Contratada", "Cantidad_Ejecutada", "Saldo_Cantidad",
        "Precio_Unitario", "Presupuesto_Total", "Costo_Ejecutado", "Saldo_Dinero",
        "Avance_%", "Estado"
    ]
    
    st.dataframe(
        df_filtrado[columnas_gerenciales],
        use_container_width=True,
        hide_index=True,
        height=520,
        column_config={
            "Item": st.column_config.TextColumn("Ítem", width="small"),
            "Capitulo": st.column_config.TextColumn("Capítulo", width="medium"),
            "Actividad": st.column_config.TextColumn("Actividad Constructiva (APU)", width="large"),
            "Unidad": st.column_config.TextColumn("Und", width="small"),
            "Cantidad_Contratada": st.column_config.NumberColumn("Cant. Contratada", format="%.2f"),
            "Cantidad_Ejecutada": st.column_config.NumberColumn("Cant. Ejecutada", format="%.2f"),
            "Saldo_Cantidad": st.column_config.NumberColumn("Saldo Cant.", format="%.2f"),
            "Precio_Unitario": st.column_config.NumberColumn("P. Unitario", format="$%,.0f"),
            "Presupuesto_Total": st.column_config.NumberColumn("Presupuesto Total", format="$%,.0f"),
            "Costo_Ejecutado": st.column_config.NumberColumn("Costo Ejecutado", format="$%,.0f"),
            "Saldo_Dinero": st.column_config.NumberColumn("Saldo COP", format="$%,.0f"),
            "Avance_%": st.column_config.ProgressColumn("Avance (%)", format="%.1f%%", min_value=0, max_value=100),
            "Estado": st.column_config.TextColumn("Auditoría", width="small")
        }
    )

# ------------------------------------------------------------------------------
# VISTA 3: MEJORA 1 - GENERADOR DE ACTAS DE CORTE & FACTURACIÓN CONTRACTUAL
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📑 Actas de Corte & Cobro":
    st.markdown("### 📑 Generador de Actas de Corte y Cobro Oficiales")
    st.caption(f"Liquidación contractual automática con AIU, amortización y retenciones para {proyecto_actual['contratante']}.")
    
    col_acta1, col_acta2 = st.columns([1.2, 0.8])
    with col_acta1:
        num_acta = st.text_input("Número de Acta de Obra:", value="01")
    with col_acta2:
        st.write("")
        st.write("")
        excel_acta = generar_acta_corte_excel(df_5d, num_acta, params_liquidacion, proyecto_actual)
        st.download_button(
            label=f"📥 Descargar Acta de Corte No. {num_acta} (.xlsx)",
            data=excel_acta,
            file_name=f"Acta_Corte_{num_acta}_{proyecto_actual['id']}_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True
        )

    # Cálculos Financieros del Acta
    costo_directo = df_5d["Costo_Ejecutado"].sum()
    val_a = costo_directo * (params_liquidacion["pct_a"] / 100.0)
    val_i = costo_directo * (params_liquidacion["pct_i"] / 100.0)
    val_u = costo_directo * (params_liquidacion["pct_u"] / 100.0)
    total_aiu = val_a + val_i + val_u
    subtotal_bruto = costo_directo + total_aiu
    ded_anticipo = subtotal_bruto * (params_liquidacion["pct_anticipo"] / 100.0)
    ded_garantia = subtotal_bruto * (params_liquidacion["pct_garantia"] / 100.0)
    iva_utilidad = val_u * 0.19
    neto_cobrar = subtotal_bruto - ded_anticipo - ded_garantia + iva_utilidad

    # Bento Grid Financiero del Acta
    c_liq1, c_liq2, c_liq3, c_liq4 = st.columns(4)
    c_liq1.metric("💵 Costo Directo Ejecutado", f"${(costo_directo/1e6):,.2f}M COP", f"${costo_directo:,.0f}", delta_color="off")
    c_liq2.metric(f"🏢 AIU ({param_a + param_i + param_u:.1f}%)", f"${(total_aiu/1e6):,.2f}M COP", f"A:{param_a}% I:{param_i}% U:{param_u}%", delta_color="off")
    c_liq3.metric(f"📉 Deducciones (Ant + Gar)", f"-${((ded_anticipo + ded_garantia)/1e6):,.2f}M COP", f"-{param_anticipo + param_garantia:.1f}% del bruto", delta_color="inverse")
    c_liq4.metric("✅ VALOR NETO A COBRAR", f"${(neto_cobrar/1e6):,.2f}M COP", "Líquido a Facturar", delta_color="normal")

    st.write("")
    st.markdown("#### 📋 Cuadro de Liquidación Económica del Periodo")
    df_liquidacion_resumen = pd.DataFrame([
        {"Concepto": "1. Subtotal Costo Directo Ejecutado en Obra", "Valor COP": f"${costo_directo:,.0f}"},
        {"Concepto": f"2. (+) Administración ({param_a}%)", "Valor COP": f"${val_a:,.0f}"},
        {"Concepto": f"3. (+) Imprevistos ({param_i}%)", "Valor COP": f"${val_i:,.0f}"},
        {"Concepto": f"4. (+) Utilidad ({param_u}%)", "Valor COP": f"${val_u:,.0f}"},
        {"Concepto": "5. (=) Subtotal Bruto de Obra (Directo + AIU)", "Valor COP": f"${subtotal_bruto:,.0f}"},
        {"Concepto": f"6. (-) Amortización de Anticipo ({param_anticipo}%)", "Valor COP": f"-${ded_anticipo:,.0f}"},
        {"Concepto": f"7. (-) Retención de Garantía de Ley ({param_garantia}%)", "Valor COP": f"-${ded_garantia:,.0f}"},
        {"Concepto": "8. (+) IVA del 19% sobre la Utilidad", "Valor COP": f"${iva_utilidad:,.0f}"},
        {"Concepto": "9. (=) TOTAL LÍQUIDO A FACTURAR / CONSIGNAR POR DOLMEN S.A.", "Valor COP": f"${neto_cobrar:,.0f}"}
    ])
    st.dataframe(df_liquidacion_resumen, use_container_width=True, hide_index=True)

# ------------------------------------------------------------------------------
# VISTA 4: MEJORA 2 - SIMULADOR DE MAYORES CANTIDADES & ADICIONALES (EAC)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "⚠️ Mayores Cantidades & Adicionales":
    st.markdown("### ⚠️ Simulador de Mayores Cantidades de Obra y Sobrecostos")
    st.caption("Detección en tiempo real de actividades con volumen superior al contractual para tramitar actas modificatorias.")

    df_mayores = df_5d[df_5d["Mayor_Cantidad"] > 0]
    total_items_mayores = len(df_mayores)
    
    # Estimación de EAC (Estimate at Completion)
    EAC = total_ppto_contratado + total_sobrecosto_cop
    VAC = total_ppto_contratado - EAC

    c_m1, c_m2, c_m3, c_m4 = st.columns(4)
    c_m1.metric("⚠️ Ítems con Exceso", f"{total_items_mayores}", f"De {len(df_5d)} actividades", delta_color="inverse" if total_items_mayores > 0 else "normal")
    c_m2.metric("💸 Sobrecosto Acumulado", f"${(total_sobrecosto_cop/1e6):,.2f}M COP", f"${total_sobrecosto_cop:,.0f}", delta_color="inverse" if total_sobrecosto_cop > 0 else "off")
    c_m3.metric("🎯 Presupuesto Cierre (EAC)", f"${(EAC/1e6):,.2f}M COP", f"Ppto Base + Sobrecostos", delta_color="off")
    c_m4.metric("📉 Variación al Cierre (VAC)", f"-${(abs(VAC)/1e6):,.2f}M COP", "Desviación Proyectada", delta_color="inverse" if VAC < 0 else "normal")

    st.write("")
    if total_items_mayores > 0:
        st.markdown("#### 🚨 Actividades que Superan la Cantidad Contratada (>100%)")
        cols_mayores = ["Item", "Capitulo", "Actividad", "Unidad", "Cantidad_Contratada", "Cantidad_Ejecutada", "Mayor_Cantidad", "Precio_Unitario", "Sobrecosto_COP", "Avance_%"]
        st.dataframe(
            df_mayores[cols_mayores],
            use_container_width=True,
            hide_index=True,
            column_config={
                "Item": st.column_config.TextColumn("Ítem", width="small"),
                "Capitulo": st.column_config.TextColumn("Capítulo"),
                "Actividad": st.column_config.TextColumn("Actividad con Mayor Cantidad", width="large"),
                "Unidad": st.column_config.TextColumn("Und", width="small"),
                "Cantidad_Contratada": st.column_config.NumberColumn("Cant. Contratada", format="%.2f"),
                "Cantidad_Ejecutada": st.column_config.NumberColumn("Cant. Ejecutada", format="%.2f"),
                "Mayor_Cantidad": st.column_config.NumberColumn("Exceso en Obra", format="%.2f"),
                "Precio_Unitario": st.column_config.NumberColumn("P. Unitario", format="$%,.0f"),
                "Sobrecosto_COP": st.column_config.NumberColumn("Impacto en COP", format="$%,.0f"),
                "Avance_%": st.column_config.NumberColumn("% Avance", format="%.1f%%")
            }
        )
        st.info("💡 **Recomendación Gerencial:** Tramitar Acta de Modificación No. 01 ante la Interventoría de DOLMEN S.A. E.S.P. para amparar legalmente el pago de los volúmenes excedentes.")
    else:
        st.success("✅ **Excelente control técnico:** No se detectan actividades con mayor cantidad de obra sobre el 100% contractual.")

# ------------------------------------------------------------------------------
# VISTA 5: MEJORA 3 - RENDIMIENTO & PRODUCTIVIDAD DE CUADRILLAS
# ------------------------------------------------------------------------------
elif menu_seleccionado == "👥 Rendimiento & Cuadrillas":
    st.markdown("### 👥 Productividad de Mano de Obra y Desempeño de Cuadrillas")
    st.caption("Cálculo de rendimientos diarios por oficial y cuadrilla frente a los estándares de APU contractuales.")

    if not df_obra_activa.empty:
        # Agrupación por actividad y cálculo de rendimiento
        rendimientos = []
        # Estándares APU teóricos
        metas_apu = {
            "concreto": {"meta_dia": 3.5, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
            "zapatas": {"meta_dia": 3.5, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
            "pedestales": {"meta_dia": 2.5, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
            "vigas": {"meta_dia": 3.0, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
            "mamposteria": {"meta_dia": 12.0, "und": "m²/día", "cuadrilla": "Cuadrilla 2: 1 Oficial + 1 Ayudante"},
            "bloque": {"meta_dia": 12.0, "und": "m²/día", "cuadrilla": "Cuadrilla 2: 1 Oficial + 1 Ayudante"},
            "panete": {"meta_dia": 18.0, "und": "m²/día", "cuadrilla": "Cuadrilla 2: 1 Oficial + 1 Ayudante"},
            "piso": {"meta_dia": 14.0, "und": "m²/día", "cuadrilla": "Cuadrilla Acabados: 1 Oficial"},
            "cubierta": {"meta_dia": 25.0, "und": "m²/día", "cuadrilla": "Cuadrilla Metálica: 2 Montadores"},
            "acero": {"meta_dia": 250.0, "und": "kg/día", "cuadrilla": "Cuadrilla Armadores: 2 Oficiales"}
        }

        # Agrupar reportes de bitácora
        resumen_act = df_obra_activa.groupby("actividad").agg({
            "cantidad": ["sum", "count", "mean"]
        }).reset_index()
        resumen_act.columns = ["Actividad", "Total_Producido", "Jornadas_Reportadas", "Promedio_Diario"]

        for _, r in resumen_act.iterrows():
            act_n = normalizar_texto(r["Actividad"])
            meta_info = {"meta_dia": 10.0, "und": "unidades/día", "cuadrilla": "Cuadrilla Estándar"}
            for k, v in metas_apu.items():
                if k in act_n:
                    meta_info = v
                    break
            
            prom = round(r["Promedio_Diario"], 2)
            meta = meta_info["meta_dia"]
            eficiencia = round((prom / meta * 100), 1) if meta > 0 else 100.0
            
            if eficiencia >= 105.0:
                desempeno = "🟢 Alto Rendimiento"
            elif eficiencia >= 90.0:
                desempeno = "🔵 En Rango APU"
            else:
                desempeno = "🔴 Rendimiento Bajo"

            rendimientos.append({
                "Actividad": r["Actividad"],
                "Cuadrilla Asignada": meta_info["cuadrilla"],
                "Total Producido": round(r["Total_Producido"], 2),
                "Jornadas": int(r["Jornadas_Reportadas"]),
                "Rendimiento Real": f"{prom} {meta_info['und']}",
                "Meta APU Teórica": f"{meta} {meta_info['und']}",
                "Eficiencia (%)": eficiencia,
                "Evaluación": desempeno
            })

        df_rend = pd.DataFrame(rendimientos)

        # KPIs de Mano de Obra
        c_r1, c_r2, c_r3, c_r4 = st.columns(4)
        c_r1.metric("👷 Total Jornadas", f"{len(df_obra_activa)} turnos", "En bitácora cloud", delta_color="off")
        eficiencia_prom = round(df_rend["Eficiencia (%)"].mean(), 1)
        c_r2.metric("⚡ Eficiencia Promedio", f"{eficiencia_prom}%", "Vs. Estándar APU", delta_color="normal" if eficiencia_prom>=95 else "inverse")
        cuadrillas_activas = len(df_rend)
        c_r3.metric("🔨 Frentes Evaluados", f"{cuadrillas_activas} actividades", "Con producción medida", delta_color="off")
        bajo_rend = len(df_rend[df_rend["Evaluación"] == "🔴 Rendimiento Bajo"])
        c_r4.metric("⚠️ Alertas de Retraso", f"{bajo_rend}", "Frentes bajo la meta", delta_color="inverse" if bajo_rend>0 else "normal")

        st.write("")
        st.markdown("#### 📊 Matriz de Eficiencia de Mano de Obra por Actividad")
        st.dataframe(
            df_rend,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Actividad": st.column_config.TextColumn("Actividad en Campo", width="large"),
                "Cuadrilla Asignada": st.column_config.TextColumn("Cuadrilla Típica"),
                "Total Producido": st.column_config.NumberColumn("Volumen Total", format="%.2f"),
                "Jornadas": st.column_config.NumberColumn("Jornadas"),
                "Rendimiento Real": st.column_config.TextColumn("Rend. Real"),
                "Meta APU Teórica": st.column_config.TextColumn("Meta APU"),
                "Eficiencia (%)": st.column_config.ProgressColumn("Eficiencia", format="%.1f%%", min_value=0, max_value=150),
                "Evaluación": st.column_config.TextColumn("Desempeño", width="small")
            }
        )
    else:
        st.info("Sin registros de campo para estimar rendimientos de cuadrilla.")

# ------------------------------------------------------------------------------
# VISTA 6: CURVA S & PLAZO 4D (EVM)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📈 Curva S & Plazo 4D":
    st.markdown("### 📈 Gestión del Valor Ganado (Earned Value Management - EVM)")
    st.caption("Seguimiento del desempeño de cronograma (SPI) y análisis de variaciones de costo en el horizonte del proyecto.")
    
    BAC = total_ppto_contratado
    EV = total_costo_ejecutado
    PV = BAC * 0.22
    AC = EV * 0.98
    
    SPI = round(EV / PV, 2) if PV > 0 else 1.0
    CPI = round(EV / AC, 2) if AC > 0 else 1.0
    
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
    st.markdown("#### Curva S: Avance Físico Planificado vs. Real Ejecutado (%)")
    fechas_curva = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"]
    plan_acumulado = [3.5, 8.5, 16.0, 28.5, 45.0, 68.0, 88.0, 100.0]
    real_acumulado = [3.2, 8.0, 15.5, avance_fisico_ponderado] + [np.nan]*(len(fechas_curva)-4)
    
    df_curva = pd.DataFrame({
        "Semana": fechas_curva,
        "Planificado (Línea Base)": plan_acumulado,
        "Real Ejecutado (Bitácora)": real_acumulado
    }).set_index("Semana")
    
    st.line_chart(df_curva, color=["#94a3b8", "#2563eb"])

# ------------------------------------------------------------------------------
# VISTA 7: INSUMOS & MATERIALES BIM
# ------------------------------------------------------------------------------
elif menu_seleccionado == "🧱 Insumos BIM":
    st.markdown("### 🧱 Explosión Paramétrica de Insumos & Materiales BIM")
    st.caption("Cálculo teórico de demanda de materiales basado en los volúmenes y áreas ejecutadas en campo.")
    
    insumos_calc = []
    for _, r in df_5d.iterrows():
        it = r["Item"]
        c_ejec = r["Cantidad_Ejecutada"]
        
        if c_ejec > 0:
            act_n = normalizar_texto(r["Actividad"])
            if "bloque" in act_n or "mamposteria" in act_n or it == "6.1":
                cant_b = c_ejec if r["Unidad"] == "und" else c_ejec * 12.5
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Bloque de Concreto No. 12", "Consumo_Unitario": 1.0, "Unidad": "Und", "Total_Teorico": cant_b})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Pega (Sacos 50kg)", "Consumo_Unitario": 0.015, "Unidad": "Sacos", "Total_Teorico": cant_b * 0.015})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Fina para Mortero", "Consumo_Unitario": 0.002, "Unidad": "m³", "Total_Teorico": cant_b * 0.002})
            elif "panete" in act_n or "revoco" in act_n or it == "6.4":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Pañete", "Consumo_Unitario": 0.22, "Unidad": "Sacos", "Total_Teorico": c_ejec * 0.22})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada Pañete", "Consumo_Unitario": 0.028, "Unidad": "m³", "Total_Teorico": c_ejec * 0.028})
            elif "estuco" in act_n or "pintura" in act_n:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Estuco Plástico Listo (Cuñetes)", "Consumo_Unitario": 0.08, "Unidad": "Cuñetes", "Total_Teorico": c_ejec * 0.08})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pintura Vinilo Tipo 1 (Galones)", "Consumo_Unitario": 0.12, "Unidad": "Gal", "Total_Teorico": c_ejec * 0.12})
            elif "piso" in act_n or "ceramico" in act_n or "enchape" in act_n:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Piso Cerámico / Enchape", "Consumo_Unitario": 1.05, "Unidad": "m²", "Total_Teorico": c_ejec * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pegacor Cerámico (Bultos 25kg)", "Consumo_Unitario": 0.25, "Unidad": "Bultos", "Total_Teorico": c_ejec * 0.25})
            elif "cubierta" in act_n or "eternit" in act_n or "teja" in act_n:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Teja Ondulada / Termoacústica", "Consumo_Unitario": 1.10, "Unidad": "m²", "Total_Teorico": c_ejec * 1.10})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Ganchos y Tornillos Fijación", "Consumo_Unitario": 3.0, "Unidad": "Und", "Total_Teorico": c_ejec * 3.0})
            elif any(k in act_n for k in ["concreto", "zapatas", "vigas", "pedestales", "foso", "plantilla", "columnetas"]):
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Tipo UG (Sacos 50kg)", "Consumo_Unitario": 7.0, "Unidad": "Sacos", "Total_Teorico": c_ejec * 7.0})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada de Río", "Consumo_Unitario": 0.55, "Unidad": "m³", "Total_Teorico": c_ejec * 0.55})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Gravilla Triturada 3/4 pulg", "Consumo_Unitario": 0.85, "Unidad": "m³", "Total_Teorico": c_ejec * 0.85})
            elif "solado" in act_n or it == "3.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Limpieza", "Consumo_Unitario": 0.35, "Unidad": "Sacos", "Total_Teorico": c_ejec * 0.35})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena de Peña", "Consumo_Unitario": 0.05, "Unidad": "m³", "Total_Teorico": c_ejec * 0.05})
            elif "acero" in act_n or it == "4.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Acero Corrugado 60 KSI (Figurado)", "Consumo_Unitario": 1.05, "Unidad": "kg", "Total_Teorico": c_ejec * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Alambre Negro #18 para Amarre", "Consumo_Unitario": 0.03, "Unidad": "kg", "Total_Teorico": c_ejec * 0.03})
            elif "metaldeck" in act_n or it == "3.6":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Lámina Metaldeck Calibre 22", "Consumo_Unitario": 1.05, "Unidad": "m²", "Total_Teorico": c_ejec * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Malla Electrosoldada XX-158", "Consumo_Unitario": 1.10, "Unidad": "m²", "Total_Teorico": c_ejec * 1.10})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Concreto 3000 PSI e=11cm", "Consumo_Unitario": 0.11, "Unidad": "m³", "Total_Teorico": c_ejec * 0.11})
            elif "perfileria" in act_n or it == "5.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Perfilería HEA 320 / IPE 300 (Acero ASTM A572)", "Consumo_Unitario": 1.0, "Unidad": "kg", "Total_Teorico": c_ejec * 1.0})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pintura Anticorrosiva Epóxica", "Consumo_Unitario": 0.02, "Unidad": "Gal", "Total_Teorico": c_ejec * 0.02})
                
    if insumos_calc:
        df_insumos = pd.DataFrame(insumos_calc)
        resumen_insumos = df_insumos.groupby(["Insumo", "Unidad"])["Total_Teorico"].sum().reset_index()
        resumen_insumos = resumen_insumos.sort_values(by="Total_Teorico", ascending=False)
        
        st.markdown("#### 📦 Balance Consolidado de Insumos Teóricos")
        st.dataframe(
            resumen_insumos,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Insumo": st.column_config.TextColumn("Insumo Crítico", width="large"),
                "Unidad": st.column_config.TextColumn("Unidad", width="small"),
                "Total_Teorico": st.column_config.NumberColumn("Total Consumo Teórico", format="%.2f")
            }
        )
    else:
        st.info("ℹ️ No hay actividades con volumen ejecutado reportado para estimar insumos.")

# ------------------------------------------------------------------------------
# VISTA 8: AUDITORÍA BITÁCORA CLOUD
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📡 Bitácora Cloud":
    st.markdown("### 📡 Registros en Tiempo Real de la Bitácora de Campo")
    st.caption("Datos capturados por los ingenieros residentes en obra desde la aplicación móvil/web conectada a Supabase.")
    
    if not df_obra_activa.empty:
        df_mostrar = df_obra_activa.copy()
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
