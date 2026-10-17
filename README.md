# Brainrot Brawl

A Smash-style platform fighter for the browser starring the Italian brainrot characters. Up to four fighters (people or CPUs) knock each other off the stage. The more damage a fighter has taken, the farther they fly.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine tests (no browser needed)
npm run build    # production build
```

## Controls

| | Player 1 | Player 2 | Controller |
|---|---|---|---|
| Move | A / D | ← / → | Stick or D-pad |
| Jump | W or Space | ↑ | A / Y |
| Attack | F | K | X |
| Special | G | L | B |
| Shield / dodge | H | ; | Bumpers or triggers |
| Drop through / fast fall | S | ↓ | Down |

Hold a direction while attacking or using a special to get a different move. Up + special is each fighter's recovery. Esc pauses.

## What's in it

- **8 fighters:** Tralalero Tralala, Tung Tung Tung Sahur, Bombardiro Crocodilo, Ballerina Cappuccina, Brr Brr Patapim, Chimpanzini Bananini, Lirilì Larilà, Cappuccino Assassino. Each has 8 normal attacks, 4 specials and a Final.
- **5 stages**, each with a gimmick: Sahur Village, Tralalero Beach, Bombardiro Skies, Cappuccino Café, Banana Jungle.
- **Items:** pizza (heals), espresso (speed), banana peels (throw them) and the Skibidi Orb (break it to unlock your Final).
- **CPU opponents** at three difficulty levels.
- **Party rules:** big heads, low gravity.
- Sound effects are generated in the browser. There are no audio or image files.

## Code layout

- `game/engine.js`: match simulation. `createMatch()` builds a match and `step()` advances it one 60 fps frame. It never touches the DOM, so tests run matches headless.
- `game/physics.js`, `game/combat.js`: movement and collisions; hits, knockback, shields, grabs and counters.
- `game/fighters.js`: every fighter's stats and frame data. To tune a move, edit its numbers here.
- `game/stages.js`, `game/items.js`, `game/ai.js`: stages and their gimmicks, items, CPU players.
- `game/render.js`, `game/art.js`, `game/scenery.js`: drawing the match, the characters and the stages.
- `game/input.js`, `game/audio.js`: keyboard/gamepad input and sound.
- `components/`: the React screens (title, character select, stage select, fight, results).

## A note on the characters

The brainrot characters are internet memes, and some have contested ownership. All their names, colours and drawings live in `game/fighters.js` and `game/art.js`, so they can be swapped for original characters before a public release or anything that makes money.
