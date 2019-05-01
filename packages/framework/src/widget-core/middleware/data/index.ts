import has from '@dojo/framework/has/has';
import { createMiddlewareFactory } from '../../tsx';
import { invalidator } from '../base';
import Store, { Path } from '@dojo/framework/stores/Store';
import Map from '@dojo/framework/shim/Map';
import { ResourceState } from './interfaces';
import { uuid } from '@dojo/framework/core/util';
import { createProcess, createProcessFactoryWith } from '@dojo/framework/stores/process';
import {
	failedResource,
	initializeResource,
	beforeReadMany,
	readMany,
	prevPage,
	nextPage,
	gotoPage,
	invalidatePagination,
	PaginationPayload
} from './commands';
import { Handle } from '@dojo/framework/core/Destroyable';

export type Status = 'failed' | 'loading' | 'completed';
export type Action = 'read';
export type ActionType = 'many';

export interface GetOrReadOptions {
	pagination?: {
		start: number;
		size: number;
	};
	options?: any;
}

export interface StatusOptions {
	action?: Action;
	type?: ActionType;
}

export interface Resource<S> {
	isLoading(options?: StatusOptions): boolean;
	isFailed(options?: StatusOptions): boolean;
	getOrRead(options?: GetOrReadOptions): undefined | S[];
	page: {
		next(): void;
		previous(): void;
		goto(page: number): void;
		total(): undefined | number;
		current(): undefined | number;
	};
}

export interface IsLoadingOptions {
	action?: Action;
	global?: boolean;
}

export interface ManyResourceResponse<S = any> {
	data: S[];
	total?: number;
	success: boolean;
}

export interface ReadPaginationOptions {
	offset: number;
	size: number;
}

export interface ResourceRead<S> {
	(options: any, pagination?: ReadPaginationOptions): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
	(options: any, pagination: ReadPaginationOptions): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
}

export interface ResourceConfig<S> {
	idKey?: string;
	template(resource: Partial<S>): S;
	read: ResourceRead<S>;
}

const createFactory = createMiddlewareFactory();

export function createDataMiddleware<S>(config: ResourceConfig<S>) {
	const store = new Store<ResourceState<S>>();
	const pathPrefix = uuid();
	const { idKey = 'id' } = config;
	const storeHandles = new Map<string, Handle>();
	const failedResourceProcess = createProcess(`${pathPrefix}-failed-resource`, [failedResource]);
	const initializeResourceProcess = createProcess(`${pathPrefix}-init`, [initializeResource]);
	const createProcessWithError = createProcessFactoryWith([
		() => ({
			after: (error, result) => {
				if (error) {
					console.log('error has occurred!');
					const { action, type, pathPrefix, initiator } = result.payload;
					result.store.apply(result.undoOperations, true);
					result.executor(failedResourceProcess, {
						action,
						type,
						pathPrefix,
						initiator
					});
				}
			}
		})
	]);
	const readManyProcess = createProcessWithError(`${pathPrefix}-read-many`, [beforeReadMany, readMany]);
	const prevPageProcess = createProcessWithError(`${pathPrefix}-prev-page`, [prevPage]);
	const nextPageProcess = createProcessWithError(`${pathPrefix}-next-page`, [nextPage]);
	const gotoPageProcess = createProcessWithError(`${pathPrefix}-goto-page`, [gotoPage]);
	const invalidatePaginationProcess = createProcessWithError(`${pathPrefix}-invalidate-pagination`, [
		invalidatePagination
	]);

	const _readManyProcess = readManyProcess(store);
	const _nextPageProcess = nextPageProcess(store);
	const _prevPageProcess = prevPageProcess(store);
	const _gotoPageProcess = gotoPageProcess(store);
	const _invalidationPaginationProcess = invalidatePaginationProcess(store);
	initializeResourceProcess(store)({ pathPrefix });

	return createFactory({ invalidator }, ({ id, middleware }) => {
		function getStatus(options: StatusOptions = {}, statusType: string) {
			const { action, type } = options;
			const meta = store.get(store.path(pathPrefix, 'meta')) as any;
			let result = false;
			if (action && type) {
				result = result || meta.actions[action][type][statusType].indexOf(id) !== -1;
			} else if (action) {
				result = result || meta.actions[action].many[statusType].indexOf(id) !== -1;
			} else {
				result = result || meta.actions.read.many[statusType].indexOf(id) !== -1;
			}

			return result;
		}

		function isLoading(options: StatusOptions): boolean {
			return getStatus(options, 'loading');
		}

		function isCompleted(options: StatusOptions): boolean {
			return getStatus(options, 'completed');
		}

		function isFailed(options: StatusOptions): boolean {
			return getStatus(options, 'failed');
		}

		function total() {
			const pagination = store.get(store.path(pathPrefix, 'meta', 'pagination', 'current', id));
			if (pagination) {
				return Math.ceil(pagination.total / pagination.size);
			}
			return undefined;
		}

		function current() {
			const pagination = store.get(store.path(pathPrefix, 'meta', 'pagination', 'current', id));
			if (pagination) {
				return Math.ceil(pagination.offset / pagination.size) + 1;
			}
			return undefined;
		}

		function subscribeToStore<U>(paths: Path<ResourceState<S>, U>) {
			const existing = storeHandles.get(`${id}-${paths.path}`);
			if (!existing) {
				const storeHandle = store.onChange(paths, () => {
					const invalidate = middleware.invalidator();
					invalidate && invalidate();
				});
				storeHandles.set(`${id}-${paths.path}`, {
					destroy: () => {
						storeHandle.remove();
					}
				});
			}
		}

		function getPaginationIds(pagination?: ReadPaginationOptions) {
			let ids: string[] = [];
			if (pagination) {
				const pageData = store.get(store.path(pathPrefix, 'pagination', `size-${pagination.size}`));
				if (pageData) {
					ids = pageData.pages[`page-${pagination.offset}`] || [];
				}
			}
			return ids;
		}

		function prev() {
			subscribeToStore(store.path(pathPrefix, 'meta', 'pagination'));
			_prevPageProcess({ initiator: id, pathPrefix });
		}

		function next() {
			subscribeToStore(store.path(pathPrefix, 'meta', 'pagination'));
			_nextPageProcess({ initiator: id, pathPrefix });
		}

		function goto(page: number) {
			subscribeToStore(store.path(pathPrefix, 'meta', 'pagination'));
			_gotoPageProcess({ page, initiator: id, pathPrefix });
		}

		function getOrRead(options?: GetOrReadOptions): S[] | undefined {
			let paginationIds: string[] = [];
			let pagination: undefined | PaginationPayload;
			if (options && options.pagination) {
				pagination = {
					offset: (options.pagination.start - 1) * options.pagination.size,
					size: options.pagination.size,
					start: options.pagination.start
				};
			}

			if (has('build-time-render')) {
				return undefined;
			}

			if (pagination) {
				let paginationMeta = store.get(store.path(pathPrefix, 'meta', 'pagination', 'current', id)) || {
					start: 1
				};
				if (pagination.start === paginationMeta.start && isLoading({ action: 'read', type: 'many' })) {
					return undefined;
				}
			} else {
				if (isLoading({ action: 'read', type: 'many' })) {
					return undefined;
				}
			}

			const loadedPages = store.get(store.path(pathPrefix, 'meta', 'pagination', 'loadedPages')) || [];
			const fetchResourcePage =
				pagination && loadedPages.indexOf(`size-${pagination.size}-offset-${pagination.offset}`) === -1;
			const hasCompleted = isCompleted({ action: 'read', type: 'many' });

			if (fetchResourcePage || !hasCompleted) {
				subscribeToStore(store.path(pathPrefix, 'data'));
				if (!hasCompleted) {
					_invalidationPaginationProcess({ pathPrefix });
				}

				_readManyProcess({
					options: options ? options.options : undefined,
					pathPrefix,
					config,
					batchId: uuid(),
					type: 'many',
					action: 'read',
					idKey,
					initiator: id,
					pagination
				});
			}

			paginationIds = getPaginationIds(pagination);

			if (!isCompleted({ action: 'read', type: 'many' }) && !paginationIds.length) {
				return undefined;
			}

			const data = store.get(store.path(pathPrefix, 'data'));
			if (paginationIds.length) {
				return paginationIds.map((id) => data[id]);
			}

			const itemIds = store.get(store.path(pathPrefix, 'order')) || {};
			const orderedData: S[] = [];
			Object.keys(itemIds).forEach((objectKey) => {
				itemIds[objectKey].forEach((id) => {
					data[id] && orderedData.push(data[id]);
				});
			});

			return orderedData;
		}

		return {
			getOrRead(pagination?: GetOrReadOptions) {
				return getOrRead(pagination);
			},
			isFailed(options: StatusOptions = {}) {
				return isFailed(options);
			},
			isLoading(options: StatusOptions = {}) {
				return isLoading(options);
			},
			page: {
				next() {
					return next();
				},
				previous() {
					return prev();
				},
				goto(page: number) {
					return goto(page);
				},
				total() {
					return total();
				},
				current() {
					return current();
				}
			}
		};
	});
}
