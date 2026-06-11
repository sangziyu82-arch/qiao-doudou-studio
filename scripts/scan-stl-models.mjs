import { copyFile, readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const sourceDir = process.argv[2] || 'D:\\下载\\3dmox';
const outputPath = process.argv[3] || join(process.cwd(), 'public', 'stl-models.json');
const publicModelsDir = join(process.cwd(), 'public', 'models');

const readUInt32LE = (buffer, offset) => buffer.readUInt32LE(offset);
const readFloatLE = (buffer, offset) => buffer.readFloatLE(offset);

const emptyBounds = () => ({
  minX: Infinity,
  minY: Infinity,
  minZ: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
  maxZ: -Infinity
});

const includePoint = (bounds, x, y, z) => {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.maxZ = Math.max(bounds.maxZ, z);
};

const finalizeBounds = (bounds) => ({
  min: [bounds.minX, bounds.minY, bounds.minZ],
  max: [bounds.maxX, bounds.maxY, bounds.maxZ],
  size: [
    Number((bounds.maxX - bounds.minX).toFixed(4)),
    Number((bounds.maxY - bounds.minY).toFixed(4)),
    Number((bounds.maxZ - bounds.minZ).toFixed(4))
  ]
});

const parseBinaryStl = (buffer) => {
  const triangleCount = readUInt32LE(buffer, 80);
  const expectedLength = 84 + triangleCount * 50;
  if (buffer.length < expectedLength) {
    throw new Error('Binary STL length is shorter than declared triangle count.');
  }
  const bounds = emptyBounds();
  for (let i = 0; i < triangleCount; i += 1) {
    const base = 84 + i * 50;
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = base + 12 + vertex * 12;
      includePoint(bounds, readFloatLE(buffer, offset), readFloatLE(buffer, offset + 4), readFloatLE(buffer, offset + 8));
    }
  }
  return { triangleCount, ...finalizeBounds(bounds) };
};

const parseAsciiStl = (buffer) => {
  const text = buffer.toString('utf8');
  const matches = [...text.matchAll(/vertex\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi)];
  if (!matches.length) {
    throw new Error('No ASCII STL vertices found.');
  }
  const bounds = emptyBounds();
  matches.forEach((match) => includePoint(bounds, Number(match[1]), Number(match[2]), Number(match[3])));
  return { triangleCount: Math.round(matches.length / 3), ...finalizeBounds(bounds) };
};

const parseStl = (buffer) => {
  const declaredTriangles = buffer.length >= 84 ? readUInt32LE(buffer, 80) : 0;
  const binaryLength = 84 + declaredTriangles * 50;
  if (declaredTriangles > 0 && binaryLength === buffer.length) {
    return parseBinaryStl(buffer);
  }
  return parseAsciiStl(buffer);
};

const readStlEntries = async (dir) => {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.stl')
      .map((entry) => ({
        file: entry.name,
        fullPath: join(dir, entry.name)
      }));
  } catch {
    return [];
  }
};

const fileEntries = new Map();
(await readStlEntries(sourceDir)).forEach((entry) => fileEntries.set(entry.file, entry));
(await readStlEntries(publicModelsDir)).forEach((entry) => {
  if (!fileEntries.has(entry.file)) fileEntries.set(entry.file, entry);
});

const models = [];
await mkdir(publicModelsDir, { recursive: true });
for (const { file, fullPath } of fileEntries.values()) {
  const buffer = await readFile(fullPath);
  const parsed = parseStl(buffer);
  const publicPath = join(publicModelsDir, file);
  if (fullPath !== publicPath) await copyFile(fullPath, publicPath);
  models.push({
    id: basename(file, extname(file)),
    name: basename(file, extname(file)),
    file,
    publicUrl: `/models/${file}`,
    path: fullPath,
    triangleCount: parsed.triangleCount,
    bounds: {
      min: parsed.min,
      max: parsed.max
    },
    size: {
      x: parsed.size[0],
      y: parsed.size[1],
      z: parsed.size[2]
    },
    unit: 'mm'
  });
}

await mkdir(join(process.cwd(), 'public'), { recursive: true });
await writeFile(
  outputPath,
  JSON.stringify(
    {
      sourceDir,
      generatedAt: new Date().toISOString(),
      count: models.length,
      models
    },
    null,
    2
  ),
  'utf8'
);

console.log(`Scanned ${models.length} STL model(s) from ${sourceDir}`);
console.log(`Wrote ${outputPath}`);
