const assert = function(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
};
assert.equal = function(left, right, message) {
	message = message || (left + ' == ' + right);
	assert(left == right, message);
};

module.exports = assert;
