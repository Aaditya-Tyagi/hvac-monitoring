// Tab bar icons drawn with plain Views — no vector-icons / SVG dependency.
// Each component takes { color, size, focused } and renders a small monochrome
// glyph. Tuned to read well at 22–28 px in the bottom tab bar.

import React from 'react';
import { View, type DimensionValue } from 'react-native';

type Props = { color: string; size: number; focused: boolean };

// Fleet: 2×2 grid of rounded squares — "the fleet" of units at a glance.
export function FleetIcon({ color, size }: Props) {
  const cell = size * 0.4;
  const gap = size * 0.1;
  const r = cell * 0.25;
  const box = {
    width: cell,
    height: cell,
    backgroundColor: color,
    borderRadius: r,
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', gap }}>
        <View style={box} />
        <View style={box} />
      </View>
      <View style={{ height: gap }} />
      <View style={{ flexDirection: 'row', gap }}>
        <View style={box} />
        <View style={box} />
      </View>
    </View>
  );
}

// History: stacked bars of decreasing width — like a list of past entries.
export function HistoryIcon({ color, size }: Props) {
  const barH = size * 0.14;
  const barGap = size * 0.11;
  const baseBar = {
    height: barH,
    backgroundColor: color,
    borderRadius: barH / 2,
  };
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <View style={[baseBar, { width: '100%' }]} />
      <View style={{ height: barGap }} />
      <View style={[baseBar, { width: '70%' }]} />
      <View style={{ height: barGap }} />
      <View style={[baseBar, { width: '85%' }]} />
    </View>
  );
}

// Settings: three horizontal sliders with knobs at varied positions — reads
// instantly as "preferences" without being a literal gear.
export function SettingsIcon({ color, size }: Props) {
  const trackH = size * 0.08;
  const knob = size * 0.22;
  const rowGap = size * 0.12;

  function Slider({ knobLeft }: { knobLeft: DimensionValue }) {
    return (
      <View style={{ height: knob, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: trackH,
            backgroundColor: color,
            opacity: 0.5,
            borderRadius: trackH / 2,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: knobLeft,
            width: knob,
            height: knob,
            backgroundColor: color,
            borderRadius: knob / 2,
          }}
        />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size, justifyContent: 'center' }}>
      <Slider knobLeft="60%" />
      <View style={{ height: rowGap }} />
      <Slider knobLeft="25%" />
      <View style={{ height: rowGap }} />
      <Slider knobLeft="70%" />
    </View>
  );
}

// Debug: a play triangle inside a circle — "press play to drive the replay."
export function DebugIcon({ color, size }: Props) {
  const tri = size * 0.45;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size * 0.5,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Play triangle: borders form a right-pointing triangle. */}
        <View
          style={{
            width: 0,
            height: 0,
            marginLeft: tri * 0.18, // optical center
            borderTopWidth: tri * 0.4,
            borderBottomWidth: tri * 0.4,
            borderLeftWidth: tri * 0.6,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: color,
          }}
        />
      </View>
    </View>
  );
}
