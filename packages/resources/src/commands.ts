import { isThenable } from '@dojo/framework/shim/Promise';
import { ResourceState } from './interfaces';
import { Command, createCommandFactory } from '@dojo/framework/stores/process';
import { replace } from '@dojo/framework/stores/state/operations';
import { uuid } from '@dojo/framework/core/util';
import { PatchOperation } from '@dojo/framework/stores/state/Patch';
import { ResourceConfig, ManyResourceResponse } from './provider';
import { StatePaths, Path } from '@dojo/framework/stores/Store';

export interface ReadManyPayload {
	pathPrefix: string;
	batchId: string;
	config: ResourceConfig<any>;
	idKey: string;
	action: string;
	initiator: string;
	type: string;
	pagination?: {
		offset: number;
		size: number;
	};
}

export interface FailedResourcePayload {
	initiator: string;
	pathPrefix: string;
	action: string;
	type: string;
}

export interface InitResourcePayload {
	pathPrefix: string;
}

export interface PrevPagePayload {
	pathPrefix: string;
	initiator: string;
}

export interface NextPagePayload {
	pathPrefix: string;
	initiator: string;
}

export interface GotoPagePayload {
	pathPrefix: string;
	initiator: string;
	page: number;
}

const createCommand = createCommandFactory<ResourceState>();

function createMetaStatuses() {
	return {
		loading: [],
		failed: [],
		completed: []
	};
}

export const initializeResource: Command<ResourceState, InitResourcePayload> = createCommand<InitResourcePayload>(
	({ get, path, at, payload }) => {
		const { pathPrefix } = payload;
		const resourceData = get(path(pathPrefix, 'meta', 'actions'));
		if (resourceData) {
			return [];
		}
		return [
			replace(path(pathPrefix, 'meta', 'actions'), {
				read: {
					many: createMetaStatuses()
				}
			})
		];
	}
);

export const beforeReadMany: Command<ResourceState, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ get, path, at, payload }) => {
		const { pathPrefix, initiator, pagination } = payload;
		const metaPath = path(pathPrefix, 'meta');

		const initiators = get(path(metaPath, 'actions', 'read', 'many', 'loading')) || [];
		initiators.push(initiator);
		const loadingOp = replace(path(metaPath, 'actions', 'read', 'many', 'loading'), initiators);
		if (pagination) {
			return [loadingOp, replace(path(metaPath, 'pagination', initiator), pagination)];
		}
		return [loadingOp];
	}
);

function processReadMany(
	result: ManyResourceResponse,
	payload: ReadManyPayload,
	path: StatePaths<ResourceState>,
	get: <S>(path: Path<ResourceState, S>) => S
) {
	const { idKey, config, pathPrefix, batchId, initiator, pagination } = payload;
	const metaPath = path(pathPrefix, 'meta');
	const { template } = config;

	if (!result.success) {
		throw new Error('Read many operation failed');
	}

	const batchIds: string[] = [];
	let operations: PatchOperation[] = [];
	result.data.forEach((item: any) => {
		const syntheticId = uuid();
		batchIds.push(syntheticId);
		operations.push(replace(path(pathPrefix, 'idMap', item[idKey]), syntheticId));
		operations.push(replace(path(pathPrefix, 'data', syntheticId), template(item)));
		operations.push(replace(path(metaPath, 'items', syntheticId, 'read', 'completed'), [initiator]));
	});

	let loadingInitiators = get(path(metaPath, 'actions', 'read', 'many', 'loading')) || [];
	loadingInitiators = [...loadingInitiators];
	let completedInitiators = get(path(metaPath, 'actions', 'read', 'many', 'completed')) || [];
	const index = loadingInitiators.indexOf(initiator);
	loadingInitiators.splice(index, 1);
	completedInitiators.push(initiator);

	operations = [
		...operations,
		replace(path(metaPath, 'actions', 'read', 'many', 'loading'), loadingInitiators),
		replace(path(metaPath, 'actions', 'read', 'many', 'completed'), completedInitiators)
	];

	if (pagination) {
		const { offset, size } = pagination;
		const paginationIds = {
			pages: {
				[`page-${offset}`]: batchIds
			},
			total: result.total
		};
		return [
			...operations,
			replace(path(pathPrefix, 'pagination', `size-${size}`), paginationIds),
			replace(path(pathPrefix, 'meta', 'pagination', initiator, 'total'), result.total)
		];
	}

	return [...operations, replace(path(pathPrefix, 'order', batchId), batchIds)];
}

export const readMany: Command<ResourceState, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ path, payload, get }) => {
		const {
			config: { read },
			pagination
		} = payload;
		const result = read(pagination ? { offset: pagination.offset, size: pagination.size } : undefined);

		if (isThenable(result)) {
			return result.then((response) => processReadMany(response, payload, path, get));
		}

		return processReadMany(result, payload, path, get);
	}
);

export const nextPage: Command<ResourceState, NextPagePayload> = createCommand<NextPagePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, initiator } = payload;
		const currentPagination = get(path(pathPrefix, 'meta', 'pagination', initiator));
		const newOffset =
			currentPagination.offset + currentPagination.size > currentPagination.total
				? currentPagination.offset + currentPagination.size
				: currentPagination.total - currentPagination.size;

		return [
			replace(path(pathPrefix, 'meta', 'pagination', initiator), {
				offset: newOffset,
				size: currentPagination.size,
				total: currentPagination.total,
				start: currentPagination.start
			})
		];
	}
);

export const prevPage: Command<ResourceState, PrevPagePayload> = createCommand<PrevPagePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, initiator } = payload;
		const currentPagination = get(path(pathPrefix, 'meta', 'pagination', initiator));
		const newOffset =
			currentPagination.offset - currentPagination.size > 0
				? 0
				: currentPagination.offset - currentPagination.size;

		return [
			replace(path(pathPrefix, 'meta', 'pagination', initiator), {
				offset: newOffset,
				size: currentPagination.size,
				total: currentPagination.total,
				start: currentPagination.start
			})
		];
	}
);

export const gotoPage: Command<ResourceState, GotoPagePayload> = createCommand<GotoPagePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, initiator, page } = payload;
		const currentPagination = get(path(pathPrefix, 'meta', 'pagination', initiator));
		let newOffset = page * currentPagination.size;
		if (newOffset < 0) {
			newOffset = 0;
		} else if (newOffset > currentPagination.total) {
			newOffset = currentPagination.total - currentPagination.size;
		}
		return [
			replace(path(pathPrefix, 'meta', 'pagination', initiator), {
				offset: newOffset,
				size: currentPagination.size,
				total: currentPagination.total,
				start: currentPagination.start
			})
		];
	}
);

export const failedResource: Command<ResourceState, FailedResourcePayload> = createCommand<FailedResourcePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, type, action, initiator } = payload;
		const actionsPath = path(pathPrefix, 'meta', 'actions');

		let failedInitiators = get(path(actionsPath, 'read', 'many', 'failed')) || [];
		let loadingInitiators = get(path(actionsPath, 'read', 'many', 'completed')) || [];
		loadingInitiators = [...loadingInitiators];
		const index = loadingInitiators.indexOf(initiator);
		loadingInitiators.splice(index, 1);
		failedInitiators.push(initiator);

		return [
			replace(path(actionsPath, action as any, type, 'loading'), loadingInitiators),
			replace(path(actionsPath, action as any, type, 'failed'), failedInitiators)
		];
	}
);
