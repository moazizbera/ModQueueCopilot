import './index.css';

import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { ModerationAction, ModerationDashboardResponse } from '../shared/api';
import { useModerationAssistant } from './hooks/useModerationAssistant';

const badgeTone = (decision: ModerationDashboardResponse['analysis']['decision']) => {
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

export const Splash = () => {
  const { dashboard, error, loading, runAction, submittingAction } = useModerationAssistant();

  const isSubmitting = (action: ModerationAction): boolean => submittingAction === action;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fdf2d3,transparent_42%),linear-gradient(180deg,#f7f1e7_0%,#efe7da_100%)] px-4 py-5 text-slate-900">
      <div className="mx-auto rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              ModQueue Copilot
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-950">
              Queue triage for u/{context.username ?? 'moderator'}
            </h1>
          </div>
          {dashboard ? (
            <span
              className={`rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeTone(dashboard.analysis.decision)}`}
            >
              {dashboard.analysis.decision}
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-[22px] bg-slate-950 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Direct Post Analysis
          </p>
          {loading ? (
            <div className="mt-3 h-16 animate-pulse rounded-2xl bg-slate-800" />
          ) : dashboard ? (
            <>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {dashboard.mode === 'live-target'
                  ? 'Already linked to the current Reddit post'
                  : 'Demo console loaded. Use the post menu for one-tap live analysis.'}
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {riskLevelLabel(dashboard.analysis.decision, dashboard.analysis.confidence)}
              </p>
              <p className="mt-2 text-lg font-semibold">
                {categoryLabel(dashboard.analysis.category)} ({dashboard.analysis.confidence}%)
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                Recommended action: {recommendedActionLabel(dashboard.analysis.decision)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {dashboard.analysis.reason}
              </p>
              <div className="mt-3 grid gap-2">
                {dashboard.analysis.signals.slice(0, 2).map((signal) => (
                  <div key={`${signal.label}-${signal.detail}`} className="rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-300">
                    <span className="font-semibold text-white">{signal.label}:</span> {signal.detail}
                  </div>
                ))}
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                {dashboard.post.title}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The dashboard could not load for this post context.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span>{dashboard ? `r/${dashboard.post.subredditName}` : 'Awaiting dashboard data'}</span>
          <span>
            {dashboard
              ? dashboard.mode === 'live-target'
                ? 'Live target'
                : 'Demo mode'
              : context.postId}
          </span>
        </div>

        {dashboard ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            Live actions only work for posts inside r/{dashboard.post.subredditName}, where this app is installed for moderators.
          </div>
        ) : null}

        {dashboard ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              className="flex h-10 items-center justify-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void runAction('approve')}
              disabled={submittingAction !== null}
            >
              {isSubmitting('approve') ? 'Approving...' : 'Approve'}
            </button>
            <button
              className="flex h-10 items-center justify-center rounded-full bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void runAction('remove')}
              disabled={submittingAction !== null}
            >
              {isSubmitting('remove') ? 'Removing...' : 'Remove'}
            </button>
            <button
              className="flex h-10 items-center justify-center rounded-full bg-amber-500 px-3 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void runAction('review')}
              disabled={submittingAction !== null}
            >
              {isSubmitting('review') ? 'Reviewing...' : 'Review'}
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          If you launched from the post menu, this card is already analyzing that post directly. Pasting a URL is only for the subreddit-level fallback flow.
        </div>

        <button
          className="mt-5 flex h-11 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
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
