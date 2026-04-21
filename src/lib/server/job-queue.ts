/**
 * Sequential in-process job queue.
 * Prevents concurrent Gemini API calls that would hit rate limits.
 */

import { runSearchJob } from './jobs';

class JobQueue {
	private queue: string[] = [];
	private running = false;
	private currentJobId: string | null = null;

	enqueue(jobId: string): void {
		this.queue.push(jobId);
		console.log(`[queue] Job ${jobId} enqueued. Queue length: ${this.queue.length}`);
		this.processNext();
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
