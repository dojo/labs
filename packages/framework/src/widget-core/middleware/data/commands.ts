import { isThenable } from '@dojo/framework/shim/Promise';
import { ResourceState, ResourceIdMap, ResourceData, ResourceMetaItems } from './interfaces';
import { Command, createCommandFactory } from '@dojo/framework/stores/process';
import { replace } from '@dojo/framework/stores/state/operations';
import { uuid } from '@dojo/framework/core/util';
import { ResourceConfig, ManyResourceResponse } from './index';
import { StatePaths, Path } from '@dojo/framework/stores/Store';
import { PatchOperation } from '@dojo/framework/stores/state/Patch';

export interface PaginationPayload {
	offset: number;
	size: number;
	start: number;
}

export interface ReadManyPayload {
	options?: any;
	pathPrefix: string;
	batchId: string;
	config: ResourceConfig<any>;
	idKey: string;
	action: string;
	initiator: string;
	type: string;
	pagination?: PaginationPayload;
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
	({ get, path, payload }) => {
		const { pathPrefix, initiator, pagination } = payload;
		const metaPath = path(pathPrefix, 'meta');

		let initiators = get(path(metaPath, 'actions', 'read', 'many', 'loading')) || [];
		initiators = [...initiators, initiator];
		const loadingOp = replace(path(metaPath, 'actions', 'read', 'many', 'loading'), initiators);
		const paginationMeta = get(path(metaPath, 'pagination', 'current', initiator));
		if (pagination) {
			const paginationOperation = replace(path(metaPath, 'pagination', 'current', initiator), {
				...paginationMeta,
				...pagination
			});
			return [loadingOp, paginationOperation];
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
	let idMap: ResourceIdMap = {};
	let data: ResourceData<any> = {};
	let metaItems: ResourceMetaItems = {};
	let operations: PatchOperation[] = [];
	if (result.data.length) {
		result.data.forEach((item: any) => {
			const syntheticId = uuid();
			batchIds.push(syntheticId);
			idMap[item[idKey]] = syntheticId;
			data[syntheticId] = template(item);
			metaItems[syntheticId] = {
				read: {
					completed: [initiator],
					loading: [],
					failed: []
				}
			};
		});

		let currentItems = get(path(metaPath, 'items')) as any;
		let currentData = get(path(pathPrefix, 'data'));
		let currentIdMap = get(path(pathPrefix, 'idMap'));
		operations = [
			replace(path(metaPath, 'items'), { ...currentItems, ...metaItems }),
			replace(path(pathPrefix, 'data'), { ...currentData, ...data }),
			replace(path(pathPrefix, 'idMap'), { ...currentIdMap, ...idMap })
		];
	}

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
		const currentPages = get(path(pathPrefix, 'meta', 'pagination', 'loadedPages')) || [];
		return [
			...operations,
			replace(path(pathPrefix, 'meta', 'pagination', 'loadedPages'), [
				...currentPages,
				`size-${size}-offset-${offset}`
			]),
			replace(path(path(pathPrefix, 'pagination'), `size-${size}`, 'pages', `page-${offset}`), batchIds),
			replace(path(path(pathPrefix, 'pagination'), `size-${size}`, 'total'), result.total || 1000000000),
			replace(path(path(pathPrefix, 'meta'), 'pagination', 'current', initiator, 'total'), result.total)
		];
	}

	return [...operations, replace(path(pathPrefix, 'order'), { [batchId]: batchIds })];
}

export const readMany: Command<ResourceState, ReadManyPayload> = createCommand<ReadManyPayload>(
	({ path, payload, get }) => {
		const {
			config: { read },
			pagination,
			options
		} = payload;
		const result = read(options, pagination ? { offset: pagination.offset, size: pagination.size } : undefined);

		if (isThenable(result)) {
			return result.then((response) => processReadMany(response, payload, path, get));
		}

		return processReadMany(result, payload, path, get) as any;
	}
);

export const nextPage: Command<ResourceState, NextPagePayload> = createCommand<NextPagePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, initiator } = payload;
		const currentPagination = get(path(pathPrefix, 'meta', 'pagination', 'current', initiator));
		let newOffset = currentPagination.offset + currentPagination.size;
		if (newOffset >= currentPagination.total) {
			const remainder = currentPagination.total % currentPagination.size || currentPagination.size;
			newOffset = currentPagination.total - remainder;
		}

		return [
			replace(path(pathPrefix, 'meta', 'pagination', 'current', initiator), {
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
		const currentPagination = get(path(pathPrefix, 'meta', 'pagination', 'current', initiator));
		const newOffset =
			currentPagination.offset - currentPagination.size < 0
				? 0
				: currentPagination.offset - currentPagination.size;

		return [
			replace(path(pathPrefix, 'meta', 'pagination', 'current', initiator), {
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
		const currentPagination = get(path(pathPrefix, 'meta', 'pagination', 'current', initiator));
		let newOffset = (page - 1) * currentPagination.size;
		if (newOffset < 0) {
			newOffset = 0;
		} else if (newOffset >= currentPagination.total) {
			const remainder = currentPagination.total % currentPagination.size || currentPagination.size;
			newOffset = currentPagination.total - remainder;
		}
		return [
			replace(path(pathPrefix, 'meta', 'pagination', 'current', initiator), {
				offset: newOffset,
				size: currentPagination.size,
				total: currentPagination.total,
				start: currentPagination.start
			})
		];
	}
);

export const invalidatePagination: Command<ResourceState, any> = createCommand<any>(({ path, payload, get }) => {
	const { pathPrefix } = payload;

	return [replace(path(pathPrefix, 'meta', 'pagination', 'loadedPages'), [])];
});

export const failedResource: Command<ResourceState, FailedResourcePayload> = createCommand<FailedResourcePayload>(
	({ path, payload, get }) => {
		const { pathPrefix, type, action, initiator } = payload;
		const actionsPath = path(pathPrefix, 'meta', 'actions');

		let failedInitiators = get(path(actionsPath, 'read', 'many', 'failed'));
		let loadingInitiators = get(path(actionsPath, 'read', 'many', 'completed'));
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
