# Context: learn_with_mindmaps

## Glossary

**Source**
The input material a Map is built from. Three kinds: a **Codebase** (a repository or subset of one), a **Document** (an article, paper, or other large text), or a **Topic** (an open-ended subject with no supplied text — content comes from the AI's own knowledge, not an ingested document).

**Map**
The mind map built from one Source. A Map is persistent: it is saved, can be closed, and reopened later with its explored state intact.

**Node**
One concept within a Map. A Node has a label and a summary. A Node may have children; a Node with no children yet is unexpanded, not necessarily childless — it may not have been explored.

**Root Node**
A Node with no parent. Generated first, directly from the Source, representing the highest-level concepts — the "what are we trying to achieve / core concepts" view.

**Expand**
The action of generating a Node's children. Expansion is Map-aware: it is generated with awareness of the Node's ancestors, siblings, and the Source, so children stay coherent with the rest of the Map rather than being generated in isolation.

**Leaf**
A Node the user has chosen not to (or cannot usefully) expand further — the bottom of a given branch's detail.

**Slop**
Low information-density text: padding, restatement, hedging, generic framing (intros/outros), and filler lists. Slop is a property of how much a text says, not whether it is true — a dense but wrong passage is not Slop. Clearing Slop from a **Document** Source and presenting what remains as a Map is the product's core promise.
_Avoid_: "AI slop" as a synonym for misinformation or hallucination.
