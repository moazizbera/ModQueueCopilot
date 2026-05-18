import { startTransition, useCallback, useEffect, useState } from 'react';
import { showToast } from '@devvit/web/client';
import type {
  ApiErrorResponse,
  ModerationAction,
  ModerationActionRequest,
  ModerationActionResponse,
  ModerationDashboardResponse,
  ModerationPolicyProfileId,
  ModerationPolicyProfileResponse,
  ModerationScenarioId,
  ModerationScenarioResponse,
  ModerationTargetPostResponse,
} from '../../shared/api';

type ModerationAssistantState = {
  dashboard: ModerationDashboardResponse | null;
  error: string | null;
  loading: boolean;
  submittingAction: ModerationAction | null;
};

const refreshIntervalMs = 20000;

const readApiError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.message;
  } catch {
    return `HTTP ${response.status}`;
  }
};

export const useModerationAssistant = () => {
  const [state, setState] = useState<ModerationAssistantState>({
    dashboard: null,
    error: null,
    loading: true,
    submittingAction: null,
  });

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard');

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const dashboard = (await response.json()) as ModerationDashboardResponse;
      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          dashboard,
          error: null,
          loading: false,
        }));
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load moderation dashboard';

      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          error: message,
          loading: false,
        }));
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const runAction = useCallback(
    async (action: ModerationAction, replyText?: string) => {
      setState((previousState) => ({
        ...previousState,
        submittingAction: action,
      }));

      try {
        const request: ModerationActionRequest = replyText
          ? { action, replyText }
          : { action };
        const response = await fetch('/api/action', {
          body: JSON.stringify(request),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const result = (await response.json()) as ModerationActionResponse;

        setState((previousState) => ({
          ...previousState,
          dashboard: result.dashboard,
          error: null,
          submittingAction: null,
        }));
        showToast(result.toastMessage);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Failed to ${action} post`;

        setState((previousState) => ({
          ...previousState,
          error: message,
          submittingAction: null,
        }));
        showToast(message);
      }
    },
    []
  );

  const setScenario = useCallback(async (scenarioId: ModerationScenarioId) => {
    setState((previousState) => ({
      ...previousState,
      loading: true,
    }));

    try {
      const response = await fetch('/api/scenario', {
        body: JSON.stringify({ scenarioId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const result = (await response.json()) as ModerationScenarioResponse;
      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          dashboard: result.dashboard,
          error: null,
          loading: false,
        }));
      });
      showToast(result.toastMessage);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to switch moderation scenario';

      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          error: message,
          loading: false,
        }));
      });
      showToast(message);
    }
  }, []);

  const setPolicyProfile = useCallback(async (policyProfileId: ModerationPolicyProfileId) => {
    setState((previousState) => ({
      ...previousState,
      loading: true,
    }));

    try {
      const response = await fetch('/api/policy-profile', {
        body: JSON.stringify({ policyProfileId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const result = (await response.json()) as ModerationPolicyProfileResponse;
      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          dashboard: result.dashboard,
          error: null,
          loading: false,
        }));
      });
      showToast(result.toastMessage);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to switch moderation policy';

      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          error: message,
          loading: false,
        }));
      });
      showToast(message);
    }
  }, []);

  const linkTargetPost = useCallback(async (targetPost: string) => {
    setState((previousState) => ({
      ...previousState,
      loading: true,
    }));

    try {
      const response = await fetch('/api/target-post', {
        body: JSON.stringify({ targetPost }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const result = (await response.json()) as ModerationTargetPostResponse;
      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          dashboard: result.dashboard,
          error: null,
          loading: false,
        }));
      });
      showToast(result.toastMessage);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to link target post';

      startTransition(() => {
        setState((previousState) => ({
          ...previousState,
          error: message,
          loading: false,
        }));
      });
      showToast(message);
    }
  }, []);

  return {
    ...state,
    linkTargetPost,
    refresh,
    runAction,
    setPolicyProfile,
    setScenario,
  } as const;
};