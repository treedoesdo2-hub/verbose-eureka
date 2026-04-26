# ADR-NNN — <one-line summary>

> Use this template when capturing an ADR the **User has stated**.
> PM (or Builder, if relayed through them) writes this up; the User
> ratifies on review. The substance must come from the User —
> never originate one yourself.
>
> Promoted file lives at `decisions/NNN-slug.md`. Strip this
> blockquote when promoting.

---

**Date:** YYYY-MM-DD
**Status:** stated by User <date>; ratified <date>; accepted
**Captured by:** PM | Builder
**Source:** chat | BOARD | escalation E-NN | assignment T-NNN

## Context

What problem or decision space prompted this? Cite the assignment,
the spec section, the prior ADR, the User's words. Keep this short —
the goal is "future-me reads this and understands why we're here," not
a literature review.

## Decision

The User's call, in plain language. One paragraph. Direct quotes from
the User welcomed where they're load-bearing.

If there are increments / phases (per ADR 017's pattern), list them
here numbered. Mark which one this ADR commits to and which are named
follow-ons.

## What this ADR commits us to

- Concrete commitments (schema field X is canonical, function Y is the
  single entry point, file format Z, etc.)
- Anything we are giving up by taking this path.

## Out of scope (this ADR does not bind)

- Things explicitly NOT covered, so future drift doesn't re-litigate.
- Any deferred follow-ons go in `decisions/DEFERRED.md` (PM
  responsibility) with a "revisit when" trigger.

## Consequences

**Positive.**
- ...

**Negative / risks.**
- ...
- (If a consequence is risk-register-grade, also update
  `planning/risks.md`.)

## Implementation notes (optional)

If the User has named specific code paths, files, or constants the
implementation should hit, capture them here so the Builder doesn't
have to re-derive. Otherwise leave this section out.

---

## Ratification

**User ratified:** YYYY-MM-DD via <chat | BOARD | escalation>.
**PM closing notes:** <if any> — anything the PM noticed during
write-up that's worth flagging for future ADRs.
