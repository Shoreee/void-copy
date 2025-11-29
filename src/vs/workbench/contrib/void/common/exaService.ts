/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Exa API service - browser side, communicates with ExaChannel in main process

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import {
	ExaSearchResult, ExaContentResult, ExaCitation, ExaFinding,
	ExaSearchResponse, ExaGetContentsResponse, ExaFindSimilarResponse,
	ExaAnswerResponse, ExaResearchResponse,
} from './exaServiceTypes.js';

export const IExaService = createDecorator<IExaService>('exaService');

export interface IExaService {
	readonly _serviceBrand: undefined;
	search(query: string, numResults?: number): Promise<{ results: ExaSearchResult[] }>;
	getContents(urls: string[]): Promise<{ contents: ExaContentResult[] }>;
	findSimilar(url: string, numResults?: number): Promise<{ results: ExaSearchResult[] }>;
	answer(question: string): Promise<{ answer: string; citations: ExaCitation[] }>;
	research(query: string): Promise<{ summary: string; findings: ExaFinding[] }>;
}

export class ExaService extends Disposable implements IExaService {
	readonly _serviceBrand: undefined;
	private readonly channel: IChannel;

	private readonly hooks = {
		search: {} as { [requestId: string]: { resolve: (r: any) => void; reject: (e: Error) => void } },
		getContents: {} as { [requestId: string]: { resolve: (r: any) => void; reject: (e: Error) => void } },
		findSimilar: {} as { [requestId: string]: { resolve: (r: any) => void; reject: (e: Error) => void } },
		answer: {} as { [requestId: string]: { resolve: (r: any) => void; reject: (e: Error) => void } },
		research: {} as { [requestId: string]: { resolve: (r: any) => void; reject: (e: Error) => void } },
	};

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
	) {
		super();
		this.channel = this.mainProcessService.getChannel('void-channel-exa');

		// Set up listeners
		this._register((this.channel.listen('onSearch') satisfies Event<ExaSearchResponse>)(e => {
			const hook = this.hooks.search[e.requestId];
			if (hook) {
				if (e.error) hook.reject(new Error(e.error));
				else hook.resolve({ results: e.results || [] });
				delete this.hooks.search[e.requestId];
			}
		}));

		this._register((this.channel.listen('onGetContents') satisfies Event<ExaGetContentsResponse>)(e => {
			const hook = this.hooks.getContents[e.requestId];
			if (hook) {
				if (e.error) hook.reject(new Error(e.error));
				else hook.resolve({ contents: e.contents || [] });
				delete this.hooks.getContents[e.requestId];
			}
		}));

		this._register((this.channel.listen('onFindSimilar') satisfies Event<ExaFindSimilarResponse>)(e => {
			const hook = this.hooks.findSimilar[e.requestId];
			if (hook) {
				if (e.error) hook.reject(new Error(e.error));
				else hook.resolve({ results: e.results || [] });
				delete this.hooks.findSimilar[e.requestId];
			}
		}));

		this._register((this.channel.listen('onAnswer') satisfies Event<ExaAnswerResponse>)(e => {
			const hook = this.hooks.answer[e.requestId];
			if (hook) {
				if (e.error) hook.reject(new Error(e.error));
				else hook.resolve({ answer: e.answer || '', citations: e.citations || [] });
				delete this.hooks.answer[e.requestId];
			}
		}));

		this._register((this.channel.listen('onResearch') satisfies Event<ExaResearchResponse>)(e => {
			const hook = this.hooks.research[e.requestId];
			if (hook) {
				if (e.error) hook.reject(new Error(e.error));
				else hook.resolve({ summary: e.summary || '', findings: e.findings || [] });
				delete this.hooks.research[e.requestId];
			}
		}));
	}

	private getExaApiKey(): string {
		const key = this.voidSettingsService.state.globalSettings.exaApiKey;
		if (!key) {
			throw new Error('Exa API Key not configured. Please set it in Settings > Feature Options > Web Search.');
		}
		return key;
	}

	async search(query: string, numResults: number = 5): Promise<{ results: ExaSearchResult[] }> {
		const requestId = generateUuid();
		const exaApiKey = this.getExaApiKey();

		return new Promise((resolve, reject) => {
			this.hooks.search[requestId] = { resolve, reject };
			this.channel.call('search', { requestId, exaApiKey, query, numResults });
		});
	}

	async getContents(urls: string[]): Promise<{ contents: ExaContentResult[] }> {
		const requestId = generateUuid();
		const exaApiKey = this.getExaApiKey();

		return new Promise((resolve, reject) => {
			this.hooks.getContents[requestId] = { resolve, reject };
			this.channel.call('getContents', { requestId, exaApiKey, urls });
		});
	}

	async findSimilar(url: string, numResults: number = 5): Promise<{ results: ExaSearchResult[] }> {
		const requestId = generateUuid();
		const exaApiKey = this.getExaApiKey();

		return new Promise((resolve, reject) => {
			this.hooks.findSimilar[requestId] = { resolve, reject };
			this.channel.call('findSimilar', { requestId, exaApiKey, url, numResults });
		});
	}

	async answer(question: string): Promise<{ answer: string; citations: ExaCitation[] }> {
		const requestId = generateUuid();
		const exaApiKey = this.getExaApiKey();

		return new Promise((resolve, reject) => {
			this.hooks.answer[requestId] = { resolve, reject };
			this.channel.call('answer', { requestId, exaApiKey, question });
		});
	}

	async research(query: string): Promise<{ summary: string; findings: ExaFinding[] }> {
		const requestId = generateUuid();
		const exaApiKey = this.getExaApiKey();

		return new Promise((resolve, reject) => {
			this.hooks.research[requestId] = { resolve, reject };
			this.channel.call('research', { requestId, exaApiKey, query });
		});
	}
}

registerSingleton(IExaService, ExaService, InstantiationType.Eager);


