import { afterEach, describe, expect, it, vi } from "vitest";
import { File } from "node:buffer";
import {
  prepareProfilePhoto,
  profileCrop,
} from "@/features/settings/profile-photo-image";

afterEach(() => vi.unstubAllGlobals());
function png(width: number, height: number) {
  const data = new Uint8Array(24);
  data.set([137, 80, 78, 71, 13, 10, 26, 10]);
  data.set([73, 72, 68, 82], 12);
  const view = new DataView(data.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new File([data], "photo.png", {
    type: "image/png",
  }) as unknown as globalThis.File;
}

describe("profile photo preparation", () => {
  it("keeps portrait and landscape crops inside the source at all control edges", () => {
    expect(
      profileCrop(1600, 900, { zoom: 1, horizontal: 0, vertical: 0 }),
    ).toEqual({ x: 350, y: 0, side: 900 });
    expect(
      profileCrop(900, 1600, { zoom: 2, horizontal: 100, vertical: 100 }),
    ).toEqual({ x: 450, y: 1150, side: 450 });
    expect(
      profileCrop(900, 1600, { zoom: 2, horizontal: -100, vertical: -100 }),
    ).toEqual({ x: 0, y: 0, side: 450 });
  });

  it("rejects oversized image dimensions before decoding pixels", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    await expect(prepareProfilePhoto(png(10000, 10000))).rejects.toThrow(
      "24 megapixels",
    );
    expect(decode).not.toHaveBeenCalled();
  });

  it("honors orientation and releases decoded bitmap memory", async () => {
    const close = vi.fn();
    const decode = vi
      .fn()
      .mockResolvedValue({ width: 800, height: 1200, close });
    vi.stubGlobal("createImageBitmap", decode);
    const file = png(1200, 800);
    const prepared = await prepareProfilePhoto(file);
    expect(decode).toHaveBeenCalledWith(file, {
      imageOrientation: "from-image",
    });
    expect(prepared).toMatchObject({ width: 800, height: 1200 });
    prepared.dispose();
    expect(close).toHaveBeenCalledOnce();
  });
});
