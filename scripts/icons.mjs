/**
 * App-Symbole für das Portal (Startbildschirm am Handy). Einmalig erzeugt:
 *   node scripts/icons.mjs
 */
import fs from 'node:fs';
import sharp from 'sharp';

const STAR = 'M24 4.5c1.3 11.2 5.6 16.2 19.5 19.5C29.6 27.3 25.3 32.3 24 43.5 22.7 32.3 18.4 27.3 4.5 24 18.4 20.7 22.7 15.7 24 4.5Z';
// Bahnen wie src/lib/components/Mark.svelte: [rx, ry, Breite, kräftige Seite]
const ORBITS = [
	[27.5, 9.8, 1.1, -1],
	[21, 7.5, 1.4, 1],
	[14.5, 5.2, 1.2, -1]
];
const fades = ORBITS.map(([rx, , , side], i) => `<linearGradient id="o${i}" gradientUnits="userSpaceOnUse" x1="${24 + side * rx}" y1="24" x2="${24 - side * rx}" y2="24"><stop offset="0" stop-color="#f3eee2"/><stop offset="0.5" stop-color="#f3eee2" stop-opacity="0.55"/><stop offset="0.92" stop-color="#f3eee2" stop-opacity="0"/></linearGradient>`).join('');
const arcs = (dir) => ORBITS.map(([rx, ry, w], i) => `<path d="M${24 - dir * rx} 24A${rx} ${ry} 0 0 1 ${24 + dir * rx} 24" stroke="url(#o${i})" stroke-width="${w}"/>`).join('');
const mark = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="0.52" stop-color="#8f9bff"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8f9bff" stop-opacity="0.35"/><stop offset="1" stop-color="#8f9bff" stop-opacity="0"/></radialGradient>${fades}</defs>
<circle cx="24" cy="24" r="22" fill="url(#glow)"/>
<g transform="rotate(-24 24 24)"><g fill="none" stroke-linecap="round" opacity="0.4">${arcs(1)}</g><circle cx="-1.84" cy="20.65" r="2.4" fill="#f472b6"/></g>
<path fill="url(#g)" d="${STAR}"/>
<g transform="rotate(-24 24 24)"><g fill="none" stroke-linecap="round" opacity="0.9">${arcs(-1)}</g>
<circle cx="38.85" cy="29.3" r="3.1" fill="#b197fc" stroke="#0b1330" stroke-width="1.6"/><circle cx="16.75" cy="28.5" r="2" fill="#5eead4" stroke="#0b1330" stroke-width="1.2"/></g>`;

/** pad: Anteil des Rands – maskierbare Symbole brauchen mehr Luft */
const icon = (size, pad) => {
	const inner = size * (1 - pad * 2);
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<rect width="${size}" height="${size}" fill="#0b1330"/>
<g transform="translate(${size * pad} ${size * pad}) scale(${inner / 48})">${mark}</g></svg>`);
};

for (const [name, size, pad] of [
	['icon-192.png', 192, 0.14],
	['icon-512.png', 512, 0.14],
	['icon-maskable-512.png', 512, 0.22]
]) {
	fs.writeFileSync(`static/${name}`, await sharp(icon(size, pad)).png({ compressionLevel: 9 }).toBuffer());
	console.log('static/' + name);
}
