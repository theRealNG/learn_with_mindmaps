import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export interface ExtractedPage {
  title: string;
  text: string;
}

/** Readability-style HTML-to-text extraction, shared by URL Document ingestion and Topic page reads. */
export async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (!contentType.includes("html")) {
    return { title: url, text: body };
  }
  return extractFromHtml(body, url);
}

export function extractFromHtml(html: string, url: string): ExtractedPage {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  const title = article?.title?.trim() || dom.window.document.title || url;

  if (article?.content) {
    return { title, text: htmlToText(article.content, dom) };
  }
  const body = dom.window.document.body?.textContent || "";
  return { title, text: body.replace(/\n{3,}/g, "\n\n").trim() };
}

/** Keeps headings as markdown so the section splitter has structure to work with. */
function htmlToText(contentHtml: string, dom: JSDOM): string {
  const fragment = new dom.window.DOMParser().parseFromString(contentHtml, "text/html");
  const lines: string[] = [];

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      const headingMatch = /^h([1-6])$/.exec(tag);
      if (headingMatch) {
        const text = (child.textContent || "").trim();
        if (text) lines.push(`\n${"#".repeat(Number(headingMatch[1]))} ${text}\n`);
      } else if (["p", "li", "blockquote", "pre"].includes(tag)) {
        const text = (child.textContent || "").trim();
        if (text) lines.push(tag === "li" ? `- ${text}` : text);
      } else {
        walk(child);
      }
    }
  };

  const root = fragment.body;
  if (root) walk(root);
  const text = lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  return text || (fragment.body?.textContent || "").trim();
}
