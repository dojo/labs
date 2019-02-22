const { it, describe, beforeEach } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import global from '@dojo/framework/shim/global';
import { restResourceConfig } from '../../src/RestResourceConfig';
import { ResourceResponseStatus } from '../../src/ResourceProvider';

describe('RestResourceConfig', () => {
	beforeEach(() => {
		global.fetch.reset();
	});

	describe('Default Configuration', () => {
		it('Should return the default configuration', async () => {
			const response = {
				ok: true,
				json: () => {
					return [{ id: '1' }];
				}
			};
			global.fetch.returns(response);
			const config = restResourceConfig({
				name: 'tests',
				origin: 'https://test.origin.com'
			});
			assert.strictEqual(config.idKey, 'id');
			assert.isFunction(config.template);
			assert.isFunction(config.read);
		});
	});

	describe('Read Many', () => {
		describe('Default', () => {
			it('Should call read function and return success payload from resource API', async () => {
				const response = {
					ok: true,
					json: () => {
						return [{ id: '1' }];
					}
				};
				global.fetch.returns(response);
				const config = restResourceConfig({
					name: 'tests',
					origin: 'https://test.origin.com'
				});
				const readResult = await config.read();
				assert.isTrue(global.fetch.calledOnce);
				assert.isTrue(
					global.fetch.calledWith('https://test.origin.com/tests', {
						method: 'GET',
						headers: { 'Content-Type': 'application/json' }
					})
				);
				assert.deepEqual(readResult, {
					data: [{ id: '1' }],
					status: ResourceResponseStatus.success
				});
			});
			it('Should call read function and return failure payload when resource request is not okay', async () => {
				const response = {
					ok: false
				};
				global.fetch.returns(response);
				const config = restResourceConfig({
					name: 'tests',
					origin: 'https://test.origin.com'
				});
				const readResult = await config.read();
				assert.isTrue(global.fetch.calledOnce);
				assert.deepEqual(readResult, {
					data: [],
					status: ResourceResponseStatus.failed
				});
			});
			it('Should call read function and return failure payload when an error is throw during the resource request', async () => {
				global.fetch.throws();
				const config = restResourceConfig({
					name: 'tests',
					origin: 'https://test.origin.com'
				});
				const readResult = await config.read();
				assert.isTrue(global.fetch.calledOnce);
				assert.deepEqual(readResult, {
					data: [],
					status: ResourceResponseStatus.failed
				});
			});
		});

		describe('Custom', () => {
			it('Should throw an error if read many is set to false', async () => {
				const config = restResourceConfig({
					name: 'tests',
					origin: 'https://test.origin.com',
					many: {
						read: false
					}
				});
				try {
					await config.read();
					assert.fail('should have thrown an error');
				} catch (error) {
					assert.strictEqual(error.message, 'ReadMany Resource Operation not supported for tests');
				}
			});

			it('Custom Read Resource', async () => {
				const response = {
					ok: true,
					json: () => {
						return [{ id: '1' }];
					}
				};
				global.fetch.returns(response);
				const config = restResourceConfig({
					name: 'tests',
					origin: 'https://test.origin.com',
					many: {
						read: {
							optimistic: true,
							url: ({ origin, name }) => {
								return `custom/${origin}/${name}`;
							},
							verb: 'GET'
						}
					}
				});
				const readResult = await config.read();
				assert.isTrue(global.fetch.calledOnce);
				assert.isTrue(
					global.fetch.calledWith('custom/https://test.origin.com/tests', {
						method: 'GET',
						headers: { 'Content-Type': 'application/json' }
					})
				);
				assert.deepEqual(readResult, {
					data: [{ id: '1' }],
					status: ResourceResponseStatus.success
				});
			});

			it('Custom idKey', async () => {
				const response = {
					ok: true,
					json: () => {
						return [{ id: '1' }];
					}
				};
				global.fetch.returns(response);
				const config = restResourceConfig({
					name: 'tests',
					origin: 'https://test.origin.com',
					idKey: 'special'
				});
				assert.strictEqual(config.idKey, 'special');
				assert.isFunction(config.template);
				assert.isFunction(config.read);
			});
		});
	});
});
