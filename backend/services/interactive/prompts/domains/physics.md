## Physics Domain Guidance

This question is from physics. Apply these preferences when selecting entities:

### Entity preferences

- **Mechanics / kinematics / dynamics** (projectile motion, forces, collisions, oscillations):
  - Use `freeform_html` with a Canvas 2D simulation as the primary entity
  - In `props.spec`: always include sliders for the 2–3 key parameters (e.g. speed, angle, mass)
  - In `props.spec`: draw velocity and force vectors if they help illustrate the concept
  - In `props.spec`: add ghost trails for comparative trajectories when relevant
  - In `props.spec`: show live numerical readouts (position, velocity, time)

- **Optics / waves / electromagnetism**:
  - Use `freeform_html` for wave animations, ray diagrams, or field line visualizations
  - Keep the simulation focused on one phenomenon

- **Thermodynamics / statistical mechanics**:
  - Use `freeform_html` for particle simulations or PV diagrams
  - Use `mermaid_viewer` for process diagrams (Carnot cycle stages, etc.)

- **Looping animations** (pendulums, springs, waves, orbital mechanics, particle systems, fluid flow):
  - Use `p5_sketch` — it runs at 60fps using p5.js and is ideal for smooth continuous animations
  - In `props.spec`: describe the objects drawn, the physics equations used, and 2–3 slider controls
  - Prefer `p5_sketch` over `freeform_html` for physics: the p5.js API makes vector math and animation much cleaner
  - Example spec: "Animate a spring-mass system. Draw a ceiling anchor, a vertical spring, and a circular mass. Use Hooke's law F=−kx with damping F=−bv. Slider for spring constant k (1–20 N/m), mass (0.1–2 kg), and damping coefficient b (0–2). Show displacement, velocity, and period as text overlays."

- **Conceptual explanations** (laws, principles, thought experiments):
  - Use `mermaid_viewer` for a simple diagram if the concept has clear components
  - Use `p5_sketch` if motion or dynamics are central (preferred over `freeform_html`)

### Layout guidance

- Physics simulations should be the first entity — they are the primary learning tool
- Follow with explanation in the `explanation` field (not in additional entities)
- Keep to 1–2 entities; a well-specified simulation plus step controls if needed

### Simulation spec writing tips

When writing `props.spec` for `freeform_html`, be explicit:
- Name the coordinate system (origin, positive directions)
- Specify what is animated (ball, particle, wave, arrow)
- Specify exactly which sliders to expose and their ranges
- Specify what vectors to draw (velocity → blue arrow, acceleration → red arrow)
- Mention whether to use SI units in readouts
