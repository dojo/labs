const { describe, it, beforeEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import Store from '@dojo/framework/stores/Store';
import { registerStoreInjector } from '@dojo/framework/stores/StoreInjector';
import provider from '../../src/provider';

let store: Store;
let registry: any;

describe('ResourceProvider', () => {
	beforeEach(() => {
		store = new Store();
		registry = registerStoreInjector(store);
	});

	it('Should fetch resources and return them to the providers renderer', () => {
		let readCallCount = 0;
		let renderCount = 0;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				readCallCount++;
				return { data: [{ id: 'a' }], success: true, total: 1 };
			}
		});

		const widget = new TestResourceProvider();
		widget.registry.base = registry;
		widget.__setProperties__({
			renderer: (resource) => {
				renderCount++;
				const result = resource.getOrRead();
				if (renderCount === 1) {
					assert.isUndefined(result);
				} else {
					assert.deepEqual(result, { data: [{ id: 'a' }], total: 1 });
				}
				return null;
			}
		});

		widget.__render__();
		assert.strictEqual(readCallCount, 1);
		assert.strictEqual(renderCount, 1);
		widget.__render__();
		assert.strictEqual(readCallCount, 1);
		assert.strictEqual(renderCount, 2);
		widget.invalidate();
		widget.__render__();
		assert.strictEqual(readCallCount, 1);
		assert.strictEqual(renderCount, 3);
	});

	it('Should default idKey to id and fetch resources', () => {
		let readCallCount = 0;
		let renderCount = 0;
		const TestResourceProvider = provider({
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				readCallCount++;
				return { data: [{ id: 'a' }], success: true, total: 1 };
			}
		});

		const widget = new TestResourceProvider();
		widget.registry.base = registry;
		widget.__setProperties__({
			renderer: (resource) => {
				renderCount++;
				const result = resource.getOrRead();
				if (renderCount === 1) {
					assert.isUndefined(result);
				} else {
					assert.deepEqual(result, { data: [{ id: 'a' }], total: 1 });
				}
				return null;
			}
		});

		widget.__render__();
		assert.strictEqual(readCallCount, 1);
		assert.strictEqual(renderCount, 1);
		widget.__render__();
		assert.strictEqual(readCallCount, 1);
		assert.strictEqual(renderCount, 2);
	});

	it('Should force read for the first render of a ResourceProvider', () => {
		let readCallCount = 0;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				readCallCount++;
				return { data: [{ id: 'a' }], success: true, total: 1 };
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				return null;
			}
		});

		widgetOne.__render__();
		assert.strictEqual(readCallCount, 1);
		widgetOne.__render__();
		assert.strictEqual(readCallCount, 1);
		widgetOne.invalidate();
		assert.strictEqual(readCallCount, 1);
		const widgetTwo = new TestResourceProvider();
		widgetTwo.registry.base = registry;
		widgetTwo.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				return null;
			}
		});
		widgetTwo.__render__();
		assert.strictEqual(readCallCount, 2);
	});

	it('should detach store from provider when it is destroyed', () => {
		let invalidateCount = 0;
		const ResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				return { data: [{ id: 'a' }], success: true, total: 1 };
			}
		});

		class TestResourceProvider extends ResourceProvider {
			invalidate() {
				invalidateCount++;
				super.invalidate();
			}
			destroy() {
				super.destroy();
			}
		}

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource: any) => {
				resource.getOrRead();
				return null;
			}
		});
		widgetOne.__render__();
		const widgetTwo = new TestResourceProvider();
		widgetTwo.registry.base = registry;
		widgetTwo.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				return null;
			}
		});
		widgetOne.destroy();
		widgetTwo.__render__();
		assert.strictEqual(invalidateCount, 4);
	});

	it('Should revert on a read error', () => {
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				throw new Error('test error');
			}
		});

		const widgetOne: any = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource: any) => {
				resource.getOrRead();
				return null;
			}
		});
		widgetOne.__render__();
		const pathPrefix = Object.keys((store as any)._state)[0];
		const metaPath = store.path(pathPrefix, 'meta');
		const status = store.get(store.path(metaPath, 'actions', 'read', 'many', 'failed'));
		assert.lengthOf(status, 1);
	});
});
