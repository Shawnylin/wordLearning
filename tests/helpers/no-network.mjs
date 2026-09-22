// Existing test mocks replace this stub; an accidentally unmocked fetch fails closed.
globalThis.fetch = async () => { throw new Error('Node tests must mock fetch; network access is disabled') }
