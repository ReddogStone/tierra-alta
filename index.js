'use strict';

const Engine3D = require('./engine/engine/engine3d');

const GameScreen = require('./src/screens/game');

let canvas = document.createElement('canvas');
canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;
document.body.appendChild(canvas);

let engine = Engine3D(canvas, true);

let render = null;
let screen = GameScreen(engine, function(value) { render = value; });

let lastTime = performance.now();
requestAnimationFrame(function draw() {
	let time = performance.now();
	let dt = (time - lastTime) * 0.001;
	lastTime = time;

	screen({ type: 'update', dt: dt });

	render();

	requestAnimationFrame(draw);
});

document.addEventListener('keydown', function(event) {
	screen({ type: 'keydown', event: event });
});
document.addEventListener('keyup', function(event) {
	screen({ type: 'keyup', event: event });
});
