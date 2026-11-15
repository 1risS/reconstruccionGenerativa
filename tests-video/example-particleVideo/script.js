import * as THREE from '//cdn.skypack.dev/three@0.130.0?min'
import { gsap } from '//cdn.skypack.dev/gsap@3.7.0?min'

const mediaUrls = [
  '../video-animations/animation_00.mp4',
  '../video-animations/animation-hydra_00.mp4',
  '../images/image_00.jpeg',
  '../images/image_01.jpeg',
  '../images/image_02.jpeg'
]
const targetCameraZ = 100
const instanceSize = 0.25
const sampleRows = 600
const randRangeZ = 2 * targetCameraZ * 0.99
const closeCameraZ = targetCameraZ / 5
const videoBlendDurationMs = 700
const cameraMotionDurationSec = 6
const cameraMotionEase = 'power2.inOut'
const mediaChangeBlurAmount = 40
const mediaChangeBlurDurationSec = 0.8

const blurVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const blurFragmentShader = `
precision mediump float;

uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_blurAmount;

float a = 0.000229;
float b = 0.005977;
float c = 0.060598;
float d = 0.241732;
float e = 0.382928;
float f = 0.241732;
float g = 0.060598;
float h = 0.005977;
float i = 0.000229;

varying vec2 vUv;

void blurPass(inout vec4 color, sampler2D tex, vec2 coord, vec2 res, int passAmount) {
  for (int pass = 0; pass < passAmount; ++pass) {
    vec2 blurX = vec2(u_blurAmount / res.x, 0.0) / pow(2.0, float(pass));
    vec2 blurY = vec2(0.0, u_blurAmount / res.y) / pow(2.0, float(pass));

    color += a * texture2D(tex, coord + blurX * -4.0);
    color += b * texture2D(tex, coord + blurX * -3.0);
    color += c * texture2D(tex, coord + blurX * -2.0);
    color += d * texture2D(tex, coord + blurX * -1.0);
    color += e * texture2D(tex, coord + blurX * 0.0);
    color += f * texture2D(tex, coord + blurX * 1.0);
    color += g * texture2D(tex, coord + blurX * 2.0);
    color += h * texture2D(tex, coord + blurX * 3.0);
    color += i * texture2D(tex, coord + blurX * 4.0);

    color += a * texture2D(tex, coord + blurY * -4.0);
    color += b * texture2D(tex, coord + blurY * -3.0);
    color += c * texture2D(tex, coord + blurY * -2.0);
    color += d * texture2D(tex, coord + blurY * -1.0);
    color += f * texture2D(tex, coord + blurY * 1.0);
    color += g * texture2D(tex, coord + blurY * 2.0);
    color += h * texture2D(tex, coord + blurY * 3.0);
    color += i * texture2D(tex, coord + blurY * 4.0);

    color /= (2.0 * (a + b + c + d) + e) * 2.0;
  }
}

void main() {
  vec2 coord = vUv;
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
  blurPass(color, u_tex, coord, u_res, 1);
  gl_FragColor = color;
}
`

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, 2, 0.5, 1000)
const blurRenderer = new THREE.WebGLRenderer({ alpha: false, antialias: false })
const blurScene = new THREE.Scene()
const blurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const blurTexture = new THREE.Texture()
const blurUniforms = {
  u_tex: { value: blurTexture },
  u_res: { value: new THREE.Vector2(1, 1) },
  u_blurAmount: { value: 0 }
}
const blurMaterial = new THREE.ShaderMaterial({
  uniforms: blurUniforms,
  vertexShader: blurVertexShader,
  fragmentShader: blurFragmentShader,
  depthTest: false,
  depthWrite: false
})
const blurState = { amount: 0 }
const statusEl = document.querySelector('#status')
const playButton = document.querySelector('#play-button')
const sampleColor = new THREE.Color()

blurTexture.minFilter = THREE.LinearFilter
blurTexture.magFilter = THREE.LinearFilter
blurTexture.generateMipmaps = false
blurRenderer.setPixelRatio(1)
blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial))

function setStatus (message) {
  if (statusEl) {
    statusEl.textContent = message
  }
}

camera.position.set(0, 0, targetCameraZ)
document.body.prepend(renderer.domElement)

const video = document.createElement('video')
const image = new Image()
let currentMediaIndex = 0
let currentMediaType = getMediaType(getCurrentMediaUrl())
video.muted = true
video.loop = true
video.autoplay = true
video.preload = 'auto'
video.playsInline = true
video.setAttribute('playsinline', '')
video.hidden = true
image.decoding = 'async'
image.hidden = true
document.body.append(video)
document.body.append(image)

let mesh = null
let sampleCanvas = null
let sampleCtx = null
let sampleCount = 0
let lastFrameTime = -1
let blendSourceData = null
let blendStartTime = 0
let needsStaticRefresh = false

function getCurrentMediaUrl () {
  return mediaUrls[currentMediaIndex]
}

function getCurrentMediaName () {
  return getCurrentMediaUrl().split('/').pop()
}

function getMediaType (url) {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) ? 'video' : 'image'
}

function isVideoActive () {
  return currentMediaType === 'video'
}

function getActiveMediaElement () {
  return isVideoActive() ? video : image
}

function getActiveMediaSize () {
  return isVideoActive()
    ? { width: video.videoWidth, height: video.videoHeight }
    : { width: image.naturalWidth, height: image.naturalHeight }
}

function isActiveMediaReady () {
  return isVideoActive()
    ? video.readyState >= video.HAVE_CURRENT_DATA
    : image.complete && image.naturalWidth > 0
}

function projectPoint (x, y, targetZ) {
  const halfHeight = 0.5
  const depth = targetCameraZ
  const distance = -targetZ + depth
  const projectedHeight = (halfHeight / depth) * distance
  const scale = projectedHeight / halfHeight
  return { scale, position: new THREE.Vector3(x * scale, y * scale, targetZ) }
}

function buildMesh (aspectRatio) {
  const rows = sampleRows
  const cols = Math.max(1, Math.round(rows * aspectRatio))
  const geom = new THREE.BoxGeometry(
    instanceSize,
    instanceSize,
    instanceSize
  ).translate(0, 0, -0.5 * instanceSize)
  const mat = new THREE.MeshBasicMaterial()
  const nextMesh = new THREE.InstancedMesh(geom, mat, rows * cols)

  for (let row = 0, index = 0; row < rows; ++row) {
    for (let col = 0; col < cols; ++col) {
      const { position, scale } = projectPoint(
        (col - cols / 2 + 0.5) * instanceSize,
        (rows / 2 - row + 0.5) * instanceSize,
        THREE.MathUtils.randFloatSpread(randRangeZ) * instanceSize
      )
      const matrix = new THREE.Matrix4()
        .setPosition(position)
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
      nextMesh.setMatrixAt(index, matrix)
      nextMesh.setColorAt(index, new THREE.Color('white'))
      index += 1
    }
  }

  nextMesh.instanceMatrix.needsUpdate = true
  nextMesh.instanceColor.needsUpdate = true

  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
  }

  mesh = nextMesh
  scene.add(mesh)

  sampleCanvas = document.createElement('canvas')
  sampleCanvas.width = cols
  sampleCanvas.height = rows
  sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
  sampleCount = cols * rows
  lastFrameTime = -1
  setStatus(
    `Sampling ${cols} x ${rows} particles from ${getCurrentMediaName()}.`
  )
}

function ensureMeshForActiveMedia () {
  if (mesh) {
    return
  }

  const { width, height } = getActiveMediaSize()
  if (width > 0 && height > 0) {
    buildMesh(width / height)
  }
}

function captureBlendSourceData () {
  if (!sampleCtx || !sampleCanvas) {
    return null
  }

  const imageData = sampleCtx.getImageData(
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height
  )
  return new Uint8ClampedArray(imageData.data)
}

function drawBlurredActiveMedia (activeMedia, width, height) {
  blurRenderer.setSize(sampleCanvas.width, sampleCanvas.height, false)
  blurUniforms.u_res.value.set(sampleCanvas.width, sampleCanvas.height)
  blurUniforms.u_blurAmount.value = blurState.amount
  blurTexture.image = activeMedia
  blurTexture.needsUpdate = true
  blurRenderer.render(blurScene, blurCamera)
  sampleCtx.drawImage(
    blurRenderer.domElement,
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height,
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height
  )
}

function refreshParticleColors () {
  if (!mesh || !sampleCtx || !isActiveMediaReady()) {
    return
  }

  const isBlurActive = blurState.amount > 0.001
  const isBlendActive =
    !!blendSourceData &&
    performance.now() - blendStartTime < videoBlendDurationMs

  if (isVideoActive()) {
    if (
      video.currentTime === lastFrameTime &&
      !isBlendActive &&
      !isBlurActive
    ) {
      return
    }
    lastFrameTime = video.currentTime
  } else if (!needsStaticRefresh && !isBlendActive && !isBlurActive) {
    return
  }

  const activeMedia = getActiveMediaElement()
  const { width, height } = getActiveMediaSize()

  if (isBlurActive) {
    drawBlurredActiveMedia(activeMedia, width, height)
  } else {
    sampleCtx.drawImage(
      activeMedia,
      0,
      0,
      width,
      height,
      0,
      0,
      sampleCanvas.width,
      sampleCanvas.height
    )
  }

  const { data } = sampleCtx.getImageData(
    0,
    0,
    sampleCanvas.width,
    sampleCanvas.height
  )

  let blendFactor = 1
  if (blendSourceData && blendSourceData.length === data.length) {
    blendFactor = Math.min(
      (performance.now() - blendStartTime) / videoBlendDurationMs,
      1
    )
  } else {
    blendSourceData = null
  }

  for (let index = 0; index < sampleCount; ++index) {
    const offset = index * 4
    const red =
      blendSourceData && blendFactor < 1
        ? THREE.MathUtils.lerp(
            blendSourceData[offset],
            data[offset],
            blendFactor
          )
        : data[offset]
    const green =
      blendSourceData && blendFactor < 1
        ? THREE.MathUtils.lerp(
            blendSourceData[offset + 1],
            data[offset + 1],
            blendFactor
          )
        : data[offset + 1]
    const blue =
      blendSourceData && blendFactor < 1
        ? THREE.MathUtils.lerp(
            blendSourceData[offset + 2],
            data[offset + 2],
            blendFactor
          )
        : data[offset + 2]

    mesh.setColorAt(
      index,
      sampleColor.setRGB(red / 255, green / 255, blue / 255)
    )
  }

  if (blendSourceData && blendFactor >= 1) {
    blendSourceData = null
  }

  if (!isVideoActive()) {
    needsStaticRefresh = false
  }

  mesh.instanceColor.needsUpdate = true
}

async function startVideoPlayback () {
  try {
    await video.play()
    if (playButton) {
      playButton.hidden = true
    }
    if (mesh) {
      setStatus(
        'Video playback is active. Scroll to move through the particle field.'
      )
    }
  } catch (error) {
    if (playButton) {
      playButton.hidden = false
    }
    setStatus(
      'Autoplay was blocked. Start playback once to animate the particles.'
    )
  }
}

function loadCurrentMedia () {
  currentMediaType = getMediaType(getCurrentMediaUrl())
  lastFrameTime = -1
  needsStaticRefresh = true
  video.pause()
  setStatus(`Loading ${getCurrentMediaName()}...`)

  if (isVideoActive()) {
    video.src = getCurrentMediaUrl()
    video.load()
    startVideoPlayback()
  } else {
    image.src = getCurrentMediaUrl()
    if (playButton) {
      playButton.hidden = true
    }
  }
}

function advanceMediaSource () {
  blendSourceData = captureBlendSourceData()
  blendStartTime = performance.now()
  currentMediaIndex = (currentMediaIndex + 1) % mediaUrls.length
  loadCurrentMedia()
}

function resize (width, height, dpr = devicePixelRatio) {
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function startCameraMotion () {
  gsap
    .timeline({ repeat: -1 })
    .to(camera.position, {
      z: closeCameraZ,
      duration: cameraMotionDurationSec,
      ease: cameraMotionEase
    })
    .to(
      blurState,
      {
        amount: mediaChangeBlurAmount,
        duration: mediaChangeBlurDurationSec,
        ease: 'power2.in'
      },
      cameraMotionDurationSec - mediaChangeBlurDurationSec
    )
    .add(() => {
      advanceMediaSource()
    })
    .to(blurState, {
      amount: 0,
      duration: mediaChangeBlurDurationSec,
      ease: 'power2.out'
    })
    .to(
      camera.position,
      {
        z: targetCameraZ,
        duration: cameraMotionDurationSec,
        ease: cameraMotionEase
      },
      '<'
    )
}

video.addEventListener('loadedmetadata', () => {
  if (!isVideoActive()) {
    return
  }
  ensureMeshForActiveMedia()
})

video.addEventListener('loadeddata', () => {
  if (!isVideoActive()) {
    return
  }
  refreshParticleColors()
})

video.addEventListener('error', () => {
  if (!isVideoActive()) {
    return
  }
  if (playButton) {
    playButton.hidden = true
  }
  setStatus('The video could not be loaded.')
})

image.addEventListener('load', () => {
  if (isVideoActive()) {
    return
  }
  ensureMeshForActiveMedia()
  needsStaticRefresh = true
  refreshParticleColors()
  setStatus(`Displaying ${getCurrentMediaName()}.`)
})

image.addEventListener('error', () => {
  if (isVideoActive()) {
    return
  }
  setStatus('The image could not be loaded.')
})

if (playButton) {
  playButton.addEventListener('click', () => {
    startVideoPlayback()
  })
}

addEventListener('resize', () => resize(innerWidth, innerHeight))
dispatchEvent(new Event('resize'))
loadCurrentMedia()
startCameraMotion()

renderer.setAnimationLoop(() => {
  refreshParticleColors()
  renderer.render(scene, camera)
})
