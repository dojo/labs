import { createMiddlewareFactory } from '../tsx';
import Map from '@dojo/framework/shim/Map';
import { destroy } from './base';

const createFactory = createMiddlewareFactory();

export const cache = createFactory({ destroy }, ({ middleware }) => {
	const cacheMap = new Map<string, any>();
	middleware.destroy(() => {
		cacheMap.clear();
	});
	return {
		get<T>(key: string): T | null {
			return cacheMap.get(key);
		},
		set<T>(key: string, value: T): void {
			cacheMap.set(key, value);
		}
	};
});

export default cache;
