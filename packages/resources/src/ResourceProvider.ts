import { uuid } from '@dojo/framework/core/util';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { ResourceState } from './interfaces';
import { createProcessFactoryWith, createProcess, ProcessExecutor } from '@dojo/framework/stores/process';
import { beforeReadMany, readMany, failedResource, ReadManyPayload } from './commands';
import { RenderResult, Constructor } from '@dojo/framework/widget-core/interfaces';
import alwaysRender from '@dojo/framework/widget-core/decorators/alwaysRender';
import Store from '@dojo/framework/stores/Store';

export type Status = 'failed' | 'loading' | 'completed';
export type Action = 'create' | 'remove' | 'update' | 'read';

export enum ResourceResponseStatus {
	failed = 0,
	success = 1
}

export interface Resource<S> {
	getOrRead(): S[];
}

export interface ManyResourceResponse<S> {
	data: S[];
	status: ResourceResponseStatus;
}

export interface ResourceRead<S> {
	(): Promise<ManyResourceResponse<S>> | ManyResourceResponse<S>;
}

export interface ResourceConfig<S> {
	idKey?: string;
	template(resource: Partial<S>): S;
	read: ResourceRead<S>;
}

export interface ResourceProviderProperties<S> {
	renderer(resource: Resource<S>): RenderResult;
}

export function resourceProvider<S>(config: ResourceConfig<S>): Constructor<WidgetBase<ResourceProviderProperties<S>>> {
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
		private _initial = true;
		private _store: Store<ResourceState<S>>;
		private _readManyProcess: ProcessExecutor<ResourceState<any>, ReadManyPayload, ReadManyPayload>;

		private _getOrRead(): S[] {
			const currentStatus =
				this._store.get(this._store.path(pathPrefix, 'meta', 'actions', 'read', 'many')) || {};

			if (currentStatus.status === 'loading') {
				return [];
			}

			if (currentStatus.status !== 'completed' || this._initial) {
				const handle = this._store.onChange(this._store.path(pathPrefix), () => {
					this.invalidate();
				});
				this.own({
					destroy: () => {
						handle.remove();
					}
				});
				this._initial = false;
				this._readManyProcess({ pathPrefix, config, batchId: uuid(), type: 'many', action: 'read', idKey });
				return [];
			}

			const itemIds = this._store.get(this._store.path(pathPrefix, 'order')) || {};
			const data = this._store.get(this._store.path(pathPrefix, 'data'));
			const orderedData: any = [];
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
				}
			}

			return renderer({
				getOrRead: () => {
					return this._getOrRead();
				}
			});
		}
	}

	return ResourceProvider;
}

export default resourceProvider;
