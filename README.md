# Recovered Fractal Generator

A clean reconstruction built from the surviving `fractalgen-backup` artifact.

The recovered file is intentionally preserved untouched as forensic evidence. It contains recognisable fractal kernels, scene/material shader fragments, texture plumbing, ocean/environment code, unrelated application fragments, and large spans of shuffled/rendered debris. It is not a source tree that can be repaired line-by-line, so this repository now wraps that evidence with a new runnable renderer that restores the remembered behaviour.

## What the reconstruction does

- Live GPU fractal rendering in WebGL2 with no runtime dependencies or build step.
- **Quaternion Julia 4D** mode: a real four-component quaternion iteration rendered as a moving 3D slice, with exposed W slice plus XW/YW/ZW rotation.
- Mandelbulb, Mandelbox, and folded-loop IFS families.
- Continuous growth/breathing, domain twisting, animated slicing, and topology-like looping motion.
- Six camera behaviours: Orbit, Chase, Flythrough, Lissajous, 4D Lock, and Observer.
- Mouse orbit and wheel zoom layered over automated camera motion.
- Animated triplanar surface textures with procedural Plasma, Veins, Cells, and Grid sources.
- Local image texture loading by picker or drag-and-drop.
- Live controls for fractal structure, Julia constants, animation, camera, material, lighting, fog, shadows, raymarch quality, and render scale.
- Six visual presets, mutation, pause, fullscreen, PNG capture, and state JSON import/export.

## Run

The simplest Windows launch is:

1. Double-click `0Play.cmd`.
2. Or open `index.html` directly in a current Chrome, Edge, or Firefox browser.

No server is required. The renderer deliberately uses a classic local script rather than ES modules, so `file://` launching works.

Controls:

- Drag: orbit/offset the active camera.
- Mouse wheel: zoom.
- Space: pause/resume.
- R: mutate the current fractal parameters.
- H: hide/show the UI.
- F: fullscreen.
- 1–6: apply the six presets.
- Drop an image onto the viewport: use it as the moving triplanar surface texture.

## Rendering model

The renderer is a full-screen WebGL2 ray marcher. The default Quaternion Julia mode embeds every sampled 3D point into a quaternion `(x,y,z,w)`, applies animated rotations through planes involving W, iterates the quaternion Julia recurrence, and distance-estimates the resulting 4D set. Changing **4D slice W** changes which 3D cross-section is observed; changing **4D rotation** continuously rotates that section through the fourth dimension.

The other fractal families share the same animated domain, camera system, texture system, and physically-inspired shading pass. Surface detail is produced with triplanar texture projection, animated UV flow, cosine palettes, diffuse/specular response, emission, ambient occlusion, soft shadows, and distance fog.

## Quality and compatibility

The default render scale is 0.85 and the default ray budget is 116 steps. Both can be adjusted live. High-DPI displays are capped at 2× device pixel ratio before render scaling to avoid accidental extreme workloads.

WebGL2 and hardware acceleration are required. No network access, external CDN, npm install, or texture download is needed at runtime.

For repository validation:

```text
npm run check
```

This performs JavaScript syntax checks plus static integration checks on the reconstructed shell.

## Recovery policy

`fractalgen-backup` remains the immutable recovered artifact. New reconstruction code lives alongside it instead of rewriting or sanitising the evidence. If future forensic work identifies additional coherent original behaviour, it can be reintroduced incrementally without losing the recovered source material.
