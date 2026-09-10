"use client";

import { useEffect, useState } from "react";

interface Config {
  configured: boolean;
  provider?: string;
  model?: string;
  maxToolTurns?: number;
  webSearch?: string;
  error?: string;
}

/** Surfaces provider/model config up front, so a missing key isn't discovered mid-generation. */
export default function ConfigBanner() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  if (!config) return null;

  if (!config.configured) {
    return (
      <div className="notice warn" style={{ marginBottom: 20 }}>
        <strong>No LLM provider configured.</strong> {config.error} Copy <code>.env.example</code> to{" "}
        <code>.env</code> and set a key, then restart.
      </div>
    );
  }

  return (
    <div className="notice" style={{ marginBottom: 20 }}>
      Generating with <strong>{config.provider}</strong> / <strong>{config.model}</strong> · up to{" "}
      {config.maxToolTurns} tool turns per generation · topic search via{" "}
      <strong>{config.webSearch}</strong>
    </div>
  );
}
