// pdf-parse's package entry runs a debug harness on import; the lib path is the parser itself.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/** Extracts text from a PDF, inserting page breaks so the section splitter has boundaries. */
export async function pdfToText(buffer: Buffer): Promise<{ title: string; text: string }> {
  const parsed = await pdfParse(buffer);
  const title = (parsed.info?.Title as string | undefined)?.trim() || "";
  const text = parsed.text.replace(/\n{3,}/g, "\n\n").trim();
  return { title, text };
}
