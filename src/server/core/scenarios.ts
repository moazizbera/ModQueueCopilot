import type {
  ModerationScenario,
  ModerationScenarioId,
} from '../../shared/api';

type ScenarioVariant = Omit<ModerationScenario, 'id' | 'label' | 'summary'>;

type ScenarioDefinition = {
  id: ModerationScenarioId;
  label: string;
  summary: string;
  variants: ScenarioVariant[];
};

const scenarioDefinitions: ScenarioDefinition[] = [
  {
    id: 'spam-crypto',
    label: 'Spam',
    summary: 'High-risk spam with multiple links, urgency language, and active reports.',
    variants: [
      {
        body: 'JOIN OUR VIP TELEGRAM ROOM today. We have guaranteed returns, instant approvals, and a discounted access link for the first 20 people. DM me now or hit https://totally-legit.example/vip and https://totally-legit.example/profits before the offer disappears.',
        numberOfComments: 1,
        reportCount: 4,
        score: -6,
        title: 'JOIN OUR VIP CRYPTO SIGNAL GROUP FOR GUARANTEED RETURNS',
      },
      {
        body: 'My private WhatsApp trading club is opening three spots tonight only. Turn $250 into daily profit with copy-paste signals. Message me directly and lock your seat before moderators remove this.',
        numberOfComments: 0,
        reportCount: 5,
        score: -9,
        title: 'Earn daily crypto income if you join my private trading club tonight',
      },
      {
        body: 'Verified airdrop alert. We are paying early users instantly if they join our Discord and connect through the link below. Limited access, no risk, huge upside, do not miss this drop.',
        numberOfComments: 2,
        reportCount: 6,
        score: -11,
        title: 'Verified airdrop access for the first users who join right now',
      },
    ],
  },
  {
    id: 'promotion-launch',
    label: 'Promotion',
    summary: 'Commercial launch post with clear promotional phrasing and a softer enforcement case.',
    variants: [
      {
        body: 'We are launching a new moderation analytics product next week. Early adopters can sign up for a free trial, use promo code MOD50, and join our newsletter for launch updates. Feedback welcome from serious subreddit teams.',
        numberOfComments: 7,
        reportCount: 1,
        score: 3,
        title: 'Launching our new moderation analytics platform with a free trial',
      },
      {
        body: 'Our team just opened beta access for a queue management tool for moderators. If your subreddit wants priority onboarding, drop a comment and we will share invite details and launch pricing.',
        numberOfComments: 9,
        reportCount: 2,
        score: 4,
        title: 'Beta access open for a new queue management tool for mod teams',
      },
      {
        body: 'We built a tool for subreddit teams that want cleaner moderation analytics. Free onboarding this week, feedback welcome, and we can set your team up with a launch discount if there is interest.',
        numberOfComments: 5,
        reportCount: 1,
        score: 6,
        title: 'Free onboarding this week for our new moderation analytics tool',
      },
    ],
  },
  {
    id: 'question-rules',
    label: 'Question',
    summary: 'Good-faith rules question that should usually be approved.',
    variants: [
      {
        body: 'I am new to this community and want to make sure I follow the rules correctly. Is it okay to share a screenshot when asking for help, or should I post only text? I checked the sidebar but I am still unsure.',
        numberOfComments: 11,
        reportCount: 0,
        score: 18,
        title: 'Is it okay to share a screenshot when asking for help here?',
      },
      {
        body: 'Quick rules question from a new member: if I want feedback on a draft, should I post it directly or use the weekly thread first? I read the rules but I want to avoid posting in the wrong format.',
        numberOfComments: 8,
        reportCount: 0,
        score: 16,
        title: 'Should draft feedback go in the weekly thread or as a normal post?',
      },
      {
        body: 'I want to ask for beginner help without breaking any community rules. Is linking to an image album allowed here, or should I keep the post text-only and put more detail in the comments?',
        numberOfComments: 10,
        reportCount: 0,
        score: 19,
        title: 'Can I include an image album in a beginner help post?',
      },
    ],
  },
  {
    id: 'discussion-policy',
    label: 'Discussion',
    summary: 'Healthy community discussion starter with strong context and no obvious risk signals.',
    variants: [
      {
        body: 'Discussion prompt for moderators: should communities lean harder on automation for repetitive removals, or keep more human review in the loop? I want to hear actual experience from teams that scaled fast without burning out the mod queue.',
        numberOfComments: 26,
        reportCount: 0,
        score: 42,
        title: 'What moderation tasks should stay human as communities scale?',
      },
      {
        body: 'For larger communities, where do you draw the line between automated enforcement and moderator judgment? I am curious which workflows you trust automation with and which ones still need a human eye.',
        numberOfComments: 21,
        reportCount: 0,
        score: 36,
        title: 'Where should automation stop and moderator judgment take over?',
      },
      {
        body: 'Moderator discussion: what queue tasks create the most burnout for your team right now, and which ones would you automate first if you had a reliable tool that kept humans in control?',
        numberOfComments: 18,
        reportCount: 0,
        score: 33,
        title: 'Which queue tasks burn out your mod team the fastest?',
      },
    ],
  },
];

const scenarioDefinitionMap = new Map<ModerationScenarioId, ScenarioDefinition>(
  scenarioDefinitions.map((scenario) => [scenario.id, scenario])
);

const buildScenario = (
  definition: ScenarioDefinition,
  variantIndex = 0
): ModerationScenario => {
  const normalizedVariantIndex = Math.abs(variantIndex) % definition.variants.length;
  const variant = definition.variants[normalizedVariantIndex] ?? definition.variants[0];

  if (!variant) {
    throw new Error(`Scenario ${definition.id} has no variants configured`);
  }

  return {
    id: definition.id,
    label: definition.label,
    summary: definition.summary,
    ...variant,
  };
};

const scenarioCatalog: ModerationScenario[] = scenarioDefinitions.map((scenario) =>
  buildScenario(scenario)
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
  scenarioId: ModerationScenarioId,
  variantIndex = 0
): ModerationScenario => {
  const definition = scenarioDefinitionMap.get(scenarioId);
  return definition ? buildScenario(definition, variantIndex) : getFallbackScenario();
};

export const pickModerationScenario = (
  scenarioId: ModerationScenarioId
): { scenario: ModerationScenario; variantIndex: number } => {
  const definition = scenarioDefinitionMap.get(scenarioId);

  if (!definition) {
    return { scenario: getFallbackScenario(), variantIndex: 0 };
  }

  const variantIndex = Math.floor(Math.random() * definition.variants.length);
  return {
    scenario: buildScenario(definition, variantIndex),
    variantIndex,
  };
};

export const isModerationScenarioId = (
  value: unknown
): value is ModerationScenarioId =>
  typeof value === 'string' && scenarioCatalog.some((scenario) => scenario.id === value);

export const defaultScenarioId: ModerationScenarioId = 'spam-crypto';