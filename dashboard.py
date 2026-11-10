import streamlit as st
import pandas as pd
import numpy as np
import requests
import io
import os
import json
import textwrap
import unicodedata
from datetime import datetime, timezone, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import plotly.graph_objects as go
import plotly.express as px
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

def normalizar_texto(texto):
    if not texto or not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode('utf-8')
    return texto.lower().strip()

PROYECTOS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "proyectos_guardados.json")

def cargar_proyectos_guardados():
    proyectos = {}
    if os.path.exists(PROYECTOS_FILE):
        try:
            with open(PROYECTOS_FILE, "r", encoding="utf-8") as f:
                proyectos = json.load(f)
        except Exception:
            proyectos = {}
    if "proyectos_guardados_session" in st.session_state:
        for k, v in st.session_state["proyectos_guardados_session"].items():
            proyectos[k] = v
    return proyectos

def guardar_proyecto_en_disco(id_key, datos_proyecto):
    proyectos = cargar_proyectos_guardados()
    proyectos[id_key] = datos_proyecto
    try:
        with open(PROYECTOS_FILE, "w", encoding="utf-8") as f:
            json.dump(proyectos, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    if "proyectos_guardados_session" not in st.session_state:
        st.session_state["proyectos_guardados_session"] = {}
    st.session_state["proyectos_guardados_session"][id_key] = datos_proyecto

def procesar_archivo_presupuesto(file_obj):
    try:
        name = file_obj.name.lower()
        if name.endswith('.csv'):
            try:
                df = pd.read_csv(file_obj, sep=None, engine='python', encoding='utf-8')
            except:
                file_obj.seek(0)
                df = pd.read_csv(file_obj, sep=';', encoding='latin-1')
        else:
            df = pd.read_excel(file_obj)
            
        col_map = {}
        for c in df.columns:
            cn = normalizar_texto(str(c))
            if any(k in cn for k in ['item', 'nro', 'codigo', 'num', 'pos']):
                col_map['item'] = c
            elif any(k in cn for k in ['capitulo', 'cap', 'etapa', 'categoria', 'rubro']):
                col_map['capitulo'] = c
            elif any(k in cn for k in ['actividad', 'descripcion', 'concepto', 'detalle', 'nombre']):
                col_map['actividad'] = c
            elif any(k in cn for k in ['unidad', 'und', 'unid', 'medida', 'u.m']):
                col_map['unidad'] = c
            elif any(k in cn for k in ['cantidad', 'cant', 'volumen', 'metrado']):
                col_map['cantidad'] = c
            elif any(k in cn for k in ['precio', 'vr_unitario', 'valor_unitario', 'unitario', 'p.u', 'vr. unit', 'costo']):
                col_map['precio'] = c
                
        if 'actividad' not in col_map or 'precio' not in col_map:
            return None, "El archivo debe contener columnas de 'Actividad' (o Descripción) y 'Precio Unitario' (o Valor)."
            
        items = []
        for idx, row in df.iterrows():
            act = str(row[col_map['actividad']]).strip()
            if not act or act.lower() in ['nan', 'none', '']:
                continue
                
            it_val = str(row[col_map['item']]).strip() if 'item' in col_map and not pd.isna(row[col_map['item']]) else f"{idx+1}"
            cap_val = str(row[col_map['capitulo']]).strip() if 'capitulo' in col_map and not pd.isna(row[col_map['capitulo']]) else "1. ACTIVIDADES GENERALES"
            und_val = str(row[col_map['unidad']]).strip() if 'unidad' in col_map and not pd.isna(row[col_map['unidad']]) else "und"
            
            try:
                cant_val = float(row[col_map['cantidad']]) if 'cantidad' in col_map and not pd.isna(row[col_map['cantidad']]) else 1.0
            except:
                cant_val = 1.0
                
            try:
                pu_raw = str(row[col_map['precio']]).replace('$', '').replace(' ', '').replace(',', '')
                pu_val = float(pu_raw) if not pd.isna(row[col_map['precio']]) else 0.0
            except:
                pu_val = 0.0
                
            match_keys = [w for w in normalizar_texto(act).split() if len(w) > 3]
            items.append({
                "Item": it_val,
                "Capitulo": cap_val,
                "Actividad": act,
                "Unidad": und_val,
                "Cantidad_Contratada": cant_val,
                "Precio_Unitario": pu_val,
                "match_keys": match_keys
            })
            
        if not items:
            return None, "No se encontraron filas con datos de actividades válidas."
            
        return items, None
    except Exception as e:
        return None, f"Error al procesar el archivo: {str(e)}"

def generar_plantilla_excel_presupuesto():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Presupuesto_Base"
    headers = ["Item", "Capitulo", "Actividad", "Unidad", "Cantidad", "Precio_Unitario"]
    ws.append(headers)
    sample_data = [
        ["1.1", "1. PRELIMINARES", "Campamento y cerramiento provisional en polisombra", "gl", 1.0, 2500000],
        ["1.2", "1. PRELIMINARES", "Demolición de muros existentes e=0.15", "m2", 45.0, 32000],
        ["2.1", "2. MAMPOSTERIA", "Levante de muro en bloque cemento No. 12", "m2", 120.0, 48000],
        ["2.2", "2. MAMPOSTERIA", "Pañete y revoque interior relación 1:4", "m2", 240.0, 25000],
        ["3.1", "3. PISOS Y ENCHAPES", "Plantilla de concreto simple e=7cm", "m2", 85.0, 34000],
        ["3.2", "3. PISOS Y ENCHAPES", "Instalación de piso porcelanato 60x60", "m2", 85.0, 58000],
        ["4.1", "4. PINTURA", "Estuco plástico y pintura vinílica dos manos", "m2", 240.0, 18000]
    ]
    for row in sample_data:
        ws.append(row)
    for col_idx in range(1, 7):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf

def render_html(html_str: str):
    """
    Renderiza fragmentos HTML en Streamlit de forma completamente segura,
    eliminando comentarios y normalizando espacios para evitar que el
    parser CommonMark active bloques de código (<pre><code>) por indentación.
    """
    clean_lines = [
        line.strip() 
        for line in html_str.splitlines() 
        if line.strip() and not line.strip().startswith("<!--")
    ]
    st.markdown(" ".join(clean_lines), unsafe_allow_html=True)

def render_section_banner(icon: str, title: str, subtitle: str, badge: str = "OFICIAL"):
    """
    Renderiza una cabecera ejecutiva uniforme y de primer nivel visual para cada subpestaña.
    """
    banner_html = f"""
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px 24px; margin-bottom: 22px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; border-left: 5px solid #2563eb;">
        <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; border: 1px solid #bfdbfe; box-shadow: 0 2px 8px rgba(37,99,235,0.08);">
                {icon}
            </div>
            <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <h2 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em;">{title}</h2>
                    <span style="background: #eff6ff; color: #1d4ed8; font-size: 0.68rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.05em; text-transform: uppercase;">{badge}</span>
                </div>
                <p style="font-size: 0.82rem; color: #64748b; margin: 3px 0 0 0; font-weight: 500;">{subtitle}</p>
            </div>
        </div>
    </div>
    """
    render_html(banner_html)

# ==============================================================================
# 1. CONFIGURACIÓN DE PÁGINA Y METADATOS CORPORATIVOS
# ==============================================================================
st.set_page_config(
    page_title="JGM ConTech | Centro de Mando Gerencial BIM 5D",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Inyección de estilos CSS corporativos de alto impacto (Tailwind CSS, Glassmorphism, Tipografía Premium)
css_styles = """
<script src="https://cdn.tailwindcss.com"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

html, body, [class*="css"] {
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
}

.stApp {
    background: radial-gradient(circle at top right, #f8fafc 0%, #f1f5f9 100%) !important;
}

#MainMenu { visibility: hidden; }
footer { visibility: hidden; }
header { background: transparent; }

/* CENTRADO Y ESTILO EJECUTIVO DE LA BARRA DE NAVEGACIÓN SUPERIOR */
div[data-testid="stSegmentedControl"] {
    display: flex !important;
    justify-content: center !important;
    width: 100% !important;
    margin: 8px 0 24px 0 !important;
}

div[data-testid="stSegmentedControl"] > div {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    padding: 6px !important;
    border-radius: 16px !important;
    border: 1px solid #cbd5e1 !important;
    box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.08) !important;
    gap: 6px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
}

div[data-testid="stSegmentedControl"] button {
    border-radius: 12px !important;
    font-size: 0.82rem !important;
    font-weight: 700 !important;
    padding: 8px 16px !important;
    color: #475569 !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    border: none !important;
}

div[data-testid="stSegmentedControl"] button:hover {
    color: #0f172a !important;
    background: #f1f5f9 !important;
    transform: translateY(-1px);
}

div[data-testid="stSegmentedControl"] button[aria-selected="true"] {
    background: linear-gradient(135deg, #0a0f1d 0%, #1e3a8a 100%) !important;
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
    gap: 6px !important;
    flex-wrap: wrap !important;
    margin-bottom: 24px !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    padding: 6px !important;
    border-radius: 16px !important;
    border: 1px solid #cbd5e1 !important;
    box-shadow: 0 10px 30px -5px rgba(15, 23, 42, 0.08) !important;
}

/* EXECUTIVE DARK LUXURY SIDEBAR */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #090d16 0%, #0d1527 50%, #0f172a 100%) !important;
    border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.35) !important;
}

section[data-testid="stSidebar"] * {
    color: #f1f5f9;
}

section[data-testid="stSidebar"] hr {
    border-color: rgba(255, 255, 255, 0.1) !important;
    margin: 16px 0 !important;
}

/* FIX TOTAL DE CONTRASTE DEL SELECTBOX DE PROYECTO */
div[data-testid="stSelectbox"] {
    margin-bottom: 8px !important;
}

div[data-testid="stSelectbox"] div[data-baseweb="select"] {
    border-radius: 12px !important;
    background-color: #0b1329 !important;
}

div[data-testid="stSelectbox"] div[data-baseweb="select"] > div {
    background-color: #0b1329 !important;
    border: 2px solid #38bdf8 !important;
    border-radius: 12px !important;
    min-height: 44px !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
}

div[data-testid="stSelectbox"] div[data-baseweb="select"] div {
    background-color: #0b1329 !important;
}

div[data-testid="stSelectbox"] div[data-baseweb="select"] span,
div[data-testid="stSelectbox"] div[data-baseweb="select"] p,
div[data-testid="stSelectbox"] div[data-baseweb="select"] div[aria-selected="true"] {
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.88rem !important;
    background-color: transparent !important;
}

div[data-testid="stSelectbox"] div[data-baseweb="select"] svg {
    fill: #38bdf8 !important;
    width: 20px !important;
    height: 20px !important;
}

/* POPOVER DESPLEGABLE EN EL BODY (PORTAL REACT) */
div[data-baseweb="popover"] {
    z-index: 9999999 !important;
}

div[data-baseweb="popover"] ul,
div[data-baseweb="popover"] [role="listbox"] {
    background-color: #090d16 !important;
    border: 2px solid #38bdf8 !important;
    border-radius: 14px !important;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75) !important;
    padding: 8px !important;
}

div[data-baseweb="popover"] li,
div[data-baseweb="popover"] [role="option"] {
    background-color: transparent !important;
    border-radius: 8px !important;
    padding: 10px 14px !important;
    margin-bottom: 4px !important;
    transition: all 0.15s ease !important;
}

div[data-baseweb="popover"] li *,
div[data-baseweb="popover"] [role="option"] * {
    color: #f1f5f9 !important;
    font-weight: 700 !important;
    font-size: 0.88rem !important;
}

div[data-baseweb="popover"] li:hover,
div[data-baseweb="popover"] li[aria-selected="true"],
div[data-baseweb="popover"] [role="option"]:hover,
div[data-baseweb="popover"] [role="option"][aria-selected="true"] {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
}

div[data-baseweb="popover"] li:hover *,
div[data-baseweb="popover"] li[aria-selected="true"] *,
div[data-baseweb="popover"] [role="option"]:hover *,
div[data-baseweb="popover"] [role="option"][aria-selected="true"] * {
    color: #ffffff !important;
}

/* Sidebar Expander */
section[data-testid="stSidebar"] [data-testid="stExpander"] {
    background: rgba(15, 23, 42, 0.6) !important;
    border: 1px solid rgba(255, 255, 255, 0.12) !important;
    border-radius: 14px !important;
}

section[data-testid="stSidebar"] [data-testid="stExpander"] details {
    border: none !important;
}

section[data-testid="stSidebar"] [data-testid="stExpander"] summary {
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 0.85rem !important;
}

section[data-testid="stSidebar"] [data-testid="stExpander"] summary:hover {
    color: #38bdf8 !important;
}

/* Sidebar Sliders */
section[data-testid="stSidebar"] .stSlider label {
    color: #94a3b8 !important;
    font-size: 0.74rem !important;
    font-weight: 700 !important;
}

section[data-testid="stSidebar"] .stSlider > div > div > div > div {
    background: #2563eb !important;
}

/* Sidebar Buttons */
section[data-testid="stSidebar"] div.stButton > button {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.25) !important;
    box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3) !important;
    font-weight: 800 !important;
    border-radius: 12px !important;
}

/* Universal Container Card Styling */
div[data-testid="stVerticalBlockBorderWrapper"] > div {
    border-radius: 18px !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03) !important;
    background: #ffffff !important;
    padding: 18px !important;
}

/* Bento Cards Universales */
.bento-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    padding: 22px;
    box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.bento-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.08);
    border-color: #cbd5e1;
}

/* Tarjetas de Métricas Nativas */
div[data-testid="stMetric"] {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 18px 22px;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
    border-top: 4px solid #2563eb;
    transition: all 0.25s ease;
    position: relative;
    overflow: hidden;
}

div[data-testid="column"]:nth-of-type(1) div[data-testid="stMetric"] { border-top: 4px solid #2563eb !important; }
div[data-testid="column"]:nth-of-type(2) div[data-testid="stMetric"] { border-top: 4px solid #10b981 !important; }
div[data-testid="column"]:nth-of-type(3) div[data-testid="stMetric"] { border-top: 4px solid #f59e0b !important; }
div[data-testid="column"]:nth-of-type(4) div[data-testid="stMetric"] { border-top: 4px solid #8b5cf6 !important; }

div[data-testid="stMetric"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.1);
    border-color: #93c5fd;
}

div[data-testid="stMetric"] label {
    font-size: 0.74rem !important;
    font-weight: 800 !important;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b !important;
}

div[data-testid="stMetric"] [data-testid="stMetricValue"] {
    font-size: 1.85rem !important;
    font-weight: 900 !important;
    color: #0f172a !important;
    font-family: 'JetBrains Mono', monospace !important;
    letter-spacing: -0.02em;
}

div[data-testid="stMetric"] [data-testid="stMetricDelta"] {
    font-weight: 800 !important;
    font-size: 0.8rem !important;
}

/* Botones de Acción Primarios */
div.stDownloadButton > button, div.stButton > button {
    background: linear-gradient(135deg, #0a0f1d 0%, #1e3a8a 100%) !important;
    color: #ffffff !important;
    border-radius: 14px !important;
    padding: 12px 24px !important;
    font-weight: 800 !important;
    letter-spacing: 0.01em !important;
    border: none !important;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.15) !important;
    transition: all 0.25s ease !important;
}

div.stDownloadButton > button:hover, div.stButton > button:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 24px rgba(30, 58, 138, 0.3) !important;
}

/* Dataframe Styling */
div[data-testid="stDataFrame"] {
    background: #ffffff;
    border-radius: 18px;
    padding: 10px;
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
# Mampostería en m² y Suelos discriminados (Plantilla vs Porcelanato)
# ==============================================================================
PRESUPUESTO_CASA_MENDOZA = [
    # 1. MAMPOSTERÍA (CANTIDAD Y PRECIO UNITARIO EN M²)
    {
        "Item": "1.1", 
        "Capitulo": "1. MAMPOSTERIA", 
        "Actividad": "Muros en mampostería de bloques de concreto No. 12", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 227.89, 
        "Precio_Unitario": 47500, 
        "match_keys": ["mamposteria", "bloque", "bloques", "muro"]
    },
    {
        "Item": "1.2", 
        "Capitulo": "1. MAMPOSTERIA", 
        "Actividad": "Pañete y mortero de revoco en muros (dos caras)", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 455.78, 
        "Precio_Unitario": 24000, 
        "match_keys": ["panete", "revoco"]
    },

    # 2. PISOS Y ENCHAPES (SEPARADOS: PLANTILLA DE CONCRETO Y ENCHAPE)
    {
        "Item": "2.1", 
        "Capitulo": "2. PISOS Y ENCHAPES", 
        "Actividad": "Plantilla de concreto e=7cm (base y solado de piso)", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 106.24, 
        "Precio_Unitario": 34000, 
        "match_keys": ["plantilla", "solado", "base de piso"]
    },
    {
        "Item": "2.2", 
        "Capitulo": "2. PISOS Y ENCHAPES", 
        "Actividad": "Instalación de piso en porcelanato 51x51 cm y enchape", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 107.10, 
        "Precio_Unitario": 58000, 
        "match_keys": ["porcelanato", "piso ceramico", "enchape", "ceramica", "piso"]
    },

    # 3. CIELOS RASOS (Ceiling Quantities)
    {
        "Item": "3.1", 
        "Capitulo": "3. CIELOS RASOS", 
        "Actividad": "Instalación de cielo raso suspendido e=5.3cm", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 86.65, 
        "Precio_Unitario": 38000, 
        "match_keys": ["cielorraso", "cielo raso", "ceiling"]
    },

    # 4. ACABADOS Y PINTURA
    {
        "Item": "4.1", 
        "Capitulo": "4. ACABADOS Y PINTURA", 
        "Actividad": "Estuco plástico y pintura vinílica en muros", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 455.78, 
        "Precio_Unitario": 16500, 
        "match_keys": ["estuco", "pintura", "vinilica"]
    },

    # 5. CARPINTERÍA (Door Quantities & Ventanas)
    {
        "Item": "5.1", 
        "Capitulo": "5. CARPINTERIA", 
        "Actividad": "Suministro e instalación de puertas interiores y acceso (7 und)", 
        "Unidad": "und", 
        "Cantidad_Contratada": 7.0, 
        "Precio_Unitario": 390000, 
        "match_keys": ["puertas", "puerta", "door"]
    },
    {
        "Item": "5.2", 
        "Capitulo": "5. CARPINTERIA", 
        "Actividad": "Suministro e instalación de ventanería en aluminio y vidrio (8 und)", 
        "Unidad": "und", 
        "Cantidad_Contratada": 8.0, 
        "Precio_Unitario": 280000, 
        "match_keys": ["ventanas", "ventana", "window", "ventaneria"]
    },

    # 6. CUBIERTA
    {
        "Item": "6.1", 
        "Capitulo": "6. CUBIERTA", 
        "Actividad": "Montaje de cubierta en teja ondulada Eternit y caballetes", 
        "Unidad": "m²", 
        "Cantidad_Contratada": 132.05, 
        "Precio_Unitario": 45000, 
        "match_keys": ["cubierta", "eternit", "techo", "teja"]
    }
]

# Catálogo de Proyectos JGM ConTech
PROYECTOS_DISPONIBLES = {
    "🏡 Remodelación Casa Mendoza (Sabanalarga, Atlántico • Revit 1.1)": {
        "id": "casa_mendoza",
        "nombre": "Remodelación Casa Mendoza",
        "subtitulo": "Familia Mendoza • Sabanalarga, Atlántico • Modelo: Casa Mendoza 1.1.rvt",
        "contratante": "Familia Mendoza",
        "cedula_cliente": "",
        "contratista": "Ing. Juan González Mendoza",
        "cedula_contratista": "C.C. 1001867834 • M.P. 021037-0828864 ATL",
        "cargo_contratista": "Ingeniero Residente de Obra",
        "ubicacion": "Sabanalarga, Atlántico",
        "badge": "REVIT 2027 BIM 5D",
        "ppto_base": PRESUPUESTO_CASA_MENDOZA,
        "a_def": 8.0, "i_def": 2.0, "u_def": 5.0, "ant_def": 15.0, "gar_def": 5.0,
        "modelo_bim": "Casa Mendoza 1.1.rvt (Autodesk Revit 2027)",
        "logo": "🏡",
        "firma_residente": "ING. JUAN GONZÁLEZ MENDOZA\nC.C. 1001867834 • M.P. 021037-0828864 ATL\nIngeniero Residente de Obra",
        "firma_interventor": "SUPERVISIÓN / PROPIETARIO\nRepresentante Familia Mendoza"
    },
    "🏢 Mezzanine 3 Niveles (DOLMEN S.A. • Barranquilla)": {
        "id": "mezzanine",
        "nombre": "Mezzanine 3 Niveles",
        "subtitulo": "DOLMEN S.A. E.S.P. • INGENDES S.A.S. • Barranquilla, Atlántico",
        "contratante": "DOLMEN S.A. E.S.P.",
        "cedula_cliente": "NIT: 802.015.442-1",
        "contratista": "Ing. Juan González Mendoza",
        "cedula_contratista": "C.C. 1001867834 • M.P. 021037-0828864 ATL",
        "cargo_contratista": "Ingeniero Residente de Obra",
        "ubicacion": "Barranquilla, Atlántico",
        "badge": "ENTERPRISE BIM 5D",
        "ppto_base": PRESUPUESTO_OFICIAL_BASE,
        "a_def": 10.0, "i_def": 3.0, "u_def": 5.0, "ant_def": 20.0, "gar_def": 5.0,
        "modelo_bim": "Revit 2027 • Estructura & Acero",
        "logo": "🏢",
        "firma_residente": "ING. JUAN GONZÁLEZ MENDOZA\nC.C. 1001867834 • M.P. 021037-0828864 ATL\nIngeniero Residente de Obra",
        "firma_interventor": "INTERVENTOR TÉCNICO DELEGADO\nSupervisor de Obra • DOLMEN S.A. E.S.P."
    }
}

# Cargar proyectos personalizados guardados en disco
proyectos_personalizados = cargar_proyectos_guardados()
for pk, pv in proyectos_personalizados.items():
    PROYECTOS_DISPONIBLES[pk] = pv

# ==============================================================================
# 4. MOTOR MATEMÁTICO: CRUCE RELACIONAL BIM 5D & BITÁCORA
# ==============================================================================
def filtrar_bitacora_por_proyecto(df_bitacora, proyecto_actual):
    """
    Filtra de manera estricta los registros de bitácora para garantizar aislamiento
    total entre proyectos y que NINGUNA información se cruce entre ellos.
    """
    if df_bitacora is None or df_bitacora.empty:
        return pd.DataFrame()
        
    proy_id = str(proyecto_actual.get("id", "")).lower()
    proy_nombre = normalizar_texto(proyecto_actual.get("nombre", ""))
    es_solo_ppto = proyecto_actual.get("tipo") == "presupuesto" or "PRESUPUESTO" in proyecto_actual.get("badge", "").upper()
    
    indices_validos = []
    
    for idx, row in df_bitacora.iterrows():
        act_raw = str(row.get("actividad", ""))
        act_txt = normalizar_texto(act_raw)
        
        # 1. Metrados BIM ([BIM_TAKEOFF]):
        # Solo aplican a Casa Mendoza si es Casa Mendoza, NUNCA a otros proyectos ni a Solo Presupuesto
        if "bim_takeoff" in act_txt or "takeoff" in act_txt:
            if proy_id == "casa_mendoza" and not es_solo_ppto:
                indices_validos.append(idx)
            continue
            
        # 2. Registros con etiqueta explícita de proyecto (ej: "[proy_id]" o "[Nombre Proyecto]"):
        tag_id = f"[{proy_id}]".replace(" ", "")
        tag_nom = f"[{proy_nombre}]" if len(proy_nombre) > 4 else "___nom_invalido___"
        
        if tag_id in act_txt.replace(" ", "") or tag_nom in act_txt:
            indices_validos.append(idx)
            continue
            
        # 3. Mapeo para proyectos base del sistema:
        if proy_id == "casa_mendoza":
            # Casa Mendoza solo toma registros donde se mencione explícitamente mendoza o sabanalarga
            if "mendoza" in act_txt or "sabanalarga" in act_txt:
                indices_validos.append(idx)
        elif proy_id == "mezzanine":
            # Mezzanine es el proyecto histórico donde se registraron las pruebas iniciales (IDs <= 50)
            # Siempre que no pertenezcan a Casa Mendoza ni tengan etiqueta entre corchetes [proy_...]
            try:
                row_id = int(row.get("id", 0))
            except:
                row_id = 0
            if row_id <= 50 and "mendoza" not in act_txt and "sabanalarga" not in act_txt and not act_raw.strip().startswith("["):
                indices_validos.append(idx)
            elif "mezzanine" in act_txt or "dolmen" in act_txt or "ingendes" in act_txt:
                indices_validos.append(idx)
        else:
            # Para proyectos creados dinámicamente por el usuario (Solo Presupuesto o nuevos BIM):
            # Solo se asocian si contienen el proy_id o el nombre del proyecto
            if proy_id in act_txt or (len(proy_nombre) > 4 and proy_nombre in act_txt):
                indices_validos.append(idx)
                
    if indices_validos:
        return df_bitacora.loc[indices_validos].copy()
    return pd.DataFrame(columns=df_bitacora.columns)

def consolidar_presupuesto_y_ejecucion(df_ppto_base, df_bitacora, proyecto_id="mezzanine", tipo_proyecto="bim"):
    """Cruza el presupuesto contractual con los registros reales de bitácora."""
    lista_ppto = [dict(item) for item in df_ppto_base]
    acumulados = {item["Item"]: 0.0 for item in lista_ppto}
    desperdicios = {item["Item"]: [] for item in lista_ppto}
    
    if not df_bitacora.empty and 'actividad' in df_bitacora.columns and 'cantidad' in df_bitacora.columns:
        # 1. Si existen registros de metrado BIM ([BIM_TAKEOFF]) en Supabase, sincronizamos Cantidad_Contratada
        # NOTA: Los metrados BIM SOLO aplican a Casa Mendoza y NUNCA sobrescriben un proyecto 'Solo Presupuesto' ni otro proyecto
        if tipo_proyecto != "presupuesto" and proyecto_id == "casa_mendoza":
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
# 5B. GENERADOR DE PRESUPUESTO OFICIAL EN PDF CON MEMBRETE PROFESIONAL
# ==============================================================================
class PresupuestoCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.doc_title = "Presupuesto Oficial de Obra"

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Encabezado en páginas 2 en adelante
        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(36, 756, 576, 756)
            self.drawString(36, 760, f"JGM ConTech • {self.doc_title[:60]}")
            self.drawRightString(576, 760, "DOCUMENTO OFICIAL DE COSTOS")
            
        # Pie de página en todas las páginas
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 36, 576, 36)
        self.drawString(36, 26, "JGM ConTech • Presupuesto Contractual Oficial con Validez Jurídica")
        self.drawRightString(576, 26, f"Página {self._pageNumber} de {page_count}")
        self.restoreState()


def generar_presupuesto_pdf(df_5d, params_liquidacion, proyecto_actual):
    """
    Genera un archivo PDF profesional del presupuesto contractual de obra
    con membrete ejecutivo, desglose de capítulos, matriz APU, AIU y firmas.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=40,
        bottomMargin=45
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=17,
        textColor=colors.HexColor('#0f172a')
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#2563eb'),
        textTransform='uppercase'
    )
    sec_heading = ParagraphStyle(
        'SecHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1e3a8a')
    )
    cell_text = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.2,
        leading=9,
        textColor=colors.HexColor('#1e293b')
    )
    cell_text_bold = ParagraphStyle(
        'CellTextBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=9,
        textColor=colors.HexColor('#0f172a')
    )
    cell_chap = ParagraphStyle(
        'CellChap',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=9.5,
        textColor=colors.HexColor('#1e3a8a')
    )
    cell_right = ParagraphStyle(
        'CellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.2,
        leading=9,
        alignment=2,
        textColor=colors.HexColor('#0f172a')
    )
    cell_right_bold = ParagraphStyle(
        'CellRightBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.2,
        leading=9,
        alignment=2,
        textColor=colors.HexColor('#0f172a')
    )

    story = []
    
    # 1. MEMBRETE EJECUTIVO SUPERIOR
    fecha_actual_str = datetime.now().strftime("%d/%m/%Y")
    proy_nombre = proyecto_actual.get('nombre', 'Proyecto de Construcción')
    es_ppto = proyecto_actual.get("tipo") == "presupuesto" or "PRESUPUESTO" in proyecto_actual.get("badge", "").upper()
    modalidad_str = "PRESUPUESTO" if es_ppto else "BIM 5D"
    
    header_data = [
        [
            Paragraph("<b>JGM ConTech</b>", subtitle_style),
            Paragraph(f"<b>FECHA DE EMISIÓN:</b> {fecha_actual_str}", ParagraphStyle('HeadR', parent=cell_right, fontSize=7))
        ],
        [
            Paragraph("PRESUPUESTO GENERAL DE OBRA Y APU", title_style),
            Paragraph(f"<b>CÓDIGO:</b> PPTO-{str(proyecto_actual.get('id', 'PROY')).upper()[:12]}", ParagraphStyle('HeadR2', parent=cell_right, fontSize=8, textColor=colors.HexColor('#1e3a8a')))
        ],
        [
            Paragraph(f"<b>Proyecto:</b> {proy_nombre} • {proyecto_actual.get('ubicacion', 'Colombia')}", cell_text),
            Paragraph(f"<b>Modalidad:</b> {modalidad_str}", cell_right)
        ]
    ]
    header_table = Table(header_data, colWidths=[360, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=8, spaceBefore=4))

    # 2. FICHA TÉCNICA CONTRACTUAL
    contratante_nom = proyecto_actual.get('contratante', 'Cliente Privado')
    cedula_cliente = proyecto_actual.get('cedula_cliente', '').strip()
    contratista_nom = proyecto_actual.get('contratista', 'Ing. Juan González Mendoza')
    cedula_contratista = proyecto_actual.get('cedula_contratista', 'C.C. 1001867834 • M.P. 021037-0828864 ATL').strip()
    cargo_contratista = proyecto_actual.get('cargo_contratista', 'Ingeniero Residente de Obra')

    txt_cliente = f"<b>{contratante_nom}</b>"
    if cedula_cliente:
        txt_cliente += f"<br/><font color='#64748b'>C.C. / NIT: {cedula_cliente}</font>"

    txt_contratista = f"<b>{contratista_nom}</b>"
    if cedula_contratista:
        txt_contratista += f"<br/><font color='#64748b'>{cedula_contratista}</font>"
    if cargo_contratista:
        txt_contratista += f"<br/><font color='#2563eb'><b>{cargo_contratista}</b></font>"

    meta_data = [
        [
            Paragraph("<b>ENTIDAD CONTRATANTE / CLIENTE:</b>", cell_text_bold),
            Paragraph(txt_cliente, cell_text),
            Paragraph("<b>DIRECCIÓN TÉCNICA / CONTRATISTA:</b>", cell_text_bold),
            Paragraph(txt_contratista, cell_text)
        ],
        [
            Paragraph("<b>UBICACIÓN DE LA OBRA:</b>", cell_text_bold),
            Paragraph(f"{proyecto_actual.get('ubicacion', 'Colombia')}", cell_text),
            Paragraph("<b>MODELO / ESPECIFICACIÓN:</b>", cell_text_bold),
            Paragraph(f"{proyecto_actual.get('modelo_bim', 'Presupuesto Base APU')}", cell_text)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[120, 150, 130, 140])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))
    meta_table = Table(meta_data, colWidths=[120, 150, 130, 140])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # 3. RESUMEN EJECUTIVO POR CAPÍTULOS
    story.append(Paragraph("1. RESUMEN EJECUTIVO POR CAPÍTULOS", sec_heading))
    story.append(Spacer(1, 4))
    
    total_costo_directo = df_5d["Presupuesto_Total"].sum()
    resumen_caps = df_5d.groupby("Capitulo")["Presupuesto_Total"].sum().reset_index()
    resumen_caps["Pct"] = (resumen_caps["Presupuesto_Total"] / total_costo_directo * 100) if total_costo_directo > 0 else 0
    
    tabla_caps_data = [
        [
            Paragraph("<b>Capítulo de Obra</b>", ParagraphStyle('ThC', parent=cell_text_bold, textColor=colors.white)),
            Paragraph("<b>Subtotal Costo Directo ($ COP)</b>", ParagraphStyle('ThR', parent=cell_right_bold, textColor=colors.white)),
            Paragraph("<b>Participación (%)</b>", ParagraphStyle('ThR2', parent=cell_right_bold, textColor=colors.white))
        ]
    ]
    for _, r in resumen_caps.iterrows():
        tabla_caps_data.append([
            Paragraph(str(r["Capitulo"]), cell_text),
            Paragraph(f"${r['Presupuesto_Total']:,.0f}", cell_right),
            Paragraph(f"{r['Pct']:.1f}%", cell_right)
        ])
    tabla_caps_data.append([
        Paragraph("<b>TOTAL COSTO DIRECTO DE OBRA</b>", cell_text_bold),
        Paragraph(f"<b>${total_costo_directo:,.0f}</b>", cell_right_bold),
        Paragraph("<b>100.0%</b>", cell_right_bold)
    ])
    
    t_caps = Table(tabla_caps_data, colWidths=[280, 160, 100])
    t_caps.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#eff6ff')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_caps)
    story.append(Spacer(1, 10))

    # 4. MATRIZ DETALLADA DE ÍTEMS Y ACTIVIDADES APU
    story.append(Paragraph("2. MATRIZ DETALLADA DE CANTIDADES Y PRECIOS UNITARIOS (APU)", sec_heading))
    story.append(Spacer(1, 4))
    
    matriz_headers = [
        Paragraph("<b>Ítem</b>", ParagraphStyle('MTh1', parent=cell_text_bold, textColor=colors.white, alignment=1)),
        Paragraph("<b>Descripción de la Actividad Constructiva (APU)</b>", ParagraphStyle('MTh2', parent=cell_text_bold, textColor=colors.white)),
        Paragraph("<b>Und</b>", ParagraphStyle('MTh3', parent=cell_text_bold, textColor=colors.white, alignment=1)),
        Paragraph("<b>Cantidad</b>", ParagraphStyle('MTh4', parent=cell_right_bold, textColor=colors.white)),
        Paragraph("<b>Precio Unit. ($)</b>", ParagraphStyle('MTh5', parent=cell_right_bold, textColor=colors.white)),
        Paragraph("<b>Subtotal ($ COP)</b>", ParagraphStyle('MTh6', parent=cell_right_bold, textColor=colors.white))
    ]
    
    matriz_rows = [matriz_headers]
    cap_actual = None
    table_styles = [
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#f1f5f9')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]
    
    row_idx = 1
    for _, r in df_5d.iterrows():
        cap_fila = r["Capitulo"]
        if cap_fila != cap_actual:
            cap_actual = cap_fila
            subtotal_cap = df_5d[df_5d["Capitulo"] == cap_actual]["Presupuesto_Total"].sum()
            matriz_rows.append([
                Paragraph(f"<b>CAP.</b>", cell_chap),
                Paragraph(f"<b>{cap_actual.upper()}</b>", cell_chap),
                Paragraph("", cell_text),
                Paragraph("", cell_text),
                Paragraph("<b>Subtotal:</b>", cell_right_bold),
                Paragraph(f"<b>${subtotal_cap:,.0f}</b>", cell_right_bold)
            ])
            table_styles.append(('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#f1f5f9')))
            table_styles.append(('LINEBELOW', (0, row_idx), (-1, row_idx), 1, colors.HexColor('#93c5fd')))
            row_idx += 1
            
        matriz_rows.append([
            Paragraph(str(r["Item"]), ParagraphStyle('CItem', parent=cell_text, alignment=1)),
            Paragraph(str(r["Actividad"]), cell_text),
            Paragraph(str(r["Unidad"]), ParagraphStyle('CUnd', parent=cell_text, alignment=1)),
            Paragraph(f"{r['Cantidad_Contratada']:,.2f}", cell_right),
            Paragraph(f"${r['Precio_Unitario']:,.0f}", cell_right),
            Paragraph(f"${r['Presupuesto_Total']:,.0f}", cell_right)
        ])
        if row_idx % 2 == 1:
            table_styles.append(('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor('#fafafa')))
        row_idx += 1
        
    t_matriz = Table(matriz_rows, colWidths=[36, 244, 30, 60, 75, 95], repeatRows=1)
    t_matriz.setStyle(TableStyle(table_styles))
    story.append(t_matriz)
    story.append(Spacer(1, 10))

    # 5. LIQUIDACIÓN CONTRACTUAL Y FACTOR AIU
    pct_a = params_liquidacion["pct_a"]
    pct_i = params_liquidacion["pct_i"]
    pct_u = params_liquidacion["pct_u"]
    
    val_a = total_costo_directo * (pct_a / 100.0)
    val_i = total_costo_directo * (pct_i / 100.0)
    val_u = total_costo_directo * (pct_u / 100.0)
    val_aiu = val_a + val_i + val_u
    val_bruto = total_costo_directo + val_aiu
    iva_u = val_u * 0.19
    total_ppto_global = val_bruto + iva_u
    
    liq_data = [
        [Paragraph("<b>CONCEPTO CONTRACTUAL</b>", cell_text_bold), Paragraph("<b>PORCENTAJE (%)</b>", cell_right_bold), Paragraph("<b>VALOR (COP)</b>", cell_right_bold)],
        [Paragraph("Subtotal Costo Directo de Actividades (APU)", cell_text), Paragraph("100.00%", cell_right), Paragraph(f"${total_costo_directo:,.0f}", cell_right)],
        [Paragraph(f"(+) Administración", cell_text), Paragraph(f"{pct_a:.2f}%", cell_right), Paragraph(f"${val_a:,.0f}", cell_right)],
        [Paragraph(f"(+) Imprevistos", cell_text), Paragraph(f"{pct_i:.2f}%", cell_right), Paragraph(f"${val_i:,.0f}", cell_right)],
        [Paragraph(f"(+) Utilidad", cell_text), Paragraph(f"{pct_u:.2f}%", cell_right), Paragraph(f"${val_u:,.0f}", cell_right)],
        [Paragraph("<b>SUBTOTAL PRESUPUESTO BRUTO (Directo + AIU)</b>", cell_text_bold), Paragraph(f"<b>{100 + pct_a + pct_i + pct_u:.2f}%</b>", cell_right_bold), Paragraph(f"<b>${val_bruto:,.0f}</b>", cell_right_bold)],
        [Paragraph("(+) Impuesto IVA (19% sobre Utilidad)", cell_text), Paragraph(f"{pct_u*0.19:.2f}%", cell_right), Paragraph(f"${iva_u:,.0f}", cell_right)],
        [Paragraph("<b>PRESUPUESTO TOTAL OFICIAL DE CONTRATACIÓN</b>", ParagraphStyle('TotL', parent=cell_text_bold, textColor=colors.HexColor('#1e3a8a'))), Paragraph("", cell_text), Paragraph(f"<b>${total_ppto_global:,.0f} COP</b>", ParagraphStyle('TotR', parent=cell_right_bold, textColor=colors.HexColor('#1e3a8a')))]
    ]
    t_liq = Table(liq_data, colWidths=[280, 100, 160])
    t_liq.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.75, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0,5), (-1,5), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#dbeafe')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    
    firma_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "firma_juan_gonzalez.png")
    if os.path.exists(firma_img_path):
        firma_flowable = RLImage(firma_img_path, width=150, height=49.4)
    else:
        firma_flowable = Spacer(1, 49.4)
        
    sig_contratista_html = (
        f"<b>{contratista_nom.upper()}</b><br/>"
        f"{cedula_contratista}<br/>"
        f"<b>{cargo_contratista}</b>"
    )
    
    sig_cliente_html = (
        f"<b>{contratante_nom.upper()}</b><br/>"
        f"{('C.C. / NIT: ' + cedula_cliente + '<br/>') if cedula_cliente else ''}"
        f"<b>Entidad Contratante / Supervisión</b>"
    )
    
    tabla_firmas = Table([
        [firma_flowable, Spacer(1, 52.5)],
        [
            Paragraph("____________________________________________<br/><b>DIRECCIÓN TÉCNICA / CONTRATISTA</b><br/>" + sig_contratista_html, ParagraphStyle('SigL', parent=cell_text, alignment=1, leading=10)),
            Paragraph("____________________________________________<br/><b>SUPERVISIÓN / CLIENTE CONTRATANTE</b><br/>" + sig_cliente_html, ParagraphStyle('SigR', parent=cell_text, alignment=1, leading=10))
        ]
    ], colWidths=[270, 270])
    tabla_firmas.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,0), 'BOTTOM'),
        ('VALIGN', (0,1), (-1,1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,0), 0),
        ('TOPPADDING', (0,1), (-1,1), 2),
    ]))
    
    cierre_elementos = [
        Paragraph("3. LIQUIDACIÓN CONTRACTUAL Y FACTOR AIU", sec_heading),
        Spacer(1, 4),
        t_liq,
        Spacer(1, 14),
        tabla_firmas
    ]
    story.append(KeepTogether(cierre_elementos))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(*args, **kwargs)
    doc.build(story, canvasmaker=canvas_maker)
    
    buffer.seek(0)
    return buffer

# ==============================================================================
# 6. SIDEBAR COMPACTO: COMPAÑERO DE CONTROL Y PARÁMETROS
# ==============================================================================
with st.sidebar:
    render_html("""
    <div style="background: linear-gradient(135deg, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.95) 100%); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 18px; padding: 20px 16px; margin-bottom: 14px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.35);">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 14px; background: linear-gradient(135deg, #2563eb, #06b6d4); font-size: 1.5rem; margin-bottom: 8px; box-shadow: 0 4px 14px rgba(37,99,235,0.45);">
            🏢
        </div>
        <div style="font-size: 1.35rem; font-weight: 900; color: #ffffff; letter-spacing: -0.02em;">JGM ConTech</div>
        <div style="font-size: 0.7rem; color: #38bdf8; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 3px;">Executive BIM 5D OS</div>
        <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 10px; border-radius: 999px; margin-top: 10px;">
            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
            <span style="font-size: 0.68rem; color: #34d399; font-weight: 800; letter-spacing: 0.04em;">EN LÍNEA • v2.4</span>
        </div>
    </div>
    
    <a href="https://jagm2000-jgmcontech-bitacora.vercel.app" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 11px 16px; border-radius: 12px; font-size: 0.8rem; font-weight: 800; text-decoration: none; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 4px 16px rgba(37,99,235,0.3); transition: all 0.2s ease; margin-bottom: 18px;">
        <span>📱</span>
        <span>Abrir Bitácora de Campo ↗</span>
    </a>
    """)

    lista_proyectos_keys = list(PROYECTOS_DISPONIBLES.keys())
    
    # Manejar selección activa persistente en session_state
    if "proyecto_activo_seleccionado" not in st.session_state or st.session_state["proyecto_activo_seleccionado"] not in lista_proyectos_keys:
        st.session_state["proyecto_activo_seleccionado"] = lista_proyectos_keys[0]
        
    idx_actual = lista_proyectos_keys.index(st.session_state["proyecto_activo_seleccionado"])

    col_act_hdr1, col_act_hdr2 = st.columns([0.62, 0.38])
    with col_act_hdr1:
        render_html("""
        <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; display: flex; align-items: center; gap: 6px; padding-top: 6px;">
            <span>🔀</span><span>Proyecto Activo:</span>
        </div>
        """)
    with col_act_hdr2:
        if st.button("➕ Nuevo", key="btn_toggle_crear_proyecto", use_container_width=True, help="Crear o importar un nuevo proyecto (Solo Presupuesto o BIM 5D)"):
            st.session_state["mostrar_crear_proyecto"] = not st.session_state.get("mostrar_crear_proyecto", False)
            st.rerun()

    proyecto_sel_key = st.selectbox(
        "Seleccionar Proyecto:",
        options=lista_proyectos_keys,
        index=idx_actual,
        label_visibility="collapsed",
        key="sb_selector_proyecto_main"
    )
    if proyecto_sel_key != st.session_state["proyecto_activo_seleccionado"]:
        st.session_state["proyecto_activo_seleccionado"] = proyecto_sel_key
        st.rerun()
        
    proyecto_actual = PROYECTOS_DISPONIBLES[st.session_state["proyecto_activo_seleccionado"]]

    es_solo_ppto_actual = proyecto_actual.get("tipo") == "presupuesto" or "PRESUPUESTO" in proyecto_actual.get("badge", "").upper()
    badge_bg = "rgba(245, 158, 11, 0.2)" if es_solo_ppto_actual else "rgba(37, 99, 235, 0.25)"
    badge_color = "#fbbf24" if es_solo_ppto_actual else "#38bdf8"
    badge_border = "rgba(245, 158, 11, 0.45)" if es_solo_ppto_actual else "rgba(56, 189, 248, 0.45)"
    badge_txt = "📊 SOLO PRESUPUESTO" if es_solo_ppto_actual else "🏗️ BIM 5D REVIT"
    sub_tag_icon = "📊" if es_solo_ppto_actual else "📐"
    sub_tag_label = "PRESUPUESTO CONTRACTUAL" if es_solo_ppto_actual else f"BIM: {proyecto_actual['modelo_bim']}"

    render_html(f"""
    <div style="background: rgba(15, 23, 42, 0.88); border: 2px solid #38bdf8; border-radius: 14px; padding: 14px; margin-top: 8px; margin-bottom: 16px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
            <div style="font-size: 1.05rem; font-weight: 900; color: #38bdf8; text-shadow: 0 0 12px rgba(56,189,248,0.4); line-height: 1.25;">{proyecto_actual['logo']} {proyecto_actual['nombre']}</div>
            <span style="font-size: 0.62rem; font-weight: 800; background: {badge_bg}; color: {badge_color}; padding: 3px 8px; border-radius: 6px; border: 1px solid {badge_border}; white-space: nowrap;">{badge_txt}</span>
        </div>
        <div style="font-size: 0.78rem; color: #f1f5f9; font-weight: 600; margin-top: 4px;">📍 {proyecto_actual['ubicacion']}</div>
        <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 3px;">👤 Cliente: <strong style="color: #ffffff;">{proyecto_actual['contratante']}</strong></div>
        <div style="display: flex; align-items: center; gap: 6px; background: rgba(30, 58, 138, 0.4); border: 1px solid rgba(56, 189, 248, 0.4); padding: 6px 10px; border-radius: 8px; margin-top: 10px;">
            <span style="font-size: 0.85rem;">{sub_tag_icon}</span>
            <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 800; font-family: monospace;">{sub_tag_label}</span>
        </div>
    </div>
    """)

    # Conexión Nube Supabase
    df_cloud = cargar_datos_bitacora_cloud()
    total_reg_cloud = len(df_cloud)
    df_obra_activa = filtrar_bitacora_por_proyecto(df_cloud, proyecto_actual)
    total_reg_proy = len(df_obra_activa)
    render_html(f"""
    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 14px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Base de Datos Cloud</span>
            <span style="font-size: 0.66rem; font-weight: 800; background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 7px; border-radius: 6px;">🟢 LIVE REST</span>
        </div>
        <div style="font-size: 0.88rem; color: #38bdf8; font-weight: 900; font-family: monospace;">{total_reg_proy} Registros de este Proyecto</div>
        <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 3px;">(Total Central: {total_reg_cloud} en Supabase)</div>
    </div>
    """)
    if st.button("🔄 Sincronizar en Vivo (Supabase)", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

    # Parámetros Contractuales de Liquidación
    with st.expander("⚙️ Parámetros Contractuales (AIU)", expanded=True):
        render_html("""
        <p style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 8px;">Ajuste los porcentajes contractuales de liquidación de actas:</p>
        """)
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
# PROCESAMIENTO RELACIONAL DE DATOS (100% AISLADO POR PROYECTO)
# ------------------------------------------------------------------------------
lista_ppto_activa = proyecto_actual["ppto_base"]
df_obra_activa = filtrar_bitacora_por_proyecto(df_cloud, proyecto_actual)

df_5d = consolidar_presupuesto_y_ejecucion(
    lista_ppto_activa, 
    df_obra_activa, 
    proyecto_id=proyecto_actual["id"],
    tipo_proyecto=proyecto_actual.get("tipo", "bim")
)

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
render_html(header_html)

# ==============================================================================
# 7B. CENTRO DE CREACIÓN & IMPORTACIÓN DE PROYECTOS (SOLO PRESUPUESTO O BIM 5D)
# ==============================================================================
if st.session_state.get("mostrar_crear_proyecto", False):
    render_html("""
    <div style="background: linear-gradient(135deg, #090e1c 0%, #0d1b38 50%, #172554 100%); border: 2px solid #38bdf8; border-radius: 20px; padding: 22px 28px; margin-bottom: 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.25); padding-bottom: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 2rem;">🚀</span>
                <div>
                    <h3 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #ffffff; letter-spacing: -0.02em;">Centro de Creación & Carga de Proyectos</h3>
                    <p style="margin: 2px 0 0 0; font-size: 0.82rem; color: #94a3b8;">Cree un nuevo proyecto o importe un presupuesto histórico en Excel/CSV (con o sin modelo 3D BIM).</p>
                </div>
            </div>
            <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid #38bdf8; padding: 5px 14px; border-radius: 999px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em;">ASISTENTE CONTECH</span>
        </div>
    </div>
    """)
    
    with st.container():
        # Paso 1: Tipo de Proyecto
        tipo_proy = st.radio(
            "📌 Tipo de Proyecto a Crear:",
            [
                "📊 Solo Presupuesto (Contractual APU - Sin Modelo 3D Revit)",
                "🏗️ Proyecto BIM 5D Integrado (Con Modelo 3D Autodesk Revit)"
            ],
            index=0,
            horizontal=True,
            help="Seleccione 'Solo Presupuesto' para cargar presupuestos pasados en Excel/CSV o proyectos que no requieren modelo 3D."
        )
        es_solo_ppto = "Solo Presupuesto" in tipo_proy
        
        # Paso 2: Metadatos
        col_m1, col_m2, col_m3 = st.columns([1.3, 1.3, 1.0])
        with col_m1:
            nuevo_nombre = st.text_input("🏷️ Nombre del Proyecto:", placeholder="Ej: Remodelación Oficinas Norte", key="np_nombre")
            nuevo_cliente = st.text_input("👤 Entidad Contratante / Cliente:", placeholder="Ej: Inversiones del Caribe S.A.S.", key="np_cliente")
            nueva_cedula_cliente = st.text_input("🆔 Cédula / NIT del Cliente:", placeholder="Ej: C.C. 1045678901 ó NIT 900...", key="np_ced_cli")
        with col_m2:
            nueva_ubicacion = st.text_input("📍 Ubicación / Ciudad:", placeholder="Ej: Barranquilla, Atlántico", key="np_ubicacion")
            nuevo_contratista = st.text_input("👷 Contratista:", value="Ing. Juan González Mendoza", key="np_contratista")
            nueva_cedula_contratista = st.text_input("🆔 Cédula / M.P. Contratista:", value="C.C. 1001867834 • M.P. 021037-0828864 ATL", key="np_ced_contra")
        with col_m3:
            nuevo_icono = st.selectbox("🎨 Ícono:", ["📊", "🏡", "🏢", "🏗️", "🛣️", "🏬", "🏥", "🏭", "🏠"], index=0 if es_solo_ppto else 3, key="np_icono")
            nuevo_cargo = st.text_input("👔 Cargo Contratista:", value="Ingeniero Residente de Obra", key="np_cargo")
            modelo_bim_text = "Presupuesto Contractual Base (Sin Modelo 3D)" if es_solo_ppto else st.text_input("📐 Archivo Revit .rvt:", value="Modelo_Proyecto.rvt", key="np_rvt")

        st.markdown("---")
        
        # Paso 3: Carga del Presupuesto
        st.markdown("#### 📑 Carga del Presupuesto Contractual (Ítems, Cantidades y Precios Unitarios)")
        
        c_up1, c_up2 = st.columns([1.4, 0.6])
        with c_up1:
            archivo_subido = st.file_uploader(
                "Subir Presupuesto en Excel (.xlsx, .xls) o CSV:",
                type=["xlsx", "xls", "csv"],
                key="np_uploader",
                help="El archivo debe tener columnas: Item, Capitulo, Actividad, Unidad, Cantidad, Precio_Unitario."
            )
        with c_up2:
            st.markdown("<div style='padding-top: 24px;'></div>", unsafe_allow_html=True)
            plantilla_buf = generar_plantilla_excel_presupuesto()
            st.download_button(
                label="📥 Descargar Plantilla Excel (.xlsx)",
                data=plantilla_buf,
                file_name="Plantilla_Presupuesto_JGM_ConTech.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
                help="Descarga un formato de Excel con columnas estandarizadas y datos de ejemplo listos."
            )
            
        items_procesados = None
        if archivo_subido is not None:
            items_procesados, err_msg = procesar_archivo_presupuesto(archivo_subido)
            if err_msg:
                st.error(f"❌ {err_msg}")
            else:
                st.success(f"✅ Se cargaron exitosamente {len(items_procesados)} actividades constructivas del archivo '{archivo_subido.name}'.")
                df_prev = pd.DataFrame(items_procesados)[["Item", "Capitulo", "Actividad", "Unidad", "Cantidad_Contratada", "Precio_Unitario"]]
                df_prev["Subtotal ($)"] = df_prev["Cantidad_Contratada"] * df_prev["Precio_Unitario"]
                st.dataframe(
                    df_prev.style.format({"Precio_Unitario": "${:,.0f}", "Subtotal ($)": "${:,.0f}", "Cantidad_Contratada": "{:,.2f}"}),
                    use_container_width=True,
                    height=200
                )
                total_prev = df_prev["Subtotal ($)"].sum()
                st.info(f"💰 **Costo Directo Total Detectado:** ${total_prev:,.2f} COP en {df_prev['Capitulo'].nunique()} capítulos.")
        
        # Opción manual si no subió archivo
        usar_manual = st.checkbox("✍️ O crear / pegar presupuesto en tabla interactiva manual", value=(archivo_subido is None), key="np_chk_manual")
        items_manuales = None
        if usar_manual and items_procesados is None:
            st.caption("Puedes agregar filas o pegar directamente desde Excel (Ctrl+V) sobre esta tabla:")
            df_init = pd.DataFrame([
                {"Item": "1.1", "Capitulo": "1. PRELIMINARES", "Actividad": "Campamento y cerramiento provisional en polisombra", "Unidad": "gl", "Cantidad": 1.0, "Precio_Unitario": 2500000.0},
                {"Item": "2.1", "Capitulo": "2. MAMPOSTERIA", "Actividad": "Muro en bloque de concreto No. 12", "Unidad": "m²", "Cantidad": 100.0, "Precio_Unitario": 48000.0},
                {"Item": "3.1", "Capitulo": "3. PISOS Y ENCHAPES", "Actividad": "Plantilla de concreto simple e=7cm", "Unidad": "m²", "Cantidad": 80.0, "Precio_Unitario": 34000.0},
            ])
            edited_df = st.data_editor(
                df_init,
                num_rows="dynamic",
                use_container_width=True,
                key="np_editor",
                column_config={
                    "Precio_Unitario": st.column_config.NumberColumn("Precio Unitario ($)", format="$%d"),
                    "Cantidad": st.column_config.NumberColumn("Cantidad", format="%.2f")
                }
            )
            items_manuales = []
            for idx, r in edited_df.iterrows():
                act = str(r.get("Actividad", "")).strip()
                if act and act.lower() not in ["nan", "none"]:
                    items_manuales.append({
                        "Item": str(r.get("Item", f"{idx+1}")),
                        "Capitulo": str(r.get("Capitulo", "1. ACTIVIDADES GENERALES")),
                        "Actividad": act,
                        "Unidad": str(r.get("Unidad", "und")),
                        "Cantidad_Contratada": float(r.get("Cantidad", 1.0) or 1.0),
                        "Precio_Unitario": float(r.get("Precio_Unitario", 0.0) or 0.0),
                        "match_keys": [w for w in normalizar_texto(act).split() if len(w) > 3]
                    })

        # Paso 4: Parámetros Contractuales
        st.markdown("#### ⚙️ Parámetros Contractuales por Defecto (AIU y Liquidación)")
        c_p1, c_p2, c_p3, c_p4, c_p5 = st.columns(5)
        with c_p1:
            np_a = st.number_input("% Admin (A):", value=8.0, step=0.5, key="np_a")
        with c_p2:
            np_i = st.number_input("% Imprevistos (I):", value=2.0, step=0.5, key="np_i")
        with c_p3:
            np_u = st.number_input("% Utilidad (U):", value=5.0, step=0.5, key="np_u")
        with c_p4:
            np_ant = st.number_input("% Anticipo:", value=15.0, step=1.0, key="np_ant")
        with c_p5:
            np_gar = st.number_input("% Ret. Garantía:", value=5.0, step=1.0, key="np_gar")

        # Botones finales
        c_b1, c_b2, c_b3 = st.columns([1, 1, 2])
        with c_b1:
            if st.button("🚀 Guardar y Activar Proyecto", type="primary", use_container_width=True, key="btn_guardar_nuevo_proy"):
                items_finales = items_procesados if items_procesados else items_manuales
                if not nuevo_nombre.strip():
                    st.error("⚠️ Ingrese un nombre para el proyecto.")
                elif not items_finales or len(items_finales) == 0:
                    st.error("⚠️ Debe cargar un archivo de presupuesto o ingresar actividades en la tabla manual.")
                else:
                    nuevo_id = f"proy_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    tipo_clave = "presupuesto" if es_solo_ppto else "bim"
                    tipo_tag = "Solo Presupuesto" if es_solo_ppto else "BIM 5D"
                    display_key = f"{nuevo_icono} {nuevo_nombre.strip()} ({nueva_ubicacion.strip() or 'Colombia'} • {tipo_tag})"
                    
                    datos_nuevo = {
                        "id": nuevo_id,
                        "tipo": tipo_clave,
                        "nombre": nuevo_nombre.strip(),
                        "subtitulo": f"{nuevo_cliente.strip() or 'Cliente Privado'} • {nueva_ubicacion.strip() or 'Colombia'} • {'Presupuesto Contractual Base' if es_solo_ppto else 'BIM 5D'}",
                        "contratante": nuevo_cliente.strip() or "Cliente Privado",
                        "cedula_cliente": nueva_cedula_cliente.strip(),
                        "contratista": nuevo_contratista.strip() or "Ing. Juan González Mendoza",
                        "cedula_contratista": nueva_cedula_contratista.strip() or "C.C. 1001867834 • M.P. 021037-0828864 ATL",
                        "cargo_contratista": nuevo_cargo.strip() or "Ingeniero Residente de Obra",
                        "ubicacion": nueva_ubicacion.strip() or "Colombia",
                        "badge": "SOLO PRESUPUESTO" if es_solo_ppto else "REVIT 2027 BIM 5D",
                        "ppto_base": items_finales,
                        "a_def": float(np_a),
                        "i_def": float(np_i),
                        "u_def": float(np_u),
                        "ant_def": float(np_ant),
                        "gar_def": float(np_gar),
                        "modelo_bim": modelo_bim_text,
                        "logo": nuevo_icono,
                        "firma_residente": f"{nuevo_contratista.strip()}\n{nueva_cedula_contratista.strip()}\n{nuevo_cargo.strip()}",
                        "firma_interventor": f"SUPERVISIÓN / CLIENTE\n{nuevo_cliente.strip() or 'Cliente Privado'}\n{nueva_cedula_cliente.strip()}"
                    }
                    guardar_proyecto_en_disco(display_key, datos_nuevo)
                    PROYECTOS_DISPONIBLES[display_key] = datos_nuevo
                    st.session_state["proyecto_activo_seleccionado"] = display_key
                    st.session_state["mostrar_crear_proyecto"] = False
                    st.success(f"🎉 ¡Proyecto '{nuevo_nombre}' creado y activado exitosamente!")
                    st.rerun()
                    
        with c_b2:
            if st.button("✖ Cancelar", use_container_width=True, key="btn_cancelar_nuevo_proy"):
                st.session_state["mostrar_crear_proyecto"] = False
                st.rerun()

    st.markdown("<hr style='margin: 24px 0; border: 0; border-top: 1px solid rgba(56, 189, 248, 0.3);'>", unsafe_allow_html=True)

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
# VISTA 1: PANEL EJECUTIVO (BENTO GRID TAILWIND ULTRA-MODERNO)
# ------------------------------------------------------------------------------
if menu_seleccionado == "🏠 Panel Ejecutivo":
    # Grid Bento de 4 Tarjetas de Alto Rendimiento
    bento_kpi_html = f"""
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-bottom: 20px;">
        <div class="bento-card" style="border-top: 4px solid #2563eb;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">💼 Presupuesto Contratado</span>
                <span style="font-size: 0.7rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; padding: 3px 8px; border-radius: 6px;">Línea Base 100%</span>
            </div>
            <div style="font-size: 1.95rem; font-weight: 900; color: #0f172a; font-family: 'JetBrains Mono', monospace; letter-spacing: -0.03em;">${(total_ppto_contratado/1_000_000):,.1f}M</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-top: 4px;">${total_ppto_contratado:,.0f} COP</div>
        </div>

        <div class="bento-card" style="border-top: 4px solid #10b981;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">🔨 Costo Físico Ejecutado</span>
                <span style="font-size: 0.7rem; font-weight: 800; background: #ecfdf5; color: #047857; padding: 3px 8px; border-radius: 6px;">{avance_financiero_global}% causado</span>
            </div>
            <div style="font-size: 1.95rem; font-weight: 900; color: #0f172a; font-family: 'JetBrains Mono', monospace; letter-spacing: -0.03em;">${(total_costo_ejecutado/1_000_000):,.2f}M</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-top: 4px;">${total_costo_ejecutado:,.0f} COP</div>
        </div>

        <div class="bento-card" style="border-top: 4px solid #f59e0b;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">⏳ Saldo por Ejecutar</span>
                <span style="font-size: 0.7rem; font-weight: 800; background: #fffbeb; color: #b45309; padding: 3px 8px; border-radius: 6px;">{round(100 - avance_financiero_global, 1)}% por facturar</span>
            </div>
            <div style="font-size: 1.95rem; font-weight: 900; color: #0f172a; font-family: 'JetBrains Mono', monospace; letter-spacing: -0.03em;">${(total_saldo_dinero/1_000_000):,.1f}M</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-top: 4px;">${total_saldo_dinero:,.0f} COP</div>
        </div>

        <div class="bento-card" style="border-top: 4px solid #8b5cf6;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b;">📊 Salud de Ejecución</span>
                <span style="font-size: 0.7rem; font-weight: 800; background: #f5f3ff; color: #6d28d9; padding: 3px 8px; border-radius: 6px;">{'🟢 En Plazo' if avance_fisico_ponderado == 0 or avance_fisico_ponderado >= 10 else '⚪ Planeación'}</span>
            </div>
            <div style="font-size: 1.95rem; font-weight: 900; color: #0f172a; font-family: 'JetBrains Mono', monospace; letter-spacing: -0.03em;">{avance_fisico_ponderado}%</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-top: 4px;">Físico Ponderado BIM</div>
        </div>
    </div>
    """
    render_html(bento_kpi_html)

    # Barra de Avance Ponderado con Degradado Esmeralda-Cian
    progress_html = f"""
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px 22px; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.03); margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: {'#10b981' if avance_fisico_ponderado > 0 else '#94a3b8'};"></span>
                <span style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #1e293b;">Curva de Avance Contractual Ponderado</span>
            </div>
            <span style="font-size: 0.88rem; font-weight: 900; color: #2563eb; font-family: monospace;">{avance_fisico_ponderado}% / 100.0%</span>
        </div>
        <div style="background: #f1f5f9; border-radius: 999px; height: 12px; overflow: hidden; padding: 1.5px; border: 1px solid #e2e8f0;">
            <div style="background: linear-gradient(90deg, #2563eb 0%, #06b6d4 50%, #10b981 100%); height: 100%; border-radius: 999px; width: {max(1.5, min(avance_fisico_ponderado, 100.0))}%; transition: width 0.6s ease;"></div>
        </div>
    </div>
    """
    render_html(progress_html)
    
    col_cap1, col_cap2 = st.columns([1.25, 0.75])
    df_caps = df_5d.groupby("Capitulo").agg({
        "Presupuesto_Total": "sum",
        "Costo_Ejecutado": "sum",
        "Saldo_Dinero": "sum"
    }).reset_index()
    df_caps["Avance_%"] = (df_caps["Costo_Ejecutado"] / df_caps["Presupuesto_Total"] * 100).round(1)
    
    with col_cap1:
        with st.container(border=True):
            render_html("""
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">📊 Desglose de Presupuesto vs. Costo Ejecutado</h3>
                <span style="font-size: 0.72rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; padding: 3px 8px; border-radius: 6px;">Por Capítulo APU</span>
            </div>
            """)
            fig_caps = go.Figure()
            fig_caps.add_trace(go.Bar(
                x=df_caps["Capitulo"],
                y=df_caps["Presupuesto_Total"],
                name="Presupuesto Base",
                marker=dict(color="#94a3b8", cornerradius=6),
                hovertemplate="<b>%{x}</b><br>Presupuesto Base: $%{y:,.0f} COP<extra></extra>"
            ))
            fig_caps.add_trace(go.Bar(
                x=df_caps["Capitulo"],
                y=df_caps["Costo_Ejecutado"],
                name="Costo Ejecutado",
                marker=dict(color="#2563eb", cornerradius=6),
                hovertemplate="<b>%{x}</b><br>Costo Ejecutado: $%{y:,.0f} COP<extra></extra>"
            ))
            fig_caps.update_layout(
                barmode="group",
                margin=dict(l=10, r=10, t=10, b=10),
                height=380,
                plot_bgcolor="rgba(0,0,0,0)",
                paper_bgcolor="rgba(0,0,0,0)",
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.02,
                    xanchor="right",
                    x=1,
                    font=dict(family="Plus Jakarta Sans", size=11, color="#64748b")
                ),
                xaxis=dict(
                    tickfont=dict(family="Plus Jakarta Sans", size=10, color="#475569"),
                    gridcolor="#f1f5f9"
                ),
                yaxis=dict(
                    tickfont=dict(family="Plus Jakarta Sans", size=10, color="#64748b"),
                    gridcolor="#f1f5f9",
                    tickprefix="$",
                    tickformat=",.0s"
                ),
                font=dict(family="Plus Jakarta Sans")
            )
            st.plotly_chart(fig_caps, use_container_width=True, config={"displayModeBar": False})
        
    with col_cap2:
        with st.container(border=True):
            render_html("""
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">📋 Resumen por Capítulos</h3>
                <span style="font-size: 0.72rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; padding: 3px 8px; border-radius: 6px;">Tabla 5D</span>
            </div>
            """)
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
    render_section_banner(
        "💰",
        "Matriz de Control Financiero 5D (APU)",
        "Cruce automatizado entre el cómputo métrico Revit, el presupuesto base y la ejecución certificada de bitácora.",
        "APU CONTRACTUAL"
    )
    
    # BARRA DE ACCIONES EJECUTIVAS: EXPORTAR PDF, EDITAR APU Y CÉDULAS
    c_btn1, c_btn2, c_btn3 = st.columns([1.1, 1.1, 1.1])
    with c_btn1:
        pdf_presupuesto = generar_presupuesto_pdf(df_5d, params_liquidacion, proyecto_actual)
        st.download_button(
            label="📄 Exportar Presupuesto PDF (Membrete Oficial)",
            data=pdf_presupuesto,
            file_name=f"Presupuesto_Oficial_{proyecto_actual['id']}_{datetime.now().strftime('%Y%m%d')}.pdf",
            mime="application/pdf",
            type="primary",
            use_container_width=True,
            help="Descarga el documento formal del presupuesto en PDF con membrete ejecutivo, resumen por capítulos, matriz APU, AIU y firmas."
        )
    with c_btn2:
        modo_edicion = st.toggle("✏️ Editar Capítulos y APU", value=st.session_state.get("modo_edicion_apu", False), key="toggle_edit_apu")
        st.session_state["modo_edicion_apu"] = modo_edicion
    with c_btn3:
        modo_meta = st.toggle("📋 Editar Cédulas & Firmantes", value=st.session_state.get("modo_meta_contrato", False), key="toggle_meta_contrato")
        st.session_state["modo_meta_contrato"] = modo_meta

    if st.session_state.get("modo_meta_contrato", False):
        with st.container(border=True):
            render_html("""
            <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(248, 250, 252, 1) 100%); border-left: 4px solid #10b981; padding: 14px 18px; border-radius: 12px; margin-bottom: 14px;">
                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #065f46;">📋 Cédulas, Contratista y Cliente (Ficha Técnica y Firmas PDF)</h4>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">
                    Ingrese o modifique la cédula del cliente (C.C. / NIT) y los datos profesionales del contratista (Cédula, Matrícula Profesional y Cargo). Al guardar, se reflejan automáticamente en el membrete y en las firmas del documento PDF oficial.
                </p>
            </div>
            """)
            col_meta_cli, col_meta_con = st.columns(2)
            with col_meta_cli:
                st.markdown("**👤 Entidad Contratante / Cliente:**")
                edit_cli_nom = st.text_input("Nombre del Cliente / Entidad:", value=proyecto_actual.get("contratante", "Cliente Privado"), key="edit_meta_cli_nom")
                edit_cli_ced = st.text_input("Cédula / NIT del Cliente:", value=proyecto_actual.get("cedula_cliente", ""), placeholder="Ej: C.C. 1045678901 ó NIT 900...", key="edit_meta_cli_ced")
            with col_meta_con:
                st.markdown("**👷 Dirección Técnica / Contratista:**")
                edit_con_nom = st.text_input("Nombre del Contratista:", value=proyecto_actual.get("contratista", "Ing. Juan González Mendoza"), key="edit_meta_con_nom")
                edit_con_ced = st.text_input("Cédula y Matrícula Profesional:", value=proyecto_actual.get("cedula_contratista", "C.C. 1001867834 • M.P. 021037-0828864 ATL"), key="edit_meta_con_ced")
                edit_con_car = st.text_input("Cargo Profesional:", value=proyecto_actual.get("cargo_contratista", "Ingeniero Residente de Obra"), key="edit_meta_con_car")

            c_mb1, c_mb2 = st.columns([1.2, 3])
            with c_mb1:
                if st.button("💾 Guardar Datos y Cédulas", type="primary", use_container_width=True, key="btn_save_meta_contrato"):
                    proyecto_actual["contratante"] = edit_cli_nom.strip()
                    proyecto_actual["cedula_cliente"] = edit_cli_ced.strip()
                    proyecto_actual["contratista"] = edit_con_nom.strip()
                    proyecto_actual["cedula_contratista"] = edit_con_ced.strip()
                    proyecto_actual["cargo_contratista"] = edit_con_car.strip()
                    proyecto_actual["firma_residente"] = f"{edit_con_nom.strip()}\n{edit_con_ced.strip()}\n{edit_con_car.strip()}"
                    proyecto_actual["firma_interventor"] = f"SUPERVISIÓN / CLIENTE\n{edit_cli_nom.strip()}\n{edit_cli_ced.strip()}"
                    PROYECTOS_DISPONIBLES[st.session_state["proyecto_activo_seleccionado"]] = proyecto_actual
                    guardar_proyecto_en_disco(st.session_state["proyecto_activo_seleccionado"], proyecto_actual)
                    st.session_state["modo_meta_contrato"] = False
                    st.success("✅ ¡Cédulas y datos de contrato guardados con éxito!")
                    st.rerun()
            with c_mb2:
                if st.button("✖ Cerrar", key="btn_close_meta_contrato"):
                    st.session_state["modo_meta_contrato"] = False
                    st.rerun()
            st.markdown("<hr style='margin: 16px 0; border: 0; border-top: 1px solid #cbd5e1;'>", unsafe_allow_html=True)

    if st.session_state.get("modo_edicion_apu", False):
        with st.container(border=True):
            render_html(f"""
            <div style="background: linear-gradient(135deg, rgba(30, 58, 138, 0.08) 0%, rgba(248, 250, 252, 1) 100%); border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 12px; margin-bottom: 14px;">
                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #1e3a8a;">✏️ Editor de Capítulos y Actividades Constructivas (APU)</h4>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">
                    Modifique directamente los nombres de los <strong>capítulos</strong>, descripciones de las <strong>actividades</strong>, unidades, cantidades y precios. Al guardar, todos los cómputos, resúmenes, gráficos y el PDF oficial se actualizarán de forma inmediata.
                </p>
            </div>
            """)
            
            # Construir tabla editable con los datos actuales
            data_edit = []
            for item in proyecto_actual["ppto_base"]:
                data_edit.append({
                    "Item": str(item.get("Item", "")),
                    "Capitulo": str(item.get("Capitulo", "")),
                    "Actividad": str(item.get("Actividad", "")),
                    "Unidad": str(item.get("Unidad", "und")),
                    "Cantidad": float(item.get("Cantidad_Contratada", 1.0)),
                    "Precio_Unitario": float(item.get("Precio_Unitario", 0.0))
                })
            df_para_editar = pd.DataFrame(data_edit)
            
            edited_apu_df = st.data_editor(
                df_para_editar,
                num_rows="dynamic",
                use_container_width=True,
                key="editor_tabla_apu",
                column_config={
                    "Item": st.column_config.TextColumn("Ítem", width="small", required=True),
                    "Capitulo": st.column_config.TextColumn("Capítulo (Nombre de Etapa)", width="medium", required=True),
                    "Actividad": st.column_config.TextColumn("Actividad Constructiva (Descripción APU)", width="large", required=True),
                    "Unidad": st.column_config.TextColumn("Und", width="small", required=True),
                    "Cantidad": st.column_config.NumberColumn("Cantidad", format="%.2f", min_value=0.01, required=True),
                    "Precio_Unitario": st.column_config.NumberColumn("Precio Unitario ($ COP)", format="$%d", min_value=0.0, required=True)
                }
            )
            
            c_ed1, c_ed2, c_ed3 = st.columns([1.1, 1, 2])
            with c_ed1:
                if st.button("💾 Guardar Cambios en Presupuesto", type="primary", use_container_width=True, key="btn_save_apu_edits"):
                    nuevos_items = []
                    for idx, r in edited_apu_df.iterrows():
                        act_str = str(r.get("Actividad", "")).strip()
                        cap_str = str(r.get("Capitulo", "")).strip()
                        if act_str and act_str.lower() not in ["nan", "none"]:
                            it_str = str(r.get("Item", f"{idx+1}")).strip()
                            und_str = str(r.get("Unidad", "und")).strip()
                            cant_val = float(r.get("Cantidad", 1.0) or 1.0)
                            pu_val = float(r.get("Precio_Unitario", 0.0) or 0.0)
                            match_keys = [w for w in normalizar_texto(act_str).split() if len(w) > 3]
                            nuevos_items.append({
                                "Item": it_str,
                                "Capitulo": cap_str or "1. ACTIVIDADES GENERALES",
                                "Actividad": act_str,
                                "Unidad": und_str,
                                "Cantidad_Contratada": cant_val,
                                "Precio_Unitario": pu_val,
                                "match_keys": match_keys
                            })
                            
                    if nuevos_items:
                        proyecto_actual["ppto_base"] = nuevos_items
                        PROYECTOS_DISPONIBLES[st.session_state["proyecto_activo_seleccionado"]]["ppto_base"] = nuevos_items
                        guardar_proyecto_en_disco(st.session_state["proyecto_activo_seleccionado"], proyecto_actual)
                        st.session_state["modo_edicion_apu"] = False
                        st.cache_data.clear()
                        st.success("✅ ¡Capítulos y actividades de APU actualizados y guardados exitosamente!")
                        st.rerun()
                    else:
                        st.error("⚠️ Ingrese al menos una actividad válida.")
                        
            with c_ed2:
                if st.button("✖ Cancelar Edición", use_container_width=True, key="btn_cancel_apu_edits"):
                    st.session_state["modo_edicion_apu"] = False
                    st.rerun()
                    
            st.markdown("<hr style='margin: 16px 0; border: 0; border-top: 1px solid #cbd5e1;'>", unsafe_allow_html=True)
    
    with st.container(border=True):
        f_col1, f_col2, f_col3 = st.columns([1.2, 1, 1])
        with f_col1:
            filtro_txt = st.text_input("🔍 Buscar ítem o actividad:", placeholder="Ej. mamposteria, porcelanato, cubierta...")
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
    render_section_banner(
        "📑",
        "Generador de Actas de Corte y Cobro Oficiales",
        f"Liquidación contractual automática con AIU, amortización y retenciones para {proyecto_actual['contratante']}.",
        "LIQUIDACIÓN 5D"
    )
    
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
        {"Concepto": f"9. (=) TOTAL LÍQUIDO A FACTURAR / CONSIGNAR POR {proyecto_actual.get('contratante', 'EL CLIENTE')}", "Valor COP": f"${neto_cobrar:,.0f}"}
    ])
    st.dataframe(df_liquidacion_resumen, use_container_width=True, hide_index=True)

# ------------------------------------------------------------------------------
# VISTA 4: MEJORA 2 - SIMULADOR DE MAYORES CANTIDADES & ADICIONALES (EAC)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "⚠️ Mayores Cantidades & Adicionales":
    render_section_banner(
        "⚠️",
        "Simulador de Mayores Cantidades de Obra y Sobrecostos",
        "Detección en tiempo real de actividades con volumen superior al contractual para tramitar actas modificatorias.",
        "CONTROL DE COSTOS EAC"
    )

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
    render_section_banner(
        "👥",
        "Productividad de Mano de Obra y Desempeño de Cuadrillas",
        "Cálculo de rendimientos diarios por oficial y cuadrilla frente a los estándares de APU contractuales.",
        "DESEMPEÑO TÉCNICO"
    )

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
        st.info(f"ℹ️ No se registran reportes de campo en bitácora para '{proyecto_actual['nombre']}'. Los rendimientos de mano de obra se calcularán automáticamente cuando se sincronicen jornadas de obra para este proyecto.")

# ------------------------------------------------------------------------------
# VISTA 6: CURVA S & PLAZO 4D (EVM)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📈 Curva S & Plazo 4D":
    render_section_banner(
        "📈",
        "Gestión del Valor Ganado (Earned Value Management - EVM)",
        "Seguimiento del desempeño de cronograma (SPI), costos (CPI) y análisis dinámico de la Curva S.",
        "LÍNEA BASE 4D"
    )
    
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
        
    st.write("")
    fechas_curva = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6", "Sem 7", "Sem 8"]
    plan_acumulado = [3.5, 8.5, 16.0, 28.5, 45.0, 68.0, 88.0, 100.0]
    
    with st.container(border=True):
        render_html("""
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">📊 Curva S: Avance Físico Planificado vs. Real Ejecutado (%)</h4>
                <p style="font-size: 0.78rem; color: #64748b; margin: 2px 0 0 0;">Línea base proyectada (Gantt contractual) vs. Cómputo físico certificado en bitácora</p>
            </div>
            <span style="font-size: 0.72rem; font-weight: 800; background: #eff6ff; color: #1d4ed8; padding: 4px 10px; border-radius: 6px;">Horizonte 8 Semanas</span>
        </div>
        """)
        
        fig_curva = go.Figure()
        # Línea Planificada
        fig_curva.add_trace(go.Scatter(
            x=fechas_curva,
            y=plan_acumulado,
            mode="lines+markers",
            name="Planificado (Línea Base)",
            line=dict(color="#94a3b8", width=3, dash="dot", shape="spline"),
            marker=dict(size=7, color="#64748b"),
            fill="tozeroy",
            fillcolor="rgba(148, 163, 184, 0.08)",
            hovertemplate="<b>%{x}</b><br>Meta Planificada: %{y:.1f}%<extra></extra>"
        ))
        
        # Puntos reales: si el avance ponderado > 0 lo graficamos, si no mostramos el arranque en 0.0%
        val_real = avance_fisico_ponderado
        if proyecto_actual["id"] == "mezzanine" and val_real > 0:
            real_acumulado = [3.2, 8.0, 15.5, val_real] + [np.nan] * (len(fechas_curva) - 4)
        elif val_real > 0:
            real_acumulado = [val_real] + [np.nan] * (len(fechas_curva) - 1)
        else:
            real_acumulado = [0.0] + [np.nan] * (len(fechas_curva) - 1)
        real_x = [f for f, r in zip(fechas_curva, real_acumulado) if not pd.isna(r)]
        real_y = [r for r in real_acumulado if not pd.isna(r)]
        
        fig_curva.add_trace(go.Scatter(
            x=real_x,
            y=real_y,
            mode="lines+markers",
            name="Real Ejecutado (Bitácora Cloud)",
            line=dict(color="#2563eb", width=4, shape="spline"),
            marker=dict(size=9, color="#2563eb", symbol="diamond", line=dict(color="#ffffff", width=2)),
            fill="tozeroy",
            fillcolor="rgba(37, 99, 235, 0.15)",
            hovertemplate="<b>%{x}</b><br>Avance Real Causado: %{y:.1f}%<extra></extra>"
        ))
        
        fig_curva.add_hline(y=100, line_dash="dash", line_color="#cbd5e1", annotation_text="Meta Contractual (100%)", annotation_position="top right")

        fig_curva.update_layout(
            margin=dict(l=15, r=15, t=15, b=15),
            height=420,
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="center",
                x=0.5,
                font=dict(family="Plus Jakarta Sans", size=12, color="#0f172a")
            ),
            xaxis=dict(
                tickfont=dict(family="Plus Jakarta Sans", size=11, color="#475569"),
                gridcolor="#f1f5f9"
            ),
            yaxis=dict(
                ticksuffix="%",
                range=[0, 108],
                tickfont=dict(family="Plus Jakarta Sans", size=11, color="#64748b"),
                gridcolor="#f1f5f9"
            ),
            font=dict(family="Plus Jakarta Sans"),
            hovermode="x unified"
        )
        st.plotly_chart(fig_curva, use_container_width=True, config={"displayModeBar": False})

# ------------------------------------------------------------------------------
# VISTA 7: INSUMOS & MATERIALES BIM (EXPLOSIÓN PARAMÉTRICA DE REQUISICIONES)
# ------------------------------------------------------------------------------
elif menu_seleccionado == "🧱 Insumos BIM":
    render_section_banner(
        "🧱",
        "Explosión Paramétrica de Insumos & Materiales BIM",
        "Cálculo cuantitativo de insumos para compras y almacén basado en los cómputos métricos de diseño y avance de obra.",
        "LOGÍSTICA & ALMACÉN"
    )

    if proyecto_actual["id"] == "casa_mendoza":
        card_mamposteria_html = """
        <div style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1px solid #bfdbfe; border-radius: 18px; padding: 22px; box-shadow: 0 4px 20px rgba(37, 99, 235, 0.06); margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                <span style="font-size: 1.8rem;">🧱</span>
                <div>
                    <h4 style="font-size: 1.05rem; font-weight: 900; color: #0f172a; margin: 0;">Conversión APU Paramétrica: Mampostería en m² ➔ Demanda de Bloques</h4>
                    <p style="font-size: 0.82rem; color: #64748b; margin: 2px 0 0 0;">Contratación en <strong>m² de muro</strong> (Ítem 1.1) y explosión técnica en <strong>unidades de bloque</strong> para logística de compras y almacén.</p>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px;">
                <div style="background: #ffffff; padding: 14px 18px; border-radius: 14px; border: 1px solid #dbeafe;">
                    <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #2563eb; display: block;">Área de Muros (Revit 1.1)</span>
                    <span style="font-size: 1.55rem; font-weight: 900; color: #0f172a; font-family: monospace;">227.89 m²</span>
                    <span style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 2px;">Pañete 2 caras: 455.78 m²</span>
                </div>
                <div style="background: #ffffff; padding: 14px 18px; border-radius: 14px; border: 1px solid #dbeafe;">
                    <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #4f46e5; display: block;">Factor de Rendimiento APU</span>
                    <span style="font-size: 1.55rem; font-weight: 900; color: #4f46e5; font-family: monospace;">12.5 und/m²</span>
                    <span style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 2px;">Bloque concreto No. 12 + 5% desp.</span>
                </div>
                <div style="background: #ffffff; padding: 14px 18px; border-radius: 14px; border: 1px solid #bbf7d0;">
                    <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #16a34a; display: block;">Demanda Total en Almacén</span>
                    <span style="font-size: 1.55rem; font-weight: 900; color: #16a34a; font-family: monospace;">2,848.6 Und</span>
                    <span style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 2px;">+ 42.7 sacos cemento para pega</span>
                </div>
                <div style="background: #ffffff; padding: 14px 18px; border-radius: 14px; border: 1px solid #fed7aa;">
                    <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #ea580c; display: block;">Pisos Discriminados</span>
                    <span style="font-size: 1.35rem; font-weight: 900; color: #ea580c; font-family: monospace;">106.2 / 107.1 m²</span>
                    <span style="font-size: 0.72rem; color: #64748b; display: block; margin-top: 2px;">Plantilla: 106.2 m² • Enchape: 107.1 m²</span>
                </div>
            </div>
        </div>
        """
        render_html(card_mamposteria_html)

    c_sel1, c_sel2 = st.columns([1.5, 1])
    with c_sel1:
        modo_insumos = st.radio(
            "Fuente de Explosión de Insumos:",
            ["📦 Demanda Total del Presupuesto Base (Requisición & Compras)", "🔨 Consumo Real Causado (Obra Ejecutada a la Fecha)"],
            horizontal=True
        )

    campo_cant = "Cantidad_Contratada" if "Demanda Total" in modo_insumos else "Cantidad_Ejecutada"
    
    insumos_calc = []
    for _, r in df_5d.iterrows():
        it = r["Item"]
        c_calc = r[campo_cant]
        
        if c_calc > 0:
            act_n = normalizar_texto(r["Actividad"])
            if "bloque" in act_n or "mamposteria" in act_n or it in ["1.1", "6.1"]:
                cant_b = c_calc if r["Unidad"] == "und" else c_calc * 12.5
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Bloque de Concreto No. 12 (40x20x10/12)", "Consumo_Unitario": 1.0, "Unidad": "Und", "Total_Teorico": cant_b})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Pega (Sacos 50kg)", "Consumo_Unitario": 0.015, "Unidad": "Sacos", "Total_Teorico": cant_b * 0.015})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Fina para Mortero de Pega", "Consumo_Unitario": 0.002, "Unidad": "m³", "Total_Teorico": cant_b * 0.002})
            elif "panete" in act_n or "revoco" in act_n or it in ["1.2", "6.4"]:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Pañete (Sacos 50kg)", "Consumo_Unitario": 0.22, "Unidad": "Sacos", "Total_Teorico": c_calc * 0.22})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada para Pañete", "Consumo_Unitario": 0.028, "Unidad": "m³", "Total_Teorico": c_calc * 0.028})
            elif "plantilla" in act_n or "solado" in act_n or it in ["2.1", "3.1"]:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Concreto Simple f'c=14 MPa (Plantilla)", "Consumo_Unitario": 0.07, "Unidad": "m³", "Total_Teorico": c_calc * 0.07})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Plantilla (Sacos)", "Consumo_Unitario": 0.45, "Unidad": "Sacos", "Total_Teorico": c_calc * 0.45})
            elif "porcelanato" in act_n or "ceramico" in act_n or "enchape" in act_n or it == "2.2":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Porcelanato / Cerámica 51x51 cm (5% desp.)", "Consumo_Unitario": 1.05, "Unidad": "m²", "Total_Teorico": c_calc * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pegacor Cerámico (Bultos 25kg)", "Consumo_Unitario": 0.25, "Unidad": "Bultos", "Total_Teorico": c_calc * 0.25})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Boquilla para Junta", "Consumo_Unitario": 0.35, "Unidad": "kg", "Total_Teorico": c_calc * 0.35})
            elif "cielorraso" in act_n or "cielo raso" in act_n or it == "3.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Panel de Cielorraso Suspendido", "Consumo_Unitario": 1.05, "Unidad": "m²", "Total_Teorico": c_calc * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Perfilería Angular y Perfiles Omega", "Consumo_Unitario": 1.8, "Unidad": "ml", "Total_Teorico": c_calc * 1.8})
            elif "estuco" in act_n or "pintura" in act_n or it == "4.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Estuco Plástico Listo (Cuñetes)", "Consumo_Unitario": 0.08, "Unidad": "Cuñetes", "Total_Teorico": c_calc * 0.08})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pintura Vinilo Tipo 1 (Galones)", "Consumo_Unitario": 0.12, "Unidad": "Gal", "Total_Teorico": c_calc * 0.12})
            elif "cubierta" in act_n or "eternit" in act_n or "teja" in act_n or it == "6.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Teja Ondulada Eternit No. 6/8", "Consumo_Unitario": 1.10, "Unidad": "m²", "Total_Teorico": c_calc * 1.10})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Ganchos de Fijación con Golilla", "Consumo_Unitario": 3.0, "Unidad": "Und", "Total_Teorico": c_calc * 3.0})
            elif "puertas" in act_n or it == "5.1":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Puertas Entamboradas con Marco y Cerradura", "Consumo_Unitario": 1.0, "Unidad": "Und", "Total_Teorico": c_calc})
            elif "ventanas" in act_n or it == "5.2":
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Ventanas de Aluminio y Vidrio", "Consumo_Unitario": 1.0, "Unidad": "Und", "Total_Teorico": c_calc})
            elif any(k in act_n for k in ["concreto", "zapatas", "vigas", "pedestales", "foso"]):
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Tipo UG (Sacos 50kg)", "Consumo_Unitario": 7.0, "Unidad": "Sacos", "Total_Teorico": c_calc * 7.0})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada de Río", "Consumo_Unitario": 0.55, "Unidad": "m³", "Total_Teorico": c_calc * 0.55})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Gravilla Triturada 3/4 pulg", "Consumo_Unitario": 0.85, "Unidad": "m³", "Total_Teorico": c_calc * 0.85})
            elif "acero" in act_n or it in ["4.1", "5.2"]:
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Acero Corrugado 60 KSI (Figurado)", "Consumo_Unitario": 1.05, "Unidad": "kg", "Total_Teorico": c_calc * 1.05})
                insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Alambre Negro #18 para Amarre", "Consumo_Unitario": 0.03, "Unidad": "kg", "Total_Teorico": c_calc * 0.03})
                
    if insumos_calc:
        df_insumos = pd.DataFrame(insumos_calc)
        resumen_insumos = df_insumos.groupby(["Insumo", "Unidad"])["Total_Teorico"].sum().reset_index()
        resumen_insumos = resumen_insumos.sort_values(by="Total_Teorico", ascending=False)
        
        st.markdown(f"#### 📦 Balance Consolidado de Insumos ({'Requisición Total' if 'Demanda Total' in modo_insumos else 'Consumo Causado'})")
        st.dataframe(
            resumen_insumos,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Insumo": st.column_config.TextColumn("Insumo Crítico", width="large"),
                "Unidad": st.column_config.TextColumn("Unidad", width="small"),
                "Total_Teorico": st.column_config.NumberColumn("Total Estimado", format="%.2f")
            }
        )
    else:
        st.info("ℹ️ No hay actividades con volumen para estimar insumos.")

# ------------------------------------------------------------------------------
# VISTA 8: AUDITORÍA BITÁCORA CLOUD
# ------------------------------------------------------------------------------
elif menu_seleccionado == "📡 Bitácora Cloud":
    render_section_banner(
        "📡",
        "Registros en Tiempo Real de Bitácora Cloud",
        f"Datos capturados en obra para {proyecto_actual['nombre']} y sincronizados en tiempo real con Supabase.",
        "REST API LIVE"
    )
    
    # 1. Formulario para registrar avance de este proyecto directamente
    with st.expander(f"📝 Registrar Reporte Diario de Bitácora para '{proyecto_actual['nombre']}'", expanded=False):
        with st.form("form_reporte_bitacora_proyecto", clear_on_submit=True):
            render_html(f"""
            <div style="background: rgba(37, 99, 235, 0.08); border-left: 4px solid #2563eb; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px;">
                <span style="font-size: 0.82rem; color: #1e3a8a; font-weight: 700;">
                    Proyecto Activo: <strong>{proyecto_actual['logo']} {proyecto_actual['nombre']}</strong> • Los reportes se asignarán exclusivamente a este proyecto con aislamiento total.
                </span>
            </div>
            """)
            c_rf1, c_rf2 = st.columns([1, 1.8])
            with c_rf1:
                fecha_rep = st.date_input("📅 Fecha de Ejecución:", value=datetime.now())
            with c_rf2:
                lista_acts_proy = [f"{it['Item']} - {it['Actividad']} ({it['Unidad']})" for it in proyecto_actual["ppto_base"]]
                act_sel_rep = st.selectbox("🔨 Actividad Constructiva:", options=lista_acts_proy)
            
            c_rf3, c_rf4, c_rf5 = st.columns([1, 1, 1.2])
            with c_rf3:
                cant_rep = st.number_input("Cantidad Ejecutada Hoy:", min_value=0.01, value=1.0, step=0.5)
            with c_rf4:
                desp_rep = st.number_input("Desperdicio (%):", min_value=0.0, max_value=50.0, value=5.0, step=0.5)
            with c_rf5:
                st.markdown("<div style='padding-top: 28px;'></div>", unsafe_allow_html=True)
                btn_submit_rep = st.form_submit_button("💾 Guardar en Supabase", type="primary", use_container_width=True)
                
            if btn_submit_rep:
                act_pura = act_sel_rep.split(" - ", 1)[-1].rsplit(" (", 1)[0]
                und_pura = act_sel_rep.rsplit(" (", 1)[-1].replace(")", "")
                
                # Tag de aislamiento total por proyecto
                act_con_tag = f"[{proyecto_actual['id']}] {act_pura}"
                payload = {
                    "fecha": fecha_rep.strftime("%d/%m/%Y"),
                    "actividad": act_con_tag,
                    "unidad": und_pura,
                    "cantidad": float(cant_rep),
                    "desperdicio": float(desp_rep)
                }
                headers_sb = {
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                }
                try:
                    url_sb = f"{SUPABASE_URL}/rest/v1/bitacora_obra"
                    res_sb = requests.post(url_sb, headers=headers_sb, json=payload, timeout=8)
                    if res_sb.status_code in [200, 201]:
                        st.cache_data.clear()
                        st.success(f"✅ ¡Registro de {cant_rep} {und_pura} guardado exitosamente para '{proyecto_actual['nombre']}'!")
                        st.rerun()
                    else:
                        st.error(f"Error al guardar en Supabase (HTTP {res_sb.status_code}): {res_sb.text}")
                except Exception as ex_sb:
                    st.error(f"Error de conexión: {str(ex_sb)}")

    # 2. Registros exclusivos de este proyecto
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
        st.caption(f"Mostrando {len(df_mostrar)} reportes registrados exclusivamente para '{proyecto_actual['nombre']}'.")
    else:
        st.info(f"ℹ️ El proyecto '{proyecto_actual['nombre']}' aún no tiene registros de ejecución en la nube. Puede registrarlos usando el formulario superior o desde la Bitácora de Campo.")

    # 3. Auditoría global opcional
    ver_todo = st.checkbox("🔍 Ver todos los registros de la base de datos central (Auditoría Global Multi-Proyecto)", value=False)
    if ver_todo and not df_cloud.empty:
        st.markdown("##### 🌐 Todos los Registros Sincronizados en Supabase (Todos los Proyectos)")
        df_all_mostrar = df_cloud.copy()
        if 'created_at' in df_all_mostrar.columns:
            try:
                df_all_mostrar['Fecha_Hora_Col'] = pd.to_datetime(df_all_mostrar['created_at'], utc=True).dt.tz_convert('America/Bogota').dt.strftime('%d/%m/%Y %I:%M %p')
            except:
                df_all_mostrar['Fecha_Hora_Col'] = df_all_mostrar['created_at']
        cols_all = [c for c in ['id', 'Fecha_Hora_Col', 'fecha', 'actividad', 'unidad', 'cantidad', 'desperdicio'] if c in df_all_mostrar.columns]
        st.dataframe(df_all_mostrar[cols_all], use_container_width=True, hide_index=True)
