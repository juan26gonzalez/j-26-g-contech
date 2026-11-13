import io
import os
from datetime import datetime
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
    Image as RLImage,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas


class PresupuestoCanvas(canvas.Canvas):
    def __init__(
        self,
        *args,
        doc_title="Presupuesto Oficial de Obra",
        doc_badge="DOCUMENTO OFICIAL DE COSTOS",
        footer_txt="JGM ConTech • Presupuesto Contractual Oficial con Validez Jurídica",
        doc_lang="es",
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.doc_title = doc_title
        self.doc_badge = doc_badge
        self.footer_txt = footer_txt
        self.doc_lang = str(doc_lang or "es").lower()

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
        page_label = (
            f"Page {self._pageNumber} of {page_count}"
            if self.doc_lang == "en"
            else f"Página {self._pageNumber} de {page_count}"
        )
        self.drawRightString(576, 26, page_label)
        self.restoreState()


def _esc_xml(texto):
    """Escapa caracteres especiales XML para párrafos de ReportLab."""
    return str(texto or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _parse_doc_opts(doc_opts, proyecto_actual):
    opts = doc_opts or {}
    lang = "en" if str(opts.get("lang", "es")).lower() == "en" else "es"
    currency = str(opts.get("currency", "COP")).upper()
    if currency not in ("COP", "USD", "EUR"):
        currency = "COP"
    unit_system = str(opts.get("unit_system", "imperial" if lang == "en" else "metric")).lower()
    proy_id = str((proyecto_actual or {}).get("id", ""))
    is_demo = bool(opts.get("is_demo", False)) or (proy_id == "demo_showcase")
    try:
        fx_rate = float(opts.get("fx_rate", 1.0) or 1.0)
        if fx_rate <= 0:
            fx_rate = 1.0
    except Exception:
        fx_rate = 1.0
    return {
        "lang": lang,
        "is_en": lang == "en",
        "currency": currency,
        "unit_system": unit_system,
        "is_demo": is_demo,
        "fx_rate": fx_rate,
    }


def _fmt_money(amount, currency="COP", include_code=False):
    val = float(amount or 0.0)
    if currency == "USD":
        base = f"US${val:,.2f}"
        return f"{base} USD" if include_code else base
    if currency == "EUR":
        base = f"€{val:,.2f}"
        return f"{base} EUR" if include_code else base
    base = f"${val:,.0f}"
    return f"{base} COP" if include_code else base


def _resolver_ubicacion_obra(proyecto_actual):
    """Retorna la dirección/ubicación estandarizada de la obra activa."""
    ubicacion = str((proyecto_actual or {}).get("ubicacion", "")).strip()
    if not ubicacion or ubicacion in ["Sabanalarga, Atlántico", "Colombia"]:
        return "Calle 20D # 1 - 19. Sabanalarga, Atlántico"
    return ubicacion


def _resolver_actores_proyecto(proyecto_actual, ctx):
    proy = proyecto_actual or {}
    is_demo = ctx["is_demo"]
    is_en = ctx["is_en"]

    contratante_nom = str(proy.get("contratante") or ("Private Client" if is_en else "Cliente Privado")).strip()
    cedula_cliente = "" if is_demo else str(proy.get("cedula_cliente", "")).strip()

    if is_demo:
        contratista_nom = str(
            proy.get("contratista")
            or ("JGM ConTech Engineering Team" if is_en else "Equipo de Ingeniería JGM ConTech")
        ).strip()
        # Regla estricta de privacidad en Demo: nunca publicar C.C. ni M.P. personal
        cedula_contratista = ""
        cargo_contratista = str(
            proy.get("cargo_contratista")
            or ("Project Controls & BIM 5D Director" if is_en else "Dirección de Gerencia & Control BIM 5D")
        ).strip()
    else:
        contratista_nom = str(proy.get("contratista") or "Ing. Juan González Mendoza").strip()
        cedula_contratista = str(
            proy.get("cedula_contratista")
            if proy.get("cedula_contratista") is not None
            else "C.C. 1001867834 • M.P. 021037-0828864 ATL"
        ).strip()
        cargo_contratista = str(
            proy.get("cargo_contratista")
            or ("Lead Resident Engineer" if is_en else "Ingeniero Residente de Obra")
        ).strip()

    return {
        "contratante_nom": contratante_nom,
        "cedula_cliente": cedula_cliente,
        "contratista_nom": contratista_nom,
        "cedula_contratista": cedula_contratista,
        "cargo_contratista": cargo_contratista,
    }


def _obtener_firma_contratista_flowable(width=160, height=48, is_demo=False):
    """Retorna imagen de firma oficial o espaciador limpio si está en modo Demo."""
    if is_demo:
        return Spacer(1, height)
    firma_img_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "assets", "firma_juan_gonzalez.png"
    )
    if os.path.exists(firma_img_path):
        return RLImage(firma_img_path, width=width, height=height)
    return Spacer(1, height)


def _calcular_honorarios_consultoria(total_costo_directo, cfg_hon, ctx):
    """Calcula el desglose financiero de honorarios en la moneda seleccionada."""
    cfg = cfg_hon or {}
    is_en = ctx["is_en"]
    fx = ctx["fx_rate"] if not cfg.get("_fx_applied") else 1.0
    modo = cfg.get("modo_calculo", "fijo")
    pct_hon = float(cfg.get("porcentaje", 5.0) or 0.0)
    val_fijo = float(cfg.get("valor_fijo", 200000.0) or 0.0) / fx
    base_dir = float(total_costo_directo or 0.0)
    if modo == "porcentaje":
        val_hon = base_dir * (pct_hon / 100.0)
        base_desc = (
            f"{pct_hon:.2f}% of Direct Cost"
            if is_en
            else f"{pct_hon:.2f}% s/ Costo Directo"
        )
    else:
        val_hon = val_fijo
        pct_eq = (val_hon / base_dir * 100.0) if base_dir > 0 else 0.0
        base_desc = f"Fixed Fee (~{pct_eq:.1f}%)" if is_en else f"Tarifa Fija (~{pct_eq:.1f}%)"
    incluir_iva = bool(cfg.get("incluir_iva_hon", False))
    iva_hon = (val_hon * 0.19) if incluir_iva else 0.0
    val_vis = float(cfg.get("valor_visita", 70000.0) or 0.0) / fx
    return {
        "val_hon": val_hon,
        "iva_hon": iva_hon,
        "total_hon": val_hon + iva_hon,
        "base_desc": base_desc,
        "incluir_iva": incluir_iva,
        "val_vis": val_vis,
    }


def _construir_bloque_honorarios_pdf(
    cfg_hon,
    total_costo_directo,
    contratista_nom,
    estilos,
    ctx,
    solo_consultoria=False,
):
    """Construye la tabla y nota comercial de honorarios de consultoría en ES o EN."""
    is_en = ctx["is_en"]
    curr = ctx["currency"]
    hon_calc = _calcular_honorarios_consultoria(total_costo_directo, cfg_hon, ctx)
    c_bold = estilos["cell_bold"]
    c_txt = estilos["cell_txt"]
    c_right = estilos["cell_right"]
    c_rbold = estilos["cell_right_bold"]

    if is_en:
        hdr_col1 = "CONSULTING ITEM / REFERENCE" if solo_consultoria else "TECHNICAL CONSULTING CONCEPT (BOQ & APU)"
        hdr_col2 = "BASIS / STRUCTURE"
        hdr_col3 = f"AMOUNT ({curr})"
    else:
        hdr_col1 = "CONCEPTO DE CONSULTORÍA / REFERENCIA" if solo_consultoria else "CONCEPTO DE CONSULTORÍA TÉCNICA (APU)"
        hdr_col2 = "MODALIDAD / BASE"
        hdr_col3 = f"VALOR ({curr})"

    rows = [[
        Paragraph(f"<b>{hdr_col1}</b>", c_bold),
        Paragraph(f"<b>{hdr_col2}</b>", c_rbold),
        Paragraph(f"<b>{hdr_col3}</b>", c_rbold),
    ]]
    if solo_consultoria:
        rows.append([
            Paragraph(
                "Estimated Construction Direct Cost (Market Reference Only — Not Billed by Consultant)"
                if is_en
                else "Inversión Estimada en Obra (Costo Directo de Referencia en Mercado — No es cobro de obra)",
                c_txt,
            ),
            Paragraph("Reference" if is_en else "Referencia", c_right),
            Paragraph(_fmt_money(total_costo_directo, curr), c_right),
        ])

    rows.append([
        Paragraph(
            "<b>Professional Technical Consulting Fee</b> (5D BOQ, Quantity Takeoff & Unit Rate Analysis)"
            if is_en
            else "<b>Honorarios Profesionales por Consultoría Técnica</b> (Presupuesto, Cómputos Métricos y APU)",
            c_txt,
        ),
        Paragraph(_esc_xml(hon_calc["base_desc"]), c_right),
        Paragraph(_fmt_money(hon_calc["val_hon"], curr), c_right),
    ])
    if hon_calc["incluir_iva"]:
        rows.append([
            Paragraph(
                "(+) VAT Tax (19% on Consulting Honorarium)"
                if is_en
                else "(+) Impuesto IVA (19% sobre Honorarios de Consultoría)",
                c_txt,
            ),
            Paragraph("19.00%", c_right),
            Paragraph(_fmt_money(hon_calc["iva_hon"], curr), c_right),
        ])
    if cfg_hon.get("incluir_visita", False):
        rows.append([
            Paragraph(
                "Optional Service: On-Site Technical Inspection Visit (if third-party executes work)"
                if is_en
                else "Servicio Opcional: Supervisión Técnica / Visita de Inspección en Obra (si ejecuta tercero)",
                c_txt,
            ),
            Paragraph("Per Visit" if is_en else "Por Visita", c_right),
            Paragraph(
                f"{_fmt_money(hon_calc['val_vis'], curr)} / {'visit' if is_en else 'visita'}",
                c_right,
            ),
        ])

    tot_label = (
        ("TOTAL CONSULTING HONORARIUM PAYABLE" if solo_consultoria else "TOTAL CONSULTING HONORARIUM (If Third-Party Awarded)")
        if is_en
        else ("TOTAL HONORARIOS A PAGAR POR CONSULTORÍA TÉCNICA" if solo_consultoria else "TOTAL HONORARIOS DE CONSULTORÍA (Si la obra la ejecuta un tercero)")
    )
    rows.append([
        Paragraph(f"<b>{tot_label}</b>", ParagraphStyle("HTotL", parent=c_bold, textColor=colors.HexColor("#1e3a8a"))),
        Paragraph("", c_txt),
        Paragraph(
            f"<b>{_fmt_money(hon_calc['total_hon'], curr, include_code=True)}</b>",
            ParagraphStyle("HTotR", parent=c_rbold, textColor=colors.HexColor("#1e3a8a")),
        ),
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
        if is_en:
            notas_html.append(
                f"<b>Commercial Condition (100% Rebate Upon Contract Award):</b> If THE CLIENT awards full construction execution to "
                f"<b>{_esc_xml(contratista_nom)} (JGM ConTech)</b>, <b>100% of this consulting fee is credited / waived</b>. "
                f"Should the client self-perform or hire a third-party contractor, the stipulated consulting honorarium remains due for engineering IP, quantity takeoff, and APU schedules."
            )
        else:
            notas_html.append(
                f"<b>Condición Comercial (Bonificación 100% por Adjudicación):</b> Si EL CLIENTE contrata la ejecución integral de la obra con "
                f"<b>{_esc_xml(contratista_nom)} (JGM ConTech)</b>, el <b>100% de estos honorarios de consultoría serán bonificados (sin costo adicional)</b>. "
                f"En caso de ejecutar la obra con un tercero o por administración directa, deberá cancelar el valor de consultoría estipulado por concepto de cesión técnica del presupuesto, cómputos métricos y análisis APU."
            )
    notas_html.append(
        (
            "<b>Scope & Liability Limitation:</b> Technical consulting fees compensate exclusively cost engineering, BIM quantity takeoff, and APU structuring. "
            "JGM ConTech assumes no site supervision or liability for quality defects or cost overruns executed by third-party contractors."
        )
        if is_en
        else (
            "<b>Alcance y Limitación de Responsabilidad:</b> La modalidad de consultoría técnica remunera exclusivamente la ingeniería de costos, cuantificación de cantidades y estructuración de APU. "
            "JGM ConTech no asume dirección de obra ni responsabilidad técnica, de calidad o sobrecostos por trabajos ejecutados por contratistas terceros."
        )
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
        if "Total_Ppto" in df.columns:
            df["Presupuesto_Total"] = pd.to_numeric(df["Total_Ppto"], errors="coerce").fillna(0.0)
        else:
            df["Presupuesto_Total"] = df["Cantidad_Contratada"] * df["Precio_Unitario"]
    else:
        df["Presupuesto_Total"] = pd.to_numeric(df["Presupuesto_Total"], errors="coerce").fillna(0.0)
    return df


def generar_presupuesto_pdf(df_5d_in, params_liquidacion, proyecto_actual, cfg_honorarios=None, doc_opts=None):
    """Genera el PDF profesional del presupuesto de obra con soporte ES/EN, moneda, unidades y modo Demo privado."""
    ctx = _parse_doc_opts(doc_opts, proyecto_actual)
    is_en = ctx["is_en"]
    curr = ctx["currency"]
    unit_sys = ctx["unit_system"]
    is_demo = ctx["is_demo"]

    df_5d = _construir_dataframe_5d(df_5d_in)
    cfg_hon = cfg_honorarios if cfg_honorarios is not None else ((proyecto_actual or {}).get("honorarios_consultoria") or {})
    incluir_hon = bool(cfg_hon.get("incluir", False))
    solo_consultoria = incluir_hon and (cfg_hon.get("escenario", "anexo_aiu") == "solo_consultoria")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=40, bottomMargin=45)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("DocTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=13.0 if is_en else 13.5, leading=16.5, textColor=colors.HexColor("#0f172a"))
    subtitle_style = ParagraphStyle("DocSub", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#2563eb"))
    sec_heading = ParagraphStyle("SecHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#1e3a8a"))
    cell_text = ParagraphStyle("CellText", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9, textColor=colors.HexColor("#1e293b"))
    cell_text_bold = ParagraphStyle("CellTextBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=colors.HexColor("#0f172a"))
    cell_chap = ParagraphStyle("CellChap", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.8, leading=9.5, textColor=colors.HexColor("#1e3a8a"))
    cell_right = ParagraphStyle("CellRight", parent=styles["Normal"], fontName="Helvetica", fontSize=7.2, leading=9, alignment=2, textColor=colors.HexColor("#0f172a"))
    cell_right_bold = ParagraphStyle("CellRightBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, alignment=2, textColor=colors.HexColor("#0f172a"))

    story = []
    fecha_actual_str = datetime.now().strftime("%Y-%m-%d" if is_en else "%d/%m/%Y")
    proy_nombre = (proyecto_actual or {}).get("nombre", "Construction Project" if is_en else "Proyecto de Construcción")
    ubicacion_actual = _resolver_ubicacion_obra(proyecto_actual)
    es_ppto = (proyecto_actual or {}).get("tipo") == "presupuesto" or "PRESUPUESTO" in str((proyecto_actual or {}).get("badge", "")).upper()

    if is_en:
        modalidad_str = "APU CONSULTING" if solo_consultoria else ("ESTIMATE" if es_ppto else "BIM 5D")
        titulo_doc = "BASE COST ESTIMATE, APU & TECHNICAL CONSULTING" if solo_consultoria else "OFFICIAL CONSTRUCTION BUDGET & UNIT PRICE SCHEDULE (APU)"
        unit_badge = "Imperial (ft², yd³, ft, lb)" if unit_sys == "imperial" else "Metric SI (m², m³, ml, kg)"
    else:
        modalidad_str = "CONSULTORÍA APU" if solo_consultoria else ("PRESUPUESTO" if es_ppto else "BIM 5D")
        titulo_doc = "PRESUPUESTO BASE, APU Y CONSULTORÍA TÉCNICA" if solo_consultoria else "PRESUPUESTO GENERAL DE OBRA Y APU"
        unit_badge = "Imperial (ft², yd³, ft, lb)" if unit_sys == "imperial" else "Métrico SI (m², m³, ml, kg)"

    header_data = [
        [
            Paragraph("<b>JGM ConTech</b>", subtitle_style),
            Paragraph(
                f"<b>{'ISSUE DATE' if is_en else 'FECHA DE EMISIÓN'}:</b> {fecha_actual_str} • {curr}",
                ParagraphStyle("HeadR", parent=cell_right, fontSize=7),
            ),
        ],
        [
            Paragraph(titulo_doc, title_style),
            Paragraph(
                f"<b>{'CODE' if is_en else 'CÓDIGO'}:</b> BOQ-{_esc_xml(str((proyecto_actual or {}).get('id', 'PROY')).upper()[:12])}",
                ParagraphStyle("HeadR2", parent=cell_right, fontSize=8, textColor=colors.HexColor("#1e3a8a")),
            ),
        ],
        [
            Paragraph(f"<b>{'Project' if is_en else 'Proyecto'}:</b> {_esc_xml(proy_nombre)} • {_esc_xml(ubicacion_actual)}", cell_text),
            Paragraph(f"<b>{'Mode / Units' if is_en else 'Modalidad / Sist.'}:</b> {modalidad_str} • {unit_badge}", cell_right),
        ],
    ]
    header_table = Table(header_data, colWidths=[350, 190])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.extend([header_table, Spacer(1, 4), HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563eb"), spaceAfter=8, spaceBefore=4)])

    actores = _resolver_actores_proyecto(proyecto_actual, ctx)
    txt_cliente = f"<b>{_esc_xml(actores['contratante_nom'])}</b>"
    if actores["cedula_cliente"]:
        txt_cliente += f"<br/><font color='#64748b'>ID / NIT: {_esc_xml(actores['cedula_cliente'])}</font>"

    txt_contratista = f"<b>{_esc_xml(actores['contratista_nom'])}</b>"
    if actores["cedula_contratista"]:
        txt_contratista += f"<br/><font color='#64748b'>{_esc_xml(actores['cedula_contratista'])}</font>"
    if actores["cargo_contratista"]:
        txt_contratista += f"<br/><font color='#2563eb'><b>{_esc_xml(actores['cargo_contratista'])}</b></font>"

    rol_der = (
        ("TECHNICAL LEAD / CONSULTANT:" if solo_consultoria else "TECHNICAL LEAD / CONTRACTOR:")
        if is_en
        else ("DIRECCIÓN TÉCNICA / CONSULTOR:" if solo_consultoria else "DIRECCIÓN TÉCNICA / CONTRATISTA:")
    )
    meta_data = [
        [
            Paragraph(f"<b>{'CLIENT / PROJECT OWNER:' if is_en else 'ENTIDAD CONTRATANTE / CLIENTE:'}</b>", cell_text_bold),
            Paragraph(txt_cliente, cell_text),
            Paragraph(f"<b>{rol_der}</b>", cell_text_bold),
            Paragraph(txt_contratista, cell_text),
        ],
        [
            Paragraph(f"<b>{'PROJECT LOCATION:' if is_en else 'UBICACIÓN DE LA OBRA:'}</b>", cell_text_bold),
            Paragraph(_esc_xml(ubicacion_actual), cell_text),
            Paragraph(f"<b>{'BIM MODEL / STANDARD:' if is_en else 'MODELO / ESPECIFICACIÓN:'}</b>", cell_text_bold),
            Paragraph(
                f"{_esc_xml((proyecto_actual or {}).get('modelo_bim', 'Base BOQ'))} ({curr} • {unit_badge})",
                cell_text,
            ),
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
    story.extend([
        Paragraph(
            "1. EXECUTIVE SUMMARY BY WBS CHAPTER" if is_en else "1. RESUMEN EJECUTIVO POR CAPÍTULOS",
            sec_heading,
        ),
        Spacer(1, 4),
    ])
    total_costo_directo = float(df_5d["Presupuesto_Total"].sum()) if not df_5d.empty else 0.0
    resumen_caps = (
        df_5d.groupby("Capitulo", sort=False)["Presupuesto_Total"].sum().reset_index()
        if not df_5d.empty
        else pd.DataFrame(columns=["Capitulo", "Presupuesto_Total"])
    )
    resumen_caps["Pct"] = (resumen_caps["Presupuesto_Total"] / total_costo_directo * 100) if total_costo_directo > 0 else 0

    tabla_caps_data = [[
        Paragraph(f"<b>{'WBS Chapter / Trade' if is_en else 'Capítulo de Obra'}</b>", ParagraphStyle("ThC", parent=cell_text_bold, textColor=colors.white)),
        Paragraph(f"<b>{'Direct Cost Subtotal' if is_en else 'Subtotal Costo Directo'} ({curr})</b>", ParagraphStyle("ThR", parent=cell_right_bold, textColor=colors.white)),
        Paragraph(f"<b>{'Weight (%)' if is_en else 'Participación (%)'}</b>", ParagraphStyle("ThR2", parent=cell_right_bold, textColor=colors.white)),
    ]]
    for _, r in resumen_caps.iterrows():
        tabla_caps_data.append([
            Paragraph(_esc_xml(r["Capitulo"]), cell_text),
            Paragraph(_fmt_money(r["Presupuesto_Total"], curr), cell_right),
            Paragraph(f"{r['Pct']:.1f}%", cell_right),
        ])
    tabla_caps_data.append([
        Paragraph(f"<b>{'TOTAL DIRECT CONSTRUCTION COST' if is_en else 'TOTAL COSTO DIRECTO DE OBRA'}</b>", cell_text_bold),
        Paragraph(f"<b>{_fmt_money(total_costo_directo, curr)}</b>", cell_right_bold),
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
    story.extend([
        Paragraph(
            "2. DETAILED BILL OF QUANTITIES & UNIT PRICE SCHEDULE (BOQ / APU)"
            if is_en
            else "2. MATRIZ DETALLADA DE CANTIDADES Y PRECIOS UNITARIOS (APU)",
            sec_heading,
        ),
        Spacer(1, 4),
    ])
    matriz_headers = [
        Paragraph(f"<b>{'Item' if is_en else 'Ítem'}</b>", ParagraphStyle("MTh1", parent=cell_text_bold, textColor=colors.white, alignment=1)),
        Paragraph(f"<b>{'Work Activity Description (APU)' if is_en else 'Descripción de la Actividad Constructiva (APU)'}</b>", ParagraphStyle("MTh2", parent=cell_text_bold, textColor=colors.white)),
        Paragraph(f"<b>{'Unit' if is_en else 'Und'}</b>", ParagraphStyle("MTh3", parent=cell_text_bold, textColor=colors.white, alignment=1)),
        Paragraph(f"<b>{'Quantity' if is_en else 'Cantidad'}</b>", ParagraphStyle("MTh4", parent=cell_right_bold, textColor=colors.white)),
        Paragraph(f"<b>{'Unit Rate' if is_en else 'Precio Unit.'} ({curr})</b>", ParagraphStyle("MTh5", parent=cell_right_bold, textColor=colors.white)),
        Paragraph(f"<b>{'Subtotal'} ({curr})</b>", ParagraphStyle("MTh6", parent=cell_right_bold, textColor=colors.white)),
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
                Paragraph("<b>WBS</b>" if is_en else "<b>CAP.</b>", cell_chap),
                Paragraph(f"<b>{_esc_xml(str(cap_actual).upper())}</b>", cell_chap),
                Paragraph("", cell_text),
                Paragraph("", cell_text),
                Paragraph("<b>Subtotal:</b>", cell_right_bold),
                Paragraph(f"<b>{_fmt_money(subtotal_cap, curr)}</b>", cell_right_bold),
            ])
            table_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#f1f5f9")))
            table_styles.append(("LINEBELOW", (0, row_idx), (-1, row_idx), 1, colors.HexColor("#93c5fd")))
            row_idx += 1

        matriz_rows.append([
            Paragraph(_esc_xml(r["Item"]), ParagraphStyle("CItem", parent=cell_text, alignment=1)),
            Paragraph(_esc_xml(r["Actividad"]), cell_text),
            Paragraph(_esc_xml(r["Unidad"]), ParagraphStyle("CUnd", parent=cell_text, alignment=1)),
            Paragraph(f"{r['Cantidad_Contratada']:,.2f}", cell_right),
            Paragraph(_fmt_money(r["Precio_Unitario"], curr), cell_right),
            Paragraph(_fmt_money(r["Presupuesto_Total"], curr), cell_right),
        ])
        if row_idx % 2 == 1:
            table_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#fafafa")))
        row_idx += 1

    t_matriz = Table(matriz_rows, colWidths=[36, 234, 34, 60, 81, 95], repeatRows=1)
    t_matriz.setStyle(TableStyle(table_styles))
    story.extend([t_matriz, Spacer(1, 10)])

    firma_flowable = _obtener_firma_contratista_flowable(160, 48, is_demo=is_demo)
    sig_contratista_html = f"<b>{_esc_xml(actores['contratista_nom'].upper())}</b><br/><b>{_esc_xml(actores['cargo_contratista'])}</b>"
    sig_cliente_html = (
        f"<b>{_esc_xml(actores['contratante_nom'].upper())}</b><br/>"
        f"{('ID / NIT: ' + _esc_xml(actores['cedula_cliente']) + '<br/>') if actores['cedula_cliente'] else ''}"
        f"<b>{('Client / Consulting Requestor' if solo_consultoria else 'Project Owner / Supervision') if is_en else ('Cliente / Solicitante de Consultoría' if solo_consultoria else 'Entidad Contratante / Supervisión')}</b>"
    )
    lbl_sig_izq = (
        ("TECHNICAL LEAD / CONSULTANT" if solo_consultoria else "TECHNICAL LEAD / CONTRACTOR")
        if is_en
        else ("DIRECCIÓN TÉCNICA / INGENIERO CONSULTOR" if solo_consultoria else "DIRECCIÓN TÉCNICA / CONTRATISTA")
    )
    lbl_sig_der = (
        ("CLIENT / REQUESTOR" if solo_consultoria else "CLIENT / SUPERVISION")
        if is_en
        else ("SOLICITANTE / CLIENTE" if solo_consultoria else "SUPERVISIÓN / CLIENTE CONTRATANTE")
    )
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
            Paragraph(
                "3. ESTIMATED CONSTRUCTION INVESTMENT & CONSULTING HONORARIUM"
                if is_en
                else "3. INVERSIÓN ESTIMADA DE OBRA Y HONORARIOS DE CONSULTORÍA",
                sec_heading,
            ),
            Spacer(1, 4),
            *_construir_bloque_honorarios_pdf(cfg_hon, total_costo_directo, actores["contratista_nom"], estilos_hon, ctx, solo_consultoria=True),
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

        if is_en:
            liq_data = [
                [Paragraph("<b>CONTRACTUAL BREAKDOWN</b>", cell_text_bold), Paragraph("<b>PERCENT (%)</b>", cell_right_bold), Paragraph(f"<b>AMOUNT ({curr})</b>", cell_right_bold)],
                [Paragraph("Direct Construction Cost Subtotal (BOQ / APU)", cell_text), Paragraph("100.00%", cell_right), Paragraph(_fmt_money(total_costo_directo, curr), cell_right)],
                [Paragraph("(+) Administration Overhead", cell_text), Paragraph(f"{pct_a:.2f}%", cell_right), Paragraph(_fmt_money(val_a, curr), cell_right)],
                [Paragraph("(+) Contingencies Allowance", cell_text), Paragraph(f"{pct_i:.2f}%", cell_right), Paragraph(_fmt_money(val_i, curr), cell_right)],
                [Paragraph("(+) Contractor Profit Fee", cell_text), Paragraph(f"{pct_u:.2f}%", cell_right), Paragraph(_fmt_money(val_u, curr), cell_right)],
                [Paragraph("<b>GROSS CONTRACT ESTIMATE SUBTOTAL (Direct + AIU)</b>", cell_text_bold), Paragraph(f"<b>{100 + pct_a + pct_i + pct_u:.2f}%</b>", cell_right_bold), Paragraph(f"<b>{_fmt_money(val_bruto, curr)}</b>", cell_right_bold)],
                [Paragraph("(+) Value-Added Tax (19% on Contractor Fee)", cell_text), Paragraph(f"{pct_u * 0.19:.2f}%", cell_right), Paragraph(_fmt_money(iva_u, curr), cell_right)],
                [Paragraph("<b>TOTAL OFFICIAL PROJECT ESTIMATE</b>", ParagraphStyle("TotL", parent=cell_text_bold, textColor=colors.HexColor("#1e3a8a"))), Paragraph("", cell_text), Paragraph(f"<b>{_fmt_money(total_ppto_global, curr, include_code=True)}</b>", ParagraphStyle("TotR", parent=cell_right_bold, textColor=colors.HexColor("#1e3a8a")))],
            ]
        else:
            liq_data = [
                [Paragraph("<b>CONCEPTO CONTRACTUAL</b>", cell_text_bold), Paragraph("<b>PORCENTAJE (%)</b>", cell_right_bold), Paragraph(f"<b>VALOR ({curr})</b>", cell_right_bold)],
                [Paragraph("Subtotal Costo Directo de Actividades (APU)", cell_text), Paragraph("100.00%", cell_right), Paragraph(_fmt_money(total_costo_directo, curr), cell_right)],
                [Paragraph("(+) Administración", cell_text), Paragraph(f"{pct_a:.2f}%", cell_right), Paragraph(_fmt_money(val_a, curr), cell_right)],
                [Paragraph("(+) Imprevistos", cell_text), Paragraph(f"{pct_i:.2f}%", cell_right), Paragraph(_fmt_money(val_i, curr), cell_right)],
                [Paragraph("(+) Utilidad", cell_text), Paragraph(f"{pct_u:.2f}%", cell_right), Paragraph(_fmt_money(val_u, curr), cell_right)],
                [Paragraph("<b>SUBTOTAL PRESUPUESTO BRUTO (Directo + AIU)</b>", cell_text_bold), Paragraph(f"<b>{100 + pct_a + pct_i + pct_u:.2f}%</b>", cell_right_bold), Paragraph(f"<b>{_fmt_money(val_bruto, curr)}</b>", cell_right_bold)],
                [Paragraph("(+) Impuesto IVA (19% sobre Utilidad)", cell_text), Paragraph(f"{pct_u * 0.19:.2f}%", cell_right), Paragraph(_fmt_money(iva_u, curr), cell_right)],
                [Paragraph("<b>PRESUPUESTO TOTAL OFICIAL DE CONTRATACIÓN</b>", ParagraphStyle("TotL", parent=cell_text_bold, textColor=colors.HexColor("#1e3a8a"))), Paragraph("", cell_text), Paragraph(f"<b>{_fmt_money(total_ppto_global, curr, include_code=True)}</b>", ParagraphStyle("TotR", parent=cell_right_bold, textColor=colors.HexColor("#1e3a8a")))],
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
            story.append(KeepTogether([
                Paragraph(
                    "3. CONTRACTUAL LIQUIDATION & INDIRECTS (AIU — EXECUTION OPTION)"
                    if is_en
                    else "3. LIQUIDACIÓN CONTRACTUAL Y FACTOR AIU (OPCIÓN EJECUCIÓN DE OBRA)",
                    sec_heading,
                ),
                Spacer(1, 4),
                t_liq,
            ]))
            story.append(Spacer(1, 10))
            story.append(KeepTogether([
                Paragraph(
                    "4. TECHNICAL CONSULTING HONORARIUM (BOQ & APU)"
                    if is_en
                    else "4. HONORARIOS PROFESIONALES POR CONSULTORÍA TÉCNICA (PRESUPUESTO Y APU)",
                    sec_heading,
                ),
                Spacer(1, 4),
                *_construir_bloque_honorarios_pdf(cfg_hon, total_costo_directo, actores["contratista_nom"], estilos_hon, ctx, solo_consultoria=False),
                Spacer(1, 14),
                tabla_firmas,
            ]))
        else:
            story.append(KeepTogether([
                Paragraph(
                    "3. CONTRACTUAL LIQUIDATION & INDIRECTS (AIU)"
                    if is_en
                    else "3. LIQUIDACIÓN CONTRACTUAL Y FACTOR AIU",
                    sec_heading,
                ),
                Spacer(1, 4),
                t_liq,
                Spacer(1, 14),
                tabla_firmas,
            ]))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(
        *args,
        doc_title=(
            f"Consulting Estimate & APU - {proy_nombre}"
            if solo_consultoria
            else (f"Official Construction Budget - {proy_nombre}" if is_en else f"Presupuesto Oficial de Obra - {proy_nombre}")
        ),
        doc_badge=(
            ("APU CONSULTING STUDY" if solo_consultoria else "OFFICIAL COST ESTIMATE")
            if is_en
            else ("CONSULTORÍA TÉCNICA APU" if solo_consultoria else "DOCUMENTO OFICIAL DE COSTOS")
        ),
        footer_txt=(
            f"JGM ConTech • {'Technical Cost Estimate' if is_en else 'Presupuesto Contractual Oficial'} ({curr} • {unit_badge})"
        ),
        doc_lang=ctx["lang"],
        **kwargs,
    )
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer


def _construir_membrete_contrato_pdf(titulo_doc, codigo_doc, modalidad_doc, proy_nombre, ubicacion_actual, fecha_str, is_en=False):
    """Construye el membrete institucional JGM ConTech estándar para contratos PDF."""
    styles = getSampleStyleSheet()
    title_st = ParagraphStyle("CTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=13.5, leading=16.5, textColor=colors.HexColor("#0f172a"))
    sub_st = ParagraphStyle("CSub", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#2563eb"))
    meta_st = ParagraphStyle("CMeta", parent=styles["Normal"], fontName="Helvetica", fontSize=7.4, leading=9.5, textColor=colors.HexColor("#1e293b"))
    right_st = ParagraphStyle("CRight", parent=styles["Normal"], fontName="Helvetica", fontSize=7.4, leading=9.5, alignment=2, textColor=colors.HexColor("#0f172a"))

    header_data = [
        [Paragraph("<b>JGM ConTech</b>", sub_st), Paragraph(f"<b>{'ISSUE DATE' if is_en else 'FECHA DE EMISIÓN'}:</b> {_esc_xml(fecha_str)}", right_st)],
        [Paragraph(_esc_xml(titulo_doc), title_st), Paragraph(f"<b>{'DOCUMENT NO.' if is_en else 'NRO. DOCUMENTO'}:</b> {_esc_xml(codigo_doc)}", ParagraphStyle("CR2", parent=right_st, fontName="Helvetica-Bold", fontSize=8, textColor=colors.HexColor("#1e3a8a")))],
        [Paragraph(f"<b>{'Project' if is_en else 'Proyecto'}:</b> {_esc_xml(proy_nombre)} • {_esc_xml(ubicacion_actual)}", meta_st), Paragraph(f"<b>{'Agreement Type' if is_en else 'Modalidad'}:</b> {_esc_xml(modalidad_doc)}", right_st)],
    ]
    header_table = Table(header_data, colWidths=[350, 190])
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


def generar_contrato_cliente_pdf(df_5d_in, params_liquidacion, proyecto_actual, cfg, doc_opts=None):
    """Genera el Contrato de Obra con soporte ES/EN, moneda, unidades y protección de datos privados en Demo."""
    ctx = _parse_doc_opts(doc_opts, proyecto_actual)
    is_en = ctx["is_en"]
    curr = ctx["currency"]
    is_demo = ctx["is_demo"]
    unit_badge = "Imperial (ft², yd³, ft)" if ctx["unit_system"] == "imperial" else "Metric SI (m², m³, ml)"

    df_5d = _construir_dataframe_5d(df_5d_in)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=38, bottomMargin=45)
    st_l = _crear_estilos_legales_pdf()
    story = []

    proy_nombre = (proyecto_actual or {}).get("nombre", "Construction Project" if is_en else "Proyecto de Construcción")
    ubicacion_actual = _resolver_ubicacion_obra(proyecto_actual)
    actores = _resolver_actores_proyecto(proyecto_actual, ctx)
    fecha_str = cfg.get("fecha_firma", datetime.now().strftime("%Y-%m-%d" if is_en else "%d/%m/%Y"))

    story.extend(_construir_membrete_contrato_pdf(
        "CIVIL WORKS CONSTRUCTION AGREEMENT" if is_en else "CONTRATO CIVIL DE OBRA MATERIAL",
        f"AGR-{cfg.get('num_contrato', 'JGM-001')}" if is_en else f"CTO-{cfg.get('num_contrato', 'JGM-001')}",
        (f"FIXED UNIT RATES + AIU ({curr} • {unit_badge})") if is_en else f"PRECIOS UNITARIOS + AIU ({curr})",
        proy_nombre,
        ubicacion_actual,
        fecha_str,
        is_en=is_en,
    ))

    if is_en:
        id_cli_en = f", holding identification <b>{_esc_xml(actores['cedula_cliente'])}</b>" if actores["cedula_cliente"] else ""
        id_con_en = f", holding professional ID <b>{_esc_xml(actores['cedula_contratista'])}</b>" if actores["cedula_contratista"] else ""
        intro_html = (
            f"This Construction Services Agreement is entered into by and between: <b>{_esc_xml(actores['contratante_nom'].upper())}</b>{id_cli_en}, "
            f"hereinafter referred to as <b>THE OWNER / CLIENT</b>; and <b>{_esc_xml(actores['contratista_nom'].upper())}</b>{id_con_en}, "
            f"acting as <b>{_esc_xml(actores['cargo_contratista'])}</b>, hereinafter referred to as <b>THE CONTRACTOR</b>, "
            f"who hereby agree to enter into this <b>FIXED UNIT-PRICE CIVIL WORKS AGREEMENT WITH INDIRECTS (AIU)</b>, "
            f"governed by applicable commercial construction law and the following clauses:"
        )
    else:
        id_cli_es = f", identificado(a) con <b>{_esc_xml(actores['cedula_cliente'])}</b>" if actores["cedula_cliente"] else ""
        id_con_es = (
            f", mayor de edad, Ingeniero Civil identificado con <b>{_esc_xml(actores['cedula_contratista'])}</b>"
            if actores["cedula_contratista"]
            else ""
        )
        intro_html = (
            f"Entre los suscritos a saber: por una parte, <b>{_esc_xml(actores['contratante_nom'].upper())}</b>{id_cli_es}, "
            f"quien para todos los efectos del presente documento se denominará <b>EL CONTRATANTE</b>; y por la otra parte, "
            f"<b>{_esc_xml(actores['contratista_nom'].upper())}</b>{id_con_es}, "
            f"actuando en calidad de <b>{_esc_xml(actores['cargo_contratista'])}</b>, quien en adelante se denominará <b>EL CONTRATISTA</b>, "
            f"hemos acordado celebrar el presente <b>CONTRATO DE OBRA CIVIL A PRECIOS UNITARIOS FIJOS CON FACTOR AIU</b>, "
            f"regido por la legislación civil vigente y las siguientes cláusulas:"
        )
    story.append(Paragraph(intro_html, st_l["legal_body"]))

    story.append(Paragraph("CLAUSE I – SCOPE OF WORK & UNIT RATES SCHEDULE" if is_en else "CLÁUSULA PRIMERA – OBJETO Y ALCANCE DE LA OBRA", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            f"THE CONTRACTOR agrees to execute for THE OWNER, on an all-inclusive basis (first-grade materials, skilled labor, "
            f"technical supervision, tools, and equipment), the construction works for <b>{_esc_xml(proy_nombre)}</b> located at "
            f"<b>{_esc_xml(ubicacion_actual)}</b>, in accordance with the following schedule of unit prices ({curr} • {unit_badge}):"
        )
        if is_en
        else (
            f"EL CONTRATISTA se obliga para con EL CONTRATANTE a ejecutar a todo costo (suministro de materiales de primera calidad, "
            f"mano de obra calificada, dirección técnica, herramienta menor y equipo), las actividades constructivas correspondientes al proyecto "
            f"<b>{_esc_xml(proy_nombre)}</b> en el inmueble ubicado en <b>{_esc_xml(ubicacion_actual)}</b>, conforme al siguiente detalle técnico ({curr}):"
        ),
        st_l["legal_body"],
    ))

    t_rows = [[
        Paragraph(f"<b>{'Item' if is_en else 'Ítem'}</b>", ParagraphStyle("CTH1", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph(f"<b>{'Work Activity Description (APU)' if is_en else 'Descripción de Actividad Constructiva (APU)'}</b>", ParagraphStyle("CTH2", parent=st_l["cell_bold"], textColor=colors.white)),
        Paragraph(f"<b>{'Unit' if is_en else 'Und'}</b>", ParagraphStyle("CTH3", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph(f"<b>{'Qty' if is_en else 'Cant.'}</b>", ParagraphStyle("CTH4", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph(f"<b>{'Unit Price' if is_en else 'P. Unit.'} ({curr})</b>", ParagraphStyle("CTH5", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph(f"<b>{'Subtotal'} ({curr})</b>", ParagraphStyle("CTH6", parent=st_l["cell_right_bold"], textColor=colors.white)),
    ]]
    for _, r in df_5d.iterrows():
        t_rows.append([
            Paragraph(_esc_xml(r["Item"]), ParagraphStyle("CTI", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(_esc_xml(r["Actividad"]), st_l["cell_txt"]),
            Paragraph(_esc_xml(r["Unidad"]), ParagraphStyle("CTU", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(f"{r['Cantidad_Contratada']:,.2f}", st_l["cell_right"]),
            Paragraph(_fmt_money(r["Precio_Unitario"], curr), st_l["cell_right"]),
            Paragraph(_fmt_money(r["Presupuesto_Total"], curr), st_l["cell_right"]),
        ])
    t_items = Table(t_rows, colWidths=[34, 240, 34, 54, 83, 95], repeatRows=1)
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

    story.append(Paragraph("CLAUSE II – CONTRACT VALUE & AIU BREAKDOWN" if is_en else "CLÁUSULA SEGUNDA – VALOR DEL CONTRATO Y LIQUIDACIÓN AIU", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            f"The estimated total contract sum is <b>{_fmt_money(total_contrato, curr, include_code=True)}</b>, "
            f"comprising Direct Works Cost plus Indirects & Fee (AIU: Administration, Contingencies, and Profit). "
            f"Final billings shall correspond strictly to quantities physically measured and certified on site:"
        )
        if is_en
        else (
            f"El valor total estimado del presente contrato asciende a la suma de <b>{_fmt_money(total_contrato, curr, include_code=True)}</b>, "
            f"desglosado en Costo Directo de actividades más el factor AIU (Administración, Imprevistos y Utilidad). "
            f"Las cantidades finales a cobrar serán las efectivamente medidas y recibidas en obra:"
        ),
        st_l["legal_body"],
    ))

    if is_en:
        liq_rows = [
            [Paragraph("<b>CONTRACTUAL CONCEPT</b>", st_l["cell_bold"]), Paragraph("<b>PERCENT (%)</b>", st_l["cell_right_bold"]), Paragraph(f"<b>AMOUNT ({curr})</b>", st_l["cell_right_bold"])],
            [Paragraph("Direct Works Cost (Materials + Labor + Equipment)", st_l["cell_txt"]), Paragraph("100.00%", st_l["cell_right"]), Paragraph(_fmt_money(total_directo, curr), st_l["cell_right"])],
            [Paragraph("(+) Administration Overhead (Site Management & Controls)", st_l["cell_txt"]), Paragraph(f"{pct_a:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(val_a, curr), st_l["cell_right"])],
            [Paragraph("(+) Contingencies", st_l["cell_txt"]), Paragraph(f"{pct_i:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(val_i, curr), st_l["cell_right"])],
            [Paragraph("(+) Contractor Profit Fee", st_l["cell_txt"]), Paragraph(f"{pct_u:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(val_u, curr), st_l["cell_right"])],
        ]
        if cfg.get("incluir_iva_u", False):
            liq_rows.append([Paragraph("(+) VAT Tax (19% on Profit Fee)", st_l["cell_txt"]), Paragraph(f"{pct_u * 0.19:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(iva_u, curr), st_l["cell_right"])])
        liq_rows.append([
            Paragraph("<b>TOTAL CONTRACT VALUE</b>", ParagraphStyle("CTotL", parent=st_l["cell_bold"], textColor=colors.HexColor("#1e3a8a"))),
            Paragraph("", st_l["cell_txt"]),
            Paragraph(f"<b>{_fmt_money(total_contrato, curr, include_code=True)}</b>", ParagraphStyle("CTotR", parent=st_l["cell_right_bold"], textColor=colors.HexColor("#1e3a8a"))),
        ])
    else:
        liq_rows = [
            [Paragraph("<b>CONCEPTO CONTRACTUAL</b>", st_l["cell_bold"]), Paragraph("<b>PORCENTAJE</b>", st_l["cell_right_bold"]), Paragraph(f"<b>VALOR ({curr})</b>", st_l["cell_right_bold"])],
            [Paragraph("Costo Directo de Obra (Materiales + Mano de Obra + Equipos)", st_l["cell_txt"]), Paragraph("100.00%", st_l["cell_right"]), Paragraph(_fmt_money(total_directo, curr), st_l["cell_right"])],
            [Paragraph("(+) Administración (Dirección Técnica, Gestión y Operación)", st_l["cell_txt"]), Paragraph(f"{pct_a:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(val_a, curr), st_l["cell_right"])],
            [Paragraph("(+) Imprevistos", st_l["cell_txt"]), Paragraph(f"{pct_i:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(val_i, curr), st_l["cell_right"])],
            [Paragraph("(+) Utilidad del Contratista", st_l["cell_txt"]), Paragraph(f"{pct_u:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(val_u, curr), st_l["cell_right"])],
        ]
        if cfg.get("incluir_iva_u", False):
            liq_rows.append([Paragraph("(+) Impuesto IVA (19% sobre Utilidad)", st_l["cell_txt"]), Paragraph(f"{pct_u * 0.19:.2f}%", st_l["cell_right"]), Paragraph(_fmt_money(iva_u, curr), st_l["cell_right"])])
        liq_rows.append([
            Paragraph("<b>VALOR TOTAL DEL CONTRATO</b>", ParagraphStyle("CTotL", parent=st_l["cell_bold"], textColor=colors.HexColor("#1e3a8a"))),
            Paragraph("", st_l["cell_txt"]),
            Paragraph(f"<b>{_fmt_money(total_contrato, curr, include_code=True)}</b>", ParagraphStyle("CTotR", parent=st_l["cell_right_bold"], textColor=colors.HexColor("#1e3a8a"))),
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

    story.append(Paragraph("CLAUSE III – PAYMENT SCHEDULE" if is_en else "CLÁUSULA TERCERA – FORMA DE PAGO", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            f"THE OWNER shall disburse the contract value to THE CONTRACTOR as follows: "
            f"<b>1) Mobilization Advance ({p_ant:.0f}%):</b> <b>{_fmt_money(v_ant, curr, include_code=True)}</b> upon execution for initial material procurement; "
            f"<b>2) Progress Billings ({p_cor:.0f}%):</b> <b>{_fmt_money(v_cor, curr, include_code=True)}</b> against certified progress certificates; and "
            f"<b>3) Final Retention Release ({p_sal:.0f}%):</b> <b>{_fmt_money(v_sal, curr, include_code=True)}</b> upon 100% substantial completion and signed Final Acceptance Certificate."
        )
        if is_en
        else (
            f"EL CONTRATANTE pagará a EL CONTRATISTA el valor del contrato de la siguiente manera: "
            f"<b>1) Anticipo ({p_ant:.0f}%):</b> La suma de <b>{_fmt_money(v_ant, curr, include_code=True)}</b> a la firma del presente documento para compra inicial de materiales e inicio de obra; "
            f"<b>2) Avance / Corte de Obra ({p_cor:.0f}%):</b> La suma de <b>{_fmt_money(v_cor, curr, include_code=True)}</b> contra avance físico verificado en obra; y "
            f"<b>3) Saldo Final ({p_sal:.0f}%):</b> La suma de <b>{_fmt_money(v_sal, curr, include_code=True)}</b> al concluir el 100% de las actividades, entrega del área limpia y firma del Acta de Recibo a Satisfacción."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE IV – PERFORMANCE SCHEDULE" if is_en else "CLÁUSULA CUARTA – PLAZO DE EJECUCIÓN", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            f"Estimated project duration is <b>{int(cfg.get('plazo_dias', 15))} business days</b> commencing upon advance payment clearing "
            f"and unobstructed site handover by THE OWNER."
        )
        if is_en
        else (
            f"El plazo estimado para la ejecución total de la obra será de <b>{int(cfg.get('plazo_dias', 15))} días hábiles</b> contados a partir "
            f"del desembolso efectivo del anticipo y la entrega del área de trabajo completamente despejada por parte de EL CONTRATANTE."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE V – COVENANTS & OBLIGATIONS" if is_en else "CLÁUSULA QUINTA – OBLIGACIONES DE LAS PARTES", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            "<b>THE CONTRACTOR:</b> Execute all works with compliant materials under qualified engineering supervision, maintaining safety protocols "
            "and statutory worker insurance coverage. <b>THE OWNER:</b> Grant unrestricted site access during working hours, provide construction utilities "
            "(water and power), and process certified progress billings on schedule."
        )
        if is_en
        else (
            "<b>De EL CONTRATISTA:</b> Ejecutar los trabajos con materiales de óptima calidad, bajo supervisión directa del Ingeniero Civil residente, "
            "manteniendo el orden constructivo y asumiendo el cumplimiento de seguridad social (EPS/ARL) de su equipo de trabajo. "
            "<b>De EL CONTRATANTE:</b> Permitir el libre acceso al inmueble en horarios laborales, garantizar puntos básicos de agua y energía eléctrica para obra, "
            "y efectuar oportunamente los desembolsos en las fechas de corte acordadas."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE VI – CHANGE ORDERS & QUANTITY OVERRUNS" if is_en else "CLÁUSULA SEXTA – MAYORES CANTIDADES Y OBRAS ADICIONALES", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            "Any additional work, scope variation, or design modification requested by THE OWNER outside Clause I "
            "shall be settled via formal Change Order at the agreed unit rates or pre-approved supplemental APU prices."
        )
        if is_en
        else (
            "Cualquier trabajo no contemplado en la Cláusula Primera, modificación arquitectónica o ampliación de áreas solicitada por EL CONTRATANTE "
            "será liquidada mediante Acta de Mayor Cantidad o Adicional utilizando los precios unitarios base o nuevos APU previamente aprobados por escrito."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE VII – WORKMANSHIP WARRANTY" if is_en else "CLÁUSULA SÉPTIMA – GARANTÍA DE CALIDAD Y ESTABILIDAD", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            f"THE CONTRACTOR warrants technical stability and proper workmanship for a period of <b>{int(cfg.get('garantia_meses', 12))} months</b> "
            f"from the date of the Final Acceptance Certificate, covering construction defects attributable to installation (excluding misuse or force majeure)."
        )
        if is_en
        else (
            f"EL CONTRATISTA garantiza la estabilidad técnica y correcta ejecución de la mano de obra realizada por un término de "
            f"<b>{int(cfg.get('garantia_meses', 12))} meses</b> contados desde la fecha del Acta de Recibo Final, respondiendo por defectos constructivos "
            f"imputables a su instalación (no cubre daños por mal uso o eventos de fuerza mayor)."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE VIII – INDEPENDENT CONTRACTOR STATUS" if is_en else "CLÁUSULA OCTAVA – AUTONOMÍA E INDEMNIDAD", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            "THE CONTRACTOR executes the works with full technical, financial, and managerial autonomy as an independent contractor, "
            "with no employment relationship with THE OWNER."
        )
        if is_en
        else (
            "EL CONTRATISTA ejecutará la obra con plena autonomía técnica, financiera y directiva, sin existir subordinación laboral respecto de EL CONTRATANTE."
        ),
        st_l["legal_body"],
    ))

    notas = str(cfg.get("notas_adicionales", "")).strip()
    if notas:
        story.append(Paragraph("CLAUSE IX – SPECIAL PROVISIONS" if is_en else "CLÁUSULA NOVENA – OBSERVACIONES ESPECIALES", st_l["clause_hdr"]))
        story.append(Paragraph(_esc_xml(notas), st_l["legal_body"]))

    firma_flowable = _obtener_firma_contratista_flowable(160, 48, is_demo=is_demo)
    sig_contra_html = f"<b>{_esc_xml(actores['contratista_nom'].upper())}</b><br/><b>{_esc_xml(actores['cargo_contratista'])}</b>"
    sig_cli_html = (
        f"<b>{_esc_xml(actores['contratante_nom'].upper())}</b><br/>"
        f"{('ID / NIT: ' + _esc_xml(actores['cedula_cliente']) + '<br/>') if actores['cedula_cliente'] else ''}"
        f"<b>{'Project Owner / Contracting Party' if is_en else 'Propietario / Entidad Contratante'}</b>"
    )
    t_firmas = Table([
        [firma_flowable, Spacer(1, 48)],
        [
            Paragraph(f"____________________________________________<br/><b>{'THE CONTRACTOR' if is_en else 'EL CONTRATISTA'}</b><br/>" + sig_contra_html, ParagraphStyle("CSL", parent=st_l["cell_txt"], alignment=1, leading=10)),
            Paragraph(f"____________________________________________<br/><b>{'THE OWNER' if is_en else 'EL CONTRATANTE'}</b><br/>" + sig_cli_html, ParagraphStyle("CSR", parent=st_l["cell_txt"], alignment=1, leading=10)),
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
        Paragraph(
            (f"IN WITNESS WHEREOF, executed at {_esc_xml(ubicacion_actual)}, on {_esc_xml(fecha_str)}." if is_en else f"Para constancia y validez se firma en {_esc_xml(ubicacion_actual)}, a los {_esc_xml(fecha_str)}."),
            st_l["legal_body"],
        ),
        Spacer(1, 10),
        t_firmas,
    ]))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(
        *args,
        doc_title=f"Agreement {proy_nombre}" if is_en else f"Contrato Obra {proy_nombre}",
        doc_badge="CONSTRUCTION AGREEMENT" if is_en else "CONTRATO CIVIL DE OBRA",
        footer_txt=f"JGM ConTech • {'Official Civil Works Contract' if is_en else 'Contrato Civil de Obra Oficial'} ({curr} • {unit_badge})",
        doc_lang=ctx["lang"],
        **kwargs,
    )
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer


def generar_subcontrato_oficial_pdf(df_items_sub_in, proyecto_actual, cfg, doc_opts=None):
    """Genera el PDF del Subcontrato de Mano de Obra a Destajo en ES/EN, moneda, unidades y sin firma privada en Demo."""
    ctx = _parse_doc_opts(doc_opts, proyecto_actual)
    is_en = ctx["is_en"]
    curr = ctx["currency"]
    is_demo = ctx["is_demo"]
    unit_badge = "Imperial (ft², yd³, ft)" if ctx["unit_system"] == "imperial" else "Metric SI (m², m³, ml)"

    df_items_sub = pd.DataFrame(df_items_sub_in or [])
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=38, bottomMargin=45)
    st_l = _crear_estilos_legales_pdf()
    story = []

    proy_nombre = (proyecto_actual or {}).get("nombre", "Construction Project" if is_en else "Proyecto de Construcción")
    ubicacion_actual = _resolver_ubicacion_obra(proyecto_actual)
    actores = _resolver_actores_proyecto(proyecto_actual, ctx)
    fecha_str = cfg.get("fecha_inicio", datetime.now().strftime("%Y-%m-%d" if is_en else "%d/%m/%Y"))

    nom_oficial = str(cfg.get("nombre_oficial", "Lead Installer" if is_en else "Oficial Instalador")).strip() or ("Lead Installer" if is_en else "Oficial Instalador")
    ced_oficial = str(cfg.get("cedula_oficial", "")).strip() or "____________________"
    tel_oficial = str(cfg.get("telefono_oficial", "")).strip() or "N/A"
    esp_oficial = str(cfg.get("especialidad", "Masonry & Finishes" if is_en else "Albañilería y Acabados")).strip()
    pct_ret = float(cfg.get("pct_retencion", 10.0))

    story.extend(_construir_membrete_contrato_pdf(
        "PIECEWORK LABOR SUBCONTRACT AGREEMENT" if is_en else "SUBCONTRATO DE MANO DE OBRA A DESTAJO",
        f"{cfg.get('num_subcontrato', 'SUB-001')}",
        f"PIECEWORK UNIT RATES ({curr} • {unit_badge})" if is_en else f"PRECIOS UNITARIOS A DESTAJO ({curr})",
        proy_nombre,
        ubicacion_actual,
        fecha_str,
        is_en=is_en,
    ))

    if is_en:
        id_con_en = f", holding professional ID <b>{_esc_xml(actores['cedula_contratista'])}</b>" if actores["cedula_contratista"] else ""
        intro_html = (
            f"Entered into by and between: <b>{_esc_xml(actores['contratista_nom'].upper())}</b>{id_con_en}, "
            f"acting as Prime Contractor / Project Director, hereinafter <b>THE CONTRACTOR</b>; and <b>{_esc_xml(nom_oficial.upper())}</b>, "
            f"holding ID No. <b>{_esc_xml(ced_oficial)}</b>, Phone <b>{_esc_xml(tel_oficial)}</b>, trade specialty <b>{_esc_xml(esp_oficial)}</b>, "
            f"acting autonomously with own hand tools, hereinafter <b>THE SUBCONTRACTOR</b>, establishing this <b>PIECEWORK LABOR SUBCONTRACT</b>:"
        )
    else:
        id_con_es = f", mayor de edad, Ingeniero Civil identificado con <b>{_esc_xml(actores['cedula_contratista'])}</b>" if actores["cedula_contratista"] else ""
        intro_html = (
            f"Entre los suscritos a saber: <b>{_esc_xml(actores['contratista_nom'].upper())}</b>{id_con_es}, "
            f"actuando como Contratista Principal / Director Técnico, quien en adelante se denominará <b>EL CONTRATANTE</b>; "
            f"y por la otra parte, <b>{_esc_xml(nom_oficial.upper())}</b>, mayor de edad, identificado con Cédula de Ciudadanía No. <b>{_esc_xml(ced_oficial)}</b>, "
            f"teléfono <b>{_esc_xml(tel_oficial)}</b>, especialista en <b>{_esc_xml(esp_oficial)}</b>, quien actúa de forma autónoma con su propia herramienta, "
            f"en adelante <b>EL SUBCONTRATISTA</b>, hemos acordado celebrar el presente <b>SUBCONTRATO CIVIL DE MANO DE OBRA A DESTAJO</b>:"
        )
    story.append(Paragraph(intro_html, st_l["legal_body"]))

    story.append(Paragraph(
        "CLAUSE I – SCOPE & PIECEWORK LABOR UNIT RATES" if is_en else "CLÁUSULA PRIMERA – OBJETO Y TARIFAS UNITARIAS DE MANO DE OBRA (DESTAJO)",
        st_l["clause_hdr"],
    ))
    story.append(Paragraph(
        (
            f"THE SUBCONTRACTOR undertakes to perform, on a labor-only piecework basis with top workmanship standards, the scheduled activities at "
            f"<b>{_esc_xml(ubicacion_actual)}</b>. Final payouts shall be based strictly on physically measured, accepted quantities:"
        )
        if is_en
        else (
            f"EL SUBCONTRATISTA se obliga a ejecutar con excelencia técnica, exclusivamente a todo costo de mano de obra (a destajo), las actividades "
            f"seleccionadas dentro de la obra ubicada en <b>{_esc_xml(ubicacion_actual)}</b>. Las cantidades definitivas a pagar serán las realmente instaladas y medidas en obra:"
        ),
        st_l["legal_body"],
    ))

    t_rows = [[
        Paragraph(f"<b>{'Item' if is_en else 'Ítem'}</b>", ParagraphStyle("STH1", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph(f"<b>{'Contracted Scope (Labor Only)' if is_en else 'Descripción de la Actividad Contratada (Solo Mano de Obra)'}</b>", ParagraphStyle("STH2", parent=st_l["cell_bold"], textColor=colors.white)),
        Paragraph(f"<b>{'Unit' if is_en else 'Und'}</b>", ParagraphStyle("STH3", parent=st_l["cell_bold"], textColor=colors.white, alignment=1)),
        Paragraph(f"<b>{'Est. Qty' if is_en else 'Cant. Est.'}</b>", ParagraphStyle("STH4", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph(f"<b>{'Labor Rate' if is_en else 'Tarifa M.O.'} ({curr})</b>", ParagraphStyle("STH5", parent=st_l["cell_right_bold"], textColor=colors.white)),
        Paragraph(f"<b>{'Est. Subtotal'} ({curr})</b>", ParagraphStyle("STH6", parent=st_l["cell_right_bold"], textColor=colors.white)),
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
            Paragraph(_esc_xml(r.get("Unidad", "ea" if is_en else "und")), ParagraphStyle("STU", parent=st_l["cell_txt"], alignment=1)),
            Paragraph(f"{cant:,.2f}", st_l["cell_right"]),
            Paragraph(_fmt_money(tarifa, curr), st_l["cell_right"]),
            Paragraph(_fmt_money(sub_mo, curr), st_l["cell_right"]),
        ])
    t_rows.append([
        Paragraph("", st_l["cell_txt"]),
        Paragraph(
            f"<b>{'TOTAL ESTIMATED PIECEWORK LABOR AMOUNT' if is_en else 'TOTAL ESTIMADO DE MANO DE OBRA A DESTAJO'}</b>",
            ParagraphStyle("STTotL", parent=st_l["cell_bold"], textColor=colors.HexColor("#1e3a8a")),
        ),
        Paragraph("", st_l["cell_txt"]),
        Paragraph("", st_l["cell_txt"]),
        Paragraph("", st_l["cell_txt"]),
        Paragraph(
            f"<b>{_fmt_money(total_mo_est, curr, include_code=True)}</b>",
            ParagraphStyle("STTotR", parent=st_l["cell_right_bold"], textColor=colors.HexColor("#1e3a8a")),
        ),
    ])

    t_sub = Table(t_rows, colWidths=[34, 240, 34, 54, 83, 95], repeatRows=1)
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
    story.append(Paragraph("CLAUSE II – QUALITY STANDARDS & REWORK" if is_en else "CLÁUSULA SEGUNDA – CALIDAD TÉCNICA Y CORRECCIÓN DE DEFECTOS", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            "THE SUBCONTRACTOR shall maintain exact lines, levels, plumb, squareness, and finish tolerances. Any defective workmanship "
            "(hollow tiles, uneven planes, cracked joints) shall be demolished and rectified by THE SUBCONTRACTOR at zero additional cost, "
            "including replacement of spoiled materials."
        )
        if is_en
        else (
            "EL SUBCONTRATISTA ejecutará los trabajos cumpliendo estrictamente niveles, plomos, escuadras, pendientes, juntas uniformes y acabados finos. "
            "Todo trabajo defectuoso (baldosas sopladas o huecas, desniveles, fisuras en juntas, salpicaduras) deberá ser demolido y corregido por EL SUBCONTRATISTA a su exclusivo costo."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph(
        f"CLAUSE III – PAYMENT TERMS & WARRANTY RETAINAGE ({pct_ret:.0f}%)" if is_en else f"CLÁUSULA TERCERA – FORMA DE PAGO Y RETENCIÓN EN GARANTÍA ({pct_ret:.0f}%)",
        st_l["clause_hdr"],
    ))
    story.append(Paragraph(
        (
            f"Payments shall follow weekly certified progress measurements. <b>No unverified cash advances apply.</b> A <b>{pct_ret:.0f}%</b> Warranty Retainage "
            f"(approx. {_fmt_money(val_ret_est, curr, include_code=True)}) shall be withheld from each weekly settlement and released upon 100% completion and punch-list clearance."
        )
        if is_en
        else (
            f"Los pagos se realizarán mediante cortes semanales de obra efectivamente ejecutada y aprobada por EL CONTRATANTE. "
            f"<b>No se entregarán anticipos sin avance ejecutado.</b> De cada corte semanal se retendrá un <b>{pct_ret:.0f}%</b> (aprox. {_fmt_money(val_ret_est, curr, include_code=True)} sobre el total) "
            f"por concepto de <b>Retención en Garantía</b>, devuelta al concluir el 100% de las actividades contratadas."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE IV – WORKER SAFETY & PPE COMPLIANCE" if is_en else "CLÁUSULA CUARTA – SEGURIDAD SOCIAL (EPS/ARL) Y ELEMENTOS DE PROTECCIÓN (EPP)", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            "THE SUBCONTRACTOR and crew must maintain active workers' compensation / occupational risk coverage and wear mandatory PPE (safety boots, eye protection, gloves, dust masks) at all times."
        )
        if is_en
        else (
            "Es condición obligatoria que EL SUBCONTRATISTA y sus ayudantes cuenten con afiliación vigente a <b>EPS y ARL (Riesgo IV/V para construcción y alturas)</b> "
            "y utilicen permanentemente sus Elementos de Protección Personal (botas, gafas para corte, guantes, mascarilla)."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE V – TOOLS & MATERIAL STEWARDSHIP" if is_en else "CLÁUSULA QUINTA – CUIDADO DE MATERIALES Y HERRAMIENTA MENOR", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            "THE SUBCONTRACTOR supplies all personal hand tools (tile cutters, trowels, laser/spirit levels, drills) and commits to minimizing site material waste."
        )
        if is_en
        else (
            "EL SUBCONTRATISTA aportará su herramienta menor completa (cortadora, llanas, palas, niveles, atornilladores) y velará por el cuidado racional de los insumos de obra."
        ),
        st_l["legal_body"],
    ))

    story.append(Paragraph("CLAUSE VI – TIMELINE & INDEPENDENT STATUS" if is_en else "CLÁUSULA SEXTA – PLAZO DE ENTREGA Y AUTONOMÍA CIVIL", st_l["clause_hdr"]))
    story.append(Paragraph(
        (
            f"Completion window is <b>{int(cfg.get('plazo_dias', 10))} calendar days</b>, starting <b>{_esc_xml(cfg.get('fecha_inicio', fecha_str))}</b> "
            f"through <b>{_esc_xml(cfg.get('fecha_entrega', fecha_str))}</b>, as an independent piecework civil subcontract."
        )
        if is_en
        else (
            f"El plazo acordado para entrega total es de <b>{int(cfg.get('plazo_dias', 10))} días calendario</b>, con inicio el <b>{_esc_xml(cfg.get('fecha_inicio', fecha_str))}</b> "
            f"y entrega máxima el <b>{_esc_xml(cfg.get('fecha_entrega', fecha_str))}</b>, bajo modalidad civil comercial autónoma a destajo."
        ),
        st_l["legal_body"],
    ))

    firma_flowable = _obtener_firma_contratista_flowable(160, 48, is_demo=is_demo)
    sig_contra_html = f"<b>{_esc_xml(actores['contratista_nom'].upper())}</b><br/><b>{_esc_xml(actores['cargo_contratista'])}</b>"
    sig_sub_html = (
        f"<b>{_esc_xml(nom_oficial.upper())}</b><br/>"
        f"{'ID' if is_en else 'C.C.'} {_esc_xml(ced_oficial)}<br/>"
        f"<b>{'Subcontractor' if is_en else 'Oficial Subcontratista'} • {_esc_xml(esp_oficial)}</b>"
    )
    t_firmas = Table([
        [
            firma_flowable,
            Paragraph(
                f"<br/><font color='#94a3b8' size='6.5'>[ {'Signature & Stamp' if is_en else 'Espacio Firma y Huella'} ]</font>",
                ParagraphStyle("Huella", parent=st_l["cell_txt"], alignment=1),
            ),
        ],
        [
            Paragraph(f"____________________________________________<br/><b>{'THE CONTRACTOR' if is_en else 'EL CONTRATANTE'}</b><br/>" + sig_contra_html, ParagraphStyle("SSL", parent=st_l["cell_txt"], alignment=1, leading=10)),
            Paragraph(f"____________________________________________<br/><b>{'THE SUBCONTRACTOR' if is_en else 'EL SUBCONTRATISTA'}</b><br/>" + sig_sub_html, ParagraphStyle("SSR", parent=st_l["cell_txt"], alignment=1, leading=10)),
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
        Paragraph(
            (f"Agreed and signed at {_esc_xml(ubicacion_actual)}, on {_esc_xml(fecha_str)}." if is_en else f"En señal de acuerdo, se firma en {_esc_xml(ubicacion_actual)}, el día {_esc_xml(fecha_str)}."),
            st_l["legal_body"],
        ),
        Spacer(1, 10),
        t_firmas,
    ]))

    canvas_maker = lambda *args, **kwargs: PresupuestoCanvas(
        *args,
        doc_title=f"Piecework Subcontract - {nom_oficial}" if is_en else f"Subcontrato Mano de Obra - {nom_oficial}",
        doc_badge="PIECEWORK SUBCONTRACT" if is_en else "SUBCONTRATO A DESTAJO",
        footer_txt=f"JGM ConTech • {'Piecework Labor Subcontract' if is_en else 'Subcontrato Civil a Destajo'} ({curr} • {unit_badge})",
        doc_lang=ctx["lang"],
        **kwargs,
    )
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer
