const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import Store from '@dojo/framework/stores/Store';
import { beforeReadMany, readMany } from '../../src/commands';
import { ResourceResponseStatus } from '../../src/ResourceProvider';
import { ReplacePatchOperation } from '@dojo/framework/stores/state/Patch';
import { replace } from '@dojo/framework/stores/state/operations';

const store = new Store();
const metaPath = store.path('test', 'meta');

describe('commands', () => {
	it('beforeReadMany', () => {
		const { at, path, get } = store;
		const operations = beforeReadMany({ at, get, path, payload: { pathPrefix: 'test' } as any });
		assert.deepEqual(operations, [replace(path(metaPath, 'actions', 'read', 'many', 'status'), 'loading')]);
	});

	it('readMany - no results', async () => {
		const { at, path, get } = store;
		const payload = {
			pathPrefix: 'test',
			idKey: 'id',
			config: {
				template: () => {},
				read: async () => {
					return { data: [], status: ResourceResponseStatus.success };
				}
			},
			batchId: 'batchId',
			action: 'action',
			type: 'type'
		};
		const operations = await readMany({ at, get, path, payload });
		assert.deepEqual(operations, [
			replace(path(metaPath, 'actions', 'read', 'many', 'status'), 'completed'),
			replace(path('test', 'order', 'batchId'), [])
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
					return { data: [{ id: 'a' }, { id: 'b' }], status: ResourceResponseStatus.success };
				}
			},
			batchId: 'batch-Id',
			action: 'action',
			type: 'type'
		};
		const operations = await readMany({ at, get, path, payload });

		const aSynthId = (operations[0] as ReplacePatchOperation).value;
		const bSynthId = (operations[3] as ReplacePatchOperation).value;
		assert.deepEqual(operations, [
			replace(path('test', 'idMap', 'a'), aSynthId),
			replace(path('test', 'data', aSynthId), { id: 'a' }),
			replace(path(metaPath, 'items', aSynthId), {
				status: 'completed',
				action: 'read',
				log: {}
			}),
			replace(path('test', 'idMap', 'b'), bSynthId),
			replace(path('test', 'data', bSynthId), { id: 'b' }),
			replace(path(metaPath, 'items', bSynthId), {
				status: 'completed',
				action: 'read',
				log: {}
			}),
			replace(path(metaPath, 'actions', 'read', 'many', 'status'), 'completed'),
			replace(path('test', 'order', 'batch-Id'), [aSynthId, bSynthId])
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
					return { data: [], status: ResourceResponseStatus.failed };
				}
			},
			batchId: 'batchId',
			action: 'action',
			type: 'type'
		};
		try {
			await readMany({ at, get, path, payload });
			assert.fail('Should throw error for failed `read`');
		} catch (e) {
			assert.strictEqual(e.message, 'Read many operation failed');
		}
	});
});
