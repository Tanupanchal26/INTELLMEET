import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  Brain, Sparkles, FileText, Download, Search,
  Loader2, Mic, Bot, Video, CheckCircle2, Send, ListChecks,
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { aiService } from '../api/ai.api';
import { exportService } from '../api/export.api';
import { useAIStore } from '../store/ai/ai.store';
import { useAppSelector } from '../hooks/useAppDispatch';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const CAPABILITIES = [
  { icon: Mic,          label: 'Transcription',  color: '#60A5FA', bg: 'rgba(59,130,246,0.1)' },
  { icon: Sparkles,     label: 'Summarization',  color: '#A78BFA', bg: 'rgba(139,92,246,0.1)' },
  { icon: CheckCircle2, label: 'Action Items',   color: '#34D399', bg: 'rgba(16,185,129,0.1)' },
  { icon: FileText,     label: 'Minutes',        color: '#FBBF24', bg: 'rgba(245,158,11,0.1)' },
  { icon: Bot,          label: 'AI Assistant',   color: '#F87171', bg: 'rgba(239,68,68,0.1)' },
  { icon: Search,       label: 'Semantic Search',color: '#22D3EE', bg: 'rgba(6,182,212,0.1)' },
  { icon: ListChecks,   label: 'Follow-ups',     color: '#F472B6', bg: 'rgba(244,114,182,0.1)' },
];

const PROMPT_SUGGESTIONS = [
  'What were the key decisions made?',
  'Who is responsible for action items?',
  'Summarise the main blockers discussed',
  'What was agreed about the timeline?',
];

const AISummary = () => {
  const store = useAIStore();
  const authUser = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.accessToken) || localStorage.getItem('im_access_token') || '';

  // All page-level state lives in Zustand so it survives navigation
  const selectedId          = store.aiPageSelectedId;
  const activeTab           = store.aiPageActiveTab;
  const chatHistory         = store.aiPageChatHistory;
  const searchQuery         = store.aiPageSearchQuery;
  const searchResults       = store.aiPageSearchResults;
  const followUpSuggestions = store.aiPageFollowUpSuggestions;

  const setSelectedId          = store.setAIPageSelectedId;
  const setActiveTab           = store.setAIPageActiveTab;
  const setSearchQuery         = store.setAIPageSearchQuery;
  const setSearchResults       = store.setAIPageSearchResults;
  const setFollowUpSuggestions = store.setAIPageFollowUpSuggestions;

  const [chatMsg, setChatMsg]         = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [searching, setSearching]     = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const { data: meetingData, isLoading } = useQuery({
    queryKey: ['meetings-ai'],
    queryFn: () =>
      import('../api/meeting.api').then((m) =>
        m.meetingService.getAll({ limit: 30, status: 'ended' }).then((r: any) => r?.data ?? r ?? [])
      ),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
  const meetings: any[] = Array.isArray(meetingData) ? meetingData : (meetingData?.data ?? []);

  const { data: aiResult, isLoading: aiLoading, isFetching: aiFetching } = useQuery({
    queryKey: ['ai-result', selectedId],
    queryFn: () => aiService.getResult(selectedId!).then((r: any) => r?.data ?? r),
    enabled: !!selectedId,
    staleTime: 30 * 60_000,   // AI results are expensive — cache for 30 min
    gcTime: 60 * 60_000,      // keep in memory for 1 hour
    placeholderData: (prev: any) => prev,
    retry: 2,
  });

  // Auto-load follow-up suggestions when a completed meeting is selected
  useEffect(() => {
    if (!selectedId || !aiResult) return;
    if (aiResult.processingStatus === 'completed' && aiResult.followUpSuggestions?.length) {
      setFollowUpSuggestions(aiResult.followUpSuggestions);
      return;
    }
    if (aiResult.processingStatus === 'completed') {
      setFollowUpLoading(true);
      aiService.getFollowUpSuggestions(selectedId)
        .then((res: any) => setFollowUpSuggestions(res?.data?.suggestions ?? res?.suggestions ?? []))
        .catch(() => {})
        .finally(() => setFollowUpLoading(false));
    }
  }, [selectedId, aiResult?.processingStatus]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res: any = await aiService.searchMeetings(searchQuery);
      setSearchResults(res?.data?.results ?? res?.results ?? []);
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const handleGenerateSummary = async () => {
    if (!selectedId) return;
    store.setGenerating(true);
    try {
      const sRes: any = await aiService.generateSummary(selectedId, '');
      store.setSummary(sRes?.data?.summary ?? sRes?.summary ?? '');
      const aRes: any = await aiService.getActionItems(selectedId);
      store.setActionItems(aRes?.data?.actionItems ?? aRes?.actionItems ?? []);
      toast.success('Summary generated');
    } catch (err: any) { toast.error(err.message || 'Failed to generate summary'); }
    finally { store.setGenerating(false); }
  };

  const handleGenerateMinutes = async () => {
    if (!selectedId) return;
    try {
      const tRes: any = await aiService.getTranscript(selectedId);
      const transcript: string = tRes?.data?.transcript ?? tRes?.transcript ?? '';
      const res: any = await aiService.generateMinutes(selectedId, transcript || undefined);
      store.setMinutes(res?.data?.minutes ?? res?.minutes ?? '');
      setActiveTab('minutes');
      toast.success('Minutes generated');
    } catch { toast.error('Failed to generate minutes'); }
  };

  const handleChat = async (msg: string) => {
    if (!msg.trim() || !selectedId) return;
    setChatMsg('');
    setChatLoading(true);
    const updated = [...chatHistory, { role: 'user', content: msg }];
    store.setAIPageChatHistory(updated);
    try {
      const res: any = await aiService.assistantChat(selectedId, msg, chatHistory);
      const reply = res?.data?.reply ?? res?.reply ?? 'No response';
      store.setAIPageChatHistory([...updated, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      const errMsg = err?.message || 'Assistant unavailable';
      store.setAIPageChatHistory([...updated, { role: 'assistant', content: `Sorry, I couldn't process that. (${errMsg})` }]);
    } finally { setChatLoading(false); }
  };

  const handleSaveAsTasks = async () => {
    if (!selectedId) return;
    try {
      const res: any = await aiService.extractAndSaveTasks(selectedId);
      const count = res?.data?.tasks?.length ?? res?.tasks?.length ?? 0;
      toast.success(`${count} tasks created from action items`);
    } catch { toast.error('Failed to save tasks'); }
  };

  const handleExportPDF = () => {
    if (selectedId) exportService.downloadSummaryPDF(selectedId);
  };
  
  const handleExportCSV = () => {
    if (selectedId) exportService.downloadActionItemsCSV(selectedId);
  };

  const displaySummary = aiResult?.summary || store.summary;
  const displayMinutes = aiResult?.minutes || store.minutes;
  const displayActions = aiResult?.actionItems?.length ? aiResult.actionItems : store.actionItems;

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] text-[var(--color-text)]">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[1.375rem] font-bold text-[var(--color-text)] tracking-tight">AI Meeting Intelligence</h1>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5 font-medium">Transcripts, summaries, and action items — powered by GPT-4o</p>
        </div>
        <Badge variant="primary" dot pulse>GPT-4o</Badge>
      </div>

      {/* Capabilities strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {CAPABILITIES.map(({ icon: Icon, label, color, bg }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--color-border-subtle)] text-center transition-colors duration-200 hover:border-indigo-300"
            style={{ background: bg }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] shadow-sm">
              <Icon size={14} style={{ color }} />
            </div>
            <span className="text-[11px] font-bold text-[var(--color-text-secondary)] leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Semantic Search */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 mb-3">
          <Search size={13} className="text-indigo-600" />
          <span className="text-[13px] font-bold text-[var(--color-text)]">Semantic Search</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] font-medium">— search by meaning, not keywords</span>
        </div>
        <div className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. What was decided about the infrastructure rollout?"
            className="input-light flex-1"
          />
          <Button size="sm" onClick={handleSearch} loading={searching} leftIcon={<Search size={12} />}>
            Search
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] hover:border-indigo-600/30 hover:bg-indigo-50/50 transition-all text-left cursor-pointer"
              >
                <Video size={12} className="text-indigo-600 shrink-0" />
                <p className="text-[12.5px] text-[var(--color-text)] flex-1 truncate font-semibold">{r.title}</p>
                <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">{new Date(r.date).toLocaleDateString()}</span>
                <Badge variant="primary">{Math.round(r.score * 100)}%</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">

        {/* Meeting list */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 px-1">Past Meetings</p>
          {meetings.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-dim)] px-1">No ended meetings yet</p>
          ) : (
            meetings.map((m: any) => (
              <button
                key={m._id}
                onClick={() => { setSelectedId(m._id); store.setAIPageChatHistory([]); setFollowUpSuggestions([]); }}
                className={clsx(
                  'flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all w-full border cursor-pointer',
                  selectedId === m._id
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-black/5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                )}
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                  <Video size={11} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate leading-tight">{m.title}</p>
                  <p className="text-[10px] text-[var(--color-text-dim)] font-medium mt-1">{new Date(m.createdAt).toLocaleDateString()}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail area */}
        <div className="flex flex-col gap-4">
          {!selectedId ? (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl flex flex-col items-center justify-center py-20 gap-4 backdrop-blur-md">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-150 flex items-center justify-center shadow-md">
                <Brain size={22} className="text-indigo-600 opacity-70" />
              </div>
              <p className="text-[13px] text-[var(--color-text-secondary)] font-semibold">Select a meeting to view AI intelligence</p>
            </div>
          ) : aiLoading && !aiResult ? (
            // Skeleton — shown only on first load
            <div className="flex flex-col gap-3">
              {[80, 60, 90, 50].map((w, i) => (
                <div key={i} className="h-4 rounded-lg bg-white/40 animate-pulse" style={{ width: `${w}%` }} />
              ))}
              <div className="h-32 rounded-2xl bg-white/40 animate-pulse mt-2" />
            </div>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" loading={store.isGenerating} leftIcon={<Sparkles size={12} />} onClick={handleGenerateSummary}>
                  Generate Summary
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<FileText size={12} />} onClick={handleGenerateMinutes}>
                  Minutes
                </Button>
                {aiFetching && !aiLoading && (
                  <Loader2 size={13} className="animate-spin text-[var(--color-text-secondary)] ml-1" />
                )}
                {displaySummary && (
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Download size={12} />}
                      onClick={handleExportPDF}
                    >
                      Export PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Download size={12} />}
                      onClick={handleExportCSV}
                    >
                      Export Actions CSV
                    </Button>
                    {displayActions.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<CheckCircle2 size={12} />}
                        onClick={handleSaveAsTasks}
                      >
                        Save as Tasks
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Tab switcher */}
              <div
                className="flex gap-1 p-1 rounded-xl w-fit border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]"
              >
                {(['summary', 'actions', 'minutes', 'followup'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'px-4 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all cursor-pointer',
                      activeTab === tab
                        ? 'bg-white text-indigo-700 border border-[var(--color-border)] shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                    )}
                  >
                    {tab === 'followup' ? 'Follow-ups' : tab}
                    {tab === 'actions' && displayActions.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[9px] border border-indigo-200 font-bold">
                        {displayActions.length}
                      </span>
                    )}
                    {tab === 'followup' && followUpSuggestions.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[9px] border border-pink-200 font-bold">
                        {followUpSuggestions.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 backdrop-blur-md shadow-lg">
                {activeTab === 'summary' && (
                  displaySummary ? (
                    <div className="prose prose-sm max-w-none text-[var(--color-text)] text-[13px] leading-relaxed [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-[var(--color-text)] [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-[var(--color-border)] [&_h2]:pb-1 [&_strong]:text-indigo-700 [&_li]:list-disc [&_li]:ml-4 [&_a]:text-indigo-600 [&_a]:font-bold">
                      <ReactMarkdown>{displaySummary}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <Sparkles size={22} className="text-[var(--color-text-dim)]" />
                      <p className="text-[13px] text-[var(--color-text-secondary)] font-semibold">Click "Generate Summary" to analyse this meeting</p>
                    </div>
                  )
                )}

                {activeTab === 'actions' && (
                  displayActions.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {displayActions.map((a: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/40 border border-[var(--color-border)] hover:border-indigo-400/50 hover:bg-white/60 transition-all">
                          <div className={clsx(
                            'w-2 h-2 rounded-full shrink-0 mt-1.5 shadow-sm',
                            a.priority === 'high' ? 'bg-red-500 shadow-red-500/20' : a.priority === 'medium' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-[var(--color-text)] font-semibold leading-normal">{a.text}</p>
                            {a.assignee && <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 font-semibold">👤 {a.assignee}</p>}
                          </div>
                          <span className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 border uppercase tracking-wider',
                            a.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                            a.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          )}>
                            {a.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <CheckCircle2 size={22} className="text-[var(--color-text-dim)]" />
                      <p className="text-[13px] text-[var(--color-text-secondary)] font-semibold">Generate a summary to extract action items</p>
                    </div>
                  )
                )}

                {activeTab === 'minutes' && (
                  displayMinutes ? (
                    <div className="prose prose-sm max-w-none text-[var(--color-text)] text-[13px] leading-relaxed [&_strong]:text-indigo-700 [&_a]:text-indigo-600 [&_a]:font-bold">
                      <ReactMarkdown>{displayMinutes}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <FileText size={22} className="text-[var(--color-text-dim)]" />
                      <p className="text-[13px] text-[var(--color-text-secondary)] font-semibold">Click "Minutes" to generate formal meeting minutes</p>
                    </div>
                  )
                )}

                {activeTab === 'followup' && (
                  followUpLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={20} className="animate-spin text-pink-500" />
                    </div>
                  ) : followUpSuggestions.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {followUpSuggestions.map((s: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/40 border border-[var(--color-border)] hover:border-pink-400/50 hover:bg-white/60 transition-all">
                          <div className={clsx(
                            'w-2 h-2 rounded-full shrink-0 mt-1.5 shadow-sm',
                            s.priority === 'high' ? 'bg-red-500' : s.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-[var(--color-text)] font-semibold leading-normal">{s.text}</p>
                            {s.owner && <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 font-semibold">👤 {s.owner}</p>}
                          </div>
                          <span className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 border uppercase tracking-wider',
                            s.priority === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                            s.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          )}>
                            {s.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <ListChecks size={22} className="text-[var(--color-text-dim)]" />
                      <p className="text-[13px] text-[var(--color-text-secondary)] font-semibold">No follow-up suggestions yet — generate a summary first</p>
                    </div>
                  )
                )}
              </div>

              {/* AI Chat */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Bot size={13} className="text-indigo-600" />
                  </div>
                  <span className="text-[13px] font-bold text-[var(--color-text)]">Ask about this meeting</span>
                </div>

                {chatHistory.length === 0 && (
                  <div className="flex flex-wrap gap-2 p-4 pb-0">
                    {PROMPT_SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleChat(s)}
                        className="text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all text-left font-bold cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {chatHistory.length > 0 && (
                  <div className="flex flex-col gap-3 p-4 max-h-56 overflow-y-auto">
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={clsx('flex gap-2 text-[12.5px] leading-relaxed', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot size={10} className="text-indigo-600" />
                          </div>
                        )}
                        <div className={clsx(
                          'max-w-[85%] px-3 py-2 rounded-xl border font-medium',
                          msg.role === 'user'
                            ? 'bg-indigo-50 border-indigo-200 text-[var(--color-text)] rounded-br-sm shadow-sm font-semibold'
                            : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text)] rounded-bl-sm shadow-sm'
                        )}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                          <Bot size={10} className="text-indigo-600" />
                        </div>
                        <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                          <div className="typing-dot bg-indigo-600 animate-pulse w-1 h-1 rounded-full" />
                          <div className="typing-dot bg-indigo-600 animate-pulse delay-75 w-1 h-1 rounded-full" />
                          <div className="typing-dot bg-indigo-600 animate-pulse delay-150 w-1 h-1 rounded-full" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <input
                    value={chatMsg}
                    onChange={(e) => setChatMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChat(chatMsg)}
                    placeholder="Ask anything about this meeting…"
                    disabled={!selectedId || chatLoading}
                    className="input-light flex-1 text-sm h-9"
                  />
                  <button
                    onClick={() => handleChat(chatMsg)}
                    disabled={!chatMsg.trim() || chatLoading}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 shrink-0 cursor-pointer shadow-sm shadow-indigo-600/10"
                    style={{ background: 'var(--color-primary)' }}
                    aria-label="Send message"
                  >
                    {chatLoading
                      ? <Loader2 size={13} className="text-white animate-spin" />
                      : <Send size={13} className="text-white" />
                    }
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISummary;
