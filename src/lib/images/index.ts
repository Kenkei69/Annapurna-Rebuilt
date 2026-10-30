import { ValidationError } from "../errors";

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ValidatedImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dimensions: ImageDimensions;
  sizeBytes: number;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_DIMENSION_PX = 10;
const MAX_DIMENSION_PX = 8192;

/**
 * Validates image buffer magic bytes, MIME type, size, and extracts pixel dimensions.
 */
export function validateImageBuffer(buffer: Buffer): ValidatedImage {
  if (!buffer || buffer.length === 0) {
    throw new ValidationError("Image buffer is empty.");
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ValidationError(
      `Image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed size of 5 MB.`
    );
  }

  // Detect MIME type and extract dimensions
  let mimeType: "image/jpeg" | "image/png" | "image/webp" | null = null;
  let dimensions: ImageDimensions | null = null;

  // 1. PNG check: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    mimeType = "image/png";
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    dimensions = { width, height };
  }

  // 2. JPEG check: FF D8 FF
  else if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    mimeType = "image/jpeg";
    dimensions = parseJpegDimensions(buffer);
  }

  // 3. WebP check: "RIFF" .... "WEBP"
  else if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    mimeType = "image/webp";
    dimensions = parseWebpDimensions(buffer);
  }

  if (!mimeType || !dimensions) {
    throw new ValidationError(
      "Unsupported image format. Only valid JPEG, PNG, or WebP images are permitted."
    );
  }

  if (
    dimensions.width < MIN_DIMENSION_PX ||
    dimensions.height < MIN_DIMENSION_PX ||
    dimensions.width > MAX_DIMENSION_PX ||
    dimensions.height > MAX_DIMENSION_PX
  ) {
    throw new ValidationError(
      `Image dimensions (${dimensions.width}x${dimensions.height}) outside acceptable bounds (${MIN_DIMENSION_PX}px - ${MAX_DIMENSION_PX}px).`
    );
  }

  return {
    mimeType,
    dimensions,
    sizeBytes: buffer.length,
  };
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions {
  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // Standalone markers without length
    if (
      marker === 0xd8 || // SOI
      marker === 0xd9 || // EOI
      marker === 0x00 ||
      (marker >= 0xd0 && marker <= 0xd7) // RST
    ) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;

    // Start of Frame markers (SOF0, SOF1, SOF2, etc.)
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 8 < buffer.length) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    offset += 2 + length;
  }

  throw new ValidationError("Invalid JPEG file structure: unable to extract dimensions.");
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions {
  const format = buffer.toString("ascii", 12, 16);

  if (format === "VP8 " && buffer.length >= 30) {
    // Lossy VP8
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
  } else if (format === "VP8L" && buffer.length >= 25) {
    // Lossless VP8L
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  } else if (format === "VP8X" && buffer.length >= 30) {
    // Extended VP8X
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  throw new ValidationError("Invalid WebP file structure: unable to extract dimensions.");
}
