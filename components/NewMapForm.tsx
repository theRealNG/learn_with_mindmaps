"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Tab = "codebase" | "document" | "topic";
type DocMode = "text" | "url" | "file";

export default function NewMapForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("codebase");
  const [docMode, setDocMode] = useState<DocMode>("text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ref, setRef] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [seedNotes, setSeedNotes] = useState("");
  const [referenceLinks, setReferenceLinks] = useState("");
  const [title, setTitle] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let response: Response;
      if (tab === "document" && docMode === "file") {
        if (!file) throw new Error("Choose a file first.");
        const form = new FormData();
        form.append("file", file);
        if (title.trim()) form.append("title", title.trim());
        response = await fetch("/api/maps", { method: "POST", body: form });
      } else {
        const body: Record<string, string> = { sourceType: tab, title: title.trim() };
        if (tab === "codebase") body.ref = ref;
        if (tab === "document") {
          if (docMode === "url") body.url = url;
          else body.text = text;
        }
        if (tab === "topic") {
          body.topic = topic;
          body.seedNotes = seedNotes;
          body.referenceLinks = referenceLinks;
        }
        response = await fetch("/api/maps", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      const data = (await response.json()) as { map?: { id: string }; error?: string };
      if (!response.ok || !data.map) throw new Error(data.error || "Could not create the map.");
      router.push(`/maps/${data.map.id}`);
    } catch (caught) {
      setError((caught as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <div className="tabs">
        {(["codebase", "document", "topic"] as Tab[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            data-active={tab === candidate}
            onClick={() => {
              setTab(candidate);
              setError(null);
            }}
          >
            {candidate[0].toUpperCase() + candidate.slice(1)}
          </button>
        ))}
      </div>

      {tab === "codebase" && (
        <div className="field">
          <label htmlFor="ref">Local path or git URL</label>
          <input
            id="ref"
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            placeholder="/Users/you/code/project  ·  https://github.com/owner/repo"
          />
          <div className="hint">
            A git URL is cloned into a local cache the first time it&apos;s used, and reused after that.
          </div>
        </div>
      )}

      {tab === "document" && (
        <>
          <div className="tabs" style={{ borderBottom: "none", marginBottom: 10 }}>
            {(["text", "url", "file"] as DocMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                data-active={docMode === mode}
                onClick={() => setDocMode(mode)}
              >
                {mode === "text" ? "Paste text" : mode === "url" ? "URL" : "Upload"}
              </button>
            ))}
          </div>
          {docMode === "text" && (
            <div className="field">
              <label htmlFor="text">Document text</label>
              <textarea
                id="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste an article, paper, or any long text…"
                style={{ minHeight: 150 }}
              />
            </div>
          )}
          {docMode === "url" && (
            <div className="field">
              <label htmlFor="url">Article URL</label>
              <input
                id="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/article"
              />
              <div className="hint">The page is fetched and its article text extracted.</div>
            </div>
          )}
          {docMode === "file" && (
            <div className="field">
              <label htmlFor="file">File (.md, .txt, .pdf)</label>
              <input
                id="file"
                type="file"
                accept=".md,.markdown,.txt,.rst,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </>
      )}

      {tab === "topic" && (
        <>
          <div className="field">
            <label htmlFor="topic">Topic</label>
            <input
              id="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Git internals"
            />
          </div>
          <div className="field">
            <label htmlFor="seed">Scoping notes (optional)</label>
            <input
              id="seed"
              value={seedNotes}
              onChange={(event) => setSeedNotes(event.target.value)}
              placeholder="Focus on the object model, skip day-to-day CLI usage"
            />
          </div>
          <div className="field">
            <label htmlFor="links">Reference links (optional)</label>
            <input
              id="links"
              value={referenceLinks}
              onChange={(event) => setReferenceLinks(event.target.value)}
              placeholder="https://… , https://…"
            />
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="title">Map title (optional)</label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Defaults to the source's own name"
        />
      </div>

      {error && <p className="error">{error}</p>}

      <button className="primary" type="submit" disabled={busy}>
        {busy && <span className="spinner" />}
        {busy ? "Creating…" : "Create map"}
      </button>
    </form>
  );
}
