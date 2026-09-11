import { useEffect, useState } from "react";
import { api } from "../api/client";

interface DocumentVersion {
  id: string;
  versionNo: number;
  fileName: string;
  mimeType?: string | null;
  uploadedAt: string;
  note?: string | null;
}

interface DocumentRecord {
  id: string;
  type: string;
  versions: DocumentVersion[];
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "pdf"; url: string }
  | { kind: "html"; html: string }
  | { kind: "unsupported"; message: string }
  | { kind: "none" };

async function downloadVersion(versionId: string, fileName: string) {
  const res = await api.getRaw(`/api/documents/versions/${versionId}/download`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentPreviewPanel({
  label,
  documentType,
  documents,
  personId,
  jobId,
  onChange,
  onFileSelected,
}: {
  label: string;
  documentType: "CANDIDATE_CV" | "JOB_SPEC";
  documents: DocumentRecord[];
  personId?: string;
  jobId?: string;
  onChange: () => void;
  // When provided, a chosen file is handed to the parent instead of being
  // uploaded directly — used for Candidate CVs, where picking a file starts
  // a parse-and-review step first (see CvReviewPanel) rather than uploading
  // blind. Leave unset (as Job Spec does) to keep the plain upload-on-choice
  // behavior below.
  onFileSelected?: (file: File) => void;
}) {
  const doc = documents.find((d) => d.type === documentType);
  const versions = [...(doc?.versions ?? [])].sort((a, b) => b.versionNo - a.versionNo);

  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(versions[0]?.id);
  const [preview, setPreview] = useState<PreviewState>({ kind: "none" });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Keep the selection valid as the version list changes underneath us
  // (e.g. after a fresh upload) — default to the newest version whenever
  // the currently-selected one no longer exists.
  useEffect(() => {
    if (!versions.some((v) => v.id === selectedVersionId)) {
      setSelectedVersionId(versions[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, versions.map((v) => v.id).join(",")]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    if (!selectedVersionId) {
      setPreview({ kind: "none" });
      return;
    }

    setPreview({ kind: "loading" });

    (async () => {
      const res = await api.getRaw(`/api/documents/versions/${selectedVersionId}/preview`);
      if (cancelled) return;

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setPreview({ kind: "unsupported", message: body.error ?? "Preview isn't available for this file." });
        return;
      }

      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setPreview({ kind: "pdf", url: objectUrl });
      } else if (contentType.includes("application/json")) {
        const { html } = await res.json();
        if (!cancelled) setPreview({ kind: "html", html });
      } else {
        setPreview({ kind: "unsupported", message: "Preview isn't available for this file." });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedVersionId]);

  async function onUpload(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setUploadError("Only PDF and Word (.docx) files are supported.");
      return;
    }
    if (onFileSelected) {
      onFileSelected(file);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      if (!doc) {
        formData.append("type", documentType);
        if (personId) formData.append("personId", personId);
        if (jobId) formData.append("jobId", jobId);
        const created = await api.post<DocumentRecord>("/api/documents", formData);
        onChange();
        setSelectedVersionId(created.versions[created.versions.length - 1]?.id ?? created.versions[0]?.id);
      } else {
        const version = await api.post<DocumentVersion>(`/api/documents/${doc.id}/versions`, formData);
        onChange();
        setSelectedVersionId(version.id);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files?.[0];
        if (dropped) onUpload(dropped);
      }}
      className={`rounded border bg-white p-4 transition-colors ${dragging ? "border-slate-900 bg-slate-50" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">{label}</h2>
        <label className="cursor-pointer rounded border px-2 py-1 text-xs hover:bg-slate-100">
          {doc ? "Upload new version" : `Upload ${label}`}
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </label>
      </div>

      {uploadError && <p className="mb-2 text-sm text-red-600">{uploadError}</p>}
      {uploading && <p className="mb-2 text-sm text-slate-500">Uploading...</p>}

      {!doc ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-slate-400">
          No {label.toLowerCase()} uploaded yet — drag one in, or use the button above.
        </p>
      ) : (
        <>
          <div className="mb-3 h-[600px] overflow-hidden rounded border bg-slate-50">
            {preview.kind === "loading" && <p className="p-4 text-sm text-slate-500">Loading preview...</p>}
            {preview.kind === "pdf" && (
              <iframe title={`${label} preview`} src={preview.url} className="h-full w-full" />
            )}
            {preview.kind === "html" && (
              <iframe
                title={`${label} preview`}
                sandbox=""
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>
                  body { font-family: system-ui, sans-serif; padding: 24px; line-height: 1.5; color: #1e293b; }
                  img { max-width: 100%; }
                </style></head><body>${preview.html}</body></html>`}
                className="h-full w-full bg-white"
              />
            )}
            {preview.kind === "unsupported" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-500">
                <p>{preview.message}</p>
                {selectedVersionId && versions.find((v) => v.id === selectedVersionId) && (
                  <button
                    onClick={() =>
                      downloadVersion(
                        selectedVersionId,
                        versions.find((v) => v.id === selectedVersionId)!.fileName
                      )
                    }
                    className="rounded border px-3 py-1.5 hover:bg-slate-100"
                  >
                    Download to view
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="mb-1 text-xs uppercase text-slate-500">Version history</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {versions.map((v) => (
              <li
                key={v.id}
                className={`flex items-center justify-between rounded border px-2 py-1 ${
                  v.id === selectedVersionId ? "border-slate-400 bg-slate-100" : ""
                }`}
              >
                <button onClick={() => setSelectedVersionId(v.id)} className="flex-1 text-left">
                  v{v.versionNo} — {new Date(v.uploadedAt).toLocaleDateString()}
                  {v.note ? ` — ${v.note}` : ""}
                  {v.versionNo === versions[0].versionNo ? (
                    <span className="ml-1 rounded bg-slate-200 px-1 text-xs">current</span>
                  ) : null}
                </button>
                <button
                  onClick={() => downloadVersion(v.id, v.fileName)}
                  className="ml-2 shrink-0 text-xs text-blue-600 hover:underline"
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
