
export enum CallScenario {
  FRESH_OUTBOUND = 'Fresh Outbound (NSD)',
  FOLLOW_UP = 'Follow-up Call'
}

export enum CustomerPersonality {
  CURIOUS = 'Curious',
  UNINTERESTED = 'Uninterested',
  ANGRY = 'Angry/Frustrated',
  PRICE_SENSITIVE = 'Price Sensitive'
}

export interface SellerActivity {
  action: string;
  time: string;
}

export interface SimilarSeller {
  name: string;
  company: string;
  package: 'TSCATALOG' | 'STAR' | 'LEADER' | 'CATALOG';
}

export interface SellerProfile {
  id: string; // GL ID
  name: string;
  companyName: string;
  businessType: string;
  products: string; // Summary string for prompt
  productList: string[]; // Detailed list
  productPhotoCount: number;
  location: string;
  gender: 'Male' | 'Female';
  address: string;
  industryType: string;
  catalogScore: number;
  mobile: string;
  email: string;
  gst: string;
  verificationStatus: {
    mobile: boolean;
    email: boolean;
    appInstalled: boolean;
    gstVerified: boolean;
  };
  similarSellers: SimilarSeller[];
  activities: SellerActivity[];
  customInstructions?: string; // Specific behavioral notes from call logs
}

export interface CallConfig {
  employeeId: string;
  executiveName: string;
  scenario: CallScenario;
  personality: CustomerPersonality;
  customerScript: string;
  executiveScript: string;
  selectedSeller: SellerProfile;
}

export interface AuditParameter {
  parameter: string;
  score: number; // Score given (e.g., 0, 5, 10)
  maxScore: number; // Max possible score
  remarks: string; // Brief reason
}

export interface AuditCategory {
  category: string;
  items: AuditParameter[];
  totalScore: number;
  maxTotalScore: number;
}

export interface EvaluationResult {
  overallScore: number;
  auditReport: AuditCategory[]; // The detailed table from PDF
  strengths: string[];
  improvements: string[];
  actionPoints: string[];
  summary: string;
  isShortCall?: boolean;
  meetingFixed: boolean;
  meetingTime?: string;
  sentiment: {
    score: number; // 0-100 (0=Rude, 100=Calm/Professional)
    label: string; // e.g. "Calm & Professional", "Aggressive"
    analysis: string; // Short explanation
  };
}

export type AudioStatus = 'idle' | 'connecting' | 'connected' | 'error';
