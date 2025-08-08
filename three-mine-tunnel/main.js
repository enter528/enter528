import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import GUI from 'https://unpkg.com/lil-gui@0.19/dist/lil-gui.esm.js';

// ---------- Basic setup ----------
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0b10');
scene.fog = new THREE.FogExp2('#0b0b10', 0.06);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 1000);
// Start camera near tunnel entrance
camera.position.set(6, 3.5, 9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxDistance = 40;
controls.maxPolarAngle = Math.PI * 0.495;

// ---------- Utility helpers ----------
function createTexturedStandardMaterial({ color = 0x222226, metalness = 0.05, roughness = 0.95, emissive = 0x000000, side = THREE.FrontSide } = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, side });
  return mat;
}

function buildFrenetFrameLookup(curve, segments = 2000) {
  const frames = curve.computeFrenetFrames(segments, false);
  const lengthLUT = curve.getLengths(segments);
  const totalLength = lengthLUT[lengthLUT.length - 1];
  return { frames, segments, lengthLUT, totalLength };
}

function getFrameAt(u, frameInfo) {
  const { frames, segments } = frameInfo;
  const iFloat = u * segments;
  const i0 = Math.max(0, Math.min(segments - 1, Math.floor(iFloat)));
  return {
    tangent: frames.tangents[i0],
    normal: frames.normals[i0],
    binormal: frames.binormals[i0]
  };
}

function getUForDistance(curve, frameInfo, s) {
  const { totalLength, lengthLUT } = frameInfo;
  const target = THREE.MathUtils.clamp(s, 0, totalLength);
  // Binary search in lengthLUT to approximate u
  let low = 0, high = lengthLUT.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lengthLUT[mid] < target) low = mid + 1; else high = mid;
  }
  const idx = Math.max(1, low);
  const l0 = lengthLUT[idx - 1];
  const l1 = lengthLUT[idx];
  const t0 = (idx - 1) / (lengthLUT.length - 1);
  const t1 = idx / (lengthLUT.length - 1);
  const alpha = (target - l0) / Math.max(1e-6, (l1 - l0));
  return THREE.MathUtils.lerp(t0, t1, alpha);
}

class OffsetCurve extends THREE.Curve {
  constructor(baseCurve, frameInfo, lateralOffset = 0, verticalOffset = 0) {
    super();
    this.baseCurve = baseCurve;
    this.frameInfo = frameInfo;
    this.lateralOffset = lateralOffset; // along binormal
    this.verticalOffset = verticalOffset; // along normal (down is negative)
  }
  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const p = this.baseCurve.getPoint(t, optionalTarget);
    const { normal, binormal } = getFrameAt(t, this.frameInfo);
    p.addScaledVector(binormal, this.lateralOffset);
    p.addScaledVector(normal, this.verticalOffset);
    return p;
  }
}

// ---------- Track path design (with a switch) ----------
// Build a wavy underground path
function buildMainPath() {
  const pts = [];
  let z = 0;
  for (let i = 0; i < 20; i++) {
    const x = Math.sin(i * 0.35) * 4.0;
    const y = Math.sin(i * 0.22) * 0.6 - 0.5 - (i * 0.02);
    z -= 4.0 + Math.random() * 0.5;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.15);
  return curve;
}

// Create a branch starting around a chosen index
function buildBranchFrom(mainCurve, switchIndex = 7) {
  const mainPoints = mainCurve.points || mainCurve.getPoints(19);
  const startIdx = THREE.MathUtils.clamp(switchIndex, 2, mainPoints.length - 6);
  const pre = mainPoints.slice(0, startIdx);

  // Diverge to the right and deeper
  const anchor = mainPoints[startIdx].clone();
  const dirNext = mainPoints[startIdx + 1].clone().sub(mainPoints[startIdx - 1]).normalize();
  const right = new THREE.Vector3().crossVectors(dirNext, new THREE.Vector3(0, 1, 0)).normalize();

  const branch = [
    ...pre,
    anchor.clone(),
    anchor.clone().addScaledVector(right, 3.0).add(new THREE.Vector3(0.0, -0.4, -2.0)),
    anchor.clone().addScaledVector(right, 5.5).add(new THREE.Vector3(0.0, -0.7, -8.0)),
    anchor.clone().addScaledVector(right, 6.5).add(new THREE.Vector3(-0.5, -1.0, -14.0)),
  ];

  // Extend further with new points
  let last = branch[branch.length - 1].clone();
  for (let i = 0; i < 10; i++) {
    last = last.clone().add(new THREE.Vector3(
      Math.sin(i * 0.45) * 0.6 + 0.1,
      -0.18 + Math.sin(i * 0.36) * 0.1,
      -3.6 - Math.random() * 0.3
    ));
    branch.push(last);
  }

  const curve = new THREE.CatmullRomCurve3(branch, false, 'centripetal', 0.15);
  return { curve, switchPoint: mainPoints[startIdx].clone() };
}

// Build curves
const mainCurve = buildMainPath();
const { curve: branchCurve, switchPoint } = buildBranchFrom(mainCurve, 7);

// Compute frame lookups
const mainFrames = buildFrenetFrameLookup(mainCurve, 3000);
const branchFrames = buildFrenetFrameLookup(branchCurve, 3000);

// Keep active curve state
let activeCurve = mainCurve;
let activeFrames = mainFrames;

// Find approximate param for the switch along main curve (by closest point among sampled points)
function approxUForPoint(curve, p, samples = 2000) {
  const pts = curve.getPoints(samples);
  let bestIdx = 0;
  let bestD2 = Infinity;
  for (let i = 0; i <= samples; i++) {
    const d2 = pts[i].distanceToSquared(p);
    if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
  }
  return bestIdx / samples;
}
const switchUOnMain = approxUForPoint(mainCurve, switchPoint, 2000);

// ---------- Build tunnel geometry (two branches) ----------
const TUNNEL_RADIUS = 3.1; // before vertical squash
const TUNNEL_VERT_SCALE = 0.82;

function createTunnelForCurve(curve, color = 0x202026) {
  const tubularSegments = 1600;
  const geom = new THREE.TubeGeometry(curve, tubularSegments, TUNNEL_RADIUS, 18, false);
  // Oval vertical scale
  geom.scale(1, TUNNEL_VERT_SCALE, 1);
  const mat = createTexturedStandardMaterial({ color, metalness: 0.02, roughness: 0.96, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.receiveShadow = true;
  return mesh;
}

const tunnelMain = createTunnelForCurve(mainCurve, 0x1f1f24);
const tunnelBranch = createTunnelForCurve(branchCurve, 0x1b1b22);
scene.add(tunnelMain);
scene.add(tunnelBranch);

// ---------- Build rails and sleepers ----------
const RAIL_GAUGE_HALF = 0.72; // half distance between rails
const RAIL_RADIUS = 0.06;
const FLOOR_DROP = -TUNNEL_RADIUS * TUNNEL_VERT_SCALE * 0.64; // drop from center to floor along normal

function createRailPair(curve, framesInfo, color = 0xc8c8cc) {
  const leftCurve = new OffsetCurve(curve, framesInfo, -RAIL_GAUGE_HALF, FLOOR_DROP + 0.05);
  const rightCurve = new OffsetCurve(curve, framesInfo, RAIL_GAUGE_HALF, FLOOR_DROP + 0.05);
  const tubularSegments = 1600;
  const railGeomL = new THREE.TubeGeometry(leftCurve, tubularSegments, RAIL_RADIUS, 12, false);
  const railGeomR = new THREE.TubeGeometry(rightCurve, tubularSegments, RAIL_RADIUS, 12, false);
  const railMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.45 });
  const railL = new THREE.Mesh(railGeomL, railMat);
  const railR = new THREE.Mesh(railGeomR, railMat);
  railL.castShadow = railL.receiveShadow = true;
  railR.castShadow = railR.receiveShadow = true;
  const group = new THREE.Group();
  group.add(railL, railR);
  return group;
}

function createSleepers(curve, framesInfo, spacing = 0.9) {
  const totalLength = framesInfo.totalLength;
  const sleeperGeom = new THREE.BoxGeometry(RAIL_GAUGE_HALF * 2.6, 0.12, 0.28);
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9, metalness: 0.0 });
  const group = new THREE.Group();
  for (let s = 1.0; s < totalLength - 0.5; s += spacing) {
    const u = getUForDistance(curve, framesInfo, s);
    const pos = curve.getPointAt(u);
    const { tangent, normal, binormal } = getFrameAt(u, framesInfo);

    const sleeper = new THREE.Mesh(sleeperGeom, sleeperMat);
    // Local frame: X->binormal (left-right), Y->normal (up), Z->tangent (forward)
    const matBasis = new THREE.Matrix4().makeBasis(binormal, normal, tangent);
    sleeper.quaternion.setFromRotationMatrix(matBasis);
    sleeper.position.copy(pos)
      .addScaledVector(normal, FLOOR_DROP + 0.01) // lower to floor level
      .addScaledVector(new THREE.Vector3().copy(normal).multiplyScalar(0.0), 1.0);
    sleeper.castShadow = true;
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }
  return group;
}

const railsMain = createRailPair(mainCurve, mainFrames);
const railsBranch = createRailPair(branchCurve, branchFrames);
const sleepersMain = createSleepers(mainCurve, mainFrames, 0.9);
const sleepersBranch = createSleepers(branchCurve, branchFrames, 0.9);
scene.add(railsMain, railsBranch, sleepersMain, sleepersBranch);

// ---------- Lamps along tunnel ----------
function addLampsAlong(curve, framesInfo, every = 12) {
  const group = new THREE.Group();
  const total = Math.floor(framesInfo.totalLength / every);
  for (let i = 2; i < total; i++) {
    const s = i * every;
    const u = getUForDistance(curve, framesInfo, s);
    const p = curve.getPointAt(u);
    const { normal, binormal } = getFrameAt(u, framesInfo);

    const lampPos = p.clone().addScaledVector(normal, TUNNEL_RADIUS * TUNNEL_VERT_SCALE - 0.25);
    const backPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.3, roughness: 0.7 })
    );
    backPlate.position.copy(lampPos);
    backPlate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
    backPlate.castShadow = backPlate.receiveShadow = true;

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffe0, emissive: 0x111100, emissiveIntensity: 0.6, roughness: 0.3 })
    );
    bulb.position.copy(lampPos).addScaledVector(normal, -0.04);

    const light = new THREE.SpotLight(0xfff2cc, 0.8, 10, Math.PI * 0.5, 0.4, 1.2);
    light.position.copy(lampPos);
    light.target.position.copy(lampPos.clone().addScaledVector(normal, -1.2));
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);

    const lampGroup = new THREE.Group();
    lampGroup.add(backPlate, bulb, light, light.target);
    lampGroup.userData = { toggleable: true, light, bulb };
    group.add(lampGroup);
  }
  return group;
}

const lampsMain = addLampsAlong(mainCurve, mainFrames, 10);
const lampsBranch = addLampsAlong(branchCurve, branchFrames, 10);
scene.add(lampsMain, lampsBranch);

// ---------- Ambient and entrance lighting ----------
scene.add(new THREE.AmbientLight(0x40424a, 0.35));

const entranceLight = new THREE.DirectionalLight(0xb0c8ff, 0.35);
entranceLight.position.set(6, 6, 6);
entranceLight.castShadow = true;
entranceLight.shadow.mapSize.set(1024, 1024);
scene.add(entranceLight);

// ---------- Train ----------
function createLocomotive() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x6aa1ff, metalness: 0.3, roughness: 0.5 })
  );
  body.position.y = FLOOR_DROP + 0.75;
  body.castShadow = true; body.receiveShadow = true;

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.9, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x3b5b9a, metalness: 0.25, roughness: 0.55 })
  );
  cab.position.set(0.2, FLOOR_DROP + 1.05, -0.1);
  cab.castShadow = true; cab.receiveShadow = true;

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.35, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 })
  );
  bumper.position.set(0, FLOOR_DROP + 0.4, 0.98);

  const wheels = new THREE.Group();
  const wheelGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = wheel.receiveShadow = true;
    const side = i < 2 ? -1 : 1;
    const z = i % 2 === 0 ? -0.7 : 0.7;
    wheel.position.set(side * (RAIL_GAUGE_HALF + 0.1), FLOOR_DROP + 0.28, z);
    wheels.add(wheel);
  }

  const headlight = new THREE.SpotLight(0xfff3cc, 2.0, 22, Math.PI * 0.18, 0.45, 1.4);
  headlight.castShadow = true;
  headlight.shadow.mapSize.set(1024, 1024);
  headlight.position.set(0, FLOOR_DROP + 0.7, 1.15);
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, FLOOR_DROP + 0.6, 3.4);
  headlight.target = lightTarget;

  const headGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.06, 20),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.75, roughness: 0.15, thickness: 0.01 })
  );
  headGlass.position.set(0, FLOOR_DROP + 0.75, 1.15);

  group.add(body, cab, bumper, wheels, headlight, lightTarget, headGlass);
  group.userData = { headlight };
  return group;
}

const train = createLocomotive();
scene.add(train);

// ---------- Switch (interactive) ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let isSwitchToBranch = false;

function createSwitchLever() {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x444, metalness: 0.5, roughness: 0.6 })
  );
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x888, metalness: 0.7, roughness: 0.5 })
  );
  pole.position.y = 0.35;

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.1, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xd94a38, metalness: 0.4, roughness: 0.5 })
  );
  handle.position.set(0.3, 0.5, 0);

  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2bd676, emissive: 0x073d1f, emissiveIntensity: 0.8 })
  );
  indicator.position.set(-0.35, 0.35, 0);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.5, roughness: 0.8 })
  );

  const holder = new THREE.Group();
  holder.add(base, pole, handle, indicator);
  holder.position.y = FLOOR_DROP + 0.05;

  group.add(plate, holder);

  group.userData = { type: 'switch', handle, indicator };
  return group;
}

const switchLever = createSwitchLever();
// Place switch near switchUOnMain along the main curve, offset to the side
(function positionSwitch() {
  const u = switchUOnMain;
  const p = mainCurve.getPointAt(u);
  const { normal, binormal, tangent } = getFrameAt(u, mainFrames);
  switchLever.position.copy(p)
    .addScaledVector(normal, FLOOR_DROP + 0.02)
    .addScaledVector(binormal, -RAIL_GAUGE_HALF - 0.6);
  // align plate with ground plane (binormal-left/right)
  const mat = new THREE.Matrix4().makeBasis(binormal, normal, tangent);
  switchLever.quaternion.setFromRotationMatrix(mat);
})();
scene.add(switchLever);

function updateSwitchVisual() {
  const { indicator, handle } = switchLever.userData;
  if (!indicator || !handle) return;
  if (isSwitchToBranch) {
    indicator.material.color.set(0xd9b738);
    indicator.material.emissive.set(0x3d2e07);
    handle.position.x = -0.3;
  } else {
    indicator.material.color.set(0x2bd676);
    indicator.material.emissive.set(0x073d1f);
    handle.position.x = 0.3;
  }
}

updateSwitchVisual();

// ---------- Train movement state ----------
const params = {
  speed: 3.0, // m/s approx
  pause: false,
  followActiveCurve: true,
};

let trainDistance = 0; // distance along active curve
let lastTimestamp = performance.now();

function setActiveCurve(useBranch) {
  isSwitchToBranch = !!useBranch;
  activeCurve = isSwitchToBranch ? branchCurve : mainCurve;
  activeFrames = isSwitchToBranch ? branchFrames : mainFrames;
  updateSwitchVisual();
}

// ---------- GUI ----------
const gui = new GUI({ title: '隧道控制' });
const f = gui.addFolder('列车');
f.add(params, 'speed', 0, 12, 0.1).name('速度 (m/s)');
f.add(params, 'pause').name('暂停');
const f2 = gui.addFolder('道岔');
f2.add({ 线路: () => setActiveCurve(!isSwitchToBranch) }, '线路').name('切换线路');

// ---------- Interaction handlers ----------
function onPointerDown(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects([switchLever, lampsMain, lampsBranch], true);
  if (intersects.length) {
    const obj = intersects[0].object;
    // Toggle switch if clicked within lever hierarchy
    let cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.type === 'switch') {
        setActiveCurve(!isSwitchToBranch);
        return;
      }
      cur = cur.parent;
    }
    // Lamps toggle
    cur = obj;
    while (cur) {
      if (cur.userData && cur.userData.toggleable) {
        const { light, bulb } = cur.userData;
        light.visible = !light.visible;
        bulb.material.emissiveIntensity = light.visible ? 0.6 : 0.05;
        return;
      }
      cur = cur.parent;
    }
  }
}
renderer.domElement.addEventListener('pointerdown', onPointerDown);

// ---------- Animation loop ----------
function updateTrain(dt) {
  if (params.pause) return;
  trainDistance += params.speed * dt;
  const len = activeFrames.totalLength;
  // loop
  if (trainDistance > len) trainDistance = 0;

  const u = getUForDistance(activeCurve, activeFrames, trainDistance);
  const pos = activeCurve.getPointAt(u);
  const { tangent, normal, binormal } = getFrameAt(u, activeFrames);

  // Build orientation from Frenet frame
  const basis = new THREE.Matrix4().makeBasis(binormal, normal, tangent);
  train.position.copy(pos);
  train.quaternion.setFromRotationMatrix(basis);

  // Make spotlight aim forward
  const light = train.userData.headlight;
  if (light) {
    light.position.copy(pos).addScaledVector(normal, FLOOR_DROP + 0.7 - train.position.y);
    const ahead = pos.clone().addScaledVector(tangent, 2.8).addScaledVector(normal, -0.2);
    light.target.position.copy(ahead);
    light.target.updateMatrixWorld();
  }
}

function animate() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
  lastTimestamp = now;

  updateTrain(dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---------- Resize ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------- Start ----------
requestAnimationFrame(animate);

// Position camera a bit into tunnel entrance looking forward
(function positionCameraStart() {
  const u = 0.02;
  const p = mainCurve.getPointAt(u);
  const { tangent } = getFrameAt(u, mainFrames);
  camera.position.copy(p.clone().add(new THREE.Vector3(6, 3.5, 9)));
  controls.target.copy(p.clone().addScaledVector(tangent, 3));
  controls.update();
})();