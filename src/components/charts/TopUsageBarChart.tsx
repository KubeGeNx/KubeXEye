import React from 'react';
import ReactECharts from 'echarts-for-react';

interface TopUsageBarChartProps {
  title: string;
  categories: string[];
  values: number[];
  valueLabel: string;
  formatter?: (value: number) => string;
}

export const TopUsageBarChart: React.FC<TopUsageBarChartProps> = ({
  title,
  categories,
  values,
  valueLabel,
  formatter,
}) => {
  const option = {
    title: { text: title, textStyle: { fontSize: 13, color: '#F0EEE8' } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: formatter,
    },
    grid: { left: 90, right: 20, top: 40, bottom: 20 },
    xAxis: { type: 'value', name: valueLabel, nameTextStyle: { color: '#C8C5BB' }, axisLabel: { color: '#C8C5BB' }, axisLine: { lineStyle: { color: '#4A4D52' } } },
    yAxis: { type: 'category', data: categories, inverse: true, axisLabel: { color: '#C8C5BB' }, axisLine: { lineStyle: { color: '#4A4D52' } } },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: { color: '#7EB6F0', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: Math.max(200, categories.length * 32 + 60) }} />;
};
