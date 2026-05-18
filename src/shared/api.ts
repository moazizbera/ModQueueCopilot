export type ModerationCategory =
  | 'SPAM'
  | 'PROMOTION'
  | 'QUESTION'
  | 'DISCUSSION'
  | 'UNKNOWN';

export type ModerationDecision = 'approve' | 'remove' | 'review';

export type ModerationAction = ModerationDecision | 'reply';

export type ModerationScenarioId =
  | 'spam-crypto'
  | 'promotion-launch'
  | 'question-rules'
  | 'discussion-policy';

export type ModerationScenario = {
  id: ModerationScenarioId;
  label: string;
  summary: string;
  title: string;
  body: string;
  reportCount: number;
  score: number;
  numberOfComments: number;
};

export type ModerationMode = 'live-target' | 'seeded-demo';

export type ModerationPolicyProfileId =
  | 'balanced'
  | 'strict-spam'
  | 'community-support';

export type ModerationPolicyProfile = {
  id: ModerationPolicyProfileId;
  label: string;
  summary: string;
};

export type ModerationSignal = {
  label: string;
  detail: string;
  weight: number;
};

export type ModerationQueuePriority = 'critical' | 'high' | 'medium' | 'low';

export type ModerationRiskDimension = {
  label: string;
  score: number;
  summary: string;
};

export type ModerationCaseFile = {
  queuePriority: ModerationQueuePriority;
  recommendedRule: string;
  moderatorBrief: string;
  nextStep: string;
  evidenceSummary: string[];
  riskDimensions: ModerationRiskDimension[];
};

export type ModerationStatus = {
  approved: boolean;
  removed: boolean;
  spam: boolean;
  locked: boolean;
};

export type ModerationPostSnapshot = {
  id: string;
  subredditName: string;
  authorName: string;
  permalink: string;
  title: string;
  body: string;
  createdAt: string;
  score: number;
  numberOfComments: number;
  numberOfReports: number;
  url: string;
  status: ModerationStatus;
  source: 'linked-target' | 'seeded-scenario';
};

export type ModerationAnalysis = {
  category: ModerationCategory;
  decision: ModerationDecision;
  reason: string;
  confidence: number;
  replySuggestion: string;
  signals: ModerationSignal[];
  caseFile: ModerationCaseFile;
  analysisMode: 'heuristic';
};

export type ModerationAudit = {
  lastAction: ModerationAction | null;
  lastActionAt: string | null;
  lastReplyText: string | null;
};

export type ModerationActivityEventType =
  | 'approve'
  | 'remove'
  | 'review'
  | 'reply'
  | 'link-live-post'
  | 'switch-policy'
  | 'switch-scenario';

export type ModerationActivityItem = {
  id: string;
  eventType: ModerationActivityEventType;
  createdAt: string;
  title: string;
  detail: string;
  mode: ModerationMode;
  subredditName: string;
  authorName: string;
  category: ModerationCategory | null;
  decision: ModerationDecision | null;
};

export type ModerationImpactSummary = {
  totalActions: number;
  approvals: number;
  removals: number;
  reviews: number;
  replies: number;
  liveLinks: number;
  scenarioSwitches: number;
  highRiskIntercepts: number;
  estimatedMinutesSaved: number;
  lastUpdatedAt: string | null;
};

export type ModerationPolicySimulation = {
  policyProfile: ModerationPolicyProfile;
  decision: ModerationDecision;
  category: ModerationCategory;
  confidence: number;
  reason: string;
};

export type ModerationDashboardResponse = {
  type: 'dashboard';
  generatedAt: string;
  mode: ModerationMode;
  moderatorUsername: string;
  post: ModerationPostSnapshot;
  analysis: ModerationAnalysis;
  audit: ModerationAudit;
  impact: ModerationImpactSummary;
  recentActivity: ModerationActivityItem[];
  activePolicyProfile: ModerationPolicyProfile;
  policyProfiles: ModerationPolicyProfile[];
  policySimulations: ModerationPolicySimulation[];
  activeScenario: ModerationScenario | null;
  scenarios: ModerationScenario[];
};

export type ModerationActionRequest = {
  action: ModerationAction;
  replyText?: string;
};

export type ModerationActionResponse = {
  type: 'action';
  action: ModerationAction;
  toastMessage: string;
  dashboard: ModerationDashboardResponse;
};

export type ModerationScenarioRequest = {
  scenarioId: ModerationScenarioId;
};

export type ModerationScenarioResponse = {
  type: 'scenario';
  toastMessage: string;
  dashboard: ModerationDashboardResponse;
};

export type ModerationPolicyProfileRequest = {
  policyProfileId: ModerationPolicyProfileId;
};

export type ModerationPolicyProfileResponse = {
  type: 'policy-profile';
  toastMessage: string;
  dashboard: ModerationDashboardResponse;
};

export type ModerationTargetPostRequest = {
  targetPost: string;
};

export type ModerationTargetPostResponse = {
  type: 'target-post';
  toastMessage: string;
  dashboard: ModerationDashboardResponse;
};

export type ApiErrorResponse = {
  status: 'error';
  message: string;
};
