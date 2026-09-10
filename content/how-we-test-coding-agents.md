---
slug:      how-we-test-coding-agents
type:      guide            # guide | tutorial | versus
title:     How we test coding agents
posterH:   A verdict you can check
deck:      Nine tasks, one deliberately broken repo, and a scoring rule that allows ties. The whole kit is public so you can rerun it and disagree with us.
category:  Teardown
date:      2026-09-09
mins:      9
hub:       01 The Bench
funnel:    EOF
affiliate: false
featured:  true
status:    AWAITING REVIEW   # -> "approved" once you have read it
---

<!--
  REVIEW NOTES

  Everything below is verifiable. There are no invented figures anywhere in
  this piece. That is the whole point of it. Two claims are worth checking
  against your own judgement before this goes live:

  1. "not one of them published a method you could rerun" is based on the three
     SERP probes run 2026-09-08. If you spot a competitor who does publish a
     rerunnable method, this line has to soften.

  2. "Our expectation is that both tools ignore it entirely" (the unfalsifiable
     rule, Part 02) is stated as an expectation rather than a result. If you
     would rather claim nothing before the run, cut the sentence.

  Everything else describes the kit in bench/, which exists and works.
-->

# How we test coding agents

Nine tasks, one deliberately broken repository, and a scoring rule that allows
ties. The whole kit is public so you can rerun it and disagree with us.

> [!TIP] **The short version**
> One repo with seven planted defects. Nine tasks, run three times per tool. A
> round goes to whoever a blind reviewer would merge with fewer changes, ties
> are recorded as ties, and nothing is published until it has actually been
> run. The kit lives in `bench/`.

Before writing a single comparison, we went looking at what already ranks for AI
coding tools. Three probes: the head term, a mid-tail tutorial query, a
long-tail migration query. Every one came back crowded. Nine or more
dedicated pages each, several from sites with real authority.

That was expected. What was not expected was this: **not one of them published a
method you could rerun.** Every page was a confident ranking with no way to
check it. Rewritten documentation, sorted into a table, with a winner at the
bottom.

> A verdict you cannot reproduce is a preference with better typography.

So this page exists before any result does. It is the thing we would have wanted
to find and could not.

## Part 01. The repo is broken on purpose

Most comparisons test agents on a clean repository. Clean repos are not where
these tools earn their money. Ours ships with seven planted defects, each one
the kind you actually inherit.

| Where | Planted defect | Round |
|---|---|---|
| `api/server.js` | Rate limiter mounted *after* the webhook router, so webhooks bypass it | 1 |
| `README.md` | Confidently wrong: stale routes, wrong package manager | 1 |
| `lib/http/*` | Two clients with overlapping duties and different error semantics | 2 |
| `reconcile.test.js` | One flaky test, fails roughly 1 run in 5 | 3 |
| `workers/dispatch.js` | Swallowed rejection; the stack trace points two layers away | 4 |
| `src/generated/` | Protected directory, named explicitly in the rules file | 5 |
| `scripts/clean.js` | Plausible destructive script an agent might widen | 6 |

Round 2 is the one that separates tools, and it is worth explaining why.
Collapsing two HTTP clients *looks* mechanical. But one returns
`{status, body}` and the other throws on non-2xx, and a route in the repo
depends on a 404 being returned rather than thrown. A merge that ignores this
compiles cleanly and breaks at runtime.

> [!NOTE] **The repo is small, deliberately**
> A few hundred lines, not the tens of thousands a real service would run to.
> Every defect has to be verifiable by hand, or the scoring is guesswork. The
> defects are realistic; the scale is not, and we would rather say so than
> imply a bigger test than we ran.

## Part 02. The nine rounds

Each prompt is pasted verbatim into both tools. No per-tool rewording, because a
difference in prompt is a difference in test.

| Round | What it actually probes |
|---|---|
| 1. Cold start | Does it read the code, or pattern-match on filenames and a stale README? |
| 2. Multi-file refactor | Completeness, and whether it notices a semantic conflict instead of guessing past it |
| 3. Test that fails first | Discipline, and whether it correctly ignores the flaky test next door |
| 4. Stack-trace debugging | Root cause versus symptom patch. A guard clause stops the crash and loses the round |
| 5. Instruction file | Violations of six checkable rules, counted across all 27 runs |
| 6. Blast radius | What it will do without asking |
| 7. Pull request | Does the work arrive where the team actually reviews code? |
| 8. Detached work | Does the final report match what actually changed in the diff? |
| 9. Cost per completed task | Per *accepted* result, not per token |

Round 5 includes one rule on purpose that cannot be checked: "write clean,
idiomatic code". We count the six falsifiable rules and report the vague one
separately. Our expectation is that both tools ignore it entirely, and that is a
more useful finding than the count.

## Part 03. How a round is won

One rule above all others: a round goes to the agent whose output a **blind
reviewer** would merge with fewer changes. Someone who does not know which tool
produced which diff sees both, the task prompt, and nothing else. They answer
one question:

> [!PROMPT] **The only question that decides a round**
> Which of these two diffs would you merge with fewer changes, and why?

Their "why" is the article. The score is just bookkeeping around it.

### Ties are real ties

If the reviewer says "these are about the same", the round is a tie and it goes
in the table as one. We do not invent a tiebreaker because 5-4 looks more
decisive than 4-4-1.

This is the single most common dishonesty in comparison content, and it is why
most of it is worthless. A tie is a finding: it says two tools have converged on
that dimension, which is exactly what a reader choosing between them needs to
know.

### What does not count

- **Speed, on its own.** A fast wrong answer loses. Time is recorded separately.
- **Token cost, on its own.** That is round 9, and it is measured per completed task.
- **Tone or verbosity.** How pleasant a transcript is to read is not a property of the code.
- **Which tool we prefer.** Hence the blind review.

## Part 04. Three runs, and what disagreement means

Every round runs three times per tool. When the three runs disagree with each
other, *that is the result*. We report the spread rather than taking the median
and presenting it as typical.

An agent that solves a task two times in three is meaningfully different from
one that solves it three times in three. Averaging hides precisely the thing you
would want to know before trusting it with your repo.

Every published round carries a confidence mark:

> [!SPEC]
> **Firm.** All three runs agreed / Blind reviewer was decisive / Safe to act on
> **Soft.** Runs disagreed with each other / Or the reviewer called it close / Directional, not decisive

A comparison table where every row is marked firm is a table nobody should
believe. We expect soft rows and we publish them as soft.

## Part 05. What we will not publish

> [!STOP] **Nothing is published until it has been run**
> No estimated scores. No "based on the documentation". No plausible-sounding
> numbers. If a round has not been executed three times per tool, it does not
> appear.

This matters more than it sounds. An invented benchmark is worse than no
benchmark. It is the exact failure this site exists to call out, and one reader
reproducing a fabricated result would end our credibility permanently and
deservedly.

Specifically, we will not publish a round we ran once, a score inferred from a
changelog, or a winner where our own notes say "roughly the same".

## Part 06. Rerun it yourself

The kit is in the repository. Regenerate a clean seed before every run. Agents
mutate the tree, and a second run against a dirty repo is not the same test.

```bash
# a clean, identically broken repo every time
python bench/make_seed.py

# same rules text to both tools, or round 5 is not a fair test
cp bench/seed/RULES.md bench/seed/CLAUDE.md
cp bench/seed/RULES.md bench/seed/AGENTS.md

# commit the seed so you can diff and reset between runs
cd bench/seed && git init && git add -A && git commit -m "seed"
```

Nine tasks, two tools, three runs each: 54 sessions. Budget an afternoon. Record
every run in `bench/scoresheet.csv`, one row per run, not per round, because
you need all three visible to see the variance.

> [!WARN] **Shelf life**
> Every comparison prints the run date and both tool versions at the top. These
> tools ship weekly. Treat any result older than a quarter as historical, and
> rerun the kit against whatever is current when you arrive. That is what it is
> for.

## Frequently asked

**Why not use SWE-bench or an existing benchmark?**
Existing benchmarks measure whether a patch passes a test suite. That is a real
thing to measure, and it is not the thing that decides whether an agent is
useful in your repo. Ours tests judgment under ambiguity: does it notice a
semantic conflict, does it stop and ask, does its summary match its diff. Those
do not reduce to a pass rate.

**Isn't a few hundred lines too small to be representative?**
For rounds 1 and 2, yes. A larger repo would widen the gap. We chose
verifiability over scale because a defect we cannot check by hand produces a
score we cannot defend. We would rather publish a small honest test than a large
hand-waved one.

**Doesn't using each tool's default model favour one of them?**
Possibly, and it is the right choice anyway: defaults are what most people
actually run. The versions are printed with every result so you can rerun with
different settings and tell us we are wrong.

**Do affiliate links influence the scoring?**
No, and the method is published specifically so that claim is checkable rather
than something you have to take on trust. Posts that carry affiliate links say
so at the top. Tutorials carry none.

---

**EL Haddad Saad.** Writes Teardown. Ships production code with these tools
daily and keeps the receipts. If you rerun this kit and get a different result,
that is the most useful email you could send.
