import { isThenable } from '@dojo/framework/shim/Promise';
import { ResourceState } from './interfaces';
import { Command, createCommandFactory } from '@dojo/framework/stores/process';
import { replace } from '@dojo/framework/stores/state/operations';
import { uuid } from '@dojo/framework/core/util';
import { PatchOperation } from '@dojo/framework/stores/state/Patch';
import { ResourceConfig, ManyResourceResponse } from './provider';
import { StatePaths } from '@dojo/framework/stores/Store';

export interface ReadManyPayload {
	pathPrefix: string;
	batchId: string;
	config: ResourceConfig<any>;
	idKey: string;
	action: string;
	type: string;
}

export interface FailedResourcePayload {
	pathPrefix: string;
	action: string;
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

function processReadMany(
	result: ManyResourceResponse<any>,
	payload: ReadManyPayload,
	path: StatePaths<ResourceState<any>>
) {
	const { idKey, config, pathPrefix, batchId } = payload;
	const metaPath = path(pathPrefix, 'meta');
	const { template } = config;

	if (!result.success) {
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

export const readMany: Command<ResourceState<any>, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ path, payload }) => {
		const {
			config: { read }
		} = payload;
		const result = read();

		if (isThenable(result)) {
			return result.then((response) => processReadMany(response, payload, path));
		}

		return processReadMany(result, payload, path);
	}
);

export const failedResource: Command<ResourceState<any>, FailedResourcePayload> = createCommand<FailedResourcePayload>(
	({ path, payload }) => {
		const { pathPrefix, type, action }: any = payload;
		const metaPath = path(pathPrefix, 'meta');
		return [replace(path(metaPath, 'actions', action, type, 'status'), 'failed')];
	}
);
