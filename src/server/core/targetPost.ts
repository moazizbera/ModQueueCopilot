import { isT3 } from '@devvit/shared-types/tid.js';
import type { T3 } from '@devvit/shared-types/tid.js';

export const parseTargetPostId = (value: string): T3 | null => {
  const trimmedValue = value.trim();

  if (isT3(trimmedValue)) {
    return trimmedValue;
  }

  const commentsMatch = trimmedValue.match(/\/comments\/([a-z0-9]+)\//i);
  if (commentsMatch?.[1]) {
    const candidate = `t3_${commentsMatch[1]}`;
    return isT3(candidate) ? candidate : null;
  }

  const bareIdMatch = trimmedValue.match(/^[a-z0-9]+$/i);
  if (bareIdMatch) {
    const candidate = `t3_${trimmedValue}`;
    return isT3(candidate) ? candidate : null;
  }

  return null;
};