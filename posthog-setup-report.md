<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into FlipWhizz. The setup covers the full user lifecycle — from registration and story creation through payment, physical book fulfilment, and social sharing.

**What was added:**

- `instrumentation-client.ts` — initialises PostHog client-side using Next.js 15.3+ native instrumentation, with exception capture enabled
- `src/lib/posthog-server.ts` — singleton PostHog Node.js client for server-side event tracking
- `next.config.ts` — reverse proxy rewrites routing PostHog traffic through `/ingest` to avoid ad-blockers
- `.env.local` — `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` set to the EU region

12 events were instrumented across 9 files, covering both client and server-side tracking. User identification is performed at sign-in and registration so client and server events are correlated under a single distinct ID.

| Event | Description | File |
|-------|-------------|------|
| `user_registered` | New user account created via email/password | `src/app/api/auth/register/route.ts` |
| `user_signed_in` | User signed in + PostHog identify called | `src/app/auth/signin/SignInForm.tsx` |
| `project_created` | New story project created | `src/app/api/projects/create/route.ts` |
| `story_created` | Personalised story generated from chat | `src/app/api/stories/create-from-chat/route.ts` |
| `payment_captured` | PayPal payment successfully captured | `src/app/api/paypal/capture/route.ts` |
| `free_story_claimed` | Free product claimed via promo code | `src/app/api/stories/[id]/claim-free/route.ts` |
| `print_order_submitted` | Physical book order submitted to Gelato | `src/app/api/orders/create/route.ts` |
| `order_shipped` | Book shipped (Gelato webhook) | `src/app/api/webhooks/gelato/route.ts` |
| `tiktok_share_initiated` | User clicked Share to TikTok | `src/components/ShareTikTokButton.tsx` |
| `tiktok_share_completed` | Story successfully posted to TikTok | `src/components/ShareTikTokButton.tsx` |
| `order_form_submitted` | Shipping form submitted in order flow | `src/components/OrderFlow.tsx` |
| `story_hub_viewed` | User landed on the story hub page | `src/app/stories/[id]/hub/StoryHubClient.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://eu.posthog.com/project/163673/dashboard/634986
- **Registration → Story Created → Payment Funnel**: https://eu.posthog.com/project/163673/insights/MFLJ5p2e
- **New Registrations Over Time**: https://eu.posthog.com/project/163673/insights/ttaIEqhf
- **Revenue Events (Payments + Free Claims)**: https://eu.posthog.com/project/163673/insights/q5IGJkKE
- **Print Order Fulfilment Funnel**: https://eu.posthog.com/project/163673/insights/zwzZsqHd
- **TikTok Share Rate**: https://eu.posthog.com/project/163673/insights/l2avJ1Fl

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
