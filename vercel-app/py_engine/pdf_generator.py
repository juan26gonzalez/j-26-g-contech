import io
import os
from datetime import datetime
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable, Image as RLImage
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas


class PresupuestoCanvas(canvas.Canvas):
    def __init__(self, *args, doc_title="Presupuesto Oficial de Obra", doc_badge="DOCUMENTO OFICIAL DE COSTOS", footer_txt="JGM ConTech • Presupuesto Contractual Oficial con Validez Jurídica", **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.doc_title = doc_title
        self.doc_badge = doc_badge
        self.footer_txt = footer_txt

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

        if self._pageNumber > 1:
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(36, 756, 576, 756)
            self.drawString(36, 760, f"JGM ConTech • {self.doc_title[:60]}")
            self.drawRightString(576, 760, self.doc_badge)

        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(36, 36, 576, 36)
        self.drawString(36, 26, self.footer_txt)
        self.drawRightString(576, 26, f"Página {self._pageNumber} de {page_count}")
        self.restoreState()


def _esc_xml(texto):
    """Escapa caracteres especiales XML para párrafos de ReportLab."""
    return str(texto or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _resolver_ubicacion_obra(proyecto_actual):
    """Retorna la dirección/ubicación estandarizada de la obra activa."""
    ubicacion = str(proyecto_actual.get("ubicacion", "")).strip()
    if not ubicacion or ubicacion in ["Sabanalarga, Atlántico", "Colombia"]:
        return "Calle 20D # 1 - 19. Sabanalarga, Atlántico"
    return ubicacion


def _obtener_firma_contratista_flowable(width=160, height=48):
    """Retorna el Flowable de imagen de firma oficial o un espaciador equivalente."""
    firma_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "firma_juan_gonzalez.png")
    if os.path.exists(firma_img_path):
        return RLImage(firma_img_path, width=width, height=height)
    return Spacer(1, height)


def _calcular_honorarios_consultoria(total_costo_directo, cfg_hon):
    """Calcula el desglose financiero de honorarios profesionales por consultoría de presupuesto y APU."""
    cfg = cfg_hon or {}
    modo = cfg.get("modo_calculo", "fijo")
    pct_hon = float(cfg.get("porcentaje", 5.0) or 0.0)
    val_fijo = float(cfg.get("valor_fijo", 200000.0) or 0.0)
    base_dir = float(total_costo_directo or 0.0)
    if modo == "porcentaje":
        val_hon = base_dir * (pct_hon / 100.0)
        base_desc = f"{pct_hon:.2f}% s/ Costo Directo"
    else:
        val_hon = val_fijo
        pct_eq = (val_hon / base_dir * 100.0) if base_dir > 0 else 0.0
        base_desc = f"Tarifa Fija (~{pct_eq:.1f}%)"
    incluir_iva = bool(cfg.get("incluir_iva_hon", False))
    iva_hon = (val_hon * 0.19) if incluir_iva else 0.0
    return {
        "val_hon": val_hon,
        "iva_hon": iva_hon,
        "total_hon": val_hon + iva_hon,
        "base_desc": base_desc,
        "incluir_iva": incluir_iva,
    }


def _construir_bloque_honorarios_pdf(cfg_hon, total_costo_directo, contratista_nom, estilos, solo_consultoria=False):
    """Construye la tabla y nota comercial de honorarios de consultoría para el PDF de Presupuesto y APU."""
    hon_calc = _calcular_honorarios_consultoria(total_costo_directo, cfg_hon)
    c_bold = estilos["cell_bold"]
    c_txt = estilos["cell_txt"]
    c_right = estilos["cell_right"]
    c_rbold = estilos["cell_right_bold"]

    hdr_col1 = "CONCEPTO DE CONSULTORÍA / REFERENCIA" if solo_consultoria else "CONCEPTO DE CONSULTORÍA TÉCNICA (APU)"
    rows = [[
        Paragraph(f"<b>{hdr_col1}</b>", c_bold),
        Paragraph("<b>MODALIDAD / BASE</b>", c_rbold),
        Paragraph("<b>VALOR (COP)</b>", c_rbold),
    ]]
    if solo_consultoria:
        rows.append([
            Paragraph("Inversión Estimada en Obra (Costo Directo de Referencia en Mercado — No es cobro de obra)", c_txt),
            Paragraph("Referencia", c_right),
            Paragraph(f"${total_costo_directo:,.0f}", c_right),
        ])

    rows.append([
        Paragraph("<b>Honorarios Profesionales por Consultoría Técnica</b> (Presupuesto, Cómputos Métricos y APU)", c_txt),
        Paragraph(_esc_xml(hon_calc["base_desc"]), c_right),
        Paragraph(f"${hon_calc['val_hon']:,.0f}", c_right),
    ])
    if hon_calc["incluir_iva"]:
        rows.append([
            Paragraph("(+) Impuesto IVA (19% sobre Honorarios de Consultoría)", c_txt),
            Paragraph("19.00%", c_right),
            Paragraph(f"${hon_calc['iva_hon']:,.0f}", c_right),
        ])
    if cfg_hon.get("incluir_visita", False):
        val_vis = float(cfg_hon.get("valor_visita", 70000.0) or 0.0)
        rows.append([
            Paragraph("Servicio Opcional: Supervisión Técnica / Visita de Inspección en Obra (si ejecuta tercero)", c_txt),
            Paragraph("Por Visita", c_right),
            Paragraph(f"${val_vis:,.0f} / visita", c_right),
        ])

    tot_label = (
        "TOTAL HONORARIOS A PAGAR POR CONSULTORÍA TÉCNICA"
        if solo_consultoria
        else "TOTAL HONORARIOS DE CONSULTORÍA (Si la obra la ejecuta un tercero)"
    )
    rows.append([
        Paragraph(f"<b>{tot_label}</b>", ParagraphStyle("HTotL", parent=c_bold, textColor=colors.HexColor("#1e3a8a"))),
        Paragraph("", c_txt),
        Paragraph(f"<b>${hon_calc['total_hon']:,.0f} COP</b>", ParagraphStyle("HTotR", parent=c_rbold, textColor=colors.HexColor("#1e3a8a"))),
    ])

    t_hon = Table(rows, colWidths=[280, 100, 160])
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    if solo_consultoria:
        t_style.append(("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f8fafc")))
    t_hon.setStyle(TableStyle(t_style))

    note_style = ParagraphStyle("HonNote", parent=c_txt, fontSize=7.4, leading=10.2, alignment=4, textColor=colors.HexColor("#1e293b"))
    notas_html = []
    if cfg_hon.get("bonificable", True):
        notas_html.append(
            f"<b>Condición Comercial (Bonificación 100% por Adjudicación):</b> Si EL CLIENTE contrata la ejecución integral de la obra con "
            f"<b>{_esc_xml(contratista_nom)} (JGM ConTech)</b>, el <b>100% de estos honorarios de consultoría serán bonificados (sin costo adicional)</b>. "
            f"En caso de ejecutar la obra con un tercero o por administración directa, deberá cancelar el valor de consultoría estipulado por concepto de cesión técnica del presupuesto, cómputos métricos y análisis APU."
        )
    notas_html.append(
        "<b>Alcance y Limitación de Responsabilidad:</b> La modalidad de consultoría técnica remunera exclusivamente la ingeniería de costos, cuantificación de cantidades y estructuración de APU. "
        "JGM ConTech no asume dirección de obra ni responsabilidad técnica, de calidad o sobrecostos por trabajos ejecutados por contratistas terceros."
    )
    nota_box = Table([[Paragraph("<br/>".join(notas_html), note_style)]], colWidths=[540])
    nota_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#93c5fd")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return [t_hon, Spacer(1, 5), nota_box]


def _construir_dataframe_5d(df_5d_or_rows):
    """Normaliza entrada (DataFrame o lista de dicts) a DataFrame con columnas esperadas."""
    if isinstance(df_5d_or_rows, pd.DataFrame):
        return df_5d_or_rows.copy()
    df = pd.DataFrame(df_5d_or_rows or [])
    if df.empty:
        return pd.DataFrame(columns=["Item", "Capitulo", "Actividad", "Unidad", "Cantidad_Contratada", "Precio_Unitario", "Presupuesto_Total"])
    for col in ["Cantidad_Contratada", "Precio_Unitario"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    if "Presupuesto_Total" not in df.columns:
        df["Presupuesto_Total"] = df["Cantidad_Contratada"] * df["Precio_Unitario"]
    else:
        df["Presupuesto_Total"] = pd.to_numeric(df["Presupuesto_Total"], errors="coerce").fillna(0.0)
    return df


def generar_presupuesto_pdf(df_5d_in, params_liquidacion, proyecto_actual, cfg_honorarios=None):
    """Genera el PDF profesional del presupuesto contractual de obra con APU, AIU, honorarios de consultoría y firmas."""
    df_5d = _construir_dataframe_5d(df_5d_in)
    cfg_hon = cfg_honorarios if cfg_honorarios is not None else (proyecto_actual.get("honorarios_consultoria") or {})
    incluir_hon = bool(cfg_hon.get("incluir", False))
    solo_consultoria = incluir_hon and (cfg_hon.get("escenario", "anexo_aiu") == "solo_consultoria")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=40, bottomMargin=45)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("DocTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=13.5 if solo_consultoria else 14, leading=17, textColor=colors.HexColor("#0f172a"))
    subtitle_style = ParagraphStyle("DocSub", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#2563eb"))
    sec_heading = ParagraphStyle("SecHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#1e3a8a"))
    cell_text = ParagraphStyle("CellText", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9, textColor=colors.HexColor("#1e293b"))
    cell_text_bold = ParagraphStyle("CellTextBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=colors.HexColor("#0f172a"))
    cell_chap = ParagraphStyle("CellChap", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.8, leading=9.5, textColor=colors.HexColor("#1e3a8a"))
    cell_right = ParagraphStyle("CellRight", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9, alignment=2, textColor=colors.HexColor("#0f172a"))
    cell_right_bold = ParagraphStyle("CellRightBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, alignment=2, textColor=colors.HexColor("#0f172a"))

    story = []
    fecha_actual_str = datetime.now().strftime("%d/%m/%Y")
    proy_nombre = proyecto_actual.get("nombre", "Proyecto de Construcción")
    ubicacion_actual = _resolver_ubicacion_obra(proyecto_actual)
    es_ppto = proyecto_actual.get("tipo") == "presupuesto" or "PRESUPUESTO" in str(proyecto_actual.get("badge", "")).upper()
    modalidad_str = "CONSULTORÍA APU" if solo_consultoria else ("PRESUPUESTO" if es_ppto else "BIM 5D")
    titulo_doc = "PRESUPUESTO BASE, APU Y CONSULTORÍA TÉCNICA" if solo_consultoria else "PRESUPUESTO GENERAL DE OBRA Y APU"

    header_data = [
        [
            Paragraph("<b>JGM ConTech</b>", subtitle_style),
            Paragraph(f"<b>FECHA DE EMISIÓN:</b> {fecha_actual_str}", ParagraphStyle("HeadR", parent=cell_right, fontSize=7)),
        ],
        [
            Paragraph(titulo_doc, title_style),
            Paragraph(f"<b>CÓDIGO:</b> PPTO-{_esc_xml(str(proyecto_actual.get('id', 'PROY')).upper()[:12])}", ParagraphStyle("HeadR2", parent=cell_right, fontSize=8, textColor=colors.HexColor("#1e3a8a"))),
        ],
        [
            Paragraph(f"<b>Proyecto:</b> {_esc_xml(proy_nombre)} • {_esc_xml(ubicacion_actual)}", cell_text),
            Paragraph(f"<b>Modalidad:</b> {modalidad_str}", cell_right),
        ],
    ]
    header_table = Table(header_data, colWidths=[360, 180])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.extend([header_table, Spacer(1, 4), HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=8, spaceBefore=4)])

    contratante_nom = proyecto_actual.get("contratante", "Cliente Privado")
    cedula_cliente = str(proyecto_actual.get("cedula_cliente", "")).strip()
    contratista_nom = proyecto_actual.get("contratista", "Ing. Juan González Mendoza")
    cedula_contratista = str(proyecto_actual.get("cedula_contratista", "C.C. 1001867834 • M.P. 021037-0828864 ATL")).strip()
    cargo_contratista = proyecto_actual.get("cargo_contratista", "Ingeniero Residente de Obra")

    txt_cliente = f"<b>{_esc_xml(contratante_nom)}</b>"
    if cedula_cliente:
        txt_cliente += f"<br/><font color='#64748b'>C.C. / NIT: {_esc_xml(cedula_cliente)}</font>"

    txt_contratista = f"<b>{_esc_xml(contratista_nom)}</b>"
    if cedula_contratista:
        txt_contratista += f"<br/><font color='#64748b'>{_esc_xml(cedula_contratista)}</font>"
    if cargo_contratista:
        txt_contratista += f"<br/><font color='#2563eb'><b>{_esc_xml(cargo_contratista)}</b></font>"

    rol_der = "DIRECCIÓN TÉCNICA / CONSULTOR:" if solo_consultoria else "DIRECCIÓN TÉCNICA / CONTRATISTA:"
    meta_data = [
        [
            Paragraph("<b>ENTIDAD CONTRATANTE / CLIENTE:</b>", cell_text_bold),
            Paragraph(txt_cliente, cell_text),
            Paragraph(f"<b>{rol_der}</b>", cell_text_bold),
            Paragraph(txt_contratista, cell_text),
        ],
        [
            Paragraph("<b>UBICACIÓN DE LA OBRA:</b>", cell_text_bold),
            Paragraph(_esc_xml(ubicacion_actual), cell_text),
            Paragraph("<b>MODELO / ESPECIFICACIÓN:</b>", cell_text_bold),
            Paragraph(_esc_xml(proyecto_actual.get("modelo_bim", "Presupuesto Base APU")), cell_text),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[120, 150, 130, 140])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.extend([meta_table, Spacer(1, 8)])

    # 1. RESUMEN EJECUTIVO POR CAPÍTULOS
    story.extend([Paragraph("1. RESUMEN EJECUTIVO POR CAPÍTULOS", sec_heading), Spacer(1, 4)])
    total_costo_directo = float(df_5d["Presupuesto_Total"].sum()) if not df_5d.empty else 0.0
    resumen_caps = df_5d.groupby("Capitulo", sort=False)["Presupuesto_Total"].sum().reset_index() if not df_5d.empty else pd.DataFrame(columns=["Capitulo", "Presupuesto_Total"])
    resumen_caps["Pct"] = (resumen_caps["Presupuesto_Total"] / total_costo_directo * 100) if total_costo_directo > 0 else 0

    tabla_caps_data = [[
        Paragraph("<b>Capítulo de Obra</b>", ParagraphStyle("ThC", parent=cell_text_bold, textColor=colors.white)),
        Paragraph("<b>Subtotal Costo Directo ($ COP)</b>", ParagraphStyle("ThR", parent=cell_right_bold, textColor=colors.white)),
        Paragraph("<b>Participación (%)</b>", ParagraphStyle("ThR2", parent=cell_right_bold, textColor=colors.white)),
    ]]
    for _, r in resumen_caps.iterrows():
        tabla_caps_data.append([
            Paragraph(_esc_xml(r["Capitulo"]), cell_text),
            Paragraph(f"${r['Presupuesto_Total']:,.0f}", cell_right),
            Paragraph(f"{r['Pct']:.1f}%", cell_right),
        ])
    tabla_caps_data.append([
        Paragraph("<b>TOTAL COSTO DIRECTO DE OBRA</b>", cell_text_bold),
        Paragraph(f"<b>${total_costo_directo:,.0f}</b>", cell_right_bold),
        Paragraph("<b>100.0%</b>", cell_right_bold),
    ])

    t_caps = Table(tabla_caps_data, colWidths=[280, 160, 100])
    t_caps.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eff6ff")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([t_caps, Spacer(1, 10)])

    # 2. MATRIZ DETALLADA DE ÍTEMS Y ACTIVIDADES APU
    story.extend([Paragraph("2. MATRIZ DETALLADA DE CANTIDADES Y PRECIOS UNITARIOS (APU)", sec_heading), Spacer(1, 4)])
    matriz_headers = [
        Paragraph("<b>Ítem</b>", ParagraphStyle("MTh1", parent=cell_text_bold, textColor=colors.white, alignment=1)),
        Paragraph("<b>Descripción de la Actividad Constructiva (APU)</b>", ParagraphStyle("MTh2", parent=cell_text_bold, textColor=colors.white)),
        Paragraph("<b>Und</b>", ParagraphStyle("MTh3", parent=cell_text_bold, textColor=colors.white, alignment=1)),
        Paragraph("<b>Cantidad</b>", ParagraphStyle("MTh4", parent=cell_right_bold, textColor=colors.white)),
        Paragraph("<b>Precio Unit. ($)</b>", ParagraphStyle("MTh5", parent=cell_right_bold, textColor=colors.white)),
        Paragraph("<b>Subtotal ($ COP)</b>", ParagraphStyle("MTh6", parent=cell_right_bold, textColor=colors.white)),
    ]
    matriz_rows = [matriz_headers]
    cap_actual = None
    table_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]

    row_idx = 1
    for _, r in df_5d.iterrows():
        cap_fila = r["Capitulo"]
        if cap_fila != cap_actual:
            cap_actual = cap_fila
            subtotal_cap = float(df_5d[df_5d["Capitulo"] == cap_actual]["Presupuesto_Total"].sum())
            matriz_rows.append([
                Paragraph("<b>CAP.</b>", cell_chap),
                Paragraph(f"<b>{_esc_xml(str(cap_actual).upper())}</b>", cell_chap),
                Paragraph("", cell_text),
                Paragraph("", cell_text),
                Paragraph("<b>Subtotal:</b>", cell_right_bold),
                Paragraph(f"<b>${subtotal_cap:,.0f}</b>", cell_right_bold),
            ])
            table_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#f1f5f9")))
            table_styles.append(("LINEBELOW", (0, row_idx), (-1, row_idx), 1, colors.HexColor("#93c5fd")))
            row_idx += 1

        matriz_rows.append([
            Paragraph(_esc_xml(r["Item"]), ParagraphStyle("CItem", parent=cell_text, alignment=1)),
            Paragraph(_esc_xml(r["Actividad"]), cell_text),
            Paragraph(_esc_xml(r["Unidad"]), ParagraphStyle("CUnd", parent=cell_text, alignment=1)),
            Paragraph(f"{r['Cantidad_Contratada']:,.2f}", cell_right),
            Paragraph(f"${r['Precio_Unitario']:,.0f}", cell_right),
            Paragraph(f"${r['Presupuesto_Total']:,.0f}", cell_right),
        ])
        if row_idx % 2 == 1:
            table_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#fafafa")))
        row_idx += 1

    t_matriz = Table(matriz_rows, colWidths=[36, 244, 30, 60, 75, 95], repeatRows=1)
    t_matriz.setStyle(TableStyle(table_styles))
    story.extend([t_matriz, Spacer(1, 10)])

    firma_flowable = _obtener_firma_contratista_flowable(160, 48)
    sig_contratista_html = f"<b>{_esc_xml(contratista_nom.upper())}</b><br/><b>{_esc_xml(cargo_contratista)}</b>"
    sig_cliente_html = (
        f"<b>{_esc_xml(contratante_nom.upper())}</b><br/>"
        f"{('C.C. / NIT: ' + _esc_xml(cedula_cliente) + '<br/>') if cedula_cliente else ''}"
        f"<b>{'Cliente / Solicitante de Consultoría' if solo_consultoria else 'Entidad Contratante / Supervisión'}</b>"
    )
    lbl_sig_izq = "DIRECCIÓN TÉCNICA / INGENIERO CONSULTOR" if solo_consultoria else "DIRECCIÓN TÉCNICA / CONTRATISTA"
    lbl_sig_der = "SOLICITANTE / CLIENTE" if solo_consultoria else "SUPERVISIÓN / CLIENTE CONTRATANTE"
    tabla_firmas = Table([
        [firma_flowable, Spacer(1, 48)],
        [
            Paragraph(f"____________________________________________<br/><b>{lbl_sig_izq}</b><br/>" + sig_contratista_html, ParagraphStyle("SigL", parent=cell_text, alignment=1, leading=10)),
            Paragraph(f"____________________________________________<br/><b>{lbl_sig_der}</b><br/>" + sig_cliente_html, ParagraphStyle("SigR", parent=cell_text, alignment=1, leading=10)),
        ],
    ], colWidths=[270, 270])
    tabla_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
        ("VALIGN", (0, 1), (-1, 1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
    ]))

    estilos_hon = {"cell_txt": cell_text, "cell_bold": cell_text_bold, "cell_right": cell_right, "cell_right_bold": cell_right_bold}

    if solo_consultoria:
        story.append(KeepTogether([
            Paragraph("3. INVERSIÓN ESTIMADA DE OBRA Y HONORARIOS DE CONSULTORÍA", sec_heading),
            Spacer(1, 4),
            *_construir_bloque_honorarios_pdf(cfg_hon, total_costo_directo, contratista_nom, estilos_hon, solo_consultoria=True),
            Spacer(1, 14),
            tabla_firmas,
        ]))
    else:
        pct_a = float(params_liquidacion.get("pct_a", 8.0))
        pct_i = float(params_liquidacion.get("pct_i", 2.0))
        pct_u = float(params_liquidacion.get("pct_u", 5.0))
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
            [Paragraph("(+) Administración", cell_text), Paragraph(f"{pct_a:.2f}%", cell_right), Paragraph(f"${val_a:,.0f}", cell_right)],
            [Paragraph("(+) Imprevistos", cell_text), Paragraph(f"{pct_i:.2f}%", cell_right), Paragraph(f"${val_i:,.0f}", cell_right)],
            [Paragraph("(+) Utilidad", cell_text), Paragraph(f"{pct_u:.2f}%", cell_right), Paragraph(f"${val_u:,.0f}", cell_right)],
            [Paragraph("<b>SUBTOTAL PRESUPUESTO BRUTO (Directo + AIU)</b>", cell_text_bold), Paragraph(f"<b>{100 + pct_a + pct_i + pct_u:.2f}%</b>", cell_right_bold), Paragraph(f"<b>${val_bruto:,.0f}</b>", cell_right_bold)],
            [Paragraph("(+) Impuesto IVA (19% sobre Utilidad)", cell_text), Paragraph(f"{pct_u*0.19:.2f}%", cell_right), Paragraph(f"${iva_u:,.0f}", cell_right)],
            [Paragraph("<b>PRESUPUESTO TOTAL OFICIAL DE CONTRATACIÓN</b>", ParagraphStyle("TotL", parent=cell_text_bold, textColor=colors.HexColor("#1e3a8a"))), Paragraph("", cell_text), Paragraph(f"<b>${total_ppto_global:,.0f} COP</b>", ParagraphStyle("TotR", parent=cell_right_bold, textColor=colors.HexColor("#1e3a8a")))],
        ]
        t_liq = Table(liq_data, colWidths=[280, 100, 160])
        t_liq.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#f8fafc")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))

        if incluir_hon:
            story.append(KeepTogether([Paragraph("3. LIQUIDACIÓN CONTRACTUAL Y FACTOR AIU (OPCIÓN EJECUCIÓN DE OBRA)", sec_heading), Spacer(1, 4), t_liq]))
            story.append(Spacer(1, 10))
            story.append(KeepTogether([
                Paragraph("4. HONORARIOS PROFESIONALES POR CONSULTORÍA TÉCNICA (PRESUPUESTO Y APU)", sec_heading),
                Spacer(1, 4),
                *_construir_bloque_honorarios_pdf(cfg_hon, total_costo_directo, contratista_nom, estilos_hon, solo_consultoria=False),
                Spacer(1, 14),
                tabla_firmas,
            ]))
        else:
            story.append(KeepTogether([Paragraph("3. LIQUIDACIÓN CONTRACTUAL Y FACTOR AIU", sec_heading), Spacer(1, 4), t_liq, Spacer(1, 14), tabla_firmas]))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(
        *args,
        doc_title=f"Consultoría Presupuesto y APU - {proy_nombre}" if solo_consultoria else "Presupuesto Oficial de Obra",
        doc_badge="CONSULTORÍA TÉCNICA APU" if solo_consultoria else "DOCUMENTO OFICIAL DE COSTOS",
        footer_txt="JGM ConTech • Estudio Técnico de Presupuesto y APU (Honorarios de Consultoría)" if solo_consultoria else "JGM ConTech • Presupuesto Contractual Oficial con Validez Jurídica",
        **kwargs,
    )
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer


def _construir_membrete_contrato_pdf(titulo_doc, codigo_doc, modalidad_doc, proy_nombre, ubicacion_actual, fecha_str):
    """Construye el membrete institucional JGM ConTech estándar para contratos PDF."""
    styles = getSampleStyleSheet()
    title_st = ParagraphStyle("CTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=13.5, leading=16.5, textColor=colors.HexColor("#0f172a"))
    sub_st = ParagraphStyle("CSub", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#2563eb"))
    meta_st = ParagraphStyle("CMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=7.4, leading=9.5, textColor=colors.HexColor("#1e293b"))
    right_st = ParagraphStyle("CRight", parent=styles["Normal"], fontName="Helvetica", fontSize=7.4, leading=9.5, alignment=2, textColor=colors.HexColor("#0f172a"))

    header_data = [
        [Paragraph("<b>JGM ConTech</b>", sub_st), Paragraph(f"<b>FECHA DE EMISIÓN:</b> {_esc_xml(fecha_str)}", right_st)],
        [Paragraph(_esc_xml(titulo_doc), title_st), Paragraph(f"<b>NRO. DOCUMENTO:</b> {_esc_xml(codigo_doc)}", ParagraphStyle("CR2", parent=right_st, fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#1e3a8a")))],
        [Paragraph(f"<b>Proyecto:</b> {_esc_xml(proy_nombre)} • {_esc_xml(ubicacion_actual)}", meta_st), Paragraph(f"<b>Modalidad:</b> {_esc_xml(modalidad_doc)}", right_st)],
    ]
    header_table = Table(header_data, colWidths=[360, 180])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [header_table, Spacer(1, 4), HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=10, spaceBefore=4)]


def _crear_estilos_legales_pdf():
    """Retorna estilos tipográficos unificados para contratos jurídicos."""
    styles = getSampleStyleSheet()
    return {
        "legal_body": ParagraphStyle("LegalBody", parent=styles["Normal"], fontName="Helvetica", fontSize=8.4, leading=11.8, alignment=4, textColor=colors.HexColor("#1e293b"), spaceAfter=5),
        "clause_hdr": ParagraphStyle("ClauseHdr", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.6, leading=11.5, textColor=colors.HexColor("#1e3a8a"), spaceBefore=6, spaceAfter=2),
        "cell_txt": ParagraphStyle("LCell", parent=styles["Normal"], fontName="Helvetica", fontSize=7.4, leading=9.5, textColor=colors.HexColor("#1e293b")),
        "cell_bold": ParagraphStyle("LCellB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.4, leading=9.5, textColor=colors.HexColor("#0f172a")),
        "cell_right": ParagraphStyle("LCellR", parent=styles["Normal"], fontName="Helvetica", fontSize=7.4, leading=9.5, alignment=2, textColor=colors.HexColor("#0f172a")),
        "cell_right_bold": ParagraphStyle("LCellRB", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.4, leading=9.5, alignment=2, textColor=colors.HexColor("#0f172a")),
    }


def generar_contrato_cliente_pdf(df_5d_in, params_liquidacion, proyecto_actual, cfg):
    """Genera el PDF formal del Contrato Civil de Obra Material a Precios Unitarios Fijos con Factor AIU."""
    df_5d = _construir_dataframe_5d(df_5d_in)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=38, bottomMargin=45)
    st_l = _crear_estilos_legales_pdf()
    story = []

    proy_nombre = proyecto_actual.get("nombre", "Proyecto de Construcción")
    ubicacion_actual = _resolver_ubicacion_obra(proyecto_actual)
    contratante_nom = proyecto_actual.get("contratante", "Cliente Privado")
    cedula_cliente = str(proyecto_actual.get("cedula_cliente", "")).strip()
    contratista_nom = proyecto_actual.get("contratista", "Ing. Juan González Mendoza")
    cedula_contratista = str(proyecto_actual.get("cedula_contratista", "C.C. 1001867834 • M.P. 021037-0828864 ATL")).strip()
    cargo_contratista = proyecto_actual.get("cargo_contratista", "Ingeniero Residente de Obra")
    fecha_str = cfg.get("fecha_firma", datetime.now().strftime("%d/%m/%Y"))

    story.extend(_construir_membrete_contrato_pdf(
        "CONTRATO CIVIL DE OBRA MATERIAL",
        f"CTO-{cfg.get('num_contrato', 'JGM-001')}",
        "PRECIOS UNITARIOS + AIU",
        proy_nombre,
        ubicacion_actual,
        fecha_str,
    ))

    id_cli_str = f", identificado(a) con <b>{_esc_xml(cedula_cliente)}</b>" if cedula_cliente else ""
    intro_html = (
        f"Entre los suscritos a saber: por una parte, <b>{_esc_xml(contratante_nom.upper())}</b>{id_cli_str}, "
        f"quien para todos los efectos del presente documento se denominará <b>EL CONTRATANTE</b>; y por la otra parte, "
        f"<b>{_esc_xml(contratista_nom.upper())}</b>, mayor de edad, Ingeniero Civil identificado con <b>{_esc_xml(cedula_contratista)}</b>, "
        f"actuando en calidad de <b>{_esc_xml(cargo_contratista)}</b>, quien en adelante se denominará <b>EL CONTRATISTA</b>, "
        f"hemos acordado celebrar el presente <b>CONTRATO DE OBRA CIVIL A PRECIOS UNITARIOS FIJOS CON FACTOR AIU</b>, "
        f"regido por la legislación civil colombiana vigente y las siguientes cláusulas:"
    )
    story.append(Paragraph(intro_html, st_l["legal_body"]))

    story.append(Paragraph("CLÁUSULA PRIMERA – OBJETO Y ALCANCE DE LA OBRA", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"EL CONTRATISTA se obliga para con EL CONTRATANTE a ejecutar a todo costo (suministro de materiales de primera calidad, "
        f"mano de obra calificada, dirección técnica, herramienta menor y equipo), las actividades constructivas correspondientes al proyecto "
        f"<b>{_esc_xml(proy_nombre)}</b> en el inmueble ubicado en <b>{_esc_xml(ubicacion_actual)}</b>, conforme al siguiente detalle técnico:",
        st_l["legal_body"],
    ))

    t_rows = [[
        Paragraph("<b>Ítem</b>", ParagraphStyle("CTH1", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph("<b>Descripción de Actividad Constructiva (APU)</b>", ParagraphStyle("CTH2", parent=st_l["cell_bold"], textColor=colors.white)),
        Paragraph("<b>Und</b>", ParagraphStyle("CTH3", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph("<b>Cant.</b>", ParagraphStyle("CTH4", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph("<b>P. Unit. ($)</b>", ParagraphStyle("CTH5", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph("<b>Subtotal ($ COP)</b>", ParagraphStyle("CTH6", parent=st_l["cell_right_bold"], textColor=colors.white)),
    ]]
    for _, r in df_5d.iterrows():
        t_rows.append([
            Paragraph(_esc_xml(r["Item"]), ParagraphStyle("CTI", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(_esc_xml(r["Actividad"]), st_l["cell_txt"]),
            Paragraph(_esc_xml(r["Unidad"]), ParagraphStyle("CTU", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(f"{r['Cantidad_Contratada']:,.2f}", st_l["cell_right"]),
            Paragraph(f"${r['Precio_Unitario']:,.0f}", st_l["cell_right"]),
            Paragraph(f"${r['Presupuesto_Total']:,.0f}", st_l["cell_right"]),
        ])
    t_items = Table(t_rows, colWidths=[36, 254, 30, 55, 75, 90], repeatRows=1)
    t_items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([t_items, Spacer(1, 6)])

    total_directo = float(df_5d["Presupuesto_Total"].sum()) if not df_5d.empty else 0.0
    pct_a = float(params_liquidacion.get("pct_a", 8.0))
    pct_i = float(params_liquidacion.get("pct_i", 2.0))
    pct_u = float(params_liquidacion.get("pct_u", 5.0))
    val_a = total_directo * (pct_a / 100.0)
    val_i = total_directo * (pct_i / 100.0)
    val_u = total_directo * (pct_u / 100.0)
    val_aiu = val_a + val_i + val_u
    val_bruto = total_directo + val_aiu
    iva_u = (val_u * 0.19) if cfg.get("incluir_iva_u", False) else 0.0
    total_contrato = val_bruto + iva_u

    story.append(Paragraph("CLÁUSULA SEGUNDA – VALOR DEL CONTRATO Y LIQUIDACIÓN AIU", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"El valor total estimado del presente contrato asciende a la suma de <b>${total_contrato:,.0f} COP</b>, "
        f"desglosado en Costo Directo de actividades más el factor AIU (Administración, Imprevistos y Utilidad). "
        f"Las cantidades finales a cobrar serán las efectivamente medidas y recibidas en obra:",
        st_l["legal_body"],
    ))

    liq_rows = [
        [Paragraph("<b>CONCEPTO CONTRACTUAL</b>", st_l["cell_bold"]), Paragraph("<b>PORCENTAJE</b>", st_l["cell_right_bold"]), Paragraph("<b>VALOR ($ COP)</b>", st_l["cell_right_bold"])],
        [Paragraph("Costo Directo de Obra (Materiales + Mano de Obra + Equipos)", st_l["cell_txt"]), Paragraph("100.00%", st_l["cell_right"]), Paragraph(f"${total_directo:,.0f}", st_l["cell_right"])],
        [Paragraph("(+) Administración (Dirección Técnica, Gestión y Operación)", st_l["cell_txt"]), Paragraph(f"{pct_a:.2f}%", st_l["cell_right"]), Paragraph(f"${val_a:,.0f}", st_l["cell_right"])],
        [Paragraph("(+) Imprevistos", st_l["cell_txt"]), Paragraph(f"{pct_i:.2f}%", st_l["cell_right"]), Paragraph(f"${val_i:,.0f}", st_l["cell_right"])],
        [Paragraph("(+) Utilidad del Contratista", st_l["cell_txt"]), Paragraph(f"{pct_u:.2f}%", st_l["cell_right"]), Paragraph(f"${val_u:,.0f}", st_l["cell_right"])],
    ]
    if cfg.get("incluir_iva_u", False):
        liq_rows.append([Paragraph("(+) Impuesto IVA (19% sobre Utilidad)", st_l["cell_txt"]), Paragraph(f"{pct_u*0.19:.2f}%", st_l["cell_right"]), Paragraph(f"${iva_u:,.0f}", st_l["cell_right"])])
    liq_rows.append([
        Paragraph("<b>VALOR TOTAL DEL CONTRATO</b>", ParagraphStyle("CTotL", parent=st_l["cell_bold"], textColor=colors.HexColor("#1e3a8a"))),
        Paragraph("", st_l["cell_txt"]),
        Paragraph(f"<b>${total_contrato:,.0f} COP</b>", ParagraphStyle("CTotR", parent=st_l["cell_right_bold"], textColor=colors.HexColor("#1e3a8a"))),
    ])
    t_val = Table(liq_rows, colWidths=[300, 100, 140])
    t_val.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([t_val, Spacer(1, 4)])

    p_ant = float(cfg.get("pct_anticipo", 50.0))
    p_cor = float(cfg.get("pct_corte", 40.0))
    p_sal = float(cfg.get("pct_saldo", 10.0))
    v_ant = total_contrato * (p_ant / 100.0)
    v_cor = total_contrato * (p_cor / 100.0)
    v_sal = total_contrato * (p_sal / 100.0)

    story.append(Paragraph("CLÁUSULA TERCERA – FORMA DE PAGO", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"EL CONTRATANTE pagará a EL CONTRATISTA el valor del contrato de la siguiente manera: "
        f"<b>1) Anticipo ({p_ant:.0f}%):</b> La suma de <b>${v_ant:,.0f} COP</b> a la firma del presente documento para compra inicial de materiales e inicio de obra; "
        f"<b>2) Avance / Corte de Obra ({p_cor:.0f}%):</b> La suma de <b>${v_cor:,.0f} COP</b> contra avance físico verificado en obra; y "
        f"<b>3) Saldo Final ({p_sal:.0f}%):</b> La suma de <b>${v_sal:,.0f} COP</b> al concluir el 100% de las actividades, entrega del área limpia y firma del Acta de Recibo a Satisfacción.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA CUARTA – PLAZO DE EJECUCIÓN", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"El plazo estimado para la ejecución total de la obra será de <b>{int(cfg.get('plazo_dias', 15))} días hábiles</b> contados a partir "
        f"del desembolso efectivo del anticipo y la entrega del área de trabajo completamente despejada por parte de EL CONTRATANTE.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA QUINTA – OBLIGACIONES DE LAS PARTES", st_l["clause_hdr"]))
    story.append(Paragraph(
        "<b>De EL CONTRATISTA:</b> Ejecutar los trabajos con materiales de óptima calidad, bajo supervisión directa del Ingeniero Civil residente, "
        "manteniendo el orden constructivo y asumiendo el cumplimiento de seguridad social (EPS/ARL) de su equipo de trabajo. "
        "<b>De EL CONTRATANTE:</b> Permitir el libre acceso al inmueble en horarios laborales, garantizar puntos básicos de agua y energía eléctrica para obra, "
        "y efectuar oportunamente los desembolsos en las fechas de corte acordadas.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA SEXTA – MAYORES CANTIDADES Y OBRAS ADICIONALES", st_l["clause_hdr"]))
    story.append(Paragraph(
        "Cualquier trabajo no contemplado en la Cláusula Primera, modificación arquitectónica o ampliación de áreas solicitada por EL CONTRATANTE "
        "será liquidada mediante Acta de Mayor Cantidad o Adicional utilizando los precios unitarios base o nuevos APU previamente aprobados por escrito.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA SÉPTIMA – GARANTÍA DE CALIDAD Y ESTABILIDAD", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"EL CONTRATISTA garantiza la estabilidad técnica y correcta ejecución de la mano de obra realizada por un término de "
        f"<b>{int(cfg.get('garantia_meses', 12))} meses</b> contados desde la fecha del Acta de Recibo Final, respondiendo por defectos constructivos "
        f"imputables a su instalación (no cubre daños por mal uso o eventos de fuerza mayor).",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA OCTAVA – AUTONOMÍA E INDEMNIDAD", st_l["clause_hdr"]))
    story.append(Paragraph(
        "EL CONTRATISTA ejecutará la obra con plena autonomía técnica, financiera y directiva, sin existir subordinación laboral respecto de EL CONTRATANTE.",
        st_l["legal_body"],
    ))

    notas = str(cfg.get("notas_adicionales", "")).strip()
    if notas:
        story.append(Paragraph("CLÁUSULA NOVENA – OBSERVACIONES ESPECIALES", st_l["clause_hdr"]))
        story.append(Paragraph(_esc_xml(notas), st_l["legal_body"]))

    firma_flowable = _obtener_firma_contratista_flowable(160, 48)
    sig_contra_html = f"<b>{_esc_xml(contratista_nom.upper())}</b><br/><b>{_esc_xml(cargo_contratista)}</b>"
    sig_cli_html = (
        f"<b>{_esc_xml(contratante_nom.upper())}</b><br/>"
        f"{('C.C. / NIT: ' + _esc_xml(cedula_cliente) + '<br/>') if cedula_cliente else ''}"
        f"<b>Propietario / Entidad Contratante</b>"
    )
    t_firmas = Table([
        [firma_flowable, Spacer(1, 48)],
        [
            Paragraph("____________________________________________<br/><b>EL CONTRATISTA</b><br/>" + sig_contra_html, ParagraphStyle("CSL", parent=st_l["cell_txt"], alignment=1, leading=10)),
            Paragraph("____________________________________________<br/><b>EL CONTRATANTE</b><br/>" + sig_cli_html, ParagraphStyle("CSR", parent=st_l["cell_txt"], alignment=1, leading=10)),
        ],
    ], colWidths=[270, 270])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
        ("VALIGN", (0, 1), (-1, 1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
    ]))

    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"Para constancia y validez se firma en {_esc_xml(ubicacion_actual)}, a los {_esc_xml(fecha_str)}.", st_l["legal_body"]),
        Spacer(1, 10),
        t_firmas,
    ]))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(
        *args,
        doc_title=f"Contrato Obra {proy_nombre}",
        doc_badge="CONTRATO CIVIL DE OBRA",
        footer_txt="JGM ConTech • Contrato Civil de Obra Oficial con Validez Jurídica",
        **kwargs,
    )
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer


def generar_subcontrato_oficial_pdf(df_items_sub_in, proyecto_actual, cfg):
    """Genera el PDF del Subcontrato Civil de Mano de Obra a Destajo (Precios Unitarios)."""
    df_items_sub = pd.DataFrame(df_items_sub_in or [])
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=38, bottomMargin=45)
    st_l = _crear_estilos_legales_pdf()
    story = []

    proy_nombre = proyecto_actual.get("nombre", "Proyecto de Construcción")
    ubicacion_actual = _resolver_ubicacion_obra(proyecto_actual)
    contratista_nom = proyecto_actual.get("contratista", "Ing. Juan González Mendoza")
    cedula_contratista = str(proyecto_actual.get("cedula_contratista", "C.C. 1001867834 • M.P. 021037-0828864 ATL")).strip()
    cargo_contratista = proyecto_actual.get("cargo_contratista", "Ingeniero Residente de Obra")
    fecha_str = cfg.get("fecha_inicio", datetime.now().strftime("%d/%m/%Y"))

    nom_oficial = str(cfg.get("nombre_oficial", "Oficial Instalador")).strip() or "Oficial Instalador"
    ced_oficial = str(cfg.get("cedula_oficial", "")).strip() or "____________________"
    tel_oficial = str(cfg.get("telefono_oficial", "")).strip() or "N/A"
    esp_oficial = str(cfg.get("especialidad", "Albañilería y Acabados")).strip()
    pct_ret = float(cfg.get("pct_retencion", 10.0))

    story.extend(_construir_membrete_contrato_pdf(
        "SUBCONTRATO DE MANO DE OBRA A DESTAJO",
        f"{cfg.get('num_subcontrato', 'SUB-001')}",
        "PRECIOS UNITARIOS A DESTAJO",
        proy_nombre,
        ubicacion_actual,
        fecha_str,
    ))

    intro_html = (
        f"Entre los suscritos a saber: <b>{_esc_xml(contratista_nom.upper())}</b>, mayor de edad, Ingeniero Civil identificado con "
        f"<b>{_esc_xml(cedula_contratista)}</b>, actuando como Contratista Principal / Director Técnico, quien en adelante se denominará "
        f"<b>EL CONTRATANTE</b>; y por la otra parte, <b>{_esc_xml(nom_oficial.upper())}</b>, mayor de edad, identificado con Cédula de Ciudadanía "
        f"No. <b>{_esc_xml(ced_oficial)}</b>, teléfono <b>{_esc_xml(tel_oficial)}</b>, especialista en <b>{_esc_xml(esp_oficial)}</b>, quien actúa de forma "
        f"autónoma con su propia herramienta y equipo auxiliar, y en adelante se denominará <b>EL SUBCONTRATISTA</b>, hemos acordado celebrar el "
        f"presente <b>SUBCONTRATO CIVIL DE MANO DE OBRA A DESTAJO</b>, regido por las siguientes cláusulas:"
    )
    story.append(Paragraph(intro_html, st_l["legal_body"]))

    story.append(Paragraph("CLÁUSULA PRIMERA – OBJETO Y TARIFAS UNITARIAS DE MANO DE OBRA (DESTAJO)", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"EL SUBCONTRATISTA se obliga a ejecutar con excelencia técnica, exclusivamente a todo costo de mano de obra (a destajo), las actividades "
        f"seleccionadas a continuación dentro de la obra ubicada en <b>{_esc_xml(ubicacion_actual)}</b>. Las cantidades definitivas a pagar serán las "
        f"realmente instaladas y medidas físicamente por el Ingeniero Residente:",
        st_l["legal_body"],
    ))

    t_rows = [[
        Paragraph("<b>Ítem</b>", ParagraphStyle("STH1", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph("<b>Descripción de la Actividad Contratada (Solo Mano de Obra)</b>", ParagraphStyle("STH2", parent=st_l["cell_bold"], textColor=colors.white)),
        Paragraph("<b>Und</b>", ParagraphStyle("STH3", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph("<b>Cant. Est.</b>", ParagraphStyle("STH4", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph("<b>Tarifa M.O. ($)</b>", ParagraphStyle("STH5", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph("<b>Subtotal Est. ($)</b>", ParagraphStyle("STH6", parent=st_l["cell_right_bold"], textColor=colors.white)),
    ]]

    total_mo_est = 0.0
    for _, r in df_items_sub.iterrows():
        cant = float(r.get("Cantidad_Contratada", 0.0) or 0.0)
        tarifa = float(r.get("Tarifa_Mano_Obra", 0.0) or 0.0)
        sub_mo = cant * tarifa
        total_mo_est += sub_mo
        t_rows.append([
            Paragraph(_esc_xml(r.get("Item", "")), ParagraphStyle("STI", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(_esc_xml(r.get("Actividad", "")), st_l["cell_txt"]),
            Paragraph(_esc_xml(r.get("Unidad", "und")), ParagraphStyle("STU", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(f"{cant:,.2f}", st_l["cell_right"]),
            Paragraph(f"${tarifa:,.0f}", st_l["cell_right"]),
            Paragraph(f"${sub_mo:,.0f}", st_l["cell_right"]),
        ])
    t_rows.append([
        Paragraph("", st_l["cell_txt"]),
        Paragraph("<b>TOTAL ESTIMADO DE MANO DE OBRA A DESTAJO</b>", ParagraphStyle("STTotL", parent=st_l["cell_bold"], textColor=colors.HexColor("#1e3a8a"))),
        Paragraph("", st_l["cell_txt"]),
        Paragraph("", st_l["cell_txt"]),
        Paragraph("", st_l["cell_txt"]),
        Paragraph(f"<b>${total_mo_est:,.0f}</b>", ParagraphStyle("STTotR", parent=st_l["cell_right_bold"], textColor=colors.HexColor("#1e3a8a"))),
    ])

    t_sub = Table(t_rows, colWidths=[36, 254, 30, 55, 75, 90], repeatRows=1)
    t_sub.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([t_sub, Spacer(1, 6)])

    val_ret_est = total_mo_est * (pct_ret / 100.0)
    story.append(Paragraph("CLÁUSULA SEGUNDA – CALIDAD TÉCNICA Y CORRECCIÓN DE DEFECTOS", st_l["clause_hdr"]))
    story.append(Paragraph(
        "EL SUBCONTRATISTA ejecutará los trabajos cumpliendo estrictamente niveles, plomos, escuadras, pendientes, juntas uniformes y acabados finos. "
        "Todo trabajo defectuoso (baldosas sopladas o huecas, desniveles, fisuras en juntas de cielo raso, salpicaduras) deberá ser demolido y "
        "corregido por EL SUBCONTRATISTA a su exclusivo costo, asumiendo además el reemplazo de los materiales dañados por error de su ejecución.",
        st_l["legal_body"],
    ))

    story.append(Paragraph(f"CLÁUSULA TERCERA – FORMA DE PAGO Y RETENCIÓN EN GARANTÍA ({pct_ret:.0f}%)", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"Los pagos se realizarán mediante cortes semanales de obra efectivamente ejecutada, nivelada y aprobada por EL CONTRATANTE. "
        f"<b>No se entregarán anticipos sin avance ejecutado.</b> De cada corte semanal se retendrá un <b>{pct_ret:.0f}%</b> (aprox. ${val_ret_est:,.0f} COP sobre el total) "
        f"por concepto de <b>Retención en Garantía</b>, suma que será devuelta al concluir el 100% de las actividades contratadas, dejar el área limpia y "
        f"contar con la aprobación del propietario.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA CUARTA – SEGURIDAD SOCIAL (EPS/ARL) Y ELEMENTOS DE PROTECCIÓN (EPP)", st_l["clause_hdr"]))
    story.append(Paragraph(
        "Es condición obligatoria que EL SUBCONTRATISTA y sus ayudantes cuenten con afiliación vigente a <b>EPS y ARL (Riesgo IV/V para construcción y alturas)</b> "
        "y utilicen permanentemente sus Elementos de Protección Personal (botas, gafas para corte, guantes, mascarilla). El incumplimiento faculta a "
        "EL CONTRATANTE para suspender la labor inmediatamente sin pago adicional.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA QUINTA – CUIDADO DE MATERIALES Y HERRAMIENTA MENOR", st_l["clause_hdr"]))
    story.append(Paragraph(
        "EL SUBCONTRATISTA aportará su herramienta menor completa (cortadora, llanas, palas, niveles, atornilladores, extensiones) y velará por el "
        "cuidado racional de los insumos de obra, evitando desperdicios o extravíos injustificados.",
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLÁUSULA SEXTA – PLAZO DE ENTREGA Y AUTONOMÍA CIVIL", st_l["clause_hdr"]))
    story.append(Paragraph(
        f"El plazo acordado para entrega total es de <b>{int(cfg.get('plazo_dias', 10))} días calendario</b>, con inicio el <b>{_esc_xml(cfg.get('fecha_inicio', fecha_str))}</b> "
        f"y entrega máxima el <b>{_esc_xml(cfg.get('fecha_entrega', fecha_str))}</b>. Por tratarse de un subcontrato civil comercial a destajo, EL SUBCONTRATISTA "
        f"actúa con autonomía técnica y administrativa para organizar su cuadrilla, sin que exista subordinación ni relación laboral directa con EL CONTRATANTE.",
        st_l["legal_body"],
    ))

    firma_flowable = _obtener_firma_contratista_flowable(160, 48)
    sig_contra_html = f"<b>{_esc_xml(contratista_nom.upper())}</b><br/><b>{_esc_xml(cargo_contratista)}</b>"
    sig_sub_html = (
        f"<b>{_esc_xml(nom_oficial.upper())}</b><br/>"
        f"C.C. {_esc_xml(ced_oficial)}<br/>"
        f"<b>Oficial Subcontratista • {_esc_xml(esp_oficial)}</b>"
    )
    t_firmas = Table([
        [firma_flowable, Paragraph("<br/><font color='#94a3b8' size='6.5'>[ Espacio Firma y Huella ]</font>", ParagraphStyle("Huella", parent=st_l["cell_txt"], alignment=1))],
        [
            Paragraph("____________________________________________<br/><b>EL CONTRATANTE</b><br/>" + sig_contra_html, ParagraphStyle("SSL", parent=st_l["cell_txt"], alignment=1, leading=10)),
            Paragraph("____________________________________________<br/><b>EL SUBCONTRATISTA</b><br/>" + sig_sub_html, ParagraphStyle("SSR", parent=st_l["cell_txt"], alignment=1, leading=10)),
        ],
    ], colWidths=[270, 270])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "BOTTOM"),
        ("VALIGN", (0, 1), (-1, 1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
    ]))

    story.append(KeepTogether([
        Spacer(1, 8),
        Paragraph(f"En señal de acuerdo, se firma en {_esc_xml(ubicacion_actual)}, el día {_esc_xml(fecha_str)}.", st_l["legal_body"]),
        Spacer(1, 10),
        t_firmas,
    ]))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(
        *args,
        doc_title=f"Subcontrato Mano de Obra - {nom_oficial}",
        doc_badge="SUBCONTRATO A DESTAJO",
        footer_txt="JGM ConTech • Subcontrato Civil de Mano de Obra a Destajo con Validez Contractual",
        **kwargs,
    )
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer
