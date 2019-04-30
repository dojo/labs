import { createMiddlewareFactory } from '../tsx';
import { dom, invalidator, destroy } from './base';

export interface IntersectionResult {
	intersectionRatio: number;
	isIntersecting: boolean;
}

interface ExtendedIntersectionObserverEntry extends IntersectionObserverEntry {
	readonly isIntersecting: boolean;
}

interface IntersectionDetail extends IntersectionGetOptions {
	entries: WeakMap<Element, IntersectionResult>;
	observer: IntersectionObserver;
}

export interface IntersectionGetOptions {
	root?: string | number;
	rootMargin?: string;
	threshold?: number[];
}

const defaultIntersection: IntersectionResult = Object.freeze({
	intersectionRatio: 0,
	isIntersecting: false
});

const createFactory = createMiddlewareFactory();

export const intersection = createFactory({ dom, invalidator, destroy }, ({ middleware }) => {
	const _details = new Map<string, IntersectionDetail>();
	const invalidate = middleware.invalidator();
	const handles: Function[] = [];
	middleware.destroy(() => {
		let handle: any;
		while ((handle = handles.pop())) {
			handle && handle();
		}
	});

	function _createDetails(options: IntersectionGetOptions, rootNode?: HTMLElement): IntersectionDetail {
		const entries = new WeakMap<HTMLElement, ExtendedIntersectionObserverEntry>();
		const observer = new IntersectionObserver(_onIntersect(entries), {
			...options,
			root: rootNode
		});
		const details = { observer, entries, ...options };

		_details.set(JSON.stringify(options), details);

		handles.push(() => observer.disconnect());
		return details;
	}

	function _getDetails(options: IntersectionGetOptions = {}): IntersectionDetail | undefined {
		return _details.get(JSON.stringify(options));
	}

	function _onIntersect(detailEntries: WeakMap<Element, IntersectionResult>) {
		return (entries: ExtendedIntersectionObserverEntry[]) => {
			for (const { intersectionRatio, isIntersecting, target } of entries) {
				detailEntries.set(target, { intersectionRatio, isIntersecting });
			}
			invalidate && invalidate();
		};
	}

	return {
		get(key: string | number, options: IntersectionGetOptions = {}): IntersectionResult {
			let rootNode: HTMLElement | undefined;
			if (options.root) {
				rootNode = middleware.dom(options.root) as HTMLElement;
				if (!rootNode) {
					return defaultIntersection;
				}
			}
			const node = middleware.dom(key);
			if (!node) {
				return defaultIntersection;
			}

			let details = _getDetails(options) || _createDetails(options, rootNode);
			if (!details.entries.get(node)) {
				details.entries.set(node, defaultIntersection);
				details.observer.observe(node);
			}

			return details.entries.get(node) || defaultIntersection;
		}
	};
});

export default intersection;
