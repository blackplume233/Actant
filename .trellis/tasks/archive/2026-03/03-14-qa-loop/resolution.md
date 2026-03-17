## Resolution

Archived on 2026-03-17 as historical QA evidence.

Why this no longer needs to remain an active task:

- The directory captures a failed exploratory QA loop, not an in-progress implementation task.
- Several failures recorded there were already fixed later in the same report sequence or by subsequent commits.
- The remaining proxy expectation in that run is no longer aligned with the current spec baseline:
  running `service` instances now document lease-first shared-runtime proxy semantics rather than
  occupied-to-ephemeral fallback as the product baseline.
- The evidence is still valuable, so the folder should be preserved under task archive rather than deleted.

Follow-up work, if needed, should be represented as a fresh issue or a new QA task tied to the
current communication contract.
