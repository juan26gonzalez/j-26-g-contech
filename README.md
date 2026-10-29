# 🏗️ JG ConTech | Ecosistema BIM 5D & Control Financiero de Obra

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-Cloud-FF4B4B.svg)
![Autodesk Revit](https://img.shields.io/badge/Revit_API-2027-0696D7.svg)
![Pandas](https://img.shields.io/badge/Pandas-Data_Analytics-150458.svg)

Plataforma integral **ConTech (Construction Technology)** diseñada para automatizar el flujo de trabajo entre el modelado tridimensional en **Autodesk Revit**, la captura de rendimientos diarios en campo y la auditoría financiera y de materiales en tiempo real en la nube.

🔗 **Demo en Vivo (Servidor en Producción):** [Abrir Plataforma JG ConTech](https://jg-contech.streamlit.app/)

---

## 🚀 Arquitectura del Sistema

El ecosistema elimina la digitación manual y los reprocesos en hojas de cálculo tradicionales mediante tres módulos interconectados:

1. **Extracción Automatizada BIM (Autodesk Revit 2027 + Python API / Dynamo):**
   * Escaneo geométrico directo sobre la base de datos interna del modelo 3D (`FilteredElementCollector`).
   * Cuantificación automática (*Quantity Takeoff*) de **Estructura** (zapatas, columnas y vigas en $m^3$) y **Arquitectura** (losas/plantillas y muros en $m^2$).
   * Conversión paramétrica de unidades imperiales internas de Revit ($ft^2$, $ft^3$) al Sistema Internacional ($m^2$, $m^3$) y exportación en un clic mediante **Dynamo Player**.

2. **Aplicación Web de Captura en Campo (`index.html` - HTML5 / CSS3 / JS):**
   * Interfaz ligera para residentes e inspectores de obra que permite registrar avances físicos diarios desde cualquier dispositivo.
   * Cálculo automático de desperdicios (5%) y exportación estructurada en formato CSV con soporte de caracteres especiales (`UTF-8-SIG`).

3. **Centro de Mando Financiero y Almacén (`dashboard.py` - Python / Pandas / Streamlit):**
   * **Módulo Financiero 5D:** Cruce relacional (`pd.merge`) entre el presupuesto base BIM y el avance real ejecutado, generando tarjetas de KPIs (Presupuesto Total, Costo Ejecutado, Saldo por Ejecutar y % de Avance).
   * **Módulo de Explosión de Materiales:** Motor de dosificación que calcula automáticamente las cantidades comerciales de compra (bultos de cemento de 50 kg, acero figurado en kg, $m^3$ de arena y triturado, cajas de cerámica, mortero adhesivo y galones de pintura) con factor de desperdicio dinámico.
   * **Reportes Corporativos:** Generación en memoria (`io.BytesIO` + `openpyxl`) de libros de Excel (`.xlsx`) multipestaña listos para gerencia y compras.

---

## 🛠️ Tecnologías Utilizadas

* **Backend & Data Science:** Python, Pandas, OpenPyXL.
* **Frontend & Cloud UI:** Streamlit Community Cloud, Inyección CSS3 corporativa, HTML5, JavaScript (ES6).
* **BIM & Automatización CAD/3D:** Autodesk Revit 2027, Revit API (`Autodesk.Revit.DB`), Dynamo Visual Programming.

---
**Desarrollado por:** Ing. Juan — *Ingeniero Civil | Especialista en Automatización BIM & Desarrollo ConTech*
