// The classic renderer refreshes fogDensity for FogExp2 even when the node
// shader uses a reference uniform. r185 supplies only the linear placeholders.
export function patchNodeFogUniforms(source) {
  const marker = 'fogFar: { value: 0 },';
  if (!source.includes(marker)) throw new Error('Pinned fog uniforms changed.');
  return source.replace(marker, marker + '\n\t\t\tfogDensity: { value: 0 },');
}
