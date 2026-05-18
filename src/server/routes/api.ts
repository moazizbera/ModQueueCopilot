import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type {
  ApiErrorResponse,
  ModerationActionRequest,
  ModerationActionResponse,
  ModerationDashboardResponse,
  ModerationPolicyProfileRequest,
  ModerationPolicyProfileResponse,
  ModerationScenarioRequest,
  ModerationScenarioResponse,
  ModerationTargetPostRequest,
  ModerationTargetPostResponse,
} from '../../shared/api';
import {
  buildModerationDashboard,
  executeModerationAction,
  linkCurrentConsoleToTargetPost,
  setModerationPolicyProfile,
  setModerationScenario,
} from '../core/moderation';
import { isModerationScenarioId } from '../core/scenarios';
import { parseTargetPostId } from '../core/targetPost';

export const api = new Hono();

api.get('/dashboard', async (c) => {
  try {
    const dashboard = await buildModerationDashboard();

    return c.json<ModerationDashboardResponse>(dashboard, 200);
  } catch (error) {
    console.error(`Dashboard load failed for post ${context.postId}:`, error);
    let errorMessage = 'Unknown error during initialization';
    if (error instanceof Error) {
      errorMessage = `Dashboard failed: ${error.message}`;
    }
    return c.json<ApiErrorResponse>(
      { status: 'error', message: errorMessage },
      400
    );
  }
});

api.post('/action', async (c) => {
  const body = await c.req.json<ModerationActionRequest>();

  if (!body.action) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'action is required',
      },
      400
    );
  }

  try {
    const response = await executeModerationAction(body);

    return c.json<ModerationActionResponse>(response, 200);
  } catch (error) {
    console.error(`Moderation action failed for post ${context.postId}:`, error);
    const message =
      error instanceof Error ? error.message : 'Unknown action failure';

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message,
      },
      400
    );
  }
});

api.post('/scenario', async (c) => {
  const body = await c.req.json<ModerationScenarioRequest>();

  if (!isModerationScenarioId(body.scenarioId)) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Valid scenarioId is required',
      },
      400
    );
  }

  try {
    const dashboard = await setModerationScenario(body.scenarioId);

    return c.json<ModerationScenarioResponse>(
      {
        dashboard,
        toastMessage: `Loaded ${body.scenarioId.replace('-', ' ')} scenario`,
        type: 'scenario',
      },
      200
    );
  } catch (error) {
    console.error(`Scenario load failed for post ${context.postId}:`, error);
    const message =
      error instanceof Error ? error.message : 'Unknown scenario failure';

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message,
      },
      400
    );
  }
});

api.post('/policy-profile', async (c) => {
  const body = await c.req.json<ModerationPolicyProfileRequest>();

  if (
    body.policyProfileId !== 'balanced' &&
    body.policyProfileId !== 'strict-spam' &&
    body.policyProfileId !== 'community-support'
  ) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Valid policyProfileId is required',
      },
      400
    );
  }

  try {
    const dashboard = await setModerationPolicyProfile(body.policyProfileId);

    return c.json<ModerationPolicyProfileResponse>(
      {
        dashboard,
        toastMessage: `Loaded ${body.policyProfileId.replace('-', ' ')} policy`,
        type: 'policy-profile',
      },
      200
    );
  } catch (error) {
    console.error(`Policy profile load failed for post ${context.postId}:`, error);
    const message =
      error instanceof Error ? error.message : 'Unknown policy profile failure';

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message,
      },
      400
    );
  }
});

api.post('/target-post', async (c) => {
  const body = await c.req.json<ModerationTargetPostRequest>();
  const targetPostId = parseTargetPostId(body.targetPost ?? '');

  if (!targetPostId) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Valid Reddit post URL or ID is required',
      },
      400
    );
  }

  try {
    const dashboard = await linkCurrentConsoleToTargetPost(targetPostId);

    return c.json<ModerationTargetPostResponse>(
      {
        dashboard,
        toastMessage: 'Linked console to live Reddit post',
        type: 'target-post',
      },
      200
    );
  } catch (error) {
    console.error(`Target post link failed for post ${context.postId}:`, error);
    const message =
      error instanceof Error ? error.message : 'Unknown target post failure';

    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message,
      },
      400
    );
  }
});
