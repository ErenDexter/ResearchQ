# Review methodologies

ResearchQ ships with **18 built-in, peer-reviewed review methodologies** plus a custom option. Each methodology defines its own phases and expected outputs, and the tool's phase stepper, prompts, and generators adapt accordingly.

The authoritative source of truth is [src/lib/server/db/seed-methodologies.ts](../src/lib/server/db/seed-methodologies.ts) — the descriptions below are summaries; consult the source for the exact phase list and expected outputs per methodology.

---

## Choosing a methodology

| If you're doing... | Start with |
|---|---|
| A full systematic review in health | **Cochrane** |
| A systematic review outside health | **PRISMA** |
| A scoping review in health | **JBI Scoping Review** |
| A scoping review outside health | **PRISMA-ScR** or **Arksey & O'Malley** |
| A software-engineering SLR | **Kitchenham SLR Guidelines** or **SLURP** |
| Mapping the research landscape | **Mapping Studies** |
| A qualitative evidence synthesis | **ENTREQ** or **Meta-ethnography** |
| A narrative review | **SANRA** |
| An integrative review | **Whittemore & Knafl** |
| Appraising evidence quality | **GRADE** (interventions), **CASP** (qualitative), **Newcastle-Ottawa Scale** (observational) |
| Structuring a clinical question | **PICO / PICOS / PICOT** |
| A qualitative question framework | **SPIDER** |
| Protocol registration | **PROSPERO** |

---

## Systematic reviews

### PRISMA
Preferred Reporting Items for Systematic Reviews and Meta-Analyses — the most widely used guideline for conducting and reporting systematic reviews, providing a 27-item checklist and a four-phase flow diagram.
**Phases:** Protocol Development → Identification → Screening → Eligibility → Quality Assessment → Data Extraction → Synthesis → Reporting.

### Cochrane Framework
The gold standard for systematic reviews in healthcare. Rigorous methodology for identifying, appraising, and synthesizing evidence to inform clinical decisions. Includes forest plots, funnel plots, and GRADE evidence rating.

### Kitchenham SLR Guidelines
Guidelines for performing systematic literature reviews in software engineering. Originally published as a Keele University / Durham University technical report, widely adopted in empirical software engineering.

### PROSPERO
An international prospective register for systematic reviews. Used as a protocol-registration workflow — write your protocol, register it, then conduct the review against what you registered.

### SLURP
A lightweight SLR methodology aimed at software-engineering practitioners, emphasizing speed and practicality over exhaustive comprehensiveness.

---

## Scoping reviews

### PRISMA-ScR
PRISMA extension for Scoping Reviews. Adapted from PRISMA for reviews that **map** the existing literature on a topic rather than answer a specific clinical question.

### Arksey & O'Malley Framework
A five-phase framework for scoping studies in the social sciences.

### JBI Scoping Review Framework
The Joanna Briggs Institute methodology for scoping reviews, widely used in health and clinical fields.

---

## Question frameworks

### PICO / PICOS / PICOT
Structured frameworks for formulating clinical questions:
- **P**opulation / **I**ntervention / **C**omparison / **O**utcome
- **+ S**tudy design (PICOS)
- **+ T**ime frame (PICOT)

### SPIDER
A qualitative/mixed-methods alternative to PICO: **S**ample, **P**henomenon of **I**nterest, **D**esign, **E**valuation, **R**esearch type.

---

## Qualitative synthesis

### ENTREQ
Enhancing transparency in reporting the synthesis of qualitative research — a 21-item framework for qualitative evidence syntheses.

### Meta-ethnography (Noblit & Hare)
The seminal seven-phase framework for interpretive synthesis of qualitative research.

---

## Evidence quality appraisal

### GRADE
Grading of Recommendations, Assessment, Development and Evaluation. Rates the certainty of evidence from High to Very Low. The de facto standard in clinical guideline development.

### CASP
Critical Appraisal Skills Programme — a family of checklists for critically appraising studies by type (qualitative, cohort, case-control, RCT, diagnostic, systematic review, etc.).

### Newcastle-Ottawa Scale
A quality-assessment scale for observational studies (case-control and cohort studies), widely cited in medical research.

### SANRA
Scale for the Assessment of Narrative Review Articles — a quality-assessment tool for narrative (non-systematic) reviews.

---

## Mixed methods and mapping

### Whittemore & Knafl Framework
The updated integrative-review methodology — allows combining diverse research designs (experimental, non-experimental, theoretical) in a single synthesis.

### Mapping Studies
Systematic evidence mapping — produces a classification scheme and visual map of the research landscape, often a precursor to a more focused systematic review.

---

## Custom methodology

You are not limited to the 18 built-in frameworks. From the Literature Review page, create a **Custom** methodology:

1. Name your methodology and give it a short description.
2. Define phases in order. Each phase has a name, a description, and a list of expected outputs (pick from the 20 supported output types or leave empty).
3. Apply the methodology to any project the same way as a built-in one.

This is the right path when your institution, funder, or journal requires a reporting framework that isn't on the built-in list.

---

## Expected outputs

Every phase can have one or more **expected outputs**. Twenty are supported today — grouped broadly:

| Group | Outputs |
|---|---|
| **Flow & inclusion** | PRISMA flow diagram, inclusion/exclusion table, search strategy log |
| **Data** | Data extraction matrix, study characteristics table, systematic mapping table, bibliometric analysis |
| **Quality & bias** | Risk of bias table, quality appraisal table, GRADE evidence table |
| **Synthesis** | Narrative summary, thematic synthesis, forest plot data, funnel plot data, summary of findings |
| **Structure & gaps** | Coding framework, conceptual framework, gap map |
| **Publication** | Protocol document, annotated bibliography |

Outputs marked "Automatic" in the UI are generated directly from your paper records (no LLM call). Outputs marked "AI-generated" use a prompt from [src/lib/server/prompts.ts](../src/lib/server/prompts.ts) against your extracted metadata.

Every output can be downloaded individually as Markdown or DOCX, or bundled into a complete review report.

---

## Adding a methodology

Contributions of new methodologies are welcome. The process:

1. Fork the repo and open [src/lib/server/db/seed-methodologies.ts](../src/lib/server/db/seed-methodologies.ts).
2. Append a new entry to the `METHODOLOGIES` array with:
   - `name`, `description` (cite the source publication in the description)
   - `type`: one of `systematic`, `scoping`, `qualitative`, `mapping`, `mixed`, `rapid`, `custom`
   - `domain`: one of `general`, `health`, `software_engineering`, `social_sciences`
   - `phases`: ordered list of `{ name, description, expectedOutputs }`
3. Bump `isBuiltIn=true` so it's seeded on every install.
4. Add a short entry to this document under the appropriate section, citing the source publication.
5. Open a PR. Bonus points if you include a reference to a published SLR that used this methodology so we can validate the phase structure.
