import React from 'react';
import ReactECharts from 'echarts-for-react';

interface UsageGaugeChartProps {
  title: string;
  percentUsed: number;
  detailLabel: string;
}

export const UsageGaugeChart: React.FC<UsageGaugeChartProps> = ({ title, percentUsed, detailLabel }) => {
  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '90%',
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        title: { fontSize: 13, offsetCenter: [0, '15%'] },
        detail: {
          valueAnimation: true,
          formatter: () => detailLabel,
          fontSize: 14,
          offsetCenter: [0, '45%'],
        },
        data: [{ value: Math.round(percentUsed * 10) / 10, name: title }],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 200 }} />;
};
