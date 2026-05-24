# FollowVine Commercial MVP Design

## Scope Decision

FollowVine should be redesigned as a commercial AI visual explainer SaaS, not extended as a demo-only image generation page. The commercial MVP must support paid membership, credit packs, credit deduction, a model-channel gateway, database-backed generation tasks, an admin console, and a commercial front-end experience.

The first version focuses on a paid product loop that can be operated safely: users can sign in, buy membership or credits, spend credits on image generation tasks, view their generated paths, and admins can manage users, orders, credits, tasks, model channels, and core settings.

## Product Information Architecture

### Public Frontend

- Marketing homepage: explains the AI drill-down explainer-book value proposition, shows examples, use cases, and calls to action.
- Pricing and recharge page: presents membership plans and credit packs, then creates Z-Pay / 易支付 payment orders.
- Template and case library: shows reusable topics, example paths, and entry points for SEO landing pages.
- SEO content pages: target long-tail terms such as RAG diagrams, Transformer diagrams, and AI teaching diagrams.
- Public share page: shows generated paths through unlisted public links without exposing private user, billing, admin, or model-channel data.

### Logged-In User Experience

- Generation workspace: lets users enter a topic, choose style/options, see balance and estimated credit cost, create generation tasks, drill down, and view results.
- Task history: shows queued, running, succeeded, and failed tasks with failure messages and retry entry points.
- My works / paths: lists saved generated paths and provides share-link management.
- Account and balance: shows membership status, credit balance, orders, and credit ledger entries.

### Admin Experience

The admin console lives under `/admin` and is separate from the user workspace. The first version only needs two permission classes: normal user and administrator.

Admin modules:

- Dashboard
- Users
- Credit ledger and orders
- Membership plans and credit packs
- Model channels
- Generation tasks
- System settings

## User, Membership, Credit, and Order Model

### Authentication

Users sign in with passwordless phone or email verification codes. A user has a phone or email login identifier, profile metadata, and a status of active or disabled.

The first version does not include teams, organizations, seats, or multi-member collaboration.

### Membership

`MembershipPlan` is configured by admins and includes:

- Name
- Price
- Validity period
- Credits granted per cycle
- Discount factor or credit-cost multiplier
- Optional task/concurrency limits
- On-shelf status

`UserMembership` records the user's current membership plan, start time, end time, and status. Membership grants benefits such as monthly credits, discounts, or higher task limits, but generation still consumes credits for cost accounting.

### Credits

Each user has a credit account and every balance change is written to a credit ledger. Ledger entry types include:

- Credit pack purchase
- Membership grant
- Generation pre-deduction or freeze
- Successful generation confirmation
- Failure refund
- Admin adjustment

Generation tasks should reserve or pre-deduct credits when created. If all generation attempts fail, the system refunds the reserved credits and records the refund in the ledger. Manual admin adjustments require a reason and must also create ledger entries.

### Orders and Payment

`Order` supports membership orders and credit-pack orders. The first payment integration targets Z-Pay / 易支付-style APIs:

- Create an internal pending order.
- Create or redirect to the payment provider order.
- Verify provider callback signatures.
- Mark paid orders as paid exactly once.
- Grant membership or credits after successful payment.
- Record provider transaction IDs and callback payload summaries for admin inspection.

Admins can view orders, inspect payment callback results, and perform manual payment corrections. Any correction that changes credits or membership must produce an auditable ledger entry.

### Pricing Rule

The MVP can start with configurable fixed prices, such as one price for the first image and another price for drill-down images. The pricing configuration should support later extension to model-specific, size-specific, or membership-discounted pricing.

## Generation Task and Model Gateway

### Task Execution

Image generation should be asynchronous. The browser creates a `GenerationTask` and receives a `taskId`; it then polls task status.

Task states:

- `pending`
- `running`
- `succeeded`
- `failed`
- `refunded`

Each task records:

- User
- Topic or parent page reference
- Style/options summary
- Estimated and charged credits
- Current status
- Result page/path IDs
- Selected model/channel metadata
- Failure reason
- Created, started, and finished timestamps

The first version uses a PostgreSQL-backed task queue. A server-side worker or scheduled processor claims pending tasks, marks them running, calls the model gateway, persists generated outputs, confirms or refunds credits, and updates task status.

### Cancellation

If a task has not started, later versions may allow cancellation and refund. Once a request has been sent to a model channel, the MVP does not need user-facing cancellation.

### Model Channels

Admins can configure multiple `ModelChannel` records for image generation. Each channel includes:

- Channel name
- Provider/base URL
- API key
- Model name, such as `gpt-image-2`
- Weight
- Timeout
- Enabled/disabled status
- Optional notes

API keys stay server-side. Admin lists should mask secrets by default.

### Routing and Retry

The MVP uses weighted random routing across enabled channels in the image-generation pool. If a channel fails or times out, the task retries another available channel until the retry limit is reached.

Each provider call creates a `ChannelAttempt` record with:

- Task ID
- Channel ID
- Start and end timestamps
- Status
- Error summary
- Latency
- Whether it produced the final result

The admin task detail page uses these records for debugging channel failures and cost/stability issues.

### Out of Scope for MVP

The MVP does not include dynamic cost optimization, quality scoring, model-pool access by membership tier, or automatic channel health algorithms. The data model should not block those future extensions.

## Admin Console

### Dashboard

Shows simple operational metrics:

- Today's task count
- Success and failure counts
- Payment amount
- Credits consumed
- Active users

This can be simple cards and basic tables; no BI-grade reporting is required.

### User Management

Admins can:

- Search users by phone or email.
- View credit balance, membership status, orders, ledger, and tasks.
- Enable or disable users.
- Manually add or deduct credits with a required reason.

### Membership and Product Management

Admins can manage:

- Membership plans
- Credit packs
- Prices
- Credit grants
- Validity periods
- On-shelf status

Coupons, distribution, affiliate programs, and promotional campaigns are out of scope.

### Orders and Payment

Admins can:

- List orders.
- View payment status and provider transaction IDs.
- Inspect callback summaries.
- Correct abnormal orders when needed.

Corrections must update credits or membership through auditable ledger entries.

### Model Channels

Admins can:

- Add, edit, disable, and delete model channels.
- Configure base URL, model name, API key, weight, timeout, and enabled status.
- View recent failures and simple success/failure counters.

### Task Management

Admins can:

- List generation tasks.
- Filter by user, status, and time.
- View failure reasons and channel attempts.
- Retry failed tasks or refund credits.

### System Settings

Admins can configure:

- Default generation prices
- Registration bonus credits
- Verification-code validity period
- Task timeout
- Retry count

## Implementation Phasing

### Phase 1: Commercial MVP Foundation

Build the account, billing, task, channel, and admin foundation:

- Passwordless phone/email login
- User, membership, credit, order, task, and model-channel database schema
- Admin console shell and core navigation
- Basic user workspace shell

The phase is complete when the system can identify users, show balances, create tasks, and expose admin records, even if payment and generation are still mocked or limited.

### Phase 2: Payment and Credit Loop

Implement the paid loop:

- Membership plans and credit packs
- Z-Pay / 易支付 order creation
- Payment callback signature verification
- Paid-order fulfillment
- Credit ledger entries
- Manual payment correction and manual credit adjustment

The phase is complete when a user can buy credits or membership and the resulting credits/membership are visible in the account and admin console.

### Phase 3: Task Queue and Model Gateway

Replace direct generation with asynchronous task execution:

- Database-backed task queue
- Credit pre-deduction or reservation
- Weighted model-channel routing
- Retry/failover across configured `gpt-image-2` channels
- Channel attempt records
- Failure refund
- Frontend task polling

The phase is complete when generation tasks can succeed, fail, retry, deduct, and refund credits correctly.

### Phase 4: Commercial Frontend

Upgrade the user-facing product:

- Marketing homepage
- Pricing/recharge page
- Template and case library
- SEO landing pages
- Logged-in generation workspace
- Task history
- My works / generated paths
- Commercialized share page

The phase is complete when the product no longer looks or behaves like a demo page and supports conversion, retention, and sharing.

### Phase 5: Operational Polish

Add first-pass operational visibility:

- Dashboard metrics
- Channel health indicators
- Task retry/refund controls
- Better failure messages
- More polished workspace and admin UX

## Migration From Current Demo

The current implementation should be treated as a generation and drill-down interaction prototype, not as the long-term product structure.

Reusable concepts:

- Prompt construction for root and drill-down pages
- Red-circle reference image generation
- Page/path identity and cache reuse ideas
- Public share path concept

Needs redesign:

- Frontend information architecture
- Authentication
- Billing and credits
- Payment
- Database schema
- Task queue
- Admin console
- Model-channel routing
- Commercial visual design

Migration should happen in phases rather than by piling commercial features into the current demo page. Each phase must have an independently verifiable result: login works, payment works, task execution works, admin works, and the commercial frontend works.

## Testing Strategy

- Unit tests for credit calculations, ledger transitions, payment callback verification, weighted channel selection, retry limits, and task state transitions.
- Integration tests for login, order creation, payment callback fulfillment, credit reservation/refund, task processing, model-channel failover, and admin mutations.
- Browser tests for public marketing navigation, login, recharge, generation task polling, history/works management, and core admin workflows.
- Security checks that model credentials, payment secrets, prompt internals, and admin data never leak to normal users or public share pages.

## Explicit Non-Goals

- Teams, organizations, seats, and collaborative workspaces
- Complex admin role-based access control beyond administrator vs normal user
- Coupons, affiliate programs, or marketing campaigns
- BI-grade analytics
- Dynamic channel cost optimizer
- Model access by membership tier
- WebSocket/SSE task streaming
- Redis/BullMQ or separate queue infrastructure
- Enterprise compliance workflows
