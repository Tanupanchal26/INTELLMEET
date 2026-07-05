import { getAIProvider } from './providers/providerFactory';

export interface ActionItem {
  text:     string;
  assignee: string | null;
  dueDate:  string | null;
  priority: 'high' | 'medium' | 'low';
  status:   'pending' | 'in_progress' | 'done';
}

export interface Decision {
  text:         string;
  type:         'approved' | 'rejected' | 'pending';
  owner:        string | null;
  impact:       'high' | 'medium' | 'low';
  risks:        string[];
  dependencies: string[];
}

export const extractActionItems = (transcript: string): Promise<ActionItem[]> =>
  getAIProvider().extractActionItems(transcript) as Promise<ActionItem[]>;

export const extractDecisions = (transcript: string): Promise<Decision[]> =>
  getAIProvider().extractDecisions(transcript) as Promise<Decision[]>;
