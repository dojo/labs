import Map from '@dojo/framework/shim/Map';
import { uuid } from '@dojo/framework/core/util';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { ResourceState } from './interfaces';
import { createProcessFactoryWith, createProcess, ProcessExecutor } from '@dojo/framework/stores/process';
import {
	beforeReadMany,
	readMany,
	failedResource,
	ReadManyPayload,
	initializeResource,
	NextPagePayload,
	PrevPagePayload,
	GotoPagePayload,
	prevPage,
	nextPage,
	gotoPage,
	PaginationPayload
} from './commands';
import { RenderResult, Constructor } from '@dojo/framework/widget-core/interfaces';
import alwaysRender from '@dojo/framework/widget-core/decorators/alwaysRender';
import Store, { Path } from '@dojo/framework/stores/Store';
import { Handle } from '@dojo/framework/core/Destroyable';

export type Status = 'failed' | 'loading' | 'completed';
export type Action = 'read';
export type ActionType = 'many';

export interface GetOrReadOptions {
	start: number;
	size: number;
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
	total: number;
	success: boolean;
}

export interface ReadPaginationOptions {
	offset: number;
	size: number;
}

export interface ResourceRead<S> {
	(): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
	(pagination?: ReadPaginationOptions): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
}

export interface ResourceConfig<S> {
	idKey?: string;
	template(resource: Partial<S>): S;
	read: ResourceRead<S>;
}

export interface ResourceProviderProperties<S> {
	renderer(resource: Resource<S>): RenderResult;
}

export function provider<S>(config: ResourceConfig<S>): Constructor<WidgetBase<ResourceProviderProperties<S>>> {
	const pathPrefix = uuid();
	const { idKey = 'id' } = config;
	const failedResourceProcess = createProcess(`${pathPrefix}-failed-resource`, [failedResource]);
	const initializeResourceProcess = createProcess(`${pathPrefix}-init`, [initializeResource]);
	const createProcessWithError = createProcessFactoryWith([
		() => ({
			after: (error, result) => {
				if (error) {
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

	@alwaysRender()
	class ResourceProvider extends WidgetBase<ResourceProviderProperties<S>> {
		private _initiatorId = uuid();
		private _store: Store<ResourceState<S>>;
		private _readManyProcess: ProcessExecutor<ResourceState<any>, ReadManyPayload, ReadManyPayload>;
		private _nextPageProcess: ProcessExecutor<ResourceState<any>, NextPagePayload, NextPagePayload>;
		private _prevPageProcess: ProcessExecutor<ResourceState<any>, PrevPagePayload, PrevPagePayload>;
		private _gotoPageProcess: ProcessExecutor<ResourceState<any>, GotoPagePayload, GotoPagePayload>;
		private _storeHandles = new Map<string, Handle>();

		constructor() {
			super();
			this.own({
				destroy: () => {
					this._storeHandles.forEach((handle) => {
						handle.destroy();
					});
					this._storeHandles.clear();
				}
			});
		}

		private _getStatus(options: StatusOptions = {}, statusType: string) {
			const { action, type } = options;
			const meta = this._store.get(this._store.path(pathPrefix, 'meta')) as any;
			let result = false;
			if (action && type) {
				result = result || meta.actions[action][type][statusType].indexOf(this._initiatorId) !== -1;
			} else if (action) {
				result = result || meta.actions[action].many[statusType].indexOf(this._initiatorId) !== -1;
			} else {
				result = result || meta.actions.read.many[statusType].indexOf(this._initiatorId) !== -1;
			}

			return result;
		}

		private _isLoading(options: StatusOptions): boolean {
			return this._getStatus(options, 'loading');
		}

		private _isCompleted(options: StatusOptions): boolean {
			return this._getStatus(options, 'completed');
		}

		private _isFailed(options: StatusOptions): boolean {
			return this._getStatus(options, 'failed');
		}

		private _total() {
			const pagination = this._store.get(this._store.path(pathPrefix, 'meta', 'pagination', this._initiatorId));
			if (pagination) {
				return Math.ceil(pagination.total / pagination.size);
			}
			return undefined;
		}

		private _current() {
			const pagination = this._store.get(this._store.path(pathPrefix, 'meta', 'pagination', this._initiatorId));
			if (pagination) {
				return Math.ceil(pagination.offset / pagination.size) + 1;
			}
			return undefined;
		}

		private _subscribeToStore<U>(paths: Path<ResourceState<S>, U>) {
			const existing = this._storeHandles.get(paths.path);
			if (!existing) {
				const storeHandle = this._store.onChange(paths, () => {
					this.invalidate();
				});
				this._storeHandles.set(paths.path, {
					destroy: () => {
						storeHandle.remove();
					}
				});
			}
		}

		private _getPaginationIds(pagination?: ReadPaginationOptions) {
			let ids: string[] = [];
			if (pagination) {
				const pageData = this._store.get(this._store.path(pathPrefix, 'pagination', `size-${pagination.size}`));
				if (pageData) {
					ids = pageData.pages[`page-${pagination.offset}`] || [];
				}
			}
			return ids;
		}

		private _prev() {
			this._subscribeToStore(this._store.path(pathPrefix, 'meta', 'pagination'));
			this._prevPageProcess({ initiator: this._initiatorId, pathPrefix });
		}

		private _next() {
			this._subscribeToStore(this._store.path(pathPrefix, 'meta', 'pagination'));
			this._nextPageProcess({ initiator: this._initiatorId, pathPrefix });
		}

		private _goto(page: number) {
			this._subscribeToStore(this._store.path(pathPrefix, 'meta', 'pagination'));
			this._gotoPageProcess({ page, initiator: this._initiatorId, pathPrefix });
		}

		private _getOrRead(options?: GetOrReadOptions): S[] | undefined {
			let paginationMeta = this._store.get(this._store.path(pathPrefix, 'meta', 'pagination', this._initiatorId));
			let paginationIds: string[] = [];
			let pagination: undefined | PaginationPayload;
			if (paginationMeta) {
				let { offset, start } = paginationMeta;
				if (options && options.start && options.start !== paginationMeta.start) {
					offset = (options.start - 1) * paginationMeta.size;
					start = options.start;
				}
				pagination = {
					offset: offset,
					size: paginationMeta.size,
					start
				};
			} else if (options) {
				pagination = {
					offset: (options.start - 1) * options.size,
					size: options.size,
					start: options.start
				};
			}

			paginationIds = this._getPaginationIds(pagination);

			if (this._isLoading({ action: 'read', type: 'many' })) {
				return undefined;
			}

			const fetchResourcePage = pagination && !paginationIds.length;

			if (fetchResourcePage || !this._isCompleted({ action: 'read', type: 'many' })) {
				this._subscribeToStore(this._store.path(pathPrefix, 'data'));
				this._readManyProcess({
					pathPrefix,
					config,
					batchId: uuid(),
					type: 'many',
					action: 'read',
					idKey,
					initiator: this._initiatorId,
					pagination
				});
			}

			if (!this._isCompleted({ action: 'read', type: 'many' })) {
				return undefined;
			}

			paginationIds = this._getPaginationIds(pagination);

			const data = this._store.get(this._store.path(pathPrefix, 'data'));
			if (paginationIds.length) {
				return paginationIds.map((id) => data[id]);
			}

			const itemIds = this._store.get(this._store.path(pathPrefix, 'order')) || {};
			const orderedData: S[] = [];
			Object.keys(itemIds).forEach((objectKey) => {
				itemIds[objectKey].forEach((id) => {
					data[id] && orderedData.push(data[id]);
				});
			});

			return orderedData;
		}

		protected render() {
			const { renderer } = this.properties;

			if (!this._store) {
				const item = this.registry.getInjector<any>('state');
				if (item) {
					this._store = item.injector();
					this._readManyProcess = readManyProcess(this._store);
					this._prevPageProcess = prevPageProcess(this._store);
					this._nextPageProcess = nextPageProcess(this._store);
					this._gotoPageProcess = gotoPageProcess(this._store);
					initializeResourceProcess(this._store)({ pathPrefix });
				}
			}

			return renderer({
				getOrRead: (pagination?: GetOrReadOptions) => {
					return this._getOrRead(pagination);
				},
				isFailed: (options: StatusOptions) => {
					return this._isFailed(options);
				},
				isLoading: (options: StatusOptions) => {
					return this._isLoading(options);
				},
				page: {
					next: () => {
						return this._next();
					},
					previous: () => {
						return this._prev();
					},
					goto: (page: number) => {
						return this._goto(page);
					},
					total: () => {
						return this._total();
					},
					current: () => {
						return this._current();
					}
				}
			});
		}
	}

	return ResourceProvider;
}

export default provider;
