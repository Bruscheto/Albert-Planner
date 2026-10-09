# Albert Planner web and AI expansion

## Why

The extension already captures courses and supports manual scheduling, but students cannot retain plans across devices or ask it to plan around personal goals. Add a persistent web workspace with real AI assistance in the first usable release.

This is a product expansion, independent of the older FutureFork hackathon proposal. Reuse its goal intake, evidence, comparison, and backup concepts; its competition gates and optional-AI restriction do not apply here. Keep that proposal intact.

## What Changes

- Add a TypeScript web application in this repository with login, editable planning profile, saved plans, and account deletion/export.
- Import existing extension exports through an explicit preview and confirmation step.
- Generate and compare candidate semester plans using known course records, explicit constraints, and evidence-backed AI explanations.
- Extract only reusable scheduling and validation code; preserve local extension operation.
- Follow the first release with an explicit website-to-extension import bridge; defer automatic bidirectional sync.

## Capabilities

### New Capabilities

- `web-ai-planning`: Authenticated personal planning workspace, validated imports, bounded AI recommendations, and durable plan revisions.

### Modified Capabilities

None of the existing formal specifications are changed.

## Impact

New web runtime, hosted authentication/database, server-side model calls, shared course contracts, deployment configuration, and privacy disclosures. Existing extension source stays in place during initial delivery. No services are provisioned or code implemented by this plan.
