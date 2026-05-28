# Traceability-First Database Notes

## Implemented Core

- Immutable wallet ledger (`WalletEntry`) with `balanceBefore`, `balanceAfter`, `requestId`, `idempotencyScopeKey`, `actorUserId`.
- Draw transaction trace (`DrawOrder`, `DrawResult`) with `requestId`, sequence, RNG metadata.
- Tenant revenue ledger (`TenantRevenueLedger`) with point and currency snapshots.
- Auditing and event replay foundation (`AuditLog`, `OutboxEvent`).
- Idempotency redesigned (`IdempotencyKey`) using `scopeKey` for operation-safe dedupe.
- Role and tenancy model (`User`, `Role`, `UserRole`, `TenantMembership`, `TenantSettings`).

## Payment-Provider-Ready Key Fields

Keep these fields populated from day one, even before provider integration is turned on:

- `TopupOrder.provider` and `TopupOrder.providerOrderRef`
- `PaymentTransaction.provider` and `PaymentTransaction.providerPaymentRef`
- `PaymentTransaction.rawPayload` (store normalized provider webhook payload)
- `PaymentTransaction.status` (state machine for reconciliation)
- `TopupOrder.idempotencyScopeKey`
- `TopupOrder.requestId`
- `WalletEntry.referenceType` and `WalletEntry.referenceId`
- `WalletEntry.metadata` for provider settlement metadata
- `TenantRevenueLedger.conversionRate`, `amountCurrency`, `currencyCode`
- `AuditLog.requestId`, `ipAddress`, `userAgent`

## Recommended Next Hardening Steps

1. Add HMAC webhook verification table for replay protection (`webhook_events`).
2. Add payout tables (`payout_requests`, `payout_transactions`) when tenant cash-out starts.
3. Add `version` field checks (optimistic locking) for mutable tenant configs.
4. Add reconciliation jobs:
   - wallet balance vs wallet ledger
   - draw orders vs wallet debits
   - revenue ledger vs draw totals
5. Add database-level RLS once auth is finalized.
