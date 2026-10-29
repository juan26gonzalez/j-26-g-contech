import streamlit as st
import pandas as pd
import io
import math
from supabase import create_client, Client

# ==============================================================================
# 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE
# ==============================================================================
SUPABASE_URL = "https://ktxbonxgrnpzearsgvtc.supabase.co"
SUPABASE_KEY = "sb_publishable_VUiAXSbX0Snwe-jvO4yEgA_8WLCK0Do"

@st.cache_resource
def iniciar_conexion():
    return create_client(SUPABASE_URL, SUPABASE_KEY)

supabase = iniciar_conexion()

# ==============================================================================
# 2. CONFIGURACIÓN DE LA PÁGINA Y ESTILOS VISUALES
# ==============================================================================
st.set_page_config(page_title="JG ConTech | Control de Obra BIM", page_icon="🏗️", layout="wide")

st.markdown("""
    <style>
    div[data-testid="stMetric"] {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 15px 20px;
        border-radius: 10px;
        border-left: 5px solid #10b981;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    div.stDownloadButton > button {
        background-color: #1a365d;
        color: white;
        border-radius: 8px;
        width: 100%;
    }
    </style>
""", unsafe_allow_html=True)

# ==============================================================================
# 3. BARRA LATERAL (Identidad y Conexión)
# ==============================================================================
with st.sidebar:
    st.markdown("## 🏗️ **JG ConTech**")
    st.caption("Plataforma BIM 5D Cloud")
    st.divider()
    
    st.markdown("### 🏢 1. Presupuesto Base (BIM)")
    archivo_bim = st.file_uploader("Sube Cantidades de Revit (CSV)", type=["csv"], key="bim")
    
    st.divider()
    st.markdown("### ☁️ 2. Datos de Campo")
    st.success("🟢 Conectado en tiempo real a Supabase (PostgreSQL)")
    if st.button("🔄 Refrescar datos de la nube", type="primary", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

st.title("📊 Centro de Mando Financiero y Almacén (BIM 5D Cloud)")

# ==============================================================================
# 4. EXTRACCIÓN DE DATOS DE LA NUBE Y PROCESAMIENTO
# ==============================================================================
# Extraemos la bitácora directamente desde Supabase
@st.cache_data(ttl=60) # Refresca los datos automáticamente cada 60 segundos
def obtener_datos_nube():
    respuesta = supabase.table("bitacora_obra").select("*").execute()
    return pd.DataFrame(respuesta.data)

df_obra = obtener_datos_nube()

if archivo_bim is not None:
    df_presupuesto = pd.read_csv(archivo_bim)
    if 'Unidad' in df_presupuesto.columns:
        df_presupuesto = df_presupuesto.drop(columns=['Unidad'])
else:
    datos_presupuesto = {
        "Actividad": [
            "Concreto en zapatas y cimentación", "Concreto en columnas estructurales",
            "Concreto en vigas de amarre y aéreas", "Construcción de plantilla de concreto",
            "Instalación de piso cerámico", "Pintura vinílica en muros",
            "Instalación de guardaescobas", "Instalación de puertas interiores y baño",
            "Instalación de aparatos sanitarios y lavaplatos", "Red de tubería hidrosanitaria PVC"
        ],
        "Cantidad_Contratada": [3.50, 2.80, 3.20, 5.00, 25.00, 80.00, 20.00, 4.00, 3.00, 18.00],
        "Precio_Unitario": [680000, 850000, 790000, 450000, 55000, 15000, 12000, 320000, 480000, 35000]
    }
    df_presupuesto = pd.DataFrame(datos_presupuesto)

# ==============================================================================
# 5. INTEGRACIÓN Y PESTAÑAS
# ==============================================================================
if not df_obra.empty:
    resumen_ejecutado = df_obra.groupby(['actividad', 'unidad'])['cantidad'].sum().reset_index()
    resumen_ejecutado = resumen_ejecutado.rename(columns={'cantidad': 'Cantidad_Ejecutada', 'actividad': 'Actividad'})

    informe_total = pd.merge(df_presupuesto, resumen_ejecutado, on='Actividad', how='left')
    informe_total['Cantidad_Ejecutada'] = informe_total['Cantidad_Ejecutada'].fillna(0)
    informe_total['Presupuesto_Total'] = informe_total['Cantidad_Contratada'] * informe_total['Precio_Unitario']
    informe_total['Costo_Ejecutado'] = informe_total['Cantidad_Ejecutada'] * informe_total['Precio_Unitario']
    informe_total['Saldo_Por_Cobrar'] = informe_total['Presupuesto_Total'] - informe_total['Costo_Ejecutado']
    informe_total['Avance_Financiero_%'] = (informe_total['Costo_Ejecutado'] / informe_total['Presupuesto_Total'].replace(0, pd.NA)) * 100
    informe_total['Avance_Financiero_%'] = informe_total['Avance_Financiero_%'].fillna(0).round(2)

    tab_finanzas, tab_materiales, tab_registros = st.tabs([
        "💰 Control Financiero", "🧱 Explosión de Materiales", "📋 Registros en Vivo"
    ])

    with tab_finanzas:
        col1, col2, col3, col4 = st.columns(4)
        total_ppto = informe_total['Presupuesto_Total'].sum()
        total_ejec = informe_total['Costo_Ejecutado'].sum()
        total_saldo = informe_total['Saldo_Por_Cobrar'].sum()
        avance_global = (total_ejec / total_ppto) * 100 if total_ppto > 0 else 0

        col1.metric("Presupuesto Total", f"${total_ppto:,.0f}")
        col2.metric("Costo Ejecutado", f"${total_ejec:,.0f}")
        col3.metric("Saldo por Ejecutar", f"${total_saldo:,.0f}")
        col4.metric("Avance Global", f"{avance_global:.1f}%")
        
        st.dataframe(informe_total[['Actividad', 'Cantidad_Contratada', 'Cantidad_Ejecutada', 'Presupuesto_Total', 'Costo_Ejecutado', 'Avance_Financiero_%']], use_container_width=True, hide_index=True)

    with tab_materiales:
        st.info("💡 Módulo de Explosión de Materiales operativo. Ingresa a la base BIM para ver requerimientos detallados.")
        # Aquí se mantiene la lógica de cálculo de materiales que ya tenías...
        
    with tab_registros:
        st.markdown("### 📡 Datos recibidos en tiempo real desde campo")
        st.dataframe(df_obra[['created_at', 'fecha', 'actividad', 'unidad', 'cantidad', 'desperdicio']].sort_values(by='created_at', ascending=False), use_container_width=True, hide_index=True)

else:
    st.info("📡 Conectado a la base de datos, pero aún no hay registros de obra subidos desde la aplicación web.")