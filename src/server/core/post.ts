import { context, reddit } from '@devvit/web/server';
import type { T3 } from '@devvit/shared-types/tid.js';
import type { Post } from '@devvit/web/server';
import type { ModerationScenarioId } from '../../shared/api';
import { defaultScenarioId, pickModerationScenario } from './scenarios';

type CreateScenarioPostOptions = {
  scenarioId?: ModerationScenarioId;
  targetPostId?: T3;
};

const trimTitle = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
};

const assertTargetPostMatchesCurrentSubreddit = (targetPost: Post): void => {
  if (!context.subredditName) {
    throw new Error('Current subreddit context is unavailable for linked moderation');
  }

  if (targetPost.subredditName !== context.subredditName) {
    throw new Error(
      `Linked moderation only works for posts inside r/${context.subredditName}. Open a post from that subreddit or install the app in r/${targetPost.subredditName}.`
    );
  }
};

export const createPost = async ({
  scenarioId = defaultScenarioId,
  targetPostId,
}: CreateScenarioPostOptions = {}) => {
  if (targetPostId) {
    const targetPost = await reddit.getPostById(targetPostId);
    assertTargetPostMatchesCurrentSubreddit(targetPost);
    const targetTitle = trimTitle(targetPost.title, 64);

    return await reddit.submitCustomPost({
      entry: 'default',
      postData: {
        targetPostId,
      },
      textFallback: {
        text: targetPost.body?.trim() || 'No body text provided on the target post.',
      },
      title: `ModQueue Copilot: ${targetTitle}`,
    });
  }

  const { scenario, variantIndex } = pickModerationScenario(scenarioId);

  return await reddit.submitCustomPost({
    entry: 'default',
    postData: {
      scenarioId,
      scenarioVariantIndex: variantIndex,
    },
    textFallback: {
      text: scenario.body,
    },
    title: scenario.title,
  });
};
