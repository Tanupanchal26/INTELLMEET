import { API_BASE_URL } from '../constants';

const getToken = (): string =>
  localStorage.getItem('im_access_token') || '';

const triggerDownload = (url: string, filename: string): void => {
  const token = getToken();
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
    })
    .catch((err) => console.error('[Export]', err));
};

export const exportService = {
  downloadSummaryPDF: (meetingId: string) =>
    triggerDownload(
      `${API_BASE_URL}/export/summary/${meetingId}`,
      `meeting-summary-${meetingId}.pdf`,
    ),

  downloadSummaryDOCX: (meetingId: string) =>
    triggerDownload(
      `${API_BASE_URL}/export/summary/${meetingId}/docx`,
      `meeting-summary-${meetingId}.docx`,
    ),

  downloadActionItemsCSV: (meetingId: string) =>
    triggerDownload(
      `${API_BASE_URL}/export/action-items/${meetingId}`,
      `action-items-${meetingId}.csv`,
    ),

  downloadAnalyticsCSV: () =>
    triggerDownload(
      `${API_BASE_URL}/export/analytics`,
      `analytics-report.csv`,
    ),
};
