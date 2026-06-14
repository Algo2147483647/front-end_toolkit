# PDF Studio

PDF Studio is a standalone browser tool for placing editable overlays on local PDF files.

## Features

- Import a local PDF.
- Insert text boxes anywhere on any page.
- Edit text content, font family, size, color, style, alignment, opacity, and position.
- Insert PNG and JPEG images anywhere on a page.
- Insert boxes, lines, and arrows.
- Save a `.pdf-studio.json` project file.
- Export a PDF with the visual edits applied.
- Re-import an exported PDF from this tool and continue editing the stored overlay objects.

## Run

From the repository root:

```powershell
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/pdf-studio/
```

The app uses PDF.js and PDF-Lib from CDN, so an internet connection is needed for the first load unless those assets are cached.

## Editable Re-import

Exported PDFs include a `pdf-studio-project.json` attachment with the original source PDF and overlay data. When PDF Studio imports one of its own exported PDFs, it restores that attachment and keeps text boxes editable.
