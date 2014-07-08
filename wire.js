'use strict';

var ndarray = require('ndarray');
var ops = require('ndarray-ops');
var createBuffer = require('gl-buffer');
var createVAO = require('gl-vao');
var glslify = require('glslify');

module.exports = function(game, opts) {
  return new WireframePlugin(game, opts);
};
module.exports.pluginInfo = {
  clientOnly: true,
  loadAfter: ['voxel-shader', 'voxel-mesher', 'voxel-keys'],
};

function WireframePlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;
  if (!this.shell) throw new Error('voxel-wireframe requires game-shell-voxel');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-wireframe requires voxel-shader plugin');

  this.mesherPlugin = game.plugins.get('voxel-mesher');
  if (!this.mesherPlugin) throw new Error('voxel-wireframe requires voxel-mesher plugin');

  this.keysPlugin = game.plugins.get('voxel-keys'); // optional

  this.showWireframe = opts.showWireframe !== undefined ? opts.showWireframe : false;
  this.requireShift = opts.requireShift !== undefined ? opts.requireShift : true;

  this.enable();
}

WireframePlugin.prototype.enable = function() {
  this.shell.bind('wireframe', 'F9');
  if (this.keysPlugin) this.keysPlugin.down.on('wireframe', this.onToggle = this.toggle.bind(this));
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
  this.mesherPlugin.on('meshed', this.onMeshed = this.createWireMesh.bind(this));
};

WireframePlugin.prototype.disable = function() {
  this.mesherPlugin.removeListener('meshed', this.onMeshed);
  this.shell.removeListener('gl-render', this.onRender);
  this.shell.removeListener('gl-init', this.onInit);
  if (this.keysPlugin) this.keysPlugin.down.removeListener('wireframe', this.onToggle);
  this.shell.unbind('wireframe');
};

WireframePlugin.prototype.shaderInit = function() {
  this.wireShader = glslify({
    vertex: './wire-shader.vert',
    fragment: './wire-shader.frag'})(this.shell.gl);
};

WireframePlugin.prototype.toggle = function(ev) {
  if (this.requireShift && ev && !ev.shiftKey) return;
  this.showWireframe = !this.showWireframe;
};

WireframePlugin.prototype.createWireMesh = function(mesh, gl, vert_data) {
  //Create wire mesh
  var triangleVertexCount = !mesh.vertexArrayObjects.surface ? 0 : mesh.vertexArrayObjects.surface.length
  var wireVertexCount = 2 * triangleVertexCount
  var wireVertexArray = ndarray(new Uint8Array(wireVertexCount * 3), [triangleVertexCount, 2, 3])
  var trianglePositions = ndarray(vert_data, [triangleVertexCount, 3], [8, 1], 0)
  ops.assign(wireVertexArray.pick(undefined, 0, undefined), trianglePositions)
  var wires = wireVertexArray.pick(undefined, 1, undefined)
  for(var i=0; i<3; ++i) {
    ops.assign(wires.lo(i).step(3), trianglePositions.lo((i+1)%3).step(3))
  }
  var wireBuf = createBuffer(gl, wireVertexArray.data)
  var wireVAO = createVAO(gl, [
    { "buffer": wireBuf,
      "type": gl.UNSIGNED_BYTE,
      "size": 3,
      "offset": 0,
      "stride": 3,
      "normalized": false
    }
  ])
  wireVAO.length = wireVertexCount

  mesh.vertexArrayObjects.wireframe = wireVAO
};

WireframePlugin.prototype.render = function() {
  if(this.showWireframe) {
    var gl = this.shell.gl

    //Bind the wire shader
    this.wireShader.bind()
    this.wireShader.attributes.position.location = 0
    this.wireShader.uniforms.projection = this.shaderPlugin.projectionMatrix
    this.wireShader.uniforms.view = this.shaderPlugin.viewMatrix

    for (var chunkIndex in this.game.voxels.meshes) {
      var mesh = this.game.voxels.meshes[chunkIndex];
      this.wireShader.uniforms.model = mesh.modelMatrix
      var wireVAO = mesh.vertexArrayObjects.wireframe // set in createWireMesh() above
      wireVAO.bind()
      gl.drawArrays(gl.LINES, 0, wireVAO.length)
      wireVAO.unbind()
    }
  }
};

