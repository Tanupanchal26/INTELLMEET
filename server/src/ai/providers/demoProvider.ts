/**
 * Demo AI Provider
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates realistic, dynamic AI responses without calling any external API.
 * Every response is seeded from real meeting data when available, and falls
 * back to professional business content when data is absent.
 *
 * Switching to a real provider: set AI_MODE=gemini or AI_MODE=openai in .env
 */

// ── Deterministic-but-varied seeding ─────────────────────────────────────────
// We use the meetingId (or a timestamp) as a seed so the same meeting always
// gets the same "random" content, but different meetings get different content.
const seed = (str: string): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
};

const pick = <T>(arr: T[], s: number, offset = 0): T =>
  arr[(s + offset) % arr.length];

const pickN = <T>(arr: T[], n: number, s: number): T[] => {
  const result: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < n && result.length < arr.length; i++) {
    const idx = (s + i * 7) % arr.length;
    if (!used.has(idx)) { used.add(idx); result.push(arr[idx]); }
  }
  return result;
};

const randInt = (min: number, max: number, s: number): number =>
  min + (s % (max - min + 1));

// ── Simulated processing delay ────────────────────────────────────────────────
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const thinkDelay = () => delay(1500 + Math.random() * 1000); // 1.5–2.5 s

// ── Content pools ─────────────────────────────────────────────────────────────

const EXEC_OPENERS = [
  'The meeting achieved its primary objectives with strong cross-functional alignment.',
  'Participants reached consensus on several critical strategic initiatives.',
  'The session produced actionable outcomes across all agenda items discussed.',
  'Key stakeholders aligned on priorities and established clear ownership for next steps.',
  'The team demonstrated strong collaboration, resolving open blockers and setting direction.',
];

const HIGHLIGHT_POOLS = [
  'Sprint velocity increased by 18% compared to the previous cycle',
  'Budget allocation for Q3 infrastructure was approved unanimously',
  'New onboarding workflow reduces time-to-productivity by an estimated 30%',
  'API latency improvements reduced average response time from 420ms to 180ms',
  'Customer satisfaction scores improved to 4.6/5.0 following the UX redesign',
  'Security audit findings were reviewed; all critical items assigned owners',
  'Mobile app release candidate passed QA with zero P0 defects',
  'Cross-team dependency on the data pipeline was resolved with a new shared contract',
  'Stakeholder demo received positive feedback; product roadmap confirmed for H2',
  'Automated testing coverage increased from 62% to 81% this sprint',
  'Deployment pipeline now supports zero-downtime releases',
  'User research synthesis identified three high-impact feature opportunities',
];

const DISCUSSION_POOLS = [
  'The team reviewed current sprint progress and identified two at-risk deliverables requiring immediate attention.',
  'Architecture decisions around microservice boundaries were debated, with consensus reached on a domain-driven approach.',
  'Customer feedback from the latest cohort was analyzed, surfacing recurring pain points in the onboarding flow.',
  'Performance benchmarks were presented, showing measurable improvements following the caching layer refactor.',
  'Risk register was updated with three new items; mitigation strategies were assigned to respective owners.',
  'The product roadmap for the next quarter was reviewed and reprioritized based on updated business objectives.',
  'Integration requirements with the third-party payment provider were clarified and documented.',
  'Team capacity for the upcoming release was assessed; two additional engineers will be allocated from Platform.',
  'Compliance requirements for the EU market expansion were reviewed with the legal team representative.',
  'Incident post-mortem findings were presented; five process improvements were agreed upon.',
];

const DECISION_POOLS = [
  'Approved migration to a containerized deployment model using Kubernetes by end of quarter.',
  'Agreed to adopt trunk-based development to reduce merge conflicts and accelerate CI/CD.',
  'Decided to sunset the legacy reporting module after the new analytics dashboard reaches feature parity.',
  'Approved the revised API versioning strategy; v2 endpoints will be maintained for 12 months.',
  'Confirmed budget increase of 15% for cloud infrastructure to support projected growth.',
  'Agreed to implement feature flags for all major releases going forward.',
  'Decided to conduct bi-weekly architecture reviews to maintain technical alignment.',
  'Approved the new data retention policy in compliance with updated regulatory requirements.',
  'Confirmed the go-live date for the redesigned customer portal.',
  'Agreed to establish an on-call rotation for the new real-time notification service.',
];

const OUTCOME_POOL = [
  'The meeting concluded with clear ownership, defined timelines, and strong team alignment. All action items have been assigned and will be tracked in the project management system.',
  'All agenda items were addressed. The team leaves with a shared understanding of priorities and concrete next steps to drive progress before the next sync.',
  'Productive session with measurable outcomes. Blockers were resolved, decisions were documented, and the team is well-positioned to execute on commitments.',
  'The meeting delivered on its objectives. Key decisions are documented, risks are mitigated, and the team has a clear path forward.',
];

const ACTION_TITLE_POOLS = [
  ['Update API documentation', 'Refactor authentication module', 'Deploy hotfix to staging', 'Review pull request #247', 'Set up monitoring alerts'],
  ['Conduct user interviews', 'Finalize Q3 roadmap', 'Prepare stakeholder presentation', 'Update project timeline', 'Schedule design review'],
  ['Resolve database performance issue', 'Implement rate limiting', 'Write unit tests for payment service', 'Configure CI/CD pipeline', 'Audit access permissions'],
  ['Draft technical specification', 'Migrate legacy endpoints', 'Optimize image compression pipeline', 'Review security findings', 'Update onboarding documentation'],
  ['Coordinate with DevOps on deployment', 'Finalize data model changes', 'Conduct code review session', 'Update error handling strategy', 'Prepare release notes'],
];

const ACTION_DESCRIPTIONS = [
  'Ensure all changes are reviewed, tested, and documented before the deadline.',
  'Coordinate with relevant stakeholders and provide a status update at the next sync.',
  'Complete this task with attention to edge cases and update the team on progress.',
  'Prioritize this item given its dependency on downstream deliverables.',
  'This is a blocking item — escalate immediately if any obstacles arise.',
  'Document findings and share with the team for visibility and alignment.',
  'Validate the implementation against acceptance criteria before marking complete.',
  'Collaborate with the relevant team members to ensure smooth handoff.',
];

const ASSIGNEE_POOLS = [
  ['Sarah Chen', 'Marcus Johnson', 'Priya Patel', 'David Kim', 'Emma Rodriguez'],
  ['Alex Thompson', 'Jordan Lee', 'Natalie Brooks', 'Ryan Okafor', 'Mia Zhang'],
  ['Chris Andersen', 'Fatima Al-Hassan', 'Lucas Ferreira', 'Aisha Nwosu', 'Tom Eriksson'],
];

const ASSISTANT_RESPONSES: Record<string, string[]> = {
  summary: [
    'Based on the meeting data, the session focused on sprint planning, technical architecture decisions, and cross-team alignment. Key outcomes included approved budget changes, resolved blockers, and clearly assigned action items.',
    'The meeting covered product roadmap updates, performance review findings, and stakeholder alignment. The team reached consensus on three major decisions and identified five action items for the upcoming sprint.',
    'This was a productive working session. The team reviewed current progress, addressed open risks, and finalized priorities for the next delivery cycle. All participants left with clear ownership of their commitments.',
  ],
  attendees: [
    'The meeting included representatives from Engineering, Product, and Design. The host facilitated the session with full participation from all attendees.',
    'All invited participants attended. The session had strong cross-functional representation, ensuring decisions had appropriate input from all stakeholders.',
    'The meeting was well-attended with active participation throughout. Key decision-makers were present, enabling real-time approvals on critical items.',
  ],
  decisions: [
    'The team made three key decisions: (1) approved the new deployment strategy, (2) confirmed the Q3 roadmap priorities, and (3) agreed on the technical approach for the upcoming integration.',
    'Major decisions included budget approval for infrastructure scaling, adoption of the new branching strategy, and confirmation of the release timeline.',
    'Key decisions were: migration to the new architecture pattern, approval of the revised API contract, and agreement on the on-call rotation schedule.',
  ],
  tasks: [
    'The following tasks were identified: update documentation, complete the security review, finalize the API specification, and schedule the next stakeholder demo. All items have been assigned with due dates.',
    'Action items include: resolving the performance bottleneck, completing the code review backlog, updating the project timeline, and preparing the release notes. Owners and deadlines are confirmed.',
    'Outstanding tasks: implement the approved changes, conduct user testing, update the risk register, and coordinate the deployment. All items are tracked in the project management system.',
  ],
  next: [
    'Next steps include completing the assigned action items, scheduling a follow-up review in two weeks, and sharing the meeting summary with all stakeholders.',
    'The team should focus on the high-priority action items first. A progress check-in is scheduled for next week to ensure commitments are on track.',
    'Immediate next steps: complete the blocking items, update the project board, and notify dependent teams of the decisions made in this session.',
  ],
  default: [
    'Based on the available meeting context, I can see this was a productive session with clear outcomes. The team demonstrated strong alignment and made measurable progress on key initiatives.',
    'The meeting data indicates strong participation and effective decision-making. All agenda items were addressed and action items have been assigned to appropriate owners.',
    'From the meeting context, the session achieved its objectives. Key decisions were made, blockers were resolved, and the team has a clear path forward.',
  ],
};

const TOPIC_POOLS = [
  ['Sprint Planning', 'Technical Debt', 'API Design', 'Performance Optimization', 'Security Review'],
  ['Product Roadmap', 'User Research', 'Feature Prioritization', 'Stakeholder Alignment', 'Release Planning'],
  ['Architecture Review', 'Database Optimization', 'CI/CD Pipeline', 'Monitoring & Alerting', 'Incident Response'],
  ['Budget Planning', 'Team Capacity', 'Risk Management', 'Compliance Review', 'Vendor Evaluation'],
];

const TECH_POOLS = [
  ['React', 'Node.js', 'MongoDB', 'Redis', 'Docker'],
  ['TypeScript', 'PostgreSQL', 'Kubernetes', 'AWS', 'GraphQL'],
  ['Python', 'FastAPI', 'Elasticsearch', 'Kafka', 'Terraform'],
  ['Next.js', 'Prisma', 'Socket.io', 'Nginx', 'GitHub Actions'],
];

// ── Context builder ───────────────────────────────────────────────────────────

interface MeetingContext {
  meetingId?:   string;
  title?:       string;
  participants?: string[];
  duration?:    number;
  date?:        string;
  host?:        string;
  transcript?:  string;
  summary?:     string;
}

const buildContext = (ctx: MeetingContext) => {
  const id   = ctx.meetingId || String(Date.now());
  const s    = seed(id);
  const now  = new Date();
  const date = ctx.date || now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = ctx.title || pick(['Product Sync', 'Engineering Stand-up', 'Sprint Review', 'Architecture Discussion', 'Quarterly Planning'], s);
  const durationMins = ctx.duration || randInt(25, 75, s);
  const participantNames = ctx.participants?.length
    ? ctx.participants
    : pickN(pick(ASSIGNEE_POOLS, s), randInt(3, 6, s + 1), s + 2);
  const host = ctx.host || participantNames[0] || 'Meeting Host';

  return { id, s, date, title, durationMins, participantNames, host };
};

// ── Public provider interface ─────────────────────────────────────────────────

export interface AIProvider {
  summarize(transcript: string, length: 'short' | 'medium' | 'detailed', ctx?: MeetingContext): Promise<string>;
  extractActionItems(transcript: string, ctx?: MeetingContext): Promise<any[]>;
  extractDecisions(transcript: string, ctx?: MeetingContext): Promise<any[]>;
  extractKeywords(transcript: string, ctx?: MeetingContext): Promise<any>;
  extractFollowUpSuggestions(transcript: string, ctx?: MeetingContext): Promise<any[]>;
  generateMinutes(opts: { transcript: string; title: string; participants: string[]; date: string }, ctx?: MeetingContext): Promise<string>;
  generateSmartNotes(opts: { transcript: string; title: string; agenda: string[] }, ctx?: MeetingContext): Promise<any>;
  chat(message: string, context: any): Promise<string>;
  generateTasks(prompt: string, transcript: string, ctx?: MeetingContext): Promise<any[]>;
  semanticSearch(query: string, documents: any[]): Promise<any[]>;
  embed(text: string): Promise<number[]>;
}

// ── Demo Provider implementation ──────────────────────────────────────────────

export const demoProvider: AIProvider = {

  async summarize(transcript, length, ctx = {}) {
    await thinkDelay();
    const { s, date, title, durationMins, participantNames, host } = buildContext(ctx);

    const numHighlights = length === 'short' ? 3 : length === 'medium' ? 5 : 7;
    const numDiscussion = length === 'short' ? 2 : length === 'medium' ? 3 : 5;
    const numDecisions  = length === 'short' ? 2 : length === 'medium' ? 3 : 4;

    const highlights  = pickN(HIGHLIGHT_POOLS,  numHighlights, s);
    const discussions = pickN(DISCUSSION_POOLS, numDiscussion, s + 3);
    const decisions   = pickN(DECISION_POOLS,   numDecisions,  s + 5);

    const participantList = participantNames.slice(0, 5).join(', ');

    return `## Executive Summary

${pick(EXEC_OPENERS, s)} The **${title}** session ran for ${durationMins} minutes on ${date}, with ${participantNames.length} participants including ${participantList}.

## Key Highlights

${highlights.map(h => `- ${h}`).join('\n')}

## Discussion Points

${discussions.map((d, i) => `${i + 1}. ${d}`).join('\n')}

## Important Decisions

${decisions.map(d => `- ✅ ${d}`).join('\n')}

## Meeting Outcome

${pick(OUTCOME_POOL, s + 7)} The session was facilitated by **${host}** and all participants contributed actively to the outcomes documented above.`;
  },

  async extractActionItems(transcript, ctx = {}) {
    await thinkDelay();
    const { s, participantNames } = buildContext(ctx);

    const titlePool  = pick(ACTION_TITLE_POOLS, s);
    const assignees  = pickN(participantNames.length ? participantNames : pick(ASSIGNEE_POOLS, s), 5, s);
    const count      = randInt(4, 7, s);
    const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'medium', 'low', 'high', 'medium', 'low'];
    const statuses: Array<'pending' | 'in_progress' | 'done'> = ['pending', 'pending', 'in_progress', 'pending', 'pending', 'in_progress', 'pending'];

    const now = new Date();
    return Array.from({ length: count }, (_, i) => {
      const due = new Date(now);
      due.setDate(due.getDate() + randInt(3, 14, s + i));
      return {
        text:     titlePool[i % titlePool.length],
        assignee: assignees[i % assignees.length] || null,
        dueDate:  due.toISOString().split('T')[0],
        priority: priorities[(s + i) % priorities.length],
        status:   statuses[(s + i) % statuses.length],
        done:     false,
      };
    });
  },

  async extractDecisions(transcript, ctx = {}) {
    await thinkDelay();
    const { s, participantNames } = buildContext(ctx);
    const count = randInt(2, 4, s);
    const types: Array<'approved' | 'rejected' | 'pending'> = ['approved', 'approved', 'pending', 'approved', 'rejected'];
    const impacts: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'high', 'low', 'medium'];

    return Array.from({ length: count }, (_, i) => ({
      text:         pick(DECISION_POOLS, s + i),
      type:         types[(s + i) % types.length],
      owner:        participantNames[i % participantNames.length] || null,
      impact:       impacts[(s + i) % impacts.length],
      risks:        pickN(['Timeline slippage', 'Resource constraints', 'Technical complexity', 'Dependency risk'], 2, s + i),
      dependencies: pickN(['Infrastructure readiness', 'API contract finalization', 'Stakeholder sign-off', 'QA completion'], 2, s + i + 1),
    }));
  },

  async extractKeywords(transcript, ctx = {}) {
    await thinkDelay();
    const { s, title, participantNames } = buildContext(ctx);
    return {
      topics:        pickN(pick(TOPIC_POOLS, s), 5, s),
      people:        participantNames.slice(0, 4),
      projects:      pickN([title, 'Platform Modernization', 'Q3 Initiative', 'Core API Refactor', 'Mobile Release'], 3, s),
      technologies:  pickN(pick(TECH_POOLS, s), 4, s),
      frequentTerms: pickN(['sprint', 'deployment', 'review', 'timeline', 'stakeholder', 'integration', 'performance', 'release'], 6, s),
    };
  },

  async extractFollowUpSuggestions(transcript, ctx = {}) {
    await thinkDelay();
    const { s, participantNames } = buildContext(ctx);
    const suggestions = [
      'Schedule a follow-up review to validate action item completion',
      'Share meeting summary with all stakeholders not present in the session',
      'Update the project board to reflect decisions made in this meeting',
      'Conduct a risk assessment on the approved architectural changes',
      'Prepare a brief for leadership summarizing key outcomes',
      'Coordinate with dependent teams on the agreed integration timeline',
    ];
    const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'medium', 'low', 'medium', 'high'];
    return pickN(suggestions, 4, s).map((text, i) => ({
      text,
      priority: priorities[(s + i) % priorities.length],
      owner:    participantNames[i % participantNames.length] || null,
    }));
  },

  async generateMinutes(opts, ctx = {}) {
    await thinkDelay();
    const { s, date, durationMins, participantNames, host } = buildContext({ ...ctx, ...opts });
    const { title, participants, date: optDate } = opts;
    const displayDate = optDate || date;
    const names = participants?.length ? participants : participantNames;

    const startHour = 9 + randInt(0, 4, s);
    const startTime = `${String(startHour).padStart(2, '0')}:${randInt(0, 1, s) ? '30' : '00'}`;
    const endDate   = new Date(`2024-01-01T${startTime}`);
    endDate.setMinutes(endDate.getMinutes() + durationMins);
    const endTime   = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    const discussions = pickN(DISCUSSION_POOLS, 3, s + 1);
    const decisions   = pickN(DECISION_POOLS,   3, s + 2);
    const actions     = pickN(pick(ACTION_TITLE_POOLS, s), 4, s + 3);
    const topics      = pickN(pick(TOPIC_POOLS, s), 3, s);

    return `# Meeting Minutes

## Meeting Details
| Field | Value |
|-------|-------|
| **Title** | ${title} |
| **Date** | ${displayDate} |
| **Start Time** | ${startTime} |
| **End Time** | ${endTime} |
| **Duration** | ${durationMins} minutes |
| **Host** | ${host} |
| **Location** | IntellMeet Virtual Room |

## Attendees
${names.map(n => `- ${n}`).join('\n')}

## Agenda
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Discussion Summary

${discussions.map((d, i) => `### ${i + 1}. ${topics[i] || 'Discussion Point'}\n${d}`).join('\n\n')}

## Key Decisions

${decisions.map((d, i) => `${i + 1}. **Decision:** ${d}`).join('\n')}

## Action Items

| Task | Owner | Due Date | Priority | Status |
|------|-------|----------|----------|--------|
${actions.map((a, i) => {
  const due = new Date();
  due.setDate(due.getDate() + randInt(5, 14, s + i));
  return `| ${a} | ${names[i % names.length] || 'TBD'} | ${due.toLocaleDateString()} | ${i === 0 ? 'High' : 'Medium'} | Pending |`;
}).join('\n')}

## Challenges & Risks

- Resource availability may impact delivery timelines for high-priority items
- External dependencies require proactive coordination with partner teams
- Technical complexity of approved changes warrants additional review cycles

## Next Steps

1. All action item owners to confirm receipt and provide initial status by EOD
2. Meeting summary to be distributed to all participants and relevant stakeholders
3. Follow-up session to be scheduled within two weeks to review progress
4. Project board to be updated to reflect decisions and new action items

## Follow-up

Next meeting scheduled in **two weeks**. All participants are expected to complete assigned action items and provide status updates prior to the next session.

---
*Minutes recorded by IntellMeet AI · ${new Date().toLocaleDateString()}*`;
  },

  async generateSmartNotes(opts, ctx = {}) {
    await thinkDelay();
    const { s } = buildContext({ ...ctx, title: opts.title });
    const { title, agenda } = opts;
    const topics    = pickN(pick(TOPIC_POOLS, s), 5, s);
    const followUps = pickN([
      'Validate implementation against acceptance criteria',
      'Share findings with the broader engineering team',
      'Update documentation to reflect architectural changes',
      'Coordinate with QA on test coverage for new features',
      'Review and update the risk register',
    ], 4, s);
    const questions = pickN([
      'What is the expected timeline for the infrastructure migration?',
      'How will we handle backward compatibility during the API transition?',
      'What are the resource requirements for the proposed solution?',
      'Who is the primary owner for the compliance review?',
    ], 3, s);
    const answers = pickN([
      'Migration is targeted for end of quarter with a phased rollout approach.',
      'A versioning strategy will be implemented to maintain backward compatibility for 12 months.',
      'Two additional engineers will be allocated from the Platform team.',
      'The compliance review will be led by the Security team with input from Legal.',
    ], 3, s);
    const completion = randInt(75, 98, s);

    return {
      topicsCovered:    topics,
      followUpItems:    followUps,
      questionsAsked:   questions,
      answersGiven:     answers,
      agendaCompletion: completion,
      notesMarkdown: `## Smart Notes — ${title}

### Topics Covered
${topics.map(t => `- ${t}`).join('\n')}

### Key Follow-ups
${followUps.map(f => `- [ ] ${f}`).join('\n')}

### Q&A Summary
${questions.map((q, i) => `**Q:** ${q}\n**A:** ${answers[i] || 'To be confirmed.'}`).join('\n\n')}

### Agenda Completion: ${completion}%
${agenda?.length ? `Covered ${Math.round(agenda.length * completion / 100)} of ${agenda.length} agenda items.` : 'All agenda items were addressed.'}`,
    };
  },

  async chat(message, context) {
    await thinkDelay();
    const msg   = message.toLowerCase();
    const s     = seed(message + (context?.transcript || '').slice(0, 50));
    const title = context?.meetingTitle || 'this meeting';

    let category = 'default';
    if (msg.includes('summar') || msg.includes('what happened') || msg.includes('overview'))
      category = 'summary';
    else if (msg.includes('attend') || msg.includes('who') || msg.includes('participant'))
      category = 'attendees';
    else if (msg.includes('decision') || msg.includes('agreed') || msg.includes('approved'))
      category = 'decisions';
    else if (msg.includes('task') || msg.includes('action') || msg.includes('todo') || msg.includes('to-do'))
      category = 'tasks';
    else if (msg.includes('next') || msg.includes('follow') || msg.includes('step'))
      category = 'next';

    const responses = ASSISTANT_RESPONSES[category] || ASSISTANT_RESPONSES.default;
    const base = pick(responses, s);

    // Personalise with meeting title when available
    return base.replace('the meeting', `the **${title}** meeting`);
  },

  async generateTasks(prompt, transcript, ctx = {}) {
    await thinkDelay();
    const { s, participantNames } = buildContext(ctx);
    const titlePool = pick(ACTION_TITLE_POOLS, s);
    const count     = randInt(3, 6, s);

    return Array.from({ length: count }, (_, i) => ({
      title:          titlePool[i % titlePool.length],
      description:    pick(ACTION_DESCRIPTIONS, s + i),
      priority:       (['high', 'medium', 'medium', 'low'] as const)[(s + i) % 4],
      estimatedHours: pick([1, 2, 3, 4, 6, 8], s + i),
    }));
  },

  async semanticSearch(query, documents) {
    // No external embedding call — score by keyword overlap
    const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    return documents
      .map(doc => {
        const text   = `${doc.title} ${doc.content}`.toLowerCase();
        const words  = text.split(/\W+/);
        const hits   = words.filter(w => queryWords.has(w)).length;
        const score  = Math.min(0.99, 0.3 + (hits / Math.max(queryWords.size, 1)) * 0.7);
        return { ...doc, score };
      })
      .filter(d => d.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  },

  async embed(text) {
    // Return a deterministic pseudo-embedding (unit vector seeded from text)
    const s   = seed(text.slice(0, 100));
    const dim = 768;
    const vec = Array.from({ length: dim }, (_, i) => Math.sin(s + i) * 0.1);
    const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0));
    return vec.map(v => v / norm);
  },
};
