import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { ECElementEvent } from 'echarts';

// Fixed step per wheel notch, independent of the browser's reported deltaY magnitude —
// trackpads report large deltaY values that make ECharts' built-in wheel zoom feel wildly
// oversensitive, so zoom is handled manually here with a small, constant step instead.
const ZOOM_STEP_IN = 1.08;
const ZOOM_STEP_OUT = 1 / 1.08;
import { refId, type GraphEdge, type HealthStatus, type NormalizedResource, type ResourceKind, type ResourceRef } from '../../graph/types';

const STATUS_COLOR: Record<HealthStatus, string> = {
  Healthy: '#3ABE82',
  Warning: '#F0A028',
  Error: '#E25A5A',
  Pending: '#7EB6F0',
  Unknown: '#7B7970',
};

const KINDS: ResourceKind[] = [
  'Pod',
  'Deployment',
  'StatefulSet',
  'DaemonSet',
  'ConfigMap',
  'Secret',
  'ServiceAccount',
  'Service',
  'Ingress',
  'PersistentVolumeClaim',
  'StorageClass',
  'Role',
  'RoleBinding',
  'ClusterRole',
  'ClusterRoleBinding',
];

// One distinct color per resource kind, so the graph reads by type at a glance — health status
// is conveyed separately via the node's border color/halo (see itemStyle below) rather than fill.
const KIND_COLOR: Record<ResourceKind, string> = {
  Pod: '#3e8635',
  Deployment: '#06c',
  StatefulSet: '#8481dd',
  DaemonSet: '#009596',
  ConfigMap: '#f0ab00',
  Secret: '#ec7a08',
  ServiceAccount: '#a18fff',
  Service: '#5752d1',
  Ingress: '#0aa3f7',
  PersistentVolumeClaim: '#c46100',
  StorageClass: '#6a6e73',
  Role: '#8bc1f7',
  RoleBinding: '#519de9',
  ClusterRole: '#b2b0ea',
  ClusterRoleBinding: '#f4c145',
};

interface DependencyGraphChartProps {
  nodes: NormalizedResource[];
  edges: GraphEdge[];
  centerRef: ResourceRef;
  onNodeClick: (ref: ResourceRef) => void;
}

export const DependencyGraphChart: React.FC<DependencyGraphChartProps> = ({ nodes, edges, centerRef, onNodeClick }) => {
  const centerId = refId(centerRef);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    const dom = instance.getDom();
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = dom.getBoundingClientRect();
      instance.dispatchAction({
        type: 'graphRoam',
        zoom: event.deltaY < 0 ? ZOOM_STEP_IN : ZOOM_STEP_OUT,
        originX: event.clientX - rect.left,
        originY: event.clientY - rect.top,
      });
    };

    dom.addEventListener('wheel', handleWheel, { passive: false });
    return () => dom.removeEventListener('wheel', handleWheel);
  }, []);

  const refById = useMemo(() => {
    const map = new Map<string, ResourceRef>();
    for (const n of nodes) map.set(refId(n.ref), n.ref);
    return map;
  }, [nodes]);

  const option = useMemo(() => {
    const echartNodes = nodes.map((n) => {
      const id = refId(n.ref);
      const isCenter = id === centerId;
      return {
        id,
        name: n.ref.name,
        category: KINDS.indexOf(n.ref.kind),
        symbolSize: isCenter ? 46 : n.missing ? 32 : 34,
        symbol: n.missing ? 'rect' : 'circle',
        itemStyle: {
          color: KIND_COLOR[n.ref.kind],
          borderColor: n.missing ? '#7d1007' : STATUS_COLOR[n.status],
          borderWidth: n.missing ? 3 : 2,
          borderType: n.missing ? ('dashed' as const) : ('solid' as const),
          shadowColor: isCenter ? '#fff' : undefined,
          shadowBlur: isCenter ? 14 : 0,
          opacity: 1,
        },
        label: {
          show: true,
          formatter: () =>
            `{kind|${n.ref.kind}}\n{name|${n.missing ? `${n.ref.name} ⚠` : n.ref.name}}`,
          rich: {
            kind: {
              color: '#E8E5DE',
              fontSize: 10,
              fontWeight: 'bold' as const,
            },
            name: {
              color: n.missing ? '#E25A5A' : '#A8A59E',
              fontSize: 10,
            },
          },
        },
        tooltip: {
          formatter: () =>
            `<b>${n.ref.kind}</b><br/>${n.ref.namespace ? `ns: ${n.ref.namespace}<br/>` : ''}name: ${n.ref.name}<br/>status: ${n.status}${
              n.statusReason ? `<br/>${n.statusReason}` : ''
            }${n.missing ? '<br/><b style="color:#E25A5A">Not defined in the cluster</b>' : ''}`,
        },
      };
    });

    const echartEdges = edges.map((e) => ({
      source: refId(e.from),
      target: refId(e.to),
      lineStyle: {
        color: e.broken ? '#E25A5A' : '#4A4D52',
        type: e.broken ? ('dashed' as const) : ('solid' as const),
        width: e.broken ? 2 : 1.5,
      },
      label: { show: false },
      tooltip: { formatter: () => `${e.relation}${e.broken ? ' (broken: target not found)' : ''}` },
    }));

    return {
      tooltip: {},
      legend: [
        {
          data: KINDS,
          bottom: 0,
          textStyle: { fontSize: 10, color: '#C8C5BB' },
          type: 'scroll',
        },
      ],
      series: [
        {
          type: 'graph',
          layout: 'force',
          // Wheel-zoom is handled manually (see the wheel listener below) for a gentler, fixed-step
          // zoom — 'move' here keeps ECharts' built-in drag-to-pan but disables its wheel zoom.
          roam: 'move',
          scaleLimit: { min: 0.3, max: 4 },
          draggable: true,
          force: { repulsion: 400, edgeLength: [160, 260], gravity: 0.04 },
          categories: KINDS.map((k) => ({ name: k, itemStyle: { color: KIND_COLOR[k] } })),
          edgeSymbol: ['none', 'arrow'],
          edgeSymbolSize: 8,
          data: echartNodes,
          links: echartEdges,
          lineStyle: { curveness: 0.1 },
        },
      ],
    };
  }, [nodes, edges, centerId]);

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: 480 }}
      onEvents={{
        click: (params: ECElementEvent) => {
          if (params.dataType === 'node') {
            const ref = refById.get(String(params.data && (params.data as { id?: string }).id));
            if (ref) onNodeClick(ref);
          }
        },
      }}
    />
  );
};
