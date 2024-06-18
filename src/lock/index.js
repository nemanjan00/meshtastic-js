module.exports = () => {
	const root = Promise.resolve();

	let current = root;

	return {
		getLock: () => {
			const oldLock = current;

			return new Promise(resolve => {
				current = new Promise(release => {
					oldLock.then(() => {
						resolve(release);
					});
				});
			});
		}
	};
};

const lock = module.exports();
