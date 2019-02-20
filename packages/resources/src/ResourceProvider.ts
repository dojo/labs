import { uuid } from '@dojo/framework/core/util';
import WidgetBase from '@dojo/framework/widget-core/WidgetBase';
import { ResourceConfig, Resource, ResourceState } from './interfaces';
import { createProcessFactoryWith } from '@dojo/framework/stores/process';
import { beforeReadMany, readMany } from './commands';
import { RenderResult, Constructor } from '@dojo/framework/widget-core/interfaces';
import alwaysRender from '@dojo/framework/widget-core/decorators/alwaysRender';
import Store from '@dojo/framework/stores/Store';

export interface ResourceProviderProperties<S> {
	renderer(resource: Resource<S>): RenderResult;
}

export function createResourceProvider<S>(
	config: ResourceConfig<S>
): Constructor<WidgetBase<ResourceProviderProperties<S>>> {
	const pathPrefix = uuid();
	const { idKey = 'id' } = config;
	const createProcess = createProcessFactoryWith([
		() => ({
			after: (error, result) => {
				if (error) {
					result.store.apply(result.undoOperations, true);
				}
			}
		})
	]);
	const readManyProcess = createProcess(`${pathPrefix}-read-many`, [beforeReadMany, readMany]);

	@alwaysRender()
	class ResourceProvider extends WidgetBase<ResourceProviderProperties<S>> {
		private _initial = false;
		private _store: Store<ResourceState<S>>;
		private _readManyProcess: any;

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
				this._readManyProcess({ config, pathPrefix, batchId: uuid(), type: 'read', idKey });
				return [];
			}

			const itemIds = this._store.get(this._store.path(pathPrefix, 'order'));
			if (!itemIds) {
				return [];
			}
			const data = this._store.get(this._store.path(pathPrefix, 'data'));
			const orderedData: any = [];
			Object.keys(itemIds).forEach((objectKey) => {
				const item = itemIds[objectKey];
				if (Array.isArray(item)) {
					item.forEach((id) => {
						data[id] && orderedData.push(data[id]);
					});
				} else if (item) {
					data[item] && orderedData.push(data[item]);
				}
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
