// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaUpload } from "../../src/features/journal/use-media-upload";

class UploadRequest {
  static instances: UploadRequest[] = [];
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void; onerror?: () => void; ontimeout?: () => void;
  status = 0; responseText = ""; timeout = 0;
  open = vi.fn(); setRequestHeader = vi.fn(); send = vi.fn(); abort = vi.fn();
  constructor() { UploadRequest.instances.push(this); }
  complete(id: string) { this.status = 200; this.responseText = JSON.stringify({ id }); this.onload?.(); }
}
const revoke = vi.fn();
beforeEach(() => {
  UploadRequest.instances = []; revoke.mockClear();
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: revoke });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("journal upload recovery", () => {
  it("ignores a late response from an image that was replaced", () => {
    const { result } = renderHook(() => useMediaUpload());
    act(() => result.current.upload(new File(["first"], "first.jpg", { type: "image/jpeg" })));
    const first = UploadRequest.instances[0];
    act(() => result.current.upload(new File(["second"], "second.png", { type: "image/png" })));
    expect(first.abort).toHaveBeenCalled();
    act(() => first.complete("stale-media"));
    expect(result.current.mediaId).toBeNull();
    act(() => UploadRequest.instances[1].complete("current-media"));
    expect(result.current.mediaId).toBe("current-media");
  });
  it("retries the same chosen file after a network error", () => {
    const file = new File(["photo"], "photo.webp", { type: "image/webp" });
    const { result } = renderHook(() => useMediaUpload());
    act(() => result.current.upload(file));
    act(() => UploadRequest.instances[0].onerror?.());
    expect(result.current.status).toBe("failed");
    expect(result.current.file).toBe(file);
    act(() => result.current.retry());
    expect(UploadRequest.instances[1].send).toHaveBeenCalledWith(file);
    act(() => UploadRequest.instances[1].complete("saved"));
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("ready");
  });
  it("cancels an upload and releases its local preview when leaving", () => {
    const { result, unmount } = renderHook(() => useMediaUpload());
    act(() => result.current.upload(new File(["photo"], "photo.jpg", { type: "image/jpeg" })));
    unmount();
    expect(UploadRequest.instances[0].abort).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:preview");
  });
  it("rejects unsupported images before making a request", () => {
    const { result } = renderHook(() => useMediaUpload());
    act(() => result.current.upload(new File(["gif"], "photo.gif", { type: "image/gif" })));
    expect(UploadRequest.instances).toHaveLength(0);
    expect(result.current.error).toMatch(/JPEG, PNG, or WebP/);
  });
});
