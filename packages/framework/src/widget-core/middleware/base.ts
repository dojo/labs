import { createMiddlewareFactory } from '../tsx';
import { getNode, getInvalidator, properties as vdomProperties, destroy as vdomDestroy, getRegistry } from '../vdom';

const createFactory = createMiddlewareFactory();

export const dom = createFactory(({ id }) => {
	return (key: string | number): HTMLElement | null => {
		return getNode(id, key);
	};
});

export const invalidator = createFactory(({ id }) => {
	return () => getInvalidator(id);
});

export const properties = createFactory(({ id }) => {
	return (func: (props: { current: any; next: any }) => void) => {
		vdomProperties(id, func);
	};
});

export const destroy = createFactory(({ id }) => {
	return (func: () => void) => {
		vdomDestroy(id, func);
	};
});

export const registry = createFactory(({ id }) => {
	return () => {
		return getRegistry(id);
	};
});
