export const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PHOTO_PIXELS = 24_000_000;
const MAX_PHOTO_SIDE = 12_000;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type PreparedProfilePhoto = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};
export type CropPosition = {
  zoom: number;
  horizontal: number;
  vertical: number;
};

function imageDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (bytes.length >= 24 && text(1, 3) === "PNG" && text(12, 4) === "IHDR")
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      )
        return {
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      offset += length;
    }
  }
  if (bytes.length >= 30 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
    if (text(12, 4) === "VP8X")
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    if (
      text(12, 4) === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 1 &&
      bytes[25] === 0x2a
    )
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (text(12, 4) === "VP8L" && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }
  throw new Error(
    "This photo couldn’t be read. Choose another JPEG, PNG, or WebP.",
  );
}

function checkDimensions(width: number, height: number) {
  if (
    !width ||
    !height ||
    width > MAX_PHOTO_SIDE ||
    height > MAX_PHOTO_SIDE ||
    width * height > MAX_PHOTO_PIXELS
  )
    throw new Error(
      "Choose a photo below 24 megapixels and 12,000 pixels per side.",
    );
}

export async function prepareProfilePhoto(
  file: File,
): Promise<PreparedProfilePhoto> {
  if (!allowedTypes.has(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  if (!file.size || file.size > MAX_PROFILE_PHOTO_BYTES)
    throw new Error("Choose a photo up to 10 MB that is not empty.");
  const dimensions = imageDimensions(new Uint8Array(await file.arrayBuffer()));
  checkDimensions(dimensions.width, dimensions.height);
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      throw new Error("This photo couldn’t be opened. Try another image.");
    }
    try {
      checkDimensions(bitmap.width, bitmap.height);
    } catch (error) {
      bitmap.close();
      throw error;
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      dispose: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("This photo couldn’t be opened. Try another image."));
      image.src = url;
    });
    checkDimensions(image.naturalWidth, image.naturalHeight);
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export function profileCrop(
  width: number,
  height: number,
  position: CropPosition,
) {
  const zoom = Math.min(3, Math.max(1, position.zoom));
  const side = Math.min(width, height) / zoom;
  const horizontal = Math.min(100, Math.max(-100, position.horizontal));
  const vertical = Math.min(100, Math.max(-100, position.vertical));
  return {
    x: ((width - side) * (horizontal + 100)) / 200,
    y: ((height - side) * (vertical + 100)) / 200,
    side,
  };
}

export function drawProfileCrop(
  canvas: HTMLCanvasElement,
  photo: PreparedProfilePhoto,
  position: CropPosition,
) {
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Photo editing isn’t available in this browser.");
  const crop = profileCrop(photo.width, photo.height, position);
  context.fillStyle = "#131315";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    photo.source,
    crop.x,
    crop.y,
    crop.side,
    crop.side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

export async function exportProfileCrop(
  photo: PreparedProfilePhoto,
  position: CropPosition,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  drawProfileCrop(canvas, photo, position);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else
          reject(
            new Error("This photo couldn’t be prepared. Try another image."),
          );
      },
      "image/jpeg",
      0.9,
    ),
  );
}
