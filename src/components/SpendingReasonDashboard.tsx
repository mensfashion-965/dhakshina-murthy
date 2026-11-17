import { useMemo, useState } from 'react';
import { Download, Eye, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import type { BillRecord } from '../types/bill';

interface SpendingReasonDashboardProps {
  bills: BillRecord[];
  isLoading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  onUpdateReason: (id: string, nextReason: string) => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  onPreviewBill: (bill: BillRecord) => void;
  onTriggerUpload: () => void;
}

function formatMoney(amount: number, currency: string): string {
  return `${currency}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SpendingReasonDashboard({
  bills,
  isLoading,
  loadError,
  onRetryLoad,
  onUpdateReason,
  onDeleteBill,
  onPreviewBill,
  onTriggerUpload,
}: SpendingReasonDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReasonFilter, setSelectedReasonFilter] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const primaryCurrency = bills[0]?.currency || '₹';

  const stats = useMemo(() => {
    const total = bills.reduce((sum, b) => sum + b.totalAmount, 0);
    const count = bills.length;
    const avg = count > 0 ? total / count : 0;
    const latestUpload = bills[0]?.uploadedDate || '—';
    return { total, count, avg, latestUpload };
  }, [bills]);

  const reasonBreakdown = useMemo(() => {
    const groups = new Map<string, { reason: string; total: number; count: number }>();
    for (const bill of bills) {
      const label = bill.spendingReason.trim() || 'Unspecified';
      const key = label.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        existing.total += bill.totalAmount;
        existing.count += 1;
      } else {
        groups.set(key, { reason: label, total: bill.totalAmount, count: 1 });
      }
    }
    const items = Array.from(groups.values()).sort((a, b) => b.total - a.total);
    const maxTotal = items[0]?.total || 1;
    return items.map((item) => ({
      ...item,
      sharePercent: Math.max(4, Math.round((item.total / maxTotal) * 100)),
    }));
  }, [bills]);

  const filteredBills = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bills.filter((bill) => {
      const matchesReason =
        selectedReasonFilter === 'ALL' ||
        bill.spendingReason.trim().toLowerCase() === selectedReasonFilter.toLowerCase();
      if (!matchesReason) return false;
      if (!q) return true;
      return (
        bill.shopName.toLowerCase().includes(q) ||
        bill.spendingReason.toLowerCase().includes(q) ||
        bill.billDate.toLowerCase().includes(q)
      );
    });
  }, [bills, searchQuery, selectedReasonFilter]);

  function handleExportCsv() {
    if (filteredBills.length === 0) return;
    const headers = ['Shop Name', 'Bill Date', 'Uploaded Date', 'Spending Reason', 'Currency', 'Total Amount'];
    const rows = filteredBills.map((b) => [
      `"${b.shopName.replaceAll('"', '""')}"`,
      b.billDate,
      b.uploadedDate,
      `"${b.spendingReason.replaceAll('"', '""')}"`,
      b.currency,
      b.totalAmount.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billtrack-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitReasonEdit(id: string) {
    if (!editingText.trim()) return;
    setBusyId(id);
    try {
      await onUpdateReason(id, editingText.trim());
      setEditingId(null);
      setEditingText('');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(id: string) {
    setBusyId(id);
    try {
      await onDeleteBill(id);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="dashboard" className="scroll-mt-20 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1E1035]">
            Spending Reason Dashboard
          </h2>
          <p className="mt-1 text-sm text-[#5B526E]">
            Every scanned receipt saved on the backend, organized by your spending reason.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={filteredBills.length === 0}
          className="inline-flex min-h-[40px] items-center gap-2 self-start rounded-lg border border-[#D8CEF0] bg-white px-4 py-2 text-xs font-semibold text-[#3B2863] transition-colors hover:bg-[#F5F2FC] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Download className="h-4 w-4 text-[#5B21B6]" />
          Export CSV
        </button>
      </div>

      {/* 4-Column KPI Summary Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E6DFF3] bg-white p-4">
          <p className="text-xs font-medium text-[#5B526E]">Total Tracked Spend</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#4C1D95]">
            {formatMoney(stats.total, primaryCurrency)}
          </p>
        </div>
        <div className="rounded-xl border border-[#E6DFF3] bg-white p-4">
          <p className="text-xs font-medium text-[#5B526E]">Bills Saved</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#1E1035]">
            {stats.count}
          </p>
        </div>
        <div className="rounded-xl border border-[#E6DFF3] bg-white p-4">
          <p className="text-xs font-medium text-[#5B526E]">Average Per Bill</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#1E1035]">
            {formatMoney(stats.avg, primaryCurrency)}
          </p>
        </div>
        <div className="rounded-xl border border-[#EAB308]/40 bg-[#FEFCE8] p-4">
          <p className="text-xs font-medium text-[#713F12]">Latest Upload Date</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#22103F]">
            {stats.latestUpload}
          </p>
        </div>
      </div>

      {/* Spending Reason Breakdown Panel */}
      {!isLoading && bills.length > 0 && (
        <div className="rounded-xl border border-[#E6DFF3] bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#1E1035]">Spend by Reason</h3>
              <p className="text-xs text-[#5B526E]">
                Click any spending reason bar to filter the saved bills ledger below.
              </p>
            </div>
            {selectedReasonFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedReasonFilter('ALL')}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#EDE8F8] px-2.5 py-1 text-xs font-semibold text-[#4C1D95] hover:bg-[#DDD6FE]"
              >
                <X className="h-3.5 w-3.5" />
                Clear reason filter
              </button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {reasonBreakdown.map((item, idx) => {
              const isSelected =
                selectedReasonFilter.toLowerCase() === item.reason.toLowerCase();
              return (
                <button
                  key={item.reason}
                  type="button"
                  onClick={() =>
                    setSelectedReasonFilter(isSelected ? 'ALL' : item.reason)
                  }
                  className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-[#5B21B6] bg-[#F5F2FC]'
                      : 'border-[#EDE8F8] bg-[#FAF9FC] hover:border-[#D8CEF0]'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-[#1E1035]">
                      {item.reason}
                    </span>
                    <span className="font-mono-tabular text-sm font-bold text-[#4C1D95] shrink-0">
                      {formatMoney(item.total, primaryCurrency)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#EDE8F8]">
                    <div
                      className={`h-full rounded-full ${
                        idx % 2 === 0 ? 'bg-[#5B21B6]' : 'bg-[#EAB308]'
                      }`}
                      style={{ width: `${item.sharePercent}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#5B526E]">
                    {item.count} {item.count === 1 ? 'bill' : 'bills'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Bills Ledger */}
      <div id="history" className="scroll-mt-20 rounded-xl border border-[#E6DFF3] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#EDE8F8] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#1E1035]">Saved Bills Ledger</h3>
            <span className="text-xs text-[#5B526E]">
              · {filteredBills.length} shown
            </span>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8E82A6]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shop, reason, or date..."
              className="min-h-[40px] w-full rounded-lg border border-[#D8CEF0] bg-[#FAF9FC] py-2 pr-3 pl-9 text-sm text-[#1E1035] placeholder:text-[#8E82A6] focus:border-[#5B21B6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5B21B6]/20"
            />
          </div>
        </div>

        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#DC2626]">{loadError}</p>
            <button
              type="button"
              onClick={onRetryLoad}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#5B21B6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4C1D95]"
            >
              Retry Loading Bills
            </button>
          </div>
        ) : isLoading ? (
          <div className="divide-y divide-[#EDE8F8]">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-[#EDE8F8]" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-36 animate-pulse rounded bg-[#EDE8F8]" />
                    <div className="h-3 w-24 animate-pulse rounded bg-[#F5F2FC]" />
                  </div>
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-[#EDE8F8]" />
              </div>
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <p className="text-base font-semibold text-[#1E1035]">No bills saved yet</p>
            <p className="max-w-md text-sm text-[#5B526E]">
              Upload a receipt photo or snap one with your camera above. Your shop name, bill date, total amount, and spending reason will appear here.
            </p>
            <button
              type="button"
              onClick={onTriggerUpload}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#FACC15] px-5 py-2.5 text-sm font-semibold text-[#22103F] transition-colors hover:bg-[#EAB308]"
            >
              <Upload className="h-4 w-4" />
              Scan Your First Bill
            </button>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#1E1035]">No matching bills found</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedReasonFilter('ALL');
              }}
              className="mt-2 text-xs font-semibold text-[#5B21B6] underline"
            >
              Reset search and filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EDE8F8] bg-[#FAF9FC] text-xs font-semibold text-[#5B526E]">
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Shop / Company</th>
                  <th className="px-4 py-3">Bill Date</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Spending Reason</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE8F8] text-sm">
                {filteredBills.map((bill) => {
                  const isEditing = editingId === bill.id;
                  const isConfirmingDelete = confirmDeleteId === bill.id;
                  const isBusy = busyId === bill.id;

                  return (
                    <tr key={bill.id} className="transition-colors hover:bg-[#FAF9FC]">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onPreviewBill(bill)}
                          className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-[#D8CEF0] bg-[#F5F2FC]"
                          aria-label={`View receipt from ${bill.shopName}`}
                        >
                          {bill.imageUrl ? (
                            <img
                              src={bill.imageUrl}
                              alt={`Receipt thumbnail for ${bill.shopName}`}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Eye className="h-4 w-4 text-[#5B21B6]" />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 font-semibold text-[#1E1035]">
                        {bill.shopName}
                      </td>

                      <td className="font-mono-tabular px-4 py-3 text-xs text-[#3B2863]">
                        {bill.billDate}
                      </td>

                      <td className="font-mono-tabular px-4 py-3 text-xs text-[#5B526E]">
                        {bill.uploadedDate}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="min-h-[34px] w-full max-w-[220px] rounded-md border border-[#5B21B6] bg-white px-2.5 py-1 text-xs text-[#1E1035] focus:outline-none"
                              aria-label="Edit spending reason"
                            />
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void submitReasonEdit(bill.id)}
                              className="rounded-md bg-[#5B21B6] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#4C1D95]"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-[#5B526E] hover:text-[#1E1035]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#22103F]">{bill.spendingReason}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(bill.id);
                                setEditingText(bill.spendingReason);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#8E82A6] transition-colors hover:bg-[#EDE8F8] hover:text-[#5B21B6]"
                              aria-label={`Edit reason for ${bill.shopName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="font-mono-tabular px-4 py-3 text-right font-bold text-[#4C1D95]">
                        {formatMoney(bill.totalAmount, bill.currency)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void confirmDelete(bill.id)}
                              className="rounded-md bg-[#DC2626] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#B91C1C]"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs font-medium text-[#5B526E] hover:text-[#1E1035]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onPreviewBill(bill)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5B526E] transition-colors hover:bg-[#EDE8F8] hover:text-[#5B21B6]"
                              aria-label={`Inspect ${bill.shopName}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(bill.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#5B526E] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                              aria-label={`Delete ${bill.shopName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
