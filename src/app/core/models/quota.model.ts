export interface QuotaInfo {
  weekCount: number;
  monthCount: number;
  weekLimit: number;
  monthLimit: number;
  canUpload: boolean;
  weekRemaining: number;
  monthRemaining: number;
}

export const QUOTA_LIMITS = {
  WEEKLY: 10,
  MONTHLY: 30,
} as const;
