# Catalog DB Architecture — User Product Decisions (2026-05-30)

These are product decisions from Yeqiuqiu answering the open questions in the prior Oracle proposal. They should be treated as input constraints for the next GPT-5.5 Pro / Oracle final proposal.

## Decisions

1. **Prize identity**
   - Pack prizes should reference **both** global catalog items and vendor inventory items where applicable.
   - **Snapshot is always required**.

2. **Graded slabs**
   - Use a global catalog template for the generic graded item, e.g. “PSA 10 card”.
   - Use vendor inventory for cert-specific individual slabs.

3. **Sets**
   - `CatalogSet` remains metadata only.
   - Prizeable complete sets become `CatalogItem` rows with `itemType = SET`.

4. **Vendor custom items in global search**
   - No by default.
   - Vendors can submit/push a patch through the system.
   - Global visibility requires manual review/moderation before promotion.

5. **Estimated value**
   - Estimated value is **out of scope for now**.
   - Do not design launch-critical value-estimation infrastructure beyond preserving room for future snapshot value/source/asOf fields.

6. **Launch-critical item types**
   - All item types are launch-critical:
     - `CARD`
     - `SEALED_PRODUCT`
     - `GRADED_CARD`
     - `SET`
     - `CUSTOM`
     - `ACCESSORY`
     - `OTHER`

7. **Search quality**
   - Make search as fast as possible while maintaining appropriate search quality.
   - Proposal should define a pragmatic launch search/index design, not defer search quality entirely.

8. **Catalog source data changes**
   - Draft packs may expose a **refresh from catalog** action.
   - Live packs must never silently refresh from mutable catalog data.

9. **Source conflicts**
   - Conflicts should be promoted to human review.
   - Proposal should include conflict queue / moderation workflow rather than automatic overwrite/merge.

10. **Compliance/audit trail for prize value and odds**
    - Deferred until later.
    - Still preserve architectural extension points for future snapshot value, currency, value source, timestamp, weight, initial stock, and remaining stock ledger.

## Request to Oracle

Using these decisions plus the existing evidence packet, produce a final database architecture proposal for Oripa catalog, inventory, prize snapshots, source conflict moderation, search, and phased migration. Prioritize launch correctness and extensibility without overbuilding valuation/compliance systems that were explicitly deferred.
