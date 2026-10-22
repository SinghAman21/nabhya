# Thesis

The B.Tech project report for Nabhya, submitted to Vidyalankar Institute of
Technology, Department of Information Technology.

| | |
|---|---|
| **Source** | `main.tex` - one self-contained file |
| **Deliverable** | `final.pdf` - 75 pages |
| **Authors** | Tanay Shinde (23101B0034), Aman Singh (23101B0063), Tanishq Chavan (23101C0008) |
| **Supervisor** | Prof. Deepali Shrikhande |
| **Class** | `final_raitdisser.cls` - also embedded inside `main.tex` |

---

## Layout

```
thesis/
├── main.tex               the source - everything lives here
├── final.pdf              the deliverable (75 pages)
├── final_raitdisser.cls   the institute class, extracted for reference
├── images/                every figure and screenshot the report embeds
│   └── unused/            figures that were dropped from the text
├── fonts/                 GeistMono (the monospace face the report sets)
├── variants/              earlier drafts, kept for comparison
├── build/                 LaTeX auxiliary files - disposable
└── page-previews/         page captures of the PDF, for checking page breaks
```

`images/` and `fonts/` sit next to `main.tex` on purpose. The preamble sets
`\graphicspath{{./images/}{./}}` and `Path=./fonts/`, so the report compiles
from this folder with no path edits - see [Building](#building).

The class file is written out by `main.tex` itself through `filecontents*`, so
`final_raitdisser.cls` appearing next to it after a build is expected. The copy
checked in here is the same file, kept in the repo so it can be read without
opening the source.

## Figures

Every image the report embeds is referenced as `images/<name>`. Two macros do
the work:

- `\imgph{width}{height}{name}` - includes `images/<name>`, or draws a
  same-sized placeholder box if the file is missing. Nothing breaks when a
  figure is still outstanding.
- `\seqfigure{stem}{name}{caption}{label}{height}` - the sequence-diagram
  wrapper, which is `\imgph` with a figure environment around it.

Diagrams are exported from the live system, not redrawn, so they cannot drift
from the code they describe.

## Building

```
cd docs/thesis
xelatex main.tex
xelatex main.tex
```

Two passes are required: the first writes the `.aux`/`.toc`/`.lof`, the second
resolves them and produces the real page numbers.

A clean build today yields **75 pages** with every figure present. The body text
matches `final.pdf` exactly; only the front-matter pagination differs slightly
(`List of Figures` starts on vii in a fresh build and ix in `final.pdf`), which
means `final.pdf` was built from a marginally earlier revision of `main.tex`.
`final.pdf` is kept as the submitted deliverable - rebuild if you want the two
back in lockstep.

Two known warnings, both pre-existing in the source and neither fatal:

- `Reference 'sec:future' undefined` - four `\ref{sec:future}` calls but no
  matching `\label`. Add the label to the Future Scope section to clear it.
- `XeTeX` will warn about the `epstopdf` package being unnecessary under
  XeLaTeX. Harmless.

## Variants

Earlier drafts, kept so the progression is visible:

| File | Pages | Notes |
|---|---|---|
| `variants/75-pages.tex` | 73 | The long form. |
| `variants/50-pages.tex` | 50 | A condensed edition. |
| `variants/standalone.tex` | - | Same source as the 50-page edition, renamed. |
| `variants/overleaf.tex` | 56 | The Overleaf-submission version; no custom font. |
| `variants/black-book-75-pages.pdf` | 74 | A separate 74-page build, kept for comparison with the 75-page deliverable. |

The variants compile from their own folder and reach the shared assets through
`../images/` and `../fonts/`.

## Chapters

1. Introduction
2. Literature Survey
3. System Analysis and Design
4. Implementation
5. Security Architecture
6. Testing and Evaluation
7. Conclusion
8. Developer Setup Guide
9. Glossary
