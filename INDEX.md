# BillTrack — Full-Stack Project Index (Frontend & Backend)

## Live Application URLs
- **Development App URL (Frontend + Backend):** https://ais-dev-bjh4cnj5c2kqdox4jlsq5p-882065952538.asia-northeast1.run.app
- **Shared App URL:** https://ais-pre-bjh4cnj5c2kqdox4jlsq5p-882065952538.asia-northeast1.run.app

Both Frontend (React + Vite) and Backend (Express API) are served together on Port `3000`.

---

## 1. Frontend Index
- `index.html` — HTML entry point, SEO/OpenGraph metadata, `Plus Jakarta Sans` & `JetBrains Mono` Google Fonts.
- `src/index.css` — Tailwind CSS v4 configuration and tabular numeric styles (`.font-mono-tabular`).
- `src/main.tsx` — React 19 root mount.
- `src/App.tsx` — Top navigation bar (Purple `#22103F` & Yellow `#FACC15`), state coordination, and main layout.
- `src/components/BillScannerWorkspace.tsx` — Camera & Gallery photo upload, image compression, automatic `POST /api/scan-bill` trigger, auto-populated form (`Shop Name`, `Bill Date`, `Uploaded Date`, `Total Amount`), and `Spending Reason` submission (`POST /api/bills`).
- `src/components/CameraCaptureModal.tsx` — Live browser camera capture (`getUserMedia`) with front/back camera switching and gallery fallback.
- `src/components/SpendingReasonDashboard.tsx` — KPI summary strip, spend-by-reason breakdown bars, search/filter controls, CSV export, inline reason editing (`PATCH /api/bills/:id`), and bill deletion (`DELETE /api/bills/:id`).
- `src/components/ReceiptPreviewModal.tsx` — Lightbox modal to inspect full receipt photos and metadata.
- `src/types/bill.ts` — Shared TypeScript interfaces (`ScannedBillData`, `BillRecord`).

---

## 2. Backend Index (`server.ts`)
- **Runtime:** Express server running on `0.0.0.0:3000` (`tsx server.ts` in dev, `node server.ts` in production).
- **AI Vision OCR:** `@google/genai` (`gemini-4-hydrogen`) with structured JSON `responseSchema`.
- **Persistence:** Atomic JSON storage at `data/bills.json` and uploaded receipt images at `data/uploads/`.

### Backend API Endpoints
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Server health check (`{"ok": true}`) |
| `POST` | `/api/scan-bill` | Scans uploaded receipt image (`imageData`, `mimeType`) and extracts `shopName`, `billDate`, `rawDateText`, `totalAmount`, `currency`, `suggestedReason` |
| `GET` | `/api/bills` | Lists all saved bills sorted newest-first |
| `POST` | `/api/bills` | Saves bill fields, spending reason, and receipt image file |
| `PATCH` | `/api/bills/:id` | Updates spending reason or bill fields |
| `DELETE` | `/api/bills/:id` | Deletes bill record and its stored receipt image |
| `GET` | `/api/uploads/:filename` | Serves saved receipt images securely |
