// Types for Exa API service

export type ExaSearchResult = {
	title: string;
	url: string;
	publishedDate?: string;
	author?: string;
	text?: string;
	summary?: string;
}

export type ExaContentResult = {
	url: string;
	text: string;
}

export type ExaCitation = {
	title: string;
	url: string;
}

export type ExaFinding = {
	title: string;
	content: string;
	sources: string[];
}

// Request params (sent from browser to main)
export type ExaSearchParams = {
	requestId: string;
	exaApiKey: string;
	query: string;
	numResults: number;
}

export type ExaGetContentsParams = {
	requestId: string;
	exaApiKey: string;
	urls: string[];
}

export type ExaFindSimilarParams = {
	requestId: string;
	exaApiKey: string;
	url: string;
	numResults: number;
}

export type ExaAnswerParams = {
	requestId: string;
	exaApiKey: string;
	question: string;
}

export type ExaResearchParams = {
	requestId: string;
	exaApiKey: string;
	query: string;
}

// Response types (sent from main to browser)
export type ExaSearchResponse = {
	requestId: string;
	results?: ExaSearchResult[];
	error?: string;
}

export type ExaGetContentsResponse = {
	requestId: string;
	contents?: ExaContentResult[];
	error?: string;
}

export type ExaFindSimilarResponse = {
	requestId: string;
	results?: ExaSearchResult[];
	error?: string;
}

export type ExaAnswerResponse = {
	requestId: string;
	answer?: string;
	citations?: ExaCitation[];
	error?: string;
}

export type ExaResearchResponse = {
	requestId: string;
	summary?: string;
	findings?: ExaFinding[];
	error?: string;
}


