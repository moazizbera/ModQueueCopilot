export const playtestQuery = 'playtest=modqueue-copilot';

export const buildPlaytestPostUrl = (
  subredditName: string,
  postId: string
): string =>
  `https://reddit.com/r/${subredditName}/comments/${postId}?${playtestQuery}`;