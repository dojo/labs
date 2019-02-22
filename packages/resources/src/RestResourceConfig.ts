import fetch from '@dojo/framework/shim/fetch';
import {
	ResourceConfig,
	ResourceResponseStatus
} from './ResourceProvider';

export interface RestResourceUrlOptions {
	origin: string;
	name: string;
	id?: string;
}

export interface RestResourceUrlFunction {
	(options: RestResourceUrlOptions): string;
}

export interface RestResourceOperationsConfig {
	optimistic: boolean;
	verb: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
	url: RestResourceUrlFunction;
}

export interface RestManyResourceOperations {
	read: false | RestResourceOperationsConfig;
}

export interface RestResource<S> {
	origin: string;
	name: string;
	idKey?: string;
	template?(resource: Partial<S>): S;
	many?: Partial<RestManyResourceOperations>;
}

const DEFAULT_REST_CONFIG: {
	many: RestManyResourceOperations;
} = {
	many: {
		read: {
			optimistic: true,
			verb: 'GET',
			url: ({ origin, name }) => `${origin}/${name}`
		}
	}
};

export function restResourceConfig<S>(config: RestResource<S>): ResourceConfig<S> {
	let {
		idKey = 'id',
		name,
		origin,
		template = (item: S) => {
			return item;
		},
		many = DEFAULT_REST_CONFIG.many
	} = config;

	many = { ...DEFAULT_REST_CONFIG.many, ...many };

	return {
		idKey,
		template,
		async read() {
			if (!many.read) {
				throw new Error(`ReadMany Resource Operation not supported for ${name}`);
			}
			try {
				const { url, verb } = many.read;
				const path = url({ origin, name });
				const response = await fetch(path, {
					method: verb,
					headers: {
						'Content-Type': 'application/json'
					}
				});
				if (!response.ok) {
					return { data: [], status: ResourceResponseStatus.failed };
				}
				const json = await response.json();
				return { data: json, status: ResourceResponseStatus.success };
			} catch (e) {
				return { data: [], status: ResourceResponseStatus.failed };
			}
		}
	};
}
