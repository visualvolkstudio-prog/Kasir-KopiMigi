const raster = new Uint8Array([1, 2, 3, 4]);
const trimmed = raster.slice(0, 2);
console.log(trimmed instanceof Uint8Array);
console.log(trimmed.length);
