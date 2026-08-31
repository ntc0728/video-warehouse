import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores';
import type { AudioPreset } from '@/stores/usePlayerStore';

/** 各预设对应的三段 EQ 增益（dB）：low(≤200Hz) / mid(≈1kHz) / high(≥3kHz) */
const PRESET_EQ: Record<AudioPreset, { low: number; mid: number; high: number }> = {
  off: { low: 0, mid: 0, high: 0 },
  pop: { low: 3, mid: 1, high: 4 },
  rock: { low: 5, mid: -2, high: 5 },
  classical: { low: 4, mid: 0, high: 4 },
  bass: { low: 8, mid: 0, high: 0 },
  vocal: { low: -2, mid: 5, high: 1 },
  treble: { low: 0, mid: 0, high: 7 },
  '3d': { low: 0, mid: 0, high: 0 },
};

interface GraphNodes {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  delay: DelayNode;
  gain: GainNode;
  panner: StereoPannerNode;
}

/**
 * Issue4 音效调节：通过 Web Audio 图谱把 <video> 的音频路由到
 *   source → 3段EQ → 声道拆分 → (右声道 Haas 延迟) → 合并 → 增益 → 声道平衡 → 输出
 * - 默认（off + balance0 + gain1）时不构建图谱，保留原生音频路径（零风险）。
 * - 仅当用户首次选择非默认音效时才创建 AudioContext / MediaElementSource；
 *   一旦创建，图谱常驻连接（reset 仅置为透传参数），避免重复 createMediaElementSource 报错。
 * - AudioContext 在用户手势（点击预设/拖动滑块）触发的状态变更中 resume，规避自动播放策略。
 */
export function useAudioEffects(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const audioEffect = usePlayerStore((s) => s.audioEffect);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<GraphNodes | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const eq = PRESET_EQ[audioEffect.preset];
    const isDefault =
      audioEffect.preset === 'off' && audioEffect.balance === 0 && audioEffect.gain === 1;

    // 默认态：若图谱已建则置为透传（音频不受影响）；未建则不建（原生音频）。
    if (isDefault) {
      if (nodesRef.current) {
        const { low, mid, high, delay, gain, panner } = nodesRef.current;
        low.gain.value = 0;
        mid.gain.value = 0;
        high.gain.value = 0;
        delay.delayTime.value = 0;
        gain.gain.value = 1;
        panner.pan.value = 0;
      }
      return;
    }

    try {
      let ctx = ctxRef.current;
      if (!ctx) {
        const AC: typeof AudioContext =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        ctxRef.current = ctx;

        // 先建链并连接，最后才创建 MediaElementSource，确保失败时不影响原生音频
        const low = ctx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 200;
        const mid = ctx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 1000;
        mid.Q.value = 0.8;
        const high = ctx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 3000;
        const splitter = ctx.createChannelSplitter(2);
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0;
        const merger = ctx.createChannelMerger(2);
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();

        // 链式连接（source 暂未接入）
        low.connect(mid);
        mid.connect(high);
        high.connect(splitter);
        splitter.connect(merger, 0, 0); // 左声道直通
        splitter.connect(delay, 1); // 右声道经延迟
        delay.connect(merger, 0, 1);
        merger.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);

        // 最后才把 video 接入图谱
        const source = ctx.createMediaElementSource(video);
        source.connect(low);
        sourceRef.current = source;
        nodesRef.current = { low, mid, high, delay, gain, panner };
      }

      void ctx.resume().catch(() => {});
      const nodes = nodesRef.current;
      if (!nodes) return;
      nodes.low.gain.value = eq.low;
      nodes.mid.gain.value = eq.mid;
      nodes.high.gain.value = eq.high;
      // 3D 环绕：右声道加 ~20ms Haas 延迟形成声场宽度；其它预设关闭延迟
      nodes.delay.delayTime.value = audioEffect.preset === '3d' ? 0.02 : 0;
      nodes.gain.gain.value = audioEffect.gain;
      nodes.panner.pan.value = audioEffect.balance;
    } catch {
      // 失败兜底：尽量恢复原生音频（若 source 已建则直连输出，否则保持原生）
      try {
        sourceRef.current?.disconnect();
        sourceRef.current?.connect(ctxRef.current!.destination);
      } catch {
        /* 忽略：原生音频路径本身可用 */
      }
    }
  }, [audioEffect, videoRef]);

  // 卸载清理
  useEffect(() => {
    return () => {
      const ctx = ctxRef.current;
      if (ctx) {
        void ctx.close().catch(() => {});
        ctxRef.current = null;
        nodesRef.current = null;
        sourceRef.current = null;
      }
    };
  }, []);
}
