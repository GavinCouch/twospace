type Photo = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
};

const MAX_BYTES = 10 * 1024 * 1024;
export function validatePhoto(photo: Photo) {
  if (photo.fileSize && photo.fileSize > MAX_BYTES)
    throw new Error("Choose a photo smaller than 10 MB.");
  if (
    !Number.isFinite(photo.width) ||
    !Number.isFinite(photo.height) ||
    photo.width <= 0 ||
    photo.height <= 0 ||
    photo.width * photo.height > 25_000_000
  )
    throw new Error("Choose a photo smaller than 25 megapixels.");
}

export async function preparePhoto(
  photo: Photo,
  encodeJpeg: (uri: string) => Promise<Photo>,
  readBlob: (uri: string) => Promise<Blob>,
  removeTemporary: (uri: string) => Promise<void>,
) {
  validatePhoto(photo);
  // iPhone originals can be HEIC even when ImagePicker's quality is set.
  const jpeg = await encodeJpeg(photo.uri);
  try {
    validatePhoto(jpeg);
    const blob = await readBlob(jpeg.uri);
    if (!blob.size || blob.size > MAX_BYTES)
      throw new Error("Choose a photo smaller than 10 MB.");
    return blob;
  } finally {
    await removeTemporary(jpeg.uri);
  }
}
