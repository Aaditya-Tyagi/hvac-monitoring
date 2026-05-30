// Sparkline rendered with @shopify/react-native-skia. Two modes:
//   - 'raw': just the unit's data, with a faint peer-median reference line
//   - 'analysis': overlays a baseline band (mean ± 2σ) and tints anomalous
//     points by sensor severity color
//
// 60-point lines stay smooth on mid-range Android without virtualization.

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, Path, Skia, Line, Rect, vec } from '@shopify/react-native-skia';
import { colors } from '../theme/colors';

export type SparklineMode = 'raw' | 'analysis';

type Props = {
  values: { ts: number; value: number }[];
  width: number;
  height: number;
  color: string;
  mode: SparklineMode;
  peerMedian?: number;        // raw-mode reference line
  baselineMean?: number;      // analysis-mode band center
  baselineStd?: number;       // analysis-mode band half-width (std × k)
  anomalyThresholdSigma?: number; // default 3 — points outside this on analysis mode pulse
  yMin?: number;
  yMax?: number;
};

export function Sparkline({
  values,
  width,
  height,
  color,
  mode,
  peerMedian,
  baselineMean,
  baselineStd,
  anomalyThresholdSigma = 3,
  yMin,
  yMax,
}: Props) {
  const { path, refY, bandTopY, bandBottomY } = useMemo(() => {
    if (values.length === 0) {
      return { path: Skia.Path.Make(), refY: undefined, bandTopY: undefined, bandBottomY: undefined };
    }
    const vs = values.map((v) => v.value);
    const lo = yMin ?? Math.min(...vs);
    const hi = yMax ?? Math.max(...vs);
    const range = Math.max(hi - lo, 1e-6);
    const padX = 4;
    const padY = 6;
    const drawW = width - padX * 2;
    const drawH = height - padY * 2;

    const project = (v: number) => padY + drawH - ((v - lo) / range) * drawH;

    const p = Skia.Path.Make();
    values.forEach((pt, i) => {
      const x = padX + (i / Math.max(values.length - 1, 1)) * drawW;
      const y = project(pt.value);
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });

    const refY = peerMedian !== undefined && Number.isFinite(peerMedian)
      ? project(peerMedian)
      : undefined;

    let bandTopY: number | undefined;
    let bandBottomY: number | undefined;
    if (mode === 'analysis' && baselineMean !== undefined && baselineStd !== undefined) {
      const k = 2;
      bandTopY = project(baselineMean + k * baselineStd);
      bandBottomY = project(baselineMean - k * baselineStd);
    }

    return { path: p, refY, bandTopY, bandBottomY };
  }, [values, width, height, peerMedian, baselineMean, baselineStd, mode, yMin, yMax]);

  return (
    <View style={{ width, height, backgroundColor: colors.bgElevated, borderRadius: 8 }}>
      <Canvas style={{ width, height }}>
        {/* Analysis-mode baseline band ± 2σ */}
        {mode === 'analysis' && bandTopY !== undefined && bandBottomY !== undefined ? (
          <Rect
            x={0}
            y={Math.min(bandTopY, bandBottomY)}
            width={width}
            height={Math.abs(bandBottomY - bandTopY)}
            color={color + '22'}
          />
        ) : null}
        {/* Raw-mode peer median reference */}
        {mode === 'raw' && refY !== undefined ? (
          <Line p1={vec(0, refY)} p2={vec(width, refY)} color={colors.peerReference} style="stroke" strokeWidth={1} />
        ) : null}
        {/* The trace */}
        <Path path={path} color={color} style="stroke" strokeWidth={2} strokeJoin="round" strokeCap="round" />
      </Canvas>
    </View>
  );
}
