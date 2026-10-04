# Landscape of AI summarisers and mind-map tools

Research for [#22](https://github.com/theRealNG/learn_with_mindmaps/issues/22) (map [#20](https://github.com/theRealNG/learn_with_mindmaps/issues/20)). Glossary terms (**Slop**, **Map**, **Node**, **Link**, **Source**, **Document**) follow `CONTEXT.md` and the standing decisions on #20.

**Question.** Which existing products already turn Documents into summaries or mind maps, and where is the gap for our USP: clearing **Slop** and presenting a **Map** with provenance and labelled **Links**?

**Short answer.** "Document in, AI mind map out" is a commodity. So are page-level citations in AI chat and summaries. Every major mind-map vendor and NotebookLM already ships both. Labelled cross-branch relations and nodes that quote the source are claimed by one niche research tool (Atlas), and only for academic papers. **No product we found treats removing Slop from the input as its core transform, or shows a reader how much of a Document was Slop.** Anti-slop products are either writer-side rewriters (SlopTrim and similar) or search-result downrankers (Kagi SlopStop). The gap is the combination: a reader-side Slop-clearing step, a coverage promise, span-level provenance on every Node, and auto-generated labelled Links, aimed at knowledge workers triaging AI-written business documents.

## Method and caveats

- **Accessed 2026-10-04** for every source below.
- **Primary sources only:** vendors' own sites, help centres, docs, blogs and changelogs.
- **Caveat: pages were read through search-index excerpts, not fetched directly.** This session's egress proxy blocked direct HTTPS to every vendor domain (`connect_rejected`). Each claim comes from a web search restricted to the vendor's own domain (`allowed_domains`), and the linked URL is the vendor page the excerpt came from. Wording may lag the live page. Re-verify before quoting externally. Claims we could not pin down are marked *(unverified detail)*.
- **Atlas's claims come from Atlas's own comparison posts** ("Atlas vs X"), which are marketing self-descriptions.

## Comparison table

Legend: **Provenance** means a way to get from a generated item back to the source text. **Cross-links** means relations between items that are not parent and child.

| Product (category) | Input types | Output shape | Provenance to source | Cross-links | Long-doc handling | Anti-AI-slop positioning |
|---|---|---|---|---|---|---|
| **NotebookLM / Gemini Notebook** (Google; reading assistant + mind map) | PDFs, Google Docs/Slides, text/markdown, URLs, pasted text, YouTube, audio [1] | Chat answers, summaries; Mind Map = interactive **tree** ("branching diagram") [2]. Multiple maps per notebook [3] | Chat answers cite "direct quotes, text, and images from your sources" [4]. Map nodes **don't carry citations themselves**: clicking a node asks chat about it, and the chat answer is cited [2] | Marketing says maps show "connections across your sources" [1], but the help page describes a branching tree [2]. No labelled cross-links found | Up to 50 sources, up to 25M words in total [5] | None found |
| **Mapify** (Xmind team, formerly Chatmind; doc→mind-map) | PDF, Word, PowerPoint, Excel, text, CSV, YouTube, webpages, images, long text [6][7] | **Tree** mind map; detail level set to Concise/Medium/Detailed [7]. Deep Research gives a cited report plus a synced map [8] | "Clarify Source": open the original file and jump to the exact page; page-level file references in Chat [9]. Deep Research has numbered citations [8] | Its blog says you can link related topics, and that it auto-detects relationships [10] *(unverified detail: no doc on labels or automation)* | Size cap per file by plan: 10/50/100 MB; "no strict page limit" [11] | None found |
| **Xmind AI** (mind-map app) | Text, Word, PDF, Markdown, OPML, images, URLs, YouTube [12][13] | Hierarchical **tree** [12] | None found | **Manual** "Relationship" lines between any two topics, with editable labels [14]. Not AI-generated | Not stated | None found |
| **MindMeister / Meister AI** (mind-map app) | Prompt; PDF, presentation, spreadsheet, image; pasted text [15] | Branched **tree**, then AI edits (expand branch, shorten) [15] | None found | Not AI-generated (manual connections only; not verified) | Not stated | None found |
| **Whimsical AI** (diagram app) | Text prompt (Claude-powered) [16] | **Tree**; each click adds 5 nodes [16] | N/A (prompt only, no Document) | None | N/A | None found |
| **Miro AI** (whiteboard) | Prompt or pasted text; CSV [17] | **Tree** mind map on an open canvas, which can connect to other diagrams [17] | None found | Manual canvas connectors | Not stated | None found |
| **GitMind** (doc→mind-map) | PDF, DOC/DOCX, PPTX, XLSX, EPUB, TXT [18] | **Tree** mind map [18] | None found | None found | Credit-metered; no limits stated [18] | None found |
| **EdrawMind AI** (mind-map app) | Prompt, file (PDF, text, images, tables), webpage [19] | **Tree**; optional "Notes" attach longer article text to key nodes [20] | Indirect (notes hold source text). No span links found | None found | Not stated | None found |
| **Heptabase** (visual PKM) | PDFs, YouTube, .docx, text, images [21] | Cards on a whiteboard (**graph**); an AI action turns a card into a mindmap card [21]; chat over whiteboards [22] | Chat answers link to the cards/blocks they used [22]. PDF highlights become cards [23] | **Manual** arrows between cards [24] | Parses whole PDFs for AI [21] | None found |
| **Atlas** (research knowledge maps) | PDFs, articles, pasted content [25] | Knowledge Map = **graph** with hierarchy (breadcrumbs from thesis to paragraph) [26] | Node text "faithful-to-source (drawn from the paper) rather than generated"; cited claims link to passages [26][27] | **Labelled** relations, e.g. motivates, causes, enables, contradicts [26] | Across a whole collection of sources [25] | None found (positioning is faithfulness to research, not Slop) |
| **Recall** (save-and-summarise PKM) | YouTube, blogs, PDFs, articles [28] | Summary cards + knowledge **graph** with auto-links [28][29] | Not found at span level | **Auto-generated, unlabelled** links between cards; path finder [29][30] | Not stated | None found |
| **Kagi Universal Summarizer** (summariser) | Web pages, PDFs (incl. scanned), PPT, Word, audio, YouTube [31] | Prose summary or **bullets** ("takeaway" / Key Moments) [31] | None | None | "Unlimited token length"; 50k–200k-token docs [31][32] | Separate product, **SlopStop**, downranks AI-slop *domains* in search [33]. Not applied to summaries |
| **Adobe Acrobat AI Assistant** (reading assistant) | PDFs and other docs [34] | Summary with headings, **bullets**, chat [34] | Citations link to the source; metadata includes title, section, page [35]. Adobe notes "rarely may provide incorrect attributions" [36] | None | "Long documents" (no figure on the page we found) [34] | None found |
| **ChatPDF** (reading assistant) | PDF [37] | Chat, summaries (**bullets/prose**) [38] | Page refs `[P2]`; click a citation to scroll to the source [37][38] | None | 2,000 pages / 32 MB per file [37] | None found |
| **SciSpace** (research reading assistant) | PDF [39] | Chat, section-wise summary [39] | "Line-by-line inline citations" [39] | None | Not stated | None found |
| **Elicit** (research assistant) | Papers (up to 200 per report) [40] | Reports, extraction tables (**prose/table**) [40] | Sentence-level citations on every claim [41] | None | 200 papers per report [40] | None found |
| **Scholarcy** (paper summariser) | Articles, papers [42] | "Summary flashcards": Snapshot, Key findings, Key concepts (**bullets/sections**) [42] | Annotated bibliography for the paper's *references* [42]. No span links found | None | Bulk summariser [43] | None found |
| **Readwise Reader Ghostreader** (reading assistant) | Saved documents [44] | One summary field per document (**prose**) [44] | None | None | Auto-summarises saved docs [44] | None found |
| **SlopTrim** (writer-side anti-slop) | Pasted text, "a tweet to a long report" [45] | Same text, with slop highlighted and trimmed (**rewrite**) [45] | Patterns named per span; "fact gate" keeps numbers, names, dates, quotes and links verbatim [45] | N/A | Not stated | **Core positioning**: "AI slop detector, Slop Score, and fluff trimmer" [45] |

## What is table stakes

A Slop-clearing Map product **must** have all of these to be credible. They are not differentiators:

1. **Multi-format ingest.** PDF, Word, web URL and pasted text are the floor. YouTube and audio are common [1][6][12][18][31].
2. **One-click AI mind map from a Document**, as an editable **tree** [2][7][12][15][18][19]. Mapify, Xmind, MindMeister, GitMind and EdrawMind all do it, often on a free tier.
3. **Citations back to the source in chat and summaries**, usually at page granularity [4][9][35][37]. Elicit (sentence-level) and SciSpace (line-level) have raised the bar for research readers [39][41].
4. **Long Documents.** Hundreds to thousands of pages, or millions of words across sources [5][11][31][37].
5. **Detail control.** A concise/medium/detailed slider [7] or summary modes [31].
6. **Expand a branch with AI** [15][16]. Our Expand already does this.
7. **Manual relationship lines** between topics in a mind map editor [14][24].

## Contested, claimed by a niche player

- **Labelled cross-branch Links generated automatically.** Atlas claims labelled relations (motivates, causes, enables, contradicts) between source-faithful nodes [26]. Recall auto-links items without labels [29]. General mind-map tools only offer manual relationship lines [14]. Atlas is limited to academic papers and research collections. We still have room in general documents and in the knowledge-worker triage segment, but "Links" alone is not new.
- **Provenance on every Node.** Atlas says its node text is drawn from the source [26]. NotebookLM gets there indirectly: clicking a node runs a cited chat [2]. Mapify gives page-level jump-to-source [9]. **Span-level provenance attached to every node of a mind map, for general documents,** is held only by Atlas, inside its research niche.

## Genuinely unclaimed

1. **Slop-clearing as the core transform on the reader's side.** No summariser, mind-map tool or reading assistant we found says it removes low-density padding, restatement or hedging from the *input* before structuring it. Their pitch is compression ("summarise", "key points"), not filtering. Every anti-slop product sits elsewhere:
   - writer-side, rewriting your own draft (SlopTrim [45]);
   - source-level, downranking AI-slop domains in search (Kagi SlopStop [33]).

   No one applies Slop-clearing to a Document someone else wrote, for the person who has to read it.
2. **A Slop ratio shown to the reader.** SlopTrim has a "Slop Score", but it is for authors editing drafts [45]. No reading tool reports content words against source words, or "how much of this doc was padding", next to the summary or map. That makes it a triage signal, which fits our primary reader.
3. **A coverage promise.** Competitors sell detail levels [7] and compression. None promises that every key point and relationship in the Document appears in the Map. None publishes a coverage eval on real sloppy documents, as our success measure does. Being explicit about coverage, with a whole Map generated up front, is open ground.
4. **Slop-clearing, span provenance and labelled Links in one Map, for business and AI-written documents.** Each piece exists somewhere:
   - span citations: Elicit, SciSpace;
   - labelled links: Atlas;
   - slop detection: SlopTrim.

   No product combines them, and no one targets knowledge workers triaging AI-generated memos, reports and proposals. The doc-to-mind-map vendors target students and general productivity [6][15][18]. The provenance-heavy tools target academics [26][40][41].
5. **A struck-through Source view** (listed as "not yet specified" on #20). The nearest analogue is SlopTrim's per-span pattern highlighting [45], which is writer-side. No reading tool shows which source spans were dropped as Slop. That is a cheap trust feature competitors lack.

### Implications for the spec

- **Lead with Slop-clearing and the Slop ratio.** The Map is the delivery format, not the headline, because "PDF to mind map" is commodity.
- **Make provenance span-level and show it on the Node itself**, not one chat click away. That beats NotebookLM and Mapify and matches Atlas.
- **Treat Links as necessary but not sufficient.** Their value comes from being labelled, auto-generated and anchored to source spans. Atlas is the benchmark to beat, and it only handles papers.
- **Watch Atlas and Mapify.** Mapify has page-level sourcing and some form of link feature. Of the incumbents, it is the most likely to add a Slop-filter mode.

## Sources (all accessed 2026-10-04)

1. Google Workspace, *Gemini Notebook (formerly NotebookLM)*: https://workspace.google.com/products/notebooklm/
2. NotebookLM Help, *Use Mind Maps*: https://support.google.com/notebooklm/answer/16212283?hl=en
3. Google blog, *Video Overviews and an upgraded Studio*: https://blog.google/technology/google-labs/notebooklm-video-overviews-studio-upgrades/
4. NotebookLM Help, *Use chat*: https://support.google.com/notebooklm/answer/16179559?hl=en-GB
5. Google blog, *8 expert tips for getting started with NotebookLM*: https://blog.google/technology/ai/notebooklm-beginner-tips/; Help, *Add or discover new sources*: https://support.google.com/gemininotebook/answer/16215270?hl=en
6. Mapify home: https://mapify.so/ ; *Chatmind is now Mapify*: https://mapify.so/blog/chatmind-is-now-mapify
7. Mapify ChatPDF: https://mapify.so/tools/chatpdf
8. Mapify Deep Research: https://mapify.so/deep-research
9. Mapify Ask AI: https://mapify.so/ask-anything
10. Mapify blog, *Concept map vs mind map*: https://mapify.so/blog/concept-map-vs-mind-map ; *Top concept map creators*: https://mapify.so/blog/top-concept-map-creators
11. Mapify pricing: https://mapify.so/pricing ; ChatPDF: https://mapify.so/tools/chatpdf
12. Xmind AI mind map generator: https://xmind.com/tools/ai-mind-map-generator
13. Xmind AI: https://xmind.com/ai ; Academy, *Summarize text, links and files*: https://xmind.com/academy/summarize-text-links-files-to-mind-maps
14. Xmind user guide, *Relationship*: https://xmind.app/user-guide/xmind/relationship-new/
15. MindMeister home: https://www.mindmeister.com/ ; *AI comes to MindMeister*: https://www.mindmeister.com/blog/ai-comes-to-mindmeister
16. Whimsical AI mind maps: https://whimsical.com/ai/ai-mind-maps ; Help: https://help.whimsical.com/get-started/ai-mind-maps
17. Miro AI mind map: https://miro.com/ai/mind-map-ai/ ; Miro AI reference: https://help.miro.com/hc/en-us/articles/20970362792210-Miro-AI-reference
18. GitMind, *Document to mind map*: https://gitmind.com/document-to-mindmap ; FAQ: https://gitmind.com/faq/ai-summary.html
19. EdrawMind AI: https://www.edrawmind.com/ad/ai-mind-map.html
20. EdrawMind, *Mind map AI guide*: https://www.edrawmind.com/ai-features/mind-map-ai.html
21. Heptabase wiki, *Work with AI*: https://wiki.heptabase.com/work-with-ai?lang=en
22. Heptabase newsletter, *Chat with your whiteboards* (2025-07-23): https://wiki.heptabase.com/newsletters/2025-07-23
23. Heptabase wiki, *Read PDFs*: https://wiki.heptabase.com/pdf-annotation
24. Heptabase wiki, *Fundamental elements*: https://wiki.heptabase.com/fundamental-elements
25. Atlas blog, *Create mind maps from documents*: https://www.atlasworkspace.ai/blog/mind-map-from-documents ; *Knowledge graph generator*: https://www.atlasworkspace.ai/blog/knowledge-graph-generator
26. Atlas blog, *Atlas vs Coggle*: https://www.atlasworkspace.ai/blog/atlas-vs-coggle ; *Atlas vs MindMeister*: https://www.atlasworkspace.ai/blog/atlas-vs-mindmeister ; *Atlas vs Whimsical*: https://www.atlasworkspace.ai/blog/atlas-vs-whimsical
27. Atlas blog, *Atlas vs Scite*: https://www.atlasworkspace.ai/blog/atlas-vs-scite
28. Recall home: https://www.getrecall.ai/
29. Recall docs, *Graph view*: https://docs.getrecall.ai/graph-view
30. Recall release notes, *Graph View 2.0* (2026-01-12): https://feedback.getrecall.ai/changelog/recall-release-notes-jan-12-2026-graph-view-20-and-much-more
31. Kagi API docs, *Universal Summarizer*: https://help.kagi.com/kagi/api/summarizer.html ; Help: https://help.kagi.com/kagi/summarizer/
32. Kagi blog, *Universal Summarizer*: https://blog.kagi.com/universal-summarizer
33. Kagi blog, *Introducing SlopStop*: https://blog.kagi.com/slopstop ; Help: https://help.kagi.com/kagi/features/slopstop.html
34. Adobe, *Acrobat AI Assistant*: https://www.adobe.com/acrobat/generative-ai-pdf.html
35. Adobe Help, *View citations in responses*: https://helpx.adobe.com/acrobat/desktop/explore-pdf-spaces/view-citations.html
36. Adobe Help, *Generative AI content usage FAQ*: https://helpx.adobe.com/acrobat/desktop/use-acrobat-ai/understand-usage-policies/user-disclosures.html
37. ChatPDF API docs: https://www.chatpdf.com/docs/api/backend
38. ChatPDF, *PDF Summary*: https://www.chatpdf.com/pdf-summary
39. SciSpace, *Chat with any PDF*: https://scispace.com/chat-pdf
40. Elicit, *Reports*: https://elicit.com/solutions/reports
41. Elicit home: https://elicit.com/
42. Scholarcy user guide, *Supercharge your reading*: https://help.scholarcy.com/guide/supercharge-your-reading
43. Scholarcy, *Bulk article summarizer*: https://www.scholarcy.com/features/bulk-article-summarizer
44. Readwise docs, *What is Ghostreader?*: https://docs.readwise.io/reader/guides/ghostreader/overview ; FAQ: https://docs.readwise.io/reader/docs/faqs/ghostreader
45. SlopTrim home: https://sloptrim.com/
