import { uuid } from '@dojo/framework/core/util';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { ResourceState } from './interfaces';
import { createProcessFactoryWith, createProcess, ProcessExecutor } from '@dojo/framework/stores/process';
import { beforeReadMany, readMany, failedResource, ReadManyPayload } from './commands';
import { RenderResult, Constructor } from '@dojo/framework/widget-core/interfaces';
import alwaysRender from '@dojo/framework/widget-core/decorators/alwaysRender';
import Store from '@dojo/framework/stores/Store';
import { Handle } from '@dojo/framework/core/Destroyable';

export type Status = 'failed' | 'loading' | 'completed';
export type Action = 'create' | 'remove' | 'update' | 'read';
export type ActionType = 'many' | 'one';

export interface PaginationOptions {
	offset: number;
	size: number;
}

export interface GetOrReadResult<S> {
	data: S[];
	total: number;
}

export interface Resource<S> {
	getOrRead(options?: PaginationOptions): undefined | GetOrReadResult<S>;
}

export interface IsLoadingOptions {
	action?: Action;
	global?: boolean;
}

export interface ManyResourceResponse<S> {
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
	const createProcessWithError = createProcessFactoryWith([
		() => ({
			after: (error, result) => {
				if (error) {
					const { action, type, pathPrefix } = result.payload;
					result.store.apply(result.undoOperations, true);
					result.executor(failedResourceProcess, { action, type, pathPrefix });
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

		private _getOrRead(options?: PaginationOptions): GetOrReadResult<S> | undefined {
			const statuses = this._store.get(this._store.path(pathPrefix, 'meta', 'actions', 'read', 'many')) || {};
			let paginationIds: string[] = [];
			let total = 0;
			if (options) {
				let pagination = this._store.get(this._store.path(pathPrefix, 'pagination', `size-${options.size}`)) || {};
				if (pagination) {
					paginationIds = pagination.pages[`page-${options.offset}`]
					total = pagination.total;
				}
			}

			if (statuses.loading && statuses.loading.indexOf(this._initiatorId) > -1) {
				return undefined;
			}

			const fetchResourcePage = options && !paginationIds.length;
			const fetchResource = !statuses.completed || statuses.completed.indexOf(this._initiatorId) === -1

			if (fetchResourcePage || fetchResource) {
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
				return undefined;
			}

			if (paginationIds.length) {
				return {
					data: paginationIds.map((id) => data[id]),
					total
				}
			}

			const itemIds = this._store.get(this._store.path(pathPrefix, 'order')) || {};
			const data = this._store.get(this._store.path(pathPrefix, 'data'));
			const orderedData: S[] = [];
			Object.keys(itemIds).forEach((objectKey) => {
				itemIds[objectKey].forEach((id) => {
					data[id] && orderedData.push(data[id]);
				});
			});

			return {
				data: orderedData,
				total: orderedData.length
			};
		}

		protected render() {
			const { renderer } = this.properties;

			if (!this._store) {
				const item = this.registry.getInjector<any>('state');
				if (item) {
					this._store = item.injector();
					this._readManyProcess = readManyProcess(this._store);
				}
			}

			return renderer({
				getOrRead: (pagination?: PaginationOptions) => {
					return this._getOrRead(pagination);
				}
			});
		}
	}

	return ResourceProvider;
}

export default provider;
