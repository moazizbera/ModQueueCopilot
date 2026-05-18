import type {
  ModerationScenario,
  ModerationScenarioId,
} from '../../shared/api';

const scenarioCatalog: ModerationScenario[] = [
  {
    body: 'JOIN OUR VIP TELEGRAM ROOM today. We have guaranteed returns, instant approvals, and a discounted access link for the first 20 people. DM me now or hit https://totally-legit.example/vip and https://totally-legit.example/profits before the offer disappears.',
    id: 'spam-crypto',
    label: 'Spam',
    numberOfComments: 1,
    reportCount: 4,
    score: -6,
    summary: 'High-risk spam with multiple links, urgency language, and active reports.',
    title: 'JOIN OUR VIP CRYPTO SIGNAL GROUP FOR GUARANTEED RETURNS',
  },
  {
    body: 'We are launching a new moderation analytics product next week. Early adopters can sign up for a free trial, use promo code MOD50, and join our newsletter for launch updates. Feedback welcome from serious subreddit teams.',
    id: 'promotion-launch',
    label: 'Promotion',
    numberOfComments: 7,
    reportCount: 1,
    score: 3,
    summary: 'Commercial launch post with clear promotional phrasing and a softer enforcement case.',
    title: 'Launching our new moderation analytics platform with a free trial',
  },
  {
    body: 'I am new to this community and want to make sure I follow the rules correctly. Is it okay to share a screenshot when asking for help, or should I post only text? I checked the sidebar but I am still unsure.',
    id: 'question-rules',
    label: 'Question',
    numberOfComments: 11,
    reportCount: 0,
    score: 18,
    summary: 'Good-faith rules question that should usually be approved.',
    title: 'Is it okay to share a screenshot when asking for help here?',
  },
  {
    body: 'Discussion prompt for moderators: should communities lean harder on automation for repetitive removals, or keep more human review in the loop? I want to hear actual experience from teams that scaled fast without burning out the mod queue.',
    id: 'discussion-policy',
    label: 'Discussion',
    numberOfComments: 26,
    reportCount: 0,
    score: 42,
    summary: 'Healthy community discussion starter with strong context and no obvious risk signals.',
    title: 'What moderation tasks should stay human as communities scale?',
  },
];

const scenarioMap = new Map<ModerationScenarioId, ModerationScenario>(
  scenarioCatalog.map((scenario) => [scenario.id, scenario])
);

const getFallbackScenario = (): ModerationScenario => {
  const fallbackScenario = scenarioCatalog[0];

  if (!fallbackScenario) {
    throw new Error('Moderation scenario catalog is empty');
  }

  return fallbackScenario;
};

export const getModerationScenarios = (): ModerationScenario[] => scenarioCatalog;

export const getModerationScenario = (
  scenarioId: ModerationScenarioId
): ModerationScenario => scenarioMap.get(scenarioId) ?? getFallbackScenario();

export const isModerationScenarioId = (
  value: unknown
): value is ModerationScenarioId =>
  typeof value === 'string' && scenarioCatalog.some((scenario) => scenario.id === value);

export const defaultScenarioId: ModerationScenarioId = 'spam-crypto';