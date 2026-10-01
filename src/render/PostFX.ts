import {
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { HalfFloatType, type Camera, type Scene, type WebGLRenderer } from 'three';
import { POSTFX, QUALITY, type Quality } from '../data/graphics';

/**
 * Post-procesado: bloom suave sobre lo emisivo, tone mapping AgX, corrección de color y viñeta.
 * Se renderiza en buffers de media precisión para que el bloom tenga rango alto.
 */
export class PostFX {
  private composer: EffectComposer;
  private readonly bloom: BloomEffect;
  private readonly tone: ToneMappingEffect;
  private readonly grade: HueSaturationEffect;
  private readonly bc: BrightnessContrastEffect;
  private readonly vignette: VignetteEffect;
  private quality: Quality;

  constructor(
    private readonly gl: WebGLRenderer,
    private readonly scene: Scene,
    private readonly camera: Camera,
    quality: Quality,
  ) {
    this.quality = quality;
    this.bloom = new BloomEffect({
      luminanceThreshold: POSTFX.bloomThreshold,
      luminanceSmoothing: POSTFX.bloomSmoothing,
      intensity: POSTFX.bloomIntensity,
      radius: POSTFX.bloomRadius,
      mipmapBlur: true,
    });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.grade = new HueSaturationEffect({ saturation: POSTFX.saturation });
    this.bc = new BrightnessContrastEffect({
      brightness: POSTFX.brightness,
      contrast: POSTFX.contrast,
    });
    this.vignette = new VignetteEffect({
      offset: POSTFX.vignetteOffset,
      darkness: POSTFX.vignetteDarkness,
    });
    this.composer = this.build();
    this.syncTuning();
  }

  private build(): EffectComposer {
    const preset = QUALITY[this.quality];
    const composer = new EffectComposer(this.gl, {
      frameBufferType: HalfFloatType,
      multisampling: preset.multisampling,
    });
    composer.addPass(new RenderPass(this.scene, this.camera));
    const effects = preset.bloom
      ? [this.bloom, this.tone, this.grade, this.bc, this.vignette]
      : [this.tone, this.grade, this.bc, this.vignette];
    composer.addPass(new EffectPass(this.camera, ...effects));
    return composer;
  }

  setQuality(quality: Quality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.composer.dispose();
    this.composer = this.build();
  }

  /** Aplica los valores de `POSTFX` (para el panel de tuning). */
  syncTuning(): void {
    this.gl.toneMappingExposure = POSTFX.exposure;
    this.bloom.luminanceMaterial.threshold = POSTFX.bloomThreshold;
    this.bloom.luminanceMaterial.smoothing = POSTFX.bloomSmoothing;
    this.bloom.intensity = POSTFX.bloomIntensity;
    this.grade.saturation = POSTFX.saturation;
    this.bc.brightness = POSTFX.brightness;
    this.bc.contrast = POSTFX.contrast;
    this.vignette.offset = POSTFX.vignetteOffset;
    this.vignette.darkness = POSTFX.vignetteDarkness;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(dt: number): void {
    this.composer.render(dt);
  }
}
