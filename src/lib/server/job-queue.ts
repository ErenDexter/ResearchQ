/**
 * Sequential in-process job queue.
 * Prevents concurrent Gemini API calls that would hit rate limits.
 *
 * The queue lives in memory, so `recoverInterruptedJobs()` runs at server
 * start to reconcile jobs that were queued or running when the process died.
 */

import { asc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { searchJobs } from './db/schema';
import { runSearchJob } from './jobs';

/** Job statuses that mean "finished"; anything else is waiting or running. */
export const TERMINAL_JOB_STATUSES = ['completed', 'failed'] as const;

const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'searching', 'filtering', 'extracting'];

class JobQueue {
	private queue: string[] = [];
	private running = false;
	private currentJobId: string | null = null;

	enqueue(jobId: string): void {
		if (this.has(jobId)) return;
		this.queue.push(jobId);
		console.log(`[queue] Job ${jobId} enqueued. Queue length: ${this.queue.length}`);
		this.processNext();
	}

	/** True if the job is waiting in the queue or currently running. */
	has(jobId: string): boolean {
		return this.currentJobId === jobId || this.queue.includes(jobId);
	}

	private async processNext(): Promise<void> {
		if (this.running || this.queue.length === 0) return;

		this.running = true;
		this.currentJobId = this.queue.shift()!;

		console.log(`[queue] Starting job ${this.currentJobId}`);

		try {
			await runSearchJob(this.currentJobId);
		} catch (err) {
			console.error(`[queue] Job ${this.currentJobId} failed:`, err);
		} finally {
			this.currentJobId = null;
			this.running = false;
			// Process next job in queue
			this.processNext();
		}
	}

	getStatus(): { queueLength: number; currentJobId: string | null; pendingJobIds: string[] } {
		return {
			queueLength: this.queue.length,
			currentJobId: this.currentJobId,
			pendingJobIds: [...this.queue]
		};
	}

	cancel(jobId: string): boolean {
		const idx = this.queue.indexOf(jobId);
		if (idx >= 0) {
			this.queue.splice(idx, 1);
			console.log(`[queue] Job ${jobId} cancelled from queue`);
			return true;
		}
		return false;
	}
}

export const jobQueue = new JobQueue();

export const INTERRUPTED_JOB_MESSAGE =
	'Interrupted by a server restart. Retry to resume from the last checkpoint.';

/**
 * Reconciles jobs left behind by a previous process: jobs that never started
 * are queued again; jobs that were mid-run are marked failed so they can be
 * retried (and resume from their last completed phase).
 */
export async function recoverInterruptedJobs(): Promise<void> {
	const stale = await db
		.select({ id: searchJobs.id, status: searchJobs.status })
		.from(searchJobs)
		.where(inArray(searchJobs.status, ACTIVE_JOB_STATUSES))
		.orderBy(asc(searchJobs.createdAt));

	for (const job of stale) {
		if (jobQueue.has(job.id)) continue;
		if (job.status === 'pending' || job.status === 'queued') {
			jobQueue.enqueue(job.id);
		} else {
			await db
				.update(searchJobs)
				.set({
					status: 'failed',
					error: INTERRUPTED_JOB_MESSAGE,
					statusMessage: INTERRUPTED_JOB_MESSAGE,
					completedAt: new Date().toISOString()
				})
				.where(eq(searchJobs.id, job.id));
		}
	}

	if (stale.length > 0) console.log(`[queue] Recovered ${stale.length} interrupted job(s)`);
}
