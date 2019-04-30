const { afterEach, beforeEach, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');
const { describe: jsdomDescribe } = intern.getPlugin('jsdom');
import { createResolvers } from './../support/util';
import { stub } from 'sinon';

import { renderer, getRegistry, getInvalidator, destroy, properties, getNode } from '../../../src/widget-core/vdom';
import { createMiddlewareFactory, createWidgetFactory, v, tsx } from '../../../src/widget-core/tsx';
import Registry from '@dojo/framework/widget-core/Registry';

const resolvers = createResolvers();
const createMiddleware = createMiddlewareFactory();
const getId = createMiddleware(({ id }) => {
	return () => id;
});
const createWidget = createWidgetFactory({ getId });

jsdomDescribe('vdom', () => {
	beforeEach(() => {
		resolvers.stub();
	});

	afterEach(() => {
		resolvers.restore();
	});

	it('Should get nodes', () => {
		let widgetId: any;
		let fooWidgetId: any;
		let show = true;
		const registry = new Registry();
		const Foo = createWidget<{ foo: string }>(({ middleware, properties }) => {
			fooWidgetId = middleware.getId();
			return v('div', { key: 'foo' }, [properties.foo]);
		});
		const App = createWidget(({ middleware }) => {
			widgetId = middleware.getId();
			return show ? <Foo key="key" foo="bar" /> : null;
		});
		const r = renderer(() => App({}));
		const root = document.createElement('app');
		r.mount({ domNode: root, registry });
		const node = getNode(fooWidgetId, 'foo');
		assert.strictEqual(root.childNodes[0], node);
		assert.strictEqual((getRegistry(widgetId) as any).baseRegistry, registry);
		const invalidator = getInvalidator(widgetId);
		const destroyStub = stub();
		const propertiesStub = stub();
		destroy(fooWidgetId, destroyStub);
		properties(fooWidgetId, propertiesStub);
		invalidator!();
		resolvers.resolve();
		assert.strictEqual(1, propertiesStub.callCount);
		show = false;
		invalidator!();
		resolvers.resolve();
		assert.strictEqual(1, destroyStub.callCount);
	});
});
