import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { api } from "./api";
import { preparePhoto, validatePhoto } from "./photo-upload";
export async function choosePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    selectionLimit: 1,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const picked = result.assets[0];
  const asset = {
    ...picked,
    fileSize: picked.fileSize ?? new File(picked.uri).size,
  };
  validatePhoto(asset);
  return asset;
}
export async function uploadPhoto(photo: ImagePicker.ImagePickerAsset) {
  const blob = await preparePhoto(
    { ...photo, fileSize: photo.fileSize ?? new File(photo.uri).size },
    async (uri) => {
      const context = ImageManipulator.manipulate(uri);
      try {
        const image = await context.renderAsync();
        try {
          const saved = await image.saveAsync({
            format: SaveFormat.JPEG,
            compress: 0.85,
          });
          return { ...saved, fileSize: new File(saved.uri).size };
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    },
    async (uri) => (await fetch(uri)).blob(),
    async (uri) => {
      const file = new File(uri);
      if (file.exists) await file.delete();
    },
  );
  const result = await api<{ id: string }>("/api/media", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  return result.id;
}
