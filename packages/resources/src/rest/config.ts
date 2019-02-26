import fetch from '@dojo/framework/shim/fetch';
import { ResourceConfig, PaginationOptions } from './../provider';

export interface RestResourceUrlOptions {
	origin: string;
	name: string;
	id?: string;
	pagination?: PaginationOptions;
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
			url: ({ origin, name, pagination }) => {
				let path = `${origin}/${name}`;
				if (pagination) {
					return `${path}?offset=${pagination.offset}&size=${pagination.size}`;
				}
				return path;
			}
		}
	}
};

export function config<S>(config: RestResource<S>): ResourceConfig<S> {
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
		async read(pagination?: PaginationOptions) {
			if (!many.read) {
				throw new Error(`ReadMany Resource Operation not supported for ${name}`);
			}
			try {
				const { url, verb } = many.read;
				const path = url({ origin, name, pagination });
				const response = await fetch(path, {
					method: verb,
					headers: {
						'Content-Type': 'application/json'
					}
				});
				if (!response.ok) {
					return { data: [], total: 0, success: false };
				}
				const json = await response.json();
				return { data: json, total: json.length, success: true };
			} catch (e) {
				return { data: [], total: 0, success: false };
			}
		}
	};
}

export default config;
