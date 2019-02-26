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

export interface Pagination {
	ids: string[];
	total: number;
}

export interface ResourceMetaActionStatus {
	loading: string[];
	failed: string[];
	completed: string[];
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
		pagination: {
			[index: string]: Pagination;
		};
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
// 	pagination: {
//		'stringified-pagination-options': {
//			ids: [ '2', '3' ],
//			total: 200
//		}
// },
// 	meta: {
// 		actions: {
// 			read: {
// 				one: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
// 				},
// 				many: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
// 				}
// 			},
// 			create: {
// 				one: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
// 				},
// 				many: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
// 				}
// 			}
// 		},
// 		items: {
// 			'1': {
//				create: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//					'action-id': {
//						'result': {}
//					}
//				},
//				update: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				},
//				remove: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				},
//				read: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//					'action-id': {
//						'status': 'loading',
//						'result': {}
//					}
//				}
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

//
