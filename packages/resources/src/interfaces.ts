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
	[index: string]: PaginationResult;
}

export interface PaginationResult {
	total: number;
	pages: {
		[index: string]: string[];
	};
}

export interface ResourceMetaActionStatus {
	loading: string[];
	failed: string[];
	completed: string[];
}

export interface ResourceMetaActionType {
	many: ResourceMetaActionStatus;
}

export interface ResourceMetaActions {
	read: ResourceMetaActionType;
}

export interface ResourceMetaItem {
	read: ResourceMetaActionStatus;
}

export interface ResourceMetaItems {
	[index: string]: ResourceMetaItem;
}

export interface PaginationDetails {
	offset: number;
	size: number;
	total: number;
	start: number;
}

export interface PaginationMeta {
	loadedPages: string[];
	current: {
		[index: string]: PaginationDetails;
	};
}

export interface ResourceMetaState {
	status: string;
	items: ResourceMetaItems;
	actions: ResourceMetaActions;
	pagination: PaginationMeta;
}

export interface ResourceState<S = any> {
	[index: string]: {
		data: ResourceData<S>;
		idMap: ResourceIdMap;
		pagination: Pagination;
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
//		'size-20': {
//			'total': 200,
//			'pages': {
//				'page-1': [ '2', '3' ]
//			}
//		}
// },
// 	meta: {
//		pagination: {
//			initiator: {
//				offset: 20,
//				size:
//			}
//		}
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
//				log: {
//					action-id: {
//						result: {}
//					}
//				},
//				create: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//				},
//				update: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//				},
//				remove: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
//				},
//				read: {
// 					'loading': [ 'initiator-id' ],
// 					'failed': [ 'initiator-id' ],
// 					'completed': [ 'initiator-id' ]
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
