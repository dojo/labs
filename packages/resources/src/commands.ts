import { isThenable } from '@dojo/framework/shim/Promise';
import { ResourceState } from './interfaces';
import { Command, createCommandFactory } from '@dojo/framework/stores/process';
import { replace } from '@dojo/framework/stores/state/operations';
import { uuid } from '@dojo/framework/core/util';
import { PatchOperation } from '@dojo/framework/stores/state/Patch';
import { ResourceConfig, ManyResourceResponse, PaginationOptions } from './provider';
import { StatePaths, Path } from '@dojo/framework/stores/Store';

export interface ReadManyPayload {
	pathPrefix: string;
	batchId: string;
	config: ResourceConfig<any>;
	idKey: string;
	action: string;
	initiator: string;
	type: string;
	pagination?: PaginationOptions;
}

export interface FailedResourcePayload {
	pathPrefix: string;
	action: string;
	type: string;
}

const createCommand = createCommandFactory<ResourceState<any>>();

export const beforeReadMany: Command<ResourceState<any>, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ get, path, at, payload }) => {
		const { pathPrefix, initiator } = payload;
		const metaPath = path(pathPrefix, 'meta');

		const initiators = get(path(metaPath, 'actions', 'read', 'many', 'loading')) || [];
		initiators.push(initiator);
		return [replace(path(metaPath, 'actions', 'read', 'many', 'loading'), initiators)];
	}
);

function processReadMany(
	result: ManyResourceResponse<any>,
	payload: ReadManyPayload,
	path: StatePaths<ResourceState<any>>,
	get: <S>(path: Path<ResourceState<any>, S>) => S
) {
	const { idKey, config, pathPrefix, batchId, initiator, pagination } = payload;
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

	let loadingInitiators = get(path(metaPath, 'actions', 'read', 'many', 'loading')) || [];
	loadingInitiators = [...loadingInitiators];
	let completedInitiators = get(path(metaPath, 'actions', 'read', 'many', 'completed')) || [];
	const index = loadingInitiators.indexOf(initiator);
	loadingInitiators.splice(index, 1);
	completedInitiators.push(initiator);

	return [
		...operations,
		replace(path(metaPath, 'actions', 'read', 'many', 'loading'), loadingInitiators),
		replace(path(metaPath, 'actions', 'read', 'many', 'completed'), completedInitiators),
		pagination
			? replace(path(pathPrefix, 'pagination', JSON.stringify(pagination)), {
					ids: batchIds,
					total: result.total
			  })
			: replace(path(pathPrefix, 'order', batchId), batchIds)
	];
}

export const readMany: Command<ResourceState<any>, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ path, payload, get }) => {
		const {
			config: { read },
			pagination
		} = payload;
		const result = read(pagination);

		if (isThenable(result)) {
			return result.then((response) => processReadMany(response, payload, path, get));
		}

		return processReadMany(result, payload, path, get);
	}
);

export const failedResource: Command<ResourceState<any>, FailedResourcePayload> = createCommand<FailedResourcePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, type, action, initiator }: any = payload;
		const metaPath = path(pathPrefix, 'meta');

		let failedInitiators = get(path(metaPath, 'actions', 'read', 'many', 'failed')) || [];
		let loadingInitiators = get(path(metaPath, 'actions', 'read', 'many', 'completed')) || [];
		loadingInitiators = [...loadingInitiators];
		const index = loadingInitiators.indexOf(initiator);
		loadingInitiators.splice(index, 1);
		failedInitiators.push(initiator);

		return [
			replace(path(metaPath, 'actions', action, type, 'loading'), loadingInitiators),
			replace(path(metaPath, 'actions', action, type, 'failed'), failedInitiators)
		];
	}
);
