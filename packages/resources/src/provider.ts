import { uuid } from '@dojo/framework/core/util';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { ResourceState } from './interfaces';
import { createProcessFactoryWith, createProcess, ProcessExecutor } from '@dojo/framework/stores/process';
import { beforeReadMany, readMany, failedResource, ReadManyPayload, initializeResource } from './commands';
import { RenderResult, Constructor } from '@dojo/framework/widget-core/interfaces';
import alwaysRender from '@dojo/framework/widget-core/decorators/alwaysRender';
import Store from '@dojo/framework/stores/Store';
import { Handle } from '@dojo/framework/core/Destroyable';

export type Status = 'failed' | 'loading' | 'completed';
export type Action = 'read';
export type ActionType = 'many';

export interface PaginationOptions {
	offset: number;
	size: number;
}

export interface StatusOptions {
	action?: Action;
	type?: ActionType;
}

export interface Resource<S> {
	isLoading(options?: StatusOptions): boolean;
	isFailed(options?: StatusOptions): boolean;
	getOrRead(options?: PaginationOptions): undefined | S[];
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

export interface ResourceRead<S> {
	(): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
	(pagination?: PaginationOptions): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
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
					result.executor(failedResourceProcess, { action, type, pathPrefix, initiator });
				}
			}
		})
	]);
	const readManyProcess = createProcessWithError(`${pathPrefix}-read-many`, [beforeReadMany, readMany]);

	@alwaysRender()
	class ResourceProvider extends WidgetBase<ResourceProviderProperties<S>> {
		private _initiatorId = uuid();
		private _store: Store<ResourceState<S>>;
		private _readManyProcess: ProcessExecutor<ResourceState<any>, ReadManyPayload, ReadManyPayload>;
		private _getOrReadHandle: Handle | undefined;

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

		private _getOrRead(options?: PaginationOptions): S[] {
			let paginationIds: string[] = [];
			if (options) {
				let pagination =
					this._store.get(this._store.path(pathPrefix, 'pagination', `size-${options.size}`));
				if (pagination) {
					paginationIds = pagination.pages[`page-${options.offset}`] || [];
				}
			}

			if (this._isLoading({ action: 'read', type: 'many' })) {
				return [];
			}

			const fetchResourcePage = options && !paginationIds.length;

			if (fetchResourcePage || !this._isCompleted({ action: 'read', type: 'many' })) {
				if (!this._getOrReadHandle) {
					const storeHandle = this._store.onChange(this._store.path(pathPrefix, 'data'), () => {
						this.invalidate();
					});
					this._getOrReadHandle = {
						destroy: () => {
							storeHandle.remove();
						}
					};
					this.own(this._getOrReadHandle);
				}
				this._readManyProcess({
					pathPrefix,
					config,
					batchId: uuid(),
					type: 'many',
					action: 'read',
					idKey,
					initiator: this._initiatorId,
					pagination: options
				});
				return [];
			}

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
					initializeResourceProcess(this._store)({ pathPrefix });
				}
			}

			return renderer({
				getOrRead: (pagination?: PaginationOptions) => {
					return this._getOrRead(pagination);
				},
				isFailed: (options: StatusOptions) => {
					return this._isFailed(options);
				},
				isLoading: (options: StatusOptions) => {
					return this._isLoading(options);
				}
			});
		}
	}

	return ResourceProvider;
}

export default provider;
