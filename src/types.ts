export type SubscriptionTier = "free" | "pro";
export type CodeLanguage = "en" | "my";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  tier: SubscriptionTier;
  createdAt: any;
}

export interface GrammaDoc {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  ownerEmail: string;
  language: CodeLanguage;
  collaborators: string[]; // List of user emails or userIds invited
  createdAt: any;
  updatedAt: any;
}

export interface GrammarIssue {
  original: string;
  replacement: string;
  offset: number;
  length: number;
  explanation: string;
  explanation_my: string; // Myanmar translation explanation
}

export interface Revision {
  id: string;
  documentId: string;
  content: string;
  originalContent: string;
  corrections: GrammarIssue[];
  createdAt: any;
  authorId: string;
}
