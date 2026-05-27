import './index.css';

import { navigateTo } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type {
  ModerationAction,
  ModerationActivityItem,
  ModerationDecision,
  ModerationScenario,
  ModerationSignal,
} from '../shared/api';
import { useModerationAssistant } from './hooks/useModerationAssistant';

const decisionTone = (decision: ModerationDecision): string => {
  switch (decision) {
    case 'remove':
      return 'bg-rose-600 text-white';
    case 'review':
      return 'bg-amber-500 text-white';
    case 'approve':
      return 'bg-emerald-600 text-white';
  }
};

const riskLevelLabel = (
  decision: ModerationDecision,
  confidence: number
): 'High Risk' | 'Medium Risk' | 'Low Risk' => {
  if (decision === 'remove' || confidence >= 85) {
    return 'High Risk';
  }

  if (decision === 'review' || confidence >= 65) {
    return 'Medium Risk';
  }

  return 'Low Risk';
};

const categoryLabel = (category: string): string =>
  category === 'SPAM'
    ? 'Likely Scam'
    : category === 'PROMOTION'
      ? 'Likely Promotion'
      : category === 'QUESTION'
        ? 'Likely Good-Faith Question'
        : category === 'DISCUSSION'
          ? 'Likely Healthy Discussion'
          : 'Mixed Signals';

const recommendedActionLabel = (decision: ModerationDecision): string => {
  switch (decision) {
    case 'remove':
      return 'Remove now';
    case 'review':
      return 'Needs human review';
    case 'approve':
      return 'Approve and monitor';
  }
};

const formatTimeSaved = (minutes: number): string =>
  minutes >= 60 ? `${(minutes / 60).toFixed(1)} hrs` : `${minutes} min`;

const statusLabel = (active: boolean, label: string) => (
  <span
    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
      active
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-500'
    }`}
  >
    {label}
  </span>
);

const actionLabel: Record<ModerationAction, string> = {
  approve: 'Approve',
  remove: 'Remove',
  reply: 'Reply',
  review: 'Needs human review',
};

type ConsoleTabId = 'overview' | 'controls' | 'activity';

type ControlsTabId = 'setup' | 'post' | 'reply';

type DetailDialogMode = 'workspace' | 'impact' | 'policy' | 'casefile';

const consoleTabs: Array<{
  accent: string;
  description: string;
  id: ConsoleTabId;
  label: string;
  kicker: string;
  meta: string;
}> = [
  {
    accent: 'from-sky-400/20 via-cyan-300/10 to-transparent',
    id: 'overview',
    kicker: 'Workspace 01',
    label: 'Overview',
    meta: 'Impact, policy, and case file',
    description: 'Verdict, impact, and case file',
  },
  {
    accent: 'from-amber-300/20 via-orange-200/10 to-transparent',
    id: 'controls',
    kicker: 'Workspace 02',
    label: 'Controls',
    meta: 'Moderator inputs and actions',
    description: 'Policy, scenarios, and action center',
  },
  {
    accent: 'from-emerald-300/20 via-teal-200/10 to-transparent',
    id: 'activity',
    kicker: 'Workspace 03',
    label: 'Activity',
    meta: 'Trail, signals, and handoff',
    description: 'Handoff, queue trail, and signals',
  },
];

const controlsTabs: Array<{
  accent: string;
  description: string;
  id: ControlsTabId;
  label: string;
  kicker: string;
  meta: string;
}> = [
  {
    accent: 'from-sky-400/18 via-cyan-300/8 to-transparent',
    id: 'setup',
    kicker: 'Setup Lane',
    label: 'Setup',
    meta: 'Profiles and target selection',
    description: 'Policy, linking, and demo scenarios',
  },
  {
    accent: 'from-violet-400/18 via-fuchsia-300/8 to-transparent',
    id: 'post',
    kicker: 'Review Lane',
    label: 'Post',
    meta: 'Source context and evidence',
    description: 'Captured post snapshot and source info',
  },
  {
    accent: 'from-amber-300/18 via-orange-200/8 to-transparent',
    id: 'reply',
    kicker: 'Action Lane',
    label: 'Reply & Action',
    meta: 'Moderator response workflow',
    description: 'Moderator comment and one-click actions',
  },
];

const DetailDialog = ({
  bullets,
  onClose,
  summary,
  title,
}: {
  bullets: string[];
  onClose: () => void;
  summary: string;
  title: string;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
    <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Workspace Guide
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">{summary}</p>
        </div>
        <button
          className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <ul className="mt-5 space-y-3">
        {bullets.map((bullet) => (
          <li key={bullet} className="rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const MetricCard = ({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value: string;
}) => (
  <div className="rounded-[28px] border border-slate-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
      {label}
    </p>
    <p className={`mt-4 text-3xl font-semibold ${tone}`}>{value}</p>
  </div>
);

const SignalRow = ({ signal }: { signal: ModerationSignal }) => {
  const tone = signal.weight >= 15 ? 'bg-rose-50' : 'bg-slate-50';

  return (
    <li className={`rounded-2xl border border-slate-200 p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{signal.label}</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
          +{signal.weight}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p>
    </li>
  );
};

const ScenarioButton = ({
  active,
  onClick,
  scenario,
}: {
  active: boolean;
  onClick: () => void;
  scenario: ModerationScenario;
}) => (
  <button
    className={`rounded-[24px] border p-4 text-left transition ${
      active
        ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold">{scenario.label}</p>
      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
        {scenario.reportCount} reports
      </span>
    </div>
    <p className={`mt-2 text-sm leading-6 ${active ? 'text-slate-300' : 'text-slate-600'}`}>
      {scenario.summary}
    </p>
  </button>
);

const activityLabel = {
  approve: 'Approved',
  'link-live-post': 'Linked Live Post',
  remove: 'Removed',
  reply: 'Replied',
  review: 'Needs Human Review',
  'switch-policy': 'Switched Policy',
  'switch-scenario': 'Switched Demo',
} as const;

const activityTone = (eventType: ModerationActivityItem['eventType']): string => {
  switch (eventType) {
    case 'remove':
      return 'bg-rose-100 text-rose-700';
    case 'review':
      return 'bg-amber-100 text-amber-700';
    case 'approve':
      return 'bg-emerald-100 text-emerald-700';
    case 'reply':
      return 'bg-sky-100 text-sky-700';
    case 'switch-policy':
      return 'bg-violet-100 text-violet-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const ActivityRow = ({ item }: { item: ModerationActivityItem }) => (
  <li className="rounded-[24px] border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${activityTone(item.eventType)}`}
      >
        {activityLabel[item.eventType]}
      </span>
      <span className="text-xs font-medium text-slate-500">
        {new Date(item.createdAt).toLocaleString()}
      </span>
    </div>
    <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      <span>r/{item.subredditName}</span>
      <span>u/{item.authorName}</span>
      <span>{item.mode === 'live-target' ? 'Live queue' : 'Demo queue'}</span>
      {item.category ? <span>{item.category}</span> : null}
    </div>
  </li>
);

const handoffStatusTone = (decision: ModerationDecision): string => {
  switch (decision) {
    case 'remove':
      return 'text-rose-700';
    case 'review':
      return 'text-amber-700';
    case 'approve':
      return 'text-emerald-700';
  }
};

export const App = () => {
  const {
    dashboard,
    error,
    linkTargetPost,
    loading,
    runAction,
    setPolicyProfile,
    setScenario,
    submittingAction,
  } = useModerationAssistant();
  const [replyText, setReplyText] = useState('');
  const [targetPostInput, setTargetPostInput] = useState('');
  const [activeTab, setActiveTab] = useState<ConsoleTabId>('overview');
  const [activeControlsTab, setActiveControlsTab] = useState<ControlsTabId>('reply');
  const [detailDialogMode, setDetailDialogMode] = useState<DetailDialogMode | null>(null);

  if (loading) {
    return (
      <div className="mq-shell min-h-screen px-5 py-8 text-slate-900">
        <div className="mq-console-shell mx-auto max-w-5xl animate-pulse rounded-[32px] p-6">
          <div className="h-5 w-32 rounded bg-slate-200" />
          <div className="mt-6 h-16 rounded-3xl bg-slate-100" />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="h-24 rounded-3xl bg-slate-100" />
            <div className="h-24 rounded-3xl bg-slate-100" />
            <div className="h-24 rounded-3xl bg-slate-100" />
            <div className="h-24 rounded-3xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="mq-shell min-h-screen px-5 py-8 text-slate-900">
        <div className="mq-console-shell mx-auto max-w-xl rounded-[28px] border border-rose-200 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-600">
            ModQueue Copilot
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">
            Moderation dashboard unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error ?? 'The dashboard could not load for this post context.'}
          </p>
        </div>
      </div>
    );
  }

  const {
    activePolicyProfile,
    activeScenario,
    analysis,
    audit,
    generatedAt,
    impact,
    mode,
    moderatorUsername,
    policyProfiles,
    policySimulations,
    post,
    recentActivity,
    scenarios,
  } = dashboard;
  const currentReplyText = replyText.trim() || analysis.replySuggestion;
  const isSubmitting = (action: ModerationAction): boolean =>
    submittingAction === action;
  const primaryAction = analysis.decision;
  const secondaryActions = (['approve', 'remove', 'review', 'reply'] as ModerationAction[]).filter(
    (action) => action !== primaryAction
  );
  const timeSavedMinutes =
    mode === 'live-target'
      ? 9
      : analysis.decision === 'remove'
        ? 12
        : analysis.decision === 'review'
          ? 6
          : 4;
  const automationReadiness =
    analysis.confidence >= 90
      ? 'High'
      : analysis.confidence >= 70
        ? 'Medium'
        : 'Low';
  const handoffNextStep =
    analysis.decision === 'remove'
      ? 'Monitor for appeals or repost attempts and leave the removal in place unless the author adds new context.'
      : analysis.decision === 'review'
        ? 'A human moderator should inspect intent, account history, and comments before taking a final action.'
        : 'Leave approved unless new reports arrive or comments reveal missing context.';
  const handoffSummary = [
    `Recommendation: ${analysis.decision.toUpperCase()} with ${analysis.confidence}% confidence under ${activePolicyProfile.label}.`,
    `Primary risk call: ${analysis.category} based on ${analysis.signals[0]?.label ?? 'mixed signals'}.`,
    audit.lastAction
      ? `Last moderator action: ${actionLabel[audit.lastAction]} at ${new Date(audit.lastActionAt ?? generatedAt).toLocaleString()}.`
      : 'No moderator action has been taken yet on this console.',
  ];
  const verdictRisk = riskLevelLabel(analysis.decision, analysis.confidence);
  const verdictTitle = `${verdictRisk}: ${categoryLabel(analysis.category)} (${analysis.confidence}%)`;
  const topReasons = analysis.signals.slice(0, 3);
  const activeWorkspaceSection =
    consoleTabs.find((tab) => tab.id === activeTab) ??
    consoleTabs[0]!;
  const activeControlsSection =
    controlsTabs.find((tab) => tab.id === activeControlsTab) ??
    controlsTabs[0]!;
  const workspaceBadge =
    activeTab === 'overview'
      ? `${policySimulations.length} policy views`
      : activeTab === 'controls'
        ? `${controlsTabs.length} moderator lanes`
        : `${recentActivity.length} recent events`;
  const controlsBadge =
    activeControlsTab === 'setup'
      ? `${policyProfiles.length} profiles`
      : activeControlsTab === 'post'
        ? `${post.numberOfReports} reports`
        : `${secondaryActions.length + 1} actions`;
  const detailDialog =
    detailDialogMode === 'workspace'
      ? {
          bullets:
            activeTab === 'overview'
              ? [
                  'The hero holds only the verdict, confidence, and top reasons so the moderator is not forced through secondary analytics first.',
                  'Impact, policy, and case file are summarized inline and opened in a dialog only when deeper explanation is needed.',
                  'This keeps the main lane readable while still preserving the richer demo story.',
                ]
              : activeTab === 'controls'
                ? [
                    'Use the top switcher to move between setup, post context, and reply workflow without stacking those lanes together.',
                    'The main panel should feel like one job at a time: configure, inspect, or act.',
                    'Extra rationale belongs in this popup, not in another dense explainer block.',
                  ]
                : [
                    'Activity is the continuity lane: handoff, audit trail, and heuristic trace.',
                    'It is intentionally separated from the decision lane so the moderator does not feel flooded by after-the-fact context.',
                    'Use it in the demo to show accountability, not to drive the first action.',
                  ],
          summary:
            activeTab === 'overview'
              ? 'This workspace is intentionally condensed so the decision is clear before the supporting detail is explored.'
              : activeTab === 'controls'
                ? 'This workspace is organized around the moderator flow, not around raw data volume.'
                : 'This workspace keeps the operational memory of the case without crowding the action surface.',
          title:
            activeTab === 'overview'
              ? 'Overview workspace'
              : activeTab === 'controls'
                ? `Controls workspace: ${activeControlsSection.label}`
                : 'Activity workspace',
        }
      : detailDialogMode === 'impact'
        ? {
            bullets: [
              `Moderator time saved: ${formatTimeSaved(impact.estimatedMinutesSaved)}.`,
              `Posts triaged: ${impact.totalActions}; high-risk intercepts: ${impact.highRiskIntercepts}.`,
              `Approvals: ${impact.approvals}, removals: ${impact.removals}, reviews: ${impact.reviews}, live links: ${impact.liveLinks}.`,
            ],
            summary: 'Analytics are summarized in one card here so they do not stretch the main page vertically.',
            title: 'Impact analytics',
          }
        : detailDialogMode === 'policy'
          ? {
              bullets: policySimulations.map(
                (simulation) =>
                  `${simulation.policyProfile.label}: ${simulation.decision.toUpperCase()} at ${simulation.confidence}% confidence. ${simulation.reason}`
              ),
              summary: 'Policy comparisons stay behind a dialog so moderators can inspect differences without carrying all profiles inline.',
              title: 'Policy comparisons',
            }
          : detailDialogMode === 'casefile'
            ? {
                bullets: [
                  `Recommended rule: ${analysis.caseFile.recommendedRule}.`,
                  `Next step: ${analysis.caseFile.nextStep}.`,
                  ...analysis.caseFile.evidenceSummary,
                ],
                summary: analysis.caseFile.moderatorBrief,
                title: 'Moderator case file',
              }
            : null;

  return (
    <div className="mq-shell min-h-screen px-4 py-6 text-slate-900 sm:px-5 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mq-console-shell rounded-[36px] p-6">
          <div
            className={`mb-6 rounded-[28px] border px-5 py-4 ${
              mode === 'live-target'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-white/80'
            }`}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {mode === 'live-target' ? 'Live Target Post' : 'Demo Scenario'}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  {mode === 'live-target'
                    ? 'This console is attached to a real Reddit post and moderation actions apply to that target post.'
                    : 'This console is running a seeded scenario for a repeatable hackathon demo.'}
                </p>
              </div>
              <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                {mode === 'live-target' ? 'Production-style workflow' : 'Demo-safe workflow'}
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Live Moderation Scope
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Direct moderation actions only work on posts inside r/{post.subredditName}, where this app is installed and the moderator has access.
                </p>
              </div>
              <div className="rounded-full bg-amber-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900">
                Same-subreddit only
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
            <div>
              <p className="mq-kicker text-xs font-semibold uppercase text-slate-500">
                ModQueue Copilot
              </p>
              <div className="mt-4 overflow-hidden rounded-[32px] border border-slate-900/10 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.20),transparent_28%),linear-gradient(135deg,#0f172a_0%,#172033_55%,#1f2937_100%)] p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)]">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_290px] xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${decisionTone(analysis.decision)}`}
                      >
                        {recommendedActionLabel(analysis.decision)}
                      </span>
                      <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                        {verdictRisk}
                      </span>
                      <span className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                        {analysis.confidence}% confidence
                      </span>
                    </div>
                    <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-[2.8rem]">
                      {verdictTitle}
                    </h1>
                    <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200">
                      {analysis.reason}
                    </p>
                    <div className="mt-5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-2 rounded-full ${analysis.decision === 'remove' ? 'bg-rose-400' : analysis.decision === 'review' ? 'bg-amber-300' : 'bg-emerald-300'}`}
                        style={{ width: `${analysis.confidence}%` }}
                      />
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {topReasons.map((signal) => (
                        <div key={`${signal.label}-${signal.detail}`} className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                            {signal.label}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-white">{signal.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[26px] border border-white/10 bg-white/7 px-4 py-4 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Queue Priority
                      </p>
                      <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                        {analysis.caseFile.queuePriority}
                      </div>
                    </div>
                    <div className="rounded-[26px] border border-white/10 bg-white/7 px-4 py-4 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Automation Readiness
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">{automationReadiness}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Safe level for acting directly before a human needs deeper review.
                      </p>
                    </div>
                    <div className="rounded-[26px] border border-white/10 bg-white/7 px-4 py-4 backdrop-blur-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        Time Saved
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">{formatTimeSaved(timeSavedMinutes)}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Estimated queue handling time avoided on this case.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {analysis.category}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {mode === 'live-target' ? 'Live post' : `${activeScenario?.label ?? 'Demo'} demo`}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                  Policy: {activePolicyProfile.label}
                </span>
              </div>
              <h2 className="mt-5 max-w-4xl text-2xl font-semibold leading-tight text-slate-950 md:text-3xl">
                {post.title}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {statusLabel(post.status.approved, 'Approved')}
                {statusLabel(post.status.removed, 'Removed')}
                {statusLabel(post.status.spam, 'Spam')}
                {statusLabel(post.status.locked, 'Locked')}
              </div>
              {mode === 'live-target' && post.status.removed ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  Reddit removals are non-destructive. The post can still be visible to moderators and sometimes the author, even when it is removed from normal community view.
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_16px_45px_rgba(15,23,42,0.16)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                    Live Context
                  </p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                    {post.source === 'seeded-scenario' ? 'Demo simulator' : 'Target Reddit post'}
                  </span>
                </div>
                <div className="mt-5 grid gap-4 text-sm text-slate-200 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <p className="text-slate-400">Moderator</p>
                    <p className="mt-1 font-medium text-white">u/{moderatorUsername}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Queue</p>
                    <p className="mt-1 font-medium text-white">r/{post.subredditName}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Last Action</p>
                    <p className="mt-1 font-medium text-white">
                      {audit.lastAction ? actionLabel[audit.lastAction] : 'None'}
                    </p>
                    {audit.lastAction === 'review' ? (
                      <span className="mt-2 inline-flex rounded-full bg-amber-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-950">
                        Waiting for human moderator
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-slate-400">Synced</p>
                    <p className="mt-1 font-medium text-white">
                      {new Date(generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Moderator Handoff
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-950">
                  {analysis.caseFile.nextStep}
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <li>{analysis.caseFile.moderatorBrief}</li>
                  <li>Queue priority: {analysis.caseFile.queuePriority}</li>
                  <li>Recommended rule: {analysis.caseFile.recommendedRule}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-3 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <div className="grid gap-3 md:grid-cols-3">
                {consoleTabs.map((tab) => {
                  const badge =
                    tab.id === 'overview'
                      ? `${policySimulations.length} views`
                      : tab.id === 'controls'
                        ? `${controlsTabs.length} lanes`
                        : `${recentActivity.length} events`;

                  return (
                    <button
                      key={tab.id}
                      className={`rounded-[22px] border px-4 py-4 text-left transition ${
                        tab.id === activeTab
                          ? 'border-slate-900 bg-slate-900 text-white shadow-[0_16px_35px_rgba(15,23,42,0.16)]'
                          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${tab.id === activeTab ? 'text-slate-300' : 'text-slate-500'}`}>
                            {tab.kicker}
                          </p>
                          <p className="mt-2 text-base font-semibold">{tab.label}</p>
                          <p className={`mt-2 text-sm leading-6 ${tab.id === activeTab ? 'text-slate-300' : 'text-slate-600'}`}>
                            {tab.description}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tab.id === activeTab ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {badge}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {activeTab === 'controls' ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="grid gap-3 md:grid-cols-3">
                    {controlsTabs.map((tab) => {
                      const badge =
                        tab.id === 'setup'
                          ? `${policyProfiles.length} profiles`
                          : tab.id === 'post'
                            ? `${post.numberOfReports} reports`
                            : `${secondaryActions.length + 1} actions`;

                      return (
                        <button
                          key={tab.id}
                          className={`rounded-[20px] border px-4 py-3 text-left transition ${
                            tab.id === activeControlsTab
                              ? 'border-slate-900 bg-slate-950 text-white shadow-[0_14px_30px_rgba(15,23,42,0.14)]'
                              : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                          onClick={() => setActiveControlsTab(tab.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${tab.id === activeControlsTab ? 'text-slate-300' : 'text-slate-500'}`}>
                                {tab.kicker}
                              </p>
                              <p className="mt-2 text-sm font-semibold">{tab.label}</p>
                              <p className={`mt-2 text-xs leading-5 ${tab.id === activeControlsTab ? 'text-slate-300' : 'text-slate-600'}`}>
                                {tab.description}
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tab.id === activeControlsTab ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {badge}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(247,242,234,0.84))] px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {activeWorkspaceSection.kicker}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                      {activeWorkspaceSection.label}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      {activeWorkspaceSection.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                      {workspaceBadge}
                    </div>
                    <button
                      className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800"
                      onClick={() => setDetailDialogMode('workspace')}
                    >
                      Open quick guide
                    </button>
                  </div>
                </div>
              </div>

          {activeTab === 'overview' ? (
            <>
              <div className="mt-8 grid gap-4 md:grid-cols-4 xl:grid-cols-5">
                <MetricCard label="Reports" tone="text-slate-950" value={`${post.numberOfReports}`} />
                <MetricCard label="Score" tone="text-slate-950" value={`${post.score}`} />
                <MetricCard
                  label="Moderator Time Saved"
                  tone="text-emerald-700"
                  value={formatTimeSaved(impact.estimatedMinutesSaved || timeSavedMinutes)}
                />
                <MetricCard
                  label="Scams Intercepted"
                  tone="text-rose-700"
                  value={`${impact.highRiskIntercepts}`}
                />
                <MetricCard
                  label="Auto-Triage"
                  tone="text-amber-700"
                  value={automationReadiness}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4 xl:grid-cols-5">
                <MetricCard
                  label="Posts Triaged"
                  tone="text-slate-950"
                  value={`${impact.totalActions}`}
                />
                <MetricCard
                  label="Comments"
                  tone="text-slate-950"
                  value={`${post.numberOfComments}`}
                />
                <MetricCard
                  label="Author"
                  tone="text-slate-950"
                  value={`u/${post.authorName}`}
                />
                <MetricCard
                  label="Decision"
                  tone={
                    analysis.decision === 'remove'
                      ? 'text-rose-700'
                      : analysis.decision === 'review'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                  }
                  value={analysis.decision}
                />
                <MetricCard
                  label="Queue"
                  tone="text-slate-950"
                  value={analysis.caseFile.queuePriority}
                />
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_16px_45px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Analytics snapshot
                    </p>
                    <button
                      className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
                      onClick={() => setDetailDialogMode('impact')}
                    >
                      Open details
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[20px] bg-white/6 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Time saved</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{formatTimeSaved(impact.estimatedMinutesSaved)}</p>
                    </div>
                    <div className="rounded-[20px] bg-white/6 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Posts triaged</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{impact.totalActions}</p>
                    </div>
                    <div className="rounded-[20px] bg-white/6 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Risk intercepts</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{impact.highRiskIntercepts}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-[#fff7ed] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Policy comparison
                    </p>
                    <button
                      className="rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700"
                      onClick={() => setDetailDialogMode('policy')}
                    >
                      Open details
                    </button>
                  </div>
                  <div className="mt-4 rounded-[20px] bg-white px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Active profile</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{activePolicyProfile.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {policySimulations.length} moderation styles are available, but the full comparison stays off the page until needed.
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-5 lg:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Case file
                    </p>
                    <button
                      className="rounded-full bg-slate-950 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
                      onClick={() => setDetailDialogMode('casefile')}
                    >
                      Open details
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[20px] bg-white px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recommended rule</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{analysis.caseFile.recommendedRule}</p>
                    </div>
                    <div className="rounded-[20px] bg-white px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Next step</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{analysis.caseFile.nextStep}</p>
                    </div>
                    <div className="rounded-[20px] bg-white px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Evidence items</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{analysis.caseFile.evidenceSummary.length} key points</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === 'controls' ? (
            <div className="mt-8 space-y-6">
              <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
                <div className="mb-6 rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-5 py-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        {activeControlsSection.kicker}
                      </p>
                      <h4 className="mt-2 text-xl font-semibold text-slate-950">
                        {activeControlsSection.label}
                      </h4>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        {activeControlsSection.description}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {controlsBadge}
                    </div>
                  </div>
                </div>

                {activeControlsTab === 'setup' ? (
                  <>
                    <div className="mb-6 rounded-[24px] bg-slate-950 p-5 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Analyze Reddit Post
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Paste a Reddit post URL or bare post ID to analyze it directly in this console. Launching from a post menu is optional, not required.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 md:flex-row">
                        <input
                          className="min-w-0 flex-1 rounded-[22px] border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition focus:border-slate-500"
                          placeholder="https://reddit.com/r/modqueue_copilot_dev/comments/... or abc123"
                          value={targetPostInput}
                          onChange={(event) => setTargetPostInput(event.target.value)}
                        />
                        <button
                          className="rounded-[22px] bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void linkTargetPost(targetPostInput)}
                          disabled={submittingAction !== null || !targetPostInput.trim()}
                        >
                          Analyze Reddit Post
                        </button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-400">
                        Direct moderation still only works for posts inside r/{post.subredditName}, where the app is installed.
                      </p>
                    </div>

                    <div className="mb-6 rounded-[24px] bg-slate-950 p-5 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Moderation Policy Profile
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Show judges how the same classifier adapts to different subreddit standards without changing the core product.
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {policyProfiles.map((profile) => (
                          <button
                            key={profile.id}
                            className={`rounded-[22px] border px-4 py-4 text-left transition ${
                              profile.id === activePolicyProfile.id
                                ? 'border-white bg-white text-slate-950'
                                : 'border-slate-700 bg-slate-900 text-white hover:border-slate-500'
                            }`}
                            onClick={() => void setPolicyProfile(profile.id)}
                            disabled={submittingAction !== null}
                          >
                            <p className="text-sm font-semibold">{profile.label}</p>
                            <p
                              className={`mt-2 text-xs leading-5 ${
                                profile.id === activePolicyProfile.id
                                  ? 'text-slate-600'
                                  : 'text-slate-300'
                              }`}
                            >
                              {profile.summary}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {mode === 'seeded-demo' ? (
                      <>
                        <div className="mb-6 rounded-[24px] bg-slate-50 p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                Demo Scenarios
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                Switch examples live during the demo to show how the classifier adapts across the mod queue.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {scenarios.map((scenario) => (
                              <ScenarioButton
                                key={scenario.id}
                                active={scenario.id === activeScenario?.id}
                                onClick={() => void setScenario(scenario.id)}
                                scenario={scenario}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mb-6 rounded-[24px] bg-slate-50 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Linked Analysis
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          This console is currently linked to a live Reddit post. You can still paste another Reddit post URL above to switch the analysis target.
                        </p>
                      </div>
                    )}
                  </>
                ) : null}

                {activeControlsTab === 'post' ? (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Post Snapshot
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Review the captured post content and act directly from this panel.
                        </p>
                      </div>
                      <button
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => navigateTo(post.permalink)}
                      >
                        Open on Reddit
                      </button>
                    </div>
                    <div className="mt-6 rounded-[24px] bg-slate-50 p-5">
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <span>{new Date(post.createdAt).toLocaleString()}</span>
                        <span>{post.id}</span>
                        <span>
                          {mode === 'seeded-demo'
                            ? activeScenario?.summary
                            : 'Live Reddit post selected from the moderator menu'}
                        </span>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap rounded-[20px] bg-white px-4 py-4 text-sm leading-7 text-slate-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.15)]">
                        {post.body}
                      </p>
                    </div>
                  </>
                ) : null}

                {activeControlsTab === 'reply' ? (
                  <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_16px_45px_rgba(15,23,42,0.14)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Action Center
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Recommended next move is highlighted first so a moderator can act without scanning the whole dashboard.
                        </p>
                      </div>
                      <div className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
                        Recommended: {recommendedActionLabel(primaryAction)}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Suggested Reply
                        </p>
                        <textarea
                          className="mt-4 min-h-28 w-full rounded-[22px] border border-white/10 bg-slate-900 px-4 py-4 text-sm leading-6 text-slate-100 outline-none transition focus:border-slate-500"
                          value={replyText || analysis.replySuggestion}
                          onChange={(event) => setReplyText(event.target.value)}
                        />
                        <p className="mt-3 text-xs leading-5 text-slate-400">
                          The reply editor is separated here so the moderator can read and edit the comment without scrolling past setup panels first.
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          One-click actions
                        </p>
                        <button
                          className={`mt-4 flex w-full items-center justify-center rounded-[22px] px-4 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            primaryAction === 'remove'
                              ? 'bg-rose-500 text-white hover:bg-rose-600'
                              : primaryAction === 'review'
                                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                                : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                          }`}
                          onClick={() => void runAction(primaryAction)}
                          disabled={submittingAction !== null}
                        >
                          {isSubmitting(primaryAction)
                            ? primaryAction === 'remove'
                              ? 'Removing...'
                              : primaryAction === 'review'
                                ? 'Reviewing...'
                                : 'Approving...'
                            : recommendedActionLabel(primaryAction)}
                        </button>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {secondaryActions.map((action) => (
                            <button
                              key={action}
                              className="rounded-[20px] border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() =>
                                action === 'reply'
                                  ? void runAction('reply', currentReplyText)
                                  : void runAction(action)
                              }
                              disabled={submittingAction !== null}
                            >
                              {isSubmitting(action)
                                ? action === 'reply'
                                  ? 'Replying...'
                                  : action === 'remove'
                                    ? 'Removing...'
                                    : action === 'review'
                                      ? 'Reviewing...'
                                      : 'Approving...'
                                : actionLabel[action]}
                            </button>
                          ))}
                        </div>

                        {mode === 'live-target' && audit.lastAction === 'remove' ? (
                          <div className="mt-4 rounded-[20px] border border-rose-300/25 bg-rose-400/10 px-4 py-4 text-sm leading-6 text-rose-100">
                            <p className="font-semibold uppercase tracking-[0.18em]">
                              Removed By ModQueue Copilot
                            </p>
                            <p className="mt-2">
                              The linked Reddit post was sent through the remove action. Moderators may still see it, but it is now in a removed moderation state rather than normal community flow.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}
              </section>

              <section>
                <div className="rounded-[30px] border border-slate-200 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Quick Facts
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <MetricCard label="Policy" tone="text-slate-950" value={activePolicyProfile.label} />
                    <MetricCard
                      label="Mode"
                      tone="text-slate-950"
                      value={mode === 'live-target' ? 'Live post' : 'Seeded demo'}
                    />
                    <MetricCard label="Reports" tone="text-slate-950" value={`${post.numberOfReports}`} />
                    <MetricCard label="Queue" tone="text-slate-950" value={analysis.caseFile.queuePriority} />
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-6">
              <div className="rounded-[30px] border border-slate-200 bg-[#f4f9f3] p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Moderator Handoff Summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Gives the next moderator a fast brief on the current recommendation, last action, and safest next step.
                    </p>
                  </div>
                  <div className={`text-sm font-semibold uppercase tracking-[0.16em] ${handoffStatusTone(analysis.decision)}`}>
                    {analysis.decision}
                  </div>
                </div>
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5">
                  <ul className="space-y-3 text-sm leading-6 text-slate-700">
                    {handoffSummary.map((item) => (
                      <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Next Best Action
                    </p>
                    <p className="mt-2 text-sm leading-6 text-emerald-900">{handoffNextStep}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-[#eef6ff] p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Recent Queue Activity
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Shows the moderation trail this console is building over time for judges and moderators.
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {recentActivity.length} events
                  </div>
                </div>
                {recentActivity.length > 0 ? (
                  <ul className="mt-5 space-y-3">
                    {recentActivity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </ul>
                ) : (
                  <div className="mt-5 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-5 text-sm leading-6 text-slate-600">
                    No moderation events recorded yet. Run demo actions or link a live post to start building the activity timeline.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[30px] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Heuristic Signals
                </p>
                <ul className="mt-5 space-y-3">
                  {analysis.signals.map((signal) => (
                    <SignalRow key={`${signal.label}-${signal.detail}`} signal={signal} />
                  ))}
                </ul>
              </div>

              <div className="rounded-[30px] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Workflow
                </p>
                <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                  <p>
                    Decisioning is deterministic and based on post text, links, reports, score, and moderation state.
                  </p>
                  <p>
                    Use Review when confidence is mixed, then let the auto-refresh surface any follow-up reports.
                  </p>
                  <p>
                    {mode === 'seeded-demo'
                      ? 'The scenario switcher makes the demo repeatable without depending on a live subreddit mod queue.'
                      : 'Actions in this console target the linked Reddit post. Reddit removals are not deletions, so moderators can still see removed posts while the public queue state changes.'}
                  </p>
                </div>
                {audit.lastReplyText ? (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Last Reply Sent
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {audit.lastReplyText}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
          ) : null}

            </div>
          </div>

          {detailDialog ? (
            <DetailDialog
              bullets={detailDialog.bullets}
              onClose={() => setDetailDialogMode(null)}
              summary={detailDialog.summary}
              title={detailDialog.title}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
