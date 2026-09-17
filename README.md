# Recovered Fractal Generator

A clean WebGL2 reconstruction built from the surviving `fractalgen-backup` artifact and subsequent visual recollection.

The original recovered file remains untouched as forensic evidence. It contains recognisable fractal kernels, scene/material shader fragments and texture plumbing interleaved with unrelated code and damaged/rendered debris, so the executable project is reconstructed alongside it rather than pretending the artifact can be repaired line-by-line.

## Reconstruction v2: flow-field renderer

The primary target is now a **camera moving with and through a fractal that flows through space**, rather than an isolated fractal object being inspected from outside.

- **Recursive Flow Filaments** is the default family: thin recursive rails, rings and strands that continue through an advecting spatial field rather than closing into one central blob.
- Spatial advection and growth are coupled. The fractal propagates along the flow axis while local breathing, recursive pulse and domain twist make growth itself contribute to motion.
- **Flow Chase** is the default camera. It follows the procedural path at a slightly different velocity from the field, so geometry overtakes and recedes around the viewer.
- Flythrough, Follow Growth, Chase, Orbit, Lissajous, 4D Lock and Observer camera behaviours remain selectable.
- Surface treatment is deliberately rougher and grainier: spatial micro-breakup, animated film grain, higher default roughness, thinner features and a new Filament Grain procedural texture.
- Independent controls expose **Space flow**, **Flow path warp**, **Growth / propagation**, **Filament width** and **Surface grain**, so motion and shape are not conflated.

The earlier families remain available and now inherit the same flowing domain:

- Quaternion Julia 4D, with moving 3D W-slices and rotations through planes involving the fourth component.
- Mandelbulb.
- Mandelbox.
- Folded Loop IFS.

## Interaction and materials

- Drag biases the automated camera instead of replacing it.
- Mouse wheel changes follow/orbit distance.
- Procedural Filament Grain, Plasma, Veins, Cells and Grid textures.
- Load arbitrary image textures with the picker or drag-and-drop.
- Animated triplanar texture flow.
- Live controls for fractal structure, flow/growth, 4D slicing, camera, material, lighting, fog, shadows and raymarch quality.
- Six starting presets, mutation, pause, fullscreen, PNG capture, and state JSON import/export.

## Run

On Windows, double-click `0Play.cmd`. You can also open `index.html` directly in a current Chrome, Edge, or Firefox browser.

No build server or external dependencies are required at runtime; the local `file://` path is intentionally supported.

Controls:

- Drag: bias the current chase/orbit view.
- Mouse wheel: alter follow distance.
- Space: pause/resume.
- R: mutate the current fractal and flow parameters.
- H: hide/show the UI.
- F: fullscreen.
- 1–6: apply the six presets.
- Drop an image onto the viewport: map it onto the moving fractal field.

## Rendering model

Rendering uses a full-screen WebGL2 distance-field ray marcher. The flow system first advects sampled world positions through time, bends that moving coordinate field around a procedural spatial path, applies growth/twist deformation, and then evaluates the selected fractal distance estimator.

The default filament estimator repeatedly folds, rotates, sorts and rescales space, sampling thin rail/ring/strand primitives at each recursive level. This produces a much more skeletal structure than the smooth closed surfaces of the earlier reconstruction.

Surface detail combines animated triplanar texture projection, cosine palettes, spatial micro-grain, diffuse/specular lighting, emission, ambient occlusion, soft shadows, distance fog and a small temporal film-grain pass.

## Quality and compatibility

The default ray budget is 132 steps at 0.78 render scale. Both can be adjusted live. High-DPI displays are capped at 2× device pixel ratio before render scaling.

WebGL2 and hardware acceleration are required. No CDN, npm install or network texture access is needed at runtime.

Repository validation:

```text
npm run check
```

This performs JavaScript syntax checks plus static renderer/UI integration checks.

## Recovery policy

`fractalgen-backup` remains the immutable recovered artifact. Reconstruction code is kept separate so additional trustworthy evidence can be incorporated later without rewriting the original data.
