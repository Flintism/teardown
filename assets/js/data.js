/* ==========================================================================
   TEARDOWN — content database
   --------------------------------------------------------------------------
   This is the single source of truth for the whole site. Every card, poster
   thumbnail, filter chip and search result on every page is generated from
   the objects below. To publish a post you add one object here and one HTML
   file in /posts. There is no build step and there are no image assets.

   FIELD REFERENCE
     slug      string   unique id, also the filename in /posts
     type      string   'versus' | 'tutorial' | 'guide'  -> picks the poster art
     title     string   card + article headline
     posterH   string   OPTIONAL shorter headline, used on the poster only
     deck      string   one-line summary under the card title
     category  string   drives the filter chips and the accent colour
     date      string   ISO date, used for sorting and display
     mins      number   read time
     author    object   { name, initials, photo }  photo is optional
     tags      array    extra search keywords
     affiliate boolean  post contains affiliate links -> the build injects a
                        disclosure and validate.py fails if it is missing
     featured  boolean  promotes the post to the homepage hero slot
     draft     boolean  renders a dimmed, unclickable "in the works" card
     num       string   OPTIONAL big ghost numeral in the poster corner
     vs        object   REQUIRED for type 'versus' -> { a: {...}, b: {...} }
                        each side: { name, initials, color }
   ========================================================================== */

const CATEGORIES = {
  'AI Coding':   { color: '#FF5B38', blob1: '#FF5B38', blob2: '#8B5CF6' },
  'Agents':      { color: '#8B5CF6', blob1: '#8B5CF6', blob2: '#22D3EE' },
  'Workflow':    { color: '#22D3EE', blob1: '#22D3EE', blob2: '#C6F135' },
  'Commerce':    { color: '#FFB020', blob1: '#FFB020', blob2: '#FF5B38' },
  'Fundamentals':{ color: '#C6F135', blob1: '#C6F135', blob2: '#22D3EE' },
  'Teardown':    { color: '#F43F5E', blob1: '#F43F5E', blob2: '#8B5CF6' },
  'App Builders':{ color: '#FFB020', blob1: '#FFB020', blob2: '#8B5CF6' }
};

/* One author record, referenced by every post. Swap the photo path here and
   it changes everywhere — cards, bylines, author boxes, the about page. */
const AUTHOR = {
  name: 'EL Haddad Saad',
  initials: 'ES',
  photo: 'assets/img/saad.jpg'
};

const POSTS = [
  {
    slug: 'claude-code-windows-install',
    type: 'tutorial',
    title: 'Install Claude Code on Windows and fix every error',
    posterH: "'claude' is not recognized. Here's why.",
    cover: 'assets/img/claude-code-windows/cover.webp',
    deck: "One PowerShell command installs Claude Code on Windows. Here's the exact fix for every install error: PATH, wrong shell, Git Bash, WSL and more.",
    category: 'AI Coding',
    date: '2026-09-12',
    mins: 10,
    num: '05',
    author: AUTHOR,
    tags: ['claude code', 'claudecode', 'windows', 'install', 'powershell', 'cmd',
           'winget', 'wsl', 'git bash', 'path', 'not recognized', 'troubleshooting']
  },
  {
    slug: 'ai-app-builders-ownership',
    type: 'guide',
    title: 'Seven AI app builders, sorted by what you own at the end',
    posterH: 'Who owns the code? Mostly not you.',
    deck: 'Five of these seven builders will hand you the code. Whether it runs anywhere else depends on the database, the logins and the secrets.',
    category: 'App Builders',
    date: '2026-09-11',
    mins: 8,
    author: AUTHOR,
    tags: ['lovable', 'bolt.new', 'v0', 'replit', 'base44', 'bubble', 'glide',
           'ai app builder', 'vibe coding', 'export', 'lock-in', 'supabase', 'github'],
    featured: true
    // affiliate: true once the Lovable (Impact) link replaces the plain lovable.dev link
  },
  {
    slug: 'how-we-test-coding-agents',
    type: 'guide',
    title: 'How we test coding agents',
    posterH: 'A verdict you can check',
    deck: 'Nine tasks, one deliberately broken repo, and a scoring rule that allows ties. The whole kit is public so you can rerun it and disagree with us.',
    category: 'Teardown',
    date: '2026-09-09',
    mins: 9,
    author: AUTHOR,
    tags: ['benchmark', 'method', 'rubric', 'testing', 'reproducible', 'the bench'],
    featured: true,
    draft: true   // awaiting review of content/how-we-test-coding-agents.md
  },
  {
    slug: 'claude-code-vs-codex',
    type: 'versus',
    title: 'Claude Code vs. Codex: which agent actually finishes the job?',
    posterH: 'Two agents. One repo. Nine rounds.',
    deck: 'We gave both CLI agents the same nine tasks in the same messy repo and scored every round. The gap is not where the marketing says it is.',
    category: 'AI Coding',
    date: '2026-08-28',
    mins: 14,
    author: AUTHOR,
    tags: ['cli', 'benchmark', 'openai', 'anthropic', 'comparison'],
    affiliate: true,
    draft: true,   // awaiting a real run of bench/ - do not publish invented scores
    vs: {
      a: { name: 'Claude Code', initials: 'CC', color: '#FF5B38' },
      b: { name: 'Codex',       initials: 'CX', color: '#22D3EE' }
    }
  },
  {
    slug: 'claude-code-hooks',
    type: 'tutorial',
    title: 'Hooks: make Claude Code follow your rules automatically',
    posterH: 'Stop asking. Start enforcing.',
    deck: 'A prompt is a suggestion. A hook is a guarantee. Wire up formatting, guardrails and notifications in about twenty minutes.',
    category: 'Workflow',
    date: '2026-08-21',
    mins: 11,
    num: '01',
    author: AUTHOR,
    tags: ['hooks', 'settings.json', 'automation', 'pretooluse', 'guardrails']
  },
  {
    slug: 'agentic-commerce',
    type: 'guide',
    title: 'How agentic commerce actually works',
    posterH: 'The buyer is a bot now',
    deck: 'Checkout was built for humans with thumbs. Here is what changes when the shopper is an agent with an API key and a budget.',
    category: 'Commerce',
    date: '2026-08-14',
    mins: 9,
    author: AUTHOR,
    tags: ['payments', 'checkout', 'protocol', 'shopify', 'mcp'],
    draft: true
  },
  {
    slug: 'cursor-vs-windsurf',
    type: 'versus',
    title: 'Cursor vs. Windsurf: the editor war nobody is winning',
    posterH: 'Same idea, different bet',
    deck: 'Two AI-native editors, two philosophies about how much rope to give the model. We used both as a daily driver for a month.',
    category: 'AI Coding',
    date: '2026-07-30',
    mins: 12,
    author: AUTHOR,
    tags: ['editor', 'ide', 'autocomplete', 'comparison'],
    affiliate: true,
    draft: true,
    vs: {
      a: { name: 'Cursor',   initials: 'CU', color: '#8B5CF6' },
      b: { name: 'Windsurf', initials: 'WS', color: '#C6F135' }
    }
  },
  {
    slug: 'context-windows',
    type: 'guide',
    title: 'You are not running out of context. You are wasting it.',
    posterH: 'A million tokens of nothing',
    deck: 'Bigger context windows did not fix retrieval. A field guide to what agents actually keep, drop, and hallucinate.',
    category: 'Fundamentals',
    date: '2026-07-22',
    mins: 8,
    author: AUTHOR,
    tags: ['context', 'tokens', 'compaction', 'memory', 'rag'],
    draft: true
  },
  {
    slug: 'teardown-agent-pricing',
    type: 'guide',
    title: 'Teardown: what you are really paying for per agent run',
    posterH: 'Follow the tokens',
    deck: 'We instrumented 400 real agent sessions and traced every dollar. Cache hits matter more than model choice.',
    category: 'Teardown',
    date: '2026-07-08',
    mins: 10,
    author: AUTHOR,
    tags: ['pricing', 'cost', 'caching', 'tokens', 'economics'],
    draft: true
  }
];

/* Expose for the site scripts (plain globals — no bundler required). */
window.TD = { POSTS, CATEGORIES, AUTHOR };
