import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { parseTargetPostId } from '../core/targetPost';
import { buildPlaytestPostUrl } from '../core/urls';

type AnalyzePostFormValues = {
  targetPost?: string;
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
