import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';
import { buildPlaytestPostUrl } from '../core/urls';
import { executeMenuModerationAction } from '../core/moderation';

export const menu = new Hono();

const requireMenuPostContext = (): UiResponse | null => {
  if (context.postId) {
    return null;
  }

  return {
    showToast: 'Open this action from a post',
  };
};

const runPostMenuAction = async (
  action: 'approve' | 'auto' | 'remove' | 'review'
): Promise<{ response: UiResponse; status: 200 | 400 }> => {
  const missingContextResponse = requireMenuPostContext();

  if (missingContextResponse) {
    return {
      response: missingContextResponse,
      status: 400,
    };
  }

  try {
    const toastMessage = await executeMenuModerationAction(action);
    return {
      response: {
        showToast: toastMessage,
      },
      status: 200,
    };
  } catch (error) {
    console.error(`Post menu action ${action} failed:`, error);
    return {
      response: {
        showToast: `Failed to ${action === 'auto' ? 'apply recommended status' : action} from the post menu`,
      },
      status: 400,
    };
  }
};

menu.post('/analyze-post-form', async (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        form: {
          acceptLabel: 'Open Analysis Console',
          description:
            'Paste a Reddit post URL, full thing ID, or bare post ID to launch linked moderation analysis.',
          fields: [
            {
              helpText:
                'Examples: https://reddit.com/r/modqueue_copilot_dev/comments/abc123/title, t3_abc123, or abc123',
              label: 'Post URL or ID',
              name: 'targetPost',
              required: true,
              type: 'string',
            },
          ],
          title: 'Analyze Reddit Post',
        },
        name: 'analyzePostForm',
      },
    },
    200
  );
});

menu.post('/analyze-current-post', async (c) => {
  if (!context.postId) {
    return c.json<UiResponse>(
      {
        showToast: 'Open this action from a post to launch analysis',
      },
      400
    );
  }

  try {
    const post = await createPost({ targetPostId: context.postId });

    return c.json<UiResponse>(
      {
        navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating analysis post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create linked moderation console',
      },
      400
    );
  }
});

menu.post('/auto-moderate-current-post', async (c) => {
  const { response, status } = await runPostMenuAction('auto');
  return c.json<UiResponse>(response, status);
});

menu.post('/approve-current-post', async (c) => {
  const { response, status } = await runPostMenuAction('approve');
  return c.json<UiResponse>(response, status);
});

menu.post('/review-current-post', async (c) => {
  const { response, status } = await runPostMenuAction('review');
  return c.json<UiResponse>(response, status);
});

menu.post('/remove-current-post', async (c) => {
  const { response, status } = await runPostMenuAction('remove');
  return c.json<UiResponse>(response, status);
});

menu.post('/post-create-spam', async (c) => {
  try {
    const post = await createPost({ scenarioId: 'spam-crypto' });

    return c.json<UiResponse>(
      {
        navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create moderation demo post',
      },
      400
    );
  }
});

menu.post('/post-create-promotion', async (c) => {
  try {
    const post = await createPost({ scenarioId: 'promotion-launch' });

    return c.json<UiResponse>(
      {
        navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create moderation demo post',
      },
      400
    );
  }
});

menu.post('/post-create-question', async (c) => {
  try {
    const post = await createPost({ scenarioId: 'question-rules' });

    return c.json<UiResponse>(
      {
        navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create moderation demo post',
      },
      400
    );
  }
});

menu.post('/post-create-discussion', async (c) => {
  try {
    const post = await createPost({ scenarioId: 'discussion-policy' });

    return c.json<UiResponse>(
      {
        navigateTo: buildPlaytestPostUrl(context.subredditName, post.id),
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create moderation demo post',
      },
      400
    );
  }
});
