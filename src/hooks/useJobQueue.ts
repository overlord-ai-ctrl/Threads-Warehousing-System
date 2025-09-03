import { useState, useEffect, useCallback } from 'react';
import { jobQueue, Job, JobStats } from '../lib/jobQueue';

export const useJobQueue = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats>({
    total: 0,
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
  });

  // Refresh jobs and stats
  const refresh = useCallback(() => {
    const allJobs = jobQueue.getJobs();
    const currentStats = jobQueue.getStats();
    
    setJobs(allJobs);
    setStats(currentStats);
  }, []);

  // Add a new job
  const addJob = useCallback(async (
    type: Job['type'],
    payload: Record<string, any>,
    idempotencyKey: string,
    correlationId?: string
  ): Promise<string> => {
    const jobId = await jobQueue.addJob(type, payload, idempotencyKey, correlationId);
    refresh();
    return jobId;
  }, [refresh]);

  // Retry a failed job
  const retryJob = useCallback(async (jobId: string): Promise<boolean> => {
    const success = await jobQueue.retryJob(jobId);
    if (success) {
      refresh();
    }
    return success;
  }, [refresh]);

  // Clear dead jobs
  const clearDeadJobs = useCallback(async (): Promise<number> => {
    const cleared = await jobQueue.clearDeadJobs();
    refresh();
    return cleared;
  }, [refresh]);

  // Get jobs by status
  const getJobsByStatus = useCallback((status: Job['status']): Job[] => {
    return jobQueue.getJobs(status);
  }, []);

  // Get job by ID
  const getJobById = useCallback((jobId: string): Job | undefined => {
    return jobQueue.getJobHistory(jobId);
  }, []);

  // Set up periodic refresh
  useEffect(() => {
    refresh(); // Initial load
    
    const interval = setInterval(refresh, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [refresh]);

  return {
    jobs,
    stats,
    addJob,
    retryJob,
    clearDeadJobs,
    getJobsByStatus,
    getJobById,
    refresh,
  };
};
