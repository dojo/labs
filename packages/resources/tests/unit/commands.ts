const { describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import Store from '@dojo/framework/stores/Store';
import { Pointer } from '@dojo/framework/stores/state/Pointer';
import { beforeReadMany, readMany } from '../../src/commands';
import { ResourceResponseStatus } from '../../src/ResourceProvider';
import { ReplacePatchOperation } from '@dojo/framework/stores/state/Patch';

const store = new Store();

describe('commands', () => {
	it('beforeReadMany', () => {
		const { at, path, get } = store;
		const operations = beforeReadMany({ at, get, path, payload: { pathPrefix: 'test' } as any});
		assert.deepEqual<any>(operations, [
			{ op: 'replace', path: new Pointer('/test/meta/actions/read/many/status'), value: 'loading'}
		]);
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
			type: 'type'
		};
		const operations = await readMany({ at, get, path, payload});
		assert.deepEqual<any>(operations, [
			{ op: 'replace', path: new Pointer('/test/meta/actions/read/many/status'), value: 'completed'},
			{ op: 'replace', path: new Pointer('/test/order/batchId'), value: []}
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
					return { data: [{id: 'a' }, { id: 'b' }], status: ResourceResponseStatus.success };
				}
			},
			batchId: 'batch-Id',
			type: 'type'
		};
		const operations = await readMany({ at, get, path, payload});

		const aSynthId = (operations[0] as ReplacePatchOperation).value;
		const bSynthId = (operations[3] as ReplacePatchOperation).value;
		assert.deepEqual<any>(operations, [
			{ op: 'replace', path: new Pointer('/test/idMap/a'), value: aSynthId},
			{ op: 'replace', path: new Pointer(`/test/data/${aSynthId}`), value: {id: 'a' }},
			{ op: 'replace', path: new Pointer(`/test/meta/items/${aSynthId}`), value: {
				"status": "completed",
				"action": "read",
				"log": {}
			}},
			{ op: 'replace', path: new Pointer('/test/idMap/b'), value: bSynthId},
			{ op: 'replace', path: new Pointer(`/test/data/${bSynthId}`), value: {id: 'b' }},
			{ op: 'replace', path: new Pointer(`/test/meta/items/${bSynthId}`), value: {
				"status": "completed",
				"action": "read",
				"log": {}
			}},
			{ op: 'replace', path: new Pointer('/test/meta/actions/read/many/status'), value: 'completed'},
			{ op: 'replace', path: new Pointer('/test/order/batch-Id'), value: [aSynthId, bSynthId]}
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
			type: 'type'
		};
		try {
			await readMany({ at, get, path, payload});
			assert.fail('Should throw error for failed `read`');
		} catch (e) {
			assert.strictEqual(e.message, 'Read many operation failed');
		}
	});
});
