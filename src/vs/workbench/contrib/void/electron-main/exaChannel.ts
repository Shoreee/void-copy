/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Exa API channel - runs in main process (no CORS restrictions)
// registered in app.ts

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import {
	ExaSearchParams, ExaSearchResponse,
	ExaGetContentsParams, ExaGetContentsResponse,
	ExaFindSimilarParams, ExaFindSimilarResponse,
	ExaAnswerParams, ExaAnswerResponse,
	ExaResearchParams, ExaResearchResponse,
} from '../common/exaServiceTypes.js';

export class ExaChannel implements IServerChannel {

	private readonly emitters = {
		search: new Emitter<ExaSearchResponse>(),
		getContents: new Emitter<ExaGetContentsResponse>(),
		findSimilar: new Emitter<ExaFindSimilarResponse>(),
		answer: new Emitter<ExaAnswerResponse>(),
		research: new Emitter<ExaResearchResponse>(),
	}

	constructor() { }

	// browser uses this to listen for responses
	listen(_: unknown, event: string): Event<any> {
		if (event === 'onSearch') return this.emitters.search.event;
		if (event === 'onGetContents') return this.emitters.getContents.event;
		if (event === 'onFindSimilar') return this.emitters.findSimilar.event;
		if (event === 'onAnswer') return this.emitters.answer.event;
		if (event === 'onResearch') return this.emitters.research.event;
		throw new Error(`ExaChannel: Event not found: ${event}`);
	}

	// browser uses this to call
	async call(_: unknown, command: string, params: any): Promise<any> {
		try {
			if (command === 'search') {
				await this._callSearch(params);
			} else if (command === 'getContents') {
				await this._callGetContents(params);
			} else if (command === 'findSimilar') {
				await this._callFindSimilar(params);
			} else if (command === 'answer') {
				await this._callAnswer(params);
			} else if (command === 'research') {
				await this._callResearch(params);
			} else {
				throw new Error(`ExaChannel: command "${command}" not recognized.`);
			}
		} catch (e) {
			console.error('ExaChannel: Call Error:', e);
		}
	}

	private async _callSearch(params: ExaSearchParams) {
		const { requestId, exaApiKey, query, numResults } = params;

		try {
			const response = await fetch('https://api.exa.ai/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': exaApiKey
				},
				body: JSON.stringify({
					query,
					numResults: numResults ?? 5,
					contents: { text: { maxCharacters: 1000 } }
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.emitters.search.fire({ requestId, error: `Exa API error: ${response.status} - ${errorText}` });
				return;
			}

			const data = await response.json();
			const results = (data.results || []).map((r: any) => ({
				title: r.title || '',
				url: r.url || '',
				publishedDate: r.publishedDate,
				author: r.author,
				text: r.text,
				summary: r.summary
			}));

			this.emitters.search.fire({ requestId, results });
		} catch (e: any) {
			this.emitters.search.fire({ requestId, error: e.message || String(e) });
		}
	}

	private async _callGetContents(params: ExaGetContentsParams) {
		const { requestId, exaApiKey, urls } = params;

		try {
			const response = await fetch('https://api.exa.ai/contents', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': exaApiKey
				},
				body: JSON.stringify({
					urls,
					text: { maxCharacters: 5000 }
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.emitters.getContents.fire({ requestId, error: `Exa API error: ${response.status} - ${errorText}` });
				return;
			}

			const data = await response.json();
			const contents = (data.results || []).map((r: any) => ({
				url: r.url || '',
				text: r.text || ''
			}));

			this.emitters.getContents.fire({ requestId, contents });
		} catch (e: any) {
			this.emitters.getContents.fire({ requestId, error: e.message || String(e) });
		}
	}

	private async _callFindSimilar(params: ExaFindSimilarParams) {
		const { requestId, exaApiKey, url, numResults } = params;

		try {
			const response = await fetch('https://api.exa.ai/findSimilar', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': exaApiKey
				},
				body: JSON.stringify({
					url,
					numResults: numResults ?? 5,
					contents: { text: { maxCharacters: 1000 } }
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.emitters.findSimilar.fire({ requestId, error: `Exa API error: ${response.status} - ${errorText}` });
				return;
			}

			const data = await response.json();
			const results = (data.results || []).map((r: any) => ({
				title: r.title || '',
				url: r.url || '',
				publishedDate: r.publishedDate,
				author: r.author,
				text: r.text,
				summary: r.summary
			}));

			this.emitters.findSimilar.fire({ requestId, results });
		} catch (e: any) {
			this.emitters.findSimilar.fire({ requestId, error: e.message || String(e) });
		}
	}

	private async _callAnswer(params: ExaAnswerParams) {
		const { requestId, exaApiKey, question } = params;

		try {
			const response = await fetch('https://api.exa.ai/answer', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': exaApiKey
				},
				body: JSON.stringify({
					query: question
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.emitters.answer.fire({ requestId, error: `Exa API error: ${response.status} - ${errorText}` });
				return;
			}

			const data = await response.json();
			this.emitters.answer.fire({
				requestId,
				answer: data.answer || '',
				citations: (data.citations || []).map((c: any) => ({
					title: c.title || '',
					url: c.url || ''
				}))
			});
		} catch (e: any) {
			this.emitters.answer.fire({ requestId, error: e.message || String(e) });
		}
	}

	private async _callResearch(params: ExaResearchParams) {
		const { requestId, exaApiKey, query } = params;

		try {
			const response = await fetch('https://api.exa.ai/research', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': exaApiKey
				},
				body: JSON.stringify({
					query
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				this.emitters.research.fire({ requestId, error: `Exa API error: ${response.status} - ${errorText}` });
				return;
			}

			const data = await response.json();
			this.emitters.research.fire({
				requestId,
				summary: data.summary || '',
				findings: (data.findings || []).map((f: any) => ({
					title: f.title || '',
					content: f.content || '',
					sources: f.sources || []
				}))
			});
		} catch (e: any) {
			this.emitters.research.fire({ requestId, error: e.message || String(e) });
		}
	}
}


