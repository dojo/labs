import { ResourceState } from './interfaces';
import { Command, createCommandFactory } from '@dojo/framework/stores/process';
import { replace } from '@dojo/framework/stores/state/operations';
import { uuid } from './uuid';
import { PatchOperation } from '@dojo/framework/stores/state/Patch';
import { ResourceConfig, ResourceResponseStatus } from './ResourceProvider';

export interface ReadManyPayload {
	pathPrefix: string;
	batchId: string;
	config: ResourceConfig<any>;
	idKey: string;
	type: string;
}

const createCommand = createCommandFactory<ResourceState<any>>();

export const beforeReadMany: Command<ResourceState<any>, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ get, path, at, payload }) => {
		const { pathPrefix } = payload;
		const metaPath = path(pathPrefix, 'meta');

		return [replace(path(metaPath, 'actions', 'read', 'many', 'status'), 'loading')];
	}
);

export const readMany: Command<ResourceState<any>, ReadManyPayload> = createCommand<ReadManyPayload>(
	async ({ path, payload }) => {
		const { idKey, config, pathPrefix, batchId } = payload;
		const { template, read } = config;

		const metaPath = path(pathPrefix, 'meta');
		const result = await read();

		if (result.status === ResourceResponseStatus.failed) {
			throw new Error('Read many operation failed');
		}

		const batchIds: string[] = [];
		const operations: PatchOperation[] = [];
		result.data.forEach((item: any) => {
			const syntheticId = uuid();
			batchIds.push(syntheticId);
			operations.push(replace(path(pathPrefix, 'idMap', item[idKey]), syntheticId));
			operations.push(replace(path(pathPrefix, 'data', syntheticId), template(item)));
			operations.push(
				replace(path(metaPath, 'items', syntheticId), { status: 'completed', action: 'read', log: {} })
			);
		});

		return [
			...operations,
			replace(path(metaPath, 'actions', 'read', 'many', 'status'), 'completed'),
			replace(path(pathPrefix, 'order', batchId), batchIds)
		];
	}
);
