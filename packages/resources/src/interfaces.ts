import { Status, Action } from './provider';

export interface ResourceData<S> {
	[index: string]: S;
}

export interface ResourceIdMap {
	[index: string]: string;
}

export interface ResourceOrder {
	[index: string]: string[];
}

export interface ResourceMetaActionStatus {
	status: Status;
}

export interface ResourceMetaActionType {
	one: ResourceMetaActionStatus;
	many: ResourceMetaActionStatus;
}

export interface ResourceMetaActions {
	read: ResourceMetaActionType;
	create: ResourceMetaActionType;
	update: ResourceMetaActionType;
	remove: ResourceMetaActionType;
}

export interface ResourceMetaItem {
	status: Status;
	action: Action;
	log: {
		[index: string]: {
			result: any;
			action: string;
		};
	};
}

export interface ResourceMetaItems {
	[index: string]: ResourceMetaItem;
}

export interface ResourceMetaState {
	status: string;
	items: ResourceMetaItems;
	actions: ResourceMetaActions;
}

export interface ResourceState<S> {
	'resource-log': any;
	[index: string]: {
		data: ResourceData<S>;
		idMap: ResourceIdMap;
		order: ResourceOrder;
		meta: ResourceMetaState;
	};
}

// status(): string

// const a: ResourceState<any> = {
// 	data: {
// 		'1': { id: 'blah', title: 'title' },
// 		'2': { id: 'foo', title: 'title-2' },
// 		'3': { id: 'bar', title: 'title-3' }
// 	},
// 	idMap: {
// 		blah: '1',
// 		foo: '2'
// 	},
// 	order: {
// 		'order-id': ['2', '3'],
// 		'order-is': '1'
// 	},
// 	meta: {
// 		actions: {
// 			read: {
// 				one: {
// 					status: 'loading'
// 				},
// 				many: {
// 					status: 'completed'
// 				}
// 			},
// 			create: {
// 				one: {
// 					status: 'loading'
// 				},
// 				many: {
// 					status: 'loading'
// 				}
// 			}
// 		},
// 		items: {
// 			'1': {
//				create: {
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					},
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				},
//				update: {
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				},
//				remove: {
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				},
//				read: {
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				}
// 			},
// 			'2': {
// 				status: 'failed',
// 				action: 'create'
// 			}
// 		},
// 		items: {
// 			'1': {
// 				status: 'loading',
// 				action: 'create',
//				logs: {
//					'action-id': {
//						'result': {}
//					}
//				}
// 			},
// 			'2': {
// 				status: 'failed',
// 				action: 'create'
// 			}
// 		}
// 	}
// };

// Assuming Optimistic Actions

// create -> update ----> collect the results and apply oldest newest from server.
// update -> update ----> collect the results and apply oldest newest from server.
// create -> delete ----> deleted item is removed so cannot be updated.
// update -> delete ----> deleted item is removed so cannot be updated.

// read many ----> fails ----> return empty and status is to failed
// create one ----> fails ----> optimistically added to
// retry (action, id) ----> re-run clear the status - re-run the action
