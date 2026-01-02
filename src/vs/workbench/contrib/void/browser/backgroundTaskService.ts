/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { generateUuid } from '../../../../base/common/uuid.js';

// ============== Types ==============

export type BackgroundTaskType = 'fix' | 'dev' | 'refactor' | 'test' | 'install';

export type BackgroundTaskStatus =
	| 'idle'
	| 'pending'    // Task created, waiting to execute
	| 'running'    // Currently executing
	| 'complete'   // Finished successfully
	| 'failed';    // Failed

export interface BackgroundTask {
	id: string;
	type: BackgroundTaskType;
	threadId: string;        // Background thread ID
	parentThreadId: string;  // Main teaching thread ID
	status: BackgroundTaskStatus;
	description: string;     // Task description
	context: string;         // Error context or task details
	trigger: 'auto' | 'manual';
	createdAt: number;
	completedAt?: number;
	result?: TaskResult;
}

export interface TaskResult {
	success: boolean;
	summary: string;
	// Fix type specific
	wasOwnFault?: boolean;   // Was it AI's own previous code issue
	bugCause?: string;
	// General
	relatedKnowledge?: string[];  // Knowledge points for teaching
}

// Status text mapping for UI display
export const BackgroundTaskStatusText: Record<BackgroundTaskType, string> = {
	fix: '🔧 后台修复中...',
	dev: '🛠️ 后台开发中...',
	refactor: '♻️ 后台重构中...',
	test: '🧪 后台测试中...',
	install: '📦 后台安装中...',
};

// ============== Service Interface ==============

export interface IBackgroundTaskService {
	readonly _serviceBrand: undefined;

	/** Current active background task */
	readonly currentTask: BackgroundTask | null;

	/** All background thread IDs */
	readonly backgroundThreadIds: Set<string>;

	// Events
	readonly onDidChangeTask: Event<BackgroundTask | null>;

	/**
	 * Start a new background task
	 * @returns Task ID
	 */
	startTask(params: {
		type: BackgroundTaskType;
		trigger: 'auto' | 'manual';
		description: string;
		context: string;
		parentThreadId: string;
	}): string;

	/**
	 * Check if a thread is a background thread
	 */
	isBackgroundThread(threadId: string): boolean;

	/**
	 * Update task status
	 */
	updateTaskStatus(taskId: string, status: BackgroundTaskStatus, result?: TaskResult): void;

	/**
	 * Get task by ID
	 */
	getTask(taskId: string): BackgroundTask | null;

	/**
	 * Get current task result
	 */
	getCurrentTaskResult(): TaskResult | null;

	/**
	 * Clear completed task (after UI has shown completion)
	 */
	clearCompletedTask(): void;

	/**
	 * Get status text for current task
	 */
	getStatusText(): string | null;
}

export const IBackgroundTaskService = createDecorator<IBackgroundTaskService>('BackgroundTaskService');

// ============== Service Implementation ==============

class BackgroundTaskService extends Disposable implements IBackgroundTaskService {
	readonly _serviceBrand: undefined;

	private _currentTask: BackgroundTask | null = null;
	private _tasks: Map<string, BackgroundTask> = new Map();
	private _backgroundThreadIds: Set<string> = new Set();

	// Events
	private readonly _onDidChangeTask = this._register(new Emitter<BackgroundTask | null>());
	readonly onDidChangeTask = this._onDidChangeTask.event;

	constructor() {
		super();
	}

	// ============== Getters ==============

	get currentTask(): BackgroundTask | null {
		return this._currentTask;
	}

	get backgroundThreadIds(): Set<string> {
		return this._backgroundThreadIds;
	}

	// ============== Task Management ==============

	startTask(params: {
		type: BackgroundTaskType;
		trigger: 'auto' | 'manual';
		description: string;
		context: string;
		parentThreadId: string;
	}): string {
		const taskId = generateUuid();
		const threadId = `bg-${taskId}`;

		const task: BackgroundTask = {
			id: taskId,
			type: params.type,
			threadId,
			parentThreadId: params.parentThreadId,
			status: 'pending',
			description: params.description,
			context: params.context,
			trigger: params.trigger,
			createdAt: Date.now(),
		};

		this._tasks.set(taskId, task);
		this._backgroundThreadIds.add(threadId);
		this._currentTask = task;

		this._onDidChangeTask.fire(task);

		return taskId;
	}

	isBackgroundThread(threadId: string): boolean {
		return this._backgroundThreadIds.has(threadId);
	}

	updateTaskStatus(taskId: string, status: BackgroundTaskStatus, result?: TaskResult): void {
		const task = this._tasks.get(taskId);
		if (!task) return;

		task.status = status;
		if (result) {
			task.result = result;
		}
		if (status === 'complete' || status === 'failed') {
			task.completedAt = Date.now();
		}

		this._tasks.set(taskId, task);

		if (this._currentTask?.id === taskId) {
			this._currentTask = task;
		}

		this._onDidChangeTask.fire(task);
	}

	getTask(taskId: string): BackgroundTask | null {
		return this._tasks.get(taskId) || null;
	}

	getCurrentTaskResult(): TaskResult | null {
		return this._currentTask?.result || null;
	}

	clearCompletedTask(): void {
		if (this._currentTask && (this._currentTask.status === 'complete' || this._currentTask.status === 'failed')) {
			// Remove from background thread set
			this._backgroundThreadIds.delete(this._currentTask.threadId);
			this._currentTask = null;
			this._onDidChangeTask.fire(null);
		}
	}

	getStatusText(): string | null {
		if (!this._currentTask) return null;

		if (this._currentTask.status === 'complete') {
			return '✅ 任务完成';
		}

		if (this._currentTask.status === 'failed') {
			return '❌ 任务失败';
		}

		return BackgroundTaskStatusText[this._currentTask.type] || '⏳ 后台处理中...';
	}
}

// Register the service
registerSingleton(IBackgroundTaskService, BackgroundTaskService, InstantiationType.Eager);

