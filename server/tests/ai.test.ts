// @ts-nocheck
/**
 * AI Pipeline Tests
 * Tests: providerFactory, grokProvider (all 9 features), transcription
 * All external HTTP calls are mocked — no real API keys needed.
 *
 * Run: npm test -- --testPathPattern=ai.test
 */

process.env.NODE_ENV            = 'test';
process.env.MONGO_URI           = 'mongodb://localhost:27017/intellmeet_test';
process.env.JWT_SECRET          = 'test-access-secret-minimum-32-characters!!';
process.env.JWT_REFRESH_SECRET  = 'test-refresh-secret-minimum-32-characters!';
process.env.SESSION_SECRET      = 'test-session-secret-minimum-32-chars!!';
process.env.GROK_API_KEY        = 'test-grok-key';
process.env.GROQ_API_KEY        = 'test-groq-key';
process.env.AI_MODE             = 'grok';
process.env.AI_RETRIES          = '2';
process.env.AI_TIMEOUT          = '5000';

// ── Mock global fetch ─────────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

const makeGrokResponse = (content: string) => ({
  ok:   true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
  text: async () => content,
});

const makeWhisperResponse = (text: string) => ({
  ok:   true,
  status: 200,
  text: async () => text,
  json: async () => ({ text, segments: [{ start: 0, end: 2.5, text }] }),
});

// ── Reset module registry + provider cache between tests ─────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  // Re-set env after resetModules so fresh requires pick them up
  process.env.GROK_API_KEY = 'test-grok-key';
  process.env.GROQ_API_KEY = 'test-groq-key';
  global.fetch = mockFetch;
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. PROVIDER FACTORY
// ─────────────────────────────────────────────────────────────────────────────
describe('providerFactory', () => {
  it('returns grokProvider when GROK_API_KEY is set', () => {
    const { getAIProvider } = require('../src/ai/providers/providerFactory');
    const provider = getAIProvider();
    expect(provider).toBeDefined();
    expect(typeof provider.summarize).toBe('function');
  });

  it('throws when GROK_API_KEY is missing', () => {
    delete process.env.GROK_API_KEY;
    const { getAIProvider } = require('../src/ai/providers/providerFactory');
    expect(() => getAIProvider()).toThrow('GROK_API_KEY is not set');
  });

  it('caches the provider instance', () => {
    const { getAIProvider } = require('../src/ai/providers/providerFactory');
    const a = getAIProvider();
    const b = getAIProvider();
    expect(a).toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SUMMARIZATION
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.summarize', () => {
  it('returns markdown summary from Grok', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse('## Executive Summary\nGreat meeting.'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.summarize('We discussed the roadmap.', 'medium');
    expect(result).toContain('Executive Summary');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('grok-4');
  });

  it('throws when transcript is empty', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await expect(grokProvider.summarize('', 'medium')).rejects.toThrow('No transcript');
  });

  it('passes length instruction in prompt', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse('## Executive Summary\nShort.'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await grokProvider.summarize('transcript text', 'short');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('3-5 bullet points');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ACTION ITEMS
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.extractActionItems', () => {
  const mockItems = [
    { text: 'Deploy hotfix', assignee: 'Alice', dueDate: '2025-08-01', priority: 'high', status: 'pending', done: false },
  ];

  it('returns parsed action items array', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse(JSON.stringify(mockItems)));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.extractActionItems('Alice will deploy the hotfix by Friday.');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].text).toBe('Deploy hotfix');
    expect(result[0].priority).toBe('high');
  });

  it('returns empty array for empty transcript', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.extractActionItems('');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. DECISIONS
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.extractDecisions', () => {
  it('returns parsed decisions array', async () => {
    const mockDecisions = [
      { text: 'Adopt Kubernetes', type: 'approved', owner: 'Bob', impact: 'high', risks: [], dependencies: [] },
    ];
    mockFetch.mockResolvedValueOnce(makeGrokResponse(JSON.stringify(mockDecisions)));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.extractDecisions('We approved Kubernetes migration.');
    expect(result[0].type).toBe('approved');
    expect(result[0].impact).toBe('high');
  });

  it('returns empty array for empty transcript', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    expect(await grokProvider.extractDecisions('')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. MEETING MINUTES
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.generateMinutes', () => {
  it('returns markdown minutes', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse('# Meeting Minutes\n## Attendees\n- Alice'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.generateMinutes({
      transcript:   'Alice discussed the roadmap.',
      title:        'Q3 Planning',
      participants: ['Alice', 'Bob'],
      date:         '2025-08-01',
    });
    expect(result).toContain('Meeting Minutes');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('Q3 Planning');
    expect(body.messages[0].content).toContain('Alice, Bob');
  });

  it('throws when transcript is empty', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await expect(grokProvider.generateMinutes({
      transcript: '', title: 'Test', participants: [], date: '2025-08-01',
    })).rejects.toThrow('No transcript');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SMART NOTES
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.generateSmartNotes', () => {
  it('returns parsed smart notes object', async () => {
    const mockNotes = {
      topicsCovered: ['API Design'], followUpItems: ['Review PR'],
      questionsAsked: ['Timeline?'], answersGiven: ['End of month'],
      agendaCompletion: 85, notesMarkdown: '## Notes',
    };
    mockFetch.mockResolvedValueOnce(makeGrokResponse(JSON.stringify(mockNotes)));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.generateSmartNotes({
      transcript: 'We discussed API design.', title: 'Tech Sync', agenda: ['API Design'],
    });
    expect(result.agendaCompletion).toBe(85);
    expect(result.topicsCovered).toContain('API Design');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. FOLLOW-UP SUGGESTIONS
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.extractFollowUpSuggestions', () => {
  it('returns follow-up items with priority and owner', async () => {
    const mockFollowUps = [
      { text: 'Send recap email', priority: 'high', owner: 'Alice' },
      { text: 'Schedule next sync', priority: 'medium', owner: null },
    ];
    mockFetch.mockResolvedValueOnce(makeGrokResponse(JSON.stringify(mockFollowUps)));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.extractFollowUpSuggestions('Alice will send a recap.');
    expect(result).toHaveLength(2);
    expect(result[0].priority).toBe('high');
  });

  it('returns empty array for empty transcript', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    expect(await grokProvider.extractFollowUpSuggestions('')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. AI ASSISTANT CHAT
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.chat', () => {
  it('returns AI reply string', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse('The meeting covered API design and deployment.'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.chat('What was discussed?', {
      transcript: 'We discussed API design and deployment.',
      summary:    'API and deployment topics.',
      meetingTitle: 'Tech Sync',
    });
    expect(typeof result).toBe('string');
    expect(result).toContain('API design');
  });

  it('includes transcript excerpt in prompt', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse('Answer here.'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await grokProvider.chat('Summarize', { transcript: 'Long transcript content here.' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('Long transcript content here.');
  });

  it('throws for empty message', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await expect(grokProvider.chat('', {})).rejects.toThrow('Message cannot be empty');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. SEMANTIC SEARCH
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider.semanticSearch', () => {
  const docs = [
    { id: '1', title: 'Deployment Meeting', content: 'We discussed Kubernetes deployment.' },
    { id: '2', title: 'Budget Review',      content: 'Q3 budget was approved.' },
    { id: '3', title: 'API Design',         content: 'REST vs GraphQL debate.' },
  ];

  it('returns ranked results from Grok', async () => {
    const ranked = [{ index: 0, score: 0.95 }, { index: 2, score: 0.61 }];
    mockFetch.mockResolvedValueOnce(makeGrokResponse(JSON.stringify(ranked)));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const results = await grokProvider.semanticSearch('deployment', docs);
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Deployment Meeting');
    expect(results[0].score).toBe(0.95);
  });

  it('returns empty array for empty documents', async () => {
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    expect(await grokProvider.semanticSearch('query', [])).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('filters out results with score <= 0.3', async () => {
    const ranked = [{ index: 0, score: 0.95 }, { index: 1, score: 0.2 }];
    mockFetch.mockResolvedValueOnce(makeGrokResponse(JSON.stringify(ranked)));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const results = await grokProvider.semanticSearch('deployment', docs);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.95);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. TRANSCRIPTION
// ─────────────────────────────────────────────────────────────────────────────
describe('transcription', () => {
  it('transcribe() returns text from Groq Whisper', async () => {
    mockFetch.mockResolvedValue(makeWhisperResponse('Hello, this is a test transcript.'));
    const { transcribe } = require('../src/ai/transcription');
    const result = await transcribe(Buffer.from('fake-audio-data'), 'test.mp3');
    expect(result).toBe('Hello, this is a test transcript.');
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toContain('groq.com');
    expect(call[1].headers.Authorization).toBe('Bearer test-groq-key');
  });

  it('transcribeVerbose() returns text and segments', async () => {
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      text: async () => '',
      json: async () => ({
        text: 'Hello world.',
        segments: [{ start: 0, end: 1.5, text: 'Hello world.' }],
      }),
    });
    const { transcribeVerbose } = require('../src/ai/transcription');
    const result = await transcribeVerbose(Buffer.from('fake-audio'), 'test.wav');
    expect(result.text).toBe('Hello world.');
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].start).toBe(0);
  });

  it('throws for empty audio buffer', async () => {
    const { transcribe } = require('../src/ai/transcription');
    await expect(transcribe(Buffer.alloc(0))).rejects.toThrow('Empty audio buffer');
  });

  it('throws when GROQ_API_KEY is missing', async () => {
    delete process.env.GROQ_API_KEY;
    const { transcribe } = require('../src/ai/transcription');
    await expect(transcribe(Buffer.from('audio'))).rejects.toThrow('GROQ_API_KEY is not configured');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. RETRY LOGIC
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider retry logic', () => {
  it('retries on 503 and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'Service Unavailable' })
      .mockResolvedValueOnce(makeGrokResponse('## Executive Summary\nRetried successfully.'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.summarize('transcript', 'short');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toContain('Retried successfully');
  });

  it('does not retry on 401 (fatal auth error)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await expect(grokProvider.summarize('transcript', 'short')).rejects.toThrow('Invalid Grok API key');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. JSON PARSING (markdown fence stripping)
// ─────────────────────────────────────────────────────────────────────────────
describe('grokProvider JSON parsing', () => {
  it('handles response wrapped in ```json fences', async () => {
    const fenced = '```json\n[{"text":"Task A","assignee":null,"dueDate":null,"priority":"low","status":"pending","done":false}]\n```';
    mockFetch.mockResolvedValueOnce(makeGrokResponse(fenced));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    const result = await grokProvider.extractActionItems('Do task A.');
    expect(result[0].text).toBe('Task A');
  });

  it('throws descriptive error on unparseable JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeGrokResponse('This is not JSON at all.'));
    const { grokProvider } = require('../src/ai/providers/grokProvider');
    await expect(grokProvider.extractActionItems('some transcript')).rejects.toThrow('Failed to parse Grok response');
  });
});

export {};
