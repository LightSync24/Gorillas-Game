// state of the game
let state = {};

// the main canvas element and its drawing context
const canvas = document.getElementById("game");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext("2d"); // this is a built-in API with methods and props that we can use to draw on the canvas element from JS
const blastHoleRadius = 18;

// left info panel
const angle1DOM = document.querySelector("#info-left .angle");
const velocity1DOM = document.querySelector("#info-left .velocity");

// right info panel
const angle2DOM = document.querySelector("#info-right .angle");
const velocity2DOM = document.querySelector("#info-right .velocity");

// congratulations panel
const congratulationsDOM = document.getElementById("congratulations");
const winnerDOM = document.getElementById("winner");
const newGameButtonDOM = document.getElementById("new-game");

// bomb's grab area
const bombGrabAreaDOM = document.getElementById("bomb-grab-area");
newGame();
// this function initializes and resets the game state, generates meta-data for the level and calls the draw function

function newGame() {
  // reset game state
  state = {
    phase: "aiming", // aiming / in flight / celebrating
    currentPlayer: 1,
    bomb: {
      x: undefined,
      y: undefined,
      rotation: 0,
      velocity: { x: 0, y: 0 },
    },

    // buildings
    backgroundBuildings: [],
    buildings: [],
    blastHoles: [],

    scale: 1,
  };

  //generate background buidings
  for (let i = 0; i < 11; i++) {
    generateBackgroundBuilding(i);
  }

  //generate buildings
  for (let i = 0; i < 8; i++) {
    generateBuilding(i);
  }

  calculateScale();
  initializeBombPosition();

  // reset HTML elements
  congratulationsDOM.style.visibility = "hidden";
  angle1DOM.innerText = 0;
  velocity1DOM.innerText = 0;
  angle2DOM.innerText = 0;
  velocity2DOM.innerText = 0;

  draw();
}

function draw() {
  ctx.save();
  // flip coordinate system upside down
  ctx.translate(0, window.innerHeight); // the transalte method accumulates, if we call it again, it wont override, it will make those new changes on top of the prev ones
  ctx.scale(1, -1); // flipping the co-ordinate system along the y-axis
  ctx.scale(state.scale, state.scale);

  // draw scene
  drawBackground();
  drawBackgroundBuildings();
  drawBuildingsWithBlastHoles();
  drawGorilla(1);
  drawGorilla(2);
  drawBomb();

  // restore transformation
  ctx.restore();
}

let isDragging = false;
let dragStartX = undefined;
let dragStartY = undefined;

// event handlers
bombGrabAreaDOM.addEventListener("mousedown", function (e) {
  if (state.phase === "aiming") {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    document.body.style.cursor = "grabbing"; // the cursor will stay at grabbing even if we leave the grab area
  }
});

// Set values on the info panel
function setInfo(deltaX, deltaY) {
  const hypotenuse = Math.sqrt(deltaX ** 2 + deltaY ** 2);
  const angleInRadians = Math.asin(deltaY / hypotenuse);
  const angleInDegrees = (angleInRadians / Math.PI) * 180;

  if (state.currentPlayer === 1) {
    angle1DOM.innerText = Math.round(angleInDegrees);
    velocity1DOM.innerText = Math.round(hypotenuse);
  } else {
    angle2DOM.innerText = Math.round(angleInDegrees);
    velocity2DOM.innerText = Math.round(hypotenuse);
  }
}

window.addEventListener("mousemove", function (e) {
  if (isDragging) {
    let deltaX = e.clientX - dragStartX;
    let deltaY = e.clientY - dragStartY;

    state.bomb.velocity.x = -deltaX; // we drag backwards, thus the velocity should be forwards, hence the -ve sign
    state.bomb.velocity.y = deltaY; // no -ve in 'y' as we have already flipped the co-ordinate system
    setInfo(deltaX, deltaY);

    draw();
  }
});

window.addEventListener("mouseup", function () {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = "default";

    throwBomb(); // this will kick off the animation cycle
  }
});

let previousAnimationTimestamp = undefined;
// event handlers to make the game interactive
function throwBomb() {
  state.phase = "in flight";
  previousAnimationTimestamp = undefined;
  requestAnimationFrame(animate);
}

function moveBomb(elapsedTime) {
  const multiplier = elapsedTime / 200; // the velocity can be very high, thus in order to make it seem low, we have this number which we
  // use to reduce the velocity

  // adjust trajectory by gravity
  state.bomb.velocity.y -= 20 * multiplier;

  // calculate the new position
  state.bomb.x += state.bomb.velocity.x * multiplier;
  state.bomb.y += state.bomb.velocity.y * multiplier;

  // rotate according to the direction
  const direction = state.currentPlayer === 1 ? -1 : 1;
  state.bomb.rotation += direction * 5 * multiplier;
}

function checkFrameHit() {
  // stop throw animation once the bomb gets out of the left, bottom, or right edge of the screen
  if (
    state.bomb.y < 0 ||
    state.bomb.x < 0 ||
    state.bomb.x > window.innerWidth / state.scale
  )
    // no need to check for the top, as we use the gravity to pull it back, so it will re-appear or will go out of bounds
    return true; // the bomb is off-screen
}

function checkBuildingHit() {
  for (let i = 0; i < state.buildings.length; i++) {
    const building = state.buildings[i];
    if (
      state.bomb.x + 4 > building.x &&
      state.bomb.x - 4 < building.x + building.width &&
      state.bomb.y - 4 < 0 + building.height
    ) {
      // check if the bomb is inside the blast hole of a prev impact
      for (let j = 0; j < state.blastHoles.length; j++) {
        const blastHole = state.blastHoles[j];
        // check how far the bomb is from the center of a prev blast hole
        const horizontalDistance = state.bomb.x - blastHole.x;
        const verticalDistance = state.bomb.y - blastHole.y;
        const distance = Math.sqrt(
          horizontalDistance ** 2 + verticalDistance ** 2
        );
        if (distance < blastHoleRadius) {
          // the bomb is inside of the rectangle of a building but a prev bomb already blew off this part
          return false;
        }
      }

      state.blastHoles.push({ x: state.bomb.x, y: state.bomb.y });
      return true;
    }
  }
}

function checkGorillaHit() {
  const enemyPlayer = state.currentPlayer === 1 ? 2 : 1;
  const enemyBuilding =
    enemyPlayer === 1 ? state.buildings.at(1) : state.buildings.at(-2);

  ctx.save();

  ctx.translate(
    enemyBuilding.x + enemyBuilding.width / 2,
    enemyBuilding.height
  );

  drawGorillaBody();
  let hit = ctx.isPointInPath(state.bomb.x, state.bomb.y);

  drawGorillaLeftArm(enemyPlayer);
  hit ||= ctx.isPointInStroke(state.bomb.x, state.bomb.y);

  drawGorillaRightArm(enemyPlayer);
  hit ||= ctx.isPointInStroke(state.bomb.x, state.bomb.y);

  drawGorillaFace(enemyPlayer);
  hit ||= ctx.isPointInPath(state.bomb.x, state.bomb.y);

  ctx.restore();

  return hit;
}

function animate(timestamp) {
  // this function paints over the screen 60 times in one second, thus it appears as a constant animation
  if (previousAnimationTimestamp === undefined) {
    // the very first animation cycle will be an exception, we dont have the prev timestamp
    previousAnimationTimestamp = timestamp;
    requestAnimationFrame(animate);
    return;
  }

  const elapsedTime = timestamp - previousAnimationTimestamp;
  // moveBomb(elapsedTime);
  const hitDetectionPrecision = 10;
  for (let i = 0; i < hitDetectionPrecision; i++) {
    moveBomb(elapsedTime / hitDetectionPrecision);
    // hit detection
    const miss = checkFrameHit() || checkBuildingHit();
    const hit = checkGorillaHit();

    // handle the case when we hit a building or the bomb goes off screen
    if (miss) {
      state.currentPlayer = state.currentPlayer === 1 ? 2 : 1; // switch players
      state.phase = "aiming";
      initializeBombPosition();

      draw();
      return;
    }
    // handle the case when we hit the enemy
    if (hit) {
      state.phase = "celebrating";
      announceWinner();

      draw();
      return;
    }
  }
  draw();

  // continue the animation loop
  previousAnimationTimestamp = timestamp;
  requestAnimationFrame(animate);
}

function announceWinner() {
  winnerDOM.innerText = `Player ${state.currentPlayer}`;
  congratulationsDOM.style.visibility = "visible";
}
newGameButtonDOM.addEventListener("click", newGame);

function generateBackgroundBuilding(index) {
  // generates the meta data for the buildings
  const previosusBuilding = state.backgroundBuildings[index - 1];
  const x = previosusBuilding
    ? previosusBuilding.x + previosusBuilding.width + 4
    : -30;

  const minWidth = 60;
  const maxWidth = 110;
  const width = minWidth + Math.random() * (maxWidth - minWidth);

  const minHeight = 80;
  const maxHeight = 350;
  const height = minHeight + Math.random() * (maxHeight - minHeight);

  state.backgroundBuildings.push({ x, width, height });
}

function generateBuilding(index) {
  const previosusBuilding = state.buildings[index - 1];
  const x = previosusBuilding
    ? previosusBuilding.x + previosusBuilding.width + 4
    : 0;
  const minWidth = 80;
  const maxWidth = 130;
  const width = minWidth + Math.random() * (maxWidth - minWidth);

  const platformWithGorilla = index === 1 || index === 7;

  const minHeight = 40;
  const maxHeight = 300;
  // in case a gorilla is standin on top of a builiding, the height range is smaller
  // we want relatively higher building b/w the gorillas
  const minHeightGorilla = 30;
  const maxHeightGorilla = 150;

  const height = platformWithGorilla
    ? minHeightGorilla + Math.random() * (maxHeightGorilla - minHeightGorilla)
    : minHeight + Math.random() * (maxHeight - minHeight);

  const lightsOn = [];
  for (let i = 0; i < 50; i++) {
    const light = Math.random() <= 0.33 ? true : false;
    lightsOn.push(light);
  }
  state.buildings.push({ x, width, height, lightsOn });
}

function initializeBombPosition() {
  // places the bomb in the hand of the gorilla that throws the bomb
  const building =
    state.currentPlayer === 1 ? state.buildings.at(1) : state.buildings.at(-2);

  // locate the gorilla
  const gorillaX = building.x + building.width / 2;
  const gorillaY = building.height;

  // offset to the hand of the gorilla
  const gorillaHandOffsetX = state.currentPlayer === 1 ? -28 : 28;
  const gorillaHandOffsetY = 107;

  // bomb co-ordinates
  state.bomb.x = gorillaX + gorillaHandOffsetX;
  state.bomb.y = gorillaY + gorillaHandOffsetY;

  // initialize the velocity
  state.bomb.velocity.x = 0;
  state.bomb.velocity.y = 0;
  state.bomb.rotation = 0;

  // initialize the position of grab area in HTML
  const grabAreaRadius = 15;
  const left = state.bomb.x * state.scale - grabAreaRadius;
  const bottom = state.bomb.y * state.scale - grabAreaRadius;
  bombGrabAreaDOM.style.left = `${left}px`;
  bombGrabAreaDOM.style.bottom = `${bottom}px`;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(
    0,
    0,
    0,
    window.innerHeight / state.scale
  );
  gradient.addColorStop(1, "#F8BA85");
  gradient.addColorStop(0, "#FFC28E");

  // drawing the sky
  ctx.fillStyle = gradient;
  ctx.fillRect(
    0,
    0,
    window.innerWidth / state.scale,
    window.innerHeight / state.scale
  );

  // draw the moon
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.arc(300, 350, 60, 0, 2 * Math.PI); // the center, radius, start angle and end angle in radians
  ctx.fill();
}

function drawBackgroundBuildings() {
  state.backgroundBuildings.forEach((building) => {
    ctx.fillStyle = "#947285";
    ctx.fillRect(building.x, 0, building.width, building.height);
  });
}

function drawBuildings() {
  state.buildings.forEach((building) => {
    // drawing the building
    ctx.fillStyle = "#4A3C68";
    ctx.fillRect(building.x, 0, building.width, building.height);

    // draw windows
    const windowWidth = 10;
    const windowHeight = 12;
    const gap = 15; // think of it as the padding of the building and the gap b/w 2 adjacent windows

    const numberOfFloors = Math.ceil(
      (building.height - gap) / (windowHeight + gap)
    );
    const numberOfRoomsPerFloor = Math.floor(
      (building.width - gap) / (windowWidth + gap)
    );

    for (let floor = 0; floor < numberOfFloors; floor++) {
      for (let room = 0; room < numberOfRoomsPerFloor; room++) {
        if (building.lightsOn[floor * numberOfRoomsPerFloor + room]) {
          ctx.save();
          // we translate the coordinate system for placing the windows
          ctx.translate(building.x + gap, building.height - gap);
          ctx.scale(1, -1);

          const x = room * (windowWidth + gap);
          const y = floor * (windowHeight + gap);

          ctx.fillStyle = "#EBB6A2";
          ctx.fillRect(x, y, windowWidth, windowWidth);
          ctx.restore(); // restoring the translation after placing the windows
        }
      }
    }
  });
}

function drawGorilla(player) {
  ctx.save();

  const building =
    player === 1 ? state.buildings.at(1) : state.buildings.at(-2);

  ctx.translate(building.x + building.width / 2, building.height); // translating the co-ordinate origin to the center of the rooftop
  drawGorillaBody();
  drawGorillaLeftArm(player);
  drawGorillaRightArm(player);
  drawGorillaFace(player);
  ctx.restore();
}

function drawGorillaBody() {
  ctx.fillStyle = "black";

  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-20, 0);
  ctx.lineTo(-17, 18);
  ctx.lineTo(-20, 44);

  ctx.lineTo(-11, 77);
  ctx.lineTo(0, 84);
  ctx.lineTo(11, 77);

  ctx.lineTo(20, 44);
  ctx.lineTo(17, 18);
  ctx.lineTo(20, 0);
  ctx.lineTo(7, 0);
  ctx.fill();
}

function drawGorillaLeftArm(player) {
  ctx.strokeStyle = "black";
  ctx.lineWidth = 18;

  ctx.beginPath();
  ctx.moveTo(-14, 50); // somewhere around the shoulder of the gorilla

  if (state.phase === "aiming" && state.currentPlayer === 1 && player === 1) {
    ctx.quadraticCurveTo(
      -44,
      63,
      -28 - state.bomb.velocity.x / 6.25,
      107 - state.bomb.velocity.y / 6.25
    );
  } else if (state.phase === "celebrating" && state.currentPlayer === player) {
    ctx.quadraticCurveTo(-44, 63, -28, 107);
  } else {
    ctx.quadraticCurveTo(-44, 45, -28, 12);
  }

  ctx.stroke();
}

function drawGorillaRightArm(player) {
  ctx.strokeStyle = "black";
  ctx.lineWidth = 18;

  ctx.beginPath();
  ctx.moveTo(+14, 50);

  if (state.phase === "aiming" && state.currentPlayer === 2 && player === 2) {
    ctx.quadraticCurveTo(
      +44,
      63,
      +28 - state.bomb.velocity.x / 6.25,
      107 - state.bomb.velocity.y / 6.25
    );
  } else if (state.phase === "celebrating" && state.currentPlayer === player) {
    ctx.quadraticCurveTo(+44, 63, +28, 107);
  } else {
    ctx.quadraticCurveTo(+44, 45, +28, 12);
  }

  ctx.stroke();
}

function drawGorillaFace(player) {
  // Face
  ctx.fillStyle = "lightgray";
  ctx.beginPath();
  ctx.arc(0, 63, 9, 0, 2 * Math.PI);
  ctx.moveTo(-3.5, 70);
  ctx.arc(-3.5, 70, 4, 0, 2 * Math.PI);
  ctx.moveTo(+3.5, 70);
  ctx.arc(+3.5, 70, 4, 0, 2 * Math.PI);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "black";
  ctx.beginPath();
  ctx.arc(-3.5, 70, 1.4, 0, 2 * Math.PI);
  ctx.moveTo(+3.5, 70);
  ctx.arc(+3.5, 70, 1.4, 0, 2 * Math.PI);
  ctx.fill();

  ctx.strokeStyle = "black";
  ctx.lineWidth = 1.4;

  // Nose
  ctx.beginPath();
  ctx.moveTo(-3.5, 66.5);
  ctx.lineTo(-1.5, 65);
  ctx.moveTo(3.5, 66.5);
  ctx.lineTo(1.5, 65);
  ctx.stroke();

  // Mouth
  ctx.beginPath();
  if (state.phase === "celebrating" && state.currentPlayer === player) {
    ctx.moveTo(-5, 60);
    ctx.quadraticCurveTo(0, 56, 5, 60);
  } else {
    ctx.moveTo(-5, 56);
    ctx.quadraticCurveTo(0, 60, 5, 56);
  }
  ctx.stroke();
}

function drawBomb() {
  ctx.save();
  ctx.translate(state.bomb.x, state.bomb.y); // translate the co-ordiantes to the bomb's initial position

  if (state.phase === "aiming") {
    // move the bomb with the mouse while aiming
    ctx.translate(-state.bomb.velocity.x / 6.25, -state.bomb.velocity.y / 6.25);

    // draw throwing trajectory
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.setLineDash([3, 8]); // after every 3 pixels, we want a gap of 8 pixels
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(0, 0); // moving the co-ordinate sys to the center of the bomb
    ctx.lineTo(state.bomb.velocity.x, state.bomb.velocity.y);
    ctx.stroke();

    // draw circle
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    ctx.fill();
  } else if (state.phase === "in flight") {
    // draw rotated banana
    ctx.fillStyle = "white";
    ctx.rotate(state.bomb.rotation);
    ctx.beginPath();
    // we draw two arches and fill them
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(0, 12, 8, -2);
    ctx.quadraticCurveTo(0, 2, -8, -2);
    ctx.fill();
  } else {
    // draw circle
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

function calculateScale() {
  // we first calculate the total width of the city
  const lastBuilding = state.buildings.at(-1);
  const totalWidthOfTheCity = lastBuilding.x + lastBuilding.width;

  state.scale = window.innerWidth / totalWidthOfTheCity; // this tells how the width of the city relates to the width of the window
}

function drawBuildingsWithBlastHoles() {
  ctx.save();
  state.blastHoles.forEach((blastHole) => {
    // we iterate over the blasthole array and draw a clipping mask for each
    ctx.beginPath();
    // outer shape clockwise
    ctx.rect(
      0,
      0,
      window.innerWidth / state.scale,
      window.innerHeight / state.scale
    );

    // inner shape counter clockwise
    ctx.arc(blastHole.x, blastHole.y, blastHoleRadius, 0, 2 * Math.PI, true); // the 'true' makes is counter-clockwise
    ctx.clip(); // we end it with the .clip method
  });
  drawBuildings();
  ctx.restore();
}

window.addEventListener("resize", () => {
  // get the new canvas height and width
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // recalculate the scale and based on that, the bomb positiona and we draw with the whole game with the new scale
  calculateScale();
  initializeBombPosition();
  draw();
});
