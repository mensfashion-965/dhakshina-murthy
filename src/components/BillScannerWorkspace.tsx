import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { Camera, CheckCircle2, FileText, Loader2, RotateCcw, Upload } from 'lucide-react';
import type { BillRecord, ScanBillResponse } from '../types/bill';
import { CameraCaptureModal } from './CameraCaptureModal';

interface BillScannerWorkspaceProps {
  onBillSaved: (bill: BillRecord) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function optimizeImageDataUrl(fileOrDataUrl: File | string): Promise<{ dataUrl: string; mimeType: string }> {
  const rawDataUrl =
    typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read selected image file.'));
          reader.readAsDataURL(fileOrDataUrl);
        });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl: rawDataUrl, mimeType: 'image/jpeg' });
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const compressed = canvas.toDataURL('image/jpeg', 0.88);
      resolve({ dataUrl: compressed, mimeType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('Unsupported or corrupted image format.'));
    img.src = rawDataUrl;
  });
}

const QUICK_REASONS = ['Groceries', 'Dining & Food', 'Travel & Fuel', 'Medical', 'Utilities', 'Office Supplies'];

export function BillScannerWorkspace({ onBillSaved, fileInputRef }: BillScannerWorkspaceProps) {
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  const [shopName, setShopName] = useState('');
  const [billDate, setBillDate] = useState('');
  const [rawDateText, setRawDateText] = useState('');
  const [uploadedDate, setUploadedDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('₹');
  const [suggestedReason, setSuggestedReason] = useState('');
  const [spendingReason, setSpendingReason] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  async function processAndScanImage(source: File | string) {
    setScanError(null);
    setSaveError(null);
    setSavedNotice(null);
    setScanComplete(false);
    setIsScanning(true);

    const today = getTodayDateString();
    setUploadedDate(today);

    try {
      const optimized = await optimizeImageDataUrl(source);
      setPreviewUrl(optimized.dataUrl);
      setImageMimeType(optimized.mimeType);

      const response = await fetch('/api/scan-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: optimized.dataUrl,
          mimeType: optimized.mimeType,
        }),
      });

      const payload = (await response.json()) as Partial<ScanBillResponse> & { error?: string };
      if (!response.ok || !payload.scanned) {
        throw new Error(payload.error || 'Could not scan bill details from the uploaded image.');
      }

      const { scanned } = payload;
      setShopName(scanned.shopName || '');
      setBillDate(scanned.billDate || '');
      setRawDateText(scanned.rawDateText || '');
      setTotalAmount(scanned.totalAmount !== null ? String(scanned.totalAmount) : '');
      setCurrency(scanned.currency || '₹');
      setSuggestedReason(scanned.suggestedReason || '');
      setScanComplete(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scanning failed. Please retry or enter details manually.');
    } finally {
      setIsScanning(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processAndScanImage(file);
    }
    e.target.value = '';
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void processAndScanImage(file);
    } else if (file) {
      setScanError('Please drop a valid image file (JPG, PNG, or WEBP).');
    }
  }

  function handleReset() {
    setPreviewUrl(null);
    setScanError(null);
    setSaveError(null);
    setSavedNotice(null);
    setScanComplete(false);
    setShopName('');
    setBillDate('');
    setRawDateText('');
    setUploadedDate('');
    setTotalAmount('');
    setCurrency('₹');
    setSuggestedReason('');
    setSpendingReason('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSavedNotice(null);

    if (!shopName.trim()) {
      setSaveError('Please enter or verify the Shop / Company Name.');
      return;
    }
    if (!totalAmount.trim() || Number.isNaN(Number(totalAmount)) || Number(totalAmount) < 0) {
      setSaveError('Please enter a valid Total Amount.');
      return;
    }
    if (!spendingReason.trim()) {
      setSaveError('Please enter your Spending Reason before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: shopName.trim(),
          billDate: billDate.trim() || getTodayDateString(),
          uploadedDate: uploadedDate || getTodayDateString(),
          totalAmount: Number(totalAmount),
          currency,
          spendingReason: spendingReason.trim(),
          imageData: previewUrl,
          mimeType: imageMimeType,
        }),
      });

      const payload = (await response.json()) as { bill?: BillRecord; error?: string };
      if (!response.ok || !payload.bill) {
        throw new Error(payload.error || 'Failed to save bill to backend.');
      }

      onBillSaved(payload.bill);
      const savedShop = payload.bill.shopName;
      handleReset();
      setSavedNotice(`Saved "${savedShop}" to your Spending Dashboard.`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save bill.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section id="scanner" className="scroll-mt-20">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-[#1E1035] sm:text-3xl">
            Scan a bill, record the reason, never lose a receipt.
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#5B526E]">
            Capture with your camera or upload from your gallery. Shop name, bill date, upload date, and total amount are extracted automatically on the backend.
          </p>
        </div>

        {previewUrl && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-lg border border-[#D8CEF0] bg-white px-4 py-2 text-sm font-medium text-[#3B2863] transition-colors hover:bg-[#F5F2FC] whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-4 w-4" />
            Clear & Scan New
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload bill photo from gallery"
      />
      <input
        ref={cameraFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Capture bill photo with device camera"
      />

      {savedNotice && (
        <div
          role="status"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#16A34A]/30 bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]"
        >
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
            <span>{savedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            className="text-xs font-semibold text-[#166534] underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        {/* Left Column: Photo Upload / Camera Capture & Preview */}
        <div className="flex flex-col rounded-xl border border-[#E6DFF3] bg-white p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1E1035]">1. Receipt Photo</h2>
            <span className="text-xs text-[#5B526E]">Camera or Gallery</span>
          </div>

          {!previewUrl ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? 'border-[#5B21B6] bg-[#F3EEFC]'
                  : 'border-[#D8CEF0] bg-[#FAF9FC] hover:border-[#7C3AED]'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EDE8F8] text-[#5B21B6]">
                <FileText className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm font-semibold text-[#1E1035]">
                Drop your bill photo here
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#5B526E]">
                Supports JPG, PNG, and mobile receipt photos. Scanning begins automatically upon upload.
              </p>

              <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#5B21B6] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4C1D95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B21B6] whitespace-nowrap shrink-0"
                >
                  <Camera className="h-4 w-4 text-[#FACC15]" />
                  Use Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#FACC15] px-5 py-2.5 text-sm font-semibold text-[#22103F] transition-colors hover:bg-[#EAB308] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CA8A04] whitespace-nowrap shrink-0"
                >
                  <Upload className="h-4 w-4" />
                  From Gallery
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#E6DFF3] bg-[#180B2E]">
                <img
                  src={previewUrl}
                  alt="Uploaded bill preview"
                  referrerPolicy="no-referrer"
                  className="max-h-[380px] w-full object-contain"
                />

                {isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#180B2E]/80 px-4 text-center backdrop-blur-xs">
                    <Loader2 className="h-8 w-8 animate-spin text-[#FACC15]" />
                    <p className="text-sm font-semibold text-white">
                      Scanning bill on backend...
                    </p>
                    <p className="text-xs text-[#DDD6FE]">
                      Reading shop name, bill date, and grand total
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={isScanning}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg border border-[#D8CEF0] bg-white px-4 py-2 text-xs font-semibold text-[#3B2863] transition-colors hover:bg-[#F5F2FC] disabled:opacity-50 whitespace-nowrap"
                >
                  <Camera className="h-4 w-4 text-[#5B21B6]" />
                  Retake Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg border border-[#D8CEF0] bg-white px-4 py-2 text-xs font-semibold text-[#3B2863] transition-colors hover:bg-[#F5F2FC] disabled:opacity-50 whitespace-nowrap"
                >
                  <Upload className="h-4 w-4 text-[#5B21B6]" />
                  Choose Another
                </button>
              </div>
            </div>
          )}

          {scanError && (
            <div
              role="alert"
              className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
            >
              <span>{scanError}</span>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => void processAndScanImage(previewUrl)}
                  className="font-semibold underline shrink-0"
                >
                  Retry Scan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Auto-Populated Bill Details + Spending Reason Box */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col justify-between rounded-xl border border-[#E6DFF3] bg-white p-5 lg:col-span-7"
        >
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#EDE8F8] pb-3.5">
              <div>
                <h2 className="text-sm font-semibold text-[#1E1035]">2. Auto-Scanned Details & Spending Reason</h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5B526E]">
                  {isScanning ? (
                    <span className="font-medium text-[#5B21B6]">Extracting accurate fields from receipt...</span>
                  ) : scanComplete ? (
                    <>
                      <span className="font-medium text-[#16A34A]">Scan verified</span>
                      <span aria-hidden="true">·</span>
                      <span>Review values and type your spending reason below</span>
                    </>
                  ) : (
                    <span>Upload a bill photo to auto-fill all 4 receipt fields</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Field 1: Shop Name / Company Name */}
              <div>
                <label htmlFor="shopName" className="block text-xs font-semibold text-[#3B2863]">
                  Shop / Company Name
                </label>
                <input
                  id="shopName"
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={isScanning ? 'Scanning shop name...' : 'e.g. Reliance Smart / ABC Traders'}
                  className="mt-1.5 min-h-[42px] w-full rounded-lg border border-[#D8CEF0] bg-[#FAF9FC] px-3.5 py-2 text-sm font-medium text-[#1E1035] placeholder:text-[#9388AA] focus:border-[#5B21B6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20"
                />
              </div>

              {/* Field 2: Bill Date (Purchase Date) */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="billDate" className="block text-xs font-semibold text-[#3B2863]">
                    Bill Date (Purchase Date)
                  </label>
                  {rawDateText && (
                    <span className="font-mono-tabular text-[11px] text-[#5B526E]">
                      Printed: {rawDateText}
                    </span>
                  )}
                </div>
                <input
                  id="billDate"
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="font-mono-tabular mt-1.5 min-h-[42px] w-full rounded-lg border border-[#D8CEF0] bg-[#FAF9FC] px-3.5 py-2 text-sm font-medium text-[#1E1035] focus:border-[#5B21B6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20"
                />
              </div>

              {/* Field 3: Uploaded Date */}
              <div>
                <label htmlFor="uploadedDate" className="block text-xs font-semibold text-[#3B2863]">
                  Uploaded Date
                </label>
                <input
                  id="uploadedDate"
                  type="date"
                  value={uploadedDate}
                  onChange={(e) => setUploadedDate(e.target.value)}
                  placeholder="Auto-set on upload"
                  className="font-mono-tabular mt-1.5 min-h-[42px] w-full rounded-lg border border-[#D8CEF0] bg-[#F5F2FC] px-3.5 py-2 text-sm font-medium text-[#4C1D95] focus:border-[#5B21B6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20"
                />
              </div>

              {/* Field 4: Total Amount */}
              <div>
                <label htmlFor="totalAmount" className="block text-xs font-semibold text-[#3B2863]">
                  Total Amount
                </label>
                <div className="mt-1.5 flex overflow-hidden rounded-lg border border-[#D8CEF0] bg-[#FAF9FC] focus-within:border-[#5B21B6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#5B21B6]/20">
                  <select
                    aria-label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="border-r border-[#D8CEF0] bg-[#EDE8F8] px-3 py-2 text-sm font-semibold text-[#3B2863] focus:outline-none"
                  >
                    <option value="₹">₹</option>
                    <option value="$">$</option>
                    <option value="€">€</option>
                    <option value="£">£</option>
                  </select>
                  <input
                    id="totalAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder={isScanning ? 'Scanning...' : '0.00'}
                    className="font-mono-tabular min-h-[42px] w-full bg-transparent px-3.5 py-2 text-base font-bold text-[#4C1D95] placeholder:font-normal placeholder:text-[#9388AA] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Spending Reason Box */}
            <div className="mt-5 rounded-xl border border-[#EAB308]/50 bg-[#FEFCE8] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="spendingReason" className="text-sm font-bold text-[#22103F]">
                  Spending Reason
                </label>
                <span className="text-xs text-[#713F12]">Required before saving to backend</span>
              </div>

              <textarea
                id="spendingReason"
                rows={2}
                value={spendingReason}
                onChange={(e) => setSpendingReason(e.target.value)}
                placeholder="Type why you spent this amount (e.g. Monthly groceries, Client lunch, Printer paper)..."
                className="mt-2 w-full rounded-lg border border-[#EAB308]/60 bg-white px-3.5 py-2.5 text-sm text-[#1E1035] placeholder:text-[#8E82A6] focus:border-[#5B21B6] focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20"
              />

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {suggestedReason && (
                  <button
                    type="button"
                    onClick={() => setSpendingReason(suggestedReason)}
                    className="rounded-md border border-[#5B21B6]/30 bg-[#EDE8F8] px-2.5 py-1 text-xs font-semibold text-[#4C1D95] transition-colors hover:bg-[#DDD6FE]"
                  >
                    Use scanned suggestion: {suggestedReason}
                  </button>
                )}
                {QUICK_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSpendingReason(reason)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      spendingReason === reason
                        ? 'border-[#5B21B6] bg-[#5B21B6] text-white'
                        : 'border-[#EAB308]/40 bg-white text-[#422006] hover:bg-[#FEF08A]'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-[#EDE8F8] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-[20px] text-xs">
              {saveError ? (
                <span className="font-medium text-[#DC2626]">{saveError}</span>
              ) : (
                <span className="text-[#5B526E]">
                  Saves receipt photo, dates, amount, and reason on the server.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving || isScanning}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#5B21B6] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4C1D95] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B21B6] whitespace-nowrap shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#FACC15]" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-[#FACC15]" />
                  Submit & Save Bill
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => void processAndScanImage(dataUrl)}
        onFallbackGallery={() => fileInputRef.current?.click()}
      />
    </section>
  );
}
