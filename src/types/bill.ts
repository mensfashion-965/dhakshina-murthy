export interface ScannedBillData {
  shopName: string;
  billDate: string;
  rawDateText: string;
  totalAmount: number | null;
  currency: string;
  suggestedReason: string;
}

export interface BillRecord {
  id: string;
  shopName: string;
  billDate: string;
  uploadedDate: string;
  totalAmount: number;
  currency: string;
  spendingReason: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface ScanBillResponse {
  scanned: ScannedBillData;
}

export interface BillsListResponse {
  bills: BillRecord[];
}
