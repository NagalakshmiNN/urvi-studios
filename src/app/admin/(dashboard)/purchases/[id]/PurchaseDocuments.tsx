"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateDocumentAction,
  deleteDocumentAction,
  restoreDocumentAction,
  type DocumentFormState,
} from "@/app/actions/purchases";
import { DOCUMENT_KINDS, canPreview, humanSize, MAX_BYTES, checkUpload } from "@/lib/purchase-documents";

export type DocumentRow = {
  id: string;
  kind: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  notes: string | null;
  uploadedAt: string;
  deletedAt: string | null;
  deletedReason: string | null;
};

function readableDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The paperwork behind one purchase.
 *
 * Upload goes through a route rather than a server action: a photographed
 * invoice is larger than an action's body allows, and the failure when it is
 * exceeded says nothing useful. Everything else is an action.
 */
export default function PurchaseDocuments({
  purchaseId,
  documents,
}: {
  purchaseId: string;
  documents: DocumentRow[];
}) {
  const router = useRouter();
  const live = documents.filter((d) => !d.deletedAt);
  const removed = documents.filter((d) => d.deletedAt);

  return (
    <>
      <div className="admin-card" style={{ marginBottom: 28 }}>
        <h3 style={{ marginBottom: 6 }}>
          Paperwork
          {live.length > 0 && <span style={{ color: "var(--sage)", fontWeight: 400, fontSize: 14 }}> · {live.length}</span>}
        </h3>
        <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "0 0 18px", lineHeight: 1.7 }}>
          The invoice these figures were read from, and anything else that belongs with it. Only someone logged into
          the admin can open these — a vendor invoice shows what you pay for stock.
        </p>

        {live.length === 0 ? (
          <p style={{ fontSize: 13.5, color: "var(--sage)", marginBottom: 20 }}>Nothing filed against this purchase yet.</p>
        ) : (
          <div className="table-scroll" style={{ marginBottom: 20 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>What it is</th>
                  <th style={{ textAlign: "right" }}>Size</th>
                  <th>Filed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {live.map((doc) => (
                  <DocumentLine key={doc.id} doc={doc} onChanged={() => router.refresh()} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <UploadForm purchaseId={purchaseId} onUploaded={() => router.refresh()} />
      </div>

      {removed.length > 0 && (
        <div className="admin-card" style={{ marginBottom: 28 }}>
          <h3 style={{ marginBottom: 6 }}>Removed paperwork</h3>
          <p style={{ fontSize: 12.5, color: "var(--sage)", margin: "0 0 18px", lineHeight: 1.7 }}>
            Removed, not destroyed. Nothing here can be opened until it is brought back — which is what makes removing
            something safe.
          </p>
          <div className="table-scroll">
            <table className="admin-table">
              <tbody>
                {removed.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <span style={{ textDecoration: "line-through", color: "var(--sage)" }}>{doc.filename}</span>
                      {doc.deletedReason && (
                        <div style={{ fontSize: 12, color: "var(--sage)" }}>{doc.deletedReason}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--sage)", whiteSpace: "nowrap" }}>
                      removed {readableDate(doc.deletedAt!)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <RestoreButton documentId={doc.id} onChanged={() => router.refresh()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function DocumentLine({ doc, onChanged }: { doc: DocumentRow; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [state, save, saving] = useActionState<DocumentFormState, FormData>(async (prev, formData) => {
    const result = await updateDocumentAction(prev, formData);
    if (result?.success) {
      setEditing(false);
      onChanged();
    }
    return result;
  }, undefined);

  if (editing) {
    return (
      <tr>
        <td colSpan={5}>
          <form action={save} className="admin-form-card" style={{ margin: "8px 0" }}>
            <input type="hidden" name="documentId" value={doc.id} />
            <div className="form-group">
              <label htmlFor={`name-${doc.id}`}>Name</label>
              <input id={`name-${doc.id}`} name="filename" defaultValue={doc.filename} required />
              <span className="field-hint">The file extension is kept whatever you type here.</span>
            </div>
            <div className="form-group">
              <label htmlFor={`kind-${doc.id}`}>What it is</label>
              <select id={`kind-${doc.id}`} name="kind" defaultValue={doc.kind}>
                {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor={`notes-${doc.id}`}>Note</label>
              <input id={`notes-${doc.id}`} name="notes" defaultValue={doc.notes ?? ""} placeholder="Optional" />
            </div>
            {state?.error && <div className="form-error">{state.error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <a href={`/api/admin/purchase-documents/${doc.id}`} target="_blank" rel="noopener noreferrer">{doc.filename}</a>
        {doc.notes && <div style={{ fontSize: 12, color: "var(--sage)" }}>{doc.notes}</div>}
        {!canPreview(doc.contentType) && (
          <div style={{ fontSize: 11.5, color: "var(--sage)" }}>Downloads rather than opening — browsers can&apos;t show this type.</div>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>{doc.kind}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{humanSize(doc.sizeBytes)}</td>
      <td style={{ whiteSpace: "nowrap", color: "var(--sage)" }}>{readableDate(doc.uploadedAt)}</td>
      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
        <a href={`/api/admin/purchase-documents/${doc.id}?download=1`} className="link-btn">Download</a>{" "}
        <button type="button" className="link-btn" onClick={() => setEditing(true)}>Edit</button>{" "}
        <DeleteButton doc={doc} onChanged={onChanged} />
      </td>
    </tr>
  );
}

function DeleteButton({ doc, onChanged }: { doc: DocumentRow; onChanged: () => void }) {
  const [state, remove, pending] = useActionState<DocumentFormState, FormData>(async (prev, formData) => {
    const result = await deleteDocumentAction(prev, formData);
    if (result?.success) onChanged();
    return result;
  }, undefined);

  return (
    <form
      action={remove}
      style={{ display: "inline" }}
      onSubmit={(e) => {
        const reason = prompt(`Remove ${doc.filename}? It can be brought back afterwards.\n\nWhy is it going? (optional)`);
        if (reason === null) {
          e.preventDefault();
          return;
        }
        (e.currentTarget.elements.namedItem("reason") as HTMLInputElement).value = reason;
      }}
    >
      <input type="hidden" name="documentId" value={doc.id} />
      <input type="hidden" name="reason" defaultValue="" />
      <button type="submit" className="link-btn" disabled={pending}>{pending ? "Removing…" : "Remove"}</button>
      {state?.error && <div className="form-error">{state.error}</div>}
    </form>
  );
}

function RestoreButton({ documentId, onChanged }: { documentId: string; onChanged: () => void }) {
  const [state, restore, pending] = useActionState<DocumentFormState, FormData>(async (prev, formData) => {
    const result = await restoreDocumentAction(prev, formData);
    if (result?.success) onChanged();
    return result;
  }, undefined);

  return (
    <form action={restore} style={{ display: "inline" }}>
      <input type="hidden" name="documentId" value={documentId} />
      <button type="submit" className="btn btn-outline" disabled={pending}>{pending ? "Bringing back…" : "Bring back"}</button>
      {state?.error && <div className="form-error">{state.error}</div>}
    </form>
  );
}

function UploadForm({ purchaseId, onUploaded }: { purchaseId: string; onUploaded: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("purchaseId", purchaseId);

    const files = data.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) {
      setError("Choose a file first.");
      return;
    }
    // Checked here as well as on the server, so an 11MB photo says so instantly
    // rather than after a minute of uploading on a phone connection.
    for (const file of files) {
      const problem = checkUpload({ name: file.name, type: file.type, size: file.size });
      if (problem) {
        setError(problem.message);
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/purchase-documents", { method: "POST", body: data });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "That didn't upload. Try again.");
        return;
      }
      form.reset();
      onUploaded();
    } catch {
      setError("That didn't upload — check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={upload} className="admin-form-card">
      <div className="form-group">
        <label htmlFor="files">Add paperwork</label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
        />
        <span className="field-hint">
          A PDF or a photo, up to {humanSize(MAX_BYTES)} each. Several at once is fine — an invoice and its transport
          bill usually arrive together.
        </span>
      </div>
      <div className="form-group">
        <label htmlFor="kind">What it is</label>
        <select id="kind" name="kind" defaultValue="Invoice">
          {DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="notes">Note</label>
        <input id="notes" name="notes" placeholder="Optional" />
      </div>
      {error && <div className="form-error">{error}</div>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
    </form>
  );
}
