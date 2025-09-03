import React, { useState } from 'react';
import { useJobQueue } from '../hooks/useJobQueue';
import { Job } from '../lib/jobQueue';

export const JobQueueView: React.FC = () => {
  const { jobs, stats, retryJob, clearDeadJobs } = useJobQueue();
  const [selectedStatus, setSelectedStatus] = useState<Job['status'] | 'all'>('all');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const filteredJobs = selectedStatus === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === selectedStatus);

  const handleRetry = async (jobId: string) => {
    const success = await retryJob(jobId);
    if (success) {
      console.log(`Job ${jobId} queued for retry`);
    } else {
      console.error(`Failed to retry job ${jobId}`);
    }
  };

  const handleClearDeadJobs = async () => {
    const cleared = await clearDeadJobs();
    console.log(`Cleared ${cleared} dead jobs`);
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'succeeded': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'dead': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end.getTime() - start.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Job Queue Status</h2>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-500">Total</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-500">Queued</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.queued}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-500">Running</div>
            <div className="text-2xl font-bold text-blue-600">{stats.running}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-500">Succeeded</div>
            <div className="text-2xl font-bold text-green-600">{stats.succeeded}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-500">Failed</div>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm font-medium text-gray-500">Dead</div>
            <div className="text-2xl font-bold text-gray-600">{stats.dead}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as Job['status'] | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="running">Running</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="dead">Dead</option>
          </select>

          {stats.dead > 0 && (
            <button
              onClick={handleClearDeadJobs}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Clear Dead Jobs ({stats.dead})
            </button>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Jobs ({filteredJobs.length})
          </h3>
        </div>
        
        {filteredJobs.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No jobs found with the selected status.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredJobs.map((job) => (
              <div key={job.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {job.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-sm text-gray-500">
                        Attempts: {job.attempts}/{job.maxAttempts}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">ID:</span> {job.id}
                      {job.correlationId && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="font-medium">Correlation:</span> {job.correlationId}
                        </>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Created:</span> {formatDate(job.createdAt)}
                      {job.status !== 'queued' && (
                        <>
                          <span className="mx-2">•</span>
                          <span className="font-medium">Updated:</span> {formatDate(job.updatedAt)}
                        </>
                      )}
                    </div>

                    {job.status === 'succeeded' && job.result && (
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Result:</span> {JSON.stringify(job.result)}
                      </div>
                    )}

                    {job.error && (
                      <div className="text-sm text-red-600 mb-2">
                        <span className="font-medium">Error:</span> {job.error}
                      </div>
                    )}

                    {job.status === 'failed' && job.nextRunAt && (
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Next Retry:</span> {formatDate(job.nextRunAt)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Retry
                      </button>
                    )}
                    
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      {expandedJob === job.id ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedJob === job.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Payload</h4>
                        <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-32">
                          {JSON.stringify(job.payload, null, 2)}
                        </pre>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Metadata</h4>
                        <dl className="text-sm">
                          <dt className="font-medium text-gray-600">Idempotency Key:</dt>
                          <dd className="text-gray-900 mb-2 font-mono">{job.idempotencyKey}</dd>
                          
                          <dt className="font-medium text-gray-600">Created:</dt>
                          <dd className="text-gray-900 mb-2">{formatDate(job.createdAt)}</dd>
                          
                          <dt className="font-medium text-gray-600">Updated:</dt>
                          <dd className="text-gray-900 mb-2">{formatDate(job.updatedAt)}</dd>
                          
                          {job.status !== 'queued' && (
                            <>
                              <dt className="font-medium text-gray-600">Duration:</dt>
                              <dd className="text-gray-900">{formatDuration(job.createdAt, job.updatedAt)}</dd>
                            </>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
