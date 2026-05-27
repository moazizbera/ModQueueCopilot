import { context, redis, reddit } from '@devvit/web/server';
import type { Post } from '@devvit/web/server';
import { isT3 } from '@devvit/shared-types/tid.js';
import type { T3 } from '@devvit/shared-types/tid.js';
import type {
  ModerationAction,
  ModerationActionRequest,
  ModerationActionResponse,
  ModerationActivityEventType,
  ModerationActivityItem,
  ModerationAnalysis,
  ModerationAudit,
  ModerationCaseFile,
  ModerationCategory,
  ModerationDashboardResponse,
  ModerationDecision,
  ModerationImpactSummary,
  ModerationPolicyProfile,
  ModerationPolicyProfileId,
  ModerationPolicySimulation,
  ModerationQueuePriority,
  ModerationRiskDimension,
  ModerationPostSnapshot,
  ModerationScenario,
  ModerationScenarioId,
  ModerationSignal,
} from '../../shared/api';
import {
  defaultScenarioId,
  getModerationScenario,
  getModerationScenarios,
  isModerationScenarioId,
  pickModerationScenario,
} from './scenarios';

type PersistedAuditState = {
  lastAction: ModerationAction | null;
  lastActionAt: string | null;
  lastReplyText: string | null;
};

type PersistedPostData = {
  policyProfileId?: ModerationPolicyProfileId;
  scenarioId?: ModerationScenarioId;
  scenarioVariantIndex?: number;
  targetPostId?: T3;
};

type PersistedImpactState = ModerationImpactSummary & {
  recentActivity: ModerationActivityItem[];
};

type AnalysisInput = {
  authorName: string;
  body: string;
  createdAt: Date;
  id: string;
  numberOfComments: number;
  numberOfReports: number;
  permalink: string;
  score: number;
  status: {
    approved: boolean;
    locked: boolean;
    removed: boolean;
    spam: boolean;
  };
  subredditName: string;
  title: string;
  url: string;
};

type AuthorRiskContext = {
  priorApprovals: number;
  priorFlaggedActions: number;
  priorRemovals: number;
  priorReviews: number;
  lastFlaggedAt: string | null;
};

type CategoryScore = Record<ModerationCategory, number>;

const AUDIT_PREFIX = 'modqueue:audit:';
const IMPACT_PREFIX = 'modqueue:impact:';
const RECENT_ACTIVITY_LIMIT = 8;
const bodyPreviewLimit = 640;
const questionStarters = [
  'how',
  'what',
  'why',
  'where',
  'when',
  'who',
  'can',
  'should',
  'is',
  'are',
  'does',
  'do',
  'help',
];
const spamKeywords = [
  'guaranteed returns',
  'double your money',
  'dm me now',
  'whatsapp',
  'telegram',
  'airdrop',
  'crypto signal',
  'forex signal',
  'investment opportunity',
  'guaranteed income',
  'passive income',
  'earn money fast',
  'make money fast',
  'no experience needed',
  '100% legit',
  'risk free',
  'work from home',
  'instant approval',
  'click here',
  'act now',
];
const promotionKeywords = [
  'subscribe',
  'promo code',
  'discount',
  'sign up',
  'join our',
  'newsletter',
  'sponsored',
  'launching',
  'shop now',
  'limited offer',
  'buy now',
  'free trial',
];
const discussionKeywords = [
  'discussion',
  'thoughts',
  'opinion',
  'debate',
  'experience',
  'let us talk',
  'community view',
  'what do you think',
];
const earningsClaimPattern =
  /\b(?:earn|make|get)\s+\$?\d[\d,]*(?:\s*(?:fast|quick|daily|weekly|today|now))?/i;
const cryptoCashPitchPattern =
  /\bcrypto\b.*\b(?:earn|make|get|profit|cash)\b|\b(?:earn|make|get|profit|cash)\b.*\bcrypto\b/i;
const urgencyPattern =
  /\b(?:fast|quick|instant|immediately|today only|limited time|urgent|act now|right now)\b/i;
const contactRoutingPattern =
  /\b(?:dm|pm|message|text|contact)\b.*\b(?:me|now|directly)\b|\b(?:whatsapp|telegram|discord|signal|cash app|cashapp)\b/i;
const investmentScamPattern =
  /\b(?:investment|trading|forex|crypto|bitcoin|usdt|airdrop)\b.*\b(?:guaranteed|returns?|profit|income|signals?)\b|\b(?:guaranteed|returns?|profit|income|signals?)\b.*\b(?:investment|trading|forex|crypto|bitcoin|usdt|airdrop)\b/i;
const excessivePunctuationPattern = /!{3,}|\?{3,}/;
const policyProfiles: ModerationPolicyProfile[] = [
  {
    id: 'balanced',
    label: 'Balanced Ops',
    summary: 'Default profile that balances safety, spam control, and moderator review load.',
  },
  {
    id: 'strict-spam',
    label: 'Strict Spam Shield',
    summary: 'Aggressive posture for fast-moving queues with higher spam and promo pressure.',
  },
  {
    id: 'community-support',
    label: 'Community Support',
    summary: 'More forgiving posture for Q&A and discussion-heavy communities.',
  },
];
const defaultPolicyProfileId: ModerationPolicyProfileId = 'balanced';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const createEmptyScores = (): CategoryScore => ({
  DISCUSSION: 0,
  PROMOTION: 0,
  QUESTION: 0,
  SPAM: 0,
  UNKNOWN: 0,
});

const pushSignal = (
  signals: ModerationSignal[],
  scores: CategoryScore,
  category: ModerationCategory,
  weight: number,
  label: string,
  detail: string
): void => {
  scores[category] += weight;
  signals.push({ detail, label, weight });
};

const countMatches = (source: string, tokens: string[]): number =>
  tokens.reduce(
    (count, token) => (source.includes(token) ? count + 1 : count),
    0
  );

const countUrls = (source: string): number => {
  const matches = source.match(/https?:\/\/\S+|www\.\S+/g);
  return matches?.length ?? 0;
};

const countUppercaseCharacters = (source: string): number => {
  const lettersOnly = source.replace(/[^a-z]/gi, '');
  if (!lettersOnly) {
    return 0;
  }

  const uppercaseLetters = lettersOnly.replace(/[^A-Z]/g, '');
  return Math.round((uppercaseLetters.length / lettersOnly.length) * 100);
};

const normaliseBody = (body: string | undefined): string => body?.trim() ?? '';

const isModerationPolicyProfileId = (
  value: unknown
): value is ModerationPolicyProfileId =>
  typeof value === 'string' && policyProfiles.some((profile) => profile.id === value);

const getModerationPolicyProfile = (
  profileId: ModerationPolicyProfileId
): ModerationPolicyProfile => {
  const matchedProfile = policyProfiles.find((profile) => profile.id === profileId);
  return (
    matchedProfile ?? {
      id: 'balanced',
      label: 'Balanced Ops',
      summary: 'Default profile that balances safety, spam control, and moderator review load.',
    }
  );
};

const impactKey = (subredditName: string): string =>
  `${IMPACT_PREFIX}${subredditName.toLowerCase()}`;

const createEmptyImpactState = (): PersistedImpactState => ({
  approvals: 0,
  estimatedMinutesSaved: 0,
  highRiskIntercepts: 0,
  lastUpdatedAt: null,
  liveLinks: 0,
  recentActivity: [],
  removals: 0,
  replies: 0,
  reviews: 0,
  scenarioSwitches: 0,
  totalActions: 0,
});

const createEmptyAuthorRiskContext = (): AuthorRiskContext => ({
  lastFlaggedAt: null,
  priorApprovals: 0,
  priorFlaggedActions: 0,
  priorRemovals: 0,
  priorReviews: 0,
});

const estimateMinutesSaved = (
  action: ModerationAction,
  mode: 'live-target' | 'seeded-demo'
): number => {
  switch (action) {
    case 'remove':
      return mode === 'live-target' ? 12 : 9;
    case 'approve':
      return mode === 'live-target' ? 6 : 4;
    case 'review':
      return 5;
    case 'reply':
      return 7;
  }
};

const readImpactState = async (subredditName: string): Promise<PersistedImpactState> => {
  const persisted = await redis.get(impactKey(subredditName));

  if (typeof persisted !== 'string') {
    return createEmptyImpactState();
  }

  try {
    const parsed = JSON.parse(persisted) as Partial<PersistedImpactState>;
    return {
      approvals: parsed.approvals ?? 0,
      estimatedMinutesSaved: parsed.estimatedMinutesSaved ?? 0,
      highRiskIntercepts: parsed.highRiskIntercepts ?? 0,
      lastUpdatedAt: parsed.lastUpdatedAt ?? null,
      liveLinks: parsed.liveLinks ?? 0,
      recentActivity: parsed.recentActivity ?? [],
      removals: parsed.removals ?? 0,
      replies: parsed.replies ?? 0,
      reviews: parsed.reviews ?? 0,
      scenarioSwitches: parsed.scenarioSwitches ?? 0,
      totalActions: parsed.totalActions ?? 0,
    };
  } catch (error) {
    console.error(`Failed to parse impact state for subreddit ${subredditName}:`, error);
    return createEmptyImpactState();
  }
};

const writeImpactState = async (
  subredditName: string,
  impact: PersistedImpactState
): Promise<void> => {
  await redis.set(impactKey(subredditName), JSON.stringify(impact));
};

const pushActivity = (
  currentItems: ModerationActivityItem[],
  item: ModerationActivityItem
): ModerationActivityItem[] => [item, ...currentItems].slice(0, RECENT_ACTIVITY_LIMIT);

const buildAuthorRiskContext = (
  recentActivity: ModerationActivityItem[],
  authorName: string
): AuthorRiskContext => {
  const normalizedAuthorName = authorName.trim().toLowerCase();

  if (!normalizedAuthorName) {
    return createEmptyAuthorRiskContext();
  }

  return recentActivity.reduce<AuthorRiskContext>((summary, item) => {
    if (item.authorName.trim().toLowerCase() !== normalizedAuthorName) {
      return summary;
    }

    if (item.eventType === 'approve') {
      summary.priorApprovals += 1;
    }

    if (item.eventType === 'remove') {
      summary.priorRemovals += 1;
      summary.priorFlaggedActions += 1;
      summary.lastFlaggedAt = summary.lastFlaggedAt ?? item.createdAt;
    }

    if (item.eventType === 'review') {
      summary.priorReviews += 1;
      summary.priorFlaggedActions += 1;
      summary.lastFlaggedAt = summary.lastFlaggedAt ?? item.createdAt;
    }

    return summary;
  }, createEmptyAuthorRiskContext());
};

const createActivityItem = ({
  authorName,
  category,
  createdAt,
  decision,
  detail,
  eventType,
  mode,
  subredditName,
  title,
}: {
  authorName: string;
  category: ModerationCategory | null;
  createdAt: string;
  decision: ModerationDecision | null;
  detail: string;
  eventType: ModerationActivityEventType;
  mode: 'live-target' | 'seeded-demo';
  subredditName: string;
  title: string;
}): ModerationActivityItem => ({
  authorName,
  category,
  createdAt,
  decision,
  detail,
  eventType,
  id: `${eventType}:${createdAt}:${title}`,
  mode,
  subredditName,
  title,
});

const recordImpactEvent = async ({
  activity,
  action,
  incrementLiveLinks,
  incrementScenarioSwitches,
  subredditName,
}: {
  activity: ModerationActivityItem;
  action?: ModerationAction;
  incrementLiveLinks?: boolean;
  incrementScenarioSwitches?: boolean;
  subredditName: string;
}): Promise<void> => {
  const currentImpact = await readImpactState(subredditName);
  const nextImpact: PersistedImpactState = {
    ...currentImpact,
    lastUpdatedAt: activity.createdAt,
    liveLinks: currentImpact.liveLinks + (incrementLiveLinks ? 1 : 0),
    recentActivity: pushActivity(currentImpact.recentActivity, activity),
    scenarioSwitches:
      currentImpact.scenarioSwitches + (incrementScenarioSwitches ? 1 : 0),
  };

  if (action) {
    nextImpact.totalActions += 1;
    nextImpact.estimatedMinutesSaved += estimateMinutesSaved(action, activity.mode);

    switch (action) {
      case 'approve':
        nextImpact.approvals += 1;
        break;
      case 'remove':
        nextImpact.removals += 1;
        if (activity.category === 'SPAM' || activity.category === 'PROMOTION') {
          nextImpact.highRiskIntercepts += 1;
        }
        break;
      case 'review':
        nextImpact.reviews += 1;
        break;
      case 'reply':
        nextImpact.replies += 1;
        break;
    }
  }

  await writeImpactState(subredditName, nextImpact);
};

const readScenarioIdFromPostData = async (
  post: Post
): Promise<ModerationScenarioId> => {
  const postData = await post.getPostData();

  if (!postData || typeof postData !== 'object' || Array.isArray(postData)) {
    return defaultScenarioId;
  }

  const scenarioId = Reflect.get(postData, 'scenarioId');
  return isModerationScenarioId(scenarioId) ? scenarioId : defaultScenarioId;
};

const readScenarioVariantIndexFromPostData = async (
  post: Post
): Promise<number> => {
  const postData = await post.getPostData();

  if (!postData || typeof postData !== 'object' || Array.isArray(postData)) {
    return 0;
  }

  const scenarioVariantIndex = Reflect.get(postData, 'scenarioVariantIndex');
  return typeof scenarioVariantIndex === 'number' && Number.isInteger(scenarioVariantIndex)
    ? scenarioVariantIndex
    : 0;
};

const readTargetPostIdFromPostData = async (
  post: Post
): Promise<T3 | null> => {
  const postData = await post.getPostData();

  if (!postData || typeof postData !== 'object' || Array.isArray(postData)) {
    return null;
  }

  const targetPostId = Reflect.get(postData, 'targetPostId');
  return typeof targetPostId === 'string' && isT3(targetPostId)
    ? targetPostId
    : null;
};

const readPolicyProfileIdFromPostData = async (
  post: Post
): Promise<ModerationPolicyProfileId> => {
  const postData = await post.getPostData();

  if (!postData || typeof postData !== 'object' || Array.isArray(postData)) {
    return defaultPolicyProfileId;
  }

  const policyProfileId = Reflect.get(postData, 'policyProfileId');
  return isModerationPolicyProfileId(policyProfileId)
    ? policyProfileId
    : defaultPolicyProfileId;
};

const createReason = (
  category: ModerationCategory,
  decision: ModerationDecision,
  signals: ModerationSignal[]
): string => {
  const topSignals = signals
    .slice()
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2)
    .map((signal) => signal.detail.toLowerCase());

  const signalSummary =
    topSignals.length > 0 ? ` Signals: ${topSignals.join('; ')}.` : '';

  switch (category) {
    case 'SPAM':
      return `Heuristic spam pattern detected, recommend ${decision}.${signalSummary}`;
    case 'PROMOTION':
      return `Promotional intent dominates the post, recommend ${decision}.${signalSummary}`;
    case 'QUESTION':
      return `This reads like a good-faith question, recommend ${decision}.${signalSummary}`;
    case 'DISCUSSION':
      return `This reads like discussion content, recommend ${decision}.${signalSummary}`;
    default:
      return `Signals are mixed, recommend ${decision}.${signalSummary}`;
  }
};

const createReplySuggestion = (
  category: ModerationCategory,
  decision: ModerationDecision,
  subredditName: string
): string => {
  if (decision === 'remove') {
    return `Hi, your post has been removed by the moderation team for ${category.toLowerCase()}-style signals. Please review the rules in r/${subredditName} and resubmit with clearer context if appropriate.`;
  }

  if (decision === 'review') {
    return `Thanks for the submission. A moderator is reviewing this post because it triggered our ${category.toLowerCase()} heuristic checks. If there is missing context, feel free to clarify in a comment.`;
  }

  if (category === 'QUESTION') {
    return `Thanks for asking this clearly. The post looks acceptable for r/${subredditName}; moderators may still step in if rule-specific issues appear.`;
  }

  return `Thanks for contributing to r/${subredditName}. The post currently looks suitable for the queue, and moderators will keep an eye on follow-up reports.`;
};

const chooseCategory = (scores: CategoryScore): {
  category: ModerationCategory;
  margin: number;
  topScore: number;
} => {
  const ranked = (Object.entries(scores) as [ModerationCategory, number][]).sort(
    (left, right) => right[1] - left[1]
  );
  const [topCategory, topScore] = ranked[0] ?? ['UNKNOWN', 0];
  const secondScore = ranked[1]?.[1] ?? 0;

  if (topScore < 8) {
    return {
      category: 'UNKNOWN',
      margin: topScore,
      topScore,
    };
  }

  return {
    category: topCategory,
    margin: topScore - secondScore,
    topScore,
  };
};

const chooseDecision = (
  category: ModerationCategory,
  confidence: number,
  reportCount: number,
  urlCount: number,
  score: number,
  policyProfileId: ModerationPolicyProfileId
): ModerationDecision => {
  if (policyProfileId === 'strict-spam') {
    if (category === 'SPAM') {
      return confidence >= 68 || reportCount > 0 || urlCount >= 1
        ? 'remove'
        : 'review';
    }

    if (category === 'PROMOTION') {
      return confidence >= 78 && urlCount > 0 ? 'remove' : 'review';
    }

    if (category === 'QUESTION' || category === 'DISCUSSION') {
      return reportCount >= 1 || score < 0 ? 'review' : 'approve';
    }

    return 'review';
  }

  if (policyProfileId === 'community-support') {
    if (category === 'SPAM') {
      return confidence >= 84 || reportCount > 1 || urlCount >= 3
        ? 'remove'
        : 'review';
    }

    if (category === 'PROMOTION') {
      return confidence >= 92 && urlCount > 1 ? 'remove' : 'review';
    }

    if (category === 'QUESTION' || category === 'DISCUSSION') {
      return reportCount >= 3 || score < -5 ? 'review' : 'approve';
    }

    return 'review';
  }

  if (category === 'SPAM') {
    return confidence >= 75 || reportCount > 0 || urlCount >= 2
      ? 'remove'
      : 'review';
  }

  if (category === 'PROMOTION') {
    return confidence >= 86 && urlCount > 0 ? 'remove' : 'review';
  }

  if (category === 'QUESTION' || category === 'DISCUSSION') {
    return reportCount >= 2 || score < -3 ? 'review' : 'approve';
  }

  return 'review';
};

const chooseQueuePriority = (
  decision: ModerationDecision,
  confidence: number,
  reportCount: number,
  topSignalWeight: number
): ModerationQueuePriority => {
  if (decision === 'remove' && (confidence >= 90 || reportCount >= 2 || topSignalWeight >= 20)) {
    return 'critical';
  }

  if (decision === 'remove' || confidence >= 82 || reportCount >= 1) {
    return 'high';
  }

  if (decision === 'review' || confidence >= 60) {
    return 'medium';
  }

  return 'low';
};

const createRiskDimensions = ({
  authorRiskContext,
  reportCount,
  score,
  signals,
  urlCount,
}: {
  authorRiskContext: AuthorRiskContext;
  reportCount: number;
  score: number;
  signals: ModerationSignal[];
  urlCount: number;
}): ModerationRiskDimension[] => {
  const spamPressure = clamp(
    signals
      .filter((signal) => signal.weight >= 10)
      .reduce((total, signal) => total + signal.weight, 0),
    0,
    100
  );
  const communityEscalation = clamp(reportCount * 24 + (score < 0 ? 12 : 0), 0, 100);
  const authorRisk = clamp(
    authorRiskContext.priorFlaggedActions * 18 + authorRiskContext.priorRemovals * 12,
    0,
    100
  );
  const promotionSurface = clamp(urlCount * 28 + (signals.some((signal) => signal.label === 'sales emphasis') ? 18 : 0), 0, 100);

  return [
    {
      label: 'Spam Pressure',
      score: spamPressure,
      summary: `${signals.filter((signal) => signal.weight >= 10).length} strong heuristic signals are stacked against this post.`,
    },
    {
      label: 'Community Escalation',
      score: communityEscalation,
      summary: reportCount > 0 ? `${reportCount} report${reportCount === 1 ? '' : 's'} and vote behavior increase urgency.` : 'No direct community escalation yet.',
    },
    {
      label: 'Author Risk',
      score: authorRisk,
      summary: authorRiskContext.priorFlaggedActions > 0 ? `Recent moderator history for this author raises recurrence risk.` : 'No recent flagged history for this author in the activity trail.',
    },
    {
      label: 'Promotion Surface',
      score: promotionSurface,
      summary: urlCount > 0 ? `${urlCount} outbound link${urlCount === 1 ? '' : 's'} increase promotional exposure.` : 'No outbound link pressure detected.',
    },
  ];
};

const createRecommendedRule = (category: ModerationCategory): string => {
  switch (category) {
    case 'SPAM':
      return 'Spam / scam solicitation';
    case 'PROMOTION':
      return 'Self-promotion / commercial solicitation';
    case 'QUESTION':
      return 'Allowed question with possible rule clarification';
    case 'DISCUSSION':
      return 'Allowed discussion / community conversation';
    default:
      return 'Needs human moderator interpretation';
  }
};

const createCaseFile = ({
  analysisReason,
  authorRiskContext,
  category,
  confidence,
  decision,
  policyProfile,
  reportCount,
  score,
  signals,
  urlCount,
}: {
  analysisReason: string;
  authorRiskContext: AuthorRiskContext;
  category: ModerationCategory;
  confidence: number;
  decision: ModerationDecision;
  policyProfile: ModerationPolicyProfile;
  reportCount: number;
  score: number;
  signals: ModerationSignal[];
  urlCount: number;
}): ModerationCaseFile => {
  const topSignals = signals.slice(0, 3).map((signal) => `${signal.label}: ${signal.detail}`);
  const queuePriority = chooseQueuePriority(
    decision,
    confidence,
    reportCount,
    signals[0]?.weight ?? 0
  );

  return {
    evidenceSummary:
      topSignals.length > 0
        ? topSignals
        : ['Low-signal case. Human judgment should anchor the next action.'],
    moderatorBrief: `${decision.toUpperCase()} under ${policyProfile.label}. ${analysisReason}`,
    nextStep:
      decision === 'remove'
        ? 'Remove or keep removed, then watch for reposts or evasive follow-up.'
        : decision === 'review'
          ? 'Escalate to a human moderator for context, rule fit, and account review.'
          : 'Approve and monitor only if fresh reports or comments change the context.',
    queuePriority,
    recommendedRule: createRecommendedRule(category),
    riskDimensions: createRiskDimensions({
      authorRiskContext,
      reportCount,
      score,
      signals,
      urlCount,
    }),
  };
};

const createAnalysis = (
  input: AnalysisInput,
  policyProfileId: ModerationPolicyProfileId,
  authorRiskContext: AuthorRiskContext
): ModerationAnalysis => {
  const body = normaliseBody(input.body);
  const combined = `${input.title}\n${body}`.trim();
  const normalized = combined.toLowerCase();
  const scores = createEmptyScores();
  const signals: ModerationSignal[] = [];
  const urlCount = countUrls(combined);
  const spamHits = countMatches(normalized, spamKeywords);
  const promotionHits = countMatches(normalized, promotionKeywords);
  const discussionHits = countMatches(normalized, discussionKeywords);
  const uppercaseRatio = countUppercaseCharacters(combined);
  const titleLower = input.title.toLowerCase().trim();
  const questionPattern = /\?/.test(combined);
  const reportCount = input.numberOfReports;
  const hasEarningsClaim = earningsClaimPattern.test(combined);
  const hasCryptoCashPitch = cryptoCashPitchPattern.test(normalized);
  const hasUrgencyLanguage = urgencyPattern.test(normalized);
  const hasContactRouting = contactRoutingPattern.test(normalized);
  const hasInvestmentScamLanguage = investmentScamPattern.test(normalized);
  const hasExcessivePunctuation = excessivePunctuationPattern.test(combined);

  if (urlCount >= 2) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      18,
      'multi-link pattern',
      `${urlCount} external links in one post`
    );
    pushSignal(
      signals,
      scores,
      'PROMOTION',
      8,
      'external links',
      'external links increase promotional risk'
    );
  } else if (urlCount === 1) {
    pushSignal(
      signals,
      scores,
      'PROMOTION',
      6,
      'single link',
      'one external link present'
    );
  }

  if (spamHits > 0) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      14 + spamHits * 4,
      'spam keywords',
      `${spamHits} high-risk spam phrase matches`
    );
  }

  if (hasEarningsClaim) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      18,
      'earnings claim',
      'high-value money-making claim detected'
    );
  }

  if (hasCryptoCashPitch) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      16,
      'crypto cash pitch',
      'crypto-related quick-profit language detected'
    );
  }

  if (hasUrgencyLanguage) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      8,
      'urgency language',
      'pushy timing language detected'
    );
  }

  if (hasContactRouting) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      14,
      'off-platform routing',
      'post pushes users toward private or off-platform contact'
    );
  }

  if (hasInvestmentScamLanguage) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      18,
      'investment scam language',
      'investment and guaranteed-profit language appear together'
    );
  }

  if (promotionHits > 0) {
    pushSignal(
      signals,
      scores,
      'PROMOTION',
      10 + promotionHits * 4,
      'promotion keywords',
      `${promotionHits} promotional phrase matches`
    );
  }

  if (discussionHits > 0) {
    pushSignal(
      signals,
      scores,
      'DISCUSSION',
      10 + discussionHits * 3,
      'discussion framing',
      'contains discussion-oriented prompts'
    );
  }

  if (
    questionPattern ||
    questionStarters.some((starter) => titleLower.startsWith(`${starter} `))
  ) {
    pushSignal(
      signals,
      scores,
      'QUESTION',
      18,
      'question phrasing',
      'question mark or interrogative opener detected'
    );
  }

  if (reportCount > 0) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      8 + reportCount * 4,
      'community reports',
      `${reportCount} active report${reportCount === 1 ? '' : 's'}`
    );
  }

  if (input.score < 0) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      6,
      'negative score',
      'negative vote score raises risk'
    );
  }

  if (uppercaseRatio >= 55) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      12,
      'shouty casing',
      `${uppercaseRatio}% uppercase ratio`
    );
  }

  if (/!{2,}|\${2,}|free/i.test(combined)) {
    pushSignal(
      signals,
      scores,
      'PROMOTION',
      7,
      'sales emphasis',
      'aggressive sales punctuation or freebie language'
    );
  }

  if (hasExcessivePunctuation && (hasEarningsClaim || hasUrgencyLanguage)) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      10,
      'hype formatting',
      'excessive punctuation amplifies a high-pressure scam pitch'
    );
  }

  if ((hasEarningsClaim || hasCryptoCashPitch) && (hasUrgencyLanguage || hasContactRouting)) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      12,
      'compound scam pattern',
      'multiple scam indicators combine into a stronger spam signal'
    );
  }

  if (authorRiskContext.priorFlaggedActions > 0) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      8 + authorRiskContext.priorFlaggedActions * 3,
      'author history',
      `${authorRiskContext.priorFlaggedActions} prior flagged action${authorRiskContext.priorFlaggedActions === 1 ? '' : 's'} for this author in recent moderator activity`
    );
  }

  if (authorRiskContext.priorRemovals > 0) {
    pushSignal(
      signals,
      scores,
      'SPAM',
      10 + authorRiskContext.priorRemovals * 2,
      'repeat removals',
      `${authorRiskContext.priorRemovals} recent removal${authorRiskContext.priorRemovals === 1 ? '' : 's'} linked to this author`
    );
  }

  if (
    authorRiskContext.priorApprovals > 0 &&
    authorRiskContext.priorFlaggedActions === 0 &&
    !hasEarningsClaim &&
    !hasInvestmentScamLanguage
  ) {
    pushSignal(
      signals,
      scores,
      'DISCUSSION',
      4,
      'trusted author history',
      `${authorRiskContext.priorApprovals} prior approval${authorRiskContext.priorApprovals === 1 ? '' : 's'} reduce immediate risk`
    );
  }

  if (body.length >= 180 && reportCount === 0 && spamHits === 0 && promotionHits === 0) {
    pushSignal(
      signals,
      scores,
      'DISCUSSION',
      8,
      'substantive body',
      'long-form context suggests discussion rather than spam'
    );
  }

  if (!body && input.title.length < 24) {
    pushSignal(
      signals,
      scores,
      'UNKNOWN',
      10,
      'limited context',
      'too little content for a strong automated decision'
    );
  }

  if (policyProfileId === 'strict-spam') {
    if (urlCount > 0) {
      pushSignal(
        signals,
        scores,
        'SPAM',
        6,
        'strict spam policy',
        'profile boosts urgency around external-link risk'
      );
    }

    if (reportCount > 0 || spamHits > 0 || promotionHits > 0) {
      pushSignal(
        signals,
        scores,
        'PROMOTION',
        4,
        'aggressive enforcement',
        'policy reduces tolerance for spam and promotion indicators'
      );
    }
  }

  if (policyProfileId === 'community-support') {
    if (questionPattern) {
      pushSignal(
        signals,
        scores,
        'QUESTION',
        6,
        'community support policy',
        'profile favors clarifying questions before escalation'
      );
    }

    if (discussionHits > 0 || body.length >= 180) {
      pushSignal(
        signals,
        scores,
        'DISCUSSION',
        5,
        'discussion tolerance',
        'profile is more forgiving for long-form discussion posts'
      );
    }
  }

  const { category, margin, topScore } = chooseCategory(scores);
  const strongSignalCount = signals.filter((signal) => signal.weight >= 10).length;
  const baseConfidence =
    category === 'UNKNOWN'
      ? clamp(38 + topScore * 2, 38, 72)
      : clamp(52 + topScore * 2 + margin * 3, 52, 98);
  const confidence =
    category === 'PROMOTION' &&
    reportCount === 0 &&
    !hasEarningsClaim &&
    !hasContactRouting &&
    !hasInvestmentScamLanguage &&
    strongSignalCount <= 1
      ? Math.min(baseConfidence, urlCount > 0 ? 79 : 72)
      : baseConfidence;
  const decision = chooseDecision(
    category,
    confidence,
    reportCount,
    urlCount,
    input.score,
    policyProfileId
  );
  const policyProfile = getModerationPolicyProfile(policyProfileId);
  const reason = `${createReason(category, decision, signals)} Policy profile: ${policyProfile.label}.`;
  const sortedSignals = signals.slice().sort((left, right) => right.weight - left.weight);

  return {
    analysisMode: 'heuristic',
    caseFile: createCaseFile({
      analysisReason: reason,
      authorRiskContext,
      category,
      confidence,
      decision,
      policyProfile,
      reportCount,
      score: input.score,
      signals: sortedSignals,
      urlCount,
    }),
    category,
    confidence,
    decision,
    reason,
    replySuggestion: createReplySuggestion(
      category,
      decision,
      input.subredditName
    ),
    signals: sortedSignals,
  };
};

const buildPolicySimulations = (
  input: AnalysisInput,
  authorRiskContext: AuthorRiskContext
): ModerationPolicySimulation[] =>
  policyProfiles.map((policyProfile) => {
    const analysis = createAnalysis(input, policyProfile.id, authorRiskContext);

    return {
      category: analysis.category,
      confidence: analysis.confidence,
      decision: analysis.decision,
      policyProfile,
      reason: analysis.reason,
    };
  });

const toBodyPreview = (body: string | undefined): string => {
  const normalizedBody = normaliseBody(body);

  if (!normalizedBody) {
    return 'No body text provided.';
  }

  if (normalizedBody.length <= bodyPreviewLimit) {
    return normalizedBody;
  }

  return `${normalizedBody.slice(0, bodyPreviewLimit).trimEnd()}...`;
};

const buildSnapshot = (
  input: AnalysisInput,
  source: ModerationPostSnapshot['source']
): ModerationPostSnapshot => ({
  authorName: input.authorName,
  body: toBodyPreview(input.body),
  createdAt: input.createdAt.toISOString(),
  id: input.id,
  numberOfComments: input.numberOfComments,
  numberOfReports: input.numberOfReports,
  permalink: input.permalink,
  score: input.score,
  source,
  status: input.status,
  subredditName: input.subredditName,
  title: input.title,
  url: input.url,
});

const auditKey = (postId: string): string => `${AUDIT_PREFIX}${postId}`;

const readAuditState = async (postId: string): Promise<ModerationAudit> => {
  const rawValue = await redis.get(auditKey(postId));

  if (!rawValue) {
    return {
      lastAction: null,
      lastActionAt: null,
      lastReplyText: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue) as PersistedAuditState;

    return {
      lastAction: parsed.lastAction ?? null,
      lastActionAt: parsed.lastActionAt ?? null,
      lastReplyText: parsed.lastReplyText ?? null,
    };
  } catch (error) {
    console.error(`Failed to parse moderation audit for post ${postId}:`, error);
    return {
      lastAction: null,
      lastActionAt: null,
      lastReplyText: null,
    };
  }
};

const writeAuditState = async (
  postId: string,
  audit: ModerationAudit
): Promise<void> => {
  await redis.set(auditKey(postId), JSON.stringify(audit));
};

const requireCurrentPost = async (): Promise<Post> => {
  if (!context.postId) {
    throw new Error('postId is required in the Devvit context');
  }

  return await reddit.getPostById(context.postId);
};

const assertTargetPostMatchesCurrentSubreddit = (targetPost: Post): void => {
  if (!context.subredditName) {
    throw new Error('Current subreddit context is unavailable for linked moderation');
  }

  if (targetPost.subredditName !== context.subredditName) {
    throw new Error(
      `This app can only moderate posts inside r/${context.subredditName}. The linked post is in r/${targetPost.subredditName}.`
    );
  }
};

const createAnalysisInput = (
  post: Post,
  activeScenario: ModerationScenario
): AnalysisInput => ({
  authorName: post.authorName,
  body: activeScenario.body,
  createdAt: post.createdAt,
  id: post.id,
  numberOfComments: activeScenario.numberOfComments,
  numberOfReports: activeScenario.reportCount,
  permalink: `https://reddit.com${post.permalink}`,
  score: activeScenario.score,
  status: {
    approved: post.approved,
    locked: post.locked,
    removed: post.removed,
    spam: post.spam,
  },
  subredditName: post.subredditName,
  title: activeScenario.title,
  url: post.url,
});

const createLiveAnalysisInput = (post: Post): AnalysisInput => ({
  authorName: post.authorName,
  body: normaliseBody(post.body),
  createdAt: post.createdAt,
  id: post.id,
  numberOfComments: post.numberOfComments,
  numberOfReports: post.numberOfReports,
  permalink: `https://reddit.com${post.permalink}`,
  score: post.score,
  status: {
    approved: post.approved,
    locked: post.locked,
    removed: post.removed,
    spam: post.spam,
  },
  subredditName: post.subredditName,
  title: post.title,
  url: post.url,
});

const persistScenarioSelection = async (
  post: Post,
  scenarioId: ModerationScenarioId,
  scenarioVariantIndex: number
): Promise<void> => {
  const currentPostData = await post.getPostData();
  const nextPostData: PersistedPostData = {
    ...(currentPostData && typeof currentPostData === 'object' && !Array.isArray(currentPostData)
      ? (currentPostData as PersistedPostData)
      : {}),
    scenarioId,
    scenarioVariantIndex,
  };
  await post.setPostData(nextPostData);
  await post.setTextFallback({
    text: getModerationScenario(scenarioId, scenarioVariantIndex).body,
  });
};

const persistPolicyProfileSelection = async (
  post: Post,
  policyProfileId: ModerationPolicyProfileId
): Promise<void> => {
  const currentPostData = await post.getPostData();
  const nextPostData: PersistedPostData = {
    ...(currentPostData && typeof currentPostData === 'object' && !Array.isArray(currentPostData)
      ? (currentPostData as PersistedPostData)
      : {}),
    policyProfileId,
  };
  await post.setPostData(nextPostData);
};

export const buildModerationDashboard = async (): Promise<ModerationDashboardResponse> => {
  const [post, moderatorUsername] = await Promise.all([
    requireCurrentPost(),
    reddit.getCurrentUsername(),
  ]);
  const [audit, scenarioId, scenarioVariantIndex, policyProfileId, targetPostId] = await Promise.all([
    readAuditState(post.id),
    readScenarioIdFromPostData(post),
    readScenarioVariantIndexFromPostData(post),
    readPolicyProfileIdFromPostData(post),
    readTargetPostIdFromPostData(post),
  ]);
  const activePolicyProfile = getModerationPolicyProfile(policyProfileId);

  if (targetPostId) {
    const targetPost = await reddit.getPostById(targetPostId);
    const analysisInput = createLiveAnalysisInput(targetPost);
    const impact = await readImpactState(analysisInput.subredditName);
    const authorRiskContext = buildAuthorRiskContext(
      impact.recentActivity,
      analysisInput.authorName
    );
    const policySimulations = buildPolicySimulations(
      analysisInput,
      authorRiskContext
    );

    return {
      activePolicyProfile,
      activeScenario: null,
      analysis: createAnalysis(analysisInput, policyProfileId, authorRiskContext),
      audit,
      generatedAt: new Date().toISOString(),
      impact,
      mode: 'live-target',
      moderatorUsername: moderatorUsername ?? 'anonymous-moderator',
      policyProfiles,
      policySimulations,
      post: buildSnapshot(analysisInput, 'linked-target'),
      recentActivity: impact.recentActivity,
      scenarios: [],
      type: 'dashboard',
    };
  }

  const activeScenario = getModerationScenario(scenarioId, scenarioVariantIndex);
  const analysisInput = createAnalysisInput(post, activeScenario);
  const impact = await readImpactState(analysisInput.subredditName);
  const authorRiskContext = buildAuthorRiskContext(
    impact.recentActivity,
    analysisInput.authorName
  );
  const policySimulations = buildPolicySimulations(
    analysisInput,
    authorRiskContext
  );

  return {
    activePolicyProfile,
    activeScenario,
    analysis: createAnalysis(analysisInput, policyProfileId, authorRiskContext),
    audit,
    generatedAt: new Date().toISOString(),
    impact,
    mode: 'seeded-demo',
    moderatorUsername: moderatorUsername ?? 'anonymous-moderator',
    policyProfiles,
    policySimulations,
    post: buildSnapshot(analysisInput, 'seeded-scenario'),
    recentActivity: impact.recentActivity,
    scenarios: getModerationScenarios(),
    type: 'dashboard',
  };
};

const createToastMessage = (action: ModerationAction): string => {
  switch (action) {
    case 'approve':
      return 'Post approved';
    case 'remove':
      return 'Post removed. Reddit may still show it to moderators and the author.';
    case 'review':
      return 'Post marked for moderator review';
    case 'reply':
      return 'Reply suggestion posted';
  }
};

export const executeModerationAction = async (
  request: ModerationActionRequest
): Promise<ModerationActionResponse> => {
  const consolePost = await requireCurrentPost();
  const [policyProfileId, targetPostId] = await Promise.all([
    readPolicyProfileIdFromPostData(consolePost),
    readTargetPostIdFromPostData(consolePost),
  ]);
  const moderatedPost = targetPostId
    ? await reddit.getPostById(targetPostId)
    : consolePost;
  if (targetPostId) {
    assertTargetPostMatchesCurrentSubreddit(moderatedPost);
  }
  const analysisInput = targetPostId
    ? createLiveAnalysisInput(moderatedPost)
    : createAnalysisInput(
        moderatedPost,
        getModerationScenario(
          await readScenarioIdFromPostData(consolePost),
          await readScenarioVariantIndexFromPostData(consolePost)
        )
      );
  const impact = await readImpactState(analysisInput.subredditName);
  const authorRiskContext = buildAuthorRiskContext(
    impact.recentActivity,
    analysisInput.authorName
  );
  const analysis = createAnalysis(
    analysisInput,
    policyProfileId,
    authorRiskContext
  );
  const actionTimestamp = new Date().toISOString();
  const audit: ModerationAudit = {
    lastAction: request.action,
    lastActionAt: actionTimestamp,
    lastReplyText: null,
  };

  switch (request.action) {
    case 'approve':
      await moderatedPost.approve();
      break;
    case 'remove':
      await moderatedPost.remove(analysis.category === 'SPAM');
      break;
    case 'review':
      break;
    case 'reply': {
      const replyText = request.replyText?.trim() || analysis.replySuggestion;
      await moderatedPost.addComment({ runAs: 'APP', text: replyText });
      audit.lastReplyText = replyText;
      break;
    }
  }

  await writeAuditState(consolePost.id, audit);
  await recordImpactEvent({
    action: request.action,
    activity: createActivityItem({
      authorName: analysisInput.authorName,
      category: analysis.category,
      createdAt: actionTimestamp,
      decision: analysis.decision,
      detail: `${request.action.toUpperCase()} executed for ${analysis.category.toLowerCase()} content with ${analysis.confidence}% confidence.`,
      eventType: request.action,
      mode: targetPostId ? 'live-target' : 'seeded-demo',
      subredditName: analysisInput.subredditName,
      title: analysisInput.title,
    }),
    subredditName: analysisInput.subredditName,
  });

  return {
    action: request.action,
    dashboard: await buildModerationDashboard(),
    toastMessage: createToastMessage(request.action),
    type: 'action',
  };
};

export const setModerationScenario = async (
  scenarioId: ModerationScenarioId
): Promise<ModerationDashboardResponse> => {
  const post = await requireCurrentPost();
  const { scenario, variantIndex } = pickModerationScenario(scenarioId);
  await persistScenarioSelection(post, scenarioId, variantIndex);
  await recordImpactEvent({
    activity: createActivityItem({
      authorName: post.authorName,
      category: null,
      createdAt: new Date().toISOString(),
      decision: null,
      detail: `Switched demo console to ${scenario.label}.`,
      eventType: 'switch-scenario',
      mode: 'seeded-demo',
      subredditName: post.subredditName,
      title: scenario.title,
    }),
    incrementScenarioSwitches: true,
    subredditName: post.subredditName,
  });
  return await buildModerationDashboard();
};

export const setModerationPolicyProfile = async (
  policyProfileId: ModerationPolicyProfileId
): Promise<ModerationDashboardResponse> => {
  const post = await requireCurrentPost();
  const profile = getModerationPolicyProfile(policyProfileId);
  await persistPolicyProfileSelection(post, policyProfileId);
  await recordImpactEvent({
    activity: createActivityItem({
      authorName: post.authorName,
      category: null,
      createdAt: new Date().toISOString(),
      decision: null,
      detail: `Switched moderation policy to ${profile.label}.`,
      eventType: 'switch-policy',
      mode: (await readTargetPostIdFromPostData(post)) ? 'live-target' : 'seeded-demo',
      subredditName: post.subredditName,
      title: profile.label,
    }),
    subredditName: post.subredditName,
  });
  return await buildModerationDashboard();
};

export const linkCurrentConsoleToTargetPost = async (
  targetPostId: T3
): Promise<ModerationDashboardResponse> => {
  const [consolePost, targetPost] = await Promise.all([
    requireCurrentPost(),
    reddit.getPostById(targetPostId),
  ]);
  assertTargetPostMatchesCurrentSubreddit(targetPost);

  const currentPostData = await consolePost.getPostData();
  await consolePost.setPostData({
    ...(currentPostData && typeof currentPostData === 'object' && !Array.isArray(currentPostData)
      ? (currentPostData as PersistedPostData)
      : {}),
    targetPostId,
  });
  await consolePost.edit({
    text: `Linked moderation target: ${targetPost.title}`,
  });
  await consolePost.setTextFallback({
    text: targetPost.body?.trim() || 'No body text provided on the target post.',
  });
  await recordImpactEvent({
    activity: createActivityItem({
      authorName: targetPost.authorName,
      category: null,
      createdAt: new Date().toISOString(),
      decision: null,
      detail: 'Console linked to a live Reddit target post for real moderation.',
      eventType: 'link-live-post',
      mode: 'live-target',
      subredditName: targetPost.subredditName,
      title: targetPost.title,
    }),
    incrementLiveLinks: true,
    subredditName: targetPost.subredditName,
  });

  return await buildModerationDashboard();
};