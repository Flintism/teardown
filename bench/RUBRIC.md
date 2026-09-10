# Scoring rubric

One rule above all others: **a round goes to the agent whose output a blind
reviewer would merge with fewer changes.** Everything below serves that.

## The blind review

Get someone who does not know which tool produced which diff. Show them the two
diffs, the task prompt, and nothing else. Ask one question:

> Which of these would you merge with fewer changes, and why?

Their "why" is the article. Record it verbatim.

If nobody is available to review blind, strip the tool names from the diffs, wait
a day, and review them yourself in a random order. It is weaker, and you should
say so in the piece.

## Ties

**Ties are real ties.** If the blind reviewer says "these are about the same",
the round is a tie and it goes in the table as one.

Do not invent a tiebreaker because a 5–4 looks more decisive than a 4–4–1. The
manufactured tiebreak is the single most common dishonesty in comparison content
and it is the reason nobody trusts these articles. A tie is a finding: it says
the tools have converged on that dimension, which is genuinely useful to a reader
choosing between them.

## What counts, what does not

**Counts toward the score**

- Correctness of the result
- Completeness against the stated task
- Whether the agent surfaced a judgment call instead of guessing
- Whether the final report matches what actually changed in the diff

**Does not count**

- Speed, on its own. A fast wrong answer loses. Record time separately.
- Token cost, on its own. That is round 9.
- Tone, verbosity, or how pleasant the transcript was to read
- Which tool you personally prefer

## Variance

Three runs per tool per round. If the three runs disagree with each other, **that
is the result** — report the spread rather than picking the median and presenting
it as typical. An agent that solves a task two times in three is meaningfully
different from one that solves it three times in three, and averaging hides it.

Record every run in `scoresheet.csv`, one row each.

## Confidence

Mark each round in the published table:

| Mark | Meaning |
|---|---|
| **firm** | Three runs agreed, blind reviewer was decisive |
| **soft** | Runs disagreed, or the reviewer called it close |
| **tie** | Genuinely indistinguishable |

Publish the soft ones as soft. A table where every row is firm is a table nobody
should believe.

## Shelf life

Print the run date and both tool versions at the top of the article. These tools
ship weekly. State plainly that a result older than a quarter should be treated
as historical, and link back to `bench/` so a reader can rerun it against
whatever is current when they arrive.

## Conflicts

If either vendor is a client, employer or investor of anyone involved, disclose
it at the top of the piece in plain language — not in a footer, and not only in
the affiliate notice. Affiliate links do not change a score; say so, and make the
method public enough that the claim is checkable.
