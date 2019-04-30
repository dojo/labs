import { middleware } from '../tsx';
import ResizeObserver from '@dojo/framework/shim/ResizeObserver';
import { dom, invalidator, destroy } from './base';

const createFactory = middleware();

export const resize = createFactory({ dom, invalidator, destroy }, ({ middleware: { dom, invalidator, destroy } }) => {
	const invalidate = invalidator();
	const keys: (string | number)[] = [];
	let contentRect: any = null;
	const handles: Function[] = [];
	destroy(() => {
		let handle: any;
		while ((handle = handles.pop())) {
			handle && handle();
		}
	});
	return {
		get(key: string | number) {
			const node = dom(key);
			if (!node) {
				return null;
			}

			if (keys.indexOf(key) === -1) {
				keys.push(key);
				const resizeObserver = new ResizeObserver(([entry]) => {
					contentRect = entry.contentRect;
					invalidate && invalidate();
				});
				resizeObserver.observe(node);
				handles.push(() => resizeObserver.disconnect());
			}
			return contentRect;
		}
	};
});

export default resize;
