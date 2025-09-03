export interface Issue {
  id: string;
  shopDomain: string;
  orderId: string;
  orderName: string;
  reason: IssueReason;
  state: IssueState;
  assigneeId?: string;
  assigneeName?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  metadata?: Record<string, any>;
}

export type IssueReason = 
  | 'address_check'
  | 'weight_mismatch'
  | 'stock_short'
  | 'payment_hold'
  | 'printer_offline'
  | 'label_unavailable'
  | 'carrier_error'
  | 'custom';

export type IssueState = 
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface IssueFilters {
  reason?: IssueReason;
  state?: IssueState;
  assigneeId?: string;
  shopDomain?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface IssueStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byReason: Record<IssueReason, number>;
  byShop: Record<string, number>;
}

export class ExceptionsManager {
  private issues: Issue[] = [];
  private listeners: Set<(issues: Issue[]) => void> = new Set();

  constructor() {
    this.loadIssues();
  }

  private loadIssues(): void {
    // Load from localStorage in browser mode
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('exceptions_issues');
      if (stored) {
        try {
          this.issues = JSON.parse(stored).map((issue: any) => ({
            ...issue,
            createdAt: new Date(issue.createdAt),
            updatedAt: new Date(issue.updatedAt),
            resolvedAt: issue.resolvedAt ? new Date(issue.resolvedAt) : undefined,
          }));
        } catch (error) {
          console.warn('Failed to parse stored issues:', error);
          this.issues = [];
        }
      }
    }
  }

  private saveIssues(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('exceptions_issues', JSON.stringify(this.issues));
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.issues]));
  }

  subscribe(listener: (issues: Issue[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.issues]);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  createIssue(data: Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>): Issue {
    const issue: Issue = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.issues.push(issue);
    this.saveIssues();
    this.notifyListeners();
    return issue;
  }

  updateIssue(id: string, updates: Partial<Issue>): Issue | null {
    const issue = this.issues.find(i => i.id === id);
    if (!issue) return null;

    Object.assign(issue, updates, { updatedAt: new Date() });
    
    if (updates.state === 'resolved' && !issue.resolvedAt) {
      issue.resolvedAt = new Date();
    }

    this.saveIssues();
    this.notifyListeners();
    return issue;
  }

  getIssue(id: string): Issue | null {
    return this.issues.find(i => i.id === id) || null;
  }

  getIssues(filters?: IssueFilters): Issue[] {
    let filtered = [...this.issues];

    if (filters?.reason) {
      filtered = filtered.filter(i => i.reason === filters.reason);
    }

    if (filters?.state) {
      filtered = filtered.filter(i => i.state === filters.state);
    }

    if (filters?.assigneeId) {
      filtered = filtered.filter(i => i.assigneeId === filters.assigneeId);
    }

    if (filters?.shopDomain) {
      filtered = filtered.filter(i => i.shopDomain === filters.shopDomain);
    }

    if (filters?.dateRange) {
      filtered = filtered.filter(i => 
        i.createdAt >= filters.dateRange!.start && 
        i.createdAt <= filters.dateRange!.end
      );
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getStats(): IssueStats {
    const stats: IssueStats = {
      total: this.issues.length,
      open: 0,
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      byReason: {} as Record<IssueReason, number>,
      byShop: {},
    };

    this.issues.forEach(issue => {
      stats[issue.state]++;
      stats.byReason[issue.reason] = (stats.byReason[issue.reason] || 0) + 1;
      stats.byShop[issue.shopDomain] = (stats.byShop[issue.shopDomain] || 0) + 1;
    });

    return stats;
  }

  assignIssue(issueId: string, assigneeId: string, assigneeName: string): Issue | null {
    return this.updateIssue(issueId, {
      assigneeId,
      assigneeName,
      state: 'assigned',
    });
  }

  startWork(issueId: string): Issue | null {
    return this.updateIssue(issueId, { state: 'in_progress' });
  }

  resolveIssue(issueId: string, resolution: string): Issue | null {
    return this.updateIssue(issueId, {
      state: 'resolved',
      resolution,
    });
  }

  closeIssue(issueId: string): Issue | null {
    return this.updateIssue(issueId, { state: 'closed' });
  }

  deleteIssue(id: string): boolean {
    const index = this.issues.findIndex(i => i.id === id);
    if (index === -1) return false;

    this.issues.splice(index, 1);
    this.saveIssues();
    this.notifyListeners();
    return true;
  }

  // Bulk operations
  bulkAssign(issueIds: string[], assigneeId: string, assigneeName: string): void {
    issueIds.forEach(id => {
      this.assignIssue(id, assigneeId, assigneeName);
    });
  }

  bulkResolve(issueIds: string[], resolution: string): void {
    issueIds.forEach(id => {
      this.resolveIssue(id, resolution);
    });
  }

  // Export functionality
  exportIssues(format: 'csv' | 'json' = 'json'): string {
    if (format === 'csv') {
      const headers = ['ID', 'Order', 'Reason', 'State', 'Assignee', 'Created', 'Updated'];
      const rows = this.issues.map(issue => [
        issue.id,
        issue.orderName,
        issue.reason,
        issue.state,
        issue.assigneeName || 'Unassigned',
        issue.createdAt.toISOString(),
        issue.updatedAt.toISOString(),
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    } else {
      return JSON.stringify(this.issues, null, 2);
    }
  }
}

// Singleton instance
export const exceptionsManager = new ExceptionsManager();
