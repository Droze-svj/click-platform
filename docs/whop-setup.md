# Whop setup — checkout links, plan IDs and the payment webhook

Click sells three paid tiers through Whop. A purchase only upgrades an account
when **all** of the following line up: the checkout link the customer uses, the
plan ID Click maps it to, and a signed webhook from Whop telling Click it happened.

| Tier | Monthly | Yearly |
|---|---|---|
| Creator | $39 | $390 |
| Pro | $119 | $1,190 |
| Agency | $349 | $3,490 |

Yearly is 10× monthly (two months free). These prices live in
`client/lib/plans.ts`; the webhook's price fallback uses the same numbers.

---

## 1. Create the plans in Whop

For each tier, create one **product** — for example "Click Creator", "Click Pro",
"Click Agency" — and give it **two recurring pricing plans**: one billed monthly
and one billed yearly, at the prices above.

In the Whop dashboard: **Dashboard → Checkout links → + Create checkout link** →
choose the product → **Pricing type: Recurring** → enter the price → choose the
subscription period (monthly or yearly) → **Create checkout link**. Repeat until
you have six links.

Each link contains its plan's ID, in the form `https://whop.com/checkout/plan_…`.
You need both the full link and the `plan_…` part.

> **Put the word Creator, Pro or Agency in each product's name.** If a plan ID is
> ever missing from Click's configuration, the webhook can still identify the
> tier from the product name — but only if the name contains it.

## 2. Add the twelve values to Render

Render → `click-platform` → **Environment**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY` | Creator monthly checkout link |
| `NEXT_PUBLIC_WHOP_URL_CREATOR_YEARLY` | Creator yearly checkout link |
| `NEXT_PUBLIC_WHOP_URL_PRO_MONTHLY` | Pro monthly checkout link |
| `NEXT_PUBLIC_WHOP_URL_PRO_YEARLY` | Pro yearly checkout link |
| `NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY` | Agency monthly checkout link |
| `NEXT_PUBLIC_WHOP_URL_AGENCY_YEARLY` | Agency yearly checkout link |
| `WHOP_PRODUCT_ID_CREATOR_MONTHLY` | the `plan_…` from the Creator monthly link |
| `WHOP_PRODUCT_ID_CREATOR_YEARLY` | the `plan_…` from the Creator yearly link |
| `WHOP_PRODUCT_ID_PRO_MONTHLY` | the `plan_…` from the Pro monthly link |
| `WHOP_PRODUCT_ID_PRO_YEARLY` | the `plan_…` from the Pro yearly link |
| `WHOP_PRODUCT_ID_AGENCY_MONTHLY` | the `plan_…` from the Agency monthly link |
| `WHOP_PRODUCT_ID_AGENCY_YEARLY` | the `plan_…` from the Agency yearly link |

**Use plan IDs, not product IDs**, despite the variable names. A product holds
both its monthly and yearly plan, so a product ID cannot tell Click which period
was bought. All six IDs must be different.

## 3. Create the webhook

In Whop: **Dashboard → Developer → Webhooks → create a webhook**.

- **URL:** `https://click-platform-1.onrender.com/api/webhooks/whop`
- **Events:** `membership.activated`, `membership.deactivated`,
  `payment.succeeded`, `payment.failed`

Copy the webhook secret — it starts with `ws_` — into Render as
`WHOP_WEBHOOK_SECRET`, **exactly as shown**. Do not remove the `ws_` prefix; Whop
signs with the whole value.

`WHOP_API_KEY` (from **Developer → API keys**) is only needed for Click to issue
refunds itself. Without it, refund requests are recorded for you to action in
Whop.

## 4. Redeploy

The checkout links are compiled into the frontend when Render **builds** the
app, so they only appear after a new deploy. In Render, trigger **Manual Deploy**
after saving the variables.

## 5. Check it end to end

1. Open Click's pricing, logged in. Each paid plan's button should now go to
   `whop.com/checkout/plan_…`.
2. In the Whop webhook settings, use **Send test event**. Click should answer
   **200**. A `401` means the secret is wrong or was pasted with the prefix
   removed. A `503` means `WHOP_WEBHOOK_SECRET` isn't set.
3. Buy the cheapest plan with a real account, using **the same email address as
   the Click account**, and confirm the account shows the plan.

## How Click matches a purchase to an account

Whop's webhook identifies the buyer by their Whop user. Click looks the account
up by, in order: a stored Whop user ID from an earlier purchase, then the buyer's
email. **Customers must check out with the email address they use on Click** —
Whop does not pass Click's own account ID through a checkout link.

## Known limits

- **Refunds and disputes.** Click's handlers for these use older Whop event names
  (`payment.refunded`, `dispute.created`). Confirm with **Send test event** which
  names your Whop account sends before relying on automatic downgrades.
- **Cancel at period end.** Click does not react to
  `membership.cancel_at_period_end_changed`; access ends when Whop sends
  `membership.deactivated` at the end of the paid period.
