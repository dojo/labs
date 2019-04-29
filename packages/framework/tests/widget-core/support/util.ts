import global from '@dojo/framework/shim/global';
import { stub, SinonStub } from 'sinon';

export function createResolvers() {
	let rAFStub: SinonStub;
	let rICStub: SinonStub;

	function resolveRAFCallbacks() {
		for (let i = 0; i < rAFStub.callCount; i++) {
			rAFStub.getCall(i).callArg(0);
		}
		rAFStub.resetHistory();
	}

	function resolveRICCallbacks() {
		for (let i = 0; i < rICStub.callCount; i++) {
			rICStub.getCall(i).callArg(0);
		}
		rICStub.resetHistory();
	}

	return {
		resolve() {
			resolveRAFCallbacks();
			resolveRICCallbacks();
		},
		resolveRIC() {
			resolveRICCallbacks();
		},
		resolveRAF() {
			resolveRAFCallbacks();
		},
		stub() {
			rAFStub = stub(global, 'requestAnimationFrame').returns(1);
			if (global.requestIdleCallback) {
				rICStub = stub(global, 'requestIdleCallback').returns(1);
			} else {
				rICStub = stub(global, 'setTimeout').returns(1);
			}
		},
		restore() {
			rAFStub.restore();
			rICStub.restore();
		}
	};
}
