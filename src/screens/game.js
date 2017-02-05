'use strict';

const MeshLib = require('../../engine/engine/mesh');
const Geometry = require('../../engine/engine/geometry');
const BlendMode = require('../../engine/engine/blend-mode');
const mat4 = require('../../engine/math/Matrix4');
const vec3 = require('../../engine/math/Vector3');

const Behavior = require('../logic/behavior');
const BehaviorSystem = require('../logic/behavior-system');

module.exports = function(engine, setRender) {

	const Mesh = engine.Mesh = MeshLib(engine);

	const playerTexture = engine.createTextureFromFile('assets/textures/spirit.png');
	const groundTexture = engine.createTextureFromFile('assets/textures/ground.png');
	const stoneTexture = engine.createTextureFromFile('assets/textures/rock.png');
	const orbTexture = engine.createTextureFromFile('assets/textures/orb.png');

	const vertexShader = getFile('/engine/shaders/simple.vshader');
	const fragmentShader = getFile('/engine/shaders/simple.fshader');

	const program = engine.createProgram(vertexShader, fragmentShader, 'simple');

	const sx = 40;
	const sy = 40;

	let up = vec3(0, 0, 1);

	let canvas = engine.canvas;
	let projection = mat4.perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

	engine.setViewport(0, 0, canvas.width, canvas.height);
	engine.setProgram(program, {
		uProjection: projection.toArray(),

		uColorLight1: [0.5, 0.5, 0.5],
		uPosLight2: [0, 0, 0],
		uColorLight2: [0, 0, 0],
		uLuminosity: 0,
		uAmbient: [0, 0, 0]
	});

	let quadMesh = Mesh.make(Geometry.createQuadData());
	let renderSprite = makeRenderSprite(engine, quadMesh);

// ================================================================================
// STATE
// ================================================================================
	let grid = createRandomGrid(sx, sy, 0);
	let geometry = createTerrainGeometry(grid, 1);
	let mesh = Mesh.make(geometry);

	let keyState = {};
	let pos = vec3(0, 0, 2);
	let target = vec3(3, 3, 0);

	let player = {
		rotation: 0,
		scale: vec3(0.5, 0.5, 1),
		color: [0, 0.7, 1, 1]
	};
	let stones = [];
	let orbs = [];

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
			uLuminosity: 0.5,
			uTexture: { texture: groundTexture },

			uWorld: world.toArray(),
			uWorldIT: worldIT.toArray()
		});

		engine.setBlendMode(BlendMode.SOLID);

		Mesh.render(program, mesh);

		let sprites = [{
			texture: playerTexture,
			position: target.clone().sub(vec3(0, 0, 0.0)),
			rotation: player.rotation,
			scale: player.scale,
			color: player.color
		}].concat(
			stones.map(function(stone) {
				return {
					texture: stoneTexture,
					position: stone.position.clone().sub(vec3(0, 0, 0.07)),
					scale: stone.scale
				};
			}),
			orbs.map(function(orb) {
				return {
					texture: orbTexture,
					position: orb.position.clone().sub(vec3(0, 0, 0.07)),
					scale: orb.scale,
					color: orb.color.concat(orb.alpha),
					luminosity: orb.luminosity
				};
			})
		);

		sprites.sort(byDistanceTo(pos)).forEach(function(sprite) {
			renderSprite(program, sprite.texture, sprite.position, sprite.rotation, sprite.scale, sprite.color, sprite.luminosity);
		});
	});

// ================================================================================
// LOGIC
// ================================================================================
	const behaviorSystem = BehaviorSystem();

	const storeKeyState = (keyCode, property) => () => Behavior.run(function*() {
		yield Behavior.filter(event =>
			event.type === 'keydown' && event.event.keyCode === keyCode);
		console.log(property);
		keyState[property] = true;
		yield Behavior.filter(event =>
			event.type === 'keyup' && event.event.keyCode === keyCode);
		keyState[property] = false;
	});

	const orbBehavior = (creator, color) => {
		let orb = {
			position: creator.position.clone(),
			scale: vec3(0.25, 0.25, 1),
			color: color,
			luminosity: 0.5,
			alpha: 0
		};
		orbs.push(orb);

		return Behavior.run(function*() {
			let from = creator.position.clone();
			let pos = from.clone().add(vec3(0, 0, 0.7));
			yield Behavior.interval(1, function(progress) {
				orb.position = from.clone().lerp(pos, 1.0 - Math.pow(2, -10 * progress));
				orb.alpha = progress;
			});

			yield Behavior.first(
				Behavior.run(function*() {
					while (true) {
						let amplitude = 0.1;
						yield Behavior.interval(1.5, function(progress) {
							let sin = Math.sin(Math.PI * progress);
							orb.position = creator.position.clone().add(vec3(0, 0, 0.7 + sin * sin * amplitude));
						});
						// yield Behavior.wait(2);
					}
				}),
				Behavior.update(function(dt) {
					let playerDistance = orb.position.clone().sub(target).length();
					if (playerDistance < 1.5) { return true; }
				})
			);

			let start = orb.position.clone();
			yield Behavior.interval(0.75, function(progress) {
				orb.position = start.clone().lerp(target, Math.pow(progress, 3));
			});

			orbs.splice(orbs.indexOf(orb), 1);
		});
	};

	const stoneBehavior = (position, interval) => {
		let stone = {
			position: position.clone(),
			saturated: false
		};
		stones.push(stone);

		return Behavior.repeat(() => Behavior.run(function*() {
			yield Behavior.wait(interval);

			stone.saturated = true;
			behaviorSystem.add(Behavior.run(function*() {
				yield orbBehavior(stone, [0.86, 0.61, 0.4]);
				stone.saturated = false;
			}));

			yield Behavior.update(function() {
				if (!stone.saturated) { return true; }
			});
		}));
	};

	for (let i = 0; i < 20; i++) {
		behaviorSystem.add(stoneBehavior(vec3(Math.random() * 20, Math.random() * 20, 0), 1));
	}

	let t = 0;
	let moveT = 0;
	return Behavior.first(
		Behavior.repeat(storeKeyState(37, 'left')),
		Behavior.repeat(storeKeyState(38, 'up')),
		Behavior.repeat(storeKeyState(39, 'right')),
		Behavior.repeat(storeKeyState(40, 'down')),

		function(event) {
			behaviorSystem.update(event);
			return { done: false };
		},

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

			if (dir.length() > 0) {
				moveT += dt;
			}

			let dp = dir.clone().scale(2 * dt);
			pos.add(dp);
			target.add(dp);

			let sin = Math.sin(t * 0.3);
			player.color[3] = 0.7 + sin * sin * 0.3;

			let moveCos = Math.cos(5 * moveT);
			player.scale = vec3(0.5, 0.5, 1).scale(0.95 + moveCos * moveCos * 0.05);
			player.rotation = moveCos * 0.05;
		})
	);
};

// ================================================================================
// HELPERS
// ================================================================================

const byDistanceTo = target => (object1, object2) => {
	let d1 = object1.position.clone().sub(target).length();
	let d2 = object2.position.clone().sub(target).length();

	if (d1 < d2) { return 1; }
	if (d1 > d2) { return -1; }
	return 0;
};

const makeRenderSprite = (Engine, quadMesh) => (program, texture, position, rotation, scale, color, luminosity) => {
	rotation = rotation || 0;
	scale = scale || vec3(1, 1, 1);
	color = color || [1, 1, 1, 1];
	luminosity = (luminosity !== undefined) ? luminosity : 0.5;

	Engine.setBlendMode(BlendMode.PREMUL_ALPHA);

	let world = mat4()
		.translate(position)
		.rotate(-0.25 * Math.PI, vec3(0, 0, 1))
		.rotate(0.4 * Math.PI, vec3(1, 0, 0))
		.rotate(rotation, vec3(0, 0, 1))
		.scale(scale)
		.translate(vec3(0, 0.5, 0));
	let worldIT = world.clone().invert().transpose();
	Engine.setProgramParameters(program.activeUniforms, {
		uColor: color,
		uLuminosity: luminosity,
		uTexture: { texture: texture },

		uWorld: world.toArray(),
		uWorldIT: worldIT.toArray()
	});

	Engine.Mesh.render(program, quadMesh);
}

function createTexture(engine, width, height, draw) {
	let canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	let context = canvas.getContext('2d');

	draw(context, width, height);

	return engine.createTexture(canvas);
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
    req.setRequestHeader('Cache-Control', 'no-cache');
    req.send(null);
    return req.responseText;
}
