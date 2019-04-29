import {
	Constructor,
	DNode,
	WidgetResult,
	MiddlewareMap,
	WidgetResultWithMiddleware,
	WidgetCallback,
	UnionToIntersection,
	MiddlewareCallback,
	MiddlewareResult,
	WNodeFactory,
	DeferredVirtualProperties,
	WNode,
	VNodeProperties,
	VNode,
	WidgetBaseTypes,
	RegistryLabel,
	LazyDefine,
	DomVNode
} from './interfaces';
import { WIDGET_BASE_TYPE } from '@dojo/framework/widget-core/Registry';

declare global {
	namespace JSX {
		type Element = WNode;
		interface ElementAttributesProperty {
			properties: {};
		}
		interface IntrinsicElements {
			[key: string]: VNodeProperties;
		}
	}
}

/**
 * The identifier for a WNode type
 */
export const WNODE = '__WNODE_TYPE';

/**
 * The identifier for a VNode type
 */
export const VNODE = '__VNODE_TYPE';

/**
 * The identifier for a VNode type created using dom()
 */
export const DOMVNODE = '__DOMVNODE_TYPE';

/**
 * Helper function that returns true if the `DNode` is a `WNode` using the `type` property
 */
export function isWNode(child: DNode | any): child is WNode<any> {
	return Boolean(child && child !== true && typeof child !== 'string' && child.type === WNODE);
}

/**
 * Helper function that returns true if the `DNode` is a `VNode` using the `type` property
 */
export function isVNode(child: DNode): child is VNode {
	return Boolean(
		child && child !== true && typeof child !== 'string' && (child.type === VNODE || child.type === DOMVNODE)
	);
}

export function isDomVNode(child: DNode): child is DomVNode {
	return Boolean(child && child !== true && typeof child !== 'string' && child.type === DOMVNODE);
}

export const REGISTRY_ITEM = '__registry_item';

export class FromRegistry<P> {
	static type = REGISTRY_ITEM;
	properties: P = {} as P;
	name: string | undefined;
}

export function fromRegistry<P>(tag: string): Constructor<FromRegistry<P>> {
	return class extends FromRegistry<P> {
		properties: P = {} as P;
		static type = REGISTRY_ITEM;
		name = tag;
	};
}

export function isWidgetBaseConstructor(item: any): item is Constructor<any> {
	return Boolean(item && item._type === WIDGET_BASE_TYPE);
}

export function isWidget(item: any): item is Constructor<any> | WidgetCallback<any, any, any> {
	return Boolean(item && item._type === WIDGET_BASE_TYPE) || item.isWidget === true;
}

export function isWNodeFactory<W extends WidgetBaseTypes>(node: any): node is WNodeFactory<W> {
	if (typeof node === 'function' && node.isFactory) {
		return true;
	}
	return false;
}

function spreadChildren(children: any[], child: any): any[] {
	if (Array.isArray(child)) {
		return child.reduce(spreadChildren, children);
	} else {
		return [...children, child];
	}
}

export function w<W extends WidgetBaseTypes>(
	node: WNode<W>,
	properties: Partial<W['properties']>,
	children?: W['children']
): WNode<W>;
export function w<W extends WidgetBaseTypes>(
	widgetConstructor: Constructor<W> | RegistryLabel | WNodeFactory<W> | LazyDefine<W>,
	properties: W['properties'],
	children?: W['children']
): WNode<W>;
export function w<W extends WidgetBaseTypes>(
	widgetConstructorOrNode:
		| Constructor<W>
		| RegistryLabel
		| WNodeFactory<W>
		| WidgetCallback<any, any, any>
		| WNode<W>
		| LazyDefine<W>,
	properties: W['properties'],
	children?: W['children']
): WNode<{ properties: W['properties']; children: W['children'] }> {
	if (isWNodeFactory<W>(widgetConstructorOrNode)) {
		return widgetConstructorOrNode(properties, children);
	}

	if (isWNode(widgetConstructorOrNode)) {
		properties = { ...(widgetConstructorOrNode.properties as any), ...(properties as any) };
		children = children ? children : widgetConstructorOrNode.children;
		widgetConstructorOrNode = widgetConstructorOrNode.widgetConstructor;
	}

	return {
		children: children || [],
		widgetConstructor: widgetConstructorOrNode,
		properties,
		type: WNODE
	};
}

/**
 * Wrapper function for calls to create VNodes.
 */
export function v(node: VNode, properties: VNodeProperties, children: undefined | DNode[]): VNode;
export function v(node: VNode, properties: VNodeProperties): VNode;
export function v(tag: string, children: undefined | DNode[]): VNode;
export function v(tag: string, properties: DeferredVirtualProperties | VNodeProperties, children?: DNode[]): VNode;
export function v(tag: string): VNode;
export function v(
	tag: string | VNode,
	propertiesOrChildren: VNodeProperties | DeferredVirtualProperties | DNode[] = {},
	children: undefined | DNode[] = undefined
): VNode {
	let properties: VNodeProperties | DeferredVirtualProperties = propertiesOrChildren;
	let deferredPropertiesCallback;

	if (Array.isArray(propertiesOrChildren)) {
		children = propertiesOrChildren;
		properties = {};
	}

	if (typeof properties === 'function') {
		deferredPropertiesCallback = properties;
		properties = {};
	}

	if (isVNode(tag)) {
		let { classes = [], styles = {}, ...newProperties } = properties;
		let { classes: nodeClasses = [], styles: nodeStyles = {}, ...nodeProperties } = tag.properties;
		nodeClasses = Array.isArray(nodeClasses) ? nodeClasses : [nodeClasses];
		classes = Array.isArray(classes) ? classes : [classes];
		styles = { ...nodeStyles, ...styles };
		properties = { ...nodeProperties, ...newProperties, classes: [...nodeClasses, ...classes], styles };
		children = children ? children : tag.children;
		tag = tag.tag;
	}

	return {
		tag,
		deferredPropertiesCallback,
		children,
		properties,
		type: VNODE
	};
}

export function tsx(tag: any, properties = {}, ...children: any[]): DNode {
	children = children.reduce(spreadChildren, []);
	properties = properties === null ? {} : properties;
	if (typeof tag === 'string') {
		return v(tag, properties, children);
	} else if (tag.type === 'registry' && (properties as any).__autoRegistryItem) {
		const name = (properties as any).__autoRegistryItem;
		delete (properties as any).__autoRegistryItem;
		return w(name, properties, children);
	} else if (tag.type === REGISTRY_ITEM) {
		const registryItem = new tag();
		return w(registryItem.name, properties, children);
	} else {
		return w(tag, properties, children);
	}
}

export function widget(): WidgetResult;
export function widget<T extends MiddlewareMap<any>, MiddlewareProps = T[keyof T]['properties']>(
	middlewares: T
): WidgetResultWithMiddleware<T, MiddlewareProps>;
export function widget<T extends MiddlewareMap<any>, MiddlewareProps = T[keyof T]['properties']>(
	middlewares?: any
): any {
	return function<Props, Children extends DNode[] = DNode[]>(
		callback: WidgetCallback<Props, T, MiddlewareProps>
	): WNodeFactory<{ properties: UnionToIntersection<Props & MiddlewareProps>; children: Children }> {
		const factory = (properties: any, children?: any) => {
			const result = w(callback as any, properties, children);
			(callback as any).isWidget = true;
			(callback as any).middlewares = middlewares;
			return result;
		};
		(factory as any).isFactory = true;
		return factory as WNodeFactory<{
			properties: UnionToIntersection<Props & MiddlewareProps>;
			children: Children;
		}>;
	};
}

export function middleware<Props>() {
	function createMiddleware<ReturnValue>(
		callback: MiddlewareCallback<Props, {}, ReturnValue>
	): MiddlewareResult<Props, {}, ReturnValue>;
	function createMiddleware<
		ReturnValue,
		Middleware extends MiddlewareMap<any>,
		MiddlewareProps = Middleware[keyof Middleware]['properties']
	>(
		middlewares: Middleware,
		callback: MiddlewareCallback<UnionToIntersection<Props & MiddlewareProps>, Middleware, ReturnValue>
	): MiddlewareResult<UnionToIntersection<Props & MiddlewareProps>, Middleware, ReturnValue>;
	function createMiddleware<
		ReturnValue,
		Middleware extends MiddlewareMap<any>,
		MiddlewareProps = Middleware[keyof Middleware]['properties']
	>(
		middlewares:
			| Middleware
			| MiddlewareCallback<UnionToIntersection<Props & MiddlewareProps>, Middleware, ReturnValue>,
		callback?: MiddlewareCallback<UnionToIntersection<Props & MiddlewareProps>, Middleware, ReturnValue>
	): any {
		if (callback) {
			return {
				middlewares,
				callback
			};
		}
		return {
			callback: middlewares
		};
	}

	return createMiddleware;
}
