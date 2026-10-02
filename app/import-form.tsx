"use client";

import { useState } from "react";
import { ArrowRight, Download, Upload, X } from "lucide-react";

type Preview = {
  total: number;
  ready: number;
  issues: Array<{ row: number; name: string; reason: string }>;
  preview: Array<{ row: number; name: string; industry: string; city: string }>;
};

export default function ImportForm({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceNote, setSourceNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(mode: "preview" | "commit") {
    if (!file) {
      setError("Choose a CSV file first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("mode", mode);
      form.set("sourceNote", sourceNote);
      const response = await fetch("/api/imports/csv", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Import failed");
      if (mode === "preview") setPreview(result as Preview);
      else onImported(result.imported as number);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Import leads from CSV"
      >
        <div className="drawer-head">
          <span>REVIEWED IMPORT</span>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <h2>Import leads from CSV</h2>
        <p>
          Preview every row and resolve duplicates before anything is saved.
        </p>
        <a className="template-link" href="/lead-import-template.csv" download>
          <Download size={16} /> Download column template
        </a>
        <label>
          CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </label>
        <label>
          Source and permission note
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={sourceNote}
            onChange={(event) => {
              setSourceNote(event.target.value);
              setPreview(null);
            }}
            placeholder="Where this list came from and why Aayatra may use it"
          />
        </label>
        <p className="field-help">
          Up to 500 rows and 2 MB. Required columns: name, industry. Contacts
          stay unreviewed for outreach.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button secondary wide"
          disabled={busy || !file || sourceNote.trim().length < 5}
          onClick={() => void send("preview")}
        >
          <Upload size={16} /> {busy ? "Checking…" : "Preview import"}
        </button>
        {preview && (
          <div className="import-preview">
            <h3>Preview</h3>
            <div className="import-counts">
              <span>
                <strong>{preview.ready}</strong> ready
              </span>
              <span>
                <strong>{preview.issues.length}</strong> issues
              </span>
              <span>
                <strong>{preview.total}</strong> total
              </span>
            </div>
            {preview.issues.length ? (
              <div className="import-issues">
                {preview.issues.slice(0, 20).map((issue) => (
                  <p key={issue.row}>
                    <strong>
                      Row {issue.row}
                      {issue.name && ` · ${issue.name}`}
                    </strong>
                    <span>{issue.reason}</span>
                  </p>
                ))}
              </div>
            ) : (
              <div className="import-ready">
                <strong>All rows are ready.</strong>
                <p>
                  The import will save them together with a batch record and
                  source note.
                </p>
              </div>
            )}
            {preview.issues.length === 0 && preview.ready > 0 && (
              <button
                className="button primary wide"
                disabled={busy}
                onClick={() => void send("commit")}
              >
                Import {preview.ready} leads <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
