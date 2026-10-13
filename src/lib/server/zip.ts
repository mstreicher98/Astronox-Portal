/**
 * Sehr kleiner ZIP-Schreiber ohne Zusatzpaket (Verfahren „stored“, also
 * ohne Komprimierung – PDFs sind ohnehin schon komprimiert).
 */

const TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf: Buffer): number {
	let c = 0xffffffff;
	for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date) {
	return {
		time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
		date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
	};
}

export function zip(entries: { name: string; data: Buffer; date?: Date }[]): Buffer {
	const parts: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const e of entries) {
		const name = Buffer.from(e.name, 'utf8');
		const crc = crc32(e.data);
		const { time, date } = dosTime(e.date ?? new Date());
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6); // UTF-8-Dateinamen
		local.writeUInt16LE(0, 8);
		local.writeUInt16LE(time, 10);
		local.writeUInt16LE(date, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(e.data.length, 18);
		local.writeUInt32LE(e.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		parts.push(local, name, e.data);

		const head = Buffer.alloc(46);
		head.writeUInt32LE(0x02014b50, 0);
		head.writeUInt16LE(20, 4);
		head.writeUInt16LE(20, 6);
		head.writeUInt16LE(0x0800, 8);
		head.writeUInt16LE(0, 10);
		head.writeUInt16LE(time, 12);
		head.writeUInt16LE(date, 14);
		head.writeUInt32LE(crc, 16);
		head.writeUInt32LE(e.data.length, 20);
		head.writeUInt32LE(e.data.length, 24);
		head.writeUInt16LE(name.length, 28);
		head.writeUInt32LE(offset, 42);
		central.push(head, name);
		offset += 30 + name.length + e.data.length;
	}
	const centralBuf = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralBuf.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...parts, centralBuf, end]);
}
