import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { BillRecord, ScannedBillData } from './src/types/bill.ts';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');

function ensureStorage(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(BILLS_FILE)) {
    fs.writeFileSync(BILLS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readBills(): BillRecord[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(BILLS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BillRecord[]) : [];
  } catch {
    return [];
  }
}

function writeBills(bills: BillRecord[]): void {
  ensureStorage();
  const tempFile = `${BILLS_FILE}.${randomUUID()}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(bills, null, 2), 'utf-8');
  fs.renameSync(tempFile, BILLS_FILE);
}

function parseDataUrl(input: string, fallbackMime = 'image/jpeg'): { mimeType: string; base64: string } {
  const trimmed = input.trim();
  const match = /^data:([^;]+);base64,(.+)$/s.exec(trimmed);
  if (match) {
    return {
      mimeType: match[1],
      base64: match[2].replace(/\s+/g, ''),
    };
  }
  return {
    mimeType: fallbackMime,
    base64: trimmed.replace(/\s+/g, ''),
  };
}

function extensionFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('heic')) return 'heic';
  return 'jpg';
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer(): Promise<void> {
  ensureStorage();
  const app = express();

  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/uploads/:filename', (req: Request, res: Response) => {
    const safeName = path.basename(String(req.params.filename || ''));
    if (!/^[a-zA-Z0-9._-]+$/.test(safeName)) {
      res.status(400).json({ error: 'Invalid filename.' });
      return;
    }
    const fullPath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Receipt image not found.' });
      return;
    }
    res.sendFile(fullPath);
  });

  app.post('/api/scan-bill', async (req: Request, res: Response) => {
    try {
      const { imageData, mimeType } = req.body as {
        imageData?: string;
        mimeType?: string;
      };

      if (!imageData || typeof imageData !== 'string') {
        res.status(400).json({ error: 'Receipt image data is required.' });
        return;
      }

      const parsed = parseDataUrl(imageData, mimeType || 'image/jpeg');
      if (!parsed.base64) {
        res.status(400).json({ error: 'Uploaded image could not be decoded.' });
        return;
      }

      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.base64,
              },
            },
            {
              text:
                'Carefully inspect this bill or receipt image and extract the exact shop/company name, purchase date printed on the bill, and final grand total amount.',
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are a high-precision receipt and invoice OCR extraction engine. ' +
            'Extract fields strictly from what is visible in the bill photo:\n' +
            '1. shopName: The merchant, store, restaurant, or company name (usually at the top header or logo). Clean up unnecessary branch punctuation, keep the official name.\n' +
            '2. billDate: The transaction/purchase date printed on the bill normalized to YYYY-MM-DD (e.g., 2026-11-16). If a 2-digit year is shown (like 16/11/26), interpret it as 2026-11-16. Note regional DD/MM/YYYY vs MM/DD/YYYY carefully based on receipt origin/currency. Return empty string if no date is legible.\n' +
            '3. rawDateText: The exact date text printed on the receipt.\n' +
            '4. totalAmount: The final Grand Total / Net Payable / Bill Total amount as a numeric decimal (do NOT pick subtotal before tax, cash tendered, change due, or invoice number). If no total is readable, return null.\n' +
            '5. currency: The currency symbol shown on the receipt (e.g., "₹", "$", "€", "£"). If Rs./INR is shown, return "₹". Default to "₹" if Indian address/GSTIN is visible, otherwise "$" if unclear.\n' +
            '6. suggestedReason: A concise 2-4 word spending purpose inferred from the items or store type (e.g., "Grocery shopping", "Team lunch", "Pharmacy medicines", "Fuel & commute", "Electronics supplies").',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shopName: {
                type: Type.STRING,
                description: 'Official shop or company name printed on the bill.',
              },
              billDate: {
                type: Type.STRING,
                description: 'Purchase date normalized as YYYY-MM-DD, or empty string if unreadable.',
              },
              rawDateText: {
                type: Type.STRING,
                description: 'Exact date string as printed on the bill.',
              },
              totalAmount: {
                type: Type.NUMBER,
                nullable: true,
                description: 'Exact final grand total payable amount on the bill.',
              },
              currency: {
                type: Type.STRING,
                description: 'Currency symbol such as ₹, $, €, or £.',
              },
              suggestedReason: {
                type: Type.STRING,
                description: 'Concise 2-4 word spending category/reason inferred from items.',
              },
            },
            required: ['shopName', 'billDate', 'rawDateText', 'totalAmount', 'currency', 'suggestedReason'],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const extracted = JSON.parse(rawText) as Partial<ScannedBillData>;

      const scanned: ScannedBillData = {
        shopName: typeof extracted.shopName === 'string' ? extracted.shopName.trim() : '',
        billDate: typeof extracted.billDate === 'string' ? extracted.billDate.trim() : '',
        rawDateText: typeof extracted.rawDateText === 'string' ? extracted.rawDateText.trim() : '',
        totalAmount:
          typeof extracted.totalAmount === 'number' && Number.isFinite(extracted.totalAmount)
            ? Number(extracted.totalAmount.toFixed(2))
            : null,
        currency: typeof extracted.currency === 'string' && extracted.currency.trim() ? extracted.currency.trim() : '₹',
        suggestedReason:
          typeof extracted.suggestedReason === 'string' ? extracted.suggestedReason.trim() : '',
      };

      res.json({ scanned });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to scan bill image.';
      console.error('Error in /api/scan-bill:', error);
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/bills', (_req: Request, res: Response) => {
    const bills = readBills().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ bills });
  });

  app.post('/api/bills', (req: Request, res: Response) => {
    try {
      const {
        shopName,
        billDate,
        uploadedDate,
        totalAmount,
        currency,
        spendingReason,
        imageData,
        mimeType,
      } = req.body as {
        shopName?: string;
        billDate?: string;
        uploadedDate?: string;
        totalAmount?: number | string;
        currency?: string;
        spendingReason?: string;
        imageData?: string;
        mimeType?: string;
      };

      const cleanShop = typeof shopName === 'string' ? shopName.trim() : '';
      const cleanReason = typeof spendingReason === 'string' ? spendingReason.trim() : '';
      const numericAmount = typeof totalAmount === 'number' ? totalAmount : Number(totalAmount);

      if (!cleanShop) {
        res.status(400).json({ error: 'Shop or company name is required.' });
        return;
      }
      if (!Number.isFinite(numericAmount) || numericAmount < 0) {
        res.status(400).json({ error: 'A valid total amount is required.' });
        return;
      }
      if (!cleanReason) {
        res.status(400).json({ error: 'Spending reason is required before saving.' });
        return;
      }

      const id = randomUUID();
      let imageUrl: string | null = null;

      if (imageData && typeof imageData === 'string') {
        const parsed = parseDataUrl(imageData, mimeType || 'image/jpeg');
        if (parsed.base64) {
          const ext = extensionFromMime(parsed.mimeType);
          const filename = `bill_${Date.now()}_${id.slice(0, 8)}.${ext}`;
          const filePath = path.join(UPLOADS_DIR, filename);
          fs.writeFileSync(filePath, Buffer.from(parsed.base64, 'base64'));
          imageUrl = `/api/uploads/${filename}`;
        }
      }

      const nowIso = new Date().toISOString();
      const record: BillRecord = {
        id,
        shopName: cleanShop,
        billDate: typeof billDate === 'string' && billDate.trim() ? billDate.trim() : nowIso.slice(0, 10),
        uploadedDate:
          typeof uploadedDate === 'string' && uploadedDate.trim()
            ? uploadedDate.trim()
            : nowIso.slice(0, 10),
        totalAmount: Number(numericAmount.toFixed(2)),
        currency: typeof currency === 'string' && currency.trim() ? currency.trim() : '₹',
        spendingReason: cleanReason,
        imageUrl,
        createdAt: nowIso,
      };

      const bills = readBills();
      bills.unshift(record);
      writeBills(bills);

      res.status(201).json({ bill: record });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save bill.';
      console.error('Error in POST /api/bills:', error);
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/bills/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const { spendingReason, shopName, billDate, totalAmount } = req.body as Partial<BillRecord>;
      const bills = readBills();
      const idx = bills.findIndex((b) => b.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Bill record not found.' });
        return;
      }

      const updated: BillRecord = {
        ...bills[idx],
        shopName: typeof shopName === 'string' && shopName.trim() ? shopName.trim() : bills[idx].shopName,
        billDate: typeof billDate === 'string' && billDate.trim() ? billDate.trim() : bills[idx].billDate,
        totalAmount:
          typeof totalAmount === 'number' && Number.isFinite(totalAmount) && totalAmount >= 0
            ? Number(totalAmount.toFixed(2))
            : bills[idx].totalAmount,
        spendingReason:
          typeof spendingReason === 'string' && spendingReason.trim()
            ? spendingReason.trim()
            : bills[idx].spendingReason,
      };

      bills[idx] = updated;
      writeBills(bills);
      res.json({ bill: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update bill.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/bills/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || '');
      const bills = readBills();
      const target = bills.find((b) => b.id === id);
      if (!target) {
        res.status(404).json({ error: 'Bill record not found.' });
        return;
      }

      if (target.imageUrl && target.imageUrl.startsWith('/api/uploads/')) {
        const filename = path.basename(target.imageUrl);
        const fullPath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }

      const nextBills = bills.filter((b) => b.id !== id);
      writeBills(nextBills);
      res.json({ deletedId: id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete bill.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BillTrack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
