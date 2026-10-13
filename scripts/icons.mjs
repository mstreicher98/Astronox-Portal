/**
 * App-Symbole für das Portal (Startbildschirm am Handy). Einmalig erzeugt:
 *   node scripts/icons.mjs
 */
import fs from 'node:fs';
import sharp from 'sharp';

const STAR = 'M24 4.5c1.3 11.2 5.6 16.2 19.5 19.5C29.6 27.3 25.3 32.3 24 43.5 22.7 32.3 18.4 27.3 4.5 24 18.4 20.7 22.7 15.7 24 4.5Z';
const mark = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5eead4"/><stop offset="0.52" stop-color="#8f9bff"/><stop offset="1" stop-color="#f472b6"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#8f9bff" stop-opacity="0.35"/><stop offset="1" stop-color="#8f9bff" stop-opacity="0"/></radialGradient></defs>
<circle cx="24" cy="24" r="22" fill="url(#glow)"/>
<g transform="rotate(-24 24 24)" fill="none" stroke="#b197fc" stroke-width="2.2" stroke-linecap="round"><path d="M3 24 A21 7.5 0 0 1 45 24" opacity="0.55"/></g>
<path fill="url(#g)" d="${STAR}"/>
<g transform="rotate(-24 24 24)"><path d="M45 24 A21 7.5 0 0 1 3 24" fill="none" stroke="#b197fc" stroke-width="2.2" stroke-linecap="round"/><circle cx="38.85" cy="29.3" r="3.1" fill="#f3eee2" stroke="#0b1330" stroke-width="1.6"/></g>`;

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
