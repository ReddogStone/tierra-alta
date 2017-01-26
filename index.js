'use strict';

const Engine3D = require('./engine/engine/engine3d');

let canvas = document.createElement('canvas');
canvas.width = 600;
canvas.height = 400;
document.body.appendChild(canvas);

let engine = Engine3D(canvas, true);
engine.clear();
