import { WIDGET_BASE_TYPE } from '@dojo/framework/widget-core/Registry';
import {
	WNode,
	DNode,
	Constructor,
	RegistryLabel,
	LazyDefine,
	WidgetBaseInterface,
	LazyWidget,
	DefaultWidgetBaseInterface,
	RenderResult,
	WidgetProperties
} from '@dojo/framework/widget-core/interfaces';
import { isWNode, WNODE, v } from '@dojo/framework/widget-core/d';
import { REGISTRY_ITEM } from '@dojo/framework/widget-core/tsx';
export { FromRegistry } from '@dojo/framework/widget-core/tsx';
export { v } from '@dojo/framework/widget-core/d';

export interface MiddlewareMap<Middleware extends { api: any; properties: any; children: any }> {
	[index: string]: Middleware;
}

export type MiddlewareApiMap<U extends MiddlewareMap<any>> = { [P in keyof U]: U[P]['api'] };

export interface MiddlewareCallback<Props, Middleware, ReturnValue> {
	(
		options: { id: string; middleware: MiddlewareApiMap<Middleware>; properties: Props }
	): ReturnValue;
}

export interface MiddlewareResult<Props, Middleware, ReturnValue> {
	api: ReturnValue;
	properties: Props;
	callback: MiddlewareCallback<Props, Middleware, ReturnValue>;
	middlewares: Middleware;
}

export interface WNodeFactory<W extends WidgetBaseTypes> {
	(properties: W['properties'], children?: W['children']): WNode<DefaultWidgetBaseInterface>;
}

export interface WidgetResultWithMiddleware<T, MiddlewareProps> {
	<Props, Children extends DNode[] = DNode[]>(
		callback: (
			options: {
				middleware: MiddlewareApiMap<T>;
				properties: UnionToIntersection<Props & MiddlewareProps>;
				children: DNode[];
			}
		) => RenderResult
	): WNodeFactory<{ properties: UnionToIntersection<Props & MiddlewareProps>; children: Children }>;
}

export interface WidgetResult {
	<Props, Children extends DNode[] = DNode[]>(
		callback: (
			options: {
				properties: Props;
				children: DNode[];
			}
		) => RenderResult
	): WNodeFactory<{ properties: Props; children: Children }>;
}

export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void)
	? I
	: never;

export interface WidgetCallback<Props, Middleware, MiddlewareProps> {
	(
		options: {
			middleware: MiddlewareApiMap<Middleware>;
			properties: UnionToIntersection<Props & MiddlewareProps>;
			children: DNode[];
		}
	): RenderResult;
}

export interface WidgetBaseTypes<P = WidgetProperties, C extends DNode = DNode> {
	readonly properties: P & WidgetProperties;
	readonly children: (C | null)[];
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

export function w<W extends WidgetBaseInterface>(
	node: WNode<W>,
	properties: Partial<W['properties']>,
	children?: W['children']
): WNode<W>;
export function w<W extends WidgetBaseInterface>(
	widgetConstructor: Constructor<W> | RegistryLabel | WNodeFactory<W> | LazyDefine<W>,
	properties: W['properties'],
	children?: W['children']
): WNode<W>;
export function w<W extends WidgetBaseInterface>(
	widgetConstructorOrNode:
		| Constructor<W>
		| RegistryLabel
		| WNodeFactory<W>
		| WNode<W>
		| LazyDefine<W>
		| LazyWidget<W>,
	properties: W['properties'],
	children?: W['children']
): any {
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

function spreadChildren(children: any[], child: any): any[] {
	if (Array.isArray(child)) {
		return child.reduce(spreadChildren, children);
	} else {
		return [...children, child];
	}
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
