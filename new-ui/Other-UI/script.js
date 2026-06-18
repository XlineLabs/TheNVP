import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { GUI } from "jsm/libs/lil-gui.module.min.js";
import { FontLoader } from "jsm/loaders/FontLoader.js";
import { TextGeometry } from "jsm/geometries/TextGeometry.js";
import { RoundedBoxGeometry } from "jsm/geometries/RoundedBoxGeometry.js";

const gui = new GUI();

//scene & camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = 5;

//renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector(".webgl"),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

//textures
const textureLoader = new THREE.TextureLoader();

// ============================================
// MELT EFFECT SETUP
// ============================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(9999, 9999);
const mouseWorld = new THREE.Vector3();
const targetMouse = new THREE.Vector3();
const currentMouse = new THREE.Vector3();

// Uniforms compartidos para el efecto
const meltUniforms = {
  uMouse: { value: new THREE.Vector3(9999, 9999, 9999) },
  uTime: { value: 0 },
  uRadius: { value: 1.2 },
  uStrength: { value: 0.55 },
};

// Shader suave y liquido
const meltParsVertex = `
  uniform vec3 uMouse;
  uniform float uTime;
  uniform float uRadius;
  uniform float uStrength;

  // Suavizado extra (smootherstep)
  float liquid(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  vec3 melt(vec3 pos, vec3 worldPos) {
    float dist = distance(worldPos, uMouse);

    // Influencia muy suave con doble suavizado
    float t = 1.0 - clamp(dist / uRadius, 0.0, 1.0);
    float influence = liquid(t);

    // Goteo suave hacia abajo
    float drip = influence * uStrength;
    pos.y -= drip;

    // Deformacion lateral suave
    float lateral = sin(uTime * 0.8) * influence * 0.08;
    pos.x += lateral;

    // Bulge suave hacia afuera
    vec3 dir = worldPos - uMouse;
    float bulge = influence * 0.1;
    pos += normalize(dir + 0.001) * bulge;

    return pos;
  }
`;

const meltVertex = `
  vec4 meltWorldPos = modelMatrix * vec4(position, 1.0);
  transformed = melt(transformed, meltWorldPos.xyz);
`;

// Funcion para aplicar el shader de melt a cualquier material
function applyMeltEffect(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMouse = meltUniforms.uMouse;
    shader.uniforms.uTime = meltUniforms.uTime;
    shader.uniforms.uRadius = meltUniforms.uRadius;
    shader.uniforms.uStrength = meltUniforms.uStrength;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>\n${meltParsVertex}`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\n${meltVertex}`,
    );
  };
  material.needsUpdate = true;
}

// ============================================
// ENVIROMENT MAP
// ============================================
const environmentMapTexture = new THREE.CubeTextureLoader().load([
  "https://cdn.jsdelivr.net/gh/danielyl123/person@main/environmentMaps/2/px.png",
  "https://cdn.jsdelivr.net/gh/danielyl123/person@main/environmentMaps/2/nx.png",
  "https://cdn.jsdelivr.net/gh/danielyl123/person@main/environmentMaps/2/py.png",
  "https://cdn.jsdelivr.net/gh/danielyl123/person@main/environmentMaps/2/ny.png",
  "https://cdn.jsdelivr.net/gh/danielyl123/person@main/environmentMaps/2/pz.png",
  "https://cdn.jsdelivr.net/gh/danielyl123/person@main/environmentMaps/2/nz.png",
]);

// ============================================
// CUBE
// ============================================
const cubeMaterial = new THREE.MeshPhysicalMaterial({
  envMap: environmentMapTexture,
  envMapIntensity: 0.5,
  metalness: 0,
  roughness: 0,
  thickness: 1.0275,
  transmission: 1,
  ior: 2.2566,
  iridescence: 0.3486,
  iridescenceIOR: 1.2025,
  iridescenceThicknessRange: [100, 800],
});
applyMeltEffect(cubeMaterial);

const cube = new THREE.Mesh(
  new RoundedBoxGeometry(1.5, 1.5, 1.5, 80, 0.09), // Muchos segmentos para suavidad liquida
  cubeMaterial,
);
cube.position.z = 0.7;
scene.add(cube);

// ============================================
// TEXT
// ============================================
let textGroup = new THREE.Group();
scene.add(textGroup);

const fontLoader = new FontLoader();
fontLoader.load("https://raw.githubusercontent.com/danielyl123/person/refs/heads/main/fonts/helvetiker_regular.typeface.json", (font) => {
  const phrase = "Explore new ideas";
  const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  applyMeltEffect(textMaterial);

  const lineHeight = 1;
  const words = phrase.split(" ");

  words.forEach((word, i) => {
    const textGeometry = new TextGeometry(word, {
      font,
      size: 0.9,
      depth: 0.01,
      curveSegments: 20,
      bevelEnabled: false,
    });
    textGeometry.computeBoundingBox();
    textGeometry.center();

    const text = new THREE.Mesh(textGeometry, textMaterial);
    text.position.y = -i * lineHeight;
    textGroup.add(text);
  });

  const totalHeight = (words.length - 1) * lineHeight;
  textGroup.position.y = totalHeight / 2;
});

// ============================================
// GUI
// ============================================
gui.close();
gui.add(cubeMaterial, "transmission").min(0).max(1).step(0.0001);
gui.add(cubeMaterial, "ior").min(1).max(10).step(0.0001);
gui.add(cubeMaterial, "thickness").min(0).max(10).step(0.0001);
gui.add(cubeMaterial, "iridescence").min(0).max(1).step(0.0001);
gui.add(cubeMaterial, "iridescenceIOR").min(1).max(2.333).step(0.0001);
gui.add(cubeMaterial.iridescenceThicknessRange, "0").min(0).max(1000).step(1);
gui.add(cubeMaterial.iridescenceThicknessRange, "1").min(0).max(1000).step(1);

const meltFolder = gui.addFolder("Liquid Effect");
meltFolder.add(meltUniforms.uRadius, "value", 0.5, 2.5, 0.05).name("Radio");
meltFolder.add(meltUniforms.uStrength, "value", 0.1, 0.6, 0.02).name("Fuerza");

// ============================================
// MOUSE INTERACTION
// ============================================
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.7);

window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Intentar interseccion con el cubo
  const intersects = raycaster.intersectObject(cube);

  if (intersects.length > 0) {
    targetMouse.copy(intersects[0].point);
  } else {
    // Si no toca el cubo, proyectar al plano
    raycaster.ray.intersectPlane(plane, mouseWorld);
    if (mouseWorld) {
      targetMouse.copy(mouseWorld);
    }
  }
});

window.addEventListener("mouseleave", () => {
  targetMouse.set(9999, 9999, 9999);
});

// ============================================
// ANIMATION LOOP
// ============================================
const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  // Actualizar tiempo
  meltUniforms.uTime.value = elapsedTime;

  // Interpolacion muy suave - como liquido viscoso
  currentMouse.lerp(targetMouse, 0.025);
  meltUniforms.uMouse.value.copy(currentMouse);

  controls.update();

  cube.rotation.y = elapsedTime * 0.25;
  cube.rotation.x = elapsedTime * 0.2;

  renderer.render(scene, camera);

  requestAnimationFrame(tick);
};
tick();

// ============================================
// RESIZE
// ============================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
