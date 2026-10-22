# Documentation

Everything written about Nabhya, indexed by what it is for. Two files stay
outside this folder deliberately: `README.md` at the repo root (how to run the
app) and `AGENTS.md` at the repo root (the canonical agent guide).

Start with [`architecture/notes.md`](architecture/notes.md) for the design
principles, or the [final year report](reports/final-year-report.md) for the
full write-up.

---

## Architecture

| File | What it covers |
|---|---|
| [`architecture/notes.md`](architecture/notes.md) | Zod as the single source of truth, the monorepo layout, the validation flow, the web-app strategy, the hardening checklist and the roadmap. **Partly stale** - it was written when `packages/db` was still empty. |
| [`architecture/schema.md`](architecture/schema.md) | The 19-entity target domain model with a vertical relationship diagram. Read the **Amendments** section: item donations are the core differentiator, drop hand-rolled auth tables, store object-storage keys rather than URLs. |
| [`architecture/data-model.md`](architecture/data-model.md) | Table-by-table longform of the schema, v1. Predates the amendments above. |
| [`architecture/system-diagrams.md`](architecture/system-diagrams.md) | The system's component, module and deployment diagrams in one place. |
| [`architecture/bts.jsonc`](architecture/bts.jsonc) | **Stale scaffold metadata** from the original `better-t-stack` generator. Says `nestjs` but also `auth: none`. Ignore it. |

## API

| File | What it covers |
|---|---|
| [`api/activity-endpoints.md`](api/activity-endpoints.md) | The admin activity-timeline and chart-ready analytics endpoints. |
| [`api/post-moderation.md`](api/post-moderation.md) | Listing and deleting an NGO's feed posts from the admin console. |

## Product

| File | What it covers |
|---|---|
| [`product/features-per-role.md`](product/features-per-role.md) | Every feature per role, checked off. Converted from the old `PerRoleFeatures.txt`. |
| [`product/ui-redesign.md`](product/ui-redesign.md) | The UI redesign plan, organised by screen *shape* rather than by user role. |
| [`product/flows/organisation.md`](product/flows/organisation.md) | The NGO flow: signup, verification, publishing, team management. |
| [`product/flows/volunteer.md`](product/flows/volunteer.md) | The volunteer flow: signup, discovery, applying, certificates. |
| [`product/flows/superadmin.md`](product/flows/superadmin.md) | The superadmin flow: verification queues, moderation, audit. |

## Audits

Point-in-time reviews with file-and-line evidence. Both were run on
`2026-10-10` against `feat/ngo-teams`.

| File | What it covers |
|---|---|
| [`audits/app-audit.md`](audits/app-audit.md) | Functional audit: broken flows, security holes, incomplete features and polish, ranked. |
| [`audits/ui-audit.md`](audits/ui-audit.md) | UI/UX audit: P0/P1/P2 findings with evidence, diagnosis and a fix for each. |

## Operations

| File | What it covers |
|---|---|
| [`ops/deployment.md`](ops/deployment.md) | Deploying the API to Render and the web export to Vercel, including the hardcoded-port and `trust proxy` gotchas. |

## Reports

| File | What it covers |
|---|---|
| [`reports/final-year-report.md`](reports/final-year-report.md) | The full project report - architecture, ER diagram, UML flows, API design, security model, testing and deployment. |
| [`reports/changelog-2026-07-20.md`](reports/changelog-2026-07-20.md) | What changed on 20 July 2026: the first working vertical slices and the auth fixes they depended on. |

## Thesis

The B.Tech project report ("black book"). See
[`thesis/README.md`](thesis/README.md) for how to build it.

| Path | What it is |
|---|---|
| `thesis/main.tex` | **The source.** Everything is in this one file; the institute's class is embedded in it. |
| `thesis/final.pdf` | **The deliverable.** 75 pages. |
| `thesis/images/` | Every figure and screenshot the report embeds. |
| `thesis/fonts/` | GeistMono, the monospace face the report sets. |
| `thesis/final_raitdisser.cls` | The institute's report class, extracted from `main.tex` for reference. |
| `thesis/variants/` | Earlier drafts of the report, kept for comparison. |
| `thesis/build/` | LaTeX auxiliary files from the last compile. Disposable. |
| `thesis/page-previews/` | Page captures of the compiled PDF, used for checking page breaks. |

---

## Conventions used here

- Filenames are `kebab-case.md`. The three flows live in `product/flows/`
  because they are per-role behaviour, not per-role docs in their own right.
- Diagrams are Mermaid inside fenced blocks, so they render on GitHub.
- A doc that describes a past state says so in its first paragraph. Nothing
  here claims to describe the current code unless it says so.
