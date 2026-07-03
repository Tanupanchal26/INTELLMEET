// @ts-nocheck
const exportService = require('../../services/export.service');
const asyncHandler = require('../../utils/asyncHandler');

exports.exportSummaryPDF = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const pdfBuffer = await exportService.generateSummaryPDF(meetingId, req.tenantId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=meeting-summary-${meetingId}.pdf`);
  res.status(200).send(pdfBuffer);
});

exports.exportActionItemsCSV = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const csvString = await exportService.generateActionItemsCSV(meetingId, req.tenantId);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=action-items-${meetingId}.csv`);
  res.status(200).send(csvString);
});

exports.exportAnalyticsCSV = asyncHandler(async (req, res) => {
  const csvString = await exportService.generateAnalyticsCSV(req.tenantId, req.user._id);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=analytics-report.csv`);
  res.status(200).send(csvString);
});

exports.exportMinutesDOCX = asyncHandler(async (req, res) => {
  const { meetingId } = req.params;
  const docxBuffer = await exportService.generateSummaryDOCX(meetingId, req.tenantId);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=meeting-summary-${meetingId}.docx`);
  res.status(200).send(docxBuffer);
});

export {};
