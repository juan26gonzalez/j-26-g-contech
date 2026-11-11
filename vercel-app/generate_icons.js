const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

function createAppIconSvg(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="55%" stop-color="#0b1530" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <radialGradient id="glowGrad" cx="50%" cy="38%" r="42%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.38" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="blueCyan" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="accentCurve" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
  </defs>

  <!-- Full-bleed dark navy canvas -->
  <rect width="512" height="512" fill="url(#bgGrad)" />
  <rect width="512" height="512" fill="url(#glowGrad)" />

  <!-- Subtle CAD blueprint grid -->
  <g stroke="#1e3a8a" stroke-opacity="0.28" stroke-width="1">
    <line x1="64" y1="0" x2="64" y2="512" />
    <line x1="128" y1="0" x2="128" y2="512" />
    <line x1="192" y1="0" x2="192" y2="512" />
    <line x1="256" y1="0" x2="256" y2="512" />
    <line x1="320" y1="0" x2="320" y2="512" />
    <line x1="384" y1="0" x2="384" y2="512" />
    <line x1="448" y1="0" x2="448" y2="512" />
    <line x1="0" y1="64" x2="512" y2="64" />
    <line x1="0" y1="128" x2="512" y2="128" />
    <line x1="0" y1="192" x2="512" y2="192" />
    <line x1="0" y1="256" x2="512" y2="256" />
    <line x1="0" y1="320" x2="512" y2="320" />
    <line x1="0" y1="384" x2="512" y2="384" />
    <line x1="0" y1="448" x2="512" y2="448" />
  </g>

  <!-- Central Geometric BIM 5D Structural & Financial Emblem -->
  <g transform="translate(256, 178)">
    <!-- Outer architectural hexagon frame -->
    <polygon points="0,-104 92,-52 92,52 0,104 -92,52 -92,-52"
      fill="#0f172a" fill-opacity="0.88"
      stroke="url(#blueCyan)" stroke-width="6" stroke-linejoin="round" />

    <!-- Subtle inner architectural truss lines -->
    <polygon points="0,-88 76,-44 76,44 0,88 -76,44 -76,-44"
      fill="none" stroke="#38bdf8" stroke-opacity="0.22" stroke-width="1.5" />

    <!-- Structural roof apex chevron (Civil Engineering Portal) -->
    <path d="M -56 -16 L 0 -54 L 56 -16"
      fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Ascending 5D Pillars / Cost Bars -->
    <rect x="-46" y="4" width="22" height="44" rx="4" fill="#2563eb" />
    <rect x="-11" y="-14" width="22" height="62" rx="4" fill="#38bdf8" />
    <rect x="24" y="-32" width="22" height="80" rx="4" fill="#ffffff" />

    <!-- Baseline Datum -->
    <line x1="-58" y1="54" x2="58" y2="54" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" />

    <!-- S-Curve Growth Arc across pillars -->
    <path d="M -52 24 C -20 24, -4 -18, 52 -42"
      fill="none" stroke="url(#accentCurve)" stroke-width="5" stroke-linecap="round" />
    <circle cx="52" cy="-42" r="5.5" fill="#10b981" stroke="#0f172a" stroke-width="2" />
  </g>

  <!-- Brand Typography (Matching Sister Bitácora App) -->
  <text x="256" y="368" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-weight="900" font-size="52" letter-spacing="-0.5">
    <tspan fill="#ffffff">JGM </tspan>
    <tspan fill="#38bdf8">ConTech</tspan>
  </text>

  <!-- Subtitle Badge Bar -->
  <rect x="136" y="392" width="240" height="32" rx="16" fill="#1e3a8a" fill-opacity="0.55" stroke="#38bdf8" stroke-opacity="0.45" stroke-width="1.5" />
  <text x="256" y="414" text-anchor="middle" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-weight="800" font-size="16" fill="#e2e8f0" letter-spacing="3.5">
    GERENCIA BIM 5D
  </text>
</svg>`;
}

function createLogoMarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="markBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="50%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <linearGradient id="accentC" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#markBg)" />
  <g transform="translate(128, 128)">
    <polygon points="0,-82 72,-41 72,41 0,82 -72,41 -72,-41"
      fill="#0f172a" fill-opacity="0.82" stroke="#ffffff" stroke-opacity="0.9" stroke-width="4" stroke-linejoin="round" />
    <path d="M -42 -12 L 0 -42 L 42 -12"
      fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="-35" y="4" width="16" height="34" rx="3" fill="#38bdf8" />
    <rect x="-8" y="-10" width="16" height="48" rx="3" fill="#93c5fd" />
    <rect x="19" y="-24" width="16" height="62" rx="3" fill="#ffffff" />
    <line x1="-44" y1="43" x2="44" y2="43" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" />
    <path d="M -40 20 C -14 20, -2 -14, 40 -32"
      fill="none" stroke="url(#accentC)" stroke-width="4.5" stroke-linecap="round" />
    <circle cx="40" cy="-32" r="4.5" fill="#34d399" />
  </g>
</svg>`;
}

function renderPng(svg, width, outputPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
  });
  const pngBuffer = resvg.render().asPng();
  fs.writeFileSync(outputPath, pngBuffer);
  console.log('Saved', outputPath, `${width}x${width}`);
}

const root = __dirname;
const svg512 = createAppIconSvg(512, 512);
const svgMark = createLogoMarkSvg();

fs.writeFileSync(path.join(root, 'public/icon.svg'), svg512);
fs.writeFileSync(path.join(root, 'public/logo-mark.svg'), svgMark);

renderPng(svg512, 512, path.join(root, 'public/icon-512.png'));
renderPng(svg512, 192, path.join(root, 'public/icon-192.png'));
renderPng(svg512, 180, path.join(root, 'public/apple-touch-icon.png'));
renderPng(svgMark, 256, path.join(root, 'public/logo-mark.png'));
renderPng(svgMark, 64, path.join(root, 'public/favicon.png'));

fs.copyFileSync(path.join(root, 'public/icon-512.png'), path.join(root, 'app/icon.png'));
fs.copyFileSync(path.join(root, 'public/apple-touch-icon.png'), path.join(root, 'app/apple-icon.png'));

console.log('Successfully generated JGM ConTech Gerencia BIM 5D branding and PWA icons!');
