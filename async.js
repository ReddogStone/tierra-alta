var async = (function() {
	function isGenerator(obj) {
		return (Object.prototype.toString.call(obj) === '[object Generator]');
	}

	function monad(unit, bind) {
		return function (generatorFunc) {
			return bind(unit(), function() {
				try {
					var gen = generatorFunc();
				} catch (e) {
					return unit(e);
				}

				return isGenerator(gen) ? bind(unit(), send) : unit(null, gen);

				function send(error, result) {
					try {
						var nextResult = error ? gen.throw(error) : gen.next(result);
					} catch (e) {
						return unit(e);
					}

					if (nextResult.done) {
						return unit(null, nextResult.value);
					}
					
					return bind(nextResult.value, send);
				}
			});
		};
	}

	function isContinuation(obj) {
		return (typeof obj === 'function');
	}

	function nextTick(callback) {
		setTimeout(callback, 0);
	}

	// Continuation monad.
	return monad(
		function unit(error, result) {
			return function(callback) { callback(error, result); };
		},
		function bind(value, func) {
			return function(callback) {
				var done = false;
				function continueNextTick(error, result) {
					if (done) {
						callback(new Error('Callback called twice!'));
						callback = function(error, result) {
							console.log('This would be received by the callback:', error, result);
						};
						return;
					}
					done = true;

					// The *func* call happens before the nextTick (on purpose!)
					var nextTask = func(error, result);
					nextTick(function() { nextTask(callback); });
				}

				if (!isContinuation(value)) {
					return continueNextTick(null, value);
				}
				try {
					value(continueNextTick);
				} catch (e) {
					continueNextTick(e);
				}
			}
		}
	);	
})();