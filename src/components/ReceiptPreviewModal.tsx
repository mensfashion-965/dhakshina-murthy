import { X } from 'lucide-react';
import type { BillRecord } from '../types/bill';

interface ReceiptPreviewModalProps {
  bill: BillRecord | null;
  onClose: () => void;
}

export function ReceiptPreviewModal({ bill, onClose }: ReceiptPreviewModalProps) {
  if (!bill) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#180B2E]/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#D8CEF0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EDE8F8] px-5 py-4">
          <div className="min-w-0">
            <h2 id="receipt-modal-title" className="truncate text-base font-semibold text-[#1E1035]">
              {bill.shopName}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#5B526E]">
              <span className="font-mono-tabular">Bill Date: {bill.billDate}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">Uploaded: {bill.uploadedDate}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5B526E] transition-colors hover:bg-[#F5F2FC] hover:text-[#1E1035]"
            aria-label="Close receipt preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-12">
          <div className="md:col-span-7">
            {bill.imageUrl ? (
              <div className="overflow-hidden rounded-lg border border-[#E9E2F5] bg-[#FAF9FC]">
                <img
                  src={bill.imageUrl}
                  alt={`Receipt from ${bill.shopName}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[#D8CEF0] bg-[#FAF9FC] text-sm text-[#5B526E]">
                No receipt image attached.
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-4 md:col-span-5">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[#5B526E]">Total Amount</p>
                <p className="mt-1 font-mono-tabular text-2xl font-bold text-[#4C1D95]">
                  {bill.currency}
                  {bill.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="border-t border-[#EDE8F8] pt-3">
                <p className="text-xs font-medium text-[#5B526E]">Shop / Company</p>
                <p className="mt-1 text-sm font-semibold text-[#1E1035]">{bill.shopName}</p>
              </div>

              <div className="border-t border-[#EDE8F8] pt-3">
                <p className="text-xs font-medium text-[#5B526E]">Spending Reason</p>
                <p className="mt-1 rounded-lg border border-[#EAB308]/40 bg-[#FEFCE8] px-3 py-2 text-sm font-medium text-[#3B2863]">
                  {bill.spendingReason}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[40px] w-full items-center justify-center rounded-lg bg-[#5B21B6] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4C1D95]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
