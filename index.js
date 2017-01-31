'use strict';

const Engine3D = require('./engine/engine/engine3d');
const MeshLib = require('./engine/engine/mesh');
const BlendMode = require('./engine/engine/blend-mode');
const mat4 = require('./engine/math/Matrix4');
const vec3 = require('./engine/math/Vector3');

let canvas = document.createElement('canvas');
canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;
document.body.appendChild(canvas);

let engine = Engine3D(canvas, true);
let Mesh = MeshLib(engine);

let emptyCanvas = document.createElement('canvas');
emptyCanvas.width = 1;
emptyCanvas.height = 1;
let context = emptyCanvas.getContext('2d');
context.fillStyle = 'white';
context.fillRect(0, 0, emptyCanvas.width, emptyCanvas.height);

const emptyTexture = engine.createTexture(emptyCanvas);

const vertexShader = getFile('/engine/shaders/simple.vshader');
const fragmentShader = getFile('/engine/shaders/simple.fshader');
const program = engine.createProgram(vertexShader, fragmentShader, 'simple');

const sx = 40;
const sy = 40;

let pos = vec3(-10, -5, 10);
let target = vec3(sx * 0.5, sy * 0.5, 0);
let up = vec3(0, 0, 1);

let projection = mat4.perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

engine.setViewport(0, 0, canvas.width, canvas.height);
engine.setBlendMode(BlendMode.SOLID);
engine.setProgram(program, {
	uProjection: projection.toArray(),

	uTexture: { texture: emptyTexture },
	uColorLight1: [1, 1, 1],
	uPosLight2: [0, 0, 0],
	uColorLight2: [0, 0, 0],
	uLuminosity: 0,
	uAmbient: [0, 0, 0]
});

requestAnimationFrame(function redraw() {
	update();

	engine.clear();
	render();
	requestAnimationFrame(redraw);
});

function update() {
	let t = performance.now() * 0.001;
	// let sin = Math.sin(t);
	// for (let i = 0; i < grid.cells.length; i++) {
		// grid.cells[i].height = grid.cells[i].originalHeight * sin * sin;
	// }

	pos = vec3(Math.sin(t + 0.5) * 20, Math.cos(0.3 * t) * 10, 10);
}

let grid = createRandomGrid(sx, sy, 0);

function render() {
	let t = performance.now() * 0.001;
	let sin = Math.sin(t);

	let view = mat4.lookAt(pos, target, up);

	let geometry = createTerrainGeometry(grid, 0.75);
	let mesh = Mesh.make(geometry);

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
}

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

	for (let y = 0; y < sy; y++) {
		for (let x = 0; x < sx - 1; x++) {
			let cell = cells[y * sx + x];
			let rightCell = cells[y * sx + x + 1];
			connectCells(x, y, cell, x + 1, y, rightCell, innerRatio,
				vertices, indices, vertices.length, indices.length);
		}
	}

	for (let y = 0; y < sy - 1; y++) {
		for (let x = 0; x < sx; x++) {
			let cell = cells[y * sx + x];
			let topCell = cells[(y + 1) * sx + x];
			connectCells(x, y, cell, x, y + 1, topCell, innerRatio,
				vertices, indices, vertices.length, indices.length);
		}
	}

	for (let y = 0; y < sy - 1; y++) {
		for (let x = 0; x < sx - 1; x++) {
			let cellsToConnect = [
				cells[y * sx + x],
				cells[y * sx + x + 1],
				cells[(y + 1) * sx + x],
				cells[(y + 1) * sx + x + 1]
			];
			addCorner(x, y, cellsToConnect, innerRatio, vertices, indices, vertices.length, indices.length);
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
	vi = writeCellVertex(cx - hir, cy - hir, cell.height, vertices, vi);
	vi = writeCellVertex(cx + hir, cy - hir, cell.height, vertices, vi);
	vi = writeCellVertex(cx - hir, cy + hir, cell.height, vertices, vi);
	vi = writeCellVertex(cx + hir, cy + hir, cell.height, vertices, vi);

	let startIndex = Math.floor(vertexOffset / 8);
	let ii = indexOffset;
	indices[ii++] = startIndex; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 2;
	indices[ii++] = startIndex + 2; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 3;
}

function writeCellVertex(x, y, z, vertices, offset) {
	let vi = offset;
	vertices[vi++] = x; vertices[vi++] = y; vertices[vi++] = z;	
	vertices[vi++] = 0; vertices[vi++] = 0; vertices[vi++] = 1;	
	vertices[vi++] = 0; vertices[vi++] = 0;	
	return offset + 8;
}

function connectCells(x1, y1, cell1, x2, y2, cell2, innerRatio, vertices, indices, vertexOffset, indexOffset) {
	let cx1 = x1 + 0.5;	let cy1 = y1 + 0.5;
	let cx2 = x2 + 0.5;	let cy2 = y2 + 0.5;
	let hir = innerRatio * 0.5;

	let dx = cx2 - cx1;
	let dy = cy2 - cy1;
	let dh = cell1.height - cell2.height;

	let vi = vertexOffset;
	vi = writeVertex(cx1 + dx * hir - dy * hir, cy1 - dx * hir + dy * hir, cell1.height, dh * dx, dh * dy, 1, vertices, vi);
	vi = writeVertex(cx2 - dx * hir - dy * hir, cy2 - dx * hir - dy * hir, cell2.height, dh * dx, dh * dy, 1, vertices, vi);
	vi = writeVertex(cx1 + dx * hir + dy * hir, cy1 + dx * hir + dy * hir, cell1.height, dh * dx, dh * dy, 1, vertices, vi);
	vi = writeVertex(cx2 - dx * hir + dy * hir, cy2 + dx * hir - dy * hir, cell2.height, dh * dx, dh * dy, 1, vertices, vi);

	let startIndex = Math.floor(vertexOffset / 8);
	let ii = indexOffset;
	indices[ii++] = startIndex; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 2;
	indices[ii++] = startIndex + 2; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 3;
}

function addCorner(x, y, cells, innerRatio, vertices, indices, vertexOffset, indexOffset) {
	let cx1 = x + 0.5;	let cy1 = y + 0.5;
	let cx2 = x + 1.5;	let cy2 = y + 0.5;
	let cx3 = x + 0.5;	let cy3 = y + 1.5;
	let cx4 = x + 1.5;	let cy4 = y + 1.5;
	let hir = innerRatio * 0.5;

	let d1 = vec3(cx4 - cx1, cy4 - cy1, cells[3].height - cells[0].height).normalize();
	let d2 = vec3(cx3 - cx2, cy3 - cy2, cells[2].height - cells[1].height).normalize();
	let n = d2.cross(d1);

	let vi = vertexOffset;
	vi = writeVertex(cx1 + hir, cy1 + hir, cells[0].height, n.x, n.y, n.z, vertices, vi);
	vi = writeVertex(cx2 - hir, cy2 + hir, cells[1].height, n.x, n.y, n.z, vertices, vi);
	vi = writeVertex(cx3 + hir, cy3 - hir, cells[2].height, n.x, n.y, n.z, vertices, vi);
	vi = writeVertex(cx4 - hir, cy4 - hir, cells[3].height, n.x, n.y, n.z, vertices, vi);

	let startIndex = Math.floor(vertexOffset / 8);
	let ii = indexOffset;
	indices[ii++] = startIndex; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 2;
	indices[ii++] = startIndex + 2; indices[ii++] = startIndex + 1; indices[ii++] = startIndex + 3;
}

function writeVertex(x, y, z, nx, ny, nz, vertices, offset) {
	let vi = offset;
	let n = vec3(nx, ny, nz).normalize();
	vertices[vi++] = x; vertices[vi++] = y; vertices[vi++] = z;	
	vertices[vi++] = n.x; vertices[vi++] = n.y; vertices[vi++] = n.z;	
	vertices[vi++] = 0; vertices[vi++] = 0;	
	return offset + 8;
}

function getFile(url) {
    var req = new XMLHttpRequest();
    req.open("GET", url, false); // 'false': synchronous.
    req.send(null);
    return req.responseText;
}