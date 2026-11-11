const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

function buildSteelIconSvg({ fullBleed = true, subtitle = "GERENCIA BIM 5D", hideSubtitle = false } = {}) {
  const rxOuter = fullBleed ? 0 : 108;
  const rxFrameWhite = fullBleed ? 76 : 88;
  const rxFrameSlate = fullBleed ? 68 : 80;

  const jPath = "M -83 -52 L -61 -52 L -61 36 L -77 52 L -125 52 L -141 36 L -141 14 L -119 14 L -119 30 L -83 30 Z";
  const gPath = "M -27 -52 L 21 -52 L 37 -36 L 37 -22 L 15 -22 L 15 -30 L -21 -30 L -21 30 L 15 30 L 15 10 L -2 10 L -2 -8 L 37 -8 L 37 36 L 21 52 L -27 52 L -43 36 L -43 -36 Z";
  const mPath = "M 55 52 L 55 -52 L 79 -52 L 99 -8 L 119 -52 L 143 -52 L 143 52 L 123 52 L 123 -12 L 105 26 L 93 26 L 75 -12 L 75 52 Z";

  const drawBolt = (cx, cy) => `
    <g transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="8.5" fill="#475569" stroke="#ffffff" stroke-width="2"/>
      <rect x="-5" y="-1" width="10" height="2" rx="1" fill="#cbd5e1"/>
    </g>
  `;

  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgSteel19" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="32%" stop-color="#cbd5e1"/>
      <stop offset="65%" stop-color="#94a3b8"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
    <linearGradient id="darkGunmetal19" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <pattern id="brushSteel19" width="120" height="4" patternUnits="userSpaceOnUse">
      <line x1="0" y1="1" x2="120" y2="1" stroke="rgba(255,255,255,0.28)" stroke-width="1"/>
      <line x1="0" y1="3" x2="120" y2="3" stroke="rgba(15,23,42,0.06)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Placa Acero Inoxidable Cepillado -->
  <rect width="512" height="512" rx="${rxOuter}" fill="url(#bgSteel19)"/>
  <rect width="512" height="512" rx="${rxOuter}" fill="url(#brushSteel19)"/>

  <!-- Bisel especular exterior e interior mecanizado -->
  <rect x="20" y="20" width="472" height="472" rx="${rxFrameWhite}" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.8"/>
  <rect x="28" y="28" width="456" height="456" rx="${rxFrameSlate}" fill="none" stroke="#64748b" stroke-width="1.5" opacity="0.5"/>

  <!-- Remaches ranurados industriales -->
  ${drawBolt(72, 72)}
  ${drawBolt(440, 72)}
  ${drawBolt(72, 440)}
  ${drawBolt(440, 440)}

  <!-- Sombra CNC sutil + Letrero JGM mecanizado oscuro -->
  <g transform="translate(258, 210) scale(1.04)" opacity="0.18">
    <path d="${jPath}" fill="#0f172a"/>
    <path d="${gPath}" fill="#0f172a"/>
    <path d="${mPath}" fill="#0f172a"/>
  </g>
  <g transform="translate(256, 206) scale(1.04)">
    <path d="${jPath}" fill="url(#darkGunmetal19)" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="miter"/>
    <path d="${gPath}" fill="url(#darkGunmetal19)" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="miter"/>
    <path d="${mPath}" fill="url(#darkGunmetal19)" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="miter"/>
  </g>

  <!-- Cápsula Gunmetal oscura con tipografía ConTech grabada -->
  <rect x="85" y="294" width="342" height="72" rx="18" fill="url(#darkGunmetal19)" stroke="#64748b" stroke-width="2.5"/>
  <rect x="88" y="297" width="336" height="66" rx="15" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="1"/>
  <text x="256" y="346" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="42" fill="#f8fafc" letter-spacing="4.5">ConTech</text>

  ${
    hideSubtitle
      ? ""
      : `<text x="256" y="405" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="13" fill="#334155" letter-spacing="4.2">${subtitle}</text>`
  }
</svg>`;
}

function renderPng(svg, width, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
  });
  const pngData = resvg.render();
  fs.writeFileSync(outPath, pngData.asPng());
  console.log("Generated:", path.relative(process.cwd(), outPath));
}

const publicDir = path.join(__dirname, "public");
const appDir = path.join(__dirname, "app");
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(appDir, { recursive: true });

const svgFullBleed = buildSteelIconSvg({ fullBleed: true, subtitle: "GERENCIA BIM 5D" });
const svgRounded = buildSteelIconSvg({ fullBleed: false, subtitle: "GERENCIA BIM 5D" });
const svgFavicon = buildSteelIconSvg({ fullBleed: false, hideSubtitle: true });

fs.writeFileSync(path.join(publicDir, "icon.svg"), svgFullBleed, "utf8");
fs.writeFileSync(path.join(publicDir, "logo-mark.svg"), svgRounded, "utf8");

renderPng(svgFullBleed, 512, path.join(publicDir, "icon-512.png"));
renderPng(svgFullBleed, 192, path.join(publicDir, "icon-192.png"));
renderPng(svgFullBleed, 180, path.join(publicDir, "apple-touch-icon.png"));
renderPng(svgRounded, 256, path.join(publicDir, "logo-mark.png"));
renderPng(svgFavicon, 64, path.join(publicDir, "favicon.png"));

renderPng(svgRounded, 256, path.join(appDir, "icon.png"));
renderPng(svgFullBleed, 180, path.join(appDir, "apple-icon.png"));

console.log("Opción 19 icons generated for Gerencia BIM 5D!");
