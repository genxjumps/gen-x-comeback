# V1.1 Stripe Test Checkout

## Boundary

This source checkpoint connects a controlled Stripe test checkout to the existing Accelerator
purchase and entitlement transaction. It does not enable live payments, public enrollment,
sales-page checkout buttons, customer email, paid recovery, refunds, or Day 1.

The integration uses Stripe directly instead of Lovable's generated payments model. The app already
has the approved `paid_purchases`, `paid_product_entitlements`, and service-role-only
`provision_accelerator_ownership` boundary. A second generated purchase model would create competing
ownership records.

## Locked offer

- Product code: `accelerator_28`
- Program version: `accelerator_28_v1`
- Price: `$37 USD`
- Billing: one-time
- Access: permanent unless explicitly revoked
- Starting the program: separate customer action
- Refund-request window: seven days from the recorded paid charge time

## Runtime flow

1. A verified, signed-in customer opens Explore Programs.
2. The server requires the customer account to be on the controlled test allow-list and confirms
   that the account does not already own the Accelerator.
3. The server retrieves the configured Stripe Price and verifies test mode, one-time billing,
   `$37 USD`, and the locked product/version metadata before creating Checkout.
4. Stripe hosts Checkout. Only test cards can be accepted because the runtime rejects live keys and
   live Stripe objects.
5. The signed Stripe webhook retrieves the Checkout Session again from Stripe, verifies the paid
   charge, exact line item, customer binding, amount, currency, product, version, and test mode, then
   calls the existing idempotent ownership transaction.
6. The signed-in success page performs the same server-side Stripe verification as an immediate
   backup. The Checkout Session ID is the shared idempotency key, so webhook and return-path retries
   converge on one purchase.
7. The purchase creates ownership only. The customer chooses when to start Day 1 from My Programs.

## Required server configuration

No values belong in Git or browser code.

| Name                          | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `STRIPE_CHECKOUT_ENABLED`     | Must equal `true` or all checkout behavior stays closed.           |
| `STRIPE_SECRET_KEY`           | Stripe test secret or restricted key only. Live keys are rejected. |
| `STRIPE_WEBHOOK_SECRET`       | Signing secret for the exact app webhook endpoint.                 |
| `STRIPE_ACCELERATOR_PRICE_ID` | Test Price ID for the locked one-time offer.                       |
| `STRIPE_TEST_CUSTOMER_IDS`    | Comma-separated customer UUID allow-list for controlled testing.   |
| `APP_ORIGIN`                  | Exact HTTPS app origin used for Checkout return URLs.              |

The Stripe test Product must include:

| Metadata key           | Required value      |
| ---------------------- | ------------------- |
| `genx_product_code`    | `accelerator_28`    |
| `genx_program_version` | `accelerator_28_v1` |

The Stripe webhook endpoint is:

`POST https://app.genxjumps.com/api/public/stripe/webhook`

Subscribe only to `checkout.session.completed` for this card-only, one-time test checkout.

## Remaining before launch

- Configure the test Product, Price, restricted key, signing secret, and controlled account IDs.
- Publish the exact approved release and run a no-charge test-card purchase with an account that
  does not already own the Accelerator.
- Verify one purchase, one permanent entitlement, Not Started state, manual Day 1 start, duplicate
  webhook replay, canceled Checkout, wrong amount/product rejection, and unauthorized account denial.
- Complete direct-buyer account entry, backup access delivery, paid recovery, and refund requests.
- Establish the required staging boundary and run the complete paid-customer journey.
- Connect sales-page buttons only after that journey passes.
- Keep live payment credentials and public enrollment disabled until Todd gives separate explicit
  approval.

## Rollback

This part adds no migration. Disabling `STRIPE_CHECKOUT_ENABLED` closes Checkout without removing
existing purchases or entitlements. Removing the UI and webhook code later does not revoke ownership
already recorded through the existing transaction.
