# Research: Mind-map rendering library survey

**Ticket:** [theRealNG/learn_with_mindmaps#3](https://github.com/theRealNG/learn_with_mindmaps/issues/3)
**Date:** 2026-09-09

## Question

Survey existing JS/TS libraries and approaches for rendering an interactive, incrementally-expandable
tree/mind-map UI for Wayfinder. Wayfinder's Map is a tree of Nodes where Root Nodes are generated first
and a Node's children are generated on demand (Expand) via an AI call — so at any moment large parts of
the tree are known to exist conceptually but have no children data yet, and the UI must let a user expand
a Node and splice freshly-fetched children into the live view. Compare React Flow, markmap, D3 hierarchical
layouts, Cytoscape.js, and a custom canvas/SVG renderer on: lazy/on-demand expansion, large-tree behavior,
pan/zoom, styling, maturity, and React/TypeScript fit.

## Method

Investigated each candidate's own documentation and GitHub repository. Direct fetches of the project
doc sites (reactflow.dev, markmap.js.org, d3js.org, js.cytoscape.org) were blocked by this session's
network egress proxy (allowlists a fixed set of domains), so evidence was gathered via `github.com` repo
pages/READMEs (not egress-blocked) and targeted web searches that surface doc-site content and maintainer
statements. Every claim below is sourced; a couple of secondary details (markmap's `Markmap.create`
signature) come from search-result excerpts of the official doc pages rather than a direct fetch, and are
flagged as such.

## Findings

### React Flow (`@xyflow/react`, formerly `reactflow`)

- **What it is:** an open-source, MIT-licensed library "for building node-based UIs with React... ready
  out-of-the-box and infinitely customizable," built and maintained by the xyflow team.
  [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow)
- **Lazy/on-demand expansion:** no single built-in "expand this node" primitive, but the data model is
  exactly suited to it: nodes and edges are plain arrays of objects held in application state
  (`useNodesState`/`useEdgesState`), and the docs' own basic-usage pattern adds elements at runtime via
  callbacks (`onConnect` → `addEdge(params, eds)`). Adding a Node's freshly-Expanded children is the same
  shape of operation: append new node/edge objects to state after the async Expand call resolves, then
  React Flow re-renders. This is an idiomatic, not a special-cased, feature.
  [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow)
- **Large trees:** React Flow renders one DOM node per graph node, so very large graphs (thousands+) can
  get slow; the maintainers' own guidance in a discussion on "progressive loading for big diagrams" is to
  virtualize by viewport — only mount nodes/edges currently visible, throttle recompute on pan/zoom, and
  optionally move position math to a Web Worker. A community member reported this approach handling
  1MB+ JSON graphs smoothly. For Wayfinder's use case (a session-scoped, incrementally-grown personal map,
  not a fixed huge corpus loaded up front) this is a reasonable ceiling, and matches the "grows on demand"
  interaction model — undiscovered Nodes never enter the DOM at all until Expanded.
  [github.com/xyflow/xyflow/discussions/3033](https://github.com/xyflow/xyflow/discussions/3033)
- **Pan/zoom:** first-class, built in — the `<Controls />` component and the core canvas provide pan/zoom
  navigation out of the box. [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow)
- **Styling:** nodes/edges are React components, styled with ordinary CSS/CSS-in-JS (a default stylesheet
  is imported and fully overridable); custom node and edge *types* are first-class, so a Wayfinder Node
  (label + summary + expand affordance + loading state) can be its own React component with full design
  control. [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow)
- **Maturity/fit:** MIT-licensed core with an optional paid Pro tier for extra examples/support; current
  major version 12 (`@xyflow/react`, v12.11.x at time of writing) with regular changeset-driven releases;
  large, active community. Being a React library, it is a direct fit for a React/TypeScript app — state
  management, async data fetching (the Expand call), and loading/error UI per node compose naturally with
  normal React patterns. [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow),
  [npmjs.com/package/@xyflow/react](https://www.npmjs.com/package/@xyflow/react)

### markmap

- **What it is:** an MIT-licensed library that "visualizes your Markdown as mindmaps," rendered as an
  interactive SVG with pan, zoom, and click-to-expand/collapse; ships as a monorepo (`markmap-lib` for
  parsing Markdown into a tree, `markmap-view` for rendering, plus a toolbar package), and also runs as a
  CLI, VS Code/Vim/Emacs extension, and MCP server. 13.1k GitHub stars, actively maintained (419+ commits).
  [github.com/markmap/markmap](https://github.com/markmap/markmap)
- **Lazy/on-demand expansion:** markmap's expand/collapse toggle only ever reveals or hides nodes that are
  **already present** in the rendered tree — it is not a "fetch children now" hook. The renderer
  (`markmap-view`'s `Markmap` class) is driven by `Markmap.create(svgSelector, options, root)`, where
  `root` is a hierarchical data object, and per search-indexed doc-site content it exposes ways to update
  that data after creation — so a Wayfinder integration would bypass the Markdown-parsing half entirely,
  construct the `INode` tree by hand, and re-supply an updated tree (with a Node's newly-Expanded children
  spliced in) after each Expand call. This works but is going against markmap's primary design center
  (turn a static Markdown outline into a picture), not with it. *(This paragraph draws on search-result
  excerpts of markmap.js.org's API and docs pages, which were not directly fetchable — see Method.)*
  [markmap.js.org API search results]
- **Large trees:** no explicit large-tree guidance found; as a full-SVG D3 render of the whole tree (not
  viewport-virtualized), it is reasonable for the hundreds-of-nodes scale typical of a document outline,
  with no documented virtualization strategy for very large or continuously-growing trees.
- **Pan/zoom:** built in — "zoom in and out with the mouse wheel, and pan around by dragging the
  background" is native toolbar/interaction behavior. [search result excerpt of markmap.js.org docs]
- **Styling:** theming is CSS-driven (SVG classes) plus color/font options passed to `Markmap.create`;
  flexible for a mind-map look, less naturally suited to embedding rich per-node UI (a summary snippet, a
  loading spinner, an expand button with custom state) than a component-based renderer, since nodes are
  SVG text/foreignObject rather than arbitrary framework components.
- **Fit:** works with React (there are React wrapper examples) but its core API is framework-agnostic
  (SVG selector + plain-object tree), so it sits awkwardly alongside idiomatic React state management —
  useful if the product were "turn a document into a mind map," a poor match for Wayfinder's core loop of
  incrementally growing a tree from many discrete async calls.

### D3 hierarchical layouts (`d3-hierarchy`)

- **What it is:** a low-level, ISC-licensed layout-computation module — "2D layout algorithms for
  visualizing hierarchical data" (tree/node-link, cluster, treemap, pack, partition). It computes `x`/`y`
  (or angle/radius) coordinates for a hierarchy's nodes; it does not render anything, manage the DOM,
  handle pan/zoom, or manage state. [github.com/d3/d3-hierarchy](https://github.com/d3/d3-hierarchy)
- **Lazy/on-demand expansion:** no built-in concept of expansion at all — you re-run the layout algorithm
  over whatever hierarchy object you currently have (which can change shape freely between renders, since
  a "hierarchy" is just a plain nested JS object you construct via `d3.hierarchy(data)`). Splicing an
  Expanded Node's new children in and re-running `tree()`/`cluster()` is straightforward, but every other
  piece of interactivity — pan/zoom (via `d3-zoom`), rendering (manual SVG or Canvas `enter`/`update`/`exit`
  bindings), hit-testing, styling, transitions — must be hand-built on top. This is the "build a custom
  renderer, but don't reinvent tree-layout math" option, not a full solution by itself.
  [github.com/d3/d3-hierarchy](https://github.com/d3/d3-hierarchy)
- **Large trees:** the layout math itself is fast (`O(n)`-ish tidy-tree algorithms); large-tree UX is
  entirely a function of how well the developer implements virtualization/incremental DOM updates on top,
  since D3 provides no default node/edge component or virtualization strategy.
- **Pan/zoom, styling:** not provided — bring your own (`d3-zoom` is the idiomatic pairing; styling is raw
  SVG/CSS or Canvas drawing code).
- **Fit:** most control, most work. Reasonable if the team wants a fully bespoke look/interaction model and
  is willing to own rendering, hit-testing, and accessibility; otherwise it duplicates what React
  Flow already provides on top of comparable (also D3-derived) layout primitives.

### Cytoscape.js

- **What it is:** a "fully featured graph theory library" (MIT-licensed) for modeling and rendering
  general graphs (not tree-specific), from University of Toronto research, published in Oxford
  Bioinformatics (2016, 2023). 11.2k GitHub stars, 1.7k forks, with monthly feature releases and weekly
  patch releases. [github.com/cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js)
- **Lazy/on-demand expansion:** elements are added to the live graph model at runtime through the core API
  (`cy.add(...)` / constructing with an `elements` array), so appending a Node's newly-fetched children
  after an Expand call is directly supported and is a common usage pattern (e.g. its own "Navigation and
  Layout" docs and third-party expand-collapse extensions build exactly this kind of progressive-disclosure
  UI). [github.com/cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js)
- **Large trees:** designed for large relational/biological networks (its flagship demos include large
  transit and biological network graphs), with a Canvas-based renderer by default rather than one-DOM-node-
  per-element, which scales further than React Flow's DOM-per-node model before needing manual
  virtualization. [github.com/cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js)
- **Pan/zoom:** built in — `minZoom`/`maxZoom`/initial `pan` are core constructor options, panning/zooming
  ships by default (a `cytoscape-panzoom` extension adds UI chrome on top).
  [github.com/cytoscape/cytoscape.js-panzoom](https://github.com/cytoscape/cytoscape.js-panzoom)
- **Styling:** a CSS-like stylesheet system (selectors matching element classes/data, declarative visual
  properties) — flexible for shapes/colors/labels, but (being Canvas-rendered) nodes are not arbitrary HTML/
  React components, so rich per-node content (a summary line, inline loading spinner, custom expand
  control) needs custom Canvas drawing or an HTML-overlay workaround rather than "just render a React
  component."
- **Fit:** general-purpose graph library, tree layouts available via extensions (e.g.
  `cytoscape.js-dagre`, breadthfirst). Strong choice if the app might ever need non-tree edges (arbitrary
  cross-links between Nodes) or must render very large graphs; steeper API to learn than React Flow for a
  team already committed to React, and less natural for embedding rich, framework-native node UI.

### Custom canvas/SVG renderer

- Building bespoke — e.g. `d3-hierarchy` (or hand-rolled layout math) plus raw Canvas/SVG drawing and a
  hand-rolled pan/zoom (`d3-zoom` or manual transform math) — gives maximum control over the exact visual
  language of a Wayfinder Map and the exact expand/loading affordances, at the cost of reimplementing
  hit-testing, accessibility, text layout, animation, and virtualization that React Flow and Cytoscape.js
  already ship. For a personal app under active early development, this is the highest-effort, highest-risk
  option and is only justified if none of the above libraries can be bent into the desired interaction
  model — which is not the case here.

## Comparison summary

| | Lazy expansion | Large trees | Pan/zoom | Styling | React/TS fit |
|---|---|---|---|---|---|
| **React Flow** | Idiomatic (append to state) | Good to ~1000s w/ viewport virtualization | Built in | Full React components/CSS | Native |
| **markmap** | Works against the grain (rebuild tree, re-supply data) | Untested at scale, no virtualization story | Built in | CSS/SVG, limited rich content | Wrapper only |
| **D3 (d3-hierarchy)** | Manual, fully flexible | Depends entirely on custom implementation | Bring your own (`d3-zoom`) | Bring your own (raw SVG/Canvas) | Low-level, more glue code |
| **Cytoscape.js** | Native (`cy.add`) | Very good (Canvas renderer) | Built in | Stylesheet system, Canvas-drawn nodes | Good but non-React-native API |
| **Custom renderer** | Whatever you build | Whatever you build | Bring your own | Whatever you build | Highest effort |

## Recommendation

**Use React Flow (`@xyflow/react`).** Its node/edge state is just application data (arrays you own), so
Wayfinder's core interaction — call Expand, await the AI response, append the returned child Nodes/edges to
state — is the library's *intended* usage pattern, not a workaround. It ships pan/zoom and a MiniMap out of
the box, and because nodes are React components, a Wayfinder Node (label, summary, expand button, per-node
loading/error state) is just a component with normal CSS/Tailwind styling — no separate rendering DSL to
learn. It is MIT-licensed, actively maintained (regular releases, large community), and is a first-class
fit for a React/TypeScript app, which this project will most likely be. Its main weakness — one DOM node
per element limiting raw scale — is not a near-term concern for a single user's session-scoped, on-demand-
grown Map (most of the tree legitimately doesn't exist yet until Expanded), and the documented viewport-
virtualization pattern is a known, incremental mitigation if a Map ever grows very large.

Runner-up: **Cytoscape.js**, if the product later needs non-tree relationships between Nodes (cross-links,
not just parent/child) or must comfortably render graphs far larger than React Flow's DOM-per-node model —
its Canvas renderer and native `cy.add()` for incremental growth make it the strongest alternative, at the
cost of a less React-idiomatic API and less natural rich per-node content.

Not recommended: **markmap** (built around parsing a static Markdown document, not incrementally-fetched
data — using it means fighting its core abstraction) and **D3 alone / a fully custom renderer** (all the
interaction infrastructure React Flow and Cytoscape.js already provide would need to be rebuilt, for no
clear benefit to this app).

## Sources

- [github.com/xyflow/xyflow](https://github.com/xyflow/xyflow) — React Flow / Svelte Flow repo (README, license, versioning)
- [github.com/xyflow/xyflow/discussions/3033](https://github.com/xyflow/xyflow/discussions/3033) — "progressive loading for big diagrams" maintainer/community guidance
- [npmjs.com/package/@xyflow/react](https://www.npmjs.com/package/@xyflow/react) — current published version
- [github.com/markmap/markmap](https://github.com/markmap/markmap) — markmap monorepo (README, license, stars, packages)
- markmap.js.org API/docs pages (`markmap-view`, `Markmap` class) — accessed via search-result excerpts; direct fetch was blocked by this session's network egress proxy
- [github.com/d3/d3-hierarchy](https://github.com/d3/d3-hierarchy) — d3-hierarchy repo (README, license, scope)
- [github.com/cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js) — Cytoscape.js repo (README, license, stars, activity)
- [github.com/cytoscape/cytoscape.js-panzoom](https://github.com/cytoscape/cytoscape.js-panzoom) — pan/zoom extension, confirms core pan/zoom options
- [github.com/cytoscape/cytoscape.js-dagre](https://github.com/cytoscape/cytoscape.js-dagre) — tree/DAG layout extension

## Caveats

This session's network egress proxy blocks the primary documentation domains for React Flow, markmap,
D3, and Cytoscape.js (`reactflow.dev`, `markmap.js.org`, `d3js.org`, `js.cytoscape.org`); findings were
triangulated from each project's GitHub repository (not blocked) and web search results that surface
doc-site content, rather than direct fetches of the doc sites themselves. The markmap runtime-API claims in
particular rest on search-result excerpts rather than a direct read of `markmap.js.org`'s API reference,
and should be spot-checked against that page before final adoption if markmap is reconsidered later.
