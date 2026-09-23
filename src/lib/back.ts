/**
 * Android back gesture / button closes the top overlay instead of leaving the
 * app. Each open overlay pushes a history entry; back pops it. Closing an
 * overlay from the UI removes its entry silently.
 */
interface Entry {
	close: () => void;
}

const stack: Entry[] = [];
let ignore = 0;

if (typeof window !== 'undefined') {
	window.addEventListener('popstate', () => {
		if (ignore > 0) {
			ignore--;
			return;
		}
		stack.pop()?.close();
	});
}

/** Register an open overlay. Call the returned function when it closes. */
export function onBack(close: () => void): () => void {
	const entry: Entry = { close };
	stack.push(entry);
	history.pushState({ overlay: stack.length }, '');
	return () => {
		const i = stack.indexOf(entry);
		if (i < 0) return; // already closed by the back gesture
		stack.splice(i, 1);
		ignore++;
		history.back();
	};
}
