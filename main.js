const http  = require('http');
const url = require('url');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {stack, route, finalizer} = require('yokto');
const static = require('node-static');

const PORT = process.env.PORT || 80;

const file = new static.Server('.');
http.createServer(stack([
	request => {
		if (request.url.startsWith('/require')) {
			console.log('Require:', request.url);
			let parts = request.url.split('/').slice(2);
			// parts = path.resolve(parts.join('/')).split('\\');
			console.log('PARTS:', parts);
			let parent = parts.slice(0, -1).join('/');
			let id = parts.join('/');

			let pre = `
console.log('Loading: ${id}');
(function() {
var exports = {};
var module = {
	get exports() {
		return exports;
	},
	set exports(value) {
		exports = value;
	}
};
function resolve(path) {
	let parts = path.split('/');
	parts = parts.reduce(function(memo, current) {
		if (current === '.') { return memo; }
		if (current === '..') { return memo.slice(0, -1); }
		return memo.concat(current);
	}, []);
	return parts.join('/');
}

const loadScript = id => callback => {
	let done = false;
	let script = document.createElement('script');
	script.src = '/require/' + id;
	script.onload = function() {
		if (done) { return; }
		done = true;

		function waitForIt() {
			if (window.__cache && (window.__cache[id] !== undefined)) {
				return callback();
			}
			setTimeout(waitForIt, 10);
		}
		waitForIt();
	};
	script.onerror = function(error) {
		if (done) { return; }
		done = true;
		callback(error);
	};
	document.head.appendChild(script);
};

const require = id => async(function*() {
	var src = id;
	if (id.startsWith('.')) {
		src = ${parent ? "'" + parent + "/' + id" : 'id'};
	}
	if (!src.endsWith('.js')) {
		src += '.js';
	}
	src = resolve(src);

	if (window.__cache && window.__cache[src]) {
		return window.__cache[src];
	}

	yield loadScript(src);

	return window.__cache[src];
});

async(function*() {
`.split('\n').join('') + '\n\n';
			let code = fs.readFileSync(id, 'utf8').replace(/require\(/g, 'yield require(') + '\n\n';
			let post = `
console.log('Loaded: ${id}');
window.__cache = window.__cache || {};
window.__cache['${id}'] = module.exports;
})(function(error) {
	if (error) {
		throw error;
	}
});

})();
`.split('\n').join('');

			return finalizer.end(200, pre + code + post);
		}
	},
	request => response => {
		file.serve(request, response);
	}
], function(request, error) {
	console.log('Not found');
	if (error) {
		console.error(error.stack);
		return finalizer.end(500, JSON.stringify(error.stack));
	}
	return finalizer.notFound();
})).listen(PORT);

console.log('Started server: ' + PORT);

