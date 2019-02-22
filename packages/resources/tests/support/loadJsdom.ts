import * as jsdom from 'jsdom';
import global from '@dojo/framework/shim/global';
import { stub } from 'sinon';

/* In order to have the tests work under Node.js, we need to load JSDom and polyfill
 * requestAnimationFrame and create a fake document.activeElement getter */

/* Create a basic document */
const doc = jsdom.jsdom(`
	<!DOCTYPE html>
	<html>
	<head></head>
	<body></body>
	<html>
`);

/* Assign it to the global namespace */
global.document = doc;

/* Assign a global window as well */
global.window = doc.defaultView;
global.self = global.window;

/* Needed for Pointer Event Polyfill's incorrect Element detection */
global.Element = function() {};

/* Polyfill requestAnimationFrame - this can never be called an *actual* polyfill */
global.requestAnimationFrame = (cb: (...args: any[]) => {}) => {
	setImmediate(cb);
	// return something at least!
	return true;
};

global.fetch = stub();
global.cancelAnimationFrame = () => {};
global.IntersectionObserver = () => {};

global.fakeActiveElement = () => {};
Object.defineProperty(doc, 'activeElement', {
	get: () => {
		return global.fakeActiveElement();
	}
});
