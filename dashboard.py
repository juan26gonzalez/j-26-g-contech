import streamlit as st
import pandas as pd
import io # Librería nativa para manejar archivos en la memoria web

# ==============================================================================
# CONFIGURACIÓN DE LA PÁGINA
# ==============================================================================
st.set_page_config(page_title="ConTech Dashboard", page_icon="🏗️", layout="wide")
st.title("🏗️ Dashboard de Control de Obra")
st.subheader("Sistema automatizado de avance físico y financiero")

# ==============================================================================
# FASE 1: DATOS MAESTROS (Presupuesto)
# ==============================================================================
datos_presupuesto = {
    "Actividad": [
        "Construcción de plantilla de concreto",
        "Instalación de piso cerámico",
        "Pintura vinílica en muros",
        "Instalación de guardaescobas"
    ],
    "Cantidad_Contratada": [5.00, 25.00, 80.00, 20.00],
    "Precio_Unitario": [450000, 55000, 15000, 12000]
}
df_presupuesto = pd.DataFrame(datos_presupuesto)

# ==============================================================================
# FASE 2: INTERFAZ DE CARGA DE ARCHIVOS
# ==============================================================================
st.markdown("### 1. Cargar datos de obra")
# Creamos un botón interactivo para arrastrar y soltar el CSV
archivo_subido = st.file_uploader("📂 Sube la Bitácora de Obra (CSV) descargada por el residente", type=["csv"])

# Todo el proceso matemático solo se ejecuta SI el usuario subió un archivo
if archivo_subido is not None:
    
    # Leemos el archivo que el usuario acaba de subir
    df_obra = pd.read_csv(archivo_subido)
    resumen_ejecutado = df_obra.groupby(['Actividad', 'Unidad'])['Cantidad'].sum().reset_index()
    resumen_ejecutado = resumen_ejecutado.rename(columns={'Cantidad': 'Cantidad_Ejecutada'})

    # ==============================================================================
    # FASE 3: EL MOTOR MATEMÁTICO (Pandas)
    # ==============================================================================
    informe_total = pd.merge(df_presupuesto, resumen_ejecutado, on='Actividad', how='left')
    informe_total['Cantidad_Ejecutada'] = informe_total['Cantidad_Ejecutada'].fillna(0)

    informe_total['Presupuesto_Total'] = informe_total['Cantidad_Contratada'] * informe_total['Precio_Unitario']
    informe_total['Costo_Ejecutado'] = informe_total['Cantidad_Ejecutada'] * informe_total['Precio_Unitario']
    informe_total['Saldo_Por_Cobrar'] = informe_total['Presupuesto_Total'] - informe_total['Costo_Ejecutado']
    informe_total['Avance_Financiero_%'] = (informe_total['Costo_Ejecutado'] / informe_total['Presupuesto_Total']) * 100
    informe_total['Avance_Financiero_%'] = informe_total['Avance_Financiero_%'].round(2)

    # ==============================================================================
    # FASE 4: INTERFAZ GRÁFICA WEB (KPIs y Gráficos)
    # ==============================================================================
    st.divider()
    st.markdown("### 2. Resumen Financiero Global")
    col1, col2, col3 = st.columns(3)

    total_ppto = informe_total['Presupuesto_Total'].sum()
    total_ejec = informe_total['Costo_Ejecutado'].sum()
    total_saldo = informe_total['Saldo_Por_Cobrar'].sum()

    col1.metric("Presupuesto Total", f"${total_ppto:,.0f}")
    col2.metric("Costo Ejecutado", f"${total_ejec:,.0f}")
    col3.metric("Saldo por Cobrar", f"${total_saldo:,.0f}")

    st.divider() 

    col_tabla, col_grafico = st.columns([1.2, 1])

    with col_tabla:
        st.markdown("### Detalle por Actividad")
        columnas_gerenciales = ['Actividad', 'Presupuesto_Total', 'Costo_Ejecutado', 'Saldo_Por_Cobrar', 'Avance_Financiero_%']
        st.dataframe(informe_total[columnas_gerenciales], use_container_width=True, hide_index=True)

    with col_grafico:
        st.markdown("### Gráfico de Avance (%)")
        st.bar_chart(data=informe_total, x='Actividad', y='Avance_Financiero_%')

    # ==============================================================================
    # FASE 5: EXPORTACIÓN A EXCEL DESDE LA WEB
    # ==============================================================================
    st.divider()
    st.markdown("### 3. Exportar Entregable")
    
    # Creamos el archivo Excel en la memoria virtual (buffer)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        informe_total.to_excel(writer, index=False, sheet_name='Control Financiero')
    
    # Botón de descarga web
    st.download_button(
        label="📥 Descargar Reporte Financiero (Excel)",
        data=buffer.getvalue(),
        file_name="Control_Financiero_Obra.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

else:
    # Mensaje de espera si aún no han subido nada
    st.info("👆 Por favor, carga el archivo de la bitácora para generar el dashboard.")