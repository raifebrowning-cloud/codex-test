import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
import { PointerLockControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/PointerLockControls.js";

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0b14, 0.03);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const keys = {};
const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const player = {
  radius: 0.5,
  height: 1.8,
  speed: 12,
  health: 100,
  kills: 0,
  invuln: 0,
};

const healthEl = document.getElementById("health");
const killsEl = document.getElementById("kills");
const messageEl = document.getElementById("message");

const ambient = new THREE.AmbientLight(0x6074a1, 0.38);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0x9ac2ff, 1.2);
moon.position.set(20, 35, -10);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
scene.add(moon);

const sporeLight = new THREE.PointLight(0x71ff77, 2.1, 40, 1.8);
sporeLight.position.set(0, 5, 0);
scene.add(sporeLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
  new THREE.MeshStandardMaterial({ color: 0x10131f, roughness: 0.95, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const maze = {
  map: [
    "####################",
    "#S......#.........G#",
    "#.####..#.#######..#",
    "#....#..#.....#....#",
    "#.##.#.#####..#.##.#",
    "#.#..#.....#..#..#.#",
    "#.#.#####..####.#..#",
    "#.#.....#.......##.#",
    "#.#####.#####.####.#",
    "#.....#.....#......#",
    "#.###.#####.######.#",
    "#...#.....#....#...#",
    "###.#####.####.#.###",
    "#...#...#....#.#...#",
    "#.###.#.####.#.###.#",
    "#.....#......#.....#",
    "####################",
  ],
  cell: 6,
  wallHeight: 6,
};

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x2f2935,
  roughness: 0.87,
  metalness: 0.12,
  emissive: 0x0e0a10,
});
const walls = [];
let startPosition = new THREE.Vector3(0, 2, 0);
let hivePosition = new THREE.Vector3(0, 2, 0);

function cellToWorld(row, col) {
  const width = maze.map[0].length;
  const height = maze.map.length;
  const x = (col - width / 2 + 0.5) * maze.cell;
  const z = (row - height / 2 + 0.5) * maze.cell;
  return new THREE.Vector3(x, 0, z);
}

for (let row = 0; row < maze.map.length; row++) {
  for (let col = 0; col < maze.map[row].length; col++) {
    const ch = maze.map[row][col];
    const pos = cellToWorld(row, col);

    if (ch === "#") {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(maze.cell, maze.wallHeight, maze.cell),
        wallMaterial
      );
      wall.position.set(pos.x, maze.wallHeight / 2, pos.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      wall.userData.isWall = true;
      scene.add(wall);
      walls.push(wall);
    }

    if (ch === "S") {
      startPosition = new THREE.Vector3(pos.x, 2, pos.z);
    }

    if (ch === "G") {
      hivePosition = new THREE.Vector3(pos.x, 2, pos.z);
    }
  }
}

controls.getObject().position.copy(startPosition);

function createSporeHive() {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 24, 24),
    new THREE.MeshStandardMaterial({
      color: 0x47ff70,
      emissive: 0x1f9f3f,
      roughness: 0.3,
      metalness: 0.05,
    })
  );
  core.castShadow = true;
  group.add(core);

  for (let i = 0; i < 6; i++) {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0x99ffb2,
        emissive: 0x3bc25c,
      })
    );
    const angle = (i / 6) * Math.PI * 2;
    node.position.set(Math.cos(angle) * 4, Math.sin(i) * 1.8, Math.sin(angle) * 4);
    group.add(node);
  }

  group.position.copy(hivePosition);
  group.position.y = 4;
  scene.add(group);

  const hiveLight = new THREE.PointLight(0x52ff74, 2.7, 32, 1.4);
  hiveLight.position.copy(group.position);
  hiveLight.position.y += 2;
  scene.add(hiveLight);

  return group;
}

const hive = createSporeHive();

function createAnt() {
  const ant = new THREE.Group();

  const shell = new THREE.MeshStandardMaterial({
    color: 0x5e3a2b,
    emissive: 0x1c0f08,
    roughness: 0.82,
    metalness: 0.08,
  });

  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 16), shell);
  abdomen.scale.set(1.45, 1.0, 1.15);
  abdomen.position.z = -1.75;

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(1.25, 18, 16), shell);

  const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 18, 16), shell);
  head.position.z = 1.65;

  ant.add(abdomen, thorax, head);

  for (let side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6),
        new THREE.MeshStandardMaterial({ color: 0x2e1b15, roughness: 0.9 })
      );
      leg.rotation.z = side * (Math.PI / 3 + i * 0.1);
      leg.rotation.x = i * 0.3 - 0.2;
      leg.position.set(side * 1.2, -0.8, i * 0.95 - 1.2);
      ant.add(leg);
    }
  }

  const mandibleL = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1e130f })
  );
  mandibleL.position.set(-0.38, -0.16, 2.45);
  mandibleL.rotation.x = Math.PI / 2.2;

  const mandibleR = mandibleL.clone();
  mandibleR.position.x = 0.38;

  ant.add(mandibleL, mandibleR);

  ant.scale.setScalar(2.2);
  ant.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return ant;
}

function randomOpenCell() {
  while (true) {
    const row = Math.floor(Math.random() * maze.map.length);
    const col = Math.floor(Math.random() * maze.map[0].length);
    const ch = maze.map[row][col];
    if (ch === ".") {
      const p = cellToWorld(row, col);
      return new THREE.Vector3(p.x, 2.8, p.z);
    }
  }
}

const ants = [];
for (let i = 0; i < 9; i++) {
  const body = createAnt();
  const pos = randomOpenCell();
  body.position.copy(pos);
  scene.add(body);

  ants.push({
    body,
    health: 100,
    speed: 3.4 + Math.random() * 1.5,
    attackRange: 3.6,
    cooldown: Math.random() * 1.5,
    wanderDir: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
  });
}

const raycaster = new THREE.Raycaster();
const bulletFlash = new THREE.PointLight(0xbbe9ff, 0, 20);
scene.add(bulletFlash);

const mazeHalfX = (maze.map[0].length * maze.cell) / 2;
const mazeHalfZ = (maze.map.length * maze.cell) / 2;

function wallCollision(position, radius) {
  for (const wall of walls) {
    const dx = Math.abs(position.x - wall.position.x);
    const dz = Math.abs(position.z - wall.position.z);
    const overlapX = dx < maze.cell / 2 + radius;
    const overlapZ = dz < maze.cell / 2 + radius;
    if (overlapX && overlapZ) {
      return true;
    }
  }
  return false;
}

function clampInMaze(position) {
  position.x = THREE.MathUtils.clamp(position.x, -mazeHalfX + 1, mazeHalfX - 1);
  position.z = THREE.MathUtils.clamp(position.z, -mazeHalfZ + 1, mazeHalfZ - 1);
}

function tryMove(delta) {
  const obj = controls.getObject();
  const oldPos = obj.position.clone();

  obj.position.x += velocity.x * delta;
  clampInMaze(obj.position);
  if (wallCollision(obj.position, player.radius)) {
    obj.position.x = oldPos.x;
  }

  obj.position.z += velocity.z * delta;
  clampInMaze(obj.position);
  if (wallCollision(obj.position, player.radius)) {
    obj.position.z = oldPos.z;
  }

  obj.position.y = player.height;
}

function updateHUD() {
  healthEl.textContent = `Health: ${Math.max(0, Math.round(player.health))}`;
  killsEl.textContent = `Ants Defeated: ${player.kills}`;
}

function playerHit(amount) {
  if (player.invuln > 0 || player.health <= 0) return;
  player.health -= amount;
  player.invuln = 0.45;
  updateHUD();

  if (player.health <= 0) {
    messageEl.textContent = "You were overrun by spore-linked ants. Refresh to retry.";
    controls.unlock();
  }
}

function fire() {
  if (!controls.isLocked || player.health <= 0) return;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const antMeshes = ants.map((a) => a.body);
  const hits = raycaster.intersectObjects(antMeshes, true);
  if (hits.length > 0) {
    let node = hits[0].object;
    while (node && !antMeshes.includes(node)) {
      node = node.parent;
    }
    const ant = ants.find((a) => a.body === node);
    if (ant && ant.health > 0) {
      ant.health -= 40;
      ant.body.rotation.z = (Math.random() - 0.5) * 0.2;
      if (ant.health <= 0) {
        ant.body.visible = false;
        player.kills += 1;
        updateHUD();
        messageEl.textContent = "Ant down! Keep moving through the hive maze.";
      }
    }
  }

  bulletFlash.position.copy(camera.position);
  bulletFlash.position.add(new THREE.Vector3(0, -0.2, 0));
  bulletFlash.intensity = 2.2;
}

function updateAnts(delta, t) {
  const playerPos = controls.getObject().position;
  for (const ant of ants) {
    if (ant.health <= 0) continue;

    const toPlayer = new THREE.Vector3().subVectors(playerPos, ant.body.position);
    const dist = toPlayer.length();

    const toHive = new THREE.Vector3().subVectors(hive.position, ant.body.position);
    const hivePull = toHive.multiplyScalar(0.05 * Math.sin(t + ant.body.id));

    if (dist < 30) {
      toPlayer.y = 0;
      toPlayer.normalize();
      ant.wanderDir.lerp(toPlayer.add(hivePull).normalize(), 0.06);
    } else {
      ant.wanderDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 0.2 + ant.body.id) * 0.005);
    }

    const nextPos = ant.body.position.clone().addScaledVector(ant.wanderDir, ant.speed * delta);
    if (!wallCollision(nextPos, 1.6)) {
      ant.body.position.copy(nextPos);
    } else {
      ant.wanderDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * (0.4 + Math.random() * 0.3));
    }

    ant.body.lookAt(playerPos.x, ant.body.position.y, playerPos.z);
    ant.body.position.y = 2.8 + Math.sin(t * 8 + ant.body.id) * 0.12;

    ant.cooldown -= delta;
    if (dist < ant.attackRange && ant.cooldown <= 0) {
      playerHit(9 + Math.random() * 8);
      ant.cooldown = 0.8 + Math.random() * 0.7;
    }
  }

  if (player.kills === ants.length) {
    messageEl.textContent = "Hive neutralized. You escaped the spore ant maze!";
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

document.addEventListener("mousedown", fire);
document.addEventListener("click", () => {
  if (player.health > 0) controls.lock();
});

controls.addEventListener("lock", () => {
  messageEl.textContent = "Hunt the giant ants before the spore hive collapses your mind.";
});

controls.addEventListener("unlock", () => {
  if (player.health > 0 && player.kills !== ants.length) {
    messageEl.textContent = "Paused. Click to continue.";
  }
});

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (controls.isLocked && player.health > 0) {
    direction.set(0, 0, 0);
    if (keys.KeyW) direction.z -= 1;
    if (keys.KeyS) direction.z += 1;
    if (keys.KeyA) direction.x -= 1;
    if (keys.KeyD) direction.x += 1;
    direction.normalize();

    velocity.x = direction.x * player.speed;
    velocity.z = direction.z * player.speed;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(forward, velocity.z);
    move.addScaledVector(right, velocity.x);

    velocity.x = move.x;
    velocity.z = move.z;

    tryMove(delta);
    updateAnts(delta, t);

    if (player.invuln > 0) {
      player.invuln -= delta;
    }
  }

  bulletFlash.intensity = Math.max(0, bulletFlash.intensity - delta * 12);
  sporeLight.position.set(
    hive.position.x + Math.sin(t * 0.9) * 10,
    6 + Math.sin(t * 1.7) * 2,
    hive.position.z + Math.cos(t * 0.8) * 10
  );

  renderer.render(scene, camera);
}

updateHUD();
animate();
