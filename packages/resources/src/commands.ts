import { StatePaths, Path } from '@dojo/framework/stores/Store';
import { ResourceState, ResourceConfig, ResourceResponseStatus } from './interfaces';
import { Command, createCommandFactory } from '@dojo/framework/stores/process';
import { replace } from '@dojo/framework/stores/state/operations';
import { uuid } from '@dojo/framework/core/util';
import { PatchOperation } from '@dojo/framework/stores/state/Patch';

export interface ReadManyPayload {
	pathPrefix: string;
	batchId: string;
	config: ResourceConfig<any>;
	idKey: string;
	type: string;
}

const createCommand = createCommandFactory<ResourceState<any>>();

export function getSynthId(
	get: <S>(path: Path<ResourceState<any>, S>) => S,
	path: StatePaths<ResourceState<any>>,
	pathPrefix: any,
	id: string
) {
	return get(path(pathPrefix, 'idMap', id)) || id;
}

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
			operations.push(replace(path(pathPrefix, 'data', syntheticId), template(item)));
			operations.push(replace(path(pathPrefix, 'idMap', item[idKey]), syntheticId));
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
