'use strict';

var createWireShader = require('./wireShader.js');

module.exports = function(game, opts) {
  return new WireframePlugin(game, opts);
};
module.exports.pluginInfo = {
  clientOnly: true,
  loadAfter: ['voxel-shader'],
};

function WireframePlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;
  if (!this.shell) throw new Error('voxel-wireframe requires game-shell-voxel');

  this.shaderPlugin = game.plugins.get('voxel-shader');
  if (!this.shaderPlugin) throw new Error('voxel-wireframe requires voxel-shader plugin');

  this.showWireframe = opts.showWireframe !== undefined ? opts.showWireframe : false;

  this.enable();
}

WireframePlugin.prototype.enable = function() {
  this.shell.bind('wireframe', 'F');
  this.shell.on('gl-init', this.onInit = this.shaderInit.bind(this));
  this.shell.on('gl-render', this.onRender = this.render.bind(this));
};

WireframePlugin.prototype.shaderInit = function() {
  this.wireShader = createWireShader(this.shell.gl);
};

WireframePlugin.prototype.disable = function() {
  this.shell.removeListener('gl-render', this.onRender);
  this.shell.removeListener('gl-init', this.onInit);
  this.shell.unbind('wireframe');
};

WireframePlugin.prototype.render = function() {
  if(this.showWireframe || this.shell.wasDown('wireframe')) {
    var gl = this.shell.gl

    //Bind the wire shader
    this.wireShader.bind()
    this.wireShader.attributes.position.location = 0
    this.wireShader.uniforms.projection = this.shaderPlugin.projectionMatrix
    this.wireShader.uniforms.view = this.shaderPlugin.viewMatrix

    for (var chunkIndex in this.game.voxels.meshes) {
      var mesh = this.game.voxels.meshes[chunkIndex];
      this.wireShader.uniforms.model = mesh.modelMatrix
      mesh.wireVAO.bind() // TODO: refactor wireVAO, created in voxel-mesher. add an event there for voxel-wireframe?
      gl.drawArrays(gl.LINES, 0, mesh.wireVertexCount)
      mesh.wireVAO.unbind()
    }
  }
};

