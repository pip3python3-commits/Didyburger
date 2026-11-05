// Registry of extra sets (worlds). Built-ins 'street' and 'court' live in world.js.
// To add a world: create sets/<name>.js exporting default { name, sky, build(kit) -> {group, update?(state,t,beat)} } and list it here.
// Dense sets should use sets/dress.js (textures, props, bake) and sets/rats.js-style instancing for crowds.
import studio from './studio.js';
import lab from './lab.js';
import oldquarter from './oldquarter.js';
import sewer from './sewer.js';
import office from './office.js';
import ratfarm from './ratfarm.js';
export const EXTRA_SETS = [studio, lab, oldquarter, sewer, office, ratfarm];
