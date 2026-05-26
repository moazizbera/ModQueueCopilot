import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ModerationAction, ModerationDashboardResponse } from '../shared/api';
import { useModerationAssistant } from './hooks/useModerationAssistant';

const moderationActions: ModerationAction[] = ['approve', 'remove', 'review'];

const badgeTone = (decision: ModerationDashboardResponse['analysis']['decision']) => {
  switch (decision) {
    case 'remove':
      return 'bg-rose-500 text-white shadow-[0_18px_40px_rgba(244,63,94,0.28)]';
    case 'review':
      return 'bg-amber-400 text-slate-950 shadow-[0_18px_40px_rgba(251,191,36,0.24)]';
    case 'approve':
      return 'bg-emerald-400 text-slate-950 shadow-[0_18px_40px_rgba(52,211,153,0.24)]';
  }
};

const riskLevelLabel = (
  decision: ModerationDashboardResponse['analysis']['decision'],
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

const categoryLabel = (category: ModerationDashboardResponse['analysis']['category']): string =>
  category === 'SPAM'
    ? 'Likely Scam'
    : category === 'PROMOTION'
      ? 'Likely Promotion'
      : category === 'QUESTION'
        ? 'Likely Good-Faith Question'
        : category === 'DISCUSSION'
          ? 'Likely Healthy Discussion'
          : 'Mixed Signals';

const recommendedActionLabel = (
  decision: ModerationDashboardResponse['analysis']['decision']
): string => {
  switch (decision) {
    case 'remove':
      return 'Remove now';
    case 'review':
      return 'Send for human review';
    case 'approve':
      return 'Approve and monitor';
  }
};

const decisionHeadline = (
  decision: ModerationDashboardResponse['analysis']['decision']
): string => {
  switch (decision) {
    case 'remove':
      return 'High-risk post. Remove before it spreads.';
    case 'review':
      return 'Borderline post. Escalate for moderator review.';
    case 'approve':
      return 'Low-risk post. Approve and keep momentum.';
  }
};

const actionLabel: Record<ModerationAction, string> = {
  approve: 'Approve',
  remove: 'Remove',
  reply: 'Reply',
  review: 'Review',
};

const actionTone = (action: ModerationAction, primary: boolean): string => {
  if (primary) {
    switch (action) {
      case 'remove':
        return 'bg-rose-500 text-white hover:bg-rose-600';
      case 'review':
        return 'bg-amber-400 text-slate-950 hover:bg-amber-300';
      case 'approve':
        return 'bg-emerald-400 text-slate-950 hover:bg-emerald-300';
      case 'reply':
        return 'bg-sky-400 text-slate-950 hover:bg-sky-300';
    }
  }

  return 'border border-white/12 bg-white/6 text-white hover:bg-white/10';
};

const queuePriorityLabel = (
  priority: ModerationDashboardResponse['analysis']['caseFile']['queuePriority']
): string => `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;

const formatCompactNumber = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${value}`;
};

const formatActionCopy = (action: ModerationAction, submitting: boolean): string => {
  if (!submitting) {
    return actionLabel[action];
  }

  switch (action) {
    case 'approve':
      return 'Approving...';
    case 'remove':
      return 'Removing...';
    case 'review':
      return 'Reviewing...';
    case 'reply':
      return 'Replying...';
  }
};

const metaTone = (
  decision: ModerationDashboardResponse['analysis']['decision']
): string => {
  switch (decision) {
    case 'remove':
      return 'text-rose-200';
    case 'review':
      return 'text-amber-200';
    case 'approve':
      return 'text-emerald-200';
  }
};

const MiniStat = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{label}</p>
    <p className="mt-2 text-lg font-semibold text-white">{value}</p>
  </div>
);

export const Splash = () => {
  const { dashboard, error, loading, runAction, submittingAction } = useModerationAssistant();

  const isSubmitting = (action: ModerationAction): boolean => submittingAction === action;

  const primaryAction = dashboard?.analysis.decision;
  const secondaryActions = moderationActions.filter(
    (action) => action !== primaryAction
  );

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#f8d87a_0%,transparent_34%),radial-gradient(circle_at_bottom_right,#fb7185_0%,transparent_26%),linear-gradient(180deg,#121826_0%,#1e293b_48%,#f4efe7_48%,#efe3d0_100%)] px-4 py-5 text-slate-900">
      <div className="mx-auto max-w-[28rem] rounded-[32px] border border-white/12 bg-slate-950/88 p-5 shadow-[0_36px_120px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/90">
              ModQueue Copilot
            </p>
            <h1 className="mt-2 text-[1.65rem] font-semibold leading-tight text-white">
              Moderator triage for u/{context.username ?? 'moderator'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Instant verdict, transparent reasons, and direct action from the post itself.
            </p>
          </div>
          <div className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300">
            {dashboard
              ? dashboard.mode === 'live-target'
                ? 'Live'
                : 'Demo'
              : 'Loading'}
          </div>
        </div>

        <div className="mt-5 rounded-[30px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-32 rounded-full bg-white/10" />
              <div className="h-10 rounded-2xl bg-white/10" />
              <div className="h-20 rounded-3xl bg-white/10" />
              <div className="grid grid-cols-3 gap-2">
                <div className="h-16 rounded-3xl bg-white/10" />
                <div className="h-16 rounded-3xl bg-white/10" />
                <div className="h-16 rounded-3xl bg-white/10" />
              </div>
            </div>
          ) : dashboard ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] ${badgeTone(dashboard.analysis.decision)}`}
                >
                  {riskLevelLabel(dashboard.analysis.decision, dashboard.analysis.confidence)}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${metaTone(dashboard.analysis.decision)}`}>
                  {queuePriorityLabel(dashboard.analysis.caseFile.queuePriority)}
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-semibold leading-tight text-white">
                {decisionHeadline(dashboard.analysis.decision)}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                <span>{categoryLabel(dashboard.analysis.category)}</span>
                <span className="text-slate-500">/</span>
                <span>{recommendedActionLabel(dashboard.analysis.decision)}</span>
                <span className="text-slate-500">/</span>
                <span>{dashboard.analysis.confidence}% confidence</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-200">{dashboard.analysis.reason}</p>

              <div className="mt-4 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-2 rounded-full ${badgeTone(dashboard.analysis.decision)}`}
                  style={{ width: `${dashboard.analysis.confidence}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <MiniStat label="Confidence" value={`${dashboard.analysis.confidence}%`} />
                <MiniStat label="Reports" value={formatCompactNumber(dashboard.post.numberOfReports)} />
                <MiniStat label="Comments" value={formatCompactNumber(dashboard.post.numberOfComments)} />
              </div>

              <div className="mt-4 grid gap-2">
                {dashboard.analysis.signals.slice(0, 3).map((signal) => (
                  <div
                    key={`${signal.label}-${signal.detail}`}
                    className="rounded-2xl border border-white/10 bg-white/6 px-3 py-3 text-sm leading-5 text-slate-200"
                  >
                    <span className="font-semibold text-white">{signal.label}</span>
                    <span className="text-slate-400"> {'->'} </span>
                    {signal.detail}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <span>Post snapshot</span>
                  <span>r/{dashboard.post.subredditName}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-white">
                  {dashboard.post.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>u/{dashboard.post.authorName}</span>
                  <span>Score {formatCompactNumber(dashboard.post.score)}</span>
                  <span>{dashboard.post.source === 'linked-target' ? 'Live target' : 'Seeded scenario'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-100">
              The dashboard could not load for this post context.
            </div>
          )}
        </div>

        {dashboard ? (
          <div className="mt-4 rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            {dashboard.mode === 'live-target'
              ? `Live moderation is armed for r/${dashboard.post.subredditName}.`
              : `Demo mode is active. Launch from a post menu for one-tap live moderation in r/${dashboard.post.subredditName}.`}
          </div>
        ) : null}

        {dashboard && primaryAction ? (
          <div className="mt-4">
            <button
              className={`flex h-12 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionTone(primaryAction, true)}`}
              onClick={() => void runAction(primaryAction)}
              disabled={submittingAction !== null}
            >
              {formatActionCopy(primaryAction, isSubmitting(primaryAction))}
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {secondaryActions.map((action) => (
                <button
                  key={action}
                  className={`flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${actionTone(action, false)}`}
                  onClick={() => void runAction(action)}
                  disabled={submittingAction !== null}
                >
                  {formatActionCopy(action, isSubmitting(action))}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-3xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-xs leading-5 text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-4 rounded-3xl border border-white/10 bg-white/6 px-4 py-3 text-xs leading-5 text-slate-300">
          Best demo path: open a post, launch ModQueue Copilot from the menu, show the verdict, top signals, and the primary action button.
        </div>

        <button
          className="mt-5 flex h-12 w-full items-center justify-center rounded-full border border-white/12 bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          Open Full Moderation Console
        </button>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
