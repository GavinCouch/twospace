import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
export async function choosePhoto() {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, selectionLimit: 1, allowsMultipleSelection: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) throw new Error("Choose a photo smaller than 10 MB.");
  if (asset.width * asset.height > 25_000_000) throw new Error("Choose a photo smaller than 25 megapixels.");
  return asset;
}
export async function uploadPhoto(photo: ImagePicker.ImagePickerAsset) {
  const blob = await (await fetch(photo.uri)).blob();
  if (blob.size > 10 * 1024 * 1024) throw new Error("Choose a photo smaller than 10 MB.");
  const result = await api<{ id: string }>("/api/media", { method: "POST", headers: { "Content-Type": photo.mimeType || blob.type || "image/jpeg" }, body: blob });
  return result.id;
}
