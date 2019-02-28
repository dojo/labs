const { describe, it, beforeEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import Store from '@dojo/framework/stores/Store';
import { registerStoreInjector } from '@dojo/framework/stores/StoreInjector';
import provider, { ReadPaginationOptions } from '../../src/provider';

let store: Store;
let registry: any;

describe('ResourceProvider', () => {
	beforeEach(() => {
		store = new Store();
		(window as any).store = store;
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
			renderer: ({ getOrRead, page: { current, total } }) => {
				renderCount++;
				const result = getOrRead();
				assert.isUndefined(current());
				assert.isUndefined(total());
				assert.deepEqual(result, [{ id: 'a' }]);
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

	it('Should fetch resources for page and return them to the providers renderer', () => {
		let readCallCount = 0;
		let renderCount = 0;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: (options?: ReadPaginationOptions) => {
				readCallCount++;
				if (renderCount === 1) {
					assert.deepEqual(options, { offset: 0, size: 20 });
				} else if (renderCount === 2) {
					assert.deepEqual(options, { offset: 20, size: 20 });
				}

				return options!.offset === 0
					? { data: [{ id: 'a' }], success: true, total: 40 }
					: { data: [{ id: 'b' }], success: true, total: 40 };
			}
		});

		const widget = new TestResourceProvider();
		widget.registry.base = registry;
		let pageNumber = 1;
		widget.__setProperties__({
			renderer: ({ getOrRead, page: { current, total } }) => {
				renderCount++;
				const result = getOrRead({ start: pageNumber, size: 20 });
				if (renderCount < 3) {
					assert.strictEqual(total(), 2);
					assert.strictEqual(current(), 1);
					assert.deepEqual(result, [{ id: 'a' }]);
				} else {
					assert.strictEqual(total(), 2);
					assert.strictEqual(current(), 2);
					assert.deepEqual(result, [{ id: 'b' }]);
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
		pageNumber++;
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 3);
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 4);
	});

	it('Calling next should cause the next page to be fetched', () => {
		let readCallCount = 0;
		let renderCount = 0;
		let nextFunction: any;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: (options?: ReadPaginationOptions) => {
				readCallCount++;
				return options!.offset === 0
					? { data: [{ id: 'a' }], success: true, total: 40 }
					: { data: [{ id: 'b' }], success: true, total: 40 };
			}
		});

		const widget = new TestResourceProvider();
		widget.registry.base = registry;
		widget.__setProperties__({
			renderer: ({ getOrRead, page: { next } }) => {
				nextFunction = next;
				renderCount++;
				const result = getOrRead({ start: 1, size: 20 });
				if (renderCount < 3) {
					assert.deepEqual(result, [{ id: 'a' }]);
				} else {
					assert.deepEqual(result, [{ id: 'b' }]);
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
		nextFunction();
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 3);
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 4);
	});

	it('Calling previous should cause the previous page to be fetched', () => {
		let readCallCount = 0;
		let renderCount = 0;
		let prevFunction: any;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: (options?: ReadPaginationOptions) => {
				readCallCount++;
				return options!.offset === 0
					? { data: [{ id: 'a' }], success: true, total: 1 }
					: { data: [{ id: 'b' }], success: true, total: 1 };
			}
		});

		const widget = new TestResourceProvider();
		widget.registry.base = registry;
		widget.__setProperties__({
			renderer: ({ getOrRead, page: { previous } }) => {
				prevFunction = previous;
				renderCount++;
				const result = getOrRead({ start: 2, size: 20 });
				if (renderCount < 3) {
					assert.deepEqual(result, [{ id: 'b' }]);
				} else {
					assert.deepEqual(result, [{ id: 'a' }]);
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
		prevFunction();
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 3);
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 4);
	});

	it('Calling goto should cause the requested page to be fetched', () => {
		let readCallCount = 0;
		let renderCount = 0;
		let gotoFunction: any;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: (options?: ReadPaginationOptions) => {
				readCallCount++;
				return options!.offset === 0
					? { data: [{ id: 'a' }], success: true, total: 40 }
					: { data: [{ id: 'b' }], success: true, total: 40 };
			}
		});

		const widget = new TestResourceProvider();
		widget.registry.base = registry;
		widget.__setProperties__({
			renderer: ({ getOrRead, page: { goto } }) => {
				gotoFunction = goto;
				renderCount++;
				const result = getOrRead({ start: 1, size: 20 });
				if (renderCount < 3) {
					assert.deepEqual(result, [{ id: 'a' }]);
				} else {
					assert.deepEqual(result, [{ id: 'b' }]);
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
		gotoFunction(2);
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 3);
		widget.__render__();
		assert.strictEqual(readCallCount, 2);
		assert.strictEqual(renderCount, 4);
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
				assert.deepEqual(result, [{ id: 'a' }]);
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
			renderer: (resource) => {
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

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
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

	it('isFailed should return true the action has failed', () => {
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				throw new Error('test error');
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				const failed = resource.isFailed({ action: 'read' });
				assert.isTrue(failed);
				return null;
			}
		});
		widgetOne.__render__();
	});

	it('isFailed should return true the action and type has failed', () => {
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				throw new Error('test error');
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				const failed = resource.isFailed({ action: 'read', type: 'many' });
				assert.isTrue(failed);
				return null;
			}
		});
		widgetOne.__render__();
	});

	it('isFailed should return true if any action has failed', () => {
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				throw new Error('test error');
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				const failed = resource.isFailed();
				assert.isTrue(failed);
				return null;
			}
		});
		widgetOne.__render__();
	});

	it('isLoading should return true the action has loading', () => {
		let promise: any;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				promise = new Promise((resolve) => {
					resolve({ data: [{ id: 'a' }], success: true, total: 1 });
				});
				return promise;
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				const loading = resource.isLoading({ action: 'read' });
				assert.isTrue(loading);
				return null;
			}
		});
		widgetOne.__render__();
		return promise;
	});

	it('isLoading should return true the action and type has loading', () => {
		let promise: any;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				promise = new Promise((resolve) => {
					resolve({ data: [{ id: 'a' }], success: true, total: 1 });
				});
				return promise;
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				const loading = resource.isLoading({ action: 'read', type: 'many' });
				assert.isTrue(loading);
				return null;
			}
		});
		widgetOne.__render__();
		return promise;
	});

	it('isLoading should return true if any action has loading', () => {
		let promise: any;
		const TestResourceProvider = provider({
			idKey: 'id',
			template: (resource: any) => {
				return resource;
			},
			read: () => {
				promise = new Promise((resolve) => {
					resolve({ data: [{ id: 'a' }], success: true, total: 1 });
				});
				return promise;
			}
		});

		const widgetOne = new TestResourceProvider();
		widgetOne.registry.base = registry;
		widgetOne.__setProperties__({
			renderer: (resource) => {
				resource.getOrRead();
				const loading = resource.isLoading();
				assert.isTrue(loading);
				return null;
			}
		});
		widgetOne.__render__();
		return promise;
	});
});
