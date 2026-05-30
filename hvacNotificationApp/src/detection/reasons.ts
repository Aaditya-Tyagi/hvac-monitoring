// Turns a DetectionResult into 1–3 human-language bullets. These are the
// product. Technicians stopped trusting the old system because alerts had no
// reason — every alert here must answer "what changed, vs what, since when."

import type { SensorKey } from '../datasource/types';
import type { DetectionResult, ReasonCode } from './engine';

const SENSOR_LABEL: Record<SensorKey, string> = {
  temp: 'Temperature',
  pressure: 'Pressure',
  airflow: 'Airflow',
  vibration: 'Vibration',
  power: 'Power',
};

const SENSOR_UNIT: Record<SensorKey, string> = {
  temp: '°C',
  pressure: 'bar',
  airflow: 'CFM',
  vibration: 'g',
  power: 'kW',
};

function fmt(v: number, sensor: SensorKey): string {
  const u = SENSOR_UNIT[sensor];
  // Sensible precision per sensor.
  if (sensor === 'vibration') return `${v.toFixed(3)} ${u}`;
  if (sensor === 'temp') return `${v.toFixed(1)} ${u}`;
  if (sensor === 'pressure') return `${v.toFixed(2)} ${u}`;
  return `${v.toFixed(1)} ${u}`;
}

// One-line headline used on the Fleet card.
export function headline(r: DetectionResult): string {
  if (r.status === 'UNKNOWN') {
    if (r.reasonCodes.includes('cold_start')) return 'Establishing baseline…';
    if (r.reasonCodes.includes('missing_data')) return 'Sensor data unavailable';
    return 'Status unknown';
  }
  if (r.status === 'OK') return 'All sensors nominal';

  // Loudest contributing sensor drives the headline.
  const top = r.contributing[0];
  if (!top) return r.status === 'ACT' ? 'Anomaly detected' : 'Drift detected';

  const sensor = SENSOR_LABEL[top.sensor];
  const peerMult = Math.abs(top.peerZ) >= 2 && top.score > 0;

  if (r.hardOverride) {
    return `${sensor} extreme — multiple sensors off normal`;
  }
  if (peerMult) {
    return `${sensor} drifting from peer baseline`;
  }
  return `${sensor} above unit baseline`;
}

// 1–3 bullet points for the Detail screen and notification body.
export function bullets(r: DetectionResult): string[] {
  if (r.status === 'UNKNOWN') {
    if (r.reasonCodes.includes('cold_start')) {
      return ['Collecting first readings to establish this unit\'s normal range.'];
    }
    if (r.reasonCodes.includes('missing_data')) {
      return ['Too many sensor readings are missing to assess the unit.'];
    }
    return ['Insufficient signal to evaluate.'];
  }

  if (r.status === 'OK') {
    return ['Sensor readings within expected range for this unit and peers.'];
  }

  const out: string[] = [];

  // Up to 3 loudest sensors with concrete numbers.
  const loud = r.contributing.slice(0, 3).filter((c) => c.score > 0.35);
  for (const c of loud) {
    const sensor = SENSOR_LABEL[c.sensor];
    const v = fmt(c.value, c.sensor);
    if (Math.abs(c.peerZ) >= Math.abs(c.baselineZ)) {
      const ratio = Math.abs(c.peerZ) >= 3 ? `${(Math.abs(c.peerZ) / 3 * 3).toFixed(1)}σ` : `${Math.abs(c.peerZ).toFixed(1)}σ`;
      out.push(`${sensor} ${v} — ${ratio} from peer median`);
    } else {
      out.push(`${sensor} ${v} — ${Math.abs(c.baselineZ).toFixed(1)}σ from this unit's baseline`);
    }
  }

  // Add interpretive context, last.
  if (r.hardOverride) {
    out.push('Multiple sensors crossed extreme thresholds in a single reading — acute event suspected.');
  } else if (r.reasonCodes.includes('sustained_drift')) {
    out.push('Anomaly sustained across multiple consecutive readings.');
  } else if (r.reasonCodes.includes('multi_signal_correlation')) {
    out.push('Two or more sensors are abnormal at the same time — likely a real fault, not noise.');
  }

  if (r.reasonCodes.includes('service_overdue_prior')) {
    out.push('Unit is overdue for scheduled service.');
  }

  return out.slice(0, 4);
}

// Compact notification body — single string, one to two short sentences.
export function notificationBody(r: DetectionResult): string {
  const bs = bullets(r);
  return bs.slice(0, 2).join(' · ');
}

// Lookup table for chip rendering in the UI.
export const REASON_LABEL: Record<ReasonCode, string> = {
  cold_start: 'Establishing baseline',
  missing_data: 'Sensor data missing',
  hard_override: 'Acute multi-signal event',
  multi_signal_correlation: 'Multi-signal correlation',
  sustained_drift: 'Sustained drift',
  peer_deviation: 'Peer deviation',
  baseline_deviation: 'Baseline deviation',
  service_overdue_prior: 'Service overdue',
};
