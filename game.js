import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd6ff);
scene.fog = new THREE.Fog(0x9fd6ff, 18, 260);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const clock = new THREE.Clock();
const keys = {};

const courseEl = document.getElementById("course");
const acornsEl = document.getElementById("acorns");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");

const player = {
  position: new THREE.Vector3(0, 3, 8),
  velocity: new THREE.Vector3(),
  radius: 0.45,
  height: 1.6,
  moveSpeed: 12,
  jumpSpeed: 10,
  dashMultiplier: 1.65,
  grounded: false,
};

const game = {
  acornsCollected: 0,
  acornsTotal: 0,
  currentCourse: "Maple Sprint",
  completed: new Set(),
  runStarted: false,
  timer: 0,
  won: false,
};

const worldBounds = { minX: -54, maxX: 54, minZ: -42, maxZ: 150 };
const gravity = 24;

const platforms = [];
const courseGoals = [];
const acorns = [];

function setMessage(text) {
  messageEl.textContent = text;
}

function updateHUD() {
  courseEl.textContent = `Course: ${game.currentCourse}`;
  acornsEl.textContent = `Acorns: ${game.acornsCollected} / ${game.acornsTotal}`;
  timerEl.textContent = `Time: ${game.timer.toFixed(1)}s`;
}

function addPlatform(position, size, color = 0x8a5d3b, emissive = 0x2f1a09) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      metalness: 0.05,
      emissive,
    })
  );
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  platforms.push({
    mesh,
    minX: position.x - size.x / 2,
    maxX: position.x + size.x / 2,
    minZ: position.z - size.z / 2,
    maxZ: position.z + size.z / 2,
    top: position.y + size.y / 2,
  });
}

function spawnAcorn(position) {
  const group = new THREE.Group();

  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0xc78d3a, roughness: 0.6, metalness: 0.1 })
  );
  nut.scale.set(1, 1.1, 1);
  group.add(nut);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x7a4e2a, roughness: 0.85 })
  );
  cap.position.y = 0.24;
  cap.scale.y = 0.5;
  group.add(cap);

  group.position.copy(position);
  group.castShadow = true;
  scene.add(group);

  acorns.push({ group, collected: false });
  game.acornsTotal += 1;
}

function createGoal(position, courseName, color) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.24, 12, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(position);
  ring.castShadow = true;
  scene.add(ring);

  const light = new THREE.PointLight(color, 1.7, 20, 1.7);
  light.position.copy(position).add(new THREE.Vector3(0, 1.2, 0));
  scene.add(light);

  courseGoals.push({ ring, light, courseName, completed: false });
}

function buildCourse(originX, originZ, courseName, tint, ringColor) {
  const jumps = [
    { dx: 0, dy: 0, dz: 0, sx: 6, sy: 1.6, sz: 6 },
    { dx: 0, dy: 1.7, dz: 10, sx: 4.6, sy: 1.4, sz: 4.6 },
    { dx: 3.8, dy: 3.5, dz: 19, sx: 4.3, sy: 1.2, sz: 4.3 },
    { dx: -2.8, dy: 5.2, dz: 30, sx: 4.4, sy: 1.2, sz: 4.4 },
    { dx: 2.9, dy: 7.6, dz: 41, sx: 4.1, sy: 1.2, sz: 4.1 },
    { dx: 0, dy: 10, dz: 53, sx: 7.2, sy: 1.4, sz: 7.2 },
  ];

  jumps.forEach((j, index) => {
    const p = new THREE.Vector3(originX + j.dx, 1 + j.dy, originZ + j.dz);
    addPlatform(p, new THREE.Vector3(j.sx, j.sy, j.sz), tint, 0x241205);
    if (index > 0) {
      spawnAcorn(p.clone().add(new THREE.Vector3(0, 1.4, 0)));
    }
  });

  createGoal(new THREE.Vector3(originX, 12.6, originZ + 53), courseName, ringColor);
}

function decorateWorld() {
  const hemi = new THREE.HemisphereLight(0xe8f8ff, 0x5f7b4f, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2c8, 1.1);
  sun.position.set(25, 55, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 360),
    new THREE.MeshStandardMaterial({ color: 0x5f9442, roughness: 0.98, metalness: 0.02 })
  );
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  scene.add(field);

  for (let i = 0; i < 60; i++) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.9, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x6e4b2a, roughness: 0.95 })
    );
    trunk.position.set((Math.random() - 0.5) * 220, 3.5, (Math.random() - 0.5) * 300 + 40);
    trunk.castShadow = true;
    scene.add(trunk);

    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x4d7f31, roughness: 0.92 })
    );
    crown.position.copy(trunk.position).add(new THREE.Vector3(0, 4.8, 0));
    crown.castShadow = true;
    scene.add(crown);
  }
}

function buildStartArea() {
  addPlatform(new THREE.Vector3(0, 0.8, 8), new THREE.Vector3(18, 1.6, 16), 0x6f4631, 0x1d120a);
  addPlatform(new THREE.Vector3(-22, 0.8, 8), new THREE.Vector3(16, 1.6, 16), 0x7b5235, 0x241306);
  addPlatform(new THREE.Vector3(22, 0.8, 8), new THREE.Vector3(16, 1.6, 16), 0x7b5235, 0x241306);

  buildCourse(-22, 10, "Maple Sprint", 0x9b6b41, 0xffc24f);
  buildCourse(0, 10, "Pine Dash", 0x8e5a34, 0x69d7ff);
  buildCourse(22, 10, "Oak Leap", 0x7f4b29, 0xaaff68);
}

function clampWorld(pos) {
  pos.x = THREE.MathUtils.clamp(pos.x, worldBounds.minX, worldBounds.maxX);
  pos.z = THREE.MathUtils.clamp(pos.z, worldBounds.minZ, worldBounds.maxZ);
}

function getStandingPlatform(position) {
  for (const platform of platforms) {
    const insideX = position.x > platform.minX - player.radius && position.x < platform.maxX + player.radius;
    const insideZ = position.z > platform.minZ - player.radius && position.z < platform.maxZ + player.radius;
    const closeTop = Math.abs(position.y - platform.top) <= 0.6;
    if (insideX && insideZ && closeTop) {
      return platform;
    }
  }
  return null;
}

function handleMovement(delta) {
  if (!controls.isLocked || game.won) return;

  const moveInput = new THREE.Vector3();
  if (keys.KeyW) moveInput.z -= 1;
  if (keys.KeyS) moveInput.z += 1;
  if (keys.KeyA) moveInput.x -= 1;
  if (keys.KeyD) moveInput.x += 1;
  moveInput.normalize();

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  const speedBoost = keys.ShiftLeft || keys.ShiftRight ? player.dashMultiplier : 1;
  const desired = new THREE.Vector3()
    .addScaledVector(forward, moveInput.z)
    .addScaledVector(right, moveInput.x)
    .normalize()
    .multiplyScalar(player.moveSpeed * speedBoost);

  player.velocity.x = desired.x;
  player.velocity.z = desired.z;

  if ((keys.Space || keys.KeyJ) && player.grounded) {
    player.velocity.y = player.jumpSpeed;
    player.grounded = false;
  }

  player.velocity.y -= gravity * delta;
  player.position.addScaledVector(player.velocity, delta);

  clampWorld(player.position);
  const underFoot = getStandingPlatform(player.position.clone().add(new THREE.Vector3(0, -player.height, 0)));

  if (underFoot && player.velocity.y <= 0) {
    player.position.y = underFoot.top + player.height;
    player.velocity.y = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (player.position.y < -20) {
    player.position.set(0, 3, 8);
    player.velocity.set(0, 0, 0);
    setMessage("You fell! Back to the stump. Keep climbing, squirrel.");
  }

  controls.getObject().position.copy(player.position);
}

function detectCurrentCourse() {
  if (player.position.x < -11) {
    game.currentCourse = "Maple Sprint";
  } else if (player.position.x > 11) {
    game.currentCourse = "Oak Leap";
  } else {
    game.currentCourse = "Pine Dash";
  }
}

function updateAcorns(time, delta) {
  for (const item of acorns) {
    if (item.collected) continue;

    item.group.rotation.y += 2.2 * delta;
    item.group.position.y += Math.sin(time * 2.4 + item.group.id) * 0.006;

    if (item.group.position.distanceTo(player.position) < 1.4) {
      item.collected = true;
      item.group.visible = false;
      game.acornsCollected += 1;
      setMessage("Crunch! Acorn collected.");
    }
  }
}

function updateGoals() {
  for (const goal of courseGoals) {
    if (goal.completed) continue;

    goal.ring.rotation.z += 0.02;
    if (goal.ring.position.distanceTo(player.position) < 2.2) {
      goal.completed = true;
      game.completed.add(goal.courseName);
      goal.light.intensity = 3.0;
      setMessage(`${goal.courseName} cleared!`);
    }
  }

  if (!game.won && game.completed.size === courseGoals.length) {
    game.won = true;
    controls.unlock();
    const bonus = Math.max(0, 120 - game.timer).toFixed(1);
    setMessage(
      `You completed all squirrel parkour courses in ${game.timer.toFixed(1)}s! Bonus nuts: ${bonus}.`
    );
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("keydown", (event) => {
  keys[event.code] = true;
});

document.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

document.addEventListener("click", () => {
  if (!game.won) controls.lock();
});

controls.addEventListener("lock", () => {
  if (!game.runStarted) {
    game.runStarted = true;
    setMessage("You're a squirrel on the move. Chain jumps and clear each glowing ring!");
  } else {
    setMessage("Back in action. Dash + jump to stick each landing.");
  }
});

controls.addEventListener("unlock", () => {
  if (!game.won) {
    setMessage("Paused. Click to continue your squirrel run.");
  }
});

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (controls.isLocked && !game.won) {
    game.timer += delta;
    handleMovement(delta);
    detectCurrentCourse();
    updateAcorns(t, delta);
    updateGoals();
  }

  updateHUD();
  renderer.render(scene, camera);
}

decorateWorld();
buildStartArea();
controls.getObject().position.copy(player.position);
updateHUD();
animate();
