import React from 'react';
import ReactECharts from 'echarts-for-react';

interface UsageGaugeChartProps {
  title: string;
  percentUsed: number;
  detailLabel: string;
}

export const UsageGaugeChart: React.FC<UsageGaugeChartProps> = ({ title, percentUsed, detailLabel }) => {
  const progressColor = percentUsed >= 85 ? '#E25A5A' : percentUsed >= 65 ? '#F0A028' : '#3ABE82';

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '90%',
        progress: { show: true, width: 14, itemStyle: { color: progressColor } },
        axisLine: { lineStyle: { width: 14, color: [[1, '#2A2D35']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        title: { fontSize: 13, offsetCenter: [0, '15%'], color: '#C8C5BB' },
        detail: {
          valueAnimation: true,
          formatter: () => detailLabel,
          fontSize: 14,
          offsetCenter: [0, '45%'],
          color: '#F0EEE8',
        },
        data: [{ value: Math.round(percentUsed * 10) / 10, name: title }],
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 200 }} />;
};
