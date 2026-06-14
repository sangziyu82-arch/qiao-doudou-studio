import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Box,
  Check,
  Download,
  Eraser,
  Eye,
  Image as ImageIcon,
  FileImage,
  Grid2X2,
  Heart,
  ImageUp,
  Paintbrush,
  Pipette,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Wand2,
  X
} from 'lucide-react';
import './styles.css';

const PUBLIC_BASE = import.meta.env.BASE_URL || '/';
const publicAsset = (path) => {
  if (!path) return '';
  if (/^(data:|blob:|https?:)/.test(path)) return path;
  return `${PUBLIC_BASE.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;
};
const DEFAULT_REFERENCE = publicAsset('reference.jpg');
const DONATE_WECHAT = publicAsset('donate-wechat.jpg');
const DONATE_ALIPAY = publicAsset('donate-alipay.jpg');
const EMPTY_CELL_COLOR = '#ffffff';
const MERGED_BLOCK_COLOR = '#ff0000';
const NUMBER_EXPORT_SIZES = {
  '2k': 2048,
  '4k': 4096
};
const makeEmptyGrid = (rows = 18, cols = 18) => Array.from({ length: rows }, () => Array(cols).fill(null));
const isSequentialNumberCell = (color) => Boolean(color) && color.toLowerCase() !== EMPTY_CELL_COLOR;
const clampGridSize = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
};
const markerKey = (row, col) => `${row}-${col}`;
const parseMarkerKey = (key) => {
  const [row, col] = key.split('-').map(Number);
  return { row, col };
};
const getMiddleBlockPlacement = (block) => {
  const points = block.cells.map(parseMarkerKey);
  const minRow = Math.min(...points.map((point) => point.row));
  const maxRow = Math.max(...points.map((point) => point.row));
  const minCol = Math.min(...points.map((point) => point.col));
  const maxCol = Math.max(...points.map((point) => point.col));
  return {
    row: minRow,
    col: minCol,
    sortRow: minRow + (maxRow > minRow ? 0.5 : 0),
    sortCol: minCol + (maxCol > minCol ? 0.5 : 0),
    isHorizontal: maxCol > minCol,
    isVertical: maxRow > minRow
  };
};

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

const distance = (a, b) => {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  return (ar.r - br.r) ** 2 + (ar.g - br.g) ** 2 + (ar.b - br.b) ** 2;
};

const nearestColor = (hex, palette) =>
  palette.reduce((best, color) => (distance(hex, color) < distance(hex, best) ? color : best), palette[0]);

const buildPalette = (cells, limit) => {
  const buckets = new Map();
  cells.flat().forEach((hex) => {
    if (!hex) return;
    const { r, g, b } = hexToRgb(hex);
    const key = rgbToHex(Math.round(r / 32) * 32, Math.round(g / 32) * 32, Math.round(b / 32) * 32);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });
  return [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([color]) => color);
};

const formatMm = (value) => Number(value || 0).toFixed(2).replace(/\.?0+$/, '');
const LAN_ORIGIN = 'http://192.168.1.190:5173';

const parseStlMesh = (arrayBuffer) => {
  const view = new DataView(arrayBuffer);
  const declaredTriangles = arrayBuffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const binaryLength = 84 + declaredTriangles * 50;

  if (declaredTriangles > 0 && binaryLength === arrayBuffer.byteLength) {
    const triangles = [];
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity
    };
    const include = ([x, y, z]) => {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.minZ = Math.min(bounds.minZ, z);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
      bounds.maxZ = Math.max(bounds.maxZ, z);
    };
    for (let i = 0; i < declaredTriangles; i += 1) {
      const base = 84 + i * 50;
      const normal = [view.getFloat32(base, true), view.getFloat32(base + 4, true), view.getFloat32(base + 8, true)];
      const vertices = [0, 1, 2].map((vertex) => {
        const offset = base + 12 + vertex * 12;
        const point = [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)];
        include(point);
        return point;
      });
      triangles.push({ normal, vertices });
    }
    return { triangles, bounds };
  }

  const text = new TextDecoder().decode(arrayBuffer);
  const matches = [...text.matchAll(/vertex\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)\s+(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi)];
  if (!matches.length) throw new Error('没有在 STL 中找到顶点。');
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity
  };
  const points = matches.map((match) => {
    const point = [Number(match[1]), Number(match[2]), Number(match[3])];
    bounds.minX = Math.min(bounds.minX, point[0]);
    bounds.minY = Math.min(bounds.minY, point[1]);
    bounds.minZ = Math.min(bounds.minZ, point[2]);
    bounds.maxX = Math.max(bounds.maxX, point[0]);
    bounds.maxY = Math.max(bounds.maxY, point[1]);
    bounds.maxZ = Math.max(bounds.maxZ, point[2]);
    return point;
  });
  const triangles = [];
  for (let i = 0; i < points.length; i += 3) {
    triangles.push({ normal: [0, 0, 0], vertices: points.slice(i, i + 3) });
  }
  return { triangles, bounds };
};

const createArrangedBinaryStl = (mesh, instances, name) => {
  const triangleCount = mesh.triangles.length * instances.length;
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  const header = encoder.encode(`${name} arranged by qiao-doudou-studio`.slice(0, 80));
  new Uint8Array(buffer, 0, 80).set(header);
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  instances.forEach(({ tx, ty }) => {
    mesh.triangles.forEach((triangle) => {
      view.setFloat32(offset, triangle.normal[0], true);
      view.setFloat32(offset + 4, triangle.normal[1], true);
      view.setFloat32(offset + 8, triangle.normal[2], true);
      offset += 12;
      triangle.vertices.forEach((vertex) => {
        const localX = vertex[0] - mesh.bounds.minX;
        const localY = vertex[1] - mesh.bounds.minY;
        view.setFloat32(offset, localX + tx, true);
        view.setFloat32(offset + 4, localY + ty, true);
        view.setFloat32(offset + 8, vertex[2] - mesh.bounds.minZ, true);
        offset += 12;
      });
      view.setUint16(offset, 0, true);
      offset += 2;
    });
  });

  return buffer;
};

function App() {
  const fileRef = useRef(null);
  const exportRef = useRef(null);
  const cropFrameRef = useRef(null);
  const cropDragRef = useRef(null);
  const skipNextProcessRef = useRef(false);
  const [imageSrc, setImageSrc] = useState(DEFAULT_REFERENCE);
  const [cropSource, setCropSource] = useState(null);
  const [activeSource, setActiveSource] = useState(DEFAULT_REFERENCE);
  const [activeCrop, setActiveCrop] = useState(null);
  const [cropRect, setCropRect] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [cropAspect, setCropAspect] = useState(1);
  const [grid, setGrid] = useState(() => makeEmptyGrid());
  const [columns, setColumns] = useState(18);
  const [rows, setRows] = useState(18);
  const [targetWidth, setTargetWidth] = useState(0);
  const [beadSize, setBeadSize] = useState(1);
  const [gap, setGap] = useState(0);
  const [colorLimit, setColorLimit] = useState(18);
  const [threshold, setThreshold] = useState(211);
  const [autoBackground, setAutoBackground] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const [numberMode, setNumberMode] = useState('color');
  const [numberExportSize, setNumberExportSize] = useState('2k');
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCenterGuide, setShowCenterGuide] = useState(true);
  const [showCountGuides, setShowCountGuides] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(45);
  const [donationOpen, setDonationOpen] = useState(true);
  const [tool, setTool] = useState('brush');
  const [specialMarkers, setSpecialMarkers] = useState(() => new Set());
  const [mergedBlocks, setMergedBlocks] = useState([]);
  const [selectedColor, setSelectedColor] = useState('#c61818');
  const [highlightColor, setHighlightColor] = useState(null);
  const [fileName, setFileName] = useState('snail-demo');
  const [stlModels, setStlModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [modelSourceDir, setModelSourceDir] = useState('D:\\下载\\3dmox');

  useEffect(() => {
    fetch(publicAsset('stl-models.json'))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.models?.length) return;
        setStlModels(data.models);
        setModelSourceDir(data.sourceDir || 'D:\\下载\\3dmox');
      })
      .catch(() => {
        setStlModels([]);
      });
  }, []);

  const selectedModel = useMemo(
    () => stlModels.find((model) => String(model.id) === String(selectedModelId)) || null,
    [selectedModelId, stlModels]
  );

  const stats = useMemo(() => {
    const map = new Map();
    grid.flat().forEach((color) => {
      if (color) map.set(color, (map.get(color) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [grid]);

  const sequentialNumbers = useMemo(() => {
    const map = new Map();
    const entries = [];
    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        if (!isSequentialNumberCell(color)) return;
        entries.push({
          key: markerKey(y, x),
          sortRow: y,
          sortCol: x
        });
      });
    });
    mergedBlocks.forEach((block) => {
      const placement = getMiddleBlockPlacement(block);
      entries.push({
        key: block.id,
        sortRow: placement.sortRow,
        sortCol: placement.sortCol
      });
    });
    entries
      .sort((a, b) => a.sortRow - b.sortRow || a.sortCol - b.sortCol)
      .forEach((entry, index) => {
        map.set(entry.key, index + 1);
      });
    return map;
  }, [grid, mergedBlocks]);

  const countGuides = useMemo(() => {
    const rowCounts = Array(grid.length).fill(0);
    const colCounts = Array(grid[0]?.length || 0).fill(0);

    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        if (!isSequentialNumberCell(color)) return;
        rowCounts[y] += 1;
        colCounts[x] += 1;
      });
    });

    mergedBlocks.forEach((block) => {
      const placement = getMiddleBlockPlacement(block);
      if (rowCounts[placement.row] !== undefined) rowCounts[placement.row] += 1;
      if (colCounts[placement.col] !== undefined) colCounts[placement.col] += 1;
    });

    return { rowCounts, colCounts };
  }, [grid, mergedBlocks]);

  const rowCount = grid.length || 0;
  const colCount = grid[0]?.length || 0;
  const beadCount = stats.reduce((sum, [, count]) => sum + count, 0);
  const cellWidth = selectedModel?.size?.x || beadSize;
  const cellHeight = selectedModel?.size?.y || beadSize;
  const actualWidth = colCount * cellWidth + Math.max(0, colCount - 1) * gap;
  const actualHeight = rowCount * cellHeight + Math.max(0, rowCount - 1) * gap;
  const shareOrigin = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? LAN_ORIGIN : window.location.origin;
  const modelPublicPath = selectedModel?.publicUrl ? publicAsset(selectedModel.publicUrl) : '';
  const modelUrl = modelPublicPath ? new URL(encodeURI(modelPublicPath), shareOrigin).href : '';
  const modelListUrl = new URL(publicAsset('stl-models.json'), shareOrigin).href;
  const overlaySource = activeSource || imageSrc;
  const overlayCrop = activeCrop || { x: 0, y: 0, w: 100, h: 100 };
  const overlayStyle = {
    opacity: showOverlay ? overlayOpacity / 100 : 0
  };
  const overlayImageStyle = {
    width: `${10000 / overlayCrop.w}%`,
    height: `${10000 / overlayCrop.h}%`,
    left: `${(-overlayCrop.x / overlayCrop.w) * 100}%`,
    top: `${(-overlayCrop.y / overlayCrop.h) * 100}%`
  };

  useEffect(() => {
    if (!activeSource) return;
    if (skipNextProcessRef.current) {
      skipNextProcessRef.current = false;
      return;
    }
    processImage(activeSource, activeCrop);
  }, [columns, rows, colorLimit, threshold, autoBackground, activeSource, activeCrop]);

  useEffect(() => {
    const handleShortcut = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      if (isTyping) return;
      if (event.key === 'Escape') {
        setHighlightColor(null);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault();
        setShowOverlay((value) => !value);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const applyModel = (model = selectedModel) => {
    if (!model) return;
    const columnCount = clampGridSize(columns, 8, 260, colCount || 18);
    setSelectedModelId(model.id);
    setBeadSize(Number(model.size.x.toFixed(2)));
    setGap(0);
    setTargetWidth(Number((columnCount * model.size.x).toFixed(2)));
  };

  const processImage = (src, crop = null) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const source = crop || { x: 0, y: 0, w: 100, h: 100 };
      const sx = (source.x / 100) * img.width;
      const sy = (source.y / 100) * img.height;
      const sw = (source.w / 100) * img.width;
      const sh = (source.h / 100) * img.height;
      const outputColumns = clampGridSize(columns, 8, 260, colCount || 18);
      const outputRows = clampGridSize(rows, 6, 260, rowCount || 18);
      const canvas = document.createElement('canvas');
      canvas.width = outputColumns;
      canvas.height = outputRows;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outputColumns, outputRows);
      const data = ctx.getImageData(0, 0, outputColumns, outputRows).data;
      const raw = Array.from({ length: outputRows }, (_, y) =>
        Array.from({ length: outputColumns }, (_, x) => {
          const index = (y * outputColumns + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          const brightness = (r + g + b) / 3;
          const contrast = Math.max(r, g, b) - Math.min(r, g, b);
          if (a < 40 || (autoBackground && brightness > threshold && contrast < 38)) return null;
          return rgbToHex(r, g, b);
        })
      );
      const palette = buildPalette(raw, colorLimit);
      const next = palette.length
        ? raw.map((row) => row.map((color) => (color ? nearestColor(color, palette) : null)))
        : raw;
      setGrid(next);
      setSelectedColor(palette[0] || '#c61818');
      setHighlightColor(null);
    };
    img.src = src;
  };

  const updateTargetWidth = (value) => {
    setTargetWidth(value);
    if (colCount) setBeadSize(Math.max(1, Number((value / colCount - gap).toFixed(2))));
    setSelectedModelId('');
  };

  const commitColumns = () => {
    const nextColumns = clampGridSize(columns, 8, 260, colCount || 18);
    setColumns(nextColumns);
    if (selectedModel) {
      setTargetWidth(Number((nextColumns * selectedModel.size.x + Math.max(0, nextColumns - 1) * gap).toFixed(2)));
    }
  };

  const commitRows = () => {
    setRows(clampGridSize(rows, 6, 260, rowCount || 18));
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileName(file.name.replace(/\.[^.]+$/, ''));
      setCropSource(reader.result);
      setCropRect({ x: 10, y: 10, w: 80, h: 80 });
      setCropAspect(1);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const clampCrop = (rect) => {
    const w = Math.min(100, Math.max(8, rect.w));
    const h = Math.min(100, Math.max(8, rect.h));
    const x = Math.min(100 - w, Math.max(0, rect.x));
    const y = Math.min(100 - h, Math.max(0, rect.y));
    return { x, y, w, h };
  };

  const updateCropFromPointer = (event) => {
    const drag = cropDragRef.current;
    const frame = cropFrameRef.current;
    if (!drag || !frame) return;
    const bounds = frame.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / bounds.width) * 100;
    const dy = ((event.clientY - drag.startY) / bounds.height) * 100;
    if (drag.mode === 'move') {
      setCropRect(clampCrop({ ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy }));
    } else {
      const start = drag.startRect;
      const minSize = 8;
      let left = start.x;
      let top = start.y;
      let right = start.x + start.w;
      let bottom = start.y + start.h;

      if (drag.mode.includes('w')) left = Math.min(right - minSize, Math.max(0, start.x + dx));
      if (drag.mode.includes('e')) right = Math.max(left + minSize, Math.min(100, start.x + start.w + dx));
      if (drag.mode.includes('n')) top = Math.min(bottom - minSize, Math.max(0, start.y + dy));
      if (drag.mode.includes('s')) bottom = Math.max(top + minSize, Math.min(100, start.y + start.h + dy));

      setCropRect({ x: left, y: top, w: right - left, h: bottom - top });
    }
  };

  const stopCropDrag = () => {
    cropDragRef.current = null;
    window.removeEventListener('pointermove', updateCropFromPointer);
    window.removeEventListener('pointerup', stopCropDrag);
  };

  const startCropDrag = (event, mode) => {
    event.preventDefault();
    cropDragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startRect: cropRect
    };
    window.addEventListener('pointermove', updateCropFromPointer);
    window.addEventListener('pointerup', stopCropDrag);
  };

  const confirmCrop = () => {
    const crop = clampCrop(cropRect);
    setCropRect(crop);
    setImageSrc(cropSource);
    setActiveSource(cropSource);
    setActiveCrop(crop);
    processImage(cropSource, crop);
    setCropSource(null);
  };

  const clearSpecialMarkers = () => {
    setSpecialMarkers(new Set());
  };

  const clearMergedBlocks = () => {
    setMergedBlocks([]);
  };

  const shiftCellKey = (key, rowOffset, colOffset) => {
    const { row, col } = parseMarkerKey(key);
    return markerKey(row + rowOffset, col + colOffset);
  };

  const addWorkspaceLine = (side) => {
    const currentCols = colCount || clampGridSize(columns, 8, 260, 8);
    const currentRows = rowCount || clampGridSize(rows, 6, 260, 6);
    if ((side === 'top' || side === 'bottom') && currentRows >= 260) {
      alert('纵向格数最多 260。');
      return;
    }
    if ((side === 'left' || side === 'right') && currentCols >= 260) {
      alert('横向格数最多 260。');
      return;
    }

    skipNextProcessRef.current = true;
    if (side === 'top') {
      setGrid((current) => [Array(currentCols).fill(null), ...current]);
      setRows(currentRows + 1);
      setSpecialMarkers((current) => new Set([...current].map((key) => shiftCellKey(key, 1, 0))));
      setMergedBlocks((current) =>
        current.map((block) => ({ ...block, cells: block.cells.map((key) => shiftCellKey(key, 1, 0)) }))
      );
      return;
    }

    if (side === 'bottom') {
      setGrid((current) => [...current, Array(currentCols).fill(null)]);
      setRows(currentRows + 1);
      return;
    }

    if (side === 'left') {
      setGrid((current) => current.map((row) => [null, ...row]));
      setColumns(currentCols + 1);
      setSpecialMarkers((current) => new Set([...current].map((key) => shiftCellKey(key, 0, 1))));
      setMergedBlocks((current) =>
        current.map((block) => ({ ...block, cells: block.cells.map((key) => shiftCellKey(key, 0, 1)) }))
      );
      return;
    }

    setGrid((current) => current.map((row) => [...row, null]));
    setColumns(currentCols + 1);
  };

  const removeMergedBlocksForCell = (row, col) => {
    const key = markerKey(row, col);
    setMergedBlocks((current) => current.filter((block) => !block.cells.includes(key)));
  };

  const createMergedRedBlock = () => {
    const selected = [...specialMarkers];
    if (selected.length !== 2) {
      alert('请先用“标记”工具选择 2 个相邻格子。');
      return;
    }
    const [a, b] = selected.map(parseMarkerKey);
    const adjacent = Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
    if (!adjacent) {
      alert('只能选择上下或左右相邻的 2 个格子，用来定位中间红块。');
      return;
    }
    const cells = selected.sort();
    setMergedBlocks((current) => [
      ...current.filter((block) => !block.cells.some((cell) => cells.includes(cell))),
      {
        id: `${cells.join('_')}_${Date.now()}`,
        cells
      }
    ]);
    clearSpecialMarkers();
    setTool('brush');
    setSelectedColor(MERGED_BLOCK_COLOR);
  };

  const paintCell = (row, col, mode = 'click') => {
    if (tool === 'marker') {
      const key = markerKey(row, col);
      setSpecialMarkers((current) => {
        const next = new Set(current);
        if (mode === 'drag') {
          if (next.size < 2) next.add(key);
        } else if (next.has(key)) {
          next.delete(key);
        } else {
          if (next.size >= 2) next.clear();
          next.add(key);
        }
        return next;
      });
      return;
    }

    if (tool !== 'picker') removeMergedBlocksForCell(row, col);
    setGrid((current) =>
      current.map((cells, y) =>
        cells.map((color, x) => {
          if (y !== row || x !== col) return color;
          if (tool === 'eraser') {
            return null;
          }
          if (tool === 'picker') {
            setSelectedColor(color || EMPTY_CELL_COLOR);
            setTool('brush');
            return color;
          }
          return selectedColor;
        })
      )
    );
  };

  const exportPng = () => {
    const canvas = exportRef.current;
    if (!canvas) return;
    const scale = 28;
    canvas.width = colCount * scale;
    canvas.height = rowCount * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f7f8fb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        ctx.fillStyle = color || '#ffffff';
        ctx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
        ctx.strokeStyle = '#2c6354';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
        if (specialMarkers.has(markerKey(y, x))) {
          ctx.strokeStyle = '#e00020';
          ctx.lineWidth = 3;
          ctx.strokeRect(x * scale + 3, y * scale + 3, scale - 6, scale - 6);
        }
      });
    });
    mergedBlocks.forEach((block) => {
      const placement = getMiddleBlockPlacement(block);
      const offsetX = placement.isHorizontal ? scale / 2 : 0;
      const offsetY = placement.isVertical ? scale / 2 : 0;
      ctx.fillStyle = MERGED_BLOCK_COLOR;
      ctx.fillRect(placement.col * scale + offsetX + 1, placement.row * scale + offsetY + 1, scale - 2, scale - 2);
      ctx.strokeStyle = '#2c6354';
      ctx.lineWidth = 1;
      ctx.strokeRect(placement.col * scale + offsetX + 0.5, placement.row * scale + offsetY + 0.5, scale - 1, scale - 1);
    });
    const link = document.createElement('a');
    link.download = `${fileName || 'qiao-doudou'}-${colCount}x${rowCount}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const fitTextToCell = (ctx, text, maxWidth, baseSize) => {
    let size = baseSize;
    do {
      ctx.font = `700 ${size}px Arial, "Microsoft YaHei", sans-serif`;
      if (ctx.measureText(text).width <= maxWidth || size <= 7) return size;
      size -= 1;
    } while (size > 7);
    return size;
  };

  const exportSequentialNumberPng = () => {
    const canvas = exportRef.current;
    if (!canvas) return;
    const targetSize = NUMBER_EXPORT_SIZES[numberExportSize] || NUMBER_EXPORT_SIZES['2k'];
    const longestSide = Math.max(colCount, rowCount, 1);
    const scale = Math.max(34, Math.floor(targetSize / longestSide));
    canvas.width = colCount * scale;
    canvas.height = rowCount * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        if (!isSequentialNumberCell(color)) return;
        const number = sequentialNumbers.get(markerKey(y, x));
        if (!number) return;
        const text = String(number);
        fitTextToCell(ctx, text, scale - 4, Math.floor(scale * 0.46));
        ctx.fillText(text, x * scale + scale / 2, y * scale + scale / 2);
      });
    });
    mergedBlocks.forEach((block) => {
      const number = sequentialNumbers.get(block.id);
      if (!number) return;
      const placement = getMiddleBlockPlacement(block);
      const offsetX = placement.isHorizontal ? scale / 2 : 0;
      const offsetY = placement.isVertical ? scale / 2 : 0;
      const text = String(number);
      fitTextToCell(ctx, text, scale - 4, Math.floor(scale * 0.46));
      ctx.fillText(text, placement.col * scale + offsetX + scale / 2, placement.row * scale + offsetY + scale / 2);
    });
    const link = document.createElement('a');
    link.download = `${fileName || 'qiao-doudou'}-${colCount}x${rowCount}-sequence-numbers-${numberExportSize}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportArrangedStl = async () => {
    if (!selectedModel?.publicUrl) {
      alert('请先扫描并选择一个 STL 模型。');
      return;
    }
    const mergedCellKeys = new Set(mergedBlocks.flatMap((block) => block.cells));
    const placements = [];
    grid.forEach((row, y) => {
      row.forEach((color, x) => {
        const key = markerKey(y, x);
        if (sequentialNumbers.has(key) && !mergedCellKeys.has(key)) placements.push({ x, y });
      });
    });
    const numberedMiddleBlocks = mergedBlocks.filter((block) => sequentialNumbers.has(block.id));
    if (!placements.length && !numberedMiddleBlocks.length) {
      alert('当前图案没有可导出的有色方块。');
      return;
    }

    const response = await fetch(encodeURI(modelPublicPath));
    if (!response.ok) {
      alert('无法读取 STL 模型文件，请重新运行 npm run scan-models。');
      return;
    }
    const mesh = parseStlMesh(await response.arrayBuffer());
    const stepX = cellWidth + gap;
    const stepY = cellHeight + gap;
    const instances = placements.map(({ x, y }) => ({
      tx: x * stepX,
      ty: y * stepY
    }));
    numberedMiddleBlocks.forEach((block) => {
      const points = block.cells.map(parseMarkerKey);
      const minRow = Math.min(...points.map((point) => point.row));
      const maxRow = Math.max(...points.map((point) => point.row));
      const minCol = Math.min(...points.map((point) => point.col));
      const maxCol = Math.max(...points.map((point) => point.col));
      const spanCols = maxCol - minCol + 1;
      const spanRows = maxRow - minRow + 1;
      const horizontalOffset = spanCols === 2 ? stepX / 2 : 0;
      const verticalOffset = spanRows === 2 ? stepY / 2 : 0;
      instances.push({
        tx: minCol * stepX + horizontalOffset,
        ty: minRow * stepY + verticalOffset
      });
    });
    const arranged = createArrangedBinaryStl(
      mesh,
      instances,
      `${fileName}-${selectedModel.name}`
    );
    const blob = new Blob([arranged], { type: 'model/stl' });
    const link = document.createElement('a');
    link.download = `${fileName || 'qiao-doudou'}-${selectedModel.name}-${colCount}x${rowCount}-arranged.stl`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const downloadSourceModel = () => {
    if (!modelUrl || !selectedModel) {
      alert('请先选择一个 STL 模型。');
      return;
    }
    const link = document.createElement('a');
    link.href = modelUrl;
    link.download = selectedModel.file || `${selectedModel.name}.stl`;
    link.click();
  };

  const copyText = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(message);
    } catch {
      window.prompt('复制这个链接：', text);
    }
  };

  const resetDemo = () => {
    setImageSrc(DEFAULT_REFERENCE);
    setCropSource(null);
    setActiveSource(DEFAULT_REFERENCE);
    setActiveCrop(null);
    setFileName('snail-demo');
    setColumns(18);
    setRows(18);
    setSelectedColor('#c61818');
    setHighlightColor(null);
    setSelectedModelId('');
    setTargetWidth(0);
    setBeadSize(1);
    setGap(0);
    setColorLimit(18);
    setThreshold(211);
    setAutoBackground(true);
    setShowNumbers(false);
    setShowOverlay(false);
    setShowCenterGuide(true);
    setShowCountGuides(true);
    clearSpecialMarkers();
    clearMergedBlocks();
    setOverlayOpacity(45);
    processImage(DEFAULT_REFERENCE, null);
  };

  const saveDraft = () => {
    localStorage.setItem(
      'qiao-doudou-draft',
      JSON.stringify({
        grid,
        columns,
        rows,
        specialMarkers: [...specialMarkers],
        mergedBlocks,
        beadSize,
        gap,
        colorLimit,
        threshold,
        autoBackground,
        fileName,
        selectedModelId,
        cellWidth,
        cellHeight
      })
    );
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Grid2X2 size={19} /></div>
          <div>
            <strong>敲豆豆工作台</strong>
            <span>图片转像素底板 · STL 尺寸排布 · 可编辑 · 可统计</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" onClick={resetDemo}><RefreshCw size={16} />示例</button>
          <button className="solid-btn" onClick={exportPng}><Download size={16} />导出图纸</button>
        </div>
      </header>

      <section className="metrics">
        <Metric label="网格数量" value={`${colCount} x ${rowCount}`} />
        <Metric label="方格/豆豆数" value={beadCount.toLocaleString()} />
        <Metric label="实际成品尺寸" value={`${actualWidth.toFixed(1)} x ${actualHeight.toFixed(1)} mm`} />
        <Metric label="单格 STL 尺寸" value={`${formatMm(cellWidth)} x ${formatMm(cellHeight)} mm`} />
      </section>

      <div className="workspace">
        <aside className="panel left-panel">
          <PanelTitle index="1" title="上传图案" />
          <button className="upload-zone" onClick={() => fileRef.current?.click()}>
            <ImageUp size={25} />
            <strong>点击或拖入一张图片</strong>
            <span>上传后先裁剪，再生成底板</span>
          </button>
          <input ref={fileRef} className="hidden" type="file" accept="image/*" onChange={handleUpload} />

          <PanelTitle index="2" title="3D STL 模型" />
          <div className="model-card">
            <div className="model-card-head">
              <Box size={18} />
              <div>
                <strong>{selectedModel?.name || '未选择模型'}</strong>
                <span>{stlModels.length ? `${stlModels.length} 个模型 · ${modelSourceDir}` : '未找到 stl-models.json'}</span>
              </div>
            </div>
            <select
              value={selectedModelId}
              onChange={(event) => {
                const model = stlModels.find((item) => item.id === event.target.value);
                if (model) applyModel(model);
                else setSelectedModelId('');
              }}
              disabled={!stlModels.length}
            >
              {stlModels.length ? (
                <>
                  <option value="">自定义尺寸</option>
                  {stlModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </>
              ) : (
                <option value="">未扫描到 STL</option>
              )}
            </select>
            <div className="model-spec-grid">
              <span>X {formatMm(selectedModel?.size?.x)} mm</span>
              <span>Y {formatMm(selectedModel?.size?.y)} mm</span>
              <span>Z {formatMm(selectedModel?.size?.z)} mm</span>
            </div>
            <button className="model-apply" onClick={() => applyModel()} disabled={!selectedModel}>
              应用 STL 尺寸并设为无间距
            </button>
          </div>

          <PanelTitle index="3" title="成品尺寸" />
          <div className="control-grid">
            <Field label="目标宽度 mm">
              <input type="number" value={targetWidth} min="0" max="2000" onChange={(e) => updateTargetWidth(Number(e.target.value))} />
            </Field>
            <Field label="单格宽度 mm">
              <input type="number" value={beadSize} min="1" max="80" step="0.1" onChange={(e) => { setBeadSize(Number(e.target.value)); setSelectedModelId(''); }} />
            </Field>
            <Field label="模型间距 mm">
              <input type="number" value={gap} min="0" max="20" step="0.1" onChange={(e) => setGap(Number(e.target.value))} />
            </Field>
            <Field label="横向格数">
              <input
                type="number"
                value={columns}
                min="8"
                max="260"
                onChange={(e) => setColumns(e.target.value)}
                onBlur={commitColumns}
              />
            </Field>
            <Field label="纵向格数">
              <input
                type="number"
                value={rows}
                min="6"
                max="260"
                onChange={(e) => setRows(e.target.value)}
                onBlur={commitRows}
              />
            </Field>
          </div>

          <PanelTitle index="4" title="图像识别" />
          <Field label="颜色数量">
            <input type="range" min="2" max="18" value={colorLimit} onChange={(e) => setColorLimit(Number(e.target.value))} />
            <b>{colorLimit}</b>
          </Field>
          <Field label="背景阈值">
            <input type="range" min="180" max="255" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            <b>{threshold}</b>
          </Field>
          <label className="toggle-row">
            <input type="checkbox" checked={autoBackground} onChange={(e) => setAutoBackground(e.target.checked)} />
            <span>自动清除浅色背景</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={showCenterGuide} onChange={(e) => setShowCenterGuide(e.target.checked)} />
            <span>显示中心参考线</span>
          </label>
          <label className="toggle-row">
            <input type="checkbox" checked={showCountGuides} onChange={(e) => setShowCountGuides(e.target.checked)} />
            <span>显示行列计数</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showNumbers && numberMode === 'color'}
              onChange={(e) => {
                setShowNumbers(e.target.checked);
                setNumberMode('color');
              }}
            />
            <span>显示颜色编号</span>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={showNumbers && numberMode === 'sequence'}
              onChange={(e) => {
                setShowNumbers(e.target.checked);
                setNumberMode('sequence');
              }}
            />
            <span>显示顺序编号</span>
          </label>
        </aside>

        <section className="stage">
          <div className="stage-toolbar">
            <ToolButton active={tool === 'brush'} label="画笔" icon={<Paintbrush size={17} />} onClick={() => setTool('brush')} />
            <ToolButton active={tool === 'eraser'} label="橡皮" icon={<Eraser size={17} />} onClick={() => setTool('eraser')} />
            <ToolButton active={tool === 'picker'} label="吸管" icon={<Pipette size={17} />} onClick={() => setTool('picker')} />
            <ToolButton active={tool === 'marker'} label="标记" icon={<Sparkles size={17} />} onClick={() => setTool('marker')} />
            <ToolButton active={showOverlay} label="原图" icon={<ImageIcon size={17} />} onClick={() => setShowOverlay((value) => !value)} />
            <div className="overlay-control">
              <span>透明度</span>
              <input
                type="range"
                min="0"
                max="100"
                value={overlayOpacity}
                onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                disabled={!showOverlay}
              />
              <b>{overlayOpacity}%</b>
            </div>
            <div className="color-input-wrap">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => {
                  setSelectedColor(e.target.value);
                }}
                title="当前颜色"
              />
              <span>{selectedColor.toUpperCase()}</span>
            </div>
          </div>

          <div className="canvas-card">
            <div className="ruler ruler-top">{actualWidth.toFixed(1)} mm</div>
            <div className="ruler ruler-left">{actualHeight.toFixed(1)} mm</div>
            <div
              className="bead-grid"
              style={{
                gridTemplateColumns: `repeat(${colCount}, minmax(9px, 1fr))`,
                aspectRatio: `${actualWidth || colCount} / ${actualHeight || rowCount}`,
                '--gap': `${Math.max(0, gap)}px`
              }}
            >
              <button className="workspace-add add-top" onClick={() => addWorkspaceLine('top')} title="在顶部增加 1 行空格" aria-label="在顶部增加一行"><Plus size={18} /></button>
              <button className="workspace-add add-bottom" onClick={() => addWorkspaceLine('bottom')} title="在底部增加 1 行空格" aria-label="在底部增加一行"><Plus size={18} /></button>
              <button className="workspace-add add-left" onClick={() => addWorkspaceLine('left')} title="在左侧增加 1 列空格" aria-label="在左侧增加一列"><Plus size={18} /></button>
              <button className="workspace-add add-right" onClick={() => addWorkspaceLine('right')} title="在右侧增加 1 列空格" aria-label="在右侧增加一列"><Plus size={18} /></button>
              <div className="image-overlay" style={overlayStyle} aria-hidden="true">
                <img src={overlaySource} alt="" style={overlayImageStyle} draggable="false" />
              </div>
              {showCenterGuide && (
                <div className="center-guides" aria-hidden="true">
                  <span className="center-guide-x" />
                  <span className="center-guide-y" />
                </div>
              )}
              {showCountGuides && countGuides.colCounts.map((count, x) => (
                count > 0 ? (
                  <span
                    className="count-guide count-col"
                    key={`col-count-${x}`}
                    style={{ gridColumn: x + 1, gridRow: 1 }}
                    title={`第 ${x + 1} 列：${count} 个有颜色色块`}
                  >
                    {count}
                  </span>
                ) : null
              ))}
              {showCountGuides && countGuides.rowCounts.map((count, y) => (
                count > 0 ? (
                  <span
                    className="count-guide count-row"
                    key={`row-count-${y}`}
                    style={{ gridColumn: 1, gridRow: y + 1 }}
                    title={`第 ${y + 1} 行：${count} 个有颜色色块`}
                  >
                    {count}
                  </span>
                ) : null
              ))}
              {mergedBlocks.map((block) => {
                const placement = getMiddleBlockPlacement(block);
                return (
                  <span
                    className={`merged-red-block ${placement.isHorizontal ? 'middle-horizontal' : ''} ${placement.isVertical ? 'middle-vertical' : ''}`}
                    key={block.id}
                    style={{
                      gridColumn: placement.col + 1,
                      gridRow: placement.row + 1
                    }}
                  >
                    {showNumbers && numberMode === 'sequence' ? sequentialNumbers.get(block.id) || '' : ''}
                  </span>
                );
              })}
              {grid.map((row, y) =>
                row.map((color, x) => {
                  const colorIndex = color ? stats.findIndex(([statColor]) => statColor === color) + 1 : '';
                  const sequenceIndex = sequentialNumbers.get(markerKey(y, x)) || '';
                  const displayIndex = numberMode === 'sequence' ? sequenceIndex : colorIndex;
                  return (
                    <button
                      className={`bead-cell ${color && highlightColor === color ? 'highlighted' : ''} ${specialMarkers.has(markerKey(y, x)) ? 'marked' : ''}`}
                      key={`${y}-${x}`}
                      style={{
                        backgroundColor: color || '#f9fafb',
                        gridColumn: x + 1,
                        gridRow: y + 1
                      }}
                      onClick={() => paintCell(y, x)}
                      onMouseEnter={(event) => event.buttons === 1 && paintCell(y, x, 'drag')}
                      title={`${x + 1}, ${y + 1} ${color || '空'}`}
                    >
                      {showNumbers && displayIndex ? displayIndex : ''}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <aside className="panel right-panel">
          <PanelTitle index="5" title="预览与操作" />
          <div className="source-preview">
            <img src={imageSrc} alt="参考图" />
            <div>
              <strong>{fileName}</strong>
              <span>当前工具：{tool === 'brush' ? '画笔' : tool === 'eraser' ? '橡皮' : tool === 'picker' ? '吸管' : '选择中间位'}</span>
            </div>
          </div>
          <div className="quick-actions">
            <button onClick={exportPng}><FileImage size={16} />PNG 图纸</button>
            <label className="export-size-control">
              <span>编号清晰度</span>
              <select value={numberExportSize} onChange={(event) => setNumberExportSize(event.target.value)}>
                <option value="2k">2K</option>
                <option value="4k">4K</option>
              </select>
            </label>
            <button onClick={exportSequentialNumberPng}><FileImage size={16} />编号PNG</button>
            <button onClick={exportArrangedStl}><Box size={16} />STL 模型</button>
            <button onClick={downloadSourceModel}><Download size={16} />下载原模</button>
            <button onClick={() => copyText(modelUrl, '已复制 STL 引用链接')}><Box size={16} />复制链接</button>
            <button onClick={() => { setNumberMode('color'); setShowNumbers((v) => !(v && numberMode === 'color')); }}><Eye size={16} />颜色编号</button>
            <button onClick={() => { setNumberMode('sequence'); setShowNumbers((v) => !(v && numberMode === 'sequence')); }}><Eye size={16} />顺序编号</button>
            <button onClick={createMergedRedBlock}><Sparkles size={16} />生成中间块</button>
            <button onClick={clearSpecialMarkers}><Sparkles size={16} />清除标记</button>
            <button onClick={clearMergedBlocks}><Eraser size={16} />清除中间块</button>
            <button onClick={() => fileRef.current?.click()}><Wand2 size={16} />换图</button>
            <button onClick={saveDraft}><Save size={16} />本地草稿</button>
            <button className="donate-action" onClick={() => setDonationOpen(true)}><Heart size={16} />打赏支持</button>
          </div>

          <div className="model-summary">
            <strong>排布规则</strong>
            <span>每个有颜色的格子对应 1 个 STL 方块；当前按 {formatMm(cellWidth)} x {formatMm(cellHeight)} mm 排列，模型间距 {formatMm(gap)} mm。</span>
            <span>已选择：{specialMarkers.size} 个；中间红块：{mergedBlocks.length} 个。红块会显示在两个格子之间，STL 使用原模型放在两格中间，不拉伸模型。</span>
            {selectedModel && (
              <div className="model-link-box">
                <code>{modelUrl}</code>
                <button onClick={() => copyText(modelListUrl, '已复制模型清单链接')}>复制模型清单</button>
              </div>
            )}
          </div>

          <PanelTitle index="6" title="RGB 颜色表" />
          <div className="palette-list">
            {stats.map(([color, count], index) => (
              <button
                className={`palette-row ${highlightColor === color ? 'active' : ''}`}
                key={color}
                onClick={() => {
                  setSelectedColor(color);
                  setHighlightColor((current) => (current === color ? null : color));
                }}
              >
                <span className="palette-index">{index + 1}</span>
                <span className="swatch" style={{ backgroundColor: color }} />
                <span className="palette-color">{color.toUpperCase()}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>

          <div className="note">
            <Sparkles size={16} />
            <span>STL 模型只负责真实尺寸；颜色和是否生成由网格图案决定。</span>
          </div>
        </aside>
      </div>

      {donationOpen && (
        <div className="donation-modal" role="dialog" aria-modal="true" aria-label="制作不易欢迎打赏">
          <div className="donation-bubbles" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="donation-dialog">
            <button className="icon-btn donation-close" onClick={() => setDonationOpen(false)} aria-label="关闭打赏">
              <X size={18} />
            </button>
            <div className="donation-hero">
              <span><Heart size={18} /> 小小支持</span>
              <strong>制作不易，欢迎打赏</strong>
              <p>如果这个敲豆豆工具帮你省了一点点时间，可以请作者喝杯奶茶。感谢每一份可爱的鼓励。</p>
            </div>
            <div className="donation-grid">
              <div className="donation-card wechat">
                <div>
                  <strong>微信支付</strong>
                  <span>推荐使用微信扫一扫</span>
                </div>
                <img src={DONATE_WECHAT} alt="微信支付打赏二维码" />
              </div>
              <div className="donation-card alipay">
                <div>
                  <strong>支付宝</strong>
                  <span>打开支付宝扫一扫</span>
                </div>
                <img src={DONATE_ALIPAY} alt="支付宝打赏二维码" />
              </div>
            </div>
          </div>
        </div>
      )}

      {cropSource && (
        <div className="crop-modal" role="dialog" aria-modal="true" aria-label="裁剪图片">
          <div className="crop-dialog">
            <div className="crop-head">
              <div>
                <strong>截取要生成的部分</strong>
                <span>拖动选框调整位置，拉右下角改变大小，确认后再生成底板。</span>
              </div>
              <button className="icon-btn" onClick={() => setCropSource(null)} aria-label="关闭裁剪"><X size={18} /></button>
            </div>
            <div className="crop-body">
              <div className="crop-frame" ref={cropFrameRef} style={{ aspectRatio: cropAspect }}>
                <img
                  src={cropSource}
                  alt="待裁剪图片"
                  draggable="false"
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) {
                      setCropAspect(img.naturalWidth / img.naturalHeight);
                    }
                  }}
                />
                <div className="crop-shade shade-top" style={{ height: `${cropRect.y}%` }} />
                <div className="crop-shade shade-left" style={{ top: `${cropRect.y}%`, width: `${cropRect.x}%`, height: `${cropRect.h}%` }} />
                <div className="crop-shade shade-right" style={{ top: `${cropRect.y}%`, left: `${cropRect.x + cropRect.w}%`, height: `${cropRect.h}%` }} />
                <div className="crop-shade shade-bottom" style={{ top: `${cropRect.y + cropRect.h}%` }} />
                <button
                  className="crop-box"
                  style={{ left: `${cropRect.x}%`, top: `${cropRect.y}%`, width: `${cropRect.w}%`, height: `${cropRect.h}%` }}
                  onPointerDown={(event) => startCropDrag(event, 'move')}
                  aria-label="拖动裁剪选区"
                >
                  <span className="crop-grid-lines" />
                  {['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'].map((handle) => (
                    <span
                      key={handle}
                      className={`crop-handle crop-handle-${handle}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        startCropDrag(event, handle);
                      }}
                    />
                  ))}
                </button>
              </div>
              <div className="crop-controls">
                <Field label="左侧位置">
                  <input type="range" min="0" max={100 - cropRect.w} value={cropRect.x} onChange={(e) => setCropRect(clampCrop({ ...cropRect, x: Number(e.target.value) }))} />
                  <b>{Math.round(cropRect.x)}%</b>
                </Field>
                <Field label="顶部位置">
                  <input type="range" min="0" max={100 - cropRect.h} value={cropRect.y} onChange={(e) => setCropRect(clampCrop({ ...cropRect, y: Number(e.target.value) }))} />
                  <b>{Math.round(cropRect.y)}%</b>
                </Field>
                <Field label="选区宽度">
                  <input type="range" min="8" max={100 - cropRect.x} value={cropRect.w} onChange={(e) => setCropRect(clampCrop({ ...cropRect, w: Number(e.target.value) }))} />
                  <b>{Math.round(cropRect.w)}%</b>
                </Field>
                <Field label="选区高度">
                  <input type="range" min="8" max={100 - cropRect.y} value={cropRect.h} onChange={(e) => setCropRect(clampCrop({ ...cropRect, h: Number(e.target.value) }))} />
                  <b>{Math.round(cropRect.h)}%</b>
                </Field>
              </div>
            </div>
            <div className="crop-actions">
              <button className="ghost-action" onClick={() => setCropSource(null)}><X size={16} />取消</button>
              <button className="solid-action" onClick={confirmCrop}><Check size={16} />生成底板</button>
            </div>
          </div>
        </div>
      )}
      <canvas ref={exportRef} className="hidden" />
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ index, title }) {
  return (
    <div className="panel-title">
      <span>{index}</span>
      <strong>{title}</strong>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>{children}</div>
    </label>
  );
}

function ToolButton({ active, icon, label, onClick }) {
  return (
    <button className={`tool-btn ${active ? 'active' : ''}`} onClick={onClick} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

createRoot(document.getElementById('root')).render(<App />);
