// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceRecorder } from "../../src/features/journal/voice-recorder";
import type { MediaUpload } from "../../src/features/journal/use-media-upload";

class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported() { return true; }
  state = "inactive"; mimeType = "audio/webm";
  onstop: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.onstop?.(); }
  constructor() { Recorder.instances.push(this); }
}
const stopTrack = vi.fn();
const upload = vi.fn();
const media: MediaUpload = { file: null, previewUrl: null, mediaId: null, status: "idle", progress: 0, error: null, upload, retry: vi.fn(), clear: vi.fn() };
beforeEach(() => {
  Recorder.instances = []; stopTrack.mockClear(); upload.mockClear();
  vi.stubGlobal("MediaRecorder", Recorder);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("voice recording cleanup", () => {
  it("stops the microphone and discards an unfinished recording when leaving", async () => {
    const user = userEvent.setup(); const view = render(<VoiceRecorder upload={media} />);
    await user.click(screen.getByRole("button", { name: "Record a voice note" }));
    await waitFor(() => expect(Recorder.instances).toHaveLength(1));
    view.unmount();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(upload).not.toHaveBeenCalled();
  });
  it("does not upload a partial recording after a recorder failure", async () => {
    const user = userEvent.setup(); render(<VoiceRecorder upload={media} />);
    await user.click(screen.getByRole("button", { name: "Record a voice note" }));
    await waitFor(() => expect(Recorder.instances).toHaveLength(1));
    act(() => {
      Recorder.instances[0].ondataavailable?.({ data: new Blob(["partial"]) });
      Recorder.instances[0].onerror?.();
      Recorder.instances[0].stop();
    });
    expect(upload).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledOnce();
  });
});
