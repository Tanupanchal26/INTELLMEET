// @ts-nocheck
const PDFDocument = require('pdfkit');
const { Parser }  = require('json2csv');
const Meeting     = require('../models/Meeting');
const AIResult    = require('../models/AIResult');
const Task        = require('../models/Task');
const analyticsService = require('./analytics.service');
const ApiError    = require('../utils/ApiError');

// ── PDF ───────────────────────────────────────────────────────────────────────
exports.generateSummaryPDF = async (meetingId: string, tenantId: string) => {
  const [meeting, aiResult] = await Promise.all([
    Meeting.findOne({ _id: meetingId, tenantId })
      .populate('participants', 'name email')
      .populate('host', 'name email'),
    AIResult.findOne({ meeting: meetingId }),
  ]);
  if (!meeting) throw ApiError.notFound('Meeting not found');

  const summaryText  = aiResult?.summary      || meeting.summary || 'No AI summary generated for this meeting.';
  const actionItems  = aiResult?.actionItems  || [];
  const decisions    = aiResult?.decisions    || [];

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];
      doc.on('data', (b: Buffer) => buffers.push(b));
      doc.on('end',  () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const primaryColor = '#1E293B';
      const accentColor  = '#4F46E5';
      const textColor    = '#334155';
      const lightBg      = '#F8FAFC';
      const borderColor  = '#E2E8F0';

      // Header
      doc.rect(0, 0, doc.page.width, 110).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold').text('INTELLMEET', 50, 35)
         .fontSize(9).font('Helvetica').text('MEETING SUMMARY REPORT', 50, 65, { characterSpacing: 1.5 });
      doc.fillColor(textColor);
      let y = 135;

      // Meeting info card
      doc.rect(50, y, doc.page.width - 100, 90).fill(lightBg).strokeColor(borderColor).stroke();
      doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold')
         .text(meeting.title, 65, y + 15, { width: doc.page.width - 130, height: 20 });
      doc.fillColor(textColor).fontSize(9.5)
         .font('Helvetica-Bold').text('Date:', 65, y + 42)
         .font('Helvetica').text(new Date(meeting.startedAt || meeting.createdAt).toLocaleString(), 110, y + 42)
         .font('Helvetica-Bold').text('Host:', 65, y + 60)
         .font('Helvetica').text(meeting.host?.name || 'Unknown Host', 110, y + 60);
      y += 110;

      const section = (title: string) => {
        if (y > doc.page.height - 120) { doc.addPage(); y = 60; }
        doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(title, 50, y);
        y += 16;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor(borderColor).stroke();
        y += 10;
      };

      // Participants
      section('Participants');
      const names = meeting.participants?.length
        ? meeting.participants.map((p: any) => p.name).join(', ')
        : 'No participants registered';
      doc.fillColor(textColor).fontSize(9.5).font('Helvetica')
         .text(names, 50, y, { width: doc.page.width - 100, lineGap: 2 });
      y += doc.heightOfString(names, { width: doc.page.width - 100, lineGap: 2 }) + 20;

      // AI Summary
      section('AI Summary');
      doc.fillColor(textColor).fontSize(9.5).font('Helvetica')
         .text(summaryText, 50, y, { width: doc.page.width - 100, align: 'justify', lineGap: 3 });
      y += doc.heightOfString(summaryText, { width: doc.page.width - 100, lineGap: 3 }) + 20;

      // Decisions
      if (decisions.length > 0) {
        section('Decisions');
        decisions.forEach((d: any) => {
          if (y > doc.page.height - 75) { doc.addPage(); y = 60; }
          const badge = d.type === 'approved' ? '✓' : d.type === 'rejected' ? '✗' : '?';
          doc.fillColor(textColor).fontSize(9.5).font('Helvetica-Bold')
             .text(`${badge}  ${d.text}`, 60, y, { width: doc.page.width - 120 });
          if (d.owner) {
            doc.fillColor('#64748B').fontSize(8.5).font('Helvetica')
               .text(`Owner: ${d.owner}  |  Impact: ${d.impact}`, 78, y + 14);
          }
          y += doc.heightOfString(d.text, { width: doc.page.width - 120 }) + 22;
        });
      }

      // Action Items
      section('Action Items');
      if (actionItems.length > 0) {
        actionItems.forEach((item: any) => {
          if (y > doc.page.height - 75) { doc.addPage(); y = 60; }
          const itemText = `[ ]  ${item.text}`;
          const metaText = `Assignee: ${item.assignee || 'Unassigned'}${item.dueDate ? ` | Due: ${item.dueDate}` : ''}  |  ${item.priority} priority`;
          doc.fillColor(textColor).fontSize(9.5).font('Helvetica-Bold')
             .text(itemText, 60, y, { width: doc.page.width - 120 })
             .fillColor('#64748B').fontSize(8.5).font('Helvetica')
             .text(metaText, 78, y + 14);
          y += doc.heightOfString(itemText, { width: doc.page.width - 120 }) + 22;
        });
      } else {
        doc.fillColor(textColor).fontSize(9.5).font('Helvetica')
           .text('No action items created for this meeting.', 50, y);
        y += 20;
      }

      // Page headers/footers
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        if (i > 0) {
          doc.rect(0, 0, doc.page.width, 35).fill(primaryColor);
          doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
             .text(`Meeting Summary: ${meeting.title}`, 50, 12);
        }
        doc.moveTo(50, doc.page.height - 45).lineTo(doc.page.width - 50, doc.page.height - 45)
           .strokeColor(borderColor).stroke();
        doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
           .text('IntellMeet Report — Generated automatically', 50, doc.page.height - 35)
           .text(`Page ${i + 1} of ${range.count}`, doc.page.width - 120, doc.page.height - 35, { align: 'right' });
      }

      doc.end();
    } catch (err) { reject(err); }
  });
};

// ── DOCX ──────────────────────────────────────────────────────────────────────
exports.generateSummaryDOCX = async (meetingId: string, tenantId: string): Promise<Buffer> => {
  const [meeting, aiResult] = await Promise.all([
    Meeting.findOne({ _id: meetingId, tenantId }).populate('participants', 'name').populate('host', 'name'),
    AIResult.findOne({ meeting: meetingId }),
  ]);
  if (!meeting) throw ApiError.notFound('Meeting not found');

  const summary     = aiResult?.summary     || meeting.summary || 'No summary available.';
  const actionItems = aiResult?.actionItems || [];
  const decisions   = aiResult?.decisions   || [];
  const keywords    = aiResult?.keywords    || {};

  const lines: string[] = [
    `INTELLMEET — MEETING SUMMARY`,
    ``,
    `Title:    ${meeting.title}`,
    `Date:     ${new Date(meeting.startedAt || meeting.createdAt).toLocaleString()}`,
    `Host:     ${meeting.host?.name || 'Unknown'}`,
    `Participants: ${(meeting.participants || []).map((p: any) => p.name).join(', ') || 'None'}`,
    ``,
    `═══════════════════════════════════════`,
    `AI SUMMARY`,
    `═══════════════════════════════════════`,
    summary,
    ``,
  ];

  if (decisions.length > 0) {
    lines.push(`═══════════════════════════════════════`);
    lines.push(`DECISIONS`);
    lines.push(`═══════════════════════════════════════`);
    decisions.forEach((d: any, i: number) => {
      lines.push(`${i + 1}. [${d.type.toUpperCase()}] ${d.text}`);
      if (d.owner) lines.push(`   Owner: ${d.owner}  |  Impact: ${d.impact}`);
      if (d.risks?.length)        lines.push(`   Risks: ${d.risks.join(', ')}`);
      if (d.dependencies?.length) lines.push(`   Dependencies: ${d.dependencies.join(', ')}`);
    });
    lines.push(``);
  }

  if (actionItems.length > 0) {
    lines.push(`═══════════════════════════════════════`);
    lines.push(`ACTION ITEMS`);
    lines.push(`═══════════════════════════════════════`);
    actionItems.forEach((a: any, i: number) => {
      lines.push(`${i + 1}. [ ] ${a.text}`);
      lines.push(`   Assignee: ${a.assignee || 'Unassigned'}  |  Priority: ${a.priority}  |  Status: ${a.status}${a.dueDate ? `  |  Due: ${a.dueDate}` : ''}`);
    });
    lines.push(``);
  }

  if (keywords?.topics?.length || keywords?.technologies?.length) {
    lines.push(`═══════════════════════════════════════`);
    lines.push(`KEYWORDS`);
    lines.push(`═══════════════════════════════════════`);
    if (keywords.topics?.length)       lines.push(`Topics:       ${keywords.topics.join(', ')}`);
    if (keywords.people?.length)       lines.push(`People:       ${keywords.people.join(', ')}`);
    if (keywords.projects?.length)     lines.push(`Projects:     ${keywords.projects.join(', ')}`);
    if (keywords.technologies?.length) lines.push(`Technologies: ${keywords.technologies.join(', ')}`);
    lines.push(``);
  }

  lines.push(`Generated by IntellMeet on ${new Date().toLocaleString()}`);

  return Buffer.from(lines.join('\r\n'), 'utf-8');
};

// ── CSV ───────────────────────────────────────────────────────────────────────
exports.generateActionItemsCSV = async (meetingId: string, tenantId: string) => {
  const [meeting, aiResult] = await Promise.all([
    Meeting.findOne({ _id: meetingId, tenantId }),
    AIResult.findOne({ meeting: meetingId }),
  ]);
  if (!meeting) throw ApiError.notFound('Meeting not found');

  const tasks = await Task.find({ meeting: meetingId, tenantId }).populate('assignedTo', 'name');

  let rows: any[] = [];
  if (tasks?.length) {
    rows = tasks.map((t: any) => ({
      Task:      t.title,
      Assignee:  t.assignedTo?.name || 'Unassigned',
      Priority:  t.priority,
      Status:    t.status,
      'Due Date': t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'N/A',
    }));
  } else if (aiResult?.actionItems?.length) {
    rows = aiResult.actionItems.map((item: any) => ({
      Task:      item.text,
      Assignee:  item.assignee || 'Unassigned',
      Priority:  item.priority,
      Status:    item.status,
      'Due Date': item.dueDate || 'N/A',
    }));
  } else if (meeting.actionItems?.length) {
    rows = meeting.actionItems.map((item: any) => ({
      Task:      item.text,
      Assignee:  item.assignee || 'Unassigned',
      Priority:  'medium',
      Status:    'pending',
      'Due Date': item.dueDate || 'N/A',
    }));
  } else {
    throw ApiError.badRequest('No action items found for this meeting');
  }

  const parser = new Parser({ fields: ['Task', 'Assignee', 'Priority', 'Status', 'Due Date'] });
  return parser.parse(rows);
};

exports.generateMarkdown = async (meetingId: string, tenantId: string): Promise<string> => {
  const [meeting, aiResult] = await Promise.all([
    Meeting.findOne({ _id: meetingId, tenantId }).populate('participants', 'name').populate('host', 'name'),
    AIResult.findOne({ meeting: meetingId }),
  ]);
  if (!meeting) throw ApiError.notFound('Meeting not found');

  const summary     = aiResult?.summary     || meeting.summary || 'No summary available.';
  const actionItems = aiResult?.actionItems || [];
  const decisions   = aiResult?.decisions   || [];

  const lines: string[] = [
    `# ${meeting.title}`,
    ``,
    `**Date:** ${new Date(meeting.startedAt || meeting.createdAt).toLocaleString()}  `,
    `**Host:** ${meeting.host?.name || 'Unknown'}  `,
    `**Participants:** ${(meeting.participants || []).map((p: any) => p.name).join(', ') || 'None'}`,
    ``,
    `## Summary`,
    ``,
    summary,
    ``,
  ];

  if (decisions.length > 0) {
    lines.push(`## Decisions`, ``);
    decisions.forEach((d: any) => {
      lines.push(`- **[${d.type.toUpperCase()}]** ${d.text}${d.owner ? ` *(${d.owner})*` : ''}`);
    });
    lines.push(``);
  }

  if (actionItems.length > 0) {
    lines.push(`## Action Items`, ``);
    actionItems.forEach((a: any) => {
      lines.push(`- [ ] ${a.text} — *${a.assignee || 'Unassigned'}* (${a.priority})`);
    });
    lines.push(``);
  }

  lines.push(`---`, `*Generated by IntellMeet on ${new Date().toLocaleString()}*`);
  return lines.join('\n');
};

exports.generateAnalyticsCSV = async (tenantId: string, userId: string) => {
  const metricsData   = await analyticsService.getDashboardMetrics(tenantId, userId);
  const analyticsData = await analyticsService.getAnalytics(tenantId, userId);

  const rows = [
    { 'Metric Name': 'Meetings This Month',    'Metric Value': metricsData.metrics.meetingsThisMonth },
    { 'Metric Name': 'Hours Saved (est.)',      'Metric Value': `${metricsData.metrics.hoursSaved} hrs` },
    { 'Metric Name': 'Tasks Completed',         'Metric Value': metricsData.metrics.tasksCompleted },
    { 'Metric Name': 'Team Members Online',     'Metric Value': metricsData.metrics.teamMembersOnline },
    { 'Metric Name': 'Avg Meeting Duration',    'Metric Value': analyticsData.engagement.find((e: any) => e.label === 'Avg Meeting Duration')?.value || '47 min' },
    { 'Metric Name': 'Participation Rate',      'Metric Value': analyticsData.engagement.find((e: any) => e.label === 'Participation Rate')?.value || '94%' },
    { 'Metric Name': 'AI Summary Usage',        'Metric Value': analyticsData.engagement.find((e: any) => e.label === 'AI Summary Usage')?.value || '78%' },
    { 'Metric Name': 'Action Item Completion',  'Metric Value': analyticsData.engagement.find((e: any) => e.label === 'Action Item Completion')?.value || '61%' },
    { 'Metric Name': 'Latest Productivity Score','Metric Value': `${analyticsData.productivity[analyticsData.productivity.length - 1]?.score || 91}%` },
  ];

  const parser = new Parser({ fields: ['Metric Name', 'Metric Value'] });
  return parser.parse(rows);
};

export {};
