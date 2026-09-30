// Keep the node graph key for each material's builder/uniform state, but share
// GPU programs by the generated source. Node UUIDs are not shader variants.
// Applied only to the pinned r185 compatibility backend, never classic materials.
export function patchNodeProgramRenderer(source) {
  const replace = (before, after) => {
    if (!source.includes(before)) throw new Error('Pinned WebGLRenderer source changed.');
    source = source.replace(before, after);
  };
  replace('const programCacheKey = programCache.getProgramCacheKey( parameters );',
    `const programCacheKey = programCache.getProgramCacheKey( parameters );
      materialProperties.gdevelopNodeProgramKey = programCacheKey;`);
  replace('program = programCache.acquireProgram( parameters, programCacheKey );',
    `// The builder has now resolved the graph, geometry, lights and outputs.
      // Preserve every other parameter (including defines and attribute bindings)
      // and use exact source strings, avoiding hash collisions and UUID variants.
      const gpuCacheKey = _nodesHandler !== null && material.isNodeMaterial
        ? 'gdevelop-node-source:' + JSON.stringify(Object.entries(parameters).filter(
          ([key]) => !['uniforms', 'customProgramCacheKey',
            'customVertexShaderID', 'customFragmentShaderID'].includes(key)))
        : programCacheKey;
      program = programCache.acquireProgram( parameters, gpuCacheKey );`);
  return source;
}

export function patchNodeProgramHandler(source) {
  const replace = (before, after) => {
    if (!source.includes(before)) throw new Error('Pinned WebGLNodesHandler source changed.');
    source = source.replace(before, after);
  };
  replace('const currentProgram = renderer.properties.get( this ).currentProgram;',
    'const currentProgram = renderer.properties.get( this ).gdevelopNodeProgramKey;');
  replace('const programs = programCache.get( material );',
    `const programs = programCache.get( material );
      // Distinct graphs can emit identical GLSL but have different uniform nodes.
      const bindingKey = materialProperties.gdevelopNodeProgramKey;`);
  replace('if ( ! programs.has( program ) )', 'if ( ! programs.has( bindingKey ) )');
  replace('programs.set( program, {', 'programs.set( bindingKey, {');
  replace('programs.get( program );', 'programs.get( bindingKey );');
  return source;
}
