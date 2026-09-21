// Three r185 allocates a global binding point for every live UniformsGroup.
// A scene may have thousands of materials; only the blocks of one draw must
// coexist. Keep each group's buffer, but bind it at its program's block index.
export function patchUniformsGroups(source) {
  const replace = (pattern, replacement) => {
    const next = source.replace(pattern, replacement);
    if (next === source) throw new Error('Pinned WebGLUniformsGroups source changed.');
    source = next;
  };
  replace('let allocatedBindingPoints = [];', 'let programBlocks = new WeakMap();');
  replace(/function bind\( uniformsGroup, program \) \{[\s\S]*?\n\t\}/, `function bind( uniformsGroup, program ) {
    const webglProgram = program.program;
    let blocks = programBlocks.get( webglProgram );
    if ( blocks === undefined ) {
      blocks = new Map();
      programBlocks.set( webglProgram, blocks );
    }
    let index = blocks.get( uniformsGroup.name );
    if ( index === undefined ) {
      index = gl.getUniformBlockIndex( webglProgram, uniformsGroup.name );
      blocks.set( uniformsGroup.name, index );
      if ( index !== gl.INVALID_INDEX && index < maxBindingPoints ) {
        gl.uniformBlockBinding( webglProgram, index, index );
      }
    }
    // Optimized-out blocks have no binding. Never alias an invalid block to 0.
    if ( index === gl.INVALID_INDEX ) return;
    if ( index >= maxBindingPoints ) {
      throw new Error( 'Uniform block index exceeds MAX_UNIFORM_BUFFER_BINDINGS.' );
    }
    gl.bindBufferBase( gl.UNIFORM_BUFFER, index, buffers[ uniformsGroup.id ] );
  }`);
  replace(/\t\t\/\/ ensure to update the binding points\/block indices mapping for this program[\s\S]*?state.updateUBOMapping\( uniformsGroup, webglProgram \);/, '');
  replace(/\t\tconst bindingPointIndex = allocateBindingPointIndex\(\);\s*uniformsGroup.__bindingPointIndex = bindingPointIndex;/, '');
  replace(/\t\tgl.bindBufferBase\( gl.UNIFORM_BUFFER, bindingPointIndex, buffer \);/, '');
  replace(/\tfunction allocateBindingPointIndex\(\) \{[\s\S]*?\n\t\}\n/, '');
  replace(/\t\tconst index = allocatedBindingPoints.indexOf\( uniformsGroup.__bindingPointIndex \);\s*allocatedBindingPoints.splice\( index, 1 \);/, '');
  replace('allocatedBindingPoints = [];', 'programBlocks = new WeakMap();');
  return source;
}
