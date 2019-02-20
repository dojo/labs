import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { ResourceConfig, RestResource, RestManyResourceOperations, ResourceResponseStatus } from './interfaces';
import { Constructor } from '@dojo/framework/widget-core/interfaces';
import { createResourceProvider, ResourceProviderProperties } from './ResourceProvider';

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

export function createRestResourceProvider<S>(
	config: RestResource<S>
): Constructor<WidgetBase<ResourceProviderProperties<S>>> {
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

	const resourceConfig: ResourceConfig<S> = {
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

	return createResourceProvider<S>(resourceConfig);
}
