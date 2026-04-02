---
title: Decomposition and Composition Theory
status: active
summary: Mathematical foundations for spec-driven development — what makes a good decomposition, and how pieces compose back
tags: [decomposition, composition, information-theory, modularity, spec-driven, category-theory, complexity]
deps: [doc01.05.02, doc01.05.04.01]
---

# Decomposition and Composition Theory

**Question:** What mathematical fields inform good software decomposition? Category theory handles composition well, but assumes the decomposition is already done. What tells us *where to cut*?

**Motivation:** Carta is a tool for artifact-driven development (doc01.05.04.01). If spec-driven development means "enrich a napkin sketch with enough context to reach production code," we need a theory of what "enough context" means, what makes a decomposition honest versus false, and how to measure decomposition quality. This session surveys the relevant fields and ranks them by foundational importance.

## The Gap in Category Theory

Fong and Spivak's *Seven Sketches in Compositionality* is about **composition**: given well-typed parts with defined interfaces, how do they assemble? The co-design chapter (profunctors, feasibility relations) models teams working independently with resource contracts. But it assumes the decomposition is already done.

Category theory is the **owl of Minerva** — it describes the algebra of composition in hindsight, after someone has already found the right parts. It cannot tell you where the joints are. For that, we need different fields entirely.

This is not a criticism. Composition and decomposition are dual concerns that require different tools.

## Fields That Address Decomposition

Ranked by foundational importance, from "read this first" to "niche."

### 1. Simon's Near-Decomposability (Foundational)

**Source:** Herbert Simon, "The Architecture of Complexity" (1962). One of the most cited papers in complexity science.

**Core claim:** Complex systems that persist over time are *nearly decomposable* — they have strong intra-subsystem interactions and weak inter-subsystem interactions, with a separation of timescales (fast local dynamics, slow global dynamics).

**Why it matters:** This is the theoretical justification for why layered architecture works at all. Simon argues the hierarchy is *in the system*, not imposed by the designer. A good decomposition discovers existing structure; a bad one cuts across natural joints.

**Key insight for spec-driven development:** A well-structured spec should reflect the nearly decomposable structure of the problem domain. If your spec forces tightly coupled concepts into separate sections, or loosely coupled concepts into the same section, the resulting code will fight you.

**Practical test:** In a nearly decomposable system, you can describe a subsystem's behavior without reference to other subsystems (at the fast timescale). If you can't describe a module without constantly referring to other modules, your decomposition cuts across joints.

**Accessibility:** 20-page paper, no math prerequisites. Read it.

### 2. Information Theory — Coupling and Cohesion (Foundational)

**Source:** Allen & Khoshgoftaar (1999), "Measuring Coupling and Cohesion: An Information-Theory Approach."

**Core claim:** Module quality can be measured with Shannon entropy. Given a graph of dependencies between components:
- **Cohesion** = mutual information *within* a module (high is good)
- **Coupling** = mutual information *between* modules (low is good)

This replaces vague intuitions ("high cohesion, low coupling") with a real-valued metric.

**Why it matters:** It gives you a *number*. You can compare two decompositions and say which one is better. The information-theoretic framing also explains *why* coupling is bad: it means predicting the behavior of one module requires information about another.

**Connection to enrichment:** When you "enrich" a napkin spec with API design context, you're reducing the mutual information between the spec and the codebase — you're making the spec *more self-contained* by internalizing the information it previously depended on externally. The enriched spec has higher cohesion.

**Extension — Partial Information Decomposition (Niche):** Williams & Beer (2010) decompose mutual information into *redundant*, *unique*, and *synergistic* components, arranged in a lattice. A good decomposition minimizes cross-boundary **synergy** (information that exists only when you look at both modules). This is more precise but still active research — not yet widely adopted.

**Accessibility:** Requires comfort with Shannon entropy (H, I, conditional entropy). Undergrad-level probability is sufficient.

### 3. Hadamard Well-Posedness (Foundational concept, simple to state)

**Source:** Jacques Hadamard (1902). Standard in applied mathematics and PDE theory.

**Three conditions for a well-posed problem:**
1. **Existence** — a solution exists
2. **Uniqueness** — the solution is determined
3. **Stability** — small changes in input cause small changes in output

**Why it matters:** This formalizes Deleuze/Bergson's "false problems." A decomposition is good if each sub-problem is well-posed. If a sub-problem has no solution, multiple contradictory solutions, or is chaotically sensitive to small requirement changes, the decomposition is wrong — you've created a false problem.

**Connection to enrichment and LLMs:** An LLM can't translate a napkin spec to production code because the problem is **ill-posed** — infinitely many valid implementations exist (no uniqueness), and small wording changes cause discontinuous output changes (no stability). Enrichment with architectural context *regularizes* the problem: it constrains the solution space until the problem becomes well-posed. This is directly analogous to Tikhonov regularization in inverse problems.

**The monoidal closure version:** `context ⊗ spec ≥ code` iff `context ≥ (spec ⊸ code)`. The internal hom `spec ⊸ code` is the *minimum context* that makes the problem well-posed. Enrichment is the practice of ensuring you've met that threshold.

**Accessibility:** Three sentences to learn. The concept is simple; the applications are deep.

### 4. Category Theory — Composition (Foundational, but retrospective)

**Source:** Fong & Spivak, *Seven Sketches*; Mac Lane, *Categories for the Working Mathematician*; Milewski, *Category Theory for Programmers*.

**What it handles:** Given typed parts with defined interfaces, category theory describes how they compose. Functors preserve structure. Universal properties guarantee that your composition is "the best" for its shape. Monoidal categories model parallel composition.

**What it doesn't handle:** Where to cut. Category theory cannot tell you which decomposition to choose — only that *if* you've chosen well, the composition will be well-behaved.

**Value for Carta:** Carta's metamodel (schemas as objects, connections as morphisms, compilation as a functor to text) is genuinely categorical. The typed-port system and polarity model are monoidal structure. So CT is useful for *Carta's internals*, even if it doesn't help with the *user's* decomposition problem.

**Accessibility:** Steep learning curve relative to payoff for practical design. Best learned through Fong/Spivak (applied) rather than Mac Lane (pure).

### 5. Design Structure Matrix (Practical tool)

**Source:** Steward (1981), Eppinger & Browning (2012). Widely used in systems engineering (MIT, NASA, automotive).

**Core idea:** Represent a system as a square adjacency matrix of dependencies. Apply clustering algorithms (simulated annealing, genetic algorithms) to find modules that minimize off-diagonal entries (inter-module dependencies).

**Why it matters:** It's Alexander's graph decomposition idea, industrialized. If you have a concrete dependency graph (code imports, API calls, data flows), DSM gives you an algorithmic answer to "where should the module boundaries be?"

**Relationship to other fields:** DSM is the *applied tool* that implements the information-theoretic criterion. Clustering a DSM to minimize inter-module entries is equivalent to minimizing inter-module mutual information (under certain assumptions).

**Accessibility:** Easy to apply, no deep math required. The matrix is the dependency graph; the clustering is optimization.

### 6. Matroid Theory (Niche)

**Source:** Whitney (1935). Standard in combinatorics and optimization.

**Core idea:** Matroids axiomatize "independence" abstractly. The three axioms (hereditary, non-empty, exchange property) capture what it means for a collection of elements to be independent, generalizing both linear independence in vector spaces and acyclicity in graphs.

**Why it's niche for our purposes:** The connection to software decomposition is an extrapolation, not established literature. You get the same intuition from linear algebra (orthogonal vectors). The exchange property — "if I have a larger independent set than you, I can always give you one element to extend yours" — is elegant but doesn't directly tell you where module boundaries should go.

**When it might matter:** If you ever need to formally prove that a set of concerns is independent (in the sense that no concern is "derivable" from others), matroid axioms are the right tool. But in practice, information-theoretic measures do the job.

**Accessibility:** Requires comfort with abstract algebra / combinatorics. Undergrad math is sufficient but not common background.

## Alexander's Trajectory: A Cautionary Note

Christopher Alexander's intellectual trajectory is instructive:

1. **Notes on the Synthesis of Form** (1964): Formalized decomposition as graph clustering. Minimize inter-cluster dependencies. Rigorous, mathematical, computable.
2. **A Pattern Language** (1977): Abandoned the formalism. Argued that good decomposition requires *perceiving* natural joints, not computing them. Patterns are discovered through observation, not optimization.
3. **The Timeless Way of Building** (1979): Went further — good design comes from an "unnameable quality" that you recognize but cannot formalize.

Alexander moved *away* from mathematical decomposition toward something closer to Simon's "observe the nearly decomposable structure." The lesson: formal tools can *validate* a decomposition (measure coupling, check well-posedness), but the *discovery* of the right decomposition is an act of perception.

This aligns with Deleuze/Bergson: "false problems" arise from "badly analyzed composites" — you've mixed things that should be separate, or separated things that belong together. The fix is not more computation but clearer seeing.

## The Pipeline

These fields form a pipeline, not a competition:

```
1. WELL-POSEDNESS (Hadamard / Bergson)
   Is the problem correctly stated?
   → If not, no decomposition will help.

2. STRUCTURE DISCOVERY (Simon)
   Does the system have natural nearly-decomposable structure?
   → Observe before cutting. The joints are in the problem.

3. DECOMPOSITION (Information theory / DSM / Alexander)
   Where are the cuts?
   → Minimize cross-boundary mutual information.
   → Validate: each sub-problem should be well-posed.

4. INDEPENDENCE VERIFICATION (Information theory / Matroid)
   Are the pieces genuinely orthogonal?
   → Low coupling, high cohesion.
   → No synergistic information across boundaries.

5. COMPOSITION (Category theory)
   How do the pieces fit back together?
   → Typed interfaces, functorial mappings, universal properties.
```

Steps 1-2 are where most design failures happen. Steps 3-5 are where most formalism lives. The hard part is seeing clearly, not computing precisely.

## Implications for Spec-Driven Development

**Enrichment as regularization:** A napkin spec is an ill-posed problem. Enriching it with context (architecture, API patterns, conventions) is regularization — constraining the solution space until the problem becomes well-posed. The minimum viable enrichment is the internal hom `spec ⊸ code`.

**Specs should reflect near-decomposability:** If the problem domain has natural nearly-decomposable structure, the spec should mirror it. Each section of the spec should be describable without constant reference to other sections.

**Measure spec quality informationally:** A good spec has high internal cohesion (each section is self-contained) and low coupling (sections don't depend on each other's details). This is measurable in principle, though we don't have tooling for it yet.

**The decomposition is the design:** Alexander, Simon, and the information-theoretic tradition all converge on the same point — the hard part of design is decomposition. If you decompose well, composition is mechanical. If you decompose badly, no amount of compositional cleverness saves you.

## Reading Order

For someone with an undergraduate math background who wants to understand decomposition theory:

1. **Simon, "The Architecture of Complexity" (1962)** — 20 pages, no prerequisites, foundational
2. **Shannon, "A Mathematical Theory of Communication" (1948)** — entropy, mutual information, the basics
3. **Allen & Khoshgoftaar (1999)** — applying information theory to module quality
4. **Hadamard well-posedness** — any PDE textbook's first chapter, or the Wikipedia article
5. **Fong & Spivak, *Seven Sketches*** — composition side (you've started this)
6. **Eppinger & Browning, *Design Structure Matrix Methods*** — if you want the practical engineering tool

## Sources

- Simon, H.A. (1962). "The Architecture of Complexity." *Proceedings of the American Philosophical Society*.
- Allen, E.B. & Khoshgoftaar, T.M. (1999). "Measuring Coupling and Cohesion: An Information-Theory Approach." *IEEE METRICS*.
- Williams, P.L. & Beer, R.D. (2010). "Nonnegative Decomposition of Multivariate Information." arXiv:1004.2515.
- Alexander, C. (1964). *Notes on the Synthesis of Form*. Harvard University Press.
- Hadamard, J. (1902). "Sur les problemes aux derivees partielles et leur signification physique." *Princeton University Bulletin*.
- Fong, B. & Spivak, D.I. (2019). *An Invitation to Applied Category Theory: Seven Sketches in Compositionality*. Cambridge University Press.
- Whitney, H. (1935). "On the abstract properties of linear dependence." *American Journal of Mathematics*.
- Eppinger, S.D. & Browning, T.R. (2012). *Design Structure Matrix Methods and Applications*. MIT Press.
