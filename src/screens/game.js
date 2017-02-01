'use strict';

const MeshLib = require('../../engine/engine/mesh');
const BlendMode = require('../../engine/engine/blend-mode');
const mat4 = require('../../engine/math/Matrix4');
const vec3 = require('../../engine/math/Vector3');

const Behavior = require('../logic/behavior');

module.exports = function(engine, setRender) {

const Mesh = MeshLib(engine);

let texCanvas = document.createElement('canvas');
texCanvas.width = 128;
texCanvas.height = 128;
let context = texCanvas.getContext('2d');
context.fillStyle = 'white';
context.fillRect(0, 0, texCanvas.width, texCanvas.height);
context.fillStyle = 'black';
context.fillRect(0.5 * texCanvas.width, 0, 0.3 * texCanvas.width, 0.3 * texCanvas.height);
context.fillRect(0, 0.5 * texCanvas.height, 0.25 * texCanvas.width, 0.25 * texCanvas.height);

const texture = engine.createTexture(texCanvas);

const vertexShader = getFile('/engine/shaders/simple.vshader');
const fragmentShader = getFile('/engine/shaders/simple.fshader');
const program = engine.createProgram(vertexShader, fragmentShader, 'simple');

const sx = 40;
const sy = 40;

let pos = vec3(0, 0, 2);
let target = vec3(2, 2, 0);
let up = vec3(0, 0, 1);

let canvas = engine.canvas;
let projection = mat4.perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

engine.setViewport(0, 0, canvas.width, canvas.height);
engine.setBlendMode(BlendMode.SOLID);
engine.setProgram(program, {
	uProjection: projection.toArray(),

	uTexture: { texture: texture },
	uColorLight1: [1, 1, 1],
	uPosLight2: [0, 0, 0],
	uColorLight2: [0, 0, 0],
	uLuminosity: 0,
	uAmbient: [0, 0, 0]
});

// ================================================================================
// STATE
// ================================================================================
let grid = createRandomGrid(sx, sy, 0);
let geometry = createTerrainGeometry(grid, 1);
let mesh = Mesh.make(geometry);

let keyState = {};

// ================================================================================
// RENDER
// ================================================================================
	setRender(function() {
		let t = performance.now() * 0.001;
		let sin = Math.sin(t);

		let view = mat4.lookAt(pos, target, up);

		let world = mat4();
		let worldIT = world.clone().invert().transpose();
		engine.setProgramParameters(program.activeUniforms, {
			uView: view.toArray(),

			uPosCamera: pos.toArray(),
			uPosLight1: pos.toArray(),

			uColor: [sin * sin, 0.7, 0.4, 1],

			uWorld: world.toArray(),
			uWorldIT: worldIT.toArray()
		});

		Mesh.render(program, mesh);
	});

// ================================================================================
// LOGIC
// ================================================================================

	const storeKeyState = (keyCode, property) => () => Behavior.run(function*() {
		yield Behavior.filter(event =>
			event.type === 'keydown' && event.event.keyCode === keyCode);
		console.log(property);
		keyState[property] = true;
		yield Behavior.filter(event =>
			event.type === 'keyup' && event.event.keyCode === keyCode);
		keyState[property] = false;
	});

	let t = 0;
	return Behavior.first(
		Behavior.repeat(storeKeyState(37, 'left')),
		Behavior.repeat(storeKeyState(38, 'up')),
		Behavior.repeat(storeKeyState(39, 'right')),
		Behavior.repeat(storeKeyState(40, 'down')),
		Behavior.update(function(dt) {
			t += dt;
			// pos = vec3(Math.sin(t + 0.5) * 20, Math.cos(0.3 * t) * 10, 10);

			let dir = vec3(0, 0, 0);
			if (keyState.right) {
				dir.add(vec3(1, -1, 0));
			}
			if (keyState.left) {
				dir.add(vec3(-1, 1, 0));
			}
			if (keyState.up) {
				dir.add(vec3(1, 1, 0));
			}
			if (keyState.down) {
				dir.add(vec3(-1, -1, 0));
			}
			dir.normalize();

			let dp = dir.clone().scale(dt);
			pos.add(dp);
			target.add(dp);
		})
	);
};

// ================================================================================
// HELPERS
// ================================================================================

function createRandomGrid(sx, sy, t) {
	let cells = new Array(sx * sy);
	let i = 0;
	for (let y = 0; y < sy; y++) {
		for (let x = 0; x < sx; x++) {
			// let height = 1.3 * Math.sin(x * 0.3 + t) + Math.sin(y * 0.2 + t);
			let height = Math.random() * 3;
			cells[i++] = {
				originalHeight: height,
				height: height
			}
		}
	}
	return {
		sx: sx,
		sy: sy,
		cells: cells
	};
}

function createTerrainGeometry(grid, innerRatio) {
	let sx = grid.sx;
	let sy = grid.sy;
	let cells = grid.cells;

	let vertices = [];
	let indices = [];

	let ci = 0;
	for (let y = 0; y < sy; y++) {
		for (let x = 0; x < sx; x++) {
			let cell = cells[ci++];
			writeCell(x, y, cell, innerRatio, vertices, indices, vertices.length, indices.length);
		}
	}

	return {
		vertices: vertices,
		indices: indices,
		description: {
			aPosition: { components: 3, type: 'FLOAT', normalized: false },
			aNormal: { components: 3, type: 'FLOAT', normalized: false },
			aTexCoord: { components: 2, type: 'FLOAT', normalized: false }
		}
	};
}

function writeCell(x, y, cell, innerRatio, vertices, indices, vertexOffset, indexOffset) {
	let cx = x + 0.5;
	let cy = y + 0.5;
	let hir = innerRatio * 0.5;
	let vi = vertexOffset;
	vi = writeCellVertex(cx - hir, cy - hir, 0, 0, 1, vertices, vi);
	vi = writeCellVertex(cx + hir, cy - hir, 0, 1, 1, vertices, vi);
	vi = writeCellVertex(cx - hir, cy + hir, 0, 0, 0, vertices, vi);
	vi = writeCellVertex(cx + hir, cy + hir, 0, 1, 0, vertices, vi);

	let startIndex = Math.floor(vertexOffset / 8);
	let ii = indexOffset;
	indices[ii++] = startIndex; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 2;
	indices[ii++] = startIndex + 2; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 3;
}

function writeCellVertex(x, y, z, tu, tv, vertices, offset) {
	return writeVertex(x, y, z, 0, 0, 1, tu, tv, vertices, offset);
}

function writeVertex(x, y, z, nx, ny, nz, tu, tv, vertices, offset) {
	let vi = offset;
	let n = vec3(nx, ny, nz).normalize();
	vertices[vi++] = x; vertices[vi++] = y; vertices[vi++] = z;	
	vertices[vi++] = n.x; vertices[vi++] = n.y; vertices[vi++] = n.z;	
	vertices[vi++] = tu; vertices[vi++] = tv;
	return offset + 8;
}

function getFile(url) {
    var req = new XMLHttpRequest();
    req.open("GET", url, false); // 'false': synchronous.
    req.send(null);
    return req.responseText;
}
