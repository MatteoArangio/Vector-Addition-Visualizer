# Vector Addition Visualizer

A small web app that shows how two 2D vectors add, using the head-to-tail method.

Enter the components of **v₁** and it is drawn on the plane; the fields for **v₂** then unlock.
Once both vectors are on screen, *Add vectors* animates the construction: a copy of v₂ travels
from the origin to the tip of v₁ (leaving a dashed outline where it started), and the sum grows
from the origin to the new tip while the result fills in.

## Running it

Open `index.html` in a browser. There is no build step and nothing to install.

To serve it locally instead: `python -m http.server` and visit `http://localhost:8000`.

## Features

- Live rendering as you type, with smooth eased animations throughout
- Auto-fitting view: the plane rescales and relabels its grid to keep every vector visible
- Replay the addition, or start from scratch with new values
- Dark and light themes, remembered between visits
- Keyboard friendly: `Enter` moves to the next field and triggers the addition

## Layout

| File | Purpose |
| --- | --- |
| `index.html` | Markup: the canvas, the equation row, the buttons |
| `styles.css` | Theme variables and layout |
| `js/anim.js` | Easing and a small promise-based tween helper |
| `js/scene.js` | Canvas rendering: grid, axes, arrows, labels |
| `js/main.js` | Input handling, state, animation sequences |

No dependencies, no frameworks — plain HTML, CSS and JavaScript.

The visual style is inspired by [3blue1brown](https://www.3blue1brown.com/).
