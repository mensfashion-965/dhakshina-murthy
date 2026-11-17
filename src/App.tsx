import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillRecord, BillsListResponse } from './types/bill';
import { BillScannerWorkspace } from './components/BillScannerWorkspace';
import { SpendingReasonDashboard } from './components/SpendingReasonDashboard';
import { ReceiptPreviewModal } from './components/ReceiptPreviewModal';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewBill, setPreviewBill] = useState<BillRecord | null>(null);

  const fetchBills = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/bills');
      const data = (await response.json()) as Partial<BillsListResponse> & { error?: string };
      if (!response.ok || !Array.isArray(data.bills)) {
        throw new Error(data.error || 'Could not load saved bills from server.');
      }
      setBills(data.bills);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to fetch saved bills.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBills();
  }, [fetchBills]);

  function handleBillSaved(newBill: BillRecord) {
    setBills((prev) => [newBill, ...prev]);
  }

  async function handleUpdateReason(id: string, nextReason: string) {
    const response = await fetch(`/api/bills/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spendingReason: nextReason }),
    });
    const data = (await response.json()) as { bill?: BillRecord; error?: string };
    if (!response.ok || !data.bill) {
      throw new Error(data.error || 'Failed to update spending reason.');
    }
    setBills((prev) => prev.map((b) => (b.id === id ? data.bill! : b)));
  }

  async function handleDeleteBill(id: string) {
    const response = await fetch(`/api/bills/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete bill.');
    }
    setBills((prev) => prev.filter((b) => b.id !== id));
  }

  function triggerUploadFromNav() {
    const scannerEl = document.getElementById('scanner');
    if (scannerEl) {
      scannerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    fileInputRef.current?.click();
  }

  return (
    <div className="min-h-screen bg-[#FAF9FC] text-[#1E1035]">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#381C66] bg-[#22103F]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <a
            href="#scanner"
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            BillTrack
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#DDD6FE] md:flex">
            <a
              href="#scanner"
              className="transition-colors hover:text-[#FACC15] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Scanner
            </a>
            <a
              href="#dashboard"
              className="transition-colors hover:text-[#FACC15] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Dashboard
            </a>
            <a
              href="#history"
              className="transition-colors hover:text-[#FACC15] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Saved Bills
            </a>
            <a
              href="#workflow"
              className="transition-colors hover:text-[#FACC15] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={triggerUploadFromNav}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#FACC15] px-4 py-2 text-xs font-bold text-[#22103F] transition-colors hover:bg-[#EAB308] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FACC15] whitespace-nowrap shrink-0"
            >
              Upload Bill
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 sm:py-10">
        <BillScannerWorkspace
          onBillSaved={handleBillSaved}
          fileInputRef={fileInputRef}
        />

        <div className="border-t border-[#E6DFF3]" />

        <SpendingReasonDashboard
          bills={bills}
          isLoading={isLoading}
          loadError={loadError}
          onRetryLoad={() => void fetchBills()}
          onUpdateReason={handleUpdateReason}
          onDeleteBill={handleDeleteBill}
          onPreviewBill={(bill) => setPreviewBill(bill)}
          onTriggerUpload={triggerUploadFromNav}
        />

        <div className="border-t border-[#E6DFF3]" />

        <section id="workflow" className="scroll-mt-20">
          <h2 className="text-lg font-bold text-[#1E1035]">How BillTrack Works</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[#E6DFF3] bg-white p-5">
              <p className="font-mono-tabular text-xs font-semibold text-[#5B21B6]">01. Capture or Upload</p>
              <h3 className="mt-1.5 text-sm font-semibold text-[#1E1035]">Camera or Gallery Photo</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5B526E]">
                Take a crisp photo of any paper receipt using your camera or pick an existing image from your gallery.
              </p>
            </div>

            <div className="rounded-xl border border-[#E6DFF3] bg-white p-5">
              <p className="font-mono-tabular text-xs font-semibold text-[#5B21B6]">02. Backend Vision Scan</p>
              <h3 className="mt-1.5 text-sm font-semibold text-[#1E1035]">Accurate Field Extraction</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#5B526E]">
                The server scans the bill image and auto-populates Shop Name, Bill Date, Uploaded Date, and Total Amount.
              </p>
            </div>

            <div className="rounded-xl border border-[#EAB308]/40 bg-[#FEFCE8] p-5">
              <p className="font-mono-tabular text-xs font-semibold text-[#713F12]">03. Save with Reason</p>
              <h3 className="mt-1.5 text-sm font-semibold text-[#22103F]">Stored on Server</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#713F12]">
                Type why you made the purchase, click Submit, and view it anytime in your Spending Reason Dashboard.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-[#E6DFF3] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-[#5B526E] sm:flex-row sm:px-6">
          <span>BillTrack · Automated Receipt & Spending Reason Ledger</span>
          <span>Powered by server-side receipt scanning and persistent storage</span>
        </div>
      </footer>

      <ReceiptPreviewModal bill={previewBill} onClose={() => setPreviewBill(null)} />
    </div>
  );
}
