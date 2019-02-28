const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import Store from '@dojo/framework/stores/Store';
import { beforeReadMany, readMany, prevPage, nextPage, gotoPage } from '../../src/commands';
import { ReplacePatchOperation } from '@dojo/framework/stores/state/Patch';
import { replace } from '@dojo/framework/stores/state/operations';
import { ResourceState } from '../../src/interfaces';

const store = new Store<ResourceState<any>>();
const metaPath = store.path('test', 'meta');

describe('commands', () => {
	it('beforeReadMany', () => {
		const { at, path, get } = store;
		const operations = beforeReadMany({ at, get, path, payload: { pathPrefix: 'test', initiator: 'init' } as any });
		assert.deepEqual(operations, [replace(path(metaPath, 'actions', 'read', 'many', 'loading'), ['init'])]);
	});

	it('readMany - no results', async () => {
		const { at, path, get } = store;
		const payload = {
			pathPrefix: 'test',
			idKey: 'id',
			config: {
				template: () => {},
				read: () => {
					return { data: [] as string[], total: 0, success: true };
				}
			},
			batchId: 'batchId',
			action: 'action',
			type: 'type',
			initiator: 'init'
		};
		const operations = await readMany({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(path(metaPath, 'actions', 'read', 'many', 'loading'), []),
			replace(path(metaPath, 'actions', 'read', 'many', 'completed'), ['init']),
			replace(path('test', 'order'), { batchId: [] })
		]);
	});

	it('readMany - with results', async () => {
		const { at, path, get } = store;
		const payload = {
			pathPrefix: 'test',
			idKey: 'id',
			config: {
				template: (item: any) => item,
				read: async () => {
					return { data: [{ id: 'a' }, { id: 'b' }], total: 2, success: true };
				}
			},
			batchId: 'batch-Id',
			action: 'action',
			type: 'type',
			initiator: 'init'
		};
		const operations = await readMany({ at, get, path, payload });

		const [aSynthId, bSynthId] = Object.keys((operations[0] as ReplacePatchOperation).value);
		assert.deepEqual(operations, [
			replace(path(metaPath, 'items'), {
				[aSynthId]: {
					read: {
						completed: ['init'],
						failed: [],
						loading: []
					}
				},
				[bSynthId]: {
					read: {
						completed: ['init'],
						failed: [],
						loading: []
					}
				}
			}),
			replace(path('test', 'data'), {
				[aSynthId]: { id: 'a' },
				[bSynthId]: { id: 'b' }
			}),
			replace(path('test', 'idMap'), {
				a: aSynthId,
				b: bSynthId
			}),
			replace(path(metaPath, 'actions', 'read', 'many', 'loading'), []),
			replace(path(metaPath, 'actions', 'read', 'many', 'completed'), ['init']),
			replace(path('test', 'order'), { 'batch-Id': [aSynthId, bSynthId] })
		]);
	});

	it('readMany - failed', async () => {
		const { at, path, get } = store;
		const payload = {
			pathPrefix: 'test',
			idKey: 'id',
			config: {
				template: () => {},
				read: async () => {
					return { data: [], success: false };
				}
			},
			batchId: 'batchId',
			action: 'action',
			type: 'type'
		};
		try {
			await readMany({ at, get, path, payload } as any);
			assert.fail('Should throw error for failed `read`');
		} catch (e) {
			assert.strictEqual(e.message, 'Read many operation failed');
		}
	});

	it('Should return operations update pagination to previous page', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 50,
				size: 10,
				start: 1,
				total: 100
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init'
		};
		const operations = prevPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 40,
				size: 10,
				start: 1,
				total: 100
			})
		]);
	});

	it('Should return operations update pagination to first page if the previous page would be negative', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 0,
				size: 10,
				start: 1,
				total: 100
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init'
		};
		const operations = prevPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 0,
				size: 10,
				start: 1,
				total: 100
			})
		]);
	});

	it('Should return operations update pagination meta to next page', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 50,
				size: 10,
				start: 1,
				total: 100
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init'
		};
		const operations = nextPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 60,
				size: 10,
				start: 1,
				total: 100
			})
		]);
	});

	it('Should update to next page with remainder', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 90,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init'
		};
		const operations = nextPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
	});

	it('Should return operations update pagination to last page if the next page would result in a page greater than available', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init'
		};
		let operations = nextPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 90,
				size: 10,
				start: 1,
				total: 100
			})
		]);
		operations = nextPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 90,
				size: 10,
				start: 1,
				total: 100
			})
		]);
	});

	it('Should return operations to update pagination data to requested page', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init',
			page: 5
		};
		const operations = gotoPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 40,
				size: 10,
				start: 1,
				total: 101
			})
		]);
	});

	it('Should return operations to update pagination data to first page if a negative page is provided', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init',
			page: -5
		};
		const operations = gotoPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 0,
				size: 10,
				start: 1,
				total: 101
			})
		]);
	});
	it('Should return operations to update pagination data to last page if page requested is greater than the page count', () => {
		const { at, path, get } = store;
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		const payload = {
			pathPrefix: 'test',
			initiator: 'init',
			page: 20
		};
		let operations = gotoPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 101
			})
		]);
		store.apply([
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 100,
				size: 10,
				start: 1,
				total: 100
			})
		]);
		operations = gotoPage({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(store.path('test', 'meta', 'pagination', 'current', 'init'), {
				offset: 90,
				size: 10,
				start: 1,
				total: 100
			})
		]);
	});
});
