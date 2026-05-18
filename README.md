## ModQueue Copilot

ModQueue Copilot is a real Reddit moderation assistant built with Devvit. It helps moderators triage live posts, detect spam and risky content, recommend actions, and execute moderation workflows directly inside Reddit.

## What It Does

- Analyze live subreddit posts inside the installed subreddit
- Recommend `Approve`, `Remove`, `Review`, or `Reply`
- Execute real moderation actions from the compact view or full console
- Show a structured moderator case file with queue priority, evidence summary, next step, and risk dimensions
- Compare outcomes across multiple moderation policy profiles
- Track persistent activity history and operational impact analytics
- Support seeded demo scenarios for reliable hackathon presentations

## Key Features

- Direct post-menu analysis for moderator workflows
- Live linked-post moderation console
- Strong spam and scam heuristics including earnings claims, urgency, off-platform routing, and investment-scam patterns
- Author-risk context based on recent moderation history
- Policy stress testing across `Balanced Ops`, `Strict Spam Shield`, and `Community Support`
- Moderator handoff summary for team workflows
- Ops Impact Center with estimated time saved and high-risk intercept counts
- Recent Queue Activity audit trail

## Platform Scope

Live moderation actions only work for posts inside the same subreddit where the app is installed and where the moderator has access. This is a Reddit platform constraint, not an app-specific limitation.

That means:

- Other users' posts in the installed subreddit: supported
- Your own posts in the installed subreddit: supported
- Posts from a different subreddit: not supported unless the app is also installed there and you moderate that subreddit

## Demo Flow

1. Open a post in the installed subreddit as a moderator.
2. Use `Analyze with ModQueue Copilot` from the post menu.
3. Review the direct analysis in the compact view.
4. Open the full moderation console.
5. Show the `Policy Stress Test`, `Moderator Case File`, `Moderator Handoff Summary`, and `Ops Impact Center`.
6. Execute a live action like `Remove` or `Review`.

## Local Development

Requirements:

- Node.js 22+
- Devvit CLI access
- A Reddit account connected for Devvit development

Default playtest subreddit:

- `modqueue_copilot_dev`

This is configured in `devvit.json` under `dev.subreddit`.

## Commands

- `npm run dev`: Starts Devvit playtest for live Reddit development
- `npm run build`: Builds the client and server bundles
- `npm run deploy`: Type checks, lints, and uploads a new app version
- `npm run launch`: Deploys and publishes the app
- `npm run login`: Logs the Devvit CLI into Reddit
- `npm run type-check`: Runs the TypeScript build check
- `npm run lint`: Runs ESLint

## Tech Stack

- Devvit
- React
- Hono
- TypeScript
- Vite
- Tailwind CSS

## Hackathon Positioning

ModQueue Copilot is a real working moderation app with demo-safe features layered on top for reliable presentation. It combines live Reddit actions with transparent moderation reasoning, policy-aware decision support, and measurable workflow impact.
