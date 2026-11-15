"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "@/components/space-provider";

type SavedFile = { id: string; name: string; url: string };

export function FileDownloads({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false);
  const files = useQuery({
    queryKey: ["export-files", spaceId],
    queryFn: async () =>
      (await api<{ files: SavedFile[] }>("/api/export")).files,
    enabled: open,
    staleTime: 0,
  });
  return (
    <div className="settings-file-downloads">
      <button
        className="secondary"
        type="button"
        aria-expanded={open}
        aria-controls="saved-file-downloads"
        onClick={() => setOpen(!open)}
      >
        <Download size={17} aria-hidden="true" />
        {open ? "Hide files" : "Download photos and audio"}
      </button>
      {open && (
        <div id="saved-file-downloads">
          {files.isPending ? (
            <p role="status">Loading files…</p>
          ) : files.error ? (
            <div>
              <p className="form-error" role="alert">
                {files.error.message}
              </p>
              <button className="quiet" onClick={() => void files.refetch()}>
                Try again
              </button>
            </div>
          ) : files.data?.length ? (
            <ul>
              {files.data.map((file) => (
                <li key={file.id}>
                  <a href={file.url} download={file.name}>
                    <Download size={15} aria-hidden="true" />
                    <span>{file.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved files to download.</p>
          )}
        </div>
      )}
    </div>
  );
}
