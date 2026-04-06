

## Replace vulnerable `xlsx` package

### Problem
The `xlsx` (SheetJS) package v0.18.5 has two high-severity vulnerabilities: Prototype Pollution and ReDoS. It's used only in `SmartOpsLeadImporter.tsx` for parsing CSV/XLSX uploads.

### Solution
Replace `xlsx` with `exceljs`, a maintained alternative with no known vulnerabilities that supports both CSV and XLSX parsing.

### Changes

**1. `package.json`** — Remove `xlsx`, add `exceljs`

**2. `src/components/SmartOpsLeadImporter.tsx`** — Replace the XLSX import and file parsing logic:
- Remove `import * as XLSX from "xlsx"`
- Add `import ExcelJS from "exceljs"`
- Rewrite the `handleFile` function to use ExcelJS's `workbook.xlsx.load(buffer)` for XLSX files and `workbook.csv.read(stream)` for CSV files
- Convert worksheet rows to `Record<string, unknown>[]` using ExcelJS's row/cell API (read header row, then map data rows to objects)

### Scope
- Only one component uses this package
- No edge functions or other files are affected
- Parsing behavior (sheet_to_json equivalent) will be preserved

