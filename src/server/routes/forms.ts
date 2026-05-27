import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { parseTargetPostId } from '../core/targetPost';
import { buildPlaytestPostUrl } from '../core/urls';
import type { ModerationScenarioId } from '../../shared/api';

type AnalyzePostFormValues = {
  targetPost?: string;
};

const submitScenarioPreview = async (
  scenarioId: ModerationScenarioId
): Promise<UiResponse> => {
  try {
    const post = await createPost({ scenarioId, scenarioVariantIndex: 0 });

    return {
      navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
    };
  } catch (error) {
    console.error(`Failed to create ${scenarioId} demo post:`, error);

    return {
      showToast: 'Failed to create moderation demo post',
    };
  }
};

export const forms = new Hono();

forms.post('/analyze-post-submit', async (c) => {
  const { targetPost } = await c.req.json<AnalyzePostFormValues>();
  const trimmedTargetPost = typeof targetPost === 'string' ? targetPost.trim() : '';

  if (!trimmedTargetPost) {
    return c.json<UiResponse>(
      {
        showToast: 'Post URL or ID is required',
      },
      400
    );
  }

  const targetPostId = parseTargetPostId(trimmedTargetPost);

  if (!targetPostId) {
    return c.json<UiResponse>(
      {
        showToast: 'Could not parse a valid Reddit post ID from that input',
      },
      400
    );
  }

  try {
    const post = await createPost({ targetPostId });

    return c.json<UiResponse>(
      {
        navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Failed to create linked moderation console: ${error}`);

    return c.json<UiResponse>(
      {
        showToast: 'Failed to create linked moderation console',
      },
      400
    );
  }
});

forms.post('/create-spam-demo-post-submit', async (c) => {
  return c.json<UiResponse>(await submitScenarioPreview('spam-crypto'), 200);
});

forms.post('/create-promotion-demo-post-submit', async (c) => {
  return c.json<UiResponse>(await submitScenarioPreview('promotion-launch'), 200);
});

forms.post('/create-question-demo-post-submit', async (c) => {
  return c.json<UiResponse>(await submitScenarioPreview('question-rules'), 200);
});

forms.post('/create-discussion-demo-post-submit', async (c) => {
  return c.json<UiResponse>(await submitScenarioPreview('discussion-policy'), 200);
});
