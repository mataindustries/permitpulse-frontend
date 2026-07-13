import { PDFDocument, ParseSpeeds } from "pdf-lib";
import { evidenceFileExtension } from "../../shared/evidence-intake/file-validation";

const maximumImagePixels = 100_000_000;
const maximumContainerBoxes = 10_000;
const maximumDecodedImageBytes = 64 * 1024 * 1024;
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return (
    bytes.length >= prefix.length &&
    prefix.every((value, index) => bytes[index] === value)
  );
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function hasSafeImageDimensions(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= maximumImagePixels &&
    height <= Math.floor(maximumImagePixels / width)
  );
}

function lastIndexOfSequence(
  bytes: Uint8Array,
  sequence: readonly number[],
): number {
  for (let offset = bytes.length - sequence.length; offset >= 0; offset -= 1) {
    if (sequence.every((value, index) => bytes[offset + index] === value)) {
      return offset;
    }
  }
  return -1;
}

async function isStructurallyValidPdf(bytes: Uint8Array): Promise<boolean> {
  const eof = lastIndexOfSequence(bytes, [0x25, 0x25, 0x45, 0x4f, 0x46]);
  if (eof < 0) return false;
  for (let offset = eof + 5; offset < bytes.length; offset += 1) {
    if (![0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(bytes[offset])) {
      return false;
    }
  }

  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      parseSpeed: ParseSpeeds.Medium,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    return document.getPageCount() > 0;
  } catch {
    return false;
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1
        ? 0xedb88320 ^ (value >>> 1)
        : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let offset = start; offset < end; offset += 1) {
    crc = crcTable[(crc ^ bytes[offset]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validPngBitDepth(bitDepth: number, colorType: number): boolean {
  const allowed: Readonly<Record<number, readonly number[]>> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  return allowed[colorType]?.includes(bitDepth) ?? false;
}

function isPngChunkType(bytes: Uint8Array, offset: number): boolean {
  for (let index = 0; index < 4; index += 1) {
    const value = bytes[offset + index];
    if (!(
      (value >= 0x41 && value <= 0x5a) ||
      (value >= 0x61 && value <= 0x7a)
    )) {
      return false;
    }
  }
  return (bytes[offset + 2] & 0x20) === 0;
}

type PngImageData = {
  bitDepth: number;
  colorType: number;
  height: number;
  imageData: Uint8Array[];
  interlaceMethod: number;
  width: number;
};

type PngPass = {
  height: number;
  rowBytes: number;
};

function pngPasses(input: PngImageData): PngPass[] | null {
  const channelsByColorType: Readonly<Record<number, number>> = {
    0: 1,
    2: 3,
    3: 1,
    4: 2,
    6: 4,
  };
  const channels = channelsByColorType[input.colorType];
  if (!channels) return null;
  const bitsPerPixel = channels * input.bitDepth;
  const passGeometry = input.interlaceMethod === 0
    ? [[0, 0, 1, 1] as const]
    : [
        [0, 0, 8, 8] as const,
        [4, 0, 8, 8] as const,
        [0, 4, 4, 8] as const,
        [2, 0, 4, 4] as const,
        [0, 2, 2, 4] as const,
        [1, 0, 2, 2] as const,
        [0, 1, 1, 2] as const,
      ];

  return passGeometry.flatMap(([startX, startY, stepX, stepY]) => {
    if (input.width <= startX || input.height <= startY) return [];
    const width = Math.ceil((input.width - startX) / stepX);
    const height = Math.ceil((input.height - startY) / stepY);
    return [{ height, rowBytes: Math.ceil((width * bitsPerPixel) / 8) }];
  });
}

async function hasValidPngImageData(input: PngImageData): Promise<boolean> {
  const passes = pngPasses(input);
  if (!passes || passes.length === 0 || input.imageData.length === 0) return false;
  const expectedBytes = passes.reduce(
    (total, pass) => total + pass.height * (pass.rowBytes + 1),
    0,
  );
  if (expectedBytes <= 0 || expectedBytes > maximumDecodedImageBytes) return false;

  const compressed = new ReadableStream<BufferSource>({
    start(controller) {
      for (const chunk of input.imageData) controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    },
  });
  const reader = compressed
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  let decodedBytes = 0;
  let passIndex = 0;
  let rowIndex = 0;
  let bytesRemainingInRow = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      let offset = 0;
      decodedBytes += chunk.byteLength;
      if (decodedBytes > expectedBytes) {
        await reader.cancel();
        return false;
      }

      while (offset < chunk.byteLength) {
        if (passIndex >= passes.length) {
          await reader.cancel();
          return false;
        }
        const pass = passes[passIndex];
        if (bytesRemainingInRow === 0) {
          if (chunk[offset] > 4) {
            await reader.cancel();
            return false;
          }
          offset += 1;
          bytesRemainingInRow = pass.rowBytes;
          if (bytesRemainingInRow === 0) return false;
        }

        const available = chunk.byteLength - offset;
        const consumed = Math.min(available, bytesRemainingInRow);
        offset += consumed;
        bytesRemainingInRow -= consumed;
        if (bytesRemainingInRow === 0) {
          rowIndex += 1;
          if (rowIndex === pass.height) {
            passIndex += 1;
            rowIndex = 0;
          }
        }
      }
    }
  } catch {
    return false;
  } finally {
    reader.releaseLock();
  }

  return (
    decodedBytes === expectedBytes &&
    passIndex === passes.length &&
    rowIndex === 0 &&
    bytesRemainingInRow === 0
  );
}

async function isStructurallyValidPng(bytes: Uint8Array): Promise<boolean> {
  if (!hasPrefix(bytes, pngSignature)) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const knownCriticalChunks = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
  let offset = pngSignature.length;
  let chunkCount = 0;
  let colorType = -1;
  let bitDepth = -1;
  let width = 0;
  let height = 0;
  let interlaceMethod = -1;
  let seenHeader = false;
  let seenPalette = false;
  let seenImageData = false;
  let imageDataEnded = false;
  const imageData: Uint8Array[] = [];

  while (offset < bytes.length && chunkCount < maximumContainerBoxes) {
    chunkCount += 1;
    if (bytes.length - offset < 12) return false;
    const dataLength = view.getUint32(offset);
    const typeOffset = offset + 4;
    if (!isPngChunkType(bytes, typeOffset)) return false;
    if (dataLength > bytes.length - offset - 12) return false;

    const type = ascii(bytes, typeOffset, 4);
    const dataOffset = offset + 8;
    const crcOffset = dataOffset + dataLength;
    if (crc32(bytes, typeOffset, crcOffset) !== view.getUint32(crcOffset)) {
      return false;
    }
    if ((bytes[typeOffset] & 0x20) === 0 && !knownCriticalChunks.has(type)) {
      return false;
    }

    if (!seenHeader && type !== "IHDR") return false;
    if (type === "IHDR") {
      if (seenHeader || dataLength !== 13) return false;
      width = view.getUint32(dataOffset);
      height = view.getUint32(dataOffset + 4);
      bitDepth = bytes[dataOffset + 8];
      colorType = bytes[dataOffset + 9];
      interlaceMethod = bytes[dataOffset + 12];
      if (
        !hasSafeImageDimensions(width, height) ||
        !validPngBitDepth(bitDepth, colorType) ||
        bytes[dataOffset + 10] !== 0 ||
        bytes[dataOffset + 11] !== 0 ||
        ![0, 1].includes(interlaceMethod)
      ) {
        return false;
      }
      seenHeader = true;
    } else if (type === "PLTE") {
      if (
        seenPalette ||
        seenImageData ||
        [0, 4].includes(colorType) ||
        dataLength === 0 ||
        dataLength > 768 ||
        dataLength % 3 !== 0
      ) {
        return false;
      }
      seenPalette = true;
    } else if (type === "IDAT") {
      if (imageDataEnded || dataLength === 0) return false;
      seenImageData = true;
      imageData.push(bytes.subarray(dataOffset, crcOffset));
    } else if (seenImageData && type !== "IEND") {
      imageDataEnded = true;
    }

    offset = crcOffset + 4;
    if (type === "IEND") {
      if (
        dataLength !== 0 ||
        !seenImageData ||
        (colorType === 3 && !seenPalette) ||
        offset !== bytes.length
      ) {
        return false;
      }
      return hasValidPngImageData({
        bitDepth,
        colorType,
        height,
        imageData,
        interlaceMethod,
        width,
      });
    }
  }

  return false;
}

function isStartOfFrame(marker: number): boolean {
  return [
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ].includes(marker);
}

function parseJpegQuantizationTables(
  bytes: Uint8Array,
  start: number,
  end: number,
  tables: Set<number>,
): boolean {
  let offset = start;
  while (offset < end) {
    const tableInfo = bytes[offset];
    const precision = tableInfo >>> 4;
    const tableId = tableInfo & 0x0f;
    if (precision > 1 || tableId > 3) return false;
    offset += 1 + 64 * (precision + 1);
    if (offset > end) return false;
    tables.add(tableId);
  }
  return offset === end;
}

function isValidJpegHuffmanTables(
  bytes: Uint8Array,
  start: number,
  end: number,
): boolean {
  let offset = start;
  while (offset < end) {
    if (end - offset < 17) return false;
    const tableInfo = bytes[offset];
    if ((tableInfo >>> 4) > 1 || (tableInfo & 0x0f) > 3) return false;
    let values = 0;
    let availableCodes = 1;
    for (let index = 1; index <= 16; index += 1) {
      const codesAtLength = bytes[offset + index];
      values += codesAtLength;
      availableCodes = availableCodes * 2 - codesAtLength;
      if (availableCodes < 0) return false;
    }
    if (values === 0 || values > 256) return false;
    offset += 17 + values;
    if (offset > end) return false;
  }
  return offset === end;
}

function isStructurallyValidJpeg(bytes: Uint8Array): boolean {
  if (!hasPrefix(bytes, [0xff, 0xd8]) || bytes.length < 4) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const quantizationTables = new Set<number>();
  const frameComponents = new Map<number, number>();
  let offset = 2;
  let markerCount = 0;
  let seenFrame = false;
  let seenScan = false;

  while (offset < bytes.length && markerCount < maximumContainerBoxes) {
    markerCount += 1;
    if (bytes[offset] !== 0xff) return false;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return false;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9) {
      return seenFrame && seenScan && offset === bytes.length;
    }
    if (
      marker === 0x00 ||
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      return false;
    }
    if (bytes.length - offset < 2) return false;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || segmentLength > bytes.length - offset) return false;
    const dataStart = offset + 2;
    const dataEnd = offset + segmentLength;

    if (marker === 0xdb) {
      if (!parseJpegQuantizationTables(bytes, dataStart, dataEnd, quantizationTables)) {
        return false;
      }
    } else if (marker === 0xc4) {
      if (!isValidJpegHuffmanTables(bytes, dataStart, dataEnd)) return false;
    } else if (marker === 0xdd) {
      if (segmentLength !== 4) return false;
    } else if (isStartOfFrame(marker)) {
      if (seenFrame || segmentLength < 11) return false;
      const precision = bytes[dataStart];
      const height = view.getUint16(dataStart + 1);
      const width = view.getUint16(dataStart + 3);
      const componentCount = bytes[dataStart + 5];
      if (
        ![8, 12].includes(precision) ||
        !hasSafeImageDimensions(width, height) ||
        componentCount < 1 ||
        componentCount > 4 ||
        segmentLength !== 8 + componentCount * 3
      ) {
        return false;
      }
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = dataStart + 6 + index * 3;
        const componentId = bytes[componentOffset];
        const sampling = bytes[componentOffset + 1];
        const quantizationTable = bytes[componentOffset + 2];
        if (
          frameComponents.has(componentId) ||
          (sampling >>> 4) === 0 ||
          (sampling & 0x0f) === 0 ||
          quantizationTable > 3
        ) {
          return false;
        }
        frameComponents.set(componentId, quantizationTable);
      }
      seenFrame = true;
    } else if (marker === 0xda) {
      if (!seenFrame || segmentLength < 8) return false;
      const scanComponentCount = bytes[dataStart];
      if (
        scanComponentCount < 1 ||
        scanComponentCount > frameComponents.size ||
        segmentLength !== 6 + scanComponentCount * 2
      ) {
        return false;
      }
      const scanComponents = new Set<number>();
      for (let index = 0; index < scanComponentCount; index += 1) {
        const componentOffset = dataStart + 1 + index * 2;
        const componentId = bytes[componentOffset];
        const tableSelectors = bytes[componentOffset + 1];
        if (
          !frameComponents.has(componentId) ||
          scanComponents.has(componentId) ||
          (tableSelectors >>> 4) > 3 ||
          (tableSelectors & 0x0f) > 3
        ) {
          return false;
        }
        scanComponents.add(componentId);
      }
      if (
        [...frameComponents.values()].some(
          (tableId) => !quantizationTables.has(tableId),
        )
      ) {
        return false;
      }
      seenScan = true;
      offset = dataEnd;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const markerStart = offset;
        while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
        if (offset >= bytes.length) return false;
        const entropyMarker = bytes[offset];
        if (entropyMarker === 0x00 || (entropyMarker >= 0xd0 && entropyMarker <= 0xd7)) {
          offset += 1;
          continue;
        }
        offset = markerStart;
        break;
      }
      continue;
    }

    offset = dataEnd;
  }

  return false;
}

type IsoBox = {
  dataEnd: number;
  dataStart: number;
  end: number;
  type: string;
};

function readIsoBox(
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  containerEnd: number,
): IsoBox | null {
  if (containerEnd - offset < 8) return null;
  let headerLength = 8;
  let size = view.getUint32(offset);
  const type = ascii(bytes, offset + 4, 4);
  if (!/^[\x20-\x7e]{4}$/.test(type)) return null;

  if (size === 1) {
    if (containerEnd - offset < 16) return null;
    const high = view.getUint32(offset + 8);
    const low = view.getUint32(offset + 12);
    if (high !== 0) return null;
    size = low;
    headerLength = 16;
  } else if (size === 0) {
    size = containerEnd - offset;
  }
  if (size < headerLength || size > containerEnd - offset) return null;

  return {
    dataEnd: offset + size,
    dataStart: offset + headerLength,
    end: offset + size,
    type,
  };
}

function parseHeicPropertyContainer(
  bytes: Uint8Array,
  view: DataView,
  start: number,
  end: number,
): { hasCodecConfiguration: boolean; hasDimensions: boolean } | null {
  let offset = start;
  let boxCount = 0;
  let hasCodecConfiguration = false;
  let hasDimensions = false;

  while (offset < end && boxCount < maximumContainerBoxes) {
    boxCount += 1;
    const box = readIsoBox(bytes, view, offset, end);
    if (!box) return null;
    if (box.type === "hvcC") {
      if (box.dataEnd - box.dataStart < 23 || bytes[box.dataStart] !== 1) return null;
      hasCodecConfiguration = true;
    } else if (box.type === "ispe") {
      if (box.dataEnd - box.dataStart !== 12) return null;
      const width = view.getUint32(box.dataStart + 4);
      const height = view.getUint32(box.dataStart + 8);
      if (!hasSafeImageDimensions(width, height)) return null;
      hasDimensions = true;
    }
    offset = box.end;
  }

  return offset === end
    ? { hasCodecConfiguration, hasDimensions }
    : null;
}

function isStructurallyValidHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let boxCount = 0;
  let seenFileType = false;
  let seenMetadata = false;
  let seenMediaData = false;

  while (offset < bytes.length && boxCount < maximumContainerBoxes) {
    boxCount += 1;
    const box = readIsoBox(bytes, view, offset, bytes.length);
    if (!box) return false;
    if (!seenFileType && box.type !== "ftyp") return false;

    if (box.type === "ftyp") {
      if (seenFileType || box.dataEnd - box.dataStart < 8 ||
        (box.dataEnd - box.dataStart) % 4 !== 0) {
        return false;
      }
      const brands = new Set<string>();
      brands.add(ascii(bytes, box.dataStart, 4));
      for (let brandOffset = box.dataStart + 8; brandOffset < box.dataEnd; brandOffset += 4) {
        brands.add(ascii(bytes, brandOffset, 4));
      }
      if (![...brands].some((brand) => heicBrands.has(brand))) return false;
      seenFileType = true;
    } else if (box.type === "meta") {
      if (seenMetadata || box.dataEnd - box.dataStart < 4) return false;
      let childOffset = box.dataStart + 4;
      let childCount = 0;
      const childTypes = new Set<string>();
      let hasImageProperties = false;
      let hasInlineData = false;
      let pictHandler = false;

      while (childOffset < box.dataEnd && childCount < maximumContainerBoxes) {
        childCount += 1;
        const child = readIsoBox(bytes, view, childOffset, box.dataEnd);
        if (!child) return false;
        childTypes.add(child.type);
        if (child.type === "hdlr") {
          if (child.dataEnd - child.dataStart < 12) return false;
          pictHandler = ascii(bytes, child.dataStart + 8, 4) === "pict";
        } else if (child.type === "iprp") {
          let propertyOffset = child.dataStart;
          let propertyCount = 0;
          let hasAssociations = false;
          let propertyResult: ReturnType<typeof parseHeicPropertyContainer> = null;
          while (propertyOffset < child.dataEnd && propertyCount < maximumContainerBoxes) {
            propertyCount += 1;
            const property = readIsoBox(bytes, view, propertyOffset, child.dataEnd);
            if (!property) return false;
            if (property.type === "ipco") {
              propertyResult = parseHeicPropertyContainer(
                bytes,
                view,
                property.dataStart,
                property.dataEnd,
              );
              if (!propertyResult) return false;
            } else if (property.type === "ipma") {
              hasAssociations = property.dataEnd > property.dataStart + 4;
            }
            propertyOffset = property.end;
          }
          if (propertyOffset !== child.dataEnd) return false;
          hasImageProperties = Boolean(
            hasAssociations &&
            propertyResult?.hasCodecConfiguration &&
            propertyResult.hasDimensions,
          );
        } else if (child.type === "idat") {
          hasInlineData = child.dataEnd > child.dataStart;
        }
        childOffset = child.end;
      }
      if (
        childOffset !== box.dataEnd ||
        !pictHandler ||
        !hasImageProperties ||
        !["pitm", "iloc", "iinf", "iprp"].every((type) => childTypes.has(type))
      ) {
        return false;
      }
      seenMetadata = true;
      seenMediaData ||= hasInlineData;
    } else if (box.type === "mdat") {
      if (box.dataEnd === box.dataStart) return false;
      seenMediaData = true;
    }

    offset = box.end;
  }

  return offset === bytes.length && seenFileType && seenMetadata && seenMediaData;
}

export async function validateEvidenceFileStructure(input: {
  bytes: Uint8Array;
  filename: string;
}): Promise<boolean> {
  switch (evidenceFileExtension(input.filename)) {
    case "pdf":
      return isStructurallyValidPdf(input.bytes);
    case "jpg":
    case "jpeg":
      return isStructurallyValidJpeg(input.bytes);
    case "png":
      return isStructurallyValidPng(input.bytes);
    case "heic":
      return isStructurallyValidHeic(input.bytes);
    case "txt":
    case "eml":
      return true;
    default:
      return false;
  }
}
